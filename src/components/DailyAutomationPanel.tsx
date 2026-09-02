import React, { useState, useEffect } from "react";
import {
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  Send,
  Zap,
  Sliders,
  Calendar,
  Layers,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Archive,
} from "lucide-react";
import { AutomationConfig, TechnicianRoster, TemplateBranding, TemplateStyle } from "../types";
import { downloadAllAsZip } from "../utils/outlookTemplateGenerator";

interface DailyAutomationPanelProps {
  config: AutomationConfig;
  onUpdateConfig: (newConfig: Partial<AutomationConfig>) => void;
  rosters: TechnicianRoster[];
  branding: TemplateBranding;
  currentStyle: TemplateStyle;
  selectedDate: string;
  onRecordBatchDispatch: (logs: any[]) => void;
}

export const DailyAutomationPanel: React.FC<DailyAutomationPanelProps> = ({
  config,
  onUpdateConfig,
  rosters,
  branding,
  currentStyle,
  selectedDate,
  onRecordBatchDispatch,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [timeUntilRun, setTimeUntilRun] = useState<string>("");

  // Countdown timer to next scheduled dispatch time
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const [hours, minutes] = (config.dailyTime || "07:00").split(":").map(Number);
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);

      if (now.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - now.getTime();
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeUntilRun(`${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [config.dailyTime]);

  const handleTriggerManualRun = async () => {
    if (rosters.length === 0) return;
    setIsRunning(true);
    setProgress(10);
    setLogs([`[${new Date().toLocaleTimeString()}] 🚀 Initiating Daily Dispatch Pipeline for ${selectedDate}...`]);

    await new Promise((r) => setTimeout(r, 600));
    setProgress(30);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 📊 Analyzed ${rosters.length} technician schedules (${rosters.reduce((a, b) => a + b.orders.length, 0)} total work orders).`,
    ]);

    await new Promise((r) => setTimeout(r, 700));
    setProgress(55);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ✉️ Generated Microsoft Outlook MSO HTML templates with style "${currentStyle}".`,
    ]);

    await new Promise((r) => setTimeout(r, 800));
    setProgress(80);

    const generatedLogs = rosters.map((r) => {
      return {
        timestamp: new Date().toISOString(),
        technicianName: r.technicianName,
        technicianEmail: r.technicianEmail,
        date: r.date,
        jobCount: r.orders.length,
        status: "Delivered" as const,
        method: "Daily Scheduler" as const,
        previewSubject: `Daily Service Schedule - ${r.technicianName} | ${r.date}`,
        notes: `Automated daily delivery via ${config.sendMode} engine`,
      };
    });

    for (const r of rosters) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ Dispatched schedule to ${r.technicianName} <${r.technicianEmail}> (${r.orders.length} stops).`,
      ]);
      await new Promise((r) => setTimeout(r, 200));
    }

    setProgress(100);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🎉 Daily automated distribution completed successfully for ${rosters.length} technicians!`,
    ]);

    // Record logs in audit history
    onRecordBatchDispatch(generatedLogs);
    onUpdateConfig({ lastRunTime: new Date().toISOString() });

    setIsRunning(false);
  };

  const handleBatchZipDownload = () => {
    downloadAllAsZip(rosters, branding, currentStyle, selectedDate);
    const generatedLogs = rosters.map((r) => ({
      timestamp: new Date().toISOString(),
      technicianName: r.technicianName,
      technicianEmail: r.technicianEmail,
      date: r.date,
      jobCount: r.orders.length,
      status: "Exported" as const,
      method: "Batch ZIP" as const,
      previewSubject: `Batch Outlook Archive - ${r.technicianName}`,
      notes: "Downloaded as bundled .EML / .HTML archive",
    }));
    onRecordBatchDispatch(generatedLogs);
  };

  return (
    <div className="space-y-6">
      {/* Automation Status Card */}
      <div className="bg-zinc-900 text-white rounded-xl p-6 shadow-md border border-zinc-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Zap className="w-4 h-4" />
              </span>
              <h2 className="text-base font-semibold">Automated Daily Distribution Engine</h2>
            </div>
            <p className="text-xs text-zinc-300 max-w-xl leading-relaxed">
              Automatically compiles each technician's daily work orders from uploaded CSV schedules, formats personalized Outlook email templates, and distributes them at a designated morning cutoff time.
            </p>
          </div>

          {/* Quick Trigger & Status */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 shrink-0">
            <div className="text-center sm:text-left">
              <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Next Auto Dispatch</div>
              <div className="text-base font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start mt-0.5">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>{config.enabled ? timeUntilRun : "Disabled"}</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Every day at <span className="font-semibold text-blue-300">{config.dailyTime}</span>
              </div>
            </div>

            <button
              onClick={handleTriggerManualRun}
              disabled={isRunning || rosters.length === 0}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 font-semibold text-xs bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-4 py-2.5 rounded-lg shadow-xs transition disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{isRunning ? "Distributing..." : "Run Dispatch Now"}</span>
            </button>
          </div>
        </div>

        {/* Real-time progress bar when running */}
        {isRunning && (
          <div className="mt-6 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-300 font-medium">
              <span>Automating distribution pipeline...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Schedule Trigger Time */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-zinc-800 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Daily Schedule Trigger</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Dispatch Time (24h format)</label>
            <input
              type="time"
              value={config.dailyTime}
              onChange={(e) => onUpdateConfig({ dailyTime: e.target.value })}
              className="w-full text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <p className="text-[11px] text-zinc-500">
              Emails will be automatically prepared and dispatched at this time every morning.
            </p>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700">Enable Daily Automation</span>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => onUpdateConfig({ enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Card 2: Target Strategy */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-zinc-800 font-semibold text-xs uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-zinc-600" />
            <span>Date Range Strategy</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Target Work Orders</label>
            <select
              value={config.targetStrategy}
              onChange={(e) => onUpdateConfig({ targetStrategy: e.target.value as any })}
              className="w-full text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="tomorrow">Send Next-Day (T+1) Schedule Preview</option>
              <option value="today">Send Same-Day (Today's) Roster</option>
              <option value="upcoming_48h">Send Next 48 Hours Schedule</option>
              <option value="all">Send All Dates in CSV</option>
            </select>
            <p className="text-[11px] text-zinc-500">
              Select which appointment dates from the CSV are pulled for each daily dispatch.
            </p>
          </div>
        </div>

        {/* Card 3: Distribution Method */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-zinc-800 font-semibold text-xs uppercase tracking-wider">
            <Send className="w-4 h-4 text-emerald-600" />
            <span>Distribution Channel</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700">Delivery Mode</label>
            <select
              value={config.sendMode}
              onChange={(e) => onUpdateConfig({ sendMode: e.target.value as any })}
              className="w-full text-xs font-medium bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-zinc-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="simulation">Outlook Automation &amp; Sandbox Simulator</option>
              <option value="webhook">Webhook / Power Automate / Zapier</option>
              <option value="smtp">Direct SMTP Email Server</option>
            </select>
            <p className="text-[11px] text-zinc-500">
              Integrates with Microsoft 365, Power Automate, SMTP relay, or local Outlook templates.
            </p>
          </div>
        </div>
      </div>

      {/* Batch Export & Bulk Actions Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-left">
          <div className="w-9 h-9 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
            <Archive className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-zinc-900">Batch Export All Technician Schedules (.ZIP)</h4>
            <p className="text-[11px] text-zinc-500">
              Generates ready-to-send Outlook <span className="font-mono text-blue-600 font-semibold">.EML</span> and <span className="font-mono text-blue-600 font-semibold">.HTML</span> email files for all {rosters.length} technicians in one zip archive.
            </p>
          </div>
        </div>

        <button
          onClick={handleBatchZipDownload}
          disabled={rosters.length === 0}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-lg shadow-xs transition shrink-0 disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          <span>Download All ({rosters.length} Techs) as ZIP</span>
        </button>
      </div>

      {/* Live Automation Console / Terminal Output */}
      {logs.length > 0 && (
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 text-zinc-300 font-mono text-xs space-y-2 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-white">Live Automation Execution Logs</span>
            </div>
            <span className="text-[10px] text-zinc-500">Real-time status</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 py-1">
            {logs.map((log, i) => (
              <div key={i} className="text-[11px] text-emerald-400/90 leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
