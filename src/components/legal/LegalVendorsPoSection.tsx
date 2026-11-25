import React, { useState } from 'react';
import {
  LegalFilterState,
  LegalPurchaseOrderRow,
  LegalSupplierRow,
  LegalTextAtribRow,
} from '../../types/legal';
import { formatBrl, formatInt } from './legalFormatters';

type DeepDiveTab = 'fornecedores' | 'pedidos' | 'atribuicao_texto';

interface LegalVendorsPoSectionProps {
  bySupplier: LegalSupplierRow[];
  byPurchaseOrder: LegalPurchaseOrderRow[];
  byTextAtribuicao: LegalTextAtribRow[];
  filters: LegalFilterState;
  onSelectFilter: (patch: Partial<LegalFilterState>) => void;
}

export const LegalVendorsPoSection: React.FC<LegalVendorsPoSectionProps> = ({
  bySupplier,
  byPurchaseOrder,
  byTextAtribuicao,
  filters,
  onSelectFilter,
}) => {
  const [activeTab, setActiveTab] = useState<DeepDiveTab>('fornecedores');

  return (
    <section className="bg-white border border-[#D5DCD2] shadow-xs rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="inline-flex items-center p-1 bg-[#F3F6F3] border border-[#D5DCD2] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('fornecedores')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'fornecedores'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Fornecedores ({bySupplier.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pedidos')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'pedidos'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Pedidos &amp; Contratos ({byPurchaseOrder.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('atribuicao_texto')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'atribuicao_texto'
                ? 'bg-[#315F52] text-white'
                : 'text-[#52605A] hover:text-[#1E3A32]'
            }`}
          >
            Atribuição &amp; Texto ({byTextAtribuicao.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-[#D5DCD2] rounded-xl max-h-[460px] overflow-y-auto">
        {activeTab === 'fornecedores' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F3F6F3] border-b border-[#D5DCD2] text-[11px] text-[#52605A] font-bold">
                <th className="py-2.5 px-3">Fornecedor / Escritório</th>
                <th className="py-2.5 px-3">Gerência Principal</th>
                <th className="py-2.5 px-3 text-right">POs</th>
                <th className="py-2.5 px-3 text-right">Cttos</th>
                <th className="py-2.5 px-3 text-right">Contas</th>
                <th className="py-2.5 px-3 text-right">Lanç. ACT</th>
                <th className="py-2.5 px-3 text-right">Realizado (ACT 26)</th>
                <th className="py-2.5 px-3 text-right">FCST 8+4</th>
                <th className="py-2.5 px-3 text-right">FCST 4+8</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {bySupplier.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#68756E]">
                    Nenhum fornecedor encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                bySupplier.map((row) => {
                  const filterVal =
                    row.fornecedor === 'Sem Fornecedor' ? '__EMPTY__' : row.fornecedor;
                  const isSelected = filters.fornecedor === filterVal;

                  return (
                    <tr
                      key={row.fornecedor}
                      onClick={() =>
                        onSelectFilter({
                          fornecedor: isSelected ? 'ALL' : filterVal,
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2 px-3 text-[#1E3A32] font-semibold max-w-[260px] truncate" title={row.fornecedor}>
                        {row.fornecedor}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[180px] truncate">
                        {row.mainGerencia || '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#52605A]">
                        {formatInt(row.posCount)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#52605A]">
                        {formatInt(row.contractsCount)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#52605A]">
                        {formatInt(row.accountsCount)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#68756E]">
                        {formatInt(row.actRows)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-[#1E3A32]">
                        {formatBrl(row.actTotal)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#52605A]">
                        {formatBrl(row.fct84Total)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#68756E]">
                        {formatBrl(row.fct48Total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'pedidos' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F3F6F3] border-b border-[#D5DCD2] text-[11px] text-[#52605A] font-bold">
                <th className="py-2.5 px-3">Documento</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Fornecedor</th>
                <th className="py-2.5 px-3">Descrição</th>
                <th className="py-2.5 px-3">Gerência</th>
                <th className="py-2.5 px-3">Atribuição</th>
                <th className="py-2.5 px-3">Texto</th>
                <th className="py-2.5 px-3 text-right">ACT 26</th>
                <th className="py-2.5 px-3 text-right">FCST 8+4</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {byPurchaseOrder.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#68756E]">
                    Nenhum Pedido de Compra ou Contrato encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                byPurchaseOrder.map((row) => {
                  const isSelected = filters.pedidoCompra === row.poOrContract;
                  return (
                    <tr
                      key={`${row.docKind}-${row.poOrContract}`}
                      onClick={() =>
                        onSelectFilter({
                          pedidoCompra: isSelected ? 'ALL' : row.poOrContract,
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2 px-3 font-mono text-xs font-bold text-[#1E3A32] whitespace-nowrap">
                        {row.poOrContract}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] whitespace-nowrap">
                        {row.docKind}
                      </td>
                      <td className="py-2 px-3 text-[#1E3A32] max-w-[180px] truncate" title={row.fornecedor}>
                        {row.fornecedor}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] whitespace-nowrap">
                        {row.ccDesc}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[140px] truncate">
                        {row.gerencia}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[130px] truncate" title={row.atribuicao}>
                        {row.atribuicao || '—'}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[220px] truncate" title={row.texto}>
                        {row.texto || '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-[#1E3A32]">
                        {formatBrl(row.actTotal)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#52605A]">
                        {formatBrl(row.fct84Total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'atribuicao_texto' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#F3F6F3] border-b border-[#D5DCD2] text-[11px] text-[#52605A] font-bold">
                <th className="py-2.5 px-3">Atribuição</th>
                <th className="py-2.5 px-3">Texto / Descrição do Lançamento</th>
                <th className="py-2.5 px-3">Conta Razão</th>
                <th className="py-2.5 px-3">Fornecedor</th>
                <th className="py-2.5 px-3">Descrição Ccusto S4H</th>
                <th className="py-2.5 px-3 text-right">Lanç.</th>
                <th className="py-2.5 px-3 text-right">Realizado (ACT 26)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6EBE4]">
              {byTextAtribuicao.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#68756E]">
                    Nenhum registro encontrado para Atribuição e Texto nos filtros atuais.
                  </td>
                </tr>
              ) : (
                byTextAtribuicao.map((row, idx) => {
                  const atribFilter =
                    row.atribuicao === 'Sem Atribuição' ? '__EMPTY__' : row.atribuicao;
                  const isSelected = filters.atribuicao === atribFilter;

                  return (
                    <tr
                      key={`${row.atribuicao}-${row.texto}-${idx}`}
                      onClick={() =>
                        onSelectFilter({
                          atribuicao: isSelected ? 'ALL' : atribFilter,
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#EBF2EE] font-semibold' : 'hover:bg-[#FAFBF9]'
                      }`}
                    >
                      <td className="py-2 px-3 font-semibold text-[#1E3A32] max-w-[150px] truncate" title={row.atribuicao}>
                        {row.atribuicao}
                      </td>
                      <td className="py-2 px-3 text-[#1E3A32] max-w-[280px] truncate" title={row.texto}>
                        {row.texto}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[180px] truncate" title={row.contaDesc}>
                        {row.contaDesc || '—'}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] max-w-[160px] truncate" title={row.fornecedor}>
                        {row.fornecedor}
                      </td>
                      <td className="py-2 px-3 text-[#52605A] whitespace-nowrap">
                        {row.ccDesc}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-[#68756E]">
                        {formatInt(row.rows)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold text-[#1E3A32]">
                        {formatBrl(row.actTotal)}
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
