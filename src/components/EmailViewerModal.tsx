import React, { useState } from "react";
import {
  X,
  Mail,
  Copy,
  Check,
  Download,
  ExternalLink,
  Calendar,
  User,
  Monitor,
  Smartphone,
  RotateCcw,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import { GeneratedEmailRecord } from "../utils/generatedEmailStorage";
import { copyRichHtmlToClipboard } from "../utils/outlookTemplateGenerator";

interface EmailViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: GeneratedEmailRecord | null;
  onLoadIntoGenerator?: (record: GeneratedEmailRecord) => void;
}

export const EmailViewerModal: React.FC<EmailViewerModalProps> = ({
  isOpen,
  onClose,
  record,
  onLoadIntoGenerator,
}) => {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);

  if (!isOpen || !record) return null;

  const handleCopyHtml = async () => {
    if (!record.htmlContent) return;
    const success = await copyRichHtmlToClipboard(record.htmlContent, record.plainTextContent || "");
    if (success) {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2500);
    }
  };

  const handleCopySubject = () => {
    navigator.clipboard.writeText(record.subject);
    setCopiedSubject(true);
    setTimeout(() => setCopiedSubject(false), 2000);
  };

  const handleDownloadEml = () => {
    if (!record.htmlContent) return;
    const boundary = "----=_NextPart_" + Date.now().toString(16);
    const emlContent = [
      `From: "NDS Dispatch Scheduling" <dispatch@ndsdata.com>`,
      `To: "${record.cleanTechName}" <technician@ndsdata.com>`,
      `Subject: ${record.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `X-Unsent: 1`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      record.plainTextContent || "NDS Technician Schedule",
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      record.htmlContent,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = record.cleanTechName.replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `Saved_${safeName}_${String(record.version).replace(/\s+/g, "_")}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-zinc-200 overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h2 className="text-sm font-bold text-white">Stored Email Display Viewer</h2>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    String(record.version).toLowerCase().includes("update") ||
                    (String(record.version).toLowerCase().includes("v") && !String(record.version).toLowerCase().includes("v0"))
                      ? "bg-yellow-400 text-zinc-950"
                      : "bg-blue-200 text-blue-950"
                  }`}
                >
                  {record.version}
                </span>
                <span className="bg-zinc-800 text-zinc-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-zinc-700">
                  {record.exportMethod}
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center space-x-2 mt-0.5">
                <span>{record.cleanTechName}</span>
                <span>•</span>
                <span>{record.workWeek}</span>
                <span>•</span>
                <span className="text-zinc-500 font-mono">{record.dateFormatted}</span>
              </p>
            </div>
          </div>

          {/* Top Controls: View mode switcher & Close button */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-zinc-800 p-1 rounded-lg border border-zinc-700">
              <button
                onClick={() => setViewMode("desktop")}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  viewMode === "desktop" ? "bg-zinc-900 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setViewMode("mobile")}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  viewMode === "mobile" ? "bg-zinc-900 text-white shadow-xs" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Subject Header Bar */}
        <div className="px-6 py-2.5 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="font-bold text-zinc-500 shrink-0">Subject:</span>
            <span className="font-semibold text-zinc-900 select-all truncate">{record.subject}</span>
          </div>
          <button
            onClick={handleCopySubject}
            className="flex items-center space-x-1 text-[11px] font-bold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 hover:bg-zinc-100 px-2.5 py-1 rounded-md transition shrink-0 cursor-pointer shadow-2xs"
          >
            {copiedSubject ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-600">Copied Subject</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-500" />
                <span>Copy Subject</span>
              </>
            )}
          </button>
        </div>

        {/* Stored Custom Notes / Details if present */}
        {record.notes && (
          <div className="px-6 py-2 bg-yellow-50/80 border-b border-yellow-200 text-xs text-yellow-950 flex items-center space-x-2">
            <span className="font-bold shrink-0">Update Note Recorded:</span>
            <span className="italic">{record.notes}</span>
          </div>
        )}

        {/* Rendered Email Body Area */}
        <div className="flex-1 overflow-y-auto bg-zinc-100 p-4 sm:p-6 flex justify-center">
          <div
            className={`bg-white rounded-xl shadow-xs transition-all duration-200 overflow-hidden w-full ${
              viewMode === "mobile" ? "max-w-[420px] p-4" : "max-w-4xl p-6"
            }`}
          >
            {record.htmlContent ? (
              <div
                className="outlook-saved-preview prose max-w-none"
                dangerouslySetInnerHTML={{ __html: record.htmlContent }}
              />
            ) : (
              <div className="p-8 text-center text-zinc-500 space-y-2">
                <Mail className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="font-semibold text-sm">HTML content was not stored for this record</p>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Subject: {record.subject}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-3.5 bg-white border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            {onLoadIntoGenerator && (
              <button
                onClick={() => {
                  onLoadIntoGenerator(record);
                  onClose();
                }}
                className="flex items-center space-x-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2 rounded-lg transition cursor-pointer shadow-2xs"
                title="Load this technician's notes and configuration into the active generator"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Load in Generator</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Copy HTML */}
            <button
              onClick={handleCopyHtml}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-white hover:bg-zinc-100 text-zinc-800 px-3.5 py-2 rounded-lg border border-zinc-300 shadow-xs transition cursor-pointer"
            >
              {copiedHtml ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied for Outlook!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Copy Styled HTML</span>
                </>
              )}
            </button>

            {/* Download EML */}
            <button
              onClick={handleDownloadEml}
              className="flex items-center space-x-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.EML)</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
