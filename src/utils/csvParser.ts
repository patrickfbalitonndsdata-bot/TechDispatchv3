import Papa from "papaparse";
import { WorkOrder, ColumnMapping, ParseResult, PriorityLevel, DetectedWorkWeek } from "../types";

// Standard Field Synonyms for automatic fuzzy header matching
const FIELD_SYNONYMS: Record<keyof ColumnMapping, string[]> = {
  setupBefore: ["setup before", "setupbefore", "setup_before", "setup date", "install before", "install date", "setup", "set up before", "set_up_before", "install", "installation date"],
  teardownAfter: ["teardown after", "teardownafter", "teardown_after", "tear down after", "tear_down_after", "teardown date", "teardown", "pickup date", "pickup after"],
  scheduleOrder: [
    "schedule order",
    "scheduleorder",
    "schedule_order",
    "schedule order list",
    "order list",
    "order_list",
    "install order",
    "install_order",
    "stop order",
    "stop_order",
    "run order",
    "run_order",
    "sequence",
    "seq",
    "order sequence",
    "order #",
    "order_seq",
    "order",
  ],
  batteryCheckPrefix: ["battery change/equipment check", "battery change", "battery check", "equipment check", "battery swap", "sd card swap"],
  locationId: ["location id", "locationid", "location_id", "location", "project id", "projectid", "project number", "project_id", "loc id", "loc_id"],
  serviceType: [
    "service type",
    "servicetype",
    "service_type",
    "service",
    "jobtype",
    "job type",
    "job_type",
    "work type",
    "service types (from project id) (from locations)",
    "service type (from project id) (from locations)",
    "service types (from locations)",
    "service type (from locations)",
    "service types",
  ],
  serviceTypeAddOns: [
    "service type add ons (from project id) (from locations)",
    "service type add-ons (from project id) (from locations)",
    "service types add ons (from project id) (from locations)",
    "service types add-ons (from project id) (from locations)",
    "service type add ons",
    "service type add-ons",
    "service types add ons",
    "service types add-ons",
    "service type add on",
    "addons",
    "add ons",
    "add-ons",
    "add_ons",
    "service add ons",
    "service_add_ons",
  ],
  method: [
    "method",
    "collection method",
    "method (from locations)",
    "equipment method",
    "device method",
    "counter method",
    "survey method",
    "data collection method",
  ],
  redo: [
    "redo",
    "is redo",
    "isredo",
    "re-do",
    "re do",
    "redone",
    "redo (from locations)",
    "is_redo",
    "redo?",
  ],
  cityState: ["city, state", "city,state", "city state", "city/state", "city_state", "city", "state", "municipality"],
  countyParish: [
    "different county (from locations)",
    "different county",
    "county (from locations)",
    "different parish (from locations)",
    "different parish",
    "parish (from locations)",
    "parish",
    "county",
    "county/parish",
    "parish/county",
    "parish or county",
    "county parish",
  ],
  workWeek: [
    "work week",
    "workweek",
    "work week (from locations)",
    "work_week",
    "ww",
    "work week #",
    "work week no",
    "week",
    "week #",
    "week no",
  ],
  cameraCounts: ["camera counts", "camera count", "cameracounts", "cameracount", "cameras", "camera_count", "camera", "units", "count", "camera qty", "qty"],
  backupUnits: [
    "backup units",
    "backup unit",
    "backup units (from project id)",
    "backup units (from project id) (from locations)",
    "backup camera",
    "backup cameras",
    "backups",
    "backup",
    "backup count",
    "backup qty",
    "backup_units",
  ],
  schedulingTeamNotes: [
    "scheduling team notes",
    "scheduling team note",
    "scheduling_team_notes",
    "scheduling notes",
    "scheduling note",
    "scheduling_notes",
    "team notes",
    "team note",
    "city of dallas list",
    "city of dallas",
  ],
  scheduleNotes: [
    "schedule notes",
    "schedule note",
    "schedulenotes",
    "schedulenote",
    "schedule_notes",
    "schedule_note",
    "location notes",
    "location note",
    "location_notes",
    "field notes",
    "field_notes",
    "notes",
  ],
  scheduleDetails: [
    "schedule details",
    "schedule detail",
    "scheduledetails",
    "scheduledetail",
    "schedule_details",
    "schedule_detail",
    "study details",
    "study detail",
    "collection details",
    "collection detail",
  ],
  taskCategory: ["task type", "task_type", "activity", "action", "entry type", "operation", "task", "status"],
  teardownTimeNotes: ["teardown time notes", "teardown notes", "teardown time", "teardowntime", "teardown_notes", "time notes", "teardown"],
  daysOfCollection: ["days of collection", "days of collection collection", "collection days", "days of study", "collection duration", "days"],
  orderNumber: ["workorder", "wo", "order", "ticket", "ticket#", "jobid", "job_id", "taskid", "id", "work order #", "wo#", "job#"],
  technicianName: ["technician", "tech", "technicianname", "techname", "engineer", "worker", "assignedto", "assigned_to", "tech_name", "employee", "agent"],
  technicianEmail: ["techemail", "email", "technicianemail", "tech_email", "useremail", "worker_email", "mail", "assigned_email"],
  date: ["date", "scheduleddate", "scheduled_date", "servicedate", "service_date", "day", "appointment_date", "work_date"],
  timeSlot: ["timeslot", "time_slot", "time", "window", "arrivalwindow", "arrival_window", "slot", "start_time", "starttime", "hours", "scheduled_time"],
  customerName: ["customer", "customername", "customer_name", "client", "clientname", "client_name", "account", "contact_name", "name"],
  customerPhone: ["phone", "customerphone", "customer_phone", "tel", "telephone", "mobile", "contact_phone", "cell", "phone#"],
  customerEmail: ["customeremail", "customer_email", "clientemail", "client_email", "cust_email"],
  serviceAddress: ["address", "serviceaddress", "service_address", "location", "site", "street", "siteaddress", "destination", "job_location"],
  jobType: ["jobtype", "job_type", "type", "service", "servicetype", "service_type", "issue", "category", "work_type", "task_type"],
  priority: ["priority", "urgency", "severity", "level", "prio", "importance"],
  description: ["description", "desc", "details", "work_description", "summary", "problem", "complaint", "scope", "task_description"],
  specialInstructions: ["specialinstructions", "special_instructions", "instructions", "notes", "dispatchernotes", "comments", "site_notes", "gate_code", "remarks"],
  requiredParts: ["partsrequired", "parts_required", "parts", "tools", "equipment", "materials", "parts_needed", "equipment_needed"],
  estimatedDurationMin: ["estmin", "estimateddurationmin", "duration", "estimated_duration", "duration_min", "minutes", "est_hours", "hours"],
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    cleaned: h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  }));

  const mapping: ColumnMapping = {
    orderNumber: "",
    locationId: "",
    serviceType: "",
    serviceTypeAddOns: "",
    method: "",
    redo: "",
    cityState: "",
    countyParish: "",
    workWeek: "",
    cameraCounts: "",
    backupUnits: "",
    schedulingTeamNotes: "",
    scheduleNotes: "",
    scheduleDetails: "",
    taskCategory: "",
    teardownTimeNotes: "",
    daysOfCollection: "",
    setupBefore: "",
    teardownAfter: "",
    scheduleOrder: "",
    batteryCheckPrefix: "",
    technicianName: "",
    technicianEmail: "",
    date: "",
    timeSlot: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceAddress: "",
    jobType: "",
    priority: "",
    description: "",
    specialInstructions: "",
    requiredParts: "",
    estimatedDurationMin: "",
  };

  const usedHeaders = new Set<string>();

  for (const [fieldKey, synonyms] of Object.entries(FIELD_SYNONYMS) as [keyof ColumnMapping, string[]][]) {
    let matchedHeader = "";

    // 1. Exact match on cleaned string
    for (const syn of synonyms) {
      const synCleaned = syn.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = normalizedHeaders.find((h) => h.cleaned === synCleaned && !usedHeaders.has(h.original));
      if (match) {
        matchedHeader = match.original;
        break;
      }
    }

    // 2. Partial match if no exact match found
    if (!matchedHeader) {
      for (const syn of synonyms) {
        const synCleaned = syn.toLowerCase().replace(/[^a-z0-9]/g, "");
        const match = normalizedHeaders.find(
          (h) => (h.cleaned.includes(synCleaned) || synCleaned.includes(h.cleaned)) && !usedHeaders.has(h.original)
        );
        if (match) {
          matchedHeader = match.original;
          break;
        }
      }
    }

    if (matchedHeader) {
      mapping[fieldKey] = matchedHeader;
      usedHeaders.add(matchedHeader);
    }
  }

  return mapping;
}

export function normalizePriority(val: any): PriorityLevel {
  if (!val) return "Normal";
  const s = String(val).trim().toLowerCase();
  if (s.includes("urgent") || s.includes("critical") || s.includes("p1") || s.includes("emergency")) return "Urgent";
  if (s.includes("high") || s.includes("p2") || s.includes("major")) return "High";
  if (s.includes("low") || s.includes("p4") || s.includes("minor")) return "Low";
  return "Normal";
}

export function normalizeDate(val: any): string {
  if (!val) {
    return new Date().toISOString().split("T")[0];
  }
  const str = String(val).trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  // If MM/DD/YYYY or M/D/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (mdyMatch) {
    const m = mdyMatch[1].padStart(2, "0");
    const d = mdyMatch[2].padStart(2, "0");
    const y = mdyMatch[3];
    return `${y}-${m}-${d}`;
  }
  // Try JS Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return str;
}

/**
 * Parses a combined date/time cell (e.g. "08/27/2026 08:00" or "8/27/2026 10:30 AM" or "2026-08-27 14:00")
 * Returns { date: "YYYY-MM-DD", timeSlot: "HH:MM AM/PM" or raw time }
 */
export function parseDateTimeString(val: any): { date: string; timeSlot: string } | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return null;

  // Match MM/DD/YYYY (with optional HH:MM or HH:MM:SS or AM/PM)
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(.*))?$/);
  if (mdyMatch) {
    const m = mdyMatch[1].padStart(2, "0");
    const d = mdyMatch[2].padStart(2, "0");
    const y = mdyMatch[3];
    const date = `${y}-${m}-${d}`;
    const timeSlot = mdyMatch[4] ? mdyMatch[4].trim() : "";
    return { date, timeSlot };
  }

  // Match YYYY-MM-DD (with optional HH:MM or HH:MM:SS or AM/PM)
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(.*))?$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    const date = `${y}-${m}-${d}`;
    const timeSlot = ymdMatch[4] ? ymdMatch[4].trim() : "";
    return { date, timeSlot };
  }

  // Fallback to JS Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const date = parsed.toISOString().split("T")[0];
    const timeSlot = parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { date, timeSlot };
  }

  return null;
}

/**
 * Extracts Project Number from Location ID (e.g. "26-999999-001" -> "26-999999")
 * Removes the trailing dash and 2-4 digit suffix (e.g., "-001")
 */
export function extractProjectNumber(locationId: string): string {
  if (!locationId) return "";
  const trimmed = String(locationId).trim();
  // Strip trailing -001, -01, -5666, -0001
  const stripped = trimmed.replace(/-\d{1,5}$/, "").trim();
  return stripped;
}

/**
 * Extracts Location suffix number from Location ID (e.g. "26-999999-001" -> "001", "26-240026-5666" -> "5666")
 */
export function extractLocationSuffix(locationId: string): string {
  if (!locationId) return "";
  const trimmed = String(locationId).trim();
  const match = trimmed.match(/-(\d{1,5})$/);
  if (match) {
    return match[1];
  }
  // Check if the whole string is just 001, 5666, etc.
  if (/^\d{1,5}$/.test(trimmed)) {
    return trimmed;
  }
  return "";
}

/**
 * Infer whether the task is an "Install", "Teardown", or "BatterySwap"
 */
export function inferTaskCategory(
  taskCategoryVal: string,
  serviceTypeVal: string,
  jobTypeVal: string,
  descVal: string
): "Install" | "Teardown" | "BatterySwap" {
  const combined = `${taskCategoryVal} ${serviceTypeVal} ${jobTypeVal} ${descVal}`.toLowerCase();

  if (
    combined.includes("swap") ||
    combined.includes("battery") ||
    combined.includes("sd card") ||
    combined.includes("sdcard") ||
    combined.includes("mid-study") ||
    combined.includes("mid study") ||
    combined.includes("check")
  ) {
    return "BatterySwap";
  }

  if (
    combined.includes("teardown") ||
    combined.includes("tear down") ||
    combined.includes("pickup") ||
    combined.includes("pick up") ||
    combined.includes("retrieve") ||
    combined.includes("removal") ||
    combined.includes("remove") ||
    combined.includes("dismantle")
  ) {
    return "Teardown";
  }

  return "Install";
}

/**
 * Cleans enclosing quotes, escaped quotes, and extra whitespace from technician names.
 * e.g. '"May, Dustyn"' -> 'May, Dustyn', '""Dustyn May""' -> 'Dustyn May'
 */
export function cleanTechnicianName(name?: string): string {
  if (!name) return "";
  let cleaned = String(name).trim();
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
  cleaned = cleaned.replace(/\\"/g, "").replace(/\\'/g, "").trim();
  cleaned = cleaned.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "").trim();
  return cleaned;
}

export function parseCsvData(csvText: string, customMapping?: Partial<ColumnMapping>): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const headers = parsed.meta.fields || [];
  const autoMap = autoDetectMapping(headers);
  const mapping: ColumnMapping = { ...autoMap, ...(customMapping || {}) };

  // Identify all "Battery Change/Equipment Check N" columns
  const batteryCheckColumns: string[] = [];
  headers.forEach((h) => {
    const cleaned = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      cleaned.includes("batterychange") ||
      cleaned.includes("equipmentcheck") ||
      cleaned.includes("batterycheck") ||
      cleaned.includes("batteryswap") ||
      (cleaned.startsWith("battery") && /\d+/.test(cleaned))
    ) {
      batteryCheckColumns.push(h);
    }
  });

  // Sort battery columns by number if applicable (e.g. check 1, check 2, check 3)
  batteryCheckColumns.sort((a, b) => {
    const numA = parseInt((a.match(/\d+/) || ["0"])[0], 10);
    const numB = parseInt((b.match(/\d+/) || ["0"])[0], 10);
    return numA - numB;
  });

  const orders: WorkOrder[] = [];
  const warnings: string[] = [];
  const detectedDates = new Set<string>();
  const technicianSet = new Set<string>();

  parsed.data.forEach((row, idx) => {
    // Check if row is empty
    const values = Object.values(row).filter((v) => v && String(v).trim().length > 0);
    if (values.length === 0) return;

    const rawTechName = (row[mapping.technicianName] || "Unassigned Tech").trim();
    const techName = cleanTechnicianName(rawTechName) || "Unassigned Tech";
    let techEmail = (row[mapping.technicianEmail] || "").trim();

    // If tech email is missing, infer a dummy safe email
    if (!techEmail && techName && techName !== "Unassigned Tech") {
      const slug = techName.toLowerCase().replace(/[^a-z0-9]/g, ".");
      techEmail = `${slug}@fieldservice.local`;
      warnings.push(`Row ${idx + 1}: Generated temporary email "${techEmail}" for "${techName}"`);
    }

    const orderNum = (row[mapping.orderNumber] || `WO-${1000 + idx}`).trim();
    const rawLocationId = (row[mapping.locationId] || row[mapping.orderNumber] || "").trim();
    const projectNumber = extractProjectNumber(rawLocationId || orderNum);

    const customer = (row[mapping.customerName] || "Valued Client").trim();
    const phone = (row[mapping.customerPhone] || "N/A").trim();
    const custEmail = (row[mapping.customerEmail] || "").trim();
    const address = (row[mapping.serviceAddress] || "Customer Location on File").trim();
    
    // NDS Specific Columns
    const serviceType = (row[mapping.serviceType] || row[mapping.jobType] || "Miovision").trim();
    const serviceTypeAddOns = (row[mapping.serviceTypeAddOns] || "").trim();
    
    // Method Column (e.g. "ATR", "Miovision", "Machine")
    const rawMethod = (
      row[mapping.method] ||
      row["Method"] ||
      row["Method (from Locations)"] ||
      row["Collection Method"] ||
      row["Equipment Method"] ||
      ""
    ).trim();
    const method = rawMethod || undefined;

    // Redo Column check
    const rawRedo = (
      row[mapping.redo] ||
      row["Redo"] ||
      row["REDO"] ||
      row["Is Redo"] ||
      row["IsRedo"] ||
      row["Re-do"] ||
      row["Redo (from Locations)"] ||
      ""
    ).trim();
    let isRedo = false;
    if (rawRedo) {
      const lowerRedo = rawRedo.toLowerCase();
      if (["true", "1", "yes", "y", "x", "redo", "checked", "check", "✓", "t"].includes(lowerRedo)) {
        isRedo = true;
      }
    } else {
      // Check any key containing "redo"
      for (const [k, v] of Object.entries(row)) {
        if (/\bredo\b/i.test(k) && v) {
          const vLower = String(v).trim().toLowerCase();
          if (["true", "1", "yes", "y", "x", "redo", "checked", "check", "✓", "t"].includes(vLower)) {
            isRedo = true;
            break;
          }
        }
      }
    }
    
    let cityState = (row[mapping.cityState] || "").trim();
    if (!cityState && address.includes(",")) {
      // Attempt extraction of City, State from address
      const parts = address.split(",");
      if (parts.length >= 2) {
        cityState = `${parts[parts.length - 2].trim()}, ${parts[parts.length - 1].trim().split(" ")[0]}`;
      }
    }

    const rawCameraCounts = (row[mapping.cameraCounts] || "").trim();
    const cameraCounts = rawCameraCounts || "";

    const rawBackupUnits = (row[mapping.backupUnits] || "").trim();
    const backupUnits = rawBackupUnits || "";

    const rawSchedulingTeamNotes = (
      row[mapping.schedulingTeamNotes] ||
      row["Scheduling Team Notes"] ||
      row["Scheduling Team Note"] ||
      row["Scheduling Notes"] ||
      row["Team Notes"] ||
      row["City of Dallas List"] ||
      ""
    ).trim();
    const schedulingTeamNotes = rawSchedulingTeamNotes || "";

    const rawScheduleNotes = (
      row[mapping.scheduleNotes] ||
      row["Schedule Notes"] ||
      row["Schedule Note"] ||
      row["Location Notes"] ||
      row["Location Note"] ||
      row["Field Notes"] ||
      ""
    ).trim();

    // If scheduleNotes happens to be identical to schedulingTeamNotes, clear it so location bullets don't show it
    let cleanScheduleNotes = rawScheduleNotes || "";
    if (
      cleanScheduleNotes &&
      schedulingTeamNotes &&
      cleanScheduleNotes.toLowerCase() === schedulingTeamNotes.toLowerCase()
    ) {
      cleanScheduleNotes = "";
    }
    const scheduleNotes = cleanScheduleNotes;

    const rawScheduleDetails = (row[mapping.scheduleDetails] || "").trim();
    const scheduleDetails = rawScheduleDetails || "";

    const teardownTimeNotes = (row[mapping.teardownTimeNotes] || "").trim();
    const daysOfCollection = (row[mapping.daysOfCollection] || "").trim();

    // Extract Duration e.g. "Duration", "Time Duration", "Duration (from Locations)"
    const rawDuration = (
      row["Duration"] ||
      row["Time Duration"] ||
      row["Duration (from Locations)"] ||
      row["Collection Duration"] ||
      row["Study Duration"] ||
      row["Hours"] ||
      ""
    ).trim();
    const duration = rawDuration || undefined;

    // Extract County / Parish e.g. "Different County (from Locations)" or "Vermilion Parish"
    const rawCountyParish = (
      row[mapping.countyParish] ||
      row["Different County (from Locations)"] ||
      row["Different County"] ||
      row["County (from Locations)"] ||
      row["Parish"] ||
      row["County"] ||
      ""
    ).trim();
    let countyParish = rawCountyParish || "";
    if (countyParish && !/parish|county/i.test(countyParish)) {
      countyParish = `${countyParish} Parish`;
    }

    const rawTaskCategory = (row[mapping.taskCategory] || "").trim();
    const jobType = (row[mapping.jobType] || serviceType || "General Service").trim();
    const priority = normalizePriority(row[mapping.priority]);
    const description = (row[mapping.description] || "Service task as assigned").trim();
    const specialInstructions = (row[mapping.specialInstructions] || "").trim();
    const requiredParts = (row[mapping.requiredParts] || "").trim();

    // Extract Work Week e.g. "Work Week", "WW", "Work Week 32", "32"
    const rawWorkWeek = (
      row[mapping.workWeek] ||
      row["Work Week"] ||
      row["WorkWeek"] ||
      row["Work Week (from Locations)"] ||
      row["WW"] ||
      ""
    ).trim();
    let workWeek = rawWorkWeek || "";
    if (!workWeek) {
      // Check if embedded in scheduleNotes, scheduleDetails, or description
      const combinedText = `${scheduleNotes} ${scheduleDetails} ${description} ${specialInstructions}`;
      const wwMatch = combinedText.match(/(?:Work\s*Week|WW)\s*[:#]?\s*(\d+)/i);
      if (wwMatch) {
        workWeek = `Work Week ${wwMatch[1]}`;
      }
    } else {
      const numMatch = workWeek.match(/\d+/);
      if (numMatch && !/work\s*week/i.test(workWeek)) {
        workWeek = `Work Week ${numMatch[0]}`;
      }
    }

    const rawScheduleOrder = (row[mapping.scheduleOrder] || row["Schedule Order"] || row["schedule order"] || row["ScheduleOrder"] || "").trim();
    let scheduleOrder: number | string | undefined = undefined;
    if (rawScheduleOrder) {
      const matchNum = rawScheduleOrder.match(/\d+(\.\d+)?/);
      if (matchNum) {
        scheduleOrder = parseFloat(matchNum[0]);
      } else {
        scheduleOrder = rawScheduleOrder;
      }
    }

    let estMin = 60;
    if (mapping.estimatedDurationMin && row[mapping.estimatedDurationMin]) {
      const num = parseInt(row[mapping.estimatedDurationMin].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(num) && num > 0) {
        estMin = num;
      }
    }

    if (techName) technicianSet.add(techName);

    // 1. Check for explicit "Setup Before", "Teardown After", and "Battery Check" columns
    const setupBeforeVal = mapping.setupBefore ? (row[mapping.setupBefore] || "").trim() : "";
    const teardownAfterVal = mapping.teardownAfter ? (row[mapping.teardownAfter] || "").trim() : "";

    const setupParsed = parseDateTimeString(setupBeforeVal);
    const teardownParsed = parseDateTimeString(teardownAfterVal);

    // Gather battery checks with non-empty values
    const batteryCheckItems: { column: string; rawVal: string; parsed: { date: string; timeSlot: string } }[] = [];
    batteryCheckColumns.forEach((col) => {
      const val = (row[col] || "").trim();
      if (val) {
        const parsedDT = parseDateTimeString(val);
        if (parsedDT) {
          batteryCheckItems.push({ column: col, rawVal: val, parsed: parsedDT });
        }
      }
    });

    const hasMultiActivityColumns = !!setupParsed || !!teardownParsed || batteryCheckItems.length > 0;

    if (hasMultiActivityColumns) {
      // Create distinct work order tasks for each present activity column:

      // (A) Setup Before -> Install
      if (setupParsed) {
        detectedDates.add(setupParsed.date);
        orders.push({
          id: `wo-${idx}-${orderNum}-install`,
          orderNumber: orderNum,
          locationId: rawLocationId || undefined,
          projectNumber: projectNumber || undefined,
          technicianName: techName,
          technicianEmail: techEmail,
          date: setupParsed.date,
          timeSlot: setupParsed.timeSlot || (row[mapping.timeSlot] || "TBD (08:00 AM - 05:00 PM)").trim(),
          customerName: customer,
          customerPhone: phone,
          customerEmail: custEmail || undefined,
          serviceAddress: address,
          cityState: cityState || undefined,
          countyParish: countyParish || undefined,
          workWeek: workWeek || undefined,
          jobType,
          taskCategory: "Install",
          serviceTypeAddOns: serviceTypeAddOns || undefined,
          method,
          isRedo,
          cameraCounts: cameraCounts || undefined,
          backupUnits: backupUnits || undefined,
          schedulingTeamNotes: schedulingTeamNotes || undefined,
          scheduleNotes: scheduleNotes || undefined,
          scheduleDetails: scheduleDetails || undefined,
          teardownTimeNotes: teardownTimeNotes || undefined,
          daysOfCollection: daysOfCollection || undefined,
          duration: duration || undefined,
          scheduleOrder,
          setupBefore: setupBeforeVal,
          teardownAfter: teardownAfterVal || undefined,
          priority,
          description: description || "Install / Setup",
          specialInstructions: specialInstructions || undefined,
          requiredParts: requiredParts || undefined,
          estimatedDurationMin: estMin,
          status: "Scheduled",
          rawRowData: row,
        });
      }

      // (B) Battery Change / Equipment Check 1..N -> BatterySwap (ONLY if entries exist)
      batteryCheckItems.forEach((bItem, bIdx) => {
        detectedDates.add(bItem.parsed.date);
        orders.push({
          id: `wo-${idx}-${orderNum}-battery-${bIdx + 1}`,
          orderNumber: orderNum,
          locationId: rawLocationId || undefined,
          projectNumber: projectNumber || undefined,
          technicianName: techName,
          technicianEmail: techEmail,
          date: bItem.parsed.date,
          timeSlot: bItem.parsed.timeSlot || (row[mapping.timeSlot] || "TBD").trim(),
          customerName: customer,
          customerPhone: phone,
          customerEmail: custEmail || undefined,
          serviceAddress: address,
          cityState: cityState || undefined,
          countyParish: countyParish || undefined,
          workWeek: workWeek || undefined,
          jobType,
          taskCategory: "BatterySwap",
          serviceTypeAddOns: serviceTypeAddOns || undefined,
          method,
          isRedo,
          cameraCounts: cameraCounts || undefined,
          backupUnits: backupUnits || undefined,
          schedulingTeamNotes: schedulingTeamNotes || undefined,
          scheduleNotes: scheduleNotes || undefined,
          scheduleDetails: scheduleDetails || undefined,
          teardownTimeNotes: teardownTimeNotes || undefined,
          daysOfCollection: daysOfCollection || undefined,
          duration: duration || undefined,
          scheduleOrder,
          setupBefore: setupBeforeVal || undefined,
          teardownAfter: teardownAfterVal || undefined,
          priority,
          description: description || `${bItem.column}`,
          specialInstructions: specialInstructions || undefined,
          requiredParts: requiredParts || undefined,
          estimatedDurationMin: estMin,
          status: "Scheduled",
          rawRowData: row,
        });
      });

      // (C) Teardown After -> Teardown
      if (teardownParsed) {
        detectedDates.add(teardownParsed.date);
        // If teardown time notes is empty, use the time portion from teardownAfter or default
        const effectiveTeardownTimeNotes = teardownTimeNotes || teardownParsed.timeSlot || "Anytime";
        orders.push({
          id: `wo-${idx}-${orderNum}-teardown`,
          orderNumber: orderNum,
          locationId: rawLocationId || undefined,
          projectNumber: projectNumber || undefined,
          technicianName: techName,
          technicianEmail: techEmail,
          date: teardownParsed.date,
          timeSlot: teardownParsed.timeSlot || (row[mapping.timeSlot] || "TBD (08:00 AM - 05:00 PM)").trim(),
          customerName: customer,
          customerPhone: phone,
          customerEmail: custEmail || undefined,
          serviceAddress: address,
          cityState: cityState || undefined,
          countyParish: countyParish || undefined,
          workWeek: workWeek || undefined,
          jobType,
          taskCategory: "Teardown",
          serviceTypeAddOns: serviceTypeAddOns || undefined,
          method,
          isRedo,
          cameraCounts: cameraCounts || undefined,
          backupUnits: backupUnits || undefined,
          schedulingTeamNotes: schedulingTeamNotes || undefined,
          scheduleNotes: scheduleNotes || undefined,
          scheduleDetails: scheduleDetails || undefined,
          teardownTimeNotes: effectiveTeardownTimeNotes,
          daysOfCollection: daysOfCollection || undefined,
          duration: duration || undefined,
          scheduleOrder,
          setupBefore: setupBeforeVal || undefined,
          teardownAfter: teardownAfterVal,
          priority,
          description: description || "Teardown / Retrieval",
          specialInstructions: specialInstructions || undefined,
          requiredParts: requiredParts || undefined,
          estimatedDurationMin: estMin,
          status: "Scheduled",
          rawRowData: row,
        });
      }
    } else {
      // Standard single-date fallback
      const rawDate = row[mapping.date] || "";
      const date = normalizeDate(rawDate);
      const timeSlot = (row[mapping.timeSlot] || "TBD (08:00 AM - 05:00 PM)").trim();
      const taskCategory = inferTaskCategory(rawTaskCategory, serviceType, jobType, description);

      if (date) detectedDates.add(date);

      orders.push({
        id: `wo-${idx}-${orderNum}`,
        orderNumber: orderNum,
        locationId: rawLocationId || undefined,
        projectNumber: projectNumber || undefined,
        technicianName: techName,
        technicianEmail: techEmail,
        date,
        timeSlot,
        customerName: customer,
        customerPhone: phone,
        customerEmail: custEmail || undefined,
        serviceAddress: address,
        cityState: cityState || undefined,
        countyParish: countyParish || undefined,
        workWeek: workWeek || undefined,
        jobType,
        taskCategory,
        serviceTypeAddOns: serviceTypeAddOns || undefined,
        method,
        isRedo,
        cameraCounts: cameraCounts || undefined,
        backupUnits: backupUnits || undefined,
        schedulingTeamNotes: schedulingTeamNotes || undefined,
        scheduleNotes: scheduleNotes || undefined,
        scheduleDetails: scheduleDetails || undefined,
        teardownTimeNotes: teardownTimeNotes || undefined,
        daysOfCollection: daysOfCollection || undefined,
        duration: duration || undefined,
        scheduleOrder,
        priority,
        description,
        specialInstructions: specialInstructions || undefined,
        requiredParts: requiredParts || undefined,
        estimatedDurationMin: estMin,
        status: "Scheduled",
        rawRowData: row,
      });
    }
  });

  const { detectedWorkWeeks, incomingWorkWeek } = detectScannedWorkWeeks(orders);

  return {
    orders,
    headers,
    mapping,
    detectedDates: Array.from(detectedDates).sort(),
    detectedWorkWeeks,
    incomingWorkWeek,
    technicians: Array.from(technicianSet).sort(),
    warnings,
    rawRows: parsed.data,
  };
}

/**
 * Detects distinct calendar work weeks and identifies the Incoming Work Week
 * when multiple work weeks are scanned in the dataset.
 */
export function detectScannedWorkWeeks(orders: WorkOrder[]): {
  detectedWorkWeeks: DetectedWorkWeek[];
  incomingWorkWeek?: DetectedWorkWeek;
} {
  if (!orders || orders.length === 0) {
    return { detectedWorkWeeks: [] };
  }

  const weekMap = new Map<
    string,
    {
      sundayDateStr: string;
      saturdayDateStr: string;
      formattedRange: string;
      weekNumbers: Set<number>;
      installCount: number;
      totalTaskCount: number;
    }
  >();

  orders.forEach((ord) => {
    const rawDate = ord.date || (ord.setupBefore ? parseDateTimeString(ord.setupBefore)?.date : undefined);
    if (!rawDate) return;

    let baseDate: Date | null = null;
    const parts = rawDate.split("-");
    if (parts.length === 3) {
      baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) baseDate = parsed;
    }
    if (!baseDate || isNaN(baseDate.getTime())) return;

    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(baseDate);
    sunday.setDate(baseDate.getDate() - dayOfWeek);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const formatMMDD = (d: Date) => {
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };

    const sundayFormatted = formatMMDD(sunday);
    const saturdayFormatted = formatMMDD(saturday);
    const sundayStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
    const saturdayStr = `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, "0")}-${String(saturday.getDate()).padStart(2, "0")}`;

    if (!weekMap.has(sundayStr)) {
      weekMap.set(sundayStr, {
        sundayDateStr: sundayStr,
        saturdayDateStr: saturdayStr,
        formattedRange: `${sundayFormatted} - ${saturdayFormatted}`,
        weekNumbers: new Set<number>(),
        installCount: 0,
        totalTaskCount: 0,
      });
    }

    const item = weekMap.get(sundayStr)!;
    item.totalTaskCount += 1;
    if (ord.taskCategory === "Install" || !ord.taskCategory) {
      item.installCount += 1;
    }

    if (ord.workWeek) {
      const numMatch = ord.workWeek.match(/\d+/);
      if (numMatch) {
        item.weekNumbers.add(parseInt(numMatch[0], 10));
      }
    }
  });

  const sortedSundayKeys = Array.from(weekMap.keys()).sort();
  if (sortedSundayKeys.length === 0) {
    return { detectedWorkWeeks: [] };
  }

  const detectedWorkWeeks: DetectedWorkWeek[] = sortedSundayKeys.map((key, index) => {
    const item = weekMap.get(key)!;
    const weekNumArray = Array.from(item.weekNumbers).sort((a, b) => a - b);
    const mainWeekNum = weekNumArray.length > 0 ? weekNumArray[0] : undefined;
    const label = mainWeekNum
      ? `Work Week ${mainWeekNum} (${item.formattedRange})`
      : `Work Week ${item.formattedRange}`;

    const isMultiple = sortedSundayKeys.length > 1;
    const isIncoming = isMultiple ? index === sortedSundayKeys.length - 1 : false;
    const isCurrentOrPrevious = isMultiple ? index < sortedSundayKeys.length - 1 : false;

    return {
      workWeekLabel: label,
      sundayDateStr: item.sundayDateStr,
      saturdayDateStr: item.saturdayDateStr,
      formattedRange: item.formattedRange,
      weekNumber: mainWeekNum,
      isIncoming,
      isCurrentOrPrevious,
      installCount: item.installCount,
      totalTaskCount: item.totalTaskCount,
    };
  });

  // If multiple weeks are scanned, identify incoming (latest) week; if single week, that week is incoming
  const incomingWorkWeek =
    detectedWorkWeeks.find((w) => w.isIncoming) ||
    detectedWorkWeeks[detectedWorkWeeks.length - 1];

  return {
    detectedWorkWeeks,
    incomingWorkWeek,
  };
}
