import { DRERow, RowJustifications, WaterfallBarItem } from '../types';
import { formatCurrencyShort } from './formatters';

export { formatCurrencyShort };

export interface WaterfallConfig {
  title: string;
  bars: WaterfallBarItem[];
  minVal: number;
  maxVal: number;
}

/**
 * Constrói a lista de barras para o Gráfico 01 (Mês: Real M-1 -> Real 2026 -> Orçado 2026)
 */
export function buildMonthWaterfallData(row: DRERow, justifications?: RowJustifications): WaterfallConfig {
  const bars: WaterfallBarItem[] = [];

  // 1. Barra inicial: Real M-1
  let currentAccum = row.realMMinus1;
  bars.push({
    label: 'Real M-1',
    category: 'base',
    startValue: 0,
    endValue: row.realMMinus1,
    changeValue: row.realMMinus1,
    displayValue: row.realMMinus1,
    color: '#14412A', // Verde profundo NIO
  });

  // 2. Barras intermediárias MoM (informadas pelo usuário)
  const momImpacts = justifications?.momImpacts || [];
  momImpacts.forEach((imp) => {
    const start = currentAccum;
    const end = currentAccum + imp.value;
    currentAccum = end;
    bars.push({
      label: imp.name || 'Desvio MoM',
      category: imp.value < 0 ? 'negative' : 'positive',
      startValue: start,
      endValue: end,
      changeValue: imp.value,
      displayValue: imp.value,
      color: imp.value < 0 ? '#8B0000' : '#22C55E', // Vermelho Escuro vs Verde Neon/Vivo
    });
  });

  // 3. Barra de transição: Real 2026
  bars.push({
    label: 'Real 2026',
    category: 'subtotal',
    startValue: 0,
    endValue: row.realCurrent,
    changeValue: row.realCurrent,
    displayValue: row.realCurrent,
    color: '#192B1C', // Verde quase preto NIO
  });

  // 4. Barras intermediárias Vs Orçado (Real Corrente -> Orçado)
  let orcadoBridgeAccum = row.realCurrent;
  const vsOrcadoImpacts = justifications?.vsOrcadoImpacts || [];
  vsOrcadoImpacts.forEach((imp) => {
    const start = orcadoBridgeAccum;
    const end = orcadoBridgeAccum + imp.value;
    orcadoBridgeAccum = end;
    bars.push({
      label: imp.name || 'Desvio Orç.',
      category: imp.value < 0 ? 'negative' : 'positive',
      startValue: start,
      endValue: end,
      changeValue: imp.value,
      displayValue: imp.value,
      color: imp.value < 0 ? '#8B0000' : '#22C55E',
    });
  });

  // 5. Barra final: Orçado 2026
  bars.push({
    label: 'Orçado 2026',
    category: 'total',
    startValue: 0,
    endValue: row.orcadoCurrent,
    changeValue: row.orcadoCurrent,
    displayValue: row.orcadoCurrent,
    color: '#14412A',
  });

  // Cálculo de limites do eixo Y
  let min = 0;
  let max = 0;
  bars.forEach((b) => {
    min = Math.min(min, b.startValue, b.endValue);
    max = Math.max(max, b.startValue, b.endValue);
  });
  // Adiciona margem de 15% para os rótulos de valores não cortarem
  max = max > 0 ? max * 1.18 : 100;

  return {
    title: 'Mês',
    bars,
    minVal: min,
    maxVal: max,
  };
}

/**
 * Constrói a lista de barras para o Gráfico 02 (YTD: Real 2026 YTD -> Orçado 2026 YTD)
 */
export function buildYTDWaterfallData(row: DRERow, justifications?: RowJustifications): WaterfallConfig {
  const bars: WaterfallBarItem[] = [];

  // 1. Barra inicial: Real 2026 YTD
  let currentAccum = row.realYTD;
  bars.push({
    label: 'Real 2026 YTD',
    category: 'base',
    startValue: 0,
    endValue: row.realYTD,
    changeValue: row.realYTD,
    displayValue: row.realYTD,
    color: '#192B1C', // Preto / Verde quase preto
  });

  // 2. Barras intermediárias YTD informadas pelo usuário
  const ytdImpacts = justifications?.ytdImpacts || [];
  ytdImpacts.forEach((imp) => {
    const start = currentAccum;
    const end = currentAccum + imp.value;
    currentAccum = end;
    bars.push({
      label: imp.name || 'Desvio YTD',
      category: imp.value < 0 ? 'negative' : 'positive',
      startValue: start,
      endValue: end,
      changeValue: imp.value,
      displayValue: imp.value,
      color: imp.value < 0 ? '#8B0000' : '#22C55E',
    });
  });

  // 3. Barra final: Orçado 2026 YTD
  bars.push({
    label: 'Orçado 2026 YTD',
    category: 'total',
    startValue: 0,
    endValue: row.orcadoYTD,
    changeValue: row.orcadoYTD,
    displayValue: row.orcadoYTD,
    color: '#192B1C', // Preto
  });

  let min = 0;
  let max = 0;
  bars.forEach((b) => {
    min = Math.min(min, b.startValue, b.endValue);
    max = Math.max(max, b.startValue, b.endValue);
  });
  max = max > 0 ? max * 1.18 : 100;

  return {
    title: 'YTD',
    bars,
    minVal: min,
    maxVal: max,
  };
}

/**
 * Renderiza um gráfico Waterfall completo e de altíssima nitidez em qualquer HTMLCanvasElement
 */
export function renderWaterfallToCanvas(
  canvas: HTMLCanvasElement,
  config: WaterfallConfig,
  options: {
    scale?: number;
    showGrid?: boolean;
    activeBarIndex?: number | null;
  } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const scale = options.scale || 1;

  // Habilita interpolação de alta qualidade para renderização ultra-nítida
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Limpa o canvas com fundo branco puro (#FFFFFF) para máxima nitidez
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Margens executivas equilibradas
  const marginTop = Math.round(54 * scale);
  const marginBottom = Math.round(58 * scale);
  const marginLeft = Math.round(42 * scale);
  const marginRight = Math.round(48 * scale);
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  const { bars, maxVal, minVal } = config;
  const totalBars = bars.length;
  if (totalBars === 0 || chartW <= 0 || chartH <= 0) return;

  // Fonte padrão de sistema para máxima nitidez
  const systemFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Título do Gráfico: "Mês" ou "YTD" (Nitidez executiva)
  ctx.fillStyle = '#14412A';
  ctx.font = `bold ${Math.round(20 * scale)}px ${systemFont}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(config.title, marginLeft, Math.round(14 * scale));

  // Subtítulo de apoio com bom contraste
  ctx.fillStyle = '#52604D';
  ctx.font = `${Math.round(12 * scale)}px ${systemFont}`;
  ctx.fillText('Evolução de desvios em R$', marginLeft + Math.round(70 * scale), Math.round(19 * scale));

  // Eixo Y e Linhas de Grade discretas e nítidas
  const gridSteps = 4;
  ctx.strokeStyle = '#D8D4CE';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.setLineDash([Math.round(3 * scale), Math.round(3 * scale)]);

  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + (maxVal - minVal) * (i / gridSteps);
    const y = Math.round(marginTop + chartH - (chartH * (val - minVal)) / (maxVal - minVal || 1)) + 0.5;
    
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + chartW, y);
    ctx.stroke();

    // Rótulo do grid à direita com alta legibilidade (10.5px nítido)
    ctx.fillStyle = '#5A6454';
    ctx.font = `600 ${Math.round(10.5 * scale)}px ${systemFont}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.setLineDash([]);
    ctx.fillText(formatCurrencyShort(val), width - Math.round(6 * scale), y);
    ctx.setLineDash([Math.round(3 * scale), Math.round(3 * scale)]);
  }
  ctx.setLineDash([]);

  // Linha base Zero sólida e destacada
  const yZero = Math.round(marginTop + chartH - (chartH * (0 - minVal)) / (maxVal - minVal || 1)) + 0.5;
  ctx.strokeStyle = '#9AA290';
  ctx.lineWidth = Math.max(1.5, Math.round(1.5 * scale));
  ctx.beginPath();
  ctx.moveTo(marginLeft, yZero);
  ctx.lineTo(marginLeft + chartW, yZero);
  ctx.stroke();

  // Cálculo das larguras das colunas e espaçamento
  const slotWidth = chartW / totalBars;
  const barWidth = Math.max(Math.round(16 * scale), Math.min(Math.round(slotWidth * 0.62), Math.round(52 * scale)));
  const barPadding = Math.round((slotWidth - barWidth) / 2);

  // Função para converter valor em coordenada Y com alinhamento pixel-perfect
  const getY = (val: number) => {
    return Math.round(marginTop + chartH - (chartH * (val - minVal)) / (maxVal - minVal || 1));
  };

  // Renderizar linhas conectoras pontilhadas entre as barras
  ctx.strokeStyle = '#9AA190';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.setLineDash([Math.round(2 * scale), Math.round(2 * scale)]);

  for (let i = 0; i < totalBars - 1; i++) {
    const currentBar = bars[i];
    const nextBar = bars[i + 1];

    const connY = getY(currentBar.endValue) + 0.5;
    const fromX = Math.round(marginLeft + i * slotWidth + barPadding + barWidth);
    const toX = Math.round(marginLeft + (i + 1) * slotWidth + barPadding);

    ctx.beginPath();
    ctx.moveTo(fromX, connY);
    ctx.lineTo(toX, connY);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Renderização das barras e rótulos
  bars.forEach((bar, idx) => {
    const x = Math.round(marginLeft + idx * slotWidth + barPadding);
    const yTop = getY(Math.max(bar.startValue, bar.endValue));
    const yBottom = getY(Math.min(bar.startValue, bar.endValue));
    const bHeight = Math.max(yBottom - yTop, Math.round(4 * scale));

    const isActive = options.activeBarIndex === idx;

    // Sombra sutil se barra estiver ativa/hover
    if (isActive) {
      ctx.shadowColor = 'rgba(20, 65, 42, 0.3)';
      ctx.shadowBlur = Math.round(10 * scale);
      ctx.shadowOffsetY = Math.round(4 * scale);
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    // Desenha barra sólida com cantos arredondados suaves
    ctx.fillStyle = bar.color;
    drawRoundedRect(ctx, x, yTop, barWidth, bHeight, Math.min(Math.round(4 * scale), Math.round(barWidth / 4)));
    ctx.fill();

    // Borda sutil de acabamento
    ctx.strokeStyle = isActive ? '#39FF00' : 'rgba(0,0,0,0.12)';
    ctx.lineWidth = isActive ? Math.round(2.5 * scale) : Math.max(1, Math.round(1 * scale));
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Rótulo numérico nítido estritamente acima de cada barra (13px, negrito, alto contraste)
    const labelY = yTop - Math.round(8 * scale);
    ctx.fillStyle = '#0F2F1B';
    ctx.font = `bold ${Math.round(13 * scale)}px ${systemFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const valText = bar.category === 'positive' || bar.category === 'negative'
      ? formatCurrencyShort(bar.changeValue)
      : formatCurrencyShort(bar.endValue).replace('+', '');
    ctx.fillText(valText, Math.round(x + barWidth / 2), labelY);

    // Rótulo do eixo X abaixo da barra: 11px negrito com excelente contraste (não embaça)
    ctx.fillStyle = '#192B1C';
    ctx.font = `600 ${Math.round(11 * scale)}px ${systemFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const maxChars = Math.max(12, Math.floor(slotWidth / (6 * scale)));
    const labelLines = wrapText(bar.label, maxChars);
    if (labelLines.length > 2) {
      labelLines[1] = labelLines[1].length > maxChars - 2 ? labelLines[1].substring(0, maxChars - 3) + '...' : labelLines[1] + '...';
    }
    labelLines.slice(0, 2).forEach((line, lineIdx) => {
      ctx.fillText(line, Math.round(x + barWidth / 2), height - marginBottom + Math.round(10 * scale) + (lineIdx * Math.round(14 * scale)));
    });
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [''];
  if (text.length <= maxCharsPerLine) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((w) => {
    if ((currentLine + ' ' + w).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + w).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = w;
    }
  });
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Gera um Data URL em altíssima resolução (1800x1000 px) de qualquer configuração Waterfall.
 * Perfeito para incorporação no slide do PowerPoint (.pptx).
 */
export function generateHighResWaterfallImage(config: WaterfallConfig): string {
  const offscreen = document.createElement('canvas');
  offscreen.width = 1800;
  offscreen.height = 1000;
  renderWaterfallToCanvas(offscreen, config, { scale: 2.5 });
  return offscreen.toDataURL('image/png', 0.95);
}
