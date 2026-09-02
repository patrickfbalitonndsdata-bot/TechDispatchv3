import React, { useRef, useState, useEffect } from "react";
import { UploadCloud, FileSpreadsheet, Sparkles, Check, AlertTriangle, ArrowRight, RefreshCw, Layers, Trash2, X } from "lucide-react";
import { ColumnMapping, ParseResult } from "../types";
import { SAMPLE_DATASETS, SampleDataset } from "../utils/sampleData";

interface CsvUploadZoneProps {
  onFileUpload: (fileContent: string, fileName: string) => void;
  onLoadSample: (sample: SampleDataset) => void;
  parseResult: ParseResult | null;
  currentFileName: string;
  onOpenMappingModal: () => void;
  onClearFile?: () => void;
}

export const CsvUploadZone: React.FC<CsvUploadZoneProps> = ({
  onFileUpload,
  onLoadSample,
  parseResult,
  currentFileName,
  onOpenMappingModal,
  onClearFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Reset native file input if the current file name was cleared
  useEffect(() => {
    if (!currentFileName && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [currentFileName]);

  const handleFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        onFileUpload(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onClearFile) {
      onClearFile();
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs transition-all">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left: Upload Dropzone & Status */}
        <div className="flex-1 w-full">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFile(e.target.files[0]);
              }
            }}
            accept=".csv,text/csv,text/plain"
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-between gap-4 ${
              isDragging
                ? "border-blue-500 bg-blue-50/50"
                : "border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50"
            }`}
          >
            <div className="flex items-center space-x-3.5 text-left">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-zinc-700" />
              </div>
              <div>
                <div className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <span>{currentFileName ? currentFileName : "Upload Technician Dispatch CSV"}</span>
                  {parseResult && parseResult.orders.length > 0 && (
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {parseResult && parseResult.orders.length > 0
                    ? `${parseResult.orders.length} work orders loaded across ${parseResult.technicians.length} technician${parseResult.technicians.length === 1 ? "" : "s"}`
                    : "Drag & drop your .csv work orders schedule, or click to browse"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {currentFileName && onClearFile && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full sm:w-auto text-xs font-semibold bg-white hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-300 hover:border-red-200 px-3 py-2 rounded-lg transition shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Remove uploaded CSV and clear data"
                >
                  <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-red-600" />
                  <span>Clear File</span>
                </button>
              )}

              <button
                type="button"
                className="w-full sm:w-auto text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{currentFileName ? "Replace CSV" : "Select CSV"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick actions and mapping info */}
        {parseResult && parseResult.orders.length > 0 && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full lg:w-auto">
            <button
              onClick={onOpenMappingModal}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 px-3.5 py-2 rounded-lg border border-zinc-200 transition shadow-xs"
              title="Inspect or tweak CSV column field mappings"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-500" />
              <span>Column Mapping ({Object.values(parseResult.mapping).filter(Boolean).length}/12)</span>
            </button>
          </div>
        )}
      </div>

      {/* Warnings & Suggestions Banner */}
      {parseResult && parseResult.orders.length > 0 && parseResult.warnings.length > 0 && (
        <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 flex items-start space-x-2 text-xs text-zinc-700">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-zinc-900">Auto-Detection Note:</span>{" "}
            {parseResult.warnings[0]}
            {parseResult.warnings.length > 1 && (
              <span className="ml-1 text-zinc-500 font-medium">
                (+{parseResult.warnings.length - 1} other auto-resolved fields)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
