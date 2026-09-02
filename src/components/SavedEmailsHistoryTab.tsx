import React, { useState, useMemo, useEffect } from "react";
import {
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
  ExternalLink,
  RotateCcw,
  Layers,
  ArrowRight,
  Filter,
  CheckCircle2,
} from "lucide-react";
import {
  GeneratedEmailRecord,
  getStoredGeneratedEmails,
  deleteStoredGeneratedEmail,
  clearStoredGeneratedEmailsForTech,
  LOCAL_STORAGE_KEY_EMAILS,
} from "../utils/generatedEmailStorage";
import { cleanTechnicianName, copyRichHtmlToClipboard } from "../utils/outlookTemplateGenerator";
import { EmailViewerModal } from "./EmailViewerModal";

interface SavedEmailsHistoryTabProps {
  activeTechName?: string;
  onSelectTechInGenerator?: (techName: string) => void;
  onLoadSavedEmailIntoGenerator?: (record: GeneratedEmailRecord) => void;
}

export const SavedEmailsHistoryTab: React.FC<SavedEmailsHistoryTabProps> = ({
  activeTechName,
  onSelectTechInGenerator,
  onLoadSavedEmailIntoGenerator,
}) => {
  const [history, setHistory] = useState<GeneratedEmailRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTechFilter, setSelectedTechFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHtmlId, setCopiedHtmlId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<GeneratedEmailRecord | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Load history from localStorage
  const loadHistory = () => {
    const records = getStoredGeneratedEmails();
    setHistory(records);
    return records;
  };

  useEffect(() => {
    loadHistory();

    // Listen for storage events across tabs or local updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY_EMAILS) {
        loadHistory();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Unique list of technicians in history
  const technicianList = useMemo(() => {
    const techSet = new Set<string>();
    history.forEach((h) => techSet.add(h.cleanTechName));
    return Array.from(techSet).sort();
  }, [history]);

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedTechFilter !== "all") {
        if (item.cleanTechName.toLowerCase() !== selectedTechFilter.toLowerCase()) {
          return false;
        }
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.technicianName.toLowerCase().includes(term) ||
        item.cleanTechName.toLowerCase().includes(term) ||
        item.workWeek.toLowerCase().includes(term) ||
        item.subject.toLowerCase().includes(term) ||
        String(item.version).toLowerCase().includes(term) ||
        (item.notes && item.notes.toLowerCase().includes(term)) ||
        item.exportMethod.toLowerCase().includes(term)
      );
    });
  }, [history, selectedTechFilter, searchTerm]);

  // Handle single record deletion
  const handleDeleteRecord = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = deleteStoredGeneratedEmail(id);
    setHistory(updated);
    setFeedbackNotice("Deleted email record from local storage.");
    setTimeout(() => setFeedbackNotice(null), 3000);
  };

  // Handle clear all records for filtered tech or all
  const handleClearHistory = () => {
    if (selectedTechFilter !== "all") {
      const updated = clearStoredGeneratedEmailsForTech(selectedTechFilter);
      setHistory(updated);
      setFeedbackNotice(`Cleared all stored history for ${selectedTechFilter}.`);
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY_EMAILS);
        setHistory([]);
        setFeedbackNotice("Cleared all generated email records.");
      } catch (err) {
        console.warn("Failed to clear local storage", err);
      }
    }
    setConfirmClearAll(false);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  // Handle copy subject
  const handleCopySubject = (id: string, text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle copy HTML
  const handleCopyHtml = async (item: GeneratedEmailRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!item.htmlContent) return;
    const ok = await copyRichHtmlToClipboard(item.htmlContent, item.plainTextContent || "");
    if (ok) {
      setCopiedHtmlId(item.id);
      setTimeout(() => setCopiedHtmlId(null), 2500);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (filteredHistory.length === 0) return;
    const headers = ["Date Generated", "Technician", "Work Week", "Version", "Subject", "Method", "Stops Count", "Notes"];
    const rows = filteredHistory.map((r) => [
      `"${r.dateFormatted}"`,
      `"${r.cleanTechName}"`,
      `"${r.workWeek}"`,
      `"${r.version}"`,
      `"${r.subject.replace(/"/g, '""')}"`,
      `"${r.exportMethod}"`,
      `"${r.jobCount || ""}"`,
      `"${(r.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NDS_Saved_Emails_History_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats Card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-400 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-zinc-900">Saved Emails History Directory</h2>
              <span className="bg-yellow-100 text-yellow-900 border border-yellow-300 text-xs font-black px-2 py-0.5 rounded-md">
                {history.length} Email{history.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Locally persisted Outlook emails. Click <strong>Display Email</strong> to view any generated schedule anytime.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV button */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredHistory.length === 0}
            className="flex items-center space-x-1.5 text-xs font-semibold bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg border border-zinc-200 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-zinc-500" />
            <span>Export CSV</span>
          </button>

          {/* Clear History button */}
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirmClearAll) {
                  handleClearHistory();
                } else {
                  setConfirmClearAll(true);
                  setTimeout(() => setConfirmClearAll(false), 4000);
                }
              }}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.75 rounded-lg border transition cursor-pointer ${
                confirmClearAll
                  ? "bg-red-600 text-white border-red-700 animate-pulse"
                  : "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
              }`}
              title="Clear stored email records"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {confirmClearAll
                  ? selectedTechFilter !== "all"
                    ? `Confirm Clear ${selectedTechFilter}?`
                    : "Confirm Clear All?"
                  : selectedTechFilter !== "all"
                  ? `Clear ${selectedTechFilter}`
                  : "Clear All History"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackNotice && (
        <div className="bg-zinc-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-md flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedbackNotice}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="text-zinc-400 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by technician, subject, work week, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          {/* Technician Filter Dropdown */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-zinc-400 shrink-0 hidden sm:inline" />
            <select
              value={selectedTechFilter}
              onChange={(e) => setSelectedTechFilter(e.target.value)}
              className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 cursor-pointer w-full sm:w-auto"
            >
              <option value="all">All Technicians ({history.length} records)</option>
              {technicianList.map((tech) => {
                const count = history.filter((h) => h.cleanTechName.toLowerCase() === tech.toLowerCase()).length;
                return (
                  <option key={tech} value={tech}>
                    {tech} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-zinc-500 font-medium shrink-0">
          Showing <strong className="text-zinc-900">{filteredHistory.length}</strong> of{" "}
          <strong className="text-zinc-900">{history.length}</strong> stored emails
        </div>
      </div>

      {/* History Grid / List */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3 shadow-xs">
          <History className="w-12 h-12 text-zinc-300 mx-auto" />
          <h3 className="text-sm font-semibold text-zinc-900">No Stored Email Records Found</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {searchTerm || selectedTechFilter !== "all"
              ? "No saved emails match your current filter criteria. Try clearing the search or switching technician."
              : "Whenever you generate, copy, download, or click Save to History on an Outlook schedule, it will appear here so you can display and re-use it anytime."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((record) => {
            const isCurrentTech =
              activeTechName && cleanTechnicianName(activeTechName).toLowerCase() === record.cleanTechName.toLowerCase();

            return (
              <div
                key={record.id}
                className="bg-white border border-zinc-200 rounded-xl p-4 shadow-2xs hover:shadow-xs hover:border-zinc-300 transition flex flex-col space-y-3 group"
              >
                {/* Card Top Row: Version Badge, Tech, Work Week, Date, and Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    {/* Version Badge */}
                    <span
                      className={`font-black px-2 py-0.5 rounded-md text-xs border ${
                        String(record.version).toLowerCase().includes("update") ||
                        (String(record.version).toLowerCase().includes("v") && !String(record.version).toLowerCase().includes("v0"))
                          ? "bg-yellow-100 text-yellow-950 border-yellow-300"
                          : "bg-blue-50 text-blue-900 border-blue-200"
                      }`}
                    >
                      {record.version}
                    </span>

                    {/* Technician Name */}
                    <div className="flex items-center space-x-1 font-bold text-zinc-900 text-xs">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{record.cleanTechName}</span>
                    </div>

                    <span className="text-zinc-300 text-xs">•</span>

                    {/* Work Week */}
                    <div className="flex items-center space-x-1 text-zinc-600 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{record.workWeek}</span>
                    </div>

                    {isCurrentTech && (
                      <span className="bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold px-1.5 py-0.2 rounded">
                        Active Tech
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-xs shrink-0">
                    <span className="text-[11px] text-zinc-500 font-mono">{record.dateFormatted}</span>
                    <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-[10px] font-semibold border border-zinc-200">
                      {record.exportMethod}
                    </span>
                    {record.jobCount !== undefined && (
                      <span className="bg-zinc-50 text-zinc-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-zinc-200">
                        {record.jobCount} stops
                      </span>
                    )}

                    {/* Delete Individual Record */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteRecord(record.id, e)}
                      className="text-zinc-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                      title="Delete this stored email record from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Subject & Notes */}
                <div className="text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-zinc-500 mr-1.5">Subject:</span>
                      <span className="font-semibold text-zinc-900 select-all">{record.subject}</span>
                    </div>
                  </div>

                  {record.notes && (
                    <div className="bg-yellow-50/80 border border-yellow-200 rounded-md px-2.5 py-1.5 text-[11px] text-yellow-950 font-medium">
                      <span className="font-bold">Update Notes:</span> {record.notes}
                    </div>
                  )}

                  {record.additionalNotes && record.additionalNotes.length > 0 && (
                    <div className="flex items-center space-x-1.5 flex-wrap text-[10px] pt-1">
                      <span className="font-bold text-emerald-800">Additional Notes:</span>
                      {record.additionalNotes.map((n) => (
                        <span key={n.id} className="bg-emerald-100 text-emerald-900 font-semibold px-1.5 py-0.5 rounded">
                          {n.day}: {n.text.slice(0, 30)}...
                        </span>
                      ))}
                    </div>
                  )}

                  {record.brandingConfig?.overlappingSchedulesEnabled && (
                    <div className="flex items-center space-x-1.5 text-[10px] pt-0.5">
                      <span className="bg-indigo-100 text-indigo-900 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                        Overlapping Schedule Enabled
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions Row: Display Email Button + Copy HTML + Copy Subject */}
                <div className="pt-2 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    {/* DISPLAY EMAIL BUTTON (Prominent) */}
                    <button
                      type="button"
                      onClick={() => setViewingRecord(record)}
                      className="inline-flex items-center space-x-1.5 bg-yellow-400 hover:bg-yellow-300 text-zinc-950 px-3.5 py-1.75 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                      title="Display the exact stored email with styled layout and preview options"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Display Email</span>
                    </button>

                    {/* Copy HTML Button */}
                    {record.htmlContent && (
                      <button
                        type="button"
                        onClick={(e) => handleCopyHtml(record, e)}
                        className="inline-flex items-center space-x-1.5 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg text-xs font-semibold border border-zinc-300 shadow-2xs transition cursor-pointer"
                        title="Copy styled HTML to paste directly into Outlook"
                      >
                        {copiedHtmlId === record.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Copy HTML</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Copy Subject Button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopySubject(record.id, record.subject, e)}
                      className="inline-flex items-center space-x-1 text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50 px-2.5 py-1.75 rounded-lg text-xs font-medium border border-zinc-200 transition cursor-pointer"
                    >
                      {copiedId === record.id ? (
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

                  {/* Switch to Tech in Generator */}
                  {onSelectTechInGenerator && (
                    <button
                      type="button"
                      onClick={() => onSelectTechInGenerator(record.cleanTechName)}
                      className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Switch to {record.cleanTechName} in Generator</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* High-Fidelity Stored Email Display Modal */}
      {viewingRecord && (
        <EmailViewerModal
          isOpen={Boolean(viewingRecord)}
          onClose={() => setViewingRecord(null)}
          record={viewingRecord}
          onLoadIntoGenerator={onLoadSavedEmailIntoGenerator}
        />
      )}
    </div>
  );
};
