import React, { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, FileSpreadsheet, RefreshCw, Cloud } from 'lucide-react';
import { parseExcelFile, exportTemplateExcelFile, getSampleWorkbook } from '../utils/excelParser';
import { DREWorkbook } from '../types';

interface ImportCardProps {
  workbook: DREWorkbook | null;
  onWorkbookLoaded: (wb: DREWorkbook, fileName: string) => void;
  currentFileName: string;
  onOpenGcpModal?: () => void;
}

export const ImportCard: React.FC<ImportCardProps> = ({
  workbook,
  onWorkbookLoaded,
  currentFileName,
  onOpenGcpModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileProcess = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMsg('Formato inválido. Por favor, envie um arquivo Excel (.xlsx ou .xls).');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelFile(buffer);

      if (parsed.rows.length === 0) {
        setErrorMsg('Nenhuma linha de despesa (N3) foi encontrada na planilha.');
        setLoading(false);
        return;
      }

      onWorkbookLoaded(parsed, file.name);
    } catch (err: unknown) {
      setErrorMsg(`Erro ao ler Excel: ${err instanceof Error ? err.message : 'Falha'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleLoadSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    const sample = getSampleWorkbook();
    onWorkbookLoaded(sample, 'DRE_NIO_Fibra_Consolidado_Oficial.xlsx');
    setErrorMsg(null);
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#A7AC98]/40 shadow-sm flex flex-col justify-between h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Cabeçalho do Card */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#14412A]">
            1. Importar Planilha DRE
          </h2>
          {onOpenGcpModal && (
            <button
              type="button"
              onClick={onOpenGcpModal}
              className="text-[11px] font-bold text-[#14412A] bg-[#14412A]/10 hover:bg-[#14412A]/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer border border-[#14412A]/20"
              title="Conectar a base diretamente à tabela no Google Cloud Platform"
            >
              <Cloud className="w-3.5 h-3.5 text-[#14412A]" />
              <span>Tabela GCP</span>
            </button>
          )}
        </div>
        <p className="text-xs text-[#6E7769] mt-0.5">
          Arraste seu arquivo Excel (.xlsx) ou conecte diretamente ao Google Cloud Platform (BigQuery / Cloud SQL).
        </p>
      </div>

      {/* Caixa de Drag & Drop Interna */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`my-4 border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center min-h-[120px] ${
          isDragging
            ? 'border-[#39FF00] bg-[#14412A]/5'
            : 'border-[#A7AC98]/80 bg-[#F6F2EE]/40 hover:bg-[#F6F2EE] hover:border-[#14412A]'
        }`}
      >
        <div className="text-[#8C9283] mb-1.5">
          {loading ? (
            <RefreshCw className="w-6 h-6 animate-spin text-[#14412A]" />
          ) : (
            <UploadCloud className="w-7 h-7 text-[#6E7769]" />
          )}
        </div>

        <div className="text-xs font-bold text-[#192B1C]">
          Clique ou arraste a planilha aqui
        </div>

        <div className="text-[11px] text-[#8C9283] mt-0.5">
          D2 (Mês Ant.) / D3 (Mês Atual) mapeados de forma resiliente
        </div>
      </div>

      {/* Status e Ações Rápidas */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#F6F2EE]">
        {workbook ? (
          <div className="flex items-center gap-1.5 text-[#14412A] font-semibold truncate max-w-[200px]" title={currentFileName}>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
            <span className="truncate">{currentFileName}</span>
          </div>
        ) : (
          <span className="text-[#8C9283]">Nenhum arquivo importado</span>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-[11px] text-[#14412A] font-semibold hover:underline cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3 text-[#14412A]" /> Exemplo NIO
          </button>
          <span className="text-[#A7AC98]">•</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              exportTemplateExcelFile(workbook, currentFileName);
            }}
            className="text-[11px] text-[#14412A] font-semibold hover:underline cursor-pointer flex items-center gap-1"
            title="Baixar planilha Excel com dados atuais ou modelo (.xlsx)"
          >
            <FileSpreadsheet className="w-3 h-3 text-[#14412A]" /> Modelo .xlsx
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-2 text-[11px] text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}
    </div>
  );
};
