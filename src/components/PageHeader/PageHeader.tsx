import React from 'react';
import { ArrowLeft, Landmark } from 'lucide-react';

interface PageHeaderProps {
  showBackButton?: boolean;
  onBackToHub?: () => void;
  sectionTitle?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  showBackButton = false,
  onBackToHub,
  sectionTitle,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#14412A] text-white border-b border-[#0E2F1E] shadow-sm">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all cursor-pointer shrink-0 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar à Plataforma Financeira</span>
            </button>
          )}

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Landmark className="w-4.5 h-4.5 text-[#39FF00]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white leading-none truncate">
                  Plataforma Financeira
                </h1>
                {sectionTitle && (
                  <>
                    <span className="text-white/35 text-sm hidden sm:inline">/</span>
                    <span className="text-xs sm:text-sm font-semibold text-[#D8FED4] truncate hidden sm:inline">
                      {sectionTitle}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
