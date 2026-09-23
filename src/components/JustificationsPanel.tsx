import React, { useState } from 'react';
import { DeviationImpact, DRERow, RowJustifications } from '../types';
import { formatCurrency, parseNumberInput } from '../utils/formatters';
import { Plus, Trash2, CheckCircle2, AlertTriangle, Wand2, ArrowRight } from 'lucide-react';

interface JustificationsPanelProps {
  selectedRow: DRERow;
  justifications: RowJustifications;
  onChangeJustifications: (updated: RowJustifications) => void;
}

export const JustificationsPanel: React.FC<JustificationsPanelProps> = ({
  selectedRow,
  justifications,
  onChangeJustifications,
}) => {
  const [activeTab, setActiveTab] = useState<'mom' | 'vsOrcado' | 'ytd'>('mom');

  // Cálculos de Consistência
  // 1. MoM: Real M-1 + sum(MoM impacts) deve igualar Real Atual
  const sumMoM = justifications.momImpacts.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const targetMoM = selectedRow.realCurrent - selectedRow.realMMinus1;
  const diffMoM = targetMoM - sumMoM;
  const isMoMConsistent = Math.abs(diffMoM) < 1; // Tolerância de R$ 1

  // 2. Vs Orçado Mês: Real Atual + sum(Vs Orçado impacts) deve igualar Orçado Atual
  const sumVsOrcado = justifications.vsOrcadoImpacts.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const targetVsOrcado = selectedRow.orcadoCurrent - selectedRow.realCurrent;
  const diffVsOrcado = targetVsOrcado - sumVsOrcado;
  const isVsOrcadoConsistent = Math.abs(diffVsOrcado) < 1;

  // 3. YTD: Real 2026 YTD + sum(YTD impacts) deve igualar Orçado 2026 YTD
  const sumYTD = justifications.ytdImpacts.reduce((acc, curr) => acc + (curr.value || 0), 0);
  const targetYTD = selectedRow.orcadoYTD - selectedRow.realYTD;
  const diffYTD = targetYTD - sumYTD;
  const isYTDConsistent = Math.abs(diffYTD) < 1;

  // Handlers para adicionar/remover/editar
  const handleAddImpact = (type: 'mom' | 'vsOrcado' | 'ytd') => {
    const listKey = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const currentList = justifications[listKey];
    
    // Sugere valor residual se houver diferença
    let suggestedVal = 0;
    if (type === 'mom' && Math.abs(diffMoM) > 0) suggestedVal = diffMoM;
    else if (type === 'vsOrcado' && Math.abs(diffVsOrcado) > 0) suggestedVal = diffVsOrcado;
    else if (type === 'ytd' && Math.abs(diffYTD) > 0) suggestedVal = diffYTD;

    const newImpact: DeviationImpact = {
      id: `imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: `Impacto 0${currentList.length + 1}`,
      value: suggestedVal,
      justification: '',
    };

    onChangeJustifications({
      ...justifications,
      [listKey]: [...currentList, newImpact],
    });
  };

  const handleUpdateImpact = (
    type: 'mom' | 'vsOrcado' | 'ytd',
    index: number,
    field: keyof DeviationImpact,
    value: string | number
  ) => {
    const listKey = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const updatedList = [...justifications[listKey]];
    
    if (field === 'value') {
      updatedList[index] = {
        ...updatedList[index],
        value: typeof value === 'number' ? value : parseNumberInput(value),
      };
    } else {
      updatedList[index] = {
        ...updatedList[index],
        [field]: value,
      };
    }

    onChangeJustifications({
      ...justifications,
      [listKey]: updatedList,
    });
  };

  const handleRemoveImpact = (type: 'mom' | 'vsOrcado' | 'ytd', index: number) => {
    const listKey = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const updatedList = justifications[listKey].filter((_, i) => i !== index);
    onChangeJustifications({
      ...justifications,
      [listKey]: updatedList,
    });
  };

  const handleAutoReconcile = (type: 'mom' | 'vsOrcado' | 'ytd') => {
    const listKey = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    let residual = 0;
    if (type === 'mom') residual = diffMoM;
    else if (type === 'vsOrcado') residual = diffVsOrcado;
    else residual = diffYTD;

    if (Math.abs(residual) < 1) return;

    const newImpact: DeviationImpact = {
      id: `imp-residual-${Date.now()}`,
      name: 'Outros Desvios Operacionais',
      value: residual,
      justification: 'Variação residual de fechamento contábil e conciliação de rotas.',
    };

    onChangeJustifications({
      ...justifications,
      [listKey]: [...justifications[listKey], newImpact],
    });
  };

  // Status atual da aba
  const currentStatus =
    activeTab === 'mom'
      ? { isConsistent: isMoMConsistent, diff: diffMoM, target: targetMoM, sum: sumMoM, label: 'Real M-1 → Real 2026' }
      : activeTab === 'vsOrcado'
      ? { isConsistent: isVsOrcadoConsistent, diff: diffVsOrcado, target: targetVsOrcado, sum: sumVsOrcado, label: 'Real 2026 → Orçado 2026' }
      : { isConsistent: isYTDConsistent, diff: diffYTD, target: targetYTD, sum: sumYTD, label: 'Real YTD → Orçado YTD' };

  const currentList =
    activeTab === 'mom'
      ? justifications.momImpacts
      : activeTab === 'vsOrcado'
      ? justifications.vsOrcadoImpacts
      : justifications.ytdImpacts;

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#A7AC98]/60 shadow-sm flex flex-col space-y-4">
      {/* CABEÇALHO DO PAINEL */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#14412A] uppercase tracking-wider">
            Painel de Justificativas e Desvios
          </h3>
          <p className="text-xs text-[#6E7769]">
            Cadastre os impactos quantitativos e textos explicativos para os gráficos Waterfall e PowerPoint.
          </p>
        </div>

        {/* ALERTA VISUAL DE CONSISTÊNCIA */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border ${
            currentStatus.isConsistent
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-900 border-red-300'
          }`}
        >
          {currentStatus.isConsistent ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              <span>Consistente (100% Conciliado)</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-[#8B0000]" />
              <span>
                Divergência de{' '}
                <strong className="underline decoration-wavy">
                  {formatCurrency(currentStatus.diff, true)}
                </strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* TABS DE SEÇÕES: a) MoM, b) Vs Orçado, c) YTD */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F6F2EE] rounded-2xl border border-[#A7AC98]/40">
        <button
          type="button"
          onClick={() => setActiveTab('mom')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'mom'
              ? 'bg-[#14412A] text-white shadow-sm'
              : 'text-[#192B1C] hover:bg-white/60'
          }`}
        >
          <span>Variações Mês (MoM)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isMoMConsistent ? 'bg-[#39FF00]' : 'bg-[#8B0000]'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vsOrcado')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'vsOrcado'
              ? 'bg-[#14412A] text-white shadow-sm'
              : 'text-[#192B1C] hover:bg-white/60'
          }`}
        >
          <span>Variações Mês (Vs Orçado)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isVsOrcadoConsistent ? 'bg-[#39FF00]' : 'bg-[#8B0000]'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ytd')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'ytd'
              ? 'bg-[#14412A] text-white shadow-sm'
              : 'text-[#192B1C] hover:bg-white/60'
          }`}
        >
          <span>Variações YTD (Vs Orçado)</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isYTDConsistent ? 'bg-[#39FF00]' : 'bg-[#8B0000]'
            }`}
          />
        </button>
      </div>

      {/* BARRA DE EQUILÍBRIO CONTÁBIL */}
      <div className="bg-[#F6F2EE]/70 rounded-2xl p-3 border border-[#A7AC98]/40 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#6E7769]">
          <span className="font-medium">Fluxo: {currentStatus.label}</span>
          <ArrowRight className="w-3 h-3" />
          <span>Meta: <strong className="text-[#192B1C]">{formatCurrency(currentStatus.target, true)}</strong></span>
          <span>| Justificado: <strong className="text-[#192B1C]">{formatCurrency(currentStatus.sum, true)}</strong></span>
        </div>

        {!currentStatus.isConsistent && (
          <button
            type="button"
            onClick={() => handleAutoReconcile(activeTab)}
            className="px-3 py-1 rounded-full bg-[#14412A] text-white text-[11px] font-semibold hover:bg-[#192B1C] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Adiciona linha de impacto com a diferença exata"
          >
            <Wand2 className="w-3 h-3 text-[#39FF00]" />
            Conciliar Residual ({formatCurrency(currentStatus.diff, true)})
          </button>
        )}
      </div>

      {/* LISTA DINÂMICA DE IMPACTOS */}
      <div className="space-y-3">
        {currentList.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-[#A7AC98] rounded-2xl bg-[#F6F2EE]/40">
            <p className="text-xs text-[#6E7769]">
              Nenhum impacto cadastrado para esta seção. Clique abaixo para adicionar um desvio explicativo.
            </p>
          </div>
        ) : (
          currentList.map((imp, idx) => (
            <div
              key={imp.id}
              className="p-3.5 bg-white rounded-2xl border border-[#DCD8D2] hover:border-[#14412A]/40 transition-colors shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {/* Nome do Impacto */}
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-[#6E7769] uppercase">
                      Nome do Impacto #{idx + 1}
                    </label>
                    <input
                      type="text"
                      value={imp.name}
                      placeholder="Ex: Reajuste Contratual Concessionárias..."
                      onChange={(e) => handleUpdateImpact(activeTab, idx, 'name', e.target.value)}
                      className="w-full mt-0.5 bg-[#F6F2EE] border border-[#A7AC98]/60 text-xs rounded-xl px-3 py-1.5 text-[#192B1C] font-semibold focus:outline-none focus:border-[#14412A]"
                    />
                  </div>

                  {/* Valor em R$ */}
                  <div>
                    <label className="text-[10px] font-bold text-[#6E7769] uppercase">
                      Valor (R$ ou R$ M)
                    </label>
                    <input
                      type="text"
                      defaultValue={imp.value}
                      placeholder="Ex: 500000 ou 1.2M"
                      onBlur={(e) => handleUpdateImpact(activeTab, idx, 'value', e.target.value)}
                      className="w-full mt-0.5 bg-[#F6F2EE] border border-[#A7AC98]/60 text-xs rounded-xl px-3 py-1.5 text-[#192B1C] font-bold focus:outline-none focus:border-[#14412A]"
                    />
                  </div>
                </div>

                {/* Botão Excluir */}
                <button
                  type="button"
                  onClick={() => handleRemoveImpact(activeTab, idx)}
                  className="p-2 text-[#8C9283] hover:text-[#8B0000] hover:bg-red-50 rounded-xl transition-colors cursor-pointer shrink-0 mt-3.5"
                  title="Remover este impacto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Justificativa Textual */}
              <div>
                <label className="text-[10px] font-bold text-[#6E7769] uppercase">
                  Justificativa Textual (Exibida no PowerPoint)
                </label>
                <textarea
                  rows={2}
                  value={imp.justification}
                  placeholder="Explique o motivo do desvio operacional, impacto de preço, volume ou cronograma..."
                  onChange={(e) => handleUpdateImpact(activeTab, idx, 'justification', e.target.value)}
                  className="w-full mt-0.5 bg-[#F6F2EE] border border-[#A7AC98]/60 text-xs rounded-xl px-3 py-2 text-[#192B1C] focus:outline-none focus:border-[#14412A] resize-none"
                />
              </div>
            </div>
          ))
        )}

        {/* BOTÃO ADICIONAR IMPACTO */}
        <button
          type="button"
          onClick={() => handleAddImpact(activeTab)}
          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-[#A7AC98] hover:border-[#14412A] text-xs font-semibold text-[#14412A] hover:bg-[#14412A]/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-[#14412A]" />
          Adicionar Impacto em{' '}
          {activeTab === 'mom'
            ? 'Variações Mês (MoM)'
            : activeTab === 'vsOrcado'
            ? 'Variações Mês (Vs Orçado)'
            : 'Variações YTD'}
        </button>
      </div>
    </div>
  );
};
