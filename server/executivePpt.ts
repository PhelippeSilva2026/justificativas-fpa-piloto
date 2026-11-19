import XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import type { ChatFilePayload } from './chatArtifacts';

const C = { navy: '0E2841', blue: '408FDE', blueDark: '185AB3', blueLight: 'B8CBE9', green: 'EAE719', ink: '404040', gray: '7F7F7F', pale: 'F2F2F2', yellow: 'FAF9CA', red: 'C0392B', white: 'FFFFFF', line: 'D9D9D9' };
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type UpfrontData = {
  request: number; integral: number; h1: number; difference: number;
  mobile: number; venue: number; weighted: number; implicit: number; maxBase: number;
  active: number; target: number; residual: number;
  mobileMonthly: number[]; venueMonthly: number[]; requestMonthly: number[]; h1Monthly: number[];
  baseContracts: { id: string; value: number }[];
  scenarios: { label: string; contracts: number; unit: number; total: number; share: number }[];
};

function num(value: unknown): number {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').replace(/R\$/gi, '').replace(/\s/g, '').replace(/%/g, '');
  if (!raw || raw === '-') return 0;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.includes(',') ? raw.replace(',', '.') : raw;
  return Number(normalized.replace(/[^0-9.-]/g, '')) || 0;
}

function readUpfront(files: ChatFilePayload[]): UpfrontData | null {
  const source = files.find((f) => f.dataBase64 && /\.xlsx?$/i.test(f.name));
  if (!source?.dataBase64) return null;
  try {
    const wb = XLSX.read(Buffer.from(source.dataBase64, 'base64'), { type: 'buffer' });
    const envio = wb.Sheets['Envio'];
    const bp = wb.Sheets['BP Consolidado'];
    if (!envio || !bp) return null;
    const e = XLSX.utils.sheet_to_json(envio, { header: 1, raw: true, defval: '' }) as unknown[][];
    const b = XLSX.utils.sheet_to_json(bp, { header: 1, raw: true, defval: '' }) as unknown[][];
    const mobileMonthly = e[1].slice(2, 14).map(num);
    const venueMonthly = e[2].slice(2, 14).map(num);
    const baseContracts = e.slice(18, 36).map((r) => ({ id: String(r[2] ?? ''), value: num(r[3]) })).filter((r) => r.id && r.value);
    const scenarios = b.slice(19, 24).map((r) => ({ label: String(r[0]), contracts: num(r[1]), unit: num(r[2]), total: num(r[3]), share: num(r[4]) / (String(r[4]).includes('%') ? 100 : 1) }));
    return {
      request: num(b[5][1]), integral: num(b[5][2]), h1: num(b[5][3]), difference: num(b[35][13]),
      mobile: num(e[1][14]), venue: num(e[2][14]), weighted: num(b[11][2]), implicit: num(b[11][1]), maxBase: num(b[12][2]),
      active: num(b[13][2]), target: num(b[13][1]), residual: num(b[2][1]),
      mobileMonthly, venueMonthly, requestMonthly: b[34].slice(1, 13).map(num), h1Monthly: b[33].slice(1, 13).map(num),
      baseContracts, scenarios,
    };
  } catch { return null; }
}

function money(value: number, digits = 1): string {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mn`;
  return `R$ ${(value / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} mil`;
}

function addChrome(slide: any, title: string, subtitle: string, page: number) {
  slide.background = { color: C.white };
  slide.addShape('rect', { x: 0.68, y: 0, w: 0.05, h: 0.9, fill: { color: C.green }, line: { color: C.green } });
  slide.addText(title, { x: 0.95, y: 0.28, w: 9.7, h: 0.38, fontFace: 'Arial', fontSize: 25, bold: true, color: C.ink, margin: 0 });
  slide.addText(subtitle, { x: 0.95, y: 0.73, w: 10.3, h: 0.28, fontFace: 'Arial', fontSize: 13, bold: true, color: C.gray, margin: 0 });
  slide.addText('V·tal', { x: 11.1, y: 0.18, w: 1.35, h: 0.38, fontFace: 'Arial', fontSize: 25, bold: true, color: C.navy, align: 'right', margin: 0 });
  slide.addText('PÚBLICA', { x: 0.08, y: 7.14, w: 0.55, h: 0.16, fontSize: 7, color: C.gray, margin: 0 });
  slide.addText(String(page), { x: 12.45, y: 7.15, w: 0.3, h: 0.18, fontSize: 8, color: C.gray, align: 'right', margin: 0 });
}

function card(slide: any, x: number, y: number, w: number, h: number, label: string, value: string, note: string, color = C.navy) {
  slide.addShape('rect', { x, y, w, h, fill: { color: C.pale }, line: { color: C.pale } });
  slide.addText(label, { x: x + 0.18, y: y + 0.16, w: w - 0.36, h: 0.26, fontSize: 12, bold: true, color: C.navy, margin: 0 });
  slide.addText(value, { x: x + 0.18, y: y + 0.55, w: w - 0.36, h: 0.48, fontSize: 28, bold: true, color, margin: 0 });
  slide.addText(note, { x: x + 0.18, y: y + 1.22, w: w - 0.36, h: h - 1.34, fontSize: 10, color: C.ink, margin: 0.02, valign: 'top' });
}

function takeaway(slide: any, text: string) {
  slide.addShape('rect', { x: 0.95, y: 6.65, w: 11.65, h: 0.62, fill: { color: C.yellow }, line: { color: C.yellow } });
  slide.addText(text, { x: 1.15, y: 6.84, w: 11.25, h: 0.25, fontSize: 13, color: C.navy, align: 'center', margin: 0 });
}

function addTable(slide: any, rows: (string | number)[][], opts: any) {
  slide.addTable(rows, { border: { type: 'solid', pt: 0.5, color: C.white }, fontSize: 9.5, color: C.ink,
    fill: C.white, margin: 0.05, rowH: 0.34, fontFace: 'Arial', ...opts,
    bold: false, autoFit: false,
  });
}

export async function buildUpfrontExecutivePpt(question: string, files: ChatFilePayload[]): Promise<Buffer | null> {
  const d = readUpfront(files);
  if (!d) return null;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Agente FP&A'; pptx.subject = question; pptx.company = 'FP&A Intelligence';
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'pt-BR' } as any;

  { const s = pptx.addSlide(); s.background = { color: C.white };
    s.addShape('ellipse', { x: 8.0, y: -1.0, w: 5.2, h: 9.3, line: { color: C.navy, transparency: 12, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('ellipse', { x: 9.1, y: -1.35, w: 4.2, h: 9.9, line: { color: C.blue, transparency: 18, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('ellipse', { x: 10.15, y: -1.1, w: 3.2, h: 9.25, line: { color: C.blueLight, transparency: 12, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('rect', { x: 0.68, y: 0, w: 0.05, h: 0.9, fill: { color: C.green }, line: { color: C.green } });
    s.addText('BUDGET 2027 · UPFRONT', { x: 0.84, y: 2.55, w: 5.8, h: 0.25, fontSize: 11, bold: true, color: C.blueDark, charSpacing: 1.5, margin: 0 });
    s.addText('Budget 2027 | Upfront\nMobile Solutions e Smart Venue', { x: 0.84, y: 2.95, w: 6.25, h: 1.05, fontSize: 25, bold: true, color: '001D61', margin: 0, valign: 'middle' });
    s.addText('FP&A – Validação do pleito\nNovembro de 2026', { x: 0.84, y: 4.55, w: 4.8, h: 0.62, fontSize: 17, color: C.blue, margin: 0 });
    s.addText('V·tal', { x: 11.15, y: 0.25, w: 1.25, h: 0.45, fontSize: 28, bold: true, color: C.navy, align: 'right', margin: 0 });
    s.addText('PÚBLICA', { x: 0.08, y: 7.14, w: 0.55, h: 0.16, fontSize: 7, color: C.gray, margin: 0 });
  }

  { const s = pptx.addSlide(); addChrome(s, 'Resumo executivo | Pleito vs. projeção FP&A', 'R$ mil · Budget 2027', 2);
    card(s, 0.95, 1.25, 2.65, 2.1, 'Pleito da área', money(d.request), `Mobile Solutions ${money(d.mobile)} + Smart Venue ${money(d.venue)}`);
    card(s, 3.8, 1.25, 2.65, 2.1, 'Projeção integral FP&A', money(d.integral), `${Math.round(d.integral / d.request * 100)}% do pleito; ${d.target} contratos ao custo médio`, C.blue);
    card(s, 0.95, 3.55, 2.65, 2.1, 'Projeção H1 FP&A', money(d.h1), `${Math.round(d.h1 / d.request * 100)}% do pleito; assinaturas até jun/27`, C.blue);
    card(s, 3.8, 3.55, 2.65, 2.1, 'Diferença vs. H1', money(d.request - d.h1), `Pleito ${(d.request / d.h1).toFixed(1).replace('.', ',')}x a projeção H1`, C.red);
    s.addChart(pptx.ChartType.bar, [{ name: 'R$ mil', labels: ['Pleito', 'Projeção integral', 'Projeção H1'], values: [d.request / 1000, d.integral / 1000, d.h1 / 1000] }], { x: 7.0, y: 1.35, w: 5.15, h: 4.5, barDir: 'col', catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, showLegend: false, showTitle: false, showValue: true, dataLabelPosition: 'outEnd', chartColors: [C.navy, C.blue, C.green], showValAxisTitle: false, showCatAxisTitle: false, valGridLine: { color: C.line } });
    takeaway(s, `O pleito de ${money(d.request)} é ${(d.request / d.integral).toFixed(1).replace('.', ',')}x a projeção integral e ${(d.request / d.h1).toFixed(1).replace('.', ',')}x a curva H1; o desvio está no custo implícito por contrato.`);
  }

  { const s = pptx.addSlide(); addChrome(s, 'Composição do pleito | Curva mensal por produto', 'R$ mil · valores enviados pela área', 3);
    s.addChart(pptx.ChartType.bar, [
      { name: 'Mobile Solutions', labels: MONTHS, values: d.mobileMonthly.map((v) => v / 1000) },
      { name: 'Smart Venue', labels: MONTHS, values: d.venueMonthly.map((v) => v / 1000) },
    ], { x: 0.95, y: 1.35, w: 7.45, h: 4.75, barDir: 'col', barGrouping: 'stacked', barOverlapPct: 100, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, showLegend: true, legendPos: 't', showTitle: false, showValue: true, dataLabelPosition: 'ctr', dataLabelColor: C.white, dataLabelFormatCode: '0;-0;', chartColors: [C.navy, C.blue], valGridLine: { color: C.line }, showCatAxisTitle: false, showValAxisTitle: false });
    addTable(s, [['Produto', 'Total 2027', '% pleito'], ['Mobile Solutions', Math.round(d.mobile / 1000), `${Math.round(d.mobile / d.request * 100)}%`], ['Smart Venue', Math.round(d.venue / 1000), `${Math.round(d.venue / d.request * 100)}%`], ['Total pleito', Math.round(d.request / 1000), '100%']], { x: 8.75, y: 1.45, w: 3.65, h: 1.45, colW: [1.85, 1.0, 0.8], fill: C.white, bold: false, color: C.ink, border: { pt: 0.5, color: C.line } });
    s.addText('Leitura da curva', { x: 8.75, y: 3.18, w: 2.3, h: 0.3, fontSize: 15, bold: true, color: C.navy, margin: 0 });
    s.addText([{ text: 'Mobile Solutions', options: { bold: true } }, { text: ' cresce em degraus trimestrais e atinge o pico no 4º tri.\n\n' }, { text: 'Smart Venue', options: { bold: true } }, { text: ' concentra desembolsos entre abril e setembro.\n\n' }, { text: 'Premissa', options: { bold: true } }, { text: ': taxa de adesão paga na assinatura do contrato.' }], { x: 8.75, y: 3.62, w: 3.55, h: 1.95, fontSize: 11, color: C.ink, margin: 0.02, breakLine: false, valign: 'top' });
    takeaway(s, `Mobile Solutions representa ${Math.round(d.mobile / d.request * 100)}% do pleito e Smart Venue ${Math.round(d.venue / d.request * 100)}%; a concentração temporal aumenta o risco de execução.`);
  }

  { const s = pptx.addSlide(); addChrome(s, 'Premissas | Custo por contrato e volume', `Base de ${d.active} contratos ativos com apropriação em 2027`, 4);
    const top = [...d.baseContracts].sort((a, b) => b.value - a.value);
    s.addChart(pptx.ChartType.bar, [{ name: 'R$ mil', labels: top.map((r) => r.id), values: top.map((r) => r.value / 1000) }], { x: 0.95, y: 1.35, w: 5.2, h: 4.75, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0', chartColors: [C.blue], valGridLine: { color: C.line }, catAxisLabelRotate: 0 });
    card(s, 6.45, 1.35, 1.75, 1.25, 'Custo implícito', money(d.implicit), 'por contrato no pleito', C.red);
    card(s, 8.4, 1.35, 1.75, 1.25, 'Média ponderada', money(d.weighted), 'base atual', C.blue);
    card(s, 10.35, 1.35, 1.75, 1.25, 'Pleito vs. média', `${(d.implicit / d.weighted).toFixed(1).replace('.', ',')}x`, 'descolamento', C.navy);
    addTable(s, [['Indicador', 'Pleito/meta', 'Base', 'Diferença'], ['Custo implícito vs. média', money(d.implicit), money(d.weighted), money(d.implicit - d.weighted)], ['Custo implícito vs. maior base', money(d.implicit), money(d.maxBase), money(d.implicit - d.maxBase)], ['Quantidade de contratos', d.target, d.active, d.target - d.active]], { x: 6.45, y: 3.0, w: 5.65, h: 1.55, colW: [2.45, 1.15, 1.0, 1.05], border: { pt: 0.5, color: C.line } });
    s.addText('O que precisa ser validado', { x: 6.45, y: 4.85, w: 2.8, h: 0.28, fontSize: 15, bold: true, color: C.navy, margin: 0 });
    s.addText(`• Critério para o custo unitário de ${money(d.implicit)}\n• Evidência do pipeline de ${d.target} contratos\n• Abertura por empreendimento e prazo de apropriação`, { x: 6.45, y: 5.18, w: 5.35, h: 0.9, fontSize: 11, color: C.ink, margin: 0.02 });
    takeaway(s, `O custo implícito de ${money(d.implicit)} por contrato supera a média ponderada em ${Math.round((d.implicit / d.weighted - 1) * 100)}%; a premissa exige justificativa da área.`);
  }

  { const s = pptx.addSlide(); addChrome(s, 'Cenários | Total 2027 com saldo de 2026', 'R$ mil · combinações de volume e custo unitário', 5);
    const rows: (string | number)[][] = [['Cenário', 'Contratos', 'Custo unit.', 'Total', '% pleito'], ...d.scenarios.map((r) => [r.label, r.contracts, Math.round(r.unit / 1000), Math.round(r.total / 1000), `${Math.round(r.share * 100)}%`])];
    addTable(s, rows, { x: 0.95, y: 1.4, w: 6.2, h: 2.2, colW: [3.15, 0.75, 0.8, 0.75, 0.75], border: { pt: 0.5, color: C.line } });
    s.addText('Como ler', { x: 0.95, y: 4.05, w: 1.4, h: 0.28, fontSize: 15, bold: true, color: C.navy, margin: 0 });
    s.addText(`• Projeção integral: ${d.target} contratos por 12 meses ao custo médio\n• Curva H1: assinaturas entre janeiro e junho, apropriadas a partir do mês de entrada\n• O saldo diferido de 2026 (${money(d.residual)}) está incluído em todos os cenários`, { x: 0.95, y: 4.43, w: 5.9, h: 1.15, fontSize: 11, color: C.ink, margin: 0.02 });
    s.addChart(pptx.ChartType.bar, [{ name: 'R$ mil', labels: d.scenarios.map((r) => r.label), values: d.scenarios.map((r) => r.total / 1000) }], { x: 7.55, y: 1.35, w: 4.75, h: 4.8, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, showLegend: false, showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0', chartColors: [C.blue], valGridLine: { color: C.line } });
    takeaway(s, `Com ${d.target} contratos ao custo médio, o total fica entre ${money(d.h1)} e ${money(d.integral)}, contra ${money(d.request)} pleiteados.`);
  }

  { const s = pptx.addSlide(); addChrome(s, 'Curva mensal | Pleito vs. projeção H1', `${d.target} assinaturas no 1º semestre mais saldo diferido de 2026`, 6);
    s.addChart(pptx.ChartType.bar, [
      { name: 'Pleito original', labels: MONTHS, values: d.requestMonthly.map((v) => v / 1000) },
      { name: 'Projeção H1 + saldo 2026', labels: MONTHS, values: d.h1Monthly.map((v) => v / 1000) },
    ], { x: 0.95, y: 1.35, w: 11.35, h: 3.7, barDir: 'col', barGrouping: 'clustered', catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, showLegend: true, legendPos: 't', showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0', chartColors: [C.blueLight, C.navy], valGridLine: { color: C.line } });
    const diff = d.requestMonthly.map((v, i) => v - d.h1Monthly[i]);
    addTable(s, [['R$ mil', ...MONTHS, 'Total'], ['Pleito', ...d.requestMonthly.map((v) => Math.round(v / 1000)), Math.round(d.request / 1000)], ['Projeção H1', ...d.h1Monthly.map((v) => Math.round(v / 1000)), Math.round(d.h1 / 1000)], ['Diferença', ...diff.map((v) => Math.round(v / 1000)), Math.round((d.request - d.h1) / 1000)]], { x: 0.95, y: 5.28, w: 11.35, h: 1.05, colW: [1.25, ...Array(12).fill(0.69), 1.0], fontSize: 7.5, border: { pt: 0.4, color: C.line } });
    takeaway(s, `A curva H1 fica ${money(d.request - d.h1)} abaixo do pleito e ${money(d.integral - d.h1)} abaixo da projeção integral.`);
  }

  { const s = pptx.addSlide(); addChrome(s, 'Recomendação | Próximos passos', 'Proposta FP&A para o upfront no Budget 2027', 7);
    const items = [
      ['Considerar a curva H1 no Budget 2027', `${d.target} contratos ao custo médio + saldo diferido de 2026`, money(d.h1)],
      ['Justificar o custo por contrato', `Explicar ${money(d.implicit)} por contrato contra ${money(d.weighted)} da base`, `${(d.implicit / d.weighted).toFixed(1).replace('.', ',')}x`],
      ['Abrir as premissas de Smart Venue', 'Detalhar número de venues, valor por venue e cronograma de desembolso', money(d.venue)],
      ['Confirmar o cronograma de assinaturas', `A curva H1 pressupõe ${d.target} assinaturas até jun/27; base atual: ${d.active}`, `${d.target} / ${d.active}`],
    ];
    items.forEach((it, i) => { const y = 1.25 + i * 1.35; s.addShape('rect', { x: 0.95, y, w: 11.35, h: 1.08, fill: { color: C.pale }, line: { color: C.pale } }); s.addText(it[0], { x: 1.15, y: y + 0.14, w: 7.9, h: 0.25, fontSize: 14, bold: true, color: C.navy, margin: 0 }); s.addText(it[1], { x: 1.15, y: y + 0.53, w: 8.9, h: 0.24, fontSize: 10.5, color: C.ink, margin: 0 }); s.addShape('rect', { x: 10.45, y: y + 0.15, w: 1.35, h: 0.75, fill: { color: i === 0 ? C.green : C.navy }, line: { color: i === 0 ? C.green : C.navy } }); s.addText(it[2], { x: 10.52, y: y + 0.36, w: 1.21, h: 0.26, fontSize: 13, bold: true, color: i === 0 ? C.navy : C.white, align: 'center', margin: 0 }); });
    takeaway(s, `Proposta: incluir ${money(d.h1)} no Budget 2027 e reabrir o valor somente com justificativa do custo por contrato e evidência do pipeline.`);
  }
  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
}
