import React, { useState } from "react";
import { X, Sparkles, Check, RefreshCw, HelpCircle, Layers } from "lucide-react";
import { ColumnMapping } from "../types";

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  currentMapping: ColumnMapping;
  sampleRows: Record<string, string>[];
  onSaveMapping: (newMapping: ColumnMapping) => void;
}

const FIELD_LABELS: { key: keyof ColumnMapping; label: string; description: string; required: boolean }[] = [
  { key: "locationId", label: "Location ID", description: "e.g. 26-104822-001 (Project # is automatically extracted by removing -001)", required: false },
  { key: "setupBefore", label: "Setup Before (Install Date & Time)", description: "Date (MM/DD/YYYY) & Time for Installs. Placed in corresponding Day of Week section.", required: false },
  { key: "teardownAfter", label: "Teardown After (Teardown Date & Time)", description: "Date (MM/DD/YYYY) & Time for Teardowns. Placed in corresponding Day of Week section.", required: false },
  { key: "scheduleOrder", label: "Schedule Order (Order List Sequence)", description: "Sorts install tasks and location bullets in numerical sequence (1, 2, 3...) within each day.", required: false },
  { key: "batteryCheckPrefix", label: "Battery Change / Equipment Checks", description: "Auto-scans columns: Battery Change/Equipment Check 1, 2, 3, 4, 5, 6, 7... only placed if date exists.", required: false },
  { key: "serviceType", label: "Service Type", description: "e.g. Miovision, ATR, Radar, Turning Movement", required: false },
  { key: "serviceTypeAddOns", label: "Service Type Add Ons", description: "Add ons from project ID / locations (e.g. Drone, ATR, Radar)", required: false },
  { key: "cityState", label: "City, State", description: "e.g. Dallas, TX or Fort Worth, TX", required: false },
  { key: "countyParish", label: "Different County / Parish (from Locations)", description: "e.g. Vermilion Parish, Lafayette Parish (used for LADOTD volume lines)", required: false },
  { key: "workWeek", label: "Work Week (WW)", description: "e.g. Work Week 32, WW 32, 32", required: false },
  { key: "cameraCounts", label: "Camera Counts", description: "e.g. 2 cameras, 0 cameras, 4 cameras", required: false },
  { key: "backupUnits", label: "Backup Units (Backup Cameras)", description: "e.g. 1, 1 backup, 2 backups (displayed as + 1 backup in location bullet)", required: false },
  { key: "schedulingTeamNotes", label: "Scheduling Team Notes", description: "Project-level notes e.g. (City of Dallas - List 104) replacing <City, State> in task lines", required: false },
  { key: "scheduleNotes", label: "Schedule Notes (Location Notes)", description: "Location-specific schedule notes e.g. (Also collecting data for 26-450236-004) beside camera counts", required: false },
  { key: "scheduleDetails", label: "Schedule Details", description: "Study duration e.g. '1 Day: Tue/Wed/Thu = TBD' converted into hours collection (24-hr, 48-hr...)", required: false },
  { key: "taskCategory", label: "Task / Job Category", description: "Install, Teardown, or BatterySwap / SD Check", required: false },
  { key: "teardownTimeNotes", label: "Teardown Time Notes", description: "e.g. Anytime, 10:00 AM, After rush hour", required: false },
  { key: "daysOfCollection", label: "Days of Collection", description: "e.g. 3-day, 5-day, 7-day", required: false },
  { key: "technicianName", label: "Technician Name", description: "Worker or field agent assigned to the job", required: true },
  { key: "technicianEmail", label: "Technician Email", description: "Email address where the schedule will be sent", required: true },
  { key: "date", label: "Fallback Scheduled Date", description: "Fallback single date if Setup/Teardown columns are absent", required: false },
  { key: "timeSlot", label: "Arrival Window / Time", description: "Time slot e.g. 08:00 AM - 10:00 AM", required: false },
  { key: "orderNumber", label: "Work Order # / Job ID", description: "Unique ticket number or work order ID", required: false },
  { key: "customerName", label: "Customer / Client Name", description: "Name of customer, business, or site contact", required: false },
  { key: "customerPhone", label: "Customer Phone Number", description: "Contact phone for technician to call on arrival", required: false },
  { key: "serviceAddress", label: "Service Location / Address", description: "Full address used for Google/Apple Maps GPS link", required: false },
  { key: "jobType", label: "Job / Work Type", description: "Title of service (e.g. Miovision, AC Diagnostic)", required: false },
  { key: "priority", label: "Priority / Urgency", description: "Urgent, High, Normal, Low severity level", required: false },
  { key: "description", label: "Task Scope / Description", description: "Detailed summary of customer issue or work to do", required: false },
  { key: "requiredParts", label: "Required Parts & Tools", description: "Special equipment, filters, replacement parts", required: false },
  { key: "specialInstructions", label: "Dispatcher Notes / Gate Codes", description: "Access notes, security codes, parking instructions", required: false },
  { key: "estimatedDurationMin", label: "Estimated Duration (Min)", description: "Job duration in minutes for shift math", required: false },
];

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  headers,
  currentMapping,
  sampleRows,
  onSaveMapping,
}) => {
  const [mapping, setMapping] = useState<ColumnMapping>({ ...currentMapping });
  const [isAiMatching, setIsAiMatching] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFieldChange = (key: keyof ColumnMapping, val: string) => {
    setMapping((prev) => ({ ...prev, [key]: val }));
  };

  const handleAiAutoMatch = async () => {
    setIsAiMatching(true);
    setAiSuccessMessage(null);
    try {
      const res = await fetch("/api/ai/match-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, sampleRows }),
      });
      const data = await res.json();
      if (data.matches && Object.keys(data.matches).length > 0) {
        setMapping((prev) => ({
          ...prev,
          ...data.matches,
        }));
        setAiSuccessMessage("AI successfully mapped detected column headers!");
      }
    } catch (err) {
      console.error("AI matching failed:", err);
    } finally {
      setIsAiMatching(false);
    }
  };

  const handleSave = () => {
    onSaveMapping(mapping);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center border border-zinc-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">CSV Column Mapping</h2>
              <p className="text-xs text-zinc-400">Map columns from your uploaded CSV file to technician schedule fields</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs">
          <div className="text-zinc-600">
            Detected <span className="font-semibold text-zinc-900">{headers.length}</span> columns in CSV file
          </div>
          <button
            onClick={handleAiAutoMatch}
            disabled={isAiMatching}
            className="flex items-center space-x-1.5 font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition"
          >
            {isAiMatching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            )}
            <span>{isAiMatching ? "Analyzing Columns..." : "AI Auto-Match Columns"}</span>
          </button>
        </div>

        {aiSuccessMessage && (
          <div className="mx-6 mt-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{aiSuccessMessage}</span>
          </div>
        )}

        {/* Mapping Form List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELD_LABELS.map(({ key, label, description, required }) => (
              <div key={key} className="bg-zinc-50/70 border border-zinc-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-800 flex items-center gap-1">
                    <span>{label}</span>
                    {required && <span className="text-red-500 font-bold">*</span>}
                  </label>
                  {mapping[key] ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Mapped
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400">Optional</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-1">{description}</p>
                <select
                  value={mapping[key] || ""}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-2.5 py-2 text-zinc-800 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                >
                  <option value="">-- (Not Mapped) --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      Column: {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-4 py-2 rounded-lg hover:bg-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-lg shadow-xs transition flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Apply Mapping</span>
          </button>
        </div>
      </div>
    </div>
  );
};
