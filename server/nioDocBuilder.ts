import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { NIO_AGO26_DATA } from './nioData';
import { NioExecutiveNarrative } from './geminiExecutiveReport';
import {
  formatCell,
  nioHeading,
  nioBody,
  nioBullet,
  nioSubheading,
  thinBorders,
  NIO_GREEN,
  GRAY_BG,
} from './nioReportSections';
import {
  renderWaterfallChart,
  renderBarWithLineChart,
  renderLineChart,
} from './chartRenderer';

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

export async function buildNioExecutiveDocx(params: {
  period: string;
  narrative: NioExecutiveNarrative;
  logoBuffer?: Buffer;
}): Promise<Buffer> {
  const { narrative, logoBuffer } = params;
  const d = NIO_AGO26_DATA;

  // 1. Gerar os 8 gráficos oficiais em PNG de alta resolução
  const [
    chartEbitdaMes,
    chartEbitdaYtd,
    chartNetAdds,
    chartGrossAdds,
    chartChurn,
    chartNetRevenue,
    chartArpu,
    chartUnitarioCac,
  ] = await Promise.all([
    renderWaterfallChart({
      title: 'Agosto/26 (R$ Mn)',
      width: 500,
      height: 180,
      bars: [
        { label: 'EBITDA orç.', value: -4.7, isTotal: true },
        { label: 'Receita', value: -27.4 },
        { label: 'Rel. receita', value: 3.4 },
        { label: 'Custo servir', value: -2.9 },
        { label: 'Adm', value: -0.6 },
        { label: 'CAC', value: 15.7 },
        { label: 'One-offs', value: -1.8 },
        { label: 'Pessoal', value: 0.5 },
        { label: 'EBITDA real', value: -17.9, isTotal: true },
      ],
    }),
    renderWaterfallChart({
      title: 'YTD (R$ Mn)',
      width: 500,
      height: 180,
      bars: [
        { label: 'EBITDA orç.', value: 6.0, isTotal: true },
        { label: 'Receita', value: -100.6 },
        { label: 'Rel. receita', value: 39.7 },
        { label: 'Custo servir', value: -38.0 },
        { label: 'Adm', value: -36.1 },
        { label: 'CAC', value: 80.7 },
        { label: 'One-offs', value: 34.8 },
        { label: 'Pessoal', value: 13.7 },
        { label: 'EBITDA real', value: 0.1, isTotal: true },
      ],
    }),
    renderBarWithLineChart({
      title: 'Net Adds (mil)',
      width: 320,
      height: 140,
      labels: ['A25', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', "D'26"],
      bars: [-35, -20, -10, 5, 8, 12, 18, 20, 21, 25, 28, 32, 35],
      forecastLine: [-30, -18, -8, 8, 12, 16, 22, 24, 25, 28, 30, 34, 38],
      highlightLast: { label: 'Ago: real 21k | orç. 46k' },
    }),
    renderBarWithLineChart({
      title: 'Gross Adds (mil)',
      width: 320,
      height: 140,
      labels: ['A25', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', "D'26"],
      bars: [85, 88, 92, 95, 102, 108, 114, 114, 114, 118, 120, 122, 125],
      forecastLine: [90, 92, 96, 100, 105, 110, 112, 110, 104, 112, 115, 118, 120],
      highlightLast: { label: 'Ago: real 114k | orç. 124k' },
    }),
    renderLineChart({
      title: 'Churn (% a.m.)',
      width: 320,
      height: 140,
      labels: ["Jan'26", 'F', 'M', 'A', 'M', 'J', 'J', 'A'],
      series: [
        { name: 'Churn total', color: '#16A34A', data: [2.5, 2.6, 2.7, 2.65, 2.75, 2.7, 2.75, 2.79] },
        { name: 'Voluntário', color: '#6B7280', data: [1.8, 1.85, 1.9, 1.88, 1.95, 1.9, 1.92, 1.96] },
        { name: 'Orçado', color: '#10B981', strokeDasharray: '3,3', data: [2.3, 2.3, 2.3, 2.3, 2.29, 2.29, 2.29, 2.29] },
      ],
    }),
    renderWaterfallChart({
      title: 'Net Revenue vs orçado (R$ Mn)',
      width: 500,
      height: 170,
      bars: [
        { label: 'Receita orç.', value: 316.5, isTotal: true },
        { label: 'Net Adds', value: -8.9 },
        { label: 'Base fat.', value: -9.3 },
        { label: '+1 fatura', value: -0.1 },
        { label: 'Price Up', value: -2.6 },
        { label: 'Price Down', value: -2.0 },
        { label: 'Redutores', value: -0.9 },
        { label: 'Outros', value: -3.5 },
        { label: 'Receita real', value: 289.1, isTotal: true },
      ],
    }),
    renderWaterfallChart({
      title: 'ARPU vs orçado (R$)',
      width: 500,
      height: 170,
      bars: [
        { label: 'ARPU orç.', value: 92.91, isTotal: true },
        { label: 'Price Up', value: -0.76 },
        { label: 'Price Down', value: -0.60 },
        { label: 'Gross/Churn', value: -0.82 },
        { label: '% base fat.', value: -2.74 },
        { label: '+1 fatura', value: -0.03 },
        { label: 'Redutores', value: -0.28 },
        { label: 'Outros', value: -0.12 },
        { label: 'ARPU real', value: 87.56, isTotal: true },
      ],
    }),
    renderWaterfallChart({
      title: 'Unitário de vendas ex-M&A (R$)',
      width: 480,
      height: 160,
      bars: [
        { label: 'Jul/26', value: 599, isTotal: true },
        { label: 'Camp PAP', value: 5 },
        { label: 'Prod EPS', value: 1 },
        { label: 'Camp Dealers', value: 2 },
        { label: 'Inbound TLV', value: 5 },
        { label: 'Camp assist.', value: 1 },
        { label: 'Não assist.', value: 13 },
        { label: 'Ago/26', value: 631, isTotal: true },
      ],
    }),
  ]);

  // Logo run
  const logoRun = logoBuffer && logoBuffer.length > 0
    ? new ImageRun({ data: logoBuffer, transformation: { width: 52, height: 26 }, type: 'png' })
    : new TextRun({ text: 'nio', bold: true, size: 24, color: NIO_GREEN, font: 'Aptos' });

  // Header padrão de todas as páginas
  const header = new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: 'D1D5DB' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 80, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Fechamento Agosto/26 · Documento de leitura',
                        size: 15,
                        color: '6B7280',
                        font: 'Aptos',
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [logoRun] })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // Footer padrão
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'USO INTERNO  ', size: 15, color: '6B7280', font: 'Aptos' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, color: '6B7280', font: 'Aptos' }),
        ],
      }),
    ],
  });

  // Construção do corpo com as 8 páginas
  const children: Array<Paragraph | Table> = [];

  // ==========================================
  // PÁGINA 1: RESUMO EXECUTIVO
  // ==========================================
  children.push(
    new Paragraph({
      spacing: { before: 100, after: 30 },
      children: [
        new TextRun({
          text: 'NIO | Fechamento Agosto/2026',
          bold: true,
          size: 32,
          color: '111827',
          font: 'Aptos Display',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: 'Documento de leitura · Reunião de performance de resultados',
          bold: true,
          size: 19,
          color: NIO_GREEN,
          font: 'Aptos',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: 'Valores em R$ milhões, exceto quando indicado. Comparações contra o Orçamento 2026 e, para KPIs, contra o Forecast.',
          size: 14.5,
          color: '6B7280',
          font: 'Aptos',
        }),
      ],
    }),
    nioHeading('1. Resumo executivo'),
    nioBody(narrative.executiveSummary),
    // Tabela Resumo Indicadores
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('Indicador', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 30 }),
            formatCell('Real ago/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 16 }),
            formatCell('Orçado ago/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 18 }),
            formatCell('Δ vs orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 18 }),
            formatCell('Referência', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 18 }),
          ],
        }),
        ...d.summaryKpis.map((row, idx) =>
          new TableRow({
            children: [
              formatCell(row.indicador, { bold: true, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.real, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.orcado, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.delta, { align: AlignmentType.RIGHT, bold: true, color: 'DC2626', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.referencia, { align: AlignmentType.RIGHT, color: '4B5563', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
            ],
          })
        ),
      ],
    }),
    nioHeading('Mensagens-chave', HeadingLevel.HEADING_2),
    ...narrative.keyMessages.map((msg) => {
      const colonIdx = msg.indexOf(':');
      if (colonIdx > 0 && colonIdx < 35) {
        return nioBullet(msg.slice(colonIdx + 1).trim(), msg.slice(0, colonIdx + 1));
      }
      return nioBullet(msg);
    }),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 2: P&L E EBITDA
  // ==========================================
  children.push(
    nioHeading('2. P&L e EBITDA'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 34 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
          ],
        }),
        ...d.plRows.map((row, idx) => {
          const bg = row.isSubtotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          const isNegMes = row.mesDelta.includes('(') || row.mesDelta.startsWith('-');
          const isNegYtd = row.ytdDelta.includes('(') || row.ytdDelta.startsWith('-');
          return new TableRow({
            children: [
              formatCell(row.label, { bold: row.isBold, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: isNegMes ? 'DC2626' : '16A34A', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: isNegYtd ? 'DC2626' : '16A34A', fill: bg }),
            ],
          });
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 100, after: 40 },
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({ data: chartEbitdaMes, transformation: { width: 330, height: 120 }, type: 'png' }),
        new TextRun({ text: '    ' }),
        new ImageRun({ data: chartEbitdaYtd, transformation: { width: 330, height: 120 }, type: 'png' }),
      ],
    }),
    nioHeading('Leitura do mês', HeadingLevel.HEADING_2),
    nioBody(narrative.monthReading),
    nioHeading('Leitura do YTD', HeadingLevel.HEADING_2),
    nioBody(narrative.ytdReading),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 3: KPIS OPERACIONAIS
  // ==========================================
  children.push(
    nioHeading('3. KPIs operacionais'),
    new Paragraph({
      spacing: { before: 40, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({ data: chartNetAdds, transformation: { width: 220, height: 105 }, type: 'png' }),
        new TextRun({ text: '  ' }),
        new ImageRun({ data: chartGrossAdds, transformation: { width: 220, height: 105 }, type: 'png' }),
        new TextRun({ text: '  ' }),
        new ImageRun({ data: chartChurn, transformation: { width: 220, height: 105 }, type: 'png' }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('KPI', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 30 }),
            formatCell('Real ago', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Forecast', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ fcst', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.kpisTable.map((row, idx) =>
          new TableRow({
            children: [
              formatCell(row.kpi, { bold: true, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.realAgo, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.orcado, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.deltaOrc, { align: AlignmentType.RIGHT, bold: true, color: 'DC2626', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.forecast, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.deltaFcst, { align: AlignmentType.RIGHT, bold: true, color: row.deltaFcst.startsWith('+') ? '16A34A' : 'DC2626', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
            ],
          })
        ),
      ],
    }),
    nioSubheading('Base e Net Adds'),
    nioBody(narrative.kpisAnalysis.baseAndNetAdds),
    nioSubheading('Gross Adds e venda bruta'),
    nioBody(narrative.kpisAnalysis.grossAddsAndSales),
    nioSubheading('Churn'),
    nioBody(narrative.kpisAnalysis.churn),
    nioSubheading('Visão orgânica (ex-M&A)'),
    nioBody(narrative.kpisAnalysis.organicVision),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 4: RECEITA E ARPU
  // ==========================================
  children.push(
    nioHeading('4. Receita e ARPU'),
    new Paragraph({
      spacing: { before: 40, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({ data: chartNetRevenue, transformation: { width: 330, height: 115 }, type: 'png' }),
        new TextRun({ text: '    ' }),
        new ImageRun({ data: chartArpu, transformation: { width: 330, height: 115 }, type: 'png' }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('Indicadores', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 28 }),
            formatCell('Jul/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Ago/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Ago/25', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ% YTD orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.revenueTable.map((row, idx) =>
          new TableRow({
            children: [
              formatCell(row.indicador, { bold: true, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.jul, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ago, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.orcado, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.deltaOrc, { align: AlignmentType.RIGHT, bold: true, color: 'DC2626', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ago25, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ytd, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.deltaYtd, { align: AlignmentType.RIGHT, bold: true, color: row.deltaYtd.startsWith('-') ? 'DC2626' : '16A34A', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
            ],
          })
        ),
      ],
    }),
    nioSubheading('Net Revenue'),
    ...narrative.revenueAnalysis.netRevenueBullets.map((b) => nioBullet(b)),
    nioSubheading('ARPU'),
    ...narrative.revenueAnalysis.arpuBullets.map((b) => nioBullet(b)),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 5: CUSTOS E DESPESAS (5.1 e 5.2)
  // ==========================================
  children.push(
    nioHeading('5. Custos e despesas'),
    nioSubheading('5.1 Custos relacionados à receita'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.costs51.map((row, idx) => {
          const bg = row.isTotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          return new TableRow({
            children: [
              formatCell(row.linha, { bold: row.isTotal, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: row.mesDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: row.ytdDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
            ],
          });
        }),
      ],
    }),
    ...narrative.costsAnalysis.relRevenueBullets.map((b) => nioBullet(b)),
    nioSubheading('5.2 Custo de servir'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.costs52.map((row, idx) => {
          const bg = row.isTotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          return new TableRow({
            children: [
              formatCell(row.linha, { bold: row.isTotal, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: row.mesDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: row.ytdDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
            ],
          });
        }),
      ],
    }),
    ...narrative.costsAnalysis.costToServeBullets.map((b) => nioBullet(b)),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 6: CUSTOS ADM E CAC (5.3 e 5.4)
  // ==========================================
  children.push(
    nioSubheading('5.3 Custos administrativos'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.costs53.map((row, idx) => {
          const bg = row.isTotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          return new TableRow({
            children: [
              formatCell(row.linha, { bold: row.isTotal, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: row.mesDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: row.ytdDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
            ],
          });
        }),
      ],
    }),
    ...narrative.costsAnalysis.adminBullets.map((b) => nioBullet(b)),
    nioSubheading('5.4 Custo de aquisição de clientes (CAC)'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.costs54.map((row, idx) => {
          const bg = row.isTotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          return new TableRow({
            children: [
              formatCell(row.linha, { bold: row.isTotal, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: row.mesDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isTotal, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: row.ytdDelta.includes('(') ? '16A34A' : 'DC2626', fill: bg }),
            ],
          });
        }),
      ],
    }),
    ...narrative.costsAnalysis.cacBullets.map((b) => nioBullet(b)),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 7: CAC UNITÁRIO E ONE-OFFS (5.4 e 5.5)
  // ==========================================
  children.push(
    nioSubheading('5.4 CAC · unitário e comissões'),
    new Paragraph({
      spacing: { before: 20, after: 60 },
      children: [
        new ImageRun({ data: chartUnitarioCac, transformation: { width: 330, height: 110 }, type: 'png' }),
      ],
    }),
    nioBody(narrative.cacUnitaryAnalysis.unitaryIntro),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('Comissão unitária por canal (R$)', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 35 }),
            formatCell('Mix real | orç.', { header: true, align: AlignmentType.CENTER, fill: NIO_GREEN, bold: true }),
            formatCell('Jul/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Ago/26', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ vs orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.channelCommissions.map((row, idx) =>
          new TableRow({
            children: [
              formatCell(row.canal, { bold: true, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.mix, { align: AlignmentType.CENTER, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.jul, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.ago, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.orc, { align: AlignmentType.RIGHT, fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
              formatCell(row.delta, { align: AlignmentType.RIGHT, bold: true, color: row.delta.startsWith('+') ? 'DC2626' : '16A34A', fill: idx % 2 === 0 ? 'FFFFFF' : GRAY_BG }),
            ],
          })
        ),
      ],
    }),
    nioSubheading('Leitura por canal'),
    nioBody(narrative.cacUnitaryAnalysis.channelReading),
    nioSubheading('Comissões e diferimento'),
    nioBody(narrative.cacUnitaryAnalysis.commissionsAndDeferral),
    nioSubheading('5.5 One-offs e custos com pessoal'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.costs55.map((row, idx) => {
          const bg = row.isBold ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          return new TableRow({
            children: [
              formatCell(row.linha, { bold: row.isBold, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, fill: bg }),
            ],
          });
        }),
      ],
    }),
    ...narrative.costsAnalysis.oneOffsBullets.map((b) => nioBullet(b)),
    pageBreak()
  );

  // ==========================================
  // PÁGINA 8: ANEXO · P&L DETALHADO
  // ==========================================
  children.push(
    nioHeading('Anexo · P&L detalhado'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell('Agosto/26 Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('YTD Real', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
          ],
        }),
        ...d.plRows.map((row, idx) => {
          const bg = row.isSubtotal ? 'E5E7EB' : idx % 2 === 0 ? 'FFFFFF' : GRAY_BG;
          const isNegMes = row.mesDelta.includes('(') || row.mesDelta.startsWith('-');
          const isNegYtd = row.ytdDelta.includes('(') || row.ytdDelta.startsWith('-');
          return new TableRow({
            children: [
              formatCell(row.label, { bold: row.isBold, fill: bg }),
              formatCell(row.mesReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.mesDelta, { align: AlignmentType.RIGHT, bold: true, color: isNegMes ? 'DC2626' : '16A34A', fill: bg }),
              formatCell(row.ytdReal, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdOrc, { align: AlignmentType.RIGHT, bold: row.isBold, fill: bg }),
              formatCell(row.ytdDelta, { align: AlignmentType.RIGHT, bold: true, color: isNegYtd ? 'DC2626' : '16A34A', fill: bg }),
            ],
          });
        }),
      ],
    })
  );

  const document = new Document({
    creator: 'FP&A NIO Fibra',
    title: 'NIO Fechamento Agosto/2026 · Documento de leitura',
    description: 'Documento executivo oficial de reunião de performance de resultados da NIO Fibra.',
    styles: {
      default: {
        document: {
          run: { font: 'Aptos', size: 16.5, color: '1F2937' },
          paragraph: { spacing: { after: 70 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 900, right: 900, bottom: 900, left: 900, header: 360, footer: 360 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
