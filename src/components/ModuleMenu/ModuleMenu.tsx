import React from 'react';
import { Home, X } from 'lucide-react';
import { FinancialModuleConfig, FinancialModuleId, PlatformPageId } from '../../config/modules';
import { ModuleCard } from '../ModuleCard';

interface ModuleMenuProps {
  modules: FinancialModuleConfig[];
  activePage: PlatformPageId;
  onSelectModule: (moduleId: FinancialModuleId) => void;
  onSelectHome: () => void;
  onCloseMobile?: () => void;
}

export const ModuleMenu: React.FC<ModuleMenuProps> = ({
  modules,
  activePage,
  onSelectModule,
  onSelectHome,
  onCloseMobile,
}) => {
  const isHomeActive = activePage === 'hub';

  const handleHomeClick = () => {
    onSelectHome();
    onCloseMobile?.();
  };

  const handleModuleClick = (moduleId: FinancialModuleId) => {
    onSelectModule(moduleId);
    onCloseMobile?.();
  };

  return (
    <aside className="relative bg-gradient-to-b from-[#1F1F21] via-[#1C1C1E] to-[#141416] text-white flex flex-col h-full w-full overflow-hidden select-none">
      {/* Arcos decorativos sutis em tom neutro na base da barra lateral */}
      <svg
        aria-hidden="true"
        viewBox="0 0 285 180"
        fill="none"
        className="pointer-events-none absolute bottom-0 left-0 w-full h-44 opacity-25"
      >
        <path
          d="M-30 165 C 50 95, 160 75, 275 115"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeOpacity="0.16"
        />
        <path
          d="M-20 185 C 65 120, 175 110, 290 150"
          stroke="#FFFFFF"
          strokeWidth="1"
          strokeOpacity="0.09"
        />
      </svg>

      {/* Cabeçalho com as 3 logos lado a lado */}
      <div className="relative z-10 px-4 pt-4 pb-3.5 border-b border-white/10">
        <div className="flex items-center justify-between gap-2 lg:hidden mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
            Plataforma Financeira
          </span>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleHomeClick}
          title="Ir para o Hub Finanças"
          className="w-full grid grid-cols-3 gap-2 items-center cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl"
        >
          <div className="h-10 rounded-lg overflow-hidden bg-[#2FE800] flex items-center justify-center shadow-xs">
            <img
              src="/Logos/nio.png"
              alt="NIO"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="h-10 rounded-lg bg-white/95 px-2 py-1 flex items-center justify-center shadow-xs">
            <img
              src="/Logos/vtal.png"
              alt="V.tal"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="h-10 rounded-lg bg-white/95 px-1.5 py-1 flex items-center justify-center shadow-xs">
            <img
              src="/Logos/tecto.png"
              alt="Tecto Data Centers"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </button>
      </div>

      {/* Navegação limpa em paleta neutra: Início + 9 módulos (15px, botões maiores) */}
      <nav
        className="relative z-10 flex-1 overflow-y-auto px-3 py-4 space-y-1.5"
        aria-label="Menu de módulos da Plataforma Financeira"
      >
        <button
          type="button"
          onClick={handleHomeClick}
          aria-current={isHomeActive ? 'page' : undefined}
          className={`w-full text-left group rounded-xl px-4 py-3 transition-all duration-150 cursor-pointer flex items-center gap-3.5 ${
            isHomeActive
              ? 'bg-[#09090B] text-white font-semibold shadow-xs ring-1 ring-white/20'
              : 'text-neutral-300 hover:bg-white/[0.08] hover:text-white font-medium'
          }`}
        >
          <Home
            className={`w-[18px] h-[18px] shrink-0 transition-colors ${
              isHomeActive ? 'text-white' : 'text-neutral-400 group-hover:text-white'
            }`}
          />
          <span className="text-[15px] leading-snug tracking-tight truncate">
            Início
          </span>
        </button>

        <div className="border-t border-white/10 my-2.5" />

        <div className="space-y-1.5">
          {modules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              isSelected={activePage === mod.id}
              onSelect={handleModuleClick}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
};
