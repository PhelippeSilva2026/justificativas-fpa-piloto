import React, { useState } from 'react';
import { Building2, FileText, Filter, Layers, MapPin, Radio } from 'lucide-react';
import {
  EnergyFilterState,
  EnergyUfDrilldownData,
  EnergyUfRow,
} from '../../types/energy';
import { formatAnomesLabel, formatBrl, formatBrlCompact, formatInt } from './energyFormatters';

interface EnergyUfDrilldownProps {
  byUf: EnergyUfRow[];
  ufMode: EnergyFilterState['ufMode'];
  activeUfFilter: string;
  selectedDrillUf: string;
  drillData: EnergyUfDrilldownData | null;
  isDrillLoading: boolean;
  onChangeUfMode: (mode: EnergyFilterState['ufMode']) => void;
  onSelectDrillUf: (uf: string) => void;
  onApplyUfFilter: (uf: string) => void;
  onToggleStationFilter: (station: string) => void;
  onToggleContractFilter: (contract: string) => void;
  onToggleCcFilter: (cc: string) => void;
  activeStation: string;
  activeContract: string;
  activeCc: string;
}

type DrillTab = 'stations' | 'contracts' | 'cc';

export const EnergyUfDrilldown: React.FC<EnergyUfDrilldownProps> = ({
  byUf,
  ufMode,
  activeUfFilter,
  selectedDrillUf,
  drillData,
  isDrillLoading,
  onChangeUfMode,
  onSelectDrillUf,
  onApplyUfFilter,
  onToggleStationFilter,
  onToggleContractFilter,
  onToggleCcFilter,
  activeStation,
  activeContract,
  activeCc,
}) => {
  const [drillTab, setDrillTab] = useState<DrillTab>('stations');

  const maxAbsUfNet = Math.max(1, ...byUf.map((u) => Math.abs(u.netTotal)));
  const maxMonthMag = Math.max(
    1,
    ...(drillData?.monthly || []).map((m) =>
      Math.max(Math.abs(m.grossCost), Math.abs(m.grossCredit), Math.abs(m.netTotal))
    )
  );

  const isSelectedUfFiltered = activeUfFilter === selectedDrillUf && selectedDrillUf !== '';

  return (
    <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5">
      {/* Cabeçalho com seletor de critério de UF */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6EBE4]">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#315F52]" />
            <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
              Análise Geográfica e Drill-down por UF
            </h2>
          </div>
          <p className="text-xs text-[#52605A] mt-0.5">
            Selecione uma UF na tabela à esquerda para abrir Estações, Contratos RE, Centros de Custo e curva mensal.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2]">
          <button
            type="button"
            onClick={() => onChangeUfMode('consolidated')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              ufMode === 'consolidated'
                ? 'bg-[#315F52] text-white shadow-2xs'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            UF Consolidada (Cadastro + Sigla)
          </button>
          <button
            type="button"
            onClick={() => onChangeUfMode('registered')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              ufMode === 'registered'
                ? 'bg-[#315F52] text-white shadow-2xs'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            UF Cadastral (ESTACAO_UF)
          </button>
        </div>
      </div>

      {/* Grade 12 colunas: Esquerda ranking de UFs (5) | Direita drill-down da UF selecionada (7) */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Lista de UFs */}
        <div className="lg:col-span-5 border border-[#D5DCD2] rounded-xl overflow-hidden bg-[#FAFBF9]">
          <div className="px-3.5 py-2.5 bg-[#F3F6F3] border-b border-[#D5DCD2] flex items-center justify-between text-[11px] font-bold text-[#52605A]">
            <span>UFs ({byUf.length})</span>
            <span>Clique na linha para detalhar</span>
          </div>

          <div className="max-h-[470px] overflow-y-auto divide-y divide-[#E6EBE4] bg-white">
            {byUf.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#68756E]">
                Nenhuma UF encontrada para os filtros aplicados.
              </div>
            ) : (
              byUf.map((row) => {
                const isSelected = selectedDrillUf === row.uf;
                const isFiltered = activeUfFilter === row.uf;
                const barWidthPct = Math.max(4, Math.round((Math.abs(row.netTotal) / maxAbsUfNet) * 100));

                return (
                  <button
                    key={row.uf}
                    type="button"
                    onClick={() => onSelectDrillUf(row.uf)}
                    className={`w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md text-xs font-extrabold ${
                            isSelected
                              ? 'bg-[#315F52] text-white'
                              : 'bg-[#F3F6F3] text-[#1E3A32] border border-[#D5DCD2]'
                          }`}
                        >
                          {row.uf}
                        </span>
                        <div className="text-[11px] text-[#52605A] truncate tabular-nums">
                          {formatInt(row.stations)} est. · {formatInt(row.contracts)} cttos
                        </div>
                        {isFiltered && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#D5E3DC] text-[#1E3A32]">
                            Filtrada
                          </span>
                        )}
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <div className="text-xs font-extrabold text-[#1E3A32]">
                          {formatBrlCompact(row.netTotal)}
                        </div>
                        <div className="text-[10px] text-[#68756E]">
                          {formatInt(row.rows)} lin.
                        </div>
                      </div>
                    </div>

                    {/* Barra proporcional via SVG */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <svg className="flex-1 h-1.5" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="0" y="0" width="100" height="4" rx="2" fill="#E6EBE4" />
                        <rect
                          x="0"
                          y="0"
                          width={barWidthPct}
                          height="4"
                          rx="2"
                          fill={isSelected ? '#315F52' : '#7BA698'}
                        />
                      </svg>
                      <span className="text-[10px] text-[#68756E] tabular-nums shrink-0">
                        Custo {formatBrlCompact(row.grossCost)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Painel de Drill-down da UF selecionada */}
        <div className="lg:col-span-7 border border-[#D5DCD2] rounded-xl bg-white p-4">
          {!selectedDrillUf ? (
            <div className="py-16 text-center text-xs text-[#68756E]">
              Selecione uma UF ao lado para visualizar o detalhamento operacional e financeiro.
            </div>
          ) : isDrillLoading && (!drillData || drillData.uf !== selectedDrillUf) ? (
            <div className="space-y-3 py-4 animate-pulse">
              <div className="h-6 w-48 bg-[#E6EBE4] rounded" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-16 bg-[#F3F6F3] rounded-xl" />
                ))}
              </div>
              <div className="h-56 bg-[#F3F6F3] rounded-xl" />
            </div>
          ) : !drillData ? (
            <div className="py-12 text-center text-xs text-[#68756E]">
              Não foi possível carregar o detalhamento de {selectedDrillUf}.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header do drill-down */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#315F52] text-white text-xs font-extrabold">
                      {drillData.uf}
                    </span>
                    <h3 className="text-sm font-extrabold text-[#1E3A32]">
                      Detalhamento da UF · {drillData.uf}
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#68756E] mt-1 tabular-nums">
                    {formatInt(drillData.summary.totalRows)} lançamentos ·{' '}
                    {formatInt(drillData.summary.registeredRows)} com UF cadastrada no RE
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onApplyUfFilter(isSelectedUfFiltered ? 'ALL' : drillData.uf)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelectedUfFiltered
                      ? 'bg-[#315F52] text-white border-[#315F52]'
                      : 'bg-[#FAFBF9] text-[#1E3A32] border-[#CCD8C7] hover:bg-[#EBF2EE]'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    {isSelectedUfFiltered
                      ? 'Remover filtro desta UF'
                      : `Filtrar página por ${drillData.uf}`}
                  </span>
                </button>
              </div>

              {/* Resumo numérico da UF */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl bg-[#FAFBF9] border border-[#E6EBE4] p-3">
                  <div className="text-[11px] font-semibold text-[#52605A]">Resultado Líquido</div>
                  <div className="text-sm font-extrabold text-[#1E3A32] tabular-nums mt-0.5">
                    {formatBrlCompact(drillData.summary.netTotal)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FAFBF9] border border-[#E6EBE4] p-3">
                  <div className="text-[11px] font-semibold text-[#52605A]">Custos Brutos</div>
                  <div className="text-sm font-extrabold text-rose-700 tabular-nums mt-0.5">
                    {formatBrlCompact(drillData.summary.grossCost)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FAFBF9] border border-[#E6EBE4] p-3">
                  <div className="text-[11px] font-semibold text-[#52605A]">Créditos / Estornos</div>
                  <div className="text-sm font-extrabold text-emerald-700 tabular-nums mt-0.5">
                    +{formatBrlCompact(drillData.summary.grossCredit)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#FAFBF9] border border-[#E6EBE4] p-3">
                  <div className="text-[11px] font-semibold text-[#52605A]">Estações / Contratos</div>
                  <div className="text-sm font-extrabold text-[#1E3A32] tabular-nums mt-0.5">
                    {formatInt(drillData.summary.distinctStations)} est. ·{' '}
                    {formatInt(drillData.summary.distinctContracts)} ct.
                  </div>
                </div>
              </div>

              {/* Mini curva mensal da UF via SVG */}
              {drillData.monthly.length > 0 && (
                <div className="rounded-xl border border-[#E6EBE4] bg-[#FAFBF9] p-3">
                  <div className="text-[11px] font-bold text-[#52605A] mb-2">
                    Comportamento Mensal em {drillData.uf} (Custos vs. Créditos)
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-1.5 items-end">
                    {drillData.monthly.map((m) => {
                      const costH = Math.max(4, Math.round((Math.abs(m.grossCost) / maxMonthMag) * 44));
                      const creditH =
                        m.grossCredit > 0
                          ? Math.max(4, Math.round((m.grossCredit / maxMonthMag) * 44))
                          : 0;
                      return (
                        <div
                          key={m.anomes}
                          className="flex flex-col items-center"
                          title={`${formatAnomesLabel(m.anomes)}: Líquido ${formatBrl(m.netTotal)} | Custos ${formatBrl(m.grossCost)} | Créditos ${formatBrl(m.grossCredit)}`}
                        >
                          <svg width="26" height="48" viewBox="0 0 26 48" aria-hidden="true">
                            <rect
                              x="2"
                              y={48 - costH}
                              width="10"
                              height={costH}
                              rx="2"
                              fill="#315F52"
                            />
                            {creditH > 0 && (
                              <rect
                                x="14"
                                y={48 - creditH}
                                width="10"
                                height={creditH}
                                rx="2"
                                fill="#4F927F"
                              />
                            )}
                          </svg>
                          <span className="text-[10px] font-semibold text-[#52605A] mt-1">
                            {formatAnomesLabel(m.anomes).replace('/26', '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Abas do Drill-down */}
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E6EBE4] pb-2">
                <button
                  type="button"
                  onClick={() => setDrillTab('stations')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    drillTab === 'stations'
                      ? 'bg-[#315F52] text-white'
                      : 'bg-[#F3F6F3] text-[#52605A] hover:text-[#1E3A32]'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Estações ({drillData.stations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillTab('contracts')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    drillTab === 'contracts'
                      ? 'bg-[#315F52] text-white'
                      : 'bg-[#F3F6F3] text-[#52605A] hover:text-[#1E3A32]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Contratos RE ({drillData.contracts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrillTab('cc')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    drillTab === 'cc'
                      ? 'bg-[#315F52] text-white'
                      : 'bg-[#F3F6F3] text-[#52605A] hover:text-[#1E3A32]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Centros de Custo ({drillData.costCenters.length})</span>
                </button>
              </div>

              {/* Tabela da aba selecionada */}
              <div className="max-h-[250px] overflow-y-auto border border-[#D5DCD2] rounded-xl">
                {drillTab === 'stations' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                      <tr>
                        <th className="py-2 px-3">Estação</th>
                        <th className="py-2 px-3">Cidade / Tipo</th>
                        <th className="py-2 px-3">Contrato</th>
                        <th className="py-2 px-3 text-right">Linhas</th>
                        <th className="py-2 px-3 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EBE4]">
                      {drillData.stations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[#68756E]">
                            Sem estações identificadas para {drillData.uf}.
                          </td>
                        </tr>
                      ) : (
                        drillData.stations.map((st) => {
                          const isActive = activeStation === st.estacao;
                          return (
                            <tr
                              key={st.estacao}
                              onClick={() => onToggleStationFilter(st.estacao)}
                              className={`cursor-pointer transition-colors ${
                                isActive ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                              }`}
                            >
                              <td className="py-2 px-3 font-bold text-[#1E3A32] whitespace-nowrap">
                                {st.estacao}
                              </td>
                              <td className="py-2 px-3 text-[#52605A]">
                                {st.cidade || '—'}
                                {st.tipoContrato ? ` · ${st.tipoContrato}` : ''}
                              </td>
                              <td className="py-2 px-3 text-[#52605A] tabular-nums">
                                {st.contratoPrincipal || '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-[#68756E] tabular-nums">
                                {formatInt(st.rows)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                                {formatBrl(st.netTotal)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {drillTab === 'contracts' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                      <tr>
                        <th className="py-2 px-3">Contrato RE</th>
                        <th className="py-2 px-3">Tipo / Fornecedor</th>
                        <th className="py-2 px-3 text-right">Estações</th>
                        <th className="py-2 px-3 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EBE4]">
                      {drillData.contracts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[#68756E]">
                            Sem contratos vinculados para {drillData.uf}.
                          </td>
                        </tr>
                      ) : (
                        drillData.contracts.map((c) => {
                          const isActive = activeContract === c.contrato;
                          return (
                            <tr
                              key={c.contrato}
                              onClick={() => onToggleContractFilter(c.contrato)}
                              className={`cursor-pointer transition-colors ${
                                isActive ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                              }`}
                            >
                              <td className="py-2 px-3 font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                                {c.contrato}
                              </td>
                              <td className="py-2 px-3 text-[#52605A]">
                                <span className="font-medium text-[#1E3A32]">{c.fornecedorPrincipal}</span>
                                {c.tipoContrato ? ` · ${c.tipoContrato}` : ''}
                              </td>
                              <td className="py-2 px-3 text-right text-[#68756E] tabular-nums">
                                {formatInt(c.stations)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                                {formatBrl(c.netTotal)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {drillTab === 'cc' && (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                      <tr>
                        <th className="py-2 px-3">Centro de Custo</th>
                        <th className="py-2 px-3">Descrição</th>
                        <th className="py-2 px-3 text-right">Linhas</th>
                        <th className="py-2 px-3 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6EBE4]">
                      {drillData.costCenters.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-[#68756E]">
                            Sem centros de custo para {drillData.uf}.
                          </td>
                        </tr>
                      ) : (
                        drillData.costCenters.map((cc) => {
                          const isActive = activeCc === cc.cc;
                          return (
                            <tr
                              key={cc.cc}
                              onClick={() => onToggleCcFilter(cc.cc)}
                              className={`cursor-pointer transition-colors ${
                                isActive ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                              }`}
                            >
                              <td className="py-2 px-3 font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-[#315F52]" />
                                  {cc.cc}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-[#52605A]">{cc.ccDesc || '—'}</td>
                              <td className="py-2 px-3 text-right text-[#68756E] tabular-nums">
                                {formatInt(cc.rows)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-[#1E3A32] tabular-nums whitespace-nowrap">
                                {formatBrl(cc.netTotal)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
