/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
import { CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw, Database } from 'lucide-react';

const FAKE_LEGACY_IDS = new Set([
  'dre-1', 'dre-2', 'dre-3', 'dre-4', 'dre-5', 'dre-6', 'dre-7', 'dre-8',
  'VTAL_SUBMARINO_O&M', 'VTAL_DWDM_TRANSPORTE', 'VTAL_ENERGIA_CLS', 'VTAL_DIREITO_PASSAGEM',
  'TECTO_ENERGIA_MERCADO_LIVRE', 'TECTO_CHILLERS_CLIMATIZACAO', 'TECTO_CROSS_CONNECTS', 'TECTO_MANUTENCAO_UPS_GERADORES',
]);

const EDITABLE_JUSTIFICATION_PERIOD = '2026/9';
const AVAILABLE_PERIODS = new Set([
  '2026/1', '2026/2', '2026/3', '2026/4', '2026/5',
  '2026/6', '2026/7', '2026/8', EDITABLE_JUSTIFICATION_PERIOD,
]);

function cleanFakeJustifications(map: Record<string, RowJustifications> | null | undefined): Record<string, RowJustifications> {
  if (!map || typeof map !== 'object') return {};
  const cleaned: Record<string, RowJustifications> = {};
  for (const [k, v] of Object.entries(map)) {
    if (!FAKE_LEGACY_IDS.has(k) && v && typeof v === 'object') {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

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
  const [gcpWorkbooks, setGcpWorkbooks] = useState<Partial<Record<CompanyId, DREWorkbook>>>({});

  const [currentFileName, setCurrentFileName] = useState<string>(() => {
    const initialCid = (localStorage.getItem('corp_active_company') as CompanyId) || 'nio';
    return COMPANIES[initialCid]?.excelFileName || 'DRE_FINAL_EXECUTIVA (GCP)';
  });

  const [selectedPeriod, setSelectedPeriod] = useState<string>(EDITABLE_JUSTIFICATION_PERIOD);
  const [selectedDiretoria, setSelectedDiretoria] = useState<string>('ALL');
  const [selectedArea, setSelectedArea] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');

  const [selectedRowId, setSelectedRowId] = useState<string>('');

  const [justificationsMap, setJustificationsMap] = useState<Record<string, RowJustifications>>({});
  const [justificationsLookupMap, setJustificationsLookupMap] = useState<Record<string, RowJustifications>>({});
  const [isLoadingJustifications, setIsLoadingJustifications] = useState<boolean>(false);

  // Cache em memória de todos os períodos por empresa para troca instantânea (0ms)
  const companyPeriodsCacheRef = useRef<Record<string, Record<string, Record<string, RowJustifications>>>>({});
  const companyLookupCacheRef = useRef<Record<string, Record<string, RowJustifications>>>({});

  // Limpa chaves antigas do localStorage (v1/v2) para evitar que caches antigos sobrescrevam o Bucket
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.includes('_justifications_v1') || key.includes('_justifications_v2'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  const getPeriodStorageKey = (cid: CompanyId, period: string) =>
    `${COMPANIES[cid]?.storageKey || 'nio_justifications'}_v3_${period.replace('/', '_')}`;

  const saveLocalJustifications = (
    cid: CompanyId,
    period: string,
    mapToSave: Record<string, RowJustifications>
  ) => {
    const cleaned = cleanFakeJustifications(mapToSave);
    if (Object.keys(cleaned).length === 0) return;
    const storageKey = getPeriodStorageKey(cid, period);
    try {
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
    } catch (e) {
      console.warn('Erro ao salvar justificativas no localStorage:', e);
    }
  };

  const readLocalJustifications = (cid: CompanyId, period: string): Record<string, RowJustifications> => {
    const storageKey = getPeriodStorageKey(cid, period);
    try {
      const local = localStorage.getItem(storageKey);
      if (local) {
        return cleanFakeJustifications(JSON.parse(local));
      }
    } catch {}
    return {};
  };

  const [activeView, setActiveView] = useState<'dashboard' | 'presentation'>('dashboard');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [isGcpModalOpen, setIsGcpModalOpen] = useState<boolean>(false);
  const [isAutoLoadingGcp, setIsAutoLoadingGcp] = useState<boolean>(true);
  const [gcpLoadError, setGcpLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(
    null
  );
  const [cloudSaveStatus, setCloudSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingSaveCallbacksRef = useRef<Record<string, () => Promise<void>>>({});
  const statusHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Função dedicada para carregar justificativas de uma empresa/período com cache instantâneo
  const fetchCompanyJustifications = async (
    cid: CompanyId,
    period: string,
    options?: { forceRefresh?: boolean; signal?: AbortSignal }
  ) => {
    const localData = readLocalJustifications(cid, period);
    const cachedPeriodData = companyPeriodsCacheRef.current[cid]?.[period];

    if (cachedPeriodData && !options?.forceRefresh) {
      const merged = { ...localData, ...cachedPeriodData };
      setJustificationsMap(merged);
      setJustificationsLookupMap(companyLookupCacheRef.current[`${cid}:${period}`] || {});
    } else if (Object.keys(localData).length > 0) {
      setJustificationsMap(localData);
    } else {
      setJustificationsMap({});
    }

    setIsLoadingJustifications(true);
    try {
      const url = `/api/gcp/justifications/load-company?companyId=${cid}&period=${encodeURIComponent(period)}${
        options?.forceRefresh ? '&refresh=1' : ''
      }`;
      const resp = await fetch(url, { signal: options?.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data.success) {
        if (data.allPeriods && typeof data.allPeriods === 'object') {
          const cleanedAll: Record<string, Record<string, RowJustifications>> = {};
          for (const [pKey, pMap] of Object.entries(data.allPeriods)) {
            cleanedAll[pKey] = cleanFakeJustifications(pMap as Record<string, RowJustifications>);
          }
          companyPeriodsCacheRef.current[cid] = {
            ...(companyPeriodsCacheRef.current[cid] || {}),
            ...cleanedAll,
          };
        }

        if (data.allLookupKeys && typeof data.allLookupKeys === 'object') {
          for (const [pKey, lMap] of Object.entries(data.allLookupKeys)) {
            if (lMap && typeof lMap === 'object') {
              companyLookupCacheRef.current[`${cid}:${pKey}`] = lMap as Record<string, RowJustifications>;
            }
          }
        }

        const serverPeriodMap = cleanFakeJustifications(
          data.justifications || companyPeriodsCacheRef.current[cid]?.[period] || {}
        );
        if (!companyPeriodsCacheRef.current[cid]) {
          companyPeriodsCacheRef.current[cid] = {};
        }
        companyPeriodsCacheRef.current[cid][period] = serverPeriodMap;

        const lookup = (data.byLookupKey && typeof data.byLookupKey === 'object')
          ? (data.byLookupKey as Record<string, RowJustifications>)
          : (companyLookupCacheRef.current[`${cid}:${period}`] || {});
        companyLookupCacheRef.current[`${cid}:${period}`] = lookup;

        const freshLocal = readLocalJustifications(cid, period);
        const merged = { ...freshLocal, ...serverPeriodMap };
        setJustificationsMap(merged);
        setJustificationsLookupMap(lookup);
        if (Object.keys(merged).length > 0) {
          saveLocalJustifications(cid, period, merged);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Não foi possível carregar justificativas compartilhadas:', error);
      }
    } finally {
      if (!options?.signal?.aborted) {
        setIsLoadingJustifications(false);
      }
    }
  };

  // Ao entrar em uma empresa ou trocar período, carrega as justificativas compartilhadas do Bucket.
  useEffect(() => {
    if (!activeCompany) return;
    const controller = new AbortController();
    fetchCompanyJustifications(activeCompany, selectedPeriod, { signal: controller.signal });
    return () => controller.abort();
  }, [activeCompany, selectedPeriod]);

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach(clearTimeout);
    pendingSaveCallbacksRef.current = {};
  }, []);

  // Carregamento automático e 100% conectado com o BigQuery + pré-carregamento de justificativas no boot
  const loadAllFromGcp = async (forceRefresh = false) => {
    setIsAutoLoadingGcp(true);
    setGcpLoadError(null);
    try {
      // Pré-carrega em paralelo as justificativas históricas para resposta imediata
      (['nio', 'vtal', 'tecto'] as CompanyId[]).forEach((cid) => {
        fetch(`/api/gcp/justifications/load-company?companyId=${cid}&period=${encodeURIComponent(selectedPeriod)}${forceRefresh ? '&refresh=1' : ''}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.success && d.allPeriods) {
              const cleanedAll: Record<string, Record<string, RowJustifications>> = {};
              for (const [pKey, pMap] of Object.entries(d.allPeriods)) {
                cleanedAll[pKey] = cleanFakeJustifications(pMap as Record<string, RowJustifications>);
              }
              companyPeriodsCacheRef.current[cid] = {
                ...(companyPeriodsCacheRef.current[cid] || {}),
                ...cleanedAll,
              };
            }
            if (d?.success && d.allLookupKeys && typeof d.allLookupKeys === 'object') {
              for (const [pKey, lMap] of Object.entries(d.allLookupKeys)) {
                if (lMap && typeof lMap === 'object') {
                  companyLookupCacheRef.current[`${cid}:${pKey}`] = lMap as Record<string, RowJustifications>;
                }
              }
            }
          })
          .catch(() => {});
      });

      const resp = await fetch(`/api/gcp/auto-load${forceRefresh ? '?refresh=1' : ''}`);
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();

      if (data.success && data.companyRows) {
        const loaded: Partial<Record<CompanyId, DREWorkbook>> = {};
        (['nio', 'vtal', 'tecto'] as CompanyId[]).forEach((cid) => {
          const rows = data.companyRows[cid];
          if (Array.isArray(rows) && rows.length > 0) {
            loaded[cid] = convertGcpRowsToWorkbook(rows, EDITABLE_JUSTIFICATION_PERIOD);
          }
        });
        setGcpWorkbooks(loaded);

        const targetCompany = activeCompany || 'nio';
        const wb = loaded[targetCompany];
        if (wb) {
          setWorkbook(wb);
          setCurrentFileName('agente_fpa.DRE_FINAL_EXECUTIVA (GCP)');
          if (wb.rows.length > 0) {
            setSelectedRowId(wb.rows[0].id);
          }
          if (wb.monthCurrent && AVAILABLE_PERIODS.has(wb.monthCurrent)) {
            setSelectedPeriod(wb.monthCurrent);
          }
        }
        showToast(`Conectado ao BigQuery! ${data.totalRows} registros carregados.`, 'success');
      } else {
        throw new Error(data.message || 'Nenhum dado retornado do BigQuery.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao conectar ao BigQuery.';
      console.warn('Auto-load BigQuery inicial:', err);
      setGcpLoadError(msg);
    } finally {
      setIsAutoLoadingGcp(false);
    }
  };

  useEffect(() => {
    loadAllFromGcp(false);
  }, []);

  // Mantém cada empresa ligada ao respectivo recorte real do BigQuery (ou vazio se não carregou).
  useEffect(() => {
    if (!activeCompany) return;
    const liveWorkbook = gcpWorkbooks[activeCompany];
    if (liveWorkbook) {
      const targetPeriod = selectedPeriod || liveWorkbook.monthCurrent || '2026/8';
      const syncedWb =
        liveWorkbook.rawRecords && liveWorkbook.rawRecords.length > 0 && liveWorkbook.monthCurrent !== targetPeriod
          ? calculateDREFromRaw(liveWorkbook.rawRecords, targetPeriod)
          : liveWorkbook;
      setWorkbook(syncedWb);
      setCurrentFileName('agente_fpa.DRE_FINAL_EXECUTIVA (GCP)');
      if (syncedWb.rows.length > 0) {
        setSelectedRowId((prev) => (syncedWb.rows.some((r) => r.id === prev) ? prev : syncedWb.rows[0].id));
      } else {
        setSelectedRowId('');
      }
    } else {
      // Sem dados fake: mantém vazio até o banco carregar
      setWorkbook({
        monthPrevious: '2026/7',
        monthCurrent: selectedPeriod || '2026/8',
        rows: [],
      });
      setSelectedRowId('');
    }
  }, [activeCompany, gcpWorkbooks]);

  // Seleção e alternância de empresa (NIO, V.tal, Tecto)
  const handleSelectCompany = (cid: CompanyId) => {
    const isSameCompany = activeCompany === cid;
    setActiveCompany(cid);
    localStorage.setItem('corp_active_company', cid);

    const liveWb = gcpWorkbooks[cid];
    if (liveWb) {
      const targetPeriod = selectedPeriod || liveWb.monthCurrent || '2026/8';
      const syncedWb =
        liveWb.rawRecords && liveWb.rawRecords.length > 0 && liveWb.monthCurrent !== targetPeriod
          ? calculateDREFromRaw(liveWb.rawRecords, targetPeriod)
          : liveWb;
      setWorkbook(syncedWb);
      setCurrentFileName('agente_fpa.DRE_FINAL_EXECUTIVA (GCP)');
      if (syncedWb.rows.length > 0) {
        setSelectedRowId(syncedWb.rows[0].id);
      } else {
        setSelectedRowId('');
      }
    } else {
      setWorkbook({
        monthPrevious: '2026/7',
        monthCurrent: selectedPeriod || '2026/8',
        rows: [],
      });
      setCurrentFileName(COMPANIES[cid].excelFileName);
      setSelectedRowId('');
    }
    setSelectedDiretoria('ALL');
    setSelectedArea('ALL');
    setSelectedStatus('ALL');

    if (isSameCompany) {
      fetchCompanyJustifications(cid, selectedPeriod);
    }
    showToast(`Ambiente ${COMPANIES[cid].name} selecionado!`, 'success');
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
    if (!AVAILABLE_PERIODS.has(newPeriod)) {
      showToast('Esse período não está disponível para consulta ou preenchimento.', 'error');
      return;
    }
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

  // Linhas sem movimento no mês não representam desvios e ficam fora de toda a análise.
  const relevantRows = useMemo(
    () => workbook.rows.filter((row) =>
      Math.abs(row.realCurrent) >= 0.01 || Math.abs(row.orcadoCurrent) >= 0.01
    ),
    [workbook.rows]
  );

  // Extrair listas únicas de Diretorias e Áreas somente das linhas relevantes.
  const uniqueDiretorias = useMemo(() => {
    const set = new Set<string>();
    relevantRows.forEach((r) => {
      const d = (r.diretoria || '').trim();
      if (d && d !== '-' && d !== '0' && d !== 'Sem Diretoria' && d !== 'Diretoria Geral') {
        set.add(d);
      }
    });
    return Array.from(set).sort();
  }, [relevantRows]);

  const uniqueAreas = useMemo(() => {
    const set = new Set<string>();
    relevantRows.forEach((r) => {
      const d = (r.diretoria || '').trim();
      const a = (r.area || '').trim();
      if (selectedDiretoria === 'ALL' || d === selectedDiretoria) {
        if (a && a !== '-' && a !== '0' && a !== 'Sem Área' && a !== 'Área Geral') {
          set.add(a);
        }
      }
    });
    return Array.from(set).sort();
  }, [relevantRows, selectedDiretoria]);

  const resolveRowJustifications = (row: DRERow | null | undefined): RowJustifications => {
    const empty: RowJustifications = {
      momImpacts: [],
      vsOrcadoImpacts: [],
      ytdImpacts: [],
    };
    if (!row) return empty;
    if (justificationsMap[row.id]) return justificationsMap[row.id];

    const dir = (row.diretoria || '').trim().toLowerCase();
    const area = (row.area || '').trim().toLowerCase();
    const n2 = (row.n2 || '').trim().toLowerCase();
    const n3 = (row.n3 || '').trim().toLowerCase();
    if (n3) {
      if (n2) {
        const byFullN2 = justificationsLookupMap[`${dir}|${area}|${n2}|${n3}`];
        if (byFullN2) return byFullN2;
        const byAreaN2 = justificationsLookupMap[`${area}|${n2}|${n3}`];
        if (byAreaN2) return byAreaN2;
      }
      const byFull = justificationsLookupMap[`${dir}|${area}|${n3}`];
      if (byFull) return byFull;
      const byArea = justificationsLookupMap[`${area}|${n3}`];
      if (byArea) return byArea;
    }
    return empty;
  };

  const isRowReconciled = (row: DRERow) => {
    const justifications = resolveRowJustifications(row);
    const sum = (items: RowJustifications['momImpacts']) =>
      items.reduce((total, impact) => total + (Number(impact.value) || 0), 0);
    const momPending = row.realCurrent - row.realMMinus1 - sum(justifications.momImpacts || []);
    const monthPending = row.realCurrent - row.orcadoCurrent - sum(justifications.vsOrcadoImpacts || []);
    const ytdPending = row.realYTD - row.orcadoYTD - sum(justifications.ytdImpacts || []);
    return Math.abs(momPending) < 1 && Math.abs(monthPending) < 1 && Math.abs(ytdPending) < 1;
  };

  // Primeiro aplica o recorte organizacional para calcular os KPIs do conjunto visível.
  const organizationFilteredRows = useMemo(() => {
    const list = relevantRows.filter((r) => {
      if (selectedDiretoria !== 'ALL' && r.diretoria !== selectedDiretoria) {
        return false;
      }
      if (selectedArea !== 'ALL' && r.area !== selectedArea) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const isConsolA =
        (a.n1 === '0' && a.n2 === '0' && a.n3 === '0') ||
        a.n1 === '0' ||
        `${a.n1} | ${a.n2} | ${a.n3}`.trim() === '0 | 0 | 0' ||
        (a.n1 || '').toLowerCase() === 'consolidado' ||
        (a.n3 || '').toLowerCase() === 'consolidado';
      const isConsolB =
        (b.n1 === '0' && b.n2 === '0' && b.n3 === '0') ||
        b.n1 === '0' ||
        `${b.n1} | ${b.n2} | ${b.n3}`.trim() === '0 | 0 | 0' ||
        (b.n1 || '').toLowerCase() === 'consolidado' ||
        (b.n3 || '').toLowerCase() === 'consolidado';

      if (isConsolA && !isConsolB) return -1;
      if (!isConsolA && isConsolB) return 1;

      const n1A = (a.n1 || '').trim();
      const n1B = (b.n1 || '').trim();
      const cmpN1 = n1A.localeCompare(n1B, 'pt-BR', { numeric: true, sensitivity: 'base' });
      if (cmpN1 !== 0) return cmpN1;

      const n2A = (a.n2 || '').trim();
      const n2B = (b.n2 || '').trim();
      const cmpN2 = n2A.localeCompare(n2B, 'pt-BR', { numeric: true, sensitivity: 'base' });
      if (cmpN2 !== 0) return cmpN2;

      const n3A = (a.n3 || '').trim();
      const n3B = (b.n3 || '').trim();
      return n3A.localeCompare(n3B, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  }, [relevantRows, selectedDiretoria, selectedArea]);

  const statusCounts = useMemo(() => {
    const completed = organizationFilteredRows.filter(isRowReconciled).length;
    return {
      total: organizationFilteredRows.length,
      completed,
      pending: organizationFilteredRows.length - completed,
    };
  }, [organizationFilteredRows, justificationsMap, justificationsLookupMap]);

  // Em seguida aplica o status escolhido sem alterar os contadores do recorte.
  const filteredRows = useMemo(() => {
    if (selectedStatus === 'ALL') return organizationFilteredRows;
    return organizationFilteredRows.filter((row) =>
      selectedStatus === 'COMPLETED' ? isRowReconciled(row) : !isRowReconciled(row)
    );
  }, [organizationFilteredRows, selectedStatus, justificationsMap, justificationsLookupMap]);

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
    filteredRows[0] ||
    null;

  const currentJustifications: RowJustifications = resolveRowJustifications(selectedRow);

  const handleWorkbookLoaded = (newWb: DREWorkbook, fileName: string) => {
    setWorkbook(newWb);
    setCurrentFileName(fileName);
    setSelectedDiretoria('ALL');
    setSelectedArea('ALL');
    setSelectedStatus('ALL');
    if (newWb.monthCurrent && AVAILABLE_PERIODS.has(newWb.monthCurrent)) {
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
    if (selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD) {
      showToast(`O período ${selectedPeriod} está disponível somente para consulta. Apenas ${EDITABLE_JUSTIFICATION_PERIOD} está liberado para edição.`, 'error');
      return;
    }
    if (!selectedRow) return;
    const companyId = activeCompany;
    setJustificationsMap((prev) => {
      const next = {
        ...prev,
        [selectedRow.id]: updated,
      };
      if (companyId) {
        if (!companyPeriodsCacheRef.current[companyId]) {
          companyPeriodsCacheRef.current[companyId] = {};
        }
        companyPeriodsCacheRef.current[companyId][selectedPeriod] = next;
        saveLocalJustifications(companyId, selectedPeriod, next);
      }
      return next;
    });

    if (!companyId) return;
    const rowToSave = selectedRow;
    const timerKey = `${companyId}:${rowToSave.id}`;
    if (saveTimersRef.current[timerKey]) {
      clearTimeout(saveTimersRef.current[timerKey]);
    }
    if (statusHideTimerRef.current) {
      clearTimeout(statusHideTimerRef.current);
      statusHideTimerRef.current = null;
    }
    const persistChanges = async () => {
      setCloudSaveStatus('saving');
      try {
        const response = await fetch('/api/gcp/justifications/save-row', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId,
            period: selectedPeriod,
            row: rowToSave,
            justifications: updated,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Falha ao salvar');
        setCloudSaveStatus('saved');
        if (statusHideTimerRef.current) {
          clearTimeout(statusHideTimerRef.current);
        }
        statusHideTimerRef.current = setTimeout(() => {
          setCloudSaveStatus('idle');
          statusHideTimerRef.current = null;
        }, 2800);
      } catch (error) {
        console.error('Erro ao salvar justificativa no Banco de Dados:', error);
        setCloudSaveStatus('error');
      } finally {
        delete saveTimersRef.current[timerKey];
        delete pendingSaveCallbacksRef.current[timerKey];
      }
    };
    pendingSaveCallbacksRef.current[timerKey] = persistChanges;
    saveTimersRef.current[timerKey] = setTimeout(() => {
      void persistChanges();
    }, 5000);
  };

  const flushPendingJustificationSave = () => {
    if (!activeCompany || !selectedRow) return;
    const timerKey = `${activeCompany}:${selectedRow.id}`;
    const pendingSave = pendingSaveCallbacksRef.current[timerKey];
    if (!pendingSave) return;
    if (saveTimersRef.current[timerKey]) {
      clearTimeout(saveTimersRef.current[timerKey]);
      delete saveTimersRef.current[timerKey];
    }
    void pendingSave();
  };

  // Funções de manipulação de impactos
  const handleAddImpact = (type: 'mom' | 'vsOrcado' | 'ytd') => {
    if (selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD) return;
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
    if (selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD) return;
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
    if (selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD) return;
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
    if (selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD) return;
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
          justification: '',
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
          name: 'Impacto Residual Mês vs Orçado',
          value: vsOrcDiff,
          justification: '',
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
          name: 'Impacto Residual YTD',
          value: ytdDiff,
          justification: '',
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

  // Exportar Razão Detalhado ou Resumo Executivo em Excel conforme empresa e filtros selecionados
  const handleExportRazaoExcel = async () => {
    const cid = activeCompany || 'nio';
    const cInfo = COMPANIES[cid];
    try {
      setIsExportingExcel(true);
      showToast(
        `Extraindo base de razão em Excel (${cInfo.shortName}) conforme filtro selecionado...`,
        'success'
      );

      const response = await fetch('/api/reports/export-razao-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: cid,
          diretoria: selectedDiretoria,
          area: selectedArea,
          period: selectedPeriod,
        }),
      });

      if (!response.ok) {
        let errMsg = 'Falha ao exportar planilha Excel.';
        try {
          const errJson = await response.json();
          if (errJson?.message) errMsg = errJson.message;
        } catch {}
        throw new Error(errMsg);
      }

      const disposition = response.headers.get('Content-Disposition') || '';
      const fileMatch = disposition.match(/filename="?([^"]+)"?/i);
      const downloadName = fileMatch?.[1] || `Razao_${cInfo.shortName}.xlsx`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast(`Planilha Excel (${downloadName}) baixada com sucesso!`, 'success');
    } catch (err: unknown) {
      showToast(
        `Erro ao baixar Excel: ${err instanceof Error ? err.message : 'Falha na extração'}`,
        'error'
      );
    } finally {
      setIsExportingExcel(false);
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
  const isJustificationReadOnly = selectedPeriod !== EDITABLE_JUSTIFICATION_PERIOD;

  return (
    <div className={`min-h-screen flex flex-col font-sans ${activeCompany === 'nio' ? 'bg-[#F6F2EE] text-[#192B1C]' : 'bg-[#F3F3F3] text-[#252525]'}`}>
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
        selectedDiretoria={selectedDiretoria}
        selectedArea={selectedArea}
        onExportRazaoExcel={handleExportRazaoExcel}
        isExportingExcel={isExportingExcel}
      />

      {/* BARRA DE PROGRESSO E STATUS DE CARREGAMENTO (BIGQUERY + JUSTIFICATIVAS HISTÓRICAS) */}
      {(isAutoLoadingGcp || isLoadingJustifications) && (
        <div className="bg-[#14412A] text-[#D8FED4] border-b border-[#39FF00]/30 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-2 text-xs flex items-center justify-between gap-3 font-medium">
            <div className="flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[#39FF00] shrink-0" />
              <span>
                {isAutoLoadingGcp && isLoadingJustifications
                  ? 'Carregando dados da DRE no BigQuery e sincronizando justificativas históricas do Bucket GCP...'
                  : isAutoLoadingGcp
                  ? 'Carregando dados reais da DRE no GCP BigQuery (vtal-fpea-prd > agente_fpa.DRE_FINAL_EXECUTIVA)...'
                  : `Carregando justificativas históricas de ${company.name} (${selectedPeriod})...`}
              </span>
            </div>
            <span className="text-[11px] text-[#39FF00] font-bold tracking-wide uppercase hidden sm:inline">
              Sincronizando...
            </span>
          </div>
          {/* Barra de carregamento animada */}
          <div className="w-full h-1 bg-[#0D2B1B] overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#14412A] via-[#39FF00] to-[#14412A] w-full animate-pulse" />
          </div>
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

      {cloudSaveStatus !== 'idle' && (
        <div className="fixed bottom-6 inset-x-0 z-50 px-4 sm:px-6 lg:px-8 pointer-events-none flex justify-center">
          <div
            className={`w-full max-w-5xl rounded-2xl px-5 py-3.5 shadow-2xl border-2 relative overflow-hidden transition-all duration-300 flex items-center justify-between gap-4 ${
              cloudSaveStatus === 'error'
                ? 'bg-[#8B0000] text-white border-red-300'
                : cloudSaveStatus === 'saved'
                ? activeCompany === 'nio'
                  ? 'bg-[#14412A] text-white border-[#39FF00]'
                  : 'bg-[#1B3B32] text-white border-[#4F927F]'
                : 'bg-[#1F2937] text-white border-white/25'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  cloudSaveStatus === 'error'
                    ? 'bg-red-500/30 text-white'
                    : cloudSaveStatus === 'saved'
                    ? activeCompany === 'nio'
                      ? 'bg-[#39FF00]/20 text-[#39FF00]'
                      : 'bg-[#4F927F]/30 text-[#7CE5C6]'
                    : 'bg-white/15 text-white'
                }`}
              >
                {cloudSaveStatus === 'saving' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : cloudSaveStatus === 'saved' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                  {cloudSaveStatus === 'saving'
                    ? 'Salvando alterações no banco de dados...'
                    : cloudSaveStatus === 'saved'
                    ? 'Justificativa salva no banco de dados.'
                    : 'Falha ao salvar no banco de dados.'}
                </p>
                <p className="text-[11px] text-white/80 font-medium hidden sm:block truncate">
                  {cloudSaveStatus === 'saving'
                    ? `Sincronizando justificativa de ${company.shortName} (${selectedPeriod})...`
                    : cloudSaveStatus === 'saved'
                    ? `Registro atualizado com sucesso para ${company.shortName} (${selectedPeriod})`
                    : 'Verifique sua conexão e tente novamente'}
                </p>
              </div>
            </div>

            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shrink-0 ${
                cloudSaveStatus === 'error'
                  ? 'bg-red-900/60 text-red-100 border border-red-400/40'
                  : cloudSaveStatus === 'saved'
                  ? activeCompany === 'nio'
                    ? 'bg-[#39FF00] text-[#14412A]'
                    : 'bg-[#4F927F] text-white'
                  : 'bg-white/15 text-white'
              }`}
            >
              {cloudSaveStatus === 'saving'
                ? 'Gravando...'
                : cloudSaveStatus === 'saved'
                ? 'Salvo Automaticamente'
                : 'Erro'}
            </span>

            {/* Barra inferior de progresso/confirmação */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/25 overflow-hidden">
              <div
                className={`h-full w-full ${
                  cloudSaveStatus === 'saving'
                    ? 'bg-gradient-to-r from-transparent via-white to-transparent animate-pulse'
                    : cloudSaveStatus === 'saved'
                    ? activeCompany === 'nio'
                      ? 'bg-[#39FF00]'
                      : 'bg-[#7CE5C6]'
                    : 'bg-red-400'
                }`}
              />
            </div>
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
            {/* AVISO DE BANCO VAZIO OU ERRO DE CARREGAMENTO (SEM DADOS FAKE) */}
            {!isAutoLoadingGcp && workbook.rows.length === 0 && (
              <div className="bg-white rounded-3xl border border-amber-300 p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#14412A]">
                      Nenhum dado carregado para {company.name} ({selectedPeriod})
                    </h3>
                    <p className="text-xs text-[#5A6454] mt-0.5">
                      {gcpLoadError
                        ? `Falha na consulta ao banco: ${gcpLoadError}`
                        : 'Os dados não foram retornados pelo banco. Nenhum dado fictício (fake) é exibido.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => loadAllFromGcp(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#14412A] hover:bg-[#1E5638] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-[#39FF00]" />
                    Recarregar Banco
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsGcpModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#CCD8C7] bg-[#FAFBF9] hover:bg-white text-[#14412A] text-xs font-bold transition-all cursor-pointer"
                  >
                    Configurar GCP
                  </button>
                </div>
              </div>
            )}

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
                  selectedStatus={selectedStatus}
                  onSelectStatus={setSelectedStatus}
                  statusCounts={statusCounts}
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
                  currentCompany={activeCompany}
                  readOnly={isJustificationReadOnly}
                />
              </div>
            </div>

            {/* LINHA 2: 3 CARDS RETANGULARES (MoM, Mês vs Orçado, YTD vs Orçado) */}
            <ImpactsSection
              selectedRow={selectedRow}
              justifications={currentJustifications}
              monthPrevious={workbook.monthPrevious}
              monthCurrent={workbook.monthCurrent}
              isLoadingJustifications={isLoadingJustifications || isAutoLoadingGcp}
              readOnly={isJustificationReadOnly}
              onAddImpact={handleAddImpact}
              onUpdateImpact={handleUpdateImpact}
              onRemoveImpact={handleRemoveImpact}
              onFieldBlur={flushPendingJustificationSave}
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

    </div>
  );
}
