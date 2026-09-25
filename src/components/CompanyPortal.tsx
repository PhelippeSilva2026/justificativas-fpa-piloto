import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Loader2, X } from 'lucide-react';
import { CompanyId } from '../types';
import { COMPANIES } from '../utils/companyConfigs';
import { CompanyLogo } from './CompanyLogo';
import { PortalAiChat } from './PortalAiChat';

interface CompanyPortalProps {
  onSelectCompany: (companyId: CompanyId) => void;
  savedCounts: Record<CompanyId, number>;
}

export const CompanyPortal: React.FC<CompanyPortalProps> = ({
  onSelectCompany,
  savedCounts
}) => {
  const [reportCompany, setReportCompany] = useState<CompanyId | null>(null);
  const [reportMonth, setReportMonth] = useState('2026-09');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState('');

  // Modo padrão do portal: 'split' (cards de operações à esquerda e Chat com IA à direita)
  // O layout clássico permanece preservado caso seja necessário reativar
  const [viewMode] = useState<'split' | 'classic'>('split');

  // Referência para alinhar a altura exata da tela de chat com a base do card da Tecto
  const leftColRef = useRef<HTMLDivElement>(null);
  const [leftColHeight, setLeftColHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!leftColRef.current) return;
    const updateHeight = () => {
      if (leftColRef.current && window.innerWidth >= 1024) {
        setLeftColHeight(leftColRef.current.offsetHeight);
      } else {
        setLeftColHeight(undefined);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(leftColRef.current);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const openReport = (event: React.MouseEvent, companyId: CompanyId) => {
    event.stopPropagation();
    setReportCompany(companyId);
    setReportError('');
  };

  const generateReport = async () => {
    if (!reportCompany || !reportMonth) return;
    setIsGenerating(true);
    setReportError('');
    try {
      const [year, month] = reportMonth.split('-');
      const period = `${year}/${Number(month)}`;
      const response = await fetch('/api/reports/executive-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: reportCompany, period }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Não foi possível gerar o documento.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${reportCompany.toUpperCase()}_Fechamento_${year}_${month}_Leitura.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setReportCompany(null);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Não foi possível gerar o documento.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reportButton = (companyId: CompanyId, isCompact = false) => (
    <button
      type="button"
      onClick={(event) => openReport(event, companyId)}
      className={`border border-[#B9C2BC] bg-white hover:bg-[#F2F6F3] text-[#24352C] font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
        isCompact ? 'mt-2 w-full text-[11px] py-1.5 px-3' : 'mt-3 w-full text-xs px-4 py-2.5'
      }`}
    >
      <FileText size={isCompact ? 13 : 15} />
      <span>Gerar leitura executiva (.docx)</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F3F3F3] text-[#252525] flex flex-col font-sans selection:bg-[#4F927F]/25 selection:text-[#202020]">
      {/* Top Bar Corporativa */}
      <header className="bg-[#242424] text-white border-b border-black px-4 sm:px-6 py-2.5 shadow-sm sticky top-0 z-20">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/Logos/fpa-logo.jfif"
              alt="Logo FP&A"
              className="w-12 h-9 rounded-lg object-cover shadow-sm"
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Análise de desvios e Justificativas
              </h1>
              <p className="text-[11px] text-white/70">
                FP&A ManagementCo · NIO · V.tal · Tecto
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      {viewMode === 'split' ? (
        /* ============================================================
           NOVA TELA INICIAL DIVIDIDA:
           - Lado Esquerdo: NIO, V.tal e Tecto empilhados verticalmente
           - Lado Direito: Tela de Chat do Agente FP&A ampliada ao máximo
           ============================================================ */
        <main className="flex-1 w-full px-3 sm:px-5 lg:px-6 py-4 flex flex-col">
          <div className="mb-3">
            <h2 className="text-lg font-extrabold text-[#252525] tracking-tight">
              Selecione uma Empresa ou Consulte o Assistente Executivo
            </h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-start flex-1">
            {/* LADO ESQUERDO: Cards Operações (NIO, V.tal, Tecto) empilhados */}
            <div 
              ref={leftColRef}
              className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col gap-3.5"
            >
              {/* CARD 1: NIO FIBRA */}
              <div
                onClick={() => onSelectCompany('nio')}
                className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#14412A] p-5 transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#22E600]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#22E600]/20 transition-all"></div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs flex-shrink-0">
                      <CompanyLogo companyId="nio" size="md" className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-bold text-[#14412A] bg-[#22E600]/20 px-2.5 py-0.5 rounded-full border border-[#22E600]/40">
                      Operação FTTH
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-[#14412A] group-hover:text-[#0F351D] transition-colors">
                    {COMPANIES.nio.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#52604D] mt-0.5 mb-2 line-clamp-1">
                    {COMPANIES.nio.tagline}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F0ECE1] flex items-center justify-between">
                  <span className="text-[11px] text-[#52604D] font-medium">
                    {savedCounts.nio > 0 ? (
                      <span className="text-[#14412A] font-bold">✓ {savedCounts.nio} com notas</span>
                    ) : (
                      'Pronto para análise'
                    )}
                  </span>
                  <button className="bg-[#14412A] text-[#39FF00] font-bold text-xs px-3 py-1.5 rounded-xl group-hover:bg-[#0F2F1B] group-hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer">
                    <span>Acessar NIO</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
                {reportButton('nio', true)}
              </div>

              {/* CARD 2: V.TAL */}
              <div
                onClick={() => onSelectCompany('vtal')}
                className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-5 transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#00D8F6]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#00D8F6]/20 transition-all"></div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs flex-shrink-0 bg-[#E5E7E6] p-1">
                      <CompanyLogo companyId="vtal" size="md" className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-bold text-[#315F52] bg-[#4F927F]/15 px-2.5 py-0.5 rounded-full border border-[#4F927F]/35">
                      Rede Neutra &amp; Infra
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-[#252525] group-hover:text-[#315F52] transition-colors">
                    {COMPANIES.vtal.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#5E6562] mt-0.5 mb-2 line-clamp-1">
                    {COMPANIES.vtal.tagline}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F0ECE1] flex items-center justify-between">
                  <span className="text-[11px] text-[#52604D] font-medium">
                    {savedCounts.vtal > 0 ? (
                      <span className="text-[#0A192F] font-bold">✓ {savedCounts.vtal} com notas</span>
                    ) : (
                      'Pronto para análise'
                    )}
                  </span>
                  <button className="bg-[#242424] text-white font-bold text-xs px-3 py-1.5 rounded-xl group-hover:bg-[#4F927F] group-hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer">
                    <span>Acessar V.tal</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
                {reportButton('vtal', true)}
              </div>

              {/* CARD 3: TECTO */}
              <div
                onClick={() => onSelectCompany('tecto')}
                className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#10B981] p-5 transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#10B981]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#10B981]/20 transition-all"></div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs flex-shrink-0 bg-[#E5E7E6] p-1">
                      <CompanyLogo companyId="tecto" size="md" className="w-full h-full" />
                    </div>
                    <span className="text-[10px] font-bold text-[#315F52] bg-[#4F927F]/15 px-2.5 py-0.5 rounded-full border border-[#4F927F]/35">
                      Data Centers
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-[#252525] group-hover:text-[#315F52] transition-colors">
                    {COMPANIES.tecto.name}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#4B5563] mt-0.5 mb-2 line-clamp-1">
                    {COMPANIES.tecto.tagline}
                  </p>
                </div>

                <div className="mt-3 pt-3 border-t border-[#F0ECE1] flex items-center justify-between">
                  <span className="text-[11px] text-[#52604D] font-medium">
                    {savedCounts.tecto > 0 ? (
                      <span className="text-[#0F172A] font-bold">✓ {savedCounts.tecto} com notas</span>
                    ) : (
                      'Pronto para análise'
                    )}
                  </span>
                  <button className="bg-[#242424] text-white font-bold text-xs px-3 py-1.5 rounded-xl group-hover:bg-[#4F927F] group-hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer">
                    <span>Acessar Tecto</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </button>
                </div>
                {reportButton('tecto', true)}
              </div>
            </div>

            {/* LADO DIREITO: Chat da IA ocupando exatamente a mesma altura dos cards (alinhado com o Tecto) */}
            <div 
              className="flex-1 min-w-0 w-full flex flex-col"
              style={{ height: leftColHeight ? `${leftColHeight}px` : undefined }}
            >
              <PortalAiChat onSelectCompany={onSelectCompany} />
            </div>
          </div>
        </main>
      ) : (
        /* ============================================================
           TELA CLÁSSICA ORIGINAL (PRESERVADA 100%):
           - Grade horizontal de 3 Colunas com os 3 Cards Grandes
           ============================================================ */
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#14412A] bg-[#E2DFD2] px-3 py-1 rounded-md">
              Portal de análise FP&A (Modo Clássico)
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
              {reportButton('nio')}
            </div>

            {/* CARD 2: V.TAL */}
            <div
              onClick={() => onSelectCompany('vtal')}
              className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D8F6]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00D8F6]/20 transition-all duration-500"></div>

              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md flex-shrink-0 bg-[#E5E7E6] p-1">
                    <CompanyLogo companyId="vtal" size="lg" className="w-full h-full" />
                  </div>

                  <span className="text-[11px] font-semibold text-[#315F52] bg-[#4F927F]/15 px-2.5 py-1 rounded-lg border border-[#4F927F]/35">
                    Rede Neutra &amp; Infra
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
              {reportButton('vtal')}
            </div>

            {/* CARD 3: TECTO */}
            <div
              onClick={() => onSelectCompany('tecto')}
              className="group relative bg-white rounded-3xl border border-[#D5D5D5] hover:border-[#4F927F] p-7 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#10B981]/20 transition-all duration-500"></div>

              <div>
                <div className="flex items-center justify-between mb-6">
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
              {reportButton('tecto')}
            </div>
          </div>
        </main>
      )}

      {/* MODAL DE LEITURA EXECUTIVA WORD (COMPARTILHADO EM AMBOS OS MODOS) */}
      {reportCompany && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isGenerating && setReportCompany(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#D7DCD8] p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#E5E7E6] p-1 overflow-hidden shadow-sm">
                  <CompanyLogo companyId={reportCompany} size="md" className="w-full h-full" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#252525]">Gerar leitura executiva</h3>
                  <p className="text-xs text-[#68716C]">{COMPANIES[reportCompany].name} · Documento Word</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                disabled={isGenerating}
                onClick={() => setReportCompany(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6">
              <label htmlFor="report-month" className="block text-sm font-bold text-[#24352C] mb-2">
                Mês de referência
              </label>
              <input
                id="report-month"
                type="month"
                value={reportMonth}
                onChange={(event) => setReportMonth(event.target.value)}
                disabled={isGenerating}
                className="w-full rounded-xl border border-[#B9C2BC] px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#4F927F]/40 focus:border-[#4F927F]"
              />
              <p className="mt-2 text-xs leading-relaxed text-[#68716C]">
                O arquivo usará os dados financeiros, os indicadores físicos e as justificativas já salvas para essa competência.
              </p>
              {reportError && (
                <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{reportError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setReportCompany(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#4E5852] hover:bg-gray-100 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isGenerating || !reportMonth}
                onClick={generateReport}
                className="px-5 py-2.5 rounded-xl bg-[#242424] text-white text-sm font-bold hover:bg-[#315F52] disabled:opacity-50 flex items-center gap-2"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {isGenerating ? 'Gerando...' : 'Gerar Word'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
