import React from 'react';
import { ChevronLeft, Construction } from 'lucide-react';

interface PlaceholderModulePageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onBackToHub: () => void;
}

export const PlaceholderModulePage: React.FC<PlaceholderModulePageProps> = ({
  title,
  description,
  icon,
  onBackToHub,
}) => {
  return (
    <div className="flex-1 flex flex-col w-full">
      <div className="mb-3">
        <button
          type="button"
          onClick={onBackToHub}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#52525B] hover:text-[#18181B] transition-colors cursor-pointer group"
        >
          <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar à Plataforma Financeira</span>
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-[#18181B] tracking-tight leading-tight">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-[#52525B] mt-1 font-medium">
          {description}
        </p>
      </div>

      <div className="w-full bg-white rounded-3xl border border-[#D8DCE0] shadow-xs p-8 sm:p-10">
        <div className="flex items-start gap-4 pb-6 border-b border-[#E5E7EB]">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] border border-[#E5E7EB] text-[#242424] flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#18181B] tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-[#52525B] mt-0.5">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-6 py-14 text-center flex flex-col items-center justify-center">
          <div className="w-11 h-11 rounded-2xl bg-[#F3F4F6] text-[#242424] flex items-center justify-center mb-3">
            <Construction className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-[#18181B]">
            Módulo em construção — selecione uma futura análise ou relatório.
          </p>
        </div>
      </div>
    </div>
  );
};
