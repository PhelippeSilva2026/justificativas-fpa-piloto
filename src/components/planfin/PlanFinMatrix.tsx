import React, { useEffect, useMemo, useState } from 'react';
import { PlanFinFilterState, PlanFinPacoteRow, PlanFinScenarioMetrics } from '../../types/planFin';

interface PlanFinMatrixProps {
  packages: PlanFinPacoteRow[];
  refMonth: number;
  filters: PlanFinFilterState;
  scenarioMode: 'actual' | 'fct102' | 'fct84';
  onChangeScenarioMode: (mode: 'actual' | 'fct102' | 'fct84') => void;
  onSelectFilter: (patch: Partial<PlanFinFilterState>) => void;
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

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function formatMoney(value: number, unit: 'mm' | 'brl'): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (unit === 'mm') {
    const mm = safe / 1_000_000;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(mm);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(safe);
}

function calcVarPct(compareVal: number, orcVal: number): number | null {
  if (!Number.isFinite(orcVal) || Math.abs(orcVal) < 1) return null;
  return ((compareVal - orcVal) / Math.abs(orcVal)) * 100;
}

function OpexStatusDot({
  compareVal,
  orcVal,
}: {
  compareVal: number;
  orcVal: number;
}) {
  const diff = compareVal - orcVal;
  let fill = '#94A39D';
  let label = 'Sem base';
  if (Math.abs(orcVal) >= 1 || Math.abs(compareVal) >= 1) {
    if (diff <= 0) {
      fill = '#16A34A';
      label = 'Dentro ou abaixo do orçamento';
    } else {
      fill = '#DC2626';
      label = 'Acima do orçamento';
    }
  }
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      className="shrink-0"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <circle
        cx="5.5"
        cy="5.5"
        r="4.5"
        fill={fill}
        stroke="#1E3A32"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
    </svg>
  );
}

function pickScenarioPair(
  m: PlanFinScenarioMetrics,
  mode: 'actual' | 'fct102' | 'fct84'
): { monthVal: number; ytdVal: number } {
  if (mode === 'fct102') return { monthVal: m.fct102Month, ytdVal: m.fct102Ytd };
  if (mode === 'fct84') return { monthVal: m.fct84Month, ytdVal: m.fct84Ytd };
  return { monthVal: m.actMonth, ytdVal: m.actYtd };
}

export const PlanFinMatrix: React.FC<PlanFinMatrixProps> = ({
  packages,
  refMonth,
  filters,
  scenarioMode,
  onChangeScenarioMode,
  onSelectFilter,
}) => {
  const [unit, setUnit] = useState<'mm' | 'brl'>('mm');
  const [expandedPkgKeys, setExpandedPkgKeys] = useState<Record<string, boolean>>({});
  const [expandedSubKeys, setExpandedSubKeys] = useState<Record<string, boolean>>({});

  // Por padrão, abre os pacotes (Nível 3 -> Nível 4) igual à visão executiva do anexo
  useEffect(() => {
    setExpandedPkgKeys((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const initial: Record<string, boolean> = {};
      packages.forEach((p) => {
        initial[p.key] = true;
      });
      return initial;
    });
  }, [packages]);

  const monthIdx = Math.max(0, Math.min(11, refMonth - 1));
  const monthFullUpper = (MONTH_FULL_NAMES_PT[monthIdx] || 'Outubro').toUpperCase();
  const monthShort = MONTH_SHORT_PT[monthIdx] || 'Out';
  const unitSuffix = unit === 'mm' ? 'R$MM' : 'R$';

  const compareShortHeader = scenarioMode === 'actual' ? 'REAL' : 'FCST';

  const totals = useMemo(() => {
    return packages.reduce(
      (acc, p) => {
        const pair = pickScenarioPair(p, scenarioMode);
        return {
          bgtMonth: acc.bgtMonth + p.bgtMonth,
          compareMonth: acc.compareMonth + pair.monthVal,
          bgtYtd: acc.bgtYtd + p.bgtYtd,
          compareYtd: acc.compareYtd + pair.ytdVal,
        };
      },
      { bgtMonth: 0, compareMonth: 0, bgtYtd: 0, compareYtd: 0 }
    );
  }, [packages, scenarioMode]);

  const allPkgsExpanded = useMemo(
    () => packages.length > 0 && packages.every((p) => expandedPkgKeys[p.key]),
    [packages, expandedPkgKeys]
  );

  const handleExpandPackagesOnly = () => {
    const next: Record<string, boolean> = {};
    packages.forEach((p) => {
      next[p.key] = true;
    });
    setExpandedPkgKeys(next);
    setExpandedSubKeys({});
  };

  const handleToggleAll = () => {
    if (allPkgsExpanded) {
      setExpandedPkgKeys({});
      setExpandedSubKeys({});
    } else {
      handleExpandPackagesOnly();
    }
  };

  const togglePkg = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPkgKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSub = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalVarMonth = totals.compareMonth - totals.bgtMonth;
  const totalVarMonthPct = calcVarPct(totals.compareMonth, totals.bgtMonth);
  const totalVarYtd = totals.compareYtd - totals.bgtYtd;
  const totalVarYtdPct = calcVarPct(totals.compareYtd, totals.bgtYtd);

  return (
    <section className="bg-white border border-[#D5DCD2] shadow-xs rounded-2xl p-4 sm:p-5">
      {/* Barra de controle da matriz */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-1 bg-[#F3F6F3] border border-[#D5DCD2] rounded-xl gap-0.5">
            <button
              type="button"
              onClick={() => onChangeScenarioMode('actual')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scenarioMode === 'actual'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              Realizado (Actual)
            </button>
            <button
              type="button"
              onClick={() => onChangeScenarioMode('fct102')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scenarioMode === 'fct102'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              Fcst 10+2
            </button>
            <button
              type="button"
              onClick={() => onChangeScenarioMode('fct84')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scenarioMode === 'fct84'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              Fcst 8+4
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#52605A] whitespace-nowrap">
            Ref: {monthShort}/26 · YTD Jan–{monthShort}
          </span>

          <div className="inline-flex items-center p-0.5 bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg">
            <button
              type="button"
              onClick={() => setUnit('mm')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unit === 'mm' ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              R$ MM
            </button>
            <button
              type="button"
              onClick={() => setUnit('brl')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                unit === 'brl' ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              R$ Exato
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleAll}
            className="px-2.5 py-1.5 text-[11px] font-bold text-[#1E3A32] bg-[#FAFBF9] hover:bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {allPkgsExpanded ? 'Recolher tudo' : 'Expandir pacotes'}
          </button>
        </div>
      </div>

      {/* Tabela Hierárquica Executiva (Pacote -> Sub Pacote -> Classificação FP&A) */}
      <div className="overflow-x-auto border border-[#D5DCD2] rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#1E3A32] text-white text-[11px] font-bold tracking-tight uppercase whitespace-nowrap">
              <th className="py-2.5 px-3 min-w-[270px]">PACOTES (N3 ▸ N4)</th>
              <th className="py-2 px-3 text-right">
                <div>ORÇ {monthFullUpper}</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right">
                <div>{compareShortHeader} {monthFullUpper}</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right bg-[#27493F]">
                <div>{compareShortHeader} X ORÇ</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right bg-[#27493F]">
                <div>{compareShortHeader} X ORÇ %</div>
                <div className="text-[9px] font-medium text-white/70">{monthFullUpper}</div>
              </th>
              <th className="py-2 px-3 text-right border-l border-white/15">
                <div>ORÇ ACUM</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right">
                <div>{compareShortHeader} ACUM</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right bg-[#27493F]">
                <div>{compareShortHeader} X ORÇ YTD</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-3 text-right bg-[#27493F]">
                <div>{compareShortHeader} X ORÇ YTD %</div>
                <div className="text-[9px] font-medium text-white/70">YTD</div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E6EBE4]">
            {packages.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[#68756E]">
                  Nenhum pacote OPEX encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              packages.map((pkg) => {
                const pkgExpanded = !!expandedPkgKeys[pkg.key];
                const pkgSelected = filters.pacote === pkg.filterValue;
                const pkgPair = pickScenarioPair(pkg, scenarioMode);
                const pkgDiffMonth = pkgPair.monthVal - pkg.bgtMonth;
                const pkgPctMonth = calcVarPct(pkgPair.monthVal, pkg.bgtMonth);
                const pkgDiffYtd = pkgPair.ytdVal - pkg.bgtYtd;
                const pkgPctYtd = calcVarPct(pkgPair.ytdVal, pkg.bgtYtd);

                return (
                  <React.Fragment key={pkg.key}>
                    {/* Nível 1: Pacote (NIVEL_3) */}
                    <tr
                      onClick={() =>
                        onSelectFilter({
                          pacote: pkgSelected ? 'ALL' : pkg.filterValue,
                          subPacote: 'ALL',
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        pkgSelected
                          ? 'bg-[#DCE8E1] font-bold'
                          : 'bg-[#F3F6F3] hover:bg-[#EBF2EE] font-bold'
                      }`}
                    >
                      <td className="py-2 px-3 text-[#1E3A32]">
                        <div className="flex items-center gap-2">
                          {pkg.subPackages.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => togglePkg(pkg.key, e)}
                              aria-label={
                                pkgExpanded ? `Recolher ${pkg.pacote}` : `Expandir ${pkg.pacote}`
                              }
                              className="w-4 h-4 rounded-[3px] border border-[#B5C4B2] bg-white hover:bg-[#EBF2EE] text-[#315F52] flex items-center justify-center text-[11px] font-extrabold leading-none shrink-0 cursor-pointer"
                            >
                              {pkgExpanded ? '−' : '+'}
                            </button>
                          ) : (
                            <span className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate max-w-[260px]" title={pkg.pacote}>
                            {pkg.pacote}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#1E3A32]">
                        {formatMoney(pkg.bgtMonth, unit)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#1E3A32]">
                        {formatMoney(pkgPair.monthVal, unit)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums bg-[#EAEFEA]/70 ${
                          pkgDiffMonth <= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatMoney(pkgDiffMonth, unit)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums bg-[#EAEFEA]/70">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="text-[#1E3A32]">
                            {pkgPctMonth !== null ? `${pkgPctMonth.toFixed(0)}%` : '—'}
                          </span>
                          <OpexStatusDot compareVal={pkgPair.monthVal} orcVal={pkg.bgtMonth} />
                        </div>
                      </td>

                      <td className="py-2 px-3 text-right tabular-nums text-[#1E3A32] border-l border-[#D5DCD2]">
                        {formatMoney(pkg.bgtYtd, unit)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#1E3A32]">
                        {formatMoney(pkgPair.ytdVal, unit)}
                      </td>
                      <td
                        className={`py-2 px-3 text-right tabular-nums bg-[#EAEFEA]/70 ${
                          pkgDiffYtd <= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatMoney(pkgDiffYtd, unit)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums bg-[#EAEFEA]/70">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="text-[#1E3A32]">
                            {pkgPctYtd !== null ? `${pkgPctYtd.toFixed(0)}%` : '—'}
                          </span>
                          <OpexStatusDot compareVal={pkgPair.ytdVal} orcVal={pkg.bgtYtd} />
                        </div>
                      </td>
                    </tr>

                    {/* Nível 2: Sub Pacote (NIVEL_4) */}
                    {pkgExpanded &&
                      pkg.subPackages.map((sub) => {
                        const subExpanded = !!expandedSubKeys[sub.key];
                        const subSelected = filters.subPacote === sub.filterValue;
                        const subPair = pickScenarioPair(sub, scenarioMode);
                        const subDiffMonth = subPair.monthVal - sub.bgtMonth;
                        const subPctMonth = calcVarPct(subPair.monthVal, sub.bgtMonth);
                        const subDiffYtd = subPair.ytdVal - sub.bgtYtd;
                        const subPctYtd = calcVarPct(subPair.ytdVal, sub.bgtYtd);

                        return (
                          <React.Fragment key={sub.key}>
                            <tr
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFilter({
                                  pacote: pkg.filterValue,
                                  subPacote: subSelected ? 'ALL' : sub.filterValue,
                                });
                              }}
                              className={`cursor-pointer transition-colors text-[11px] ${
                                subSelected
                                  ? 'bg-[#EBF2EE] font-semibold'
                                  : 'bg-white hover:bg-[#FAFBF9]'
                              }`}
                            >
                              <td className="py-1.5 pl-7 pr-3 text-[#374740]">
                                <div className="flex items-center gap-2">
                                  {sub.classifications.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleSub(sub.key, e)}
                                      aria-label={
                                        subExpanded
                                          ? `Recolher ${sub.subPacote}`
                                          : `Expandir ${sub.subPacote}`
                                      }
                                      className="w-4 h-4 rounded-[3px] border border-[#C6D2C3] bg-[#FAFBF9] hover:bg-[#EBF2EE] text-[#315F52] flex items-center justify-center text-[10px] font-bold leading-none shrink-0 cursor-pointer"
                                    >
                                      {subExpanded ? '−' : '+'}
                                    </button>
                                  ) : (
                                    <span className="w-4 h-4 shrink-0" />
                                  )}
                                  <span className="truncate max-w-[240px]" title={sub.subPacote}>
                                    {sub.subPacote}
                                  </span>
                                </div>
                              </td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-[#52605A]">
                                {formatMoney(sub.bgtMonth, unit)}
                              </td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-[#1E3A32] font-medium">
                                {formatMoney(subPair.monthVal, unit)}
                              </td>
                              <td
                                className={`py-1.5 px-3 text-right tabular-nums font-medium bg-[#F4F6F4]/80 ${
                                  subDiffMonth <= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {formatMoney(subDiffMonth, unit)}
                              </td>
                              <td className="py-1.5 px-3 text-right tabular-nums bg-[#F4F6F4]/80">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <span className="text-[#52605A]">
                                    {subPctMonth !== null ? `${subPctMonth.toFixed(0)}%` : '—'}
                                  </span>
                                  <OpexStatusDot
                                    compareVal={subPair.monthVal}
                                    orcVal={sub.bgtMonth}
                                  />
                                </div>
                              </td>

                              <td className="py-1.5 px-3 text-right tabular-nums text-[#52605A] border-l border-[#E6EBE4]">
                                {formatMoney(sub.bgtYtd, unit)}
                              </td>
                              <td className="py-1.5 px-3 text-right tabular-nums text-[#1E3A32] font-medium">
                                {formatMoney(subPair.ytdVal, unit)}
                              </td>
                              <td
                                className={`py-1.5 px-3 text-right tabular-nums font-medium bg-[#F4F6F4]/80 ${
                                  subDiffYtd <= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {formatMoney(subDiffYtd, unit)}
                              </td>
                              <td className="py-1.5 px-3 text-right tabular-nums bg-[#F4F6F4]/80">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <span className="text-[#52605A]">
                                    {subPctYtd !== null ? `${subPctYtd.toFixed(0)}%` : '—'}
                                  </span>
                                  <OpexStatusDot
                                    compareVal={subPair.ytdVal}
                                    orcVal={sub.bgtYtd}
                                  />
                                </div>
                              </td>
                            </tr>

                            {/* Nível 3: Classificação FP&A */}
                            {subExpanded &&
                              sub.classifications.map((cls) => {
                                const clsPair = pickScenarioPair(cls, scenarioMode);
                                const clsDiffMonth = clsPair.monthVal - cls.bgtMonth;
                                const clsPctMonth = calcVarPct(clsPair.monthVal, cls.bgtMonth);
                                const clsDiffYtd = clsPair.ytdVal - cls.bgtYtd;
                                const clsPctYtd = calcVarPct(clsPair.ytdVal, cls.bgtYtd);

                                return (
                                  <tr
                                    key={cls.key}
                                    className="bg-[#FAFBF9] hover:bg-[#F3F6F3] transition-colors text-[11px]"
                                  >
                                    <td className="py-1.5 pl-14 pr-3 text-[#52605A]">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[#94A39D] select-none">└</span>
                                        <span
                                          className="truncate max-w-[220px]"
                                          title={cls.classificacao}
                                        >
                                          {cls.classificacao}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-[#68756E]">
                                      {formatMoney(cls.bgtMonth, unit)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-[#374740]">
                                      {formatMoney(clsPair.monthVal, unit)}
                                    </td>
                                    <td
                                      className={`py-1.5 px-3 text-right tabular-nums ${
                                        clsDiffMonth <= 0 ? 'text-emerald-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {formatMoney(clsDiffMonth, unit)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums">
                                      <div className="inline-flex items-center justify-end gap-1.5">
                                        <span className="text-[#68756E]">
                                          {clsPctMonth !== null ? `${clsPctMonth.toFixed(0)}%` : '—'}
                                        </span>
                                        <OpexStatusDot
                                          compareVal={clsPair.monthVal}
                                          orcVal={cls.bgtMonth}
                                        />
                                      </div>
                                    </td>

                                    <td className="py-1.5 px-3 text-right tabular-nums text-[#68756E] border-l border-[#E6EBE4]">
                                      {formatMoney(cls.bgtYtd, unit)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-[#374740]">
                                      {formatMoney(clsPair.ytdVal, unit)}
                                    </td>
                                    <td
                                      className={`py-1.5 px-3 text-right tabular-nums ${
                                        clsDiffYtd <= 0 ? 'text-emerald-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {formatMoney(clsDiffYtd, unit)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums">
                                      <div className="inline-flex items-center justify-end gap-1.5">
                                        <span className="text-[#68756E]">
                                          {clsPctYtd !== null ? `${clsPctYtd.toFixed(0)}%` : '—'}
                                        </span>
                                        <OpexStatusDot
                                          compareVal={clsPair.ytdVal}
                                          orcVal={cls.bgtYtd}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          <tfoot>
            <tr className="bg-[#1E3A32] text-white font-extrabold tabular-nums text-xs">
              <td className="py-2.5 px-3">Total</td>
              <td className="py-2.5 px-3 text-right">{formatMoney(totals.bgtMonth, unit)}</td>
              <td className="py-2.5 px-3 text-right">{formatMoney(totals.compareMonth, unit)}</td>
              <td
                className={`py-2.5 px-3 text-right bg-[#27493F] ${
                  totalVarMonth <= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {formatMoney(totalVarMonth, unit)}
              </td>
              <td className="py-2.5 px-3 text-right bg-[#27493F]">
                <div className="inline-flex items-center justify-end gap-1.5">
                  <span>{totalVarMonthPct !== null ? `${totalVarMonthPct.toFixed(0)}%` : '—'}</span>
                  <OpexStatusDot compareVal={totals.compareMonth} orcVal={totals.bgtMonth} />
                </div>
              </td>

              <td className="py-2.5 px-3 text-right border-l border-white/15">
                {formatMoney(totals.bgtYtd, unit)}
              </td>
              <td className="py-2.5 px-3 text-right">{formatMoney(totals.compareYtd, unit)}</td>
              <td
                className={`py-2.5 px-3 text-right bg-[#27493F] ${
                  totalVarYtd <= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {formatMoney(totalVarYtd, unit)}
              </td>
              <td className="py-2.5 px-3 text-right bg-[#27493F]">
                <div className="inline-flex items-center justify-end gap-1.5">
                  <span>{totalVarYtdPct !== null ? `${totalVarYtdPct.toFixed(0)}%` : '—'}</span>
                  <OpexStatusDot compareVal={totals.compareYtd} orcVal={totals.bgtYtd} />
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
