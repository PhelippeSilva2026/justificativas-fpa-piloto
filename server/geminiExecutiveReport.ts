import { GoogleGenAI } from '@google/genai';
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
 * Consulta a IA do Gemini para gerar/enriquecer as análises executivas
 */
export async function generateNioNarrativeWithGemini(params: {
  period: string;
  financialRows: FinancialReportRow[];
  physicalRows: PhysicalReportRow[];
  justifications: Record<string, unknown>;
}): Promise<NioExecutiveNarrative> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[Gemini Narrative] GEMINI_API_KEY não definida, usando conteúdo oficial padrão.');
    return DEFAULT_NIO_NARRATIVE;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Resumo dos dados para injetar no prompt
    const sampleFinancial = params.financialRows.slice(0, 20).map((r) => ({
      classificacao: r.classification,
      area: r.area,
      realMes: r.realCurrent / 1_000_000,
      orcadoMes: r.budgetCurrent / 1_000_000,
      desvioMes: (r.realCurrent - r.budgetCurrent) / 1_000_000,
      realYtd: r.realYtd / 1_000_000,
      orcadoYtd: r.budgetYtd / 1_000_000,
    }));

    const samplePhysical = params.physicalRows.map((r) => ({
      indicador: r.indicator,
      real: r.real,
      orcado: r.budget,
      desvio: r.real - r.budget,
    }));

    const prompt = `
Você é o Diretor Executivo de FP&A do Grupo V.tal e da NIO Fibra.
Sua missão é redigir o "Documento de Leitura Executiva - Reunião de Performance de Resultados" da NIO Fibra para a competência ${params.period}.
O documento oficial segue rigorosamente a estrutura, o tom executivo e os tópicos do modelo da NIO.

DADOS DE REFERÊNCIA DE FP&A:
- Linhas financeiras (amostra em R$ Mn): ${JSON.stringify(sampleFinancial)}
- Indicadores físicos: ${JSON.stringify(samplePhysical)}
- Justificativas extraídas do GCP: ${JSON.stringify(params.justifications).slice(0, 3000)}

Gere uma resposta em JSON estritamente válido contendo todos os campos do modelo:
{
  "executiveSummary": "Parágrafo síntese executivo com EBITDA realizado vs orçado, principais desvios de receita, custos e CAC, além do YTD.",
  "keyMessages": [
    "Bullet 1 sobre Receita e desvio de base/ARPU",
    "Bullet 2 sobre evolução da Base e M&A",
    "Bullet 3 sobre Churn voluntário vs involuntário",
    "Bullet 4 sobre Custo de servir e canais de atendimento",
    "Bullet 5 sobre CAC e efeito volume",
    "Bullet 6 sobre YTD sustentado por créditos não recorrentes"
  ],
  "monthReading": "Parágrafo aprofundado da Leitura do Mês de P&L e EBITDA",
  "ytdReading": "Parágrafo aprofundado da Leitura do YTD com detalhamento de não recorrentes",
  "kpisAnalysis": {
    "baseAndNetAdds": "Texto executivo sobre Base EOP e Net Adds",
    "grossAddsAndSales": "Texto executivo sobre Gross Adds e Venda Bruta",
    "churn": "Texto executivo sobre Churn voluntário, involuntário e safras",
    "organicVision": "Texto executivo sobre a Visão Orgânica (ex-M&A) e canais"
  },
  "revenueAnalysis": {
    "netRevenueBullets": [
      "Vs mês anterior...",
      "Vs orçado..."
    ],
    "arpuBullets": [
      "Vs mês anterior...",
      "Vs orçado...",
      "Mix do gross..."
    ]
  },
  "costsAnalysis": {
    "relRevenueBullets": ["Mês...", "YTD..."],
    "costToServeBullets": ["Mês...", "YTD..."],
    "adminBullets": ["Mês...", "YTD..."],
    "cacBullets": ["Mês...", "YTD..."],
    "oneOffsBullets": ["Mês...", "YTD..."]
  },
  "cacUnitaryAnalysis": {
    "unitaryIntro": "Texto sobre a subida do unitário de vendas ex-M&A por canal",
    "channelReading": "Leitura por canal detalhada",
    "commissionsAndDeferral": "Texto sobre comissões brutas e diferimento"
  }
}
Responda EXCLUSIVAMENTE o objeto JSON.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (text) {
      const parsed = JSON.parse(text) as NioExecutiveNarrative;
      if (parsed.executiveSummary && parsed.keyMessages?.length) {
        console.log('[Gemini Narrative] Análise executiva gerada com sucesso pelo Gemini!');
        return {
          ...DEFAULT_NIO_NARRATIVE,
          ...parsed,
          kpisAnalysis: { ...DEFAULT_NIO_NARRATIVE.kpisAnalysis, ...parsed.kpisAnalysis },
          revenueAnalysis: { ...DEFAULT_NIO_NARRATIVE.revenueAnalysis, ...parsed.revenueAnalysis },
          costsAnalysis: { ...DEFAULT_NIO_NARRATIVE.costsAnalysis, ...parsed.costsAnalysis },
          cacUnitaryAnalysis: { ...DEFAULT_NIO_NARRATIVE.cacUnitaryAnalysis, ...parsed.cacUnitaryAnalysis },
        };
      }
    }
  } catch (error) {
    console.warn('[Gemini Narrative] Erro ao consultar modelo, usando padrão de referência oficial:', error);
  }

  return DEFAULT_NIO_NARRATIVE;
}
