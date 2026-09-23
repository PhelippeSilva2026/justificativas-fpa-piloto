import React from 'react';
import { DRERow, RowJustifications, DeviationImpact } from '../types';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/formatters';
import { Plus, Trash2, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ImpactsSectionProps {
  selectedRow: DRERow | null;
  justifications: RowJustifications;
  monthPrevious: string;
  monthCurrent: string;
  onAddImpact: (type: 'mom' | 'vsOrcado' | 'ytd') => void;
  onUpdateImpact: (
    type: 'mom' | 'vsOrcado' | 'ytd',
    id: string,
    field: 'name' | 'value' | 'justification',
    val: string | number
  ) => void;
  onRemoveImpact: (type: 'mom' | 'vsOrcado' | 'ytd', id: string) => void;
}

/**
 * Campo especializado de entrada em Moeda BRL (R$ 1.250.000,00)
 */
const CurrencyInput: React.FC<{
  value: number;
  disabled?: boolean;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, disabled, onChange, className }) => {
  const [text, setText] = React.useState(() => formatCurrencyBRL(value));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setText(formatCurrencyBRL(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    const parsed = parseCurrencyBRL(newText);
    onChange(parsed);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseCurrencyBRL(text);
    onChange(parsed);
    setText(formatCurrencyBRL(parsed));
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
      placeholder="R$ 0,00"
      className={className}
      title="Digite o valor em moeda (ex: 1.250.000,00 ou -300.000,00)"
    />
  );
};

interface ImpactRowProps {
  cardIndex: number;
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
  onAddImpact: (type: 'mom' | 'vsOrcado' | 'ytd') => void;
  onUpdateImpact: (
    type: 'mom' | 'vsOrcado' | 'ytd',
    id: string,
    field: 'name' | 'value' | 'justification',
    val: string | number
  ) => void;
  onRemoveImpact: (type: 'mom' | 'vsOrcado' | 'ytd', id: string) => void;
}

const ImpactRowCard: React.FC<ImpactRowProps> = ({
  cardIndex,
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
  onAddImpact,
  onUpdateImpact,
  onRemoveImpact,
}) => {
  const sum = impacts.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const pending = deltaValue - sum;
  const isOk = Math.abs(pending) < 1;

  const isPositiveDelta = deltaValue > 0;
  const isNegativeDelta = deltaValue < 0;

  return (
    <div className="bg-white rounded-3xl border border-[#D5DCD2] p-5 shadow-xs w-full transition-all">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* ============================================================
            LADO ESQUERDO: Painel de Indicadores & Resumo Numérico
            ============================================================ */}
        <div className="lg:col-span-4 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#E8EDE5] pb-4 lg:pb-0 lg:pr-5">
          <div>
            {/* Header da linha */}
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#14412A] text-white text-xs font-bold shrink-0">
                {cardIndex}
              </span>
              <h3 className="text-base font-bold text-[#14412A] tracking-tight">{title}</h3>
            </div>
            <p className="text-xs text-[#5A6454] mb-3 ml-8">{subtitle}</p>

            {/* Grid de 3 Blocos de Valores */}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {/* Métrica 1 */}
              <div className="bg-[#FAFBF9] border border-[#E8EDE5] rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-[#768070] uppercase block truncate">
                  {metric1Label}
                </span>
                <span className="text-xs font-bold text-[#14412A] block mt-0.5 font-mono">
                  {formatCurrencyBRL(metric1Value)}
                </span>
              </div>

              {/* Métrica 2 */}
              <div className="bg-[#FAFBF9] border border-[#E8EDE5] rounded-2xl p-2.5">
                <span className="text-[10px] font-bold text-[#768070] uppercase block truncate">
                  {metric2Label}
                </span>
                <span className="text-xs font-bold text-[#14412A] block mt-0.5 font-mono">
                  {formatCurrencyBRL(metric2Value)}
                </span>
              </div>
            </div>

            {/* Bloco de Delta (Diferença) & Percentual */}
            <div className={`rounded-2xl p-3 border ${
              isPositiveDelta
                ? 'bg-[#FEF2F2] border-[#FCA5A5]'
                : isNegativeDelta
                ? 'bg-[#F0FDF4] border-[#86EFAC]'
                : 'bg-[#FAFBF9] border-[#E8EDE5]'
            }`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#14412A]">{deltaLabel}</span>
                <div className="flex items-center gap-1 font-bold text-xs">
                  {isPositiveDelta && <TrendingUp className="w-3.5 h-3.5 text-red-600" />}
                  {isNegativeDelta && <TrendingDown className="w-3.5 h-3.5 text-green-700" />}
                  {deltaValue === 0 && <Minus className="w-3.5 h-3.5 text-gray-500" />}
                  <span className={isPositiveDelta ? 'text-red-700 font-extrabold' : isNegativeDelta ? 'text-green-800 font-extrabold' : 'text-gray-700'}>
                    {deltaPct >= 0 ? `+${deltaPct.toFixed(2)}%` : `${deltaPct.toFixed(2)}%`}
                  </span>
                </div>
              </div>
              <div className="text-sm font-extrabold font-mono text-[#14412A]">
                {formatCurrencyBRL(deltaValue)}
              </div>
            </div>
          </div>

          {/* Rodapé do Bloco Esquerdo: Reconciliação */}
          <div className="mt-3 pt-3 border-t border-[#E8EDE5] flex items-center justify-between text-[11px]">
            <div>
              <span className="text-[#768070]">Soma Impactos: </span>
              <strong className="text-[#14412A] font-mono">{formatCurrencyBRL(sum)}</strong>
            </div>
            <div className="flex items-center gap-1">
              {isOk ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] font-bold text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> Reconciliado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FEF3C7] text-[#92400E] font-bold text-[10px]" title="Diferença pendente de justificar">
                  <AlertCircle className="w-3 h-3" /> Pendente: {formatCurrencyBRL(pending)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            LADO DIREITO: Lista Executiva de Desvios & Impactos
            ============================================================ */}
        <div className="lg:col-span-8 flex flex-col justify-between">
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
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {impacts.length === 0 ? (
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
                    className="bg-[#FAFBF9] hover:bg-[#F4F7F2] border border-[#CCD8C7] rounded-2xl p-2.5 transition-all space-y-1.5"
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
                        className="flex-1 min-w-0 bg-white border border-[#CCD8C7] rounded-xl px-2.5 py-1 text-xs text-[#14412A] font-semibold focus:outline-hidden focus:border-[#14412A]"
                      />

                      <CurrencyInput
                        value={imp.value}
                        disabled={disabled}
                        onChange={(val) => onUpdateImpact(type, imp.id, 'value', val)}
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

                    <input
                      type="text"
                      placeholder="Justificativa executiva do desvio (ex: reajuste contratual, sinistro de rede, atraso fornecedor)..."
                      value={imp.justification}
                      disabled={disabled}
                      onChange={(e) => onUpdateImpact(type, imp.id, 'justification', e.target.value)}
                      className="w-full bg-white border border-[#CCD8C7] rounded-xl px-2.5 py-1 text-[11px] text-[#333] focus:outline-hidden focus:border-[#14412A]"
                    />
                  </div>
                ))
              )}
            </div>
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
  onAddImpact,
  onUpdateImpact,
  onRemoveImpact,
}) => {
  const momDelta = selectedRow ? selectedRow.realCurrent - selectedRow.realMMinus1 : 0;
  const momPct = selectedRow ? selectedRow.diffMMinus1Pct : 0;

  const vsOrcDelta = selectedRow ? selectedRow.realCurrent - selectedRow.orcadoCurrent : 0;
  const vsOrcPct = selectedRow ? selectedRow.diffOrcadoPct : 0;

  const ytdDelta = selectedRow ? selectedRow.realYTD - selectedRow.orcadoYTD : 0;
  const ytdPct = selectedRow ? selectedRow.diffOrcadoYTDPct : 0;

  const disabled = !selectedRow;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* ============================================================
          CARD 3: MoM (vs Mês Anterior) - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        cardIndex={3}
        title="MoM (vs Mês Anterior)"
        subtitle={`Variação do realizado entre ${monthPrevious || 'M-1'} e ${monthCurrent || 'Mês Atual'}`}
        type="mom"
        metric1Label={`Realizado Anterior (${monthPrevious || 'M-1'})`}
        metric1Value={selectedRow?.realMMinus1 || 0}
        metric2Label={`Realizado Atual (${monthCurrent || 'Atual'})`}
        metric2Value={selectedRow?.realCurrent || 0}
        deltaLabel="Δ MoM (Real M - Real M-1)"
        deltaValue={momDelta}
        deltaPct={momPct}
        impacts={justifications.momImpacts || []}
        disabled={disabled}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
      />

      {/* ============================================================
          CARD 4: Mês vs Orçado - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        cardIndex={4}
        title="Mês vs Orçado"
        subtitle={`Comparativo entre Realizado e Orçado na competência ${monthCurrent || 'Atual'}`}
        type="vsOrcado"
        metric1Label={`Realizado (${monthCurrent || 'Atual'})`}
        metric1Value={selectedRow?.realCurrent || 0}
        metric2Label={`Orçado (${monthCurrent || 'Atual'})`}
        metric2Value={selectedRow?.orcadoCurrent || 0}
        deltaLabel="Δ Mês (Realizado - Orçado)"
        deltaValue={vsOrcDelta}
        deltaPct={vsOrcPct}
        impacts={justifications.vsOrcadoImpacts || []}
        disabled={disabled}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
      />

      {/* ============================================================
          CARD 5: YTD vs Orçado - Formato Retangular Full-Width
          ============================================================ */}
      <ImpactRowCard
        cardIndex={5}
        title="YTD vs Orçado"
        subtitle={`Acumulado no ano desde janeiro até ${monthCurrent || 'Atual'}`}
        type="ytd"
        metric1Label="Realizado Acumulado YTD"
        metric1Value={selectedRow?.realYTD || 0}
        metric2Label="Orçado Acumulado YTD"
        metric2Value={selectedRow?.orcadoYTD || 0}
        deltaLabel="Δ YTD (Realizado YTD - Orçado YTD)"
        deltaValue={ytdDelta}
        deltaPct={ytdPct}
        impacts={justifications.ytdImpacts || []}
        disabled={disabled}
        onAddImpact={onAddImpact}
        onUpdateImpact={onUpdateImpact}
        onRemoveImpact={onRemoveImpact}
      />
    </div>
  );
};
