import JSZip from "jszip";
import {
  TechnicianRoster,
  TemplateStyle,
  TemplateBranding,
  WorkOrder,
  EmailAttachment,
  PedsConductLineItem,
} from "../types";
import { extractProjectNumber, extractLocationSuffix, parseDateTimeString } from "./csvParser";
import { getTechnicianAirtableLink, getTechnicianGoogleMapsLink } from "./technicianRosterDirectory";
import { getStoredPreviousUpdateNotes } from "./generatedEmailStorage";

export const DEFAULT_COD_SCHOOL_ZONE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdfpvqvsfjC8gA8gKoByJdu1CQafOhvTP_gWMQvItjEvcprMg/viewform";
export const DEFAULT_COD_SCHOOL_ZONE_FORM_TEXT =
  "School Zone PED Count Site Data Form";

export const DEFAULT_BRANDING: TemplateBranding = {
  companyName: "NDS Data & Field Services",
  dispatcherName: "Central Dispatch Team",
  dispatcherTitle: "Field Resource Coordinator",
  replyToEmail: "dispatch@ndsdata.com",
  supportPhone: "1-800-555-TECH",
  primaryColor: "#0078D4", // Microsoft 365 Outlook Blue
  accentColor: "#107C41", // Excel Green / Success
  includeMapLinks: true,
  includeChecklist: true,
  customDisclaimer: "Please complete digital safety walk-around before operating fleet vehicle. Log all arrival times in field portal.",
  greetingPrefix: "Hello",
  emergencyHotline: "1-800-555-9110",
  // Exact template default fields
  photoUploadLinkText: "South Central Job Photos",
  photoUploadUrl: "https://airtable.com/appsVo4SWcGXTkarK/shrBgw2x5NJZwU3Xo",
  airtableBaseUrl: "https://airtable.com",
  googleMapsBaseUrl: "https://maps.google.com",
  privateJobsNotice: "(FOR PRIVATE JOBS, PLEASE UPLOAD FIELD PHOTOS TO GOOGLE CHAT ONLY IN REAL TIME)",
  dataUploadEmail: "jobs@ndsdata.com",
  useAnytimeTeardowns: false,
  ladotdExclusive: false,
  codExclusive: false,
  codSightDistanceLocations: {},
  codSchoolZonePedFormEnabled: true,
  codSchoolZonePedFormUrl: DEFAULT_COD_SCHOOL_ZONE_FORM_URL,
  codSchoolZonePedFormText: DEFAULT_COD_SCHOOL_ZONE_FORM_TEXT,
  emailUpdatesEnabled: false,
  updateVersion: 1,
  updateNotes: "",
  additionalNotesEnabled: false,
  additionalNotes: [],
  sundaySundayEnabled: false,
  overlappingSchedulesEnabled: false,
  conductStudyEnabled: false,
  pedsConductLines: [],
  dayItemOrderOverrides: {},
};

/**
 * Parse numeric unit count from a camera count or backup units string
 */
export function parseUnitNumber(val?: string): number {
  if (!val) return 0;
  const trimmed = val.trim().toLowerCase();
  if (trimmed === "" || trimmed === "0" || ["none", "no", "n/a", "na"].includes(trimmed)) return 0;
  const match = trimmed.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Detects whether an order has a Manual collection method.
 * If Manual, equipment details are disregarded and omitted.
 */
export function isManualOrder(order: WorkOrder): boolean {
  const methodStr = (order.method || "").trim().toLowerCase();
  if (methodStr.includes("manual")) {
    return true;
  }

  if (order.rawRowData) {
    for (const [k, v] of Object.entries(order.rawRowData)) {
      if (/\b(method|equipment|collection)\b/i.test(k) && v) {
        const vStr = String(v).trim().toLowerCase();
        if (vStr.includes("manual")) {
          return true;
        }
      }
    }
  }

  const jobTypeLower = (order.jobType || "").toLowerCase();
  const addOnsLower = (order.serviceTypeAddOns || "").toLowerCase();
  if (jobTypeLower === "manual" || addOnsLower.includes("manual count") || addOnsLower === "manual") {
    return true;
  }

  return false;
}

/**
 * Detects whether an order is an ATR / Machine unit.
 * Rule:
 * - If Method contains "Cam", "Camera", "Algorithm", "Video", "Miovision", "Scout" -> Camera (returns false)
 *   e.g. "Cam - ATR Speed Algorithm" -> Camera (false)
 *   e.g. "Cam - ATR Algorithm" -> Camera (false)
 * - If Method is "ATR", "Machine", "Tube", "Tubes", etc. -> Machine (returns true)
 */
export function isMachineOrder(order: WorkOrder): boolean {
  if (isManualOrder(order)) {
    return false;
  }

  const methodStr = (order.method || "").trim().toUpperCase();
  if (methodStr) {
    // If it contains camera/algorithm indicators, it is a Camera, NOT a Machine
    if (
      methodStr.includes("CAM") ||
      methodStr.includes("CAMERA") ||
      methodStr.includes("ALGORITHM") ||
      methodStr.includes("VIDEO") ||
      methodStr.includes("MIOVISION") ||
      methodStr.includes("SCOUT")
    ) {
      return false;
    }
    if (/\bATR\b/i.test(methodStr) || methodStr.includes("MACHINE") || methodStr.includes("TUBE")) {
      return true;
    }
  }

  if (order.rawRowData) {
    for (const [k, v] of Object.entries(order.rawRowData)) {
      if (/\b(method|equipment|collection)\b/i.test(k) && v) {
        const vStr = String(v).trim().toUpperCase();
        if (
          vStr.includes("CAM") ||
          vStr.includes("CAMERA") ||
          vStr.includes("ALGORITHM") ||
          vStr.includes("VIDEO") ||
          vStr.includes("MIOVISION") ||
          vStr.includes("SCOUT")
        ) {
          return false;
        }
        if (/\bATR\b/i.test(vStr) || vStr.includes("MACHINE") || vStr.includes("TUBE")) {
          return true;
        }
      }
    }
  }

  const jobTypeUpper = (order.jobType || "").toUpperCase();
  const addOnsUpper = (order.serviceTypeAddOns || "").toUpperCase();

  if (
    jobTypeUpper.includes("CAM") ||
    jobTypeUpper.includes("CAMERA") ||
    jobTypeUpper.includes("ALGORITHM") ||
    addOnsUpper.includes("CAM") ||
    addOnsUpper.includes("CAMERA") ||
    addOnsUpper.includes("ALGORITHM")
  ) {
    return false;
  }

  if (/\bATR\b/i.test(jobTypeUpper) || /\bATR\b/i.test(addOnsUpper) || jobTypeUpper.includes("MACHINE") || addOnsUpper.includes("MACHINE")) {
    return true;
  }

  return false;
}

export interface JoinedLadotdNoteInfo {
  joinedSuffix: string;
  locNumbers: string[];
  unitText: string;
  extraNotes: string;
  originalNote: string;
}

/**
 * Parses LADOTD Schedule Notes that specify joined locations with a single equipment count.
 * E.g. "4764, 4765, 4766, 4769 1 camera", "(4555, 4556, 4557 1 camera)", "4555, 4556, 4557 - 2 cameras"
 */
export function parseJoinedLadotdNote(notes?: string): JoinedLadotdNoteInfo | null {
  if (!notes) return null;
  const clean = notes.trim();

  const regex = /(?:^|\(|\b)((?:\d{3,5}\s*(?:,|\/|and|&|\s)\s*)+\d{3,5})\s*[-:,]?\s*\(?(\d+\s*(?:cameras?|machines?|units?|cams?))\)?/i;
  const match = clean.match(regex);
  if (match) {
    const rawLocs = match[1];
    let unitPart = match[2].trim();
    unitPart = unitPart.replace(/\bcams\b/i, "cameras").replace(/\bcam\b/i, "camera");
    const locNumbers = rawLocs.split(/[\s,\/&]+|and/i).filter(Boolean);
    if (locNumbers.length > 1 && locNumbers.every((n) => /^\d{3,5}$/.test(n))) {
      const afterMatch = clean.replace(match[0], "").replace(/^[,\s()\-:]+/, "").replace(/[,\s()]+$/, "").trim();
      return {
        joinedSuffix: locNumbers.join(", "),
        locNumbers,
        unitText: unitPart,
        extraNotes: afterMatch ? `(${afterMatch})` : "",
        originalNote: clean,
      };
    }
  }
  return null;
}

/**
 * Formats parent / headline counts for Installs, Teardowns, Battery Swaps lines.
 * Examples:
 * - "(4 cameras / 2 machines)"
 * - "(4 cameras)"
 * - "(2 machines)"
 * - "(1 camera)"
 * - "(1 machine)"
 * Note: Orders with Method = "Manual" are disregarded and not counted.
 */
export function formatNDSGroupUnitCounts(orders: WorkOrder[], isLadotdActive?: boolean): string {
  let totalCameras = 0;
  let totalMachines = 0;
  const coveredSuffixes = new Set<string>();

  if (isLadotdActive) {
    for (const ord of orders) {
      const noteSrc = ord.scheduleNotes || (ord.rawRowData && ord.rawRowData["Schedule Notes"]) || ord.specialInstructions || ord.description || "";
      const parsed = parseJoinedLadotdNote(noteSrc);
      if (parsed) {
        if (parsed.locNumbers.some((n) => coveredSuffixes.has(n))) continue;
        parsed.locNumbers.forEach((n) => coveredSuffixes.add(n));

        const countMatch = parsed.unitText.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0], 10) : 1;
        if (/machine/i.test(parsed.unitText)) {
          totalMachines += count;
        } else {
          totalCameras += count;
        }
      }
    }
  }

  orders.forEach((ord) => {
    const s = ord.locationId
      ? extractLocationSuffix(ord.locationId)
      : extractLocationSuffix(ord.orderNumber);
    if (s && coveredSuffixes.has(s)) {
      return;
    }

    // Disregard manual method orders completely from equipment counts
    if (isManualOrder(ord)) {
      return;
    }

    const isMach = isMachineOrder(ord);

    let count = 1;
    if (ord.cameraCounts !== undefined && ord.cameraCounts !== "") {
      const trimmed = ord.cameraCounts.trim();
      if (/^0\s*(cameras?|machines?|units?)?$/i.test(trimmed) || trimmed === "0") {
        count = 0;
      } else {
        count = parseUnitNumber(trimmed);
        if (count === 0 && !["none", "no", "n/a", "na"].includes(trimmed.toLowerCase())) {
          count = 1;
        }
      }
    }

    let backupCount = 0;
    if (ord.backupUnits !== undefined && ord.backupUnits !== "") {
      const trimmedB = ord.backupUnits.trim();
      if (trimmedB !== "0" && !["none", "no", "n/a", "na"].includes(trimmedB.toLowerCase())) {
        backupCount = parseUnitNumber(trimmedB);
      }
    }

    const units = count + backupCount;
    if (isMach) {
      totalMachines += units;
    } else {
      totalCameras += units;
    }
  });

  const parts: string[] = [];
  if (totalCameras > 0) {
    parts.push(totalCameras === 1 ? "1 camera" : `${totalCameras} cameras`);
  }
  if (totalMachines > 0) {
    parts.push(totalMachines === 1 ? "1 machine" : `${totalMachines} machines`);
  }

  if (parts.length === 0) return "";
  return `(${parts.join(" / ")})`;
}

export function formatNDSCameraCount(count?: string): string {
  if (!count) return "";
  const trimmed = count.trim();
  if (trimmed === "" || trimmed === "0" || ["none", "no", "n/a", "na"].includes(trimmed.toLowerCase())) return "";
  const clean = trimmed.replace(/^\(/, "").replace(/\)$/, "").trim();
  if (clean === "" || clean === "0" || clean === "0 cameras" || clean === "0 camera") return "";
  if (/^0\s*cameras?$/i.test(clean)) return "";
  if (/^\d+$/.test(clean)) {
    const num = parseInt(clean, 10);
    if (num === 0) return "";
    return num === 1 ? `(1 camera)` : `(${num} cameras)`;
  }
  if (clean.toLowerCase().includes("camera")) {
    const numMatch = clean.match(/^(\d+)/);
    if (numMatch && parseInt(numMatch[1], 10) === 0) return "";
    return `(${clean})`;
  }
  return `(${clean})`;
}

export interface FormattedBulletItem {
  suffix: string;
  unitText: string;
  isMachine: boolean;
  isManual: boolean;
  notesText: string;
  isRedo: boolean;
  fullText: string;
}

/**
 * Formats a location bullet point with:
 * - Location Suffix (e.g. 001, 5666)
 * - Units (e.g. "1 camera", "1 machine", "1 camera + 1 backup", "2 machines") -> Omitted if Method = "Manual"
 * - Schedule Notes (e.g. "(East corner pole)")
 * - REDO (if checked on the row)
 * E.g.: "• 001 1 camera + 1 backup (East corner pole) REDO" or "• 001 1 machine" or "• 001" (if Manual)
 */
export function formatBulletItem(order: WorkOrder): FormattedBulletItem {
  const suffix = order.locationId
    ? extractLocationSuffix(order.locationId)
    : extractLocationSuffix(order.orderNumber);

  const isManual = isManualOrder(order);
  const isMach = isMachineOrder(order);
  const unitLabelSingle = isMach ? "machine" : "camera";
  const unitLabelPlural = isMach ? "machines" : "cameras";

  let mainUnitText = "";
  if (isManual) {
    // If Manual method is scanned, disregard equipment and do not put anything as equipment
    mainUnitText = "";
  } else if (order.cameraCounts !== undefined && order.cameraCounts.trim() !== "") {
    const trimmed = order.cameraCounts.trim().replace(/^\(/, "").replace(/\)$/, "").trim();
    if (trimmed !== "" && trimmed !== "0" && !["none", "no", "n/a", "na"].includes(trimmed.toLowerCase())) {
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (num > 0) {
          mainUnitText = num === 1 ? `1 ${unitLabelSingle}` : `${num} ${unitLabelPlural}`;
        }
      } else {
        const matchNum = trimmed.match(/^(\d+)/);
        if (matchNum && parseInt(matchNum[1], 10) === 0) {
          mainUnitText = ""; // 0 units -> omit
        } else if (!/^0\s*(cameras?|machines?)?$/i.test(trimmed)) {
          // If string contains "camera" and we are in machine mode, swap to machine
          if (isMach) {
            mainUnitText = trimmed.replace(/\bcameras?\b/gi, (m) => /s$/i.test(m) ? "machines" : "machine");
          } else {
            mainUnitText = trimmed;
          }
        }
      }
    }
  } else {
    // Default to 1 camera or 1 machine
    mainUnitText = `1 ${unitLabelSingle}`;
  }

  let backupText = "";
  if (!isManual && order.backupUnits && order.backupUnits.trim() !== "") {
    const trimmedB = order.backupUnits.trim().replace(/^\(/, "").replace(/\)$/, "");
    if (trimmedB !== "0" && !["none", "no", "n/a", "na"].includes(trimmedB.toLowerCase())) {
      if (/^\d+$/.test(trimmedB)) {
        const numB = parseInt(trimmedB, 10);
        if (numB > 0) {
          backupText = numB === 1 ? "1 backup" : `${numB} backups`;
        }
      } else if (trimmedB.toLowerCase().includes("backup")) {
        backupText = trimmedB;
      } else {
        const matchNum = trimmedB.match(/\d+/);
        if (matchNum) {
          const numB = parseInt(matchNum[0], 10);
          if (numB > 0) {
            backupText = numB === 1 ? "1 backup" : `${numB} backups`;
          }
        } else {
          backupText = `${trimmedB} backup`;
        }
      }
    }
  }

  const parts: string[] = [];
  if (mainUnitText) parts.push(mainUnitText);
  if (backupText) {
    if (parts.length > 0) {
      parts.push(`+ ${backupText}`);
    } else {
      parts.push(backupText);
    }
  }

  const unitText = parts.join(" ");

  let notesText = "";
  if (order.scheduleNotes && order.scheduleNotes.trim() !== "") {
    const trimmedN = order.scheduleNotes.trim();
    if (!["none", "no", "n/a", "na", "null", "undefined"].includes(trimmedN.toLowerCase())) {
      // Ensure we don't display Scheduling Team Notes (or City of Dallas list keywords) on location bullets
      const isCod = /\(?\s*City\s+of\s+Dallas\s*[-–—]?\s*List\s*#?\s*\d+\s*\)?/i.test(trimmedN);
      const isSameAsTeamNotes = order.schedulingTeamNotes && (
        trimmedN.toLowerCase() === order.schedulingTeamNotes.trim().toLowerCase() ||
        `(${trimmedN.toLowerCase()})` === order.schedulingTeamNotes.trim().toLowerCase() ||
        trimmedN.toLowerCase() === `(${order.schedulingTeamNotes.trim().toLowerCase()})`
      );
      if (!isCod && !isSameAsTeamNotes) {
        notesText = trimmedN.startsWith("(") && trimmedN.endsWith(")") ? trimmedN : `(${trimmedN})`;
      }
    }
  }

  // Check if REDO is enabled
  let isRedo = Boolean(order.isRedo);
  if (!isRedo && order.rawRowData) {
    for (const [k, v] of Object.entries(order.rawRowData)) {
      if (/\bredo\b/i.test(k) && v) {
        const vLower = String(v).trim().toLowerCase();
        if (["true", "1", "yes", "y", "x", "redo", "checked", "check", "✓", "t"].includes(vLower)) {
          isRedo = true;
          break;
        }
      }
    }
  }

  const textComponents: string[] = [];
  if (suffix) textComponents.push(suffix);
  if (unitText) textComponents.push(unitText);
  if (notesText) textComponents.push(notesText);
  if (isRedo) textComponents.push("REDO");

  return {
    suffix,
    unitText,
    isMachine: isMach,
    isManual,
    notesText,
    isRedo,
    fullText: textComponents.join(" "),
  };
}

/**
 * Format camera count for bullet item (legacy signature maintained for backwards compatibility)
 */
export function formatBulletCameraCount(count?: string, backupUnits?: string, scheduleNotes?: string): string {
  let camText = "";
  if (count && count.trim() !== "") {
    const trimmed = count.trim().replace(/^\(/, "").replace(/\)$/, "").trim();
    if (trimmed !== "" && trimmed !== "0" && !["none", "no", "n/a", "na"].includes(trimmed.toLowerCase())) {
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        if (num > 0) {
          camText = num === 1 ? "1 camera" : `${num} cameras`;
        }
      } else {
        const matchNum = trimmed.match(/^(\d+)/);
        if (matchNum && parseInt(matchNum[1], 10) === 0) {
          camText = ""; // 0 cameras -> disregarded, omit
        } else if (!/^0\s*cameras?$/i.test(trimmed)) {
          camText = trimmed;
        }
      }
    }
  }

  let backupText = "";
  if (backupUnits && backupUnits.trim() !== "") {
    const trimmedB = backupUnits.trim().replace(/^\(/, "").replace(/\)$/, "");
    if (trimmedB !== "0" && !["none", "no", "n/a", "na"].includes(trimmedB.toLowerCase())) {
      if (/^\d+$/.test(trimmedB)) {
        const numB = parseInt(trimmedB, 10);
        if (numB > 0) {
          backupText = numB === 1 ? "1 backup" : `${numB} backups`;
        }
      } else if (trimmedB.toLowerCase().includes("backup")) {
        backupText = trimmedB;
      } else {
        const matchNum = trimmedB.match(/\d+/);
        if (matchNum) {
          const numB = parseInt(matchNum[0], 10);
          if (numB > 0) {
            backupText = numB === 1 ? "1 backup" : `${numB} backups`;
          }
        } else {
          backupText = `${trimmedB} backup`;
        }
      }
    }
  }

  let parts: string[] = [];
  if (camText) parts.push(camText);
  if (backupText) {
    if (parts.length > 0) {
      parts.push(`+ ${backupText}`);
    } else {
      parts.push(backupText);
    }
  }

  let result = parts.join(" ");

  if (scheduleNotes && scheduleNotes.trim() !== "") {
    const trimmedN = scheduleNotes.trim();
    if (!["none", "no", "n/a", "na"].includes(trimmedN.toLowerCase())) {
      const noteFormatted = trimmedN.startsWith("(") && trimmedN.endsWith(")") ? trimmedN : `(${trimmedN})`;
      result = result ? `${result} ${noteFormatted}` : noteFormatted;
    }
  }

  return result.trim();
}

/**
 * Formats the Project Number and Service Type / Add Ons string.
 * Rule: If ATR is scanned in Service Types or Add Ons (or service type / job type),
 * replace "ATR" with "ALG" and place "ALG" BEFORE the <Project Number>.
 * Example:
 *   If project is "26-450222", serviceType is "Miovision", addOns has "ATR", other text "Volume" ->
 *   `ALG 26-450222 Volume` (or `ALG 26-450222 Miovision Volume`)
 *   If serviceType is "ATR" -> `ALG 26-450222`
 */
export function formatNDSProjectAndServiceLine(
  projectNumber: string,
  serviceType: string,
  rawAddOns: string
): { prefix: string; formattedHtml: string; formattedText: string } {
  let isAtr = false;

  // Check if ATR is present in serviceType or addOns (case-insensitive word boundary)
  if (/\bATR\b/i.test(serviceType)) {
    isAtr = true;
  }
  if (/\bATR\b/i.test(rawAddOns)) {
    isAtr = true;
  }

  // Clean ATR out of serviceType and addOns if present
  let cleanServiceType = serviceType.replace(/\bATR\b/gi, "").replace(/\s+/g, " ").trim();
  let cleanAddOns = rawAddOns.replace(/\bATR\b/gi, "").replace(/\s+/g, " ").trim();

  // If serviceType became empty after removing ATR, or was default Miovision and ATR was in addOns
  // Note: If serviceType is "ALG", it also acts as a prefix before project number
  let prefix = "";
  if (isAtr) {
    prefix = "ALG";
  } else if (cleanServiceType.toUpperCase() === "ALG") {
    prefix = "ALG";
    cleanServiceType = "";
  }

  // If service type contains TMC and add-ons are present, insert "w/" between them if not already present
  if (cleanServiceType.toUpperCase().includes("TMC") && cleanAddOns) {
    if (!/^w\//i.test(cleanAddOns) && !/^with\s+/i.test(cleanAddOns)) {
      cleanAddOns = `w/ ${cleanAddOns}`;
    }
  }

  // Construct trailing service info (e.g. "TMC", "Miovision", "w/ Heavy Trucks", "Volume")
  const trailingParts: string[] = [];
  if (cleanServiceType && cleanServiceType.toUpperCase() !== "ALG") {
    trailingParts.push(cleanServiceType);
  }
  if (cleanAddOns) {
    trailingParts.push(cleanAddOns);
  }
  const trailingStr = trailingParts.join(" ").trim();
  const trailingWithSpace = trailingStr ? `${trailingStr} ` : "";

  let formattedHtml = "";
  let formattedText = "";

  if (prefix) {
    formattedHtml = `${prefix} ${projectNumber ? projectNumber + " " : ""}${trailingWithSpace}`.trim();
    formattedText = `${prefix} ${projectNumber ? projectNumber + " " : ""}${trailingWithSpace}`.trim();
  } else {
    formattedHtml = `${projectNumber ? projectNumber + " " : ""}${trailingWithSpace}`.trim();
    formattedText = `${projectNumber ? projectNumber + " " : ""}${trailingWithSpace}`.trim();
  }

  return { prefix, formattedHtml, formattedText };
}

export interface GroupedProjectTask {
  primaryOrder: WorkOrder;
  orders: WorkOrder[];
  isMultiLocation: boolean;
  projectNumber: string;
  category: "Install" | "Teardown" | "BatterySwap";
}

/**
 * Cleans enclosing quotes, escaped quotes, and extra whitespace from technician names.
 * e.g. '"May, Dustyn"' -> 'May, Dustyn', '""Dustyn May""' -> 'Dustyn May'
 */
export function cleanTechnicianName(name?: string): string {
  if (!name) return "";
  let cleaned = String(name).trim();
  // Remove leading/trailing quotes (single, double, smart quotes, backticks)
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
  // Remove escaped quotes or stray double quotes at boundaries
  cleaned = cleaned.replace(/\\"/g, "").replace(/\\'/g, "").trim();
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
  return cleaned;
}

/**
 * Extracts first name from a technician's full name on a first-name basis.
 * Handles both "First Last" (e.g. "Dustyn May" -> "Dustyn") and "Last, First" (e.g. "May, Dustyn" -> "Dustyn").
 * Automatically removes enclosing quotes.
 */
export function extractFirstName(fullName?: string): string {
  if (!fullName) return "Technician";
  const cleaned = cleanTechnicianName(fullName);
  if (!cleaned) return "Technician";

  // If name has a comma (e.g., "May, Dustyn" or "Fullerton, Dustin M.")
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((p) => cleanTechnicianName(p)).filter(Boolean);
    if (parts.length >= 2) {
      // The portion after the comma is the first name (and optional middle name/initial)
      const afterComma = parts[1];
      const firstNamePart = afterComma.split(/\s+/)[0];
      if (firstNamePart) {
        return cleanTechnicianName(firstNamePart);
      }
    }
  }

  // Standard "First Last" or single name format (e.g. "Dustyn May" -> "Dustyn")
  const firstWord = cleaned.split(/\s+/)[0];
  return cleanTechnicianName(firstWord) || cleaned;
}

/**
 * Converts days collection or schedule details into hours collection string (e.g. "24-hr", "48-hr", "72-hr")
 */
export function formatCollectionDurationHours(scheduleDetails?: string, daysOfCollection?: string): string {
  const combined = `${scheduleDetails || ""} ${daysOfCollection || ""}`.trim();
  if (!combined) return "24-hr";

  // Check for explicit hour patterns e.g. "24-hr", "24hr", "48-hour", "72 hours"
  const hrMatch = combined.match(/(\d+)\s*(?:-| )?\s*(?:hr|hrs|hour|hours)\b/i);
  if (hrMatch) {
    return `${hrMatch[1]}-hr`;
  }

  // Check for explicit day patterns e.g. "1 Day: Tue/Wed/Thu = TBD", "1-day", "2 days", "3-day", "1 Day"
  const dayMatch = combined.match(/(\d+)\s*(?:-| )?\s*(?:day|days)\b/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const hours = days * 24;
    return `${hours}-hr`;
  }

  // Check if string has just a number
  const singleNumMatch = combined.match(/\b(\d+)\b/);
  if (singleNumMatch) {
    const num = parseInt(singleNumMatch[1], 10);
    if (num <= 14) {
      return `${num * 24}-hr`;
    }
    return `${num}-hr`;
  }

  return "24-hr";
}

/**
 * Checks if a given time string represents 0:30 / 00:30 / 12:30 AM
 */
export function isMidnightThirtyTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  const trimmed = timeStr.trim().toLowerCase();
  if (/(?:^|\b)(?:0{1,2}:30(?::00)?|12:30(?::00)?\s*am)(?:$|\b)/i.test(trimmed)) {
    return true;
  }
  const hmMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (hmMatch) {
    let hour = parseInt(hmMatch[1], 10);
    const minute = parseInt(hmMatch[2], 10);
    const isAm = /am/i.test(trimmed);
    const isPm = /pm/i.test(trimmed);
    if (isAm && hour === 12) hour = 0;
    if (isPm && hour < 12) hour += 12;
    if (hour === 0 && minute === 30) return true;
  }
  return false;
}

/**
 * Calculates previous calendar day string YYYY-MM-DD for a given date string
 */
export function getPreviousDayDateString(dateStr: string): string {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    date.setDate(date.getDate() - 1);
    const prevY = date.getFullYear();
    const prevM = String(date.getMonth() + 1).padStart(2, "0");
    const prevD = String(date.getDate()).padStart(2, "0");
    return `${prevY}-${prevM}-${prevD}`;
  }
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    parsed.setDate(parsed.getDate() - 1);
    return parsed.toISOString().split("T")[0];
  }
  return dateStr;
}

/**
 * Resolves the effective schedule date for a work order.
 * - If order is a Teardown with 0:30 time and Anytime toggle is OFF:
 *   adjusts date to the day BEFORE the Teardown After date (e.g., Wednesday -> Tuesday).
 * - If Anytime toggle is ON:
 *   uses the exact Date in Teardown After column (e.g. Wednesday stays Wednesday).
 */
export function resolveOrderEffectiveDate(order: WorkOrder, useAnytimeTeardowns?: boolean): string {
  if (order.taskCategory === "Teardown" && !useAnytimeTeardowns) {
    const rawAfter = (order.teardownAfter || "").trim();
    const timeSlot = (order.timeSlot || "").trim();
    const timeNotes = (order.teardownTimeNotes || "").trim();

    let timeStr = "";
    let baseDate = order.date;
    if (rawAfter) {
      const parsed = parseDateTimeString(rawAfter);
      if (parsed) {
        if (parsed.timeSlot) timeStr = parsed.timeSlot;
        if (parsed.date) baseDate = parsed.date;
      }
    }
    if (!timeStr && timeSlot && !timeSlot.toLowerCase().includes("tbd") && !timeSlot.toLowerCase().includes("anytime")) {
      timeStr = timeSlot;
    }
    if (!timeStr && timeNotes && timeNotes.toLowerCase() !== "anytime") {
      timeStr = timeNotes;
    }

    if (isMidnightThirtyTime(timeStr)) {
      return getPreviousDayDateString(baseDate);
    }
  }
  return order.date;
}

/**
 * Formats Teardown Timing Note according to NDS Dispatch rules:
 * 1. If time is 0:30 (or 00:30 / 12:30 AM):
 *    - If useAnytime is TRUE: outputs "Anytime"
 *    - If useAnytime is FALSE: outputs "After Midnight <Day section> night and a full <24-hr> collection"
 * 2. For all other times (e.g. 14:00, 18:30, 19:00):
 *    "After <Time> <Day section> <afternoon | morning | night>"
 *    (e.g., "After 18:30 Wednesday night" or "After 14:00 Wednesday afternoon")
 * 3. If no time is specified or teardownTimeNotes is "Anytime", outputs "Anytime" (or raw notes)
 */
export function formatNDSTeardownNote(
  order: WorkOrder,
  daySection?: string,
  useAnytime?: boolean
): string {
  const rawNotes = (order.teardownTimeNotes || "").trim();
  const rawAfter = (order.teardownAfter || "").trim();
  const rawTimeSlot = (order.timeSlot || "").trim();

  // 1. Detect time string and date
  let timeStr = "";
  let extractedDateStr = order.date || "";

  if (rawAfter) {
    const parsed = parseDateTimeString(rawAfter);
    if (parsed) {
      if (parsed.timeSlot) timeStr = parsed.timeSlot;
      if (parsed.date) extractedDateStr = parsed.date;
    }
  }

  if (!timeStr && rawTimeSlot && !rawTimeSlot.toLowerCase().includes("tbd") && !rawTimeSlot.toLowerCase().includes("anytime")) {
    timeStr = rawTimeSlot;
  }

  if (!timeStr && rawNotes && rawNotes.toLowerCase() !== "anytime") {
    const timeMatch = rawNotes.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)/i);
    if (timeMatch) {
      timeStr = timeMatch[1];
    }
  }

  // 2. Detect Day Section (e.g. Wednesday, Thursday)
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let targetDay = daySection || "";

  if (!targetDay && extractedDateStr) {
    const parts = extractedDateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(d.getTime())) {
        targetDay = daysOfWeek[d.getDay()];
      }
    }
  }

  if (!targetDay) {
    targetDay = "Wednesday";
  }

  // If no time is found, and rawNotes is provided, return it
  if (!timeStr) {
    if (rawNotes) return rawNotes;
    return "Anytime";
  }

  // 3. Parse hour and minute
  let hour = 0;
  let minute = 0;
  const isPm = /pm/i.test(timeStr);
  const isAm = /am/i.test(timeStr);

  const hmMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (hmMatch) {
    hour = parseInt(hmMatch[1], 10);
    minute = parseInt(hmMatch[2], 10);
  } else {
    return rawNotes || timeStr;
  }

  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  // Format 24-hr time representation like "0:30", "18:30", "14:00", "10:00"
  const formattedTime = `${hour}:${minute.toString().padStart(2, "0")}`;

  // 4. Special Case for 0:30 Time (Midnight):
  // When useAnytime is TRUE -> outputs "Anytime" ONLY for 0:30 time.
  // When useAnytime is FALSE -> outputs "After Midnight <Day> night and a full <24-hr> collection".
  if (hour === 0 && minute === 30) {
    if (useAnytime) {
      return "Anytime";
    }
    const durationHours = formatCollectionDurationHours(order.scheduleDetails, order.daysOfCollection);
    return `After Midnight ${targetDay} night and a full ${durationHours} collection`;
  }

  // 5. General Time Formatting: Morning / Afternoon / Night
  // Times other than 0:30 keep their specific scheduled time note!
  let timeOfDay = "night";
  if (hour < 12) {
    timeOfDay = "morning";
  } else if (hour >= 12 && hour < 18) {
    timeOfDay = "afternoon";
  } else {
    timeOfDay = "night";
  }

  return `After ${formattedTime} ${targetDay} ${timeOfDay}`;
}

/**
 * Calculates a sorting minute value for ordering teardowns chronologically within the same day.
 * - Explicit "Anytime" (or empty time) -> returns -10000 (top of list / first row).
 * - For 0:30 / 00:30 / 12:30 AM (Midnight):
 *   - If useAnytime is TRUE: returns -10000 (sorted as Anytime on first row).
 *   - If useAnytime is FALSE: returns 9999999 (sorted on the LAST row of that day's teardowns).
 * - Earlier/other times (e.g. 14:00, 16:00, 18:30, 19:00, 19:30) get their chronological minute-of-day (0 to 1439).
 */
export function getTeardownSortMinute(order: WorkOrder, useAnytime?: boolean): number {
  const rawAfter = (order.teardownAfter || "").trim();
  const timeSlot = (order.timeSlot || "").trim();
  const rawNotes = (order.teardownTimeNotes || "").trim();

  let timeStr = "";
  if (rawAfter) {
    const parsed = parseDateTimeString(rawAfter);
    if (parsed && parsed.timeSlot) timeStr = parsed.timeSlot;
  }
  if (!timeStr && timeSlot && !timeSlot.toLowerCase().includes("tbd") && !timeSlot.toLowerCase().includes("anytime")) {
    timeStr = timeSlot;
  }
  if (!timeStr && rawNotes && rawNotes.toLowerCase() !== "anytime") {
    const timeMatch = rawNotes.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)/i);
    if (timeMatch) {
      timeStr = timeMatch[1];
    } else {
      timeStr = rawNotes;
    }
  }

  // Check for Midnight 0:30 in time string or notes
  if (isMidnightThirtyTime(timeStr) || isMidnightThirtyTime(rawNotes) || /after\s+midnight/i.test(rawNotes)) {
    if (useAnytime) {
      return -10000; // When Anytime toggle is active, 0:30 teardowns are sorted on the first rows as Anytime!
    }
    return 9999999; // Otherwise, always at the very end of the day's teardown list (last row)
  }

  if (!timeStr || timeStr.toLowerCase().includes("anytime") || (rawNotes && rawNotes.toLowerCase().includes("anytime"))) {
    return -10000; // Explicit Anytime is listed on the first rows!
  }

  // Parse hour & minute
  const hmMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (hmMatch) {
    let hour = parseInt(hmMatch[1], 10);
    const minute = parseInt(hmMatch[2], 10);
    const isAm = /am/i.test(timeStr);
    const isPm = /pm/i.test(timeStr);
    if (isAm && hour === 12) hour = 0;
    if (isPm && hour < 12) hour += 12;

    if (hour === 0 && minute === 30) {
      if (useAnytime) {
        return -10000;
      }
      return 9999999; // 0:30 Midnight is ALWAYS on the last row
    }
    return hour * 60 + minute;
  }

  return -10000; // If no clock time is found, default to Anytime (first rows)
}

/**
 * Extracts numeric sequence value from a work order's scheduleOrder field (e.g. 1, 2, "3", "Order 4" -> 4).
 * Returns 999999 if not defined.
 */
export function getOrderScheduleSequence(ord: WorkOrder): number {
  if (ord.scheduleOrder !== undefined && ord.scheduleOrder !== null && ord.scheduleOrder !== "") {
    if (typeof ord.scheduleOrder === "number") return ord.scheduleOrder;
    const str = String(ord.scheduleOrder).trim();
    const match = str.match(/\d+(\.\d+)?/);
    if (match) {
      const val = parseFloat(match[0]);
      if (!isNaN(val)) return val;
    }
  }
  return 999999;
}

/**
 * Group orders for a single day:
 * - For INSTALLS: Sequenced strictly by Schedule Order. Consecutive locations sharing the same
 *   Project Number are grouped into a single Install task block. When a different Project Number
 *   appears in the sequence (e.g. Project A -> Project B -> Project A), a new Install task line
 *   is created to preserve the exact routing sequence.
 * - For BATTERY SWAPS: Grouped by sequence and project.
 * - For TEARDOWNS: Grouped by project and teardown time (Anytime -> chronological -> Midnight 0:30 last).
 */
export function groupDayOrdersByProject(
  dayOrders: WorkOrder[],
  useAnytime?: boolean,
  codExclusive?: boolean
): GroupedProjectTask[] {
  // Separate day orders by category
  const installOrders = dayOrders.filter((o) => (o.taskCategory || "Install") === "Install");
  const batterySwapOrders = dayOrders.filter((o) => o.taskCategory === "BatterySwap");
  const teardownOrders = dayOrders.filter((o) => o.taskCategory === "Teardown");

  // 1. INSTALLS: Sort strictly by Schedule Order
  installOrders.sort((a, b) => {
    const seqA = getOrderScheduleSequence(a);
    const seqB = getOrderScheduleSequence(b);
    if (seqA !== seqB) return seqA - seqB;

    const sufA = a.locationId ? extractLocationSuffix(a.locationId) : "";
    const sufB = b.locationId ? extractLocationSuffix(b.locationId) : "";
    const numA = parseInt(sufA || "0", 10);
    const numB = parseInt(sufB || "0", 10);
    if (numA !== numB) return numA - numB;

    return (a.locationId || "").localeCompare(b.locationId || "");
  });

  // Group consecutive installs by projectNumber
  const installGroups: GroupedProjectTask[] = [];
  let currentInstallGroup: GroupedProjectTask | null = null;

  installOrders.forEach((o) => {
    const projectNumber = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
    if (currentInstallGroup && currentInstallGroup.projectNumber === projectNumber) {
      currentInstallGroup.orders.push(o);
    } else {
      currentInstallGroup = {
        primaryOrder: o,
        orders: [o],
        isMultiLocation: false,
        projectNumber,
        category: "Install",
      };
      installGroups.push(currentInstallGroup);
    }
  });

  // 2. BATTERY SWAPS: Sort by Schedule Order & group consecutive
  batterySwapOrders.sort((a, b) => {
    const seqA = getOrderScheduleSequence(a);
    const seqB = getOrderScheduleSequence(b);
    if (seqA !== seqB) return seqA - seqB;

    const sufA = a.locationId ? extractLocationSuffix(a.locationId) : "";
    const sufB = b.locationId ? extractLocationSuffix(b.locationId) : "";
    const numA = parseInt(sufA || "0", 10);
    const numB = parseInt(sufB || "0", 10);
    if (numA !== numB) return numA - numB;

    return (a.locationId || "").localeCompare(b.locationId || "");
  });

  const batteryGroups: GroupedProjectTask[] = [];
  let currentBatteryGroup: GroupedProjectTask | null = null;

  batterySwapOrders.forEach((o) => {
    const projectNumber = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
    if (currentBatteryGroup && currentBatteryGroup.projectNumber === projectNumber) {
      currentBatteryGroup.orders.push(o);
    } else {
      currentBatteryGroup = {
        primaryOrder: o,
        orders: [o],
        isMultiLocation: false,
        projectNumber,
        category: "BatterySwap",
      };
      batteryGroups.push(currentBatteryGroup);
    }
  });

  // 3. TEARDOWNS: Teardown Time supersedes Schedule Order
  // If COD Exclusive is ON, place non-COD teardowns (with earlier times) above and group all COD teardowns below (midnight/last)
  teardownOrders.sort((a, b) => {
    if (codExclusive) {
      const isCodA = Boolean(extractCodListKeyword(a));
      const isCodB = Boolean(extractCodListKeyword(b));
      if (isCodA !== isCodB) {
        return isCodA ? 1 : -1; // Place COD Exclusive teardowns below/after non-COD teardowns
      }
    }

    const timeA = getTeardownSortMinute(a, useAnytime);
    const timeB = getTeardownSortMinute(b, useAnytime);
    if (timeA !== timeB) return timeA - timeB;

    const seqA = getOrderScheduleSequence(a);
    const seqB = getOrderScheduleSequence(b);
    if (seqA !== seqB) return seqA - seqB;

    const sufA = a.locationId ? extractLocationSuffix(a.locationId) : "";
    const sufB = b.locationId ? extractLocationSuffix(b.locationId) : "";
    const numA = parseInt(sufA || "0", 10);
    const numB = parseInt(sufB || "0", 10);
    if (numA !== numB) return numA - numB;

    return (a.locationId || "").localeCompare(b.locationId || "");
  });

  const teardownGroups: GroupedProjectTask[] = [];
  const teardownMap = new Map<string, GroupedProjectTask>();

  teardownOrders.forEach((o) => {
    const projectNumber = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
    const timeVal = getTeardownSortMinute(o, useAnytime);
    const isCod = codExclusive && Boolean(extractCodListKeyword(o)) ? "COD" : "STD";
    const key = projectNumber ? `Teardown:::${isCod}:::${projectNumber}:::${timeVal}` : `single:::${o.id}`;

    let group = teardownMap.get(key);
    if (!group) {
      group = {
        primaryOrder: o,
        orders: [],
        isMultiLocation: false,
        projectNumber,
        category: "Teardown",
      };
      teardownMap.set(key, group);
      teardownGroups.push(group);
    }
    group.orders.push(o);
  });

  const allGroups = [...installGroups, ...batteryGroups, ...teardownGroups];

  // Finalize each group's metadata and sub-orders:
  allGroups.forEach((g) => {
    // Sort all sub-locations/orders in this group:
    g.orders.sort((a, b) => {
      if (g.category === "Teardown") {
        const timeA = getTeardownSortMinute(a, useAnytime);
        const timeB = getTeardownSortMinute(b, useAnytime);
        if (timeA !== timeB) return timeA - timeB;
      }

      const seqA = getOrderScheduleSequence(a);
      const seqB = getOrderScheduleSequence(b);
      if (seqA !== seqB) return seqA - seqB;

      const sufA = a.locationId ? extractLocationSuffix(a.locationId) : "";
      const sufB = b.locationId ? extractLocationSuffix(b.locationId) : "";
      const numA = parseInt(sufA || "0", 10);
      const numB = parseInt(sufB || "0", 10);
      if (numA !== numB) return numA - numB;
      return (a.locationId || "").localeCompare(b.locationId || "");
    });

    if (g.orders.length > 1) {
      g.isMultiLocation = true;
    }

    const firstOrder = g.orders[0];
    g.primaryOrder = { ...firstOrder };

    // Sum units (cameraCounts) + backup units (backupUnits) for the parent headline across all orders in the group
    let totalCams = 0;
    let hasExplicitCount = false;

    g.orders.forEach((ord) => {
      let ordUnits = 0;
      if (ord.cameraCounts !== undefined && ord.cameraCounts !== "") {
        hasExplicitCount = true;
        ordUnits = parseUnitNumber(ord.cameraCounts);
      } else {
        ordUnits = 1; // Default to 1 if not specified
      }

      let backupCount = 0;
      if (ord.backupUnits !== undefined && ord.backupUnits !== "") {
        hasExplicitCount = true;
        backupCount = parseUnitNumber(ord.backupUnits);
      }

      totalCams += ordUnits + backupCount;
    });

    const firstWithScheduleDetails = g.orders.find((ord) => !!ord.scheduleDetails)?.scheduleDetails;
    const firstWithTeardownAfter = g.orders.find((ord) => !!ord.teardownAfter)?.teardownAfter;
    const firstWithTeardownTimeNotes = g.orders.find((ord) => !!ord.teardownTimeNotes)?.teardownTimeNotes;
    const firstWithDaysOfCollection = g.orders.find((ord) => !!ord.daysOfCollection)?.daysOfCollection;

    g.primaryOrder = {
      ...g.primaryOrder,
      cameraCounts:
        hasExplicitCount || totalCams > 0
          ? totalCams === 0
            ? "0 cameras"
            : totalCams === 1
            ? "1 camera"
            : `${totalCams} cameras`
          : g.primaryOrder.cameraCounts,
      scheduleDetails: g.primaryOrder.scheduleDetails || firstWithScheduleDetails,
      teardownAfter: g.primaryOrder.teardownAfter || firstWithTeardownAfter,
      teardownTimeNotes: g.primaryOrder.teardownTimeNotes || firstWithTeardownTimeNotes,
      daysOfCollection: g.primaryOrder.daysOfCollection || firstWithDaysOfCollection,
    };
  });

  return allGroups;
}

/**
 * Helper to extract collection duration text and determine if it is > 1 day.
 * When multiple distinct collection days are detected for a project (e.g. 2 Days and 7 Days),
 * formats them combined in ascending order: "2-day & 7-day Collection".
 * Returns { isMultiDay: boolean, daysCount: number, collectionText: string }
 * e.g. "2-day & 7-day Collection", "3-day collection", "7-day collection", "1-day collection"
 */
export function extractCollectionDaysInfo(
  scheduleDetails?: string,
  daysOfCollection?: string,
  orders?: WorkOrder[]
): {
  daysCount: number;
  collectionText: string;
  isMultiDay: boolean;
} {
  const textSources: string[] = [];
  if (scheduleDetails) textSources.push(scheduleDetails);
  if (daysOfCollection) textSources.push(daysOfCollection);

  if (orders && Array.isArray(orders) && orders.length > 0) {
    orders.forEach((ord) => {
      if (ord.scheduleDetails && !textSources.includes(ord.scheduleDetails)) {
        textSources.push(ord.scheduleDetails);
      }
      if (ord.daysOfCollection && !textSources.includes(ord.daysOfCollection)) {
        textSources.push(ord.daysOfCollection);
      }
    });
  }

  const daysSet = new Set<number>();

  textSources.forEach((text) => {
    if (!text) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    // 1. Check for explicit day patterns: "2 Days", "7 Days", "2-day", "7-day", "2day", "7day", etc.
    const dayMatches = Array.from(cleanText.matchAll(/\b([1-9]|[12]\d|30)\s*(?:-| )?\s*(?:day|days)\b/gi));
    if (dayMatches.length > 0) {
      dayMatches.forEach((m) => {
        const num = parseInt(m[1], 10);
        if (num > 0 && num <= 30) daysSet.add(num);
      });
      return;
    }

    // 2. Check for explicit hour patterns: "48-hr", "72-hr", "48 hour", "168 hours", etc.
    const hrMatches = Array.from(cleanText.matchAll(/\b(\d+)\s*(?:-| )?\s*(?:hr|hrs|hour|hours)\b/gi));
    if (hrMatches.length > 0) {
      hrMatches.forEach((m) => {
        const hrs = parseInt(m[1], 10);
        const days = Math.round(hrs / 24);
        const effectiveDays = days >= 1 ? days : 1;
        if (effectiveDays > 0 && effectiveDays <= 30) daysSet.add(effectiveDays);
      });
      return;
    }

    // 3. Only if the ENTIRE field is just a pure standalone number (e.g., "2" or "7" or "2 & 7" or "2, 7")
    // Never extract numbers from long text, dates (08/24/2026), or project numbers (26-240026)
    if (/^[0-9\s,&/]+$/.test(cleanText) && cleanText.length <= 10) {
      const pureNumMatches = Array.from(cleanText.matchAll(/\b([1-9]|[12]\d|30)\b/g));
      pureNumMatches.forEach((m) => {
        const num = parseInt(m[1], 10);
        if (num > 0 && num <= 30) {
          daysSet.add(num);
        }
      });
    }
  });

  const sortedDays = Array.from(daysSet).sort((a, b) => a - b);

  if (sortedDays.length === 0) {
    return { daysCount: 1, collectionText: "1-day collection", isMultiDay: false };
  }

  if (sortedDays.length === 1) {
    const single = sortedDays[0];
    return {
      daysCount: single,
      collectionText: `${single}-day collection`,
      isMultiDay: single > 1,
    };
  }

  // Multiple different collection days (e.g. 2 and 7)
  let formattedText = "";
  if (sortedDays.length === 2) {
    formattedText = `${sortedDays[0]}-day & ${sortedDays[1]}-day Collection`;
  } else {
    const prefix = sortedDays.slice(0, -1).map((d) => `${d}-day`).join(", ");
    formattedText = `${prefix} & ${sortedDays[sortedDays.length - 1]}-day Collection`;
  }

  return {
    daysCount: Math.max(...sortedDays),
    collectionText: formattedText,
    isMultiDay: true,
  };
}

/**
 * Helper to identify if a schedule note should be formatted in green italic font.
 * Covers notes containing "(NOTE:", "NOTE:", "Note:", or note keywords like
 * "placed possible camera placement", "please see ... notes", etc.
 */
export function isGreenItalicNote(text?: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (/^\(?\s*note\s*:/i.test(clean)) return true;
  if (/\bnote\s*:/i.test(clean)) return true;
  if (/placed possible camera placement/i.test(clean)) return true;
  if (/cannot identify if there is a pole/i.test(clean)) return true;
  if (/please see\s+.*\bnotes?\b/i.test(clean)) return true;
  return false;
}

/**
 * Extracts Parish or County name for LADOTD reporting
 */
export function extractParishOrCounty(o: WorkOrder): string {
  let p = (
    o.countyParish ||
    (o.rawRowData && (
      o.rawRowData["Different County (from Locations)"] ||
      o.rawRowData["Different County"] ||
      o.rawRowData["County (from Locations)"] ||
      o.rawRowData["Parish"] ||
      o.rawRowData["County"]
    )) ||
    ""
  ).trim();

  if (!p) {
    p = (o.cityState || o.serviceAddress || "").trim();
  }

  if (p && !/parish|county/i.test(p)) {
    p = `${p} Parish`;
  }
  return p;
}

/**
 * Extracts Work Week string formatted e.g. "(Work Week 32)"
 */
export function extractWorkWeekString(o: WorkOrder): string {
  let ww = (
    o.workWeek ||
    (o.rawRowData && (
      o.rawRowData["Work Week"] ||
      o.rawRowData["WorkWeek"] ||
      o.rawRowData["Work Week (from Locations)"] ||
      o.rawRowData["WW"]
    )) ||
    ""
  ).trim();

  if (!ww) {
    const combined = `${o.scheduleNotes || ""} ${o.scheduleDetails || ""} ${o.description || ""} ${o.specialInstructions || ""}`;
    const wwMatch = combined.match(/(?:Work\s*Week|WW)\s*[:#]?\s*(\d+)/i);
    if (wwMatch) {
      ww = `(Work Week ${wwMatch[1]})`;
    } else {
      ww = "(Work Week 32)";
    }
  } else {
    const numMatch = ww.match(/\d+/);
    if (numMatch) {
      ww = `(Work Week ${numMatch[0]})`;
    } else {
      ww = ww.startsWith("(") ? ww : `(${ww})`;
    }
  }
  return ww;
}

/**
 * Extract time duration as a time range (e.g., 14:00-16:00) instead of total hours.
 */
export function extractStudyTimeRange(order: WorkOrder): string {
  // Check if raw time fields or duration columns have an explicit time range like 14:00-16:00 or 8:00 AM - 10:00 AM
  const directFields = [
    order.rawRowData?.["Time Duration"],
    order.rawRowData?.["Time"],
    order.rawRowData?.["Time Slot"],
    order.rawRowData?.["TimeSlot"],
    order.rawRowData?.["Duration"],
    order.rawRowData?.["Collection Duration"],
    order.rawRowData?.["Study Duration"],
    order.rawRowData?.["Schedule Notes"],
    order.rawRowData?.["Schedule Details"],
    order.scheduleNotes,
    order.scheduleDetails,
  ];

  for (const field of directFields) {
    if (!field) continue;
    // Look for explicit range e.g. 14:00-16:00, 14:00 - 16:00, 08:00 AM - 10:00 AM
    const rangeMatch = field.match(/(\d{1,2}:\d{2}(?:\s*[ap]m)?)\s*(?:-|to)\s*(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i);
    if (rangeMatch) {
      return `${rangeMatch[1].trim()}-${rangeMatch[2].trim()}`;
    }
  }

  // Next, if we have Setup Before (start) and Teardown After (end) timestamps on the same day or duration
  const startStr = order.setupBefore || order.rawRowData?.["Setup Before"] || "";
  const endStr = order.teardownAfter || order.rawRowData?.["Teardown After"] || "";

  const extractTime = (val: string): string => {
    const m = val.match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "";
  };

  const startTime = extractTime(startStr);
  const endTime = extractTime(endStr);

  if (startTime && endTime && startTime !== endTime) {
    return `${startTime}-${endTime}`;
  }

  // If we have start time and duration hours e.g. "08:30" and "3 hours" -> calculate range e.g. 08:30-11:30
  let rawDur = (
    order.duration ||
    order.rawRowData?.["Duration"] ||
    order.rawRowData?.["Time Duration"] ||
    order.rawRowData?.["Hours"] ||
    ""
  ).trim();

  const numHoursMatch = rawDur.match(/(\d+(?:\.\d+)?)/);
  if (startTime && numHoursMatch) {
    const hours = parseFloat(numHoursMatch[1]);
    const [h, m] = startTime.split(":").map(Number);
    const totalMin = h * 60 + m + Math.round(hours * 60);
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const endFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    return `${startTime}-${endFormatted}`;
  }

  // Fallback to raw duration or clean string
  let cleanDuration = rawDur.replace(/^\(/, "").replace(/\)$/, "").trim();
  if (/^\d+$/.test(cleanDuration)) {
    cleanDuration = `${cleanDuration} hours`;
  }
  return cleanDuration || "TBD";
}

/**
 * Extracts City of Dallas list keyword from Scheduling Team Notes or other fields,
 * e.g. "(City of Dallas – List 105)" or "(City of Dallas - List 105)"
 */
export function extractCodListKeyword(order: WorkOrder): string | null {
  const sources = [
    order.rawRowData?.["Scheduling Team Notes"],
    order.rawRowData?.["Scheduling Notes"],
    order.rawRowData?.["Schedule Notes"],
    order.scheduleNotes,
    order.rawRowData?.["City of Dallas List"],
    order.rawRowData?.["City of Dallas"],
    order.rawRowData?.["Notes"],
    order.rawRowData?.["Description"],
    order.description,
  ];

  for (const src of sources) {
    if (!src) continue;
    // Match variations like: (City of Dallas – List 105), (City of Dallas - List 105), (City of Dallas List 105), City of Dallas - List 105
    const match = src.match(/\(?\s*City\s+of\s+Dallas\s*[-–—]?\s*List\s*#?\s*\d+\s*\)?/i);
    if (match) {
      let matchedStr = match[0].trim();
      if (!matchedStr.startsWith("(")) matchedStr = `(${matchedStr}`;
      if (!matchedStr.endsWith(")")) matchedStr = `${matchedStr})`;
      return matchedStr;
    }
  }
  return null;
}

/**
 * Finds the COD list keyword across a group of orders
 */
export function getCodListForGroup(orders: WorkOrder[]): string | null {
  for (const ord of orders) {
    const kw = extractCodListKeyword(ord);
    if (kw) return kw;
  }
  return null;
}

/**
 * Extracts Scheduling Team Notes for a project/group of orders.
 * If present (e.g. "(City of Dallas - List 104)" or "City of Dallas - List 104"),
 * formats with parentheses and returns it to replace <City, State> on the Install/Teardown/Battery swap line.
 */
export function extractSchedulingTeamNotesForGroup(orders: WorkOrder[]): string | null {
  for (const ord of orders) {
    const directSources = [
      ord.schedulingTeamNotes,
      ord.rawRowData?.["Scheduling Team Notes"],
      ord.rawRowData?.["Scheduling Team Note"],
      ord.rawRowData?.["Scheduling Notes"],
      ord.rawRowData?.["Scheduling Note"],
      ord.rawRowData?.["Team Notes"],
      ord.rawRowData?.["Team Note"],
      ord.rawRowData?.["City of Dallas List"],
    ];

    for (const src of directSources) {
      if (src && typeof src === "string" && src.trim()) {
        let clean = src.trim();
        if (["none", "no", "n/a", "na", "null", "undefined"].includes(clean.toLowerCase())) {
          continue;
        }
        if (!clean.startsWith("(")) clean = `(${clean}`;
        if (!clean.endsWith(")")) clean = `${clean})`;
        return clean;
      }
    }

    // Also check for City of Dallas keyword from other fields if any
    const cod = extractCodListKeyword(ord);
    if (cod) return cod;
  }
  return null;
}

/**
 * Extract Study / Service Type for COD Exclusive line, e.g. PED, PEDS, TMC, Volume, Miovision
 */
export function extractStudyLabelForCod(order: WorkOrder): string {
  const rawStudy = (order.rawRowData?.["Study"] || order.rawRowData?.["Study Type"] || "").trim();
  if (rawStudy) return rawStudy;
  const rawJob = (order.jobType || "").trim();
  if (rawJob && rawJob.toUpperCase() !== "MIOVISION") return rawJob;

  const combined = `${order.jobType || ""} ${order.serviceTypeAddOns || ""} ${order.description || ""}`.toLowerCase();
  if (combined.includes("ped")) return "PED";
  if (combined.includes("tmc")) return "TMC";
  if (combined.includes("radar") || combined.includes("spot speed")) return "Radar";
  if (combined.includes("atr")) return "ATR";
  if (combined.includes("volume")) return "Volume";

  return rawJob || "PED";
}

/**
 * Detects if an order/project is a Radar or Parking study when Conduct Study toggle is ON.
 * Formats duration as time range (e.g. 14:00-16:00) or fallback.
 */
export function getStudyInfo(order: WorkOrder): {
  isStudy: boolean;
  studyType: "Radar" | "Parking";
  studyLabel: string;
  headerText: string;
  durationText: string;
} | null {
  const combined = `${order.jobType || ""} ${order.serviceTypeAddOns || ""} ${order.description || ""} ${order.scheduleNotes || ""} ${order.rawRowData?.["Service Types (from Project ID) (from Locations)"] || ""} ${order.rawRowData?.["Service Type"] || ""} ${order.rawRowData?.["Service Type Add Ons"] || ""} ${order.rawRowData?.["Study"] || ""}`.toLowerCase();

  const durationRange = extractStudyTimeRange(order);

  if (combined.includes("radar") || combined.includes("spot speed") || combined.includes("speed study")) {
    return {
      isStudy: true,
      studyType: "Radar",
      studyLabel: "Radar",
      headerText: "Conduct Radar (Spot Speed) Study:",
      durationText: durationRange,
    };
  }

  if (combined.includes("parking")) {
    return {
      isStudy: true,
      studyType: "Parking",
      studyLabel: "Parking",
      headerText: "Conduct Parking Study:",
      durationText: durationRange,
    };
  }

  return null;
}

/**
 * Render PEDS Conduct Sight Distance Line HTML
 */
export function renderPedsConductLineHtml(item: PedsConductLineItem): string {
  const proj = (item.projectNumber || "").trim();
  const listNum = (item.listNumber || "").trim();
  const city = (item.cityText || "City of Dallas").trim();

  let listPart = "";
  if (listNum) {
    listPart = ` – List ${listNum}`;
  }

  const content = item.customText
    ? item.customText
    : `${proj ? proj + " " : ""}PEDS (${city}${listPart})`;

  return `
  <div style="margin-top: 6px; margin-bottom: 16px;">
    <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
      <span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">Conduct Sight Distance and additional PED requirement:</span> <strong style="color: #000000;">${escapeHtml(content)}</strong>
    </div>
  </div>`;
}

/**
 * Render PEDS Conduct Sight Distance Line Plain Text
 */
export function renderPedsConductLineText(item: PedsConductLineItem): string {
  const proj = (item.projectNumber || "").trim();
  const listNum = (item.listNumber || "").trim();
  const city = (item.cityText || "City of Dallas").trim();

  let listPart = "";
  if (listNum) {
    listPart = ` – List ${listNum}`;
  }

  const content = item.customText
    ? item.customText
    : `${proj ? proj + " " : ""}PEDS (${city}${listPart})`;

  return `Conduct Sight Distance and additional PED requirement: ${content}\n`;
}

export interface CodPedsLocationInfo {
  suffix: string;
  cameraCountText?: string;
  notes?: string;
  isMachine?: boolean;
  order: WorkOrder;
}

export interface CodPedsProjectInfo {
  projectNumber: string;
  studyLabel: string;
  codKeyword: string;
  listNumber?: string;
  locations: CodPedsLocationInfo[];
  uniqueSuffixes: string[];
  totalCameras: number;
  hasTeardown: boolean;
  hasInstall: boolean;
  primaryOrder: WorkOrder;
}

/**
 * Detects all City of Dallas PEDS projects in a roster or list of orders
 */
export function detectCodPedsProjectsInRoster(orders: WorkOrder[]): CodPedsProjectInfo[] {
  if (!orders || orders.length === 0) return [];

  const projectMap = new Map<string, WorkOrder[]>();

  orders.forEach((ord) => {
    const pNum =
      ord.projectNumber ||
      (ord.locationId ? extractProjectNumber(ord.locationId) : extractProjectNumber(ord.orderNumber));
    if (!pNum) return;
    if (!projectMap.has(pNum)) {
      projectMap.set(pNum, []);
    }
    projectMap.get(pNum)!.push(ord);
  });

  const results: CodPedsProjectInfo[] = [];

  projectMap.forEach((pOrders, pNum) => {
    const primary = pOrders[0];
    const studyLabel = extractStudyLabelForCod(primary);

    const combined = `${primary.jobType || ""} ${primary.serviceTypeAddOns || ""} ${primary.description || ""} ${primary.scheduleNotes || ""} ${primary.rawRowData?.["Service Types (from Project ID) (from Locations)"] || ""} ${primary.rawRowData?.["Service Type"] || ""} ${primary.rawRowData?.["Service Type Add Ons"] || ""} ${primary.rawRowData?.["Study"] || ""}`.toLowerCase();
    const isPed = combined.includes("ped") || studyLabel.toLowerCase().includes("ped");

    const codKeyword = getCodListForGroup(pOrders) || extractSchedulingTeamNotesForGroup(pOrders);
    const isCod = Boolean(codKeyword && /City\s+of\s+Dallas/i.test(codKeyword));

    if (isPed && isCod && codKeyword) {
      const listMatch = codKeyword.match(/List\s*#?\s*(\d+)/i);
      const listNumber = listMatch ? listMatch[1] : undefined;

      const locs: CodPedsLocationInfo[] = [];
      const suffixSet = new Set<string>();
      let totalCameras = 0;
      let hasTeardown = false;
      let hasInstall = false;

      pOrders.forEach((o) => {
        if (o.taskCategory === "Teardown") hasTeardown = true;
        if (o.taskCategory === "Install" || !o.taskCategory) hasInstall = true;

        const suf = o.locationId ? extractLocationSuffix(o.locationId) : "";
        if (suf) {
          suffixSet.add(suf);
          const bullet = formatBulletItem(o);
          locs.push({
            suffix: suf,
            cameraCountText: bullet.unitText,
            notes: bullet.notesText,
            isMachine: bullet.isMachine,
            order: o,
          });
        }
        totalCameras += parseUnitNumber(o.cameraCounts || o.rawRowData?.["Camera Counts"]);
      });

      const uniqueSuffixes = Array.from(suffixSet).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      results.push({
        projectNumber: pNum,
        studyLabel: studyLabel.toUpperCase() === "PED" ? "Peds" : studyLabel,
        codKeyword,
        listNumber,
        locations: locs,
        uniqueSuffixes,
        totalCameras: totalCameras || pOrders.length,
        hasTeardown,
        hasInstall,
        primaryOrder: primary,
      });
    }
  });

  return results;
}

/**
 * Render Conduct Sight Distance and additional PED requirement line with checked location bullets in HTML
 */
export function renderCodSightDistanceHtml(
  projectNumber: string,
  codKeyword: string,
  checkedLocations: string[]
): string {
  if (!checkedLocations || checkedLocations.length === 0) return "";
  const bullets = checkedLocations
    .map(
      (loc) => `
        <li style="margin: 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.25; color: #000000;">
          <span style="font-weight: bold; color: #000000;">${escapeHtml(loc)}</span>
        </li>`
    )
    .join("");

  return `
    <div style="margin-top: 6px; margin-bottom: 16px;">
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">Conduct Sight Distance and additional PED requirement:</span> <strong style="color: #000000;">${escapeHtml(projectNumber)} PEDS ${escapeHtml(codKeyword)}</strong>
      </div>
      <ul style="margin: 4px 0 2px 0; padding: 0; padding-left: 24px; list-style-type: disc; mso-special-format: bullet;">
        ${bullets}
      </ul>
    </div>`;
}

/**
 * Render Conduct Sight Distance and additional PED requirement line with checked location bullets in Plain Text
 */
export function renderCodSightDistanceText(
  projectNumber: string,
  codKeyword: string,
  checkedLocations: string[]
): string {
  if (!checkedLocations || checkedLocations.length === 0) return "";
  const bullets = checkedLocations.map((loc) => `  • ${loc}`).join("\n");
  return `\nConduct Sight Distance and additional PED requirement: ${projectNumber} PEDS ${codKeyword}\n${bullets}\n`;
}

/**
 * Formats all bullet items for a project task group, handling joined LADOTD notes when LADOTD Exclusive is active.
 */
export function formatGroupBullets(
  group: GroupedProjectTask,
  isLadotdActive: boolean
): FormattedBulletItem[] {
  const processedSuffixes = new Set<string>();
  const bullets: FormattedBulletItem[] = [];

  // Map each location number (e.g. "4555", "4556", "4557") to its parsed joined info if present
  const joinedInfoByLoc = new Map<string, JoinedLadotdNoteInfo>();
  if (isLadotdActive) {
    for (const ord of group.orders) {
      const noteSrc =
        ord.scheduleNotes ||
        (ord.rawRowData && ord.rawRowData["Schedule Notes"]) ||
        ord.specialInstructions ||
        ord.description ||
        "";
      const parsed = parseJoinedLadotdNote(noteSrc);
      if (parsed) {
        for (const num of parsed.locNumbers) {
          const rawNum = num.trim();
          const cleanNum = rawNum.replace(/^0+/, "");
          if (rawNum && !joinedInfoByLoc.has(rawNum)) {
            joinedInfoByLoc.set(rawNum, parsed);
          }
          if (cleanNum && !joinedInfoByLoc.has(cleanNum)) {
            joinedInfoByLoc.set(cleanNum, parsed);
          }
        }
      }
    }
  }

  for (const ord of group.orders) {
    const s = ord.locationId
      ? extractLocationSuffix(ord.locationId)
      : extractLocationSuffix(ord.orderNumber);
    const cleanS = s ? s.replace(/^0+/, "") : "";

    // Skip if this location was already covered by a prior bullet or joined group
    if ((s && processedSuffixes.has(s)) || (cleanS && processedSuffixes.has(cleanS))) {
      continue;
    }

    const joinedParsed = isLadotdActive && (s ? joinedInfoByLoc.get(s) : null) || (cleanS ? joinedInfoByLoc.get(cleanS) : null);

    if (isLadotdActive && joinedParsed) {
      // Mark all locations belonging to this joined note as processed so subsequent rows are skipped
      for (const num of joinedParsed.locNumbers) {
        processedSuffixes.add(num);
        processedSuffixes.add(num.replace(/^0+/, ""));
      }
      if (s) processedSuffixes.add(s);
      if (cleanS) processedSuffixes.add(cleanS);

      const isMach = /machine/i.test(joinedParsed.unitText);
      bullets.push({
        suffix: joinedParsed.joinedSuffix,
        unitText: joinedParsed.unitText,
        isMachine: isMach,
        isManual: false,
        notesText: joinedParsed.extraNotes,
        isRedo: Boolean(ord.isRedo),
        fullText: `${joinedParsed.joinedSuffix} ${joinedParsed.unitText}${joinedParsed.extraNotes ? " " + joinedParsed.extraNotes : ""}${ord.isRedo ? " REDO" : ""}`,
      });
    } else {
      if (s) processedSuffixes.add(s);
      if (cleanS) processedSuffixes.add(cleanS);
      const bullet = formatBulletItem(ord);
      if (bullet.suffix) {
        bullets.push(bullet);
      }
    }
  }

  return bullets;
}

/**
 * Render exact NDS task lines for Installs, Teardowns, and SD Card & Battery Swaps
 * Includes support for nested sub-location bullets (• 001 1 camera, • 5666 1 camera...)
 * Supports LADOTD Exclusive formatting, COD Exclusive formatting, and global multi-day collection suffixes.
 */
export function renderNDSTaskGroupHtml(
  group: GroupedProjectTask,
  daySection?: string,
  useAnytime?: boolean,
  ladotdExclusive?: boolean,
  branding?: TemplateBranding
): string {
  const o = group.primaryOrder;
  const projectNumber = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
  const serviceType = o.jobType || "Miovision";
  const rawAddOns = o.serviceTypeAddOns || "";
  const cityState = o.cityState || o.serviceAddress || "";
  const category = group.category;

  const isLadotdProject = projectNumber === "26-240026" || projectNumber.includes("26-240026");
  const isLadotdActive = Boolean((branding?.ladotdExclusive ?? ladotdExclusive) && isLadotdProject);
  const groupUnitCounts = formatNDSGroupUnitCounts(group.orders, isLadotdActive);

  const isCodExclusiveActive = Boolean(branding?.codExclusive);
  const codKeyword = isCodExclusiveActive ? getCodListForGroup(group.orders) : null;

  const collectionInfo = extractCollectionDaysInfo(o.scheduleDetails, o.daysOfCollection, group.orders);
  const multiDayCollectionHtml = collectionInfo.isMultiDay
    ? ` <span style="background-color: #00FFFF; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${collectionInfo.collectionText}</span>`
    : "";

  let mainLine = "";

  if (isLadotdActive) {
    // LADOTD Exclusive Format: ALG 26-240026 Volume <Parish> (Camera Counts) (Work Week 32) <No. Days> collection
    const parishName = extractParishOrCounty(o);
    const parishPart = parishName ? ` ${parishName}` : "";
    const workWeekStr = extractWorkWeekString(o);
    const camPart = groupUnitCounts ? ` ${groupUnitCounts}` : "";
    const collectionBadge = ` <span style="background-color: #00FFFF; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${collectionInfo.collectionText}</span>`;

    if (category === "BatterySwap") {
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #00FFFF; color: #000000; font-weight: bold; font-style: italic; padding: 0 4px; display: inline-block;">SD Card and Battery Swaps:</span> <span style="color: #FF0000; font-weight: bold; font-style: italic;">Upload Data</span> <strong style="color: #000000;">ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}</strong>${collectionBadge} <span style="color: #000000; font-weight: normal; font-style: italic;">(Check if cameras are still working, tampered, etc., replace / adjust / swap if necessary.)</span>
      </div>`;
    } else if (category === "Teardown") {
      const teardownNotes = formatNDSTeardownNote(o, daySection, useAnytime ?? branding?.useAnytimeTeardowns);
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #000000; color: #FFFFFF; font-weight: bold; padding: 0 4px; display: inline-block;">Teardowns:</span> <span style="color: #FF0000; font-weight: bold; font-style: italic;">Upload Data</span> <strong style="color: #000000;">ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}</strong>${collectionBadge} <span style="background-color: #CCCCCC; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${teardownNotes}</span>
      </div>`;
    } else {
      // Default: Install
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">Install:</span> <strong style="color: #000000;">ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}</strong>${collectionBadge}
      </div>`;
    }
  } else {
    // Standard & COD Exclusive Format (with global multi-day collection rule for >1 day)
    // Preserves prefixes (like ALG for ATR), Add-Ons (w/ Heavy Trucks, Volume, Speed, etc.), and replaces City, State with Scheduling Team Notes (City of Dallas - List ###)
    const teamNotes = getCodListForGroup(group.orders) || extractSchedulingTeamNotesForGroup(group.orders);
    const { formattedHtml } = formatNDSProjectAndServiceLine(projectNumber, serviceType, rawAddOns);
    const camPart = groupUnitCounts ? ` ${groupUnitCounts}` : "";
    // If Scheduling Team Notes / COD keyword is present, replace <City, State> with <Scheduling Team Notes>
    const locationOrNotesPart = teamNotes
      ? (formattedHtml ? ` ${teamNotes}` : teamNotes)
      : cityState
      ? (formattedHtml ? ` ${cityState}` : cityState)
      : "";

    const studyInfo = branding?.conductStudyEnabled ? getStudyInfo(o) : null;

    if (studyInfo && category === "Install") {
      const citySegment = teamNotes ? ` ${teamNotes}` : cityState ? ` ${cityState}` : "";
      const durationText = studyInfo.durationText;
      const studyBody = `${projectNumber}${citySegment} ${studyInfo.studyLabel} (${durationText})`;
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${studyInfo.headerText}</span> <strong style="color: #000000;">${studyBody}</strong>
      </div>`;
    } else if (category === "BatterySwap") {
      const collectionBadge = ` <span style="background-color: #00FFFF; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${collectionInfo.collectionText}</span>`;
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #00FFFF; color: #000000; font-weight: bold; font-style: italic; padding: 0 4px; display: inline-block;">SD Card and Battery Swaps:</span> <span style="color: #FF0000; font-weight: bold; font-style: italic;">Upload Data</span> <strong style="color: #000000;">${formattedHtml}${locationOrNotesPart}${camPart}</strong>${collectionBadge} <span style="color: #000000; font-weight: normal; font-style: italic;">(Check if cameras are still working, tampered, etc., replace / adjust / swap if necessary.)</span>
      </div>`;
    } else if (category === "Teardown") {
      const teardownNotes = formatNDSTeardownNote(o, daySection, useAnytime ?? branding?.useAnytimeTeardowns);
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #000000; color: #FFFFFF; font-weight: bold; padding: 0 4px; display: inline-block;">Teardowns:</span> <span style="color: #FF0000; font-weight: bold; font-style: italic;">Upload Data</span> <strong style="color: #000000;">${formattedHtml}${locationOrNotesPart}${camPart}</strong>${multiDayCollectionHtml} <span style="background-color: #CCCCCC; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${teardownNotes}</span>
      </div>`;
    } else {
      // Default: Install
      mainLine = `
      <div style="margin: 0 0 8px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5; color: #000000; font-weight: bold;">
        <span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">Install:</span> <strong style="color: #000000;">${formattedHtml}${locationOrNotesPart}${camPart}</strong>${multiDayCollectionHtml}
      </div>`;
    }
  }

  // Render location bullet points for all locations with a location suffix (e.g. 001, 5666)
  // Formatted with Outlook native bullet semantics (mso-special-format: bullet) and tight line height
  const validBullets = formatGroupBullets(group, isLadotdActive);

  // Check for COD Sight Distance requirement locations under Teardowns
  let sightDistanceHtml = "";
  if (isCodExclusiveActive && category === "Teardown") {
    const checkedLocs = branding?.codSightDistanceLocations?.[projectNumber];
    if (checkedLocs && checkedLocs.length > 0) {
      sightDistanceHtml = renderCodSightDistanceHtml(
        projectNumber,
        codKeyword || "(City of Dallas)",
        checkedLocs
      );
    }
  }

  if (validBullets.length > 0) {
    const bulletsHtml = validBullets
      .map((b) => {
        // Red (#D32F2F) for cameras, Turquoise (#0E6482) for machines (ATR)
        const unitColor = b.isMachine ? "#0E6482" : "#D32F2F";
        const unitSpan = b.unitText ? ` <span style="color: ${unitColor}; font-style: italic;">${b.unitText}</span>` : "";
        // Green (#008000) italic for NOTE: keyword notes, Red (#D32F2F) font for standard Schedule Notes
        const isGreen = isGreenItalicNote(b.notesText);
        const notesSpan = b.notesText
          ? ` <span style="color: ${isGreen ? "#008000" : "#D32F2F"};${isGreen ? " font-style: italic;" : ""}">${b.notesText}</span>`
          : "";
        // Red (#D32F2F) font for REDO
        const redoSpan = b.isRedo ? ` <span style="font-weight: bold; color: #D32F2F;">REDO</span>` : "";
        return `
        <li style="margin: 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.25; color: #000000;">
          <span style="font-weight: bold; color: #000000;">${b.suffix}</span>${unitSpan}${notesSpan}${redoSpan}
        </li>`;
      })
      .join("");

    return `
    <div style="margin-top: 6px; margin-bottom: 16px;">
      ${mainLine}
      <ul style="margin: 4px 0 2px 0; padding: 0; padding-left: 24px; list-style-type: disc; mso-special-format: bullet;">
        ${bulletsHtml}
      </ul>
    </div>${sightDistanceHtml}`;
  }

  return `
  <div style="margin-top: 6px; margin-bottom: 16px;">
    ${mainLine}
  </div>${sightDistanceHtml}`;
}

export function renderNDSTaskGroupText(
  group: GroupedProjectTask,
  daySection?: string,
  useAnytime?: boolean,
  ladotdExclusive?: boolean,
  branding?: TemplateBranding
): string {
  const o = group.primaryOrder;
  const projectNumber = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
  const serviceType = o.jobType || "Miovision";
  const rawAddOns = o.serviceTypeAddOns || "";
  const cityState = o.cityState || o.serviceAddress || "";
  const category = group.category;

  const isLadotdProject = projectNumber === "26-240026" || projectNumber.includes("26-240026");
  const isLadotdActive = Boolean((branding?.ladotdExclusive ?? ladotdExclusive) && isLadotdProject);
  const groupUnitCounts = formatNDSGroupUnitCounts(group.orders, isLadotdActive);

  const isCodExclusiveActive = Boolean(branding?.codExclusive);
  const codKeyword = isCodExclusiveActive ? getCodListForGroup(group.orders) : null;

  const collectionInfo = extractCollectionDaysInfo(o.scheduleDetails, o.daysOfCollection);
  const multiDayCollectionText = collectionInfo.isMultiDay
    ? ` ${collectionInfo.collectionText}`
    : "";

  let mainLine = "";

  if (isLadotdActive) {
    const parishName = extractParishOrCounty(o);
    const parishPart = parishName ? ` ${parishName}` : "";
    const workWeekStr = extractWorkWeekString(o);
    const camPart = groupUnitCounts ? ` ${groupUnitCounts}` : "";
    const collectionText = ` ${collectionInfo.collectionText}`;

    if (category === "BatterySwap") {
      mainLine = `SD Card and Battery Swaps: Upload Data ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}${collectionText} (Check if cameras are still working, tampered, etc., replace / adjust / swap if necessary.)`;
    } else if (category === "Teardown") {
      const teardownNotes = formatNDSTeardownNote(o, daySection, useAnytime ?? branding?.useAnytimeTeardowns);
      mainLine = `Teardowns: Upload Data ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}${collectionText} ${teardownNotes}`;
    } else {
      mainLine = `Install: ALG 26-240026 Volume${parishPart}${camPart} ${workWeekStr}${collectionText}`;
    }
  } else {
    const teamNotes = getCodListForGroup(group.orders) || extractSchedulingTeamNotesForGroup(group.orders);
    const { formattedText } = formatNDSProjectAndServiceLine(projectNumber, serviceType, rawAddOns);
    const camPart = groupUnitCounts ? ` ${groupUnitCounts}` : "";
    const locationOrNotesPart = teamNotes
      ? (formattedText ? ` ${teamNotes}` : teamNotes)
      : cityState
      ? (formattedText ? ` ${cityState}` : cityState)
      : "";

    const studyInfo = branding?.conductStudyEnabled ? getStudyInfo(o) : null;

    if (studyInfo && category === "Install") {
      const citySegment = teamNotes ? ` ${teamNotes}` : cityState ? ` ${cityState}` : "";
      const durationText = studyInfo.durationText;
      const studyBody = `${projectNumber}${citySegment} ${studyInfo.studyLabel} (${durationText})`;
      mainLine = `${studyInfo.headerText} ${studyBody}`;
    } else if (category === "BatterySwap") {
      mainLine = `SD Card and Battery Swaps: Upload Data ${formattedText}${locationOrNotesPart}${camPart} ${collectionInfo.collectionText} (Check if cameras are still working, tampered, etc., replace / adjust / swap if necessary.)`;
    } else if (category === "Teardown") {
      const teardownNotes = formatNDSTeardownNote(o, daySection, useAnytime ?? branding?.useAnytimeTeardowns);
      mainLine = `Teardowns: Upload Data ${formattedText}${locationOrNotesPart}${camPart}${multiDayCollectionText} ${teardownNotes}`;
    } else {
      mainLine = `Install: ${formattedText}${locationOrNotesPart}${camPart}${multiDayCollectionText}`;
    }
  }

  // Check for COD Sight Distance requirement locations under Teardowns
  let sightDistanceText = "";
  if (isCodExclusiveActive && category === "Teardown") {
    const checkedLocs = branding?.codSightDistanceLocations?.[projectNumber];
    if (checkedLocs && checkedLocs.length > 0) {
      sightDistanceText = renderCodSightDistanceText(
        projectNumber,
        codKeyword || "(City of Dallas)",
        checkedLocs
      );
    }
  }

  const validBullets = formatGroupBullets(group, isLadotdActive);

  if (validBullets.length > 0) {
    const bulletLines = validBullets.map((b) => {
      const uPart = b.unitText ? ` ${b.unitText}` : "";
      const nPart = b.notesText ? ` ${b.notesText}` : "";
      const rPart = b.isRedo ? ` REDO` : "";
      return `  • ${b.suffix}${uPart}${nPart}${rPart}`;
    });
    return `${mainLine}\n${bulletLines.join("\n")}\n${sightDistanceText}`;
  }

  return `${mainLine}\n${sightDistanceText}`;
}

/**
 * Renderable Day Schedule Item
 */
export interface RenderableScheduleItem {
  id: string;
  type: "task_group" | "peds_conduct";
  category?: "Install" | "Teardown" | "BatterySwap" | "ConductStudy" | "PedsConduct";
  title: string;
  projectNumber?: string;
  taskGroup?: GroupedProjectTask;
  pedsLine?: PedsConductLineItem;
  html: string;
  text: string;
}

/**
 * Builds the complete list of task lines and PEDS Conduct lines for a day section,
 * respecting any manual order overrides.
 */
export function buildDayScheduleItems(
  dayKey: string,
  baseDayName: string,
  dayOrders: WorkOrder[],
  branding: TemplateBranding = DEFAULT_BRANDING
): RenderableScheduleItem[] {
  const items: RenderableScheduleItem[] = [];

  // 1. Task Groups
  if (dayOrders.length > 0) {
    const projectGroups = groupDayOrdersByProject(
      dayOrders,
      branding.useAnytimeTeardowns,
      branding.codExclusive
    );
    projectGroups.forEach((g, idx) => {
      const studyInfo = branding.conductStudyEnabled ? getStudyInfo(g.primaryOrder) : null;
      const isConductStudy = Boolean(studyInfo && g.category === "Install");
      const catName = isConductStudy ? "ConductStudy" : g.category;

      const pNum = g.projectNumber || g.primaryOrder.projectNumber || "";
      const itemId = `task-${g.category.toLowerCase()}-${pNum || idx}-${g.primaryOrder.id || idx}`;

      const html = renderNDSTaskGroupHtml(
        g,
        baseDayName,
        branding.useAnytimeTeardowns,
        branding.ladotdExclusive,
        branding
      );
      const text = renderNDSTaskGroupText(
        g,
        baseDayName,
        branding.useAnytimeTeardowns,
        branding.ladotdExclusive,
        branding
      );

      items.push({
        id: itemId,
        type: "task_group",
        category: catName,
        title: isConductStudy
          ? `${studyInfo?.headerText} ${pNum}`
          : `${g.category}: ${pNum}`,
        projectNumber: pNum,
        taskGroup: g,
        html,
        text,
      });
    });
  }

  // 2. PEDS Conduct Lines for this day
  const pedsForDay = (branding.pedsConductLines || []).filter(
    (p) =>
      (p.day && p.day.trim().toLowerCase() === dayKey.trim().toLowerCase()) ||
      (p.day && p.day.trim().toLowerCase() === baseDayName.trim().toLowerCase())
  );

  pedsForDay.forEach((p) => {
    const itemId = `peds-${p.id}`;
    const html = renderPedsConductLineHtml(p);
    const text = renderPedsConductLineText(p);

    items.push({
      id: itemId,
      type: "peds_conduct",
      category: "PedsConduct",
      title: `PEDS Conduct: ${p.projectNumber || "Project"} (List ${p.listNumber || ""})`,
      projectNumber: p.projectNumber,
      pedsLine: p,
      html,
      text,
    });
  });

  // 3. Apply custom ordering override if defined for this day
  const orderOverride =
    branding.dayItemOrderOverrides?.[dayKey] ||
    branding.dayItemOrderOverrides?.[baseDayName];

  if (orderOverride && Array.isArray(orderOverride) && orderOverride.length > 0) {
    items.sort((a, b) => {
      const idxA = orderOverride.indexOf(a.id);
      const idxB = orderOverride.indexOf(b.id);
      const posA = idxA >= 0 ? idxA : 9999;
      const posB = idxB >= 0 ? idxB : 9999;
      return posA - posB;
    });
  }

  return items;
}

export function renderNDSTaskItemHtml(o: WorkOrder, daySection?: string, useAnytime?: boolean, ladotdExclusive?: boolean, branding?: TemplateBranding): string {
  const groups = groupDayOrdersByProject([o], useAnytime);
  return groups.length > 0 ? renderNDSTaskGroupHtml(groups[0], daySection, useAnytime, ladotdExclusive, branding) : "";
}

export function renderNDSTaskItemText(o: WorkOrder, daySection?: string, useAnytime?: boolean, ladotdExclusive?: boolean, branding?: TemplateBranding): string {
  const groups = groupDayOrdersByProject([o], useAnytime);
  return groups.length > 0 ? renderNDSTaskGroupText(groups[0], daySection, useAnytime, ladotdExclusive, branding) : "";
}

export function getPriorityColors(priority: string) {
  switch (priority) {
    case "Urgent":
      return { bg: "#FEE2E2", text: "#991B1B", border: "#F87171", badge: "#DC2626" };
    case "High":
      return { bg: "#FFEDD5", text: "#9A3412", border: "#FDBA74", badge: "#EA580C" };
    case "Low":
      return { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1", badge: "#64748B" };
    default:
      return { bg: "#DBEAFE", text: "#1E40AF", border: "#93C5FD", badge: "#2563EB" };
  }
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// Calculate Sunday - Saturday date range for a given date formatted as MM/DD/YYYY
export function formatToMMDDYYYY(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function getWeekDateRange(dateStr: string, branding?: TemplateBranding): {
  sundayStr: string;
  saturdayStr: string;
  formattedRange: string;
  sundayDate: Date;
  sundayFormatted: string;
  saturdayFormatted: string;
  nextSundayFormatted: string;
  nextSundayDate: Date;
} {
  let baseDate = new Date();
  if (dateStr) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) baseDate = parsed;
    }
  }

  const dayOfWeek = baseDate.getDay(); // 0 is Sunday
  const sunday = new Date(baseDate);
  sunday.setDate(baseDate.getDate() - dayOfWeek);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const nextSunday = new Date(sunday);
  nextSunday.setDate(sunday.getDate() + 7);

  const sundayFormatted = formatToMMDDYYYY(sunday);
  const saturdayFormatted = formatToMMDDYYYY(saturday);
  const nextSundayFormatted = formatToMMDDYYYY(nextSunday);

  const formattedRange = branding?.weekStartDate && branding?.weekEndDate
    ? `Sunday, ${branding.weekStartDate} - ${branding?.sundaySundayEnabled ? "Sunday" : "Saturday"}, ${branding.weekEndDate}`
    : branding?.sundaySundayEnabled
    ? `Sunday, ${sundayFormatted} - Sunday, ${nextSundayFormatted}`
    : `Sunday, ${sundayFormatted} - Saturday, ${saturdayFormatted}`;

  return {
    sundayStr: sunday.toISOString().split("T")[0],
    saturdayStr: saturday.toISOString().split("T")[0],
    formattedRange,
    sundayDate: sunday,
    sundayFormatted,
    saturdayFormatted,
    nextSundayFormatted,
    nextSundayDate: nextSunday,
  };
}

// Group work orders by day of week (Sunday = 0 to Saturday = 6, and optional Sunday_Lower)
export function groupOrdersByDayOfWeek(
  orders: WorkOrder[],
  sundayDate: Date,
  useAnytimeTeardowns?: boolean,
  sundaySundayEnabled?: boolean,
  overlappingSchedulesEnabled?: boolean
): Record<string, WorkOrder[]> {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const grouped: Record<string, WorkOrder[]> = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday_Lower: [],
  };

  const baseSunday = new Date(sundayDate.getFullYear(), sundayDate.getMonth(), sundayDate.getDate());
  const baseSundayMs = baseSunday.getTime();

  // Find target work week number for this week (e.g. WW 36)
  const currentWeekNumbers: number[] = [];
  orders.forEach((o) => {
    if (o.workWeek) {
      const match = o.workWeek.match(/\d+/);
      if (match) {
        const d = resolveOrderEffectiveDate(o, useAnytimeTeardowns);
        if (d) {
          const p = d.split("-");
          if (p.length === 3) {
            const dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
            const diff = Math.round((dt.getTime() - baseSundayMs) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff <= (sundaySundayEnabled ? 7 : 6)) {
              if (o.taskCategory === "Install" || !o.setupBefore) {
                currentWeekNumbers.push(parseInt(match[0], 10));
              }
            }
          }
        }
      }
    }
  });

  const targetWwNum =
    currentWeekNumbers.length > 0
      ? currentWeekNumbers.sort(
          (a, b) =>
            currentWeekNumbers.filter((v) => v === b).length - currentWeekNumbers.filter((v) => v === a).length
        )[0]
      : null;

  orders.forEach((order) => {
    const effectiveDate = resolveOrderEffectiveDate(order, useAnytimeTeardowns);
    if (effectiveDate) {
      const parts = effectiveDate.split("-");
      let orderDate: Date | null = null;
      if (parts.length === 3) {
        orderDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        const parsed = new Date(effectiveDate);
        if (!isNaN(parsed.getTime())) {
          orderDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        }
      }

      if (orderDate && !isNaN(orderDate.getTime())) {
        const targetMidnight = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
        const diffDays = Math.round((targetMidnight.getTime() - baseSundayMs) / (1000 * 60 * 60 * 24));

        // Detect if this specific order is an overlapping task originating from a previous work week
        let isFromPreviousWeek = false;

        // Check 1: Explicit workWeek number is lower than current week's target work week
        if (targetWwNum !== null && order.workWeek) {
          const ordWwMatch = order.workWeek.match(/\d+/);
          if (ordWwMatch) {
            const ordWwNum = parseInt(ordWwMatch[0], 10);
            if (ordWwNum < targetWwNum) {
              isFromPreviousWeek = true;
            }
          }
        }

        // Check 2: Setup Before (parent install) was scheduled before baseSunday
        if (!isFromPreviousWeek && order.setupBefore) {
          const setupP = parseDateTimeString(order.setupBefore);
          if (setupP && setupP.date) {
            const sParts = setupP.date.split("-");
            if (sParts.length === 3) {
              const sDate = new Date(parseInt(sParts[0], 10), parseInt(sParts[1], 10) - 1, parseInt(sParts[2], 10));
              if (sDate.getTime() < baseSundayMs) {
                isFromPreviousWeek = true;
              }
            }
          }
        }

        // Check 3: Date range inside workWeek label (e.g. "Work week 08/30/2026 - 09/05/2026")
        if (!isFromPreviousWeek && order.workWeek) {
          const dateMatch = order.workWeek.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const pDate = new Date(dateMatch[1]);
            if (!isNaN(pDate.getTime()) && pDate.getTime() < baseSundayMs) {
              isFromPreviousWeek = true;
            }
          }
        }

        // Check if date falls in current calendar week range (0..6 or 7)
        if (diffDays >= 0 && (diffDays <= 6 || (diffDays === 7 && sundaySundayEnabled))) {
          // If task is from a previous week and overlapping toggle is OFF, exclude it
          if (isFromPreviousWeek && !overlappingSchedulesEnabled) {
            return;
          }

          if (diffDays === 0) {
            grouped["Sunday"].push(order);
            return;
          } else if (diffDays >= 1 && diffDays <= 6) {
            const dayName = days[diffDays];
            grouped[dayName].push(order);
            return;
          } else if (diffDays === 7 && sundaySundayEnabled) {
            grouped["Sunday_Lower"].push(order);
            return;
          }
        } else {
          // Date is strictly outside this work week schedule
          return;
        }
      }
    }

    // Fallback ONLY when the order has no date information at all
    const text = `${order.description || ""} ${order.specialInstructions || ""} ${order.timeSlot || ""}`.toLowerCase();
    if (sundaySundayEnabled && (text.includes("lower sunday") || text.includes("next sunday") || text.includes("following sunday"))) {
      grouped["Sunday_Lower"].push(order);
      return;
    }
    for (const d of days) {
      if (text.includes(d.toLowerCase())) {
        grouped[d].push(order);
        return;
      }
    }
    // Default fallback to Monday or the roster's selected day
    grouped["Monday"].push(order);
  });

  return grouped;
}

/**
 * Convenience wrapper for groupOrdersByDayOfWeek taking branding options
 */
export function groupNDSOrdersByDay(
  orders: WorkOrder[],
  sundayDate: Date,
  branding?: TemplateBranding
): Record<string, WorkOrder[]> {
  return groupOrdersByDayOfWeek(
    orders,
    sundayDate,
    branding?.useAnytimeTeardowns,
    branding?.sundaySundayEnabled,
    branding?.overlappingSchedulesEnabled
  );
}

export const SPEED_INSTALL_NOTE =
  "Note: For SPEED locations, please ensure that poles are extended in order to have our cameras placed high enough to collect good data.";

export const SPEED_TEARDOWN_NOTE =
  'Note: For SPEED locations, please make sure to follow the correct file naming when uploading data for all SPEED locations being collecting by camera. See correct Format: <ALG>SPACE<Project Number>SPACE<SPEED> | Example: “ALG 25-99999 SPEED”.';

export const TMC_INSTALL_NOTE =
  "Note: If the proposed camera placement will not work due to actual site conditions, please use your best judgment where to install the equipment and obtain approval from the region before leaving the site. Also, please ensure that everything within the polygon, including driveways, pedestrian crossing and all possible movements are captured.\nFor backup cameras, it is best to place diagonally where the main camera is.";

export const LADOTD_MON_NOTE =
  `Note:\nFor locations with no street view, please look for a viable ALG cam installation point and have it approved by the region first before leaving the site. Please make sure that cameras are facing the taillights of the vehicles.\n\nFor not collectable locations (no installation points, closed roads, private property, etc), please first consult with Douglas Thomas about locations but also send photos of the locations to the region for confirmation in Google Chat. Once completed, you may skip installing at location.\n\nContinue installing locations not finished today on Tuesday until all inventories have been used up.\n\nIf you are unable to fully allocate your inventory, please follow the escalation protocol provided by your Field Manager or Doug. Thank you!`;

export const LADOTD_START_TUE_NOTE =
  `Note:\nFor locations with no street view, please look for a viable ALG cam installation point and have it approved by the region first before leaving the site. Please make sure that cameras are facing the taillights of the vehicles.\n\nFor not collectable locations (no installation points, closed roads, private property, etc), please first consult with Douglas Thomas about locations but also send photos of the locations to the region for confirmation in Google Chat. Once completed, you may skip installing at location.\n\nIf you are unable to fully allocate your inventory, please follow the escalation protocol provided by your Field Manager or Doug. Thank you!`;

export const LADOTD_TUE_NOTE =
  `Note:\nContinue installing locations not finished yesterday until all inventories have been used up.`;

export const MACHINE_LOCS_TO_CAM_NOTE =
  "Note: Please use cameras for machine locations if you are unable to install the machines due to road conditions. We are unable to determine in advance whether the current road conditions will allow for machine installation. Camera placement has therefore been provided as an alternative option for your installs when machine installation is not feasible.";

export const PEDS_SIGHT_DISTANCE_NOTE =
  "Note: For PEDS locations, please make sure to conduct the sight distance requirement and complete the attached PDF/form link for this SPEED project. Please coordinate with Douglas if you have any questions.";

/**
 * Checks if an order or project has "Speed" in Service Type Add Ons (or any add-on column/field)
 */
export function hasSpeedAddOn(order: WorkOrder): boolean {
  if (order.serviceTypeAddOns && /\bspeed\b/i.test(order.serviceTypeAddOns)) {
    return true;
  }
  if (order.rawRowData) {
    for (const [k, v] of Object.entries(order.rawRowData)) {
      if (/add\s*ons?|speed/i.test(k) && v && /\bspeed\b/i.test(String(v))) {
        return true;
      }
    }
  }
  if (order.jobType && /\bspeed\b/i.test(order.jobType)) {
    return true;
  }
  return false;
}

/**
 * Checks if an order or project has "TMC" in Service Types (or any service type column/field)
 */
export function hasTmcServiceType(order: WorkOrder): boolean {
  if (order.jobType && /\bTMC\b/i.test(order.jobType)) {
    return true;
  }
  if (order.serviceTypeAddOns && /\bTMC\b/i.test(order.serviceTypeAddOns)) {
    return true;
  }
  if (order.rawRowData) {
    for (const [k, v] of Object.entries(order.rawRowData)) {
      if (/service\s*types?|job\s*type/i.test(k) && v && /\bTMC\b/i.test(String(v))) {
        return true;
      }
    }
  }
  return false;
}

export interface AutoDetectedNote {
  id: string;
  day: string;
  text: string;
  rule: "speed_install" | "speed_teardown" | "tmc_install";
  projectNumber?: string;
  autoGenerated: boolean;
}

/**
 * Automatically scans a technician roster for SPEED and TMC rules:
 * - If "Speed" is in Service Type Add Ons:
 *   - Auto-adds SPEED_INSTALL_NOTE on the Day of Install for that project
 *   - Auto-adds SPEED_TEARDOWN_NOTE on the Day of Teardown for that project
 * - If "TMC" is in Service Types:
 *   - Auto-adds TMC_INSTALL_NOTE on the Day of Install for that project
 */
export function autoDetectAdditionalNotesForRoster(
  roster: TechnicianRoster,
  sundayDate: Date,
  useAnytimeTeardowns?: boolean,
  sundaySundayEnabled?: boolean
): AutoDetectedNote[] {
  if (!roster || !roster.orders || roster.orders.length === 0) {
    return [];
  }

  // 1. Identify which project numbers have SPEED and which have TMC across all orders of this roster
  const speedProjects = new Set<string>();
  const tmcProjects = new Set<string>();

  roster.orders.forEach((o) => {
    const proj = (o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber))).trim();
    if (hasSpeedAddOn(o)) {
      if (proj) speedProjects.add(proj);
    }
    if (hasTmcServiceType(o)) {
      if (proj) tmcProjects.add(proj);
    }
  });

  // 2. Group orders by day
  const groupedOrders = groupOrdersByDayOfWeek(
    roster.orders,
    sundayDate,
    useAnytimeTeardowns,
    sundaySundayEnabled
  );

  const notes: AutoDetectedNote[] = [];

  // 3. For each day, check if any order triggers the install / teardown notes
  Object.entries(groupedOrders).forEach(([dayKey, dayOrders]) => {
    if (!dayOrders || dayOrders.length === 0) return;

    let hasSpeedInstallToday = false;
    let hasSpeedTeardownToday = false;
    let hasTmcInstallToday = false;

    dayOrders.forEach((o) => {
      const proj = (o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber))).trim();
      const isTeardown = o.taskCategory === "Teardown";
      const isInstall = (o.taskCategory || "Install") === "Install";

      const isSpeed = (proj && speedProjects.has(proj)) || hasSpeedAddOn(o);
      const isTmc = (proj && tmcProjects.has(proj)) || hasTmcServiceType(o);

      if (isInstall && isSpeed) {
        hasSpeedInstallToday = true;
      }
      if (isTeardown && isSpeed) {
        hasSpeedTeardownToday = true;
      }
      if (isInstall && isTmc) {
        hasTmcInstallToday = true;
      }
    });

    if (hasSpeedInstallToday) {
      notes.push({
        id: `auto-speed-install-${dayKey}`,
        day: dayKey,
        text: SPEED_INSTALL_NOTE,
        rule: "speed_install",
        autoGenerated: true,
      });
    }

    if (hasSpeedTeardownToday) {
      notes.push({
        id: `auto-speed-teardown-${dayKey}`,
        day: dayKey,
        text: SPEED_TEARDOWN_NOTE,
        rule: "speed_teardown",
        autoGenerated: true,
      });
    }

    if (hasTmcInstallToday) {
      notes.push({
        id: `auto-tmc-install-${dayKey}`,
        day: dayKey,
        text: TMC_INSTALL_NOTE,
        rule: "tmc_install",
        autoGenerated: true,
      });
    }
  });

  return notes;
}

export function getAdditionalNotesForDay(
  dayKey: string,
  baseDayName: string,
  branding?: TemplateBranding,
  roster?: TechnicianRoster
): string[] {
  const matchedNotes: string[] = [];
  const seenNoteTexts = new Set<string>();

  // 1. Check user-configured / active branding notes
  if (branding?.additionalNotesEnabled && branding.additionalNotes && branding.additionalNotes.length > 0) {
    branding.additionalNotes.forEach((n) => {
      if (!n.text || !n.text.trim()) return;
      const noteDay = (n.day || "").trim().toLowerCase();
      const keyLower = dayKey.trim().toLowerCase();
      const baseLower = baseDayName.trim().toLowerCase();

      let isMatch = false;
      // Direct exact match
      if (noteDay === keyLower || noteDay === baseLower) {
        isMatch = true;
      } else if (keyLower === "sunday_lower" || keyLower.includes("lower")) {
        // Specific Lower Sunday vs Upper Sunday match
        if (
          noteDay.includes("lower") ||
          noteDay.includes("next") ||
          noteDay.includes("following") ||
          noteDay.includes("2nd") ||
          noteDay.includes("second") ||
          noteDay === "sunday_lower"
        ) {
          isMatch = true;
        }
      } else if (keyLower === "sunday" || keyLower.includes("upper")) {
        if (
          noteDay.includes("upper") ||
          noteDay.includes("first") ||
          noteDay === "sunday" ||
          noteDay.startsWith("sunday (upper")
        ) {
          isMatch = true;
        }
      } else if (noteDay.startsWith(baseLower)) {
        isMatch = true;
      }

      if (isMatch) {
        const trimmed = n.text.trim();
        const normKey = trimmed.replace(/^note\s*[:\-]\s*/i, "").trim().toLowerCase();
        if (!seenNoteTexts.has(normKey)) {
          seenNoteTexts.add(normKey);
          matchedNotes.push(trimmed);
        }
      }
    });
  }

  // 2. Automatically include auto-detected notes from roster orders (SPEED and TMC rules)
  if (roster && roster.orders && roster.orders.length > 0) {
    const weekInfo = getWeekDateRange(roster.date, branding);
    const autoNotes = autoDetectAdditionalNotesForRoster(
      roster,
      weekInfo.sundayDate,
      branding?.useAnytimeTeardowns,
      branding?.sundaySundayEnabled
    );

    autoNotes.forEach((an) => {
      const anDay = an.day.trim().toLowerCase();
      const keyLower = dayKey.trim().toLowerCase();
      const baseLower = baseDayName.trim().toLowerCase();

      let isMatch = false;
      if (anDay === keyLower || anDay === baseLower) {
        isMatch = true;
      } else if (keyLower === "sunday_lower" && anDay.includes("lower")) {
        isMatch = true;
      } else if (keyLower === "sunday" && anDay === "sunday") {
        isMatch = true;
      }

      if (isMatch) {
        const trimmed = an.text.trim();
        const normKey = trimmed.replace(/^note\s*[:\-]\s*/i, "").trim().toLowerCase();
        if (!seenNoteTexts.has(normKey)) {
          seenNoteTexts.add(normKey);
          matchedNotes.push(trimmed);
        }
      }
    });
  }

  return matchedNotes;
}

export function formatNoteTextWithPrefix(text: string): string {
  const trimmed = text.trim();
  if (/^note\s*[:\-]/i.test(trimmed)) {
    return trimmed;
  }
  return `Note: ${trimmed}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Renders an additional note in Outlook HTML with proper green (#00FF00) and yellow (#FFFF00) highlights.
 * For SPEED Teardown notes:
 * - Part 1 (instructions) is highlighted in Green (#00FF00), bold, italic
 * - Part 2 ("See correct Format: <ALG>SPACE<Project Number>SPACE<SPEED> | Example: “ALG 25-99999 SPEED”.") is highlighted in Yellow (#FFFF00), bold, italic
 */
export function renderNDSNoteHtml(noteText: string): string {
  const formatted = formatNoteTextWithPrefix(noteText);

  // Check if this note contains "See correct Format:" or "Example:" (SPEED Teardown note)
  if (/See correct Format\s*:/i.test(formatted)) {
    const splitIndex = formatted.search(/See correct Format\s*:/i);
    const part1 = formatted.substring(0, splitIndex).trim();
    const part2 = formatted.substring(splitIndex).trim();

    return `
    <div style="margin: 4px 0 6px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt; line-height: 1.4;">
      <span style="background-color: #00FF00; mso-highlight: #00FF00; color: #000000; font-weight: bold; font-style: italic; display: inline; padding: 1px 4px;">${escapeHtml(part1)} </span><span style="background-color: #FFFF00; mso-highlight: #FFFF00; color: #000000; font-weight: bold; font-style: italic; display: inline; padding: 1px 4px;">${escapeHtml(part2)}</span>
    </div>`;
  }

  // Handle multiline notes (e.g. TMC install note with newline)
  const lines = formatted.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    return lines
      .map(
        (line) => `
    <div style="margin: 4px 0 4px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt; line-height: 1.4;">
      <span style="background-color: #00FF00; mso-highlight: #00FF00; color: #000000; font-weight: bold; font-style: italic; display: inline-block; padding: 1px 4px;">${escapeHtml(line.trim())}</span>
    </div>`
      )
      .join("");
  }

  return `
  <div style="margin: 4px 0 6px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt; line-height: 1.4;">
    <span style="background-color: #00FF00; mso-highlight: #00FF00; color: #000000; font-weight: bold; font-style: italic; display: inline-block; padding: 1px 4px;">${escapeHtml(formatted)}</span>
  </div>`;
}

/**
 * Highlights 'added' and 'removed' keywords in red font color
 */
export function highlightUpdateKeywordsHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(/\b(added|removed)\b/gi, (match) => {
    return `<span style="color: #FF0000; font-weight: bold;">${match}</span>`;
  });
}

/**
 * Resolves all previous update notes that should be stacked underneath the active update line.
 */
export function resolveStackedPreviousUpdateNotes(
  branding: TemplateBranding,
  roster?: TechnicianRoster
): Array<{ version: number | string; notes: string; text?: string }> {
  // If explicitly configured in branding, use those
  if (branding.previousUpdateNotes && branding.previousUpdateNotes.length > 0) {
    return branding.previousUpdateNotes.filter(
      (p) => (p.notes && p.notes.trim()) || (p.text && p.text.trim())
    );
  }

  // Otherwise, automatically retrieve from local storage history for this tech & week
  if (roster && typeof window !== "undefined") {
    try {
      const currentVerNum =
        typeof branding.updateVersion === "number"
          ? branding.updateVersion
          : parseInt(String(branding.updateVersion || 1), 10) || 1;
      const weekInfo = getWeekDateRange(roster.date, branding);
      return getStoredPreviousUpdateNotes(
        roster.technicianName,
        weekInfo.formattedRange,
        currentVerNum
      );
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Renders the highlighted Yellow Banner for the active update,
 * followed by all stacked previous version update notes (unhighlighted, unbold, keywords red).
 */
export function renderEmailUpdateBannerHtml(
  branding: TemplateBranding,
  roster?: TechnicianRoster
): string {
  if (!branding.emailUpdatesEnabled) return "";
  const vNum = branding.updateVersion !== undefined && branding.updateVersion !== "" ? branding.updateVersion : 1;
  const notesPart = branding.updateNotes?.trim() ? ` ${branding.updateNotes.trim()}` : "";
  const fullRawText = `UPDATE v${vNum}: Schedule is updated.${notesPart}`;
  const formattedText = highlightUpdateKeywordsHtml(fullRawText);

  let html = `
    <!-- Highlighted Email Update Notification Banner (Active Version) -->
    <p style="margin: 0 0 14px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5;">
      <span style="background-color: #FFFF00; color: #000000; font-weight: bold; mso-highlight: yellow; padding: 2px 4px; display: inline;">${formattedText}</span>
    </p>`;

  // Stacked previous version update notes (unhighlighted and unbold, "added" / "removed" red)
  const prevNotes = resolveStackedPreviousUpdateNotes(branding, roster);
  if (prevNotes.length > 0) {
    prevNotes.forEach((p) => {
      const prevLineText =
        p.text ||
        `UPDATE v${p.version}: Schedule is updated.${p.notes ? ` ${p.notes.trim()}` : ""}`;
      const formattedPrevText = highlightUpdateKeywordsHtml(prevLineText);
      html += `
    <!-- Previous Version Update Note (Stacked, Unhighlighted, Unbold) -->
    <p style="margin: 0 0 14px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.5;">
      ${formattedPrevText}
    </p>`;
    });
  }

  return html;
}

export function generateEmailSubject(roster: TechnicianRoster, branding: TemplateBranding): string {
  const weekInfo = getWeekDateRange(roster.date, branding);
  const updateSuffix = branding.emailUpdatesEnabled
    ? ` UPDATE v${branding.updateVersion !== undefined && branding.updateVersion !== "" ? branding.updateVersion : 1}`
    : "";
  return `${roster.technicianName} Weekly Schedule ${weekInfo.formattedRange}${updateSuffix}`;
}

// Generate Outlook HTML formatted email
export function generateOutlookHtml(
  roster: TechnicianRoster,
  branding: TemplateBranding = DEFAULT_BRANDING,
  style: TemplateStyle = "exact_nds_template"
): string {
  const primaryColor = branding.primaryColor || "#0078D4";
  const urgentCount = roster.urgentCount || 0;
  const totalMinutes = roster.totalEstimatedMinutes || roster.orders.length * 60;
  const weekInfo = getWeekDateRange(roster.date, branding);
  const groupedOrders = groupOrdersByDayOfWeek(
    roster.orders,
    weekInfo.sundayDate,
    branding.useAnytimeTeardowns,
    branding.sundaySundayEnabled,
    branding.overlappingSchedulesEnabled
  );

  const airtableUrl = getTechnicianAirtableLink(
    roster.technicianName,
    branding.airtableBaseUrl,
    branding.customTechAirtableLinks,
    weekInfo.formattedRange
  );
  const googleMapsUrl = getTechnicianGoogleMapsLink(
    roster.technicianName,
    branding.googleMapsUrl,
    branding.customTechGoogleMapsLinks,
    branding.googleMapsBaseUrl,
    weekInfo.formattedRange
  );
  const photoUploadUrl = branding.photoUploadUrl || "https://airtable.com/appsVo4SWcGXTkarK/shrBgw2x5NJZwU3Xo";
  const photoUploadText = branding.photoUploadLinkText || "South Central Job Photos";
  const privateJobsNotice = branding.privateJobsNotice || "(FOR PRIVATE JOBS, PLEASE UPLOAD FIELD PHOTOS TO GOOGLE CHAT ONLY IN REAL TIME)";
  const dataUploadEmail = branding.dataUploadEmail || "jobs@ndsdata.com";
  const updateBannerHtml = renderEmailUpdateBannerHtml(branding, roster);

  const isCodSchoolZoneFormActive = Boolean(
    branding.codExclusive &&
      (branding.codSchoolZonePedFormEnabled === undefined ||
        branding.codSchoolZonePedFormEnabled === true)
  );
  const schoolZonePedFormUrl =
    branding.codSchoolZonePedFormUrl || DEFAULT_COD_SCHOOL_ZONE_FORM_URL;
  const schoolZonePedFormText =
    branding.codSchoolZonePedFormText || DEFAULT_COD_SCHOOL_ZONE_FORM_TEXT;

  const codSchoolZoneFormHtml = isCodSchoolZoneFormActive
    ? `<br />\n      <span style="font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt;">📝</span> <a href="${schoolZonePedFormUrl}" style="color: #800080; text-decoration: underline; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;" target="_blank">${escapeHtml(schoolZonePedFormText)}</a>`
    : "";

  // If exact_nds_template is selected (DEFAULT)
  if (style === "exact_nds_template") {
    const daysDefinitions: Array<{ key: string; displayName: string; baseDayName: string }> = branding.sundaySundayEnabled
      ? [
          { key: "Sunday", displayName: `Sunday ${weekInfo.sundayFormatted}`, baseDayName: "Sunday" },
          { key: "Monday", displayName: "Monday", baseDayName: "Monday" },
          { key: "Tuesday", displayName: "Tuesday", baseDayName: "Tuesday" },
          { key: "Wednesday", displayName: "Wednesday", baseDayName: "Wednesday" },
          { key: "Thursday", displayName: "Thursday", baseDayName: "Thursday" },
          { key: "Friday", displayName: "Friday", baseDayName: "Friday" },
          { key: "Saturday", displayName: "Saturday", baseDayName: "Saturday" },
          { key: "Sunday_Lower", displayName: `Sunday ${weekInfo.nextSundayFormatted}`, baseDayName: "Sunday" },
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

    const blankLineSeparator = `<p style="margin: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; line-height: 1.5; mso-line-height-rule: exactly;">&nbsp;</p>`;

    const daysHtml = daysDefinitions
      .map((def) => {
        const dayOrders = groupedOrders[def.key] || [];
        const dayNotes = getAdditionalNotesForDay(def.key, def.baseDayName, branding, roster);
        const dayItems = buildDayScheduleItems(def.key, def.baseDayName, dayOrders, branding);
        let dayBody = "";

        if (dayItems.length > 0) {
          dayBody = `
          <div style="margin: 0;">
            ${dayItems.map((item) => item.html).join("")}
          </div>
          `;
        } else {
          dayBody = `
          <div style="margin: 0;">
            <span style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; font-weight: bold; background-color: #FFFF00; color: #000000; padding: 2px 6px; display: inline-block;">TBD</span>
          </div>
          `;
        }

        const notesHtml = dayNotes.length > 0
          ? dayNotes.map((note) => renderNDSNoteHtml(note)).join("")
          : "";

        return `
        <!-- ${def.displayName} Section -->
        <div style="margin-top: 14px; margin-bottom: 0;">
          <span style="color: #D32F2F; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 18pt; mso-ansi-font-size: 18.0pt; mso-bidi-font-size: 18.0pt; font-weight: bold; text-decoration: underline;">${def.displayName}</span>
        </div>
        ${blankLineSeparator}
        ${notesHtml ? `${notesHtml}\n        ${blankLineSeparator}` : ""}
        ${dayBody}
        <!-- Divider Line between Day Sections (Outlook Desktop & Web Compatible) -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100% !important; margin: 12px 0 16px 0; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          <tr>
            <td style="border-bottom: 1px solid #000000; height: 1px; line-height: 1px; font-size: 1px; mso-line-height-rule: exactly; padding: 0;">&nbsp;</td>
          </tr>
        </table>
        `;
      })
      .join("");

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Installs Schedule: ${roster.technicianName}</title>
  <style type="text/css">
    body, table, td, a, p, div, span, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table { border-collapse: collapse !important; }
    body, p, td, div, span, li { font-family: Calibri, 'Segoe UI', Arial, Helvetica, sans-serif !important; font-size: 11pt; color: #000000; line-height: 1.5; mso-line-height-rule: exactly; }
    body { margin: 0; padding: 16px; background-color: #FFFFFF; }
  </style>
</head>
<body style="font-family: Calibri, 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.5; margin: 0; padding: 16px; background-color: #FFFFFF;">
  <div style="max-width: 800px; width: 100%; margin: 0 auto; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;">
    
    <!-- Greeting -->
    <p style="margin: 0 0 14px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.5;">
      Hello ${extractFirstName(roster.technicianName)},
    </p>

    ${updateBannerHtml}

    <!-- Intro Body -->
    <p style="margin: 0 0 14px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.5;">
      Hope your week is off to a great start. Please see the attached documents and the table below regarding installs for ${weekInfo.formattedRange}. Please be prepared for your scheduled installs and pop-up installs throughout the week.
    </p>

    <p style="margin: 0 0 16px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.5;">
      As the road could be different than it is on Google Earth, please use your best judgment where to install the cameras/machines.
    </p>

    <!-- Links Section -->
    <p style="margin: 0 0 4px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.8;">
      Airtable Schedule Link: <a href="${airtableUrl}" style="color: #0078D4; text-decoration: underline; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;" target="_blank">${cleanTechnicianName(roster.technicianName)} Airtable View</a><br />
      <span style="font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt;">🌍</span> Google Maps App: <a href="${googleMapsUrl}" style="color: #0078D4; text-decoration: underline; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;" target="_blank">${cleanTechnicianName(roster.technicianName)} | ${weekInfo.formattedRange} Maps</a><br />
      <span style="font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt;">📷</span> Location Setup Photo Upload Link: <a href="${photoUploadUrl}" style="color: #0078D4; text-decoration: underline; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;" target="_blank">${photoUploadText}</a>${codSchoolZoneFormHtml}
    </p>

    <!-- Highlighted Private Jobs Note in Lime Green (Size 14) -->
    <p style="margin: 14px 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 14pt; mso-ansi-font-size: 14.0pt; mso-bidi-font-size: 14.0pt; font-weight: bold; font-style: italic; text-decoration: underline; color: #16A34A; line-height: 1.5;">
      ${privateJobsNotice}
    </p>

    <!-- Days List (Sunday - Saturday) -->
    ${daysHtml}

    <!-- General Notes Section -->
    <div style="margin-top: 24px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; color: #000000; line-height: 1.6;">
      <div style="font-weight: bold; text-decoration: underline; margin-bottom: 8px; font-size: 12pt; mso-ansi-font-size: 12.0pt; mso-bidi-font-size: 12.0pt; color: #000000;">
        General Notes
      </div>
      <ul style="margin: 0; padding-left: 20px; list-style-type: disc; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt;">
        <li style="margin-bottom: 8px; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5;">
          Please remember to click <strong>“REPLY ALL”</strong> to ensure all necessary parties receive the report. Failure to submit a field report will result in disciplinary action.
        </li>
        <li style="margin-bottom: 8px; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5;">
          If any issues arise—whether general or data-related—please reach out to your field manager. If you do not receive a response, follow your escalation chain.
        </li>
        <li style="margin-bottom: 8px; font-size: 11pt; mso-ansi-font-size: 11.0pt; mso-bidi-font-size: 11.0pt; line-height: 1.5;">
          Once data is obtained, begin the upload process immediately before ending your shift, regardless of whether the data is good or bad. <strong><u>Failure to do so will result in disciplinary action.</u></strong> Your shift is not over until you have successfully completed the transfer to FileZilla and/or sent the data to <a href="mailto:${dataUploadEmail}" style="color: #0078D4; text-decoration: underline;">${dataUploadEmail}</a>, and submitted your field report.
        </li>
      </ul>
    </div>

  </div>
</body>
</html>`;
  }

  // AI Briefing section for other layouts
  let aiBriefingHtml = "";
  if (roster.aiBriefing) {
    aiBriefingHtml = `
    <!-- AI Briefing & Safety Callout -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid ${primaryColor}; border-radius: 4px;">
      <tr>
        <td style="padding: 16px; font-family: 'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size: 14px; font-weight: 700; color: #1E293B; text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 6px;">
                ⚡ Daily Morning Dispatch Briefing
              </td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #334155; line-height: 1.6; padding-bottom: 10px;">
                ${roster.aiBriefing.briefing}
              </td>
            </tr>
            ${
              roster.aiBriefing.safetyAlert
                ? `
            <tr>
              <td style="padding-top: 6px; padding-bottom: 6px;">
                <table cellpadding="0" cellspacing="0" border="0" style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 4px; width: 100%;">
                  <tr>
                    <td style="padding: 8px 12px; font-size: 13px; color: #92400E; font-weight: 600; font-family: 'Segoe UI', Arial, sans-serif;">
                      ⚠️ Safety Focus: <span style="font-weight: 400; color: #78350F;">${roster.aiBriefing.safetyAlert}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ""
            }
            ${
              roster.aiBriefing.keyHighlights && roster.aiBriefing.keyHighlights.length > 0
                ? `
            <tr>
              <td style="padding-top: 8px;">
                <div style="font-size: 12px; font-weight: 700; color: #64748B; margin-bottom: 4px;">KEY ROUTE HIGHLIGHTS:</div>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.5;">
                  ${roster.aiBriefing.keyHighlights.map((k) => `<li style="margin-bottom: 3px;">${k}</li>`).join("")}
                </ul>
              </td>
            </tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
    `;
  }

  // Work order rows generator
  let workOrdersContent = "";

  if (style === "compact_table") {
    workOrdersContent = `
    <!-- Compact Table View -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #CBD5E1;">
      <thead>
        <tr style="background-color: #0F172A; color: #FFFFFF;">
          <th style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; text-align: left; border: 1px solid #334155;"># / Time</th>
          <th style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; text-align: left; border: 1px solid #334155;">Customer & Address</th>
          <th style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; text-align: left; border: 1px solid #334155;">Task & Priority</th>
          <th style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; text-align: left; border: 1px solid #334155;">Parts / Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${roster.orders
          .map((order, idx) => {
            const pColors = getPriorityColors(order.priority);
            const rowBg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.serviceAddress)}`;
            return `
          <tr style="background-color: ${rowBg};">
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; border: 1px solid #E2E8F0; vertical-align: top;">
              <div style="font-weight: 700; color: #0F172A;">${order.orderNumber}</div>
              <div style="color: #2563EB; font-size: 12px; font-weight: 600; margin-top: 3px;">${order.timeSlot}</div>
              <div style="color: #64748B; font-size: 11px;">Est: ${order.estimatedDurationMin || 60}m</div>
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; border: 1px solid #E2E8F0; vertical-align: top;">
              <div style="font-weight: 700; color: #1E293B;">${order.customerName}</div>
              <div style="color: #475569; font-size: 12px; margin-top: 2px;">
                <a href="${mapUrl}" target="_blank" style="color: ${primaryColor}; text-decoration: none;">📍 ${order.serviceAddress}</a>
              </div>
              <div style="color: #64748B; font-size: 12px; margin-top: 2px;">
                📞 <a href="tel:${order.customerPhone}" style="color: #334155; text-decoration: none;">${order.customerPhone}</a>
              </div>
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; border: 1px solid #E2E8F0; vertical-align: top;">
              <div style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: ${pColors.bg}; color: ${pColors.text}; border: 1px solid ${pColors.border}; margin-bottom: 4px;">
                ${order.priority.toUpperCase()}
              </div>
              <div style="font-weight: 600; color: #0F172A;">${order.jobType}</div>
              <div style="color: #475569; font-size: 12px; margin-top: 2px;">${order.description}</div>
            </td>
            <td style="padding: 10px 12px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; border: 1px solid #E2E8F0; vertical-align: top;">
              ${order.requiredParts ? `<div style="color: #0369A1; font-weight: 600; margin-bottom: 3px;">🔧 ${order.requiredParts}</div>` : ""}
              ${order.specialInstructions ? `<div style="color: #B45309; font-style: italic;">📝 ${order.specialInstructions}</div>` : ""}
            </td>
          </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
    `;
  } else if (style === "field_cards") {
    workOrdersContent = `
    <!-- Field Tech Step-by-Step Stop Cards -->
    <div style="margin-bottom: 24px;">
      ${roster.orders
        .map((order, idx) => {
          const pColors = getPriorityColors(order.priority);
          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.serviceAddress)}`;
          return `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
          <!-- Card Header Bar -->
          <tr style="background-color: #F8FAFC; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 12px 16px; font-family: 'Segoe UI', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: ${primaryColor}; color: #FFFFFF; font-weight: 700; font-size: 12px; padding: 3px 8px; border-radius: 4px; margin-right: 8px;">
                      STOP ${idx + 1}
                    </span>
                    <strong style="font-size: 15px; color: #0F172A;">${order.timeSlot}</strong>
                    <span style="color: #64748B; font-size: 13px; margin-left: 8px;">(${order.orderNumber})</span>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background-color: ${pColors.bg}; color: ${pColors.text}; border: 1px solid ${pColors.border};">
                      ${order.priority.toUpperCase()} PRIORITY
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card Body -->
          <tr>
            <td style="padding: 16px; font-family: 'Segoe UI', Arial, sans-serif;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: top; width: 60%; padding-right: 16px;">
                    <div style="font-size: 16px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">
                      ${order.jobType}
                    </div>
                    <div style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 12px;">
                      ${order.description}
                    </div>
                    
                    ${
                      order.requiredParts
                        ? `
                    <div style="background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px;">
                      <div style="font-size: 11px; font-weight: 700; color: #0369A1; text-transform: uppercase;">Required Parts & Tools:</div>
                      <div style="font-size: 13px; color: #0C4A6E; font-weight: 500; margin-top: 2px;">${order.requiredParts}</div>
                    </div>`
                        : ""
                    }

                    ${
                      order.specialInstructions
                        ? `
                    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 4px; padding: 8px 12px;">
                      <div style="font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase;">Dispatcher Special Notes:</div>
                      <div style="font-size: 13px; color: #78350F; margin-top: 2px;">${order.specialInstructions}</div>
                    </div>`
                        : ""
                    }
                  </td>
                  <td style="vertical-align: top; width: 40%; background-color: #F8FAFC; border-radius: 4px; padding: 12px; border: 1px solid #E2E8F0;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Customer & Location</div>
                    <div style="font-size: 14px; font-weight: 700; color: #0F172A; margin-bottom: 2px;">${order.customerName}</div>
                    <div style="font-size: 12px; color: #334155; margin-bottom: 8px;">
                      📍 <a href="${mapUrl}" target="_blank" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">${order.serviceAddress}</a>
                    </div>
                    <div style="font-size: 12px; color: #334155; margin-bottom: 12px;">
                      📞 <a href="tel:${order.customerPhone}" style="color: #0F172A; font-weight: 600; text-decoration: none;">${order.customerPhone}</a>
                    </div>

                    <!-- Action Navigation Button -->
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td align="center" style="background-color: ${primaryColor}; border-radius: 4px;">
                          <a href="${mapUrl}" target="_blank" style="display: block; padding: 8px 12px; font-size: 12px; color: #FFFFFF; font-weight: 600; text-decoration: none; font-family: 'Segoe UI', Arial, sans-serif;">
                            🗺️ Open GPS Navigation
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        `;
        })
        .join("")}
    </div>
    `;
  } else if (style === "safety_priority") {
    workOrdersContent = `
    <!-- High Priority & Safety Highlight Layout -->
    <div style="margin-bottom: 24px;">
      <!-- Critical Priority Callout Banner -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px; background-color: #FEF2F2; border: 2px solid #DC2626; border-radius: 6px;">
        <tr>
          <td style="padding: 14px 18px; font-family: 'Segoe UI', Arial, sans-serif;">
            <div style="font-size: 14px; font-weight: 800; color: #991B1B; text-transform: uppercase;">
              🚨 Critical Shift Priority Overview (${urgentCount} Urgent / Emergency Jobs Assigned)
            </div>
            <div style="font-size: 13px; color: #7F1D1D; margin-top: 4px;">
              Please review all safety protocols, Lockout/Tagout procedures, and required PPE before arriving on job sites.
            </div>
          </td>
        </tr>
      </table>

      <!-- Standard Table -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border: 1px solid #E2E8F0;">
        ${roster.orders
          .map((order, idx) => {
            const pColors = getPriorityColors(order.priority);
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.serviceAddress)}`;
            const isUrgent = order.priority === "Urgent";
            return `
          <tr style="background-color: ${isUrgent ? "#FFF5F5" : idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC"}; border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 16px; font-family: 'Segoe UI', Arial, sans-serif; vertical-align: top;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: top; width: 25%;">
                    <div style="font-size: 14px; font-weight: 700; color: #0F172A;">${order.timeSlot}</div>
                    <div style="font-size: 12px; color: #64748B; margin-top: 2px;">${order.orderNumber}</div>
                    <div style="margin-top: 6px;">
                      <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background-color: ${pColors.bg}; color: ${pColors.text}; border: 1px solid ${pColors.border};">
                        ${order.priority.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td style="vertical-align: top; width: 45%; padding-left: 12px; padding-right: 12px;">
                    <div style="font-size: 15px; font-weight: 700; color: #1E293B;">${order.jobType}</div>
                    <div style="font-size: 13px; color: #475569; margin-top: 4px;">${order.description}</div>
                    ${
                      order.requiredParts
                        ? `<div style="font-size: 12px; color: #0369A1; font-weight: 600; margin-top: 6px;">🔧 Required Parts: ${order.requiredParts}</div>`
                        : ""
                    }
                    ${
                      order.specialInstructions
                        ? `<div style="font-size: 12px; color: #B45309; margin-top: 4px;">⚠️ ${order.specialInstructions}</div>`
                        : ""
                    }
                  </td>
                  <td style="vertical-align: top; width: 30%; font-size: 13px;">
                    <div style="font-weight: 700; color: #0F172A;">${order.customerName}</div>
                    <div style="color: #475569; font-size: 12px; margin-top: 2px;">
                      <a href="${mapUrl}" target="_blank" style="color: ${primaryColor}; text-decoration: none;">📍 ${order.serviceAddress}</a>
                    </div>
                    <div style="color: #64748B; font-size: 12px; margin-top: 4px;">
                      📞 <a href="tel:${order.customerPhone}" style="color: #334155; text-decoration: none; font-weight: 600;">${order.customerPhone}</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `;
          })
          .join("")}
      </table>
    </div>
    `;
  } else {
    // Default: Modern Executive Style
    workOrdersContent = `
    <!-- Modern Executive Route Layout -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 24px;">
      ${roster.orders
        .map((order, idx) => {
          const pColors = getPriorityColors(order.priority);
          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.serviceAddress)}`;
          return `
        <tr>
          <td style="padding-bottom: 14px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; border-left: 4px solid ${pColors.badge};">
              <tr>
                <td style="padding: 16px; font-family: 'Segoe UI', Arial, sans-serif;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <!-- Top Row: Time, Order#, Priority -->
                    <tr>
                      <td style="vertical-align: middle; padding-bottom: 8px;">
                        <span style="font-size: 15px; font-weight: 800; color: #0F172A;">
                          ⏰ ${order.timeSlot}
                        </span>
                        <span style="font-size: 13px; color: #64748B; margin-left: 10px;">
                          WO: <strong>${order.orderNumber}</strong>
                        </span>
                        <span style="font-size: 12px; color: #94A3B8; margin-left: 10px;">
                          (~${order.estimatedDurationMin || 60} min)
                        </span>
                      </td>
                      <td style="text-align: right; vertical-align: middle; padding-bottom: 8px;">
                        <span style="display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background-color: ${pColors.bg}; color: ${pColors.text}; border: 1px solid ${pColors.border};">
                          ${order.priority.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                    <!-- Main details -->
                    <tr>
                      <td colspan="2" style="padding-top: 4px; padding-bottom: 8px; border-top: 1px dashed #F1F5F9;">
                        <div style="font-size: 15px; font-weight: 700; color: #1E293B; margin-bottom: 4px;">
                          ${order.jobType}
                        </div>
                        <div style="font-size: 13px; color: #475569; line-height: 1.5;">
                          ${order.description}
                        </div>
                      </td>
                    </tr>
                    <!-- Location & Contacts Row -->
                    <tr>
                      <td colspan="2" style="background-color: #F8FAFC; border-radius: 4px; padding: 10px 12px; margin-top: 6px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="font-size: 13px; color: #334155; vertical-align: middle;">
                              <strong>Customer:</strong> ${order.customerName} &nbsp;|&nbsp; 
                              <strong>Address:</strong> <a href="${mapUrl}" target="_blank" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">📍 ${order.serviceAddress}</a> &nbsp;|&nbsp; 
                              <strong>Phone:</strong> <a href="tel:${order.customerPhone}" style="color: #0F172A; text-decoration: none; font-weight: 600;">📞 ${order.customerPhone}</a>
                            </td>
                          </tr>
                          ${
                            order.requiredParts
                              ? `
                          <tr>
                            <td style="font-size: 12px; color: #0369A1; padding-top: 6px; font-weight: 600;">
                              🔧 <strong>Parts Required:</strong> ${order.requiredParts}
                            </td>
                          </tr>`
                              : ""
                          }
                          ${
                            order.specialInstructions
                              ? `
                          <tr>
                            <td style="font-size: 12px; color: #B45309; padding-top: 4px; font-style: italic;">
                              📝 <strong>Special Instructions:</strong> ${order.specialInstructions}
                            </td>
                          </tr>`
                              : ""
                          }
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        `;
        })
        .join("")}
    </table>
    `;
  }

  // Complete Outlook HTML Document with MSO and Table structure
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <!--[if gte mso 9]>
  <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
  </xml>
  <![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Technician Schedule: ${roster.technicianName}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F1F5F9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .stack-column { display: block !important; width: 100% !important; direction: ltr !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <!-- Centered Email Container Wrapper -->
  <center style="width: 100%; background-color: #F1F5F9; padding: 24px 0;">
    <!--[if mso]>
    <table align="center" border="0" cellspacing="0" cellpadding="0" width="680">
    <tr>
    <td align="center" valign="top" width="680">
    <![endif]-->
    <table class="email-container" align="center" border="0" cellpadding="0" cellspacing="0" width="680" style="max-width: 680px; width: 100%; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      
      <!-- Top Brand Header Banner -->
      <tr>
        <td style="background-color: #0F172A; padding: 20px 24px; border-bottom: 4px solid ${primaryColor};">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 20px; font-weight: 800; color: #FFFFFF; font-family: 'Segoe UI', Arial, sans-serif; letter-spacing: -0.5px;">
                  ${branding.companyName}
                </div>
                <div style="font-size: 12px; color: #94A3B8; font-family: 'Segoe UI', Arial, sans-serif; margin-top: 2px;">
                  Official Field Service Dispatch &amp; Work Order Roster
                </div>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div style="display: inline-block; background-color: rgba(255,255,255,0.12); padding: 6px 12px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);">
                  <div style="font-size: 11px; color: #94A3B8; text-transform: uppercase; font-weight: 700;">SERVICE DATE</div>
                  <div style="font-size: 14px; font-weight: 700; color: #38BDF8;">${roster.date}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Technician Salutation & Summary Metrics Bar -->
      <tr>
        <td style="padding: 24px 24px 16px 24px; font-family: 'Segoe UI', Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: top; padding-bottom: 16px;">
                <div style="font-size: 22px; font-weight: 800; color: #0F172A;">
                  ${branding.greetingPrefix}, ${extractFirstName(roster.technicianName)} 👋
                </div>
                <div style="font-size: 14px; color: #64748B; margin-top: 4px;">
                  You have <strong>${roster.orders.length} assigned appointments</strong> on your itinerary today. Please review the customer work orders below.
                </div>
              </td>
            </tr>
          </table>

          <!-- Metric Highlight Cards -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;">
            <tr>
              <td align="center" style="padding: 12px 8px; border-right: 1px solid #E2E8F0; width: 25%;">
                <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Total Stops</div>
                <div style="font-size: 20px; font-weight: 800; color: #0F172A; margin-top: 2px;">${roster.orders.length}</div>
              </td>
              <td align="center" style="padding: 12px 8px; border-right: 1px solid #E2E8F0; width: 25%;">
                <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">Est. Work Time</div>
                <div style="font-size: 20px; font-weight: 800; color: #0F172A; margin-top: 2px;">${formatMinutes(totalMinutes)}</div>
              </td>
              <td align="center" style="padding: 12px 8px; border-right: 1px solid #E2E8F0; width: 25%;">
                <div style="font-size: 11px; font-weight: 700; color: #DC2626; text-transform: uppercase;">Urgent Tickets</div>
                <div style="font-size: 20px; font-weight: 800; color: ${urgentCount > 0 ? "#DC2626" : "#0F172A"}; margin-top: 2px;">${urgentCount}</div>
              </td>
              <td align="center" style="padding: 12px 8px; width: 25%;">
                <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase;">First Arrival</div>
                <div style="font-size: 16px; font-weight: 800; color: ${primaryColor}; margin-top: 4px;">${roster.orders[0]?.timeSlot.split("-")[0].trim() || "08:00 AM"}</div>
              </td>
            </tr>
          </table>

          ${aiBriefingHtml}

          <!-- Work Orders Section Header -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px;">
            <tr>
              <td style="font-size: 16px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.5px;">
                📋 Assigned Daily Work Orders
              </td>
              <td style="text-align: right; font-size: 12px; color: #64748B;">
                Sorted chronologically by window
              </td>
            </tr>
          </table>

          <!-- Main Work Orders List -->
          ${workOrdersContent}

          ${
            branding.includeChecklist
              ? `
          <!-- Pre-Departure Tech Checklist -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px;">
            <tr>
              <td style="font-family: 'Segoe UI', Arial, sans-serif;">
                <div style="font-size: 13px; font-weight: 700; color: #1E293B; margin-bottom: 8px;">
                  ✅ MANDATORY PRE-SHIFT FIELD CHECKLIST:
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12px; color: #475569;">
                  <tr>
                    <td style="padding: 3px 0;">[ ] Vehicle fluid &amp; tire pressure pre-trip inspection</td>
                    <td style="padding: 3px 0;">[ ] Verified specialized parts in truck inventory</td>
                  </tr>
                  <tr>
                    <td style="padding: 3px 0;">[ ] Calibrated multimeter &amp; required safety PPE</td>
                    <td style="padding: 3px 0;">[ ] Charged tablet &amp; mobile field dispatch app</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>`
              : ""
          }

          <!-- Dispatcher Sign-off & Hotline Footer -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #E2E8F0; padding-top: 16px; margin-top: 8px;">
            <tr>
              <td style="vertical-align: top; width: 60%; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #334155;">
                <div style="font-weight: 700; color: #0F172A;">${branding.dispatcherName}</div>
                <div style="color: #64748B; font-size: 12px;">${branding.dispatcherTitle} &bull; ${branding.companyName}</div>
                <div style="color: #64748B; font-size: 12px; margin-top: 4px;">
                  Email: <a href="mailto:${branding.replyToEmail}" style="color: ${primaryColor}; text-decoration: none;">${branding.replyToEmail}</a>
                </div>
              </td>
              <td style="vertical-align: top; width: 40%; text-align: right; font-family: 'Segoe UI', Arial, sans-serif;">
                <div style="display: inline-block; background-color: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 4px; padding: 8px 12px; text-align: right;">
                  <div style="font-size: 10px; font-weight: 700; color: #1E40AF; text-transform: uppercase;">Dispatcher Live Hotline</div>
                  <div style="font-size: 14px; font-weight: 800; color: #1D4ED8; margin-top: 2px;">
                    <a href="tel:${branding.supportPhone}" style="color: #1D4ED8; text-decoration: none;">${branding.supportPhone}</a>
                  </div>
                </div>
              </td>
            </tr>
          </table>

        </td>
      </tr>

      <!-- Disclaimer & Confidentiality Notice -->
      <tr>
        <td style="background-color: #F8FAFC; padding: 16px 24px; border-top: 1px solid #E2E8F0; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #94A3B8; line-height: 1.5; text-align: center;">
          ${branding.customDisclaimer}
          <div style="margin-top: 6px; font-size: 10px; color: #CBD5E1;">
            Generated via Outlook Schedule Dispatch Automation System &bull; Confidential Field Service Roster
          </div>
        </td>
      </tr>

    </table>
    <!--[if mso]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </center>
</body>
</html>`;
}

// Generate Plain Text Fallback
export function generatePlainTextEmail(roster: TechnicianRoster, branding: TemplateBranding): string {
  const weekInfo = getWeekDateRange(roster.date, branding);
  const groupedOrders = groupOrdersByDayOfWeek(
    roster.orders,
    weekInfo.sundayDate,
    branding.useAnytimeTeardowns,
    branding.sundaySundayEnabled,
    branding.overlappingSchedulesEnabled
  );
  const photoUploadText = branding.photoUploadLinkText || "South Central Job Photos";
  const photoUploadUrl = branding.photoUploadUrl || "https://airtable.com/appsVo4SWcGXTkarK/shrBgw2x5NJZwU3Xo";
  const privateJobsNotice = branding.privateJobsNotice || "(FOR PRIVATE JOBS, PLEASE UPLOAD FIELD PHOTOS TO GOOGLE CHAT ONLY IN REAL TIME)";
  const dataUploadEmail = branding.dataUploadEmail || "jobs@ndsdata.com";
  const airtableUrl = getTechnicianAirtableLink(
    roster.technicianName,
    branding.airtableBaseUrl,
    branding.customTechAirtableLinks,
    weekInfo.formattedRange
  );
  const googleMapsUrl = getTechnicianGoogleMapsLink(
    roster.technicianName,
    branding.googleMapsUrl,
    branding.customTechGoogleMapsLinks,
    branding.googleMapsBaseUrl,
    weekInfo.formattedRange
  );
  const daysDefinitions: Array<{ key: string; displayName: string; baseDayName: string }> = branding.sundaySundayEnabled
    ? [
        { key: "Sunday", displayName: `Sunday ${weekInfo.sundayFormatted}`, baseDayName: "Sunday" },
        { key: "Monday", displayName: "Monday", baseDayName: "Monday" },
        { key: "Tuesday", displayName: "Tuesday", baseDayName: "Tuesday" },
        { key: "Wednesday", displayName: "Wednesday", baseDayName: "Wednesday" },
        { key: "Thursday", displayName: "Thursday", baseDayName: "Thursday" },
        { key: "Friday", displayName: "Friday", baseDayName: "Friday" },
        { key: "Saturday", displayName: "Saturday", baseDayName: "Saturday" },
        { key: "Sunday_Lower", displayName: `Sunday ${weekInfo.nextSundayFormatted}`, baseDayName: "Sunday" },
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

  const lines: string[] = [];
  lines.push(`Hello ${extractFirstName(roster.technicianName)},\n`);

  if (branding.emailUpdatesEnabled) {
    const vNum = branding.updateVersion !== undefined && branding.updateVersion !== "" ? branding.updateVersion : 1;
    const notesPart = branding.updateNotes?.trim() ? ` ${branding.updateNotes.trim()}` : "";
    lines.push(`UPDATE v${vNum}: Schedule is updated.${notesPart}\n`);

    const prevNotes = resolveStackedPreviousUpdateNotes(branding, roster);
    if (prevNotes.length > 0) {
      prevNotes.forEach((p) => {
        const prevLineText =
          p.text ||
          `UPDATE v${p.version}: Schedule is updated.${p.notes ? ` ${p.notes.trim()}` : ""}`;
        lines.push(`${prevLineText}\n`);
      });
    }
  }

  const isCodSchoolZoneFormActive = Boolean(
    branding.codExclusive &&
      (branding.codSchoolZonePedFormEnabled === undefined ||
        branding.codSchoolZonePedFormEnabled === true)
  );
  const schoolZonePedFormUrl =
    branding.codSchoolZonePedFormUrl || DEFAULT_COD_SCHOOL_ZONE_FORM_URL;
  const schoolZonePedFormText =
    branding.codSchoolZonePedFormText || DEFAULT_COD_SCHOOL_ZONE_FORM_TEXT;

  lines.push(`Hope your week is off to a great start. Please see the attached documents and the table below regarding installs for ${weekInfo.formattedRange}. Please be prepared for your scheduled installs and pop-up installs throughout the week.\n`);
  lines.push(`As the road could be different than it is on Google Earth, please use your best judgment where to install the cameras/machines.\n`);
  lines.push(`Airtable Schedule Link: ${cleanTechnicianName(roster.technicianName)} Airtable View (${airtableUrl})`);
  lines.push(`🌍 Google Maps App: ${cleanTechnicianName(roster.technicianName)} | ${weekInfo.formattedRange} Maps (${googleMapsUrl})`);
  lines.push(`📷 Location Setup Photo Upload Link: ${photoUploadText} (${photoUploadUrl})`);
  if (isCodSchoolZoneFormActive) {
    lines.push(`📝 ${schoolZonePedFormText} (${schoolZonePedFormUrl})`);
  }
  lines.push("");
  lines.push(`${privateJobsNotice}\n`);

  daysDefinitions.forEach((def) => {
    lines.push(def.displayName);
    lines.push(""); // 1-line space separator after Day heading
    const dayNotes = getAdditionalNotesForDay(def.key, def.baseDayName, branding, roster);
    if (dayNotes.length > 0) {
      dayNotes.forEach((n) => {
        const formattedNote = formatNoteTextWithPrefix(n);
        lines.push(formattedNote);
      });
      lines.push(""); // 1-line space separator after Notes
    }
    const dayOrders = groupedOrders[def.key] || [];
    const dayItems = buildDayScheduleItems(def.key, def.baseDayName, dayOrders, branding);
    if (dayItems.length > 0) {
      dayItems.forEach((it) => {
        lines.push(it.text);
      });
      lines.push("");
    } else {
      lines.push("TBD");
      lines.push("");
    }
    lines.push("________________________________________");
    lines.push("");
  });

  lines.push(`\nGeneral Notes`);
  lines.push(`•\tPlease remember to click “REPLY ALL” to ensure all necessary parties receive the report. Failure to submit a field report will result in disciplinary action.`);
  lines.push(`•\tIf any issues arise—whether general or data-related—please reach out to your field manager. If you do not receive a response, follow your escalation chain.`);
  lines.push(`•\tOnce data is obtained, begin the upload process immediately before ending your shift, regardless of whether the data is good or bad. Failure to do so will result in disciplinary action. Your shift is not over until you have successfully completed the transfer to FileZilla and/or sent the data to ${dataUploadEmail}, and submitted your field report.`);

  return lines.join("\n");
}

// Generate standard RFC 822 .EML format file content (compatible with Outlook Desktop, Mac, Windows)
export function generateEmlFileContent(
  roster: TechnicianRoster,
  branding: TemplateBranding,
  style: TemplateStyle,
  attachments?: EmailAttachment[]
): string {
  const subject = generateEmailSubject(roster, branding);
  const plainText = generatePlainTextEmail(roster, branding);
  const htmlContent = generateOutlookHtml(roster, branding, style);
  const now = new Date().toUTCString();
  const effectiveAttachments = attachments || branding.attachments || [];

  if (effectiveAttachments.length === 0) {
    const boundary = `----=_NextPart_${Math.random().toString(36).substring(2)}_${Date.now()}`;
    return [
      `From: "${branding.dispatcherName}" <${branding.replyToEmail}>`,
      `To: "${roster.technicianName}" <${roster.technicianEmail}>`,
      `Date: ${now}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `X-Mailer: Microsoft Outlook Compatible Dispatch Automation`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      plainText,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      htmlContent,
      ``,
      `--${boundary}--`,
    ].join("\r\n");
  }

  // Nested multipart/mixed with multipart/alternative body + attachments
  const mixedBoundary = `----=_MixedPart_${Math.random().toString(36).substring(2)}_${Date.now()}`;
  const altBoundary = `----=_AltPart_${Math.random().toString(36).substring(2)}_${Date.now()}`;

  const lines: string[] = [
    `From: "${branding.dispatcherName}" <${branding.replyToEmail}>`,
    `To: "${roster.technicianName}" <${roster.technicianEmail}>`,
    `Date: ${now}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `X-Mailer: Microsoft Outlook Compatible Dispatch Automation`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="utf-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    plainText,
    ``,
    `--${altBoundary}`,
    `Content-Type: text/html; charset="utf-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    htmlContent,
    ``,
    `--${altBoundary}--`,
  ];

  // Append each attachment
  effectiveAttachments.forEach((att) => {
    const formattedBase64 = att.base64Data
      ? att.base64Data.match(/.{1,76}/g)?.join("\r\n") || att.base64Data
      : "";
    const mimeType = att.type || "application/octet-stream";

    lines.push(
      ``,
      `--${mixedBoundary}`,
      `Content-Type: ${mimeType}; name="${att.name}"`,
      `Content-Disposition: attachment; filename="${att.name}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      formattedBase64
    );
  });

  lines.push(``, `--${mixedBoundary}--`);
  return lines.join("\r\n");
}

// Deep link to Outlook Office 365 Web Compose
export function getOutlook365WebUrl(roster: TechnicianRoster, branding: TemplateBranding): string {
  const subject = generateEmailSubject(roster, branding);
  const body = generatePlainTextEmail(roster, branding);
  const params = new URLSearchParams({
    to: roster.technicianEmail,
    subject: subject,
    body: body,
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
}

// Deep link to Outlook Live / Hotmail Web Compose
export function getOutlookLiveWebUrl(roster: TechnicianRoster, branding: TemplateBranding): string {
  const subject = generateEmailSubject(roster, branding);
  const body = generatePlainTextEmail(roster, branding);
  const params = new URLSearchParams({
    to: roster.technicianEmail,
    subject: subject,
    body: body,
  });
  return `https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`;
}

// Standard Mailto URL
export function getMailtoUrl(roster: TechnicianRoster, branding: TemplateBranding): string {
  const subject = encodeURIComponent(generateEmailSubject(roster, branding));
  const body = encodeURIComponent(generatePlainTextEmail(roster, branding));
  return `mailto:${encodeURIComponent(roster.technicianEmail)}?subject=${subject}&body=${body}`;
}

// Download single .eml file
export function downloadEmlFile(
  roster: TechnicianRoster,
  branding: TemplateBranding,
  style: TemplateStyle,
  attachments?: EmailAttachment[]
) {
  const effectiveAttachments = attachments || branding.attachments || [];
  const emlContent = generateEmlFileContent(roster, branding, style, effectiveAttachments);
  const blob = new Blob([emlContent], { type: "message/rfc822;charset=utf-8" });
  const filename = `Schedule_${roster.date}_${roster.technicianName.replace(/[^a-zA-Z0-9]/g, "_")}.eml`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Download all technician emails as a ZIP bundle
export async function downloadAllAsZip(
  rosters: TechnicianRoster[],
  branding: TemplateBranding,
  style: TemplateStyle,
  dateStr: string,
  attachments?: EmailAttachment[]
) {
  const zip = new JSZip();
  const folder = zip.folder(`Technician_Schedules_${dateStr}`);
  const effectiveAttachments = attachments || branding.attachments || [];

  for (const roster of rosters) {
    const cleanName = roster.technicianName.replace(/[^a-zA-Z0-9]/g, "_");
    const emlContent = generateEmlFileContent(roster, branding, style, effectiveAttachments);
    const htmlContent = generateOutlookHtml(roster, branding, style);
    const txtContent = generatePlainTextEmail(roster, branding);

    folder?.file(`EML_Templates/Schedule_${cleanName}.eml`, emlContent);
    folder?.file(`HTML_Templates/Schedule_${cleanName}.html`, htmlContent);
    folder?.file(`Text_Templates/Schedule_${cleanName}.txt`, txtContent);
    folder?.file(`Text_Summary/Schedule_${cleanName}.txt`, txtContent);
  }

  // Include attached files in ZIP as well if any
  if (effectiveAttachments.length > 0) {
    const attachFolder = folder?.folder("Email_Attachments");
    effectiveAttachments.forEach((att) => {
      if (att.base64Data) {
        attachFolder?.file(att.name, att.base64Data, { base64: true });
      }
    });
  }

  const content = await zip.generateAsync({ type: "blob" });
  const filename = `Batch_Outlook_Schedules_${dateStr}.zip`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Copy rich HTML to clipboard
export async function copyRichHtmlToClipboard(htmlString: string, plainText: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const htmlBlob = new Blob([htmlString], { type: "text/html" });
      const textBlob = new Blob([plainText], { type: "text/plain" });
      const clipboardItem = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });
      await navigator.clipboard.write([clipboardItem]);
      return true;
    } else {
      // Fallback
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.error("Clipboard copy failed:", err);
    try {
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch {
      return false;
    }
  }
}
