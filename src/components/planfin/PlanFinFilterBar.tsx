import React, { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { PlanFinFilterOptions, PlanFinFilterState } from '../../types/planFin';

interface PlanFinFilterBarProps {
  filters: PlanFinFilterState;
  options: PlanFinFilterOptions | null;
  onChange: (patch: Partial<PlanFinFilterState>) => void;
  onReset: () => void;
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

function formatMonthOption(anomes: string, hasFullActual: boolean): string {
  const parts = anomes.split('/');
  const year = parts[0] || '2026';
  const m = Number(parts[1]);
  if (Number.isFinite(m) && m >= 1 && m <= 12) {
    const name = MONTH_FULL_NAMES_PT[m - 1];
    return hasFullActual ? `${name}/${year}` : `${name}/${year} (Em aberto)`;
  }
  return anomes;
}

export const PlanFinFilterBar: React.FC<PlanFinFilterBarProps> = ({
  filters,
  options,
  onChange,
  onReset,
}) => {
  const filteredSubPacotes = useMemo(() => {
    const allSubs = options?.subPacotes || [];
    if (filters.pacote === 'ALL') return allSubs;
    return allSubs.filter((s) => s.pacote === filters.pacote);
  }, [options, filters.pacote]);

  const defaultAnomes = options?.defaultAnomes || '2026/10';
  const hasActiveFilter =
    filters.anomes !== defaultAnomes ||
    filters.pacote !== 'ALL' ||
    filters.subPacote !== 'ALL';

  const handlePacoteChange = (nextPacote: string) => {
    if (nextPacote === 'ALL') {
      onChange({ pacote: 'ALL', subPacote: 'ALL' });
      return;
    }
    const subStillValid = (options?.subPacotes || []).some(
      (s) => s.pacote === nextPacote && s.value === filters.subPacote
    );
    onChange({
      pacote: nextPacote,
      subPacote: subStillValid ? filters.subPacote : 'ALL',
    });
  };

  return (
    <section className="bg-white border border-[#D5DCD2] shadow-xs rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#1E3A32]">
          <Filter className="w-3.5 h-3.5 text-[#315F52]" />
          <span>Filtros Executivos OPEX · V.tal</span>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1E3A32] bg-[#FAFBF9] hover:bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-[#315F52]" />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div>
          <label
            htmlFor="planfin-filter-mes"
            className="block text-[11px] font-bold text-[#52605A] mb-1"
          >
            Mês (Competência 2026)
          </label>
          <select
            id="planfin-filter-mes"
            value={filters.anomes}
            onChange={(e) => onChange({ anomes: e.target.value })}
            className="w-full h-9 px-3 rounded-xl border border-[#D5DCD2] bg-[#FAFBF9] text-xs font-semibold text-[#1E3A32] focus:outline-none focus:ring-2 focus:ring-[#315F52]/30 focus:border-[#315F52]"
          >
            {(options?.months || []).map((m) => (
              <option key={m.value} value={m.value}>
                {formatMonthOption(m.value, m.hasFullActual)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="planfin-filter-pacote"
            className="block text-[11px] font-bold text-[#52605A] mb-1"
          >
            Pacote (Nível 3)
          </label>
          <select
            id="planfin-filter-pacote"
            value={filters.pacote}
            onChange={(e) => handlePacoteChange(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-[#D5DCD2] bg-[#FAFBF9] text-xs font-semibold text-[#1E3A32] focus:outline-none focus:ring-2 focus:ring-[#315F52]/30 focus:border-[#315F52]"
          >
            <option value="ALL">Todos os Pacotes ({options?.pacotes.length || 0})</option>
            {(options?.pacotes || []).map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="planfin-filter-subpacote"
            className="block text-[11px] font-bold text-[#52605A] mb-1"
          >
            Sub Pacote (Nível 4)
          </label>
          <select
            id="planfin-filter-subpacote"
            value={filters.subPacote}
            onChange={(e) => onChange({ subPacote: e.target.value })}
            className="w-full h-9 px-3 rounded-xl border border-[#D5DCD2] bg-[#FAFBF9] text-xs font-semibold text-[#1E3A32] focus:outline-none focus:ring-2 focus:ring-[#315F52]/30 focus:border-[#315F52]"
          >
            <option value="ALL">Todos os Sub Pacotes ({filteredSubPacotes.length})</option>
            {filteredSubPacotes.map((s) => (
              <option key={`${s.pacote}::${s.value}`} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};
