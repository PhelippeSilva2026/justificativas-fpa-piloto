import React, { useMemo, useState } from 'react';
import { Building2, Landmark, Layers } from 'lucide-react';
import {
  RealEstateBuildingSaleRow,
  RealEstatePlOpeningRow,
} from '../../types/realEstate';
import { formatAnomesLabel, formatBrl, formatBrlCompact, formatInt } from './realEstateFormatters';

interface RealEstateBuildingSalesAndPlSectionProps {
  plOpenings: RealEstatePlOpeningRow[];
  buildingSales: RealEstateBuildingSaleRow[];
  activeContrato: string;
  activeSearch: string;
  onSelectBuildingFilter: (row: RealEstateBuildingSaleRow) => void;
  onSelectPlLeafFilter: (leafKey: string) => void;
}

const GROUP_ORDER = [
  'Net Revenue',
  'Rentals',
  'Facilities',
  'Água, Esgoto & Gás',
  'Provisões',
  'Internacional',
  'Overhead',
];

export const RealEstateBuildingSalesAndPlSection: React.FC<
  RealEstateBuildingSalesAndPlSectionProps
> = ({
  plOpenings,
  buildingSales,
  activeContrato,
  activeSearch,
  onSelectBuildingFilter,
  onSelectPlLeafFilter,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('ALL');

  const groupedOpenings = useMemo(() => {
    const groups = new Map<
      string,
      {
        group: string;
        bgt26: number;
        act26: number;
        fct84: number;
        fct48: number;
        rows: number;
        items: RealEstatePlOpeningRow[];
      }
    >();

    for (const item of plOpenings) {
      if (groupFilter !== 'ALL' && item.group !== groupFilter) continue;
      const existing = groups.get(item.group) || {
        group: item.group,
        bgt26: 0,
        act26: 0,
        fct84: 0,
        fct48: 0,
        rows: 0,
        items: [],
      };
      existing.bgt26 += item.bgt26;
      existing.act26 += item.act26;
      existing.fct84 += item.fct84;
      existing.fct48 += item.fct48;
      existing.rows += item.rows;
      existing.items.push(item);
      groups.set(item.group, existing);
    }

    return Array.from(groups.values()).sort(
      (a, b) =>
        (GROUP_ORDER.indexOf(a.group) === -1 ? 99 : GROUP_ORDER.indexOf(a.group)) -
        (GROUP_ORDER.indexOf(b.group) === -1 ? 99 : GROUP_ORDER.indexOf(b.group))
    );
  }, [plOpenings, groupFilter]);

  const totals = useMemo(() => {
    return plOpenings.reduce(
      (acc, r) => {
        acc.bgt26 += r.bgt26;
        acc.act26 += r.act26;
        acc.fct84 += r.fct84;
        acc.fct48 += r.fct48;
        return acc;
      },
      { bgt26: 0, act26: 0, fct84: 0, fct48: 0 }
    );
  }, [plOpenings]);

  const buildingTotals = useMemo(() => {
    return buildingSales.reduce(
      (acc, r) => {
        acc.actTotal += r.actTotal;
        acc.bgtTotal += r.bgtTotal;
        acc.fct84Total += r.fct84Total;
        acc.fct48Total += r.fct48Total;
        if (Math.abs(r.actTotal) > 0.01) acc.realizedCount += 1;
        return acc;
      },
      { actTotal: 0, bgtTotal: 0, fct84Total: 0, fct48Total: 0, realizedCount: 0 }
    );
  }, [buildingSales]);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
      {/* Esquerda (7 cols): Aberturas P&L Real Estate (BGT vs ACTUAL vs FCST) */}
      <div className="xl:col-span-7 bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5 flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#E6EBE4]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EEF4F1] text-[#315F52] flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
                Aberturas P&amp;L de Real Estate · BGT × ACT × FCST
              </h2>
            </div>
            <p className="text-xs text-[#52605A] mt-1">
              Estrutura própria de Real Estate (Receitas, Venda de Prédios, Rentals, IFRS16, IPTU,
              Facilities, Utilidades, PDD, Ex-Brasil e Overhead).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'Net Revenue', 'Rentals', 'Facilities', 'Água, Esgoto & Gás'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupFilter(g)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  groupFilter === g
                    ? 'bg-[#315F52] text-white'
                    : 'bg-[#FAFBF9] text-[#52605A] border border-[#D5DCD2] hover:bg-[#F3F6F3] hover:text-[#1E3A32]'
                }`}
              >
                {g === 'ALL' ? 'Todas' : g}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3.5 overflow-x-auto border border-[#D5DCD2] rounded-xl flex-1">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] border-b border-[#D5DCD2] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Abertura Real Estate</th>
                <th className="py-2.5 px-3 text-right">BGT 26</th>
                <th className="py-2.5 px-3 text-right">ACTUAL 26</th>
                <th className="py-2.5 px-3 text-right">FCST 8+4</th>
                <th className="py-2.5 px-3 text-right">FCST 4+8</th>
                <th className="py-2.5 px-3 text-right">Δ (ACT − BGT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {groupedOpenings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#68756E]">
                    Sem aberturas P&amp;L para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                groupedOpenings.map((grp) => {
                  const grpDelta = grp.act26 - grp.bgt26;
                  const grpFav = grpDelta >= 0;
                  return (
                    <React.Fragment key={grp.group}>
                      <tr className="bg-[#FAFBF9] font-extrabold text-[#1E3A32]">
                        <td className="py-2 px-3 whitespace-nowrap">{grp.group}</td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatBrlCompact(grp.bgt26)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatBrlCompact(grp.act26)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatBrlCompact(grp.fct84)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          {formatBrlCompact(grp.fct48)}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              grpFav
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {grpDelta > 0 ? '+' : ''}
                            {formatBrlCompact(grpDelta)}
                          </span>
                        </td>
                      </tr>
                      {grp.items.map((item) => {
                        const delta = item.act26 - item.bgt26;
                        const isFav = delta >= 0;
                        return (
                          <tr
                            key={item.leafKey}
                            onClick={() => onSelectPlLeafFilter(item.leafKey)}
                            className="hover:bg-[#F3F6F3] transition-colors cursor-pointer"
                            title="Clique para filtrar lançamentos relacionados no painel"
                          >
                            <td className="py-1.5 pl-6 pr-3 text-[#1E3A32] font-medium whitespace-nowrap">
                              {item.label}
                            </td>
                            <td className="py-1.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                              {formatBrlCompact(item.bgt26)}
                            </td>
                            <td className="py-1.5 px-3 text-right font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                              {formatBrlCompact(item.act26)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                              {formatBrlCompact(item.fct84)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-[#68756E] tabular-nums whitespace-nowrap">
                              {formatBrlCompact(item.fct48)}
                            </td>
                            <td
                              className={`py-1.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                                isFav ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {delta > 0 ? '+' : ''}
                              {formatBrlCompact(delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            {groupedOpenings.length > 0 && (
              <tfoot>
                <tr className="bg-[#315F52] text-white font-extrabold text-xs">
                  <td className="py-2.5 px-3">Total Real Estate Consolidado</td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatBrlCompact(totals.bgt26)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatBrlCompact(totals.act26)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatBrlCompact(totals.fct84)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {formatBrlCompact(totals.fct48)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">
                    {totals.act26 - totals.bgt26 > 0 ? '+' : ''}
                    {formatBrlCompact(totals.act26 - totals.bgt26)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Direita (5 cols): Venda de Prédios V.tal */}
      <div className="xl:col-span-5 bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5 flex flex-col">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#E6EBE4]">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
                Venda de Prédios V.tal
              </h2>
            </div>
            <p className="text-xs text-[#52605A] mt-1">
              Imóveis alienados, receitas de venda e ajustes registrados em Real Estate.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[#EEF4F1] border border-[#C8D5CE] text-[11px] font-bold text-[#315F52] tabular-nums whitespace-nowrap">
            {formatInt(buildingTotals.realizedCount)} imóveis realizados
          </span>
        </div>

        {/* Mini Resumo Executivo Venda de Prédios */}
        <div className="mt-3.5 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-emerald-50/75 border border-emerald-200 p-3">
            <div className="text-[11px] font-bold text-emerald-800">Realizado (ACT 26)</div>
            <div className="text-sm font-black text-emerald-900 tabular-nums mt-0.5">
              {formatBrlCompact(buildingTotals.actTotal)}
            </div>
          </div>
          <div className="rounded-xl bg-[#FAFBF9] border border-[#D5DCD2] p-3">
            <div className="text-[11px] font-bold text-[#52605A]">Forecast 8+4</div>
            <div className="text-sm font-black text-[#1E3A32] tabular-nums mt-0.5">
              {formatBrlCompact(buildingTotals.fct84Total)}
            </div>
          </div>
          <div className="rounded-xl bg-[#FAFBF9] border border-[#D5DCD2] p-3">
            <div className="text-[11px] font-bold text-[#52605A]">Budget 26</div>
            <div className="text-sm font-black text-[#1E3A32] tabular-nums mt-0.5">
              {formatBrlCompact(buildingTotals.bgtTotal)}
            </div>
          </div>
        </div>

        {/* Tabela de Prédios Vendidos */}
        <div className="mt-3.5 max-h-[380px] overflow-auto border border-[#D5DCD2] rounded-xl flex-1">
          <table className="w-full text-left text-xs min-w-[460px]">
            <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
              <tr>
                <th className="py-2 px-3">Imóvel / Descrição</th>
                <th className="py-2 px-3">Contrato RE</th>
                <th className="py-2 px-3">Comp.</th>
                <th className="py-2 px-3 text-right">ACT 26</th>
                <th className="py-2 px-3 text-right">FCT 8+4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {buildingSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#68756E]">
                    Nenhum imóvel ou lançamento de venda encontrado para este recorte.
                  </td>
                </tr>
              ) : (
                buildingSales.map((row, idx) => {
                  const isFiltered =
                    (row.contrato !== '—' && activeContrato === row.contrato) ||
                    (activeSearch && activeSearch.toUpperCase() === row.imovel.toUpperCase());
                  const isRealized = Math.abs(row.actTotal) > 0.01;
                  return (
                    <tr
                      key={`${row.imovel}-${row.contrato}-${row.anomes}-${idx}`}
                      onClick={() => onSelectBuildingFilter(row)}
                      className={`cursor-pointer transition-colors ${
                        isFiltered ? 'bg-[#EBF2EE]' : 'hover:bg-[#F3F6F3]'
                      }`}
                      title={`${row.texto} · BGT: ${formatBrl(row.bgtTotal)}`}
                    >
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#4F927F] shrink-0" />
                          <span className="font-extrabold text-[#1E3A32] whitespace-nowrap">
                            {row.imovel}
                          </span>
                          {isRealized && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                              ACT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#52605A] truncate max-w-[205px]">
                          {row.texto}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#52605A] tabular-nums whitespace-nowrap">
                        {row.contrato}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] whitespace-nowrap">
                        {row.anomes !== '—' ? formatAnomesLabel(row.anomes) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold tabular-nums whitespace-nowrap text-emerald-800">
                        {Math.abs(row.actTotal) > 0.01 ? formatBrlCompact(row.actTotal) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-[#52605A] tabular-nums whitespace-nowrap">
                        {Math.abs(row.fct84Total) > 0.01 ? formatBrlCompact(row.fct84Total) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
