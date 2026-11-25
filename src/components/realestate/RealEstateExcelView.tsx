import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  SlidersHorizontal,
  Table2,
} from 'lucide-react';
import {
  RealEstateAnaliseChartSummary,
  RealEstateAnaliseRow,
  RealEstateExcelModelData,
  RealEstatePlRow,
} from '../../types/realEstate';
import { formatAnomesLabel, formatExcelNumber } from './realEstateFormatters';

interface RealEstateExcelViewProps {
  data: RealEstateExcelModelData | null;
  isLoading: boolean;
  error: string | null;
  actCutoffMonth: number;
  includeOverheadCc: boolean;
  onChangeCutoffMonth: (m: number) => void;
  onChangeIncludeOverheadCc: (include: boolean) => void;
  onRetry: () => void;
  onExportModelExcel: (excelSign: boolean) => void;
  isExporting: boolean;
}

type ExcelSubTab = 'analise' | 'base_pl';
type PlBlockFocus = 'all' | 'bgt' | 'fct' | 'act_fct' | 'totals';

const CUTOFF_OPTIONS = [
  { value: 8, label: 'Ago/26 (8m ACT + 4m FCT)' },
  { value: 9, label: 'Set/26 (9m ACT + 3m FCT)' },
  { value: 10, label: 'Out/26 (10m ACT + M+2 FCT)' },
  { value: 11, label: 'Nov/26 (11m ACT + 1m FCT)' },
];

const GROUP_CHILDREN: Record<string, string[]> = {
  net_revenue: ['rev_locacoes', 'rev_venda_predios', 'rev_outras'],
  rentals: [
    'rentals_adm',
    'rentals_tec',
    'rentals_ifrs16',
    'rentals_iptu',
    'rentals_comodato',
    'rentals_demais',
  ],
  facilities: ['fac_manutencao', 'fac_limpeza', 'fac_comodato'],
  utilities: ['util_agua', 'util_comodato'],
  overhead: ['ovh_consultoria', 'ovh_bpo', 'ovh_others'],
};

const StackedSummaryChart: React.FC<{
  title: string;
  summary: RealEstateAnaliseChartSummary;
  unit: 'mi' | 'full';
  excelSign: boolean;
  cutoffMonth: number;
}> = ({ title, summary, unit, excelSign, cutoffMonth }) => {
  const fmt = (v: number, dec: 1 | 2 = 2) =>
    formatExcelNumber(v, { unit, decimals: dec, excelSign });

  const bgtActAbs = Math.abs(summary.bgtActPeriod);
  const bgtFctAbs = Math.abs(summary.bgtFctPeriod);
  const bgtTotAbs = Math.max(0.01, bgtActAbs + bgtFctAbs);

  const realActAbs = Math.abs(summary.realActPeriod);
  const realFctAbs = Math.abs(summary.realFctPeriod);
  const realTotAbs = Math.max(0.01, realActAbs + realFctAbs);

  const maxStack = Math.max(1, bgtTotAbs, realTotAbs);
  const svgH = 148;
  const maxBarH = 116;

  const bgtActH = Math.round((bgtActAbs / maxStack) * maxBarH);
  const bgtFctH = Math.round((bgtFctAbs / maxStack) * maxBarH);
  const realActH = Math.round((realActAbs / maxStack) * maxBarH);
  const realFctH = Math.round((realFctAbs / maxStack) * maxBarH);

  const bgtTotalSigned = excelSign ? -summary.bgtTotal : summary.bgtTotal;
  const realTotalSigned = excelSign ? -summary.realTotal : summary.realTotal;
  const deltaPct =
    bgtTotalSigned !== 0
      ? ((realTotalSigned - bgtTotalSigned) / Math.abs(bgtTotalSigned)) * 100
      : 0;

  return (
    <div className="bg-white rounded-2xl border border-[#D5DCD2] p-4 shadow-2xs flex flex-col justify-between">
      <div>
        <div className="text-xs font-extrabold text-[#1E3A32] mb-2">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-[#E6EBE4] text-[#52605A] font-bold">
                <th className="py-1.5 text-left">Cenário</th>
                <th className="py-1.5 text-right">ACT (1–{cutoffMonth})</th>
                <th className="py-1.5 text-right">FCT ({cutoffMonth + 1}–12)</th>
                <th className="py-1.5 text-right">Total</th>
                <th className="py-1.5 text-right">Δ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4] tabular-nums">
              <tr>
                <td className="py-1.5 font-bold text-[#52605A]">RE Bgt</td>
                <td className="py-1.5 text-right font-semibold text-[#1E3A32]">
                  {fmt(summary.bgtActPeriod, 2)}
                </td>
                <td className="py-1.5 text-right font-semibold text-[#1E3A32]">
                  {fmt(summary.bgtFctPeriod, 2)}
                </td>
                <td className="py-1.5 text-right font-extrabold text-[#1E3A32]">
                  {fmt(summary.bgtTotal, 2)}
                </td>
                <td className="py-1.5 text-right text-[#68756E]">—</td>
              </tr>
              <tr>
                <td className="py-1.5 font-bold text-[#315F52]">RE Act + Fct</td>
                <td className="py-1.5 text-right font-semibold text-[#1E3A32]">
                  {fmt(summary.realActPeriod, 2)}
                </td>
                <td className="py-1.5 text-right font-semibold text-[#1E3A32]">
                  {fmt(summary.realFctPeriod, 2)}
                </td>
                <td className="py-1.5 text-right font-extrabold text-[#1E3A32]">
                  {fmt(summary.realTotal, 2)}
                </td>
                <td
                  className={`py-1.5 text-right font-extrabold ${
                    deltaPct <= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {deltaPct > 0 ? '+' : ''}
                  {deltaPct.toFixed(1).replace('.', ',')}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico de Barras Empilhadas em SVG (mesmo conceito da aba Análise) */}
      <div className="mt-4 pt-3 border-t border-[#E6EBE4] flex flex-col items-center">
        <svg width="240" height={svgH} viewBox={`0 0 240 ${svgH}`} aria-label={title}>
          <line x1="20" y1={svgH - 22} x2="220" y2={svgH - 22} stroke="#D5DCD2" strokeWidth="1" />

          {/* Coluna 1: RE Bgt */}
          <rect
            x="48"
            y={svgH - 22 - bgtActH}
            width="46"
            height={Math.max(2, bgtActH)}
            fill="#CBD5CE"
            rx="2"
          />
          {bgtFctH > 0 && (
            <rect
              x="48"
              y={svgH - 22 - bgtActH - bgtFctH}
              width="46"
              height={bgtFctH}
              fill="#94A3B8"
              rx="2"
            />
          )}
          <text x="71" y={svgH - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#52605A">
            RE Bgt
          </text>

          {/* Coluna 2: RE Act + Fct */}
          <rect
            x="146"
            y={svgH - 22 - realActH}
            width="46"
            height={Math.max(2, realActH)}
            fill="#315F52"
            rx="2"
          />
          {realFctH > 0 && (
            <rect
              x="146"
              y={svgH - 22 - realActH - realFctH}
              width="46"
              height={realFctH}
              fill="#4F927F"
              rx="2"
            />
          )}
          <text x="169" y={svgH - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#1E3A32">
            RE Act + Fct
          </text>
        </svg>

        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] font-semibold text-[#52605A] mt-1">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#315F52]" /> ACT Realizado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#4F927F]" /> FCT (M+2)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#CBD5CE]" /> Budget Base
          </span>
        </div>
      </div>
    </div>
  );
};

const AnaliseSummaryTable: React.FC<{
  title: string;
  subtitle: string;
  rows: RealEstateAnaliseRow[];
  unit: 'mi' | 'full';
  excelSign: boolean;
}> = ({ title, subtitle, rows, unit, excelSign }) => {
  const fmt = (v: number) => formatExcelNumber(v, { unit, decimals: 1, excelSign });

  return (
    <div className="bg-white rounded-2xl border border-[#D5DCD2] overflow-hidden shadow-2xs">
      <div className="px-4 py-3 bg-[#315F52] text-white">
        <div className="text-xs sm:text-sm font-extrabold tracking-tight">{title}</div>
        <div className="text-[11px] text-white/80 mt-0.5">{subtitle}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#3D6F61] text-white text-[11px] font-bold">
              <th className="py-2 px-3 text-left">Linha</th>
              <th className="py-2 px-3 text-right">BGT 26</th>
              <th className="py-2 px-3 text-right">ACT + FCT 26</th>
              <th className="py-2 px-3 text-right">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EBE4]">
            {rows.map((r) => {
              const isRoot = r.level === 0;
              const isSection = r.level === 1;
              return (
                <tr
                  key={r.id}
                  className={
                    isRoot
                      ? 'bg-[#EBF2EE] text-[#1E3A32] font-extrabold'
                      : isSection
                        ? 'bg-[#F3F6F3] text-[#1E3A32] font-extrabold'
                        : 'bg-white text-[#52605A] hover:bg-[#FAFBF9]'
                  }
                >
                  <td
                    className={`py-2 px-3 whitespace-nowrap ${
                      r.level === 2 ? 'pl-6 font-medium' : ''
                    }`}
                  >
                    {r.label}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                    {fmt(r.bgt26)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                    {fmt(r.actFct26)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap font-bold">
                    {fmt(r.delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const RealEstateExcelView: React.FC<RealEstateExcelViewProps> = ({
  data,
  isLoading,
  error,
  actCutoffMonth,
  includeOverheadCc,
  onChangeCutoffMonth,
  onChangeIncludeOverheadCc,
  onRetry,
  onExportModelExcel,
  isExporting,
}) => {
  const [subTab, setSubTab] = useState<ExcelSubTab>('analise');
  const [blockFocus, setBlockFocus] = useState<PlBlockFocus>('all');
  const [unit, setUnit] = useState<'mi' | 'full'>('mi');
  const [excelSign, setExcelSign] = useState<boolean>(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const hiddenChildIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const [groupId, isCollapsed] of Object.entries(collapsedGroups)) {
      if (isCollapsed && GROUP_CHILDREN[groupId]) {
        GROUP_CHILDREN[groupId].forEach((cid) => hidden.add(cid));
      }
    }
    return hidden;
  }, [collapsedGroups]);

  const fmtPl = (v: number) => formatExcelNumber(v, { unit, decimals: 1, excelSign });

  const showBgt = blockFocus === 'all' || blockFocus === 'bgt';
  const showFct = blockFocus === 'all' || blockFocus === 'fct';
  const showActFct = blockFocus === 'all' || blockFocus === 'act_fct';
  const showTotals = blockFocus === 'all' || blockFocus === 'totals';

  return (
    <div className="flex flex-col space-y-5">
      {/* Barra de navegação das abas do Excel (Análise | Base P&L) + Controles */}
      <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sub-abas idênticas às do arquivo Excel */}
          <div className="inline-flex rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => setSubTab('analise')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                subTab === 'analise'
                  ? 'bg-[#315F52] text-white shadow-2xs'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Aba 1 · Análise (Resumo)</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('base_pl')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                subTab === 'base_pl'
                  ? 'bg-[#315F52] text-white shadow-2xs'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Aba 2 · Base P&amp;L (BGT · FCT 8+4 · ACT+FCT)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onExportModelExcel(excelSign)}
            disabled={isExporting || isLoading || !data}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-[#315F52] hover:bg-[#274D42] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Exportar Modelo P&amp;L (.xlsx)</span>
          </button>
        </div>

        {/* Controles do modelo P&L */}
        <div className="pt-3 border-t border-[#E6EBE4] flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#52605A]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#315F52]" />
            Parâmetros do Modelo:
          </span>

          <div className="flex items-center gap-1.5">
            <label htmlFor="re-excel-cutoff" className="text-[11px] font-bold text-[#52605A]">
              Corte ACT / FCT (M+2):
            </label>
            <select
              id="re-excel-cutoff"
              value={actCutoffMonth}
              onChange={(e) => onChangeCutoffMonth(Number(e.target.value))}
              className="h-8 rounded-lg border border-[#CCD8C7] bg-[#FAFBF9] px-2.5 text-xs font-semibold text-[#1E3A32] outline-none"
            >
              {CUTOFF_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded-lg bg-[#F3F6F3] p-0.5 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => onChangeIncludeOverheadCc(true)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                includeOverheadCc ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              AREA Real Estate + Overhead/PDD (CC BR01932625)
            </button>
            <button
              type="button"
              onClick={() => onChangeIncludeOverheadCc(false)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                !includeOverheadCc ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              Somente AREA = Real Estate
            </button>
          </div>

          <div className="inline-flex rounded-lg bg-[#F3F6F3] p-0.5 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => setUnit('mi')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                unit === 'mi' ? 'bg-[#315F52] text-white' : 'text-[#52605A]'
              }`}
            >
              R$ Mi
            </button>
            <button
              type="button"
              onClick={() => setUnit('full')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                unit === 'full' ? 'bg-[#315F52] text-white' : 'text-[#52605A]'
              }`}
            >
              R$ Exato
            </button>
          </div>

          <div className="inline-flex rounded-lg bg-[#F3F6F3] p-0.5 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => setExcelSign(true)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                excelSign ? 'bg-[#315F52] text-white' : 'text-[#52605A]'
              }`}
              title="Exibe OPEX positivo e Receita entre parênteses igual ao Excel de Real Estate"
            >
              Padrão Excel (OPEX +)
            </button>
            <button
              type="button"
              onClick={() => setExcelSign(false)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                !excelSign ? 'bg-[#315F52] text-white' : 'text-[#52605A]'
              }`}
              title="Exibe Receita positiva e OPEX negativo conforme DRE contábil do BigQuery"
            >
              Padrão BigQuery (OPEX -)
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-rose-800">{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-[#315F52] text-white font-bold cursor-pointer"
          >
            Recarregar modelo
          </button>
        </div>
      )}

      {isLoading && !data ? (
        <div className="bg-white rounded-2xl border border-[#D5DCD2] p-8 space-y-4 animate-pulse">
          <div className="h-6 w-64 bg-[#E6EBE4] rounded" />
          <div className="h-72 bg-[#F3F6F3] rounded-xl" />
        </div>
      ) : !data ? null : subTab === 'analise' ? (
        /* ================= ABA 1: ANÁLISE (RESUMO) ================= */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-4">
            <AnaliseSummaryTable
              title="Visão P&L (Sem Comodato e Venda de Prédio)"
              subtitle="Comparativo FY 2026 · Valores em R$ Mi (ou R$)"
              rows={data.analise.visaoPl}
              unit={unit}
              excelSign={excelSign}
            />
          </div>

          <div className="xl:col-span-4">
            <AnaliseSummaryTable
              title="Visão Gerencial Real Estate (Sem Estação Técnica e Comodato)"
              subtitle="Exclui estações técnicas, PDD e venda de prédio"
              rows={data.analise.visaoGerencial}
              unit={unit}
              excelSign={excelSign}
            />
          </div>

          <div className="xl:col-span-4 space-y-5">
            <StackedSummaryChart
              title="Visão Gerencial · RE Bgt vs. RE Act + Fct"
              summary={data.analise.chartSummaryGerencial}
              unit={unit}
              excelSign={excelSign}
              cutoffMonth={data.actCutoffMonth}
            />
            <StackedSummaryChart
              title="Visão P&L · RE Bgt vs. RE Act + Fct"
              summary={data.analise.chartSummaryPl}
              unit={unit}
              excelSign={excelSign}
              cutoffMonth={data.actCutoffMonth}
            />
          </div>
        </div>
      ) : (
        /* ================= ABA 2: BASE P&L (MATRIZ MENSAL + TOTALIZADORES) ================= */
        <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E6EBE4]">
            <div>
              <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
                Base P&amp;L · Real Estate 2026 ({unit === 'mi' ? 'R$ Milhões' : 'R$ Completo'})
              </h2>
              <p className="text-xs text-[#52605A] mt-0.5">
                Budget 2026, Forecast 8+4, Realizado + Forecast M+2 (meses após{' '}
                {formatAnomesLabel(data.months[data.actCutoffMonth - 1])} marcados em destaque FCT) e
                comparativos YTD / FY à direita.
              </p>
            </div>

            <div className="inline-flex flex-wrap rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2] gap-1">
              {(
                [
                  { id: 'all', label: 'Todos os Blocos' },
                  { id: 'act_fct', label: 'ACT + FCT (M+2)' },
                  { id: 'bgt', label: 'BGT 26' },
                  { id: 'fct', label: 'FCT 8+4' },
                  { id: 'totals', label: 'Totalizadores YTD / FY' },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBlockFocus(b.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    blockFocus === b.id
                      ? 'bg-[#315F52] text-white'
                      : 'text-[#52605A] hover:text-[#1E3A32]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto border border-[#D5DCD2] rounded-xl">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                {/* Linha 1 do cabeçalho: Grupos (BGT 26 | FCT 8+4 | ACT + FCT | YTD | FY) */}
                <tr className="bg-[#274D42] text-white font-extrabold">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-[#274D42] text-left py-2 px-3 min-w-[230px] border-r border-[#467768]"
                  >
                    Estrutura P&amp;L Real Estate
                  </th>

                  {showBgt && (
                    <th
                      colSpan={13}
                      className="py-1.5 px-2 text-center bg-[#315F52] border-r border-[#467768]"
                    >
                      BGT 26 (Budget 2026)
                    </th>
                  )}
                  {showFct && (
                    <th
                      colSpan={13}
                      className="py-1.5 px-2 text-center bg-[#3D6F61] border-r border-[#558A7B]"
                    >
                      FCT 8+4 (Forecast 8+4)
                    </th>
                  )}
                  {showActFct && (
                    <th
                      colSpan={13}
                      className="py-1.5 px-2 text-center bg-[#1E3A32] border-r border-[#467768]"
                    >
                      ACT + FCT (Realizado 1–{data.actCutoffMonth} + FCT {data.actCutoffMonth + 1}–12)
                    </th>
                  )}
                  {showTotals && (
                    <>
                      <th
                        colSpan={3}
                        className="py-1.5 px-2 text-center bg-[#315F52] border-r border-[#467768]"
                      >
                        YTD (Meses 1–{data.actCutoffMonth})
                      </th>
                      <th colSpan={3} className="py-1.5 px-2 text-center bg-[#274D42]">
                        FY 2026 (Ano Completo)
                      </th>
                    </>
                  )}
                </tr>

                {/* Linha 2 do cabeçalho: Meses individuais e variações */}
                <tr className="bg-[#356658] text-white/95 font-bold text-[10px]">
                  {showBgt && (
                    <>
                      {data.months.map((m) => (
                        <th key={`bgt-h-${m}`} className="py-1.5 px-2 text-right whitespace-nowrap">
                          {formatAnomesLabel(m)}
                        </th>
                      ))}
                      <th className="py-1.5 px-2 text-right bg-[#274D42] border-r border-[#467768] whitespace-nowrap">
                        FY 26
                      </th>
                    </>
                  )}

                  {showFct && (
                    <>
                      {data.months.map((m) => (
                        <th key={`fct-h-${m}`} className="py-1.5 px-2 text-right whitespace-nowrap">
                          {formatAnomesLabel(m)}
                        </th>
                      ))}
                      <th className="py-1.5 px-2 text-right bg-[#315F52] border-r border-[#558A7B] whitespace-nowrap">
                        FY 26
                      </th>
                    </>
                  )}

                  {showActFct && (
                    <>
                      {data.months.map((m, idx) => {
                        const isMPlusFct = idx >= data.actCutoffMonth;
                        return (
                          <th
                            key={`act-h-${m}`}
                            className={`py-1.5 px-2 text-right whitespace-nowrap ${
                              isMPlusFct ? 'bg-rose-800 text-white' : ''
                            }`}
                            title={
                              isMPlusFct
                                ? 'Mês projetado via Fcst 8+4 (M+2)'
                                : 'Mês realizado (ACTUAL 2026)'
                            }
                          >
                            {formatAnomesLabel(m)}
                            {isMPlusFct ? ' (F)' : ''}
                          </th>
                        );
                      })}
                      <th className="py-1.5 px-2 text-right bg-[#1E3A32] border-r border-[#467768] whitespace-nowrap">
                        FY 26
                      </th>
                    </>
                  )}

                  {showTotals && (
                    <>
                      <th className="py-1.5 px-2 text-right whitespace-nowrap">ACT vs ACT25</th>
                      <th className="py-1.5 px-2 text-right whitespace-nowrap">ACT vs BGT</th>
                      <th className="py-1.5 px-2 text-right border-r border-[#467768] whitespace-nowrap">
                        ACT vs FCT
                      </th>
                      <th className="py-1.5 px-2 text-right whitespace-nowrap">FY vs ACT25</th>
                      <th className="py-1.5 px-2 text-right whitespace-nowrap">FY vs BGT</th>
                      <th className="py-1.5 px-2 text-right whitespace-nowrap">FY vs FCT</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E6EBE4]">
                {data.basePl
                  .filter((row: RealEstatePlRow) => !hiddenChildIds.has(row.id))
                  .map((row: RealEstatePlRow) => {
                    const hasChildren = Boolean(GROUP_CHILDREN[row.id]);
                    const isCollapsed = Boolean(collapsedGroups[row.id]);
                    const isDarkTotal = row.isTotal;
                    const isSection = row.isSectionHeader && !row.isTotal;

                    const rowBg = isDarkTotal
                      ? 'bg-[#EBF2EE] text-[#1E3A32] font-extrabold'
                      : isSection
                        ? 'bg-[#F3F6F3] text-[#1E3A32] font-extrabold'
                        : 'bg-white text-[#52605A] hover:bg-[#FAFBF9]';

                    const stickyBg = isDarkTotal
                      ? 'bg-[#EBF2EE] text-[#1E3A32]'
                      : isSection
                        ? 'bg-[#F3F6F3] text-[#1E3A32]'
                        : 'bg-white text-[#1E3A32]';

                    return (
                      <tr key={row.id} className={rowBg}>
                        <td
                          className={`sticky left-0 z-10 py-2 px-3 border-r border-[#D5DCD2] whitespace-nowrap ${stickyBg} ${
                            row.level === 2 ? 'pl-7 font-medium' : ''
                          }`}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleGroup(row.id)}
                              className="inline-flex items-center gap-1.5 cursor-pointer text-left"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="w-3.5 h-3.5 text-[#315F52]" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-[#315F52]" />
                              )}
                              <span>{row.label}</span>
                            </button>
                          ) : (
                            <span>{row.label}</span>
                          )}
                        </td>

                        {showBgt && (
                          <>
                            {row.bgt.map((val, i) => (
                              <td
                                key={`${row.id}-bgt-${i}`}
                                className="py-2 px-2 text-right tabular-nums whitespace-nowrap"
                              >
                                {fmtPl(val)}
                              </td>
                            ))}
                            <td className="py-2 px-2 text-right tabular-nums font-extrabold border-r border-[#D5DCD2] whitespace-nowrap">
                              {fmtPl(row.bgtFy)}
                            </td>
                          </>
                        )}

                        {showFct && (
                          <>
                            {row.fct.map((val, i) => (
                              <td
                                key={`${row.id}-fct-${i}`}
                                className="py-2 px-2 text-right tabular-nums whitespace-nowrap"
                              >
                                {fmtPl(val)}
                              </td>
                            ))}
                            <td className="py-2 px-2 text-right tabular-nums font-extrabold border-r border-[#D5DCD2] whitespace-nowrap">
                              {fmtPl(row.fctFy)}
                            </td>
                          </>
                        )}

                        {showActFct && (
                          <>
                            {row.actFct.map((val, i) => {
                              const isFctMonth = i >= data.actCutoffMonth;
                              return (
                                <td
                                  key={`${row.id}-act-${i}`}
                                  className={`py-2 px-2 text-right tabular-nums whitespace-nowrap ${
                                    isFctMonth ? 'bg-rose-50/70' : ''
                                  }`}
                                >
                                  {fmtPl(val)}
                                </td>
                              );
                            })}
                            <td className="py-2 px-2 text-right tabular-nums font-extrabold border-r border-[#D5DCD2] whitespace-nowrap">
                              {fmtPl(row.actFctFy)}
                            </td>
                          </>
                        )}

                        {showTotals && (
                          <>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {fmtPl(row.ytd.act26VsAct25)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {fmtPl(row.ytd.act26VsBgt26)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums border-r border-[#D5DCD2] whitespace-nowrap">
                              {fmtPl(row.ytd.act26VsFct26)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {fmtPl(row.fy.act26VsAct25)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {fmtPl(row.fy.act26VsBgt26)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                              {fmtPl(row.fy.act26VsFct26)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
