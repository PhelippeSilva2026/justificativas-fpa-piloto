import React from 'react';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { RealEstateLedgerResponse } from '../../types/realEstate';
import { formatAnomesLabel, formatBrl, formatInt } from './realEstateFormatters';

export type RealEstateLedgerSort = 'valor_abs' | 'valor_asc' | 'valor_desc' | 'recent';

interface RealEstateLedgerTableProps {
  ledger: RealEstateLedgerResponse | null;
  isLoading: boolean;
  sortBy: RealEstateLedgerSort;
  onChangeSortBy: (sort: RealEstateLedgerSort) => void;
  onChangePage: (page: number) => void;
}

export const RealEstateLedgerTable: React.FC<RealEstateLedgerTableProps> = ({
  ledger,
  isLoading,
  sortBy,
  onChangeSortBy,
  onChangePage,
}) => {
  const rows = ledger?.rows || [];
  const currentPage = ledger?.page || 1;
  const totalPages = ledger?.totalPages || 1;
  const totalCount = ledger?.totalCount || 0;

  return (
    <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6EBE4]">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#315F52]" />
            <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
              Razão Contábil Detalhado · Real Estate (DRE_FINAL)
            </h2>
          </div>
          <p className="text-xs text-[#52605A] mt-0.5 tabular-nums">
            {formatInt(totalCount)} registros encontrados · página {formatInt(currentPage)} de{' '}
            {formatInt(totalPages)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="re-ledger-sort" className="text-xs font-semibold text-[#52605A]">
            Ordenar por:
          </label>
          <select
            id="re-ledger-sort"
            value={sortBy}
            onChange={(e) => onChangeSortBy(e.target.value as RealEstateLedgerSort)}
            className="h-9 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] px-3 text-xs font-semibold text-[#1E3A32] outline-none focus:border-[#315F52]"
          >
            <option value="valor_abs">Maior Valor Absoluto</option>
            <option value="valor_asc">Maior Custo (Mais Negativo)</option>
            <option value="valor_desc">Maior Receita/Crédito (Mais Positivo)</option>
            <option value="recent">Competência Mais Recente</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border border-[#D5DCD2] rounded-xl">
        <table className="w-full text-left text-xs min-w-[1180px]">
          <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] border-b border-[#D5DCD2]">
            <tr>
              <th className="py-2.5 px-3">Comp.</th>
              <th className="py-2.5 px-3">País</th>
              <th className="py-2.5 px-3">Classificação / TIPO_RE</th>
              <th className="py-2.5 px-3">Centro de Custo</th>
              <th className="py-2.5 px-3">Conta</th>
              <th className="py-2.5 px-3">Fornecedor</th>
              <th className="py-2.5 px-3">Contrato RE</th>
              <th className="py-2.5 px-3">Estação / Operação</th>
              <th className="py-2.5 px-3">UF / Cidade</th>
              <th className="py-2.5 px-3">Texto / Histórico</th>
              <th className="py-2.5 px-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6EBE4]">
            {isLoading && rows.length === 0 ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td colSpan={11} className="py-3 px-3">
                    <div className="h-4 bg-[#F3F6F3] rounded w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-[#68756E]">
                  Nenhum lançamento contábil para os filtros atuais.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={`${r.documento}-${idx}`} className="hover:bg-[#FAFBF9]">
                  <td className="py-2.5 px-3 font-semibold text-[#1E3A32] whitespace-nowrap">
                    {formatAnomesLabel(r.anomes)}
                  </td>
                  <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                    {r.pais || 'Brasil'}
                  </td>
                  <td className="py-2.5 px-3 text-[#1E3A32] whitespace-nowrap">
                    <div className="font-semibold max-w-[175px] truncate">{r.classificacao || '—'}</div>
                    <div className="text-[10px] text-[#68756E] max-w-[175px] truncate">
                      {r.tipoRe || '—'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[#1E3A32] whitespace-nowrap">
                    <div className="font-semibold tabular-nums">{r.cc || '—'}</div>
                    <div className="text-[10px] text-[#68756E] max-w-[130px] truncate">
                      {r.ccDesc}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                    <div className="font-medium tabular-nums">{r.conta || '—'}</div>
                    <div className="text-[10px] text-[#68756E] max-w-[140px] truncate">
                      {r.contaDesc}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-[#1E3A32] max-w-[170px] truncate">
                    {r.fornecedor || '—'}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-[#1E3A32] tabular-nums whitespace-nowrap">
                    {r.contrato || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-[#1E3A32] whitespace-nowrap">
                    <div className="font-semibold">{r.estacao || '—'}</div>
                    <div className="text-[10px] text-[#68756E]">{r.tipoOperacao || ''}</div>
                  </td>
                  <td className="py-2.5 px-3 text-[#52605A] whitespace-nowrap">
                    {r.uf || '—'}
                    {r.cidade ? ` · ${r.cidade}` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-[#52605A] max-w-[210px] truncate" title={r.texto}>
                    {r.texto || '—'}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-extrabold tabular-nums whitespace-nowrap ${
                      r.valor > 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatBrl(r.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="text-[#52605A] tabular-nums">
          Exibindo {rows.length} de {formatInt(totalCount)} lançamentos
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoading || currentPage <= 1}
            onClick={() => onChangePage(currentPage - 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D5DCD2] bg-white hover:bg-[#FAFBF9] font-semibold text-[#1E3A32] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Anterior</span>
          </button>

          <span className="px-2.5 font-bold text-[#1E3A32] tabular-nums">
            {formatInt(currentPage)} / {formatInt(totalPages)}
          </span>

          <button
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            onClick={() => onChangePage(currentPage + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#D5DCD2] bg-white hover:bg-[#FAFBF9] font-semibold text-[#1E3A32] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Próxima</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
