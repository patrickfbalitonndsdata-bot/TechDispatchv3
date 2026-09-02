import React, { useState } from "react";
import { X, Settings, Building, Phone, Mail, Palette, CheckSquare, ShieldCheck, Check, Users, ExternalLink, Search } from "lucide-react";
import { TemplateBranding } from "../types";
import { HARDCODED_TECHNICIAN_ROSTER } from "../utils/technicianRosterDirectory";

interface SettingsBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: TemplateBranding;
  onSaveBranding: (newBranding: TemplateBranding) => void;
}

export const SettingsBrandingModal: React.FC<SettingsBrandingModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSaveBranding,
}) => {
  const [form, setForm] = useState<TemplateBranding>({ ...branding });

  if (!isOpen) return null;

  const handleChange = (key: keyof TemplateBranding, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    onSaveBranding(form);
    onClose();
  };

  const COLOR_PRESETS = [
    { name: "Outlook Blue", hex: "#0078D4" },
    { name: "Classic Navy", hex: "#0F172A" },
    { name: "Emerald", hex: "#0F766E" },
    { name: "Amber Orange", hex: "#D97706" },
    { name: "Crimson", hex: "#DC2626" },
  ];

  const [rosterSearch, setRosterSearch] = useState("");

  const filteredRoster = HARDCODED_TECHNICIAN_ROSTER.filter(
    (t) =>
      t.name.toLowerCase().includes(rosterSearch.toLowerCase()) ||
      t.aliases.some((a) => a.toLowerCase().includes(rosterSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-300 flex items-center justify-center border border-zinc-700">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Outlook Template &amp; Dispatcher Settings</h2>
              <p className="text-xs text-zinc-400">Configure company branding, dispatcher signature, and safety options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Section: Organization & Dispatcher Info */}
          <div className="space-y-3">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Building className="w-3.5 h-3.5 text-zinc-600" />
              <span>Company &amp; Dispatcher Signature</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-zinc-700 block mb-1">Company / Organization Name</label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => handleChange("companyName", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Dispatcher / Sender Name</label>
                <input
                  type="text"
                  value={form.dispatcherName}
                  onChange={(e) => handleChange("dispatcherName", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Reply-To Email Address</label>
                <input
                  type="email"
                  value={form.replyToEmail}
                  onChange={(e) => handleChange("replyToEmail", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Dispatch Support Phone</label>
                <input
                  type="text"
                  value={form.supportPhone}
                  onChange={(e) => handleChange("supportPhone", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Section: External Links & Upload Channels (for Exact Schedule Template) */}
          <div className="space-y-3 pt-3 border-t border-zinc-200">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Mail className="w-3.5 h-3.5 text-zinc-600" />
              <span>Airtable, Maps &amp; Field Photo Links</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-zinc-700 block mb-1">Airtable View Base URL</label>
                <input
                  type="text"
                  placeholder="https://airtable.com/appYourAirtableBase"
                  value={form.airtableBaseUrl || ""}
                  onChange={(e) => handleChange("airtableBaseUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Google Maps Routing URL</label>
                <input
                  type="text"
                  placeholder="https://maps.google.com"
                  value={form.googleMapsBaseUrl || ""}
                  onChange={(e) => handleChange("googleMapsBaseUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Photo Upload URL</label>
                <input
                  type="text"
                  placeholder="https://airtable.com/appsVo4SWcGXTkarK/shrBgw2x5NJZwU3Xo"
                  value={form.photoUploadUrl || ""}
                  onChange={(e) => handleChange("photoUploadUrl", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="font-medium text-zinc-700 block mb-1">Photo Upload Link Text</label>
                <input
                  type="text"
                  placeholder="South Central Job Photos"
                  value={form.photoUploadLinkText || ""}
                  onChange={(e) => handleChange("photoUploadLinkText", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-medium text-zinc-700 block mb-1">Data Transfer Upload Email (FileZilla / Reports)</label>
                <input
                  type="email"
                  placeholder="jobs@ndsdata.com"
                  value={form.dataUploadEmail || ""}
                  onChange={(e) => handleChange("dataUploadEmail", e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Section: Outlook Accent Styling */}
          <div className="space-y-3 pt-3 border-t border-zinc-200">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Palette className="w-3.5 h-3.5 text-zinc-600" />
              <span>Theme &amp; Brand Accent Colors</span>
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => handleChange("primaryColor", color.hex)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    form.primaryColor === color.hex
                      ? "border-zinc-900 bg-zinc-900 text-white font-semibold"
                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color.hex }}></span>
                  <span>{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Email Content Features */}
          <div className="space-y-3 pt-3 border-t border-zinc-200">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <CheckSquare className="w-3.5 h-3.5 text-zinc-600" />
              <span>Email Content Controls</span>
            </h3>

            <div className="space-y-2.5">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includeMapLinks}
                  onChange={(e) => handleChange("includeMapLinks", e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-zinc-800">Include Google Maps GPS links for all service addresses</span>
              </label>

              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includeChecklist}
                  onChange={(e) => handleChange("includeChecklist", e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="font-medium text-zinc-800">Attach Pre-Shift Field &amp; Vehicle Safety Checklist in footer</span>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!form.useAnytimeTeardowns}
                  onChange={(e) => handleChange("useAnytimeTeardowns", e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 block">(Anytime) Teardown Scheduling Mode</span>
                  <span className="text-[11px] text-zinc-500 block">
                    When enabled, only teardowns with 0:30 time are scheduled on their exact Teardown After date and labeled as &ldquo;Anytime&rdquo; (at the top of the day&apos;s teardowns). Other teardowns (such as 14:00, 19:00) keep their specific time notes. When disabled, 0:30 midnight teardowns are automatically scheduled on the previous day.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!form.ladotdExclusive}
                  onChange={(e) => handleChange("ladotdExclusive", e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 block">LADOTD Exclusive Mode</span>
                  <span className="text-[11px] text-zinc-500 block">
                    When enabled, for project number 26-240026 formats lines as &ldquo;Install: ALG 26-240026 Volume &lt;Parish&gt; (Camera Counts) (Work Week 32) &lt;No. Days&gt; collection&rdquo; with 3-4 digit location suffixes (e.g. • 5666 1 camera). Parish is scanned from &ldquo;Different County (from Locations)&rdquo; and collection duration is scanned from &ldquo;Schedule Details&rdquo;.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!form.codExclusive}
                  onChange={(e) => handleChange("codExclusive", e.target.checked)}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 mt-0.5"
                />
                <div className="flex-1">
                  <span className="font-medium text-zinc-900 flex items-center space-x-1.5">
                    <span>City of Dallas (COD Exclusive) Mode</span>
                    <span className="text-[9px] bg-teal-100 text-teal-900 font-bold px-1.5 py-0.2 rounded border border-teal-300">
                      COD Exclusive
                    </span>
                  </span>
                  <span className="text-[11px] text-zinc-500 block mt-0.5">
                    When enabled, provides modal selection for Conduct Sight Distance teardown lines on Peds studies with City of Dallas List notes, and includes the School Zone PED Count Site Data Form header link.
                  </span>

                  {form.codExclusive && (
                    <div className="mt-2.5 p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.codSchoolZonePedFormEnabled !== false}
                          onChange={(e) => handleChange("codSchoolZonePedFormEnabled", e.target.checked)}
                          className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <span className="text-xs font-semibold text-purple-950">
                          Include &ldquo;📝 School Zone PED Count Site Data Form&rdquo; link in Header Links
                        </span>
                      </label>

                      {form.codSchoolZonePedFormEnabled !== false && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-700 block mb-0.5">Link Text</label>
                            <input
                              type="text"
                              value={form.codSchoolZonePedFormText || "School Zone PED Count Site Data Form"}
                              onChange={(e) => handleChange("codSchoolZonePedFormText", e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-700 block mb-0.5">Google Form URL</label>
                            <input
                              type="url"
                              value={form.codSchoolZonePedFormUrl || "https://docs.google.com/forms/d/e/1FAIpQLSdfpvqvsfjC8gA8gKoByJdu1CQafOhvTP_gWMQvItjEvcprMg/viewform"}
                              onChange={(e) => handleChange("codSchoolZonePedFormUrl", e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs font-mono text-zinc-800"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!form.additionalNotesEnabled}
                  onChange={(e) => handleChange("additionalNotesEnabled", e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 block">Additional Notes Feature</span>
                  <span className="text-[11px] text-zinc-500 block">
                    When enabled, provides day-specific custom notes placed before the task lines, highlighted with a bright green background and styled in black bold italic text.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={!!form.sundaySundayEnabled}
                  onChange={(e) => handleChange("sundaySundayEnabled", e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 mt-0.5"
                />
                <div>
                  <span className="font-medium text-zinc-900 block">Sunday - Sunday 8-Day Schedule Mode</span>
                  <span className="text-[11px] text-zinc-500 block">
                    When enabled, extends the weekly schedule view to Sunday through Sunday, adding a second Sunday after Saturday with dates for both the Upper Sunday and Lower Sunday (e.g., Sunday 08/23/2026 to Sunday 08/30/2026).
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Section: Technician Airtable Links Directory */}
          <div className="space-y-3 pt-3 border-t border-zinc-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <Users className="w-3.5 h-3.5 text-zinc-600" />
                <span>Hardcoded Technician Airtable Links ({HARDCODED_TECHNICIAN_ROSTER.length})</span>
              </h3>
              <div className="relative w-44">
                <Search className="w-3 h-3 text-zinc-400 absolute left-2 top-2" />
                <input
                  type="text"
                  placeholder="Filter roster..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 bg-zinc-50 border border-zinc-300 rounded-md text-[11px] focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
                />
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">
              When an email is generated for any scanned technician matching the roster below, their specific Airtable link is automatically embedded into the greeting header link.
            </p>

            <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded-lg bg-zinc-50/50 divide-y divide-zinc-200">
              {filteredRoster.map((item) => (
                <div key={item.name} className="p-2 flex items-center justify-between gap-2 hover:bg-white transition text-[11px]">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-zinc-900">{item.name}</span>
                    <span className="text-zinc-400 ml-2 font-mono text-[10px] truncate block">{item.airtableLink}</span>
                  </div>
                  <a
                    href={item.airtableLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded border border-blue-200 text-[10px] font-medium"
                  >
                    <span>Test</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Safety Disclaimer */}
          <div className="space-y-2 pt-3 border-t border-zinc-200">
            <label className="font-medium text-zinc-700 block">Custom Field Safety Disclaimer / Notice</label>
            <textarea
              rows={2}
              value={form.customDisclaimer}
              onChange={(e) => handleChange("customDisclaimer", e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 text-xs"
            />
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
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
