/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { DRERow, DREWorkbook, RowJustifications, CompanyId } from './types';
import { exportToPowerPoint } from './utils/pptxExport';
import { calculateDREFromRaw, convertGcpRowsToWorkbook } from './utils/gcpConnector';
import { COMPANIES, getCompanyWorkbook, getCompanySampleJustifications } from './utils/companyConfigs';
import { CompanyPortal } from './components/CompanyPortal';
import { Navbar } from './components/Navbar';
import { OrganizationFilterCard } from './components/OrganizationFilterCard';
import { SelectionCard } from './components/SelectionCard';
import { ImpactsSection } from './components/ImpactsSection';
import { WaterfallRow } from './components/WaterfallRow';
import { SlidePreview } from './components/SlidePreview';
import { GcpConnectionModal } from './components/GcpConnectionModal';
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export default function App() {
  // Controle de Empresa / Tela Inicial: null exibe o Portal Corporativo de Entrada
  const [activeCompany, setActiveCompany] = useState<CompanyId | null>(() => {
    const saved = localStorage.getItem('corp_active_company');
    return saved === 'nio' || saved === 'vtal' || saved === 'tecto'
      ? (saved as CompanyId)
      : null;
  });

  const currentCompanyConfig = activeCompany ? COMPANIES[activeCompany] : null;

  // Inicializa a DRE conforme a empresa ativa ou amostra padrão
  const [workbook, setWorkbook] = useState<DREWorkbook>(() => {
    const initialCid = (localStorage.getItem('corp_active_company') as CompanyId) || 'nio';
    return getCompanyWorkbook(initialCid);
  });
  const [gcpWorkbook, setGcpWorkbook] = useState<DREWorkbook | null>(null);

  const [currentFileName, setCurrentFileName] = useState<string>(() => {
    const initialCid = (localStorage.getItem('corp_active_company') as CompanyId) || 'nio';
    return COMPANIES[initialCid]?.excelFileName || 'DRE_FINAL_EXECUTIVA (GCP)';
  });

  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026/8');
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');

  const [selectedRowId, setSelectedRowId] = useState<string>(() => {
    const initialCid = (localStorage.getItem('corp_active_company') as CompanyId) || 'nio';
    return getCompanyWorkbook(initialCid).rows[0]?.id || '';
  });

  const [justificationsMap, setJustificationsMap] = useState<Record<string, RowJustifications>>(() => {
    const initialCid: CompanyId = (localStorage.getItem('corp_active_company') as CompanyId) || 'nio';
    const storageKey = COMPANIES[initialCid]?.storageKey || 'nio_justifications_v1';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return initialCid === 'nio' ? {} : getCompanySampleJustifications(initialCid);
  });

  // Salva automaticamente qualquer alteração de justificativas no armazenamento da empresa ativa
  useEffect(() => {
    if (!activeCompany) return;
    const storageKey = COMPANIES[activeCompany]?.storageKey || 'nio_justifications_v1';
    try {
      localStorage.setItem(storageKey, JSON.stringify(justificationsMap));
    } catch (e) {
      console.warn('Erro ao salvar justificativas no localStorage:', e);
    }
  }, [justificationsMap, activeCompany]);
  const [activeView, setActiveView] = useState<'dashboard' | 'presentation'>('dashboard');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isGcpModalOpen, setIsGcpModalOpen] = useState<boolean>(false);
  const [isAutoLoadingGcp, setIsAutoLoadingGcp] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Carregamento automático e 100% conectado com o BigQuery no boot do aplicativo
  useEffect(() => {
    let isCancelled = false;

    async function autoLoadBigQuery() {
      try {
        const resp = await fetch('/api/gcp/auto-load');
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        if (isCancelled) return;

        if (data.success && Array.isArray(data.rows) && data.rows.length > 0) {
          const wb = convertGcpRowsToWorkbook(data.rows, '2026/8');
          setGcpWorkbook(wb);
          setWorkbook(wb);
          setCurrentFileName('agente_fpa.DRE_FINAL_EXECUTIVA (GCP)');
          if (wb.rows.length > 0) {
            setSelectedRowId(wb.rows[0].id);
          }
          if (wb.monthCurrent) {
            setSelectedPeriod(wb.monthCurrent);
          }
          showToast(`Conectado automaticamente ao BigQuery! ${data.rows.length} linhas carregadas.`, 'success');
        }
      } catch (err) {
        console.warn('Auto-load BigQuery inicial:', err);
      } finally {
        if (!isCancelled) {
          setIsAutoLoadingGcp(false);
        }
      }
    }

    autoLoadBigQuery();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Mantém a NIO ligada ao workbook real mesmo quando o usuário volta ao
  // portal e seleciona a empresa novamente.
  useEffect(() => {
    if (activeCompany === 'nio' && gcpWorkbook) {
      setWorkbook(gcpWorkbook);
      setCurrentFileName('agente_fpa.DRE_FINAL_EXECUTIVA (GCP)');
      if (gcpWorkbook.rows.length > 0) {
        setSelectedRowId(gcpWorkbook.rows[0].id);
      }
    }
  }, [activeCompany, gcpWorkbook]);

  // Seleção e alternância de empresa (NIO, V.tal, Tecto)
  const handleSelectCompany = (cid: CompanyId) => {
    setActiveCompany(cid);
    localStorage.setItem('corp_active_company', cid);

    const wb = cid === 'nio' && gcpWorkbook ? gcpWorkbook : getCompanyWorkbook(cid);
    setWorkbook(wb);
    setCurrentFileName(COMPANIES[cid].excelFileName);
    if (wb.rows.length > 0) {
      setSelectedRowId(wb.rows[0].id);
    }
    setSelectedDiretoria('ALL');
    setSelectedArea('ALL');

    // Recupera justificativas da empresa selecionada
    try {
      const saved = localStorage.getItem(COMPANIES[cid].storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setJustificationsMap(parsed);
          showToast(`Ambiente ${COMPANIES[cid].name} carregado com sucesso!`, 'success');
          return;
        }
      }
    } catch {}

    setJustificationsMap(cid === 'nio' ? {} : getCompanySampleJustifications(cid));
    showToast(`Ambiente ${COMPANIES[cid].name} carregado com sucesso!`, 'success');
  };

  const handleGoToPortal = () => {
    setActiveCompany(null);
    localStorage.removeItem('corp_active_company');
  };

  // Contagem de justificativas salvas por empresa para exibição no Portal
  const savedCounts: Record<CompanyId, number> = useMemo(() => {
    const counts: Record<CompanyId, number> = { nio: 0, vtal: 0, tecto: 0 };
    (['nio', 'vtal', 'tecto'] as CompanyId[]).forEach((cid) => {
      try {
        const raw = localStorage.getItem(COMPANIES[cid].storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            counts[cid] = Object.keys(parsed).length;
          }
        }
      } catch {}
    });
    return counts;
  }, [justificationsMap, activeCompany]);

  // Troca de Período DRE (ex: "2026/8", "2026/9")
  const handleSelectPeriod = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    if (workbook.rawRecords && workbook.rawRecords.length > 0) {
      try {
        const recalculated = calculateDREFromRaw(workbook.rawRecords, newPeriod);
        setWorkbook(recalculated);
        showToast(`Período atualizado para ${newPeriod}. Valores e desvios recalculados!`, 'success');
      } catch (err: unknown) {
        showToast(
          `Erro ao recalcular período: ${err instanceof Error ? err.message : 'Falha'}`,
          'error'
        );
      }
    } else {
      setWorkbook((prev) => ({
        ...prev,
        monthCurrent: newPeriod,
      }));
      showToast(`Período selecionado: ${newPeriod}`, 'success');
    }
  };

  // Extrair listas únicas de Diretorias e Áreas para os seletores
  const uniqueDiretorias = useMemo(() => {
    const set = new Set<string>();
    const sourceRows = workbook.rawRecords && workbook.rawRecords.length > 0 ? workbook.rawRecords : workbook.rows;
    sourceRows.forEach((r) => {
      const d = (r.diretoria || '').trim();
      if (d && d !== '-' && d !== '0' && d !== 'Sem Diretoria' && d !== 'Diretoria Geral') {
        set.add(d);
      }
    });
    return Array.from(set).sort();
  }, [workbook.rows, workbook.rawRecords]);

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    const sourceRows = workbook.rawRecords && workbook.rawRecords.length > 0 ? workbook.rawRecords : workbook.rows;
    sourceRows.forEach((r) => {
      const d = (r.diretoria || '').trim();
      const a = (r.area || '').trim();
      if (selectedDiretoria === 'ALL' || d === selectedDiretoria) {
        if (a && a !== '-' && a !== '0' && a !== 'Sem Área' && a !== 'Área Geral') {
          set.add(a);
        }
      }
    });
    return Array.from(set).sort();
  }, [workbook.rows, workbook.rawRecords, selectedDiretoria]);

  // Filtrar Linhas N3 conforme Diretoria e Área selecionadas
  const filteredRows = useMemo(() => {
    return workbook.rows.filter((r) => {
      if (selectedDiretoria !== 'ALL' && r.diretoria !== selectedDiretoria) {
        return false;
      }
      if (selectedArea !== 'ALL' && r.area !== selectedArea) {
        return false;
      }
      return true;
    });
  }, [workbook.rows, selectedDiretoria, selectedArea]);

  // Garantir que a linha selecionada pertença ao subconjunto filtrado
  useEffect(() => {
    if (filteredRows.length > 0) {
      const exists = filteredRows.some((r) => r.id === selectedRowId);
      if (!exists) {
        setSelectedRowId(filteredRows[0].id);
      }
    }
  }, [filteredRows, selectedRowId]);

  const selectedRow =
    filteredRows.find((r) => r.id === selectedRowId) ||
    workbook.rows.find((r) => r.id === selectedRowId) ||
    filteredRows[0] ||
    workbook.rows[0] ||
    null;

  const currentJustifications: RowJustifications =
    (selectedRow && justificationsMap[selectedRow.id]) || {
      momImpacts: [],
      vsOrcadoImpacts: [],
      ytdImpacts: [],
    };

  const handleWorkbookLoaded = (newWb: DREWorkbook, fileName: string) => {
    setWorkbook(newWb);
    setCurrentFileName(fileName);
    setSelectedDiretoria('ALL');
    setSelectedArea('ALL');
    if (newWb.monthCurrent) {
      setSelectedPeriod(newWb.monthCurrent);
    }
    if (newWb.rows.length > 0) {
      setSelectedRowId(newWb.rows[0].id);
    }
    showToast(
      `Dados carregados com sucesso de "${fileName}"! ${newWb.rows.length} subcategorias (N3) mapeadas.`,
      'success'
    );
  };

  const handleUpdateJustifications = (updated: RowJustifications) => {
    if (!selectedRow) return;
    setJustificationsMap((prev) => ({
      ...prev,
      [selectedRow.id]: updated,
    }));
  };

  // Funções de manipulação de impactos
  const handleAddImpact = (type: 'mom' | 'vsOrcado' | 'ytd') => {
    if (!selectedRow) return;
    const key = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const currentList = currentJustifications[key] || [];

    // Calcula resíduo pendente para sugerir valor inteligente
    let targetDelta = 0;
    if (type === 'mom') targetDelta = selectedRow.realCurrent - selectedRow.realMMinus1;
    else if (type === 'vsOrcado') targetDelta = selectedRow.realCurrent - selectedRow.orcadoCurrent;
    else targetDelta = selectedRow.realYTD - selectedRow.orcadoYTD;

    const currentSum = currentList.reduce((acc, i) => acc + (Number(i.value) || 0), 0);
    const pendingVal = targetDelta - currentSum;

    const newItem = {
      id: `${type}-${Date.now()}`,
      name: currentList.length === 0 ? 'Desvio Principal' : `Desvio Adicional ${currentList.length + 1}`,
      value: pendingVal !== 0 ? pendingVal : 0,
      justification: '',
    };

    handleUpdateJustifications({
      ...currentJustifications,
      [key]: [...currentList, newItem],
    });
  };

  const handleUpdateImpact = (
    type: 'mom' | 'vsOrcado' | 'ytd',
    id: string,
    field: 'name' | 'value' | 'justification',
    val: string | number
  ) => {
    if (!selectedRow) return;
    const key = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const currentList = currentJustifications[key] || [];
    const updatedList = currentList.map((item) => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });

    handleUpdateJustifications({
      ...currentJustifications,
      [key]: updatedList,
    });
  };

  const handleRemoveImpact = (type: 'mom' | 'vsOrcado' | 'ytd', id: string) => {
    if (!selectedRow) return;
    const key = type === 'mom' ? 'momImpacts' : type === 'vsOrcado' ? 'vsOrcadoImpacts' : 'ytdImpacts';
    const currentList = currentJustifications[key] || [];
    handleUpdateJustifications({
      ...currentJustifications,
      [key]: currentList.filter((i) => i.id !== id),
    });
  };

  // Auto-conciliar impactos pendentes
  const handleAutoReconcileAll = () => {
    if (!selectedRow) return;

    // 1. MoM
    const momDelta = selectedRow.realCurrent - selectedRow.realMMinus1;
    const momList = [...(currentJustifications.momImpacts || [])];
    const momSum = momList.reduce((acc, i) => acc + (Number(i.value) || 0), 0);
    const momDiff = momDelta - momSum;
    if (Math.abs(momDiff) >= 1) {
      if (momList.length > 0) {
        momList[momList.length - 1].value = (Number(momList[momList.length - 1].value) || 0) + momDiff;
      } else {
        momList.push({
          id: `mom-${Date.now()}`,
          name: 'Impacto Residual MoM',
          value: momDiff,
          justification: 'Ajuste de conciliação mensal',
        });
      }
    }

    // 2. Mês vs Orçado
    const vsOrcDelta = selectedRow.realCurrent - selectedRow.orcadoCurrent;
    const vsOrcList = [...(currentJustifications.vsOrcadoImpacts || [])];
    const vsOrcSum = vsOrcList.reduce((acc, i) => acc + (Number(i.value) || 0), 0);
    const vsOrcDiff = vsOrcDelta - vsOrcSum;
    if (Math.abs(vsOrcDiff) >= 1) {
      if (vsOrcList.length > 0) {
        vsOrcList[vsOrcList.length - 1].value = (Number(vsOrcList[vsOrcList.length - 1].value) || 0) + vsOrcDiff;
      } else {
        vsOrcList.push({
          id: `vsorc-${Date.now()}`,
          name: 'Impacto Orçado Mês',
          value: vsOrcDiff,
          justification: 'Desvio orçamentário previsto no período',
        });
      }
    }

    // 3. YTD
    const ytdDelta = selectedRow.realYTD - selectedRow.orcadoYTD;
    const ytdList = [...(currentJustifications.ytdImpacts || [])];
    const ytdSum = ytdList.reduce((acc, i) => acc + (Number(i.value) || 0), 0);
    const ytdDiff = ytdDelta - ytdSum;
    if (Math.abs(ytdDiff) >= 1) {
      if (ytdList.length > 0) {
        ytdList[ytdList.length - 1].value = (Number(ytdList[ytdList.length - 1].value) || 0) + ytdDiff;
      } else {
        ytdList.push({
          id: `ytd-${Date.now()}`,
          name: 'Impacto Acumulado YTD',
          value: ytdDiff,
          justification: 'Desvio acumulado no ano conforme apurado',
        });
      }
    }

    handleUpdateJustifications({
      momImpacts: momList,
      vsOrcadoImpacts: vsOrcList,
      ytdImpacts: ytdList,
    });
    showToast('Desvios conciliados com sucesso para fechar o Δ Teórico!', 'success');
  };

  // Exportar Slide do N3 Atual
  const handleExportCurrentSlide = async () => {
    if (!selectedRow || !selectedRow.id) return;
    const cid = activeCompany || 'nio';
    const cInfo = COMPANIES[cid];
    try {
      setIsExporting(true);
      showToast(`Renderizando gráficos em alta resolução e gerando PowerPoint (${cInfo.shortName})...`, 'success');
      const cleanSubcat = selectedRow.n3.replace(/[^a-zA-Z0-9]/g, '_');
      await exportToPowerPoint([selectedRow], justificationsMap, `${cInfo.shortName}_Slide_${cleanSubcat}`, cid);
      showToast(`Apresentação PowerPoint (${cInfo.name}) exportada com sucesso!`, 'success');
    } catch (err: unknown) {
      showToast(
        `Erro ao exportar PowerPoint: ${err instanceof Error ? err.message : 'Falha na geração'}`,
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Exportar Apresentação Completa (Deck com todos os N3)
  const handleExportAllSlides = async () => {
    const rowsToExport = filteredRows.length > 0 ? filteredRows : workbook.rows;
    if (rowsToExport.length === 0) return;
    const cid = activeCompany || 'nio';
    const cInfo = COMPANIES[cid];
    try {
      setIsExporting(true);
      showToast(`Exportando deck executivo da ${cInfo.name} com ${rowsToExport.length} slides...`, 'success');
      await exportToPowerPoint(rowsToExport, justificationsMap, `${cInfo.shortName}_Deck_Completo_DRE_Executivo`, cid);
      showToast(`Deck completo (${rowsToExport.length} slides) exportado com sucesso!`, 'success');
    } catch (err: unknown) {
      showToast(
        `Erro ao exportar Deck: ${err instanceof Error ? err.message : 'Falha na geração'}`,
        'error'
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Navegação entre slides no modo apresentação
  const currentIndex = filteredRows.findIndex((r) => r.id === selectedRow?.id);
  const handlePrevSlide = () => {
    if (currentIndex > 0) {
      setSelectedRowId(filteredRows[currentIndex - 1].id);
    }
  };
  const handleNextSlide = () => {
    if (currentIndex < filteredRows.length - 1) {
      setSelectedRowId(filteredRows[currentIndex + 1].id);
    }
  };

  // SE NENHUMA EMPRESA ESTIVER SELECIONADA: EXIBE A TELA INICIAL (PORTAL NIO | VTAL | TECTO)
  if (!activeCompany) {
    return (
      <>
        <CompanyPortal
          onSelectCompany={handleSelectCompany}
          savedCounts={savedCounts}
        />
        {/* TOAST DE NOTIFICAÇÃO */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
                toastMessage.type === 'success'
                  ? 'bg-[#14412A] text-white border-[#39FF00]'
                  : 'bg-[#8B0000] text-white border-red-300'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-[#39FF00] shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-white shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  const company = currentCompanyConfig || COMPANIES.nio;

  return (
    <div className="min-h-screen bg-[#F6F2EE] text-[#192B1C] flex flex-col font-sans">
      {/* HEADER EXECUTIVO COM TROCA DE EMPRESA E RETORNO AO PORTAL */}
      <Navbar
        workbook={workbook}
        currentFileName={currentFileName}
        monthPrevious={workbook.monthPrevious}
        monthCurrent={workbook.monthCurrent}
        selectedPeriod={selectedPeriod}
        onSelectPeriod={handleSelectPeriod}
        onExportCurrentSlide={handleExportCurrentSlide}
        onExportAllSlides={handleExportAllSlides}
        onLoadSample={() => {
          const sample = getCompanyWorkbook(activeCompany);
          setJustificationsMap(getCompanySampleJustifications(activeCompany));
          handleWorkbookLoaded(sample, `${company.excelFileName} (Amostra 2026)`);
        }}
        onOpenGcpModal={() => setIsGcpModalOpen(true)}
        isExporting={isExporting}
        activeView={activeView}
        onToggleView={setActiveView}
        totalSlides={filteredRows.length}
        currentCompany={activeCompany}
        onSelectCompany={handleSelectCompany}
        onGoToPortal={handleGoToPortal}
      />

      {/* BARRA DE STATUS DE SINCRONIZAÇÃO AUTOMÁTICA GCP */}
      {isAutoLoadingGcp && (
        <div className="bg-[#14412A] text-[#D8FED4] px-4 py-1.5 text-xs flex items-center justify-center gap-2 border-b border-[#39FF00]/30 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#39FF00]" />
          <span>Conectando automaticamente ao GCP BigQuery (vtal-fpea-prd &gt; agente_fpa.DRE_FINAL_EXECUTIVA)...</span>
        </div>
      )}

      {/* TOAST DE NOTIFICAÇÃO */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
              toastMessage.type === 'success'
                ? 'bg-[#14412A] text-white border-[#39FF00]'
                : 'bg-[#8B0000] text-white border-red-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-[#39FF00] shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-white shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'presentation' ? (
          /* ===================================================
             MODO APRESENTAÇÃO (SLIDE WIDESCREEN 16:9 TOTAL)
             =================================================== */
          <div className="space-y-4">
            {/* Seletor Rápido de Slides */}
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-[#D5DCD2] shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  disabled={currentIndex <= 0}
                  className="p-2 rounded-xl border border-[#CCD8C7] disabled:opacity-30 hover:bg-[#FAFBF9] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#14412A]" />
                </button>

                <span className="text-xs font-bold text-[#14412A]">
                  Slide {currentIndex + 1} de {filteredRows.length}
                </span>

                <button
                  type="button"
                  onClick={handleNextSlide}
                  disabled={currentIndex >= filteredRows.length - 1}
                  className="p-2 rounded-xl border border-[#CCD8C7] disabled:opacity-30 hover:bg-[#FAFBF9] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-[#14412A]" />
                </button>

                {selectedRow && (
                  <span className="text-xs text-[#5A6454] font-medium ml-2">
                    {selectedRow.area || selectedRow.diretoria} | {selectedRow.n3}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className="px-4 py-2 rounded-full border border-[#CCD8C7] text-xs font-semibold text-[#14412A] hover:bg-[#FAFBF9] cursor-pointer"
                >
                  Voltar para Edição
                </button>
              </div>
            </div>

            {/* Slide 16:9 */}
            {selectedRow && (
              <SlidePreview
                row={selectedRow}
                justifications={currentJustifications}
                onExportCurrent={handleExportCurrentSlide}
                isExporting={isExporting}
                companyId={activeCompany}
              />
            )}
          </div>
        ) : (
          /* ===================================================
             LAYOUT DE EDIÇÃO E ANÁLISE EXECUTIVA
             =================================================== */
          <div className="space-y-6">
            {/* LINHA 1: CARD 1 (Filtro Organizacional Diretoria/Área) + CARD 2 (Selecionar Linha N3) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className="lg:col-span-4 flex flex-col">
                <OrganizationFilterCard
                  diretorias={uniqueDiretorias}
                  selectedDiretoria={selectedDiretoria}
                  onSelectDiretoria={(dir) => {
                    setSelectedDiretoria(dir);
                    setSelectedArea('ALL');
                  }}
                  areas={uniqueAreas}
                  selectedArea={selectedArea}
                  onSelectArea={setSelectedArea}
                  onOpenGcpModal={() => setIsGcpModalOpen(true)}
                  totalFilteredLines={filteredRows.length}
                  totalLines={workbook.rows.length}
                />
              </div>

              <div className="lg:col-span-8 flex flex-col">
                <SelectionCard
                  rows={filteredRows}
                  selectedRowId={selectedRow?.id || null}
                  onSelectRow={(id) => setSelectedRowId(id)}
                  selectedRow={selectedRow}
                  justifications={currentJustifications}
                  onAutoReconcileAll={handleAutoReconcileAll}
                />
              </div>
            </div>

            {/* LINHA 2: 3 CARDS RETANGULARES (MoM, Mês vs Orçado, YTD vs Orçado) */}
            <ImpactsSection
              selectedRow={selectedRow}
              justifications={currentJustifications}
              monthPrevious={workbook.monthPrevious}
              monthCurrent={workbook.monthCurrent}
              onAddImpact={handleAddImpact}
              onUpdateImpact={handleUpdateImpact}
              onRemoveImpact={handleRemoveImpact}
            />

            {/* LINHA 3: 2 GRÁFICOS WATERFALL VERTICALMENTE EMPILHADOS (Waterfall Mês + Waterfall YTD) */}
            <WaterfallRow
              selectedRow={selectedRow}
              justifications={currentJustifications}
            />
          </div>
        )}
      </main>

      {/* MODAL DE CONEXÃO GCP */}
      <GcpConnectionModal
        isOpen={isGcpModalOpen}
        onClose={() => setIsGcpModalOpen(false)}
        onWorkbookLoaded={handleWorkbookLoaded}
        currentWorkbook={workbook}
      />

      {/* RODAPÉ DO SISTEMA */}
      <footer className="bg-white border-t border-[#D5DCD2] py-4 px-6 text-center text-xs text-[#5A6454] mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="font-semibold text-[#14412A]">
            {company.name} — Plataforma Corporativa de Análise Orçamentária e Gráficos Waterfall
          </div>
          <div className="text-[11px] text-[#768070]">
            Conectado ao BigQuery &amp; Bucket GCP • Exportação PowerPoint (.pptx)
          </div>
        </div>
      </footer>
    </div>
  );
}
