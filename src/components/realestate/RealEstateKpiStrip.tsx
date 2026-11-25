import React from 'react';
import { RealEstateSummary } from '../../types/realEstate';
import { formatBrl, formatBrlCompact, formatInt } from './realEstateFormatters';

interface RealEstateKpiStripProps {
  summary: RealEstateSummary | null;
  tipoLabel: string;
  isLoading: boolean;
}

export const RealEstateKpiStrip: React.FC<RealEstateKpiStripProps> = ({
  summary,
  tipoLabel,
  isLoading,
}) => {
  if (isLoading && !summary) {
    return (
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-[#D5DCD2] p-5 h-[132px] animate-pulse flex flex-col justify-between"
          >
            <div className="h-3 w-28 bg-[#E6EBE4] rounded" />
            <div className="h-7 w-40 bg-[#E6EBE4] rounded" />
            <div className="h-3 w-48 bg-[#F3F6F3] rounded" />
          </div>
        ))}
      </section>
    );
  }

  const s = summary || {
    totalRows: 0,
    netTotal: 0,
    grossCost: 0,
    grossCredit: 0,
    distinctContracts: 0,
    distinctStations: 0,
    distinctUfs: 0,
    distinctCountries: 0,
    distinctCostCenters: 0,
    distinctSuppliers: 0,
    rowsWithContract: 0,
    rowsWithStation: 0,
    rowsWithRegisteredUf: 0,
    valueWithContract: 0,
  };

  const contractRowPct = s.totalRows > 0 ? Math.round((s.rowsWithContract / s.totalRows) * 100) : 0;
  const stationRowPct = s.totalRows > 0 ? Math.round((s.rowsWithStation / s.totalRows) * 100) : 0;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl border border-[#D5DCD2] p-5 flex flex-col justify-between shadow-2xs">
        <div className="text-xs font-bold text-[#52605A]">
          Resultado Líquido · {tipoLabel}
        </div>
        <div className="mt-2">
          <div
            className={`text-2xl font-black tracking-tight tabular-nums ${
              s.netTotal > 0 ? 'text-emerald-700' : 'text-[#1E3A32]'
            }`}
          >
            {formatBrlCompact(s.netTotal)}
          </div>
          <div className="text-[11px] font-medium text-[#68756E] tabular-nums mt-0.5">
            Exato: {formatBrl(s.netTotal)}
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A] tabular-nums">
          <span>Lançamentos filtrados</span>
          <span className="font-bold text-[#1E3A32]">{formatInt(s.totalRows)} linhas</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D5DCD2] p-5 flex flex-col justify-between shadow-2xs">
        <div className="text-xs font-bold text-[#52605A]">
          Custos OPEX vs. Receitas / Créditos
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#52605A]">Custos / Despesas</span>
            <span className="text-base font-extrabold text-rose-700 tabular-nums">
              {formatBrlCompact(s.grossCost)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#52605A]">Receitas / Venda / Estornos</span>
            <span className="text-base font-extrabold text-emerald-700 tabular-nums">
              +{formatBrlCompact(s.grossCredit)}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A] tabular-nums">
          <span>Centros de Custo</span>
          <span className="font-bold text-[#1E3A32]">{formatInt(s.distinctCostCenters)} ativos</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D5DCD2] p-5 flex flex-col justify-between shadow-2xs">
        <div className="text-xs font-bold text-[#52605A]">
          Contratos RE (CONTRATO_RE)
        </div>
        <div className="mt-2">
          <div className="text-2xl font-black text-[#1E3A32] tracking-tight tabular-nums">
            {formatInt(s.distinctContracts)}
          </div>
          <div className="text-[11px] font-medium text-[#68756E] tabular-nums mt-0.5">
            {contractRowPct}% dos lançamentos vinculados a contrato
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A] tabular-nums">
          <span>Líquido com contrato</span>
          <span className="font-bold text-[#1E3A32]">{formatBrlCompact(s.valueWithContract)}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#D5DCD2] p-5 flex flex-col justify-between shadow-2xs">
        <div className="text-xs font-bold text-[#52605A]">
          Estações, UFs &amp; Países
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl font-black text-[#1E3A32] tracking-tight tabular-nums">
              {formatInt(s.distinctStations)}
            </span>
            <span className="text-xs font-semibold text-[#52605A]">
              estações · {formatInt(s.distinctUfs)} UFs · {formatInt(s.distinctCountries)} países
            </span>
          </div>
          <div className="text-[11px] font-medium text-[#68756E] tabular-nums mt-0.5">
            {stationRowPct}% das linhas com sigla de estação
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-[#E6EBE4] flex items-center justify-between text-[11px] text-[#52605A] tabular-nums">
          <span>Fornecedores / Locadores</span>
          <span className="font-bold text-[#1E3A32]">{formatInt(s.distinctSuppliers)}</span>
        </div>
      </div>
    </section>
  );
};
