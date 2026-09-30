import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
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
import { FinancialReportRow, PhysicalReportRow } from './wordReport';
import { VtalExecutiveNarrative, TectoExecutiveNarrative } from './geminiExecutiveReport';

const MONTHS_PT = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const HEADER_DARK = '3A3A3A';
const TAUPE_TOTAL = 'C8BEB7';
const SUBHEADER_GRAY = 'EBEBEB';
const MARGIN_GRAY = 'F2F2F2';
const BORDER_GRAY = 'D4D4D4';
const TEXT_DARK = '262626';
const TEXT_MUTED = '666666';

const gridBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_GRAY },
};

function parsePeriodLabel(period: string): { monthName: string; year: number; fullLabel: string } {
  const [yStr, mStr] = String(period || '2026/8').split('/');
  const year = Number(yStr) || 2026;
  const month = Number(mStr) || 8;
  const monthName = MONTHS_PT[month] || 'Agosto';
  return {
    monthName,
    year,
    fullLabel: `${monthName} ${year}`,
  };
}

/**
 * Formata valor em R$ milhões arredondado para inteiro com separador de milhar e parênteses para negativos.
 * Ex: 2799 -> "2.799", -158 -> "(158)", 0 -> "–"
 */
function fmtIntMn(valMn: number, zeroAsDash = true): string {
  if (Math.abs(valMn) < 0.05) {
    return zeroAsDash ? '–' : '0';
  }
  const rounded = Math.round(valMn);
  if (rounded === 0) {
    return valMn < 0 ? '(0)' : zeroAsDash ? '0' : '0';
  }
  const absFormatted = Math.abs(rounded).toLocaleString('pt-BR');
  return rounded < 0 ? `(${absFormatted})` : absFormatted;
}

/**
 * Formata variação percentual no padrão do relatório executivo V.tal / Tecto.
 * Para linhas de Receita/EBITDA: deltaPct = (real - orc) / |orc|
 * Para linhas de OPEX (negativas): segue a convenção da tabela oficial onde saving positivo aparece como (X%) de redução do gasto
 */
function fmtPct(orcMn: number, realMn: number, isOpex = false): string {
  if (Math.abs(orcMn) < 0.15) return '–';
  const delta = realMn - orcMn;
  const rawPct = isOpex && orcMn < 0
    ? (delta / orcMn) * 100
    : (delta / Math.abs(orcMn)) * 100;
  const rounded = Math.round(rawPct);
  if (rounded === 0) {
    return rawPct < 0 ? '(0%)' : '0%';
  }
  return rounded < 0 ? `(${Math.abs(rounded)}%)` : `${rounded}%`;
}

type RowStyleKind = 'header' | 'total' | 'group' | 'margin' | 'detail';

interface HoldingTableRowSpec {
  label: string;
  indent?: number; // 0, 1, 2
  kind: RowStyleKind;
  col1: string;
  col2: string;
  col3?: string;
  col4?: string;
}

function holdingCell(
  text: string,
  options: {
    kind: RowStyleKind;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    indentLevel?: number;
    widthPct?: number;
  }
): TableCell {
  const isHeader = options.kind === 'header';
  const isTotal = options.kind === 'total';
  const isGroup = options.kind === 'group';
  const isMargin = options.kind === 'margin';

  const fill = isHeader
    ? HEADER_DARK
    : isTotal
    ? TAUPE_TOTAL
    : isGroup
    ? SUBHEADER_GRAY
    : isMargin
    ? MARGIN_GRAY
    : 'FFFFFF';

  const bold = isHeader || isTotal;
  const color = isHeader ? 'FFFFFF' : TEXT_DARK;
  const indentSpaces = options.indentLevel ? '   '.repeat(options.indentLevel) : '';

  return new TableCell({
    width: options.widthPct ? { size: options.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: ShadingType.CLEAR, color: 'auto', fill },
    margins: { top: 65, bottom: 65, left: 110, right: 110 },
    children: [
      new Paragraph({
        alignment: options.align || AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text: `${indentSpaces}${text}`,
            bold,
            color,
            size: isHeader ? 17 : 17,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

function buildFiveColHoldingTable(
  firstColHeader: string,
  colHeaders: [string, string, string, string],
  rows: HoldingTableRowSpec[]
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          holdingCell(firstColHeader, { kind: 'header', align: AlignmentType.LEFT, widthPct: 44 }),
          holdingCell(colHeaders[0], { kind: 'header', align: AlignmentType.CENTER, widthPct: 14 }),
          holdingCell(colHeaders[1], { kind: 'header', align: AlignmentType.CENTER, widthPct: 14 }),
          holdingCell(colHeaders[2], { kind: 'header', align: AlignmentType.CENTER, widthPct: 14 }),
          holdingCell(colHeaders[3], { kind: 'header', align: AlignmentType.CENTER, widthPct: 14 }),
        ],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              holdingCell(r.label, {
                kind: r.kind,
                align: AlignmentType.LEFT,
                indentLevel: r.indent || 0,
                widthPct: 44,
              }),
              holdingCell(r.col1, { kind: r.kind, align: AlignmentType.CENTER, widthPct: 14 }),
              holdingCell(r.col2, { kind: r.kind, align: AlignmentType.CENTER, widthPct: 14 }),
              holdingCell(r.col3 ?? '–', { kind: r.kind, align: AlignmentType.CENTER, widthPct: 14 }),
              holdingCell(r.col4 ?? '–', { kind: r.kind, align: AlignmentType.CENTER, widthPct: 14 }),
            ],
          })
      ),
    ],
  });
}

function buildThreeColHoldingTable(
  colHeaders: [string, string, string],
  rows: HoldingTableRowSpec[]
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          holdingCell(colHeaders[0], { kind: 'header', align: AlignmentType.LEFT, widthPct: 44 }),
          holdingCell(colHeaders[1], { kind: 'header', align: AlignmentType.CENTER, widthPct: 28 }),
          holdingCell(colHeaders[2], { kind: 'header', align: AlignmentType.CENTER, widthPct: 28 }),
        ],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [
              holdingCell(r.label, {
                kind: r.kind,
                align: AlignmentType.LEFT,
                indentLevel: r.indent || 0,
                widthPct: 44,
              }),
              holdingCell(r.col1, { kind: r.kind, align: AlignmentType.CENTER, widthPct: 28 }),
              holdingCell(r.col2, { kind: r.kind, align: AlignmentType.CENTER, widthPct: 28 }),
            ],
          })
      ),
    ],
  });
}

function buildHoldingHeader(companyLabel: string, closingLabel: string): Header {
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B8B8B8' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                margins: { bottom: 60 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({ text: 'HOLDING · ', size: 16, color: TEXT_MUTED, font: 'Arial' }),
                      new TextRun({ text: companyLabel, bold: true, size: 16, color: TEXT_DARK, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                margins: { bottom: 60 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: `Closing ${closingLabel}`, size: 16, color: TEXT_MUTED, font: 'Arial' }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildHoldingFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({ text: 'Página ', size: 15, color: TEXT_MUTED, font: 'Arial' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, color: TEXT_MUTED, font: 'Arial' }),
          new TextRun({ text: ' de ', size: 15, color: TEXT_MUTED, font: 'Arial' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: TEXT_MUTED, font: 'Arial' }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: 'USO INTERNO', bold: true, size: 16, color: '000000', font: 'Arial' }),
        ],
      }),
    ],
  });
}

function buildCoverTitleBlock(companyTitle: string, fullPeriodLabel: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 280, after: 40 },
      children: [
        new TextRun({
          text: 'H O L D I N G',
          bold: true,
          size: 18,
          color: '737373',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: companyTitle,
          bold: true,
          size: 56,
          color: TEXT_DARK,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 140 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' },
      },
      children: [
        new TextRun({
          text: `Performance de Resultados — ${fullPeriodLabel} e Acumulado do Ano (YTD)`,
          size: 24,
          color: '666666',
          font: 'Arial',
        }),
      ],
    }),
  ];
}

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 3, color: 'D4D4D4' },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 26,
        color: TEXT_DARK,
        font: 'Arial',
      }),
    ],
  });
}

function tableUnitCaption(text = 'Valores em R$ milhões, exceto quando indicado.'): Paragraph {
  return new Paragraph({
    spacing: { before: 70, after: 110 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 16,
        color: TEXT_MUTED,
        font: 'Arial',
      }),
    ],
  });
}

function executiveBullet(text: string): Paragraph {
  const clean = String(text || '').trim();
  const colonIdx = clean.indexOf(':');
  const dashIdx = clean.indexOf('—');
  const children: TextRun[] = [];

  if (colonIdx > 0 && colonIdx < 48) {
    children.push(
      new TextRun({
        text: clean.slice(0, colonIdx + 1),
        bold: true,
        size: 18.5,
        color: TEXT_DARK,
        font: 'Arial',
      }),
      new TextRun({
        text: clean.slice(colonIdx + 1),
        size: 18.5,
        color: TEXT_DARK,
        font: 'Arial',
      })
    );
  } else if (dashIdx > 0 && dashIdx < 38) {
    children.push(
      new TextRun({
        text: clean.slice(0, dashIdx),
        bold: true,
        size: 18.5,
        color: TEXT_DARK,
        font: 'Arial',
      }),
      new TextRun({
        text: clean.slice(dashIdx),
        size: 18.5,
        color: TEXT_DARK,
        font: 'Arial',
      })
    );
  } else {
    children.push(
      new TextRun({
        text: clean,
        size: 18.5,
        color: TEXT_DARK,
        font: 'Arial',
      })
    );
  }

  return new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.LEFT,
    spacing: { before: 45, after: 75, line: 260 },
    children,
  });
}

const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

interface AggregatedPair {
  mOrc: number;
  mReal: number;
  yOrc: number;
  yReal: number;
}

function sumMatching(
  rows: FinancialReportRow[],
  predicate: (r: FinancialReportRow) => boolean,
  fallback?: { mOrc?: number; mReal?: number; yOrc: number; yReal: number }
): AggregatedPair {
  let mOrc = 0;
  let mReal = 0;
  let yOrc = 0;
  let yReal = 0;
  let count = 0;

  for (const r of rows) {
    if (predicate(r)) {
      mOrc += r.budgetCurrent / 1_000_000;
      mReal += r.realCurrent / 1_000_000;
      yOrc += r.budgetYtd / 1_000_000;
      yReal += r.realYtd / 1_000_000;
      count += 1;
    }
  }

  if (count === 0 && fallback) {
    return {
      mOrc: fallback.mOrc ?? 0,
      mReal: fallback.mReal ?? 0,
      yOrc: fallback.yOrc,
      yReal: fallback.yReal,
    };
  }

  return { mOrc, mReal, yOrc, yReal };
}

function makeYtdRow(
  label: string,
  pair: AggregatedPair,
  kind: RowStyleKind,
  indent = 0,
  isOpex = false
): HoldingTableRowSpec {
  const delta = pair.yReal - pair.yOrc;
  return {
    label,
    indent,
    kind,
    col1: fmtIntMn(pair.yOrc, true),
    col2: fmtIntMn(pair.yReal, true),
    col3: Math.abs(pair.yOrc) < 0.05 && Math.abs(pair.yReal) < 0.05 ? '–' : fmtIntMn(delta, false),
    col4: fmtPct(pair.yOrc, pair.yReal, isOpex),
  };
}

/**
 * Constrói o documento Word executivo da V.tal (4 páginas idênticas ao modelo HOLDING · V.tal)
 */
export async function buildVtalExecutiveDocx(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  narrative: VtalExecutiveNarrative;
}): Promise<Buffer> {
  const { period, financialRows, narrative } = params;
  const { fullLabel } = parsePeriodLabel(period);

  // Filtra linhas BAU da V.tal (ex-LTLA, ex-B2B, ex-UmTelecom, ex-Mobile Solutions, ex-Special Projects)
  const vtalBauRows = financialRows.filter((r) => {
    const l0 = (r.level0 || 'BAU').trim().toUpperCase();
    const l2 = (r.level2 || 'V.tal').trim();
    return l0 === 'BAU' && l2 === 'V.tal';
  });

  // Filtra todas as linhas consolidadas ex-LTLA para a Tabela 1 (Resultado do Mês)
  const vtalExLtlaRows = financialRows.filter((r) => {
    const l2 = (r.level2 || 'V.tal').trim();
    return l2 !== 'V.tal (LTLA)';
  });

  const isRevenueRow = (r: FinancialReportRow) => {
    if (r.level1 && r.level1 !== '-') {
      return r.level1.toLowerCase().includes('revenue');
    }
    return ['FTTH', 'Wholesale', 'Other Revenue (Swaps, IRU)', 'Connectivity', 'Low latency', 'TIC', 'Performance Business', 'UmTelecom', 'Copper', 'IPV4'].includes(r.level3);
  };

  // --- RECEITA BAU ---
  const anchorMonthly = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('monthly')
  );
  const anchorConn = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('connection')
  );
  const anchorVoip = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('voip')
  );
  const anchorMakeWhole = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('make whole')
  );
  const anchorTaxCredits = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('beneficio')
  );
  const anchorOtherFtth = sumMatching(
    vtalBauRows,
    (r) =>
      r.level3 === 'FTTH' &&
      r.level4 === 'Anchor Tenant' &&
      !r.classification.toLowerCase().includes('monthly') &&
      !r.classification.toLowerCase().includes('connection') &&
      !r.classification.toLowerCase().includes('voip') &&
      !r.classification.toLowerCase().includes('make whole') &&
      !r.classification.toLowerCase().includes('beneficio')
  );
  const anchorTotal = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant'
  );

  const otherTenantsMonthly = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Other Tenants' && r.classification.toLowerCase().includes('monthly')
  );
  const otherTenantsConn = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Other Tenants' && r.classification.toLowerCase().includes('connection')
  );
  const otherTenantsOther = sumMatching(
    vtalBauRows,
    (r) =>
      r.level3 === 'FTTH' &&
      r.level4 === 'Other Tenants' &&
      !r.classification.toLowerCase().includes('monthly') &&
      !r.classification.toLowerCase().includes('connection')
  );
  const otherTenantsTotal = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'FTTH' && r.level4 === 'Other Tenants'
  );

  const ftthTotal = sumMatching(vtalBauRows, (r) => r.level3 === 'FTTH');

  // Wholesale
  const perfIntl = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'Performance Business' && r.classification.toLowerCase().includes('international')
  );
  const perfNat = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'Performance Business' && !r.classification.toLowerCase().includes('international')
  );
  const perfBusiness = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'Performance Business'
  );
  const oiB2b = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'Oi B2B'
  );
  const topContracts = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'ToP Contracts'
  );
  const copperNetMgmt = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Wholesale' && r.level4 === 'Copper Network Management'
  );
  const wholesaleTotal = sumMatching(vtalBauRows, (r) => r.level3 === 'Wholesale');

  // Other Revenue (Swaps, IRU)
  const ductsSharing = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && r.classification.toLowerCase().includes('ducts')
  );
  const polesSharing = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && !r.classification.toLowerCase().includes('ducts') && r.level4.toLowerCase().includes('passive')
  );
  const passiveInfraRev = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && r.level4.toLowerCase().includes('passive')
  );
  const receitaSwaps = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && r.classification.toLowerCase().includes('receita swaps')
  );
  const iruContracts = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && r.classification.toLowerCase().includes('iru')
  );
  const swapsIruTotal = sumMatching(
    vtalBauRows,
    (r) => r.level3 === 'Other Revenue (Swaps, IRU)' && r.level4 === 'Swaps/IRU'
  );
  const otherRevTotal = sumMatching(vtalBauRows, (r) => r.level3 === 'Other Revenue (Swaps, IRU)');

  const netRevenueBau = sumMatching(vtalBauRows, (r) => isRevenueRow(r));

  // --- OPEX BAU ---
  const opexMaintTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs');
  const maintB2bVar = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'B2B Network Variable Maintenance');
  const maintDarkFiber = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'Dark Fiber');
  const maintFtthFixed = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'FTTH & Backbone Fixed Maintenance');
  const maintFtthVar = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'FTTH Network Variable Maintenance');
  const maintIntl = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'International Connectivity');
  const maintInv = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'Inventory Management');
  const maintNoc = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4 === 'Network Operation Center');
  const maintVoip = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Maintenance & Operational Costs' && r.level4.toUpperCase() === 'VOIP');

  const opexPassiveTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure');
  const passBusSupport = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Business Support');
  const passRealEstate = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && (r.level4 === 'Real Estate' || r.level4 === 'Facilities'));
  const passFrota = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Frota');
  const passSecurity = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Security');
  const passEnergy = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Energy');
  const passTransInfra = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Transmission Infra');
  const passDataTelco = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Passive network infrastructure' && r.level4 === 'Data Telco');

  const opexSwapsTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Swaps');
  const swapsDucts = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Swaps' && r.level4 === 'Swaps Ducts');
  const swapsTaxRec = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Swaps' && (r.level4 === 'Lite Fiber' || r.level4 === 'Tax Recovery'));
  const swapsDarkFiber = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Swaps' && r.level4 === 'Dark Fiber');

  const opexHrTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'HR');

  const opexSgaTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A');
  const sgaIt = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'IT');
  const sgaLegal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'Legal');
  const sgaSpec = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'Specialized Services');
  const sgaMkt = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'Marketing');
  const sgaLaborCont = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'Contingencies');
  const sgaClientCo = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && (r.level4 === 'ClientCo' || r.level4 === 'Fee'));
  const sgaOtherExp = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'SG&A' && r.level4 === 'Other expenses');

  const opexOthersTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Others');
  const othersTax = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Others' && r.level4 === 'Tax & Other');
  const othersWriteOff = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Others' && (r.level4 === 'Assets Write-off' || r.level4 === 'Others'));
  const othersBadDebt = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Others' && r.level4 === 'Bad debt V.tal');
  const othersNonOp = sumMatching(vtalBauRows, (r) => !isRevenueRow(r) && r.level3 === 'Others' && r.level4 === 'Non-operational Revenue');

  const opexBauTotal = sumMatching(vtalBauRows, (r) => !isRevenueRow(r));

  const ebitdaBau: AggregatedPair = {
    mOrc: netRevenueBau.mOrc + opexBauTotal.mOrc,
    mReal: netRevenueBau.mReal + opexBauTotal.mReal,
    yOrc: netRevenueBau.yOrc + opexBauTotal.yOrc,
    yReal: netRevenueBau.yReal + opexBauTotal.yReal,
  };

  // Totais consolidados ex-LTLA do Mês Selecionado (Tabela 1: Resultado do Mês)
  const monthNetRev = sumMatching(vtalExLtlaRows, (r) => isRevenueRow(r));
  const monthOpex = sumMatching(vtalExLtlaRows, (r) => !isRevenueRow(r));
  const monthEbitda: AggregatedPair = {
    mOrc: monthNetRev.mOrc + monthOpex.mOrc,
    mReal: monthNetRev.mReal + monthOpex.mReal,
    yOrc: monthNetRev.yOrc + monthOpex.yOrc,
    yReal: monthNetRev.yReal + monthOpex.yReal,
  };
  const mMarginOrc = Math.abs(monthNetRev.mOrc) > 0.1 ? (monthEbitda.mOrc / monthNetRev.mOrc) * 100 : 0;
  const mMarginReal = Math.abs(monthNetRev.mReal) > 0.1 ? (monthEbitda.mReal / monthNetRev.mReal) * 100 : 0;
  const mMarginDelta = Math.round(mMarginReal - mMarginOrc);
  const mMarginDeltaStr = mMarginDelta < 0 ? `(${Math.abs(mMarginDelta)})pp` : `${mMarginDelta}pp`;

  // Tabela 1: Resultado do Mês Selecionado
  const monthTableRows: HoldingTableRowSpec[] = [
    {
      label: 'Receita Líquida',
      kind: 'detail',
      col1: fmtIntMn(monthNetRev.mOrc, false),
      col2: fmtIntMn(monthNetRev.mReal, false),
      col3: fmtIntMn(monthNetRev.mReal - monthNetRev.mOrc, false),
      col4: fmtPct(monthNetRev.mOrc, monthNetRev.mReal, false),
    },
    {
      label: 'OPEX',
      kind: 'detail',
      col1: fmtIntMn(monthOpex.mOrc, false),
      col2: fmtIntMn(monthOpex.mReal, false),
      col3: fmtIntMn(monthOpex.mReal - monthOpex.mOrc, false),
      col4: fmtPct(monthOpex.mOrc, monthOpex.mReal, true),
    },
    {
      label: 'EBITDA',
      kind: 'total',
      col1: fmtIntMn(monthEbitda.mOrc, false),
      col2: fmtIntMn(monthEbitda.mReal, false),
      col3: fmtIntMn(monthEbitda.mReal - monthEbitda.mOrc, false),
      col4: fmtPct(monthEbitda.mOrc, monthEbitda.mReal, false),
    },
    {
      label: '% Margem EBITDA',
      kind: 'margin',
      col1: `${Math.round(mMarginOrc)}%`,
      col2: `${Math.round(mMarginReal)}%`,
      col3: mMarginDeltaStr,
      col4: '—',
    },
  ];

  const yMarginOrc = Math.abs(netRevenueBau.yOrc) > 0.1 ? (ebitdaBau.yOrc / netRevenueBau.yOrc) * 100 : 0;
  const yMarginReal = Math.abs(netRevenueBau.yReal) > 0.1 ? (ebitdaBau.yReal / netRevenueBau.yReal) * 100 : 0;
  const yMarginDelta = Math.round(yMarginReal - yMarginOrc);
  const yMarginDeltaStr = yMarginDelta < 0 ? `(${Math.abs(yMarginDelta)})pp` : `${yMarginDelta}pp`;

  // Tabela 2: Resultado Acumulado (YTD) — BAU
  const ytdBauTableRows: HoldingTableRowSpec[] = [
    makeYtdRow('Receita Líquida (ex LTLA)', netRevenueBau, 'total', 0, false),
    makeYtdRow('FTTH', ftthTotal, 'group', 1, false),
    makeYtdRow('Anchor Tenant', anchorTotal, 'detail', 2, false),
    makeYtdRow('Other Tenants', otherTenantsTotal, 'detail', 2, false),
    makeYtdRow('Wholesale', wholesaleTotal, 'group', 1, false),
    makeYtdRow('Performance Business', perfBusiness, 'detail', 2, false),
    makeYtdRow('Oi B2B', oiB2b, 'detail', 2, false),
    makeYtdRow('ToP Contracts', topContracts, 'detail', 2, false),
    makeYtdRow('Other Revenue (Swaps, IRU)', otherRevTotal, 'group', 1, false),
    makeYtdRow('Passive infra revenue (Postes & Dutos)', passiveInfraRev, 'detail', 2, false),
    makeYtdRow('Swaps/IRU', swapsIruTotal, 'detail', 2, false),
    makeYtdRow('OPEX', opexBauTotal, 'total', 0, true),
    makeYtdRow('Maintenance & Operational Costs', opexMaintTotal, 'group', 1, true),
    makeYtdRow('Passive network infrastructure', opexPassiveTotal, 'group', 1, true),
    makeYtdRow('Swaps', opexSwapsTotal, 'group', 1, true),
    makeYtdRow('HR', opexHrTotal, 'group', 1, true),
    makeYtdRow('SG&A', opexSgaTotal, 'group', 1, true),
    makeYtdRow('Others', opexOthersTotal, 'group', 1, false),
    makeYtdRow('EBITDA BAU (ex LTLA)', ebitdaBau, 'total', 0, false),
    {
      label: '% Margem',
      indent: 0,
      kind: 'margin',
      col1: `${Math.round(yMarginOrc)}%`,
      col2: `${Math.round(yMarginReal)}%`,
      col3: yMarginDeltaStr,
      col4: '—',
    },
  ];

  // Tabela 3: Detalhamento da Receita (YTD)
  const revenueDetailRows: HoldingTableRowSpec[] = [
    makeYtdRow('Receita Líquida (ex LTLA)', netRevenueBau, 'total', 0, false),
    makeYtdRow('FTTH', ftthTotal, 'group', 1, false),
    makeYtdRow('Anchor Tenant', anchorTotal, 'group', 2, false),
    makeYtdRow('Monthly fee', anchorMonthly, 'detail', 3, false),
    makeYtdRow('Connection fee', anchorConn, 'detail', 3, false),
    makeYtdRow('VOIP', anchorVoip, 'detail', 3, false),
    makeYtdRow('Make-whole', anchorMakeWhole, 'detail', 3, false),
    makeYtdRow('Tax credits', anchorTaxCredits, 'detail', 3, false),
    makeYtdRow('Other FTTH', anchorOtherFtth, 'detail', 3, false),
    makeYtdRow('Other Tenants', otherTenantsTotal, 'group', 2, false),
    makeYtdRow('Monthly fee', otherTenantsMonthly, 'detail', 3, false),
    makeYtdRow('Connection fee', otherTenantsConn, 'detail', 3, false),
    makeYtdRow('Other FTTH', otherTenantsOther, 'detail', 3, false),
    makeYtdRow('Wholesale', wholesaleTotal, 'group', 1, false),
    makeYtdRow('Performance Business', perfBusiness, 'group', 2, false),
    makeYtdRow('International Connectivity', perfIntl, 'detail', 3, false),
    makeYtdRow('National Connectivity', perfNat, 'detail', 3, false),
    makeYtdRow('Oi B2B', oiB2b, 'group', 2, false),
    makeYtdRow('ToP Contracts', topContracts, 'group', 2, false),
    makeYtdRow('Copper Network Management', copperNetMgmt, 'group', 2, false),
    makeYtdRow('Other Revenue (Swaps, IRU)', otherRevTotal, 'group', 1, false),
    makeYtdRow('Passive infra revenue (Postes & Dutos)', passiveInfraRev, 'group', 2, false),
    makeYtdRow('Ducts Infra Sharing', ductsSharing, 'detail', 3, false),
    makeYtdRow('Poles Infra Sharing', polesSharing, 'detail', 3, false),
    makeYtdRow('Swaps/IRU', swapsIruTotal, 'group', 2, false),
    makeYtdRow('Receita Swaps', receitaSwaps, 'detail', 3, false),
    makeYtdRow('IRU Contracts', iruContracts, 'detail', 3, false),
  ];

  // Tabela 4: Detalhamento do OPEX (YTD)
  const opexDetailRows: HoldingTableRowSpec[] = [
    makeYtdRow('OPEX', opexBauTotal, 'total', 0, true),
    makeYtdRow('Maintenance & Operational Costs', opexMaintTotal, 'group', 1, true),
    makeYtdRow('B2B Network Variable Maintenance', maintB2bVar, 'detail', 2, true),
    makeYtdRow('Dark Fiber', maintDarkFiber, 'detail', 2, true),
    makeYtdRow('FTTH & Backbone Fixed Maintenance', maintFtthFixed, 'detail', 2, true),
    makeYtdRow('FTTH Network Variable Maintenance', maintFtthVar, 'detail', 2, true),
    makeYtdRow('International Connectivity', maintIntl, 'detail', 2, true),
    makeYtdRow('Inventory Management', maintInv, 'detail', 2, true),
    makeYtdRow('Network Operation Center', maintNoc, 'detail', 2, true),
    makeYtdRow('Voip', maintVoip, 'detail', 2, true),
    makeYtdRow('Passive network infrastructure', opexPassiveTotal, 'group', 1, true),
    makeYtdRow('Business Support', passBusSupport, 'detail', 2, true),
    makeYtdRow('Real Estate', passRealEstate, 'detail', 2, true),
    makeYtdRow('Frota', passFrota, 'detail', 2, true),
    makeYtdRow('Security', passSecurity, 'detail', 2, true),
    makeYtdRow('Energy', passEnergy, 'detail', 2, true),
    makeYtdRow('Transmission Infra', passTransInfra, 'detail', 2, true),
    makeYtdRow('Data Telco', passDataTelco, 'detail', 2, true),
    makeYtdRow('Swaps', opexSwapsTotal, 'group', 1, true),
    makeYtdRow('Swap Ducts', swapsDucts, 'detail', 2, true),
    makeYtdRow('Tax Recovery', swapsTaxRec, 'detail', 2, true),
    makeYtdRow('Dark Fiber', swapsDarkFiber, 'detail', 2, true),
    makeYtdRow('HR', opexHrTotal, 'group', 1, true),
    makeYtdRow('SG&A', opexSgaTotal, 'group', 1, true),
    makeYtdRow('IT', sgaIt, 'detail', 2, true),
    makeYtdRow('Legal', sgaLegal, 'detail', 2, true),
    makeYtdRow('Specialized Services', sgaSpec, 'detail', 2, true),
    makeYtdRow('Marketing', sgaMkt, 'detail', 2, true),
    makeYtdRow('Labor Contingencies', sgaLaborCont, 'detail', 2, true),
    makeYtdRow('ClientCo', sgaClientCo, 'detail', 2, true),
    makeYtdRow('Other Expenses', sgaOtherExp, 'detail', 2, true),
    makeYtdRow('Others', opexOthersTotal, 'group', 1, false),
    makeYtdRow('Tax & Other', othersTax, 'detail', 2, false),
    makeYtdRow('Assets Write-off', othersWriteOff, 'detail', 2, false),
    makeYtdRow('Bad debt V.tal', othersBadDebt, 'detail', 2, true),
    makeYtdRow('Non-operational Revenue', othersNonOp, 'detail', 2, true),
  ];

  // Tabela 5: Novos Negócios (YTD) — calculada dinamicamente do BigQuery (NIVEL_0 = 'NEW BUSINESS')
  const fmtMnSigned = (valMn: number, withPlus = false): string => {
    const rounded = Math.round(valMn);
    if (rounded === 0) {
      return valMn < -0.05 ? '(0)mn' : '0mn';
    }
    const absStr = Math.abs(rounded).toLocaleString('pt-BR');
    if (rounded < 0) return `(${absStr})mn`;
    return `${withPlus ? '+' : ''}${absStr}mn`;
  };

  const ebitdaB2b = sumMatching(
    financialRows,
    (r) => (r.level0 || '').trim().toUpperCase() === 'NEW BUSINESS' && (r.level2 || '').trim() === 'B2B'
  );
  const ebitdaUmTelecom = sumMatching(
    financialRows,
    (r) => (r.level0 || '').trim().toUpperCase() === 'NEW BUSINESS' && (r.level2 || '').trim() === 'UmTelecom'
  );
  const ebitdaMobile = sumMatching(
    financialRows,
    (r) => (r.level0 || '').trim().toUpperCase() === 'NEW BUSINESS' && (r.level2 || '').trim() === 'Mobile Solutions'
  );

  const newBusinessTableRows: HoldingTableRowSpec[] = [
    {
      label: 'EBITDA B2B',
      kind: 'detail',
      col1: fmtMnSigned(ebitdaB2b.yReal, false),
      col2: fmtMnSigned(ebitdaB2b.yReal - ebitdaB2b.yOrc, true),
    },
    {
      label: 'EBITDA Um Telecom',
      kind: 'detail',
      col1: fmtMnSigned(ebitdaUmTelecom.yReal, false),
      col2: fmtMnSigned(ebitdaUmTelecom.yReal - ebitdaUmTelecom.yOrc, true),
    },
    {
      label: 'EBITDA Mobile Solutions',
      kind: 'detail',
      col1: fmtMnSigned(ebitdaMobile.yReal, false),
      col2: fmtMnSigned(ebitdaMobile.yReal - ebitdaMobile.yOrc, true),
    },
  ];

  // Tabela 6: Projetos V.tal (YTD) — calculada dinamicamente do BigQuery (NIVEL_0 = 'SPECIAL PROJECTS')
  const fmtProjDelta = (pair: AggregatedPair): string => {
    const delta = pair.yReal - pair.yOrc;
    const deltaStr = fmtMnSigned(delta, true);
    if (Math.abs(pair.yOrc) < 0.15) return deltaStr;
    const pct = Math.round(((pair.yReal - pair.yOrc) / Math.abs(pair.yOrc)) * 100);
    const signedPct = pct > 0 ? `+${pct}%` : `${pct}%`;
    return `${deltaStr} (${signedPct})`;
  };

  const projIpv4 = sumMatching(
    financialRows,
    (r) =>
      (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS' &&
      (r.level3.trim().toUpperCase() === 'IPV4' ||
        r.classification.trim().toUpperCase() === 'RECEITA IPV4')
  );
  const projBuildings = sumMatching(
    financialRows,
    (r) =>
      (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS' &&
      (r.level3.trim() === 'Real Estate' ||
        r.classification.trim() === 'Real Estate - Venda de Prédios' ||
        r.level4.trim() === 'Sales of Buildings')
  );
  const projTotal = sumMatching(
    financialRows,
    (r) => (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS'
  );

  const projectsTableRows: HoldingTableRowSpec[] = [
    {
      label: 'IPv4',
      kind: 'detail',
      col1: fmtMnSigned(projIpv4.yReal, false),
      col2: fmtProjDelta(projIpv4),
    },
    {
      label: 'Venda de Prédios',
      kind: 'detail',
      col1: fmtMnSigned(projBuildings.yReal, false),
      col2: fmtProjDelta(projBuildings),
    },
    {
      label: 'EBITDA Projetos (total)¹',
      kind: 'total',
      col1: fmtMnSigned(projTotal.yReal, false),
      col2: fmtProjDelta(projTotal),
    },
  ];

  const children: Array<Paragraph | Table> = [
    ...buildCoverTitleBlock('V.tal', fullLabel),
    sectionHeading('Destaques'),
    ...narrative.highlights.map((b) => executiveBullet(b)),

    sectionHeading(`Resultado de ${fullLabel}`),
    buildFiveColHoldingTable(
      'Indicador',
      ['Orçado', 'Realizado', 'Δ Orçado', 'Δ Orçado %'],
      monthTableRows
    ),
    tableUnitCaption(),

    sectionHeading(`Resultado Acumulado (YTD) ${parsePeriodLabel(period).year} — BAU`),
    buildFiveColHoldingTable(
      'Linha',
      ['Orçado YTD', 'Realizado YTD', 'Δ Orçado', 'Δ Orçado %'],
      ytdBauTableRows
    ),
    tableUnitCaption(),
    ...narrative.ytdBauBullets.map((b) => executiveBullet(b)),

    sectionHeading('Detalhamento da Receita (YTD)'),
    buildFiveColHoldingTable(
      'Linha',
      ['Orçado YTD', 'Realizado YTD', 'Δ Orçado', 'Δ Orçado %'],
      revenueDetailRows
    ),
    new Paragraph({ spacing: { before: 80, after: 40 }, children: [] }),
    ...narrative.revenueDetailBullets.map((b) => executiveBullet(b)),

    sectionHeading('Detalhamento do OPEX (YTD)'),
    buildFiveColHoldingTable(
      'Linha',
      ['Orçado YTD', 'Realizado YTD', 'Δ Orçado', 'Δ Orçado %'],
      opexDetailRows
    ),

    sectionHeading('Novos Negócios (YTD)'),
    buildThreeColHoldingTable(['Linha de EBITDA', 'Realizado YTD', 'Δ Orçado'], newBusinessTableRows),
    new Paragraph({ spacing: { before: 60, after: 20 }, children: [] }),
    ...narrative.newBusinessBullets.map((b) => executiveBullet(b)),

    sectionHeading('Projetos V.tal (YTD)'),
    buildThreeColHoldingTable(['Projeto', 'Realizado', 'Δ Orçado'], projectsTableRows),
    tableUnitCaption(narrative.projectsFootnote),
    ...narrative.projectsBullets.map((b) => executiveBullet(b)),
  ];

  const document = new Document({
    creator: 'FP&A Holding V.tal',
    title: `HOLDING · V.tal — Closing ${fullLabel}`,
    description: 'Performance de Resultados — V.tal',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 18, color: TEXT_DARK },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 960, right: 900, bottom: 960, left: 900, header: 420, footer: 420 },
          },
        },
        headers: { default: buildHoldingHeader('V.tal', fullLabel) },
        footers: { default: buildHoldingFooter() },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

/**
 * Constrói o documento Word executivo da Tecto seguindo exatamente o mesmo padrão visual HOLDING · Tecto
 */
export async function buildTectoExecutiveDocx(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  narrative: TectoExecutiveNarrative;
}): Promise<Buffer> {
  const { period, financialRows, physicalRows, narrative } = params;
  const { fullLabel, year } = parsePeriodLabel(period);

  // Agregações dinâmicas da Tecto a partir do BigQuery
  const colocationRev = sumMatching(
    financialRows,
    (r) => r.level3 === 'Colocation' || r.classification.toLowerCase().includes('colocation')
  );

  // Operational Costs
  const opPower = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('power')
  );
  const opMaint = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('maintenance')
  );
  const opFacilities = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('facilities')
  );
  const opSecurity = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('security')
  );
  const opZpe = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('zpe')
  );
  const opCostsTotal: AggregatedPair = {
    mOrc: opPower.mOrc + opMaint.mOrc + opFacilities.mOrc + opSecurity.mOrc + opZpe.mOrc,
    mReal: opPower.mReal + opMaint.mReal + opFacilities.mReal + opSecurity.mReal + opZpe.mReal,
    yOrc: opPower.yOrc + opMaint.yOrc + opFacilities.yOrc + opSecurity.yOrc + opZpe.yOrc,
    yReal: opPower.yReal + opMaint.yReal + opFacilities.yReal + opSecurity.yReal + opZpe.yReal,
  };

  // HR
  const hrLabor = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('personnel')
  );
  const hrCostSharing = sumMatching(
    financialRows,
    (r) => r.level3 === 'HR' && r.classification.toLowerCase().includes('cost sharing')
  );
  const hrTotal: AggregatedPair = {
    mOrc: hrLabor.mOrc + hrCostSharing.mOrc,
    mReal: hrLabor.mReal + hrCostSharing.mReal,
    yOrc: hrLabor.yOrc + hrCostSharing.yOrc,
    yReal: hrLabor.yReal + hrCostSharing.yReal,
  };

  // SG&A
  const sgaConsult = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('consultorias')
  );
  const sgaTravel = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('travel')
  );
  const sgaLegal = sumMatching(
    financialRows,
    (r) => r.level3 === 'SG&A' && r.classification.toLowerCase().includes('legal')
  );
  const sgaMkt = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('marketing')
  );
  const sgaIt = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('opex it')
  );
  const sgaInsurance = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('insurance')
  );
  const sgaTotal: AggregatedPair = {
    mOrc: sgaConsult.mOrc + sgaTravel.mOrc + sgaLegal.mOrc + sgaMkt.mOrc + sgaIt.mOrc + sgaInsurance.mOrc,
    mReal: sgaConsult.mReal + sgaTravel.mReal + sgaLegal.mReal + sgaMkt.mReal + sgaIt.mReal + sgaInsurance.mReal,
    yOrc: sgaConsult.yOrc + sgaTravel.yOrc + sgaLegal.yOrc + sgaMkt.yOrc + sgaIt.yOrc + sgaInsurance.yOrc,
    yReal: sgaConsult.yReal + sgaTravel.yReal + sgaLegal.yReal + sgaMkt.yReal + sgaIt.yReal + sgaInsurance.yReal,
  };

  // Others
  const otherOpex = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('other opex')
  );
  const otherPdd = sumMatching(
    financialRows,
    (r) => r.classification.toLowerCase().includes('pdd')
  );
  const othersTotal: AggregatedPair = {
    mOrc: otherOpex.mOrc + otherPdd.mOrc,
    mReal: otherOpex.mReal + otherPdd.mReal,
    yOrc: otherOpex.yOrc + otherPdd.yOrc,
    yReal: otherOpex.yReal + otherPdd.yReal,
  };

  const opexTotal: AggregatedPair = {
    mOrc: opCostsTotal.mOrc + hrTotal.mOrc + sgaTotal.mOrc + othersTotal.mOrc,
    mReal: opCostsTotal.mReal + hrTotal.mReal + sgaTotal.mReal + othersTotal.mReal,
    yOrc: opCostsTotal.yOrc + hrTotal.yOrc + sgaTotal.yOrc + othersTotal.yOrc,
    yReal: opCostsTotal.yReal + hrTotal.yReal + sgaTotal.yReal + othersTotal.yReal,
  };

  const ebitdaTecto: AggregatedPair = {
    mOrc: colocationRev.mOrc + opexTotal.mOrc,
    mReal: colocationRev.mReal + opexTotal.mReal,
    yOrc: colocationRev.yOrc + opexTotal.yOrc,
    yReal: colocationRev.yReal + opexTotal.yReal,
  };

  // Tabela 1: Resultado do Mês
  const monthTableRows: HoldingTableRowSpec[] = [
    {
      label: 'Receita Líquida (Colocation)',
      kind: 'detail',
      col1: fmtIntMn(colocationRev.mOrc, true),
      col2: fmtIntMn(colocationRev.mReal, true),
      col3: fmtIntMn(colocationRev.mReal - colocationRev.mOrc, false),
      col4: fmtPct(colocationRev.mOrc, colocationRev.mReal, false),
    },
    {
      label: 'OPEX',
      kind: 'detail',
      col1: fmtIntMn(opexTotal.mOrc, false),
      col2: fmtIntMn(opexTotal.mReal, false),
      col3: fmtIntMn(opexTotal.mReal - opexTotal.mOrc, false),
      col4: fmtPct(opexTotal.mOrc, opexTotal.mReal, true),
    },
    {
      label: 'EBITDA',
      kind: 'total',
      col1: fmtIntMn(ebitdaTecto.mOrc, false),
      col2: fmtIntMn(ebitdaTecto.mReal, false),
      col3: fmtIntMn(ebitdaTecto.mReal - ebitdaTecto.mOrc, false),
      col4: fmtPct(ebitdaTecto.mOrc, ebitdaTecto.mReal, false),
    },
  ];

  // Tabela 2: Resultado Acumulado (YTD) — BAU
  const ytdBauRows: HoldingTableRowSpec[] = [
    makeYtdRow('Receita Líquida', colocationRev, 'total', 0, false),
    makeYtdRow('Colocation & Cross-Connects', colocationRev, 'group', 1, false),
    makeYtdRow('OPEX', opexTotal, 'total', 0, true),
    makeYtdRow('Operational Costs', opCostsTotal, 'group', 1, true),
    makeYtdRow('HR', hrTotal, 'group', 1, true),
    makeYtdRow('SG&A', sgaTotal, 'group', 1, true),
    makeYtdRow('Others', othersTotal, 'group', 1, true),
    makeYtdRow('EBITDA BAU', ebitdaTecto, 'total', 0, false),
  ];

  // Tabela 3: Detalhamento do OPEX (YTD)
  const opexDetailRows: HoldingTableRowSpec[] = [
    makeYtdRow('OPEX', opexTotal, 'total', 0, true),
    makeYtdRow('Operational Costs', opCostsTotal, 'group', 1, true),
    makeYtdRow('Data Center Opex - Power Costs', opPower, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Maintenance / Materials', opMaint, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Facilities & Utilities', opFacilities, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Security', opSecurity, 'detail', 2, true),
    makeYtdRow('Data Center Opex - ZPE Leasing', opZpe, 'detail', 2, true),
    makeYtdRow('HR', hrTotal, 'group', 1, true),
    makeYtdRow('Data Center Opex - O&E Personnel', hrLabor, 'detail', 2, true),
    makeYtdRow('Cost Sharing Tecto', hrCostSharing, 'detail', 2, true),
    makeYtdRow('SG&A', sgaTotal, 'group', 1, true),
    makeYtdRow('Data Center Opex - Consultorias', sgaConsult, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Travel', sgaTravel, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Legal & Cost Sharing', sgaLegal, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Marketing', sgaMkt, 'detail', 2, true),
    makeYtdRow('Data Center Opex - IT', sgaIt, 'detail', 2, true),
    makeYtdRow('Data Center Opex - Insurance', sgaInsurance, 'detail', 2, true),
    makeYtdRow('Others', othersTotal, 'group', 1, true),
    makeYtdRow('Data Center - Other Opex', otherOpex, 'detail', 2, true),
    makeYtdRow('Data Center - PDD', otherPdd, 'detail', 2, true),
  ];

  const children: Array<Paragraph | Table> = [
    ...buildCoverTitleBlock('Tecto', fullLabel),
    sectionHeading('Destaques'),
    ...narrative.highlights.map((b) => executiveBullet(b)),

    sectionHeading(`Resultado de ${fullLabel}`),
    buildFiveColHoldingTable(
      'Indicador',
      ['Orçado', 'Realizado', 'Δ Orçado', 'Δ Orçado %'],
      monthTableRows
    ),
    tableUnitCaption(),

    sectionHeading(`Resultado Acumulado (YTD) ${year} — BAU`),
    buildFiveColHoldingTable(
      'Linha',
      ['Orçado YTD', 'Realizado YTD', 'Δ Orçado', 'Δ Orçado %'],
      ytdBauRows
    ),
    tableUnitCaption(),
    ...narrative.ytdBauBullets.map((b) => executiveBullet(b)),

    pageBreak(),

    sectionHeading('Detalhamento do OPEX (YTD)'),
    buildFiveColHoldingTable(
      'Linha',
      ['Orçado YTD', 'Realizado YTD', 'Δ Orçado', 'Δ Orçado %'],
      opexDetailRows
    ),
    tableUnitCaption(),
    ...narrative.opexDetailBullets.map((b) => executiveBullet(b)),
  ];

  if (physicalRows.length > 0) {
    const physRowsSpec: HoldingTableRowSpec[] = physicalRows.map((p) => {
      const delta = p.real - p.budget;
      return {
        label: p.indicator,
        kind: 'detail',
        col1: p.budget.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        col2: p.real.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        col3: delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
        col4: fmtPct(p.budget, p.real, false),
      };
    });
    children.push(
      sectionHeading('Indicadores Físicos — Data Centers'),
      buildFiveColHoldingTable(
        'Indicador',
        ['Orçado', 'Realizado', 'Δ Orçado', 'Δ Orçado %'],
        physRowsSpec
      )
    );
  }

  const document = new Document({
    creator: 'FP&A Holding · Tecto Data Centers',
    title: `HOLDING · Tecto — Closing ${fullLabel}`,
    description: 'Performance de Resultados — Tecto Data Centers',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 18, color: TEXT_DARK },
          paragraph: { spacing: { after: 80 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 960, right: 900, bottom: 960, left: 900, header: 420, footer: 420 },
          },
        },
        headers: { default: buildHoldingHeader('Tecto', fullLabel) },
        footers: { default: buildHoldingFooter() },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
