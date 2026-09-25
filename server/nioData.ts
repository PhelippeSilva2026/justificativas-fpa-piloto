export interface NioPageData {
  summaryKpis: Array<{
    indicador: string;
    real: string;
    orcado: string;
    delta: string;
    referencia: string;
    isNegative?: boolean;
  }>;
  plRows: Array<{
    label: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isBold?: boolean;
    isSubtotal?: boolean;
  }>;
  kpisTable: Array<{
    kpi: string;
    realAgo: string;
    orcado: string;
    deltaOrc: string;
    forecast: string;
    deltaFcst: string;
    ytdReal: string;
    ytdOrc: string;
  }>;
  revenueTable: Array<{
    indicador: string;
    jul: string;
    ago: string;
    orcado: string;
    deltaOrc: string;
    ago25: string;
    ytd: string;
    deltaYtd: string;
  }>;
  costs51: Array<{
    linha: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isTotal?: boolean;
  }>;
  costs52: Array<{
    linha: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isTotal?: boolean;
  }>;
  costs53: Array<{
    linha: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isTotal?: boolean;
  }>;
  costs54: Array<{
    linha: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isTotal?: boolean;
  }>;
  channelCommissions: Array<{
    canal: string;
    mix: string;
    jul: string;
    ago: string;
    orc: string;
    delta: string;
  }>;
  costs55: Array<{
    linha: string;
    mesReal: string;
    mesOrc: string;
    mesDelta: string;
    ytdReal: string;
    ytdOrc: string;
    ytdDelta: string;
    isBold?: boolean;
  }>;
}

export const NIO_AGO26_DATA: NioPageData = {
  summaryKpis: [
    { indicador: 'Base EOP (mil)', real: '3.312', orcado: '3.430', delta: '-117 (-3,4%)', referencia: '-6 vs forecast', isNegative: true },
    { indicador: 'Net Adds (mil)', real: '20,6', orcado: '46,4', delta: '-25,9', referencia: '-4 vs forecast · 5º mês positivo', isNegative: true },
    { indicador: 'Gross Adds (mil)', real: '113,5', orcado: '123,8', delta: '-10,3 (-8,3%)', referencia: '+9 vs forecast · YTD -13%', isNegative: true },
    { indicador: 'Churn (% a.m.)', real: '2,79%', orcado: '2,29%', delta: '+0,51pp', referencia: 'YTD 2,73% vs 2,66%', isNegative: true },
    { indicador: 'ARPU (R$)', real: '87,56', orcado: '92,91', delta: '-5,36 (-5,8%)', referencia: '+0,99 vs julho', isNegative: true },
    { indicador: 'Receita líquida', real: '289,1', orcado: '316,5', delta: '-27,4 (-8,7%)', referencia: 'YTD 2.301,8 (-4,2%)', isNegative: true },
    { indicador: 'EBITDA', real: '(17,9)', orcado: '(4,7)', delta: '-13,2', referencia: 'YTD 0,1 vs 6,0 orçado', isNegative: true },
  ],
  plRows: [
    { label: 'Receita líquida', mesReal: '289,1', mesOrc: '316,5', mesDelta: '(27,4)', ytdReal: '2.301,8', ytdOrc: '2.402,4', ytdDelta: '(100,6)', isBold: true },
    { label: '(-) Custos relacionados à receita', mesReal: '159,8', mesOrc: '163,2', mesDelta: '(3,4)', ytdReal: '1.214,7', ytdOrc: '1.254,4', ytdDelta: '(39,7)' },
    { label: 'Margem direta', mesReal: '129,3', mesOrc: '153,4', mesDelta: '(24,0)', ytdReal: '1.087,1', ytdOrc: '1.148,0', ytdDelta: '(60,9)', isSubtotal: true, isBold: true },
    { label: '(-) Custo de servir', mesReal: '24,5', mesOrc: '21,5', mesDelta: '2,9', ytdReal: '222,4', ytdOrc: '184,4', ytdDelta: '38,0' },
    { label: 'Margem operacional', mesReal: '104,9', mesOrc: '131,8', mesDelta: '(26,9)', ytdReal: '864,7', ytdOrc: '963,6', ytdDelta: '(98,9)', isSubtotal: true, isBold: true },
    { label: '(-) Custos administrativos', mesReal: '13,8', mesOrc: '13,2', mesDelta: '0,6', ytdReal: '157,7', ytdOrc: '121,6', ytdDelta: '36,1' },
    { label: '(-) Custo de aquisição (CAC)', mesReal: '92,6', mesOrc: '108,3', mesDelta: '(15,7)', ytdReal: '621,9', ytdOrc: '702,6', ytdDelta: '(80,7)' },
    { label: '(-) One-offs', mesReal: '(1,5)', mesOrc: '(3,3)', mesDelta: '1,8', ytdReal: '(46,8)', ytdOrc: '(12,0)', ytdDelta: '(34,8)' },
    { label: '(-) Custos com pessoal', mesReal: '17,9', mesOrc: '18,4', mesDelta: '(0,5)', ytdReal: '131,9', ytdOrc: '145,5', ytdDelta: '(13,7)' },
    { label: 'EBITDA', mesReal: '(17,9)', mesOrc: '(4,7)', mesDelta: '(13,2)', ytdReal: '0,1', ytdOrc: '6,0', ytdDelta: '(5,9)', isSubtotal: true, isBold: true },
    { label: 'Margem EBITDA', mesReal: '-6,2%', mesOrc: '-1,5%', mesDelta: '-4,7pp', ytdReal: '0,0%', ytdOrc: '0,2%', ytdDelta: '-0,2pp', isBold: true },
  ],
  kpisTable: [
    { kpi: 'Base EOP (mil)', realAgo: '3.312', orcado: '3.430', deltaOrc: '-117', forecast: '3.318', deltaFcst: '-6', ytdReal: '-', ytdOrc: '-' },
    { kpi: 'Net Adds (mil)', realAgo: '20,6', orcado: '46,4', deltaOrc: '-25,9', forecast: '24,9', deltaFcst: '-4,3', ytdReal: '-25,2', ytdOrc: '92,3' },
    { kpi: 'Gross Adds (mil)', realAgo: '113,5', orcado: '123,8', deltaOrc: '-10,3', forecast: '104,1', deltaFcst: '+9,4', ytdReal: '696,4', ytdOrc: '798,8' },
    { kpi: 'Churn (% a.m.)', realAgo: '2,79%', orcado: '2,29%', deltaOrc: '+0,51pp', forecast: '2,41%', deltaFcst: '+0,39pp', ytdReal: '2,73%', ytdOrc: '2,66%' },
    { kpi: 'Net Adds orgânico (mil)', realAgo: '+5', orcado: '46,4', deltaOrc: '-42', forecast: '24,9', deltaFcst: '-20', ytdReal: '-', ytdOrc: '-' },
    { kpi: 'Gross Adds orgânico (mil)', realAgo: '90,8', orcado: '123,8', deltaOrc: '-33,0', forecast: '104,1', deltaFcst: '-13,3', ytdReal: '630', ytdOrc: '799' },
  ],
  revenueTable: [
    { indicador: 'Net Revenue (R$ Mn)', jul: '284,3', ago: '289,1', orcado: '316,5', deltaOrc: '-8,7%', ago25: '319,5', ytd: '2.301,8', deltaYtd: '-4,2%' },
    { indicador: 'Base EOP (mil)', jul: '3.292', ago: '3.312', orcado: '3.430', deltaOrc: '-3,4%', ago25: '3.591', ytd: '-', deltaYtd: '-' },
    { indicador: 'Base média (mil)', jul: '3.284', ago: '3.302', orcado: '3.407', deltaOrc: '-3,1%', ago25: '3.623', ytd: '-', deltaYtd: '-' },
    { indicador: 'ARPU total (R$)', jul: '86,57', ago: '87,56', orcado: '92,91', deltaOrc: '-5,8%', ago25: '88,20', ytd: '87,69', deltaYtd: '-2,9%' },
  ],
  costs51: [
    { linha: 'Operação FTTH (V.tal)', mesReal: '141,0', mesOrc: '139,2', mesDelta: '1,8', ytdReal: '1.049,5', ytdOrc: '1.061,4', ytdDelta: '(11,9)' },
    { linha: 'Operação VoIP (V.tal)', mesReal: '5,3', mesOrc: '5,1', mesDelta: '0,1', ytdReal: '45,6', ytdOrc: '44,6', ytdDelta: '1,0' },
    { linha: 'Operação rede', mesReal: '(0,6)', mesOrc: '-', mesDelta: '(0,6)', ytdReal: '(5,6)', ytdOrc: '-', ytdDelta: '(5,6)' },
    { linha: 'Aquisição de conteúdo (SVA/OTT)', mesReal: '3,4', mesOrc: '7,3', mesDelta: '(3,9)', ytdReal: '30,7', ytdOrc: '48,6', ytdDelta: '(17,9)' },
    { linha: 'PDD', mesReal: '12,3', mesOrc: '12,5', mesDelta: '(0,1)', ytdReal: '105,1', ytdOrc: '106,9', ytdDelta: '(1,8)' },
    { linha: 'Interconexão', mesReal: '-', mesOrc: '-', mesDelta: '-', ytdReal: '0,5', ytdOrc: '-', ytdDelta: '0,5' },
    { linha: 'Taxa Anatel', mesReal: '1,5', mesOrc: '1,8', mesDelta: '(0,3)', ytdReal: '11,8', ytdOrc: '13,4', ytdDelta: '(1,6)' },
    { linha: 'Crédito PIS/COFINS', mesReal: '(3,0)', mesOrc: '(2,7)', mesDelta: '(0,3)', ytdReal: '(23,0)', ytdOrc: '(20,5)', ytdDelta: '(2,5)' },
    { linha: 'Total', mesReal: '159,8', mesOrc: '163,2', mesDelta: '(3,4)', ytdReal: '1.214,7', ytdOrc: '1.254,4', ytdDelta: '(39,7)', isTotal: true },
  ],
  costs52: [
    { linha: 'Atendimento', mesReal: '16,7', mesOrc: '13,2', mesDelta: '3,5', ytdReal: '168,5', ytdOrc: '114,6', ytdDelta: '53,9' },
    { linha: 'Faturamento e arrecadação', mesReal: '1,8', mesOrc: '2,2', mesDelta: '(0,4)', ytdReal: '20,6', ytdOrc: '20,7', ytdDelta: '-' },
    { linha: 'Crédito PIS/COFINS', mesReal: '(0,5)', mesOrc: '-', mesDelta: '(0,5)', ytdReal: '(4,5)', ytdOrc: '-', ytdDelta: '(4,5)' },
    { linha: 'Crédito, cobrança e fraude', mesReal: '4,6', mesOrc: '4,4', mesDelta: '0,2', ytdReal: '35,5', ytdOrc: '34,7', ytdDelta: '0,8' },
    { linha: 'Mensageria', mesReal: '3,5', mesOrc: '3,9', mesDelta: '(0,4)', ytdReal: '15,7', ytdOrc: '31,2', ytdDelta: '(15,5)' },
    { linha: 'Mínimo Tahto', mesReal: '-', mesOrc: '-', mesDelta: '-', ytdReal: '1,1', ytdOrc: '-', ytdDelta: '1,1' },
    { linha: 'Multas', mesReal: '(1,6)', mesOrc: '(2,2)', mesDelta: '0,6', ytdReal: '(14,5)', ytdOrc: '(16,8)', ytdDelta: '2,4' },
    { linha: 'Total', mesReal: '24,5', mesOrc: '21,5', mesDelta: '2,9', ytdReal: '222,4', ytdOrc: '184,4', ytdDelta: '38,0', isTotal: true },
  ],
  costs53: [
    { linha: 'Comunicação corporativa', mesReal: '0,1', mesOrc: '-', mesDelta: '0,1', ytdReal: '0,8', ytdOrc: '-', ytdDelta: '0,8' },
    { linha: 'Contingências', mesReal: '2,4', mesOrc: '0,1', mesDelta: '2,3', ytdReal: '20,7', ytdOrc: '7,5', ytdDelta: '13,3' },
    { linha: 'Despesas gerais', mesReal: '0,7', mesOrc: '1,0', mesDelta: '(0,3)', ytdReal: '5,8', ytdOrc: '7,8', ytdDelta: '(2,0)' },
    { linha: 'Jurídico', mesReal: '0,8', mesOrc: '3,4', mesDelta: '(2,6)', ytdReal: '28,6', ytdOrc: '31,0', ytdDelta: '(2,4)' },
    { linha: 'Serviços especializados', mesReal: '1,4', mesOrc: '0,2', mesDelta: '1,2', ytdReal: '17,8', ytdOrc: '7,1', ytdDelta: '10,7' },
    { linha: 'Tecnologia', mesReal: '8,3', mesOrc: '8,4', mesDelta: '(0,1)', ytdReal: '83,9', ytdOrc: '68,2', ytdDelta: '15,6' },
    { linha: 'Total', mesReal: '13,8', mesOrc: '13,2', mesDelta: '0,6', ytdReal: '157,7', ytdOrc: '121,6', ytdDelta: '36,1', isTotal: true },
  ],
  costs54: [
    { linha: 'Brand building', mesReal: '1,2', mesOrc: '3,0', mesDelta: '(1,9)', ytdReal: '20,2', ytdOrc: '16,0', ytdDelta: '4,1' },
    { linha: 'Comunicação e marca', mesReal: '1,2', mesOrc: '1,8', mesDelta: '(0,6)', ytdReal: '18,8', ytdOrc: '27,0', ytdDelta: '(8,2)' },
    { linha: 'Crédito PIS/COFINS', mesReal: '(2,4)', mesOrc: '(1,2)', mesDelta: '(1,1)', ytdReal: '(14,4)', ytdOrc: '(7,9)', ytdDelta: '(6,5)' },
    { linha: 'Mídia digital', mesReal: '25,6', mesOrc: '25,2', mesDelta: '0,4', ytdReal: '167,9', ytdOrc: '156,6', ytdDelta: '11,3' },
    { linha: 'Taxa de conexão', mesReal: '49,6', mesOrc: '65,9', mesDelta: '(16,3)', ytdReal: '340,5', ytdOrc: '425,1', ytdDelta: '(84,6)' },
    { linha: 'Vendas (comissões)', mesReal: '17,4', mesOrc: '13,7', mesDelta: '3,8', ytdReal: '88,9', ytdOrc: '85,7', ytdDelta: '3,2' },
    { linha: 'Total', mesReal: '92,6', mesOrc: '108,3', mesDelta: '(15,7)', ytdReal: '621,9', ytdOrc: '702,6', ytdDelta: '(80,7)', isTotal: true },
  ],
  channelCommissions: [
    { canal: 'PAP', mix: '48% | 31%', jul: '530', ago: '540', orc: '566', delta: '-26' },
    { canal: 'PAP EPS', mix: '2% | 2%', jul: '732', ago: '775', orc: '781', delta: '-6' },
    { canal: 'Dealer digital', mix: '8% | 8%', jul: '531', ago: '560', orc: '340', delta: '+220' },
    { canal: 'Inbound (mídia + comissão)', mix: '6% | 7%', jul: '818', ago: '892', orc: '577', delta: '+315' },
    { canal: 'Teleagentes', mix: '4% | 11%', jul: '525', ago: '551', orc: '484', delta: '+67' },
    { canal: 'Não assistido (mídia)', mix: '21% | 33%', jul: '646', ago: '731', orc: '474', delta: '+257' },
    { canal: 'Assistido (mídia + comissão)', mix: '10% | 3%', jul: '822', ago: '887', orc: '576', delta: '+311' },
  ],
  costs55: [
    { linha: 'Buffer Tahto', mesReal: '-', mesOrc: '-', mesDelta: '-', ytdReal: '10,1', ytdOrc: '14,6', ytdDelta: '(4,5)' },
    { linha: 'Contrato desvantajoso (Tahto)', mesReal: '(1,5)', mesOrc: '-', mesDelta: '(1,5)', ytdReal: '(16,2)', ytdOrc: '-', ytdDelta: '(16,2)' },
    { linha: 'Benefício Alagoas', mesReal: '-', mesOrc: '(3,3)', mesDelta: '3,3', ytdReal: '-', ytdOrc: '(26,7)', ytdDelta: '26,7' },
    { linha: 'Denúncia espontânea (ICMS)', mesReal: '-', mesOrc: '-', mesDelta: '-', ytdReal: '(66,9)', ytdOrc: '-', ytdDelta: '(66,9)' },
    { linha: 'Oi Service TSA / ELEA', mesReal: '-', mesOrc: '-', mesDelta: '-', ytdReal: '26,1', ytdOrc: '-', ytdDelta: '26,1' },
    { linha: 'One-offs', mesReal: '(1,5)', mesOrc: '(3,3)', mesDelta: '1,8', ytdReal: '(46,8)', ytdOrc: '(12,0)', ytdDelta: '(34,8)', isBold: true },
    { linha: 'Custos com pessoal', mesReal: '17,9', mesOrc: '18,4', mesDelta: '(0,5)', ytdReal: '131,9', ytdOrc: '145,5', ytdDelta: '(13,7)', isBold: true },
  ],
};
