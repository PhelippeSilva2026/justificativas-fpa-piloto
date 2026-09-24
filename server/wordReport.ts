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
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export type ReportCompanyId = 'nio' | 'vtal' | 'tecto';

export interface FinancialReportRow {
  id: string;
  classification: string;
  area: string;
  level3: string;
  level4: string;
  realCurrent: number;
  budgetCurrent: number;
  realYtd: number;
  budgetYtd: number;
}

export interface PhysicalReportRow {
  indicator: string;
  real: number;
  budget: number;
}

interface Impact {
  name?: string;
  value?: number;
  justification?: string;
}

interface RowJustifications {
  momImpacts?: Impact[];
  vsOrcadoImpacts?: Impact[];
  ytdImpacts?: Impact[];
}

interface WordReportInput {
  companyId: ReportCompanyId;
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, RowJustifications>;
  logo: Buffer;
}

const COMPANY = {
  nio: { name: 'NIO Fibra', short: 'NIO', primary: '14412A', accent: '39FF00' },
  vtal: { name: 'V.tal', short: 'V.tal', primary: '242424', accent: '4F927F' },
  tecto: { name: 'Tecto Data Centers', short: 'Tecto', primary: '242424', accent: '4F927F' },
} as const;

const MONTHS = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const borders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'D9D9D9' },
};

const formatMillions = (value: number) => {
  if (Math.abs(value) < 0.0005) return '-';
  const absolute = Math.abs(value / 1_000_000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return value < 0 ? `(${absolute})` : absolute;
};

const formatNumber = (value: number) => value.toLocaleString('pt-BR', {
  minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  maximumFractionDigits: 2,
});

const periodLabel = (period: string) => {
  const [yearText, monthText] = period.split('/');
  const month = Number(monthText);
  const year = Number(yearText);
  return `${MONTHS[month] || monthText}/${year}`;
};

const cell = (
  text: string,
  options: { header?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; fill?: string; bold?: boolean } = {},
) => new TableCell({
  shading: options.header || options.fill
    ? { type: ShadingType.CLEAR, color: 'auto', fill: options.fill || '404040' }
    : undefined,
  margins: { top: 90, bottom: 90, left: 110, right: 110 },
  children: [new Paragraph({
    alignment: options.align || AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text,
      bold: options.header || options.bold,
      color: options.header ? 'FFFFFF' : '202020',
      size: options.header ? 17 : 16,
      font: 'Aptos',
    })],
  })],
});

const financialTable = (rows: FinancialReportRow[], primary: string, period: string) => {
  const grouped = new Map<string, FinancialReportRow>();
  for (const row of rows) {
    const key = row.level3 || row.classification;
    const current = grouped.get(key) || {
      ...row,
      classification: key,
      realCurrent: 0,
      budgetCurrent: 0,
      realYtd: 0,
      budgetYtd: 0,
    };
    current.realCurrent += row.realCurrent;
    current.budgetCurrent += row.budgetCurrent;
    current.realYtd += row.realYtd;
    current.budgetYtd += row.budgetYtd;
    grouped.set(key, current);
  }
  const data = Array.from(grouped.values())
    .sort((a, b) => Math.abs((b.realCurrent - b.budgetCurrent)) - Math.abs((a.realCurrent - a.budgetCurrent)));
  const label = periodLabel(period);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell('R$ Mn', { header: true, fill: primary }),
          cell(`Real ${label}`, { header: true, align: AlignmentType.CENTER, fill: primary }),
          cell(`Orçado ${label}`, { header: true, align: AlignmentType.CENTER, fill: primary }),
          cell('Δ Mês', { header: true, align: AlignmentType.CENTER, fill: primary }),
          cell('Real YTD', { header: true, align: AlignmentType.CENTER, fill: primary }),
          cell('Orçado YTD', { header: true, align: AlignmentType.CENTER, fill: primary }),
          cell('Δ YTD', { header: true, align: AlignmentType.CENTER, fill: primary }),
        ],
      }),
      ...data.map((row, index) => new TableRow({
        children: [
          cell(row.classification, { bold: true, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.budgetCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realCurrent - row.budgetCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realYtd), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.budgetYtd), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realYtd - row.budgetYtd), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
        ],
      })),
    ],
  });
};

const heading = (
  text: string,
  primary: string,
  level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1,
) => new Paragraph({
  heading: level,
  spacing: { before: level === HeadingLevel.HEADING_1 ? 260 : 180, after: 100 },
  children: [new TextRun({ text, bold: true, color: primary, font: 'Aptos' })],
});

const body = (text: string) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 120, line: 260 },
  children: [new TextRun({ text, size: 19, color: '303030', font: 'Aptos' })],
});

const bullet = (text: string) => new Paragraph({
  bullet: { level: 0 },
  alignment: AlignmentType.JUSTIFIED,
  spacing: { after: 80, line: 250 },
  children: [new TextRun({ text, size: 18, color: '303030', font: 'Aptos' })],
});

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

export async function generateExecutiveWordReport(input: WordReportInput): Promise<Buffer> {
  const company = COMPANY[input.companyId];
  const label = periodLabel(input.period);
  const totals = input.financialRows.reduce((acc, row) => ({
    realCurrent: acc.realCurrent + row.realCurrent,
    budgetCurrent: acc.budgetCurrent + row.budgetCurrent,
    realYtd: acc.realYtd + row.realYtd,
    budgetYtd: acc.budgetYtd + row.budgetYtd,
  }), { realCurrent: 0, budgetCurrent: 0, realYtd: 0, budgetYtd: 0 });

  const rowsByVariance = [...input.financialRows].sort((a, b) =>
    Math.abs(b.realCurrent - b.budgetCurrent) - Math.abs(a.realCurrent - a.budgetCurrent)
  );
  const filledJustifications = rowsByVariance.flatMap((row) => {
    const saved = input.justifications[row.id] || {};
    const impacts = [...(saved.vsOrcadoImpacts || []), ...(saved.ytdImpacts || [])];
    const texts = impacts
      .filter((impact) => String(impact.justification || '').trim())
      .map((impact) => `${impact.name || 'Impacto'}: ${String(impact.justification).trim()}`);
    return texts.length ? [{ row, texts }] : [];
  });

  const summary = `${company.name} encerrou ${label} com realizado de R$ ${formatMillions(totals.realCurrent)} Mn, `
    + `ante orçamento de R$ ${formatMillions(totals.budgetCurrent)} Mn, resultando em desvio de `
    + `R$ ${formatMillions(totals.realCurrent - totals.budgetCurrent)} Mn. No acumulado, o realizado soma `
    + `R$ ${formatMillions(totals.realYtd)} Mn, comparado a R$ ${formatMillions(totals.budgetYtd)} Mn orçados.`;

  const logoRun = input.logo.length
    ? new ImageRun({ data: input.logo, transformation: { width: 72, height: 48 }, type: 'png' })
    : new TextRun({ text: company.short, bold: true, color: company.primary });

  const header = new Header({
    children: [new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [logoRun] })] }),
        new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Fechamento ${label} · Documento de leitura`, color: '595959', size: 16, font: 'Aptos' })],
        })] }),
      ] })],
    })],
  });

  const footer = new Footer({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({ text: 'USO INTERNO  |  ', size: 16, color: '595959', font: 'Aptos' }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '595959', font: 'Aptos' }),
    ],
  })] });

  const children: Array<Paragraph | Table> = [
    new Paragraph({
      spacing: { before: 120, after: 30 },
      children: [new TextRun({ text: `${company.short} | Fechamento ${label}`, bold: true, size: 34, color: company.primary, font: 'Aptos Display' })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: 'Documento de leitura · Reunião de performance de resultados', size: 21, color: '595959', font: 'Aptos' })],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: 'Valores financeiros em R$ milhões, exceto quando indicado.', italics: true, size: 17, color: '707070', font: 'Aptos' })],
    }),
    heading('1. Resumo executivo', company.primary),
    body(summary),
    heading('Mensagens-chave', company.primary, HeadingLevel.HEADING_2),
    ...(filledJustifications.length
      ? filledJustifications.slice(0, 8).map(({ row, texts }) => bullet(
        `${row.classification}: desvio mensal de R$ ${formatMillions(row.realCurrent - row.budgetCurrent)} Mn. ${texts.join(' ')}`
      ))
      : [body('Não há justificativas preenchidas para esta competência.')]),
    pageBreak(),
    heading('2. P&L e desempenho financeiro', company.primary),
    body('Visão consolidada das linhas financeiras com movimento na competência, comparando realizado e orçamento no mês e no acumulado do ano.'),
    financialTable(input.financialRows, company.primary, input.period),
    pageBreak(),
    heading('3. KPIs operacionais', company.primary),
    body('Indicadores físicos extraídos da base única de físicos para a empresa e competência selecionadas.'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ tableHeader: true, children: [
          cell('Indicador', { header: true, fill: company.primary }),
          cell('Real', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Orçado', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Δ', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
        ] }),
        ...(input.physicalRows.length
          ? input.physicalRows.map((row, index) => new TableRow({ children: [
            cell(row.indicator, { bold: true, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
            cell(formatNumber(row.real), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
            cell(formatNumber(row.budget), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
            cell(formatNumber(row.real - row.budget), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          ] }))
          : [new TableRow({ children: [cell('Sem indicadores físicos para a competência.'), cell('-'), cell('-'), cell('-')] })]),
      ],
    }),
    pageBreak(),
    heading('4. Justificativas de desvios', company.primary),
    ...(filledJustifications.length
      ? filledJustifications.flatMap(({ row, texts }) => [
        heading(row.classification, company.primary, HeadingLevel.HEADING_2),
        body(`Área: ${row.area || '-'} · Real: R$ ${formatMillions(row.realCurrent)} Mn · Orçado: R$ ${formatMillions(row.budgetCurrent)} Mn · Desvio: R$ ${formatMillions(row.realCurrent - row.budgetCurrent)} Mn.`),
        ...texts.map((text) => bullet(text)),
      ])
      : [body('Não há justificativas preenchidas para esta competência.')]),
    pageBreak(),
    heading('Anexo · P&L detalhado', company.primary),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders,
      rows: [
        new TableRow({ tableHeader: true, children: [
          cell('Classificação', { header: true, fill: company.primary }),
          cell('Área', { header: true, fill: company.primary }),
          cell('Real mês', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Orçado mês', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Δ mês', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Real YTD', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
          cell('Δ YTD', { header: true, align: AlignmentType.CENTER, fill: company.primary }),
        ] }),
        ...rowsByVariance.map((row, index) => new TableRow({ children: [
          cell(row.classification, { bold: true, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(row.area || '-', { fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.budgetCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realCurrent - row.budgetCurrent), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realYtd), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
          cell(formatMillions(row.realYtd - row.budgetYtd), { align: AlignmentType.RIGHT, fill: index % 2 ? 'F5F5F5' : 'FFFFFF' }),
        ] })),
      ],
    }),
  ];

  const document = new Document({
    creator: 'FP&A ManagementCo',
    title: `${company.short} Fechamento ${label}`,
    description: 'Documento executivo de leitura de resultados, desvios e indicadores físicos.',
    styles: {
      default: { document: { run: { font: 'Aptos', size: 19, color: '202020' }, paragraph: { spacing: { after: 100 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', run: { font: 'Aptos Display', size: 34, bold: true, color: '000000' } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 907, bottom: 893, left: 907, header: 420, footer: 420 },
        },
      },
      headers: { default: header },
      footers: { default: footer },
      children,
    }],
  });

  return Packer.toBuffer(document);
}
