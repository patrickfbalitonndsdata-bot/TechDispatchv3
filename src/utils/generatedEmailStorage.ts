import { cleanTechnicianName } from "./outlookTemplateGenerator";
import { PedsConductLineItem } from "../types";

export interface GeneratedEmailRecord {
  id: string;
  technicianName: string;
  cleanTechName: string;
  workWeek: string;
  workWeekKey: string;
  version: number | string;
  subject: string;
  timestamp: string;
  dateFormatted: string;
  notes?: string;
  exportMethod: "Clipboard" | "Outlook EML" | "Outlook Web" | "Batch ZIP" | "Manual Save";
  jobCount?: number;
  htmlContent?: string;
  plainTextContent?: string;
  additionalNotes?: Array<{ id: string; day: string; text: string }>;
  googleMapsUrl?: string;
  airtableUrl?: string;
  photoUploadUrl?: string;
  brandingConfig?: {
    additionalNotesEnabled?: boolean;
    emailUpdatesEnabled?: boolean;
    updateVersion?: number | string;
    updateNotes?: string;
    previousUpdateNotes?: Array<{ version: number | string; notes: string; text?: string }>;
    sundaySundayEnabled?: boolean;
    overlappingSchedulesEnabled?: boolean;
    useAnytimeTeardowns?: boolean;
    ladotdExclusive?: boolean;
    codExclusive?: boolean;
    conductStudyEnabled?: boolean;
    pedsConductLines?: PedsConductLineItem[];
    dayItemOrderOverrides?: Record<string, string[]>;
    googleMapsUrl?: string;
    customTechGoogleMapsLinks?: Record<string, string>;
    airtableBaseUrl?: string;
    customTechAirtableLinks?: Record<string, string>;
    photoUploadUrl?: string;
    photoUploadLinkText?: string;
  };
}

export const LOCAL_STORAGE_KEY_EMAILS = "nds_generated_emails_directory_v1";

/**
 * Normalizes a technician name and work week into a consistent lookup key.
 */
export function buildWorkWeekKey(technicianName: string, workWeek: string): string {
  const cleanTech = cleanTechnicianName(technicianName).toLowerCase().replace(/\s+/g, "_");
  const cleanWeek = (workWeek || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `${cleanTech}__${cleanWeek}`;
}

/**
 * Retrieves all stored generated email records from localStorage.
 */
export function getStoredGeneratedEmails(): GeneratedEmailRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EMAILS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to load stored generated emails from localStorage", err);
  }
  return [];
}

/**
 * Saves a new generated email record into localStorage.
 */
export function saveStoredGeneratedEmail(
  record: Omit<GeneratedEmailRecord, "id" | "timestamp" | "dateFormatted" | "cleanTechName" | "workWeekKey">
): GeneratedEmailRecord {
  const cleanTech = cleanTechnicianName(record.technicianName);
  const workWeekKey = buildWorkWeekKey(cleanTech, record.workWeek);
  const now = new Date();

  const fullRecord: GeneratedEmailRecord = {
    ...record,
    id: `email-gen-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    cleanTechName: cleanTech,
    workWeekKey,
    timestamp: now.toISOString(),
    dateFormatted: now.toLocaleString([], {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };

  const existing = getStoredGeneratedEmails();
  // Prevent exact duplicates generated within 3 seconds for the same subject & method
  const isDuplicate = existing.some(
    (e) =>
      e.workWeekKey === workWeekKey &&
      e.subject === record.subject &&
      e.exportMethod === record.exportMethod &&
      Math.abs(new Date(e.timestamp).getTime() - now.getTime()) < 3000
  );

  if (!isDuplicate) {
    const updated = [fullRecord, ...existing];
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save generated email to localStorage", err);
    }
    return fullRecord;
  }

  return existing.find((e) => e.workWeekKey === workWeekKey) || fullRecord;
}

/**
 * Deletes a single generated email record by ID.
 */
export function deleteStoredGeneratedEmail(id: string): GeneratedEmailRecord[] {
  const existing = getStoredGeneratedEmails();
  const updated = existing.filter((e) => e.id !== id);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to delete generated email from localStorage", err);
  }
  return updated;
}

/**
 * Clears all generated emails for a specific technician (and optional work week).
 */
export function clearStoredGeneratedEmailsForTech(
  technicianName: string,
  workWeek?: string
): GeneratedEmailRecord[] {
  const cleanTech = cleanTechnicianName(technicianName).toLowerCase();
  const existing = getStoredGeneratedEmails();
  const updated = existing.filter((e) => {
    if (e.cleanTechName.toLowerCase() !== cleanTech) return true;
    if (workWeek && e.workWeek !== workWeek) return true;
    return false;
  });

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to clear technician generated emails from localStorage", err);
  }
  return updated;
}

/**
 * Clears stored generated emails for specific work weeks (with optional technician filter).
 */
export function clearStoredGeneratedEmailsForWorkWeeks(
  workWeeks: string[],
  technicianName?: string
): GeneratedEmailRecord[] {
  const targetWeeks = new Set(workWeeks.map((w) => (w || "").trim().toLowerCase()));
  const cleanTech =
    technicianName && technicianName !== "all" ? cleanTechnicianName(technicianName).toLowerCase() : null;
  const existing = getStoredGeneratedEmails();

  const updated = existing.filter((e) => {
    const eWeek = (e.workWeek || "").trim().toLowerCase();
    const matchesWeek = targetWeeks.has(eWeek);
    if (!matchesWeek) return true; // keep

    if (cleanTech) {
      // only delete if tech matches
      if (e.cleanTechName.toLowerCase() === cleanTech) {
        return false; // delete
      }
      return true; // keep for other techs
    }

    return false; // delete across all techs
  });

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to clear work weeks from localStorage", err);
  }
  return updated;
}

/**
 * Retrieves generated emails for a specific technician and work week.
 */
export function getGeneratedEmailsForTechAndWeek(
  technicianName: string,
  workWeek: string
): GeneratedEmailRecord[] {
  const cleanTech = cleanTechnicianName(technicianName).toLowerCase();
  const workWeekKey = buildWorkWeekKey(technicianName, workWeek);
  const all = getStoredGeneratedEmails();

  return all.filter((e) => e.workWeekKey === workWeekKey || (e.cleanTechName.toLowerCase() === cleanTech && e.workWeek === workWeek));
}

/**
 * Calculates recommendation for email updates based on previously generated emails stored locally:
 * If 0 previous emails -> Initial email (Version 0, isUpdate: false)
 * If 1 previous email (Version 0) -> Next email is Version 1 (UPDATE v1, isUpdate: true, recommendedVersion: 1)
 * If 2 previous emails (Version 0, UPDATE v1) -> Next email is Version 2 (UPDATE v2, isUpdate: true, recommendedVersion: 2)
 * If N previous emails -> Next email is Version N (UPDATE vN, isUpdate: true, recommendedVersion: N)
 */
export function getRecommendedUpdateVersion(
  technicianName: string,
  workWeek: string
): {
  count: number;
  recommendedVersion: number;
  isUpdate: boolean;
  history: GeneratedEmailRecord[];
} {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  const count = history.length;

  if (count === 0) {
    return {
      count: 0,
      recommendedVersion: 1, // If they enable updates on first email, start with v1
      isUpdate: false,
      history,
    };
  }

  return {
    count,
    recommendedVersion: count, // 1 previous email (v0) -> next email is version 1
    isUpdate: true,
    history,
  };
}

/**
 * Extracts a numeric version value from a version string or number.
 * e.g. "Version 0" -> 0, "UPDATE v1" -> 1, "v2" -> 2, "Initial" -> 0, 3 -> 3
 */
export function extractVersionNumber(version: string | number | undefined | null): number {
  if (version === undefined || version === null) return 0;
  if (typeof version === "number") return version;
  const str = String(version).trim().toLowerCase();
  if (str === "initial" || str === "version 0" || str === "0") return 0;
  const match = str.match(/(?:v|version|update\s*v?)?\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * Retrieves all previous update notes for a technician in a given work week,
 * ordered from latest previous version down to earliest (e.g. v2, v1).
 */
export function getStoredPreviousUpdateNotes(
  technicianName: string,
  workWeek: string,
  currentVersionNum: number = 1
): Array<{ version: number | string; notes: string; text?: string }> {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  if (history.length === 0) return [];

  const results: Array<{ version: number | string; notes: string; text?: string }> = [];
  const seenVersions = new Set<string>();

  // Sort history by version descending
  const sorted = [...history].sort((a, b) => {
    const verA = extractVersionNumber(a.version);
    const verB = extractVersionNumber(b.version);
    if (verB !== verA) return verB - verA;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  for (const rec of sorted) {
    const verNum = extractVersionNumber(rec.version);
    // Only include previous versions strictly less than current active update version
    // If current is v2, we want v1. If current is v3, we want v2, v1.
    if (verNum >= currentVersionNum && currentVersionNum > 1) {
      continue;
    }
    if (verNum === 0 && !rec.brandingConfig?.updateNotes && !rec.notes) {
      continue;
    }

    const verKey = `v${verNum > 0 ? verNum : 0}`;
    if (seenVersions.has(verKey)) continue;
    seenVersions.add(verKey);

    // If this record has stacked previous notes saved in its brandingConfig, we can also extract those
    const noteText = rec.brandingConfig?.updateNotes || rec.notes || "";
    if (verNum > 0 || noteText.trim()) {
      const displayVer = verNum > 0 ? verNum : 1;
      results.push({
        version: displayVer,
        notes: noteText.trim(),
        text: `UPDATE v${displayVer}: Schedule is updated.${noteText.trim() ? ` ${noteText.trim()}` : ""}`,
      });
    }

    // Also include any chained earlier previousUpdateNotes stored in this record
    if (rec.brandingConfig?.previousUpdateNotes && rec.brandingConfig.previousUpdateNotes.length > 0) {
      for (const prev of rec.brandingConfig.previousUpdateNotes) {
        const prevVerNum = extractVersionNumber(prev.version);
        const pKey = `v${prevVerNum > 0 ? prevVerNum : 0}`;
        if (!seenVersions.has(pKey) && prevVerNum < currentVersionNum) {
          seenVersions.add(pKey);
          results.push({
            version: prev.version,
            notes: prev.notes || "",
            text: prev.text || `UPDATE v${prev.version}: Schedule is updated.${prev.notes ? ` ${prev.notes.trim()}` : ""}`,
          });
        }
      }
    }
  }

  // Final sort by version descending
  return results.sort((a, b) => extractVersionNumber(b.version) - extractVersionNumber(a.version));
}

/**
 * Extracts links (Google Maps, Airtable, Photo Upload) from an HTML email string or plain text.
 */
export function extractLinksFromEmailContent(
  htmlContent?: string,
  plainText?: string
): {
  googleMapsUrl?: string;
  airtableUrl?: string;
  photoUploadUrl?: string;
} {
  const result: { googleMapsUrl?: string; airtableUrl?: string; photoUploadUrl?: string } = {};

  if (htmlContent) {
    // 1. Google Maps link: e.g. Google Maps App: <a href="THE_URL" ...
    const mapsMatch =
      htmlContent.match(/Google Maps App:\s*<a\s+[^>]*href=["']([^"']+)["']/i) ||
      htmlContent.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(?:[^<]*Maps|[^<]*Google Maps)<\/a>/i) ||
      htmlContent.match(/href=["'](https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google\.com|maps\.app\.goo\.gl)[^"']*)["']/i);
    if (mapsMatch && mapsMatch[1]) {
      result.googleMapsUrl = mapsMatch[1].replace(/&amp;/g, "&").trim();
    }

    // 2. Airtable link: e.g. Airtable Schedule Link: <a href="THE_URL" ...
    const airtableMatch =
      htmlContent.match(/Airtable Schedule Link:\s*<a\s+[^>]*href=["']([^"']+)["']/i) ||
      htmlContent.match(/href=["'](https?:\/\/(?:www\.)?airtable\.com\/[^"']*)["']/i);
    if (airtableMatch && airtableMatch[1]) {
      result.airtableUrl = airtableMatch[1].replace(/&amp;/g, "&").trim();
    }

    // 3. Photo Upload link: e.g. Location Setup Photo Upload Link: <a href="THE_URL" ...
    const photoMatch = htmlContent.match(/Photo Upload Link:\s*<a\s+[^>]*href=["']([^"']+)["']/i);
    if (photoMatch && photoMatch[1]) {
      result.photoUploadUrl = photoMatch[1].replace(/&amp;/g, "&").trim();
    }
  }

  if (plainText) {
    if (!result.googleMapsUrl) {
      const gMatch = plainText.match(/Google Maps App:\s*([^\s\r\n]+)/i);
      if (gMatch && gMatch[1]) {
        result.googleMapsUrl = gMatch[1].trim();
      }
    }
    if (!result.airtableUrl) {
      const aMatch = plainText.match(/Airtable Schedule Link:\s*([^\s\r\n]+)/i);
      if (aMatch && aMatch[1]) {
        result.airtableUrl = aMatch[1].trim();
      }
    }
    if (!result.photoUploadUrl) {
      const pMatch = plainText.match(/Photo Upload Link:\s*([^\s\r\n]+)/i);
      if (pMatch && pMatch[1]) {
        result.photoUploadUrl = pMatch[1].trim();
      }
    }
  }

  return result;
}

/**
 * Retrieves the stored links from the Initial Email (Version 0 / earliest record) or prior email
 * for a technician in a given work week.
 */
export function getStoredInitialEmailLinks(
  technicianName: string,
  workWeek: string
): {
  googleMapsUrl?: string;
  airtableUrl?: string;
  photoUploadUrl?: string;
  sourceVersion?: string | number;
  initialEmailRecord?: GeneratedEmailRecord | null;
} {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  if (history.length === 0) {
    return {};
  }

  // Find the initial email (Version 0 / earliest version or oldest record in history)
  let initialRecord = history.find((h) => extractVersionNumber(h.version) === 0);

  // If not found with version 0, sort history from oldest to newest to find the base email
  if (!initialRecord) {
    const sortedOldestFirst = [...history].sort((a, b) => {
      const vA = extractVersionNumber(a.version);
      const vB = extractVersionNumber(b.version);
      if (vA !== vB) return vA - vB;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    initialRecord = sortedOldestFirst[0];
  }

  if (!initialRecord) return {};

  const cleanTech = cleanTechnicianName(technicianName);

  // Extract googleMapsUrl
  let googleMapsUrl =
    initialRecord.googleMapsUrl ||
    initialRecord.brandingConfig?.customTechGoogleMapsLinks?.[technicianName] ||
    initialRecord.brandingConfig?.customTechGoogleMapsLinks?.[cleanTech] ||
    initialRecord.brandingConfig?.googleMapsUrl;

  // Extract airtableUrl
  let airtableUrl =
    initialRecord.airtableUrl ||
    initialRecord.brandingConfig?.customTechAirtableLinks?.[technicianName] ||
    initialRecord.brandingConfig?.customTechAirtableLinks?.[cleanTech];

  // Extract photoUploadUrl
  let photoUploadUrl =
    initialRecord.photoUploadUrl ||
    initialRecord.brandingConfig?.photoUploadUrl;

  // If any link is not in properties, extract from HTML or plainText content
  if (!googleMapsUrl || !airtableUrl || !photoUploadUrl) {
    const extracted = extractLinksFromEmailContent(
      initialRecord.htmlContent,
      initialRecord.plainTextContent
    );
    if (!googleMapsUrl && extracted.googleMapsUrl) {
      googleMapsUrl = extracted.googleMapsUrl;
    }
    if (!airtableUrl && extracted.airtableUrl) {
      airtableUrl = extracted.airtableUrl;
    }
    if (!photoUploadUrl && extracted.photoUploadUrl) {
      photoUploadUrl = extracted.photoUploadUrl;
    }
  }

  // If still not found, check any other records in history for this tech/week that may contain the link
  if (!googleMapsUrl) {
    for (const rec of history) {
      const gUrl =
        rec.googleMapsUrl ||
        rec.brandingConfig?.customTechGoogleMapsLinks?.[technicianName] ||
        rec.brandingConfig?.customTechGoogleMapsLinks?.[cleanTech] ||
        rec.brandingConfig?.googleMapsUrl;
      if (gUrl && gUrl.trim()) {
        googleMapsUrl = gUrl.trim();
        break;
      }
      const ex = extractLinksFromEmailContent(rec.htmlContent, rec.plainTextContent);
      if (ex.googleMapsUrl && ex.googleMapsUrl.trim()) {
        googleMapsUrl = ex.googleMapsUrl.trim();
        break;
      }
    }
  }

  return {
    googleMapsUrl: googleMapsUrl || undefined,
    airtableUrl: airtableUrl || undefined,
    photoUploadUrl: photoUploadUrl || undefined,
    sourceVersion: initialRecord.version,
    initialEmailRecord: initialRecord,
  };
}


