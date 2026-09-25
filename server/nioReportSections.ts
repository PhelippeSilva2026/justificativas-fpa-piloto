import {
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ImageRun,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { NioExecutiveNarrative } from './geminiExecutiveReport';
import {
  renderWaterfallChart,
  renderBarWithLineChart,
  renderLineChart,
} from './chartRenderer';

export const NIO_GREEN = '14412A';
export const NIO_ACCENT = '39FF00';
export const GRAY_BG = 'F9FAFB';
export const BORDER_COLOR = 'E5E7EB';

export const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

export const formatCell = (
  text: string,
  options: {
    header?: boolean;
    align?: typeof AlignmentType[keyof typeof AlignmentType];
    fill?: string;
    bold?: boolean;
    color?: string;
    size?: number;
    widthPercent?: number;
  } = {}
) => {
  return new TableCell({
    width: options.widthPercent ? { size: options.widthPercent, type: WidthType.PERCENTAGE } : undefined,
    shading: options.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: options.fill }
      : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: options.align || AlignmentType.LEFT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            bold: options.header || options.bold,
            color: options.color || (options.header ? 'FFFFFF' : '1F2937'),
            size: options.size || (options.header ? 15 : 14.5),
            font: 'Aptos',
          }),
        ],
      }),
    ],
  });
};

export const nioHeading = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) =>
  new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 220 : 160, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 24 : 20,
        color: NIO_GREEN,
        font: 'Aptos',
      }),
    ],
  });

export const nioBody = (text: string) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 90, line: 240 },
    children: [new TextRun({ text, size: 16.5, color: '2A2A2A', font: 'Aptos' })],
  });

export const nioBullet = (text: string, boldPrefix?: string) =>
  new Paragraph({
    bullet: { level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 70, line: 230 },
    children: [
      ...(boldPrefix
        ? [new TextRun({ text: boldPrefix + ' ', bold: true, size: 16, color: '1A1A1A', font: 'Aptos' })]
        : []),
      new TextRun({ text, size: 16, color: '2A2A2A', font: 'Aptos' }),
    ],
  });

export const nioSubheading = (text: string) =>
  new Paragraph({
    spacing: { before: 140, after: 50 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 18,
        color: '1F2937',
        font: 'Aptos',
      }),
    ],
  });
