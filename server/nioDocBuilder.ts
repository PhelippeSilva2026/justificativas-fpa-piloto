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
import { buildNioDynamicPageData } from './nioData';
import { NioExecutiveNarrative } from './geminiExecutiveReport';
import { FinancialReportRow, PhysicalReportRow } from './wordReport';
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

const MONTHS_PT = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export async function buildNioExecutiveDocx(params: {
  period: string;
  financialRows?: FinancialReportRow[];
  physicalRows?: PhysicalReportRow[];
  narrative: NioExecutiveNarrative;
  logoBuffer?: Buffer;
}): Promise<Buffer> {
  const { period, financialRows, physicalRows, narrative, logoBuffer } = params;
  const [yStr, mStr] = String(period || '2026/8').split('/');
  const year = Number(yStr) || 2026;
  const month = Number(mStr) || 8;
  const monthName = MONTHS_PT[month] || 'Agosto';
  const shortYear = String(year).slice(-2);
  const monthShort = monthName.slice(0, 3);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonthShort = (MONTHS_PT[previousMonth] || '').slice(0, 3);
  const previousShortYear = String(previousYear).slice(-2);
  const priorYearShort = String(year - 1).slice(-2);
  const d = buildNioDynamicPageData({ period, financialRows, physicalRows });
  const displayToNumber = (value: string) => {
    const clean = String(value || '').trim();
    if (!clean || clean === '-') return 0;
    const negative = clean.startsWith('(') || clean.startsWith('-');
    const numeric = Number(clean.replace(/[()%-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return negative ? -numeric : numeric;
  };
  const pl = (label: string) => d.plRows.find((row) => row.label === label);
  const phys = (label: string) => physicalRows?.find((row) => row.indicator === label);
  const basePhysical = phys('Base EOP');
  const churnPhysical = phys('Churn');
  const churnRate = (churnValue?: number, baseValue?: number) => baseValue ? ((churnValue || 0) / baseValue) * 100 : 0;

  // Gráficos oficiais alimentados exclusivamente pelas bases da competência selecionada.
  const [
    chartEbitdaMes,
    chartEbitdaYtd,
    chartNetAdds,
    chartGrossAdds,
    chartChurn,
  ] = await Promise.all([
    renderWaterfallChart({
      title: `${monthName}/${shortYear} (R$ Mn)`,
      width: 500,
      height: 180,
      bars: [
        { label: 'EBITDA orç.', value: displayToNumber(pl('EBITDA')?.mesOrc || '0'), isTotal: true },
        { label: 'Receita', value: displayToNumber(pl('Receita líquida')?.mesDelta || '0') },
        { label: 'Rel. receita', value: -displayToNumber(pl('(-) Custos relacionados à receita')?.mesDelta || '0') },
        { label: 'Custo servir', value: -displayToNumber(pl('(-) Custo de servir')?.mesDelta || '0') },
        { label: 'Adm', value: -displayToNumber(pl('(-) Custos administrativos')?.mesDelta || '0') },
        { label: 'CAC', value: -displayToNumber(pl('(-) Custo de aquisição (CAC)')?.mesDelta || '0') },
        { label: 'Pessoal', value: -displayToNumber(pl('(-) Custos com pessoal')?.mesDelta || '0') },
        { label: 'EBITDA real', value: displayToNumber(pl('EBITDA')?.mesReal || '0'), isTotal: true },
      ],
    }),
    renderWaterfallChart({
      title: 'YTD (R$ Mn)',
      width: 500,
      height: 180,
      bars: [
        { label: 'EBITDA orç.', value: displayToNumber(pl('EBITDA')?.ytdOrc || '0'), isTotal: true },
        { label: 'Receita', value: displayToNumber(pl('Receita líquida')?.ytdDelta || '0') },
        { label: 'Rel. receita', value: -displayToNumber(pl('(-) Custos relacionados à receita')?.ytdDelta || '0') },
        { label: 'Custo servir', value: -displayToNumber(pl('(-) Custo de servir')?.ytdDelta || '0') },
        { label: 'Adm', value: -displayToNumber(pl('(-) Custos administrativos')?.ytdDelta || '0') },
        { label: 'CAC', value: -displayToNumber(pl('(-) Custo de aquisição (CAC)')?.ytdDelta || '0') },
        { label: 'Pessoal', value: -displayToNumber(pl('(-) Custos com pessoal')?.ytdDelta || '0') },
        { label: 'EBITDA real', value: displayToNumber(pl('EBITDA')?.ytdReal || '0'), isTotal: true },
      ],
    }),
    renderBarWithLineChart({
      title: 'Net Adds (mil)',
      width: 320,
      height: 140,
      labels: [`${previousMonthShort}/${previousShortYear}`, `${monthShort}/${shortYear}`],
      bars: [(phys('Net Adds')?.realPrevious || 0) / 1_000, (phys('Net Adds')?.real || 0) / 1_000],
      forecastLine: [(phys('Net Adds')?.budgetPrevious || 0) / 1_000, (phys('Net Adds')?.budget || 0) / 1_000],
      highlightLast: { label: `${monthShort}: real ${((phys('Net Adds')?.real || 0) / 1_000).toFixed(1)}k | orç. ${((phys('Net Adds')?.budget || 0) / 1_000).toFixed(1)}k` },
    }),
    renderBarWithLineChart({
      title: 'Gross Adds (mil)',
      width: 320,
      height: 140,
      labels: [`${previousMonthShort}/${previousShortYear}`, `${monthShort}/${shortYear}`],
      bars: [(phys('Gross Adds')?.realPrevious || 0) / 1_000, (phys('Gross Adds')?.real || 0) / 1_000],
      forecastLine: [(phys('Gross Adds')?.budgetPrevious || 0) / 1_000, (phys('Gross Adds')?.budget || 0) / 1_000],
      highlightLast: { label: `${monthShort}: real ${((phys('Gross Adds')?.real || 0) / 1_000).toFixed(1)}k | orç. ${((phys('Gross Adds')?.budget || 0) / 1_000).toFixed(1)}k` },
    }),
    renderLineChart({
      title: 'Churn (% a.m.)',
      width: 320,
      height: 140,
      labels: [`${previousMonthShort}/${previousShortYear}`, `${monthShort}/${shortYear}`],
      series: [
        { name: 'Churn total', color: '#16A34A', data: [churnRate(churnPhysical?.realPrevious, basePhysical?.realPrevious), churnRate(churnPhysical?.real, basePhysical?.real)] },
        { name: 'Orçado', color: '#10B981', strokeDasharray: '3,3', data: [churnRate(churnPhysical?.budgetPrevious, basePhysical?.budgetPrevious), churnRate(churnPhysical?.budget, basePhysical?.budget)] },
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
                        text: `Fechamento ${monthName}/${shortYear} · Documento de leitura`,
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
          text: `NIO | Fechamento ${monthName}/${year}`,
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
            formatCell(`Real ${monthShort.toLowerCase()}/${shortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 16 }),
            formatCell(`Orçado ${monthShort.toLowerCase()}/${shortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 18 }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true, widthPercent: 11 }),
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
            formatCell(`Real ${monthShort.toLowerCase()}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('Indicadores', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 28 }),
            formatCell(`${previousMonthShort}/${previousShortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell(`${monthShort}/${shortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Orçado', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell('Δ Orç.', { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell(`${monthShort}/${priorYearShort}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('Comissão unitária por canal (R$)', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 35 }),
            formatCell('Mix real | orç.', { header: true, align: AlignmentType.CENTER, fill: NIO_GREEN, bold: true }),
            formatCell(`${previousMonthShort}/${previousShortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
            formatCell(`${monthShort}/${shortYear}`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
    nioSubheading('5.5 Custos com pessoal'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: thinBorders,
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            formatCell('R$ Mn', { header: true, fill: NIO_GREEN, bold: true, widthPercent: 38 }),
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
            formatCell(`${monthName}/${shortYear} Real`, { header: true, align: AlignmentType.RIGHT, fill: NIO_GREEN, bold: true }),
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
    title: `NIO Fechamento ${monthName}/${year} · Documento de leitura`,
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
