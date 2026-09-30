import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import opentype, { type Font } from 'opentype.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeXml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let regularFont: Font | null = null;
let boldFont: Font | null = null;
let fontsInitialized = false;

function parseTtfFile(filePath: string): Font | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return opentype.parse(arrayBuffer);
  } catch (err) {
    console.warn('[ChartRenderer] Falha ao fazer parse da fonte TTF:', filePath, err);
    return null;
  }
}

function ensureVectorFontsLoaded() {
  if (fontsInitialized && (regularFont || boldFont)) return;
  fontsInitialized = true;

  const regularCandidates = [
    path.resolve(__dirname, 'fonts', 'DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'server', 'fonts', 'DejaVuSans.ttf'),
    path.resolve(__dirname, '..', 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf'),
    path.resolve(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf'),
  ];
  const boldCandidates = [
    path.resolve(__dirname, 'fonts', 'DejaVuSans-Bold.ttf'),
    path.resolve(process.cwd(), 'server', 'fonts', 'DejaVuSans-Bold.ttf'),
    path.resolve(__dirname, '..', 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans-Bold.ttf'),
    path.resolve(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans-Bold.ttf'),
  ];

  for (const p of regularCandidates) {
    const f = parseTtfFile(p);
    if (f) {
      regularFont = f;
      break;
    }
  }

  for (const p of boldCandidates) {
    const f = parseTtfFile(p);
    if (f) {
      boldFont = f;
      break;
    }
  }
}

/**
 * Converte texto em <path d="..." /> vetorial puro usando opentype.js + DejaVuSans.ttf (charToGlyph).
 * Evita tabelas GSUB/Bidi incompatíveis e elimina 100% da dependência de fontes instaladas no sistema operacional
 * (Cloud Run / Render / Docker), garantindo que nunca apareçam "quadradinhos" (tofu □□□□) nos gráficos do Word.
 */
function renderSvgText(params: {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight?: 'normal' | 'bold';
  textAnchor?: 'start' | 'middle' | 'end';
}): string {
  const { text, x, y, fontSize, fill, fontWeight = 'normal', textAnchor = 'start' } = params;
  if (!text) return '';

  ensureVectorFontsLoaded();
  const font = fontWeight === 'bold' ? boldFont || regularFont : regularFont || boldFont;

  if (font) {
    try {
      const cleanText = String(text);
      const scale = (1 / font.unitsPerEm) * fontSize;
      const glyphs = Array.from(cleanText).map((ch) => {
        try {
          return font.charToGlyph(ch);
        } catch {
          return font.charToGlyph(' ');
        }
      });

      let totalWidth = 0;
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        totalWidth += (g.advanceWidth || 0) * scale;
        if (i < glyphs.length - 1) {
          try {
            totalWidth += font.getKerningValue(g, glyphs[i + 1]) * scale;
          } catch {}
        }
      }

      let curX = x;
      if (textAnchor === 'middle') {
        curX = x - totalWidth / 2;
      } else if (textAnchor === 'end') {
        curX = x - totalWidth;
      }

      const fullPath = new opentype.Path();
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        try {
          const gp = g.getPath(curX, y, fontSize);
          fullPath.extend(gp);
        } catch {}
        curX += (g.advanceWidth || 0) * scale;
        if (i < glyphs.length - 1) {
          try {
            curX += font.getKerningValue(g, glyphs[i + 1]) * scale;
          } catch {}
        }
      }

      const d = fullPath.toPathData(2);
      if (d) {
        return `<path d="${d}" fill="${fill}" />`;
      }
    } catch (err) {
      console.warn('[ChartRenderer] Erro ao converter texto em path:', err);
    }
  }

  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}" text-anchor="${textAnchor}" fill="${fill}">${escapeXml(text)}</text>`;
}

export interface WaterfallBar {
  label: string;
  value: number;
  isTotal?: boolean;
  displayValue?: string;
}

export interface WaterfallOptions {
  title?: string;
  width?: number;
  height?: number;
  unit?: string;
  bars: WaterfallBar[];
}

/**
 * Renderiza um gráfico de cascata (waterfall) financeiro em SVG (com textos vetoriais em <path>) e converte para Buffer PNG de alta resolução
 */
export async function renderWaterfallChart(options: WaterfallOptions): Promise<Buffer> {
  const width = options.width || 560;
  const height = options.height || 220;
  const padding = { top: 35, right: 25, bottom: 45, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { bars } = options;
  if (!bars.length) {
    const emptySvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/></svg>`;
    return sharp(Buffer.from(emptySvg), { density: 192 }).png().toBuffer();
  }

  // Calcula valores acumulados
  let currentVal = 0;
  const computedBars: Array<{
    label: string;
    value: number;
    start: number;
    end: number;
    isTotal: boolean;
    displayValue: string;
    isPositive: boolean;
  }> = [];

  let minVal = 0;
  let maxVal = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (bar.isTotal) {
      const start = 0;
      const end = bar.value;
      currentVal = bar.value;
      computedBars.push({
        label: bar.label,
        value: bar.value,
        start,
        end,
        isTotal: true,
        displayValue:
          bar.displayValue ||
          (bar.value < 0
            ? `(${Math.abs(bar.value).toFixed(1).replace('.', ',')})`
            : bar.value.toFixed(1).replace('.', ',')),
        isPositive: bar.value >= 0,
      });
      minVal = Math.min(minVal, 0, bar.value);
      maxVal = Math.max(maxVal, 0, bar.value);
    } else {
      const start = currentVal;
      const end = currentVal + bar.value;
      currentVal = end;
      computedBars.push({
        label: bar.label,
        value: bar.value,
        start,
        end,
        isTotal: false,
        displayValue:
          bar.displayValue ||
          (bar.value >= 0
            ? `+${bar.value.toFixed(1).replace('.', ',')}`
            : `${bar.value.toFixed(1).replace('.', ',')}`),
        isPositive: bar.value >= 0,
      });
      minVal = Math.min(minVal, start, end);
      maxVal = Math.max(maxVal, start, end);
    }
  }

  // Margem de segurança vertical
  const range = maxVal - minVal || 1;
  const yMin = minVal - range * 0.15;
  const yMax = maxVal + range * 0.15;
  const yRange = yMax - yMin || 1;

  const scaleY = (val: number) => {
    return padding.top + chartHeight - ((val - yMin) / yRange) * chartHeight;
  };

  const barWidth = Math.min(42, Math.max(18, (chartWidth / computedBars.length) * 0.65));
  const slotWidth = chartWidth / computedBars.length;
  const zeroY = scaleY(0);

  let svgElements = `<rect width="${width}" height="${height}" fill="#ffffff" />`;

  // Título do gráfico
  if (options.title) {
    svgElements += renderSvgText({
      text: options.title,
      x: padding.left,
      y: 20,
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#14412A',
      textAnchor: 'start',
    });
  }

  // Linha zero
  svgElements += `<line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${width - padding.right}" y2="${zeroY.toFixed(1)}" stroke="#D1D5DB" stroke-width="1" stroke-dasharray="2,2" />`;

  // Renderiza cada barra
  computedBars.forEach((bar, idx) => {
    const x = padding.left + idx * slotWidth + (slotWidth - barWidth) / 2;
    const yTop = scaleY(Math.max(bar.start, bar.end));
    const yBottom = scaleY(Math.min(bar.start, bar.end));
    const h = Math.max(2, yBottom - yTop);

    let fillColor = '#1F2937'; // Preto/cinza escuro para totais (EBITDA orçado e real)
    if (!bar.isTotal) {
      fillColor = bar.isPositive ? '#16A34A' : '#DC2626'; // Verde para positivo, vermelho para negativo
    }

    // Retângulo da barra
    svgElements += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fillColor}" />`;

    // Valor acima ou abaixo da barra
    const labelY = bar.isPositive || bar.isTotal ? yTop - 5 : yBottom + 12;
    const textColor = bar.isTotal ? '#1F2937' : bar.isPositive ? '#15803D' : '#B91C1C';
    svgElements += renderSvgText({
      text: bar.displayValue,
      x: x + barWidth / 2,
      y: labelY,
      fontSize: 9,
      fontWeight: 'bold',
      fill: textColor,
      textAnchor: 'middle',
    });

    // Rótulo no eixo X (quebrado em palavras se necessário)
    const words = bar.label.split(' ');
    if (words.length > 1 && bar.label.length > 7) {
      svgElements += renderSvgText({
        text: words[0],
        x: x + barWidth / 2,
        y: height - padding.bottom + 12,
        fontSize: 8,
        fontWeight: 'normal',
        fill: '#4B5563',
        textAnchor: 'middle',
      });
      svgElements += renderSvgText({
        text: words.slice(1).join(' '),
        x: x + barWidth / 2,
        y: height - padding.bottom + 22,
        fontSize: 8,
        fontWeight: 'normal',
        fill: '#4B5563',
        textAnchor: 'middle',
      });
    } else {
      svgElements += renderSvgText({
        text: bar.label,
        x: x + barWidth / 2,
        y: height - padding.bottom + 14,
        fontSize: 8.5,
        fontWeight: 'normal',
        fill: '#4B5563',
        textAnchor: 'middle',
      });
    }
  });

  const fullSvg = `<svg width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${svgElements}
  </svg>`;

  return sharp(Buffer.from(fullSvg)).png().toBuffer();
}

/**
 * Renderiza gráfico de linha (ex: evolução de Churn % a.m.)
 */
export async function renderLineChart(options: {
  title?: string;
  width?: number;
  height?: number;
  labels: string[];
  series: Array<{
    name: string;
    color: string;
    strokeDasharray?: string;
    data: number[];
  }>;
}): Promise<Buffer> {
  const width = options.width || 380;
  const height = options.height || 160;
  const padding = { top: 25, right: 36, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allVals: number[] = [];
  options.series.forEach((s) => allVals.push(...s.data));
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1) * 1.15;
  const range = maxVal - minVal || 1;

  const scaleX = (idx: number) => padding.left + (idx / Math.max(1, options.labels.length - 1)) * chartWidth;
  const scaleY = (val: number) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;

  let svgElements = `<rect width="${width}" height="${height}" fill="#ffffff" />`;
  if (options.title) {
    svgElements += renderSvgText({
      text: options.title,
      x: padding.left,
      y: 15,
      fontSize: 10,
      fontWeight: 'bold',
      fill: '#14412A',
      textAnchor: 'start',
    });
  }

  // Linhas das séries
  options.series.forEach((s) => {
    let pathD = '';
    s.data.forEach((val, i) => {
      const x = scaleX(i);
      const y = scaleY(val);
      pathD += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    const dash = s.strokeDasharray ? `stroke-dasharray="${s.strokeDasharray}"` : '';
    svgElements += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2" ${dash} />`;

    // Último ponto com rótulo
    const lastX = scaleX(s.data.length - 1);
    const lastY = scaleY(s.data[s.data.length - 1]);
    svgElements += `<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${s.color}" />`;
    svgElements += renderSvgText({
      text: `${s.data[s.data.length - 1].toFixed(2).replace('.', ',')}%`,
      x: lastX + 4,
      y: lastY + 3,
      fontSize: 8,
      fontWeight: 'bold',
      fill: s.color,
      textAnchor: 'start',
    });
  });

  // Rótulos X
  options.labels.forEach((label, i) => {
    const x = scaleX(i);
    svgElements += renderSvgText({
      text: label,
      x,
      y: height - 10,
      fontSize: 7.5,
      fontWeight: 'normal',
      fill: '#6B7280',
      textAnchor: 'middle',
    });
  });

  const fullSvg = `<svg width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${svgElements}
  </svg>`;

  return sharp(Buffer.from(fullSvg)).png().toBuffer();
}

/**
 * Renderiza gráfico de barras com linha de forecast (ex: Gross Adds e Net Adds mensais)
 */
export async function renderBarWithLineChart(options: {
  title?: string;
  width?: number;
  height?: number;
  labels: string[];
  bars: number[];
  forecastLine?: number[];
  highlightLast?: { label: string };
}): Promise<Buffer> {
  const width = options.width || 380;
  const height = options.height || 160;
  const padding = { top: 25, right: 25, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const allVals = [...options.bars, ...(options.forecastLine || [])];
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1) * 1.2;
  const range = maxVal - minVal || 1;

  const scaleX = (idx: number) => padding.left + (idx / Math.max(1, options.labels.length)) * chartWidth;
  const scaleY = (val: number) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
  const slotWidth = chartWidth / Math.max(1, options.labels.length);
  const barWidth = slotWidth * 0.65;
  const zeroY = scaleY(0);

  let svgElements = `<rect width="${width}" height="${height}" fill="#ffffff" />`;
  if (options.title) {
    svgElements += renderSvgText({
      text: options.title,
      x: padding.left,
      y: 15,
      fontSize: 10,
      fontWeight: 'bold',
      fill: '#14412A',
      textAnchor: 'start',
    });
  }

  // Linha zero
  svgElements += `<line x1="${padding.left}" y1="${zeroY.toFixed(1)}" x2="${width - padding.right}" y2="${zeroY.toFixed(1)}" stroke="#E5E7EB" stroke-width="1" />`;

  // Barras
  options.bars.forEach((val, i) => {
    const x = scaleX(i) + (slotWidth - barWidth) / 2;
    const yTop = scaleY(Math.max(val, 0));
    const yBottom = scaleY(Math.min(val, 0));
    const h = Math.max(1, yBottom - yTop);
    const isLast = i === options.bars.length - 1;
    const fill = isLast ? '#14412A' : '#475569';

    svgElements += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${fill}" />`;
    svgElements += renderSvgText({
      text: options.labels[i] || '',
      x: x + barWidth / 2,
      y: height - 10,
      fontSize: 7,
      fontWeight: 'normal',
      fill: '#6B7280',
      textAnchor: 'middle',
    });
  });

  // Linha de forecast
  if (options.forecastLine && options.forecastLine.length === options.labels.length) {
    let pathD = '';
    options.forecastLine.forEach((val, i) => {
      const x = scaleX(i) + slotWidth / 2;
      const y = scaleY(val);
      pathD += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    svgElements += `<path d="${pathD}" fill="none" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3,3" />`;
  }

  // Rótulo destaque no topo
  if (options.highlightLast) {
    svgElements += renderSvgText({
      text: options.highlightLast.label,
      x: width - padding.right,
      y: 15,
      fontSize: 8.5,
      fontWeight: 'bold',
      fill: '#14412A',
      textAnchor: 'end',
    });
  }

  const fullSvg = `<svg width="${width * 2}" height="${height * 2}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${svgElements}
  </svg>`;

  return sharp(Buffer.from(fullSvg)).png().toBuffer();
}
