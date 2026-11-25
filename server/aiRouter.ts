const CORPORATE_DATA_PATTERNS = [
  /\bbigquery\b/i,
  /\bbanco(?:\s+de\s+dados)?\b/i,
  /\bbase\s+(?:oficial|financeira|de\s+dados)\b/i,
  /\bdre\b/i,
  /\bfechamento\b/i,
  /\b(?:realizado|real)\s+(?:x|vs\.?|versus)\s+(?:or[cç]ado|budget)\b/i,
  /\b(?:or[cç]ado|budget)\s+(?:x|vs\.?|versus)\s+(?:realizado|real)\b/i,
  /\b(?:versus|vs\.?)\s+(?:or[cç]ado|budget)\b/i,
  /\b(?:ebitda|opex|capex|receita\s+l[ií]quida)\b/i,
  /\b(?:f[ií]sicos|ftth|home\s+passed|homes?\s+connected|net\s*adds?|gross\s*adds?|churn|arpu)\b/i,
  /\b(?:nio|v[.]?tal|tecto)\b.*\b(?:m[eê]s|acumulado|ytd|valor|varia[cç][aã]o|or[cç]ado|realizado)\b/i,
  /\b(?:fornecedor|conta\s+do\s+raz[aã]o|centro\s+de\s+custo|lan[cç]amento)\b/i,
  /\b(?:justificativas?|impactos?)\b.*\b(?:salv[ao]|hist[oó]rico|m[eê]s|ytd|banco)\b/i,
  /\b(?:tabela|view|dataset)\b.*\b(?:agente_fpa|vtal-fpea-prd)\b/i,
];

export type AgentRoute = 'corporate-data' | 'general';

export function classifyAgentRoute(message: string): AgentRoute {
  return CORPORATE_DATA_PATTERNS.some((pattern) => pattern.test(message))
    ? 'corporate-data'
    : 'general';
}
