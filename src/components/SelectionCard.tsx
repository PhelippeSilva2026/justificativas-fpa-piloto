import React from 'react';
import { CompanyId, DRERow, RowJustifications } from '../types';
import { formatCurrencyShort, isWithinReconciliationTolerance } from '../utils/formatters';
import { ChevronDown, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';

const LevelSelect: React.FC<{
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}> = ({ label, value, options, allLabel, onChange }) => (
  <label className="block">
    <span className="block mb-1 text-[10px] font-bold uppercase tracking-wide text-[#768070]">{label}</span>
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none bg-white border border-[#A7AC98]/80 text-[#192B1C] text-xs font-semibold rounded-xl px-3.5 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-[#14412A] cursor-pointer"
      >
        <option value="ALL">{allLabel}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6E7769] pointer-events-none" />
    </div>
  </label>
);

interface SelectionCardProps {
  rows: DRERow[];
  selectedRowId: string | null;
  onSelectRow: (id: string) => void;
  selectedRow: DRERow | null;
  justifications: RowJustifications;
  onAutoReconcileAll?: () => void;
  currentCompany: CompanyId;
  readOnly?: boolean;
  nioFilters?: {
    n1Options: string[];
    n2Options: string[];
    n3Options: string[];
    responsavelOptions: string[];
    selectedN1: string;
    selectedN2: string;
    selectedN3: string;
    selectedResponsavel: string;
    onSelectN1: (value: string) => void;
    onSelectN2: (value: string) => void;
    onSelectN3: (value: string) => void;
    onSelectResponsavel: (value: string) => void;
  };
  onClearFilters?: () => void;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  rows,
  selectedRowId,
  onSelectRow,
  selectedRow,
  justifications,
  onAutoReconcileAll,
  currentCompany,
  readOnly = false,
  nioFilters,
  onClearFilters,
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

    const isMomOk = isWithinReconciliationTolerance(momPend);
    const isVsOrcOk = isWithinReconciliationTolerance(vsOrcPend);
    const isYtdOk = isWithinReconciliationTolerance(ytdPend);

    isBalanced = isMomOk && isVsOrcOk && isYtdOk;
    hasPending = !isBalanced;

    if (hasPending) {
      const pList: string[] = [];
      if (!isMomOk) pList.push(`MoM: ${formatCurrencyShort(momPend, false)}`);
      if (!isVsOrcOk) pList.push(`Mês: ${formatCurrencyShort(vsOrcPend, false)}`);
      if (!isYtdOk) pList.push(`YTD: ${formatCurrencyShort(ytdPend, false)}`);
      pendingSummary = pList.join(' | ');
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#A7AC98]/40 shadow-sm flex flex-col justify-between h-full">
      {/* Topo do Card com Título e Contador */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#14412A]">
            {isCorporate ? 'Selecionar Linha de Despesa (Classificação FP&A)' : 'Filtro Nível'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {currentCompany === 'nio' && onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CCD8C7] bg-[#FAFBF9] px-2.5 py-1.5 text-[10px] font-bold text-[#14412A] hover:bg-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Limpar filtros
            </button>
          )}
          <span className="text-xs text-[#8C9283] font-medium">
            {rows.length} {rows.length === 1 ? 'linha disponível' : 'linhas disponíveis'}
          </span>
        </div>
      </div>

      {currentCompany === 'nio' && nioFilters ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
          <LevelSelect label="NIO_N1" value={nioFilters.selectedN1} options={nioFilters.n1Options} allLabel="Todos os Níveis 1" onChange={nioFilters.onSelectN1} />
          <LevelSelect label="NIO_N2" value={nioFilters.selectedN2} options={nioFilters.n2Options} allLabel="Todos os Níveis 2" onChange={nioFilters.onSelectN2} />
          <LevelSelect label="NIO_N3" value={nioFilters.selectedN3} options={nioFilters.n3Options} allLabel="Todos os Níveis 3" onChange={nioFilters.onSelectN3} />
          <LevelSelect label="Responsável" value={nioFilters.selectedResponsavel} options={nioFilters.responsavelOptions} allLabel="Todos os Responsáveis" onChange={nioFilters.onSelectResponsavel} />
        </div>
      ) : (
      <div className="relative my-3">
        <select
          value={selectedRowId || ''}
          onChange={(e) => onSelectRow(e.target.value)}
          disabled={rows.length === 0}
          className="w-full appearance-none bg-white border border-[#A7AC98]/80 text-[#192B1C] text-xs font-semibold rounded-2xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-[#14412A] focus:border-transparent transition-all shadow-2xs disabled:bg-[#F6F2EE] disabled:text-[#8C9283] cursor-pointer"
        >
          {rows.length === 0 ? (
            <option value="">Nenhuma linha para os filtros selecionados</option>
          ) : (
            rows.map((r) => {
              const isConsol =
                (r.n1 === '0' && r.n2 === '0' && r.n3 === '0') ||
                r.n3 === '0' ||
                `${r.n1} | ${r.n2} | ${r.n3}`.trim() === '0 | 0 | 0' ||
                (r.n1 || '').toLowerCase() === 'consolidado' ||
                (r.n3 || '').toLowerCase() === 'consolidado';
              return (
                <option key={r.id} value={r.id}>
                  {isConsol ? 'Consolidado' : r.n3}
                </option>
              );
            })
          )}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#6E7769]">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      )}

      {/* 4 Mini Cards de Metadados em uma única linha */}
      {currentCompany !== 'nio' && <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-2">
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
            {selectedRow ? ((selectedRow.n1 === '0' && selectedRow.n2 === '0') ? 'Consolidado' : selectedRow.n1) : '-'}
          </div>
        </div>

        {/* Caixa 3: RESPONSÁVEL */}
        <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-2.5">
          <div className="text-[9px] font-bold text-[#768070] tracking-wider uppercase truncate">
            {isCorporate ? 'NÍVEL 4' : 'RESPONSÁVEL'}
          </div>
          <div className="text-xs font-bold text-[#14412A] truncate mt-0.5" title={selectedRow?.responsavel || '-'}>
            {selectedRow?.responsavel && selectedRow.responsavel !== '0' && selectedRow.responsavel !== '-'
              ? selectedRow.responsavel
              : (selectedRow?.n1 === '0' ? 'Diretoria Executiva' : '-')}
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
      </div>}

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
            {onAutoReconcileAll && !readOnly && (
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
