import { CompanyId, CompanyInfo, DRERow, DREWorkbook, RowJustifications } from '../types';
import { getSampleWorkbook, getSampleJustifications } from './excelParser';

export const COMPANIES: Record<CompanyId, CompanyInfo> = {
  nio: {
    id: 'nio',
    name: 'NIO Fibra',
    shortName: 'NIO',
    tagline: 'Operação B2C & Redes de Fibra Óptica FTTH',
    description: 'Acompanhamento executivo de custos de ativação, aluguel de postes, O&M de rede e base de clientes de fibra.',
    primaryColor: '#14412A',
    accentColor: '#39FF00',
    headerBg: 'bg-[#14412A]',
    headerBorder: 'border-[#1E5C3C]',
    cardBorder: 'border-[#39FF00]/40',
    accentText: 'text-[#39FF00]',
    storageKey: 'nio_justifications_v1',
    excelFileName: 'Planilha_DRE_NIO_Fibra.xlsx',
    defaultResponsible: 'Diretoria de Operações & B2C',
    sectors: ['O&M Fibra', 'Cessão de Postes', 'Ativações FTTH', 'CPE Wi-Fi', 'Atendimento NOC']
  },
  vtal: {
    id: 'vtal',
    name: 'V.tal',
    shortName: 'V.tal',
    tagline: 'Rede Neutra de Infraestrutura & Cabos Submarinos',
    description: 'Gestão de desvios da maior rede neutra de fibra óptica do país: cabos submarinos, transporte DWDM e infraestrutura.',
    primaryColor: '#0A192F',
    accentColor: '#00D8F6',
    headerBg: 'bg-[#0A192F]',
    headerBorder: 'border-[#1B3A60]',
    cardBorder: 'border-[#00D8F6]/40',
    accentText: 'text-[#00D8F6]',
    storageKey: 'vtal_justifications_v1',
    excelFileName: 'Planilha_DRE_Vtal_RedeNeutra.xlsx',
    defaultResponsible: 'Diretoria de Engenharia & Infraestrutura',
    sectors: ['Cabos Submarinos', 'Transporte DWDM', 'Dark Fiber', 'Estações CLS', 'Direito de Passagem']
  },
  tecto: {
    id: 'tecto',
    name: 'Tecto Data Centers',
    shortName: 'Tecto',
    tagline: 'Infraestrutura de Data Centers & Hiperescala',
    description: 'Análise de variações em custos de energia elétrica (MW), eficiência de PUE, colocation e sistemas críticos de data center.',
    primaryColor: '#0F172A',
    accentColor: '#10B981',
    headerBg: 'bg-[#0F172A]',
    headerBorder: 'border-[#1E293B]',
    cardBorder: 'border-[#10B981]/40',
    accentText: 'text-[#10B981]',
    storageKey: 'tecto_justifications_v1',
    excelFileName: 'Planilha_DRE_Tecto_DataCenters.xlsx',
    defaultResponsible: 'Diretoria de Operações de Data Centers',
    sectors: ['Energia & PUE', 'Climatização Chillers', 'Geradores & UPS', 'Cross-Connects', 'Certificações Tier III']
  }
};

export const VTAL_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="vtal-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#071324" />
      <stop offset="100%" stop-color="#0D2545" />
    </linearGradient>
    <linearGradient id="vtal-glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E5FF" />
      <stop offset="100%" stop-color="#0088FF" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" ry="115" fill="url(#vtal-bg)" />
  <g transform="translate(68, 140)">
    <!-- Letra V estilizada -->
    <path d="M 30 20 L 105 180 L 165 180 L 240 20 L 185 20 L 135 132 L 85 20 Z" fill="#FFFFFF" />
    <!-- Ponto de fibra ótica luminosa V.tal -->
    <circle cx="230" cy="182" r="16" fill="url(#vtal-glow)" />
    <!-- Texto 'tal' -->
    <text x="255" y="186" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="96" fill="#FFFFFF" letter-spacing="-2">tal</text>
  </g>
  <circle cx="410" cy="115" r="8" fill="#00E5FF" opacity="0.8" />
  <circle cx="430" cy="135" r="4" fill="#00E5FF" opacity="0.5" />
</svg>
`;

export const TECTO_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="tecto-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090E17" />
      <stop offset="100%" stop-color="#111B2B" />
    </linearGradient>
    <linearGradient id="tecto-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981" />
      <stop offset="100%" stop-color="#06B6D4" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" ry="115" fill="url(#tecto-bg)" />
  <!-- Monograma geométrico T / Cubo de Data Center -->
  <g transform="translate(110, 115)">
    <polygon points="146,0 286,75 146,150 6,75" fill="url(#tecto-accent)" opacity="0.9" />
    <polygon points="6,82 146,157 146,240 6,165" fill="#0B7A58" />
    <polygon points="146,157 286,82 286,165 146,240" fill="#048398" />
    <text x="146" y="278" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="54" fill="#FFFFFF" letter-spacing="7">TECTO</text>
  </g>
</svg>
`;

// Helper para obter PNG do logo de qualquer uma das empresas para PPTX
export async function getCompanyLogoPngDataUrl(companyId: CompanyId): Promise<string> {
  const logoPaths: Record<CompanyId, string> = {
    nio: '/Logos/nio.png',
    vtal: '/Logos/vtal.png',
    tecto: '/Logos/tecto.png',
  };

  try {
    const response = await fetch(logoPaths[companyId]);
    if (!response.ok) return '';
    const blob = await response.blob();

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

// Workbooks iniciais específicos de cada empresa
export function getCompanyWorkbook(companyId: CompanyId): DREWorkbook {
  if (companyId === 'vtal') {
    const rows: DRERow[] = [
      {
        id: 'VTAL_SUBMARINO_O&M',
        diretoria: 'DIRETORIA DE ENGENHARIA & CABOS SUBMARINOS',
        area: 'CABOS SUBMARINOS INTERNACIONAIS',
        responsavel: 'Fernando Albuquerque',
        n1: 'CUSTOS OPERACIONAIS',
        n2: 'INFRAESTRUTURA SUBMARINA',
        n3: 'Cabos Submarinos - O&M Sistemas Malbec e Monet',
        realMMinus1: -4250000,
        realCurrent: -3850000,
        orcadoCurrent: -4100000,
        diffOrcadoAbs: 250000,
        diffOrcadoPct: 6.1,
        diffMMinus1Abs: 400000,
        diffMMinus1Pct: 9.4,
        realYTD: -32100000,
        orcadoYTD: -33400000,
        diffOrcadoYTDAbs: 1300000,
        diffOrcadoYTDPct: 3.9
      },
      {
        id: 'VTAL_DWDM_TRANSPORTE',
        diretoria: 'DIRETORIA DE OPERAÇÕES DE REDE',
        area: 'TRANSMISSÃO & BACKBONE NACIONAL',
        responsavel: 'Carlos Eduardo Mendes',
        n1: 'CUSTOS DE REDE',
        n2: 'TRANSPORTE ÓPTICO DE LONGA DISTÂNCIA',
        n3: 'Transporte Óptico - Swaps de Fibra & Capacidade DWDM',
        realMMinus1: -2890000,
        realCurrent: -3120000,
        orcadoCurrent: -2750000,
        diffOrcadoAbs: -370000,
        diffOrcadoPct: -13.5,
        diffMMinus1Abs: -230000,
        diffMMinus1Pct: -8.0,
        realYTD: -23400000,
        orcadoYTD: -21800000,
        diffOrcadoYTDAbs: -1600000,
        diffOrcadoYTDPct: -7.3
      },
      {
        id: 'VTAL_ENERGIA_CLS',
        diretoria: 'DIRETORIA DE INFRAESTRUTURA CRÍTICA',
        area: 'ESTAÇÕES TERRESTRES & CLS',
        responsavel: 'Roberto Valente',
        n1: 'CUSTOS DE FACILITIES',
        n2: 'ENERGIA E CLIMATIZAÇÃO',
        n3: 'Energia Elétrica Estações CLS Fortaleza e Praia Grande',
        realMMinus1: -1450000,
        realCurrent: -1380000,
        orcadoCurrent: -1500000,
        diffOrcadoAbs: 120000,
        diffOrcadoPct: 8.0,
        diffMMinus1Abs: 70000,
        diffMMinus1Pct: 4.8,
        realYTD: -11200000,
        orcadoYTD: -11900000,
        diffOrcadoYTDAbs: 700000,
        diffOrcadoYTDPct: 5.9
      },
      {
        id: 'VTAL_DIREITO_PASSAGEM',
        diretoria: 'DIRETORIA JURÍDICO & REGULATÓRIO',
        area: 'CONCESSÕES & FAIXAS DE DOMÍNIO',
        responsavel: 'Camila Barreto',
        n1: 'CUSTOS REGULATÓRIOS',
        n2: 'DIREITO DE PASSAGEM E CONCESSÕES',
        n3: 'Licenciamento e Concessionárias de Rodovias Federais',
        realMMinus1: -980000,
        realCurrent: -1050000,
        orcadoCurrent: -920000,
        diffOrcadoAbs: -130000,
        diffOrcadoPct: -14.1,
        diffMMinus1Abs: -70000,
        diffMMinus1Pct: -7.1,
        realYTD: -7800000,
        orcadoYTD: -7200000,
        diffOrcadoYTDAbs: -600000,
        diffOrcadoYTDPct: -8.3
      }
    ];
    return {
      monthPrevious: '2026/7',
      monthCurrent: '2026/8',
      rows
    };
  }

  if (companyId === 'tecto') {
    const rows: DRERow[] = [
      {
        id: 'TECTO_ENERGIA_MERCADO_LIVRE',
        diretoria: 'DIRETORIA DE OPERAÇÕES DE DATA CENTERS',
        area: 'INFRAESTRUTURA ENERGÉTICA',
        responsavel: 'Leonardo Mattos',
        n1: 'CUSTOS DE OPERAÇÃO (OPEX)',
        n2: 'ENERGIA ELÉTRICA & DEMANDA',
        n3: 'Energia Mercado Livre - Campus Fortaleza e Barueri (MW)',
        realMMinus1: -5600000,
        realCurrent: -5150000,
        orcadoCurrent: -5400000,
        diffOrcadoAbs: 250000,
        diffOrcadoPct: 4.6,
        diffMMinus1Abs: 450000,
        diffMMinus1Pct: 8.0,
        realYTD: -42800000,
        orcadoYTD: -43900000,
        diffOrcadoYTDAbs: 1100000,
        diffOrcadoYTDPct: 2.5
      },
      {
        id: 'TECTO_CHILLERS_CLIMATIZACAO',
        diretoria: 'DIRETORIA DE ENGENHARIA & FACILITIES',
        area: 'SISTEMAS TÉRMICOS & HVAC',
        responsavel: 'Rafael Fontes',
        n1: 'CUSTOS DE FACILITIES',
        n2: 'CLIMATIZAÇÃO CRÍTICA',
        n3: 'Sistemas de Chillers & Eficiência PUE das Salas de Servidores',
        realMMinus1: -1850000,
        realCurrent: -1980000,
        orcadoCurrent: -1750000,
        diffOrcadoAbs: -230000,
        diffOrcadoPct: -13.1,
        diffMMinus1Abs: -130000,
        diffMMinus1Pct: -7.0,
        realYTD: -15200000,
        orcadoYTD: -14100000,
        diffOrcadoYTDAbs: -1100000,
        diffOrcadoYTDPct: -7.8
      },
      {
        id: 'TECTO_CROSS_CONNECTS',
        diretoria: 'DIRETORIA DE PRODUTOS & CONECTIVIDADE',
        area: 'INTERCONEXÃO & CARRIER NEUTRAL',
        responsavel: 'Patricia Prado',
        n1: 'RECEITA LÍQUIDA / MARGEM',
        n2: 'CONECTIVIDADE NEUTRA',
        n3: 'Cross-Connects Ópticos & Metro Connect Inter-Data Center',
        realMMinus1: 890000,
        realCurrent: 1040000,
        orcadoCurrent: 950000,
        diffOrcadoAbs: 90000,
        diffOrcadoPct: 9.5,
        diffMMinus1Abs: 150000,
        diffMMinus1Pct: 16.9,
        realYTD: 7900000,
        orcadoYTD: 7300000,
        diffOrcadoYTDAbs: 600000,
        diffOrcadoYTDPct: 8.2
      },
      {
        id: 'TECTO_MANUTENCAO_UPS_GERADORES',
        diretoria: 'DIRETORIA DE OPERAÇÕES DE DATA CENTERS',
        area: 'SISTEMAS CRÍTICOS DE MISSÃO',
        responsavel: 'Gustavo Ribeiro',
        n1: 'MANUTENÇÃO PREVENTIVA',
        n2: 'GERADORES E NO-BREAKS',
        n3: 'Contratos Preventivos No-Breaks (UPS) e Bancos de Baterias',
        realMMinus1: -720000,
        realCurrent: -690000,
        orcadoCurrent: -740000,
        diffOrcadoAbs: 50000,
        diffOrcadoPct: 6.8,
        diffMMinus1Abs: 30000,
        diffMMinus1Pct: 4.2,
        realYTD: -5600000,
        orcadoYTD: -5900000,
        diffOrcadoYTDAbs: 300000,
        diffOrcadoYTDPct: 5.1
      }
    ];
    return {
      monthPrevious: '2026/7',
      monthCurrent: '2026/8',
      rows
    };
  }

  // Padrão: NIO
  return getSampleWorkbook();
}

// Justificativas iniciais para V.tal e Tecto
export function getCompanySampleJustifications(companyId: CompanyId): Record<string, RowJustifications> {
  if (companyId === 'vtal') {
    return {
      'VTAL_SUBMARINO_O&M': {
        momImpacts: [
          {
            id: 'vtal_mom_1',
            name: 'Otimização Contrato Navio de Reparo',
            value: 400000,
            justification: 'Renegociação da taxa diária de prontidão de embarcação para atendimento ao consórcio Malbec.'
          }
        ],
        vsOrcadoImpacts: [
          {
            id: 'vtal_vsorc_1',
            name: 'Menor Incidência de Falhas em Águas Rasas',
            value: 250000,
            justification: 'Zero incidentes de âncoras ou frotas pesqueiras no trecho submarino sudeste durante o mês de Agosto.'
          }
        ],
        ytdImpacts: [
          {
            id: 'vtal_ytd_1',
            name: 'Ganhos de Escala no Consórcio de Cabos',
            value: 1300000,
            justification: 'Rateio proporcional favorável com parceiros internacionais na manutenção preventiva dos repetidores.'
          }
        ]
      }
    };
  }

  if (companyId === 'tecto') {
    return {
      'TECTO_ENERGIA_MERCADO_LIVRE': {
        momImpacts: [
          {
            id: 'tecto_mom_1',
            name: 'Queda do PLD e Compra Oportuna de Energia',
            value: 450000,
            justification: 'Preço de Liquidação das Diferenças (PLD) favorável no submercado Sudeste/Centro-Oeste no mês.'
          }
        ],
        vsOrcadoImpacts: [
          {
            id: 'tecto_vsorc_1',
            name: 'Ajuste de Cotação de Demanda Horossazonal',
            value: 250000,
            justification: 'Contratação antecipada de blocos de energia renovável I-REC abaixo da tarifa média orçada.'
          }
        ],
        ytdImpacts: [
          {
            id: 'tecto_ytd_1',
            name: 'Eficiência Acumulada de PUE nas Unidades',
            value: 1100000,
            justification: 'Índice de PUE médio mantido em 1.28 versus premissa orçamentária conservadora de 1.34.'
          }
        ]
      }
    };
  }

  // Padrão NIO
  return getSampleJustifications();
}
