import React from 'react';
import { PlanFinSummary } from '../../types/planFin';

interface PlanFinKpiStripProps {
  summary: PlanFinSummary;
  refMonth: number;
  scenarioMode: 'actual' | 'fct102' | 'fct84';
}

const MONTH_FULL_NAMES_PT = [
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

function formatMm(val: number): string {
  const safe = Number.isFinite(val) ? val / 1_000_000 : 0;
  return `R$ ${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)} MM`;
}

function formatSignedMm(val: number): string {
  const safe = Number.isFinite(val) ? val / 1_000_000 : 0;
  const prefix = safe > 0 ? '+' : '';
  return `${prefix}R$ ${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)} MM`;
}

function calcVarPct(actual: number, budget: number): number | null {
  if (!Number.isFinite(budget) || Math.abs(budget) < 1) return null;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

export const PlanFinKpiStrip: React.FC<PlanFinKpiStripProps> = ({
  summary,
  refMonth,
  scenarioMode,
}) => {
  const monthIdx = Math.max(0, Math.min(11, refMonth - 1));
  const monthName = MONTH_FULL_NAMES_PT[monthIdx] || 'Outubro';

  const compareLabel =
    scenarioMode === 'fct102'
      ? 'Fcst 10+2'
      : scenarioMode === 'fct84'
        ? 'Fcst 8+4'
        : 'Realizado';

  const monthVal =
    scenarioMode === 'fct102'
      ? summary.fct102Month
      : scenarioMode === 'fct84'
        ? summary.fct84Month
        : summary.actMonth;

  const ytdVal =
    scenarioMode === 'fct102'
      ? summary.fct102Ytd
      : scenarioMode === 'fct84'
        ? summary.fct84Ytd
        : summary.actYtd;

  const monthDiff = monthVal - summary.bgtMonth;
  const monthPct = calcVarPct(monthVal, summary.bgtMonth);
  const ytdDiff = ytdVal - summary.bgtYtd;
  const ytdPct = calcVarPct(ytdVal, summary.bgtYtd);

  const fyProj = scenarioMode === 'fct84' ? summary.fct84Fy : summary.fct102Fy;
  const fyProjLabel = scenarioMode === 'fct84' ? 'Fcst 8+4 FY' : 'Fcst 10+2 FY';
  const fyDiff = fyProj - summary.bgtFy;
  const fyPct = calcVarPct(fyProj, summary.bgtFy);

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      {/* Card 1: Mês Selecionado */}
      <div className="bg-white border border-[#D5DCD2] rounded-xl px-4 py-2.5 flex flex-col justify-between gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#52605A]">
            OPEX {monthName} · {compareLabel}
          </span>
          <span className="text-base font-semibold text-[#1E3A32] tabular-nums tracking-tight">
            {formatMm(monthVal)}
          </span>
        </div>
        <div className="pt-1.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] gap-2">
          <span className="text-[#52605A] tabular-nums">
            Orç: <span className="font-semibold text-[#1E3A32]">{formatMm(summary.bgtMonth)}</span>
          </span>
          <span
            className={`font-semibold tabular-nums ${
              monthDiff <= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedMm(monthDiff)}
            {monthPct !== null ? ` (${monthPct > 0 ? '+' : ''}${monthPct.toFixed(1)}%)` : ''}
          </span>
        </div>
      </div>

      {/* Card 2: Acumulado YTD */}
      <div className="bg-white border border-[#D5DCD2] rounded-xl px-4 py-2.5 flex flex-col justify-between gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#52605A]">
            Acumulado YTD (Jan–{monthName.slice(0, 3)})
          </span>
          <span className="text-base font-semibold text-[#1E3A32] tabular-nums tracking-tight">
            {formatMm(ytdVal)}
          </span>
        </div>
        <div className="pt-1.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] gap-2">
          <span className="text-[#52605A] tabular-nums">
            Orç YTD: <span className="font-semibold text-[#1E3A32]">{formatMm(summary.bgtYtd)}</span>
          </span>
          <span
            className={`font-semibold tabular-nums ${
              ytdDiff <= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedMm(ytdDiff)}
            {ytdPct !== null ? ` (${ytdPct > 0 ? '+' : ''}${ytdPct.toFixed(1)}%)` : ''}
          </span>
        </div>
      </div>

      {/* Card 3: Projeção Anual FY vs Budget FY */}
      <div className="bg-white border border-[#D5DCD2] rounded-xl px-4 py-2.5 flex flex-col justify-between gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#52605A]">
            Visão Anual 2026 · {fyProjLabel}
          </span>
          <span className="text-base font-semibold text-[#1E3A32] tabular-nums tracking-tight">
            {formatMm(fyProj)}
          </span>
        </div>
        <div className="pt-1.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] gap-2">
          <span className="text-[#52605A] tabular-nums">
            BGT FY: <span className="font-semibold text-[#1E3A32]">{formatMm(summary.bgtFy)}</span>
          </span>
          <span
            className={`font-semibold tabular-nums ${
              fyDiff <= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {formatSignedMm(fyDiff)}
            {fyPct !== null ? ` (${fyPct > 0 ? '+' : ''}${fyPct.toFixed(1)}%)` : ''}
          </span>
        </div>
      </div>
    </section>
  );
};
