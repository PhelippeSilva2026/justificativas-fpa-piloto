import React from 'react';
import { DRERow, RowJustifications } from '../types';
import { buildMonthWaterfallData, buildYTDWaterfallData } from '../utils/waterfallGenerator';
import { WaterfallCanvas } from './WaterfallCanvas';
import { BarChart3, TrendingUp } from 'lucide-react';

interface WaterfallRowProps {
  selectedRow: DRERow | null;
  justifications: RowJustifications;
}

export const WaterfallRow: React.FC<WaterfallRowProps> = ({
  selectedRow,
  justifications,
}) => {
  // Configuração padrão segura para quando nenhum dado estiver selecionado
  const dummyRow: DRERow = {
    id: 'empty',
    responsavel: '-',
    n1: '-',
    n2: '-',
    n3: '-',
    realMMinus1: 0,
    realCurrent: 0,
    orcadoCurrent: 0,
    diffOrcadoAbs: 0,
    diffOrcadoPct: 0,
    diffMMinus1Abs: 0,
    diffMMinus1Pct: 0,
    realYTD: 0,
    orcadoYTD: 0,
    diffOrcadoYTDAbs: 0,
    diffOrcadoYTDPct: 0,
  };

  const rowToUse = selectedRow || dummyRow;
  const monthConfig = buildMonthWaterfallData(rowToUse, justifications);
  const ytdConfig = buildYTDWaterfallData(rowToUse, justifications);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* CARD GRÁFICO 01: Waterfall Mês (MoM & Vs Orçado) */}
      <div className="bg-white rounded-3xl p-6 border border-[#D5DCD2] shadow-xs flex flex-col w-full">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8EDE5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14412A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              01
            </div>
            <div>
              <h3 className="text-base font-bold text-[#14412A]">
                Gráfico 01: Waterfall Mês (MoM &amp; Vs Orçado)
              </h3>
              <p className="text-xs text-[#5A6454]">
                Ponte de conciliação do Real M-1 até o Real do Mês, e desvios versus Orçado
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#14412A] bg-[#EFF4EC] px-3.5 py-1.5 rounded-full border border-[#CCD8C7]">
            Mensal (MoM &amp; Vs Orçado)
          </span>
        </div>

        {/* Container em Largura Total */}
        <div className="w-full bg-[#FAFBF9] rounded-2xl p-4 border border-[#CCD8C7] min-h-[380px] h-[390px]">
          <WaterfallCanvas config={monthConfig} />
        </div>
      </div>

      {/* CARD GRÁFICO 02: Waterfall YTD (Acumulado Ano) */}
      <div className="bg-white rounded-3xl p-6 border border-[#D5DCD2] shadow-xs flex flex-col w-full">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E8EDE5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#14412A] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              02
            </div>
            <div>
              <h3 className="text-base font-bold text-[#14412A]">
                Gráfico 02: Waterfall YTD (Acumulado no Ano)
              </h3>
              <p className="text-xs text-[#5A6454]">
                Evolução e abertura dos desvios acumulados do ano (Realizado YTD vs Orçado YTD)
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-[#14412A] bg-[#EFF4EC] px-3.5 py-1.5 rounded-full border border-[#CCD8C7]">
            Acumulado (YTD)
          </span>
        </div>

        {/* Container em Largura Total */}
        <div className="w-full bg-[#FAFBF9] rounded-2xl p-4 border border-[#CCD8C7] min-h-[380px] h-[390px]">
          <WaterfallCanvas config={ytdConfig} />
        </div>
      </div>
    </div>
  );
};
