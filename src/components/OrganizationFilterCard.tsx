import React from 'react';
import { Building2, Layers, ListFilter, CheckCircle2, AlertCircle } from 'lucide-react';

type StatusFilter = 'ALL' | 'COMPLETED' | 'PENDING';

interface OrganizationFilterCardProps {
  diretorias: string[];
  selectedDiretoria: string;
  onSelectDiretoria: (dir: string) => void;
  areas: string[];
  selectedArea: string;
  onSelectArea: (area: string) => void;
  selectedStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
  statusCounts: { total: number; completed: number; pending: number };
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
  selectedStatus,
  onSelectStatus,
  statusCounts,
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
            <h2 className="font-bold text-[#14412A] text-base">Filtro Organizacional</h2>
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
                Diretoria
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
              <option value="ALL">Todas as Diretorias</option>
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
                Área
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

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-[#14412A] mb-1.5">
              <ListFilter className="w-3.5 h-3.5 text-[#14412A]" />
              Status do preenchimento
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value as StatusFilter)}
              className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] text-[#14412A] focus:bg-white focus:border-[#14412A] focus:outline-hidden transition-all cursor-pointer"
            >
              <option value="ALL">Todas</option>
              <option value="COMPLETED">Concluído</option>
              <option value="PENDING">Pendente</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] px-2 py-2 text-center">
              <div className="text-[9px] font-bold uppercase tracking-wide text-[#768070]">Linhas</div>
              <div className="text-base font-extrabold text-[#14412A]">{statusCounts.total}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                <CheckCircle2 className="w-3 h-3" /> Concluídas
              </div>
              <div className="text-base font-extrabold text-emerald-800">{statusCounts.completed}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide text-amber-800">
                <AlertCircle className="w-3 h-3" /> Pendentes
              </div>
              <div className="text-base font-extrabold text-amber-800">{statusCounts.pending}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
