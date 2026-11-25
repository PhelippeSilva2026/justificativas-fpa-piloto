import React, { useState } from 'react';
import { BookOpen, Building2, Tags, Users } from 'lucide-react';
import {
  RealEstateAccountRow,
  RealEstateClassificationRow,
  RealEstateCostCenterRow,
  RealEstateSupplierRow,
} from '../../types/realEstate';
import { formatBrl, formatBrlCompact, formatInt } from './realEstateFormatters';

interface RealEstateBreakdownGridProps {
  byCostCenter: RealEstateCostCenterRow[];
  byClassification: RealEstateClassificationRow[];
  bySupplier: RealEstateSupplierRow[];
  byAccount: RealEstateAccountRow[];
  activeCc: string;
  activeClassification: string;
  activeSupplier: string;
  onToggleCcFilter: (cc: string) => void;
  onToggleClassificationFilter: (classif: string) => void;
  onToggleSupplierFilter: (supplier: string) => void;
}

export const RealEstateBreakdownGrid: React.FC<RealEstateBreakdownGridProps> = ({
  byCostCenter,
  byClassification,
  bySupplier,
  byAccount,
  activeCc,
  activeClassification,
  activeSupplier,
  onToggleCcFilter,
  onToggleClassificationFilter,
  onToggleSupplierFilter,
}) => {
  const [leftTab, setLeftTab] = useState<'classification' | 'cc'>('classification');
  const [rightTab, setRightTab] = useState<'supplier' | 'account'>('supplier');

  const maxCcAbs = Math.max(1, ...byCostCenter.map((c) => Math.abs(c.netTotal)));
  const maxClassifAbs = Math.max(1, ...byClassification.map((c) => Math.abs(c.netTotal)));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Esquerda: Classificação FP&A x TIPO_RE | Centro de Custo */}
      <div className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E6EBE4]">
          <div>
            <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
              {leftTab === 'classification'
                ? 'Classificação FP&A × TIPO_RE'
                : 'Abertura por Centro de Custo'}
            </h2>
            <p className="text-xs text-[#52605A] mt-0.5">
              {leftTab === 'classification'
                ? 'Rentals, Facilities, Água, Comodato, Venda de Prédios e Conectividade Internacional.'
                : 'Clique em um Centro de Custo para aplicar filtro cruzado.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => setLeftTab('classification')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                leftTab === 'classification'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <Tags className="w-3.5 h-3.5" />
              <span>Linhas RE</span>
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('cc')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                leftTab === 'cc'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Centros de Custo</span>
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[420px] overflow-y-auto border border-[#D5DCD2] rounded-xl">
          {leftTab === 'classification' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                <tr>
                  <th className="py-2.5 px-3">Classificação FP&amp;A / TIPO_RE</th>
                  <th className="py-2.5 px-3 text-right">Custos</th>
                  <th className="py-2.5 px-3 text-right">Créditos</th>
                  <th className="py-2.5 px-3 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE4]">
                {byClassification.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#68756E]">
                      Nenhuma classificação encontrada.
                    </td>
                  </tr>
                ) : (
                  byClassification.map((row, i) => {
                    const isActive = activeClassification === row.classificacao;
                    const barPct = Math.max(3, Math.round((Math.abs(row.netTotal) / maxClassifAbs) * 100));

                    return (
                      <tr
                        key={`${row.classificacao}-${row.tipoRe}-${i}`}
                        onClick={() => onToggleClassificationFilter(row.classificacao)}
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1E3A32] truncate max-w-[230px]">
                              {row.classificacao}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#315F52] text-white shrink-0">
                                Ativo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#52605A] tabular-nums">
                            TIPO_RE: {row.tipoRe} · {formatInt(row.rows)} lin.
                          </div>
                          <svg className="w-full h-1 mt-1.5" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true">
                            <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#E6EBE4" />
                            <rect x="0" y="0" width={barPct} height="3" rx="1.5" fill={isActive ? '#315F52' : '#4F927F'} />
                          </svg>
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-700 tabular-nums whitespace-nowrap">
                          {formatBrlCompact(row.grossCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                          +{formatBrlCompact(row.grossCredit)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                          {formatBrl(row.netTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                <tr>
                  <th className="py-2.5 px-3">Centro de Custo</th>
                  <th className="py-2.5 px-3 text-right">Est. / Ctto</th>
                  <th className="py-2.5 px-3 text-right">Custos</th>
                  <th className="py-2.5 px-3 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE4]">
                {byCostCenter.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#68756E]">
                      Nenhum Centro de Custo encontrado.
                    </td>
                  </tr>
                ) : (
                  byCostCenter.map((cc) => {
                    const isActive = activeCc === cc.cc;
                    const barPct = Math.max(3, Math.round((Math.abs(cc.netTotal) / maxCcAbs) * 100));

                    return (
                      <tr
                        key={cc.cc}
                        onClick={() => onToggleCcFilter(cc.cc)}
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1E3A32] tabular-nums">{cc.cc}</span>
                            {isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#315F52] text-white">
                                Ativo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#52605A] truncate max-w-[230px]">
                            {cc.ccDesc || 'Sem descrição'}
                          </div>
                          <svg className="w-full h-1 mt-1.5" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true">
                            <rect x="0" y="0" width="100" height="3" rx="1.5" fill="#E6EBE4" />
                            <rect x="0" y="0" width={barPct} height="3" rx="1.5" fill={isActive ? '#315F52' : '#4F927F'} />
                          </svg>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                          {formatInt(cc.stations)} / {formatInt(cc.contracts)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                          {formatBrlCompact(cc.grossCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
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

      {/* Direita: Fornecedores / Locadores & Contas Contábeis */}
      <div className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E6EBE4]">
          <div>
            <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
              {rightTab === 'supplier'
                ? 'Principais Fornecedores e Locadores'
                : 'Abertura por Conta Contábil'}
            </h2>
            <p className="text-xs text-[#52605A] mt-0.5">
              {rightTab === 'supplier'
                ? 'Clique em um fornecedor para aplicar filtro cruzado.'
                : 'Aluguel, IPTU, Condomínio, Manutenção, Limpeza, Água e Receitas.'}
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-[#F3F6F3] p-1 border border-[#D5DCD2]">
            <button
              type="button"
              onClick={() => setRightTab('supplier')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                rightTab === 'supplier'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Fornecedores</span>
            </button>
            <button
              type="button"
              onClick={() => setRightTab('account')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                rightTab === 'account'
                  ? 'bg-[#315F52] text-white'
                  : 'text-[#52605A] hover:text-[#1E3A32]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Contas</span>
            </button>
          </div>
        </div>

        <div className="mt-3 max-h-[420px] overflow-y-auto border border-[#D5DCD2] rounded-xl">
          {rightTab === 'supplier' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                <tr>
                  <th className="py-2.5 px-3">Fornecedor</th>
                  <th className="py-2.5 px-3 text-right">Cttos / Est.</th>
                  <th className="py-2.5 px-3 text-right">Custos</th>
                  <th className="py-2.5 px-3 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE4]">
                {bySupplier.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#68756E]">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                ) : (
                  bySupplier.map((sup) => {
                    const isActive = activeSupplier === sup.fornecedor;
                    return (
                      <tr
                        key={sup.fornecedor}
                        onClick={() => onToggleSupplierFilter(sup.fornecedor)}
                        className={`cursor-pointer transition-colors ${
                          isActive ? 'bg-[#EBF2EE]' : 'hover:bg-[#FAFBF9]'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#1E3A32] flex items-center gap-1.5">
                            <span className="truncate max-w-[230px]">{sup.fornecedor}</span>
                            {isActive && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#315F52] text-white shrink-0">
                                Ativo
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#68756E] tabular-nums">
                            {formatInt(sup.rows)} lançamentos
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                          {formatInt(sup.contracts)} / {formatInt(sup.stations)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                          {formatBrlCompact(sup.grossCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                          {formatBrl(sup.netTotal)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F3F6F3] text-[11px] font-bold text-[#52605A] sticky top-0 border-b border-[#D5DCD2]">
                <tr>
                  <th className="py-2.5 px-3">Conta Contábil</th>
                  <th className="py-2.5 px-3 text-right">Linhas</th>
                  <th className="py-2.5 px-3 text-right">Custos</th>
                  <th className="py-2.5 px-3 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6EBE4]">
                {byAccount.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[#68756E]">
                      Nenhuma conta encontrada.
                    </td>
                  </tr>
                ) : (
                  byAccount.map((acc) => (
                    <tr key={acc.conta} className="hover:bg-[#FAFBF9]">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-[#1E3A32] tabular-nums">{acc.conta}</div>
                        <div className="text-[11px] text-[#52605A] truncate max-w-[240px]">
                          {acc.contaDesc || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#68756E] tabular-nums">
                        {formatInt(acc.rows)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[#52605A] tabular-nums whitespace-nowrap">
                        {formatBrlCompact(acc.grossCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-extrabold text-[#1E3A32] tabular-nums whitespace-nowrap">
                        {formatBrl(acc.netTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
};
