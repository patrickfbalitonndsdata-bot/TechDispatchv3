import { cleanTechnicianName } from "./outlookTemplateGenerator";
import { PedsConductLineItem, EmailAttachment } from "../types";

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
  attachments?: EmailAttachment[];
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
    attachments?: EmailAttachment[];
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

export const NDS_SAVED_EMAILS_EVENT = "nds-saved-emails-updated";

/**
 * Dispatches custom update event to synchronize all open components within the same window
 */
function notifyEmailsUpdated(records: GeneratedEmailRecord[]) {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(NDS_SAVED_EMAILS_EVENT, { detail: records }));
    } catch {
      // ignore
    }
  }
}

/**
 * Quota-resilient localStorage writer that protects against browser 5MB storage overflows
 */
function safeSetStoredEmails(updated: GeneratedEmailRecord[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(updated));
    notifyEmailsUpdated(updated);
    return true;
  } catch (err) {
    console.warn("localStorage setItem hit quota limits, applying adaptive pruning...", err);
    try {
      // Pruning Tier 1: Remove heavy HTML from records beyond the top 8 (preserve plaintext)
      const tier1 = updated.map((rec, idx) => {
        if (idx >= 8 && rec.htmlContent) {
          return {
            ...rec,
            htmlContent: `<div style="font-family: Calibri, sans-serif; white-space: pre-wrap;">${rec.plainTextContent || "Email Content"}</div>`,
          };
        }
        return rec;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(tier1));
      notifyEmailsUpdated(tier1);
      return true;
    } catch {
      try {
        // Pruning Tier 2: Limit history to most recent 30 items
        const tier2 = updated.slice(0, 30).map((rec, idx) => {
          if (idx >= 3 && rec.htmlContent) {
            return {
              ...rec,
              htmlContent: `<div style="font-family: Calibri, sans-serif; white-space: pre-wrap;">${rec.plainTextContent || "Email Content"}</div>`,
            };
          }
          return rec;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY_EMAILS, JSON.stringify(tier2));
        notifyEmailsUpdated(tier2);
        return true;
      } catch (finalErr) {
        console.error("Critical: unable to persist generated emails history to localStorage", finalErr);
        return false;
      }
    }
  }
}

/**
 * Saves a new generated email record into localStorage safely.
 */
export function saveStoredGeneratedEmail(
  record: Omit<GeneratedEmailRecord, "id" | "timestamp" | "dateFormatted" | "cleanTechName" | "workWeekKey">
): GeneratedEmailRecord {
  const cleanTech = cleanTechnicianName(record.technicianName);
  const workWeekKey = buildWorkWeekKey(cleanTech, record.workWeek);
  const now = new Date();

  // Strip massive base64 payload strings from attachments to guarantee localStorage safety
  const sanitizedAttachments = record.attachments?.map((att, idx) => ({
    id: att.id || `att-${idx}-${att.name}`,
    name: att.name,
    size: att.size,
    type: att.type,
    base64Data: undefined,
  }));

  const sanitizedBrandingConfig = record.brandingConfig
    ? {
        ...record.brandingConfig,
        attachments: record.brandingConfig.attachments?.map((att, idx) => ({
          id: att.id || `att-${idx}-${att.name}`,
          name: att.name,
          size: att.size,
          type: att.type,
          base64Data: undefined,
        })),
      }
    : undefined;

  const fullRecord: GeneratedEmailRecord = {
    ...record,
    attachments: sanitizedAttachments,
    brandingConfig: sanitizedBrandingConfig,
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
  // Check if an entry with the exact same work week and export method was generated in the last 4 seconds
  const dupIndex = existing.findIndex(
    (e) =>
      e.workWeekKey === workWeekKey &&
      e.exportMethod === record.exportMethod &&
      Math.abs(new Date(e.timestamp).getTime() - now.getTime()) < 4000
  );

  let updated: GeneratedEmailRecord[];
  if (dupIndex !== -1) {
    // Update the existing item with the latest preview content
    updated = [...existing];
    updated[dupIndex] = { ...fullRecord, id: existing[dupIndex].id };
  } else {
    updated = [fullRecord, ...existing];
  }

  safeSetStoredEmails(updated);
  return fullRecord;
}

/**
 * Deletes a single generated email record by ID.
 */
export function deleteStoredGeneratedEmail(id: string): GeneratedEmailRecord[] {
  const existing = getStoredGeneratedEmails();
  const updated = existing.filter((e) => e.id !== id);
  safeSetStoredEmails(updated);
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
  const rawTech = (technicianName || "").toLowerCase().trim();
  const existing = getStoredGeneratedEmails();
  const updated = existing.filter((e) => {
    const eClean = cleanTechnicianName(e.cleanTechName).toLowerCase();
    const eRaw = (e.technicianName || "").toLowerCase().trim();
    const matchesTech =
      e.cleanTechName.toLowerCase() === cleanTech ||
      eClean === cleanTech ||
      eRaw === rawTech ||
      cleanTechnicianName(eRaw).toLowerCase() === cleanTech;
    if (!matchesTech) return true;
    if (workWeek && e.workWeek !== workWeek) return true;
    return false;
  });

  safeSetStoredEmails(updated);
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
      const eClean = cleanTechnicianName(e.cleanTechName).toLowerCase();
      const eRaw = (e.technicianName || "").toLowerCase().trim();
      const matchesTech =
        e.cleanTechName.toLowerCase() === cleanTech ||
        eClean === cleanTech ||
        eRaw === (technicianName || "").toLowerCase().trim() ||
        cleanTechnicianName(eRaw).toLowerCase() === cleanTech;
      if (matchesTech) {
        return false; // delete
      }
      return true; // keep for other techs
    }

    return false; // delete across all techs
  });

  safeSetStoredEmails(updated);
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
  const rawTech = (technicianName || "").toLowerCase().trim();
  const workWeekKey = buildWorkWeekKey(technicianName, workWeek);
  const all = getStoredGeneratedEmails();

  return all.filter((e) => {
    if (e.workWeekKey === workWeekKey) return true;
    const eClean = cleanTechnicianName(e.cleanTechName).toLowerCase();
    const eRaw = (e.technicianName || "").toLowerCase().trim();
    const matchesTech =
      e.cleanTechName.toLowerCase() === cleanTech ||
      eClean === cleanTech ||
      eRaw === rawTech ||
      cleanTechnicianName(eRaw).toLowerCase() === cleanTech;
    return matchesTech && e.workWeek === workWeek;
  });
}

/**
 * Extracts a numeric version value from a version string or number.
 * e.g. "Version 0" -> 0, "UPDATE v1" -> 1, "v2" -> 2, "Initial" -> 0, 3 -> 3, "UPDATE v1 (Manual)" -> 1
 */
export function extractVersionNumber(version: string | number | undefined | null): number {
  if (version === undefined || version === null) return 0;
  if (typeof version === "number") return isNaN(version) ? 0 : version;
  const str = String(version).trim();
  if (!str) return 0;
  const lower = str.toLowerCase();
  if (lower === "initial" || lower === "version 0" || lower === "0" || lower === "v0") return 0;

  // Check explicit UPDATE vX or vX patterns
  const updateMatch = lower.match(/update\s*v?(\d+)/i);
  if (updateMatch) {
    const n = parseInt(updateMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  const vMatch = lower.match(/(?:^|\b)v(\d+)\b/i);
  if (vMatch) {
    const n = parseInt(vMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  const verWordMatch = lower.match(/(?:^|\b)version\s*(\d+)\b/i);
  if (verWordMatch) {
    const n = parseInt(verWordMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  // Generic trailing/standalone digit
  const anyDigitMatch = lower.match(/(\d+)/);
  if (anyDigitMatch) {
    const n = parseInt(anyDigitMatch[1], 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/**
 * Robustly inspects an entire GeneratedEmailRecord to determine what version it is tagged with,
 * checking brandingConfig.updateVersion, record.version, subject line ("UPDATE vX"), and notes.
 * This ensures that whether a version was manually entered or automatically tagged, it is accurately detected.
 */
export function extractRecordVersionNumber(rec: GeneratedEmailRecord | undefined | null): number {
  if (!rec) return 0;

  // 1. Check brandingConfig.updateVersion first
  if (
    rec.brandingConfig?.updateVersion !== undefined &&
    rec.brandingConfig?.updateVersion !== null &&
    rec.brandingConfig?.updateVersion !== ""
  ) {
    const num = extractVersionNumber(rec.brandingConfig.updateVersion);
    if (num > 0) return num;
  }

  // 2. Check record.version
  if (rec.version !== undefined && rec.version !== null && rec.version !== "") {
    const num = extractVersionNumber(rec.version);
    if (num > 0) return num;
  }

  // 3. Check record.subject for UPDATE v{X} pattern
  if (rec.subject) {
    const subjMatch = rec.subject.match(/\bUPDATE\s+v?(\d+)\b/i);
    if (subjMatch) {
      const num = parseInt(subjMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // 4. Check notes / updateNotes
  const noteStr = rec.brandingConfig?.updateNotes || rec.notes || "";
  if (noteStr) {
    const noteMatch = noteStr.match(/\bUPDATE\s+v?(\d+)\b/i);
    if (noteMatch) {
      const num = parseInt(noteMatch[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  return 0;
}

/**
 * Retrieves the most recent saved email record from history for a technician and work week.
 */
export function getMostRecentSavedEmail(
  technicianName: string,
  workWeek: string
): GeneratedEmailRecord | null {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  if (history.length === 0) return null;

  const sorted = [...history].sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return 0;
  });

  return sorted[0];
}

/**
 * Calculates recommendation for email updates following the historical email of the generated email:
 * - Sorts saved history by recency (most recent saved record first).
 * - Reads the tagged version from that most recent saved record (whether manually or automatically edited).
 * - The newly generated email automatically follows the version from the recent saved history (recent + 1):
 *   e.g. If the recent saved email is tagged version 1 (v1), the new generated becomes version 2 (v2).
 *   e.g. If the recent saved email is tagged version 2 (v2), the new generated becomes version 3 (v3).
 *   e.g. If the recent saved email is tagged initial (v0), the new generated becomes version 1 (v1).
 *   e.g. If 0 previous emails exist in saved history, recommendedVersion starts at 1.
 */
export function getRecommendedUpdateVersion(
  technicianName: string,
  workWeek: string
): {
  count: number;
  recommendedVersion: number;
  isUpdate: boolean;
  history: GeneratedEmailRecord[];
  mostRecentRecord?: GeneratedEmailRecord;
  mostRecentVersion: number;
  mostRecentVersionLabel: string;
} {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  const count = history.length;

  if (count === 0) {
    return {
      count: 0,
      recommendedVersion: 1, // If they enable updates on first email, start with v1
      isUpdate: false,
      history,
      mostRecentVersion: 0,
      mostRecentVersionLabel: "None",
    };
  }

  // Sort history by recency (newest timestamp first).
  const sorted = [...history].sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return 0;
  });

  const mostRecent = sorted[0];
  const recentVersion = extractRecordVersionNumber(mostRecent);
  // The newly generated will automatically become recentVersion + 1
  const recommendedVersion = Math.max(1, recentVersion + 1);
  const mostRecentVersionLabel = recentVersion > 0 ? `v${recentVersion}` : "v0 (Initial)";

  return {
    count,
    recommendedVersion,
    isUpdate: true,
    history: sorted,
    mostRecentRecord: mostRecent,
    mostRecentVersion: recentVersion,
    mostRecentVersionLabel,
  };
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
    const verA = extractRecordVersionNumber(a);
    const verB = extractRecordVersionNumber(b);
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

/**
 * Retrieves the attachments from the most recent prior email in saved history for a technician
 * and work week, strictly matching the immediate previous email/version relative to the incoming version.
 *
 * For example:
 * - If the incoming email is v3 (incomingVersion = 3), the attachments that should be added
 *   to the incoming email are the attachments from v2, NOT v1 or initial.
 * - If the incoming email is v2 (incomingVersion = 2), the attachments from v1 are fetched, not initial.
 * - If the incoming email is v1 (incomingVersion = 1), the attachments from initial (Version 0) are fetched.
 *
 * If the immediate prior version does not have attachments, it checks the next most recent prior record
 * with attachments (strictly older than incoming version).
 */
export function getMostRecentPriorAttachments(
  technicianName: string,
  workWeek: string,
  incomingVersion: number | string = 1
): {
  attachments: EmailAttachment[];
  sourceVersion?: string | number;
  sourceDateFormatted?: string;
  sourceSubject?: string;
  sourceRecord?: GeneratedEmailRecord | null;
} {
  const history = getGeneratedEmailsForTechAndWeek(technicianName, workWeek);
  if (!history || history.length === 0) {
    return { attachments: [] };
  }

  const incomingVerNum = extractVersionNumber(incomingVersion);

  // Filter for records strictly prior to the incoming version
  // If incomingVerNum is 3, candidates are versions with version number < 3 (e.g. 2, 1, 0)
  // If incomingVerNum is 2, candidates are 1, 0
  // If incomingVerNum is 1, candidates are 0 (initial)
  let priorRecords = history.filter((rec) => {
    const ver = extractRecordVersionNumber(rec);
    if (incomingVerNum > 0) {
      return ver < incomingVerNum;
    }
    return false;
  });

  // Fallback: If no records match by strict version number but history exists and incomingVerNum > 1,
  // take records sorted from newest to oldest
  if (priorRecords.length === 0 && incomingVerNum > 1 && history.length > 0) {
    priorRecords = [...history];
  }

  if (priorRecords.length === 0) {
    return { attachments: [] };
  }

  // Sort prior records:
  // 1. Primary: highest version number descending (e.g. v2 > v1 > v0)
  // 2. Secondary: latest timestamp descending
  priorRecords.sort((a, b) => {
    const verA = extractRecordVersionNumber(a);
    const verB = extractRecordVersionNumber(b);
    if (verB !== verA) {
      return verB - verA;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // The immediate target version is incomingVerNum - 1 (e.g. 2 when incoming is 3)
  const immediateTargetVersion = incomingVerNum > 0 ? incomingVerNum - 1 : 0;

  // 1. Check if a record matching the immediate prior version has attachments
  const directPriorRecord = priorRecords.find((rec) => {
    const verNum = extractVersionNumber(rec.version);
    if (verNum === immediateTargetVersion) {
      const atts = rec.attachments || rec.brandingConfig?.attachments;
      return atts && atts.length > 0;
    }
    return false;
  });

  if (directPriorRecord) {
    const atts = directPriorRecord.attachments || directPriorRecord.brandingConfig?.attachments || [];
    return {
      attachments: atts.map((a) => ({
        ...a,
        id: `att-inherited-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      })),
      sourceVersion: directPriorRecord.version,
      sourceDateFormatted: directPriorRecord.dateFormatted,
      sourceSubject: directPriorRecord.subject,
      sourceRecord: directPriorRecord,
    };
  }

  // 2. Otherwise check the most recent prior record with attachments (highest version < incoming)
  for (const rec of priorRecords) {
    const atts = rec.attachments || rec.brandingConfig?.attachments;
    if (atts && atts.length > 0) {
      return {
        attachments: atts.map((a) => ({
          ...a,
          id: `att-inherited-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        })),
        sourceVersion: rec.version,
        sourceDateFormatted: rec.dateFormatted,
        sourceSubject: rec.subject,
        sourceRecord: rec,
      };
    }
  }

  return { attachments: [] };
}



