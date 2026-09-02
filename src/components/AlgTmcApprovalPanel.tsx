import React, { useState, useRef, useMemo } from "react";
import {
  FileText,
  UploadCloud,
  Check,
  Copy,
  Download,
  Trash2,
  Sparkles,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Edit3,
  Layers,
  Mail,
  Zap,
  MapPin,
  Paperclip,
  Calendar,
  Clock,
  Plus,
} from "lucide-react";
import {
  ScannedPdfData,
  parsePdfFile,
  SAMPLE_PDF_APPROVALS,
  generateCombinedApprovalEmail,
  CombinedApprovalEmail,
  UrgencyScheduleOption,
  formatUrgencyLine,
  formatAtrSubject,
  formatTmcSubject,
  formatCombinedSubject,
  KmzAttachment,
  createMultipartEml,
} from "../utils/pdfParser";

interface AlgTmcApprovalPanelProps {
  onScannedDataChange?: (data: ScannedPdfData[]) => void;
}

export const AlgTmcApprovalPanel: React.FC<AlgTmcApprovalPanelProps> = ({ onScannedDataChange }) => {
  const [pdfList, setPdfList] = useState<ScannedPdfData[]>([]);
  // activeTab: "combined" | 0 | 1
  const [activeTab, setActiveTab] = useState<"combined" | number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState<boolean>(false);
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isExportingEml, setIsExportingEml] = useState<boolean>(false);

  // 1. Urgency Schedule Option state ("today" | "next_week" | "today_next_week" | "none")
  const [scheduleOption, setScheduleOption] = useState<UrgencyScheduleOption>("today");

  // 2. KMZ Attachments State
  const [kmzList, setKmzList] = useState<KmzAttachment[]>([]);
  const [isDraggingKmz, setIsDraggingKmz] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const kmzInputRef = useRef<HTMLInputElement>(null);

  // Re-generate combined approval email whenever pdfList or scheduleOption changes
  const combinedEmail: CombinedApprovalEmail | null = useMemo(() => {
    return generateCombinedApprovalEmail(pdfList, scheduleOption);
  }, [pdfList, scheduleOption]);

  // Determine active single PDF if not in combined view
  const activeSinglePdf: ScannedPdfData | undefined =
    typeof activeTab === "number" ? pdfList[activeTab] || pdfList[0] : pdfList[0];

  // Helper to re-generate single PDF text & HTML with scheduleOption
  const getSinglePdfRender = (pdf: ScannedPdfData) => {
    const isTmc = pdf.studyType.toUpperCase().includes("TMC");
    const urgencyLine = formatUrgencyLine(pdf.urgency, scheduleOption);

    if (isTmc) {
      const text = `Hi James,\n\nPlease see TMC camera placement approval.\n\n${urgencyLine}\n\nProject Number: ${pdf.projectNumber}\nLocation/s: ${pdf.locationsCount}`;
      const html = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi James,</p>
  <p style="margin: 0 0 12px 0;">Please see TMC camera placement approval.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${pdf.projectNumber}</strong></p>
  <p style="margin: 0 0 0 0;"><strong>Location/s:</strong> ${pdf.locationsCount}</p>
</div>`.trim();
      return { text, html, subject: formatTmcSubject(pdf.projectNumber) };
    } else {
      const text = `Hi Nina/Marisa,\n\nPlease see ALG conversion attached.\n\n${urgencyLine}\n\nRegion: ${pdf.region || "South Central"}\nProject Number: ${pdf.projectNumber}\nLocation/s: ${pdf.locationsCount}\nStudy: ${pdf.fullStudyFormatted}`;
      const html = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi Nina/Marisa,</p>
  <p style="margin: 0 0 12px 0;">Please see ALG conversion attached.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> ${pdf.region || "South Central"}</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${pdf.projectNumber}</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> ${pdf.locationsCount}</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ${pdf.fullStudyFormatted}</p>
</div>`.trim();
      return { text, html, subject: formatAtrSubject(pdf.projectNumber, pdf.addOns) };
    }
  };

  const handlePdfFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (fileArray.length === 0) return;

    setIsLoading(true);
    try {
      const filesToProcess = fileArray.slice(0, 2);
      const results: ScannedPdfData[] = [];

      for (const file of filesToProcess) {
        const scanned = await parsePdfFile(file, scheduleOption);
        results.push(scanned);
      }

      setPdfList((prev) => {
        const combined = [...prev, ...results].slice(0, 2);
        if (onScannedDataChange) onScannedDataChange(combined);
        return combined;
      });

      if (pdfList.length + results.length >= 2) {
        setActiveTab("combined");
      } else {
        setActiveTab(0);
      }
    } catch (err) {
      console.error("Error parsing PDF file:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKmzFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".kmz") ||
        f.name.toLowerCase().endsWith(".kml") ||
        f.type.includes("kml") ||
        f.type.includes("kmz") ||
        f.type.includes("zip") ||
        f.type.includes("octet-stream")
    );

    if (fileArray.length === 0) return;

    const newKmzItems: KmzAttachment[] = fileArray.map((f) => ({
      id: `kmz-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      fileName: f.name,
      fileSizeFormatted: f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`,
      file: f,
    }));

    setKmzList((prev) => [...prev, ...newKmzItems]);
  };

  const handleRemoveKmz = (id: string) => {
    setKmzList((prev) => prev.filter((k) => k.id !== id));
  };

  const handleLoadSampleKmz = () => {
    const sampleKmz: KmzAttachment = {
      id: `sample-kmz-${Date.now()}`,
      fileName: `${activeSinglePdf?.projectNumber || "26-770113"}_Camera_Locations.kmz`,
      fileSizeFormatted: "142 KB",
    };
    setKmzList((prev) => [...prev, sampleKmz]);
  };

  const handleRemovePdf = (indexToRemove: number) => {
    setPdfList((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      if (onScannedDataChange) onScannedDataChange(updated);
      return updated;
    });
    setActiveTab(0);
  };

  const handleClearAllPdfs = () => {
    setPdfList([]);
    setActiveTab(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onScannedDataChange) onScannedDataChange([]);
  };

  const handleLoadSample = (sampleIndex: number) => {
    const sample = SAMPLE_PDF_APPROVALS[sampleIndex];
    if (!sample) return;

    setPdfList((prev) => {
      if (prev.some((p) => p.projectNumber === sample.projectNumber)) {
        return prev;
      }
      const updated = [...prev, { ...sample }].slice(0, 2);
      if (onScannedDataChange) onScannedDataChange(updated);
      return updated;
    });
    setActiveTab(pdfList.length >= 1 ? "combined" : 0);
  };

  const handleLoadBothSamples = () => {
    const cloned = SAMPLE_PDF_APPROVALS.map((s) => ({ ...s }));
    setPdfList(cloned);
    setActiveTab("combined");
    if (onScannedDataChange) onScannedDataChange(cloned);
  };

  const handleUpdatePdfField = (index: number, field: keyof ScannedPdfData, value: string) => {
    setPdfList((prev) => {
      const updated = [...prev];
      const current = { ...updated[index] };
      (current as any)[field] = value;

      const isTmc = current.studyType.toUpperCase().includes("TMC");
      const isAtr = current.studyType.toUpperCase().includes("ATR");

      if (field === "studyType" || field === "addOns" || field === "projectNumber") {
        if (isAtr) {
          current.fullStudyFormatted = current.addOns ? `ALG ${current.addOns}` : "ALG Volume";
          current.emailSubject = formatAtrSubject(current.projectNumber, current.addOns);
        } else if (isTmc) {
          current.fullStudyFormatted = current.addOns ? `TMC ${current.addOns}` : "TMC";
          current.emailSubject = formatTmcSubject(current.projectNumber);
        } else {
          current.fullStudyFormatted = current.addOns ? `ALG ${current.addOns}` : `ALG ${current.studyType}`;
          current.emailSubject = formatAtrSubject(current.projectNumber, current.addOns);
        }
      }

      updated[index] = current;
      if (onScannedDataChange) onScannedDataChange(updated);
      return updated;
    });
  };

  const handleCopySubject = async (subjectText: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(subjectText);
      setCopiedStatus(tag);
      setTimeout(() => setCopiedStatus(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyRichEmail = async (text: string, html: string, tag: string) => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([text], { type: "text/plain" });
        const htmlBlob = new Blob([html], { type: "text/html" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": textBlob,
            "text/html": htmlBlob,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiedStatus(tag);
      setTimeout(() => setCopiedStatus(null), 2500);
    } catch {
      await navigator.clipboard.writeText(text);
      setCopiedStatus(tag);
      setTimeout(() => setCopiedStatus(null), 2500);
    }
  };

  /**
   * Export email bundled with all uploaded PDF files and KMZ files into Outlook .EML!
   */
  const handleDownloadEmlWithAttachments = async (
    subject: string,
    html: string,
    toName: string,
    targetPdfs: ScannedPdfData[]
  ) => {
    setIsExportingEml(true);
    try {
      const pdfAttachments = targetPdfs.map((p) => ({
        name: p.fileName || `${p.projectNumber || "approval"}.pdf`,
        file: p.originalFile,
        base64: p.originalFileBase64,
      }));

      const emlBlob = await createMultipartEml({
        subject,
        to: toName,
        htmlBody: html,
        pdfAttachments,
        kmzAttachments: kmzList,
      });

      const url = URL.createObjectURL(emlBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subject.replace(/[^a-zA-Z0-9-_]/g, "_")}.eml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate multipart EML:", err);
    } finally {
      setIsExportingEml(false);
    }
  };

  return (
    <div className="bg-white border-2 border-indigo-200/90 rounded-xl p-4 sm:p-5 shadow-sm space-y-4 transition-all">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3.5">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-zinc-900">ALG / TMC Approval Scanner</h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                PDF Page 1 Scanner (1 or 2 Files)
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>
                Yellow Urgency Highlight
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Scans TMC &amp; ATR approval PDFs, attaches KMZ map files, and packages emails with yellow-highlighted urgency for Outlook.
            </p>
          </div>
        </div>

        {/* Quick Sample Presets */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-zinc-400 font-medium mr-1">Samples:</span>
          <button
            type="button"
            onClick={() => handleLoadSample(1)}
            className="text-[11px] font-semibold bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-700 text-zinc-700 border border-zinc-200 px-2.5 py-1 rounded-md transition cursor-pointer"
            title="Load Cheyenne WY 26-770113 (TMC to James)"
          >
            TMC (James)
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample(0)}
            className="text-[11px] font-semibold bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-700 text-zinc-700 border border-zinc-200 px-2.5 py-1 rounded-md transition cursor-pointer"
            title="Load Boulder CO 26-770109 (ATR/ALG to Nina/Marisa)"
          >
            ATR (Nina/Marisa)
          </button>
          <button
            type="button"
            onClick={handleLoadBothSamples}
            className="text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1"
            title="Load both TMC + ATR PDFs for combined approval template"
          >
            <Sparkles className="w-3 h-3 text-indigo-600" />
            <span>Load Both</span>
          </button>
        </div>
      </div>

      {/* 1. URGENCY SCHEDULE OPTION BUTTONS */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <span>Urgency Schedule Option</span>
              <span className="text-[10px] font-mono bg-yellow-300 text-amber-950 px-1.5 py-0.2 rounded font-bold">
                Outlook Highlight
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              Select timing suffix to append to the highlighted URGENCY line:
            </p>
          </div>
        </div>

        {/* Interactive Option Pill Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScheduleOption("today")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              scheduleOption === "today"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300"
                : "bg-white text-zinc-700 border-amber-200 hover:bg-amber-100/50"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleOption("next_week")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              scheduleOption === "next_week"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300"
                : "bg-white text-zinc-700 border-amber-200 hover:bg-amber-100/50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Next Week</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleOption("today_next_week")}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
              scheduleOption === "today_next_week"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300"
                : "bg-white text-zinc-700 border-amber-200 hover:bg-amber-100/50"
            }`}
          >
            <span>Today / Next Week</span>
          </button>

          <button
            type="button"
            onClick={() => setScheduleOption("none")}
            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
              scheduleOption === "none"
                ? "bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300"
                : "bg-white text-zinc-700 border-amber-200 hover:bg-amber-100/50"
            }`}
            title="Just show URGENCY: <Urgency> with no suffix"
          >
            <span>Urgency Only</span>
          </button>
        </div>
      </div>

      {/* PDF Upload Dropzone */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) handlePdfFiles(e.target.files);
        }}
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingPdf(true);
        }}
        onDragLeave={() => setIsDraggingPdf(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingPdf(false);
          if (e.dataTransfer.files) handlePdfFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isDraggingPdf
            ? "border-indigo-500 bg-indigo-50/50"
            : pdfList.length > 0
            ? "border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/40"
            : "border-zinc-300 hover:border-indigo-400 bg-zinc-50/60 hover:bg-zinc-50"
        }`}
      >
        <div className="flex items-center space-x-3.5 text-left">
          <div className="w-9 h-9 rounded-lg bg-indigo-100/80 border border-indigo-200 flex items-center justify-center shrink-0">
            {isLoading ? (
              <RefreshCw className="w-4 h-4 text-indigo-700 animate-spin" />
            ) : (
              <UploadCloud className="w-4 h-4 text-indigo-700" />
            )}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <span>{pdfList.length > 0 ? `${pdfList.length} of 2 PDF(s) Loaded` : "Drop 1 or 2 Approval PDFs"}</span>
              {pdfList.length > 0 && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" /> Page 1 Extracted
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
              {pdfList.length > 0
                ? pdfList.map((p) => `${p.projectNumber || p.fileName} [${p.studyType}]`).join(" + ")
                : "Upload TMC and ATR approval PDFs to generate James / Nina / Marisa email formats"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {pdfList.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAllPdfs();
              }}
              className="text-xs font-semibold bg-white hover:bg-red-50 text-zinc-700 hover:text-red-700 border border-zinc-300 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-red-600" />
              <span>Clear</span>
            </button>
          )}

          <button
            type="button"
            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{pdfList.length >= 2 ? "Replace PDFs" : pdfList.length === 1 ? "Add 2nd PDF" : "Select PDF(s)"}</span>
          </button>
        </div>
      </div>

      {/* Main Scanned Content & Email Template Preview */}
      {pdfList.length > 0 && (
        <div className="space-y-4 pt-1">
          {/* Navigation Bar: Combined Tab + Individual PDF Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-200 pb-2">
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1.5">
              {pdfList.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("combined")}
                  className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "combined"
                      ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300"
                      : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Combined Approval (TMC + ATR)</span>
                </button>
              )}

              {pdfList.map((pdf, idx) => {
                const isTmc = pdf.studyType.includes("TMC");
                return (
                  <button
                    key={pdf.id}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`flex items-center space-x-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === idx
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>
                      PDF {idx + 1} ({isTmc ? "TMC" : "ATR"}): {pdf.projectNumber || pdf.fileName}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePdf(idx);
                      }}
                      className="hover:text-red-300 ml-1 cursor-pointer font-normal text-sm"
                      title="Remove this PDF"
                    >
                      ×
                    </span>
                  </button>
                );
              })}

              {pdfList.length < 2 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 py-1.5 px-2.5 rounded-lg transition cursor-pointer"
                >
                  + Add 2nd PDF
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1.5 cursor-pointer ${
                  isEditing
                    ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? "Close Editor" : "Edit Scanned Values"}</span>
              </button>
            </div>
          </div>

          {/* Editable Field Inspector */}
          {isEditing && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 sm:p-4 text-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-700" />
                  <span>Edit Scanned Values (Live Updates Output)</span>
                </div>
                <span className="text-[11px] text-amber-700">Changes immediately apply to email templates</span>
              </div>

              {pdfList.map((pdf, idx) => (
                <div key={pdf.id} className="bg-white border border-amber-200 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-1.5">
                    <span className="font-bold text-zinc-800 text-xs">
                      PDF #{idx + 1}: {pdf.fileName} ({pdf.studyType})
                    </span>
                    <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-mono">
                      {pdf.studyType.includes("TMC") ? "Target: James (TMC Approval)" : "Target: Nina/Marisa (ALG Conversion)"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Project Number</label>
                      <input
                        type="text"
                        value={pdf.projectNumber}
                        onChange={(e) => handleUpdatePdfField(idx, "projectNumber", e.target.value)}
                        placeholder="e.g. 26-770113"
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-mono font-bold text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Urgency</label>
                      <input
                        type="text"
                        value={pdf.urgency}
                        onChange={(e) => handleUpdatePdfField(idx, "urgency", e.target.value)}
                        placeholder="e.g. Priority Client"
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-semibold text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Location/s Count</label>
                      <input
                        type="text"
                        value={pdf.locationsCount}
                        onChange={(e) => handleUpdatePdfField(idx, "locationsCount", e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-semibold text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Study Type</label>
                      <select
                        value={pdf.studyType}
                        onChange={(e) => handleUpdatePdfField(idx, "studyType", e.target.value)}
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-semibold text-zinc-900"
                      >
                        <option value="TMC">TMC (Camera Placement)</option>
                        <option value="ATR">ATR (ALG Conversion)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Region (for ATR/ALG)</label>
                      <input
                        type="text"
                        value={pdf.region}
                        onChange={(e) => handleUpdatePdfField(idx, "region", e.target.value)}
                        placeholder="South Central"
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-semibold text-zinc-900"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-700 mb-0.5">Add-ons (after w/)</label>
                      <input
                        type="text"
                        value={pdf.addOns}
                        onChange={(e) => handleUpdatePdfField(idx, "addOns", e.target.value)}
                        placeholder="e.g. Volume or Pedestrians, Bicycles..."
                        className="w-full bg-white border border-zinc-300 rounded px-2 py-1 text-xs font-semibold text-zinc-900"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VIEW MODE 1: COMBINED APPROVAL EMAIL (when activeTab === "combined" and 2 PDFs loaded) */}
          {activeTab === "combined" && combinedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left 5 Cols: Dual PDF Summary & KMZ Attachment Box */}
                <div className="lg:col-span-5 space-y-3">
                  {/* Scanned Breakdown */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 text-xs space-y-3">
                    <div className="font-bold text-zinc-900 flex items-center justify-between border-b border-zinc-200 pb-2">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        Dual PDF Approval Flow
                      </span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                        2 Files Active
                      </span>
                    </div>

                    {/* TMC Section Details */}
                    {combinedEmail.tmcPdf && (
                      <div className="bg-white border border-zinc-200 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-700 uppercase">Part 1: TMC Approval (Top)</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1 rounded">TMC</span>
                        </div>
                        <div className="text-[11px] text-zinc-700 space-y-0.5">
                          <p><strong>Project:</strong> {combinedEmail.tmcPdf.projectNumber}</p>
                          <p><strong>Location/s:</strong> {combinedEmail.tmcPdf.locationsCount}</p>
                          <p><strong>Urgency:</strong> {combinedEmail.tmcPdf.urgency}</p>
                        </div>
                      </div>
                    )}

                    {/* ATR Section Details */}
                    {combinedEmail.atrPdf && (
                      <div className="bg-white border border-zinc-200 rounded-lg p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">Part 2: ALG Conversion (Bottom)</span>
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1 rounded">ATR</span>
                        </div>
                        <div className="text-[11px] text-zinc-700 space-y-0.5">
                          <p><strong>Region:</strong> {combinedEmail.atrPdf.region || "South Central"}</p>
                          <p><strong>Project:</strong> {combinedEmail.atrPdf.projectNumber}</p>
                          <p><strong>Location/s:</strong> {combinedEmail.atrPdf.locationsCount}</p>
                          <p><strong>Study:</strong> {combinedEmail.atrPdf.fullStudyFormatted}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. ATTACHMENT PLACEHOLDER FOR KMZ FILE (Below Scanned Details) */}
                  <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-zinc-900">KMZ Map Attachment Placeholder</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleLoadSampleKmz}
                        className="text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                      >
                        + Sample KMZ
                      </button>
                    </div>

                    <input
                      type="file"
                      ref={kmzInputRef}
                      onChange={(e) => {
                        if (e.target.files) handleKmzFiles(e.target.files);
                      }}
                      accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
                      multiple
                      className="hidden"
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingKmz(true);
                      }}
                      onDragLeave={() => setIsDraggingKmz(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingKmz(false);
                        if (e.dataTransfer.files) handleKmzFiles(e.dataTransfer.files);
                      }}
                      onClick={() => kmzInputRef.current?.click()}
                      className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition flex items-center justify-center space-x-2 ${
                        isDraggingKmz
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/70"
                      }`}
                    >
                      <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-xs text-emerald-800 font-medium">
                        Drop KMZ map file here or click to browse
                      </span>
                    </div>

                    {/* Attached KMZ File Badges */}
                    {kmzList.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                          Attached Map File(s):
                        </span>
                        {kmzList.map((kmz) => (
                          <div
                            key={kmz.id}
                            className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-emerald-950 truncate">{kmz.fileName}</span>
                              <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-mono">
                                {kmz.fileSizeFormatted}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveKmz(kmz.id)}
                              className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Remove KMZ"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right 7 Cols: Combined Outlook Email Card */}
                <div className="lg:col-span-7 bg-white border-2 border-indigo-200 rounded-xl shadow-xs overflow-hidden">
                  {/* Top Bar */}
                  <div className="bg-indigo-600 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider bg-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Combined Outlook Approval
                      </span>
                      <span className="text-xs font-semibold text-indigo-100 hidden sm:inline">To: James</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyRichEmail(
                            combinedEmail.emailBodyText,
                            combinedEmail.emailBodyHtml,
                            "combined"
                          )
                        }
                        className="text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 px-3 py-1 rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedStatus === "combined" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied to Outlook!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Combined Email</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isExportingEml}
                        onClick={() =>
                          handleDownloadEmlWithAttachments(
                            combinedEmail.emailSubject,
                            combinedEmail.emailBodyHtml,
                            "James <james@ndsdata.com>",
                            pdfList
                          )
                        }
                        className="text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white border border-indigo-500 px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                        title="Download .eml file with PDFs & KMZ attached ready to send in Outlook"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isExportingEml ? "Packaging..." : ".EML (with Attachments)"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Attached Files Banner */}
                  <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between text-xs text-zinc-600">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="font-bold flex items-center gap-1 text-zinc-700">
                        <Paperclip className="w-3.5 h-3.5 text-zinc-500" /> Attachments ({pdfList.length + kmzList.length}):
                      </span>
                      {pdfList.map((p, i) => (
                        <span key={p.id} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          📄 {p.fileName || `${p.projectNumber}.pdf`}
                        </span>
                      ))}
                      {kmzList.map((k) => (
                        <span key={k.id} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          🌍 {k.fileName}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Live Visual Email Preview */}
                  <div className="p-4 sm:p-5 font-sans text-sm text-zinc-900 bg-white select-text space-y-3.5">
                    <div className="text-xs text-zinc-500 border-b border-zinc-100 pb-2 space-y-1">
                      <div>
                        <strong className="text-zinc-700">To:</strong> James
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-zinc-700">Subject:</strong>{" "}
                          <span className="font-semibold text-zinc-900">{combinedEmail.emailSubject}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopySubject(combinedEmail.emailSubject, "subj-combined")}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shrink-0 transition"
                          title="Copy Subject only"
                        >
                          {copiedStatus === "subj-combined" ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Subject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Email Body with Live Yellow Highlight for Urgency */}
                    <div className="bg-white border border-zinc-200 rounded-lg p-4 font-sans text-sm leading-relaxed shadow-2xs space-y-3">
                      <p>Hi James,</p>
                      <p>Please see TMC camera placement approval.</p>

                      {/* Urgency Line Highlighted in Yellow */}
                      <p>
                        <span className="bg-yellow-300 text-black font-bold px-1.5 py-0.5 rounded-xs inline-block shadow-2xs">
                          {formatUrgencyLine(
                            combinedEmail.tmcPdf?.urgency || "Priority Client",
                            scheduleOption === "none" ? "today_next_week" : scheduleOption
                          )}
                        </span>
                      </p>

                      <div className="space-y-0.5">
                        <p><strong>Project Number:</strong> <strong className="font-bold font-mono">{combinedEmail.tmcPdf?.projectNumber}</strong></p>
                        <p><strong>Location/s:</strong> {combinedEmail.tmcPdf?.locationsCount}</p>
                      </div>

                      <p className="pt-2">Also, Please see ALG conversion attached.</p>

                      <div className="space-y-0.5">
                        <p><strong>Region:</strong> {combinedEmail.atrPdf?.region || "South Central"}</p>
                        <p><strong>Project Number:</strong> <strong className="font-bold font-mono">{combinedEmail.atrPdf?.projectNumber}</strong></p>
                        <p><strong>Location/s:</strong> {combinedEmail.atrPdf?.locationsCount}</p>
                        <p><strong>Study:</strong> {combinedEmail.atrPdf?.fullStudyFormatted || (combinedEmail.atrPdf?.addOns ? `ALG ${combinedEmail.atrPdf.addOns}` : "ALG Volume")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: INDIVIDUAL SINGLE PDF APPROVAL (when activeTab is a number e.g. 0 or 1) */}
          {typeof activeTab === "number" && activeSinglePdf && (
            (() => {
              const singleRender = getSinglePdfRender(activeSinglePdf);
              const isTmc = activeSinglePdf.studyType.includes("TMC");

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left 5 Cols: Scanned Breakdown Card & KMZ Attachment Box */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 text-xs space-y-3">
                      <div className="font-bold text-zinc-900 flex items-center justify-between border-b border-zinc-200 pb-2">
                        <span>Scanned Page 1 Details</span>
                        <span className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-mono">
                          {activeSinglePdf.studyType}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Project Number (Upper Left)</span>
                          <span className="text-sm font-bold font-mono text-zinc-900">{activeSinglePdf.projectNumber || "Not found"}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Urgency (Upper Right)</span>
                          <span className="bg-yellow-300 text-black font-bold px-2 py-0.5 rounded-xs inline-block mt-0.5">
                            {formatUrgencyLine(activeSinglePdf.urgency, scheduleOption)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Location/s (Project Details)</span>
                          <span className="font-bold text-zinc-900 bg-white border border-zinc-200 px-2 py-0.5 rounded inline-block mt-0.5">
                            {activeSinglePdf.locationsCount} Location{activeSinglePdf.locationsCount === "1" ? "" : "s"}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Study Line</span>
                          <p className="font-medium text-zinc-800 bg-white border border-zinc-200 p-1.5 rounded mt-0.5 text-[11px]">
                            {activeSinglePdf.studyLineRaw || `${activeSinglePdf.locationsCount} ${activeSinglePdf.studyType}`}
                          </p>
                        </div>

                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase font-bold block">Add-ons (Next to Study)</span>
                          <p className="font-medium text-indigo-900 bg-indigo-50/70 border border-indigo-200 p-1.5 rounded mt-0.5 text-[11px]">
                            {activeSinglePdf.addOns || "None detected"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. ATTACHMENT PLACEHOLDER FOR KMZ FILE (Below Scanned Details) */}
                    <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-3.5 sm:p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                            <MapPin className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-zinc-900">KMZ Map Attachment Placeholder</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadSampleKmz}
                          className="text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded cursor-pointer transition"
                        >
                          + Sample KMZ
                        </button>
                      </div>

                      <input
                        type="file"
                        ref={kmzInputRef}
                        onChange={(e) => {
                          if (e.target.files) handleKmzFiles(e.target.files);
                        }}
                        accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
                        multiple
                        className="hidden"
                      />

                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingKmz(true);
                        }}
                        onDragLeave={() => setIsDraggingKmz(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDraggingKmz(false);
                          if (e.dataTransfer.files) handleKmzFiles(e.dataTransfer.files);
                        }}
                        onClick={() => kmzInputRef.current?.click()}
                        className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition flex items-center justify-center space-x-2 ${
                          isDraggingKmz
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/70"
                        }`}
                      >
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs text-emerald-800 font-medium">
                          Drop KMZ map file here or click to browse
                        </span>
                      </div>

                      {/* Attached KMZ File Badges */}
                      {kmzList.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                            Attached Map File(s):
                          </span>
                          {kmzList.map((kmz) => (
                            <div
                              key={kmz.id}
                              className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-semibold text-emerald-950 truncate">{kmz.fileName}</span>
                                <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-mono">
                                  {kmz.fileSizeFormatted}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveKmz(kmz.id)}
                                className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer"
                                title="Remove KMZ"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right 7 Cols: Single Outlook Email Card */}
                  <div className="lg:col-span-7 bg-white border-2 border-indigo-200 rounded-xl shadow-xs overflow-hidden">
                    {/* Header */}
                    <div className="bg-indigo-600 text-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-wider bg-indigo-700 px-2 py-0.5 rounded">
                          {isTmc ? "TMC Approval (James)" : "ALG Conversion (Nina/Marisa)"}
                        </span>
                        <span className="text-xs font-semibold text-indigo-100">{singleRender.subject}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyRichEmail(
                              singleRender.text,
                              singleRender.html,
                              `single-${activeTab}`
                            )
                          }
                          className="text-xs font-bold bg-white text-indigo-700 hover:bg-indigo-50 px-3 py-1 rounded-md transition shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          {copiedStatus === `single-${activeTab}` ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Email</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isExportingEml}
                          onClick={() =>
                            handleDownloadEmlWithAttachments(
                              singleRender.subject,
                              singleRender.html,
                              isTmc ? "James <james@ndsdata.com>" : "Nina, Marisa <scheduling@ndsdata.com>",
                              [activeSinglePdf]
                            )
                          }
                          className="text-xs font-bold bg-indigo-700 hover:bg-indigo-800 text-white border border-indigo-500 px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                          title="Download .eml file with PDF & KMZ attached ready to send in Outlook"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isExportingEml ? "Packaging..." : ".EML (with Attachments)"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Attached Files Banner */}
                    <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between text-xs text-zinc-600">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-bold flex items-center gap-1 text-zinc-700">
                          <Paperclip className="w-3.5 h-3.5 text-zinc-500" /> Attachments ({1 + kmzList.length}):
                        </span>
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[11px] font-mono">
                          📄 {activeSinglePdf.fileName || `${activeSinglePdf.projectNumber}.pdf`}
                        </span>
                        {kmzList.map((k) => (
                          <span key={k.id} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                            🌍 {k.fileName}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="p-4 sm:p-5 font-sans text-sm text-zinc-900 bg-white select-text space-y-3">
                      <div className="text-xs text-zinc-500 border-b border-zinc-100 pb-2 space-y-1">
                        <div>
                          <strong className="text-zinc-700">To:</strong>{" "}
                          {isTmc ? "James" : "Nina, Marisa"}
                        </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <strong className="text-zinc-700">Subject:</strong>{" "}
                          <span className="font-semibold text-zinc-900">{singleRender.subject}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopySubject(singleRender.subject, `subj-${activeTab}`)}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shrink-0 transition"
                          title="Copy Subject only"
                        >
                          {copiedStatus === `subj-${activeTab}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-700 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Subject</span>
                            </>
                          )}
                        </button>
                      </div>
                      </div>

                      <div className="bg-white border border-zinc-200 rounded-lg p-4 font-sans text-sm leading-relaxed shadow-2xs space-y-3">
                        {isTmc ? (
                          <>
                            <p>Hi James,</p>
                            <p>Please see TMC camera placement approval.</p>
                            <p>
                              <span className="bg-yellow-300 text-black font-bold px-1.5 py-0.5 rounded-xs inline-block shadow-2xs">
                                {formatUrgencyLine(activeSinglePdf.urgency, scheduleOption)}
                              </span>
                            </p>
                            <div className="space-y-0.5">
                              <p><strong>Project Number:</strong> <strong className="font-bold font-mono">{activeSinglePdf.projectNumber}</strong></p>
                              <p><strong>Location/s:</strong> {activeSinglePdf.locationsCount}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <p>Hi Nina/Marisa,</p>
                            <p>Please see ALG conversion attached.</p>
                            <p>
                              <span className="bg-yellow-300 text-black font-bold px-1.5 py-0.5 rounded-xs inline-block shadow-2xs">
                                {formatUrgencyLine(activeSinglePdf.urgency, scheduleOption)}
                              </span>
                            </p>
                            <div className="space-y-0.5">
                              <p><strong>Region:</strong> {activeSinglePdf.region || "South Central"}</p>
                              <p><strong>Project Number:</strong> <strong className="font-bold font-mono">{activeSinglePdf.projectNumber}</strong></p>
                              <p><strong>Location/s:</strong> {activeSinglePdf.locationsCount}</p>
                              <p><strong>Study:</strong> {activeSinglePdf.fullStudyFormatted}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
};
