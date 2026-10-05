import React from 'react';
import { DRERow, RowJustifications, DeviationImpact } from '../types';
import { formatCurrencyShort, isWithinReconciliationTolerance, parseCurrencyMillions } from '../utils/formatters';
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ImpactsSectionProps {
  selectedRow: DRERow | null;
  justifications: RowJustifications;
  monthPrevious: string;
  monthCurrent: string;
  isLoadingJustifications?: boolean;
  readOnly?: boolean;
  onAddImpact: (type: 'mom' | 'vsOrcado' | 'ytd') => void;
  onUpdateImpact: (
    type: 'mom' | 'vsOrcado' | 'ytd',
    id: string,
    field: 'name' | 'value' | 'justification',
    val: string | number
  ) => void;
  onRemoveImpact: (type: 'mom' | 'vsOrcado' | 'ytd', id: string) => void;
  onFieldBlur?: () => void;
}

/**
 * Campo executivo em milhões. O valor persistido continua integral em reais.
 */
const CurrencyInput: React.FC<{
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  onCommit?: () => void;
  className?: string;
}> = ({ value, disabled, onChange, onCommit, className }) => {
  const [text, setText] = React.useState(() => formatCurrencyShort(value, false));
  const [isFocused, setIsFocused] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setText(formatCurrencyShort(value, false));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    setIsDirty(true);
    const parsed = parseCurrencyMillions(newText);
    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (isDirty) {
      const parsed = parseCurrencyMillions(text);
      onChange(parsed);
      setText(formatCurrencyShort(parsed, false));
      setIsDirty(false);
      onCommit?.();
    } else {
      setText(formatCurrencyShort(value, false));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={text}
      disabled={disabled}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="R$ 0,00M"
      className={className}
      title="Digite o valor em milhões (ex.: 4,41 ou -0,30)"
    />
  );
};

interface ImpactRowProps {
  title: string;
  subtitle: string;
  type: 'mom' | 'vsOrcado' | 'ytd';
  metric1Label: string;
  metric1Value: number;
  metric2Label: string;
  metric2Value: number;
  deltaLabel: string;
  deltaValue: number;
  deltaPct: number;
  impacts: DeviationImpact[];
  disabled: boolean;
  isLoading?: boolean;
  onAddImpact: (type: 'mom' | 'vsOrcado' | 'ytd') => void;
  onUpdateImpact: (
    type: 'mom' | 'vsOrcado' | 'ytd',
    id: string,
    field: 'name' | 'value' | 'justification',
    val: string | number
  ) => void;
  onRemoveImpact: (type: 'mom' | 'vsOrcado' | 'ytd', id: string) => void;
  onFieldBlur?: () => void;
}

const ImpactRowCard: React.FC<ImpactRowProps> = ({
  title,
  subtitle,
  type,
  metric1Label,
  metric1Value,
  metric2Label,
  metric2Value,
  deltaLabel,
  deltaValue,
  deltaPct,
  impacts,
  disabled,
  isLoading = false,
  onAddImpact,
  onUpdateImpact,
  onRemoveImpact,
  onFieldBlur,
}) => {
  const sum = impacts.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const pending = deltaValue - sum;
  const isOk = isWithinReconciliationTolerance(pending);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
      {/* ============================================================
          LADO ESQUERDO: Painel de Indicadores & Resumo Numérico
          Mesmo tamanho e largura de "1 Filtro Organizacional" (lg:col-span-4)
          ============================================================ */}
      <div className="lg:col-span-4 bg-white rounded-3xl border border-[#D5DCD2] p-5 shadow-xs flex flex-col justify-between h-full">
        <div>
          {/* Header da linha */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-[#14412A] tracking-tight">{title}</h3>
          </div>
          <p className="text-xs text-[#5A6454] mb-3 ml-8">{subtitle}</p>

          {/* Grid de 2 Blocos de Valores */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {/* Métrica 1 */}
            <div className="bg-[#FAFBF9] border border-[#E8EDE5] rounded-2xl p-2.5">
              <span className="text-[10px] font-bold text-[#768070] uppercase block truncate">
                {metric1Label}
              </span>
              <span className="text-xs font-bold text-[#14412A] block mt-0.5 font-mono">
                {formatCurrencyShort(metric1Value, false)}
              </span>
            </div>

            {/* Métrica 2 */}
            <div className="bg-[#FAFBF9] border border-[#E8EDE5] rounded-2xl p-2.5">
              <span className="text-[10px] font-bold text-[#768070] uppercase block truncate">
                {metric2Label}
              </span>
              <span className="text-xs font-bold text-[#14412A] block mt-0.5 font-mono">
                {formatCurrencyShort(metric2Value, false)}
              </span>
            </div>
          </div>

          {/* Bloco de Delta (Diferença) & Percentual */}
          <div className="rounded-2xl p-3 border bg-[#FAFBF9] border-[#D5DCD2]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-[#14412A]">{deltaLabel}</span>
              <div className="flex items-center gap-1 font-bold text-xs">
                <span className="text-[#4F5B50] font-extrabold">
                  {deltaPct >= 0 ? `+${deltaPct.toFixed(2)}%` : `${deltaPct.toFixed(2)}%`}
                </span>
              </div>
            </div>
            <div className="text-sm font-extrabold font-mono text-[#14412A]">
              {formatCurrencyShort(deltaValue, false)}
            </div>
          </div>
        </div>

        {/* Rodapé do Bloco Esquerdo: Reconciliação */}
        <div className="mt-3 pt-3 border-t border-[#E8EDE5] flex items-center justify-between text-[11px]">
          <div>
            <span className="text-[#768070]">Soma Impactos: </span>
            <strong className="text-[#14412A] font-mono">{formatCurrencyShort(sum, false)}</strong>
          </div>
          <div className="flex items-center gap-1">
            {isOk ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#DCFCE7] text-[#166534] font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Reconciliado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FEF3C7] text-[#92400E] font-bold text-xs" title="Diferença pendente de justificar">
                <AlertCircle className="w-3.5 h-3.5" /> Pendente: {formatCurrencyShort(pending, false)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          LADO DIREITO: Card de Detalhamento de Desvios & Justificativas
          Mesmo tamanho e largura de "2 Selecionar Linha de Despesa" (lg:col-span-8)
          ============================================================ */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-[#D5DCD2] p-5 shadow-xs flex flex-col justify-between h-full">
        <div>
          {/* Header da lista de impactos */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#E8EDE5]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#14412A] uppercase tracking-wider">
                Detalhamento de Desvios &amp; Justificativas
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EFF4EC] text-[#14412A] font-semibold">
                {impacts.length} impacto(s)
              </span>
            </div>

            <button
              type="button"
              onClick={() => onAddImpact(type)}
              disabled={disabled}
              className="inline-flex items-center gap-1 bg-[#14412A] hover:bg-[#1E5638] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#39FF00]" />
              Adicionar Impacto
            </button>
          </div>

          {/* Lista dos Desvios */}
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {isLoading && impacts.length === 0 ? (
              <div className="bg-[#FAFBF9] border border-[#CCD8C7] rounded-2xl p-4 my-1 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#14412A] font-semibold">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#14412A]" />
                    Carregando justificativas históricas...
                  </span>
                  <span className="text-[10px] text-[#5A6454] font-medium">Sincronizando GCP Bucket</span>
                </div>
                <div className="w-full h-2 bg-[#E6ECE2] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#14412A] via-[#39FF00] to-[#14412A] w-2/3 animate-pulse rounded-full" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-7 bg-[#E8EDE5]/70 rounded-xl animate-pulse w-full" />
                  <div className="h-10 bg-[#E8EDE5]/50 rounded-xl animate-pulse w-full" />
                </div>
              </div>
            ) : impacts.length === 0 ? (
              <div className="bg-[#FAFBF9] border border-dashed border-[#CCD8C7] rounded-2xl p-5 text-center my-1">
                <p className="text-xs text-[#5A6454] font-medium">
                  {disabled
                    ? 'Selecione uma despesa N3 para detalhar os impactos.'
                    : 'Nenhum desvio registrado para este comparativo. Clique em "+ Adicionar Impacto" acima.'}
                </p>
              </div>
            ) : (
              impacts.map((imp, idx) => (
                <div
                  key={imp.id}
                  className="bg-[#FAFBF9] hover:bg-[#F4F7F2] border border-[#CCD8C7] rounded-2xl p-2.5 transition-all space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#14412A]/10 text-[#14412A] text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="Nome do evento ou causador do desvio..."
                      value={imp.name}
                      disabled={disabled}
                      onChange={(e) => onUpdateImpact(type, imp.id, 'name', e.target.value)}
                      onBlur={onFieldBlur}
                      className="flex-1 min-w-0 bg-white border border-[#CCD8C7] rounded-xl px-2.5 py-1 text-xs text-[#14412A] font-semibold focus:outline-hidden focus:border-[#14412A]"
                    />

                    <CurrencyInput
                      value={imp.value}
                      disabled={disabled}
                      onChange={(val) => onUpdateImpact(type, imp.id, 'value', val)}
                      onCommit={onFieldBlur}
                      className="w-36 bg-white border border-[#CCD8C7] rounded-xl px-2.5 py-1 text-xs font-bold text-right text-[#14412A] font-mono focus:outline-hidden focus:border-[#14412A]"
                    />

                    <button
                      type="button"
                      onClick={() => onRemoveImpact(type, imp.id)}
                      disabled={disabled}
                      className="text-[#768070] hover:text-red-600 p-1 transition-colors cursor-pointer shrink-0"
                      title="Remover este impacto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Campo de Justificativa com 2 linhas para melhor visualização do comentário */}
                  <textarea
                    rows={2}
                    placeholder="Justificativa executiva do desvio (ex: reajuste contratual, sinistro de rede, atraso fornecedor)..."
                    value={imp.justification}
                    disabled={disabled}
                    onChange={(e) => onUpdateImpact(type, imp.id, 'justification', e.target.value)}
                    onBlur={onFieldBlur}
                    className="w-full bg-white border border-[#CCD8C7] rounded-xl px-2.5 py-1.5 text-[11px] text-[#333] leading-relaxed resize-y focus:outline-hidden focus:border-[#14412A] min-h-[46px]"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ImpactsSection: React.FC<ImpactsSectionProps> = ({
  selectedRow,
  justifications,
  monthPrevious,
  monthCurrent,
  isLoadingJustifications = false,
  readOnly = false,
  onAddImpact,
  onUpdateImpact,
  onRemoveImpact,
  onFieldBlur,
}) => {
  const momDelta = selectedRow ? selectedRow.realCurrent - selectedRow.realMMinus1 : 0;
  const momPct = selectedRow && selectedRow.realMMinus1 !== 0
    ? (momDelta / selectedRow.realMMinus1) * 100
    : 0;

  const vsOrcDelta = selectedRow ? selectedRow.realCurrent - selectedRow.orcadoCurrent : 0;
  const vsOrcPct = selectedRow && selectedRow.orcadoCurrent !== 0
    ? (vsOrcDelta / selectedRow.orcadoCurrent) * 100
    : 0;

  const ytdDelta = selectedRow ? selectedRow.realYTD - selectedRow.orcadoYTD : 0;
  const ytdPct = selectedRow && selectedRow.orcadoYTD !== 0
    ? (ytdDelta / selectedRow.orcadoYTD) * 100
    : 0;

  const disabled = !selectedRow || readOnly;

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* ============================================================
          CARD 3: MoM (vs Mês Anterior) - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        title="MoM (vs Mês Anterior)"
        subtitle={`Variação do realizado entre ${monthPrevious || 'M-1'} e ${monthCurrent || 'Mês Atual'}`}
        type="mom"
        metric1Label={`Real Anterior (${monthPrevious || 'M-1'})`}
        metric1Value={selectedRow?.realMMinus1 || 0}
        metric2Label={`Real Atual (${monthCurrent || 'Atual'})`}
        metric2Value={selectedRow?.realCurrent || 0}
        deltaLabel="Δ MoM (Real M - Real M-1)"
        deltaValue={momDelta}
        deltaPct={momPct}
        impacts={justifications.momImpacts || []}
        disabled={disabled}
        isLoading={isLoadingJustifications}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
        onFieldBlur={onFieldBlur}
      />

      {/* ============================================================
          CARD 4: Mês vs Orçado - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        title="Mês vs Orçado"
        subtitle={`Comparativo entre Real e Orçado na competência ${monthCurrent || 'Atual'}`}
        type="vsOrcado"
        metric1Label={`Orçado (${monthCurrent || 'Atual'})`}
        metric1Value={selectedRow?.orcadoCurrent || 0}
        metric2Label={`Real (${monthCurrent || 'Atual'})`}
        metric2Value={selectedRow?.realCurrent || 0}
        deltaLabel="Δ Mês (Real - Orçado)"
        deltaValue={vsOrcDelta}
        deltaPct={vsOrcPct}
        impacts={justifications.vsOrcadoImpacts || []}
        disabled={disabled}
        isLoading={isLoadingJustifications}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
        onFieldBlur={onFieldBlur}
      />

      {/* ============================================================
          CARD 5: YTD vs Orçado - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        title="YTD vs Orçado"
        subtitle={`Acumulado no ano desde janeiro até ${monthCurrent || 'Atual'}`}
        type="ytd"
        metric1Label="Orçado Acumulado YTD"
        metric1Value={selectedRow?.orcadoYTD || 0}
        metric2Label="Real Acumulado YTD"
        metric2Value={selectedRow?.realYTD || 0}
        deltaLabel="Δ YTD (Real YTD - Orçado YTD)"
        deltaValue={ytdDelta}
        deltaPct={ytdPct}
        impacts={justifications.ytdImpacts || []}
        disabled={disabled}
        isLoading={isLoadingJustifications}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
        onFieldBlur={onFieldBlur}
      />
    </div>
  );
};
