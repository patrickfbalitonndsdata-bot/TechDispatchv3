import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Monitor,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  Mail,
  Plus,
  Trash2,
  StickyNote,
  Calendar,
  X,
  BookmarkPlus,
  BookmarkCheck,
  Bookmark,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  History,
  RotateCcw,
  CheckCheck,
  Info,
  Clock,
  Send,
  Save,
  Paperclip,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Globe,
  MapPin,
  Link as LinkIcon,
  ArrowUp,
  ArrowDown,
  Compass,
  Footprints,
  MoveUp,
  MoveDown,
} from "lucide-react";
import {
  TechnicianRoster,
  TemplateBranding,
  TemplateStyle,
  EmailAttachment,
  PedsConductLineItem,
  WorkOrder,
} from "../types";
import {
  generateOutlookHtml,
  generatePlainTextEmail,
  generateEmailSubject,
  getWeekDateRange,
  formatNoteTextWithPrefix,
  downloadEmlFile,
  getOutlook365WebUrl,
  copyRichHtmlToClipboard,
  cleanTechnicianName,
  resolveStackedPreviousUpdateNotes,
  autoDetectAdditionalNotesForRoster,
  buildDayScheduleItems,
  groupNDSOrdersByDay,
  SPEED_INSTALL_NOTE,
  SPEED_TEARDOWN_NOTE,
  TMC_INSTALL_NOTE,
  LADOTD_MON_NOTE,
  LADOTD_TUE_NOTE,
  PEDS_SIGHT_DISTANCE_NOTE,
} from "../utils/outlookTemplateGenerator";
import {
  GeneratedEmailRecord,
  getStoredGeneratedEmails,
  saveStoredGeneratedEmail,
  deleteStoredGeneratedEmail,
  clearStoredGeneratedEmailsForTech,
  getGeneratedEmailsForTechAndWeek,
  getRecommendedUpdateVersion,
  getStoredPreviousUpdateNotes,
  getStoredInitialEmailLinks,
} from "../utils/generatedEmailStorage";
import { GeneratedEmailsHistoryModal } from "./GeneratedEmailsHistoryModal";
import { CodSightDistanceModal } from "./CodSightDistanceModal";
import { getTechnicianGoogleMapsLink, getTechnicianAirtableLink } from "../utils/technicianRosterDirectory";

export interface NotePreset {
  id: string;
  title: string;
  text: string;
  isBuiltIn?: boolean;
}

const DEFAULT_NOTE_PRESETS: NotePreset[] = [
  {
    id: "preset-speed-install",
    title: "⚡ SPEED - Install (Extend Poles)",
    text: SPEED_INSTALL_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-speed-teardown",
    title: "⚡ SPEED - Teardown (File Naming)",
    text: SPEED_TEARDOWN_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-tmc-install",
    title: "📍 TMC - Install (Site Approval & Backup Diagonally)",
    text: TMC_INSTALL_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-peds-sight-distance",
    title: "🚶 PEDS - Sight Distance Requirement",
    text: PEDS_SIGHT_DISTANCE_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-ladotd-mon",
    title: "LADOTD Notes (Monday)",
    text: LADOTD_MON_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-ladotd-tue",
    title: "LADOTD notes (Tuesday)",
    text: LADOTD_TUE_NOTE,
    isBuiltIn: true,
  },
  {
    id: "preset-unfinished",
    title: "Continue Unfinished",
    text: "Note: Continue installing locations not finished yesterday until all inventories have been used up.",
    isBuiltIn: true,
  },
];

const STALE_LEGACY_PRESET_IDS = new Set([
  "preset-ladder",
  "preset-depot",
  "preset-weather",
  "preset-tamper",
]);

const LOCAL_STORAGE_KEY_PRESETS = "nds_additional_notes_custom_presets_v1";

interface OutlookEmailPreviewProps {
  roster: TechnicianRoster;
  branding: TemplateBranding;
  currentStyle?: TemplateStyle;
  onRecordDispatch: (method: any, status: any) => void;
  onToggleAnytime?: (val: boolean) => void;
  onToggleLadotd?: (val: boolean) => void;
  onToggleCodExclusive?: (val: boolean) => void;
  onToggleEmailUpdates?: (val: boolean) => void;
  onUpdateEmailUpdateDetails?: (version: number | string, notes: string) => void;
  onToggleAdditionalNotes?: (val: boolean) => void;
  onUpdateAdditionalNotes?: (notes: Array<{ id: string; day: string; text: string }>) => void;
  onToggleSundaySunday?: (val: boolean) => void;
  onToggleOverlappingSchedules?: (val: boolean) => void;
  onToggleConductStudy?: (val: boolean) => void;
  onUpdatePedsConductLines?: (lines: PedsConductLineItem[]) => void;
  onUpdateDayItemOrderOverrides?: (overrides: Record<string, string[]>) => void;
  onUpdateBranding?: (newBranding: Partial<TemplateBranding>) => void;
  onClearPreview?: () => void;
}

export const OutlookEmailPreview: React.FC<OutlookEmailPreviewProps> = ({
  roster,
  branding,
  currentStyle = "exact_nds_template",
  onRecordDispatch,
  onToggleAnytime,
  onToggleLadotd,
  onToggleCodExclusive,
  onToggleEmailUpdates,
  onUpdateEmailUpdateDetails,
  onToggleAdditionalNotes,
  onUpdateAdditionalNotes,
  onToggleSundaySunday,
  onToggleOverlappingSchedules,
  onToggleConductStudy,
  onUpdatePedsConductLines,
  onUpdateDayItemOrderOverrides,
  onUpdateBranding,
  onClearPreview,
}) => {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const [selectedNoteDay, setSelectedNoteDay] = useState<string>("Monday");
  const [noteInputText, setNoteInputText] = useState<string>("");
  const [customPresets, setCustomPresets] = useState<NotePreset[]>([]);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetTitle, setNewPresetTitle] = useState("");
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Conduct Study & PEDS Conduct Sight Distance State
  const [selectedPedsDay, setSelectedPedsDay] = useState<string>("Monday");
  const [pedsProjectNumber, setPedsProjectNumber] = useState<string>("");
  const [pedsCity, setPedsCity] = useState<string>("City of Dallas");
  const [pedsListNumber, setPedsListNumber] = useState<string>("");
  const [pedsCustomText, setPedsCustomText] = useState<string>("");
  const [pedsFeedback, setPedsFeedback] = useState<string | null>(null);

  // Multi-Selection Presets State
  const [showMultiSelectModal, setShowMultiSelectModal] = useState(false);
  const [multiSelectPresetIds, setMultiSelectPresetIds] = useState<string[]>([]);
  const [multiSelectDayMap, setMultiSelectDayMap] = useState<Record<string, string>>({});
  const [multiSelectBulkDay, setMultiSelectBulkDay] = useState<string>("Monday");
  const [multiSelectSearch, setMultiSelectSearch] = useState<string>("");

  // Generated Emails History & Auto-Versioning State
  const [storedEmails, setStoredEmails] = useState<GeneratedEmailRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [autoVersionNotice, setAutoVersionNotice] = useState<{
    tech: string;
    count: number;
    suggestedVersion: number;
  } | null>(null);
  const [manualSaveSuccess, setManualSaveSuccess] = useState(false);

  // COD Sight Distance Modal State
  const [showCodSightDistanceModal, setShowCodSightDistanceModal] = useState(false);

  // Email Attachments State
  const [attachments, setAttachments] = useState<EmailAttachment[]>(branding.attachments || []);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync attachments if updated externally via branding
  useEffect(() => {
    if (branding.attachments) {
      setAttachments(branding.attachments);
    }
  }, [branding.attachments]);

  const updateAttachments = (newAttachments: EmailAttachment[]) => {
    setAttachments(newAttachments);
    if (onUpdateBranding) {
      onUpdateBranding({ attachments: newAttachments });
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const newItems: EmailAttachment[] = [];

    for (const file of fileList) {
      try {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.includes(",") ? res.split(",")[1] : res;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newItems.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          base64Data,
          lastModified: file.lastModified,
        });
      } catch (err) {
        console.error("Failed to read file attachment", file.name, err);
      }
    }

    if (newItems.length > 0) {
      const updated = [...attachments, ...newItems];
      updateAttachments(updated);
      setPresetFeedback(`Attached ${newItems.length} file(s) for Outlook export!`);
      setTimeout(() => setPresetFeedback(null), 3500);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const updated = attachments.filter((a) => a.id !== id);
    updateAttachments(updated);
  };

  const handleClearAllAttachments = () => {
    updateAttachments([]);
    setPresetFeedback("Cleared all attachments.");
    setTimeout(() => setPresetFeedback(null), 2500);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Load custom presets from localStorage on mount (filtering legacy removed presets)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PRESETS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((p) => !STALE_LEGACY_PRESET_IDS.has(p.id));
          setCustomPresets(filtered);
        }
      }
    } catch (e) {
      console.warn("Failed to load custom note presets from localStorage", e);
    }
  }, []);

  // Save custom presets to localStorage
  const saveCustomPresetsToStorage = (updated: NotePreset[]) => {
    setCustomPresets(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PRESETS, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to save custom note presets to localStorage", e);
    }
  };

  const allPresets = useMemo(() => {
    return [...customPresets, ...DEFAULT_NOTE_PRESETS];
  }, [customPresets]);

  const weekInfo = useMemo(() => getWeekDateRange(roster.date, branding), [roster.date, branding]);

  // Initial email stored links for this technician and work week
  const initialEmailStoredLinks = useMemo(() => {
    return getStoredInitialEmailLinks(roster.technicianName, weekInfo.formattedRange);
  }, [roster.technicianName, weekInfo.formattedRange, storedEmails]);

  // Google Maps App Link Placeholder State & Handlers
  const explicitCustomMapUrl =
    (branding.customTechGoogleMapsLinks && branding.customTechGoogleMapsLinks[roster.technicianName]) ||
    branding.googleMapsUrl ||
    "";

  // Check if link is auto-embedded from initial email history
  const isAutoEmbeddedFromInitial = !explicitCustomMapUrl && !!initialEmailStoredLinks.googleMapsUrl;
  const activeCustomMapUrl = explicitCustomMapUrl || initialEmailStoredLinks.googleMapsUrl || "";

  const resolvedGoogleMapsUrl = useMemo(() => {
    return getTechnicianGoogleMapsLink(
      roster.technicianName,
      activeCustomMapUrl,
      branding.customTechGoogleMapsLinks,
      branding.googleMapsBaseUrl,
      weekInfo.formattedRange
    );
  }, [roster.technicianName, activeCustomMapUrl, branding.customTechGoogleMapsLinks, branding.googleMapsBaseUrl, weekInfo.formattedRange]);

  const handleGoogleMapsUrlChange = (val: string) => {
    const updatedMap = {
      ...(branding.customTechGoogleMapsLinks || {}),
      [roster.technicianName]: val,
    };
    if (onUpdateBranding) {
      onUpdateBranding({
        googleMapsUrl: val,
        customTechGoogleMapsLinks: updatedMap,
      });
    }
  };

  const handleResetGoogleMapsUrl = () => {
    const updatedMap = { ...(branding.customTechGoogleMapsLinks || {}) };
    delete updatedMap[roster.technicianName];
    if (onUpdateBranding) {
      onUpdateBranding({
        googleMapsUrl: "",
        customTechGoogleMapsLinks: updatedMap,
      });
    }
    setPresetFeedback("Reset Google Maps link to default route query.");
    setTimeout(() => setPresetFeedback(null), 2500);
  };

  const subject = useMemo(() => generateEmailSubject(roster, branding), [roster, branding]);
  const htmlContent = useMemo(
    () => generateOutlookHtml(roster, branding, "exact_nds_template"),
    [roster, branding]
  );
  const plainTextContent = useMemo(
    () => generatePlainTextEmail(roster, branding),
    [roster, branding]
  );

  const autoDetectedNotes = useMemo(() => {
    return autoDetectAdditionalNotesForRoster(
      roster,
      weekInfo.sundayDate,
      branding.useAnytimeTeardowns,
      branding.sundaySundayEnabled
    );
  }, [roster, weekInfo.sundayDate, branding.useAnytimeTeardowns, branding.sundaySundayEnabled]);

  // Handler to sync auto-detected notes into active notes list
  const handleSyncAutoDetectedNotes = () => {
    if (autoDetectedNotes.length === 0) return;
    const existing = branding.additionalNotes || [];
    const newNotes = [...existing];

    autoDetectedNotes.forEach((an) => {
      const alreadyExists = newNotes.some(
        (n) =>
          n.day.toLowerCase() === an.day.toLowerCase() &&
          n.text.toLowerCase().includes(an.text.slice(0, 30).toLowerCase())
      );
      if (!alreadyExists) {
        newNotes.push({
          id: `auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          day: an.day,
          text: formatNoteTextWithPrefix(an.text),
        });
      }
    });

    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes(newNotes);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: newNotes, additionalNotesEnabled: true });
    }
    if (onToggleAdditionalNotes && !branding.additionalNotesEnabled) {
      onToggleAdditionalNotes(true);
    }
    setPresetFeedback(`Synced ${autoDetectedNotes.length} auto-detected note(s) into schedule!`);
    setTimeout(() => setPresetFeedback(null), 3500);
  };

  const daySelectOptions = useMemo(() => {
    return branding.sundaySundayEnabled
      ? [
          { value: "Sunday", label: `Sunday (${weekInfo.sundayFormatted})` },
          { value: "Monday", label: "Monday" },
          { value: "Tuesday", label: "Tuesday" },
          { value: "Wednesday", label: "Wednesday" },
          { value: "Thursday", label: "Thursday" },
          { value: "Friday", label: "Friday" },
          { value: "Saturday", label: "Saturday" },
          { value: "Sunday_Lower", label: `Sunday (${weekInfo.nextSundayFormatted})` },
        ]
      : [
          { value: "Sunday", label: "Sunday" },
          { value: "Monday", label: "Monday" },
          { value: "Tuesday", label: "Tuesday" },
          { value: "Wednesday", label: "Wednesday" },
          { value: "Thursday", label: "Thursday" },
          { value: "Friday", label: "Friday" },
          { value: "Saturday", label: "Saturday" },
        ];
  }, [branding.sundaySundayEnabled, weekInfo]);

  const daysDefinitions = useMemo(() => {
    return branding.sundaySundayEnabled
      ? [
          { key: "Sunday", displayName: `Sunday (${weekInfo.sundayFormatted})`, baseDayName: "Sunday" },
          { key: "Monday", displayName: "Monday", baseDayName: "Monday" },
          { key: "Tuesday", displayName: "Tuesday", baseDayName: "Tuesday" },
          { key: "Wednesday", displayName: "Wednesday", baseDayName: "Wednesday" },
          { key: "Thursday", displayName: "Thursday", baseDayName: "Thursday" },
          { key: "Friday", displayName: "Friday", baseDayName: "Friday" },
          { key: "Saturday", displayName: "Saturday", baseDayName: "Saturday" },
          { key: "Sunday_Lower", displayName: `Sunday (${weekInfo.nextSundayFormatted})`, baseDayName: "Sunday" },
        ]
      : [
          { key: "Sunday", displayName: "Sunday", baseDayName: "Sunday" },
          { key: "Monday", displayName: "Monday", baseDayName: "Monday" },
          { key: "Tuesday", displayName: "Tuesday", baseDayName: "Tuesday" },
          { key: "Wednesday", displayName: "Wednesday", baseDayName: "Wednesday" },
          { key: "Thursday", displayName: "Thursday", baseDayName: "Thursday" },
          { key: "Friday", displayName: "Friday", baseDayName: "Friday" },
          { key: "Saturday", displayName: "Saturday", baseDayName: "Saturday" },
        ];
  }, [branding.sundaySundayEnabled, weekInfo]);

  const groupedOrders = useMemo(() => {
    return groupNDSOrdersByDay(roster.orders, weekInfo.sundayDate, branding);
  }, [roster.orders, weekInfo.sundayDate, branding]);

  const getDayDisplayName = (dayKey: string) => {
    if (dayKey === "Sunday_Lower") {
      return `Sunday (${weekInfo.nextSundayFormatted})`;
    }
    if (dayKey === "Sunday" && branding.sundaySundayEnabled) {
      return `Sunday (${weekInfo.sundayFormatted})`;
    }
    return dayKey;
  };

  // Refresh stored generated emails from localStorage
  const refreshStoredEmails = useCallback(() => {
    const records = getStoredGeneratedEmails();
    setStoredEmails(records);
    return records;
  }, []);

  // Initial load of stored emails
  useEffect(() => {
    refreshStoredEmails();
  }, [refreshStoredEmails]);

  const [clearNotice, setClearNotice] = useState<string | null>(null);

  // Auto-detect and recommend email update version when technician or work week changes
  useEffect(() => {
    const techName = roster.technicianName;
    const workWeek = weekInfo.formattedRange;
    if (!techName) return;

    const rec = getRecommendedUpdateVersion(techName, workWeek);
    if (rec.count > 0) {
      // Prior generated emails exist for this tech in this work week
      // e.g. 1 previous email (Version 0) -> nextVer = 1 (UPDATE v1)
      // 2 previous emails (v0, v1) -> nextVer = 2 (UPDATE v2)
      const nextVer = rec.recommendedVersion;
      setAutoVersionNotice({
        tech: cleanTechnicianName(techName),
        count: rec.count,
        suggestedVersion: nextVer,
      });

      // Auto-toggle ON the Email Updates feature when stored history exists
      if (!branding.emailUpdatesEnabled) {
        if (onToggleEmailUpdates) {
          onToggleEmailUpdates(true);
        } else if (onUpdateBranding) {
          onUpdateBranding({ emailUpdatesEnabled: true, updateVersion: nextVer });
        }
      }
      if (branding.updateVersion === undefined || Number(branding.updateVersion) < nextVer) {
        if (onUpdateEmailUpdateDetails) {
          onUpdateEmailUpdateDetails(nextVer, branding.updateNotes || "");
        } else if (onUpdateBranding) {
          onUpdateBranding({ updateVersion: nextVer });
        }
      }
    } else {
      setAutoVersionNotice(null);
    }
  }, [roster.technicianName, weekInfo.formattedRange]);

  // Record a generated email into localStorage with full rendered content
  const recordGeneratedEmailToStorage = (
    method: "Clipboard" | "Outlook EML" | "Outlook Web" | "Batch ZIP" | "Manual Save"
  ) => {
    const currentVersion = branding.emailUpdatesEnabled
      ? branding.updateVersion !== undefined && branding.updateVersion !== ""
        ? `UPDATE v${branding.updateVersion}`
        : "UPDATE v1"
      : "Version 0";

    const resolvedAirtable = getTechnicianAirtableLink(
      roster.technicianName,
      branding.airtableBaseUrl,
      branding.customTechAirtableLinks,
      weekInfo.formattedRange
    );
    const resolvedPhoto = branding.photoUploadUrl || "https://airtable.com/appsVo4SWcGXTkarK/shrBgw2x5NJZwU3Xo";

    saveStoredGeneratedEmail({
      technicianName: roster.technicianName,
      workWeek: weekInfo.formattedRange,
      version: currentVersion,
      subject,
      exportMethod: method,
      notes: branding.updateNotes,
      jobCount: roster.orders.length,
      htmlContent,
      plainTextContent,
      additionalNotes: branding.additionalNotes,
      googleMapsUrl: activeCustomMapUrl || resolvedGoogleMapsUrl,
      airtableUrl: resolvedAirtable,
      photoUploadUrl: resolvedPhoto,
      brandingConfig: {
        additionalNotesEnabled: branding.additionalNotesEnabled,
        emailUpdatesEnabled: branding.emailUpdatesEnabled,
        updateVersion: branding.updateVersion,
        updateNotes: branding.updateNotes,
        previousUpdateNotes: resolveStackedPreviousUpdateNotes(branding, roster),
        sundaySundayEnabled: branding.sundaySundayEnabled,
        overlappingSchedulesEnabled: branding.overlappingSchedulesEnabled,
        useAnytimeTeardowns: branding.useAnytimeTeardowns,
        ladotdExclusive: branding.ladotdExclusive,
        codExclusive: branding.codExclusive,
        conductStudyEnabled: branding.conductStudyEnabled,
        pedsConductLines: branding.pedsConductLines,
        dayItemOrderOverrides: branding.dayItemOrderOverrides,
        googleMapsUrl: activeCustomMapUrl || resolvedGoogleMapsUrl,
        customTechGoogleMapsLinks: branding.customTechGoogleMapsLinks,
        customTechAirtableLinks: branding.customTechAirtableLinks,
        photoUploadUrl: branding.photoUploadUrl,
        photoUploadLinkText: branding.photoUploadLinkText,
      },
    });

    refreshStoredEmails();
  };

  // Clear currently displayed email state, notes, and update configurations
  const handleClearPreview = () => {
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes([]);
    }
    if (onUpdateEmailUpdateDetails) {
      onUpdateEmailUpdateDetails(1, "");
    }
    if (onUpdatePedsConductLines) {
      onUpdatePedsConductLines([]);
    }
    if (onUpdateDayItemOrderOverrides) {
      onUpdateDayItemOrderOverrides({});
    }
    if (onToggleAdditionalNotes) {
      onToggleAdditionalNotes(false);
    }
    if (onToggleEmailUpdates) {
      onToggleEmailUpdates(false);
    }
    if (onToggleConductStudy) {
      onToggleConductStudy(false);
    }
    if (onUpdateBranding) {
      onUpdateBranding({
        additionalNotes: [],
        additionalNotesEnabled: false,
        emailUpdatesEnabled: false,
        updateVersion: 1,
        updateNotes: "",
        attachments: [],
        conductStudyEnabled: false,
        pedsConductLines: [],
        dayItemOrderOverrides: {},
      });
    }

    setAttachments([]);
    setNoteInputText("");
    setSelectedNoteDay("Monday");
    setSelectedPedsDay("Monday");
    setPedsProjectNumber("");
    setPedsListNumber("");
    setPedsCustomText("");
    setMultiSelectBulkDay("Monday");
    setMultiSelectPresetIds([]);
    setMultiSelectDayMap({});

    if (onClearPreview) {
      onClearPreview();
    }

    setClearNotice("Preview cleared! Custom notes, schedule, attachments, and uploaded file have been reset.");
    setTimeout(() => setClearNotice(null), 4000);
  };

  // Conduct Study & PEDS Conduct Sight Distance Handlers
  const handleAddPedsConductLine = () => {
    if (!pedsProjectNumber.trim() && !pedsListNumber.trim() && !pedsCustomText.trim()) return;
    const newLine: PedsConductLineItem = {
      id: `peds-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: selectedPedsDay,
      projectNumber: pedsProjectNumber.trim() || "26-470285",
      listNumber: pedsListNumber.trim() || "105",
      cityText: pedsCity.trim() || "City of Dallas",
      customText: pedsCustomText.trim() || undefined,
    };
    const updated = [...(branding.pedsConductLines || []), newLine];
    if (onUpdatePedsConductLines) {
      onUpdatePedsConductLines(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ pedsConductLines: updated });
    }
    setPedsProjectNumber("");
    setPedsListNumber("");
    setPedsCustomText("");
    setPedsFeedback(`Added PEDS Conduct line to ${getDayDisplayName(selectedPedsDay)}`);
    setTimeout(() => setPedsFeedback(null), 3000);
  };

  const handleRemovePedsConductLine = (id: string) => {
    const updated = (branding.pedsConductLines || []).filter((item) => item.id !== id);
    if (onUpdatePedsConductLines) {
      onUpdatePedsConductLines(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ pedsConductLines: updated });
    }
  };

  const handleMoveScheduleItem = (
    dayKey: string,
    baseDayName: string,
    dayOrders: WorkOrder[],
    itemId: string,
    direction: "up" | "down"
  ) => {
    const currentItems = buildDayScheduleItems(dayKey, baseDayName, dayOrders, branding);
    const itemIds = currentItems.map((it) => it.id);
    const currentIndex = itemIds.indexOf(itemId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= itemIds.length) return;

    const newOrderIds = [...itemIds];
    const temp = newOrderIds[currentIndex];
    newOrderIds[currentIndex] = newOrderIds[targetIndex];
    newOrderIds[targetIndex] = temp;

    const newOverrides = {
      ...(branding.dayItemOrderOverrides || {}),
      [dayKey]: newOrderIds,
    };

    if (onUpdateDayItemOrderOverrides) {
      onUpdateDayItemOrderOverrides(newOverrides);
    } else if (onUpdateBranding) {
      onUpdateBranding({ dayItemOrderOverrides: newOverrides });
    }
  };

  const getFileBadgeColor = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return "bg-red-50 text-red-700 border-red-300";
    if (ext === "kmz" || ext === "kml") return "bg-amber-50 text-amber-800 border-amber-300";
    if (ext === "csv" || ext === "xlsx" || ext === "xls") return "bg-emerald-50 text-emerald-800 border-emerald-300";
    if (ext === "doc" || ext === "docx" || ext === "txt") return "bg-blue-50 text-blue-800 border-blue-300";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "bg-purple-50 text-purple-800 border-purple-300";
    return "bg-zinc-50 text-zinc-700 border-zinc-300";
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf") return <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />;
    if (ext === "kmz" || ext === "kml") return <FileCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    if (ext === "csv" || ext === "xlsx" || ext === "xls") return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-zinc-600 shrink-0" />;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Delete an individual generated email from local storage
  const handleDeleteGeneratedEmail = (id: string) => {
    deleteStoredGeneratedEmail(id);
    const updated = refreshStoredEmails();

    // Re-check auto-version recommendation
    const rec = getRecommendedUpdateVersion(roster.technicianName, weekInfo.formattedRange);
    if (rec.count > 0) {
      const nextVer = rec.count + 1;
      setAutoVersionNotice({
        tech: cleanTechnicianName(roster.technicianName),
        count: rec.count,
        suggestedVersion: nextVer,
      });
      if (onUpdateEmailUpdateDetails) {
        onUpdateEmailUpdateDetails(nextVer, branding.updateNotes || "");
      } else if (onUpdateBranding) {
        onUpdateBranding({ updateVersion: nextVer });
      }
    } else {
      setAutoVersionNotice(null);
    }
  };

  // Clear all generated email history for active technician
  const handleClearTechHistory = (techName: string, workWeek?: string) => {
    clearStoredGeneratedEmailsForTech(techName, workWeek);
    refreshStoredEmails();
    setAutoVersionNotice(null);
  };

  // Filtered list of stored emails for active technician
  const activeTechEmails = useMemo(() => {
    return getGeneratedEmailsForTechAndWeek(roster.technicianName, weekInfo.formattedRange);
  }, [storedEmails, roster.technicianName, weekInfo.formattedRange]);

  const handleUpdateVersionChange = (val: string) => {
    const num = parseInt(val, 10);
    const newVersion = isNaN(num) || num < 1 ? 1 : num;
    if (onUpdateEmailUpdateDetails) {
      onUpdateEmailUpdateDetails(newVersion, branding.updateNotes || "");
    } else if (onUpdateBranding) {
      onUpdateBranding({ updateVersion: newVersion });
    }
  };

  const handleUpdateNotesChange = (val: string) => {
    if (onUpdateEmailUpdateDetails) {
      onUpdateEmailUpdateDetails(branding.updateVersion || 1, val);
    } else if (onUpdateBranding) {
      onUpdateBranding({ updateNotes: val });
    }
  };

  const handleSetPresetNote = (preset: string) => {
    handleUpdateNotesChange(preset);
  };

  const handleAddAdditionalNote = () => {
    if (!noteInputText.trim()) return;
    const formatted = formatNoteTextWithPrefix(noteInputText);
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: selectedNoteDay,
      text: formatted,
    };
    const updated = [...(branding.additionalNotes || []), newNote];
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: updated });
    }
    setNoteInputText("");
    setPresetFeedback(`Added note to ${getDayDisplayName(selectedNoteDay)}`);
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  const handleQuickAddPresetToDay = (presetText: string) => {
    const formatted = formatNoteTextWithPrefix(presetText);
    const newNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: selectedNoteDay,
      text: formatted,
    };
    const updated = [...(branding.additionalNotes || []), newNote];
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: updated });
    }
    setPresetFeedback(`Added "${formatted.slice(0, 35)}..." to ${getDayDisplayName(selectedNoteDay)}`);
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  const handleOpenSavePresetModal = () => {
    if (!noteInputText.trim()) return;
    const clean = formatNoteTextWithPrefix(noteInputText).replace(/^Note:\s*/i, "").trim();
    const defaultTitle = clean.length > 28 ? clean.substring(0, 28) + "..." : clean;
    setNewPresetTitle(defaultTitle);
    setShowSavePresetModal(true);
  };

  const handleConfirmSavePreset = () => {
    if (!noteInputText.trim()) return;
    const title = newPresetTitle.trim() || "Custom Note Preset";
    const formatted = formatNoteTextWithPrefix(noteInputText);
    const newPreset: NotePreset = {
      id: `custom-preset-${Date.now()}`,
      title,
      text: formatted,
      isBuiltIn: false,
    };
    const updated = [newPreset, ...customPresets];
    saveCustomPresetsToStorage(updated);
    setShowSavePresetModal(false);
    setNewPresetTitle("");
    setPresetFeedback(`Saved preset "${title}" locally!`);
    setTimeout(() => setPresetFeedback(null), 3500);
  };

  const handleDeleteCustomPreset = (presetId: string, title: string) => {
    const updated = customPresets.filter((p) => p.id !== presetId);
    saveCustomPresetsToStorage(updated);
    // Also remove from multi-selection if present
    setMultiSelectPresetIds((prev) => prev.filter((id) => id !== presetId));
    setPresetFeedback(`Removed preset "${title}"`);
    setTimeout(() => setPresetFeedback(null), 2500);
  };

  const handleRemoveAdditionalNote = (id: string) => {
    const updated = (branding.additionalNotes || []).filter((n) => n.id !== id);
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: updated });
    }
  };

  const handleClearAllAdditionalNotes = () => {
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes([]);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: [] });
    }
    setPresetFeedback("Cleared all active notes for this email");
    setTimeout(() => setPresetFeedback(null), 2500);
  };

  // --- Multi-Select Presets Handlers ---
  const handleOpenMultiSelectModal = () => {
    // Initialize day map for all presets if empty
    const initialMap: Record<string, string> = { ...multiSelectDayMap };
    allPresets.forEach((p) => {
      if (!initialMap[p.id]) {
        initialMap[p.id] = selectedNoteDay || "Monday";
      }
    });
    setMultiSelectDayMap(initialMap);
    setShowMultiSelectModal(true);
  };

  const handleTogglePresetSelection = (presetId: string) => {
    setMultiSelectPresetIds((prev) =>
      prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId]
    );
  };

  const handleSelectAllPresets = () => {
    const allIds = allPresets.map((p) => p.id);
    setMultiSelectPresetIds(allIds);
  };

  const handleDeselectAllPresets = () => {
    setMultiSelectPresetIds([]);
  };

  const handleSetPresetDay = (presetId: string, day: string) => {
    setMultiSelectDayMap((prev) => ({
      ...prev,
      [presetId]: day,
    }));
  };

  const handleApplyBulkDayToSelected = () => {
    if (multiSelectPresetIds.length === 0) return;
    setMultiSelectDayMap((prev) => {
      const updated = { ...prev };
      multiSelectPresetIds.forEach((id) => {
        updated[id] = multiSelectBulkDay;
      });
      return updated;
    });
    setPresetFeedback(`Set ${multiSelectPresetIds.length} selected note(s) to ${getDayDisplayName(multiSelectBulkDay)}`);
    setTimeout(() => setPresetFeedback(null), 3000);
  };

  const handleAddMultiSelectedPresetsToSchedule = () => {
    if (multiSelectPresetIds.length === 0) return;

    const notesToAdd = multiSelectPresetIds
      .map((presetId) => {
        const preset = allPresets.find((p) => p.id === presetId);
        if (!preset) return null;
        const targetDay = multiSelectDayMap[presetId] || selectedNoteDay || "Sunday";
        return {
          id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          day: targetDay,
          text: formatNoteTextWithPrefix(preset.text),
        };
      })
      .filter(Boolean) as Array<{ id: string; day: string; text: string }>;

    const updated = [...(branding.additionalNotes || []), ...notesToAdd];
    if (onUpdateAdditionalNotes) {
      onUpdateAdditionalNotes(updated);
    } else if (onUpdateBranding) {
      onUpdateBranding({ additionalNotes: updated });
    }

    setShowMultiSelectModal(false);
    setPresetFeedback(
      `Added ${notesToAdd.length} preset notes across assigned days to schedule!`
    );
    setTimeout(() => setPresetFeedback(null), 4000);
  };

  // --- Export & Dispatch Actions with Local Storage Tracking ---
  const handleCopyRichHtml = async () => {
    const success = await copyRichHtmlToClipboard(htmlContent, plainTextContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onRecordDispatch("Clipboard", "Delivered");
      recordGeneratedEmailToStorage("Clipboard");
    }
  };

  const handleDownloadEml = () => {
    downloadEmlFile(roster, branding, "exact_nds_template", attachments);
    onRecordDispatch("Outlook EML", "Exported");
    recordGeneratedEmailToStorage("Outlook EML");
  };

  const handleOpenOutlookWeb = () => {
    const url = getOutlook365WebUrl(roster, branding);
    window.open(url, "_blank");
    onRecordDispatch("Outlook Web", "Exported");
    recordGeneratedEmailToStorage("Outlook Web");
  };

  const handleManualMarkGenerated = () => {
    recordGeneratedEmailToStorage("Manual Save");
    setManualSaveSuccess(true);
    setTimeout(() => setManualSaveSuccess(false), 2500);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Top Preview Controls Bar */}
      <div className="p-4 bg-blue-600 border-b border-blue-700 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 text-white border border-white/30 flex items-center justify-center shadow-xs">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-tight">Outlook Email Template Generator</h2>
              {activeTechEmails.length > 0 && (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-zinc-950 font-bold px-2 py-0.5 rounded-md text-[11px] inline-flex items-center space-x-1 transition cursor-pointer shadow-xs"
                  title="View locally stored email versions for this technician"
                >
                  <History className="w-3 h-3 text-zinc-950" />
                  <span>{activeTechEmails.length} Email(s) Saved</span>
                </button>
              )}
            </div>
            <p className="text-xs text-blue-100">
              Generating for <span className="text-white font-bold">{roster.technicianName}</span> ({roster.technicianEmail})
            </p>
          </div>
        </div>

        {/* Top Controls: Additional Notes, Sunday-Sunday, Email Updates, Anytime, LADOTD & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Additional Notes Toggle */}
          <button
            onClick={() => {
              const nextVal = !branding.additionalNotesEnabled;
              if (onToggleAdditionalNotes) {
                onToggleAdditionalNotes(nextVal);
              } else if (onUpdateBranding) {
                onUpdateBranding({ additionalNotesEnabled: nextVal });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
              branding.additionalNotesEnabled
                ? "bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-400 font-bold"
                : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
            }`}
            title="When toggled ON: Add custom notes under specific days styled in green, bold, and italic text."
          >
            <span className="font-bold">Additional Notes</span>
            <span
              className={`w-2 h-2 rounded-full transition ${
                branding.additionalNotesEnabled ? "bg-white animate-pulse" : "bg-zinc-300"
              }`}
            />
          </button>

          {/* Sunday - Sunday Email Toggle */}
          <button
            onClick={() => {
              const nextVal = !branding.sundaySundayEnabled;
              if (onToggleSundaySunday) {
                onToggleSundaySunday(nextVal);
              } else if (onUpdateBranding) {
                onUpdateBranding({ sundaySundayEnabled: nextVal });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
              branding.sundaySundayEnabled
                ? "bg-cyan-300 hover:bg-cyan-200 text-cyan-950 border-cyan-200 font-bold"
                : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
            }`}
            title="When toggled ON: Adds another Sunday after Saturday, displaying dates for both Upper and Lower Sunday."
          >
            <span className="font-bold">Sunday - Sunday</span>
            <span
              className={`w-2 h-2 rounded-full transition ${
                branding.sundaySundayEnabled ? "bg-cyan-950 animate-pulse" : "bg-zinc-300"
              }`}
            />
          </button>

          {/* Overlapping Schedule Toggle */}
          <button
            onClick={() => {
              const nextVal = !branding.overlappingSchedulesEnabled;
              if (onToggleOverlappingSchedules) {
                onToggleOverlappingSchedules(nextVal);
              } else if (onUpdateBranding) {
                onUpdateBranding({ overlappingSchedulesEnabled: nextVal });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
              branding.overlappingSchedulesEnabled
                ? "bg-indigo-300 hover:bg-indigo-200 text-indigo-950 border-indigo-200 font-bold ring-2 ring-indigo-300/60"
                : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
            }`}
            title="When toggled ON: Reads overlapping Battery Swaps, Teardowns, and carryover tasks from last week and combines them into the current week's schedule."
          >
            <span className="font-bold">Overlapping Schedule</span>
            <span
              className={`w-2 h-2 rounded-full transition ${
                branding.overlappingSchedulesEnabled ? "bg-indigo-950 animate-pulse" : "bg-zinc-300"
              }`}
            />
          </button>

          {/* Conduct Study Toggle */}
          <button
            onClick={() => {
              const nextVal = !branding.conductStudyEnabled;
              if (onToggleConductStudy) {
                onToggleConductStudy(nextVal);
              } else if (onUpdateBranding) {
                onUpdateBranding({ conductStudyEnabled: nextVal });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
              branding.conductStudyEnabled
                ? "bg-purple-300 hover:bg-purple-200 text-purple-950 border-purple-200 font-bold ring-2 ring-purple-300/60"
                : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
            }`}
            title="When toggled ON: Formats Parking and Radar studies as 'Conduct <Study>: <Project Number> <City, State> (<Time Duration>)' and enables PEDS Conduct Sight Distance lines."
          >
            <span className="font-bold">Conduct Study</span>
            <span
              className={`w-2 h-2 rounded-full transition ${
                branding.conductStudyEnabled ? "bg-purple-950 animate-pulse" : "bg-zinc-300"
              }`}
            />
          </button>

          {/* Email Updates Toggle */}
          <button
            onClick={() => {
              if (onToggleEmailUpdates) {
                onToggleEmailUpdates(!branding.emailUpdatesEnabled);
              } else if (onUpdateBranding) {
                onUpdateBranding({ emailUpdatesEnabled: !branding.emailUpdatesEnabled });
              }
            }}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
              branding.emailUpdatesEnabled
                ? "bg-yellow-400 hover:bg-yellow-300 text-yellow-950 border-yellow-300 font-bold"
                : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
            }`}
            title="When toggled ON: Adds 'UPDATE v<version>' to the email subject line and inserts a highlighted yellow banner in the greeting."
          >
            <span className="font-bold">Email Updates</span>
            <span
              className={`w-2 h-2 rounded-full transition ${
                branding.emailUpdatesEnabled ? "bg-yellow-950 animate-pulse" : "bg-zinc-300"
              }`}
            />
          </button>

          {onToggleAnytime && (
            <button
              onClick={() => onToggleAnytime(!branding.useAnytimeTeardowns)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
                branding.useAnytimeTeardowns
                  ? "bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-300 font-bold"
                  : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
              }`}
              title="When toggled ON: Teardowns with 0:30 time appear on their exact Teardown After date with 'Anytime'."
            >
              <span className="font-bold">Anytime</span>
              <span
                className={`w-2 h-2 rounded-full transition ${
                  branding.useAnytimeTeardowns ? "bg-amber-950 animate-pulse" : "bg-zinc-300"
                }`}
              />
            </button>
          )}

          {onToggleLadotd && (
            <button
              onClick={() => onToggleLadotd(!branding.ladotdExclusive)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
                branding.ladotdExclusive
                  ? "bg-emerald-400 hover:bg-emerald-300 text-emerald-950 border-emerald-300 font-bold"
                  : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
              }`}
              title="When toggled ON: Formats project 26-240026 with LADOTD specifications."
            >
              <span className="font-bold">LADOTD Exclusive</span>
              <span
                className={`w-2 h-2 rounded-full transition ${
                  branding.ladotdExclusive ? "bg-emerald-950 animate-pulse" : "bg-zinc-300"
                }`}
              />
            </button>
          )}

          {/* COD Exclusive Toggle */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                const nextVal = !branding.codExclusive;
                if (onToggleCodExclusive) {
                  onToggleCodExclusive(nextVal);
                } else if (onUpdateBranding) {
                  onUpdateBranding({ codExclusive: nextVal });
                }
                if (nextVal) {
                  setShowCodSightDistanceModal(true);
                }
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-xs ${
                branding.codExclusive
                  ? "bg-teal-400 hover:bg-teal-300 text-teal-950 border-teal-300 font-bold ring-2 ring-teal-300/60"
                  : "bg-white/95 hover:bg-white text-zinc-800 border-white/80"
              }`}
              title="When toggled ON: Scans Scheduling Team Notes for '(City of Dallas – List ...)' and places this into the main task line instead of <City, State>, sequences COD teardowns together, and prompts for picking locations for Conduct Sight Distance."
            >
              <span className="font-bold">COD Exclusive</span>
              <span
                className={`w-2 h-2 rounded-full transition ${
                  branding.codExclusive ? "bg-teal-950 animate-pulse" : "bg-zinc-300"
                }`}
              />
            </button>

            {branding.codExclusive && (
              <button
                type="button"
                onClick={() => setShowCodSightDistanceModal(true)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-500/20 hover:bg-teal-500/30 text-teal-100 border border-teal-300/30 transition cursor-pointer"
                title="Open Location Picker for Conduct Sight Distance line"
              >
                <Footprints className="w-3.5 h-3.5 text-teal-300" />
                <span>
                  Sight Distance
                  {Object.values(branding.codSightDistanceLocations || {}).reduce<number>(
                    (acc: number, arr: string[] | undefined) => acc + (arr ? arr.length : 0),
                    0
                  ) > 0 && (
                    <span className="ml-1 bg-teal-300 text-teal-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                      {Object.values(branding.codSightDistanceLocations || {}).reduce<number>(
                        (acc: number, arr: string[] | undefined) => acc + (arr ? arr.length : 0),
                        0
                      )}
                    </span>
                  )}
                </span>
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1 bg-blue-800/80 p-1 rounded-lg border border-blue-500/60 shadow-inner">
            <button
              onClick={() => setViewMode("desktop")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                viewMode === "desktop" ? "bg-white text-blue-900 shadow-xs border border-white font-bold" : "text-blue-100 hover:text-white hover:bg-blue-700/50"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop Outlook</span>
            </button>

            <button
              onClick={() => setViewMode("mobile")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                viewMode === "mobile" ? "bg-white text-blue-900 shadow-xs border border-white font-bold" : "text-blue-100 hover:text-white hover:bg-blue-700/50"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Version Detection Banner (If emails were previously generated for this tech and work week) */}
      {autoVersionNotice && (
        <div className="bg-yellow-100/90 border-b border-yellow-300 px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-yellow-950 animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center justify-center p-1 rounded-md bg-yellow-400 text-zinc-950 font-black">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="font-bold">Auto-Version Active:</span> Found{" "}
              <strong>{autoVersionNotice.count}</strong> previous email generation(s) in local storage for{" "}
              <strong>{autoVersionNotice.tech}</strong> ({weekInfo.formattedRange}). With initial email as <strong>Version 0</strong>, automatically set to{" "}
              <span className="bg-yellow-300 px-1.5 py-0.5 rounded font-black border border-yellow-400">
                UPDATE v{branding.updateVersion || autoVersionNotice.suggestedVersion}
              </span>
              . <span className="text-yellow-800 italic">(You can modify or override this anytime)</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="font-bold bg-white text-zinc-900 border border-yellow-400 hover:bg-yellow-50 px-2.5 py-1 rounded-md transition cursor-pointer flex items-center space-x-1 text-[11px] shadow-2xs"
            >
              <History className="w-3 h-3 text-yellow-700" />
              <span>View History ({autoVersionNotice.count})</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoVersionNotice(null)}
              className="text-yellow-700 hover:text-yellow-950 p-1 cursor-pointer"
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Expanded Additional Notes Control Panel (Active when Additional Notes toggle is ON) */}
      {branding.additionalNotesEnabled && (
        <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-3 sm:px-6 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center justify-center p-1 rounded-md bg-emerald-500 text-white shadow-xs">
                <StickyNote className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Additional Notes Configuration
              </span>
              <span className="text-[11px] text-emerald-800 hidden md:inline font-medium">
                (Notes render between Day heading & task lines with <span className="bg-[#00FF00] text-black font-bold italic px-1.5 py-0.5 rounded shadow-2xs">bright green highlight and black bold italic text</span>)
              </span>
            </div>

            {/* Multi-Select & Presets Action Bar */}
            <div className="flex items-center space-x-2 text-[11px]">
              <button
                type="button"
                onClick={handleOpenMultiSelectModal}
                className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold shadow-xs transition cursor-pointer"
                title="Select multiple saved presets and choose a specific day for each"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multi-Select Presets</span>
                <span className="bg-emerald-800 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {allPresets.length}
                </span>
              </button>

              <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-900 px-2 py-1 rounded-lg font-semibold border border-emerald-300">
                <Bookmark className="w-3 h-3 text-emerald-700" />
                <span>{customPresets.length} Custom ({allPresets.length} Total)</span>
              </span>
            </div>
          </div>

          {/* Auto-Detected Rules Banner */}
          {autoDetectedNotes.length > 0 && (
            <div className="bg-emerald-100/90 border border-emerald-300 rounded-lg p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-2xs">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-bold text-emerald-950">
                  Auto-Detected Rules for this Technician ({autoDetectedNotes.length}):
                </span>
                {autoDetectedNotes.map((an) => (
                  <span
                    key={an.id}
                    className="bg-white text-emerald-900 border border-emerald-300 font-semibold px-2 py-0.5 rounded text-[11px] shadow-2xs"
                  >
                    {an.rule === "speed_install" && `⚡ SPEED Install (${getDayDisplayName(an.day)})`}
                    {an.rule === "speed_teardown" && `⚡ SPEED Teardown (${getDayDisplayName(an.day)})`}
                    {an.rule === "tmc_install" && `📍 TMC Install (${getDayDisplayName(an.day)})`}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleSyncAutoDetectedNotes}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2.5 py-1 rounded-md text-xs transition cursor-pointer shrink-0 shadow-2xs flex items-center space-x-1"
                title="Populate auto-detected notes into active saved list"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Sync Auto Notes</span>
              </button>
            </div>
          )}

          {/* Feedback banner */}
          {presetFeedback && (
            <div className="flex items-center justify-between bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center space-x-2">
                <Check className="w-3.5 h-3.5" />
                <span className="font-semibold">{presetFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setPresetFeedback(null)}
                className="text-emerald-100 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Saved Presets Ribbon / Selector */}
          <div className="bg-white/80 border border-emerald-200 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-950">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quick Presets:</span>
                <span className="text-[11px] text-emerald-700 font-normal hidden sm:inline">
                  Click title to load into input, or click <strong>+ Add to {getDayDisplayName(selectedNoteDay).slice(0, 3)}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={handleOpenMultiSelectModal}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center space-x-1 cursor-pointer"
              >
                <CheckSquare className="w-3 h-3" />
                <span>Multi-Select Mode</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {allPresets.map((preset) => (
                <div
                  key={preset.id}
                  className={`inline-flex items-center rounded-lg border text-xs shadow-2xs transition group ${
                    preset.isBuiltIn
                      ? "bg-emerald-50/70 border-emerald-300 text-zinc-800"
                      : "bg-amber-50/90 border-amber-300 text-amber-950"
                  }`}
                  title={preset.text}
                >
                  <button
                    type="button"
                    onClick={() => setNoteInputText(preset.text)}
                    className="px-2 py-1 font-medium hover:underline text-left cursor-pointer flex items-center space-x-1"
                  >
                    {!preset.isBuiltIn && (
                      <span className="bg-amber-200 text-amber-900 text-[9px] font-bold px-1 rounded">
                        Saved
                      </span>
                    )}
                    <span>{preset.title}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickAddPresetToDay(preset.text)}
                    className="px-1.5 py-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-200/50 border-l border-emerald-300/60 rounded-r-lg transition cursor-pointer"
                    title={`Add directly to ${getDayDisplayName(selectedNoteDay)}`}
                  >
                    + {getDayDisplayName(selectedNoteDay).slice(0, 3)}
                  </button>

                  {!preset.isBuiltIn && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomPreset(preset.id, preset.title)}
                      className="px-1 py-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition cursor-pointer border-l border-amber-300/60"
                      title="Delete this saved preset"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form: Select Day + Input Field + Save/Add Button + Save as Preset Button */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Day Dropdown */}
            <div className="sm:col-span-3 lg:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                Select Day:
              </label>
              <select
                value={selectedNoteDay}
                onChange={(e) => setSelectedNoteDay(e.target.value)}
                className="w-full bg-white border border-emerald-400 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs cursor-pointer"
              >
                {daySelectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Note Text Input */}
            <div className="sm:col-span-6 lg:col-span-6">
              <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                Note Text:
              </label>
              <input
                type="text"
                value={noteInputText}
                onChange={(e) => setNoteInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAdditionalNote();
                  }
                }}
                placeholder="e.g. Note: Continue installing locations not finished yesterday until all inventories have been used up."
                className="w-full bg-white border border-emerald-400 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs"
              />
            </div>

            {/* Action Buttons: Add Note & Save As Reusable Preset */}
            <div className="sm:col-span-3 lg:col-span-4 flex items-center space-x-2 sm:self-end">
              <button
                type="button"
                onClick={handleAddAdditionalNote}
                disabled={!noteInputText.trim()}
                className={`flex-1 flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-xs ${
                  noteInputText.trim()
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-emerald-200 text-emerald-700 cursor-not-allowed"
                }`}
                title="Add note to selected day"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add to {getDayDisplayName(selectedNoteDay).slice(0, 3)}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenSavePresetModal}
                disabled={!noteInputText.trim()}
                className={`flex items-center justify-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border shadow-xs ${
                  noteInputText.trim()
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                    : "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                }`}
                title="Save this note as a reusable preset stored locally"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">Save Preset</span>
              </button>
            </div>
          </div>

          {/* Modal / Popover: Save Preset Name */}
          {showSavePresetModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
              <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-md w-full p-5 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center space-x-2 text-emerald-900">
                    <BookmarkPlus className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-zinc-900">Save Note as Reusable Preset</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSavePresetModal(false)}
                    className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-zinc-800 mb-1">
                      Preset Name / Title:
                    </label>
                    <input
                      type="text"
                      value={newPresetTitle}
                      onChange={(e) => setNewPresetTitle(e.target.value)}
                      placeholder="e.g., Unfinished Installs Rollover"
                      className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-zinc-800 mb-1">
                      Note Content:
                    </label>
                    <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-emerald-950 font-medium">
                      <span className="bg-[#00FF00] text-black font-bold italic px-1.5 py-0.5 rounded shadow-2xs">
                        {formatNoteTextWithPrefix(noteInputText)}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500">
                    This preset will be saved locally in your browser so you can reuse it across all technician emails anytime.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowSavePresetModal(false)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSavePreset}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition cursor-pointer shadow-xs flex items-center space-x-1.5"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Save Preset</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Active Saved Notes List */}
          {branding.additionalNotes && branding.additionalNotes.length > 0 && (
            <div className="pt-1 border-t border-emerald-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900">
                  Active Saved Notes for this Email ({branding.additionalNotes.length}):
                </span>
                <button
                  type="button"
                  onClick={handleClearAllAdditionalNotes}
                  className="text-[11px] text-red-600 hover:text-red-800 underline font-medium cursor-pointer"
                >
                  Clear All Notes
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branding.additionalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 shadow-2xs text-xs group"
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-2">
                      <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0">
                        {getDayDisplayName(note.day)}
                      </span>
                      {note.text.includes("See correct Format:") ? (
                        <span className="text-xs truncate">
                          <span className="bg-[#00FF00] text-black font-bold italic px-1.5 py-0.5 rounded-l shadow-2xs">
                            {note.text.substring(0, note.text.indexOf("See correct Format:")).trim()}
                          </span>{" "}
                          <span className="bg-[#FFFF00] text-black font-bold italic px-1.5 py-0.5 rounded-r shadow-2xs">
                            {note.text.substring(note.text.indexOf("See correct Format:")).trim()}
                          </span>
                        </span>
                      ) : (
                        <span className="bg-[#00FF00] text-black font-bold italic px-1.5 py-0.5 rounded text-xs truncate shadow-2xs">
                          {formatNoteTextWithPrefix(note.text)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdditionalNote(note.id)}
                      className="text-zinc-400 hover:text-red-600 p-1 rounded transition shrink-0 cursor-pointer"
                      title="Remove this note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Email Updates Control Panel (Active when Email Updates toggle is ON) */}
      {branding.emailUpdatesEnabled && (
        <div className="bg-yellow-50/90 border-b border-yellow-200 px-4 py-3 sm:px-6 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-400 text-zinc-950 text-xs font-black shadow-xs">
                v{branding.updateVersion || 1}
              </span>
              <span className="text-xs font-bold text-yellow-950 uppercase tracking-wide">
                Email Schedule Update Configuration
              </span>
              <span className="text-[11px] text-yellow-800 hidden md:inline">
                (Subject gets <code className="bg-yellow-200/80 px-1 py-0.5 rounded text-yellow-950 font-bold">UPDATE v{branding.updateVersion || 1}</code> and greeting gets yellow highlighted banner)
              </span>
            </div>

            {/* Quick Presets & History Shortcut */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="bg-yellow-200/90 hover:bg-yellow-300 text-yellow-950 px-2 py-0.5 rounded border border-yellow-400 font-bold transition cursor-pointer text-[11px] flex items-center space-x-1"
              >
                <History className="w-3 h-3" />
                <span>History ({activeTechEmails.length})</span>
              </button>
              <span className="text-yellow-800 font-medium ml-1">Quick Presets:</span>
              <button
                type="button"
                onClick={() =>
                  handleSetPresetNote("I added installs in COD List-104 (470268 & 470269) to your Wednesday schedule.")
                }
                className="bg-white/80 hover:bg-white text-zinc-800 px-2 py-0.5 rounded border border-yellow-300 font-medium transition cursor-pointer text-[11px]"
              >
                + Added COD List-104
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSetPresetNote("I added additional locations to your Friday route.")
                }
                className="bg-white/80 hover:bg-white text-zinc-800 px-2 py-0.5 rounded border border-yellow-300 font-medium transition cursor-pointer text-[11px]"
              >
                + Added Friday route
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSetPresetNote("I removed cancelled sites from your Tuesday teardown list.")
                }
                className="bg-white/80 hover:bg-white text-zinc-800 px-2 py-0.5 rounded border border-yellow-300 font-medium transition cursor-pointer text-[11px]"
              >
                + Removed cancelled sites
              </button>
              {branding.updateNotes && (
                <button
                  type="button"
                  onClick={() => handleSetPresetNote("")}
                  className="text-zinc-500 hover:text-zinc-800 underline text-[11px] ml-1 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Version Number Input */}
            <div className="sm:col-span-3 lg:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-800 mb-1">
                Update Version:
              </label>
              <div className="flex items-center">
                <span className="bg-yellow-200 border border-r-0 border-yellow-400 text-yellow-950 font-bold px-2.5 py-1.5 rounded-l-lg text-xs select-none">
                  v
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={branding.updateVersion || 1}
                  onChange={(e) => handleUpdateVersionChange(e.target.value)}
                  className="w-full bg-white border border-yellow-400 rounded-r-lg px-2.5 py-1.5 text-xs font-bold text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-yellow-500"
                  placeholder="1"
                />
              </div>
            </div>

            {/* Notes Input */}
            <div className="sm:col-span-9 lg:col-span-10">
              <label className="block text-[11px] font-bold text-zinc-800 mb-1">
                Update Notes <span className="text-zinc-500 font-normal">(Prefix "UPDATE v{branding.updateVersion || 1}: Schedule is updated." is automatically added)</span>:
              </label>
              <input
                type="text"
                value={branding.updateNotes || ""}
                onChange={(e) => handleUpdateNotesChange(e.target.value)}
                placeholder="e.g. I added installs in COD List-104 (470268 & 470269) to your Wednesday schedule."
                className="w-full bg-white border border-yellow-400 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>

          {/* Live Formatted Note Preview Pill */}
          <div className="pt-1 space-y-1.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-700 shrink-0">
                Active Update Line (Yellow Highlight & Bold):
              </span>
              <div className="bg-[#FFFF00] text-black font-bold px-2 py-0.5 text-xs rounded border border-yellow-400 overflow-x-auto select-all inline-block shadow-2xs">
                UPDATE v{branding.updateVersion || 1}: Schedule is updated.
                {branding.updateNotes?.trim() && (
                  <span>
                    {" "}
                    {branding.updateNotes
                      .split(/\b(added|removed)\b/gi)
                      .map((chunk, i) =>
                        /^(added|removed)$/i.test(chunk) ? (
                          <span key={i} className="text-[#FF0000] font-black">
                            {chunk}
                          </span>
                        ) : (
                          chunk
                        )
                      )}
                  </span>
                )}
              </div>
            </div>

            {/* Stacked Previous Version Notes (Unhighlighted & Unbold with red 'added'/'removed') */}
            {resolveStackedPreviousUpdateNotes(branding, roster).length > 0 && (
              <div className="pt-1.5 border-t border-yellow-300/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-yellow-950">
                  <span className="flex items-center space-x-1">
                    <span>Stacked Prior Version Notes (Auto-stacked, Unhighlighted & Unbold in email):</span>
                  </span>
                  <span className="text-[10px] font-medium text-yellow-800">
                    {resolveStackedPreviousUpdateNotes(branding, roster).length} prior note(s) preserved
                  </span>
                </div>
                <div className="space-y-1">
                  {resolveStackedPreviousUpdateNotes(branding, roster).map((prev, idx) => (
                    <div
                      key={idx}
                      className="bg-white/90 border border-yellow-200 rounded px-2.5 py-1 text-xs text-zinc-900 flex items-center justify-between gap-2 shadow-2xs font-normal"
                    >
                      <div className="min-w-0 flex-1 truncate">
                        <span className="font-bold text-zinc-700 mr-1.5 text-[11px]">
                          UPDATE v{prev.version}:
                        </span>
                        <span>
                          Schedule is updated.{" "}
                          {prev.notes?.trim() && (
                            <span>
                              {prev.notes
                                .split(/\b(added|removed)\b/gi)
                                .map((chunk, i) =>
                                  /^(added|removed)$/i.test(chunk) ? (
                                    <span key={i} className="text-[#FF0000] font-bold">
                                      {chunk}
                                    </span>
                                  ) : (
                                    chunk
                                  )
                                )}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">
                        v{prev.version}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conduct Study & PEDS Requirement Configuration Panel */}
      {branding.conductStudyEnabled && (
        <div className="bg-purple-50/70 border-b border-purple-200 px-4 py-3 sm:px-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center justify-center p-1 rounded-md bg-purple-700 text-white shadow-xs">
                <Compass className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-purple-950 uppercase tracking-wide">
                Conduct Study &amp; PEDS Requirement Configuration
              </span>
              <span className="text-[11px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-300">
                Active in Schedule
              </span>
            </div>

            {pedsFeedback && (
              <span className="text-xs bg-purple-100 text-purple-900 font-semibold px-2.5 py-1 rounded-md border border-purple-300 animate-in fade-in">
                {pedsFeedback}
              </span>
            )}
          </div>

          <div className="text-xs text-purple-900 bg-white/80 border border-purple-200 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-purple-950">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>Study &amp; PEDS Formatting Rules:</span>
            </div>
            <p className="text-zinc-700 pl-5">
              • <strong>Radar &amp; Parking Studies:</strong> Automatically rendered as{" "}
              <code className="text-purple-900 font-mono bg-purple-50 px-1 py-0.5 rounded text-[11px]">
                Conduct &lt;Study&gt;: &lt;Project Number&gt; &lt;City, State&gt; (&lt;Time Duration&gt;)
              </code>
            </p>
            <p className="text-zinc-700 pl-5">
              • <strong>PEDS Conduct Sight Distance Line:</strong> Add below and position freely between Install, Teardown, and Battery Swap lines using the{" "}
              <strong className="text-purple-950">↑ / ↓ Move Arrow Buttons</strong>.
            </p>
          </div>

          {/* Add PEDS Line Form */}
          <div className="bg-white border border-purple-200 rounded-lg p-3 shadow-2xs space-y-2.5">
            <div className="text-xs font-bold text-zinc-900 flex items-center space-x-1.5">
              <Footprints className="w-3.5 h-3.5 text-purple-600" />
              <span>Add PEDS Conduct Sight Distance Line</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Day</label>
                <select
                  value={selectedPedsDay}
                  onChange={(e) => setSelectedPedsDay(e.target.value)}
                  className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-md border border-purple-300 bg-purple-50/40 text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {daySelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Project Number</label>
                <input
                  type="text"
                  value={pedsProjectNumber}
                  onChange={(e) => setPedsProjectNumber(e.target.value)}
                  placeholder="e.g. 26-470285"
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">City / Agency</label>
                <input
                  type="text"
                  value={pedsCity}
                  onChange={(e) => setPedsCity(e.target.value)}
                  placeholder="e.g. City of Dallas"
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">List Number</label>
                <input
                  type="text"
                  value={pedsListNumber}
                  onChange={(e) => setPedsListNumber(e.target.value)}
                  placeholder="e.g. 105"
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleAddPedsConductLine}
                  disabled={!pedsProjectNumber.trim() && !pedsListNumber.trim() && !pedsCustomText.trim()}
                  className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold py-1.5 px-2 rounded-md text-xs transition cursor-pointer flex items-center justify-center space-x-1 shadow-xs"
                  title="Add PEDS Conduct Sight Distance line to selected day"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Live Line Preview */}
            <div className="text-[11px] text-zinc-600 bg-purple-50/50 border border-purple-200/80 rounded px-2.5 py-1 flex items-center space-x-2">
              <span className="font-semibold text-purple-900 shrink-0">Line Preview:</span>
              <span className="font-mono text-zinc-800 truncate">
                Conduct Sight Distance and additional PED requirement:{" "}
                <span className="font-bold text-purple-900">
                  {pedsProjectNumber.trim() || "<Project Number>"}
                </span>{" "}
                PEDS ({pedsCity.trim() || "City of Dallas"} – List{" "}
                <span className="font-bold text-purple-900">
                  {pedsListNumber.trim() || "<Number>"}
                </span>
                )
              </span>
            </div>
          </div>

          {/* Interactive Day Schedule Task Sequence & Ordering Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-800">
              <div className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Day Schedule Task Sequence &amp; Movable Lines</span>
              </div>
              <span className="text-[11px] text-zinc-500 font-normal">
                Use <strong className="text-zinc-700">↑ / ↓ buttons</strong> to reposition PEDS lines and task groups
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {daysDefinitions.map((def) => {
                const dayOrders = groupedOrders[def.key] || [];
                const dayScheduleItems = buildDayScheduleItems(
                  def.key,
                  def.baseDayName,
                  dayOrders,
                  branding
                );

                if (dayScheduleItems.length === 0) return null;

                return (
                  <div
                    key={def.key}
                    className="bg-white border border-purple-200 rounded-lg p-2.5 shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between border-b border-purple-100 pb-1">
                      <span className="text-xs font-bold text-purple-950 flex items-center space-x-1">
                        <span>{def.displayName}</span>
                        <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded-full font-semibold">
                          {dayScheduleItems.length} item{dayScheduleItems.length > 1 ? "s" : ""}
                        </span>
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayScheduleItems.map((item, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === dayScheduleItems.length - 1;
                        const isPeds = item.type === "peds_conduct";

                        const getBadge = () => {
                          if (isPeds) {
                            return (
                              <span className="bg-purple-100 text-purple-900 border border-purple-300 font-bold px-1.5 py-0.2 rounded text-[10px] shrink-0">
                                PEDS Conduct
                              </span>
                            );
                          }
                          if (item.category === "ConductStudy") {
                            return (
                              <span className="bg-violet-100 text-violet-900 border border-violet-300 font-bold px-1.5 py-0.2 rounded text-[10px] shrink-0">
                                Conduct Study
                              </span>
                            );
                          }
                          if (item.category === "BatterySwap") {
                            return (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded text-[10px] shrink-0">
                                Battery Swap
                              </span>
                            );
                          }
                          if (item.category === "Teardown") {
                            return (
                              <span className="bg-blue-100 text-blue-900 border border-blue-300 font-bold px-1.5 py-0.2 rounded text-[10px] shrink-0">
                                Teardown
                              </span>
                            );
                          }
                          return (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-1.5 py-0.2 rounded text-[10px] shrink-0">
                              Install
                            </span>
                          );
                        };

                        return (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded text-xs border ${
                              isPeds
                                ? "bg-purple-50/80 border-purple-300 text-purple-950 font-medium"
                                : "bg-zinc-50 border-zinc-200 text-zinc-800"
                            }`}
                          >
                            <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                              {getBadge()}
                              <span className="truncate text-[11px]" title={item.title}>
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center space-x-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() =>
                                  handleMoveScheduleItem(
                                    def.key,
                                    def.baseDayName,
                                    dayOrders,
                                    item.id,
                                    "up"
                                  )
                                }
                                className="p-1 rounded hover:bg-zinc-200 disabled:opacity-25 text-zinc-700 transition cursor-pointer"
                                title="Move line Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() =>
                                  handleMoveScheduleItem(
                                    def.key,
                                    def.baseDayName,
                                    dayOrders,
                                    item.id,
                                    "down"
                                  )
                                }
                                className="p-1 rounded hover:bg-zinc-200 disabled:opacity-25 text-zinc-700 transition cursor-pointer"
                                title="Move line Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>

                              {isPeds && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePedsConductLine(item.id)}
                                  className="p-1 rounded hover:bg-red-100 text-red-600 transition cursor-pointer ml-0.5"
                                  title="Delete PEDS line"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Google Maps App Link Placeholder & Embedding */}
      <div className="bg-emerald-50/40 border-b border-emerald-200/80 px-4 py-3 sm:px-6 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="inline-flex items-center justify-center p-1 rounded-md bg-emerald-700 text-white shadow-xs">
              <Globe className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Google Maps App Link Placeholder
            </span>
            <span className="text-[11px] font-mono text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300 font-semibold">
              🌍 Google Maps App: {cleanTechnicianName(roster.technicianName)} | {weekInfo.formattedRange} Maps
            </span>
            {isAutoEmbeddedFromInitial ? (
              <span className="text-[11px] bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-full border border-blue-300 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-blue-700" />
                <span>Auto-Embedded from Initial Email ({initialEmailStoredLinks.sourceVersion || "v0"})</span>
              </span>
            ) : activeCustomMapUrl ? (
              <span className="text-[11px] bg-emerald-200/90 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-400 flex items-center space-x-1">
                <Check className="w-3 h-3 text-emerald-700" />
                <span>Custom Link Embedded</span>
              </span>
            ) : (
              <span className="text-[11px] bg-zinc-200/70 text-zinc-700 font-medium px-2 py-0.5 rounded-full border border-zinc-300">
                Default Route Search
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={resolvedGoogleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition shadow-2xs"
              title="Open current Google Maps URL in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
              <span>Test / Open Link</span>
            </a>
            {activeCustomMapUrl && (
              <button
                type="button"
                onClick={handleResetGoogleMapsUrl}
                className="text-zinc-600 hover:text-red-700 text-xs px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-zinc-300 bg-white hover:bg-red-50"
                title="Reset to default route query"
              >
                Reset Default
              </button>
            )}
          </div>
        </div>

        {/* Input box for pasting or typing custom Google Maps URL */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-emerald-700">
              <LinkIcon className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={activeCustomMapUrl}
              onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
              placeholder={
                isAutoEmbeddedFromInitial
                  ? `Auto-embedded from initial email: ${initialEmailStoredLinks.googleMapsUrl}`
                  : `Paste link to embed for Google Maps App: e.g. https://www.google.com/maps/d/u/0/viewer?mid=... or https://maps.app.goo.gl/... (Default: https://maps.google.com/?q=${encodeURIComponent(cleanTechnicianName(roster.technicianName))})`
              }
              className="w-full text-xs font-mono pl-8 pr-3 py-2 rounded-lg border border-emerald-300/90 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition placeholder:text-zinc-400 text-zinc-900 shadow-2xs"
            />
          </div>
        </div>
        {isAutoEmbeddedFromInitial && (
          <div className="text-[11px] text-blue-900 bg-blue-50/80 border border-blue-200/80 rounded-md px-2.5 py-1 flex items-center space-x-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Auto-Embedded Link:</strong> Reused Google Maps link from the initial email ({initialEmailStoredLinks.sourceVersion || "v0"}) for {cleanTechnicianName(roster.technicianName)} in work week {weekInfo.formattedRange}.
            </span>
          </div>
        )}
      </div>

      {/* Email Attachments Placeholder & Dropzone */}
      <div className="bg-zinc-50/95 border-b border-zinc-200 px-4 py-3 sm:px-6 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="inline-flex items-center justify-center p-1 rounded-md bg-blue-600 text-white shadow-xs">
              <Paperclip className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
              Email Attachments Placeholder
            </span>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-300">
              {attachments.length} {attachments.length === 1 ? "file" : "files"}
            </span>
            {attachments.length > 0 && (
              <span className="text-[11px] text-zinc-500 font-mono">
                ({formatFileSize(attachments.reduce((acc, a) => acc + (a.size || 0), 0))} total)
              </span>
            )}
            <span className="text-[11px] text-zinc-500 hidden md:inline">
              (Accepts any file formats: .pdf, .kmz, .kml, .csv, .xlsx, .docx, images, etc. Attached automatically upon exporting to Outlook .EML)
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Attach Files</span>
            </button>
            {attachments.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllAttachments}
                className="text-zinc-500 hover:text-red-600 text-xs px-2 py-1 rounded transition cursor-pointer border border-zinc-300 bg-white"
                title="Remove all attachments"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Drag & Drop Box or Attached Files Chips */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-lg border-2 border-dashed transition-all p-3 ${
            isDraggingFile
              ? "border-blue-500 bg-blue-50/80 scale-[1.005]"
              : attachments.length > 0
              ? "border-zinc-300 bg-white"
              : "border-zinc-300 bg-zinc-100/50 hover:bg-zinc-100"
          }`}
        >
          {attachments.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center py-2 cursor-pointer text-zinc-500 hover:text-zinc-700 select-none"
            >
              <Paperclip className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-xs">
                <strong>Drop attachments here</strong> or <span className="text-blue-600 underline font-semibold">browse files</span> (.pdf, .kmz, .kml, .csv, .xlsx, .docx, images, etc.)
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-xs shadow-2xs ${getFileBadgeColor(
                    att.name
                  )}`}
                >
                  {getFileIcon(att.name)}
                  <span className="font-semibold text-zinc-900 max-w-[180px] sm:max-w-[240px] truncate" title={att.name}>
                    {att.name}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({formatFileSize(att.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="text-zinc-400 hover:text-red-600 p-0.5 rounded transition cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Outlook Desktop Simulator Container */}
      <div className="p-4 sm:p-6 bg-zinc-100/60 flex-1 flex flex-col items-center justify-center overflow-x-auto min-h-[500px]">
        {viewMode === "desktop" && (
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-md border border-zinc-300 overflow-hidden flex flex-col">
            {/* Outlook Window Titlebar */}
            <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center justify-between text-xs select-none">
              <div className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Microsoft Outlook — Message Viewer</span>
              </div>
              <div className="flex items-center space-x-2 text-white/80">
                <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-white/40 inline-block"></span>
              </div>
            </div>

            {/* Outlook Simplified Ribbon */}
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-1.5 flex items-center space-x-4 text-xs text-zinc-600 select-none">
              <span className="font-semibold text-blue-700 border-b-2 border-blue-600 pb-0.5">Message</span>
              <span className="hover:text-zinc-900 cursor-pointer">Insert</span>
              <span className="hover:text-zinc-900 cursor-pointer">Options</span>
              <span className="hover:text-zinc-900 cursor-pointer">Format Text</span>
              <span className="hover:text-zinc-900 cursor-pointer">Review</span>
            </div>

            {/* Outlook Headers (From / To / Subject / Attachments) */}
            <div className="p-4 bg-white border-b border-zinc-200 space-y-2 text-xs font-sans">
              <div className="flex items-center">
                <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px]">From:</span>
                <span className="font-medium text-zinc-800">
                  {branding.dispatcherName} &lt;{branding.replyToEmail}&gt;
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px]">To:</span>
                <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {roster.technicianName} &lt;{roster.technicianEmail}&gt;
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px]">Date:</span>
                <span className="text-zinc-600">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex items-start">
                <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px] mt-0.5">Subject:</span>
                <span className="font-bold text-zinc-900 text-sm">{subject}</span>
              </div>

              {/* Native Outlook Attachments Header Bar */}
              {attachments.length > 0 && (
                <div className="pt-2 border-t border-zinc-100 flex items-start">
                  <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px] mt-1 flex items-center space-x-1">
                    <Paperclip className="w-3 h-3 text-zinc-400" />
                    <span>Attach:</span>
                  </span>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="bg-zinc-50 border border-zinc-300 rounded px-2 py-1 text-[11px] flex items-center space-x-1.5 shadow-2xs hover:bg-zinc-100 transition"
                      >
                        {getFileIcon(att.name)}
                        <span className="font-medium text-zinc-800 max-w-[160px] truncate" title={att.name}>
                          {att.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ({formatFileSize(att.size)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email Body Preview (Rendered HTML) */}
            <div className="p-4 bg-[#F8FAFC] overflow-y-auto max-h-[600px]">
              <div
                className="outlook-body-wrapper"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          </div>
        )}

        {viewMode === "mobile" && (
          <div className="w-[380px] bg-zinc-900 rounded-[38px] p-3 shadow-xl border-4 border-zinc-700">
            {/* Phone Screen Notch */}
            <div className="w-32 h-4 bg-zinc-800 rounded-full mx-auto mb-2"></div>
            {/* Mobile App Screen */}
            <div className="bg-white rounded-[28px] overflow-hidden flex flex-col h-[580px]">
              {/* Mobile Outlook App Bar */}
              <div className="bg-[#0078D4] text-white p-3 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span className="font-bold">Outlook Mobile</span>
                </div>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Inbox</span>
              </div>

              {/* Mobile Message Headers */}
              <div className="p-3 bg-zinc-50 border-b border-zinc-200 text-xs">
                <div className="font-bold text-zinc-900 text-[13px]">{subject}</div>
                <div className="text-[11px] text-zinc-500 mt-1">From: {branding.dispatcherName}</div>
                <div className="text-[11px] text-blue-600">To: {roster.technicianName}</div>
                {attachments.length > 0 && (
                  <div className="mt-1 text-[11px] text-zinc-600 flex items-center space-x-1 bg-white px-2 py-0.5 rounded border border-zinc-200">
                    <Paperclip className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="font-semibold">{attachments.length} Attachment(s):</span>
                    <span className="truncate text-zinc-500 text-[10px]">
                      {attachments.map((a) => a.name).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile Body */}
              <div className="p-2 bg-[#F8FAFC] overflow-y-auto flex-1">
                <div
                  className="scale-95 origin-top"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Export Actions Toolbar */}
      <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 flex items-center space-x-2 flex-wrap gap-y-1">
          <span>
            Ready to distribute to <span className="font-semibold text-zinc-900">{roster.technicianEmail}</span>
          </span>
          {manualSaveSuccess && (
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center space-x-1 animate-in fade-in duration-150">
              <Check className="w-3 h-3" />
              <span>Saved to History!</span>
            </span>
          )}
          {clearNotice && (
            <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center space-x-1 animate-in fade-in duration-150">
              <RotateCcw className="w-3 h-3 text-blue-700" />
              <span>Preview Cleared &amp; Reset!</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clear Preview Button (Red color) */}
          <button
            type="button"
            onClick={handleClearPreview}
            className="flex items-center space-x-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-lg border border-red-700 shadow-xs transition cursor-pointer"
            title="Clear the current preview configurations, notes, and update details to generate a fresh email from scratch"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white" />
            <span>Clear Preview</span>
          </button>

          {/* Manual Save / Mark as Generated (Yellow color) */}
          <button
            type="button"
            onClick={handleManualMarkGenerated}
            className="flex items-center space-x-1.5 text-xs font-bold bg-yellow-400 hover:bg-yellow-500 text-zinc-950 px-3.5 py-2 rounded-lg border border-yellow-500 shadow-xs transition cursor-pointer"
            title="Saves this generated email version to browser local storage history"
          >
            <Save className="w-3.5 h-3.5 text-zinc-950" />
            <span>Save to History</span>
          </button>

          {/* Download .EML file / Export Button (Blue color) */}
          <button
            onClick={handleDownloadEml}
            className="flex items-center space-x-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg border border-blue-700 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span>Download Outlook (.EML)</span>
          </button>
        </div>
      </div>

      {/* --- Multi-Select Presets Modal --- */}
      {showMultiSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Multi-Select Presets &amp; Assign Days</h3>
                  <p className="text-xs text-zinc-400">Select multiple saved presets and choose a specific target day for each</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMultiSelectModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Toolbar: Batch Day Selector & Select All / Deselect All */}
            <div className="p-3.5 bg-zinc-50 border-b border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSelectAllPresets}
                  className="font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllPresets}
                  className="font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  Deselect All
                </button>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {multiSelectPresetIds.length} of {allPresets.length} selected
                </span>
              </div>

              {/* Bulk Day Assignment */}
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <span className="text-zinc-600 font-medium text-[11px]">Set all selected to:</span>
                <select
                  value={multiSelectBulkDay}
                  onChange={(e) => setMultiSelectBulkDay(e.target.value)}
                  className="bg-white border border-zinc-300 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                >
                  {daySelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyBulkDayToSelected}
                  disabled={multiSelectPresetIds.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-2.5 py-1 rounded-lg transition cursor-pointer text-xs"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Presets List with Individual Day Selector */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-zinc-100">
              {allPresets.map((preset) => {
                const isSelected = multiSelectPresetIds.includes(preset.id);
                const assignedDay = multiSelectDayMap[preset.id] || selectedNoteDay || "Sunday";

                return (
                  <div
                    key={preset.id}
                    className={`pt-2 first:pt-0 p-2.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                        : "bg-white border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* Checkbox & Text */}
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePresetSelection(preset.id)}
                        className="mt-0.5 text-zinc-700 hover:text-emerald-700 cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-zinc-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span
                            onClick={() => handleTogglePresetSelection(preset.id)}
                            className="font-bold text-xs text-zinc-900 cursor-pointer hover:underline"
                          >
                            {preset.title}
                          </span>
                          {!preset.isBuiltIn ? (
                            <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-300">
                              Custom Saved
                            </span>
                          ) : (
                            <span className="bg-zinc-100 text-zinc-600 text-[9px] font-medium px-1.5 py-0.2 rounded">
                              Built-in Template
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs">
                          <span className="bg-[#00FF00] text-black font-bold italic px-1.5 py-0.5 rounded text-[11px] inline-block shadow-2xs">
                            {formatNoteTextWithPrefix(preset.text)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Individual Day Dropdown for this note */}
                    <div className="flex items-center space-x-2 shrink-0 sm:self-center pl-8 sm:pl-0">
                      <span className="text-[11px] font-bold text-zinc-600">Assign Day:</span>
                      <select
                        value={assignedDay}
                        onChange={(e) => {
                          handleSetPresetDay(preset.id, e.target.value);
                          // Auto-select if changed
                          if (!isSelected) {
                            handleTogglePresetSelection(preset.id);
                          }
                        }}
                        className={`bg-white border rounded-lg px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer ${
                          isSelected
                            ? "border-emerald-500 text-emerald-950 font-bold bg-emerald-50/50"
                            : "border-zinc-300 text-zinc-700"
                        }`}
                      >
                        {daySelectOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs">
              <div className="text-zinc-600 font-medium">
                {multiSelectPresetIds.length > 0 ? (
                  <span>
                    Ready to add <strong className="text-emerald-800">{multiSelectPresetIds.length}</strong> note(s) to schedule
                  </span>
                ) : (
                  <span>No presets selected</span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowMultiSelectModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 font-semibold hover:bg-zinc-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddMultiSelectedPresetsToSchedule}
                  disabled={multiSelectPresetIds.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold transition cursor-pointer shadow-xs flex items-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add {multiSelectPresetIds.length} Selected Notes to Schedule</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Generated Emails Local Storage History Modal --- */}
      <GeneratedEmailsHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        history={storedEmails}
        activeTechName={roster.technicianName}
        activeWorkWeek={weekInfo.formattedRange}
        onDeleteRecord={handleDeleteGeneratedEmail}
        onClearTechHistory={handleClearTechHistory}
      />

      {/* --- City of Dallas (COD Exclusive) Options & Sight Distance Modal --- */}
      <CodSightDistanceModal
        isOpen={showCodSightDistanceModal}
        onClose={() => setShowCodSightDistanceModal(false)}
        roster={roster}
        branding={branding}
        onSaveLocations={(locs, schoolZoneConfig) => {
          if (onUpdateBranding) {
            onUpdateBranding({
              codSightDistanceLocations: locs,
              ...(schoolZoneConfig
                ? {
                    codSchoolZonePedFormEnabled: schoolZoneConfig.enabled,
                    codSchoolZonePedFormUrl: schoolZoneConfig.url,
                    codSchoolZonePedFormText: schoolZoneConfig.text,
                  }
                : {}),
            });
          }
          setPresetFeedback("Updated City of Dallas (COD) settings & schedule!");
          setTimeout(() => setPresetFeedback(null), 3000);
        }}
      />
    </div>
  );
};
