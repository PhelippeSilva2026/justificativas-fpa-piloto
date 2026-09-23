import React from 'react';
import { Building2, Layers, RefreshCw } from 'lucide-react';

interface OrganizationFilterCardProps {
  diretorias: string[];
  selectedDiretoria: string;
  onSelectDiretoria: (dir: string) => void;
  areas: string[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  onOpenGcpModal?: () => void;
  totalFilteredLines: number;
  totalLines: number;
}

export const OrganizationFilterCard: React.FC<OrganizationFilterCardProps> = ({
  diretorias,
  selectedDiretoria,
  onSelectDiretoria,
  areas,
  selectedArea,
  onSelectArea,
  onOpenGcpModal,
  totalFilteredLines,
  totalLines,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-[#D5DCD2] p-5 shadow-xs flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#14412A] text-white text-xs font-bold">
              1
            </span>
            <h2 className="font-bold text-[#14412A] text-base">Filtro Organizacional (NIO)</h2>
          </div>
        </div>

        <p className="text-xs text-[#5A6454] mb-4">
          Selecione a <strong>Diretoria</strong> e a <strong>Área</strong> para filtrar os desvios e alimentar as análises da DRE.
        </p>

        <div className="space-y-3.5">
          {/* Campo Diretoria (DIRETORIA_NIO) */}
          <div>
            <label className="flex items-center justify-between text-xs font-bold text-[#14412A] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#14412A]" />
                Diretoria (DIRETORIA_NIO)
              </span>
              <span className="text-[10px] text-[#5A6454] font-normal">
                {diretorias.length} diretoria(s)
              </span>
            </label>
            <select
              value={selectedDiretoria}
              onChange={(e) => onSelectDiretoria(e.target.value)}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] text-[#14412A] focus:bg-white focus:border-[#14412A] focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">Todas as Diretorias (Consolidado NIO)</option>
              {diretorias.map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
          </div>

          {/* Campo Área (AREA_NIO) */}
          <div>
            <label className="flex items-center justify-between text-xs font-bold text-[#14412A] mb-1.5">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#14412A]" />
                Área (AREA_NIO)
              </span>
              <span className="text-[10px] text-[#5A6454] font-normal">
                {areas.length} área(s)
              </span>
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onSelectArea(e.target.value)}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] text-[#14412A] focus:bg-white focus:border-[#14412A] focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">Todas as Áreas da Diretoria</option>
              {areas.map((ar) => (
                <option key={ar} value={ar}>
                  {ar}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Rodapé do Card */}
      <div className="mt-4 pt-3 border-t border-[#E8EDE5] flex items-center justify-between text-[11px] text-[#5A6454]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#39FF00] animate-pulse" />
          <span className="font-mono text-[10px] text-[#14412A]">agente_fpa.DRE_FINAL_EXECUTIVA</span>
        </div>
        <span className="font-medium text-[#14412A]">
          <strong>{totalFilteredLines}</strong> de {totalLines} linhas
        </span>
      </div>
    </div>
  );
};
