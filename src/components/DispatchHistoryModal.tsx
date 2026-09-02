import React, { useState } from "react";
import { X, History, Search, Download, Trash2, CheckCircle2, AlertCircle, Eye, FileSpreadsheet } from "lucide-react";
import { DispatchLogRecord } from "../types";

interface DispatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DispatchLogRecord[];
  onClearLogs: () => void;
}

export const DispatchHistoryModal: React.FC<DispatchHistoryModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.technicianEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.previewSubject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || log.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = ["Timestamp", "Technician", "Email", "Date", "Stops", "Status", "Method", "Subject", "Notes"];
    const rows = logs.map((l) => [
      `"${l.timestamp}"`,
      `"${l.technicianName}"`,
      `"${l.technicianEmail}"`,
      `"${l.date}"`,
      l.jobCount,
      `"${l.status}"`,
      `"${l.method}"`,
      `"${l.previewSubject.replace(/"/g, '""')}"`,
      `"${l.notes || ""}"`,
    ]);

    const csvText = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Dispatch_Audit_Logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center border border-zinc-700">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Dispatch History &amp; Audit Logs</h2>
              <p className="text-xs text-zinc-400">Track and verify all automated and manual Outlook schedule distributions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search technician, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="exported">Exported</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCsv}
              disabled={logs.length === 0}
              className="flex items-center space-x-1 font-semibold text-zinc-700 bg-white hover:bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-300 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="flex items-center space-x-1 font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 text-zinc-400">
              <History className="w-8 h-8 mx-auto text-zinc-300 mb-2" />
              <p className="text-xs font-semibold text-zinc-600">No dispatch records found</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Run a daily distribution or export an Outlook template to log actions.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Technician</th>
                  <th className="pb-2">Recipient Email</th>
                  <th className="pb-2">Stops</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 transition">
                    <td className="py-2.5 font-mono text-[11px] text-zinc-500">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-2.5 font-medium text-zinc-900">{log.technicianName}</td>
                    <td className="py-2.5 font-mono text-zinc-600">{log.technicianEmail}</td>
                    <td className="py-2.5 font-medium text-zinc-700">{log.jobCount} stops</td>
                    <td className="py-2.5">
                      <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          log.status === "Delivered"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : log.status === "Exported"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {log.status === "Delivered" && <CheckCircle2 className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-zinc-500 text-[11px]">{log.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
          <span>Total records: {filteredLogs.length}</span>
          <button
            onClick={onClose}
            className="font-semibold text-zinc-700 hover:text-zinc-900 px-4 py-1.5 rounded-lg bg-white border border-zinc-300 shadow-xs hover:bg-zinc-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
