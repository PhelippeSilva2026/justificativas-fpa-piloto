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
    rows: rows.length > 0 ? rows : getSampleWorkbook().rows,
  };
}

/**
 * Cria uma planilha padrão DRE da NIO Fibra com dados executivos de exemplo
 */
export function getSampleWorkbook(): DREWorkbook {
  const baseRows: DRERow[] = [
    {
      id: 'dre-1',
      diretoria: 'Diretoria de Engenharia & Operações',
      area: 'Rede & Infraestrutura Passiva',
      responsavel: 'Carlos Mendonça (Diretor de Rede & Infra)',
      n1: 'OPEX REDE',
      n2: 'Infraestrutura Passiva',
      n3: 'Compartilhamento de Postes (Concessionárias)',
      realMMinus1: 8_200_000,
      realCurrent: 9_450_000,
      orcadoCurrent: 8_500_000,
      diffOrcadoAbs: 950_000,
      diffOrcadoPct: 11.18,
      diffMMinus1Abs: 1_250_000,
      diffMMinus1Pct: 15.24,
      realYTD: 68_400_000,
      orcadoYTD: 64_000_000,
      diffOrcadoYTDAbs: 4_400_000,
      diffOrcadoYTDPct: 6.88,
    },
    {
      id: 'dre-2',
      diretoria: 'Diretoria de Engenharia & Operações',
      area: 'Operações de Campo FTTH',
      responsavel: 'Mariana Duarte (Gerente de Operações FTTH)',
      n1: 'OPEX REDE',
      n2: 'Manutenção de Campo',
      n3: 'Reparo Emergencial & Rompimento de Cabos',
      realMMinus1: 3_150_000,
      realCurrent: 2_600_000,
      orcadoCurrent: 2_900_000,
      diffOrcadoAbs: -300_000,
      diffOrcadoPct: -10.34,
      diffMMinus1Abs: -550_000,
      diffMMinus1Pct: -17.46,
      realYTD: 22_800_000,
      orcadoYTD: 24_200_000,
      diffOrcadoYTDAbs: -1_400_000,
      diffOrcadoYTDPct: -5.79,
    },
    {
      id: 'dre-3',
      diretoria: 'Diretoria Comercial & Experiência',
      area: 'Instalações & Habilitações',
      responsavel: 'Felipe Alencar (Head de Experiência do Cliente)',
      n1: 'OPEX CLIENTE',
      n2: 'Instalações & Habilitações',
      n3: 'Instalação e Ativação FTTH (Equipes Parceiras)',
      realMMinus1: 5_400_000,
      realCurrent: 6_200_000,
      orcadoCurrent: 5_800_000,
      diffOrcadoAbs: 400_000,
      diffOrcadoPct: 6.9,
      diffMMinus1Abs: 800_000,
      diffMMinus1Pct: 14.81,
      realYTD: 44_600_000,
      orcadoYTD: 42_000_000,
      diffOrcadoYTDAbs: 2_600_000,
      diffOrcadoYTDPct: 6.19,
    },
    {
      id: 'dre-4',
      diretoria: 'Diretoria de TI & Sistemas',
      area: 'Cloud & Licenciamento',
      responsavel: 'Renata Vasconcellos (Gerente de TI & Telecom)',
      n1: 'OPEX TI',
      n2: 'Cloud & Licenciamento',
      n3: 'OSS/BSS & Plataformas de Provisionamento',
      realMMinus1: 1_850_000,
      realCurrent: 1_920_000,
      orcadoCurrent: 2_100_000,
      diffOrcadoAbs: -180_000,
      diffOrcadoPct: -8.57,
      diffMMinus1Abs: 70_000,
      diffMMinus1Pct: 3.78,
      realYTD: 14_900_000,
      orcadoYTD: 16_000_000,
      diffOrcadoYTDAbs: -1_100_000,
      diffOrcadoYTDPct: -6.88,
    },
    {
      id: 'dre-5',
      diretoria: 'Diretoria Comercial & Experiência',
      area: 'Aquisição de Clientes & Canais',
      responsavel: 'Bruno Queiroz (Diretor Comercial B2B & Varejo)',
      n1: 'COMERCIAL',
      n2: 'Aquisição de Clientes',
      n3: 'Comissões de Vendas & Canais Credenciados',
      realMMinus1: 4_200_000,
      realCurrent: 4_900_000,
      orcadoCurrent: 4_600_000,
      diffOrcadoAbs: 300_000,
      diffOrcadoPct: 6.52,
      diffMMinus1Abs: 700_000,
      diffMMinus1Pct: 16.67,
      realYTD: 35_100_000,
      orcadoYTD: 34_000_000,
      diffOrcadoYTDAbs: 1_100_000,
      diffOrcadoYTDPct: 3.24,
    },
    {
      id: 'dre-6',
      diretoria: 'Diretoria de Engenharia & Operações',
      area: 'Operações NOC & Backbone',
      responsavel: 'Juliana Rossi (Gerente Geral de NOC & Engenharia)',
      n1: 'PESSOAL',
      n2: 'Operações de Rede',
      n3: 'Equipes Técnicas NOC & Engenharia de Backbone',
      realMMinus1: 7_100_000,
      realCurrent: 7_350_000,
      orcadoCurrent: 7_200_000,
      diffOrcadoAbs: 150_000,
      diffOrcadoPct: 2.08,
      diffMMinus1Abs: 250_000,
      diffMMinus1Pct: 3.52,
      realYTD: 56_800_000,
      orcadoYTD: 57_000_000,
      diffOrcadoYTDAbs: -200_000,
      diffOrcadoYTDPct: -0.35,
    },
    {
      id: 'dre-7',
      diretoria: 'Diretoria Financeira & Administrativa',
      area: 'Controladoria & Tributário',
      responsavel: 'Marcelo Pires (Head de Controladoria & FP&A)',
      n1: 'ADMINISTRATIVO',
      n2: 'Serviços Terceirizados & Auditoria',
      n3: 'Consultorias Especializadas & Auditoria Externa',
      realMMinus1: 950_000,
      realCurrent: 1_120_000,
      orcadoCurrent: 1_000_000,
      diffOrcadoAbs: 120_000,
      diffOrcadoPct: 12.0,
      diffMMinus1Abs: 170_000,
      diffMMinus1Pct: 17.89,
      realYTD: 7_900_000,
      orcadoYTD: 7_500_000,
      diffOrcadoYTDAbs: 400_000,
      diffOrcadoYTDPct: 5.33,
    },
    {
      id: 'dre-8',
      diretoria: 'Diretoria Comercial & Experiência',
      area: 'Atendimento & CX',
      responsavel: 'Camila Fontana (Gerente de Atendimento)',
      n1: 'OPEX CLIENTE',
      n2: 'Relacionamento & Suporte',
      n3: 'Call Center Receptivo & Retenção de Assinantes',
      realMMinus1: 2_400_000,
      realCurrent: 2_550_000,
      orcadoCurrent: 2_600_000,
      diffOrcadoAbs: -50_000,
      diffOrcadoPct: -1.92,
      diffMMinus1Abs: 150_000,
      diffMMinus1Pct: 6.25,
      realYTD: 19_600_000,
      orcadoYTD: 20_200_000,
      diffOrcadoYTDAbs: -600_000,
      diffOrcadoYTDPct: -2.97,
    }
  ];

  // Gerar registros transacionais (GcpRawRecord) de 2026/1 a 2026/12
  const rawRecords: any[] = [];
  for (const r of baseRows) {
    for (let m = 1; m <= 12; m++) {
      const anomes = `2026/${m}`;
      // Variações realistas mês a mês
      const factor = 1 + (m - 8) * 0.02;
      const valReal = Math.round(r.realCurrent * factor * (1 + (m % 3 - 1) * 0.03));
      const valBudget = Math.round(r.orcadoCurrent * (1 + (m - 8) * 0.01));

      rawRecords.push({
        diretoria: r.diretoria,
        area: r.area,
        responsavel: r.responsavel,
        n1: r.n1,
        n2: r.n2,
        n3: r.n3,
        anomes,
        tipo: 'ACTUAL 2026',
        valor: valReal,
      });

      rawRecords.push({
        diretoria: r.diretoria,
        area: r.area,
        responsavel: r.responsavel,
        n1: r.n1,
        n2: r.n2,
        n3: r.n3,
        anomes,
        tipo: 'Budget 2026',
        valor: valBudget,
      });
    }
  }

  return {
    monthPrevious: '2026/7',
    monthCurrent: '2026/8',
    rows: baseRows,
    rawRecords,
  };
}

/**
 * Cria justificativas iniciais de exemplo para dar vida imediata à interface
 */
export function getSampleJustifications(): Record<string, RowJustifications> {
  return {
    'dre-1': {
      momImpacts: [
        {
          id: 'imp-1-1',
          name: 'Reajuste IPCA Contratos Enel/Light',
          value: 780_000,
          justification: 'Aplicação do reajuste anual de cessão de postes conforme índice inflacionário contratual.',
        },
        {
          id: 'imp-1-2',
          name: 'Regularização de Pontos Clandestinos',
          value: 470_000,
          justification: 'Vistoria das concessionárias identificou necessidade de readequação e licenciamento de rotas.',
        },
      ],
      vsOrcadoImpacts: [
        {
          id: 'imp-1-3',
          name: 'Expansão de Rotas FTTH Antecipada',
          value: 650_000,
          justification: 'Antecipação de ocupação de 45.000 postes para atender cronograma comercial do Q3.',
        },
        {
          id: 'imp-1-4',
          name: 'Desconto Renegociação de Backhaul',
          value: -300_000,
          justification: 'Economia obtida na repactuação de lotes com distribuidoras no interior de SP.',
        },
      ],
      ytdImpacts: [
        {
          id: 'imp-1-5',
          name: 'Aceleração de Ocupação de Postes YTD',
          value: 3_200_000,
          justification: 'Volume acumulado de HPs passados 18% superior ao plano diretor de expansão.',
        },
        {
          id: 'imp-1-6',
          name: 'Taxas de Notificação e Projetos Concessionárias',
          value: 1_200_000,
          justification: 'Aumento pontual nas taxas de aprovação de projetos técnicos junto às distribuidoras.',
        },
      ],
    },
    'dre-2': {
      momImpacts: [
        {
          id: 'imp-2-1',
          name: 'Redução de Rompimentos de Fibra',
          value: -420_000,
          justification: 'Menor incidência de sinistros por terceiros e obras viárias no mês de Agosto.',
        },
        {
          id: 'imp-2-2',
          name: 'Otimização de Rotas de Plantão',
          value: -130_000,
          justification: 'Consolidação das bases operacionais de prontidão com ganhos de eficiência logística.',
        },
      ],
      vsOrcadoImpacts: [
        {
          id: 'imp-2-3',
          name: 'Menor Volume de Ocorrências Críticas',
          value: -300_000,
          justification: 'Efeito do programa preventivo de blindagem e anelamento das rotas metropolitanas.',
        },
      ],
      ytdImpacts: [
        {
          id: 'imp-2-4',
          name: 'Ganhos de Eficiência Manutenção Preventiva',
          value: -1_400_000,
          justification: 'Digitalização das vistorias de campo reduziu chamados de emergência no ano acumulado.',
        },
      ],
    },
  };
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
