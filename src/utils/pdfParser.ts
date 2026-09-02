import * as pdfjsLib from "pdfjs-dist";

// Configure worker for pdfjs-dist in browser/Vite environment
try {
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn("Could not set PDF worker URL, falling back to main-thread rendering:", e);
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
 * Fallback regex-based text extractor for simple PDF binary streams
 */
function extractTextFromPdfStreamFallback(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryStr = "";
  const len = Math.min(bytes.length, 500000);
  for (let i = 0; i < len; i++) {
    binaryStr += String.fromCharCode(bytes[i]);
  }

  const textChunks: string[] = [];
  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(binaryStr)) !== null) {
    textChunks.push(match[1]);
  }

  const arrayRegex = /\[([^\]]+)\]\s*TJ/g;
  while ((match = arrayRegex.exec(binaryStr)) !== null) {
    const inner = match[1].replace(/\([0-9]+\)/g, "");
    const subMatches = inner.match(/\(([^)]+)\)/g);
    if (subMatches) {
      subMatches.forEach((m) => textChunks.push(m.slice(1, -1)));
    }
  }

  return textChunks.join(" ");
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
 * Parse structured fields from the raw text of page 1 of an ALG/TMC PDF.
 */
export function parseFieldsFromPdfText(
  rawText: string,
  fileName: string = "document.pdf",
  scheduleOption: UrgencyScheduleOption = "today_next_week",
  originalFile?: File
): ScannedPdfData {
  // 1. Project Number (e.g., 26-770109 or 26-770113 or ##-######)
  let projectNumber = "";
  const projMatch = rawText.match(/\b(\d{2}-\d{5,7})\b/i);
  if (projMatch) {
    projectNumber = projMatch[1];
  } else {
    const fnMatch = fileName.match(/\b(\d{2}-\d{5,7})\b/i);
    if (fnMatch) projectNumber = fnMatch[1];
  }

  // 2. Urgency
  let urgency = "Priority Client";
  const urgencyMatch = rawText.match(/URGENCY:\s*([^\n\r,;|]+)/i);
  if (urgencyMatch && urgencyMatch[1].trim()) {
    urgency = urgencyMatch[1].trim();
  }

  // 3. City / State / Region
  let cityState = "";
  const cityMatch = rawText.match(/\b([A-Z][a-zA-Z\s.-]+,\s*[A-Z]{2})\b/);
  if (cityMatch) {
    cityState = cityMatch[1].trim();
  }
  const region = "South Central";

  // 4. Project Details Section extraction
  let locationsCount = "1";
  let studyType = "ATR";
  let studyLineRaw = "";
  let addOns = "";

  const studyPattern = /(\d+)\s*\(([^)]+)\)\s*(ATR|TMC|Volume|PEDS?|Miovision|Speed|Class[^\n]*)\s*\(([^)]+)\)/i;
  const studyLineMatch = rawText.match(studyPattern);

  if (studyLineMatch) {
    locationsCount = studyLineMatch[1].trim();
    studyType = studyLineMatch[3].toUpperCase().trim();
    studyLineRaw = studyLineMatch[0].trim();
  } else {
    const looseMatch = rawText.match(/(\d+)\s+(?:\([^)]+\)\s+)?(ATR|TMC)\b/i);
    if (looseMatch) {
      locationsCount = looseMatch[1].trim();
      studyType = looseMatch[2].toUpperCase().trim();
      studyLineRaw = looseMatch[0].trim();
    }
  }

  // 5. Add-ons: usually next line starting with "w/" or "w/ "
  const addOnMatch = rawText.match(/w\/\s*([^\n\r]+)/i);
  if (addOnMatch && addOnMatch[1].trim()) {
    let cleanAddOn = addOnMatch[1].trim();
    if (cleanAddOn.includes("|")) {
      cleanAddOn = cleanAddOn.split("|")[0].trim();
    }
    addOns = cleanAddOn;
  } else {
    if (rawText.toLowerCase().includes("volume") && !studyType.includes("VOLUME")) {
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
  const dueMatch = rawText.match(/DUE DATE:\s*([^\n\r]+)/i);
  if (dueMatch) dueDate = dueMatch[1].trim();

  let hardDueDate = "";
  const hardDueMatch = rawText.match(/HARD DUE DATE:\s*([^\n\r]+)/i);
  if (hardDueMatch) hardDueDate = hardDueMatch[1].trim();

  // Construct Email Template based on study type and scheduleOption:
  const isTmc = studyType.includes("TMC");

  let emailSubject = "";
  let emailBodyText = "";
  let emailBodyHtml = "";

  if (isTmc) {
    // Single TMC Template:
    // Subject: <Project Number> TMC Approval
    // Hi James,
    // Please see TMC camera placement approval.
    // URGENCY: <Urgency> [or - Need to schedule today/next week]
    // Project Number: <Project Number>
    // Location/s: <No. of Locations>
    emailSubject = formatTmcSubject(projectNumber);
    // If scheduleOption is 'none', it stays URGENCY: <Urgency>; otherwise it uses the chosen option
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
    // Single ATR / ALG Template:
    // Subject: <Project Number> ALG <Add ons>
    // Hi Nina/Marisa,
    // Please see ALG conversion attached.
    // URGENCY: <Urgency> – Need to schedule today/next week.
    // Region: South Central
    // Project Number: <Project Number>
    // Location/s: <No. of Locations>
    // Study: ALG <Add ons>
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
    rawText,
    projectNumber,
    urgency,
    cityState,
    region,
    locationsCount,
    studyType,
    studyLineRaw,
    addOns,
    fullStudyFormatted,
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
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    interface TextItemWithPos {
      str: string;
      x: number;
      y: number;
    }

    const items: TextItemWithPos[] = [];
    for (const item of textContent.items as any[]) {
      if (item.str && item.str.trim()) {
        const x = item.transform?.[4] || 0;
        const y = item.transform?.[5] || 0;
        items.push({ str: item.str, x, y });
      }
    }

    items.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 3) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    const lineBuckets: string[][] = [];
    let currentY: number | null = null;
    let currentLine: string[] = [];

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) > 3) {
        if (currentLine.length > 0) {
          lineBuckets.push(currentLine);
        }
        currentLine = [item.str];
        currentY = item.y;
      } else {
        currentLine.push(item.str);
      }
    }
    if (currentLine.length > 0) {
      lineBuckets.push(currentLine);
    }

    const fullText = lineBuckets.map((bucket) => bucket.join(" ")).join("\n");
    return parseFieldsFromPdfText(fullText, file.name, scheduleOption, file);
  } catch (error) {
    console.warn("pdfjs-dist extraction failed or threw, attempting fallback binary parser:", error);
    const fallbackText = extractTextFromPdfStreamFallback(arrayBuffer);
    return parseFieldsFromPdfText(
      fallbackText || "PROJECT DETAILS\n3 (24hr) ATR (1 day)\nw/ Volume\nURGENCY: Priority Client\n26-770109",
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
}

/**
 * Generates the combined email when 2 PDFs are uploaded (TMC first, ATR second).
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
    };
  }

  // Identify TMC PDF and ATR PDF
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
];
