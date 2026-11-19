import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { DeckSpec } from './dynamicDeck';

const W = 960, H = 540;
const hex = (value: string) => { const n = parseInt(value, 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
const C = { navy: hex('0E2841'), blue: hex('408FDE'), light: hex('F2F2F2'), yellow: hex('EAE719'), takeaway: hex('FAF9CA'), text: hex('404040'), muted: hex('7F7F7F'), red: hex('C0392B'), white: rgb(1, 1, 1) };

function wrap(text: string, max: number): string[] {
  const words = String(text || '').split(/\s+/); const lines: string[] = []; let line = '';
  for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > max && line) { lines.push(line); line = word; } else line = next; }
  if (line) lines.push(line); return lines;
}

export async function buildDynamicPdf(spec: DeckSpec): Promise<Buffer> {
  const doc = await PDFDocument.create(); const regular = await doc.embedFont(StandardFonts.Helvetica); const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = (p: any, value: string, x: number, y: number, size: number, color = C.text, isBold = false, max = 90) => wrap(value, max).forEach((line, i) => p.drawText(line, { x, y: y - i * size * 1.18, size, font: isBold ? bold : regular, color }));
  { const p = doc.addPage([W, H]); p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.white }); p.drawRectangle({ x: 50, y: H - 70, width: 4, height: 70, color: C.yellow }); text(p, spec.title, 70, 325, 30, C.navy, true, 42); text(p, spec.subtitle || spec.context || 'Análise executiva FP&A', 70, 220, 18, C.blue, false, 55); text(p, 'V·tal', 825, 505, 27, C.navy, true); }
  spec.slides.forEach((s, index) => { const p = doc.addPage([W, H]); p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.white }); p.drawRectangle({ x: 50, y: H - 65, width: 4, height: 65, color: C.yellow }); text(p, s.title, 70, 510, 25, C.text, true, 58); text(p, s.subtitle || '', 70, 482, 12, C.muted, true, 90); text(p, 'V·tal', 835, 510, 22, C.navy, true);
    let top = 430;
    if (s.kpis?.length) { const items = s.kpis.slice(0, 4); const cw = 820 / items.length; items.forEach((k, i) => { const x = 70 + i * (cw + 8); p.drawRectangle({ x, y: top - 95, width: cw - 8, height: 95, color: C.light }); text(p, k.label, x + 12, top - 20, 10, C.navy, true, 25); text(p, k.value, x + 12, top - 50, 22, k.tone === 'negative' ? C.red : C.navy, true, 18); if (k.note) text(p, k.note, x + 12, top - 75, 8, C.text, false, 28); }); top -= 120; }
    if (s.chart) { const categories = s.chart.categories.slice(0, 15); const series = s.chart.series.slice(0, 4); const max = Math.max(1, ...series.flatMap((v) => v.values.map(Number))); const chartX = 70, chartY = 120, chartW = s.bullets?.length ? 560 : 820, chartH = Math.max(170, top - chartY); const group = chartW / Math.max(1, categories.length); series.forEach((sr, si) => sr.values.slice(0, categories.length).forEach((value, ci) => { const bw = Math.max(4, group / (series.length + 1)); const bh = Number(value) / max * (chartH - 35); p.drawRectangle({ x: chartX + ci * group + si * bw, y: chartY + 25, width: bw - 2, height: bh, color: [C.navy, C.blue, C.yellow, C.red][si] }); })); categories.forEach((c, i) => text(p, c, chartX + i * group, chartY + 12, 7, C.muted, false, 9)); if (s.bullets?.length) s.bullets.slice(0, 6).forEach((b, i) => text(p, `${b.title ? `${b.title}: ` : ''}${b.text}`, 665, top - i * 45, 10, C.text, Boolean(b.title), 38));
    } else if (s.table) { const rows = [s.table.headers, ...s.table.rows.slice(0, 10)]; const cols = Math.max(1, s.table.headers.length); const cellW = 820 / cols; rows.forEach((row, ri) => row.forEach((v, ci) => { const y = top - ri * 30; p.drawRectangle({ x: 70 + ci * cellW, y: y - 23, width: cellW, height: 27, color: ri === 0 ? C.navy : ri % 2 ? C.white : C.light }); text(p, String(v), 75 + ci * cellW, y - 14, cols > 7 ? 7 : 9, ri === 0 ? C.white : C.text, ri === 0, Math.max(8, Math.floor(cellW / 5))); }));
    } else if (s.recommendations?.length) { s.recommendations.slice(0, 5).forEach((r, i) => { const y = top - i * 75; p.drawRectangle({ x: 70, y: y - 55, width: 820, height: 60, color: C.light }); text(p, r.title, 85, y - 18, 13, C.navy, true, 60); text(p, r.detail, 85, y - 40, 9, C.text, false, 75); if (r.badge) text(p, r.badge, 790, y - 27, 11, i === 0 ? C.red : C.navy, true, 15); });
    } else if (s.bullets?.length) s.bullets.slice(0, 8).forEach((b, i) => text(p, `${b.title ? `${b.title}: ` : ''}${b.text}`, 85, top - i * 45, 12, C.text, Boolean(b.title), 90));
    if (s.takeaway) { p.drawRectangle({ x: 70, y: 25, width: 820, height: 45, color: C.takeaway }); text(p, s.takeaway, 90, 52, 11, C.navy, true, 110); }
    text(p, String(index + 2), 900, 18, 7, C.muted);
  });
  return Buffer.from(await doc.save());
}
