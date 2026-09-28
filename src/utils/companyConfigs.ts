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
    storageKey: 'nio_justifications_live_v1',
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
    primaryColor: '#242424',
    accentColor: '#4F927F',
    headerBg: 'bg-[#242424]',
    headerBorder: 'border-black',
    cardBorder: 'border-[#4F927F]/40',
    accentText: 'text-[#4F927F]',
    storageKey: 'vtal_justifications_live_v2',
    excelFileName: 'Planilha_DRE_Vtal_RedeNeutra.xlsx',
    defaultResponsible: 'Diretoria de Engenharia & Infraestrutura',
    sectors: ['Cabos Submarinos', 'Transporte DWDM', 'Dark Fiber', 'Estações CLS', 'Direito de Passagem']
  },
  tecto: {
    id: 'tecto',
    name: 'Tecto Data Centers',
    shortName: 'Tecto',
    tagline: 'Infraestrutura de Data Centers',
    description: 'Análise de variações em custos de energia elétrica (MW), eficiência de PUE, colocation e sistemas críticos de data center.',
    primaryColor: '#242424',
    accentColor: '#4F927F',
    headerBg: 'bg-[#242424]',
    headerBorder: 'border-black',
    cardBorder: 'border-[#4F927F]/40',
    accentText: 'text-[#4F927F]',
    storageKey: 'tecto_justifications_live_v2',
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

// Workbooks iniciais vazios (nunca exibe dados fake caso o banco não carregue)
export function getCompanyWorkbook(_companyId: CompanyId): DREWorkbook {
  return {
    monthPrevious: '2026/7',
    monthCurrent: '2026/8',
    rows: [],
  };
}

// Justificativas iniciais vazias (sem dados fake)
export function getCompanySampleJustifications(_companyId: CompanyId): Record<string, RowJustifications> {
  return {};
}
