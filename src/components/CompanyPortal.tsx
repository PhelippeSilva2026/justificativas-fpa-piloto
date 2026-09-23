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
    <div className="min-h-screen bg-[#F4F2EC] text-[#192B1C] flex flex-col font-sans selection:bg-[#39FF00]/30 selection:text-[#14412A]">
      {/* Top Bar Corporativa */}
      <header className="bg-[#14412A] text-white border-b border-[#1E5C3C] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#39FF00]/20 border border-[#39FF00]/40 flex items-center justify-center font-black text-[#39FF00] text-xs tracking-wider">
              FP&A
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Controladoria & FP&A Corporativo
              </h1>
              <p className="text-[11px] text-white/70">
                Ponte de Conciliação DRE · Análise de Desvios Orçamentários
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/80 bg-[#0F2F1B] px-3 py-1.5 rounded-lg border border-[#2E6B48]">
            <span className="w-2 h-2 rounded-full bg-[#39FF00] animate-pulse"></span>
            <span>Ambiente Integrado GCP & Bucket</span>
          </div>
        </div>
      </header>

      {/* Hero / Título do Portal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-[#14412A] bg-[#E2DFD2] px-3 py-1 rounded-md">
            Portal Multiusuário de Fechamento
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#14412A] tracking-tight mt-4">
            O que você deseja justificar hoje?
          </h2>
          <p className="text-base text-[#52604D] mt-3">
            Selecione a empresa ou unidade de negócio abaixo para abrir a análise de variações, preencher impactos e conciliações, ou gerar apresentações para a diretoria.
          </p>
        </div>

        {/* Grade com os 3 Cards Executivos: NIO, V.tal e Tecto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full">
          {/* CARD 1: NIO */}
          <div
            onClick={() => onSelectCompany('nio')}
            className="group relative bg-white rounded-3xl border-2 border-[#DCD8D2] hover:border-[#14412A] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
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
              <p className="text-xs text-[#6B7565] leading-relaxed">
                {COMPANIES.nio.description}
              </p>

              {/* Setores e Subcategorias chave */}
              <div className="mt-6 pt-5 border-t border-[#F0ECE1]">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#8C9283] block mb-2">
                  Linhas Contábeis Principais
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMPANIES.nio.sectors.map((sec) => (
                    <span
                      key={sec}
                      className="text-[11px] bg-[#F5F3EB] text-[#2C3B2D] px-2 py-0.5 rounded-md border border-[#E0DCD1]"
                    >
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
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
            className="group relative bg-white rounded-3xl border-2 border-[#DCD8D2] hover:border-[#0A192F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D8F6]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00D8F6]/20 transition-all duration-500"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                {/* Logo V.tal */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#071324] p-1">
                  <CompanyLogo companyId="vtal" size="lg" className="w-full h-full" />
                </div>

                <span className="text-[11px] font-semibold text-[#006A80] bg-[#00D8F6]/20 px-2.5 py-1 rounded-lg border border-[#00D8F6]/40">
                  Rede Neutra & Infra
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#0A192F] group-hover:text-[#003B73] transition-colors">
                {COMPANIES.vtal.name}
              </h3>
              <p className="text-xs font-semibold text-[#4A5D78] mt-1 mb-3">
                {COMPANIES.vtal.tagline}
              </p>
              <p className="text-xs text-[#6B7565] leading-relaxed">
                {COMPANIES.vtal.description}
              </p>

              {/* Setores e Subcategorias chave */}
              <div className="mt-6 pt-5 border-t border-[#F0ECE1]">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#8C9283] block mb-2">
                  Linhas Contábeis Principais
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMPANIES.vtal.sectors.map((sec) => (
                    <span
                      key={sec}
                      className="text-[11px] bg-[#F0F5FA] text-[#132A4A] px-2 py-0.5 rounded-md border border-[#D5E2F0]"
                    >
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
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
              <button className="bg-[#0A192F] text-[#00D8F6] font-bold text-xs px-4 py-2 rounded-xl group-hover:bg-[#06101E] group-hover:shadow-md transition-all flex items-center gap-1.5">
                <span>Acessar V.tal</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>

          {/* CARD 3: TECTO */}
          <div
            onClick={() => onSelectCompany('tecto')}
            className="group relative bg-white rounded-3xl border-2 border-[#DCD8D2] hover:border-[#0F172A] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#10B981]/20 transition-all duration-500"></div>

            <div>
              <div className="flex items-center justify-between mb-6">
                {/* Logo Tecto */}
                <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#090E17] p-1">
                  <CompanyLogo companyId="tecto" size="lg" className="w-full h-full" />
                </div>

                <span className="text-[11px] font-semibold text-[#0B7A58] bg-[#10B981]/20 px-2.5 py-1 rounded-lg border border-[#10B981]/40">
                  Data Centers
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#0F172A] group-hover:text-[#044E36] transition-colors">
                {COMPANIES.tecto.name}
              </h3>
              <p className="text-xs font-semibold text-[#4B5563] mt-1 mb-3">
                {COMPANIES.tecto.tagline}
              </p>
              <p className="text-xs text-[#6B7565] leading-relaxed">
                {COMPANIES.tecto.description}
              </p>

              {/* Setores e Subcategorias chave */}
              <div className="mt-6 pt-5 border-t border-[#F0ECE1]">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#8C9283] block mb-2">
                  Linhas Contábeis Principais
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMPANIES.tecto.sectors.map((sec) => (
                    <span
                      key={sec}
                      className="text-[11px] bg-[#F2FBF7] text-[#064E3B] px-2 py-0.5 rounded-md border border-[#D1F2E3]"
                    >
                      {sec}
                    </span>
                  ))}
                </div>
              </div>
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
              <button className="bg-[#0F172A] text-[#10B981] font-bold text-xs px-4 py-2 rounded-xl group-hover:bg-[#050912] group-hover:shadow-md transition-all flex items-center gap-1.5">
                <span>Acessar Tecto</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé informativo de Governança & Armazenamento */}
        <div className="mt-14 max-w-4xl mx-auto bg-white rounded-2xl p-5 border border-[#DCD8D2] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#52604D]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#14412A]/10 flex items-center justify-center font-bold text-[#14412A]">
              ☁
            </div>
            <div>
              <p className="font-semibold text-[#192B1C]">
                Arquitetura em Nuvem Sem Necessidade de Login Google
              </p>
              <p className="text-[11px] text-[#6B7565]">
                As justificativas salvas por analistas ficam gravadas por empresa e preparadas para sincronização com seu Bucket GCP e BigQuery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-[#F4F2EC] px-3 py-1 rounded-md font-mono text-[11px] text-[#14412A] border border-[#E0DCD1]">
              GCP Service Account
            </span>
          </div>
        </div>
      </main>
    </div>
  );
};
