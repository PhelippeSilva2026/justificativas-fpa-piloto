import React, { useMemo, useState } from 'react';
import {
  LegalClassificationJustifications,
  LegalClassificationRow,
  LegalDescricaoRow,
  LegalDiretoriaRow,
  LegalFilterState,
  LegalGerenciaRow,
  LegalJustificationImpact,
  LegalMatrixChildRow,
} from '../../types/legal';
import { formatBrl } from './legalFormatters';

type GovernanceTab = 'diretoria' | 'gerencia' | 'descricao' | 'classificacao';

interface LegalGovernanceMatrixProps {
  byDiretoria: LegalDiretoriaRow[];
  byGerencia: LegalGerenciaRow[];
  byDescricao: LegalDescricaoRow[];
  byClassification: LegalClassificationRow[];
  refMonth: number;
  filters: LegalFilterState;
  onSelectFilter: (patch: Partial<LegalFilterState>) => void;
}

const MONTH_NAMES_PT = [
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

interface MatrixRowItem {
  key: string;
  label: string;
  sublabel?: string;
  filterKey: keyof LegalFilterState;
  filterValue: string;
  bgtMonth: number;
  actMonth: number;
  disponivelMonth: number;
  bgtYtd: number;
  actTotal: number;
  disponivelYtd: number;
  fct84Total: number;
  fct48Total: number;
  children: LegalMatrixChildRow[];
  justifications?: LegalClassificationJustifications | null;
}

function formatPeriodLabelPt(period: string): string {
  const parts = String(period || '').split('/');
  const year = parts[0] || '2026';
  const monthNum = Number(parts[1]);
  if (Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12) {
    return `${MONTH_FULL_NAMES_PT[monthNum - 1]}/${year}`;
  }
  return period || '—';
}

function formatImpactSigned(value: number, unit: 'mm' | 'brl'): string {
  const safe = Number.isFinite(value) ? value : 0;
  const prefix = safe > 0 ? '+' : '';
  if (unit === 'mm') {
    const mm = safe / 1_000_000;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(mm);
    return `${prefix}R$ ${formatted} MM`;
  }
  return `${prefix}${formatBrl(safe, 0)}`;
}

function formatMatrixMoney(value: number, unit: 'mm' | 'brl'): string {
  const safe = Number.isFinite(value) ? value : 0;
  if (unit === 'mm') {
    const mm = safe / 1_000_000;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(mm);
  }
  return formatBrl(safe, 0);
}

function calcVarPct(real: number, orc: number): number | null {
  if (!Number.isFinite(orc) || Math.abs(orc) < 1) return null;
  return ((real - orc) / Math.abs(orc)) * 100;
}

function StatusDot({ disponivel, orc, real }: { disponivel: number; orc: number; real: number }) {
  let fill = '#94A39D';
  if (Math.abs(orc) >= 1 || Math.abs(real) >= 1) {
    fill = disponivel >= 0 ? '#16A34A' : '#DC2626';
  }
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" className="shrink-0" aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4.5" fill={fill} stroke="#1E3A32" strokeOpacity="0.25" strokeWidth="1" />
    </svg>
  );
}

export const LegalGovernanceMatrix: React.FC<LegalGovernanceMatrixProps> = ({
  byDiretoria,
  byGerencia,
  byDescricao,
  byClassification,
  refMonth,
  filters,
  onSelectFilter,
}) => {
  const [activeTab, setActiveTab] = useState<GovernanceTab>('diretoria');
  const [unit, setUnit] = useState<'mm' | 'brl'>('mm');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const activeMonthNum = useMemo(() => {
    if (filters.anomes && filters.anomes !== 'ALL') {
      const parsed = Number(filters.anomes.split('/')[1]);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
        return Math.trunc(parsed);
      }
    }
    return refMonth;
  }, [filters.anomes, refMonth]);

  const monthIdx = Math.max(0, Math.min(11, activeMonthNum - 1));
  const refMonthLabel = MONTH_NAMES_PT[monthIdx] || 'Nov';
  const refMonthFullUpper = (MONTH_FULL_NAMES_PT[monthIdx] || 'Novembro').toUpperCase();

  const rows: MatrixRowItem[] = useMemo(() => {
    if (activeTab === 'diretoria') {
      return byDiretoria.map((d) => ({
        key: `dir:${d.diretoria}`,
        label: d.diretoria,
        filterKey: 'diretoria',
        filterValue: d.diretoria === 'Sem Diretoria' ? '__EMPTY__' : d.diretoria,
        bgtMonth: d.bgtMonth,
        actMonth: d.actMonth,
        disponivelMonth: d.disponivelMonth,
        bgtYtd: d.bgtYtd,
        actTotal: d.actTotal,
        disponivelYtd: d.disponivelYtd,
        fct84Total: d.fct84Total,
        fct48Total: d.fct48Total,
        children: d.children || [],
      }));
    }
    if (activeTab === 'gerencia') {
      return byGerencia.map((g) => ({
        key: `ger:${g.gerencia}`,
        label: g.gerencia,
        sublabel: g.diretoria,
        filterKey: 'gerencia',
        filterValue: g.gerencia === 'Sem Gerência' ? '__EMPTY__' : g.gerencia,
        bgtMonth: g.bgtMonth,
        actMonth: g.actMonth,
        disponivelMonth: g.disponivelMonth,
        bgtYtd: g.bgtYtd,
        actTotal: g.actTotal,
        disponivelYtd: g.disponivelYtd,
        fct84Total: g.fct84Total,
        fct48Total: g.fct48Total,
        children: g.children || [],
      }));
    }
    if (activeTab === 'descricao') {
      return byDescricao.map((d) => ({
        key: `desc:${d.descricao}`,
        label: d.descricao,
        sublabel: d.gerencia,
        filterKey: 'descricao',
        filterValue: d.descricao === 'Sem Descrição' ? '__EMPTY__' : d.descricao,
        bgtMonth: d.bgtMonth,
        actMonth: d.actMonth,
        disponivelMonth: d.disponivelMonth,
        bgtYtd: d.bgtYtd,
        actTotal: d.actTotal,
        disponivelYtd: d.disponivelYtd,
        fct84Total: d.fct84Total,
        fct48Total: d.fct48Total,
        children: d.children || [],
      }));
    }
    return byClassification.map((c) => ({
      key: `classif:${c.classificacao}`,
      label: c.classificacao,
      filterKey: 'classificacao',
      filterValue: c.classificacao === 'Sem Classificação' ? '__EMPTY__' : c.classificacao,
      bgtMonth: c.bgtMonth,
      actMonth: c.actMonth,
      disponivelMonth: c.disponivelMonth,
      bgtYtd: c.bgtYtd,
      actTotal: c.actTotal,
      disponivelYtd: c.disponivelYtd,
      fct84Total: c.fct84Total,
      fct48Total: c.fct48Total,
      children: [],
      justifications: c.justifications ?? null,
    }));
  }, [activeTab, byDiretoria, byGerencia, byDescricao, byClassification]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        bgtMonth: acc.bgtMonth + r.bgtMonth,
        actMonth: acc.actMonth + r.actMonth,
        disponivelMonth: acc.disponivelMonth + r.disponivelMonth,
        bgtYtd: acc.bgtYtd + r.bgtYtd,
        actTotal: acc.actTotal + r.actTotal,
        disponivelYtd: acc.disponivelYtd + r.disponivelYtd,
        fct84Total: acc.fct84Total + r.fct84Total,
        fct48Total: acc.fct48Total + r.fct48Total,
      }),
      {
        bgtMonth: 0,
        actMonth: 0,
        disponivelMonth: 0,
        bgtYtd: 0,
        actTotal: 0,
        disponivelYtd: 0,
        fct84Total: 0,
        fct48Total: 0,
      }
    );
  }, [rows]);

  const canExpandRow = (row: MatrixRowItem) =>
    activeTab === 'classificacao' ? true : row.children.length > 0;

  const anyExpanded = useMemo(
    () =>
      rows.some((r) =>
        (activeTab === 'classificacao' ? true : r.children.length > 0) && expandedKeys[r.key]
      ),
    [activeTab, rows, expandedKeys]
  );

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpandAll = () => {
    if (anyExpanded) {
      setExpandedKeys({});
    } else {
      const next: Record<string, boolean> = {};
      rows.forEach((r) => {
        if (activeTab === 'classificacao' || r.children.length > 0) next[r.key] = true;
      });
      setExpandedKeys(next);
    }
  };

  const firstColHeader =
    activeTab === 'diretoria'
      ? 'DIRETORIA ▸ GERÊNCIA'
      : activeTab === 'gerencia'
        ? 'GERÊNCIA ▸ DESCRIÇÃO'
        : activeTab === 'descricao'
          ? 'DESCRIÇÃO ▸ CLASSIF. FP&A'
          : 'CLASSIFICAÇÃO FP&A';

  const unitSuffix = unit === 'mm' ? 'R$MM' : 'R$';
  const totalVarMonth = calcVarPct(totals.actMonth, totals.bgtMonth);
  const totalVarYtd = calcVarPct(totals.actTotal, totals.bgtYtd);

  return (
    <section className="bg-white border border-[#D5DCD2] shadow-xs rounded-2xl p-4 sm:p-5">
      {/* Barra superior com os 4 botões de visão + controle de unidade e expandir/recolher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="inline-flex flex-wrap items-center p-1 bg-[#F3F6F3] border border-[#D5DCD2] rounded-xl gap-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('diretoria')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'diretoria'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Diretoria ({byDiretoria.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gerencia')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'gerencia'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Gerência ({byGerencia.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('descricao')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'descricao'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Descrição ({byDescricao.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('classificacao')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'classificacao'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Classificação FP&amp;A ({byClassification.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#52605A] whitespace-nowrap">
            Ref: {refMonthLabel}/26 · YTD Jan–{refMonthLabel}
          </span>

          <div className="inline-flex items-center p-0.5 bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg">
            <button
              type="button"
              onClick={() => setUnit('mm')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                unit === 'mm' ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              R$ MM
            </button>
            <button
              type="button"
              onClick={() => setUnit('brl')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                unit === 'brl' ? 'bg-[#315F52] text-white' : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              R$ Exato
            </button>
          </div>

          <button
            type="button"
            onClick={toggleExpandAll}
            className="px-2.5 py-1.5 text-[11px] font-bold text-[#1E3A32] bg-[#FAFBF9] hover:bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {anyExpanded ? 'Recolher tudo' : 'Expandir tudo'}
          </button>
        </div>
      </div>

      {/* Tabela Hierárquica Executiva */}
      <div className="overflow-x-auto border border-[#D5DCD2] rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#1E3A32] text-white text-[11px] font-bold tracking-tight uppercase whitespace-nowrap">
              <th className="py-2.5 px-3 min-w-[240px]">{firstColHeader}</th>
              <th className="py-2 px-2.5 text-right">
                <div>ORÇ {refMonthFullUpper}</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>REAL {refMonthFullUpper}</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>DISP. {refMonthFullUpper}</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>REAL X ORÇ %</div>
                <div className="text-[9px] font-medium text-white/70">{refMonthFullUpper}</div>
              </th>
              <th className="py-2 px-2.5 text-right border-l border-white/15">
                <div>ORÇ ACUM</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>REAL ACUM</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>DISP. YTD</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>REAL X ORÇ %</div>
                <div className="text-[9px] font-medium text-white/70">YTD</div>
              </th>
              <th className="py-2 px-2.5 text-right border-l border-white/15">
                <div>FCST 8+4</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
              <th className="py-2 px-2.5 text-right">
                <div>FCST 4+8</div>
                <div className="text-[9px] font-medium text-white/70">({unitSuffix})</div>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E6EBE4]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-[#68756E]">
                  Nenhum registro encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isExpanded = !!expandedKeys[row.key];
                const isSelected = filters[row.filterKey] === row.filterValue;
                const varMonthPct = calcVarPct(row.actMonth, row.bgtMonth);
                const varYtdPct = calcVarPct(row.actTotal, row.bgtYtd);

                return (
                  <React.Fragment key={row.key}>
                    {/* Linha Pai */}
                    <tr
                      onClick={() =>
                        onSelectFilter({
                          [row.filterKey]: isSelected ? 'ALL' : row.filterValue,
                        } as Partial<LegalFilterState>)
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#DCE8E1] font-bold'
                          : 'bg-[#F3F6F3] hover:bg-[#EBF2EE] font-bold'
                      }`}
                    >
                      <td className="py-2 px-3 text-[#1E3A32]">
                        <div className="flex items-center gap-2">
                          {canExpandRow(row) ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(row.key, e)}
                              aria-label={isExpanded ? `Recolher ${row.label}` : `Expandir ${row.label}`}
                              className="w-4 h-4 rounded-[3px] border border-[#B5C4B2] bg-white hover:bg-[#EBF2EE] text-[#315F52] flex items-center justify-center text-[11px] font-extrabold leading-none shrink-0 cursor-pointer"
                            >
                              {isExpanded ? '−' : '+'}
                            </button>
                          ) : (
                            <span className="w-4 h-4 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate max-w-[260px]" title={row.label}>
                              {row.label}
                            </div>
                            {row.sublabel && (
                              <div className="text-[10px] font-medium text-[#68756E] truncate max-w-[250px]">
                                {row.sublabel}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums text-[#1E3A32]">
                        {formatMatrixMoney(row.bgtMonth, unit)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums text-[#1E3A32]">
                        {formatMatrixMoney(row.actMonth, unit)}
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right tabular-nums ${
                          row.disponivelMonth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatMatrixMoney(row.disponivelMonth, unit)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="text-[#1E3A32]">
                            {varMonthPct !== null ? `${varMonthPct.toFixed(0)}%` : '—'}
                          </span>
                          <StatusDot
                            disponivel={row.disponivelMonth}
                            orc={row.bgtMonth}
                            real={row.actMonth}
                          />
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-right tabular-nums text-[#1E3A32] border-l border-[#D5DCD2]">
                        {formatMatrixMoney(row.bgtYtd, unit)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums text-[#1E3A32]">
                        {formatMatrixMoney(row.actTotal, unit)}
                      </td>
                      <td
                        className={`py-2 px-2.5 text-right tabular-nums ${
                          row.disponivelYtd >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {formatMatrixMoney(row.disponivelYtd, unit)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="text-[#1E3A32]">
                            {varYtdPct !== null ? `${varYtdPct.toFixed(0)}%` : '—'}
                          </span>
                          <StatusDot
                            disponivel={row.disponivelYtd}
                            orc={row.bgtYtd}
                            real={row.actTotal}
                          />
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-right tabular-nums text-[#52605A] border-l border-[#D5DCD2]">
                        {formatMatrixMoney(row.fct84Total, unit)}
                      </td>
                      <td className="py-2 px-2.5 text-right tabular-nums text-[#68756E]">
                        {formatMatrixMoney(row.fct48Total, unit)}
                      </td>
                    </tr>

                    {/* Drill-down em Classificação FP&A: Justificativas do Mês Selecionado e Visão YTD */}
                    {isExpanded && activeTab === 'classificacao' && (() => {
                      const j = row.justifications;
                      const justifPeriod = j?.period || `2026/${activeMonthNum}`;
                      const periodLabel = formatPeriodLabelPt(justifPeriod);
                      const vsOrcado = j?.vsOrcadoImpacts || [];
                      const mom = j?.momImpacts || [];
                      const ytd = j?.ytdImpacts || [];

                      const renderImpactItem = (item: LegalJustificationImpact) => (
                        <div
                          key={item.id}
                          className="bg-[#FAFBF9] border border-[#E6EBE4] rounded-lg px-3 py-2.5 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold text-[#1E3A32] truncate">
                              {item.name}
                            </span>
                            <span
                              className={`text-[11px] font-extrabold tabular-nums shrink-0 ${
                                item.value >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatImpactSigned(item.value, unit)}
                            </span>
                          </div>
                          {item.justification ? (
                            <p className="text-xs text-[#374740] whitespace-pre-line leading-relaxed">
                              {item.justification}
                            </p>
                          ) : (
                            <p className="text-[11px] italic text-[#7A8780]">
                              Sem texto explicativo preenchido.
                            </p>
                          )}
                        </div>
                      );

                      return (
                        <tr className="bg-[#FAFBF9]">
                          <td colSpan={11} className="p-0">
                            <div className="pl-9 pr-4 py-3.5 border-l-4 border-[#315F52] space-y-3">
                              {(j?.isFallbackPeriod || j?.updatedBy) && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#52605A]">
                                  <span>
                                    Competência das justificativas: <strong className="text-[#1E3A32]">{periodLabel}</strong>
                                    {j?.isFallbackPeriod ? ' (último fechamento disponível)' : ''}
                                  </span>
                                  {j?.updatedBy && (
                                    <span>Atualizado por {j.updatedBy}</span>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Justificativas do Mês Selecionado */}
                                <div className="bg-white border border-[#D5DCD2] rounded-xl p-3.5 space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E6EBE4]">
                                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E3A32]">
                                      Justificativas do Mês — {periodLabel}
                                    </h4>
                                    <span className="text-[11px] font-semibold text-[#52605A] tabular-nums">
                                      Mês vs Orçado ({vsOrcado.length})
                                    </span>
                                  </div>

                                  {vsOrcado.length > 0 ? (
                                    <div className="space-y-2">{vsOrcado.map(renderImpactItem)}</div>
                                  ) : (
                                    <p className="text-xs text-[#68756E] py-2">
                                      Nenhuma justificativa de Mês vs Orçado registrada para {periodLabel}.
                                    </p>
                                  )}

                                  {mom.length > 0 && (
                                    <div className="pt-2 border-t border-[#E6EBE4] space-y-2">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#52605A]">
                                        Variação Mensal (MoM · {mom.length})
                                      </div>
                                      {mom.map(renderImpactItem)}
                                    </div>
                                  )}
                                </div>

                                {/* Visão YTD das Justificativas */}
                                <div className="bg-white border border-[#D5DCD2] rounded-xl p-3.5 space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E6EBE4]">
                                    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E3A32]">
                                      Visão YTD das Justificativas — Até {periodLabel}
                                    </h4>
                                    <span className="text-[11px] font-semibold text-[#52605A] tabular-nums">
                                      YTD vs Orçado ({ytd.length})
                                    </span>
                                  </div>

                                  {ytd.length > 0 ? (
                                    <div className="space-y-2">{ytd.map(renderImpactItem)}</div>
                                  ) : (
                                    <p className="text-xs text-[#68756E] py-2">
                                      Nenhuma justificativa YTD registrada até {periodLabel}.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}

                    {/* Linhas Filhas (Drill-down para Diretoria, Gerência e Descrição) */}
                    {isExpanded &&
                      activeTab !== 'classificacao' &&
                      row.children.map((child) => {
                        const childSelected =
                          child.filterKey &&
                          child.filterValue &&
                          filters[child.filterKey] === child.filterValue;
                        const cVarMonth = calcVarPct(child.actMonth, child.bgtMonth);
                        const cVarYtd = calcVarPct(child.actTotal, child.bgtYtd);

                        return (
                          <tr
                            key={child.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (child.filterKey && child.filterValue) {
                                onSelectFilter({
                                  [child.filterKey]: childSelected ? 'ALL' : child.filterValue,
                                } as Partial<LegalFilterState>);
                              }
                            }}
                            className={`cursor-pointer transition-colors text-[11px] ${
                              childSelected
                                ? 'bg-[#EBF2EE] font-semibold'
                                : 'bg-white hover:bg-[#FAFBF9]'
                            }`}
                          >
                            <td className="py-1.5 pl-9 pr-3 text-[#374740]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[#94A39D] select-none">└</span>
                                <div className="min-w-0">
                                  <div className="truncate max-w-[240px]" title={child.label}>
                                    {child.label}
                                  </div>
                                  {child.sublabel && (
                                    <div className="font-mono text-[10px] text-[#68756E]">
                                      {child.sublabel}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#52605A]">
                              {formatMatrixMoney(child.bgtMonth, unit)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#1E3A32] font-medium">
                              {formatMatrixMoney(child.actMonth, unit)}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right tabular-nums font-medium ${
                                child.disponivelMonth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatMatrixMoney(child.disponivelMonth, unit)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <span className="text-[#52605A]">
                                  {cVarMonth !== null ? `${cVarMonth.toFixed(0)}%` : '—'}
                                </span>
                                <StatusDot
                                  disponivel={child.disponivelMonth}
                                  orc={child.bgtMonth}
                                  real={child.actMonth}
                                />
                              </div>
                            </td>

                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#52605A] border-l border-[#E6EBE4]">
                              {formatMatrixMoney(child.bgtYtd, unit)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#1E3A32] font-medium">
                              {formatMatrixMoney(child.actTotal, unit)}
                            </td>
                            <td
                              className={`py-1.5 px-2.5 text-right tabular-nums font-medium ${
                                child.disponivelYtd >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {formatMatrixMoney(child.disponivelYtd, unit)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <span className="text-[#52605A]">
                                  {cVarYtd !== null ? `${cVarYtd.toFixed(0)}%` : '—'}
                                </span>
                                <StatusDot
                                  disponivel={child.disponivelYtd}
                                  orc={child.bgtYtd}
                                  real={child.actTotal}
                                />
                              </div>
                            </td>

                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#52605A] border-l border-[#E6EBE4]">
                              {formatMatrixMoney(child.fct84Total, unit)}
                            </td>
                            <td className="py-1.5 px-2.5 text-right tabular-nums text-[#68756E]">
                              {formatMatrixMoney(child.fct48Total, unit)}
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>

          {/* Linha Total no rodapé */}
          <tfoot>
            <tr className="bg-[#1E3A32] text-white font-extrabold tabular-nums text-xs">
              <td className="py-2.5 px-3">Total</td>
              <td className="py-2.5 px-2.5 text-right">
                {formatMatrixMoney(totals.bgtMonth, unit)}
              </td>
              <td className="py-2.5 px-2.5 text-right">
                {formatMatrixMoney(totals.actMonth, unit)}
              </td>
              <td
                className={`py-2.5 px-2.5 text-right ${
                  totals.disponivelMonth >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {formatMatrixMoney(totals.disponivelMonth, unit)}
              </td>
              <td className="py-2.5 px-2.5 text-right">
                <div className="inline-flex items-center justify-end gap-1.5">
                  <span>{totalVarMonth !== null ? `${totalVarMonth.toFixed(0)}%` : '—'}</span>
                  <StatusDot
                    disponivel={totals.disponivelMonth}
                    orc={totals.bgtMonth}
                    real={totals.actMonth}
                  />
                </div>
              </td>

              <td className="py-2.5 px-2.5 text-right border-l border-white/15">
                {formatMatrixMoney(totals.bgtYtd, unit)}
              </td>
              <td className="py-2.5 px-2.5 text-right">
                {formatMatrixMoney(totals.actTotal, unit)}
              </td>
              <td
                className={`py-2.5 px-2.5 text-right ${
                  totals.disponivelYtd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {formatMatrixMoney(totals.disponivelYtd, unit)}
              </td>
              <td className="py-2.5 px-2.5 text-right">
                <div className="inline-flex items-center justify-end gap-1.5">
                  <span>{totalVarYtd !== null ? `${totalVarYtd.toFixed(0)}%` : '—'}</span>
                  <StatusDot
                    disponivel={totals.disponivelYtd}
                    orc={totals.bgtYtd}
                    real={totals.actTotal}
                  />
                </div>
              </td>

              <td className="py-2.5 px-2.5 text-right border-l border-white/15">
                {formatMatrixMoney(totals.fct84Total, unit)}
              </td>
              <td className="py-2.5 px-2.5 text-right">
                {formatMatrixMoney(totals.fct48Total, unit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
};
