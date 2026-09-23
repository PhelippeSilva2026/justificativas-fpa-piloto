/**
 * Formatação de moeda e números no padrão executivo brasileiro (BRL)
 */

export function formatCurrency(value: number, compact: boolean = false): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';

  if (compact && Math.abs(value) >= 1_000_000) {
    const valInM = value / 1_000_000;
    return `R$ ${valInM.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
  }

  if (compact && Math.abs(value) >= 1_000) {
    const valInK = value / 1_000;
    return `R$ ${valInK.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata um valor numérico em moeda BRL estrita, com separador de milhar (.) e centavos (,)
 * Exemplo: 1250000 -> "R$ 1.250.000,00", -300000 -> "-R$ 300.000,00"
 */
export function formatCurrencyBRL(value: number, includeSymbol: boolean = true): string {
  if (isNaN(value) || value === null || value === undefined) {
    return includeSymbol ? 'R$ 0,00' : '0,00';
  }
  const isNegative = value < 0;
  const absVal = Math.abs(value);
  const formatted = absVal.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (!includeSymbol) {
    return isNegative ? `-${formatted}` : formatted;
  }
  return isNegative ? `-R$ ${formatted}` : `R$ ${formatted}`;
}

/**
 * Converte string digitada ou formatada em moeda BRL de volta para número float
 * Exemplo: "R$ 1.250.000,00" -> 1250000, "-R$ 300.000,00" -> -300000, "950.000" -> 950000
 */
export function parseCurrencyBRL(input: string | number): number {
  if (typeof input === 'number') return isNaN(input) ? 0 : input;
  if (!input) return 0;

  let str = String(input).trim();
  const isNegative = str.includes('-') || (str.startsWith('(') && str.endsWith(')'));

  // Remove símbolo R$, espaços e parênteses
  str = str.replace(/[R$\s()]/gi, '');
  // Mantém apenas dígitos, pontos, vírgulas e sinal
  str = str.replace(/[^\d.,-]/g, '');

  if (!str || str === '-') return 0;

  // Lógica de separador decimal e milhar brasileiro:
  if (str.includes(',') && str.includes('.')) {
    // Ex: "1.250.000,00"
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Ex: "1250000,50"
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Se tiver mais de um ponto (ex: 1.250.000) ou se tiver exatamente 3 dígitos após o ponto (ex: 950.000)
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = parts.join('');
    }
  }

  // Remove qualquer traço que tenha sobrado no meio
  str = str.replace(/-/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

/**
 * Converte qualquer texto de mês/data no formato abreviado "Mmm/AAAA", ex: "Ago/2026", "Jul/2026"
 */
export function formatShortMonthYear(input: unknown): string {
  if (input === null || input === undefined || input === '') return '';
  const str = String(input).trim();
  if (!str) return '';

  // 1. Já está no formato abreviado exato "Ago/2026" ou "Jul/2026"
  const exactMatch = str.match(/^([A-Za-zçÇ]{3})\/(\d{2,4})$/);
  if (exactMatch) {
    const rawMonth = exactMatch[1];
    let year = exactMatch[2];
    if (year.length === 2) year = `20${year}`;
    const capMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();
    return `${capMonth}/${year}`;
  }

  // Mapeamento completo de meses (nomes, abreviações e números)
  const monthMap: Record<string, string> = {
    jan: 'Jan', janeiro: 'Jan', '01': 'Jan', '1': 'Jan',
    fev: 'Fev', fevereiro: 'Fev', '02': 'Fev', '2': 'Fev',
    mar: 'Mar', marco: 'Mar', março: 'Mar', '03': 'Mar', '3': 'Mar',
    abr: 'Abr', abril: 'Abr', '04': 'Abr', '4': 'Abr',
    mai: 'Mai', maio: 'Mai', '05': 'Mai', '5': 'Mai',
    jun: 'Jun', junho: 'Jun', '06': 'Jun', '6': 'Jun',
    jul: 'Jul', julho: 'Jul', '07': 'Jul', '7': 'Jul',
    ago: 'Ago', agosto: 'Ago', '08': 'Ago', '8': 'Ago',
    set: 'Set', setembro: 'Set', '09': 'Set', '9': 'Set',
    out: 'Out', outubro: 'Out', '10': 'Out',
    nov: 'Nov', novembro: 'Nov', '11': 'Nov',
    dez: 'Dez', dezembro: 'Dez', '12': 'Dez',
  };

  // 2. Se for número serial de data do Excel (ex: 46234)
  const serialNum = Number(str);
  if (!isNaN(serialNum) && serialNum > 30000 && serialNum < 65000) {
    const d = new Date((serialNum - (25567 + 2)) * 86400 * 1000);
    const m = d.getUTCMonth() + 1;
    const y = d.getUTCFullYear();
    const abbr = monthMap[String(m)] || 'Ago';
    return `${abbr}/${y}`;
  }

  // 3. Normalização de texto sem acentos para busca
  const norm = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Detecta ano de 4 dígitos ou 2 dígitos
  const yearMatch = norm.match(/\b(20\d\d)\b/) || norm.match(/[\/\-](\d{2,4})/);
  let year = '2026';
  if (yearMatch) {
    const rawY = yearMatch[1].replace(/[^\d]/g, '');
    year = rawY.length === 2 ? `20${rawY}` : rawY;
  }

  // Procura por nome de mês por extenso ou abreviação
  for (const [key, abbr] of Object.entries(monthMap)) {
    if (isNaN(Number(key))) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(norm)) {
        return `${abbr}/${year}`;
      }
    }
  }

  // Se o formato for número de mês com barra (ex: "08/2026" ou "8/2026")
  const slashNumMatch = norm.match(/(\d{1,2})[\/\-](\d{2,4})/);
  if (slashNumMatch) {
    const m = String(parseInt(slashNumMatch[1], 10));
    const abbr = monthMap[m] || 'Ago';
    let y = slashNumMatch[2];
    if (y.length === 2) y = `20${y}`;
    return `${abbr}/${y}`;
  }

  // Se o formato for ISO (ex: "2026-08" ou "2026-08-15")
  const isoMatch = norm.match(/(\d{4})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const m = String(parseInt(isoMatch[2], 10));
    const abbr = monthMap[m] || 'Ago';
    return `${abbr}/${isoMatch[1]}`;
  }

  return str;
}

export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? '-' : '+';
  const absVal = Math.abs(value);
  if (absVal >= 1_000_000) {
    return `${sign}R$ ${(absVal / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
  }
  if (absVal >= 1_000) {
    return `${sign}R$ ${(absVal / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}k`;
  }
  return `${sign}R$ ${absVal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return '0,0%';
  const val = Math.abs(value) <= 1 && Math.abs(value) > 0 ? value * 100 : value;
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function parseNumberInput(input: string | number): number {
  if (typeof input === 'number') return input;
  if (!input) return 0;
  
  let clean = input.trim();
  let multiplier = 1;
  
  if (clean.toLowerCase().endsWith('m')) {
    multiplier = 1_000_000;
    clean = clean.slice(0, -1).trim();
  } else if (clean.toLowerCase().endsWith('k')) {
    multiplier = 1_000;
    clean = clean.slice(0, -1).trim();
  }

  // Remove R$, spaces
  clean = clean.replace(/R\$\s*/gi, '').replace(/\s+/g, '');
  
  // Handle Brazilian formatting: 1.234,56 or standard 1234.56
  if (clean.includes(',') && clean.includes('.')) {
    // 1.234,56
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num * multiplier;
}
