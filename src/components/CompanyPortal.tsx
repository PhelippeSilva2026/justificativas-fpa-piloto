import React from 'react';
import { CompanyId } from '../types';
import { COMPANIES } from '../utils/companyConfigs';
import { CompanyLogo } from './CompanyLogo';

interface CompanyPortalProps {
  onSelectCompany: (companyId: CompanyId) => void;
  savedCounts: Record<CompanyId, number>;
}

export const CompanyPortal: React.FC<CompanyPortalProps> = ({
  onSelectCompany,
  savedCounts
}) => {
  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#252525] flex flex-col font-sans selection:bg-[#4F927F]/25 selection:text-[#202020]">
      {/* Top Bar Corporativa */}
      <header className="bg-[#242424] text-white border-b border-black px-6 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/Logos/fpa-logo.jfif"
              alt="Logo FP&A"
              className="w-16 h-11 rounded-lg object-cover shadow-sm"
            />
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Análise de desvios e Justificativas
              </h1>
              <p className="text-[11px] text-white/70">
                FP&A ManagementCo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/80 bg-black/25 px-3 py-1.5 rounded-lg border border-white/15">
            <span className="w-2 h-2 rounded-full bg-[#4F927F] animate-pulse"></span>
            <span>Ambiente Integrado GCP & Bucket</span>
          </div>
        </div>
      </header>

      {/* Hero / Título do Portal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14412A] bg-[#E2DFD2] px-3 py-1 rounded-md">
            Portal de análise FP&A
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#252525] tracking-tight mt-4">
            O que você deseja analisar hoje?
          </h2>
        </div>

        {/* Grade com os 3 Cards Executivos: NIO, V.tal e Tecto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
          {/* CARD 1: NIO */}
          <div
            onClick={() => onSelectCompany('nio')}
            className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#22E600]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#22E600]/20 transition-all duration-500"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                {/* Logo NIO */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                  <CompanyLogo companyId="nio" size="lg" className="w-full h-full" />
                </div>

                <span className="text-[11px] font-semibold text-[#14412A] bg-[#22E600]/20 px-2.5 py-1 rounded-lg border border-[#22E600]/40">
                  Operação FTTH
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#14412A] group-hover:text-[#0F351D] transition-colors">
                {COMPANIES.nio.name}
              </h3>
              <p className="text-xs font-semibold text-[#52604D] mt-1 mb-3">
                {COMPANIES.nio.tagline}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-[#F0ECE1] flex items-center justify-between">
              <span className="text-xs text-[#52604D] font-medium">
                {savedCounts.nio > 0 ? (
                  <span className="text-[#14412A] font-semibold">
                    ✓ {savedCounts.nio} contas com notas
                  </span>
                ) : (
                  'Pronto para preenchimento'
                )}
              </span>
              <button className="bg-[#14412A] text-[#39FF00] font-bold text-xs px-4 py-2 rounded-xl group-hover:bg-[#0F2F1B] group-hover:shadow-md transition-all flex items-center gap-1.5">
                <span>Acessar NIO</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>

          {/* CARD 2: V.TAL */}
          <div
            onClick={() => onSelectCompany('vtal')}
            className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D8F6]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00D8F6]/20 transition-all duration-500"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                {/* Logo V.tal */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#E5E7E6] p-1">
                  <CompanyLogo companyId="vtal" size="lg" className="w-full h-full" />
                </div>

                <span className="text-[11px] font-semibold text-[#315F52] bg-[#4F927F]/15 px-2.5 py-1 rounded-lg border border-[#4F927F]/35">
                  Rede Neutra & Infra
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#252525] group-hover:text-[#315F52] transition-colors">
                {COMPANIES.vtal.name}
              </h3>
              <p className="text-xs font-semibold text-[#5E6562] mt-1 mb-3">
                {COMPANIES.vtal.tagline}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-[#F0ECE1] flex items-center justify-between">
              <span className="text-xs text-[#52604D] font-medium">
                {savedCounts.vtal > 0 ? (
                  <span className="text-[#0A192F] font-semibold">
                    ✓ {savedCounts.vtal} contas com notas
                  </span>
                ) : (
                  'Pronto para preenchimento'
                )}
              </span>
              <button className="bg-[#242424] text-white font-bold text-xs px-4 py-2 rounded-xl group-hover:bg-[#4F927F] group-hover:shadow-md transition-all flex items-center gap-1.5">
                <span>Acessar V.tal</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>

          {/* CARD 3: TECTO */}
          <div
            onClick={() => onSelectCompany('tecto')}
            className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#10B981]/20 transition-all duration-500"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                {/* Logo Tecto */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#E5E7E6] p-1">
                  <CompanyLogo companyId="tecto" size="lg" className="w-full h-full" />
                </div>

                <span className="text-[11px] font-semibold text-[#315F52] bg-[#4F927F]/15 px-2.5 py-1 rounded-lg border border-[#4F927F]/35">
                  Data Centers
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#252525] group-hover:text-[#315F52] transition-colors">
                {COMPANIES.tecto.name}
              </h3>
              <p className="text-xs font-semibold text-[#4B5563] mt-1 mb-3">
                {COMPANIES.tecto.tagline}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-[#F0ECE1] flex items-center justify-between">
              <span className="text-xs text-[#52604D] font-medium">
                {savedCounts.tecto > 0 ? (
                  <span className="text-[#0F172A] font-semibold">
                    ✓ {savedCounts.tecto} contas com notas
                  </span>
                ) : (
                  'Pronto para preenchimento'
                )}
              </span>
              <button className="bg-[#242424] text-white font-bold text-xs px-4 py-2 rounded-xl group-hover:bg-[#4F927F] group-hover:shadow-md transition-all flex items-center gap-1.5">
                <span>Acessar Tecto</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
