import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import { createRequire } from 'node:module';
import { buildUpfrontExecutivePpt } from './executivePpt';
import { buildDynamicDeck, extractDeckSpec } from './dynamicDeck';
import { buildDynamicPdf } from './dynamicPdf';

const require = createRequire(import.meta.url);
const JSZip = createRequire(require.resolve('pptxgenjs'))('jszip');

export interface ChatFilePayload {
  name: string;
  mimeType: string;
  dataBase64?: string;
  url?: string;
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/?\s*>/g, '\t')
    .replace(/<w:br\/?\s*>/g, '\n')
    .replace(/<a:br\/?\s*>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .trim();
}

export async function extractAttachmentContext(files: ChatFilePayload[]): Promise<string> {
  const sections: string[] = [];
  for (const file of files) {
    if (!file.dataBase64) continue;
    const buffer = Buffer.from(file.dataBase64, 'base64');
    const extension = file.name.toLowerCase().split('.').pop() || '';
    let content = '';
    try {
      if (['csv', 'txt', 'json', 'md', 'xml'].includes(extension) || /^text\//i.test(file.mimeType)) {
        content = buffer.toString('utf8');
      } else if (['xlsx', 'xls'].includes(extension)) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        content = workbook.SheetNames.slice(0, 12).map((sheetName) =>
          `ABA ${sheetName}:\n${XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])}`
        ).join('\n\n');
      } else if (extension === 'docx') {
        const zip = await JSZip.loadAsync(buffer);
        const xml = await zip.file('word/document.xml')?.async('string');
        content = xml ? xmlToText(xml) : '';
      } else if (extension === 'pptx') {
        const zip = await JSZip.loadAsync(buffer);
        const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const slides = await Promise.all(slideNames.slice(0, 40).map(async (name, index) =>
          `SLIDE ${index + 1}:\n${xmlToText(await zip.file(name)!.async('string'))}`
        ));
        content = slides.join('\n\n');
      }
    } catch {
      content = '';
    }
    if (content.trim()) {
      sections.push(`\n--- INÍCIO DO ARQUIVO ${file.name} ---\n${content.slice(0, 180_000)}\n--- FIM DO ARQUIVO ${file.name} ---`);
    }
  }
  return sections.join('\n').slice(0, 350_000);
}

export function requestedArtifactFormat(message: string): 'xlsx' | 'pptx' | 'pdf' | null {
  const normalized = message.toLowerCase();
  if (/\b(pdf|relat[oó]rio em pdf)\b/.test(normalized) && /\b(ger|cri|mont|export|baix|cusp)/.test(normalized)) return 'pdf';
  if (/\b(ppt|pptx|powerpoint|apresenta[cç][aã]o|slide)\b/.test(normalized) && /\b(ger|cri|mont|export|baix|cusp)/.test(normalized)) return 'pptx';
  if (/\b(excel|xlsx|planilha)\b/.test(normalized) && /\b(ger|cri|mont|export|baix|cusp)/.test(normalized)) return 'xlsx';
  return null;
}

function cleanCell(value: string): string {
  return value.replace(/\\\$/g, '$').replace(/\*\*/g, '').replace(/`/g, '').trim();
}

export function extractMarkdownTables(markdown: string): string[][][] {
  const lines = markdown.split('\n');
  const tables: string[][][] = [];
  let current: string[][] = [];
  const flush = () => {
    if (current.length >= 2) tables.push(current);
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(cleanCell);
      if (cells.every((cell) => /^[\s:-]+$/.test(cell))) continue;
      current.push(cells);
    } else {
      flush();
    }
  }
  flush();
  return tables;
}

function safeFileStem(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Analise_FPA';
}

export async function buildChatArtifact(format: 'xlsx' | 'pptx' | 'pdf', question: string, answer: string, sourceFiles: ChatFilePayload[] = []): Promise<ChatFilePayload> {
  const stem = safeFileStem(question);
  const tables = extractMarkdownTables(answer);

  if (format === 'xlsx') {
    const workbook = XLSX.utils.book_new();
    if (tables.length > 0) {
      tables.forEach((table, index) => {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(table), `Dados ${index + 1}`.slice(0, 31));
      });
    } else {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Pergunta', question],
        ['Resposta', answer.replace(/\*\*/g, '').replace(/`/g, '')],
      ]), 'Análise');
    }
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return {
      name: `${stem}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dataBase64: buffer.toString('base64'),
    };
  }

  const dynamicSpec = extractDeckSpec(answer);
  if (format === 'pdf') {
    const pdfSpec = dynamicSpec || {
      title: question,
      subtitle: 'Análise executiva FP&A',
      slides: [{
        title: 'Síntese executiva | Resultado da análise',
        subtitle: 'Conteúdo gerado pela inteligência FP&A',
        type: 'content' as const,
        bullets: answer.replace(/\*\*/g, '').split(/\n+/).filter(Boolean).slice(0, 8).map((text) => ({ text })),
      }],
    };
    const pdfBuffer = await buildDynamicPdf(pdfSpec);
    return { name: `${stem}.pdf`, mimeType: 'application/pdf', dataBase64: pdfBuffer.toString('base64') };
  }
  if (dynamicSpec) {
    const dynamicBuffer = await buildDynamicDeck(dynamicSpec);
    return {
      name: `${stem}.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      dataBase64: dynamicBuffer.toString('base64'),
    };
  }

  const executiveBuffer = await buildUpfrontExecutivePpt(question, sourceFiles);
  if (executiveBuffer) {
    return {
      name: `${stem}.pptx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      dataBase64: executiveBuffer.toString('base64'),
    };
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Agente FP&A';
  pptx.subject = question;
  const plain = answer.replace(/\*\*/g, '').replace(/`/g, '').replace(/\|/g, ' ').replace(/\n{3,}/g, '\n\n');
  const chunks = plain.match(/[\s\S]{1,1800}(?:\s|$)/g) || [plain];
  chunks.slice(0, 12).forEach((chunk, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'F7F8F6' };
    slide.addText(index === 0 ? 'Análise FP&A' : 'Análise FP&A · continuação', {
      x: 0.6, y: 0.35, w: 12.1, h: 0.45, fontFace: 'Aptos Display', fontSize: 24, bold: true, color: '14412A',
    });
    if (index === 0) slide.addText(question, { x: 0.6, y: 0.88, w: 12.1, h: 0.48, fontSize: 13, bold: true, color: '334155', margin: 0 });
    slide.addText(chunk.trim(), {
      x: 0.65, y: index === 0 ? 1.5 : 1.05, w: 12, h: index === 0 ? 5.45 : 5.9,
      fontFace: 'Aptos', fontSize: 13, color: '1F2937', breakLine: false, valign: 'top', margin: 0.08,
    });
  });
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
  return {
    name: `${stem}.pptx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    dataBase64: buffer.toString('base64'),
  };
}
