export type PriorityLevel = "Urgent" | "High" | "Normal" | "Low";

export interface WorkOrder {
  id: string;
  orderNumber: string;
  locationId?: string; // Location ID e.g. "26-999999-001"
  projectNumber?: string; // Parsed Project Number e.g. "26-999999" (without -001)
  technicianName: string;
  technicianEmail: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "08:00 AM - 10:00 AM" or "09:00"
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceAddress: string;
  cityState?: string; // e.g. "Dallas, TX"
  countyParish?: string; // e.g. "Vermilion Parish" or from "Different County (from Locations)"
  workWeek?: string; // e.g. "Work Week 32" or "32"
  jobType: string; // Service Type e.g. "TMC", "Miovision"
  taskCategory?: "Install" | "Teardown" | "BatterySwap"; // Install, Teardown, or SD Card & Battery Swap
  serviceTypeAddOns?: string; // Service Type Add Ons (from Project ID) (from Locations)
  method?: string; // Method column e.g. "ATR", "Miovision", "Machine"
  isRedo?: boolean; // Redo column checked status
  cameraCounts?: string; // Camera Counts e.g. "2 cameras" or "0 cameras"
  backupUnits?: string; // Backup Units column e.g. "1 backup" or "1"
  schedulingTeamNotes?: string; // Scheduling Team Notes e.g. "(City of Dallas - List 104)"
  scheduleNotes?: string; // Schedule Notes (Location specific notes) e.g. "East corner pole", "Also collecting data for..."
  scheduleDetails?: string; // Schedule Details e.g. "1 Day: Tue/Wed/Thu = TBD", "24-hr"
  teardownTimeNotes?: string; // Teardown Time Notes e.g. "Anytime"
  daysOfCollection?: string; // Days of collection e.g. "3-day"
  duration?: string; // Time Duration e.g. "TBD hours", "4 hours", "24-hr" from Duration column
  setupBefore?: string; // Setup Before timestamp from CSV e.g. "08/27/2026 08:00"
  teardownAfter?: string; // Teardown After timestamp from CSV e.g. "08/29/2026 17:00"
  scheduleOrder?: number | string; // Sequence / order from "Schedule Order" column
  batteryCheckDates?: string[]; // Battery Change/Equipment Check 1..N dates
  priority: PriorityLevel;
  description: string;
  specialInstructions?: string;
  requiredParts?: string;
  estimatedDurationMin?: number;
  status?: "Scheduled" | "In Progress" | "Completed" | "Pending Parts";
  rawRowData?: Record<string, string>;
}

export interface ColumnMapping {
  orderNumber: string;
  locationId: string;
  serviceType: string;
  serviceTypeAddOns: string;
  method: string;
  redo: string;
  cityState: string;
  countyParish: string;
  workWeek: string;
  cameraCounts: string;
  backupUnits: string;
  schedulingTeamNotes: string;
  scheduleNotes: string;
  scheduleDetails: string;
  taskCategory: string;
  teardownTimeNotes: string;
  daysOfCollection: string;
  setupBefore: string;
  teardownAfter: string;
  scheduleOrder: string;
  batteryCheckPrefix: string;
  technicianName: string;
  technicianEmail: string;
  date: string;
  timeSlot: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceAddress: string;
  jobType: string;
  priority: string;
  description: string;
  specialInstructions: string;
  requiredParts: string;
  estimatedDurationMin: string;
}

export interface AIBriefing {
  briefing: string;
  keyHighlights: string[];
  safetyAlert: string;
  suggestedRouteTip?: string;
}

export interface TechnicianRoster {
  technicianName: string;
  technicianEmail: string;
  date: string;
  orders: WorkOrder[];
  totalEstimatedMinutes: number;
  urgentCount: number;
  highCount: number;
  normalCount: number;
  aiBriefing?: AIBriefing;
  customDispatcherNote?: string;
}

export type TemplateStyle = "exact_nds_template" | "modern_executive" | "field_cards" | "compact_table" | "safety_priority";

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  base64Data?: string;
  lastModified?: number;
}

export interface PedsConductLineItem {
  id: string;
  day: string; // e.g. "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday_Lower"
  projectNumber: string; // e.g. "26-470285"
  listNumber: string; // e.g. "105"
  cityText?: string; // e.g. "City of Dallas" (default: "City of Dallas")
  customText?: string; // optional custom full line override
  orderIndex?: number; // relative sorting index within the day's tasks
}

export interface TemplateBranding {
  companyName: string;
  dispatcherName: string;
  dispatcherTitle: string;
  replyToEmail: string;
  supportPhone: string;
  primaryColor: string; // Hex e.g. #0078D4 (Outlook Blue)
  accentColor: string; // Hex
  includeMapLinks: boolean;
  includeChecklist: boolean;
  customDisclaimer: string;
  greetingPrefix: string;
  emergencyHotline?: string;
  // Specific fields for the exact Outlook template
  photoUploadLinkText?: string;
  photoUploadUrl?: string;
  airtableBaseUrl?: string;
  googleMapsBaseUrl?: string;
  googleMapsUrl?: string;
  customTechGoogleMapsLinks?: Record<string, string>;
  privateJobsNotice?: string;
  dataUploadEmail?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  useAnytimeTeardowns?: boolean;
  ladotdExclusive?: boolean;
  // COD Exclusive Feature (City of Dallas - List keyword replacement and grouped teardowns)
  codExclusive?: boolean;
  // COD Sight Distance Location Selection per project number (e.g. { "26-470285": ["001", "002"] })
  codSightDistanceLocations?: Record<string, string[]>;
  // COD School Zone PED Count Site Data Form link
  codSchoolZonePedFormEnabled?: boolean;
  codSchoolZonePedFormUrl?: string;
  codSchoolZonePedFormText?: string;
  // Email Updates Feature
  emailUpdatesEnabled?: boolean;
  updateVersion?: number | string;
  updateNotes?: string;
  previousUpdateNotes?: Array<{ version: number | string; notes: string; text?: string }>;
  // Additional Notes Feature (Green Bold Italic notes per day)
  additionalNotesEnabled?: boolean;
  additionalNotes?: Array<{ id: string; day: string; text: string }>;
  // Sunday - Sunday Email Feature (Upper Sunday and Lower Sunday with dates)
  sundaySundayEnabled?: boolean;
  // Overlapping Schedules Feature (Read overlapping Battery Swaps, Teardowns from previous week and combine)
  overlappingSchedulesEnabled?: boolean;
  // Conduct Study Feature (Radar, Parking, etc. formatted as Conduct <Study>: <Project Number> <City, State> (<Time Duration>))
  conductStudyEnabled?: boolean;
  // PEDS Conduct Sight Distance Lines (Movable between Install/Teardown/Battery Swap lines)
  pedsConductLines?: PedsConductLineItem[];
  // Day Schedule Item Custom Ordering Overrides: dayKey -> list of item IDs in desired order
  dayItemOrderOverrides?: Record<string, string[]>;
  // Custom Technician Airtable Links
  customTechAirtableLinks?: Record<string, string>;
  // Email Attachments (.pdf, .kmz, .kml, .csv, etc.)
  attachments?: EmailAttachment[];
}

export interface AutomationConfig {
  enabled: boolean;
  dailyTime: string; // e.g. "07:00" (24h)
  targetStrategy: "today" | "tomorrow" | "upcoming_48h" | "all";
  sendMode: "simulation" | "webhook" | "smtp";
  webhookUrl: string;
  autoExportZip: boolean;
  lastRunTime: string | null;
  nextRunTime: string | null;
  recipientFilter: "all" | "active_only";
  smtpConfig?: {
    host: string;
    port: number;
    user: string;
    secure: boolean;
  };
}

export interface DispatchLogRecord {
  id: string;
  timestamp: string;
  technicianName: string;
  technicianEmail: string;
  date: string;
  jobCount: number;
  status: "Delivered" | "Pending" | "Failed" | "Exported";
  method: "Outlook EML" | "Outlook Web" | "Daily Scheduler" | "Batch ZIP" | "Mailto" | "Clipboard";
  previewSubject: string;
  previewBodyHtml?: string;
  notes?: string;
}

export interface ParseResult {
  orders: WorkOrder[];
  headers: string[];
  mapping: ColumnMapping;
  detectedDates: string[];
  technicians: string[];
  warnings: string[];
  rawRows: Record<string, string>[];
}
