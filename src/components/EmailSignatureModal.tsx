import React, { useState, useEffect } from "react";
import { X, Check, FileSignature, RotateCcw, Building, MapPin, Globe, Sparkles } from "lucide-react";
import {
  TemplateBranding,
  EmailSignaturePresetId,
  EmailSignatureDetails,
} from "../types";
import {
  EMAIL_SIGNATURE_PRESETS,
  SIGNATURE_PRESET_OPTIONS,
  getEffectiveSignature,
  renderEmailSignatureHtml,
} from "../utils/signaturePresets";

interface EmailSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: TemplateBranding;
  onUpdateBranding?: (partial: Partial<TemplateBranding>) => void;
  onToggleEmailSignature?: (enabled: boolean) => void;
  onSelectPreset?: (preset: EmailSignaturePresetId) => void;
}

export const EmailSignatureModal: React.FC<EmailSignatureModalProps> = ({
  isOpen,
  onClose,
  branding,
  onUpdateBranding,
  onToggleEmailSignature,
  onSelectPreset,
}) => {
  const currentPresetKey = (branding.emailSignaturePreset || "patrick") as EmailSignaturePresetId;
  const isEnabled = Boolean(branding.emailSignatureEnabled);

  const [selectedPreset, setSelectedPreset] = useState<EmailSignaturePresetId>(currentPresetKey);
  const [enabled, setEnabled] = useState<boolean>(isEnabled);
  const [customFields, setCustomFields] = useState<Partial<EmailSignatureDetails>>(
    branding.customEmailSignature || {}
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useEffect(() => {
    setSelectedPreset((branding.emailSignaturePreset || "patrick") as EmailSignaturePresetId);
    setEnabled(Boolean(branding.emailSignatureEnabled));
    setCustomFields(branding.customEmailSignature || {});
  }, [branding, isOpen]);

  if (!isOpen) return null;

  const currentPresetData =
    selectedPreset in EMAIL_SIGNATURE_PRESETS
      ? EMAIL_SIGNATURE_PRESETS[selectedPreset as keyof typeof EMAIL_SIGNATURE_PRESETS]
      : EMAIL_SIGNATURE_PRESETS.patrick;

  const effectiveSig: EmailSignatureDetails = {
    ...currentPresetData,
    ...customFields,
    id: selectedPreset,
  };

  const handleSelectPreset = (presetId: "james" | "kyle" | "patrick" | "katrin") => {
    setSelectedPreset(presetId);
    setCustomFields({}); // Reset any overrides to load pure preset
    if (onSelectPreset) {
      onSelectPreset(presetId);
    }
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (onToggleEmailSignature) {
      onToggleEmailSignature(checked);
    }
  };

  const handleSave = () => {
    if (onUpdateBranding) {
      onUpdateBranding({
        emailSignatureEnabled: enabled,
        emailSignaturePreset: selectedPreset,
        customEmailSignature: Object.keys(customFields).length > 0 ? customFields : undefined,
      });
    }
    onClose();
  };

  const handleResetToDefault = () => {
    setCustomFields({});
    if (onUpdateBranding) {
      onUpdateBranding({
        customEmailSignature: undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-zinc-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-sky-300 flex items-center justify-center border border-white/20 shadow-inner">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Email Signature Settings</h2>
              <p className="text-xs text-blue-200">
                Choose sender profile and append signature to schedule emails
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Main Toggle Switch */}
          <div className="flex items-center justify-between p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${enabled ? "bg-sky-500 animate-pulse" : "bg-zinc-300"}`} />
              <div>
                <span className="font-bold text-zinc-900 text-sm block">Email Signature Toggle</span>
                <span className="text-[11px] text-zinc-600">
                  When enabled, automatically appends the signature to the bottom of the email.
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => handleToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Preset Selection Buttons */}
          <div>
            <label className="font-bold text-zinc-800 text-xs block mb-2 uppercase tracking-wider">
              Select Signature Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SIGNATURE_PRESET_OPTIONS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/90 text-blue-950 font-semibold ring-2 ring-blue-500/40 shadow-xs"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold">{preset.label}</span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 line-clamp-2 leading-tight">
                      {preset.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exact Visual Signature Preview Box (Formatted as per photo) */}
          <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Signature Live Outlook Preview (Photo Match)
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
              >
                {isEditing ? "Done Customizing" : "Edit / Customize Fields"}
              </button>
            </div>

            {/* Rendered Signature with exact colors, fonts, and sizes */}
            <div className="bg-white p-5 rounded-lg border border-zinc-200 shadow-xs">
              <div
                dangerouslySetInnerHTML={{
                  __html: renderEmailSignatureHtml(effectiveSig),
                }}
              />
            </div>
          </div>

          {/* Optional: Field Customizer */}
          {isEditing && (
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-800">Customize Signature Details</span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="flex items-center space-x-1 text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset to Preset Defaults</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Greeting</label>
                  <input
                    type="text"
                    value={effectiveSig.greeting}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, greeting: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={effectiveSig.name}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-medium text-zinc-700 block mb-1">Title / Role Line</label>
                  <input
                    type="text"
                    value={effectiveSig.title}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, title: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Company Name</label>
                  <input
                    type="text"
                    value={effectiveSig.company}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, company: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Corporate Office Address</label>
                  <input
                    type="text"
                    value={effectiveSig.address}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Website URL</label>
                  <input
                    type="text"
                    placeholder="www.ndsdata.com (optional)"
                    value={effectiveSig.website || ""}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, website: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>

                <div>
                  <label className="font-medium text-zinc-700 block mb-1">Tagline / Slogan</label>
                  <input
                    type="text"
                    value={effectiveSig.tagline}
                    onChange={(e) =>
                      setCustomFields((prev) => ({ ...prev, tagline: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded-lg text-zinc-900"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-200/60 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xs cursor-pointer flex items-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
};
