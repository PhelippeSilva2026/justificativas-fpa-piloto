import pptxgen from 'pptxgenjs';
import { DRERow, RowJustifications, CompanyId } from '../types';
import { formatCurrencyShort } from './formatters';
import { getCompanyLogoPngDataUrl, COMPANIES } from './companyConfigs';
import {
  buildMonthWaterfallData,
  buildYTDWaterfallData,
  generateHighResWaterfallImage,
} from './waterfallGenerator';

/**
 * Gera um slide executivo para uma linha específica de DRE (Subcategoria N3)
 */
export async function addSlideForDRERow(
  pptx: pptxgen,
  row: DRERow,
  justifications?: RowJustifications,
  logoDataUrl?: string,
  companyId: CompanyId = 'nio'
): Promise<void> {
  const slide = pptx.addSlide();

  // Fundo Branco (#FFFFFF) conforme solicitado pelo usuário
  slide.background = { color: 'FFFFFF' };

  const company = COMPANIES[companyId] || COMPANIES.nio;
  const titleColor = companyId === 'vtal' ? '0A192F' : companyId === 'tecto' ? '0F172A' : '14412A';

  // 1. TÍTULO DO SLIDE: "N1 | N2 | N3"
  // Topo esquerdo, Arial, 18pt, em negrito
  const fullTitle = `${row.n1.toUpperCase()} | ${row.n2} | ${row.n3}`;
  slide.addText(fullTitle, {
    x: 0.8,
    y: 0.45,
    w: 9.8,
    h: 0.45,
    fontFace: 'Arial',
    fontSize: 18,
    bold: true,
    color: titleColor,
    valign: 'top',
  });

  // 2. SUBTÍTULO: Logo abaixo do título. "Responsável: " (negrito) + nome do gestor (normal). Arial 10pt.
  slide.addText(
    [
      { text: 'Responsável: ', options: { bold: true, fontSize: 10, fontFace: 'Arial', color: '192B1C' } },
      { text: row.responsavel, options: { bold: false, fontSize: 10, fontFace: 'Arial', color: '333333' } },
    ],
    {
      x: 0.8,
      y: 0.92,
      w: 9.8,
      h: 0.35,
      valign: 'top',
    }
  );

  // 3. LOGOMARCA NIO: Canto superior direito.
  // Alinhada para que a margem superior coincida com a linha do título e inferior com o subtítulo.
  if (logoDataUrl) {
    slide.addImage({
      data: logoDataUrl,
      x: 10.9,
      y: 0.42,
      w: 1.65,
      h: 0.8,
    });
  }

  // 4. RODAPÉ: "USO INTERNO" estritamente no canto inferior esquerdo, Arial 8pt, cor cinza sutil
  slide.addText('USO INTERNO', {
    x: 0.8,
    y: 7.1,
    w: 3.0,
    h: 0.25,
    fontFace: 'Arial',
    fontSize: 8,
    color: '8C9283',
    valign: 'bottom',
  });

  // Linha sutil divisória no rodapé
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8,
    y: 7.05,
    w: 11.73,
    h: 0,
    line: { color: 'DCD8D2', width: 0.75 },
  });

  // ==========================================
  // DIVISÃO EM 4 QUADRANTES IGUAIS (16:9 Widescreen)
  // Col 1 (Esquerda): x: 0.8, w: 5.7
  // Col 2 (Direita):  x: 6.83, w: 5.7
  // Linha 1 (Superior): y: 1.35, h: 2.7
  // Linha 2 (Inferior): y: 4.25, h: 2.7
  // ==========================================

  // QUADRANTE 1 (Superior Esquerdo): Gráfico 01 (Waterfall Mês) em alta resolução
  const monthConfig = buildMonthWaterfallData(row, justifications);
  const monthImgData = generateHighResWaterfallImage(monthConfig);

  // Moldura do card quadrante 1
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.25,
    w: 5.75,
    h: 2.75,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: 'A7AC98', width: 0.75 },
  });

  slide.addImage({
    data: monthImgData,
    x: 0.85,
    y: 1.30,
    w: 5.65,
    h: 2.65,
  });

  // QUADRANTE 2 (Superior Direito): Caixa de texto estruturada Variações Mês
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: 1.25,
    w: 5.75,
    h: 2.75,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: 'A7AC98', width: 0.75 },
  });

  const momList = justifications?.momImpacts || [];
  const vsOrcadoList = justifications?.vsOrcadoImpacts || [];
  const totalMonthItems = momList.length + vsOrcadoList.length;

  // Cálculo de fontes dinâmicas para assegurar que NUNCA ultrapasse a área do slide
  let mTitleSize = 11;
  let mSubheadSize = 9.5;
  let mBodySize = 8.5;
  let mLineSpacing = 1.05;

  if (totalMonthItems >= 5) {
    mTitleSize = 9.5;
    mSubheadSize = 8.0;
    mBodySize = 7.0;
    mLineSpacing = 0.98;
  } else if (totalMonthItems >= 3) {
    mTitleSize = 10.0;
    mSubheadSize = 8.5;
    mBodySize = 7.5;
    mLineSpacing = 1.0;
  }

  const monthBoxTextRuns: pptxgen.TextProps[] = [];

  // Título da caixa: "Variações Mês"
  monthBoxTextRuns.push({
    text: 'Variações Mês',
    options: { fontFace: 'Arial', fontSize: mTitleSize, bold: true, color: '14412A', breakLine: true },
  });

  // Seção 1: "MoM"
  monthBoxTextRuns.push({
    text: 'MoM',
    options: { fontFace: 'Arial', fontSize: mSubheadSize, bold: true, color: '192B1C', breakLine: true },
  });

  if (momList.length === 0) {
    monthBoxTextRuns.push({
      text: '• Sem desvios adicionais informados para o período MoM.',
      options: { fontFace: 'Arial', fontSize: mBodySize, italic: true, color: '666666', breakLine: true },
    });
  } else {
    momList.forEach((imp) => {
      const valFormatted = formatCurrencyShort(imp.value);
      monthBoxTextRuns.push(
        {
          text: `• ${imp.name} (`,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: true, color: '192B1C' },
        },
        {
          text: valFormatted,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: true, color: imp.value < 0 ? '8B0000' : '14412A' },
        },
        {
          text: `): ${imp.justification || 'Desvio operacional apurado.'}`,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: false, color: '333333', breakLine: true },
        }
      );
    });
  }

  // Seção 2: "Vs Orçado"
  monthBoxTextRuns.push({
    text: 'Vs Orçado',
    options: { fontFace: 'Arial', fontSize: mSubheadSize, bold: true, color: '192B1C', breakLine: true },
  });

  if (vsOrcadoList.length === 0) {
    monthBoxTextRuns.push({
      text: '• Aderência integral ao orçamento previsto no mês.',
      options: { fontFace: 'Arial', fontSize: mBodySize, italic: true, color: '666666', breakLine: true },
    });
  } else {
    vsOrcadoList.forEach((imp) => {
      const valFormatted = formatCurrencyShort(imp.value);
      monthBoxTextRuns.push(
        {
          text: `• ${imp.name} (`,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: true, color: '192B1C' },
        },
        {
          text: valFormatted,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: true, color: imp.value < 0 ? '8B0000' : '14412A' },
        },
        {
          text: `): ${imp.justification || 'Justificativa orçamentária.'}`,
          options: { fontFace: 'Arial', fontSize: mBodySize, bold: false, color: '333333', breakLine: true },
        }
      );
    });
  }

  slide.addText(monthBoxTextRuns, {
    x: 6.95,
    y: 1.35,
    w: 5.45,
    h: 2.55,
    valign: 'top',
    margin: [0.04, 0.06, 0.04, 0.06],
    wrap: true,
    shrinkText: true,
    lineSpacingMultiple: mLineSpacing,
  });

  // QUADRANTE 3 (Inferior Esquerdo): Gráfico 02 (Waterfall YTD)
  const ytdConfig = buildYTDWaterfallData(row, justifications);
  const ytdImgData = generateHighResWaterfallImage(ytdConfig);

  slide.addShape(pptxgen.ShapeType ? pptxgen.ShapeType.roundRect : pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 4.15,
    w: 5.75,
    h: 2.75,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: 'A7AC98', width: 0.75 },
  });

  slide.addImage({
    data: ytdImgData,
    x: 0.85,
    y: 4.20,
    w: 5.65,
    h: 2.65,
  });

  // QUADRANTE 4 (Inferior Direito): Explicação das Variações YTD
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: 4.15,
    w: 5.75,
    h: 2.75,
    rectRadius: 0.1,
    fill: { color: 'FFFFFF' },
    line: { color: 'A7AC98', width: 0.75 },
  });

  const ytdList = justifications?.ytdImpacts || [];
  const totalYtdItems = ytdList.length;

  let yTitleSize = 11;
  let ySubheadSize = 9.5;
  let yBodySize = 8.5;
  let yLineSpacing = 1.05;

  if (totalYtdItems >= 4) {
    yTitleSize = 9.5;
    ySubheadSize = 8.0;
    yBodySize = 7.0;
    yLineSpacing = 0.98;
  } else if (totalYtdItems >= 2) {
    yTitleSize = 10.0;
    ySubheadSize = 8.5;
    yBodySize = 7.5;
    yLineSpacing = 1.0;
  }

  const ytdBoxTextRuns: pptxgen.TextProps[] = [];

  // Título da caixa: "Explicação das Variações YTD"
  ytdBoxTextRuns.push({
    text: 'Explicação das Variações YTD',
    options: { fontFace: 'Arial', fontSize: yTitleSize, bold: true, color: '14412A', breakLine: true },
  });

  // Seção 1: "Vs Orçado"
  ytdBoxTextRuns.push({
    text: 'Vs Orçado',
    options: { fontFace: 'Arial', fontSize: ySubheadSize, bold: true, color: '192B1C', breakLine: true },
  });

  if (ytdList.length === 0) {
    ytdBoxTextRuns.push({
      text: '• Execução acumulada YTD em conformidade com as diretrizes da companhia.',
      options: { fontFace: 'Arial', fontSize: yBodySize, italic: true, color: '666666', breakLine: true },
    });
  } else {
    ytdList.forEach((imp) => {
      const valFormatted = formatCurrencyShort(imp.value);
      ytdBoxTextRuns.push(
        {
          text: `• ${imp.name} (`,
          options: { fontFace: 'Arial', fontSize: yBodySize, bold: true, color: '192B1C' },
        },
        {
          text: valFormatted,
          options: { fontFace: 'Arial', fontSize: yBodySize, bold: true, color: imp.value < 0 ? '8B0000' : '14412A' },
        },
        {
          text: `): ${imp.justification || 'Impacto acumulado no ano.'}`,
          options: { fontFace: 'Arial', fontSize: yBodySize, bold: false, color: '333333', breakLine: true },
        }
      );
    });
  }

  slide.addText(ytdBoxTextRuns, {
    x: 6.95,
    y: 4.25,
    w: 5.45,
    h: 2.55,
    valign: 'top',
    margin: [0.04, 0.06, 0.04, 0.06],
    wrap: true,
    shrinkText: true,
    lineSpacingMultiple: yLineSpacing,
  });
}

/**
 * Exporta o slide atual selecionado ou a apresentação completa para arquivo PowerPoint (.pptx)
 */
export async function exportToPowerPoint(
  rowsToExport: DRERow[],
  allJustifications: Record<string, RowJustifications>,
  fileNamePrefix: string = 'Apresentacao_DRE_Executiva',
  companyId: CompanyId = 'nio'
): Promise<void> {
  const pptx = new pptxgen();
  const company = COMPANIES[companyId] || COMPANIES.nio;

  // Define layout 16:9 Widescreen (13.33 x 7.5 polegadas)
  pptx.defineLayout({ name: 'CORP_16_9', width: 13.333, height: 7.5 });
  pptx.layout = 'CORP_16_9';
  pptx.author = `${company.name} - Controladoria & FP&A`;
  pptx.company = company.shortName;
  pptx.title = `Análise Executiva DRE e Gráficos Waterfall - ${company.name}`;

  // Pré-gera a logo da empresa em PNG alta resolução
  const logoDataUrl = await getCompanyLogoPngDataUrl(companyId);

  for (const row of rowsToExport) {
    await addSlideForDRERow(pptx, row, allJustifications[row.id], logoDataUrl, companyId);
  }

  const cleanName = `${fileNamePrefix}_${new Date().toISOString().slice(0, 10)}.pptx`;
  await pptx.writeFile({ fileName: cleanName });
}
