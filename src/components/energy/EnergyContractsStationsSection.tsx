import React, { useState } from 'react';
import { FileText, Radio } from 'lucide-react';
import { EnergyContractRow, EnergyStationRow } from '../../types/energy';
import { formatBrl, formatBrlCompact, formatInt } from './energyFormatters';

interface EnergyContractsStationsSectionProps {
  byContract: EnergyContractRow[];
  byStation: EnergyStationRow[];
  activeContract: string;
  activeStation: string;
  onToggleContractFilter: (contract: string) => void;
  onToggleStationFilter: (station: string) => void;
}

export const EnergyContractsStationsSection: React.FC<EnergyContractsStationsSectionProps> = ({
  byContract,
  byStation,
  activeContract,
  activeStation,
  onToggleContractFilter,
  onToggleStationFilter,
}) => {
  const [activeTab, setActiveTab] = useState<'contracts' | 'stations'>('contracts');

  return (
    <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6EBE4]">
        <div>
          <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
            {activeTab === 'contracts'
              ? 'Ranking de Contratos RE (CONTRATO_RE)'
              : 'Ranking de Estações (SIGLA_ESTACAO)'}
          </h2>
          <p className="text-xs text-[#52605A] mt-0.5">
            {activeTab === 'contracts'
              ? 'Clique em qualquer Contrato RE para isolar seus lançamentos, estações e curva mensal.'
              : 'Clique em qualquer Estação para consultar seus contratos, município, status financeiro e histórico.'}
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2]">
          <button
            type="button"
            onClick={() => setActiveTab('contracts')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'contracts'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Contratos ({byContract.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stations')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
              activeTab === 'stations'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Estações ({byStation.length})</span>
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[460px] overflow-auto border border-[#D5DCD2] rounded-xl">
        {activeTab === 'contracts' ? (
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
              <tr>
                <th className="py-2.5 px-3">Contrato RE</th>
                <th className="py-2.5 px-3">Fornecedor Principal</th>
                <th className="py-2.5 px-3">Tipo de Contrato</th>
                <th className="py-2.5 px-3">Gestor</th>
                <th className="py-2.5 px-3 text-right">Estações</th>
                <th className="py-2.5 px-3 text-right">UFs</th>
                <th className="py-2.5 px-3 text-right">Custos</th>
                <th className="py-2.5 px-3 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {byContract.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#68756E]">
                    Nenhum contrato encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                byContract.map((c) => {
                  const isActive = activeContract === c.contrato;
                  return (
                    <tr
                      key={c.contrato}
                      onClick={() => onToggleContractFilter(c.contrato)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {c.contrato}
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#315F52] text-white">
                              Filtrado
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#1E3A32] font-medium max-w-[230px] truncate">
                        {c.fornecedorPrincipal || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                        {c.tipoContrato || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] max-w-[160px] truncate">
                        {c.gestor || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums">
                        {formatInt(c.stations)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums">
                        {formatInt(c.ufs)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-700 tabular-nums whitespace-nowrap">
                        {formatBrlCompact(c.grossCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                        {formatBrl(c.netTotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs min-w-[880px]">
            <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
              <tr>
                <th className="py-2.5 px-3">Estação</th>
                <th className="py-2.5 px-3">UF</th>
                <th className="py-2.5 px-3">Cidade</th>
                <th className="py-2.5 px-3">Tipo Contrato</th>
                <th className="py-2.5 px-3">Operação</th>
                <th className="py-2.5 px-3">Status Fin.</th>
                <th className="py-2.5 px-3">Contrato Principal</th>
                <th className="py-2.5 px-3 text-right">Linhas</th>
                <th className="py-2.5 px-3 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {byStation.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#68756E]">
                    Nenhuma estação encontrada para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                byStation.map((st) => {
                  const isActive = activeStation === st.estacao;
                  return (
                    <tr
                      key={st.estacao}
                      onClick={() => onToggleStationFilter(st.estacao)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-extrabold text-[#1E3A32] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {st.estacao}
                          {isActive && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#315F52] text-white">
                              Filtrada
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#1E3A32] whitespace-nowrap">
                        {st.uf || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] max-w-[160px] truncate">
                        {st.cidade || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                        {st.tipoContrato || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                        {st.tipoOperacao || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                        {st.statusFin || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[#52605A] tabular-nums whitespace-nowrap">
                        {st.contratoPrincipal || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#68756E] tabular-nums">
                        {formatInt(st.rows)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                        {formatBrl(st.netTotal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
