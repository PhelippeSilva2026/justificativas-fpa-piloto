import React from 'react';
import { CompanyId, DRERow, RowJustifications } from '../types';
import { formatCurrencyBRL, formatCurrencyShort } from '../utils/formatters';
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

interface SelectionCardProps {
  rows: DRERow[];
  selectedRowId: string | null;
  onSelectRow: (id: string) => void;
  selectedRow: DRERow | null;
  justifications: RowJustifications;
  onAutoReconcileAll?: () => void;
  currentCompany: CompanyId;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  rows,
  selectedRowId,
  onSelectRow,
  selectedRow,
  justifications,
  onAutoReconcileAll,
  currentCompany,
}) => {
  const isCorporate = currentCompany === 'vtal' || currentCompany === 'tecto';
  // Cálculo de pendências para o status de fechamento
  let isBalanced = false;
  let hasPending = false;
  let pendingSummary = '';

  if (selectedRow) {
    const momDelta = selectedRow.realCurrent - selectedRow.realMMinus1;
    const momSum = (justifications.momImpacts || []).reduce((acc, i) => acc + i.value, 0);
    const momPend = momDelta - momSum;

    const vsOrcDelta = selectedRow.realCurrent - selectedRow.orcadoCurrent;
    const vsOrcSum = (justifications.vsOrcadoImpacts || []).reduce((acc, i) => acc + i.value, 0);
    const vsOrcPend = vsOrcDelta - vsOrcSum;

    const ytdDelta = selectedRow.realYTD - selectedRow.orcadoYTD;
    const ytdSum = (justifications.ytdImpacts || []).reduce((acc, i) => acc + i.value, 0);
    const ytdPend = ytdDelta - ytdSum;

    const isMomOk = Math.abs(momPend) < 1;
    const isVsOrcOk = Math.abs(vsOrcPend) < 1;
    const isYtdOk = Math.abs(ytdPend) < 1;

    isBalanced = isMomOk && isVsOrcOk && isYtdOk;
    hasPending = !isBalanced;

    if (hasPending) {
      const pList: string[] = [];
      if (!isMomOk) pList.push(`MoM: ${formatCurrencyBRL(momPend)}`);
      if (!isVsOrcOk) pList.push(`Mês: ${formatCurrencyBRL(vsOrcPend)}`);
      if (!isYtdOk) pList.push(`YTD: ${formatCurrencyBRL(ytdPend)}`);
      pendingSummary = pList.join(' | ');
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#A7AC98]/40 shadow-sm flex flex-col justify-between h-full">
      {/* Topo do Card com Título e Contador */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#14412A]">
          2. Selecionar Linha de Despesa ({isCorporate ? 'Classificação FP&A' : 'N3'})
        </h2>
        <span className="text-xs text-[#8C9283] font-medium">
          {rows.length} {rows.length === 1 ? 'linha disponível' : 'linhas disponíveis'}
        </span>
      </div>

      {/* Select Dropdown estilizado como no layout */}
      <div className="relative my-3">
        <select
          value={selectedRowId || ''}
          onChange={(e) => onSelectRow(e.target.value)}
          disabled={rows.length === 0}
          className="w-full appearance-none bg-white border border-[#A7AC98]/80 text-[#192B1C] text-xs font-semibold rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#14412A] focus:border-transparent transition-all shadow-2xs disabled:bg-[#F6F2EE] disabled:text-[#8C9283] cursor-pointer"
        >
          {rows.length === 0 ? (
            <option value="">Aguardando carregamento da planilha...</option>
          ) : (
            rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.n3}
              </option>
            ))
          )}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#6E7769]">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {/* 4 Mini Cards de Metadados em uma única linha */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-2">
        {/* Caixa 1: DIRETORIA / ÁREA */}
        <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-2.5">
          <div className="text-[9px] font-bold text-[#768070] tracking-wider uppercase truncate">
            {isCorporate ? 'ÁREA' : 'DIRETORIA / ÁREA'}
          </div>
          <div
            className="text-xs font-bold text-[#14412A] truncate mt-0.5"
            title={selectedRow ? `${selectedRow.diretoria || '-'} > ${selectedRow.area || '-'}` : '-'}
          >
            {isCorporate
              ? selectedRow?.area || '-'
              : selectedRow
              ? selectedRow.diretoria && selectedRow.area
                ? `${selectedRow.diretoria} / ${selectedRow.area}`
                : selectedRow.area || selectedRow.diretoria || 'Consolidado'
              : '-'}
          </div>
        </div>

        {/* Caixa 2: GRUPO / N1 */}
        <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-2.5">
          <div className="text-[9px] font-bold text-[#768070] tracking-wider uppercase truncate">
            {isCorporate ? 'NÍVEL 3' : 'GRUPO / N1'}
          </div>
          <div className="text-xs font-bold text-[#14412A] truncate mt-0.5" title={selectedRow ? `${selectedRow.n1} / ${selectedRow.n2}` : '-'}>
            {selectedRow ? `${selectedRow.n1}` : '-'}
          </div>
        </div>

        {/* Caixa 3: RESPONSÁVEL */}
        <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-2.5">
          <div className="text-[9px] font-bold text-[#768070] tracking-wider uppercase truncate">
            {isCorporate ? 'NÍVEL 4' : 'RESPONSÁVEL'}
          </div>
          <div className="text-xs font-bold text-[#14412A] truncate mt-0.5" title={selectedRow?.responsavel || '-'}>
            {selectedRow?.responsavel || '-'}
          </div>
        </div>

        {/* Caixa 4: REAL VS ORÇADO MÊS */}
        <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-2.5">
          <div className="text-[9px] font-bold text-[#768070] tracking-wider uppercase truncate">
            REAL VS ORÇADO
          </div>
          <div className="text-xs font-bold text-[#14412A] truncate mt-0.5">
            {selectedRow
              ? `${formatCurrencyShort(selectedRow.realCurrent)} vs ${formatCurrencyShort(selectedRow.orcadoCurrent)}`
              : '-'}
          </div>
        </div>
      </div>

      {/* Footer com Status de Fechamento dos Desvios */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#F6F2EE] text-xs">
        <span className="text-[#6E7769] font-medium text-xs">
          Status de Fechamento dos Desvios:
        </span>

        {!selectedRow ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#F6F2EE] text-[#8C9283] border border-[#A7AC98]/40">
            Nenhum dado selecionado
          </span>
        ) : isBalanced ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#E8F8EE] text-[#14412A] border border-[#22C55E]/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
            100% Conciliado / Consistente
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300"
              title={pendingSummary}
            >
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Pendente ({pendingSummary || 'diferenças'})
            </span>
            {onAutoReconcileAll && (
              <button
                type="button"
                onClick={onAutoReconcileAll}
                className="text-[11px] font-bold text-[#14412A] hover:underline cursor-pointer bg-[#39FF00]/20 px-2 py-0.5 rounded-full border border-[#39FF00]"
                title="Ajusta o último impacto ou cria um impacto para zerar a diferença"
              >
                Auto-conciliar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
