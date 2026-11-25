import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { RealEstateMonthlyPoint } from '../../types/realEstate';
import { formatAnomesLabel, formatBrl, formatBrlCompact, formatInt } from './realEstateFormatters';

interface RealEstateMonthlyChartProps {
  monthly: RealEstateMonthlyPoint[];
  selectedAnomes: string;
  tipoLabel: string;
  onSelectMonth: (anomes: string) => void;
}

export const RealEstateMonthlyChart: React.FC<RealEstateMonthlyChartProps> = ({
  monthly,
  selectedAnomes,
  tipoLabel,
  onSelectMonth,
}) => {
  const [hoveredMonth, setHoveredMonth] = useState<RealEstateMonthlyPoint | null>(null);

  const maxMagnitude = Math.max(
    1,
    ...monthly.map((m) => Math.max(Math.abs(m.grossCost), Math.abs(m.grossCredit), Math.abs(m.netTotal)))
  );

  const activePoint =
    hoveredMonth ||
    (selectedAnomes !== 'ALL' ? monthly.find((m) => m.anomes === selectedAnomes) || null : null);

  return (
    <section className="bg-white rounded-2xl border border-[#D5DCD2] shadow-xs p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E6EBE4]">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#315F52]" />
            <h2 className="text-base font-extrabold text-[#1E3A32] tracking-tight">
              Evolução Mensal · {tipoLabel}
            </h2>
          </div>
          <p className="text-xs text-[#52605A] mt-0.5">
            Clique em qualquer competência para filtrar toda a página por mês.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-[#52605A]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#315F52]" />
            Custos OPEX
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#4F927F]" />
            Receitas / Venda / Créditos
          </span>
        </div>
      </div>

      <div className="mt-3 mb-4 min-h-[34px] rounded-xl bg-[#FAFBF9] border border-[#E6EBE4] px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {activePoint ? (
          <>
            <div className="font-bold text-[#1E3A32]">
              {formatAnomesLabel(activePoint.anomes)} ({activePoint.anomes})
              <span className="text-[#68756E] font-medium ml-2 tabular-nums">
                · {formatInt(activePoint.rows)} lançamentos
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 tabular-nums">
              <span className="text-[#52605A]">
                Custos: <strong className="text-rose-700">{formatBrl(activePoint.grossCost)}</strong>
              </span>
              <span className="text-[#52605A]">
                Receitas/Créditos: <strong className="text-emerald-700">+{formatBrl(activePoint.grossCredit)}</strong>
              </span>
              <span className="text-[#52605A]">
                Líquido: <strong className="text-[#1E3A32]">{formatBrl(activePoint.netTotal)}</strong>
              </span>
            </div>
          </>
        ) : (
          <span className="text-[#68756E]">
            Passe o mouse ou clique em um mês para inspecionar Custos, Receitas/Créditos e Resultado Líquido.
          </span>
        )}
      </div>

      {monthly.length === 0 ? (
        <div className="py-10 text-center text-xs text-[#68756E]">
          Sem lançamentos mensais para os filtros atuais.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 items-end pt-2">
          {monthly.map((m) => {
            const costH = m.grossCost !== 0 ? Math.max(4, Math.round((Math.abs(m.grossCost) / maxMagnitude) * 108)) : 0;
            const creditH = m.grossCredit > 0 ? Math.max(4, Math.round((m.grossCredit / maxMagnitude) * 108)) : 0;
            const isSelected = selectedAnomes === m.anomes;

            return (
              <button
                key={m.anomes}
                type="button"
                onMouseEnter={() => setHoveredMonth(m)}
                onMouseLeave={() => setHoveredMonth(null)}
                onClick={() => onSelectMonth(isSelected ? 'ALL' : m.anomes)}
                className={`group flex flex-col items-center p-2 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#315F52] bg-[#EBF2EE] ring-1 ring-[#315F52]'
                    : 'border-transparent hover:border-[#D5DCD2] hover:bg-[#FAFBF9]'
                }`}
              >
                <div
                  className={`text-[11px] font-bold tabular-nums mb-1 whitespace-nowrap ${
                    m.netTotal > 0 ? 'text-emerald-700' : 'text-[#1E3A32]'
                  }`}
                >
                  {formatBrlCompact(m.netTotal)}
                </div>

                <div className="w-full h-28 flex items-end justify-center border-b border-[#E6EBE4]">
                  <svg width="36" height="112" viewBox="0 0 36 112" aria-hidden="true">
                    {costH > 0 && (
                      <rect
                        x="3"
                        y={112 - costH}
                        width="13"
                        height={costH}
                        rx="3"
                        fill={isSelected ? '#1E3A32' : '#315F52'}
                      />
                    )}
                    {creditH > 0 && (
                      <rect
                        x="20"
                        y={112 - creditH}
                        width="13"
                        height={creditH}
                        rx="3"
                        fill="#4F927F"
                      />
                    )}
                  </svg>
                </div>

                <div className="mt-2 text-xs font-bold text-[#1E3A32]">
                  {formatAnomesLabel(m.anomes)}
                </div>
                <div className="text-[10px] text-[#68756E] tabular-nums">
                  {formatInt(m.rows)} lin.
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
