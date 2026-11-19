import PptxGenJS from 'pptxgenjs';

const C = { navy: '0E2841', blue: '408FDE', blueDark: '185AB3', blueLight: 'B8CBE9', yellow: 'EAE719', takeaway: 'FAF9CA', card: 'F2F2F2', text: '404040', muted: '7F7F7F', red: 'C0392B', white: 'FFFFFF', line: 'D9D9D9' };

export type DeckSpec = {
  title: string; subtitle?: string; context?: string;
  slides: Array<{
    title: string; subtitle?: string; type?: 'summary' | 'chart' | 'table' | 'recommendations' | 'content'; takeaway?: string;
    kpis?: Array<{ label: string; value: string; note?: string; tone?: 'primary' | 'positive' | 'negative' | 'neutral' }>;
    chart?: { type?: 'column' | 'bar' | 'line' | 'stacked'; categories: string[]; series: Array<{ name: string; values: number[] }> };
    table?: { headers: string[]; rows: Array<Array<string | number>>; highlightRow?: number };
    bullets?: Array<{ title?: string; text: string }>;
    recommendations?: Array<{ title: string; detail: string; badge?: string }>;
  }>;
};

export function extractDeckSpec(text: string): DeckSpec | null {
  const match = text.match(/<<<DECK_SPEC_JSON>>>\s*([\s\S]*?)\s*<<<END_DECK_SPEC_JSON>>>/i);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed?.title || !Array.isArray(parsed?.slides) || parsed.slides.length === 0) return null;
    parsed.slides = parsed.slides.slice(0, 15);
    return parsed as DeckSpec;
  } catch { return null; }
}

export function stripDeckSpec(text: string): string {
  return text.replace(/\s*<<<DECK_SPEC_JSON>>>[\s\S]*?<<<END_DECK_SPEC_JSON>>>\s*/gi, '').trim();
}

function chrome(slide: any, title: string, subtitle: string, page: number) {
  slide.background = { color: C.white };
  slide.addShape('rect', { x: 0.68, y: 0, w: 0.05, h: 0.9, fill: { color: C.yellow }, line: { color: C.yellow } });
  slide.addText(title, { x: 0.95, y: 0.28, w: 9.7, h: 0.38, fontFace: 'Arial', fontSize: 25, bold: true, color: C.text, margin: 0, fit: 'shrink' });
  slide.addText(subtitle, { x: 0.95, y: 0.73, w: 10.2, h: 0.28, fontFace: 'Arial', fontSize: 13, bold: true, color: C.muted, margin: 0, fit: 'shrink' });
  slide.addText('V·tal', { x: 11.1, y: 0.18, w: 1.35, h: 0.38, fontFace: 'Arial', fontSize: 25, bold: true, color: C.navy, align: 'right', margin: 0 });
  slide.addText('PÚBLICA', { x: 0.08, y: 7.14, w: 0.55, h: 0.16, fontSize: 7, color: C.muted, margin: 0 });
  slide.addText(String(page), { x: 12.45, y: 7.15, w: 0.3, h: 0.18, fontSize: 8, color: C.muted, align: 'right', margin: 0 });
}

function conclusion(slide: any, text = '') {
  if (!text) return;
  slide.addShape('rect', { x: 0.95, y: 6.65, w: 11.65, h: 0.62, fill: { color: C.takeaway }, line: { color: C.takeaway } });
  slide.addText(text, { x: 1.15, y: 6.81, w: 11.25, h: 0.3, fontFace: 'Arial', fontSize: 13, color: C.navy, bold: true, align: 'center', margin: 0, fit: 'shrink' });
}

function addKpis(slide: any, kpis: NonNullable<DeckSpec['slides'][number]['kpis']>, y = 1.25) {
  const list = kpis.slice(0, 4); const gap = 0.18; const w = (11.65 - gap * (list.length - 1)) / list.length;
  list.forEach((k, i) => { const x = 0.95 + i * (w + gap); const color = k.tone === 'negative' ? C.red : k.tone === 'positive' ? C.blueDark : C.navy;
    slide.addShape('rect', { x, y, w, h: 1.45, fill: { color: C.card }, line: { color: C.card } });
    slide.addText(k.label, { x: x + 0.15, y: y + 0.14, w: w - 0.3, h: 0.24, fontSize: 11, bold: true, color: C.navy, margin: 0, fit: 'shrink' });
    slide.addText(k.value, { x: x + 0.15, y: y + 0.5, w: w - 0.3, h: 0.45, fontSize: 25, bold: true, color, margin: 0, fit: 'shrink' });
    if (k.note) slide.addText(k.note, { x: x + 0.15, y: y + 1.04, w: w - 0.3, h: 0.25, fontSize: 9, color: C.text, margin: 0, fit: 'shrink' });
  });
}

function addChart(slide: any, pptx: PptxGenJS, chart: NonNullable<DeckSpec['slides'][number]['chart']>, y: number, h: number, x = 0.95, w = 7.35) {
  const horizontal = chart.type === 'bar';
  const series = chart.series.slice(0, 5).map((s) => ({ name: s.name, labels: chart.categories.slice(0, 20), values: s.values.slice(0, 20).map(Number) }));
  slide.addChart(chart.type === 'line' ? pptx.ChartType.line : pptx.ChartType.bar, series, {
    x, y, w, h, barDir: horizontal ? 'bar' : 'col', barGrouping: chart.type === 'stacked' ? 'stacked' : 'clustered', barOverlapPct: chart.type === 'stacked' ? 100 : 0,
    showLegend: series.length > 1, legendPos: 't', showValue: chart.categories.length <= 12, dataLabelPosition: chart.type === 'stacked' ? 'ctr' : 'outEnd', dataLabelFormatCode: '#,##0.0;-#,##0.0;',
    chartColors: [C.navy, C.blue, C.blueLight, C.yellow, C.red], catAxisLabelFontSize: chart.categories.length > 12 ? 7 : 9, valAxisLabelFontSize: 8, valGridLine: { color: C.line }, showTitle: false,
  });
}

function addBullets(slide: any, bullets: NonNullable<DeckSpec['slides'][number]['bullets']>, x: number, y: number, w: number, h: number) {
  const runs = bullets.slice(0, 7).map((b) => `${b.title ? `${b.title}: ` : ''}${b.text}`).join('\n\n');
  slide.addText(runs, { x, y, w, h, fontFace: 'Arial', fontSize: 11, color: C.text, bullet: { type: 'bullet' }, breakLine: false, margin: 0.05, valign: 'top', fit: 'shrink', paraSpaceAfterPt: 5 });
}

export async function buildDynamicDeck(spec: DeckSpec): Promise<Buffer> {
  const pptx = new PptxGenJS(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Agente FP&A'; pptx.subject = spec.title; pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'pt-BR' } as any;
  { const s = pptx.addSlide(); s.background = { color: C.white };
    s.addShape('ellipse', { x: 8.0, y: -1.0, w: 5.2, h: 9.3, line: { color: C.navy, transparency: 12, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('ellipse', { x: 9.1, y: -1.35, w: 4.2, h: 9.9, line: { color: C.blue, transparency: 18, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('ellipse', { x: 10.15, y: -1.1, w: 3.2, h: 9.25, line: { color: C.blueLight, transparency: 12, pt: 3 }, fill: { color: C.white, transparency: 100 } });
    s.addShape('rect', { x: 0.68, y: 0, w: 0.05, h: 0.9, fill: { color: C.yellow }, line: { color: C.yellow } });
    s.addText(spec.title, { x: 0.84, y: 2.75, w: 6.3, h: 1.15, fontFace: 'Arial', fontSize: 27, bold: true, color: '001D61', margin: 0, valign: 'middle', fit: 'shrink' });
    s.addText(spec.subtitle || spec.context || 'Análise executiva FP&A', { x: 0.84, y: 4.45, w: 5.3, h: 0.62, fontSize: 17, color: C.blue, margin: 0, fit: 'shrink' });
    s.addText('V·tal', { x: 11.15, y: 0.25, w: 1.25, h: 0.45, fontSize: 28, bold: true, color: C.navy, align: 'right', margin: 0 });
  }
  spec.slides.forEach((item, idx) => { const s = pptx.addSlide(); chrome(s, item.title, item.subtitle || '', idx + 2); let y = 1.25;
    if (item.kpis?.length) { addKpis(s, item.kpis, y); y += 1.7; }
    if (item.type === 'recommendations' || item.recommendations?.length) {
      (item.recommendations || []).slice(0, 4).forEach((r, i) => { const ry = 1.25 + i * 1.33; s.addShape('rect', { x: 0.95, y: ry, w: 11.65, h: 1.08, fill: { color: C.card }, line: { color: C.card } }); s.addText(r.title, { x: 1.15, y: ry + 0.16, w: 8.6, h: 0.25, fontSize: 14, bold: true, color: C.navy, margin: 0, fit: 'shrink' }); s.addText(r.detail, { x: 1.15, y: ry + 0.56, w: 8.8, h: 0.24, fontSize: 10.5, color: C.text, margin: 0, fit: 'shrink' }); if (r.badge) { s.addShape('rect', { x: 10.45, y: ry + 0.15, w: 1.55, h: 0.75, fill: { color: i === 0 ? C.yellow : C.navy }, line: { color: i === 0 ? C.yellow : C.navy } }); s.addText(r.badge, { x: 10.55, y: ry + 0.36, w: 1.35, h: 0.25, fontSize: 13, bold: true, color: i === 0 ? C.navy : C.white, align: 'center', margin: 0, fit: 'shrink' }); } });
    } else if (item.table) {
      const rows = [item.table.headers, ...item.table.rows.slice(0, 12)]; const cols = Math.max(1, item.table.headers.length); const tableW = item.chart ? 6.2 : 11.65;
      s.addTable(rows as any, { x: 0.95, y, w: tableW, h: Math.min(4.8, rows.length * 0.36), fontFace: 'Arial', fontSize: cols > 8 ? 7.5 : 9.5, color: C.text, border: { pt: 0.5, color: C.line }, fill: { color: C.white }, margin: 0.05, bold: false });
      if (item.chart) addChart(s, pptx, item.chart, y, 4.8, 7.45, 5.15);
      else if (item.bullets?.length) addBullets(s, item.bullets, 0.95, y + Math.min(4.0, rows.length * 0.36) + 0.25, 11.3, 1.1);
    } else if (item.chart) {
      addChart(s, pptx, item.chart, y, 5.0, 0.95, item.bullets?.length ? 7.45 : 11.35);
      if (item.bullets?.length) addBullets(s, item.bullets, 8.7, y + 0.25, 3.5, 4.4);
    } else if (item.bullets?.length) addBullets(s, item.bullets, 1.15, y + 0.2, 10.7, 4.9);
    conclusion(s, item.takeaway || '');
  });
  return await pptx.write({ outputType: 'nodebuffer' }) as Buffer;
}
