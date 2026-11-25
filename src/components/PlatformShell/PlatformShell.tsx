import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { FINANCIAL_MODULES, FinancialModuleId, PlatformPageId } from '../../config/modules';
import { ModuleMenu } from '../ModuleMenu';

interface PlatformShellProps {
  activePage: PlatformPageId;
  onSelectModule: (moduleId: FinancialModuleId) => void;
  onBackToHub: () => void;
  children: React.ReactNode;
}

export const PlatformShell: React.FC<PlatformShellProps> = ({
  activePage,
  onSelectModule,
  onBackToHub,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen lg:h-screen w-full bg-[#F3F4F6] text-[#18181B] flex flex-col lg:flex-row font-sans lg:overflow-hidden">
      {/* Barra superior mobile/tablet (< lg) */}
      <div className="lg:hidden sticky top-0 z-30 bg-[#1C1C1E] text-white px-4 py-2.5 flex items-center justify-between gap-3 border-b border-white/10 shadow-sm">
        <button
          type="button"
          onClick={onBackToHub}
          className="flex items-center gap-1.5 cursor-pointer"
          title="Ir para o Hub Finanças"
        >
          <div className="h-7 w-9 rounded-md overflow-hidden bg-[#2FE800] flex items-center justify-center">
            <img src="/Logos/nio.png" alt="NIO" className="w-full h-full object-cover" />
          </div>
          <div className="h-7 w-11 rounded-md bg-white/95 px-1 py-0.5 flex items-center justify-center">
            <img src="/Logos/vtal.png" alt="V.tal" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="h-7 w-11 rounded-md bg-white/95 px-1 py-0.5 flex items-center justify-center">
            <img src="/Logos/tecto.png" alt="Tecto" className="max-h-full max-w-full object-contain" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu de módulos"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span>Módulos</span>
        </button>
      </div>

      {/* Drawer mobile (< lg) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-2xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 w-[285px] max-w-[85vw] h-full shadow-2xl">
            <ModuleMenu
              modules={FINANCIAL_MODULES}
              activePage={activePage}
              onSelectModule={onSelectModule}
              onSelectHome={onBackToHub}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Sidebar fixa à esquerda de 285px (desktop/notebook >= lg) */}
      <div className="hidden lg:block w-[285px] shrink-0 h-full border-r border-[#2B2B2E]">
        <ModuleMenu
          modules={FINANCIAL_MODULES}
          activePage={activePage}
          onSelectModule={onSelectModule}
          onSelectHome={onBackToHub}
        />
      </div>

      {/* Área principal neutra ocupando toda a largura restante */}
      <div className="relative flex-1 min-w-0 flex flex-col lg:h-full lg:overflow-y-auto bg-[#F3F4F6]">
        <div className="relative z-10 flex-1 w-full px-5 sm:px-7 lg:px-8 py-5 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};
