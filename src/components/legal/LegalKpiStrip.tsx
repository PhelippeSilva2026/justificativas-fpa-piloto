import React from 'react';
import { LegalSummary } from '../../types/legal';
import {
  calcConsumptionPct,
  formatBrlCompact,
  formatInt,
  getDisponivelTone,
} from './legalFormatters';

interface LegalKpiStripProps {
  summary: LegalSummary;
  maxActMonth: number;
  compareScope: 'ytd' | 'fy';
}

export const LegalKpiStrip: React.FC<LegalKpiStripProps> = ({
  summary,
  maxActMonth,
  compareScope,
}) => {
  const bgtSelected = compareScope === 'ytd' ? summary.bgtYtd : summary.bgtFy;
  const disponivelSelected =
    compareScope === 'ytd' ? summary.disponivelYtd : summary.disponivelFy;
  const fct84Selected = compareScope === 'ytd' ? summary.fct84Ytd : summary.fct84Total;

  const consumptionPct = calcConsumptionPct(summary.actTotal, bgtSelected);
  const dispTone = getDisponivelTone(disponivelSelected, bgtSelected);
  const barRatio =
    consumptionPct === null ? 0 : Math.min(100, Math.max(0, consumptionPct));

  const poCoveragePct =
    summary.actRows > 0 ? (summary.actRowsWithPo / summary.actRows) * 100 : 0;
  const atribCoveragePct =
    summary.actRows > 0 ? (summary.actRowsWithAtrib / summary.actRows) * 100 : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* KPI 1: Budget 2026 (BGT) */}
      <div className="bg-white border border-[#D5DCD2] rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-[#52605A]">
              Budget 2026 (BGT {compareScope.toUpperCase()})
            </span>
            <span className="text-[11px] font-medium text-[#68756E] tabular-nums">
              {compareScope === 'ytd' ? `Jan–Mês ${maxActMonth}` : 'Jan–Dez'}
            </span>
          </div>
          <div className="text-2xl font-black text-[#1E3A32] tabular-nums tracking-tight mt-1">
            {formatBrlCompact(bgtSelected)}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A]">
          <span>
            {compareScope === 'ytd' ? 'BGT FY 2026:' : 'BGT YTD:'}
          </span>
          <span className="font-bold text-[#1E3A32] tabular-nums">
            {formatBrlCompact(compareScope === 'ytd' ? summary.bgtFy : summary.bgtYtd)}
          </span>
        </div>
      </div>

      {/* KPI 2: Realizado (ACTUAL 2026) */}
      <div className="bg-white border border-[#D5DCD2] rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-[#52605A]">
              Realizado (ACTUAL 2026)
            </span>
            <span className="text-[11px] font-medium text-[#68756E] tabular-nums">
              {formatInt(summary.actRows)} lançamentos
            </span>
          </div>
          <div className="text-2xl font-black text-[#1E3A32] tabular-nums tracking-tight mt-1">
            {formatBrlCompact(summary.actTotal)}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A]">
          <span>Consumo sobre BGT ({compareScope.toUpperCase()}):</span>
          <span className="font-bold text-[#1E3A32] tabular-nums">
            {consumptionPct !== null ? `${consumptionPct.toFixed(1).replace('.', ',')}%` : 'N/A'}
          </span>
        </div>
      </div>

      {/* KPI 3: Disponível (BGT - Realizado) */}
      <div className="bg-white border border-[#D5DCD2] rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-[#52605A]">
              Disponível (BGT − Realizado)
            </span>
            <span className={`text-[11px] font-bold ${dispTone.textClass}`}>
              {dispTone.label}
            </span>
          </div>
          <div className={`text-2xl font-black tabular-nums tracking-tight mt-1 ${dispTone.textClass}`}>
            {formatBrlCompact(disponivelSelected)}
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4]">
          <div className="flex items-center justify-between text-[11px] text-[#52605A] mb-1.5">
            <span>
              {compareScope === 'ytd' ? 'Saldo FY:' : 'Saldo YTD:'}{' '}
              <strong className="text-[#1E3A32] tabular-nums">
                {formatBrlCompact(
                  compareScope === 'ytd' ? summary.disponivelFy : summary.disponivelYtd
                )}
              </strong>
            </span>
            <span className="tabular-nums text-[#68756E]">
              {consumptionPct !== null ? `${consumptionPct.toFixed(0)}% usado` : 'Base mista'}
            </span>
          </div>
          <svg
            viewBox="0 0 200 6"
            className="w-full h-1.5 block rounded-sm overflow-hidden"
            aria-hidden="true"
          >
            <rect x="0" y="0" width="200" height="6" rx="3" fill="#E6EBE4" />
            <rect
              x="0"
              y="0"
              width={Math.max(0, Math.min(200, (barRatio / 100) * 200))}
              height="6"
              rx="3"
              fill={dispTone.barFill}
            />
          </svg>
        </div>
      </div>

      {/* KPI 4: Forecasts & Rastreabilidade Operacional */}
      <div className="bg-white border border-[#D5DCD2] rounded-2xl p-5 flex flex-col justify-between shadow-2xs">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-[#52605A]">
              Forecasts (FCST 8+4 e 4+8)
            </span>
            <span className="text-[11px] font-medium text-[#68756E] tabular-nums">
              {formatInt(summary.distinctCcs)} CCs
            </span>
          </div>
          <div className="text-2xl font-black text-[#1E3A32] tabular-nums tracking-tight mt-1">
            {formatBrlCompact(fct84Selected)}
          </div>
          <div className="text-[11px] text-[#68756E] tabular-nums mt-0.5">
            FCST 8+4 ({compareScope.toUpperCase()}) · 4+8 FY:{' '}
            <span className="text-[#1E3A32] font-semibold">
              {formatBrlCompact(summary.fct48Total)}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A] tabular-nums">
          <span>
            {formatInt(summary.distinctSuppliers)} forn. · {formatInt(summary.distinctPos)} POs
          </span>
          <span className="font-semibold text-[#1E3A32]">
            PO {poCoveragePct.toFixed(0)}% · Atrib {atribCoveragePct.toFixed(0)}%
          </span>
        </div>
      </div>
    </section>
  );
};
