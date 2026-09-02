import React, { useState } from "react";
import {
  X,
  Mail,
  Search,
  Trash2,
  Download,
  Calendar,
  User,
  History,
  Sparkles,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import { GeneratedEmailRecord } from "../utils/generatedEmailStorage";
import { cleanTechnicianName, copyRichHtmlToClipboard } from "../utils/outlookTemplateGenerator";
import { EmailViewerModal } from "./EmailViewerModal";

interface GeneratedEmailsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: GeneratedEmailRecord[];
  activeTechName?: string;
  activeWorkWeek?: string;
  onDeleteRecord: (id: string) => void;
  onClearTechHistory?: (techName: string, workWeek?: string) => void;
  onLoadSavedEmailIntoGenerator?: (record: GeneratedEmailRecord) => void;
}

export const GeneratedEmailsHistoryModal: React.FC<GeneratedEmailsHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  activeTechName,
  activeWorkWeek,
  onDeleteRecord,
  onClearTechHistory,
  onLoadSavedEmailIntoGenerator,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTech, setFilterTech] = useState<string>(activeTechName ? "current" : "all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHtmlId, setCopiedHtmlId] = useState<string | null>(null);
  const [confirmClearTech, setConfirmClearTech] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<GeneratedEmailRecord | null>(null);

  if (!isOpen) return null;

  const cleanActiveTech = activeTechName ? cleanTechnicianName(activeTechName).toLowerCase() : "";

  const filteredHistory = history.filter((item) => {
    if (filterTech === "current" && cleanActiveTech) {
      if (item.cleanTechName.toLowerCase() !== cleanActiveTech) return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.technicianName.toLowerCase().includes(term) ||
      item.cleanTechName.toLowerCase().includes(term) ||
      item.workWeek.toLowerCase().includes(term) ||
      item.subject.toLowerCase().includes(term) ||
      String(item.version).toLowerCase().includes(term) ||
      (item.notes && item.notes.toLowerCase().includes(term))
    );
  });

  const handleCopySubject = (id: string, text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyHtml = async (item: GeneratedEmailRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!item.htmlContent) return;
    const success = await copyRichHtmlToClipboard(item.htmlContent, item.plainTextContent || "");
    if (success) {
      setCopiedHtmlId(item.id);
      setTimeout(() => setCopiedHtmlId(null), 2500);
    }
  };

  const handleExportCsv = () => {
    if (filteredHistory.length === 0) return;
    const headers = ["Timestamp", "Technician", "Work Week", "Version", "Subject", "Method", "Notes"];
    const rows = filteredHistory.map((r) => [
      `"${r.dateFormatted}"`,
      `"${r.cleanTechName}"`,
      `"${r.workWeek}"`,
      `"${r.version}"`,
      `"${r.subject.replace(/"/g, '""')}"`,
      `"${r.exportMethod}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Generated_Emails_History_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-zinc-200 overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-400 text-zinc-950 flex items-center justify-center font-bold">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-white">Generated Email Version History</h2>
                  <span className="bg-yellow-400 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {history.length} Saved
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Tracking all generated Outlook schedules to auto-detect update versions per technician
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Toolbar & Filters */}
          <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search subject, week, tech..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {activeTechName && (
                <select
                  value={filterTech}
                  onChange={(e) => setFilterTech(e.target.value)}
                  className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-hidden cursor-pointer"
                >
                  <option value="current">{cleanTechnicianName(activeTechName)} Only</option>
                  <option value="all">All Technicians ({history.length})</option>
                </select>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleExportCsv}
                disabled={filteredHistory.length === 0}
                className="flex items-center space-x-1 font-semibold text-zinc-700 bg-white hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-300 transition cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-zinc-500" />
                <span>Export CSV</span>
              </button>

              {onClearTechHistory && activeTechName && (
                <button
                  onClick={() => {
                    if (confirmClearTech) {
                      onClearTechHistory(activeTechName, activeWorkWeek);
                      setConfirmClearTech(false);
                    } else {
                      setConfirmClearTech(true);
                      setTimeout(() => setConfirmClearTech(false), 4000);
                    }
                  }}
                  className={`flex items-center space-x-1 font-semibold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                    confirmClearTech
                      ? "bg-red-600 text-white border-red-700 animate-pulse"
                      : "text-red-600 bg-red-50 hover:bg-red-100 border-red-200"
                  }`}
                  title="Clear all generated email records for this technician"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmClearTech ? "Confirm Clear?" : "Clear Tech History"}</span>
                </button>
              )}
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filteredHistory.length === 0 ? (
              <div className="text-center py-16 text-zinc-400">
                <History className="w-10 h-10 mx-auto text-zinc-300 mb-2" />
                <p className="text-sm font-semibold text-zinc-700">No generated emails found</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  When you generate, copy, or download an Outlook email for a technician, it will be saved here in local storage to automatically track update versions.
                </p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-2xs hover:border-zinc-300 transition space-y-2 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-2">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span
                        className={`border font-black px-2 py-0.5 rounded text-xs ${
                          String(item.version).toLowerCase().includes("update") ||
                          (String(item.version).toLowerCase().includes("v") && !String(item.version).toLowerCase().includes("v0"))
                            ? "bg-yellow-100 text-yellow-900 border-yellow-300"
                            : "bg-blue-50 text-blue-900 border-blue-200"
                        }`}
                      >
                        {String(item.version).toLowerCase().includes("v") ||
                        String(item.version).toLowerCase().includes("update") ||
                        String(item.version).toLowerCase().includes("version")
                          ? item.version
                          : `Version ${item.version}`}
                      </span>
                      <span className="font-bold text-zinc-900 text-xs flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.cleanTechName}</span>
                      </span>
                      <span className="text-zinc-400 text-xs">•</span>
                      <span className="text-zinc-600 text-xs flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{item.workWeek}</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {item.dateFormatted}
                      </span>
                      <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-[10px] font-medium border border-zinc-200">
                        {item.exportMethod}
                      </span>
                      {/* Delete Individual Generated Email */}
                      <button
                        type="button"
                        onClick={() => onDeleteRecord(item.id)}
                        className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                        title="Delete this generated email from history (adjusts auto-version counter)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-1 gap-2">
                    <div className="min-w-0 pr-3 flex-1">
                      <div className="font-semibold text-zinc-800 truncate" title={item.subject}>
                        Subject: {item.subject}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-zinc-500 italic mt-0.5 truncate">
                          Notes: {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Display Email Button */}
                      <button
                        type="button"
                        onClick={() => setViewingRecord(item)}
                        className="inline-flex items-center space-x-1 text-[11px] font-bold text-zinc-900 bg-yellow-400 hover:bg-yellow-300 px-2.5 py-1 rounded-md transition cursor-pointer shadow-2xs"
                        title="Display full formatted email preview"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Display Email</span>
                      </button>

                      {/* Copy HTML Button */}
                      {item.htmlContent && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyHtml(item, e)}
                          className="flex items-center space-x-1 text-[11px] font-medium text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                          title="Copy styled HTML"
                        >
                          {copiedHtmlId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-zinc-400" />
                              <span>Copy HTML</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Copy Subject Button */}
                      <button
                        type="button"
                        onClick={(e) => handleCopySubject(item.id, item.subject, e)}
                        className="flex items-center space-x-1 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-md transition cursor-pointer"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-zinc-400" />
                            <span>Subject</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
            <div>
              Showing <strong className="text-zinc-800">{filteredHistory.length}</strong> recorded email(s) in local storage
            </div>
            <button
              onClick={onClose}
              className="font-semibold text-zinc-700 hover:text-zinc-900 px-4 py-1.5 rounded-lg bg-white border border-zinc-300 shadow-xs hover:bg-zinc-100 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Stored Email Full Display Modal */}
      {viewingRecord && (
        <EmailViewerModal
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          record={viewingRecord}
          onLoadIntoGenerator={onLoadSavedEmailIntoGenerator}
        />
      )}
    </>
  );
};
