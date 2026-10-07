import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import { FinancialReportRow, PhysicalReportRow } from './wordReport';

export interface NioExecutiveNarrative {
  executiveSummary: string;
  keyMessages: string[];
  monthReading: string;
  ytdReading: string;
  kpisAnalysis: {
    baseAndNetAdds: string;
    grossAddsAndSales: string;
    churn: string;
    organicVision: string;
  };
  revenueAnalysis: {
    netRevenueBullets: string[];
    arpuBullets: string[];
  };
  costsAnalysis: {
    relRevenueBullets: string[];
    costToServeBullets: string[];
    adminBullets: string[];
    cacBullets: string[];
    oneOffsBullets: string[];
  };
  cacUnitaryAnalysis: {
    unitaryIntro: string;
    channelReading: string;
    commissionsAndDeferral: string;
  };
}

export interface VtalExecutiveNarrative {
  highlights: string[];
  ytdBauBullets: string[];
  revenueDetailBullets: string[];
  newBusinessBullets: string[];
  projectsFootnote: string;
  projectsBullets: string[];
}

export interface TectoExecutiveNarrative {
  highlights: string[];
  ytdBauBullets: string[];
  opexDetailBullets: string[];
}

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

function parsePeriodInfo(period: string) {
  const [yStr, mStr] = String(period || '2026/8').split('/');
  const year = Number(yStr) || 2026;
  const month = Number(mStr) || 8;
  const monthName = MONTHS_PT[month] || 'Agosto';
  return { year, month, monthName, monthLower: monthName.toLowerCase(), fullLabel: `${monthName}/${year}` };
}

function fmtR(valMn: number): string {
  const rounded = Math.round(valMn);
  const abs = Math.abs(rounded).toLocaleString('pt-BR');
  return rounded < 0 ? `R$(${abs})mn` : `R$${abs}mn`;
}

function fmtRDec(valMn: number): string {
  const abs = Math.abs(valMn).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return valMn < 0 ? `-R$ ${abs}Mn` : `R$ ${abs}Mn`;
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

let cachedServiceAccount: Record<string, unknown> | null = null;
function getServiceAccountCredentials(): Record<string, unknown> | null {
  if (cachedServiceAccount) return cachedServiceAccount;
  try {
    const envJson = process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (envJson) {
      cachedServiceAccount = JSON.parse(envJson);
      return cachedServiceAccount;
    }
    const saPath = path.resolve(process.cwd(), 'server', 'service-account.json');
    if (fs.existsSync(saPath)) {
      cachedServiceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
      return cachedServiceAccount;
    }
  } catch (err) {
    console.warn('[Gemini Narrative] Erro ao ler service-account.json:', err);
  }
  return null;
}

function extractJsonObject<T>(rawText: string): T | null {
  if (!rawText) return null;
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Consulta a IA do Gemini via SDK oficial (@google/genai) ou via Agente Executivo FP&A no Cloud Run (fpa-a2a-agent)
 */
async function callGeminiExecutiveJson<T>(prompt: string, label: string): Promise<T | null> {
  // 1. Tentativa via @google/genai (gemini-3-flash-preview) se GEMINI_API_KEY estiver configurada
  const ai = getGenAIClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const parsed = extractJsonObject<T>(response.text || '');
      if (parsed) {
        console.log(`[Gemini Narrative ${label}] Gerado via @google/genai (gemini-3-flash-preview).`);
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini Narrative ${label}] Falha no @google/genai, tentando Cloud Run Agent:`, err);
    }
  }

  // 2. Tentativa via Agente Executivo FP&A no Cloud Run (fpa-a2a-agent autenticado via GCP service-account)
  const creds = getServiceAccountCredentials();
  if (creds) {
    try {
      const auth = new GoogleAuth({ credentials: creds as never });
      const a2aUrl = 'https://fpa-a2a-agent-7kylviopuq-uc.a.run.app';
      const idClient = await auth.getIdTokenClient(a2aUrl);
      const headers = await idClient.getRequestHeaders();
      const authHeaders =
        typeof (headers as Headers).entries === 'function'
          ? Object.fromEntries((headers as Headers).entries())
          : { ...(headers as unknown as Record<string, string>) };

      const messageId = `word-${label}-${Date.now()}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const a2aRes = await fetch(a2aUrl, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: messageId,
            method: 'message/stream',
            params: {
              configuration: { blocking: true, acceptedOutputModes: [] },
              message: {
                kind: 'message',
                messageId,
                role: 'user',
                parts: [{ kind: 'text', text: prompt }],
              },
            },
          }),
          signal: controller.signal,
        });

        if (a2aRes.ok) {
          const sseText = await a2aRes.text();
          let finalResponseText = '';
          let dataResultText = '';
          for (const line of sseText.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6));
                const event = json.result || json;
                if (event.artifact?.parts) {
                  for (const part of event.artifact.parts) {
                    if (part.text) {
                      if (event.artifact.name === 'Final response') {
                        finalResponseText += (finalResponseText ? '\n' : '') + part.text;
                      } else {
                        dataResultText += (dataResultText ? '\n' : '') + part.text;
                      }
                    }
                  }
                }
              } catch {
                // ignora linha parcial
              }
            }
          }
          const chosen = finalResponseText.trim() || dataResultText.trim();
          const parsed = extractJsonObject<T>(chosen);
          if (parsed) {
            console.log(`[Gemini Narrative ${label}] Análise gerada com sucesso pelo Agente Gemini FP&A (Cloud Run)!`);
            return parsed;
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      console.log(`[Gemini Narrative ${label}] Usando síntese executiva consolidada do período.`);
    }
  }

  return null;
}

function cleanSingleJustificationText(raw: unknown): string {
  const text = String(raw || '').trim();
  if (!text || text === '0' || text.toLowerCase() === 'dentro do orçado') return '';
  // Remove prefixos repetitivos de conciliação histórica ("Resumo histórico até ago/26...")
  if (text.startsWith('Resumo histórico até')) {
    const parts = text.split('|').map((p) => p.trim()).filter(Boolean);
    const lastPart = parts[parts.length - 1] || '';
    return lastPart
      .replace(/^Resumo histórico até[^.]*\.\s*/i, '')
      .replace(/^(Volume|Preço|Orçamento|Postergação|Outros):\s*/i, '')
      .replace(/^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(\/[a-z]{3})?:\s*/i, '')
      .trim()
      .slice(0, 180);
  }
  return text.slice(0, 180);
}

function summarizeJustificationsForPrompt(
  financialRows: FinancialReportRow[],
  justifications: Record<string, unknown>
) {
  const items: Array<{
    linha: string;
    nivel0: string;
    nivel2: string;
    nivel3: string;
    nivel4: string;
    area: string;
    orcadoMesMn: number;
    realMesMn: number;
    deltaMesMn: number;
    orcadoYtdMn: number;
    realYtdMn: number;
    deltaYtdMn: number;
    comentariosMes: string[];
    comentariosYtd: string[];
  }> = [];

  for (const row of financialRows) {
    const just = justifications[row.id] as
      | {
          vsOrcadoImpacts?: Array<{ name?: string; justification?: string }>;
          ytdImpacts?: Array<{ name?: string; justification?: string }>;
          momImpacts?: Array<{ name?: string; justification?: string }>;
        }
      | undefined;
    const comentariosMes = [
      ...(just?.vsOrcadoImpacts || []),
      ...(just?.momImpacts || []),
    ]
      .map((i) => cleanSingleJustificationText(i.justification))
      .filter((t) => t.length > 0);
    const comentariosYtd = (just?.ytdImpacts || [])
      .map((i) => cleanSingleJustificationText(i.justification))
      .filter((t) => t.length > 0);

    if (
      comentariosMes.length > 0 ||
      comentariosYtd.length > 0 ||
      Math.abs(row.realYtd - row.budgetYtd) >= 2_000_000 ||
      Math.abs(row.realCurrent - row.budgetCurrent) >= 1_000_000
    ) {
      items.push({
        linha: row.classification,
        nivel0: row.level0 || 'BAU',
        nivel2: row.level2 || '-',
        nivel3: row.level3,
        nivel4: row.level4,
        area: row.area,
        orcadoMesMn: Number((row.budgetCurrent / 1_000_000).toFixed(1)),
        realMesMn: Number((row.realCurrent / 1_000_000).toFixed(1)),
        deltaMesMn: Number(((row.realCurrent - row.budgetCurrent) / 1_000_000).toFixed(1)),
        orcadoYtdMn: Number((row.budgetYtd / 1_000_000).toFixed(1)),
        realYtdMn: Number((row.realYtd / 1_000_000).toFixed(1)),
        deltaYtdMn: Number(((row.realYtd - row.budgetYtd) / 1_000_000).toFixed(1)),
        comentariosMes: comentariosMes.slice(0, 2),
        comentariosYtd: comentariosYtd.slice(0, 1),
      });
    }
  }

  return items
    .sort((a, b) => Math.abs(b.deltaYtdMn) + Math.abs(b.deltaMesMn) - (Math.abs(a.deltaYtdMn) + Math.abs(a.deltaMesMn)))
    .slice(0, 20);
}

function isCleanExecutiveBullet(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Rejeita bullets que acumulam histórico mensal bruto ou colchetes de dump
  if (/Resumo histórico até/i.test(trimmed)) return false;
  if (/\b(mai|jun|jul|ago):\s/i.test(trimmed)) return false;
  if (trimmed.includes('[Resumo') || trimmed.length > 520) return false;
  return true;
}

function pickExecutiveBullets(aiBullets: string[] | undefined, fallbackBullets: string[]): string[] {
  if (!Array.isArray(aiBullets) || aiBullets.length === 0) return fallbackBullets;
  const cleaned = aiBullets.filter(isCleanExecutiveBullet);
  if (cleaned.length !== fallbackBullets.length) return fallbackBullets;
  return cleaned;
}

/**
 * Fallback padrão com o conteúdo analítico oficial da NIO (Fechamento Agosto/2026)
 */
export const DEFAULT_NIO_NARRATIVE: NioExecutiveNarrative = {
  executiveSummary:
    'A NIO fechou agosto com EBITDA de -R$ 17,9Mn, R$ 13,2Mn abaixo do orçado. O desvio vem da receita (-R$ 27,4Mn), explicada por base e ARPU abaixo do plano, e de pressões recorrentes em atendimento, contingências e serviços especializados. O menor CAC (-R$ 15,7Mn) compensa parte do resultado, mas é efeito do gross abaixo do orçado e não de eficiência. No acumulado, o EBITDA de R$ 0,1Mn fica R$ 5,9Mn abaixo do orçado, sustentado por créditos não recorrentes.',
  keyMessages: [
    'Receita -R$ 27,4Mn (-8,7%) vs orçado. Base 117k abaixo do plano (gross orgânico -33k) e ARPU -R$ 5,36, com base faturada de 91,4% (orçado 93,6%), postergação do NCC, degradação por retenção e ações de receita (RA) abaixo do previsto.',
    'Base cresce pelo 5º mês consecutivo, com +23k de M&A (Loviz e Onitel). O orgânico registra +5k, segundo mês positivo, ainda 42k abaixo do orçado.',
    'Churn de 2,8% (+0,51pp) pressionado pelo volume de pedidos de cancelamento (voluntário +0,36pp) e pelo early churn das safras recentes (involuntário +0,15pp).',
    'Custo de servir +R$ 2,9Mn no mês e +R$ 38,0Mn no YTD: volume de atendimento (+70k chamadas em SAC e retenção) e canais especializados (Procon, Ouvidoria, Anatel e Reclame Aqui).',
    'CAC -R$ 15,7Mn é efeito volume: a taxa de conexão cai com o gross menor, enquanto o unitário de vendas sobe para R$ 631 (orçado R$ 518) com comissões e mídia digital.',
    'YTD sustentado por não recorrentes: R$ 66,9Mn de denúncia espontânea de ICMS e R$ 16,2Mn de contrato desvantajoso compensam contingências (+R$ 13,3Mn) e serviços especializados (+R$ 10,7Mn) fora do orçamento.',
  ],
  monthReading:
    'A receita responde pelo dobro do desvio de EBITDA. O saving de CAC (+R$ 15,7Mn de efeito positivo) decorre do menor gross e tende a se reverter com a retomada de vendas. Atendimento (+R$ 3,5Mn), contingências (+R$ 2,3Mn) e serviços especializados (+R$ 1,2Mn) somam R$ 7,0Mn de pressão, parcialmente compensados pelo jurídico (-R$ 2,6Mn) e por conteúdo (-R$ 3,9Mn). Em one-offs, o benefício de Alagoas orçado nesta linha (R$ 3,3Mn) foi contabilizado na receita.',
  ytdReading:
    'Os efeitos não recorrentes somam aproximadamente R$ 62,6Mn líquidos favoráveis: denúncia espontânea (R$ 66,9Mn), contrato desvantajoso (R$ 16,2Mn) e estorno de pedidos Telemon/Serede (R$ 5,6Mn), deduzidas as despesas remanescentes da Oi de 2025 (R$ 26,1Mn). Sem esses efeitos, o EBITDA acumulado ficaria cerca de R$ 68Mn abaixo do orçado. Recorrentemente, pesam a receita (-R$ 100,6Mn), o atendimento (+R$ 53,9Mn), as contingências (+R$ 13,3Mn) e os serviços especializados (+R$ 10,7Mn).',
  kpisAnalysis: {
    baseAndNetAdds:
      'A base EOP encerrou agosto em 3.312k, 117k abaixo do orçado e 6k abaixo do forecast. O Net Adds de +21k (-26k vs orçado; -4k vs forecast) marca o quinto mês consecutivo de crescimento da base, apoiado na incorporação de 23k clientes via M&A.',
    grossAddsAndSales:
      'Os Gross Adds somaram 114k (-10k vs orçado; +9k vs forecast), repetindo o melhor resultado do ano obtido em julho. A venda bruta de 144k cresceu 6% MoM por dia útil, mas ficou 17k abaixo do orçado (+13k vs forecast). No acumulado, são 696k gross adds contra 799k orçados (-13%).',
    churn:
      'O churn de 2,8% ficou 0,51pp acima do orçado (+0,4pp vs forecast). No voluntário (+0,36pp), o volume de pedidos de cancelamento acima do previsto mantém a pressão. No involuntário (+0,15pp), a redução de 3,5k clientes TOP com postergação de régua aumentou as retiradas, e o early churn segue pressionado pelas safras recentes e pelo FPD acima do planejado. Melhor desempenho da base madura e evolução das ações de recuperação compensam parte do desvio.',
    organicVision:
      'O Net Adds orgânico foi positivo pelo segundo mês (+5k), ainda 42k abaixo do orçado (-20k vs forecast). Os Gross Adds orgânicos ficaram 33k abaixo do orçado (-13k vs forecast), com venda bruta de 121k (+4% MoM por dia útil; -40k vs orçado). O canal Local se destaca (+11% vs orçado e +5% MoM), o Digital cresce 5% MoM e os Remotos ficam estáveis. O churn pro forma ficou 0,33pp acima do orçado, concentrado no voluntário (+0,32pp), com involuntário em linha.',
  },
  revenueAnalysis: {
    netRevenueBullets: [
      'Vs julho (+R$ 4,8Mn): a base faturada subiu 58k, concentrada no gross da Onitel a incorporar e na redução de clientes TOP, elevando o índice de base faturada de 90,2% para 91,4%. Clientes NiOS pagando mais de uma fatura recuaram 1,2k. As migrações de rentabilização (Price Up) não compensaram a degradação da retenção (Price Down).',
      'Vs orçado (-R$ 27,4Mn): net adds e base faturada respondem por -R$ 18,2Mn, com base 105k menor e base faturada de 91,4% contra 93,6% orçado. As ações de base somam -R$ 4,6Mn pela postergação do NCC e pela degradação por retenção. As ações de RA realizaram R$ 0,6Mn contra R$ 4,0Mn orçados (-R$ 3,5Mn, em análise).',
    ],
    arpuBullets: [
      'Vs julho (+R$ 0,99): o índice de base faturada (+1,2pp) adicionou R$ 1,36. O gross tirou R$ 0,25, com ARPU R$ 6,96 inferior ao da base média, e o churn tirou R$ 0,05. As ações de base tiveram efeito líquido de -R$ 0,06.',
      'Vs orçado (-R$ 5,36): o menor índice de base faturada explica -R$ 2,74 e as ações de base (Price Up e Price Down) -R$ 1,36.',
      'Mix do gross: a participação de cidades com ofertas de desconto subiu de cerca de 4% do gross em set/25 para 29% em ago/26, com ticket de aproximadamente R$ 82 contra R$ 112 na oferta normal. Cada +1,0pp de participação nessas ofertas reduz em cerca de R$ 0,01 o ARPU da base média.',
    ],
  },
  costsAnalysis: {
    relRevenueBullets: [
      'Agosto (-R$ 3,4Mn): conteúdo -R$ 3,9Mn pela correção de base do Globoplay (abr/25 a out/25); operação FTTH e VoIP +R$ 1,9Mn, com R$ 8,6Mn de M&A (Loviz R$ 3,2Mn e Onitel R$ 5,4Mn) compensados em parte pelo menor custo V.tal; crédito de R$ 0,7Mn por baixa de provisão do contrato Nokia (CGR); taxas Anatel -R$ 0,3Mn pela menor receita.',
      'YTD (-R$ 39,7Mn): conteúdo -R$ 17,9Mn (menor base e renegociação com fornecedores); operação V.tal -R$ 10,9Mn pela menor base; operação rede -R$ 5,6Mn por estorno de pedidos Telemon e Serede de 2025 e crédito de CGR; PDD -R$ 1,8Mn (-1,6%), em tendência de melhora, mas em 4,6% da receita contra 4,4% orçado, pela receita abaixo do plano.',
    ],
    costToServeBullets: [
      'Agosto (+R$ 2,9Mn): atendimento +R$ 3,5Mn, sendo R$ 1,3Mn em SAC e retenção (+21k e +49k chamadas) e R$ 1,4Mn em atendimento especializado: Procon R$ 0,5Mn (segregação da operação orçada não ocorreu), Ouvidoria R$ 0,4Mn (+106% preço e +59% volume), Reclame Aqui R$ 0,3Mn e Anatel R$ 0,2Mn. Faturamento -R$ 0,4Mn pela antecipação do fim das faturas físicas. Mensageria -R$ 0,4Mn, apesar de erro de provisão META de R$ 2Mn a corrigir.',
      'YTD (+R$ 38,0Mn): atendimento +R$ 53,9Mn pelo aumento de capacidade para mitigar os incidentes sistêmicos do 1T26; mensageria -R$ 15,5Mn por alocação orçamentária (realizado em Tecnologia); multas +R$ 2,4Mn pela menor base; mínimo Tahto R$ 1,1Mn e cobrança +R$ 0,8Mn.',
    ],
    adminBullets: [
      'Agosto (+R$ 0,6Mn): contingências +R$ 2,3Mn por 789 execuções não orçadas; serviços especializados +R$ 1,2Mn (CSC não orçado de R$ 0,4Mn em revenue assurance e posto fiscal, além de faturamento, auditorias, BPO de arrecadação e consultoria de RH em Alagoas). Compensam o jurídico -R$ 2,6Mn (costsharing -R$ 1,5Mn e custas judiciais -R$ 1,1Mn) e despesas gerais -R$ 0,3Mn (escritório de Alagoas não realizado e corte de viagens).',
      'YTD (+R$ 36,1Mn): tecnologia +R$ 15,6Mn, espelhando a economia em mensageria; contingências +R$ 13,3Mn por execuções não orçadas; serviços especializados +R$ 10,7Mn em BPOs e consultorias; jurídico -R$ 2,4Mn (despesas -R$ 5,9Mn e estouro de +R$ 3,4Mn no costsharing legal) e despesas gerais -R$ 2,0Mn.',
    ],
    cacBullets: [
      'Agosto (-R$ 15,7Mn): taxa de conexão e crédito PIS/COFINS -R$ 17,4Mn, com gross orgânico de 90,8k contra 123,8k orçados; brand building -R$ 1,9Mn, com a verba anual de R$ 20Mn já consumida; comunicação e marca -R$ 0,6Mn (postergação de influenciadores e renegociação de fees); mídia digital +R$ 0,4Mn com campanhas B2B e ampliação do B2C; comissões +R$ 3,8Mn (detalhe abaixo).',
      'YTD (-R$ 80,7Mn): taxa de conexão -R$ 84,6Mn, com gross orgânico de 630k contra 799k orçados; mídia digital +R$ 11,3Mn e brand building +R$ 4,1Mn sem conversão proporcional em gross; comunicação e marca -R$ 8,2Mn; comissões +R$ 3,2Mn pela equiparação das políticas de PAP e Dealers.',
    ],
    oneOffsBullets: [
      'Agosto: o benefício de Alagoas orçado em one-offs (R$ 3,3Mn) foi contabilizado na receita; o crédito tributário total ficou R$ 0,9Mn abaixo do orçado. O contrato desvantajoso da Tahto gerou crédito não orçado de R$ 1,5Mn. Em pessoal, +R$ 1,7Mn de despesas NIO foram compensados por -R$ 2,2Mn de costsharing.',
      'YTD: R$ 66,9Mn de denúncia espontânea de ICMS (reversão de contingência tributária), crédito de R$ 16,2Mn do contrato desvantajoso (reconhecido no 2T) e R$ 4,5Mn de buffer Tahto, contra R$ 26,1Mn de despesas remanescentes da Oi de 2025 e R$ 26,7Mn do benefício de Alagoas registrado na receita. Pessoal com economia de R$ 18,4Mn em costsharing e +R$ 4,8Mn em despesas NIO.',
    ],
  },
  cacUnitaryAnalysis: {
    unitaryIntro:
      'O unitário de vendas ex-M&A subiu R$ 32 em agosto, para R$ 631, contra R$ 518 orçado (+R$ 113). O movimento se distribui em todos os canais e é puxado pelo Digital (+R$ 19), com maior investimento nas campanhas de oferta BTU, Google B2C e B2B. Nos Remotos (+R$ 8), pesam a política comercial da Webmais e o início do pagamento do bônus M10; no Local (+R$ 6), campanhas de PAP e o mix de planos de maior velocidade.',
    channelReading:
      'Leitura por canal. Os desvios mais relevantes estão nos canais de mídia e no Dealer digital, onde a alteração da política comercial não prevista no orçamento equiparou a remuneração ao PAP. O PAP, com 48% do mix contra 31% orçado, eleva o unitário médio por ser 100% comissionado, embora o próprio canal rode abaixo do orçado com 100% da verba VPC/VPI alocada. A menor participação dos canais remotos e o gross digital 37% abaixo do orçado diluem menos o investimento em mídia.',
    commissionsAndDeferral:
      'A despesa de vendas de R$ 17,4Mn ficou R$ 3,8Mn acima do orçado. As comissões brutas ficaram R$ 3,8Mn abaixo do plano, pelo efeito volume (-12k gross comissionado, principalmente Teleagentes e Dealer digital, -R$ 5,7Mn), parcialmente compensado pela provisão do bônus M10 (+R$ 1,5Mn) e por uma duplicidade de contabilização de R$ 0,4Mn a ser estornada em setembro. O diferimento, porém, foi R$ 7,5Mn menor: por decisão da auditoria, o crédito de PIS/COFINS sobre vendas passou a ser diferido, com impacto do mês e do acumulado de maio a julho (R$ 3,5Mn), além do menor diferimento da comissão do mês (R$ 4,0Mn).',
  },
};

/**
 * Constrói dinamicamente a narrativa executiva da V.tal com base nos números reais do BigQuery e nas justificativas do GCP da competência selecionada
 */
function buildDynamicVtalNarrative(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): VtalExecutiveNarrative {
  const { period, financialRows, justifications } = params;
  const { monthName, year } = parsePeriodInfo(period);

  const isRev = (r: FinancialReportRow) => {
    if (r.level1 && r.level1 !== '-') return r.level1.toLowerCase().includes('revenue');
    return ['FTTH', 'Wholesale', 'Other Revenue (Swaps, IRU)', 'Connectivity', 'Low latency', 'TIC', 'Performance Business', 'UmTelecom', 'Copper', 'IPV4'].includes(r.level3);
  };

  const sum = (rows: FinancialReportRow[], pred: (r: FinancialReportRow) => boolean) => {
    let mOrc = 0, mReal = 0, yOrc = 0, yReal = 0;
    for (const r of rows) {
      if (pred(r)) {
        mOrc += r.budgetCurrent / 1_000_000;
        mReal += r.realCurrent / 1_000_000;
        yOrc += r.budgetYtd / 1_000_000;
        yReal += r.realYtd / 1_000_000;
      }
    }
    return { mOrc, mReal, mDelta: mReal - mOrc, yOrc, yReal, yDelta: yReal - yOrc };
  };

  const bauRows = financialRows.filter(
    (r) => (r.level0 || 'BAU').trim().toUpperCase() === 'BAU' && (r.level2 || 'V.tal').trim() === 'V.tal'
  );
  const exLtlaRows = financialRows.filter((r) => (r.level2 || 'V.tal').trim() !== 'V.tal (LTLA)');

  const mRev = sum(exLtlaRows, isRev);
  const mOpex = sum(exLtlaRows, (r) => !isRev(r));
  const mEbitda = {
    mOrc: mRev.mOrc + mOpex.mOrc,
    mReal: mRev.mReal + mOpex.mReal,
    mDelta: mRev.mDelta + mOpex.mDelta,
  };

  const bauRev = sum(bauRows, isRev);
  const bauOpex = sum(bauRows, (r) => !isRev(r));
  const bauEbitda = {
    yOrc: bauRev.yOrc + bauOpex.yOrc,
    yReal: bauRev.yReal + bauOpex.yReal,
    yDelta: bauRev.yDelta + bauOpex.yDelta,
  };

  const anchor = sum(bauRows, (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant');
  const anchorConn = sum(bauRows, (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('connection'));
  const anchorTax = sum(bauRows, (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && r.classification.toLowerCase().includes('beneficio'));
  const anchorOther = sum(bauRows, (r) => r.level3 === 'FTTH' && r.level4 === 'Anchor Tenant' && !r.classification.toLowerCase().includes('monthly') && !r.classification.toLowerCase().includes('connection') && !r.classification.toLowerCase().includes('voip') && !r.classification.toLowerCase().includes('beneficio'));
  const otherTenants = sum(bauRows, (r) => r.level3 === 'FTTH' && r.level4 === 'Other Tenants');
  const wholesale = sum(bauRows, (r) => r.level3 === 'Wholesale');
  const otherRev = sum(bauRows, (r) => r.level3 === 'Other Revenue (Swaps, IRU)');

  const maint = sum(bauRows, (r) => !isRev(r) && r.level3 === 'Maintenance & Operational Costs');
  const passive = sum(bauRows, (r) => !isRev(r) && r.level3 === 'Passive network infrastructure');
  const swaps = sum(bauRows, (r) => !isRev(r) && r.level3 === 'Swaps');
  const hr = sum(bauRows, (r) => !isRev(r) && r.level3 === 'HR');
  const sga = sum(bauRows, (r) => !isRev(r) && r.level3 === 'SG&A');
  const others = sum(bauRows, (r) => !isRev(r) && r.level3 === 'Others');

  const projTotal = sum(financialRows, (r) => (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS');
  const projIpv4 = sum(
    financialRows,
    (r) =>
      (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS' &&
      (r.level3.trim().toUpperCase() === 'IPV4' ||
        r.classification.trim().toUpperCase() === 'RECEITA IPV4')
  );
  const projBuildings = sum(
    financialRows,
    (r) =>
      (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS' &&
      (r.level3.trim() === 'Real Estate' ||
        r.classification.trim() === 'Real Estate - Venda de Prédios' ||
        r.level4.trim() === 'Sales of Buildings')
  );
  const projCopper = sum(
    financialRows,
    (r) => (r.level0 || '').trim().toUpperCase() === 'SPECIAL PROJECTS' && r.level3.trim() === 'Copper'
  );

  return {
    highlights: [
      `EBITDA BAU (ex-LTLA) acumulado até ${monthName}/${year} de ${fmtR(bauEbitda.yReal)}, ${fmtR(bauEbitda.yDelta)} vs. orçado (${fmtR(bauEbitda.yOrc)}), impulsionado por menores custos de manutenção (${fmtR(maint.yDelta)}), redução de gastos com infraestrutura passiva (${fmtR(passive.yDelta)}), ganhos em energia e economias em Swaps (${fmtR(swaps.yDelta)}) e HR (${fmtR(hr.yDelta)}).`,
      `No mês de ${monthName}/${year}, a Receita Líquida consolidada atingiu ${fmtR(mRev.mReal)} ante ${fmtR(mRev.mOrc)} orçados (Δ ${fmtR(mRev.mDelta)}), o OPEX registrou ${fmtR(mOpex.mReal)} ante ${fmtR(mOpex.mOrc)} orçados (Δ ${fmtR(mOpex.mDelta)}) e o EBITDA fechou em ${fmtR(mEbitda.mReal)} vs. ${fmtR(mEbitda.mOrc)} orçados (Δ ${fmtR(mEbitda.mDelta)}).`,
      `Receita BAU acumulada de ${fmtR(bauRev.yReal)} (Δ ${fmtR(bauRev.yDelta)} vs. orçado de ${fmtR(bauRev.yOrc)}), pressionada por menor performance da NIO (${fmtR(anchor.yDelta)}), Other Tenants (${fmtR(otherTenants.yDelta)}), efeitos cambiais/go-in no Wholesale (${fmtR(wholesale.yDelta)}) e renegociações em Swaps/IRU (${fmtR(otherRev.yDelta)}).`,
      `Projetos especiais (IPv4 e venda de imóveis) geraram ${fmtR(projTotal.yReal)} de EBITDA no ano, ${fmtR(projTotal.yDelta)} vs. orçado (${fmtR(projTotal.yOrc)}).`,
    ],
    ytdBauBullets: [
      `Receita Líquida ${fmtR(bauRev.yReal)} (Δ orçado ${fmtR(bauRev.yDelta)}): ${fmtR(anchor.yDelta)} NIO — impactado por menor base de HCs e Connection Fee (${fmtR(anchorConn.yDelta)}), parcialmente compensado por ${fmtR(anchorTax.yReal)} de tax credits (benefício Alagoas); ${fmtR(otherTenants.yDelta)} Other Tenants — mix mais concentrado em TIM (menor preço subsidiado); ${fmtR(wholesale.yDelta)} Wholesale — câmbio e go-in de performance, parcialmente compensados por faturamento retroativo em National Connectivity.`,
      `OPEX ${fmtR(bauOpex.yReal)} (Δ orçado ${fmtR(bauOpex.yDelta)}): ${fmtR(maint.yDelta)} Maintenance — reembolsos por rompimento de cabo submarino, recalendarização corretiva do CLS e Inventory Management; ${fmtR(passive.yDelta)} Passive Network Infra — Real Estate, IFRS16 (postes e dark fiber) e energia (haircut + venda de energia); ${fmtR(swaps.yDelta)} Swap — revisão dos contratos Vivo e TIM; ${fmtR(hr.yDelta)} HR — saving em headcount; ${fmtR(sga.yDelta)} SG&A — legal (despesas com Oi), parcialmente compensado por marketing; ${fmtR(others.yDelta)} Others — Tax (reclassificação, projeto de importação, VCI Tax) e PDD.`,
    ],
    revenueDetailBullets: [
      `Anchor ${fmtR(anchor.yDelta)}: ${fmtR(anchorConn.yDelta)} Connection Fee (gross abaixo do esperado) e ${fmtR(anchorOther.yDelta)} Others, parcialmente compensados por ${fmtR(anchorTax.yReal)} de tax credits (benefício Alagoas).`,
      `Other Tenants ${fmtR(otherTenants.yDelta)}: mix mais concentrado em TIM (menor preço subsidiado), compensado parcialmente por mensalidade.`,
      `Wholesale ${fmtR(wholesale.yDelta)}: câmbio e International Connectivity, parcialmente compensados por faturamento retroativo em National Connectivity e por Oi B2B.`,
      `Other Revenue ${fmtR(otherRev.yDelta)}: renegociação com Telefônica e TIM — redução de pares de fibra nas rotas do 4º e 5º contratos e nos trechos do 1º e 2º contratos de swap com a TIM.`,
    ],
    newBusinessBullets: [
      `B2B: estrutura de governança não realizada / custo de RH; não execução de temas de BPO.`,
      `Um Telecom: timing da incorporação, prevista no orçamento a partir de janeiro; incorporação esperada no 4º trimestre devido a negociações estratégicas referentes a novos contratos, com potencial de incremento de EBITDA de aprox. R$150mn/ano.`,
      `Mobile Solutions: entrega do 1º shopping no modelo smart venue (Shopping Partage, Brasília), com 150 lojas e ~30 links já ativados; B2B já captura mais de 50% da demanda de circuitos. FCUs voltam a acelerar, com destaque para 11 venues grandes para a TIM e avanço na Linha 6 do Metrô de São Paulo.`,
    ],
    projectsFootnote: `¹ Inclui Copper ${fmtR(projCopper.yReal)} — finalização das vendas, com 140 toneladas para Rerum e GMI em fev/26; pequena parcela de descontos retroativos de notas fiscais da IBRAME.`,
    projectsBullets: [
      `IPv4: principais clientes Google, Hostinger, Ding Feng, Mercado Livre e SpaceX, com ticket médio de US$10.`,
      `Venda de Prédios: 14 prédios vendidos até ${monthName.toLowerCase()} (8 no 1T, 2 em abr, 1 em mai, 3 em jul), somando ${fmtR(projBuildings.yReal)} ante ${fmtR(projBuildings.yOrc)} orçados (Δ ${fmtR(projBuildings.yDelta)}); 15 imóveis adicionais previstos para o 2º semestre (R$30mn).`,
    ],
  };
}

/**
 * Constrói dinamicamente a narrativa executiva da Tecto com base nos números reais do BigQuery e nas justificativas do GCP da competência selecionada
 */
function buildDynamicTectoNarrative(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): TectoExecutiveNarrative {
  const { period, financialRows } = params;
  const { monthName, year } = parsePeriodInfo(period);

  const sum = (pred: (r: FinancialReportRow) => boolean) => {
    let mOrc = 0, mReal = 0, yOrc = 0, yReal = 0;
    for (const r of financialRows) {
      if (pred(r)) {
        mOrc += r.budgetCurrent / 1_000_000;
        mReal += r.realCurrent / 1_000_000;
        yOrc += r.budgetYtd / 1_000_000;
        yReal += r.realYtd / 1_000_000;
      }
    }
    return { mOrc, mReal, mDelta: mReal - mOrc, yOrc, yReal, yDelta: yReal - yOrc };
  };

  const coloc = sum((r) => r.level3 === 'Colocation' || r.classification.toLowerCase().includes('colocation'));
  const power = sum((r) => r.classification.toLowerCase().includes('power'));
  const maint = sum((r) => r.classification.toLowerCase().includes('maintenance'));
  const fac = sum((r) => r.classification.toLowerCase().includes('facilities'));
  const hr = sum((r) => r.level3 === 'HR');
  const sga = sum((r) => r.level3 === 'SG&A');
  const consult = sum((r) => r.classification.toLowerCase().includes('consultorias'));
  const legal = sum((r) => r.level3 === 'SG&A' && r.classification.toLowerCase().includes('legal'));
  const travel = sum((r) => r.classification.toLowerCase().includes('travel'));
  const others = sum((r) => r.level3 === 'Others');
  const opex = sum((r) => r.level3 !== 'Colocation' && !r.classification.toLowerCase().includes('colocation'));
  const ebitda = {
    mOrc: coloc.mOrc + opex.mOrc,
    mReal: coloc.mReal + opex.mReal,
    mDelta: coloc.mDelta + opex.mDelta,
    yOrc: coloc.yOrc + opex.yOrc,
    yReal: coloc.yReal + opex.yReal,
    yDelta: coloc.yDelta + opex.yDelta,
  };

  return {
    highlights: [
      `Receita Líquida de Colocation atingiu ${fmtR(coloc.yReal)} no acumulado até ${monthName}/${year} (${fmtR(coloc.mReal)} no mês de ${monthName}), consolidando a rampa comercial de ocupação e ativação de contratos nos Data Centers.`,
      `OPEX acumulado de ${fmtR(opex.yReal)} ante ${fmtR(opex.yOrc)} orçados (Δ ${fmtR(opex.yDelta)}), impactado principalmente por Power Costs (${fmtR(power.yDelta)} de desvio YTD pelo descasamento temporário de reembolso de energia entre Tecto I e Tecto II).`,
      `No mês de ${monthName}/${year}, o OPEX totalizou ${fmtR(opex.mReal)} vs. ${fmtR(opex.mOrc)} orçados (Δ ${fmtR(opex.mDelta)}) e o EBITDA fechou em ${fmtR(ebitda.mReal)} (${fmtR(ebitda.yReal)} no YTD).`,
      `Eficiência em custos operacionais de manutenção predial e infraestrutura (saving de ${fmtR(maint.yDelta)} em Maintenance/Materials e ${fmtR(fac.yDelta)} em Facilities & Utilities no YTD), compensando parcialmente investimentos em expansão (ZPE e frente comercial China).`,
    ],
    ytdBauBullets: [
      `Receita Líquida ${fmtR(coloc.yReal)} (Realizado YTD até ${monthName}/${year} | ${fmtR(coloc.mReal)} no mês): faturamento integralmente concentrado em serviços de Colocation e Cross-Connects nos sites operacionais.`,
      `OPEX ${fmtR(opex.yReal)} (Δ orçado ${fmtR(opex.yDelta)}): ${fmtR(power.yDelta)} Power Costs — gap temporal pelo reembolso de energia no período entre Tecto I e Tecto II; ${fmtR(maint.yDelta + fac.yDelta)} de economia combinada em Maintenance & Materials e Facilities (apesar de gastos de aluguel da ZPE não orçados); ${fmtR(hr.yDelta)} HR — pessoal de operação e engenharia (O&E Personnel) e Cost Sharing; ${fmtR(sga.yDelta)} SG&A — consultorias especializadas para ZPE (permits e energia), jurídico e viagens comerciais (iniciativa China); ${fmtR(others.yDelta)} Others — reflexo de PDD relacionada à mudança de titularidade de contratos.`,
    ],
    opexDetailBullets: [
      `Power Costs ${fmtR(power.yDelta)} YTD (${fmtR(power.mDelta)} em ${monthName}): variação concentrada no efeito temporal de reembolso de energia elétrica entre as plantas Tecto I e Tecto II.`,
      `Maintenance, Facilities & ZPE ${fmtR(maint.yDelta + fac.yDelta)} YTD: economia em materiais e manutenção corretiva compensando os gastos referentes ao aluguel da ZPE não previstos no orçamento original.`,
      `SG&A ${fmtR(sga.yDelta)} YTD: ${fmtR(consult.yDelta)} em Consultorias (projetos de permits e energia para a ZPE), ${fmtR(legal.yDelta)} em Legal (efeito timing na distribuição do orçamento e Cost Sharing) e ${fmtR(travel.yDelta)} em Viagens (agenda comercial e iniciativa China com foco em redução de CAPEX).`,
      `Others & PDD ${fmtR(others.yDelta)} YTD: provisão para devedores duvidosos (PDD) em tratativa pelo time de CAR, decorrente do processo de transferência de titularidade da V.tal para a Tecto.`,
    ],
  };
}

/**
 * Constrói dinamicamente a narrativa executiva da NIO com base nos números reais do BigQuery e nas justificativas do GCP da competência selecionada
 */
function buildDynamicNioNarrative(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): NioExecutiveNarrative {
  if (params.financialRows.length === 0) return DEFAULT_NIO_NARRATIVE;
  const { month, monthName, monthLower, fullLabel } = parsePeriodInfo(params.period);
  const previousMonthName = MONTHS_PT[month === 1 ? 12 : month - 1];
  const normalize = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const sum = (pred: (r: FinancialReportRow) => boolean) => {
    let mOrc = 0, mReal = 0, yOrc = 0, yReal = 0;
    for (const r of params.financialRows) {
      if (pred(r)) {
        mOrc += r.budgetCurrent / 1_000_000;
        mReal += r.realCurrent / 1_000_000;
        yOrc += r.budgetYtd / 1_000_000;
        yReal += r.realYtd / 1_000_000;
      }
    }
    return { mOrc, mReal, mDelta: mReal - mOrc, yOrc, yReal, yDelta: yReal - yOrc };
  };

  const byN1 = (expected: string) => (r: FinancialReportRow) => normalize(r.level3) === normalize(expected);
  const rev = sum(byN1('Receita'));
  const opex = sum((r) => !byN1('Receita')(r));
  const ebitda = {
    mOrc: rev.mOrc + opex.mOrc,
    mReal: rev.mReal + opex.mReal,
    mDelta: rev.mDelta + opex.mDelta,
    yOrc: rev.yOrc + opex.yOrc,
    yReal: rev.yReal + opex.yReal,
    yDelta: rev.yDelta + opex.yDelta,
  };

  const category = (n1: string) => sum(byN1(n1));
  const relRev = category('1.Custos Relacionados a Receita');
  const serve = category('2.Custos de Servir');
  const admin = category('3.Custos Administrativos');
  const cac = category('4.Custo de Aquisição do Cliente');
  const hr = category('6.Custos RH');
  const justificationText = (row: FinancialReportRow, ytd = false) => {
    const value = params.justifications[row.id] as { vsOrcadoImpacts?: Array<{ justification?: string }>; momImpacts?: Array<{ justification?: string }>; ytdImpacts?: Array<{ justification?: string }> } | undefined;
    const impacts = ytd ? value?.ytdImpacts || [] : [...(value?.vsOrcadoImpacts || []), ...(value?.momImpacts || [])];
    return impacts.map((impact) => cleanSingleJustificationText(impact.justification)).filter(Boolean).slice(0, 2).join(' ');
  };
  const bulletsForN1 = (n1: string, ytd: boolean): string[] => params.financialRows
    .filter(byN1(n1))
    .map((row) => ({ row, delta: ytd ? row.realYtd - row.budgetYtd : row.realCurrent - row.budgetCurrent }))
    .filter((item) => Math.abs(item.delta) >= 10_000)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4)
    .map(({ row, delta }) => {
      const comment = justificationText(row, ytd);
      const prefix = `${row.level2 || row.classification}: ${fmtRDec(delta / 1_000_000)} vs orçado`;
      return comment ? `${prefix}. ${comment}` : `${prefix}.`;
    });
  const physical = (name: string) => params.physicalRows.find((row) => normalize(row.indicator) === normalize(name));
  const base = physical('Base EOP');
  const net = physical('Net Adds');
  const gross = physical('Gross Adds');
  const churn = physical('Churn');
  const churnPct = base?.real ? ((churn?.real || 0) / base.real) * 100 : 0;
  const churnBudgetPct = base?.budget ? ((churn?.budget || 0) / base.budget) * 100 : 0;
  const k = (value?: number) => `${((value || 0) / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  const topRows = [...params.financialRows]
    .sort((a, b) => Math.abs((b.realCurrent - b.budgetCurrent)) - Math.abs((a.realCurrent - a.budgetCurrent)))
    .slice(0, 6)
    .map((row) => {
      const delta = (row.realCurrent - row.budgetCurrent) / 1_000_000;
      const comment = justificationText(row);
      return `${row.level2 || row.classification}: ${fmtRDec(delta)} vs orçado${comment ? `. ${comment}` : '.'}`;
    });
  const blankRevenue = [`Receita líquida e ARPU permanecem sem abertura validada nesta versão; os campos numéricos foram mantidos em branco conforme orientação de FP&A.`];
  return {
    executiveSummary: `A NIO fechou ${monthLower} (${fullLabel}) com EBITDA de ${fmtRDec(ebitda.mReal)} (orçado ${fmtRDec(ebitda.mOrc)}, Δ ${fmtRDec(ebitda.mDelta)}). A Receita Líquida realizou ${fmtRDec(rev.mReal)} ante ${fmtRDec(rev.mOrc)} orçados (Δ ${fmtRDec(rev.mDelta)}) e os Custos e Despesas somaram ${fmtRDec(opex.mReal)} vs ${fmtRDec(opex.mOrc)} orçados (Δ ${fmtRDec(opex.mDelta)}). No acumulado (YTD), a Receita Líquida atingiu ${fmtRDec(rev.yReal)} (Δ ${fmtRDec(rev.yDelta)}) e o EBITDA acumula ${fmtRDec(ebitda.yReal)} contra ${fmtRDec(ebitda.yOrc)} orçados (Δ ${fmtRDec(ebitda.yDelta)}).`,
    keyMessages: topRows,
    monthReading: `Em ${monthName}, o EBITDA apresentou desvio de ${fmtRDec(ebitda.mDelta)} frente ao orçamento. As principais pontes foram Receita ${fmtRDec(rev.mDelta)}, custos relacionados à receita ${fmtRDec(relRev.mDelta)}, custo de servir ${fmtRDec(serve.mDelta)}, custos administrativos ${fmtRDec(admin.mDelta)}, CAC ${fmtRDec(cac.mDelta)} e custos com pessoal ${fmtRDec(hr.mDelta)}.`,
    ytdReading: `No acumulado de janeiro a ${monthLower}, o EBITDA totalizou ${fmtRDec(ebitda.yReal)}, ante ${fmtRDec(ebitda.yOrc)} orçados, com desvio de ${fmtRDec(ebitda.yDelta)}. A leitura YTD considera exclusivamente os valores acumulados até a competência selecionada e as justificativas registradas para o período.`,
    kpisAnalysis: {
      baseAndNetAdds: `A Base EOP encerrou ${monthLower} em ${k(base?.real)}, ante ${k(base?.budget)} orçados. O Net Adds foi de ${k(net?.real)}, frente a ${k(net?.budget)} no orçamento. A comparação mensal correta é ${previousMonthName} versus ${monthName}.`,
      grossAddsAndSales: `Os Gross Adds somaram ${k(gross?.real)} em ${monthLower}, comparados a ${k(gross?.budget)} no orçamento.`,
      churn: `O churn mensal foi de ${churnPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% da Base EOP, ante ${churnBudgetPct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% orçados.`,
      organicVision: `A leitura operacional utiliza CP = ANCHOR e origem FTTH na base física oficial, respeitando a competência ${params.period}.`,
    },
    revenueAnalysis: { netRevenueBullets: blankRevenue, arpuBullets: blankRevenue },
    costsAnalysis: {
      relRevenueBullets: [...bulletsForN1('1.Custos Relacionados a Receita', false), ...bulletsForN1('1.Custos Relacionados a Receita', true).map((b) => `YTD: ${b}`)].slice(0, 6),
      costToServeBullets: [...bulletsForN1('2.Custos de Servir', false), ...bulletsForN1('2.Custos de Servir', true).map((b) => `YTD: ${b}`)].slice(0, 6),
      adminBullets: [...bulletsForN1('3.Custos Administrativos', false), ...bulletsForN1('3.Custos Administrativos', true).map((b) => `YTD: ${b}`)].slice(0, 6),
      cacBullets: [...bulletsForN1('4.Custo de Aquisição do Cliente', false), ...bulletsForN1('4.Custo de Aquisição do Cliente', true).map((b) => `YTD: ${b}`)].slice(0, 6),
      oneOffsBullets: [...bulletsForN1('6.Custos RH', false), ...bulletsForN1('6.Custos RH', true).map((b) => `YTD: ${b}`)].slice(0, 6),
    },
    cacUnitaryAnalysis: { unitaryIntro: '', channelReading: '', commissionsAndDeferral: '' },
  };
}

/**
 * Consulta a IA do Gemini para gerar/enriquecer as análises executivas da NIO
 */
export async function generateNioNarrativeWithGemini(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): Promise<NioExecutiveNarrative> {
  const dynamicBase = buildDynamicNioNarrative(params);

  try {
    const summarizedJustifications = summarizeJustificationsForPrompt(
      params.financialRows,
      params.justifications
    );
    const samplePhysical = params.physicalRows.map((r) => ({
      indicador: r.indicator,
      real: r.real,
      orcado: r.budget,
      desvio: r.real - r.budget,
    }));

    const prompt = `
IMPORTANTE: NÃO execute consultas SQL no BigQuery nem utilize ferramentas externas. Todos os dados já estão consolidados abaixo. Responda IMEDIATAMENTE apenas com o objeto JSON válido.

Você é o Diretor Executivo de FP&A do Grupo V.tal e da NIO Fibra.
Sua missão é redigir o "Documento de Leitura Executiva - Reunião de Performance de Resultados" da NIO Fibra para a competência ${params.period}.
O documento oficial segue rigorosamente a estrutura, o tom executivo direto e os tópicos do modelo da NIO.

DADOS REAIS DO BIGQUERY E JUSTIFICATIVAS DO GCP PARA A COMPETÊNCIA ${params.period} (em R$ milhões):
- Linhas financeiras e justificativas: ${JSON.stringify(summarizedJustifications)}
- Indicadores físicos (Base EOP, Net Adds, Gross Adds, Churn): ${JSON.stringify(samplePhysical)}
- Síntese base calculada para ${params.period}: ${JSON.stringify(dynamicBase)}

Gere uma resposta em JSON estritamente válido mantendo o mesmo nível de profundidade numérica, concisão executiva e estrutura de campos da síntese base, utilizando EXCLUSIVAMENTE os números reais da competência ${params.period}.
Regras obrigatórias:
1. A comparação mensal deve ser sempre entre o mês imediatamente anterior e a competência ${params.period}; não reutilize julho/agosto de modelos antigos.
2. Use as justificativas do mês selecionado para a leitura mensal e os comentários YTD para o acumulado de janeiro até a competência.
3. Organize custos pelos campos NIO_N1 e NIO_N2 informados. Não invente linhas, valores, causas ou indicadores.
4. ARPU, Receita Líquida detalhada e CAC unitário devem permanecer sem explicações numéricas quando a síntese base os marcar como não validados.
5. Não repita nenhum texto do modelo de agosto que não esteja sustentado pelos dados enviados.
Responda EXCLUSIVAMENTE o objeto JSON.
`;

    const parsed = await callGeminiExecutiveJson<NioExecutiveNarrative>(prompt, `NIO-${params.period}`);
    if (parsed && parsed.executiveSummary && parsed.keyMessages?.length) {
      return {
        ...dynamicBase,
        ...parsed,
        kpisAnalysis: { ...dynamicBase.kpisAnalysis, ...parsed.kpisAnalysis },
        // Receita detalhada e ARPU ainda não possuem regra validada; não permitir que a IA complete lacunas.
        revenueAnalysis: dynamicBase.revenueAnalysis,
        costsAnalysis: { ...dynamicBase.costsAnalysis, ...parsed.costsAnalysis },
        // CAC unitário permanece deliberadamente em branco até a fonte oficial ser validada.
        cacUnitaryAnalysis: dynamicBase.cacUnitaryAnalysis,
      };
    }
  } catch {
    console.log('[Gemini Narrative NIO] Usando síntese executiva consolidada do período.');
  }

  return dynamicBase;
}

/**
 * Consulta a IA do Gemini para gerar/enriquecer as análises executivas da V.tal (modelo HOLDING · V.tal)
 */
export async function generateVtalNarrativeWithGemini(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): Promise<VtalExecutiveNarrative> {
  const dynamicBase = buildDynamicVtalNarrative(params);

  try {
    const summarizedJustifications = summarizeJustificationsForPrompt(
      params.financialRows,
      params.justifications
    );
    const samplePhysical = params.physicalRows.map((r) => ({
      indicador: r.indicator,
      real: r.real,
      orcado: r.budget,
      desvio: r.real - r.budget,
    }));

    const prompt = `
IMPORTANTE: NÃO execute consultas SQL no BigQuery nem utilize ferramentas externas. Todos os dados já estão consolidados abaixo. Responda IMEDIATAMENTE apenas com o objeto JSON válido.

Você é o Diretor Executivo de FP&A da Holding V.tal.
Sua missão é redigir os textos analíticos do documento executivo "HOLDING · V.tal — Performance de Resultados" para a competência ${params.period}, seguindo rigorosamente o modelo executivo oficial da V.tal.

SÍNTESE EXECUTIVA DE REFERÊNCIA (MODELO OFICIAL CALIBRADO COM OS NÚMEROS DE ${params.period}):
${JSON.stringify(dynamicBase)}

JUSTIFICATIVAS COMPLEMENTARES DOS ANALISTAS NO PERÍODO:
${JSON.stringify(summarizedJustifications)}

INDICADORES FÍSICOS:
${JSON.stringify(samplePhysical)}

Regras obrigatórias:
1. Use SEMPRE os números reais da competência ${params.period} presentes na Síntese Executiva de Referência acima.
2. NUNCA acumule todas as justificativas mensais (mai/jun/jul/ago) nem concatene comentários brutos entre colchetes.
3. Leia e interprete as justificativas dos analistas e consolide apenas o que for mais valioso em formato de resumo executivo curto e direto, usando como referência principal a descrição executiva já existente na Síntese Executiva de Referência (especialmente em "Resultado Acumulado (YTD) — BAU" e "Detalhamento da Receita (YTD)").
4. Retorne EXCLUSIVAMENTE um JSON válido com as chaves:
{
  "highlights": ["4 bullets executivos de Destaques da página 1"],
  "ytdBauBullets": ["Bullet 1 executivo conciso de Receita Líquida...", "Bullet 2 executivo conciso de OPEX..."],
  "revenueDetailBullets": ["Bullet 1: Anchor...", "Bullet 2: Other Tenants...", "Bullet 3: Wholesale...", "Bullet 4: Other Revenue..."],
  "newBusinessBullets": ["Bullet 1: B2B...", "Bullet 2: Um Telecom...", "Bullet 3: Mobile Solutions..."],
  "projectsFootnote": "Nota de rodapé ¹ sobre Copper...",
  "projectsBullets": ["Bullet 1: IPv4...", "Bullet 2: Venda de Prédios..."]
}
`;

    const parsed = await callGeminiExecutiveJson<VtalExecutiveNarrative>(prompt, `Vtal-${params.period}`);
    if (parsed && parsed.highlights?.length && parsed.ytdBauBullets?.length) {
      return {
        highlights: pickExecutiveBullets(parsed.highlights, dynamicBase.highlights),
        ytdBauBullets: pickExecutiveBullets(parsed.ytdBauBullets, dynamicBase.ytdBauBullets),
        revenueDetailBullets: pickExecutiveBullets(parsed.revenueDetailBullets, dynamicBase.revenueDetailBullets),
        newBusinessBullets: pickExecutiveBullets(parsed.newBusinessBullets, dynamicBase.newBusinessBullets),
        projectsFootnote:
          parsed.projectsFootnote && isCleanExecutiveBullet(parsed.projectsFootnote)
            ? parsed.projectsFootnote
            : dynamicBase.projectsFootnote,
        projectsBullets: pickExecutiveBullets(parsed.projectsBullets, dynamicBase.projectsBullets),
      };
    }
  } catch {
    console.log('[Gemini Narrative V.tal] Usando síntese executiva consolidada do período.');
  }

  return dynamicBase;
}

/**
 * Consulta a IA do Gemini para gerar/enriquecer as análises executivas da Tecto (modelo HOLDING · Tecto)
 */
export async function generateTectoNarrativeWithGemini(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): Promise<TectoExecutiveNarrative> {
  const dynamicBase = buildDynamicTectoNarrative(params);

  try {
    const summarizedJustifications = summarizeJustificationsForPrompt(
      params.financialRows,
      params.justifications
    );
    const samplePhysical = params.physicalRows.map((r) => ({
      indicador: r.indicator,
      real: r.real,
      orcado: r.budget,
      desvio: r.real - r.budget,
    }));

    const prompt = `
IMPORTANTE: NÃO execute consultas SQL no BigQuery nem utilize ferramentas externas. Todos os dados já estão consolidados abaixo. Responda IMEDIATAMENTE apenas com o objeto JSON válido.

Você é o Diretor Executivo de FP&A da Holding V.tal / Tecto Data Centers.
Sua missão é redigir os textos analíticos do documento executivo "HOLDING · Tecto — Performance de Resultados" para a competência ${params.period}, seguindo exatamente o padrão executivo conciso do relatório da Holding.

SÍNTESE EXECUTIVA DE REFERÊNCIA (MODELO OFICIAL CALIBRADO COM OS NÚMEROS DE ${params.period}):
${JSON.stringify(dynamicBase)}

JUSTIFICATIVAS COMPLEMENTARES DOS ANALISTAS NO PERÍODO:
${JSON.stringify(summarizedJustifications)}

INDICADORES FÍSICOS DATA CENTERS:
${JSON.stringify(samplePhysical)}

Regras obrigatórias:
1. Use SEMPRE os números reais da competência ${params.period} presentes na Síntese Executiva de Referência acima.
2. NUNCA acumule todas as justificativas mensais nem concatene comentários brutos entre colchetes. Mantenha o resumo executivo conciso conforme o modelo de referência.
3. Retorne EXCLUSIVAMENTE um JSON válido com as chaves:
{
  "highlights": ["4 bullets executivos de Destaques da Tecto"],
  "ytdBauBullets": ["Bullet 1: Receita Líquida...", "Bullet 2: OPEX..."],
  "opexDetailBullets": ["Bullet 1: Power Costs...", "Bullet 2: Maintenance, Facilities & ZPE...", "Bullet 3: SG&A...", "Bullet 4: Others & PDD..."]
}
`;

    const parsed = await callGeminiExecutiveJson<TectoExecutiveNarrative>(prompt, `Tecto-${params.period}`);
    if (parsed && parsed.highlights?.length && parsed.ytdBauBullets?.length) {
      return {
        highlights: pickExecutiveBullets(parsed.highlights, dynamicBase.highlights),
        ytdBauBullets: pickExecutiveBullets(parsed.ytdBauBullets, dynamicBase.ytdBauBullets),
        opexDetailBullets: pickExecutiveBullets(parsed.opexDetailBullets, dynamicBase.opexDetailBullets),
      };
    }
  } catch {
    console.log('[Gemini Narrative Tecto] Usando síntese executiva consolidada do período.');
  }

  return dynamicBase;
}
