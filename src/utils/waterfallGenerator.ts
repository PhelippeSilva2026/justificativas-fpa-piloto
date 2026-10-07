import { DRERow, RowJustifications, WaterfallBarItem } from '../types';
import { formatCurrencyShort } from './formatters';

export { formatCurrencyShort };

export interface WaterfallDeltaBracket {
  fromIndex: number;
  toIndex: number;
  label: string;
  value: number;
  percent: number;
  type?: 'mom' | 'vsOrcado' | 'ytd';
}

export interface WaterfallConfig {
  title: string;
  bars: WaterfallBarItem[];
  minVal: number;
  maxVal: number;
  brackets?: WaterfallDeltaBracket[];
  connectorBreaks?: number[];
}

function formatDeltaBadgeText(val: number, pct: number): string {
  const valStr = formatCurrencyShort(val, true);
  const pctSign = pct > 0 ? '+' : '';
  const pctStr = `${pctSign}${pct.toFixed(1).replace('.', ',')}%`;
  return `${valStr} (${pctStr})`;
}

/**
 * Constrói duas pontes independentes no mesmo gráfico:
 * MoM: Real M-1 -> Real atual; Vs Orçado: Orçado -> Real atual.
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

  const firstRealCurrentIndex = bars.length - 1;

  // 4. Segunda ponte independente: começa no Orçado e termina no Real.
  // Assim, os impactos mantêm exatamente os sinais registrados pelo usuário.
  let orcadoBridgeAccum = row.orcadoCurrent;
  const orcadoCurrentIndex = bars.length;
  bars.push({
    label: 'Orçado 2026',
    category: 'base',
    startValue: 0,
    endValue: row.orcadoCurrent,
    changeValue: row.orcadoCurrent,
    displayValue: row.orcadoCurrent,
    color: '#14412A',
  });

  const vsOrcadoImpacts = justifications?.vsOrcadoImpacts || [];
  vsOrcadoImpacts.forEach((imp) => {
    const bridgeChange = imp.value;
    const start = orcadoBridgeAccum;
    const end = orcadoBridgeAccum + bridgeChange;
    orcadoBridgeAccum = end;
    bars.push({
      label: imp.name || 'Desvio Orç.',
      category: bridgeChange < 0 ? 'negative' : 'positive',
      startValue: start,
      endValue: end,
      changeValue: bridgeChange,
      displayValue: bridgeChange,
      color: bridgeChange < 0 ? '#8B0000' : '#22C55E',
    });
  });

  // 5. Fechamento da segunda ponte no Real atual.
  bars.push({
    label: 'Real 2026',
    category: 'total',
    startValue: 0,
    endValue: row.realCurrent,
    changeValue: row.realCurrent,
    displayValue: row.realCurrent,
    color: '#192B1C',
  });

  // Cálculo de limites do eixo Y com folga superior generosa
  let min = 0;
  let max = 0;
  bars.forEach((b) => {
    min = Math.min(min, b.startValue, b.endValue);
    max = Math.max(max, b.startValue, b.endValue);
  });
  // Adiciona folga superior substancial (55% acima do valor máximo ou 45% acima de zero se todos negativos)
  // para que os rótulos de valores numéricos e as linhas/badges de delta NUNCA encostem nas barras
  if (max > 0) {
    max = max * 1.55;
  } else {
    max = Math.abs(min) > 0 ? Math.abs(min) * 0.45 : 100;
  }
  if (min < 0) {
    min = min * 1.15;
  }

  // Linhas superiores de variação (MoM: Real M-1 -> Real 2026 e Vs Orçado: Real 2026 -> Orçado 2026)
  const finalRealCurrentIndex = orcadoCurrentIndex + 1 + vsOrcadoImpacts.length;

  const momDelta = row.diffMMinus1Abs !== undefined && row.diffMMinus1Abs !== 0
    ? row.diffMMinus1Abs
    : row.realCurrent - row.realMMinus1;
  const momPct = row.diffMMinus1Pct !== undefined && row.diffMMinus1Pct !== 0
    ? row.diffMMinus1Pct
    : (row.realMMinus1 !== 0 ? (momDelta / row.realMMinus1) * 100 : 0);

  const vsOrcDelta = row.diffOrcadoAbs !== undefined && row.diffOrcadoAbs !== 0
    ? row.diffOrcadoAbs
    : row.realCurrent - row.orcadoCurrent;
  const vsOrcPct = row.diffOrcadoPct !== undefined && row.diffOrcadoPct !== 0
    ? row.diffOrcadoPct
    : (row.orcadoCurrent !== 0 ? (vsOrcDelta / row.orcadoCurrent) * 100 : 0);

  const brackets: WaterfallDeltaBracket[] = [
    {
      fromIndex: 0,
      toIndex: firstRealCurrentIndex,
      label: `MoM · ${formatDeltaBadgeText(momDelta, momPct)}`,
      value: momDelta,
      percent: momPct,
      type: 'mom',
    },
    {
      fromIndex: orcadoCurrentIndex,
      toIndex: finalRealCurrentIndex,
      label: `Vs Orçado · ${formatDeltaBadgeText(vsOrcDelta, vsOrcPct)}`,
      value: vsOrcDelta,
      percent: vsOrcPct,
      type: 'vsOrcado',
    },
  ];

  return {
    title: 'Mês',
    bars,
    minVal: min,
    maxVal: max,
    brackets,
    connectorBreaks: [firstRealCurrentIndex],
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
    // Mesma convenção: os impactos conciliam Real - Orçado; para caminhar
    // visualmente do Real até o Orçado, aplicamos o sinal inverso na ponte.
    const bridgeChange = -imp.value;
    const start = currentAccum;
    const end = currentAccum + bridgeChange;
    currentAccum = end;
    bars.push({
      label: imp.name || 'Desvio YTD',
      category: bridgeChange < 0 ? 'negative' : 'positive',
      startValue: start,
      endValue: end,
      changeValue: bridgeChange,
      displayValue: imp.value,
      color: bridgeChange < 0 ? '#8B0000' : '#22C55E',
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
  // Folga superior para YTD
  if (max > 0) {
    max = max * 1.55;
  } else {
    max = Math.abs(min) > 0 ? Math.abs(min) * 0.45 : 100;
  }
  if (min < 0) {
    min = min * 1.15;
  }

  // Linha superior de delta YTD: Real 2026 YTD até Orçado 2026 YTD
  const orcadoYtdIndex = 1 + ytdImpacts.length;
  const ytdDelta = row.diffOrcadoYTDAbs !== undefined && row.diffOrcadoYTDAbs !== 0
    ? row.diffOrcadoYTDAbs
    : row.realYTD - row.orcadoYTD;
  const ytdPct = row.diffOrcadoYTDPct !== undefined && row.diffOrcadoYTDPct !== 0
    ? row.diffOrcadoYTDPct
    : (row.orcadoYTD !== 0 ? (ytdDelta / row.orcadoYTD) * 100 : 0);

  const brackets: WaterfallDeltaBracket[] = [
    {
      fromIndex: 0,
      toIndex: orcadoYtdIndex,
      label: formatDeltaBadgeText(ytdDelta, ytdPct),
      value: ytdDelta,
      percent: ytdPct,
      type: 'ytd',
    },
  ];

  return {
    title: 'YTD',
    bars,
    minVal: min,
    maxVal: max,
    brackets,
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

  const { bars, maxVal, minVal } = config;
  const totalBars = bars.length;
  if (totalBars === 0) return;

  // Adapta a tipografia e a área dos rótulos à quantidade de barras.
  // A mesma rotina atende a pré-visualização e a imagem incorporada no PPT.
  const isDense = totalBars >= 8;
  const isVeryDense = totalBars >= 12;
  const axisFontSize = isVeryDense ? 7.5 : isDense ? 8.5 : 11;
  const valueFontSize = isVeryDense ? 8.5 : isDense ? 10 : 13;
  const maxAxisLines = isDense ? 3 : 2;

  // Margens executivas equilibradas, com espaço adicional para rótulos densos
  const marginTop = Math.round(54 * scale);
  const marginBottom = Math.round((isDense ? 78 : 58) * scale);
  const marginLeft = Math.round(42 * scale);
  const marginRight = Math.round(48 * scale);
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  if (totalBars === 0 || chartW <= 0 || chartH <= 0) return;

  const slotWidth = chartW / totalBars;

  // Fonte padrão de sistema para máxima nitidez
  const systemFont = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Título do Gráfico: "Mês" ou "YTD" bem no cantinho superior esquerdo
  ctx.fillStyle = '#14412A';
  ctx.font = `bold ${Math.round(17 * scale)}px ${systemFont}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(config.title, Math.round(8 * scale), Math.round(6 * scale));

  // Sem grade horizontal e sem rótulos do eixo Y: o foco fica nas barras
  // e nos valores executivos exibidos diretamente sobre cada elemento.

  // Linha base Zero sólida e destacada
  const yZero = Math.round(marginTop + chartH - (chartH * (0 - minVal)) / (maxVal - minVal || 1)) + 0.5;
  ctx.strokeStyle = '#9AA290';
  ctx.lineWidth = Math.max(1.5, Math.round(1.5 * scale));
  ctx.beginPath();
  ctx.moveTo(marginLeft, yZero);
  ctx.lineTo(marginLeft + chartW, yZero);
  ctx.stroke();

  // Cálculo das larguras das colunas e espaçamento
  const barWidth = Math.max(Math.round(16 * scale), Math.min(Math.round(slotWidth * 0.62), Math.round(52 * scale)));
  const barPadding = Math.round((slotWidth - barWidth) / 2);

  // Função para converter valor em coordenada Y com alinhamento pixel-perfect
  const getY = (val: number) => {
    return Math.round(marginTop + chartH - (chartH * (val - minVal)) / (maxVal - minVal || 1));
  };

  // Interrompe discretamente o eixo zero entre pontes independentes
  // (ex.: MoM | Vs Orçado), reforçando que os caminhos não são contínuos.
  config.connectorBreaks?.forEach((breakAfterIndex) => {
    if (breakAfterIndex < 0 || breakAfterIndex >= totalBars - 1) return;

    const breakX = Math.round(marginLeft + (breakAfterIndex + 1) * slotWidth);
    const breakWidth = Math.max(12, Math.round(18 * scale));
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(
      Math.round(breakX - breakWidth / 2),
      Math.round(yZero - 3 * scale),
      breakWidth,
      Math.max(4, Math.round(6 * scale)),
    );
  });

  // Renderizar linhas conectoras pontilhadas entre as barras
  ctx.strokeStyle = '#9AA190';
  ctx.lineWidth = Math.max(1, Math.round(1 * scale));
  ctx.setLineDash([Math.round(2 * scale), Math.round(2 * scale)]);

  for (let i = 0; i < totalBars - 1; i++) {
    if (config.connectorBreaks?.includes(i)) continue;
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

    // Em gráficos densos, reduz e alterna levemente a altura dos números para
    // impedir a sobreposição entre valores de barras vizinhas.
    const valueStagger = isDense ? (idx % 2) * Math.round(12 * scale) : 0;
    const labelY = yTop - Math.round(8 * scale) - valueStagger;
    ctx.fillStyle = '#0F2F1B';
    ctx.font = `bold ${Math.round(valueFontSize * scale)}px ${systemFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    
    const valText = bar.category === 'positive' || bar.category === 'negative'
      ? formatCurrencyShort(bar.changeValue, true)
      : formatCurrencyShort(bar.endValue, false);
    ctx.fillText(valText, Math.round(x + barWidth / 2), labelY);

    // Rótulo do eixo X: quebra por largura real do slot, em até três linhas
    // quando há muitas justificativas.
    ctx.fillStyle = '#192B1C';
    ctx.font = `600 ${Math.round(axisFontSize * scale)}px ${systemFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelMaxWidth = Math.max(Math.round(24 * scale), Math.round(slotWidth - 5 * scale));
    const labelLines = wrapTextToWidth(ctx, bar.label, labelMaxWidth, maxAxisLines);
    const lineHeight = Math.round((axisFontSize + 2) * scale);
    labelLines.forEach((line, lineIdx) => {
      ctx.fillText(line, Math.round(x + barWidth / 2), height - marginBottom + Math.round(9 * scale) + (lineIdx * lineHeight));
    });
  });

  // Renderização das linhas superiores de variação / delta com pill badge
  if (config.brackets && config.brackets.length > 0) {
    // Ponto mais alto das barras no gráfico para posicionar a linha com folga uniforme
    let minBarTopY = height;
    bars.forEach((b) => {
      const bTop = getY(Math.max(b.startValue, b.endValue));
      if (bTop < minBarTopY) minBarTopY = bTop;
    });

    // Posição vertical da linha do bracket:
    // Garante folga segura e limpa acima do topo da maior barra e de seu rótulo numérico
    // mantendo alinhamento no topo (y ~ 36*scale)
    const idealBracketY = Math.round(36 * scale);
    const maxAllowedBracketY = minBarTopY - Math.round(34 * scale);
    const baseBracketY = Math.max(Math.round(28 * scale), Math.min(idealBracketY, maxAllowedBracketY));

    config.brackets.forEach((bracket) => {
      const fromIdx = Math.max(0, Math.min(bracket.fromIndex, totalBars - 1));
      const toIdx = Math.max(0, Math.min(bracket.toIndex, totalBars - 1));
      if (fromIdx >= toIdx) return;

      const x1 = Math.round(marginLeft + fromIdx * slotWidth + barPadding + barWidth / 2);
      const x2 = Math.round(marginLeft + toIdx * slotWidth + barPadding + barWidth / 2);
      const xMid = Math.round((x1 + x2) / 2);
      const bracketY = baseBracketY;

      const stemH = Math.round(7 * scale);

      // Traçado da linha do bracket (haste descendo em cada extremidade)
      ctx.strokeStyle = '#6E7769';
      ctx.lineWidth = Math.max(1.2, Math.round(1.2 * scale));
      ctx.beginPath();
      ctx.moveTo(x1, bracketY + stemH);
      ctx.lineTo(x1, bracketY);
      ctx.lineTo(x2, bracketY);
      ctx.lineTo(x2, bracketY + stemH);
      ctx.stroke();

      // Pill Badge com valor e percentual no centro
      const badgeText = bracket.label;
      ctx.font = `bold ${Math.round(10 * scale)}px ${systemFont}`;
      const textW = ctx.measureText(badgeText).width;
      const badgeW = Math.round(textW + 16 * scale);
      const badgeH = Math.round(20 * scale);
      const badgeX = Math.round(xMid - badgeW / 2);
      const badgeY = Math.round(bracketY - badgeH / 2);
      const radius = Math.round(badgeH / 2);

      // Sombra sutil e fundo branco para mascarar a linha horizontal perfeitamente
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = Math.round(4 * scale);
      ctx.shadowOffsetY = Math.round(1.5 * scale);
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, radius);
      ctx.fill();
      ctx.restore();

      // Borda sutil do badge com distinção por sinal
      const isPositive = bracket.value > 0;
      const isNegative = bracket.value < 0;
      ctx.strokeStyle = isNegative ? '#DC2626' : isPositive ? '#16A34A' : '#94A3B8';
      ctx.lineWidth = Math.max(1, Math.round(1 * scale));
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, radius);
      ctx.stroke();

      // Texto no centro do badge
      ctx.fillStyle = isNegative ? '#991B1B' : isPositive ? '#14412A' : '#334155';
      ctx.font = `bold ${Math.round(10 * scale)}px ${systemFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, xMid, bracketY);
    });
  }
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

function wrapTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const clean = String(text || '').trim();
  if (!clean) return [''];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushWordChunks = (word: string) => {
    let chunk = '';
    for (const char of word) {
      const candidate = chunk + char;
      if (chunk && ctx.measureText(candidate).width > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = candidate;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);
    current = ctx.measureText(word).width <= maxWidth ? word : pushWordChunks(word);
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  const visible = lines.slice(0, maxLines);
  let last = visible[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  visible[maxLines - 1] = `${last}…`;
  return visible;
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
