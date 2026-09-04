import { getStoredInitialEmailLinks } from "./generatedEmailStorage";

export interface TechnicianDirectoryEntry {
  name: string;
  aliases: string[];
  airtableLink: string;
}

export const HARDCODED_TECHNICIAN_ROSTER: TechnicianDirectoryEntry[] = [
  {
    name: "Shaw, Tyler",
    aliases: ["Tyler Shaw", "Shaw, Tyler", "Tyler, Shaw", "Shaw Tyler", "Tyler", "Shaw"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrCnXFZVq9IbGQu6",
  },
  {
    name: "Fullerton, Dustin",
    aliases: ["Dustin Fullerton", "Fullerton, Dustin", "Dustin, Fullerton", "Fullerton Dustin", "Dustin"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shr3RwuPr5kc1bkR0",
  },
  {
    name: "Justin Windecker",
    aliases: ["Justin Windecker", "Windecker, Justin", "Justin, Windecker", "Windecker Justin", "Windecker"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrxnA693nRfqoosU",
  },
  {
    name: "Rafeedie, Richard",
    aliases: ["Richard Rafeedie", "Rafeedie, Richard", "Richard, Rafeedie", "Rafeedie Richard", "Rafeedie"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrS3BOklH5x3yjMq",
  },
  {
    name: "Thomas, Doug",
    aliases: ["Doug Thomas", "Thomas, Doug", "Doug, Thomas", "Thomas Doug", "Doug"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrqH8nTC4bSkKM6G",
  },
  {
    name: "May, Dustyn",
    aliases: ["Dustyn May", "May, Dustyn", "Dustyn, May", "May Dustyn"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrsXtX5sVqAVn0Q5",
  },
  {
    name: "Juan Espinoza",
    aliases: ["Juan Espinoza", "Espinoza, Juan", "Juan, Espinoza", "Espinoza Juan"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrO49LfwUnwovSLh",
  },
  {
    name: "Gilliam Johns",
    aliases: ["Gilliam Johns", "Johns, Gilliam", "Gilliam, Johns", "Johns Gilliam", "Gilliam"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrDkuNGfxv113CHy",
  },
  {
    name: "Timothy Addison",
    aliases: ["Timothy Addison", "Addison, Timothy", "Timothy, Addison", "Addison Timothy", "Tim Addison", "Addison, Tim"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrrfSAH8tl1ElLnX",
  },
  {
    name: "Eduardo Lara",
    aliases: ["Eduardo Lara", "Lara, Eduardo", "Eduardo, Lara", "Lara Eduardo", "Eduardo"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shr1KfYiatpFz2pep/tblr3T3GCLPM1hYo5",
  },
  {
    name: "Carlos Coreas",
    aliases: ["Carlos Coreas", "Coreas, Carlos", "Carlos, Coreas", "Coreas Carlos"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shr4r3BEIBY8zKRlQ",
  },
  {
    name: "Anthony Oliphant",
    aliases: ["Anthony Oliphant", "Oliphant, Anthony", "Anthony, Oliphant", "Oliphant Anthony", "Anthony"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrk91Lyp3JijoL39",
  },
  {
    name: "Jhonathan White",
    aliases: ["Jhonathan White", "White, Jhonathan", "Jhonathan, White", "White Jhonathan", "Jonathan White", "White, Jonathan"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrnPzVljJ7kG7kp6",
  },
  {
    name: "Gavin Adams",
    aliases: ["Gavin Adams", "Adams, Gavin", "Gavin, Adams", "Adams Gavin", "Gavin"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrckOWb1L4Q4rMbs",
  },
  {
    name: "Diego Coreas",
    aliases: ["Diego Coreas", "Coreas, Diego", "Diego, Coreas", "Coreas Diego"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shroy91I1ErxGU8g1",
  },
  {
    name: "Koda Costello",
    aliases: ["Koda Costello", "Costello, Koda", "Koda, Costello", "Costello Koda", "Koda"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shraAP7j7Oc7xzRlu",
  },
  {
    name: "Julian Chihuahua",
    aliases: ["Julian Chihuahua", "Chihuahua, Julian", "Julian, Chihuahua", "Chihuahua Julian", "Julian"],
    airtableLink: "https://airtable.com/appvNeYuPd12aTmxS/shrGbAmC3YHmPDIyD",
  },
];

/**
 * Cleans a technician name formatting (e.g., "Fullerton, Dustin" -> "Dustin Fullerton")
 */
export function cleanTechnicianName(str: string): string {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[1]} ${parts[0]}`;
    }
  }
  return trimmed;
}

/**
 * Normalizes a technician name for fuzzy key lookup (lowercased, stripped of non-alphanumeric except spaces)
 */
function cleanName(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Finds the custom Airtable Link for any technician.
 * Handles variations like "Last, First", "First Last", partial matches, and case insensitivity.
 */
export function getTechnicianAirtableLink(
  technicianName: string,
  fallbackBaseUrl?: string,
  customOverrides?: Record<string, string>,
  workWeek?: string
): string {
  if (!technicianName) {
    return fallbackBaseUrl || "https://airtable.com";
  }

  const rawTrimmed = technicianName.trim();
  const cleaned = cleanName(rawTrimmed);

  // 1. Check custom overrides from settings if provided
  if (customOverrides) {
    for (const [key, link] of Object.entries(customOverrides)) {
      if (link && (cleanName(key) === cleaned || key.toLowerCase() === rawTrimmed.toLowerCase())) {
        return link;
      }
    }
  }

  // 2. Auto-embed link from stored initial email history if workWeek is provided
  if (workWeek && typeof window !== "undefined") {
    try {
      const stored = getStoredInitialEmailLinks(technicianName, workWeek);
      if (stored.airtableUrl && stored.airtableUrl.trim()) {
        return stored.airtableUrl.trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. Exact or Alias matching against hardcoded roster
  for (const tech of HARDCODED_TECHNICIAN_ROSTER) {
    // Check canonical name
    if (cleanName(tech.name) === cleaned) {
      return tech.airtableLink;
    }

    // Check all configured aliases
    for (const alias of tech.aliases) {
      if (cleanName(alias) === cleaned) {
        return tech.airtableLink;
      }
    }
  }

  // 4. Permutation matching (e.g. if input is "Coreas, Carlos" vs "Carlos Coreas")
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length >= 2) {
    const reversed = [...words].reverse().join(" ");
    for (const tech of HARDCODED_TECHNICIAN_ROSTER) {
      for (const alias of tech.aliases) {
        const aliasClean = cleanName(alias);
        if (aliasClean === reversed) {
          return tech.airtableLink;
        }
      }
    }
  }

  // 5. Fallback URL if technician is not in the hardcoded roster
  if (fallbackBaseUrl && fallbackBaseUrl.trim()) {
    const base = fallbackBaseUrl.trim().replace(/\/+$/, "");
    if (base.includes("?")) {
      return `${base}&tech=${encodeURIComponent(rawTrimmed)}`;
    }
    return `${base}?tech=${encodeURIComponent(rawTrimmed)}`;
  }

  return `https://airtable.com/appSearch?tech=${encodeURIComponent(rawTrimmed)}`;
}

/**
 * Resolves the Google Maps routing URL for a technician.
 * Supports direct user custom link, auto-embedding from stored initial email history, custom technician overrides, or default map query.
 */
export function getTechnicianGoogleMapsLink(
  rawTechnicianName: string,
  customDirectUrl?: string,
  customOverrides?: Record<string, string>,
  fallbackBaseUrl?: string,
  workWeek?: string
): string {
  // 1. Direct custom URL passed for active email if present
  if (customDirectUrl && customDirectUrl.trim()) {
    return customDirectUrl.trim();
  }

  const rawTrimmed = (rawTechnicianName || "").trim();
  const cleaned = cleanName(rawTrimmed);

  // 2. Check custom overrides by technician name
  if (customOverrides) {
    for (const [key, link] of Object.entries(customOverrides)) {
      if (link && link.trim() && (cleanName(key) === cleaned || key.toLowerCase() === rawTrimmed.toLowerCase())) {
        return link.trim();
      }
    }
  }

  // 3. Auto-embed link from stored initial email history if workWeek is provided
  if (workWeek && typeof window !== "undefined") {
    try {
      const stored = getStoredInitialEmailLinks(rawTechnicianName, workWeek);
      if (stored.googleMapsUrl && stored.googleMapsUrl.trim()) {
        return stored.googleMapsUrl.trim();
      }
    } catch {
      // ignore
    }
  }

  // 4. Check fallback base URL
  if (fallbackBaseUrl && fallbackBaseUrl.trim()) {
    const base = fallbackBaseUrl.trim();
    if (base.includes("maps")) {
      return `${base.replace(/\/+$/, "")}/search/${encodeURIComponent(cleanTechnicianName(rawTechnicianName) + " route")}`;
    }
    return base;
  }

  // 5. Default Google Maps query URL
  return `https://maps.google.com/?q=${encodeURIComponent(cleanTechnicianName(rawTechnicianName))}`;
}
