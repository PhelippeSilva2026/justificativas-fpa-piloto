import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

export interface ChatFilePayload {
  name: string;
  mimeType: string;
  dataBase64?: string;
  url?: string;
}

export function requestedArtifactFormat(message: string): 'xlsx' | 'pptx' | null {
  const normalized = message.toLowerCase();
  if (/\b(excel|xlsx|planilha)\b/.test(normalized) && /\b(ger|cri|mont|export|baix|cusp)/.test(normalized)) return 'xlsx';
  if (/\b(ppt|pptx|powerpoint|apresenta[cç][aã]o|slide)\b/.test(normalized) && /\b(ger|cri|mont|export|baix|cusp)/.test(normalized)) return 'pptx';
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

export async function buildChatArtifact(format: 'xlsx' | 'pptx', question: string, answer: string): Promise<ChatFilePayload> {
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
