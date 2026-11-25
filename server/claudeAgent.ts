import type { ChatFilePayload } from './chatArtifacts';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function attachmentBlocks(files: ChatFilePayload[]): ClaudeContentBlock[] {
  const blocks: ClaudeContentBlock[] = [];
  for (const file of files) {
    if (!file.dataBase64) continue;
    if (/^image\/(png|jpeg|gif|webp)$/i.test(file.mimeType)) {
      blocks.push({
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: file.mimeType, data: file.dataBase64 },
      });
    }
    if (file.mimeType === 'application/pdf') {
      blocks.push({
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: file.dataBase64 },
      });
    }
  }
  return blocks;
}

export async function callClaudeAgent(params: {
  prompt: string;
  files?: ChatFilePayload[];
  purpose: 'general' | 'corporate-synthesis';
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5';
  const content: ClaudeContentBlock[] = [
    { type: 'text', text: params.prompt },
    ...attachmentBlocks((params.files || []).slice(0, 4)),
  ];

  const system = params.purpose === 'corporate-synthesis'
    ? `Você é o Agente FP&A. Receberá dados corporativos já consultados e governados pelo mecanismo interno. Trabalhe somente com esses dados: não invente números, não alegue acesso direto ao banco e sinalize lacunas. Produza análise executiva em português do Brasil. Quando houver instrução de DECK_SPEC_JSON, cumpra rigorosamente o esquema solicitado e escolha a quantidade de slides necessária para contar a história.`
    : `Você é o Agente FP&A, especialista em análise financeira, arquivos de escritório e comunicação executiva. Responda em português do Brasil. Analise cuidadosamente os arquivos e a conversa, faça cálculos verificáveis e produza entregáveis úteis. Não alegue acesso ao banco corporativo. Se o pedido depender de dados internos não fornecidos, explique que precisa consultar a base corporativa. Quando houver instrução de DECK_SPEC_JSON, cumpra rigorosamente o esquema solicitado e escolha livremente a quantidade de slides necessária.`;

  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 12000),
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Claude API ${response.status}: ${detail.slice(0, 800)}`);
  }

  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = (payload.content || [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n\n')
    .trim();

  return text || null;
}
