import React from 'react';
import {
  BarChart3,
  FileCheck2,
  Zap,
  Building2,
  Scale,
  Plane,
  HardHat,
  Settings2,
  Megaphone,
} from 'lucide-react';
import { FinancialModuleConfig } from '../../config/modules';

const ICON_MAP: Record<FinancialModuleConfig['iconName'], React.ComponentType<{ className?: string }>> = {
  BarChart3,
  FileCheck2,
  Zap,
  Building2,
  Scale,
  Plane,
  HardHat,
  Settings2,
  Megaphone,
};

interface ModuleCardProps {
  module: FinancialModuleConfig;
  isSelected?: boolean;
  onSelect: (moduleId: FinancialModuleConfig['id']) => void;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  isSelected = false,
  onSelect,
}) => {
  const Icon = ICON_MAP[module.iconName];

  return (
    <button
      type="button"
      onClick={() => onSelect(module.id)}
      title={module.description}
      aria-current={isSelected ? 'page' : undefined}
      className={`w-full text-left group rounded-xl px-4 py-3 transition-all duration-150 cursor-pointer flex items-center gap-3.5 ${
        isSelected
          ? 'bg-[#09090B] text-white font-semibold shadow-xs ring-1 ring-white/20'
          : 'text-neutral-300 hover:bg-white/[0.08] hover:text-white font-medium'
      }`}
    >
      <Icon
        className={`w-[18px] h-[18px] shrink-0 transition-colors ${
          isSelected ? 'text-white' : 'text-neutral-400 group-hover:text-white'
        }`}
      />
      <span className="text-[15px] leading-snug tracking-tight truncate">
        {module.title}
      </span>
    </button>
  );
};
