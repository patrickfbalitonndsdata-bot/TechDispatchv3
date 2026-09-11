import { EmailSignatureDetails, EmailSignaturePresetId, TemplateBranding } from "../types";

export const EMAIL_SIGNATURE_PRESETS: Record<"james" | "kyle" | "patrick" | "katrin", EmailSignatureDetails> = {
  james: {
    id: "james",
    label: "James",
    greeting: "Kind regards,",
    name: "James Laciste",
    title: "Auditor – Scheduling",
    company: "NDS – National Data & Surveying Services",
    officeLabel: "Corporate Office:",
    address: "810 S. Atlantic Blvd, Suite A, Monterey Park CA 91754",
    website: "",
    tagline: "Celebrating 35+ Years of Excellence!",
  },
  kyle: {
    id: "kyle",
    label: "Kyle",
    greeting: "Kind regards,",
    name: "Crislie Busayong",
    title: "South Central Scheduling Specialist (AL/AR/CO/KS/LA/MS/NE/NM/OK/TX/WY)",
    company: "NDS – National Data & Surveying Services",
    officeLabel: "Corporate Office:",
    address: "810 S. Atlantic Blvd, Suite A, Monterey Park CA 91754",
    website: "www.ndsdata.com",
    tagline: "Celebrating 35+ Years of Excellence!",
  },
  patrick: {
    id: "patrick",
    label: "Patrick",
    greeting: "Thank you,",
    name: "Patrick Franz Baliton",
    title: "Scheduling Specialist (South Central Region)",
    company: "NDS – National Data & Surveying Services",
    officeLabel: "Corporate Office:",
    address: "810 S. Atlantic Blvd, Suite A, Monterey Park CA 91754",
    website: "www.ndsdata.com",
    tagline: "Celebrating 35+ Years of Excellence!",
  },
  katrin: {
    id: "katrin",
    label: "Katrin",
    greeting: "Kind regards,",
    name: "Katrin Pasucal",
    title: "Scheduling Specialist",
    company: "NDS – National Data & Surveying Services",
    officeLabel: "Corporate Office:",
    address: "810 S. Atlantic Blvd, Suite A, Monterey Park CA 91754",
    website: "www.ndsdata.com",
    tagline: "Celebrating 35+ Years of Excellence!",
  },
};

export const SIGNATURE_PRESET_OPTIONS: Array<{ id: "james" | "kyle" | "patrick" | "katrin"; label: string; desc: string }> = [
  { id: "patrick", label: "Patrick", desc: "Patrick Franz Baliton – Scheduling Specialist" },
  { id: "james", label: "James", desc: "James Laciste – Auditor – Scheduling" },
  { id: "kyle", label: "Kyle", desc: "Crislie Busayong – South Central Scheduling Specialist" },
  { id: "katrin", label: "Katrin", desc: "Katrin Pasucal – Scheduling Specialist" },
];

/**
 * Returns the effective signature based on branding configuration.
 */
export function getEffectiveSignature(branding: TemplateBranding): EmailSignatureDetails {
  const presetKey = (branding.emailSignaturePreset || "patrick") as EmailSignaturePresetId;
  const base =
    presetKey in EMAIL_SIGNATURE_PRESETS
      ? EMAIL_SIGNATURE_PRESETS[presetKey as keyof typeof EMAIL_SIGNATURE_PRESETS]
      : EMAIL_SIGNATURE_PRESETS.patrick;

  if (branding.customEmailSignature) {
    return {
      ...base,
      ...branding.customEmailSignature,
      id: presetKey,
      label: branding.customEmailSignature.label || base.label,
    };
  }

  return base;
}

/**
 * Generates exact HTML matching the requested Outlook signature typography, font sizes, weights, and colors.
 */
export function renderEmailSignatureHtml(signature: EmailSignatureDetails): string {
  const websiteHtml = signature.website
    ? `<p style="margin: 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; mso-ansi-font-size: 10.0pt; line-height: 1.4; mso-line-height-rule: exactly;"><a href="https://${signature.website.replace(/^https?:\/\//, "")}" target="_blank" style="color: #595959; text-decoration: underline;">${signature.website}</a></p>`
    : "";

  return `
    <!-- Email Signature -->
    <div style="margin-top: 24px; font-family: Calibri, 'Segoe UI', Arial, sans-serif; line-height: 1.4; mso-line-height-rule: exactly; text-align: left;">
      <p style="margin: 0 0 16px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; mso-ansi-font-size: 11.0pt; color: #000000; line-height: 1.4; mso-line-height-rule: exactly;">
        ${signature.greeting}
      </p>
      <p style="margin: 0 0 2px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; mso-ansi-font-size: 11.5pt; font-weight: bold; font-style: italic; color: #1E293B; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.name}
      </p>
      <p style="margin: 0 0 2px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10.5pt; mso-ansi-font-size: 10.5pt; font-weight: bold; font-style: italic; color: #1F4E79; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.title}
      </p>
      <p style="margin: 0 0 4px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; mso-ansi-font-size: 11.5pt; font-weight: bold; color: #1F4E79; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.company}
      </p>
      <p style="margin: 0 0 1px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9pt; mso-ansi-font-size: 9.0pt; font-weight: bold; color: #595959; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.officeLabel || "Corporate Office:"}
      </p>
      <p style="margin: 0 0 1px 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt; mso-ansi-font-size: 10.0pt; color: #595959; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.address}
      </p>
      ${websiteHtml}
      <p style="margin: 14px 0 0 0; padding: 0; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 12pt; mso-ansi-font-size: 12.0pt; font-weight: bold; color: #1F4E79; line-height: 1.3; mso-line-height-rule: exactly;">
        ${signature.tagline}
      </p>
    </div>`;
}

/**
 * Generates plain text email signature.
 */
export function renderEmailSignatureText(signature: EmailSignatureDetails): string {
  const lines: string[] = [];
  lines.push(signature.greeting);
  lines.push("");
  lines.push(signature.name);
  lines.push(signature.title);
  lines.push(signature.company);
  lines.push(signature.officeLabel || "Corporate Office:");
  lines.push(signature.address);
  if (signature.website) {
    lines.push(signature.website);
  }
  lines.push("");
  lines.push(signature.tagline);
  return lines.join("\n");
}
