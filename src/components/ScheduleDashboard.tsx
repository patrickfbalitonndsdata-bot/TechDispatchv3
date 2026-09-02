import React from "react";
import { Users, Clock, AlertCircle, Calendar, MapPin, Phone, Wrench, ShieldAlert, CheckCircle2, ChevronRight, Sparkles, ExternalLink } from "lucide-react";
import { TechnicianRoster, WorkOrder, TemplateBranding } from "../types";
import { getPriorityColors, formatMinutes } from "../utils/outlookTemplateGenerator";
import { getTechnicianAirtableLink } from "../utils/technicianRosterDirectory";

interface ScheduleDashboardProps {
  rosters: TechnicianRoster[];
  selectedTechName: string;
  onSelectTech: (name: string) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  availableDates: string[];
  branding: TemplateBranding;
  onTriggerAiBriefing: (techName: string) => void;
  isAiGenerating: boolean;
}

export const ScheduleDashboard: React.FC<ScheduleDashboardProps> = ({
  rosters,
  selectedTechName,
  onSelectTech,
  selectedDate,
  onSelectDate,
  availableDates = [],
  branding,
  onTriggerAiBriefing,
  isAiGenerating,
}) => {
  const currentRoster = rosters.find((r) => r.technicianName === selectedTechName) || rosters[0];

  // Aggregate Metrics across all technicians for selected date
  const totalJobs = rosters.reduce((acc, r) => acc + r.orders.length, 0);
  const totalUrgent = rosters.reduce((acc, r) => acc + r.urgentCount, 0);
  const totalMinutes = rosters.reduce((acc, r) => acc + r.totalEstimatedMinutes, 0);

  if (rosters.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-zinc-500 shadow-xs">
        <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-zinc-800">No Technician Schedules Available</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
          Upload a CSV file or load a sample dataset above to view and generate Outlook schedule emails.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Technicians</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">{rosters.length}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Active field rosters</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Stops</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">{totalJobs}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Scheduled appointments</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Urgent Jobs</span>
            <div className={`w-7 h-7 rounded-lg ${totalUrgent > 0 ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-400"} flex items-center justify-center`}>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-2xl font-bold mt-2 ${totalUrgent > 0 ? "text-red-600" : "text-zinc-900"}`}>
            {totalUrgent}
          </div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Priority &amp; emergency</div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Total Work Time</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-zinc-900 mt-2">{formatMinutes(totalMinutes)}</div>
          <div className="text-[11px] text-zinc-400 mt-0.5">Estimated on-site hours</div>
        </div>
      </div>

      {/* Date and Technician Selector Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-xs sm:max-w-md py-1">
              {availableDates.map((date) => (
                <button
                  key={date}
                  onClick={() => onSelectDate(date)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md transition ${
                    selectedDate === date
                      ? "bg-zinc-900 text-white shadow-xs"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Viewing: <span className="font-semibold text-blue-600">{currentRoster?.technicianName}</span> ({currentRoster?.orders.length} stops)
          </div>
        </div>

        {/* Technician Tabs Pill Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {rosters.map((roster) => {
            const isSelected = roster.technicianName === selectedTechName;
            return (
              <button
                key={roster.technicianName}
                onClick={() => onSelectTech(roster.technicianName)}
                className={`flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
                  isSelected
                    ? "bg-blue-50/70 border-blue-300 text-blue-900 shadow-xs"
                    : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                  isSelected ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700"
                }`}>
                  {roster.technicianName.charAt(0)}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-xs leading-tight">{roster.technicianName}</div>
                  <div className="text-[10px] text-zinc-400 leading-tight">
                    {roster.orders.length} stops &bull; {formatMinutes(roster.totalEstimatedMinutes)}
                  </div>
                </div>
                {roster.urgentCount > 0 && (
                  <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                    {roster.urgentCount} Urgent
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Technician Schedule Details Card */}
      {currentRoster && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          {/* Header Info */}
          <div className="p-4 bg-zinc-50/70 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-zinc-900">{currentRoster.technicianName}'s Route Roster</h3>
                <span className="text-xs text-zinc-400 font-mono">({currentRoster.technicianEmail})</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {currentRoster.orders.length} stops scheduled on {currentRoster.date} &bull; Total estimated time: {formatMinutes(currentRoster.totalEstimatedMinutes)}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {/* Airtable View Button */}
              <a
                href={getTechnicianAirtableLink(currentRoster.technicianName, branding.airtableBaseUrl, branding.customTechAirtableLinks)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-white hover:bg-zinc-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg shadow-xs transition"
                title={`Open Airtable view for ${currentRoster.technicianName}`}
              >
                <span>Airtable View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {/* AI Briefing Button */}
              <button
                onClick={() => onTriggerAiBriefing(currentRoster.technicianName)}
                disabled={isAiGenerating}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-1.5 rounded-lg shadow-xs transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAiGenerating ? "Generating AI Brief..." : currentRoster.aiBriefing ? "Regenerate AI Brief" : "Generate AI Route Brief"}</span>
              </button>
            </div>
          </div>

          {/* AI Briefing Card (if generated) */}
          {currentRoster.aiBriefing && (
            <div className="p-4 bg-blue-50/40 border-b border-blue-100">
              <div className="flex items-start space-x-3">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                      AI Morning Route Briefing
                    </span>
                  </div>
                  <p className="text-xs text-zinc-700 leading-relaxed">{currentRoster.aiBriefing.briefing}</p>

                  {currentRoster.aiBriefing.safetyAlert && (
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-900 font-medium">
                      ⚠️ Safety Focus: {currentRoster.aiBriefing.safetyAlert}
                    </div>
                  )}

                  {currentRoster.aiBriefing.keyHighlights && currentRoster.aiBriefing.keyHighlights.length > 0 && (
                    <div className="text-xs text-zinc-600">
                      <div className="font-semibold text-zinc-800 text-[11px] mb-1">Key Highlights:</div>
                      <ul className="list-disc list-inside space-y-0.5 text-zinc-600">
                        {currentRoster.aiBriefing.keyHighlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Work Orders List Table */}
          <div className="divide-y divide-zinc-100 overflow-x-auto">
            {currentRoster.orders.map((order, idx) => {
              const pColors = getPriorityColors(order.priority);
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.serviceAddress)}`;

              return (
                <div key={order.id} className="p-4 hover:bg-zinc-50/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Index & Time */}
                  <div className="flex items-start space-x-3 md:w-1/4 shrink-0">
                    <div className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">{order.timeSlot}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{order.orderNumber}</div>
                      <div className="mt-1">
                        <span
                          className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: pColors.bg, color: pColors.text, border: `1px solid ${pColors.border}` }}
                        >
                          {order.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Task & Notes */}
                  <div className="md:w-2/5 space-y-1">
                    <div className="text-xs font-semibold text-zinc-800">{order.jobType}</div>
                    <p className="text-xs text-zinc-600 line-clamp-2">{order.description}</p>
                    
                    {order.requiredParts && (
                      <div className="text-[11px] text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 inline-block font-medium">
                        🔧 {order.requiredParts}
                      </div>
                    )}
                    {order.specialInstructions && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-medium ml-1">
                        📝 {order.specialInstructions}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Customer & Location */}
                  <div className="md:w-1/3 text-xs space-y-1">
                    <div className="font-semibold text-zinc-900">{order.customerName}</div>
                    <div className="text-zinc-600 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <a
                        href={mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline line-clamp-1"
                        title={order.serviceAddress}
                      >
                        {order.serviceAddress}
                      </a>
                    </div>
                    <div className="text-zinc-400 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <a href={`tel:${order.customerPhone}`} className="hover:text-zinc-900 font-mono text-zinc-600">
                        {order.customerPhone}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
