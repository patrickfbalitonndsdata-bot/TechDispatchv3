import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { inflate, inflateRaw } from "pako";

// Configure worker for pdfjs-dist reliably in Vite environment
try {
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }
} catch (e) {
  console.warn("Could not set PDF worker URL directly:", e);
}

export type UrgencyScheduleOption = "today" | "next_week" | "today_next_week" | "none";

export interface KmzAttachment {
  id: string;
  fileName: string;
  fileSizeFormatted: string;
  file?: File;
  rawBase64?: string;
}

export interface ScannedPdfData {
  id: string;
  fileName: string;
  rawText: string;
  projectNumber: string;
  urgency: string;
  cityState: string;
  region: string;
  locationsCount: string;
  studyType: string; // "ATR" | "TMC" | other
  studyLineRaw: string;
  addOns: string;
  fullStudyFormatted: string;
  firm?: string;
  contact?: string;
  dueDate?: string;
  hardDueDate?: string;
  emailBodyText: string;
  emailBodyHtml: string;
  emailSubject: string;
  originalFile?: File;
  originalFileBase64?: string;
}

/**
 * Generates email subject line:
 * - ATR: <Project Number> ALG <Add ons>
 * - TMC: <Project Number> TMC Approval
 * - Combined (2 PDFs): <ATR Project Number> ALG <Add ons> and <TMC Project Number> TMC Approval
 */
export function formatAtrSubject(projectNumber: string, addOns?: string): string {
  const proj = (projectNumber || "Project").trim();
  const cleanAddOns = (addOns || "").trim();
  return cleanAddOns ? `${proj} ALG ${cleanAddOns}` : `${proj} ALG Volume`;
}

export function formatTmcSubject(projectNumber: string): string {
  const proj = (projectNumber || "Project").trim();
  return `${proj} TMC Approval`;
}

export function formatCombinedSubject(
  atrProjectNumber: string,
  atrAddOns: string | undefined,
  tmcProjectNumber: string
): string {
  const atrPart = formatAtrSubject(atrProjectNumber, atrAddOns);
  const tmcPart = formatTmcSubject(tmcProjectNumber);
  return `${atrPart} and ${tmcPart}`;
}

export function formatTripleCombinedSubject(
  priorAtrProjectNumber: string,
  priorAddOns: string | undefined,
  secondAtrProjectNumber: string,
  secondAddOns: string | undefined,
  tmcProjectNumber: string
): string {
  const atr1 = (priorAtrProjectNumber || "ATR 1").trim();
  const atr2 = (secondAtrProjectNumber || "ATR 2").trim();
  const add1 = (priorAddOns || "Volume").trim();
  const add2 = (secondAddOns || "Volume").trim();
  const addOnsCombined = add1 === add2 ? add1 : `${add1} / ${add2}`;
  const tmcPart = formatTmcSubject(tmcProjectNumber);
  return `${atr1} & ${atr2} ALG ${addOnsCombined} and ${tmcPart}`;
}

/**
 * Formats the URGENCY line with selectable scheduling option:
 * - "today": URGENCY: <Urgency> - Need to schedule today
 * - "next_week": URGENCY: <Urgency> - Need to schedule next week
 * - "today_next_week": URGENCY: <Urgency> – Need to schedule today/next week.
 * - "none": URGENCY: <Urgency>
 */
export function formatUrgencyLine(
  urgency: string,
  scheduleOption: UrgencyScheduleOption = "today_next_week"
): string {
  const cleanUrgency = (urgency || "Priority Client").trim();
  switch (scheduleOption) {
    case "today":
      return `URGENCY: ${cleanUrgency} - Need to schedule today`;
    case "next_week":
      return `URGENCY: ${cleanUrgency} - Need to schedule next week`;
    case "today_next_week":
      return `URGENCY: ${cleanUrgency} – Need to schedule today/next week.`;
    case "none":
    default:
      return `URGENCY: ${cleanUrgency}`;
  }
}

/**
 * Convert browser File or Blob to base64 string
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a standard RFC 2822 / MIME multipart .eml message with attachments
 * (compatible with Microsoft Outlook, Apple Mail, Thunderbird, etc.)
 */
export async function createMultipartEml({
  subject,
  to,
  htmlBody,
  pdfAttachments = [],
  kmzAttachments = [],
}: {
  subject: string;
  to: string;
  htmlBody: string;
  pdfAttachments?: { name: string; file?: File; base64?: string }[];
  kmzAttachments?: KmzAttachment[];
}): Promise<Blob> {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let eml = `From: Scheduling Team <scheduling@ndsdata.com>\r\n`;
  eml += `To: ${to}\r\n`;
  eml += `Subject: ${subject}\r\n`;
  eml += `MIME-Version: 1.0\r\n`;

  const totalAttachments = pdfAttachments.length + kmzAttachments.length;

  if (totalAttachments === 0) {
    eml += `Content-Type: text/html; charset=utf-8\r\n`;
    eml += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    eml += `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
  } else {
    eml += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    // Part 1: HTML Body
    eml += `--${boundary}\r\n`;
    eml += `Content-Type: text/html; charset=utf-8\r\n`;
    eml += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    eml += `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>\r\n\r\n`;

    // Part 2: PDF Attachments
    for (const pdf of pdfAttachments) {
      let b64 = pdf.base64 || "";
      if (!b64 && pdf.file) {
        b64 = await fileToBase64(pdf.file);
      }
      if (!b64) {
        // Create mock placeholder PDF binary if testing sample
        b64 = btoa(`%PDF-1.4\n1 0 obj\n<< /Title (${pdf.name}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`);
      }

      eml += `--${boundary}\r\n`;
      eml += `Content-Type: application/pdf; name="${pdf.name}"\r\n`;
      eml += `Content-Transfer-Encoding: base64\r\n`;
      eml += `Content-Disposition: attachment; filename="${pdf.name}"\r\n\r\n`;

      const chunked = b64.match(/.{1,76}/g)?.join("\r\n") || b64;
      eml += `${chunked}\r\n\r\n`;
    }

    // Part 3: KMZ / KML Attachments
    for (const kmz of kmzAttachments) {
      let b64 = kmz.rawBase64 || "";
      if (!b64 && kmz.file) {
        b64 = await fileToBase64(kmz.file);
      }
      if (!b64) {
        // Create minimal KML XML representation
        const kmlMock = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${kmz.fileName}</name>
    <description>Study Map Locations</description>
  </Document>
</kml>`;
        b64 = btoa(kmlMock);
      }

      const mimeType = kmz.fileName.toLowerCase().endsWith(".kml")
        ? "application/vnd.google-earth.kml+xml"
        : "application/vnd.google-earth.kmz";

      eml += `--${boundary}\r\n`;
      eml += `Content-Type: ${mimeType}; name="${kmz.fileName}"\r\n`;
      eml += `Content-Transfer-Encoding: base64\r\n`;
      eml += `Content-Disposition: attachment; filename="${kmz.fileName}"\r\n\r\n`;

      const chunked = b64.match(/.{1,76}/g)?.join("\r\n") || b64;
      eml += `${chunked}\r\n\r\n`;
    }

    eml += `--${boundary}--\r\n`;
  }

  return new Blob([eml], { type: "message/rfc822" });
}

/**
 * Flate stream decompressor & binary parser to extract printable strings from PDF streams
 */
export function extractTextFromPdfStreamFallback(arrayBuffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const streamsText: string[] = [];

    // Find all "stream" ... "endstream" blocks and decompress them using pako
    let i = 0;
    while (i < bytes.length - 10) {
      if (
        bytes[i] === 115 && // s
        bytes[i + 1] === 116 && // t
        bytes[i + 2] === 114 && // r
        bytes[i + 3] === 101 && // e
        bytes[i + 4] === 97 && // a
        bytes[i + 5] === 109 // m
      ) {
        let streamStart = i + 6;
        if (bytes[streamStart] === 13) streamStart++; // \r
        if (bytes[streamStart] === 10) streamStart++; // \n

        // Search for "endstream"
        let endIdx = -1;
        for (let j = streamStart; j < bytes.length - 8; j++) {
          if (
            bytes[j] === 101 && // e
            bytes[j + 1] === 110 && // n
            bytes[j + 2] === 100 && // d
            bytes[j + 3] === 115 && // s
            bytes[j + 4] === 116 && // t
            bytes[j + 5] === 114 && // r
            bytes[j + 6] === 101 && // e
            bytes[j + 7] === 97 && // a
            bytes[j + 8] === 109 // m
          ) {
            endIdx = j;
            break;
          }
        }

        if (endIdx > streamStart) {
          let streamEnd = endIdx;
          while (streamEnd > streamStart && (bytes[streamEnd - 1] === 10 || bytes[streamEnd - 1] === 13)) {
            streamEnd--;
          }

          const chunk = bytes.subarray(streamStart, streamEnd);
          try {
            const decompressed = inflate(chunk);
            const decoded = new TextDecoder("latin1").decode(decompressed);
            streamsText.push(decoded);
          } catch {
            try {
              const decompressedRaw = inflateRaw(chunk);
              const decoded = new TextDecoder("latin1").decode(decompressedRaw);
              streamsText.push(decoded);
            } catch {
              // Not flate or corrupted chunk
            }
          }
          i = endIdx + 9;
          continue;
        }
      }
      i++;
    }

    const rawLatin1 = new TextDecoder("latin1").decode(bytes);
    const combinedContent = streamsText.join("\n") + "\n" + rawLatin1;

    const extractedChunks: string[] = [];

    // Extract text in parentheses (e.g., (26-470282), (Dallas, TX), (60 (24hr) ATR (1 day)), etc.)
    const tjMatches = combinedContent.match(/\((?:[^\\()]|\\.)*\)\s*T[jJ]/g);
    if (tjMatches) {
      for (const m of tjMatches) {
        const str = m.replace(/\s*T[jJ]$/, "").slice(1, -1)
          .replace(/\\([()\\])/g, "$1")
          .replace(/\\n/g, "\n");
        if (str.trim()) extractedChunks.push(str);
      }
    }

    // Extract TJ array chunks: [ (60) 10 ((24hr) ATR (1 day)) ] TJ
    const arrayTjMatches = combinedContent.match(/\[([^\]]+)\]\s*TJ/gi);
    if (arrayTjMatches) {
      for (const arr of arrayTjMatches) {
        const innerStrings = arr.match(/\((?:[^\\()]|\\.)*\)/g);
        if (innerStrings) {
          const joined = innerStrings
            .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, "$1"))
            .join(" ");
          if (joined.trim()) extractedChunks.push(joined);
        }
      }
    }

    if (extractedChunks.length > 2) {
      return extractedChunks.join("\n");
    }

    // Otherwise grab any project text patterns from the decompressed content or raw file
    const lines: string[] = [];
    const projMatch = combinedContent.match(/\b\d{2}-\d{5,8}\b/);
    if (projMatch) lines.push(projMatch[0]);

    const studyMatch = combinedContent.match(/\d+\s*\([^)]+\)\s*(?:ATR|TMC)[^\n\r]+/i);
    if (studyMatch) lines.push(studyMatch[0]);

    const urgencyMatch = combinedContent.match(/URGENCY:[^\n\r]+/i);
    if (urgencyMatch) lines.push(urgencyMatch[0]);

    return lines.join("\n");
  } catch (e) {
    console.warn("Fallback stream parser error:", e);
    return "";
  }
}

/**
 * Parse structured fields from the raw text of page 1 of an ALG/TMC PDF.
 */
export function parseFieldsFromPdfText(
  rawText: string,
  fileName: string = "document.pdf",
  scheduleOption: UrgencyScheduleOption = "today_next_week",
  originalFile?: File
): ScannedPdfData {
  // Normalize text whitespace and linebreaks
  const normalizedText = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 1. Primary Project Number extraction
  let projectNumber = "";

  // Check if filename contains a project number (e.g., "26-470282.pdf" or "26-470282_Dallas.pdf")
  const fileNameProjMatch = fileName.match(/\b([0-9]{2}-[0-9]{5,8})\b/);

  // Strip out RELATED PROJECTS and HISTORICAL PROJECTS so they don't hijack the main project number
  const textWithoutRelated = normalizedText
    .replace(/RELATED\s+PROJECTS[:\s]+[^\n\r]+/gi, "")
    .replace(/HISTORICAL\s+PROJECTS[:\s]+[^\n\r]+/gi, "");

  // Look for header pattern like "26-470282 | Dallas, TX" or "26-770109 | Boulder, CO"
  const headerProjMatch = textWithoutRelated.match(/(?:^|\n|\s)\s*([0-9]{2}-[0-9]{5,8})\s*\|/);
  if (headerProjMatch && headerProjMatch[1]) {
    projectNumber = headerProjMatch[1].trim();
  } else {
    // Look for labeled "PROJECT NO: 26-470282" or "PROJECT #: 26-470282"
    const labeledMatch = textWithoutRelated.match(/PROJECT\s*(?:NO|NUMBER|#)?[:\s]+([0-9]{2}-[0-9]{5,8})/i);
    if (labeledMatch && labeledMatch[1]) {
      projectNumber = labeledMatch[1].trim();
    } else {
      // Find the first standalone XX-XXXXXX number in the primary document text (excluding related projects)
      const standaloneMatch = textWithoutRelated.match(/\b([0-9]{2}-[0-9]{5,8})\b/);
      if (standaloneMatch && standaloneMatch[1]) {
        projectNumber = standaloneMatch[1].trim();
      } else if (fileNameProjMatch && fileNameProjMatch[1]) {
        projectNumber = fileNameProjMatch[1].trim();
      } else {
        const generalMatch = normalizedText.match(/\b([0-9]{2}-[0-9]{5,8})\b/);
        if (generalMatch && generalMatch[1]) {
          projectNumber = generalMatch[1].trim();
        }
      }
    }
  }

  if (!projectNumber && fileNameProjMatch) {
    projectNumber = fileNameProjMatch[1];
  }

  // 2. Urgency
  let urgency = "Priority Client";
  const urgencyMatch = normalizedText.match(/URGENCY:\s*([^\n,;|]+)/i);
  if (urgencyMatch && urgencyMatch[1].trim()) {
    urgency = urgencyMatch[1].trim();
  }

  // 3. City / State / Region
  let cityState = "";
  const headerCityMatch = normalizedText.match(/[0-9]{2}-[0-9]{5,8}\s*\|\s*([A-Za-z\s.-]+,\s*[A-Z]{2})/);
  if (headerCityMatch && headerCityMatch[1]) {
    cityState = headerCityMatch[1].trim();
  } else {
    const cityMatch = normalizedText.match(/\b([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2})\b/);
    if (cityMatch) {
      cityState = cityMatch[1].trim();
    }
  }

  let region = "South Central";
  const explicitRegionMatch = normalizedText.match(/Region:\s*([^\n,;|]+)/i);
  if (explicitRegionMatch && explicitRegionMatch[1].trim()) {
    region = explicitRegionMatch[1].trim();
  }

  // 4. Firm and Contact
  let firm = "";
  const firmMatch = normalizedText.match(/FIRM:\s*([^\n\r,;|]+)/i);
  if (firmMatch && firmMatch[1].trim()) {
    firm = firmMatch[1].trim();
  }

  let contact = "";
  const contactMatch = normalizedText.match(/CONTACT:\s*([^\n\r,;|]+)/i);
  if (contactMatch && contactMatch[1].trim()) {
    contact = contactMatch[1].trim();
  }

  // 5. Project Details Section extraction
  let locationsCount = "1";
  let studyType = "";
  let studyLineRaw = "";
  let addOns = "";

  // Regex to capture study pattern: e.g. "60 (24hr) ATR (1 day)" or "19 (24hr) ATR (1 day)" or "4 (4hr) TMC (1 day)"
  const studyPattern = /(\d+)\s*(?:\([^)]+\)\s*)?(ATR|TMC|VOLUME|SPEED|CLASS[^\s()]*|MIOSPHERE|MIOVISION|PEDS?|BICYCLE|TURNING\s*MOVEMENT)\s*(?:\(([^)]+)\))?/i;
  const studyLineMatch = normalizedText.match(studyPattern);

  if (studyLineMatch) {
    locationsCount = studyLineMatch[1].trim();
    const typeGroup = studyLineMatch[2].toUpperCase().trim();
    if (typeGroup.includes("TMC") || typeGroup.includes("TURNING") || typeGroup.includes("MIOVISION") || typeGroup.includes("MIOSPHERE")) {
      studyType = "TMC";
    } else {
      studyType = "ATR";
    }
    studyLineRaw = studyLineMatch[0].trim();
  } else {
    // Loose pattern: "60 ATR" or "19 ATR" or "12 TMC"
    const looseMatch = normalizedText.match(/(\d+)\s+(?:(?:\([^)]+\)\s+)?)(ATR|TMC|MIOSPHERE|MIOVISION)\b/i);
    if (looseMatch) {
      locationsCount = looseMatch[1].trim();
      studyType = looseMatch[2].toUpperCase().includes("TMC") ? "TMC" : "ATR";
      studyLineRaw = looseMatch[0].trim();
    } else {
      const locMatch = normalizedText.match(/(?:Locations?|No\.?\s*of\s*Locations?)[:\s]+(\d+)/i);
      if (locMatch) {
        locationsCount = locMatch[1].trim();
      }
    }
  }

  // Determine studyType if still not resolved
  if (!studyType) {
    const textUpper = (normalizedText + " " + fileName).toUpperCase();
    if (textUpper.includes(" TMC ") || textUpper.includes("TURNING MOVEMENT") || textUpper.includes("TMC APPROVAL")) {
      studyType = "TMC";
    } else {
      studyType = "ATR";
    }
  }

  // 6. Add-ons: look for "w/ <Addons>" (e.g. "w/ Volume, Speed" or "w/ Speed & Classification")
  const addOnMatch = normalizedText.match(/w\/\s*([^\n\r]+)/i);
  if (addOnMatch && addOnMatch[1].trim()) {
    let cleanAddOn = addOnMatch[1].trim();
    if (cleanAddOn.includes("|")) {
      cleanAddOn = cleanAddOn.split("|")[0].trim();
    }
    cleanAddOn = cleanAddOn.replace(/\s*(?:TO\s+BE\s+COLLECTED|\*|PROJECT\s+NOTES).*$/i, "").trim();
    addOns = cleanAddOn;
  } else {
    const lower = normalizedText.toLowerCase();
    if (lower.includes("speed") && (lower.includes("class") || lower.includes("classification"))) {
      addOns = "Speed & Classification";
    } else if (lower.includes("speed") && lower.includes("volume")) {
      addOns = "Volume, Speed";
    } else if (lower.includes("speed")) {
      addOns = "Speed";
    } else if (lower.includes("class") || lower.includes("classification")) {
      addOns = "Classification";
    } else if (studyType === "ATR" || lower.includes("volume")) {
      addOns = "Volume";
    }
  }

  let fullStudyFormatted = "";
  if (studyType.includes("ATR")) {
    fullStudyFormatted = addOns ? `ALG ${addOns}` : "ALG Volume";
  } else if (studyType.includes("TMC")) {
    fullStudyFormatted = addOns ? `TMC ${addOns}` : "TMC";
  } else {
    fullStudyFormatted = addOns ? `ALG ${addOns}` : `ALG ${studyType}`;
  }

  let dueDate = "";
  const dueMatch = normalizedText.match(/DUE DATE:\s*([^\n\r]+)/i);
  if (dueMatch) dueDate = dueMatch[1].trim();

  let hardDueDate = "";
  const hardDueMatch = normalizedText.match(/HARD DUE DATE:\s*([^\n\r]+)/i);
  if (hardDueMatch) hardDueDate = hardDueMatch[1].trim();

  // Construct Email Template based on study type and scheduleOption:
  const isTmc = studyType.includes("TMC");

  let emailSubject = "";
  let emailBodyText = "";
  let emailBodyHtml = "";

  if (isTmc) {
    emailSubject = formatTmcSubject(projectNumber);
    const urgencyLine = formatUrgencyLine(urgency, scheduleOption === "today_next_week" ? "none" : scheduleOption);

    emailBodyText = `Hi James,

Please see TMC camera placement approval.

${urgencyLine}

Project Number: ${projectNumber}
Location/s: ${locationsCount}`;

    emailBodyHtml = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi James,</p>
  <p style="margin: 0 0 12px 0;">Please see TMC camera placement approval.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${projectNumber}</strong></p>
  <p style="margin: 0 0 0 0;"><strong>Location/s:</strong> ${locationsCount}</p>
</div>`.trim();
  } else {
    emailSubject = formatAtrSubject(projectNumber, addOns);
    const urgencyLine = formatUrgencyLine(urgency, scheduleOption);

    emailBodyText = `Hi Nina/Marisa,

Please see ALG conversion attached.

${urgencyLine}

Region: ${region}
Project Number: ${projectNumber}
Location/s: ${locationsCount}
Study: ${fullStudyFormatted}`;

    emailBodyHtml = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi Nina/Marisa,</p>
  <p style="margin: 0 0 12px 0;">Please see ALG conversion attached.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> ${region}</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${projectNumber}</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> ${locationsCount}</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ${fullStudyFormatted}</p>
</div>`.trim();
  }

  return {
    id: `pdf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    fileName,
    rawText: normalizedText,
    projectNumber,
    urgency,
    cityState,
    region,
    locationsCount,
    studyType,
    studyLineRaw,
    addOns,
    fullStudyFormatted,
    firm,
    contact,
    dueDate,
    hardDueDate,
    emailBodyText,
    emailBodyHtml,
    emailSubject,
    originalFile,
  };
}

/**
 * Parses the first page of a given PDF file in the browser.
 */
export async function parsePdfFile(
  file: File,
  scheduleOption: UrgencyScheduleOption = "today_next_week"
): Promise<ScannedPdfData> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, 2);
    let fullExtractedText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1.0 });
      const pageWidth = viewport.width || 612;
      const midX = pageWidth * 0.48;

      interface TextItemWithPos {
        str: string;
        x: number;
        y: number;
      }

      const leftItems: TextItemWithPos[] = [];
      const rightItems: TextItemWithPos[] = [];
      const allItems: TextItemWithPos[] = [];

      for (const item of textContent.items as any[]) {
        if (item.str && item.str.trim()) {
          const x = item.transform?.[4] || 0;
          const y = item.transform?.[5] || 0;
          const itemObj = { str: item.str, x, y };
          allItems.push(itemObj);
          if (x < midX) {
            leftItems.push(itemObj);
          } else {
            rightItems.push(itemObj);
          }
        }
      }

      const sortItems = (list: TextItemWithPos[]) => {
        list.sort((a, b) => {
          if (Math.abs(b.y - a.y) > 4) {
            return b.y - a.y;
          }
          return a.x - b.x;
        });

        const lineBuckets: string[][] = [];
        let currentY: number | null = null;
        let currentLine: string[] = [];

        for (const it of list) {
          if (currentY === null || Math.abs(it.y - currentY) > 4) {
            if (currentLine.length > 0) {
              lineBuckets.push(currentLine);
            }
            currentLine = [it.str];
            currentY = it.y;
          } else {
            currentLine.push(it.str);
          }
        }
        if (currentLine.length > 0) {
          lineBuckets.push(currentLine);
        }
        return lineBuckets.map((bucket) => bucket.join(" ")).join("\n");
      };

      const leftText = sortItems(leftItems);
      const rightText = sortItems(rightItems);
      const fullSpatialText = sortItems(allItems);

      // Combine column text and spatial text
      const pageText = `${leftText}\n\n${rightText}\n\n${fullSpatialText}`;
      fullExtractedText += (fullExtractedText ? "\n\n" : "") + pageText;
    }

    if (fullExtractedText.trim()) {
      return parseFieldsFromPdfText(fullExtractedText, file.name, scheduleOption, file);
    }
    throw new Error("Empty text extracted by pdfjs");
  } catch (error) {
    console.warn("pdfjs-dist extraction failed or threw, attempting fallback binary parser:", error);
    const fallbackText = extractTextFromPdfStreamFallback(arrayBuffer);
    return parseFieldsFromPdfText(
      fallbackText || "",
      file.name,
      scheduleOption,
      file
    );
  }
}

export interface CombinedApprovalEmail {
  emailSubject: string;
  emailBodyText: string;
  emailBodyHtml: string;
  tmcPdf?: ScannedPdfData;
  atrPdf?: ScannedPdfData;
  atrPdf2?: ScannedPdfData;
  allPdfs?: ScannedPdfData[];
  isTriple?: boolean;
}

/**
 * Generates the combined email when 2 or 3 PDFs are uploaded (TMC and ATRs).
 */
export function generateCombinedApprovalEmail(
  pdfList: ScannedPdfData[],
  scheduleOption: UrgencyScheduleOption = "today_next_week"
): CombinedApprovalEmail | null {
  if (pdfList.length === 0) return null;
  if (pdfList.length === 1) {
    const single = pdfList[0];
    return {
      emailSubject: single.emailSubject,
      emailBodyText: single.emailBodyText,
      emailBodyHtml: single.emailBodyHtml,
      tmcPdf: single.studyType.includes("TMC") ? single : undefined,
      atrPdf: single.studyType.includes("ATR") ? single : undefined,
      allPdfs: pdfList,
      isTriple: false,
    };
  }

  // Handle 3 PDFs (1 TMC + 2 ATRs, or general 3 files)
  if (pdfList.length === 3) {
    let tmcPdf = pdfList.find((p) => p.studyType.includes("TMC"));
    const atrPdfs = pdfList.filter((p) => p !== tmcPdf);

    if (!tmcPdf) {
      tmcPdf = pdfList[0];
    }
    const priorAtr = atrPdfs[0] || pdfList[1];
    const secondAtr = atrPdfs[1] || pdfList[2];

    const rawUrgency = tmcPdf?.urgency || priorAtr?.urgency || secondAtr?.urgency || "Priority Client";
    const urgencyLine = formatUrgencyLine(
      rawUrgency,
      scheduleOption === "none" ? "today_next_week" : scheduleOption
    );

    const tmcProj = (tmcPdf?.projectNumber || "").trim();
    const tmcLocs = (tmcPdf?.locationsCount || "1").trim();

    const priorAtrProj = (priorAtr?.projectNumber || "").trim();
    const secondAtrProj = (secondAtr?.projectNumber || "").trim();
    const priorAtrLocs = (priorAtr?.locationsCount || "1").trim();
    const secondAtrLocs = (secondAtr?.locationsCount || "1").trim();

    const region = priorAtr?.region || secondAtr?.region || "South Central";
    const addOns1 = (priorAtr?.addOns || "Volume").trim();
    const addOns2 = (secondAtr?.addOns || "Volume").trim();

    const emailSubject = formatTripleCombinedSubject(
      priorAtrProj,
      priorAtr?.addOns,
      secondAtrProj,
      secondAtr?.addOns,
      tmcProj
    );

    const emailBodyText = `Hi James,

Please see TMC camera placement approval.

${urgencyLine}

Project Number: ${tmcProj}
Location/s: ${tmcLocs}

Also, please see ALG conversion attached.

Region: ${region}
Project Number: ${priorAtrProj} & ${secondAtrProj}
Location/s: ${priorAtrLocs} & ${secondAtrLocs}
Study: ALG ${addOns1} / ${addOns2}`;

    const emailBodyHtml = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi James,</p>
  <p style="margin: 0 0 12px 0;">Please see TMC camera placement approval.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${tmcProj}</strong></p>
  <p style="margin: 0 0 14px 0;"><strong>Location/s:</strong> ${tmcLocs}</p>
  <p style="margin: 0 0 12px 0;">Also, please see ALG conversion attached.</p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> ${region}</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${priorAtrProj} &amp; ${secondAtrProj}</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> ${priorAtrLocs} &amp; ${secondAtrLocs}</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ALG ${addOns1} / ${addOns2}</p>
</div>`.trim();

    return {
      emailSubject,
      emailBodyText,
      emailBodyHtml,
      tmcPdf,
      atrPdf: priorAtr,
      atrPdf2: secondAtr,
      allPdfs: pdfList,
      isTriple: true,
    };
  }

  // Identify TMC PDF and ATR PDF (2 PDFs)
  let tmcPdf = pdfList.find((p) => p.studyType.includes("TMC"));
  let atrPdf = pdfList.find((p) => p.studyType.includes("ATR"));

  if (!tmcPdf && !atrPdf) {
    tmcPdf = pdfList[0];
    atrPdf = pdfList[1];
  } else if (!tmcPdf) {
    tmcPdf = pdfList.find((p) => p !== atrPdf) || pdfList[0];
  } else if (!atrPdf) {
    atrPdf = pdfList.find((p) => p !== tmcPdf) || pdfList[1];
  }

  const rawUrgency = tmcPdf?.urgency || atrPdf?.urgency || "Priority Client";
  // Format urgency line with the chosen schedule option (today, next week, today/next week)
  const urgencyLine = formatUrgencyLine(
    rawUrgency,
    scheduleOption === "none" ? "today_next_week" : scheduleOption
  );

  const tmcProj = tmcPdf?.projectNumber || "";
  const tmcLocs = tmcPdf?.locationsCount || "1";

  const atrRegion = atrPdf?.region || "South Central";
  const atrProj = atrPdf?.projectNumber || "";
  const atrLocs = atrPdf?.locationsCount || "1";
  const atrStudy = atrPdf?.fullStudyFormatted || (atrPdf?.addOns ? `ALG ${atrPdf.addOns}` : "ALG Volume");

  // Subject format for 2 PDFs (ALG and TMC): <ATR Project Number> ALG <Add ons> and <TMC Project Number> TMC Approval
  const emailSubject = formatCombinedSubject(atrProj, atrPdf?.addOns, tmcProj);

  const emailBodyText = `Hi James,

Please see TMC camera placement approval.

${urgencyLine}

Project Number: ${tmcProj}
Location/s: ${tmcLocs}

Also, Please see ALG conversion attached.

Region: ${atrRegion}
Project Number: ${atrProj}
Location/s: ${atrLocs}
Study: ${atrStudy}`;

  const emailBodyHtml = `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi James,</p>
  <p style="margin: 0 0 12px 0;">Please see TMC camera placement approval.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">${urgencyLine}</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${tmcProj}</strong></p>
  <p style="margin: 0 0 14px 0;"><strong>Location/s:</strong> ${tmcLocs}</p>
  <p style="margin: 0 0 12px 0;">Also, Please see ALG conversion attached.</p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> ${atrRegion}</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>${atrProj}</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> ${atrLocs}</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ${atrStudy}</p>
</div>`.trim();

  return {
    emailSubject,
    emailBodyText,
    emailBodyHtml,
    tmcPdf,
    atrPdf,
    allPdfs: pdfList,
    isTriple: false,
  };
}

/**
 * Pre-built sample PDF datasets matching the uploaded screenshots for testing
 */
export const SAMPLE_PDF_APPROVALS: ScannedPdfData[] = [
  {
    id: "sample-pdf-1",
    fileName: "26-770109_Boulder_CO.pdf",
    rawText: `Colorado
26-770109 | Boulder, CO
DUE DATE: 8/31/2026 03:32
HARD DUE DATE:
URGENCY: Priority Client
FIRM: LSC Transportation Consultants
PHONE: (303)333-1105
CONTACT: Christopher S. McGranahan
EMAIL(TO): csmcgranahan@lsctrans.com
EMAIL (CC): lscdenver@lsctrans.com
PROJECT DETAILS
3 (24hr) ATR (1 day)
w/ Volume
00:00-24:00 | Wed, Thu | 08/26/26 - 08/27/26
All Locations
PROJECT ATTACHMENT(S)
Yes`,
    projectNumber: "26-770109",
    urgency: "Priority Client",
    cityState: "Boulder, CO",
    region: "South Central",
    locationsCount: "3",
    studyType: "ATR",
    studyLineRaw: "3 (24hr) ATR (1 day)",
    addOns: "Volume",
    fullStudyFormatted: "ALG Volume",
    dueDate: "8/31/2026 03:32",
    hardDueDate: "",
    emailSubject: "26-770109 ALG Volume",
    emailBodyText: `Hi Nina/Marisa,

Please see ALG conversion attached.

URGENCY: Priority Client – Need to schedule today/next week.

Region: South Central
Project Number: 26-770109
Location/s: 3
Study: ALG Volume`,
    emailBodyHtml: `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi Nina/Marisa,</p>
  <p style="margin: 0 0 12px 0;">Please see ALG conversion attached.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">URGENCY: Priority Client – Need to schedule today/next week.</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> South Central</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>26-770109</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> 3</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ALG Volume</p>
</div>`.trim(),
  },
  {
    id: "sample-pdf-2",
    fileName: "26-770113_Cheyenne_WY.pdf",
    rawText: `26-770113 | Cheyenne, WY
DUE DATE: 9/4/2026 00:03
HARD DUE DATE:
URGENCY: Priority Client
FIRM: Kimley-Horn
PHONE: (970) 880-1176
CONTACT: Erick Berry
EMAIL(TO): Erick.Berry@kimley-horn.com
EMAIL (CC): Curtis.Rowe@kimley-horn.com, JoAnne.Harris@kimley-horn.com
PROJECT DETAILS
4 (4hr) TMC (1 day)
w/ Pedestrians, Bicycles, Motorcycles (FHWA 1), Passenger Vehicles (FHWA 2), Light Trucks (FHWA 3), Buses (FHWA 4), Single Unit Trucks (FHWA 5-7), TTSTs/Combo Unit Trucks (FHWA 8-13)
07:00-09:00, 16:00-18:00 | Tue/Wed/Thu | 09/01/26 - 09/03/26
All Locations`,
    projectNumber: "26-770113",
    urgency: "Priority Client",
    cityState: "Cheyenne, WY",
    region: "South Central",
    locationsCount: "4",
    studyType: "TMC",
    studyLineRaw: "4 (4hr) TMC (1 day)",
    addOns: "Pedestrians, Bicycles, Motorcycles (FHWA 1), Passenger Vehicles (FHWA 2), Light Trucks (FHWA 3), Buses (FHWA 4), Single Unit Trucks (FHWA 5-7), TTSTs/Combo Unit Trucks (FHWA 8-13)",
    fullStudyFormatted: "TMC Pedestrians, Bicycles, Motorcycles (FHWA 1), Passenger Vehicles (FHWA 2), Light Trucks (FHWA 3), Buses (FHWA 4), Single Unit Trucks (FHWA 5-7), TTSTs/Combo Unit Trucks (FHWA 8-13)",
    dueDate: "9/4/2026 00:03",
    hardDueDate: "",
    emailSubject: "26-770113 TMC Approval",
    emailBodyText: `Hi James,

Please see TMC camera placement approval.

URGENCY: Priority Client

Project Number: 26-770113
Location/s: 4`,
    emailBodyHtml: `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi James,</p>
  <p style="margin: 0 0 12px 0;">Please see TMC camera placement approval.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">URGENCY: Priority Client</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>26-770113</strong></p>
  <p style="margin: 0 0 0 0;"><strong>Location/s:</strong> 4</p>
</div>`.trim(),
  },
  {
    id: "sample-pdf-3",
    fileName: "26-770118_Fort_Collins_CO.pdf",
    rawText: `Colorado
26-770118 | Fort Collins, CO
DUE DATE: 9/02/2026 04:00
HARD DUE DATE:
URGENCY: Priority Client
FIRM: Apex Design
PHONE: (303)555-0199
CONTACT: Sarah Jenkins
EMAIL(TO): sjenkins@apexdesign.com
PROJECT DETAILS
2 (48hr) ATR (2 days)
w/ Speed & Classification
00:00-24:00 | Wed, Thu | 08/26/26 - 08/27/26
All Locations
PROJECT ATTACHMENT(S)
Yes`,
    projectNumber: "26-770118",
    urgency: "Priority Client",
    cityState: "Fort Collins, CO",
    region: "South Central",
    locationsCount: "2",
    studyType: "ATR",
    studyLineRaw: "2 (48hr) ATR (2 days)",
    addOns: "Speed & Classification",
    fullStudyFormatted: "ALG Speed & Classification",
    dueDate: "9/02/2026 04:00",
    hardDueDate: "",
    emailSubject: "26-770118 ALG Speed & Classification",
    emailBodyText: `Hi Nina/Marisa,

Please see ALG conversion attached.

URGENCY: Priority Client – Need to schedule today/next week.

Region: South Central
Project Number: 26-770118
Location/s: 2
Study: ALG Speed & Classification`,
    emailBodyHtml: `
<div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #000000; line-height: 1.5;">
  <p style="margin: 0 0 12px 0;">Hi Nina/Marisa,</p>
  <p style="margin: 0 0 12px 0;">Please see ALG conversion attached.</p>
  <p style="margin: 0 0 12px 0;"><span style="background-color: #FFFF00; color: #000000; font-weight: bold; padding: 0 4px; display: inline-block;">URGENCY: Priority Client – Need to schedule today/next week.</span></p>
  <p style="margin: 0 0 4px 0;"><strong>Region:</strong> South Central</p>
  <p style="margin: 0 0 4px 0;"><strong>Project Number:</strong> <strong>26-770118</strong></p>
  <p style="margin: 0 0 4px 0;"><strong>Location/s:</strong> 2</p>
  <p style="margin: 0 0 0 0;"><strong>Study:</strong> ALG Speed & Classification</p>
</div>`.trim(),
  },
];
