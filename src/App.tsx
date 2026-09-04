import React, { useState, useMemo, useEffect } from "react";
import {
  Mail,
  Users,
  History,
  Sparkles,
  Calendar,
  FileText,
} from "lucide-react";
import {
  WorkOrder,
  ColumnMapping,
  ParseResult,
  TechnicianRoster,
  TemplateBranding,
  TemplateStyle,
  DispatchLogRecord,
} from "./types";
import { parseCsvData } from "./utils/csvParser";
import { DEFAULT_BRANDING, cleanTechnicianName } from "./utils/outlookTemplateGenerator";
import { SAMPLE_DATASETS, SampleDataset } from "./utils/sampleData";
import { getStoredGeneratedEmails, GeneratedEmailRecord, LOCAL_STORAGE_KEY_EMAILS } from "./utils/generatedEmailStorage";

import { Navbar } from "./components/Navbar";
import { CsvUploadZone } from "./components/CsvUploadZone";
import { OutlookEmailPreview } from "./components/OutlookEmailPreview";
import { ColumnMappingModal } from "./components/ColumnMappingModal";
import { SettingsBrandingModal } from "./components/SettingsBrandingModal";
import { DispatchHistoryModal } from "./components/DispatchHistoryModal";
import { SavedEmailsHistoryTab } from "./components/SavedEmailsHistoryTab";
import { AlgTmcApprovalPanel } from "./components/AlgTmcApprovalPanel";

export default function App() {
  // 1. Data & Parsing State
  const [currentCsvText, setCurrentCsvText] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [customMapping, setCustomMapping] = useState<ColumnMapping | null>(null);

  // 2. Selection & View Tab State
  const [activeTab, setActiveTab] = useState<"generator" | "history">("generator");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTechName, setSelectedTechName] = useState<string>("");
  const [savedEmailsCount, setSavedEmailsCount] = useState<number>(0);

  // 3. Settings & Styling State
  const [branding, setBranding] = useState<TemplateBranding>(DEFAULT_BRANDING);
  const [currentStyle, setCurrentStyle] = useState<TemplateStyle>("exact_nds_template");
  const [algTmcApprovalEnabled, setAlgTmcApprovalEnabled] = useState<boolean>(false);

  // 4. Modals State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // 5. Audit & Dispatch Logs
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogRecord[]>([]);

  // Update saved emails count on mount and storage change
  const refreshSavedCount = () => {
    try {
      const records = getStoredGeneratedEmails();
      setSavedEmailsCount(records.length);
    } catch {
      setSavedEmailsCount(0);
    }
  };

  useEffect(() => {
    refreshSavedCount();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY_EMAILS) {
        refreshSavedCount();
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const loadSampleDataset = (sample: SampleDataset) => {
    setCurrentCsvText(sample.csvContent);
    setCurrentFileName(sample.name);
    const parsed = parseCsvData(sample.csvContent, customMapping || undefined);
    setParseResult(parsed);

    if (parsed.incomingWorkWeek) {
      setSelectedDate(parsed.incomingWorkWeek.sundayDateStr);
    } else if (parsed.detectedDates.length > 0) {
      setSelectedDate(parsed.detectedDates[0]);
    }
    if (parsed.technicians.length > 0) {
      setSelectedTechName(parsed.technicians[0]);
    }
  };

  const handleFileUpload = (text: string, fileName: string) => {
    setCurrentCsvText(text);
    setCurrentFileName(fileName);
    const parsed = parseCsvData(text, customMapping || undefined);
    setParseResult(parsed);

    if (parsed.incomingWorkWeek) {
      setSelectedDate(parsed.incomingWorkWeek.sundayDateStr);
    } else if (parsed.detectedDates.length > 0) {
      setSelectedDate(parsed.detectedDates[0]);
    }
    if (parsed.technicians.length > 0) {
      setSelectedTechName(parsed.technicians[0]);
    }
  };

  const handleSaveMapping = (newMapping: ColumnMapping) => {
    setCustomMapping(newMapping);
    if (currentCsvText) {
      const parsed = parseCsvData(currentCsvText, newMapping);
      setParseResult(parsed);
      if (parsed.incomingWorkWeek) {
        setSelectedDate(parsed.incomingWorkWeek.sundayDateStr);
      } else if (parsed.detectedDates.length > 0 && !parsed.detectedDates.includes(selectedDate)) {
        setSelectedDate(parsed.detectedDates[0]);
      }
      if (parsed.technicians.length > 0 && !parsed.technicians.includes(selectedTechName)) {
        setSelectedTechName(parsed.technicians[0]);
      }
    }
  };

  // Build rosters grouped by technician across all orders for the current file
  const rosters: TechnicianRoster[] = useMemo(() => {
    if (!parseResult || parseResult.orders.length === 0) return [];

    const techMap = new Map<string, WorkOrder[]>();

    parseResult.orders.forEach((ord) => {
      const tech = ord.technicianName || "Unassigned Tech";
      if (!techMap.has(tech)) {
        techMap.set(tech, []);
      }
      techMap.get(tech)!.push(ord);
    });

    const result: TechnicianRoster[] = [];

    techMap.forEach((orders, techName) => {
      const email = orders[0]?.technicianEmail || `${techName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@ndsdata.com`;
      const urgentCount = orders.filter((o) => o.priority === "Urgent").length;
      const highCount = orders.filter((o) => o.priority === "High").length;
      const normalCount = orders.filter((o) => o.priority === "Normal" || o.priority === "Low").length;
      const totalMinutes = orders.reduce((acc, o) => acc + (o.estimatedDurationMin || 60), 0);

      result.push({
        technicianName: techName,
        technicianEmail: email,
        date: selectedDate || new Date().toISOString().split("T")[0],
        orders,
        totalEstimatedMinutes: totalMinutes,
        urgentCount,
        highCount,
        normalCount,
      });
    });

    return result;
  }, [parseResult, selectedDate]);

  const activeRoster = useMemo(() => {
    return rosters.find((r) => r.technicianName === selectedTechName) || rosters[0] || null;
  }, [rosters, selectedTechName]);

  const handleRecordDispatch = (method: any, status: any) => {
    if (!activeRoster) return;
    const newLog: DispatchLogRecord = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      technicianName: activeRoster.technicianName,
      technicianEmail: activeRoster.technicianEmail,
      date: activeRoster.date,
      jobCount: activeRoster.orders.length,
      status: status || "Delivered",
      method: method || "Outlook EML",
      previewSubject: `${activeRoster.technicianName} | Install Schedule`,
      notes: `Manual dispatch via ${method}`,
    };
    setDispatchLogs((prev) => [newLog, ...prev]);
  };

  const toggleAnytime = (val: boolean) => {
    setBranding((prev) => ({ ...prev, useAnytimeTeardowns: val }));
  };

  const toggleLadotd = (val: boolean) => {
    setBranding((prev) => ({ ...prev, ladotdExclusive: val }));
  };

  const toggleCodExclusive = (val: boolean) => {
    setBranding((prev) => ({ ...prev, codExclusive: val }));
  };

  const toggleEmailUpdates = (val: boolean) => {
    setBranding((prev) => ({ ...prev, emailUpdatesEnabled: val }));
  };

  const updateEmailUpdateDetails = (version: number | string, notes: string) => {
    setBranding((prev) => ({ ...prev, updateVersion: version, updateNotes: notes }));
  };

  const toggleAdditionalNotes = (val: boolean) => {
    setBranding((prev) => ({ ...prev, additionalNotesEnabled: val }));
  };

  const updateAdditionalNotes = (notes: Array<{ id: string; day: string; text: string }>) => {
    setBranding((prev) => ({ ...prev, additionalNotes: notes }));
  };

  const toggleSundaySunday = (val: boolean) => {
    setBranding((prev) => ({ ...prev, sundaySundayEnabled: val }));
  };

  const toggleOverlappingSchedules = (val: boolean) => {
    setBranding((prev) => ({ ...prev, overlappingSchedulesEnabled: val }));
  };

  const toggleConductStudy = (val: boolean) => {
    setBranding((prev) => ({ ...prev, conductStudyEnabled: val }));
  };

  const updatePedsConductLines = (lines: any[]) => {
    setBranding((prev) => ({ ...prev, pedsConductLines: lines }));
  };

  const updateDayItemOrderOverrides = (overrides: Record<string, string[]>) => {
    setBranding((prev) => ({ ...prev, dayItemOrderOverrides: overrides }));
  };

  const updateBranding = (partial: Partial<TemplateBranding>) => {
    setBranding((prev) => ({ ...prev, ...partial }));
  };

  const handleClearAll = () => {
    setCurrentCsvText("");
    setCurrentFileName("");
    setParseResult(null);
    setSelectedDate("");
    setSelectedTechName("");
    setBranding(DEFAULT_BRANDING);
  };

  const handleSelectTechFromHistory = (techName: string) => {
    // Find matching technician in loaded rosters if possible
    const match = rosters.find(
      (r) => cleanTechnicianName(r.technicianName).toLowerCase() === cleanTechnicianName(techName).toLowerCase()
    );
    if (match) {
      setSelectedTechName(match.technicianName);
    }
    setActiveTab("generator");
  };

  const handleLoadSavedEmailIntoGenerator = (record: GeneratedEmailRecord) => {
    // If the technician exists in the current roster, select them
    const match = rosters.find(
      (r) => cleanTechnicianName(r.technicianName).toLowerCase() === cleanTechnicianName(record.cleanTechName).toLowerCase()
    );
    if (match) {
      setSelectedTechName(match.technicianName);
    }

    // Apply saved branding configurations and notes
    if (record.brandingConfig) {
      setBranding((prev) => ({
        ...prev,
        ...record.brandingConfig,
        additionalNotes: record.additionalNotes || prev.additionalNotes,
        updateNotes: record.notes || record.brandingConfig?.updateNotes || "",
      }));
    } else if (record.additionalNotes) {
      setBranding((prev) => ({
        ...prev,
        additionalNotes: record.additionalNotes || [],
        additionalNotesEnabled: (record.additionalNotes && record.additionalNotes.length > 0) || false,
        updateNotes: record.notes || "",
      }));
    }

    setActiveTab("generator");
  };

  return (
    <div className="min-h-screen bg-zinc-50/70 text-zinc-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Main Navigation */}
      <Navbar
        onLoadSample={loadSampleDataset}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        activeDatasetName={currentFileName}
        totalOrdersCount={parseResult?.orders.length || 0}
        techniciansCount={rosters.length}
      />

      {/* Main App Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* CSV Dropzone / Upload Bar */}
        <CsvUploadZone
          onFileUpload={handleFileUpload}
          onLoadSample={loadSampleDataset}
          parseResult={parseResult}
          currentFileName={currentFileName}
          onOpenMappingModal={() => setIsMappingModalOpen(true)}
          onClearFile={handleClearAll}
        />

        {/* ALG/TMC Approval Toggle Switch & Subpanel */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 sm:p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                  algTmcApprovalEnabled
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-zinc-900">
                    ALG/TMC Approval
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.2 rounded-full border transition ${
                      algTmcApprovalEnabled
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-zinc-100 text-zinc-500 border-zinc-200"
                    }`}
                  >
                    {algTmcApprovalEnabled ? "Enabled" : "Optional PDF Scanner"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-zinc-500 mt-0.5">
                  Scan up to 2 project PDF approvals (Page 1) to auto-generate Nina/Marisa approval emails.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={algTmcApprovalEnabled}
              onClick={() => setAlgTmcApprovalEnabled(!algTmcApprovalEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                algTmcApprovalEnabled ? "bg-indigo-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  algTmcApprovalEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Conditional PDF Upload & Email Preview Component */}
          {algTmcApprovalEnabled && (
            <div className="mt-4 pt-4 border-t border-zinc-100">
              <AlgTmcApprovalPanel />
            </div>
          )}
        </div>

        {/* View Mode Navigation Tabs: Generator vs Saved History */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-0">
          <div className="flex items-center space-x-2 -mb-px">
            {/* Tab 1: Email Generator */}
            <button
              type="button"
              onClick={() => setActiveTab("generator")}
              className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                activeTab === "generator"
                  ? "border-zinc-900 text-zinc-900 bg-white rounded-t-lg shadow-2xs"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
              }`}
            >
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Email Generator &amp; Preview</span>
              {rosters.length > 0 && (
                <span className="bg-zinc-100 text-zinc-700 text-[10px] font-semibold px-1.5 py-0.2 rounded-full border border-zinc-200">
                  {rosters.length} Techs
                </span>
              )}
            </button>

            {/* Tab 2: Saved History Directory */}
            <button
              type="button"
              onClick={() => {
                refreshSavedCount();
                setActiveTab("history");
              }}
              className={`flex items-center space-x-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
                activeTab === "history"
                  ? "border-yellow-500 text-zinc-950 bg-white rounded-t-lg shadow-2xs"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
              }`}
            >
              <History className="w-4 h-4 text-yellow-600" />
              <span>Saved Emails History</span>
              {savedEmailsCount > 0 && (
                <span className="bg-yellow-400 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
                  {savedEmailsCount}
                </span>
              )}
            </button>
          </div>

          {/* Quick Selectors (Technician & Work Week when multiple scanned) */}
          {activeTab === "generator" && (
            <div className="hidden sm:flex items-center space-x-3 text-xs pb-1.5">
              {parseResult?.detectedWorkWeeks && parseResult.detectedWorkWeeks.length > 1 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Work Week:</span>
                  </span>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-indigo-50/80 border border-indigo-200 text-indigo-950 font-bold rounded-lg px-2 py-1 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600 shadow-2xs cursor-pointer"
                  >
                    {parseResult.detectedWorkWeeks.map((ww) => (
                      <option key={ww.sundayDateStr} value={ww.sundayDateStr}>
                        {ww.isIncoming ? "👉 [Incoming] " : "[Past/Current] "}
                        {ww.workWeekLabel}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {rosters.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-zinc-500 font-medium flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Technician:</span>
                  </span>
                  <select
                    value={selectedTechName}
                    onChange={(e) => setSelectedTechName(e.target.value)}
                    className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 shadow-2xs cursor-pointer"
                  >
                    {rosters.map((r) => (
                      <option key={r.technicianName} value={r.technicianName}>
                        {r.technicianName} ({r.orders.length} stops)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Content Display */}
        {activeTab === "generator" ? (
          <>
            {/* Mobile Selectors */}
            {((parseResult?.detectedWorkWeeks && parseResult.detectedWorkWeeks.length > 1) || rosters.length > 0) && (
              <div className="flex sm:hidden flex-col gap-2 bg-white border border-zinc-200 rounded-lg p-2.5 text-xs">
                {parseResult?.detectedWorkWeeks && parseResult.detectedWorkWeeks.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-700 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Work Week:</span>
                    </span>
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-indigo-50 border border-indigo-300 rounded-lg px-2 py-1 text-xs font-bold text-indigo-950"
                    >
                      {parseResult.detectedWorkWeeks.map((ww) => (
                        <option key={ww.sundayDateStr} value={ww.sundayDateStr}>
                          {ww.isIncoming ? "👉 Incoming: " : ""}
                          {ww.workWeekLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {rosters.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-700">Active Technician:</span>
                    <select
                      value={selectedTechName}
                      onChange={(e) => setSelectedTechName(e.target.value)}
                      className="bg-zinc-50 border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-900"
                    >
                      {rosters.map((r) => (
                        <option key={r.technicianName} value={r.technicianName}>
                          {r.technicianName} ({r.orders.length} stops)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Outlook Email Preview & Generator */}
            {activeRoster ? (
              <OutlookEmailPreview
                roster={activeRoster}
                branding={branding}
                currentStyle={currentStyle}
                onRecordDispatch={handleRecordDispatch}
                onToggleAnytime={toggleAnytime}
                onToggleLadotd={toggleLadotd}
                onToggleCodExclusive={toggleCodExclusive}
                onToggleEmailUpdates={toggleEmailUpdates}
                onUpdateEmailUpdateDetails={updateEmailUpdateDetails}
                onToggleAdditionalNotes={toggleAdditionalNotes}
                onUpdateAdditionalNotes={updateAdditionalNotes}
                onToggleSundaySunday={toggleSundaySunday}
                onToggleOverlappingSchedules={toggleOverlappingSchedules}
                onToggleConductStudy={toggleConductStudy}
                onUpdatePedsConductLines={updatePedsConductLines}
                onUpdateDayItemOrderOverrides={updateDayItemOrderOverrides}
                onUpdateBranding={updateBranding}
                onClearPreview={handleClearAll}
              />
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
                <Mail className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-zinc-900 mb-1">No technician schedule loaded</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Upload a CSV file or load a sample dataset above to generate Outlook email schedules.
                </p>
              </div>
            )}
          </>
        ) : (
          /* Saved History Tab View */
          <SavedEmailsHistoryTab
            activeTechName={activeRoster?.technicianName}
            onSelectTechInGenerator={handleSelectTechFromHistory}
            onLoadSavedEmailIntoGenerator={handleLoadSavedEmailIntoGenerator}
          />
        )}
      </main>

      {/* Column Mapping Modal */}
      {parseResult && (
        <ColumnMappingModal
          isOpen={isMappingModalOpen}
          onClose={() => setIsMappingModalOpen(false)}
          headers={parseResult.headers}
          currentMapping={parseResult.mapping}
          sampleRows={parseResult.rawRows}
          onSaveMapping={handleSaveMapping}
        />
      )}

      {/* Settings & Branding Modal */}
      <SettingsBrandingModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        branding={branding}
        onSaveBranding={(newB) => setBranding(newB)}
      />

      {/* Dispatch History Audit Modal */}
      <DispatchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        logs={dispatchLogs}
        onClearLogs={() => setDispatchLogs([])}
      />
    </div>
  );
}
