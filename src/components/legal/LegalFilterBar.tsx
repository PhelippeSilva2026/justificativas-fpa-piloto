import React from 'react';
import { RotateCcw, Search, X } from 'lucide-react';
import { LegalFilterOptions, LegalFilterState } from '../../types/legal';
import { formatAnomesLabel, formatBrlCompact } from './legalFormatters';

interface LegalFilterBarProps {
  filters: LegalFilterState;
  options: LegalFilterOptions | null;
  onChange: (patch: Partial<LegalFilterState>) => void;
  onReset: () => void;
}

export const LegalFilterBar: React.FC<LegalFilterBarProps> = ({
  filters,
  options,
  onChange,
  onReset,
}) => {
  const activeTags: { key: keyof LegalFilterState; label: string; value: string }[] = [];

  if (filters.classificacao !== 'ALL') {
    const match = options?.classifications.find((c) => c.value === filters.classificacao);
    activeTags.push({
      key: 'classificacao',
      label: 'Classificação FP&A',
      value: match?.label || filters.classificacao,
    });
  }
  if (filters.diretoria !== 'ALL') {
    const match = options?.diretorias.find((d) => d.value === filters.diretoria);
    activeTags.push({
      key: 'diretoria',
      label: 'Diretoria',
      value: match?.label || filters.diretoria,
    });
  }
  if (filters.gerencia !== 'ALL') {
    const match = options?.gerencias.find((g) => g.value === filters.gerencia);
    activeTags.push({
      key: 'gerencia',
      label: 'Gerência',
      value: match?.label || filters.gerencia,
    });
  }
  if (filters.descricao !== 'ALL') {
    const match = options?.descricoes.find((d) => d.value === filters.descricao);
    activeTags.push({
      key: 'descricao',
      label: 'Descrição',
      value: match?.label || filters.descricao,
    });
  }
  if (filters.pais !== 'ALL') {
    const match = options?.paises.find((p) => p.value === filters.pais);
    activeTags.push({
      key: 'pais',
      label: 'País',
      value: match?.label || filters.pais,
    });
  }
  if (filters.centroCusto !== 'ALL') {
    const match = options?.costCenters.find((c) => c.value === filters.centroCusto);
    activeTags.push({
      key: 'centroCusto',
      label: 'Ccusto S4H',
      value: match?.label || filters.centroCusto,
    });
  }
  if (filters.fornecedor !== 'ALL') {
    const match = options?.suppliers.find((s) => s.value === filters.fornecedor);
    activeTags.push({
      key: 'fornecedor',
      label: 'Fornecedor',
      value: match?.label || filters.fornecedor,
    });
  }
  if (filters.contaRazao !== 'ALL') {
    const match = options?.accounts.find((a) => a.value === filters.contaRazao);
    activeTags.push({
      key: 'contaRazao',
      label: 'Conta Razão',
      value: match?.label || filters.contaRazao,
    });
  }
  if (filters.pedidoCompra !== 'ALL') {
    activeTags.push({
      key: 'pedidoCompra',
      label: 'Pedido / Contrato',
      value: filters.pedidoCompra,
    });
  }
  if (filters.atribuicao !== 'ALL') {
    activeTags.push({
      key: 'atribuicao',
      label: 'Atribuição',
      value: filters.atribuicao === '__EMPTY__' ? 'Sem Atribuição' : filters.atribuicao,
    });
  }
  if (filters.anomes !== 'ALL') {
    activeTags.push({
      key: 'anomes',
      label: 'Mês',
      value: formatAnomesLabel(filters.anomes),
    });
  }
  if (filters.search.trim()) {
    activeTags.push({ key: 'search', label: 'Busca', value: `"${filters.search.trim()}"` });
  }

  const selectClass =
    'w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52] focus:bg-white transition-colors truncate';
  const labelClass = 'block text-[11px] font-bold text-[#52605A] mb-1 truncate';

  return (
    <section className="bg-white border border-[#D5DCD2] shadow-xs rounded-2xl p-4 sm:p-5">
      {activeTags.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#52605A] hover:text-[#1E3A32] bg-white hover:bg-[#F3F6F3] border border-[#D5DCD2] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar filtros ({activeTags.length})</span>
          </button>
        </div>
      )}

      {/* Linha 1: Os 5 filtros principais de Legal no GCP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
        <div>
          <label htmlFor="legal-filter-classificacao" className={labelClass}>
            Classificação FP&amp;A
          </label>
          <select
            id="legal-filter-classificacao"
            value={filters.classificacao}
            onChange={(e) => onChange({ classificacao: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todas as Classificações FP&amp;A</option>
            {options?.classifications.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({formatBrlCompact(opt.actTotal || 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-diretoria" className={labelClass}>
            Diretoria
          </label>
          <select
            id="legal-filter-diretoria"
            value={filters.diretoria}
            onChange={(e) => onChange({ diretoria: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todas as Diretorias</option>
            {options?.diretorias.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({formatBrlCompact(opt.actTotal || 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-gerencia" className={labelClass}>
            Gerência
          </label>
          <select
            id="legal-filter-gerencia"
            value={filters.gerencia}
            onChange={(e) => onChange({ gerencia: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todas as Gerências</option>
            {options?.gerencias.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({formatBrlCompact(opt.actTotal || 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-descricao" className={labelClass}>
            Descrição
          </label>
          <select
            id="legal-filter-descricao"
            value={filters.descricao}
            onChange={(e) => onChange({ descricao: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todas as Descrições</option>
            {options?.descricoes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({formatBrlCompact(opt.actTotal || 0)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-pais" className={labelClass}>
            País
          </label>
          <select
            id="legal-filter-pais"
            value={filters.pais}
            onChange={(e) => onChange({ pais: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todos os Países</option>
            {options?.paises.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({formatBrlCompact(opt.actTotal || 0)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 2: Filtros complementares contábeis e operacionais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        <div>
          <label htmlFor="legal-filter-cc" className={labelClass}>
            Centro de Custo (Ccusto S4H)
          </label>
          <select
            id="legal-filter-cc"
            value={filters.centroCusto}
            onChange={(e) => onChange({ centroCusto: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todos os Centros de Custo</option>
            {options?.costCenters.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-fornecedor" className={labelClass}>
            Fornecedor / Escritório
          </label>
          <select
            id="legal-filter-fornecedor"
            value={filters.fornecedor}
            onChange={(e) => onChange({ fornecedor: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todos os Fornecedores</option>
            {options?.suppliers.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-conta" className={labelClass}>
            Conta Razão &amp; Descrição
          </label>
          <select
            id="legal-filter-conta"
            value={filters.contaRazao}
            onChange={(e) => onChange({ contaRazao: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todas as Contas Razão</option>
            {options?.accounts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 3: Competência, Pedido/Contrato e Busca rápida */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label htmlFor="legal-filter-anomes" className={labelClass}>
            Competência (Mês 2026)
          </label>
          <select
            id="legal-filter-anomes"
            value={filters.anomes}
            onChange={(e) => onChange({ anomes: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Ano Completo / Todos os Meses</option>
            {options?.months.map((m) => (
              <option key={m} value={m}>
                {formatAnomesLabel(m)} ({m})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-po" className={labelClass}>
            Pedido de Compra / Contrato
          </label>
          <select
            id="legal-filter-po"
            value={filters.pedidoCompra}
            onChange={(e) => onChange({ pedidoCompra: e.target.value })}
            className={selectClass}
          >
            <option value="ALL">Todos os Pedidos e Contratos</option>
            {options?.purchaseOrders.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="legal-filter-search" className={labelClass}>
            Busca rápida (Texto, Atribuição, PO, Fornecedor)
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#68756E] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="legal-filter-search"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ search: e.target.value })}
              placeholder="Ex: Massa, Trabalhista, 45000..."
              className="w-full h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] focus:bg-white pl-8 pr-8 text-xs font-medium text-[#1E3A32] placeholder:text-[#8E9B95] outline-none focus:border-[#315F52] transition-colors"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ search: '' })}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#68756E] hover:text-[#1E3A32] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filtros ativos interativos (botões de remoção) */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-[#E6EBE4]">
          <span className="text-[11px] font-semibold text-[#52605A]">Filtros ativos:</span>
          {activeTags.map((tag) => (
            <button
              key={tag.key}
              type="button"
              onClick={() =>
                onChange({ [tag.key]: tag.key === 'search' ? '' : 'ALL' } as Partial<LegalFilterState>)
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-[#315F52] hover:bg-[#274D42] text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="text-white/80">{tag.label}:</span>
              <span className="max-w-[200px] truncate">{tag.value}</span>
              <X className="w-3 h-3 text-white/80" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
