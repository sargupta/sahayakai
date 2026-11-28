/**
 * Shared PDF export utility.
 * Replaces the 6 near-duplicate handleDownloadPDF implementations across
 * display components. See outputs/ux_review_2026_04_21/DISPLAY_CONSISTENCY_AUDIT.md
 * section 2 "Duplicate PDF Download Logic".
 */

export interface ExportPdfOptions {
    elementId: string;
    filename: string;
    hideSelector?: string;
    /**
     * Footer line stamped on every page. Leave undefined (the default) to use
     * the server-resolved access-gate watermark; pass `null` to force none
     * (tests) or a string to override.
     */
    watermark?: string | null;
}

export interface ExportPdfResult {
    ok: boolean;
    error?: string;
}

// ── Access-gate watermark (docs/ACCESS_GATE_DESIGN.md) ──────────────────────
// Every teacher-facing PDF goes through this module, so the watermark is
// applied here once instead of in each of the display components.

const WATERMARK_TTL_MS = 5 * 60 * 1000;
let _watermarkCache: { value: string | null; expiresAt: number } | null = null;

/**
 * Ask the server which footer line (if any) this account's exports carry.
 * The text is derived server-side from verified token claims, so the client
 * only renders it. Returns null for accounts with no watermark and on any
 * failure: a network error must never block a teacher's download.
 */
export async function fetchExportWatermark(): Promise<string | null> {
    if (_watermarkCache && Date.now() < _watermarkCache.expiresAt) return _watermarkCache.value;
    try {
        const res = await fetch("/api/access/watermark", { credentials: "same-origin" });
        if (!res.ok) return null;
        const data: unknown = await res.json();
        const raw = (data as { watermark?: unknown } | null)?.watermark;
        const value = typeof raw === "string" && raw.length > 0 ? raw : null;
        _watermarkCache = { value, expiresAt: Date.now() + WATERMARK_TTL_MS };
        return value;
    } catch {
        return null;
    }
}

/** Test hook: forget the cached watermark. */
export function resetExportWatermarkCache(): void {
    _watermarkCache = null;
}

/**
 * jsPDF's built-in Helvetica only covers WinAnsi (Latin-1). A school name in
 * an Indic script would render as mojibake, so anything outside Latin-1 is
 * dropped from the footer; the email and date always survive.
 */
export function toPdfSafeText(text: string): string {
    return text
        .replace(/\u2026/g, "...")
        .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
        .replace(/\s+/g, " ")
        .replace(/(\s\u00B7){2,}/g, " \u00B7")
        .trim();
}

interface FooterCapablePdf {
    getNumberOfPages(): number;
    setPage(page: number): unknown;
    setFillColor(r: number, g: number, b: number): unknown;
    rect(x: number, y: number, w: number, h: number, style: string): unknown;
    setFont(fontName: string, fontStyle: string): unknown;
    setFontSize(size: number): unknown;
    setTextColor(r: number, g: number, b: number): unknown;
    text(text: string, x: number, y: number, options?: { align?: "center"; maxWidth?: number }): unknown;
}

/** Stamp `text` as a centred footer band on every page of an A4 portrait PDF. */
export function stampPdfFooter(pdf: FooterCapablePdf, text: string): void {
    const safe = toPdfSafeText(text);
    if (!safe) return;
    const pageWidth = 210;
    const pageHeight = 297;
    const bandHeight = 6;
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
        pdf.setPage(page);
        // Opaque band so the line stays legible over the page image.
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pageHeight - bandHeight, pageWidth, bandHeight, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(110, 110, 110);
        pdf.text(safe, pageWidth / 2, pageHeight - 2, { align: "center", maxWidth: pageWidth - 16 });
    }
}

export async function exportElementToPdf({
    elementId,
    filename,
    hideSelector = ".no-print",
    watermark,
}: ExportPdfOptions): Promise<ExportPdfResult> {
    const element = document.getElementById(elementId);
    if (!element) return { ok: false, error: "Element not found" };

    const footer = watermark === undefined ? await fetchExportWatermark() : watermark;

    // jspdf v4 removed the reliable default export from the ESM build; the
    // named `jsPDF` export is stable across v2–v4.
    const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
    ]);

    const hideNodes = Array.from(
        element.querySelectorAll<HTMLElement>(hideSelector),
    );
    const prevDisplay = hideNodes.map((n) => n.style.display);
    hideNodes.forEach((n) => (n.style.display = "none"));

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight <= pageHeight) {
            pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        } else {
            let heightLeft = imgHeight;
            let position = 0;
            pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
        }

        if (footer) stampPdfFooter(pdf, footer);

        pdf.save(sanitizeFilename(filename));
        return { ok: true };
    } catch (err) {
        return {
            ok: false,
            error: err instanceof Error ? err.message : "PDF generation failed",
        };
    } finally {
        hideNodes.forEach((n, i) => (n.style.display = prevDisplay[i]));
    }
}

function sanitizeFilename(name: string): string {
    const stripped = name.replace(/[^a-z0-9_\-\.]/gi, "_");
    return stripped.endsWith(".pdf") ? stripped : `${stripped}.pdf`;
}
