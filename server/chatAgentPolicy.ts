export interface AgentHistoryMessage {
  sender?: 'user' | 'agent' | string;
  text?: string;
}

const MAX_HISTORY_MESSAGES = 24;
const MAX_HISTORY_CHARS = 20_000;

export function sanitizeAgentHistory(input: unknown): AgentHistoryMessage[] {
  if (!Array.isArray(input)) return [];

  const cleaned = input
    .filter((item): item is AgentHistoryMessage => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      sender: item.sender === 'user' ? 'user' : 'agent',
      text: typeof item.text === 'string' ? item.text.trim().slice(0, 4_000) : '',
    }))
    .filter((item) => item.text.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);

  let remaining = MAX_HISTORY_CHARS;
  const bounded: AgentHistoryMessage[] = [];
  for (let index = cleaned.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const item = cleaned[index];
    const text = item.text.slice(Math.max(0, item.text.length - remaining));
    remaining -= text.length;
    bounded.unshift({ ...item, text });
  }
  return bounded;
}

export function buildGroundedAgentPrompt(message: string, historyInput: unknown): string {
  const history = sanitizeAgentHistory(historyInput);
  const conversation = history.length
    ? history
        .map((item) => `${item.sender === 'user' ? 'USUÁRIO' : 'AGENTE'}: ${item.text}`)
        .join('\n\n')
    : '(sem mensagens anteriores relevantes)';

  return `Você é o Agente de FP&A da V.tal. Responda à SOLICITAÇÃO ATUAL usando o histórico apenas para resolver referências como "isso", "aqui", "também" e manter continuidade.

REGRAS OBRIGATÓRIAS DE EVIDÊNCIA E APRESENTAÇÃO:
1. Use somente fatos efetivamente encontrados nos dados consultados. Não complete lacunas com conhecimento geral, suposições ou enquadramentos "típicos".
2. Se a solicitação mencionar duas ou mais entidades/termos (por exemplo, Bloomberg e agências de rating), pesquise e responda cada uma separadamente. Nunca use o resultado de uma como evidência da outra.
3. Para cada item sem registro, escreva claramente "não localizado nos dados consultados" e informe os termos efetivamente pesquisados. Não invente exemplos, fornecedores, contas ou classificações.
4. Diferencie explicitamente: "Evidência encontrada", "Não localizado" e, somente se útil, "Próxima busca sugerida".
5. Em tabelas, CONTA_DO_RAZAO e quaisquer códigos contábeis são identificadores de texto: apresente apenas dígitos, sem separadores de milhar e sem sufixo decimal (ex.: 4102010104; nunca 4.102.010.104,0).
6. TOTAL_VALOR deve ser calculado na unidade original em reais e exibido como moeda brasileira com duas casas (ex.: R$ 12.345,67). Não converta lançamentos para Mn/M e não arredonde para 0,0 Mn. Se também mostrar milhões, mantenha obrigatoriamente o valor exato em reais.
7. QTD_LANCAMENTOS é inteiro, sem casas decimais.
8. Ao gerar SQL, use CAST/SAFE_CAST para preservar códigos como STRING e calcule SUM(valor) sem divisão por 1.000.000. Só conclua depois de validar que a evidência textual suporta cada termo pedido.

HISTÓRICO RECENTE:
${conversation}

SOLICITAÇÃO ATUAL:
${message.trim()}`;
}

function normalizeAccountCode(value: string): string {
  const plain = value.replace(/[`*_]/g, '').trim();
  if (!/^[\d.,\s]+$/.test(plain)) return value;

  const withoutDecimal = plain.replace(/([,.]0+)$/, '');
  const digits = withoutDecimal.replace(/\D/g, '');
  return digits.length >= 5 ? digits : value;
}

function normalizeInteger(value: string): string {
  const plain = value.replace(/[`*_]/g, '').trim();
  if (!/^-?\d+(?:[,.]0+)?$/.test(plain)) return value;
  return plain.replace(/([,.]0+)$/, '');
}

function normalizeCurrency(value: string): string {
  const plain = value.replace(/[`*_]/g, '').trim();
  if (/^R\$/i.test(plain) || !/^-?\d+(?:\.\d+)?$/.test(plain)) return value;
  const numeric = Number(plain);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric).replace(/\u00a0/g, ' ');
}

function isDimensionHeader(header: string): boolean {
  return ['NIVEL', 'AREA', 'CLASSIFICACAO', 'NIO', 'FORNECEDOR', 'CENTRO', 'EMPRESA', 'GERENCIAL']
    .some((token) => header.includes(token));
}

export function normalizeAgentReplyMarkdown(raw: string): string {
  const lines = raw.split('\n');
  let headers: string[] | null = null;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
        headers = null;
        return line;
      }

      const cells = trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
      const isDelimiter = cells.every((cell) => /^[\s:-]+$/.test(cell));
      if (!headers) {
        headers = cells.map((cell) => cell.replace(/[`*_\s]/g, '').toUpperCase());
        return line;
      }
      if (isDelimiter) return line;

      const normalized = cells.map((cell, index) => {
        const header = headers?.[index] || '';
        if (header.includes('CONTADORAZAO') || header.includes('CONTACONTABIL')) {
          return normalizeAccountCode(cell);
        }
        if (header.includes('QTDLANCAMENTOS') || header.includes('QUANTIDADE')) {
          return normalizeInteger(cell);
        }
        if (header === 'VALOR' || header.includes('TOTALVALOR')) {
          return normalizeCurrency(cell);
        }
        if (isDimensionHeader(header) && /^0(?:[,.]0+)?$/.test(cell.replace(/[`*_\s]/g, ''))) {
          return '—';
        }
        return cell;
      });
      return `| ${normalized.join(' | ')} |`;
    })
    .join('\n');
}
