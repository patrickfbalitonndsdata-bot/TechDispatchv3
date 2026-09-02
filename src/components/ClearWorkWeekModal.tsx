import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Calendar,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  CheckSquare,
  Square,
  Filter,
  Users,
  Mail,
} from "lucide-react";
import { GeneratedEmailRecord } from "../utils/generatedEmailStorage";

interface ClearWorkWeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: GeneratedEmailRecord[];
  selectedTechFilter: string;
  onConfirmDelete: (selectedWeeks: string[], techName?: string) => void;
}

interface WorkWeekSummary {
  workWeek: string;
  totalEmails: number;
  filteredEmails: number;
  technicians: string[];
  lastGenerated: string;
}

export const ClearWorkWeekModal: React.FC<ClearWorkWeekModalProps> = ({
  isOpen,
  onClose,
  history,
  selectedTechFilter,
  onConfirmDelete,
}) => {
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"filtered" | "all">(
    selectedTechFilter !== "all" ? "filtered" : "all"
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync default scope filter whenever modal opens or active tech changes
  useEffect(() => {
    if (isOpen) {
      setSelectedWeeks([]);
      setSearchTerm("");
      setScopeFilter(selectedTechFilter !== "all" ? "filtered" : "all");
      setIsDeleting(false);
    }
  }, [isOpen, selectedTechFilter]);

  // Aggregate work weeks from history
  const workWeekSummaries = useMemo<WorkWeekSummary[]>(() => {
    const map = new Map<
      string,
      {
        total: number;
        filtered: number;
        techs: Set<string>;
        latestTimestamp: number;
        lastGeneratedFormatted: string;
      }
    >();

    for (const record of history) {
      const week = (record.workWeek || "Unspecified Work Week").trim();
      if (!map.has(week)) {
        map.set(week, {
          total: 0,
          filtered: 0,
          techs: new Set<string>(),
          latestTimestamp: 0,
          lastGeneratedFormatted: "",
        });
      }

      const item = map.get(week)!;
      item.total += 1;
      item.techs.add(record.cleanTechName || record.technicianName);

      if (
        selectedTechFilter === "all" ||
        record.cleanTechName.toLowerCase() === selectedTechFilter.toLowerCase()
      ) {
        item.filtered += 1;
      }

      const recTime = new Date(record.timestamp).getTime();
      if (recTime > item.latestTimestamp) {
        item.latestTimestamp = recTime;
        item.lastGeneratedFormatted = record.dateFormatted;
      }
    }

    const list: WorkWeekSummary[] = [];
    map.forEach((data, week) => {
      // If we are scoping by a specific technician and this week has 0 emails for them, we can still list it if in 'all' mode
      list.push({
        workWeek: week,
        totalEmails: data.total,
        filteredEmails: data.filtered,
        technicians: Array.from(data.techs).sort(),
        lastGenerated: data.lastGeneratedFormatted,
      });
    });

    // Sort by work week or recent
    return list.sort((a, b) => b.workWeek.localeCompare(a.workWeek));
  }, [history, selectedTechFilter]);

  // Filtered summaries according to search term and scope
  const filteredSummaries = useMemo(() => {
    return workWeekSummaries.filter((summary) => {
      if (scopeFilter === "filtered" && selectedTechFilter !== "all" && summary.filteredEmails === 0) {
        return false;
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        summary.workWeek.toLowerCase().includes(term) ||
        summary.technicians.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [workWeekSummaries, searchTerm, scopeFilter, selectedTechFilter]);

  // Calculate total affected emails
  const affectedEmailCount = useMemo(() => {
    const selectedSet = new Set(selectedWeeks);
    return history.filter((r) => {
      const week = (r.workWeek || "Unspecified Work Week").trim();
      if (!selectedSet.has(week)) return false;
      if (scopeFilter === "filtered" && selectedTechFilter !== "all") {
        return r.cleanTechName.toLowerCase() === selectedTechFilter.toLowerCase();
      }
      return true;
    }).length;
  }, [history, selectedWeeks, scopeFilter, selectedTechFilter]);

  if (!isOpen) return null;

  // Toggle one week
  const handleToggleWeek = (week: string) => {
    setSelectedWeeks((prev) =>
      prev.includes(week) ? prev.filter((w) => w !== week) : [...prev, week]
    );
  };

  // Select all visible
  const handleSelectAll = () => {
    const allVisible = filteredSummaries.map((s) => s.workWeek);
    const newSet = new Set([...selectedWeeks, ...allVisible]);
    setSelectedWeeks(Array.from(newSet));
  };

  // Deselect all visible
  const handleDeselectAll = () => {
    const visibleSet = new Set(filteredSummaries.map((s) => s.workWeek));
    setSelectedWeeks((prev) => prev.filter((w) => !visibleSet.has(w)));
  };

  const handleDelete = () => {
    if (selectedWeeks.length === 0) return;
    setIsDeleting(true);
    const techParam = scopeFilter === "filtered" && selectedTechFilter !== "all" ? selectedTechFilter : undefined;
    onConfirmDelete(selectedWeeks, techParam);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-zinc-900">Clear History by Work Week</h3>
                <span className="bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  Bulk Deletion
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Select one or more specific work weeks to permanently delete from stored email history.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technician Scope Selector (if technician filter is currently applied) */}
        {selectedTechFilter !== "all" && (
          <div className="px-4 py-2.5 bg-amber-50/80 border-b border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center space-x-1.5 font-medium">
              <Filter className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Active Filter: <strong>{selectedTechFilter}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-amber-800">Delete scope:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-amber-200/60 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScopeFilter("filtered")}
                  className={`px-2 py-1 rounded-md transition ${
                    scopeFilter === "filtered"
                      ? "bg-white text-amber-950 shadow-2xs"
                      : "text-amber-800 hover:text-amber-950"
                  }`}
                >
                  {selectedTechFilter} Only
                </button>
                <button
                  type="button"
                  onClick={() => setScopeFilter("all")}
                  className={`px-2 py-1 rounded-md transition ${
                    scopeFilter === "all"
                      ? "bg-white text-amber-950 shadow-2xs"
                      : "text-amber-800 hover:text-amber-950"
                  }`}
                >
                  All Technicians
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Selection Toolbar */}
        <div className="p-3.5 border-b border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white text-xs">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search work weeks or tech..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={filteredSummaries.length === 0}
              className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition disabled:opacity-40 cursor-pointer"
            >
              Select All ({filteredSummaries.length})
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              disabled={selectedWeeks.length === 0}
              className="px-2.5 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition disabled:opacity-40 cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Work Week Checklist Content */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 divide-y divide-zinc-100">
          {filteredSummaries.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Calendar className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-xs font-medium text-zinc-600">No matching work weeks found.</p>
              <p className="text-[11px] text-zinc-400">Try adjusting your search query or technician filter.</p>
            </div>
          ) : (
            filteredSummaries.map((summary) => {
              const isSelected = selectedWeeks.includes(summary.workWeek);
              const emailCount =
                scopeFilter === "filtered" && selectedTechFilter !== "all"
                  ? summary.filteredEmails
                  : summary.totalEmails;

              return (
                <div
                  key={summary.workWeek}
                  onClick={() => handleToggleWeek(summary.workWeek)}
                  className={`py-3 px-3 rounded-xl transition flex items-start space-x-3 cursor-pointer select-none my-1 ${
                    isSelected
                      ? "bg-red-50/80 border border-red-200/80"
                      : "hover:bg-zinc-50 border border-transparent"
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                        isSelected
                          ? "bg-red-600 border-red-600 text-white"
                          : "border-zinc-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isSelected ? "text-red-950" : "text-zinc-900"
                        }`}
                      >
                        {summary.workWeek}
                      </h4>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          isSelected
                            ? "bg-red-200/80 text-red-900 font-extrabold"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {emailCount} email{emailCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                      <div className="flex items-center space-x-1 truncate max-w-xs">
                        <Users className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="truncate">
                          {summary.technicians.slice(0, 3).join(", ")}
                          {summary.technicians.length > 3
                            ? ` +${summary.technicians.length - 3} more`
                            : ""}
                        </span>
                      </div>
                      {summary.lastGenerated && (
                        <div className="flex items-center space-x-1 text-zinc-400">
                          <span>Latest: {summary.lastGenerated}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Warning / Summary Banner */}
        {selectedWeeks.length > 0 && (
          <div className="px-4 py-2.5 bg-red-50 border-t border-red-100 flex items-center space-x-2 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="flex-1 font-medium">
              You have selected <strong>{selectedWeeks.length} work week{selectedWeeks.length !== 1 ? "s" : ""}</strong> containing{" "}
              <strong>{affectedEmailCount} email record{affectedEmailCount !== 1 ? "s" : ""}</strong> to permanently delete.
            </span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 font-medium">
            {selectedWeeks.length} of {workWeekSummaries.length} selected
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.75 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition cursor-pointer shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={selectedWeeks.length === 0 || isDeleting}
              className="flex items-center space-x-1.5 px-4 py-1.75 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 rounded-lg transition shadow-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                Delete Selected ({selectedWeeks.length})
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
