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

function fmtDec1(valMn: number, dashZero = true): string {
  if (Math.abs(valMn) < 0.05) return dashZero ? '-' : '0,0';
  const absStr = Math.abs(valMn).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return valMn < 0 ? `(${absStr})` : absStr;
}

export function buildNioDynamicPageData(params: {
  period: string;
  financialRows?: Array<{
    classification: string;
    level1?: string;
    level2?: string;
    level3: string;
    realCurrent: number;
    budgetCurrent: number;
    realYtd: number;
    budgetYtd: number;
  }>;
  physicalRows?: Array<{
    indicator: string;
    real: number;
    budget: number;
    realPrevious?: number;
    budgetPrevious?: number;
    realYtd?: number;
    budgetYtd?: number;
  }>;
}): NioPageData {
  const { financialRows = [], physicalRows = [] } = params;
  if (financialRows.length === 0) return NIO_AGO26_DATA;

  const norm = (value: unknown) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();

  const sumBy = (pred: (r: (typeof financialRows)[number]) => boolean) => {
    let mR = 0, mO = 0, yR = 0, yO = 0;
    for (const r of financialRows) {
      if (pred(r)) {
        mR += r.realCurrent / 1_000_000;
        mO += r.budgetCurrent / 1_000_000;
        yR += r.realYtd / 1_000_000;
        yO += r.budgetYtd / 1_000_000;
      }
    }
    return { mR, mO, mD: mR - mO, yR, yO, yD: yR - yO };
  };

  const byN1 = (expected: string) => (r: (typeof financialRows)[number]) => norm(r.level3) === norm(expected);
  const rev = sumBy(byN1('Receita'));
  // Custos são negativos no banco; na leitura executiva aparecem como despesa positiva.
  const relRevRaw = sumBy(byN1('1.Custos Relacionados a Receita'));
  const serveRaw = sumBy(byN1('2.Custos de Servir'));
  const admRaw = sumBy(byN1('3.Custos Administrativos'));
  const cacRaw = sumBy(byN1('4.Custo de Aquisição do Cliente'));
  const hrRaw = sumBy(byN1('6.Custos RH'));
  const oneOffRaw = { mR: 0, mO: 0, mD: 0, yR: 0, yO: 0, yD: 0 };

  const inv = (p: { mR: number; mO: number; yR: number; yO: number }) => ({
    mR: -p.mR,
    mO: -p.mO,
    mD: -p.mR - -p.mO,
    yR: -p.yR,
    yO: -p.yO,
    yD: -p.yR - -p.yO,
  });

  const cRel = inv(relRevRaw);
  const cServe = inv(serveRaw);
  const cAdm = inv(admRaw);
  const cCac = inv(cacRaw);
  const cOneOff = inv(oneOffRaw);
  const cHr = inv(hrRaw);

  const mDir = {
    mR: rev.mR - cRel.mR,
    mO: rev.mO - cRel.mO,
    mD: rev.mR - cRel.mR - (rev.mO - cRel.mO),
    yR: rev.yR - cRel.yR,
    yO: rev.yO - cRel.yO,
    yD: rev.yR - cRel.yR - (rev.yO - cRel.yO),
  };
  const mOp = {
    mR: mDir.mR - cServe.mR,
    mO: mDir.mO - cServe.mO,
    mD: mDir.mR - cServe.mR - (mDir.mO - cServe.mO),
    yR: mDir.yR - cServe.yR,
    yO: mDir.yO - cServe.yO,
    yD: mDir.yR - cServe.yR - (mDir.yO - cServe.yO),
  };
  const allRows = sumBy(() => true);
  const mMarginR = Math.abs(rev.mR) > 0.1 ? (allRows.mR / rev.mR) * 100 : 0;
  const mMarginO = Math.abs(rev.mO) > 0.1 ? (allRows.mO / rev.mO) * 100 : 0;
  const yMarginR = Math.abs(rev.yR) > 0.1 ? (allRows.yR / rev.yR) * 100 : 0;
  const yMarginO = Math.abs(rev.yO) > 0.1 ? (allRows.yO / rev.yO) * 100 : 0;

  const mkPl = (label: string, p: { mR: number; mO: number; mD: number; yR: number; yO: number; yD: number }, isBold = false, isSubtotal = false) => ({
    label,
    mesReal: fmtDec1(p.mR, false),
    mesOrc: fmtDec1(p.mO, false),
    mesDelta: fmtDec1(p.mD, false),
    ytdReal: fmtDec1(p.yR, false),
    ytdOrc: fmtDec1(p.yO, false),
    ytdDelta: fmtDec1(p.yD, false),
    isBold,
    isSubtotal,
  });

  const getPhysical = (name: string) => physicalRows.find((row) => norm(row.indicator) === norm(name));
  const base = getPhysical('Base EOP');
  const netAdds = getPhysical('Net Adds');
  const gross = getPhysical('Gross Adds');
  const churn = getPhysical('Churn');
  const fmtThousands = (value?: number) => value === undefined ? '-' : (value / 1_000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const fmtIntegerThousands = (value?: number) => value === undefined ? '-' : Math.round(value / 1_000).toLocaleString('pt-BR');
  const fmtDeltaK = (real?: number, budget?: number) => real === undefined || budget === undefined ? '-' : `${real - budget >= 0 ? '+' : ''}${fmtThousands(real - budget)}`;
  const churnRealPct = base?.real ? ((churn?.real || 0) / base.real) * 100 : 0;
  const churnBudgetPct = base?.budget ? ((churn?.budget || 0) / base.budget) * 100 : 0;
  const churnRealYtdPct = base?.realYtd ? ((churn?.realYtd || 0) / base.realYtd) * 100 : 0;
  const churnBudgetYtdPct = base?.budgetYtd ? ((churn?.budgetYtd || 0) / base.budgetYtd) * 100 : 0;
  const pct = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  type CostRow = NioPageData['costs51'][number];
  const groupedByN2 = (n1: string): CostRow[] => {
    const grouped = new Map<string, { mR: number; mO: number; yR: number; yO: number }>();
    for (const row of financialRows.filter(byN1(n1))) {
      const label = String(row.level2 || 'Não classificado').trim();
      const acc = grouped.get(label) || { mR: 0, mO: 0, yR: 0, yO: 0 };
      acc.mR += -row.realCurrent / 1_000_000;
      acc.mO += -row.budgetCurrent / 1_000_000;
      acc.yR += -row.realYtd / 1_000_000;
      acc.yO += -row.budgetYtd / 1_000_000;
      grouped.set(label, acc);
    }
    const detail: CostRow[] = Array.from(grouped.entries())
      .filter(([, v]) => Math.max(Math.abs(v.mR), Math.abs(v.mO), Math.abs(v.yR), Math.abs(v.yO)) >= 0.05)
      .sort((a, b) => Math.abs(b[1].mR - b[1].mO) - Math.abs(a[1].mR - a[1].mO))
      .map(([linha, v]) => ({
        linha,
        mesReal: fmtDec1(v.mR), mesOrc: fmtDec1(v.mO), mesDelta: fmtDec1(v.mR - v.mO),
        ytdReal: fmtDec1(v.yR), ytdOrc: fmtDec1(v.yO), ytdDelta: fmtDec1(v.yR - v.yO),
      }));
    const total = groupedByN1Total(n1);
    detail.push({
      linha: 'Total', mesReal: fmtDec1(total.mR), mesOrc: fmtDec1(total.mO), mesDelta: fmtDec1(total.mD),
      ytdReal: fmtDec1(total.yR), ytdOrc: fmtDec1(total.yO), ytdDelta: fmtDec1(total.yD), isTotal: true,
    });
    return detail;
  };
  const groupedByN1Total = (n1: string) => inv(sumBy(byN1(n1)));

  const pickN2 = (label: string, aliases: string[] = [label]): NioPageData['costs55'][number] => {
    const candidates = financialRows.filter((row) => aliases.some((alias) => norm(row.level2).includes(norm(alias))));
    const raw = { mR: 0, mO: 0, yR: 0, yO: 0 };
    for (const row of candidates) {
      raw.mR += -row.realCurrent / 1_000_000; raw.mO += -row.budgetCurrent / 1_000_000;
      raw.yR += -row.realYtd / 1_000_000; raw.yO += -row.budgetYtd / 1_000_000;
    }
    return { linha: label, mesReal: fmtDec1(raw.mR), mesOrc: fmtDec1(raw.mO), mesDelta: fmtDec1(raw.mR - raw.mO), ytdReal: fmtDec1(raw.yR), ytdOrc: fmtDec1(raw.yO), ytdDelta: fmtDec1(raw.yR - raw.yO) };
  };

  const costs55 = [
    pickN2('Buffer Tahto'),
    pickN2('Contrato desvantajoso (Tahto)', ['Contrato desvantajoso', 'Desvantajoso Tahto']),
    pickN2('Benefício Alagoas', ['Benefício Alagoas', 'Alagoas Benefício']),
    pickN2('Denúncia espontânea (ICMS)', ['Denúncia espontânea', 'Denuncia espontanea']),
    pickN2('Oi Service TSA / ELEA', ['Oi Service TSA', 'ELEA']),
    pickN2('Pessoal'),
  ];
  costs55[costs55.length - 1].linha = 'Custos com pessoal';
  costs55[costs55.length - 1].isBold = true;

  return {
    ...NIO_AGO26_DATA,
    summaryKpis: [
      {
        indicador: 'Base EOP (mil)', real: fmtIntegerThousands(base?.real), orcado: fmtIntegerThousands(base?.budget),
        delta: fmtDeltaK(base?.real, base?.budget), referencia: base?.realPrevious === undefined ? '-' : `${fmtDeltaK(base.real, base.realPrevious)} vs mês anterior`,
        isNegative: (base?.real || 0) < (base?.budget || 0),
      },
      {
        indicador: 'Net Adds (mil)', real: fmtThousands(netAdds?.real), orcado: fmtThousands(netAdds?.budget),
        delta: fmtDeltaK(netAdds?.real, netAdds?.budget), referencia: `YTD ${fmtThousands(netAdds?.realYtd)} vs ${fmtThousands(netAdds?.budgetYtd)}`,
        isNegative: (netAdds?.real || 0) < (netAdds?.budget || 0),
      },
      {
        indicador: 'Gross Adds (mil)', real: fmtThousands(gross?.real), orcado: fmtThousands(gross?.budget),
        delta: fmtDeltaK(gross?.real, gross?.budget), referencia: `YTD ${fmtThousands(gross?.realYtd)} vs ${fmtThousands(gross?.budgetYtd)}`,
        isNegative: (gross?.real || 0) < (gross?.budget || 0),
      },
      {
        indicador: 'Churn (% a.m.)', real: pct(churnRealPct), orcado: pct(churnBudgetPct),
        delta: `${(churnRealPct - churnBudgetPct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}pp`,
        referencia: `YTD ${pct(churnRealYtdPct)} vs ${pct(churnBudgetYtdPct)}`,
        isNegative: churnRealPct > churnBudgetPct,
      },
      { indicador: 'ARPU (R$)', real: '-', orcado: '-', delta: '-', referencia: '-' },
      {
        indicador: 'Receita líquida',
        real: '-', orcado: '-', delta: '-', referencia: '-',
      },
      {
        indicador: 'EBITDA',
        real: fmtDec1(allRows.mR, false),
        orcado: fmtDec1(allRows.mO, false),
        delta: `${fmtDec1(allRows.mD, false)}`,
        referencia: `YTD ${fmtDec1(allRows.yR, false)} vs ${fmtDec1(allRows.yO, false)} orçado`,
        isNegative: allRows.mD < 0,
      },
    ],
    plRows: [
      mkPl('Receita líquida', rev, true, false),
      mkPl('(-) Custos relacionados à receita', cRel),
      mkPl('Margem direta', mDir, true, true),
      mkPl('(-) Custo de servir', cServe),
      mkPl('Margem operacional', mOp, true, true),
      mkPl('(-) Custos administrativos', cAdm),
      mkPl('(-) Custo de aquisição (CAC)', cCac),
      mkPl('(-) One-offs', cOneOff),
      mkPl('(-) Custos com pessoal', cHr),
      mkPl('EBITDA', allRows, true, true),
      {
        label: 'Margem EBITDA',
        mesReal: `${mMarginR.toFixed(1).replace('.', ',')}%`,
        mesOrc: `${mMarginO.toFixed(1).replace('.', ',')}%`,
        mesDelta: `${(mMarginR - mMarginO).toFixed(1).replace('.', ',')}pp`,
        ytdReal: `${yMarginR.toFixed(1).replace('.', ',')}%`,
        ytdOrc: `${yMarginO.toFixed(1).replace('.', ',')}%`,
        ytdDelta: `${(yMarginR - yMarginO).toFixed(1).replace('.', ',')}pp`,
        isBold: true,
      },
    ],
    kpisTable: [
      { kpi: 'Base EOP (mil)', realAgo: fmtIntegerThousands(base?.real), orcado: fmtIntegerThousands(base?.budget), deltaOrc: fmtDeltaK(base?.real, base?.budget), forecast: '-', deltaFcst: '-', ytdReal: '-', ytdOrc: '-' },
      { kpi: 'Net Adds (mil)', realAgo: fmtThousands(netAdds?.real), orcado: fmtThousands(netAdds?.budget), deltaOrc: fmtDeltaK(netAdds?.real, netAdds?.budget), forecast: '-', deltaFcst: '-', ytdReal: fmtThousands(netAdds?.realYtd), ytdOrc: fmtThousands(netAdds?.budgetYtd) },
      { kpi: 'Gross Adds (mil)', realAgo: fmtThousands(gross?.real), orcado: fmtThousands(gross?.budget), deltaOrc: fmtDeltaK(gross?.real, gross?.budget), forecast: '-', deltaFcst: '-', ytdReal: fmtThousands(gross?.realYtd), ytdOrc: fmtThousands(gross?.budgetYtd) },
      { kpi: 'Churn (% a.m.)', realAgo: pct(churnRealPct), orcado: pct(churnBudgetPct), deltaOrc: `${(churnRealPct - churnBudgetPct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}pp`, forecast: '-', deltaFcst: '-', ytdReal: pct(churnRealYtdPct), ytdOrc: pct(churnBudgetYtdPct) },
    ],
    revenueTable: [
      { indicador: 'Net Revenue (R$ Mn)', jul: '-', ago: '-', orcado: '-', deltaOrc: '-', ago25: '-', ytd: '-', deltaYtd: '-' },
      { indicador: 'Base EOP (mil)', jul: fmtIntegerThousands(base?.realPrevious), ago: fmtIntegerThousands(base?.real), orcado: fmtIntegerThousands(base?.budget), deltaOrc: base?.budget ? `${(((base.real || 0) / base.budget - 1) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '-', ago25: '-', ytd: '-', deltaYtd: '-' },
      { indicador: 'Base média (mil)', jul: '-', ago: '-', orcado: '-', deltaOrc: '-', ago25: '-', ytd: '-', deltaYtd: '-' },
      { indicador: 'ARPU total (R$)', jul: '-', ago: '-', orcado: '-', deltaOrc: '-', ago25: '-', ytd: '-', deltaYtd: '-' },
    ],
    costs51: groupedByN2('1.Custos Relacionados a Receita'),
    costs52: groupedByN2('2.Custos de Servir'),
    costs53: groupedByN2('3.Custos Administrativos'),
    costs54: groupedByN2('4.Custo de Aquisição do Cliente'),
    channelCommissions: NIO_AGO26_DATA.channelCommissions.map((row) => ({ ...row, mix: '-', jul: '-', ago: '-', orc: '-', delta: '-' })),
    costs55,
  };
}
