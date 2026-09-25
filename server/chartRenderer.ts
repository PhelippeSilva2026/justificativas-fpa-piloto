import sharp from 'sharp';

function escapeXml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
 * Renderiza um gráfico de cascata (waterfall) financeiro em SVG e converte para Buffer PNG de alta resolução
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
    return sharp(Buffer.from(emptySvg)).png().toBuffer();
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
        displayValue: bar.displayValue || (bar.value < 0 ? `(${Math.abs(bar.value).toFixed(1)})` : bar.value.toFixed(1)),
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
        displayValue: bar.displayValue || (bar.value >= 0 ? `+${bar.value.toFixed(1)}` : `${bar.value.toFixed(1)}`),
        isPositive: bar.value >= 0,
      });
      minVal = Math.min(minVal, start, end);
      maxVal = Math.max(maxVal, start, end);
    }
  }

  // Margem de segurança vertical
  const range = (maxVal - minVal) || 1;
  const yMin = minVal - range * 0.15;
  const yMax = maxVal + range * 0.15;
  const yRange = (yMax - yMin) || 1;

  const scaleY = (val: number) => {
    return padding.top + chartHeight - ((val - yMin) / yRange) * chartHeight;
  };

  const barWidth = Math.min(42, Math.max(18, (chartWidth / computedBars.length) * 0.65));
  const slotWidth = chartWidth / computedBars.length;
  const zeroY = scaleY(0);

  let svgElements = '';

  // Título do gráfico
  if (options.title) {
    svgElements += `<text x="${padding.left}" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#14412A">${escapeXml(options.title)}</text>`;
  }

  // Linha zero
  svgElements += `<line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#D1D5DB" stroke-width="1" stroke-dasharray="2,2" />`;

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
    const textColor = bar.isTotal ? '#1F2937' : (bar.isPositive ? '#15803D' : '#B91C1C');
    svgElements += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${labelY.toFixed(1)}" font-family="Arial, sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="${textColor}">${escapeXml(bar.displayValue)}</text>`;

    // Rótulo no eixo X (quebrado em palavras se necessário)
    const words = bar.label.split(' ');
    if (words.length > 1 && bar.label.length > 7) {
      svgElements += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(height - padding.bottom + 12).toFixed(1)}" font-family="Arial, sans-serif" font-size="8" fill="#4B5563" text-anchor="middle">${escapeXml(words[0])}</text>`;
      svgElements += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(height - padding.bottom + 22).toFixed(1)}" font-family="Arial, sans-serif" font-size="8" fill="#4B5563" text-anchor="middle">${escapeXml(words.slice(1).join(' '))}</text>`;
    } else {
      svgElements += `<text x="${(x + barWidth / 2).toFixed(1)}" y="${(height - padding.bottom + 14).toFixed(1)}" font-family="Arial, sans-serif" font-size="8.5" fill="#4B5563" text-anchor="middle">${escapeXml(bar.label)}</text>`;
    }
  });

  const fullSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff">
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
  const padding = { top: 25, right: 30, bottom: 30, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  let allVals: number[] = [];
  options.series.forEach((s) => allVals.push(...s.data));
  const minVal = Math.min(...allVals, 0);
  const maxVal = Math.max(...allVals, 1) * 1.15;
  const range = (maxVal - minVal) || 1;

  const scaleX = (idx: number) => padding.left + (idx / (options.labels.length - 1)) * chartWidth;
  const scaleY = (val: number) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;

  let svgElements = '';
  if (options.title) {
    svgElements += `<text x="${padding.left}" y="15" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#14412A">${escapeXml(options.title)}</text>`;
  }

  // Linhas das séries
  options.series.forEach((s) => {
    let pathD = '';
    s.data.forEach((val, i) => {
      const x = scaleX(i);
      const y = scaleY(val);
      pathD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    const dash = s.strokeDasharray ? `stroke-dasharray="${s.strokeDasharray}"` : '';
    svgElements += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2" ${dash} />`;

    // Último ponto com rótulo
    const lastX = scaleX(s.data.length - 1);
    const lastY = scaleY(s.data[s.data.length - 1]);
    svgElements += `<circle cx="${lastX}" cy="${lastY}" r="3" fill="${s.color}" />`;
    svgElements += `<text x="${lastX + 4}" y="${lastY + 3}" font-family="Arial, sans-serif" font-size="8" font-weight="bold" fill="${s.color}">${s.data[s.data.length - 1].toFixed(2)}%</text>`;
  });

  // Rótulos X
  options.labels.forEach((label, i) => {
    const x = scaleX(i);
    svgElements += `<text x="${x}" y="${height - 10}" font-family="Arial, sans-serif" font-size="7.5" fill="#6B7280" text-anchor="middle">${escapeXml(label)}</text>`;
  });

  const fullSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff">
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
  const range = (maxVal - minVal) || 1;

  const scaleX = (idx: number) => padding.left + (idx / options.labels.length) * chartWidth;
  const scaleY = (val: number) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;
  const slotWidth = chartWidth / options.labels.length;
  const barWidth = slotWidth * 0.65;
  const zeroY = scaleY(0);

  let svgElements = '';
  if (options.title) {
    svgElements += `<text x="${padding.left}" y="15" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#14412A">${escapeXml(options.title)}</text>`;
  }

  // Linha zero
  svgElements += `<line x1="${padding.left}" y1="${zeroY}" x2="${width - padding.right}" y2="${zeroY}" stroke="#E5E7EB" stroke-width="1" />`;

  // Barras
  options.bars.forEach((val, i) => {
    const x = scaleX(i) + (slotWidth - barWidth) / 2;
    const yTop = scaleY(Math.max(val, 0));
    const yBottom = scaleY(Math.min(val, 0));
    const h = Math.max(1, yBottom - yTop);
    const isLast = i === options.bars.length - 1;
    const fill = isLast ? '#14412A' : '#475569';

    svgElements += `<rect x="${x}" y="${yTop}" width="${barWidth}" height="${h}" rx="1" fill="${fill}" />`;
    svgElements += `<text x="${x + barWidth / 2}" y="${height - 10}" font-family="Arial, sans-serif" font-size="7" fill="#6B7280" text-anchor="middle">${escapeXml(options.labels[i])}</text>`;
  });

  // Linha de forecast
  if (options.forecastLine && options.forecastLine.length === options.labels.length) {
    let pathD = '';
    options.forecastLine.forEach((val, i) => {
      const x = scaleX(i) + slotWidth / 2;
      const y = scaleY(val);
      pathD += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    });
    svgElements += `<path d="${pathD}" fill="none" stroke="#10B981" stroke-width="1.5" stroke-dasharray="3,3" />`;
  }

  // Rótulo destaque no topo
  if (options.highlightLast) {
    svgElements += `<text x="${width - padding.right}" y="15" font-family="Arial, sans-serif" font-size="8.5" font-weight="bold" fill="#14412A" text-anchor="end">${escapeXml(options.highlightLast.label)}</text>`;
  }

  const fullSvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff">
    ${svgElements}
  </svg>`;

  return sharp(Buffer.from(fullSvg)).png().toBuffer();
}
