import * as XLSX from 'xlsx';
import { DRERow, DREWorkbook, DeviationImpact, RowJustifications } from '../types';
import { formatShortMonthYear } from './formatters';

/**
 * Normaliza strings para comparação flexível de cabeçalhos
 */
function normalizeHeader(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[∆Δ]/g, ' delta ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converte valor de célula para número com segurança
 */
function parseCellNumber(val: unknown): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  // Remove formatação de moeda se houver
  const cleaned = str
    .replace(/R\$\s*/gi, '')
    .replace(/%/g, '')
    .replace(/\s+/g, '');
    
  if (cleaned.includes(',') && cleaned.includes('.')) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (cleaned.includes(',')) {
    return parseFloat(cleaned.replace(',', '.')) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Lê o arquivo Excel (ArrayBuffer) e extrai D2, D3 e as linhas de DRE
 */
export function parseExcelFile(data: ArrayBuffer): DREWorkbook {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Leitura de D2 e D3 conforme especificação rigorosa:
  // Célula D2: Mês Anterior (ex: "Jul/2026")
  // Célula D3: Mês Atual (ex: "Ago/2026")
  let rawD2 = worksheet['D2']?.v ? String(worksheet['D2'].v).trim() : '';
  let rawD3 = worksheet['D3']?.v ? String(worksheet['D3'].v).trim() : '';

  // Converter a planilha em matriz 2D de dados
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });

  // Busca resiliente caso D2/D3 estejam mescladas ou em colunas vizinhas
  if (!rawD2 || !rawD3) {
    for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
      const row = rawRows[r] as unknown[];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = normalizeHeader(String(row[c] || ''));
        if (val.includes('mes anterior') || val.includes('m-1') || val.includes('anterior')) {
          const candidate = String(row[c + 1] || row[c + 2] || row[c + 3] || '').trim();
          if (candidate && !rawD2) rawD2 = candidate;
        }
        if (val.includes('mes atual') || val.includes('atual')) {
          const candidate = String(row[c + 1] || row[c + 2] || row[c + 3] || '').trim();
          if (candidate && !rawD3) rawD3 = candidate;
        }
      }
    }
  }

  let monthPrevious = formatShortMonthYear(rawD2 || 'Jul/2026') || 'Jul/2026';
  let monthCurrent = formatShortMonthYear(rawD3 || 'Ago/2026') || 'Ago/2026';

  // Procurar a linha de cabeçalho
  let headerRowIndex = -1;
  let colIndices: Record<string, number> = {};

  for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
    const row = rawRows[r] as unknown[];
    if (!Array.isArray(row)) continue;

    const normalizedCols = row.map((cell) => normalizeHeader(String(cell)));
    
    // Procura se a linha tem 'responsavel' ou 'n1' ou 'n3'
    const hasN3 = normalizedCols.some(c => c === 'n3' || c.includes('subcategoria') || c.includes('n3'));
    const hasN1 = normalizedCols.some(c => c === 'n1' || c.includes('grupo'));
    const hasReal = normalizedCols.some(c => c.includes('real'));

    if ((hasN3 && hasN1) || (hasN3 && hasReal)) {
      headerRowIndex = r;
      // Mapear índices com regras de especificidade estritas
      normalizedCols.forEach((colName, index) => {
        const isYTD = colName.includes('ytd');
        const isPercent = colName.includes('%') || colName.includes('pct') || colName.includes('percent');
        const isDelta = colName.includes('delta') || colName.includes('#') || colName.includes('diff') || colName.includes('var');
        const isM1 = colName.includes('m-1') || colName.includes('m 1') || colName.includes('m minus 1') || colName.includes('m1') || colName.includes('mes anterior');
        const isReal = colName.includes('real') || colName.includes('atual') || colName.includes('realizado');
        const isOrcado = colName.includes('orcado') || colName.includes('budget') || colName.includes('meta') || colName.includes('orcamento');

        // Responsável / Gestor
        if (colName.includes('responsavel') || colName.includes('gestor') || colName.includes('owner') || colName.includes('diretor') || colName.includes('gerente')) {
          colIndices['responsavel'] = index;
        }
        // N1 (Macro / Grupo)
        else if (colName === 'n1' || colName.includes('grupo') || colName.includes('macro') || colName.includes('nivel 1')) {
          colIndices['n1'] = index;
        }
        // N2 (Categoria)
        else if (colName === 'n2' || colName.includes('categoria') || colName.includes('nivel 2')) {
          colIndices['n2'] = index;
        }
        // N3 (Subcategoria / Item / Conta)
        else if (colName === 'n3' || colName.includes('subcategoria') || colName.includes('sub-categoria') || colName.includes('conta') || colName.includes('item')) {
          colIndices['n3'] = index;
        }
        // 1. Delta Orçado YTD %
        else if (isYTD && isOrcado && isPercent) {
          colIndices['diffOrcadoYTDPct'] = index;
        }
        // 2. Delta Orçado YTD # (Absoluto)
        else if (isYTD && isOrcado && (isDelta || colName.includes('#'))) {
          colIndices['diffOrcadoYTDAbs'] = index;
        }
        // 3. Orçado YTD (Base Budget acumulado)
        else if (isYTD && isOrcado && !isPercent && !isDelta) {
          colIndices['orcadoYTD'] = index;
        }
        // 4. Real YTD
        else if (isYTD && isReal && !isPercent && !isDelta) {
          colIndices['realYTD'] = index;
        }
        // 5. Delta M-1 %
        else if (isM1 && isPercent) {
          colIndices['diffMMinus1Pct'] = index;
        }
        // 6. Delta M-1 R$ / Absoluto
        else if (isM1 && (isDelta || colName.includes('r$') || colName.includes('#'))) {
          colIndices['diffMMinus1Abs'] = index;
        }
        // 7. Real M-1 (Base mês anterior)
        else if (isM1 && isReal && !isPercent && !isDelta) {
          colIndices['realMMinus1'] = index;
        }
        // 8. Delta Orçado Mês %
        else if (!isYTD && isOrcado && isPercent) {
          colIndices['diffOrcadoPct'] = index;
        }
        // 9. Delta Orçado Mês # (Absoluto)
        else if (!isYTD && isOrcado && (isDelta || colName.includes('#'))) {
          colIndices['diffOrcadoAbs'] = index;
        }
        // 10. Orçado Mês (Budget Mês)
        else if (!isYTD && isOrcado && !isPercent && !isDelta) {
          colIndices['orcadoCurrent'] = index;
        }
        // 11. Real Mês
        else if (!isYTD && !isM1 && isReal && !isPercent && !isDelta) {
          colIndices['realCurrent'] = index;
        }
      });
      break;
    }
  }

  // Se não achou de forma estrita, faz busca heurística padrão
  if (headerRowIndex === -1) {
    headerRowIndex = 4; // Geralmente linha 5
    colIndices = {
      responsavel: 0,
      n1: 1,
      n2: 2,
      n3: 3,
      realMMinus1: 4,
      realCurrent: 5,
      orcadoCurrent: 6,
      diffOrcadoAbs: 7,
      diffOrcadoPct: 8,
      diffMMinus1Abs: 9,
      diffMMinus1Pct: 10,
      realYTD: 11,
      orcadoYTD: 12,
      diffOrcadoYTDAbs: 13,
      diffOrcadoYTDPct: 14,
    };
  }

  const rows: DRERow[] = [];
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    if (!row || row.length === 0) continue;

    const n3 = String(row[colIndices['n3'] ?? 3] || '').trim();
    if (!n3) continue; // Pula linhas vazias

    const responsavel = String(row[colIndices['responsavel'] ?? 0] || 'Gestor Operacional').trim();
    const n1 = String(row[colIndices['n1'] ?? 1] || 'OPEX FIBRA').trim();
    const n2 = String(row[colIndices['n2'] ?? 2] || 'Rede & Operações').trim();

    const realMMinus1 = parseCellNumber(row[colIndices['realMMinus1'] ?? 4]);
    const realCurrent = parseCellNumber(row[colIndices['realCurrent'] ?? 5]);
    const orcadoCurrent = parseCellNumber(row[colIndices['orcadoCurrent'] ?? 6]);
    
    // Calcula diferenças se não vierem preenchidas
    let diffOrcadoAbs = parseCellNumber(row[colIndices['diffOrcadoAbs'] ?? 7]);
    if (diffOrcadoAbs === 0 && orcadoCurrent !== 0) {
      diffOrcadoAbs = realCurrent - orcadoCurrent;
    }

    let diffOrcadoPct = parseCellNumber(row[colIndices['diffOrcadoPct'] ?? 8]);
    if (diffOrcadoPct === 0 && orcadoCurrent !== 0) {
      diffOrcadoPct = (diffOrcadoAbs / orcadoCurrent) * 100;
    }

    let diffMMinus1Abs = parseCellNumber(row[colIndices['diffMMinus1Abs'] ?? 9]);
    if (diffMMinus1Abs === 0 && realMMinus1 !== 0) {
      diffMMinus1Abs = realCurrent - realMMinus1;
    }

    let diffMMinus1Pct = parseCellNumber(row[colIndices['diffMMinus1Pct'] ?? 10]);
    if (diffMMinus1Pct === 0 && realMMinus1 !== 0) {
      diffMMinus1Pct = (diffMMinus1Abs / realMMinus1) * 100;
    }

    const realYTD = parseCellNumber(row[colIndices['realYTD'] ?? 11]) || (realCurrent * 8);
    const orcadoYTD = parseCellNumber(row[colIndices['orcadoYTD'] ?? 12]) || (orcadoCurrent * 8);

    let diffOrcadoYTDAbs = parseCellNumber(row[colIndices['diffOrcadoYTDAbs'] ?? 13]);
    if (diffOrcadoYTDAbs === 0 && orcadoYTD !== 0) {
      diffOrcadoYTDAbs = realYTD - orcadoYTD;
    }

    let diffOrcadoYTDPct = parseCellNumber(row[colIndices['diffOrcadoYTDPct'] ?? 14]);
    if (diffOrcadoYTDPct === 0 && orcadoYTD !== 0) {
      diffOrcadoYTDPct = (diffOrcadoYTDAbs / orcadoYTD) * 100;
    }

    rows.push({
      id: `dre-${r}-${n3.toLowerCase().replace(/\s+/g, '-')}`,
      responsavel,
      n1,
      n2,
      n3,
      realMMinus1,
      realCurrent,
      orcadoCurrent,
      diffOrcadoAbs,
      diffOrcadoPct,
      diffMMinus1Abs,
      diffMMinus1Pct,
      realYTD,
      orcadoYTD,
      diffOrcadoYTDAbs,
      diffOrcadoYTDPct,
    });
  }

  return {
    monthPrevious,
    monthCurrent,
    rows,
  };
}

/**
 * Retorna planilha inicial vazia (nunca exibe dados fake se o banco não carregar)
 */
export function getSampleWorkbook(): DREWorkbook {
  return {
    monthPrevious: '2026/7',
    monthCurrent: '2026/8',
    rows: [],
  };
}

/**
 * Retorna mapa de justificativas vazio (sem dados fake)
 */
export function getSampleJustifications(): Record<string, RowJustifications> {
  return {};
}

/**
 * Gera e dispara o download do arquivo oficial DRE NIO (.xlsx),
 * preservando todas as informações importadas e dados atuais quando disponíveis.
 */
export function exportTemplateExcelFile(
  workbookToExport?: DREWorkbook | null,
  fileName?: string
): void {
  const wb = XLSX.utils.book_new();
  const source = workbookToExport && workbookToExport.rows && workbookToExport.rows.length > 0
    ? workbookToExport
    : getSampleWorkbook();

  const mPrev = formatShortMonthYear(source.monthPrevious) || 'Jul/2026';
  const mCurr = formatShortMonthYear(source.monthCurrent) || 'Ago/2026';

  // Matriz de dados com D2 e D3 conforme especificação
  const data: (string | number)[][] = [
    ['DRE GERENCIAL EXECUTIVO - NIO FIBRA ÓPTICA', '', '', ''],
    ['Mês Anterior:', '', '', mPrev], // D2 = Mês Anterior
    ['Mês Atual:', '', '', mCurr],     // D3 = Mês Atual
    [''], // Linha 4 em branco
    // Linha 5: Cabeçalhos exatos
    [
      'Responsável',
      'N1',
      'N2',
      'N3',
      'Real M-1',
      'Real 2026',
      'Orçado 2026',
      '∆ Orçado 2026 #',
      '∆ Orçado 2026 %',
      'R$ ∆ M-1',
      '% ∆ M-1',
      'Real 2026 YTD',
      'Orçado 2026 YTD',
      '∆ Orçado 2026 # YTD',
      '∆ Orçado 2026 % YTD'
    ]
  ];

  // Adiciona as linhas do arquivo importado/atual
  source.rows.forEach(r => {
    data.push([
      r.responsavel,
      r.n1,
      r.n2,
      r.n3,
      r.realMMinus1,
      r.realCurrent,
      r.orcadoCurrent,
      r.diffOrcadoAbs,
      r.diffOrcadoPct,
      r.diffMMinus1Abs,
      r.diffMMinus1Pct,
      r.realYTD,
      r.orcadoYTD,
      r.diffOrcadoYTDAbs,
      r.diffOrcadoYTDPct
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Ajusta larguras das colunas
  ws['!cols'] = [
    { wch: 32 }, // Responsável
    { wch: 18 }, // N1
    { wch: 28 }, // N2
    { wch: 42 }, // N3
    { wch: 16 }, // Real M-1
    { wch: 16 }, // Real 2026
    { wch: 16 }, // Orçado 2026
    { wch: 18 }, // ∆ Orçado #
    { wch: 16 }, // ∆ Orçado %
    { wch: 16 }, // R$ ∆ M-1
    { wch: 14 }, // % ∆ M-1
    { wch: 18 }, // Real YTD
    { wch: 18 }, // Orçado YTD
    { wch: 20 }, // ∆ YTD #
    { wch: 16 }, // ∆ YTD %
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'DRE NIO');

  let outputFileName = fileName?.trim() || 'Planilha_DRE_NIO_Fibra_Modelo.xlsx';
  if (!outputFileName.toLowerCase().endsWith('.xlsx')) {
    outputFileName += '.xlsx';
  }

  XLSX.writeFile(wb, outputFileName);
}
