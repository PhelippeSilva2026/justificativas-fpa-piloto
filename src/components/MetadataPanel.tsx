import React, { useState, useMemo } from 'react';
import { DRERow } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { User, Layers, Tag, Search, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MetadataPanelProps {
  rows: DRERow[];
  selectedRow: DRERow;
  onSelectRow: (row: DRERow) => void;
  monthPreviousName: string;
  monthCurrentName: string;
}

export const MetadataPanel: React.FC<MetadataPanelProps> = ({
  rows,
  selectedRow,
  onSelectRow,
  monthPreviousName,
  monthCurrentName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      (r) =>
        r.n3.toLowerCase().includes(term) ||
        r.n2.toLowerCase().includes(term) ||
        r.n1.toLowerCase().includes(term) ||
        r.responsavel.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#A7AC98]/60 shadow-sm flex flex-col space-y-5">
      {/* SELEÇÃO DE N3 (DROPDOWN / PESQUISA) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-[#14412A]">
            Subcategoria de Despesa (N3)
          </label>
          <span className="text-[11px] text-[#6E7769] font-medium">
            {rows.length} itens cadastrados
          </span>
        </div>

        <div className="relative">
          <select
            value={selectedRow.id}
            onChange={(e) => {
              const found = rows.find((r) => r.id === e.target.value);
              if (found) onSelectRow(found);
            }}
            className="w-full appearance-none bg-[#F6F2EE] border border-[#A7AC98] text-[#192B1C] font-semibold text-sm rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#14412A] cursor-pointer"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.n3} ({r.n1} - {r.n2})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#14412A]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Campo de busca rápida se houver muitas linhas */}
        {rows.length > 5 && (
          <div className="relative mt-2">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#6E7769]" />
            <input
              type="text"
              placeholder="Filtrar por nome, categoria ou gestor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#DCD8D2] text-xs rounded-xl pl-9 pr-3 py-2 text-[#192B1C] focus:outline-none focus:border-[#14412A]"
            />
            {searchTerm && (
              <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#A7AC98] rounded-2xl shadow-lg divide-y divide-[#F6F2EE]">
                {filteredRows.length === 0 ? (
                  <div className="p-3 text-xs text-[#6E7769] text-center">Nenhum resultado encontrado</div>
                ) : (
                  filteredRows.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        onSelectRow(r);
                        setSearchTerm('');
                      }}
                      className="w-full text-left p-2.5 hover:bg-[#F6F2EE] text-xs flex flex-col"
                    >
                      <span className="font-semibold text-[#192B1C]">{r.n3}</span>
                      <span className="text-[10px] text-[#6E7769]">{r.n1} | {r.n2}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* METADADOS DA LINHA SELECIONADA */}
      <div className="bg-[#F6F2EE] rounded-2xl p-4 space-y-3 border border-[#A7AC98]/40">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#14412A]/10 flex items-center justify-center text-[#14412A] shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6E7769] uppercase tracking-wide">
              Responsável / Gestor
            </div>
            <div className="text-xs font-bold text-[#192B1C]">
              {selectedRow.responsavel}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#DCD8D2]">
          <div className="flex items-start gap-2">
            <Layers className="w-3.5 h-3.5 text-[#14412A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-[#6E7769] font-medium">N1 (Grupo)</div>
              <div className="text-xs font-semibold text-[#192B1C]">{selectedRow.n1}</div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Tag className="w-3.5 h-3.5 text-[#14412A] shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] text-[#6E7769] font-medium">N2 (Categoria)</div>
              <div className="text-xs font-semibold text-[#192B1C]">{selectedRow.n2}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CARDS DE VALORES DRE: MÊS & YTD */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#14412A]">Resumo Orçamentário (Mês)</span>
          <span className="text-[11px] text-[#6E7769]">
            {monthPreviousName} → {monthCurrentName}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Real M-1 */}
          <div className="bg-[#F6F2EE] rounded-2xl p-3 border border-[#A7AC98]/40">
            <div className="text-[10px] text-[#6E7769] font-medium leading-tight">Real M-1</div>
            <div className="text-xs font-bold text-[#192B1C] mt-1">
              {formatCurrency(selectedRow.realMMinus1, true)}
            </div>
            <div className="text-[9px] text-[#6E7769] mt-0.5">{monthPreviousName}</div>
          </div>

          {/* Real Atual */}
          <div className="bg-[#14412A]/5 rounded-2xl p-3 border border-[#14412A]/20">
            <div className="text-[10px] text-[#14412A] font-bold leading-tight">Real 2026</div>
            <div className="text-xs font-bold text-[#14412A] mt-1">
              {formatCurrency(selectedRow.realCurrent, true)}
            </div>
            <div className="text-[9px] text-[#14412A]/80 mt-0.5">{monthCurrentName}</div>
          </div>

          {/* Orçado Atual */}
          <div className="bg-[#F6F2EE] rounded-2xl p-3 border border-[#A7AC98]/40">
            <div className="text-[10px] text-[#6E7769] font-medium leading-tight">Orçado 2026</div>
            <div className="text-xs font-bold text-[#192B1C] mt-1">
              {formatCurrency(selectedRow.orcadoCurrent, true)}
            </div>
            <div className="text-[9px] text-[#6E7769] mt-0.5">Budget Mês</div>
          </div>
        </div>

        {/* Variações Mês */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* MoM */}
          <div className="p-2.5 rounded-2xl border border-[#DCD8D2] bg-white flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#6E7769]">Variação MoM</div>
              <div className="font-bold text-[#192B1C]">
                {formatCurrency(selectedRow.diffMMinus1Abs, true)}
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                selectedRow.diffMMinus1Abs > 0
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {selectedRow.diffMMinus1Abs > 0 ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {formatPercent(selectedRow.diffMMinus1Pct)}
            </span>
          </div>

          {/* Vs Orçado */}
          <div className="p-2.5 rounded-2xl border border-[#DCD8D2] bg-white flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#6E7769]">Vs Orçado Mês</div>
              <div className="font-bold text-[#192B1C]">
                {formatCurrency(selectedRow.diffOrcadoAbs, true)}
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                selectedRow.diffOrcadoAbs > 0
                  ? 'bg-red-100 text-red-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {selectedRow.diffOrcadoAbs > 0 ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {formatPercent(selectedRow.diffOrcadoPct)}
            </span>
          </div>
        </div>

        {/* Resumo YTD */}
        <div className="pt-2 border-t border-[#DCD8D2]/60">
          <div className="text-xs font-bold text-[#14412A] mb-1.5">Acumulado do Ano (YTD)</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-2xl bg-[#F6F2EE] border border-[#A7AC98]/40">
              <div className="text-[10px] text-[#6E7769]">Real YTD</div>
              <div className="text-xs font-bold text-[#192B1C]">
                {formatCurrency(selectedRow.realYTD, true)}
              </div>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#F6F2EE] border border-[#A7AC98]/40">
              <div className="text-[10px] text-[#6E7769]">Orçado YTD</div>
              <div className="text-xs font-bold text-[#192B1C]">
                {formatCurrency(selectedRow.orcadoYTD, true)}
              </div>
            </div>
          </div>

          <div className="mt-2 p-2 rounded-2xl bg-white border border-[#DCD8D2] flex items-center justify-between text-xs">
            <span className="text-[10px] text-[#6E7769] font-medium">Desvio YTD vs Orçado:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#192B1C]">
                {formatCurrency(selectedRow.diffOrcadoYTDAbs, true)}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedRow.diffOrcadoYTDAbs > 0
                    ? 'bg-red-100 text-red-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {formatPercent(selectedRow.diffOrcadoYTDPct)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
