import React from 'react';
import { CompanyLogo } from './CompanyLogo';
import { Download, FileSpreadsheet, Presentation, Layers, Cloud, ArrowLeft, Building2 } from 'lucide-react';
import { exportTemplateExcelFile } from '../utils/excelParser';
import { DREWorkbook, CompanyId } from '../types';
import { COMPANIES } from '../utils/companyConfigs';

interface NavbarProps {
  workbook: DREWorkbook | null;
  currentFileName: string;
  monthPrevious: string;
  monthCurrent: string;
  selectedPeriod: string;
  onSelectPeriod: (period: string) => void;
  onExportCurrentSlide: () => void;
  onExportAllSlides: () => void;
  onLoadSample: () => void;
  onOpenGcpModal: () => void;
  isExporting: boolean;
  activeView: 'dashboard' | 'presentation';
  onToggleView: (view: 'dashboard' | 'presentation') => void;
  totalSlides: number;
  currentCompany: CompanyId;
  onSelectCompany: (company: CompanyId) => void;
  onGoToPortal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  workbook,
  currentFileName,
  monthPrevious,
  monthCurrent,
  selectedPeriod,
  onSelectPeriod,
  onExportCurrentSlide,
  onExportAllSlides,
  onLoadSample,
  onOpenGcpModal,
  isExporting,
  activeView,
  onToggleView,
  totalSlides,
  currentCompany,
  onSelectCompany,
  onGoToPortal,
}) => {
  const availablePeriods = [
    '2026/1', '2026/2', '2026/3', '2026/4',
    '2026/5', '2026/6', '2026/7', '2026/8',
    '2026/9', '2026/10', '2026/11', '2026/12'
  ];

  const company = COMPANIES[currentCompany] || COMPANIES.nio;

  // Cores dinâmicas do header por empresa
  const headerBgClass =
    currentCompany === 'vtal'
      ? 'bg-[#0A192F] border-[#1B3A60]'
      : currentCompany === 'tecto'
      ? 'bg-[#0F172A] border-[#1E293B]'
      : 'bg-[#14412A] border-[#192B1C]';

  const accentColorText =
    currentCompany === 'vtal'
      ? 'text-[#00D8F6]'
      : currentCompany === 'tecto'
      ? 'text-[#10B981]'
      : 'text-[#39FF00]';

  const exportBtnBg =
    currentCompany === 'vtal'
      ? 'bg-[#00D8F6] text-[#0A192F] hover:bg-[#00c4e0]'
      : currentCompany === 'tecto'
      ? 'bg-[#10B981] text-[#0F172A] hover:bg-[#0ea372]'
      : 'bg-[#39FF00] text-[#192B1C] hover:bg-[#32e000]';

  return (
    <header className={`sticky top-0 z-40 ${headerBgClass} text-white border-b shadow-md transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* LOGO, BOTÃO INÍCIO E MARCA DA EMPRESA */}
        <div className="flex items-center gap-3">
          {/* Botão de Retorno ao Portal Inicial */}
          <button
            type="button"
            onClick={onGoToPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all shadow-xs cursor-pointer group"
            title="Voltar para a tela inicial de seleção de empresas"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Início</span>
          </button>

          {/* Logo da Empresa Selecionada */}
          <div className="flex items-center gap-3">
            <div className="flex items-center cursor-pointer" onClick={onGoToPortal} title="Clique para voltar ao Portal">
              <CompanyLogo companyId={currentCompany} size="md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                  Análise de Variações
                </h1>
                <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/30 border border-white/20 ${accentColorText}`}>
                  {company.shortName}
                </span>
              </div>
              <p className="text-[11px] text-white/70 hidden sm:block mt-0.5">
                {company.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* SELETOR DE EMPRESAS (NIO | VTAL | TECTO) */}
        <div className="hidden md:flex items-center bg-black/25 p-1 rounded-2xl border border-white/15">
          {(['nio', 'vtal', 'tecto'] as CompanyId[]).map((cid) => {
            const isSelected = currentCompany === cid;
            const cInfo = COMPANIES[cid];
            return (
              <button
                key={cid}
                type="button"
                onClick={() => onSelectCompany(cid)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? `${cid === 'vtal' ? 'bg-[#00D8F6] text-[#0A192F]' : cid === 'tecto' ? 'bg-[#10B981] text-[#0F172A]' : 'bg-[#39FF00] text-[#14412A]'} shadow-sm`
                    : 'text-white/75 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{cInfo.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* SELETOR INTERATIVO DE PERÍODO DRE */}
        <div className="hidden xl:flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-2xl border border-white/15 text-xs shadow-inner">
          <span className="text-white/70 font-medium">Período:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => onSelectPeriod(e.target.value)}
            className={`bg-black/40 font-bold text-xs px-2.5 py-1 rounded-lg border border-white/30 focus:outline-hidden cursor-pointer ${accentColorText}`}
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p} className="bg-[#14412A] text-white">
                {p}
              </option>
            ))}
          </select>
          <div className="text-[11px] text-white/60 pl-1 border-l border-white/20">
            <span className="text-white/90 font-semibold">M-1: {monthPrevious}</span>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center gap-2">
          {/* Alternar Modo Visualização */}
          <div className="hidden lg:flex items-center bg-black/25 p-1 rounded-full border border-white/15">
            <button
              type="button"
              onClick={() => onToggleView('dashboard')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-white/20 text-white shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Edição & Gráficos
            </button>
            <button
              type="button"
              onClick={() => onToggleView('presentation')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                activeView === 'presentation'
                  ? 'bg-white/20 text-white shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Presentation className={`w-3.5 h-3.5 ${accentColorText}`} />
              Slide 16:9
            </button>
          </div>

          {/* Baixar Modelo Excel */}
          <button
            type="button"
            onClick={() => exportTemplateExcelFile(workbook, `${company.excelFileName}`)}
            className="hidden xl:flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/25 hover:bg-black/40 text-xs font-medium text-white border border-white/20 transition-colors cursor-pointer"
            title="Baixar planilha Excel com dados atuais da empresa (.xlsx)"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${accentColorText}`} />
            Excel
          </button>

          {/* Conectar GCP */}
          <button
            type="button"
            onClick={onOpenGcpModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/25 hover:bg-black/40 text-xs font-bold text-white border border-white/20 transition-all shadow-xs cursor-pointer"
            title="Conectar a base à tabela ou bucket do Google Cloud Platform"
          >
            <Cloud className={`w-3.5 h-3.5 ${accentColorText}`} />
            <span>GCP</span>
          </button>

          {/* Exportar Slide Atual */}
          <button
            type="button"
            onClick={onExportCurrentSlide}
            disabled={isExporting}
            className={`px-3.5 sm:px-4 py-2 rounded-full font-extrabold text-xs active:scale-95 transition-all shadow-md flex items-center gap-1.5 sm:gap-2 cursor-pointer ${exportBtnBg}`}
            title="Exportar este slide N3 em formato .pptx com logo e formatação da empresa"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{isExporting ? 'Exportando...' : 'Exportar Slide'}</span>
            <span className="sm:hidden">PPTX</span>
          </button>

          {/* Exportar Deck Completo */}
          {totalSlides > 1 && (
            <button
              type="button"
              onClick={onExportAllSlides}
              disabled={isExporting}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full bg-white text-[#14412A] font-bold text-xs hover:bg-[#F6F2EE] transition-colors shadow-sm cursor-pointer"
              title={`Exportar apresentação completa da ${company.shortName} com todas as ${totalSlides} subcategorias`}
            >
              <Layers className="w-3.5 h-3.5 text-[#14412A]" />
              Deck ({totalSlides})
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
