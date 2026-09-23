import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { parseExcelFile, exportTemplateExcelFile, getSampleWorkbook } from '../utils/excelParser';
import { DREWorkbook } from '../types';

interface UploadDropzoneProps {
  workbook: DREWorkbook | null;
  onWorkbookLoaded: (wb: DREWorkbook, fileName: string) => void;
  currentFileName: string;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  workbook,
  onWorkbookLoaded,
  currentFileName,
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
        setErrorMsg('Nenhuma linha de despesa (N3) foi encontrada na planilha. Verifique se o cabeçalho contém N3.');
        setLoading(false);
        return;
      }

      onWorkbookLoaded(parsed, file.name);
    } catch (err: unknown) {
      setErrorMsg(`Erro ao ler arquivo Excel: ${err instanceof Error ? err.message : 'Falha no processamento'}`);
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

  const handleLoadSample = () => {
    const sample = getSampleWorkbook();
    onWorkbookLoaded(sample, 'DRE_NIO_Fibra_Consolidado_Oficial.xlsx');
    setErrorMsg(null);
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-3xl p-6 transition-all duration-200 text-center ${
          isDragging
            ? 'border-[#39FF00] bg-[#14412A]/5 scale-[1.01]'
            : 'border-[#A7AC98] bg-white hover:border-[#14412A]/60'
        }`}
      >
        <div className="flex flex-col items-center justify-center max-w-xl mx-auto space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-[#F6F2EE] flex items-center justify-center text-[#14412A] shadow-inner">
            {loading ? (
              <RefreshCw className="w-7 h-7 animate-spin text-[#14412A]" />
            ) : (
              <UploadCloud className="w-7 h-7 text-[#14412A]" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#192B1C]">
              Arraste e solte sua Planilha DRE da NIO
            </h3>
            <p className="text-xs text-[#6E7769] mt-1">
              Mapeamento automático das células <strong className="text-[#14412A]">D2 (Mês Anterior)</strong> e{' '}
              <strong className="text-[#14412A]">D3 (Mês Atual)</strong>, colunas N1, N2, N3 e valores Real vs Orçado.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              type="button"
              className="px-5 py-2.5 rounded-full bg-[#14412A] text-white text-xs font-semibold hover:bg-[#192B1C] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#39FF00]" />
              Selecionar Arquivo Excel
            </button>

            <button
              onClick={handleLoadSample}
              type="button"
              className="px-4 py-2.5 rounded-full bg-[#F6F2EE] text-[#14412A] text-xs font-semibold hover:bg-[#EAE4DD] border border-[#A7AC98]/60 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Carregar Dados Demonstração NIO
            </button>

            <button
              onClick={() => exportTemplateExcelFile(workbook, currentFileName)}
              type="button"
              className="px-4 py-2.5 rounded-full bg-white text-[#192B1C] text-xs font-medium hover:bg-[#F6F2EE] border border-[#A7AC98] transition-colors cursor-pointer flex items-center gap-1.5"
              title="Baixar planilha Excel com dados atuais / importados (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-[#14412A]" />
              Baixar Modelo (.xlsx)
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs font-medium text-[#8B0000] bg-red-50 px-4 py-2 rounded-xl border border-red-200 mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {workbook && (
            <div className="w-full mt-3 pt-3 border-t border-[#A7AC98]/40 flex flex-wrap items-center justify-between text-xs text-[#192B1C] px-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                <span className="font-semibold">{currentFileName}</span>
                <span className="text-[#6E7769]">({workbook.rows.length} linhas N3 carregadas)</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="bg-[#F6F2EE] px-2.5 py-1 rounded-full border border-[#A7AC98]/50">
                  D2 (Mês Anterior): <strong className="text-[#14412A]">{workbook.monthPrevious}</strong>
                </span>
                <span className="bg-[#39FF00]/15 text-[#14412A] px-2.5 py-1 rounded-full border border-[#39FF00]/40 font-semibold">
                  D3 (Mês Atual): <strong className="text-[#14412A]">{workbook.monthCurrent}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
