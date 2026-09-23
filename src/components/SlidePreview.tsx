import React from 'react';
import { DRERow, RowJustifications, CompanyId } from '../types';
import { CompanyLogo } from './CompanyLogo';
import { WaterfallCanvas } from './WaterfallCanvas';
import { buildMonthWaterfallData, buildYTDWaterfallData } from '../utils/waterfallGenerator';
import { formatCurrencyShort } from '../utils/formatters';
import { Download, Sparkles } from 'lucide-react';

interface SlidePreviewProps {
  row: DRERow;
  justifications: RowJustifications;
  onExportCurrent: () => void;
  isExporting?: boolean;
  companyId?: CompanyId;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({
  row,
  justifications,
  onExportCurrent,
  isExporting = false,
  companyId = 'nio',
}) => {
  const monthConfig = buildMonthWaterfallData(row, justifications);
  const ytdConfig = buildYTDWaterfallData(row, justifications);

  return (
    <div className="flex flex-col space-y-3">
      {/* Barra de Ações do Slide */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#39FF00]" />
          <h3 className="text-xs font-bold text-[#14412A] uppercase tracking-wider">
            Pré-visualização do Slide Widescreen (16:9)
          </h3>
          <span className="text-[11px] text-[#6E7769] hidden sm:inline">
            — Formato idêntico ao exportado no PowerPoint (.pptx)
          </span>
        </div>

        <button
          type="button"
          onClick={onExportCurrent}
          disabled={isExporting}
          className="px-4 py-1.5 rounded-full bg-[#39FF00] text-[#192B1C] font-bold text-xs hover:bg-[#32e000] active:scale-95 transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {isExporting ? 'Gerando Slide...' : 'Exportar este Slide (.pptx)'}
        </button>
      </div>

      {/* MOLDURA DO SLIDE 16:9 */}
      <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border-2 border-[#A7AC98] shadow-md flex flex-col relative overflow-hidden aspect-[16/9.5] min-h-[520px]">
        {/* CABEÇALHO DO SLIDE */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#A7AC98]/40">
          <div className="space-y-0.5">
            {/* Título: N1 | N2 | N3 */}
            <h1 className="text-base sm:text-lg md:text-xl font-bold text-[#14412A] tracking-tight leading-snug">
              {row.n1.toUpperCase()} | {row.n2} | {row.n3}
            </h1>
            {/* Subtítulo: Responsável */}
            <div className="text-xs text-[#192B1C]">
              <strong className="font-bold">Responsável: </strong>
              <span className="text-[#334155]">{row.responsavel}</span>
            </div>
          </div>

          {/* Logomarca da Empresa no canto superior direito */}
          <div className="shrink-0 flex items-center">
            <CompanyLogo companyId={companyId} size="lg" />
          </div>
        </div>

        {/* 4 QUADRANTES */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-4 pt-4 pb-2">
          {/* QUADRANTE 1 (Superior Esquerdo): Gráfico 01 (Waterfall Mês) */}
          <div className="bg-white rounded-2xl p-3 border border-[#A7AC98]/60 shadow-xs flex flex-col">
            <div className="flex-1 w-full h-full">
              <WaterfallCanvas config={monthConfig} />
            </div>
          </div>

          {/* QUADRANTE 2 (Superior Direito): Caixa Variações Mês */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#A7AC98]/60 shadow-xs overflow-y-auto flex flex-col justify-start">
            <h4 className="text-[11px] font-bold text-[#14412A] mb-1.5 border-b border-[#F6F2EE] pb-1 uppercase tracking-wider">
              Variações Mês
            </h4>

            {/* Seção 1: MoM */}
            <div className="mb-2 space-y-0.5">
              <div className="text-[10px] font-bold text-[#192B1C]">MoM</div>
              {justifications.momImpacts.length === 0 ? (
                <div className="text-[9px] text-[#6E7769] italic pl-1.5">
                  • Sem desvios adicionais informados para o período MoM.
                </div>
              ) : (
                <ul className="space-y-0.5 pl-1.5">
                  {justifications.momImpacts.map((imp) => (
                    <li key={imp.id} className="text-[9.5px] text-[#333333] leading-snug">
                      <span className="font-bold text-[#192B1C]">• {imp.name} (</span>
                      <strong className={`font-bold ${imp.value < 0 ? 'text-[#8B0000]' : 'text-[#14412A]'}`}>
                        {formatCurrencyShort(imp.value)}
                      </strong>
                      <span className="font-bold text-[#192B1C]">): </span>
                      <span>{imp.justification || 'Desvio operacional apurado.'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Seção 2: Vs Orçado */}
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-[#192B1C]">Vs Orçado</div>
              {justifications.vsOrcadoImpacts.length === 0 ? (
                <div className="text-[9px] text-[#6E7769] italic pl-1.5">
                  • Aderência integral ao orçamento previsto no mês.
                </div>
              ) : (
                <ul className="space-y-0.5 pl-1.5">
                  {justifications.vsOrcadoImpacts.map((imp) => (
                    <li key={imp.id} className="text-[9.5px] text-[#333333] leading-snug">
                      <span className="font-bold text-[#192B1C]">• {imp.name} (</span>
                      <strong className={`font-bold ${imp.value < 0 ? 'text-[#8B0000]' : 'text-[#14412A]'}`}>
                        {formatCurrencyShort(imp.value)}
                      </strong>
                      <span className="font-bold text-[#192B1C]">): </span>
                      <span>{imp.justification || 'Justificativa orçamentária apurada.'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* QUADRANTE 3 (Inferior Esquerdo): Gráfico 02 (Waterfall YTD) */}
          <div className="bg-white rounded-2xl p-3 border border-[#A7AC98]/60 shadow-xs flex flex-col">
            <div className="flex-1 w-full h-full">
              <WaterfallCanvas config={ytdConfig} />
            </div>
          </div>

          {/* QUADRANTE 4 (Inferior Direito): Explicação das Variações YTD */}
          <div className="bg-white rounded-2xl p-3.5 border border-[#A7AC98]/60 shadow-xs overflow-y-auto flex flex-col justify-start">
            <h4 className="text-[11px] font-bold text-[#14412A] mb-1.5 border-b border-[#F6F2EE] pb-1 uppercase tracking-wider">
              Explicação das Variações YTD
            </h4>

            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-[#192B1C]">Vs Orçado</div>
              {justifications.ytdImpacts.length === 0 ? (
                <div className="text-[9px] text-[#6E7769] italic pl-1.5">
                  • Execução acumulada YTD em conformidade com as diretrizes da companhia.
                </div>
              ) : (
                <ul className="space-y-0.5 pl-1.5">
                  {justifications.ytdImpacts.map((imp) => (
                    <li key={imp.id} className="text-[9.5px] text-[#333333] leading-snug">
                      <span className="font-bold text-[#192B1C]">• {imp.name} (</span>
                      <strong className={`font-bold ${imp.value < 0 ? 'text-[#8B0000]' : 'text-[#14412A]'}`}>
                        {formatCurrencyShort(imp.value)}
                      </strong>
                      <span className="font-bold text-[#192B1C]">): </span>
                      <span>{imp.justification || 'Impacto acumulado no ano apurado.'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* RODAPÉ DO SLIDE */}
        <div className="pt-2 border-t border-[#A7AC98]/40 flex items-center justify-between text-[8px] text-[#8C9283] font-semibold tracking-wider uppercase">
          <span>USO INTERNO</span>
          <span className="flex items-center gap-1 normal-case tracking-normal">
            <Sparkles className="w-2.5 h-2.5 text-[#39FF00]" /> NIO Fibra Óptica - Controladoria Executiva
          </span>
        </div>
      </div>
    </div>
  );
};
