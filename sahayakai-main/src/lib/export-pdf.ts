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
}

export interface ExportPdfResult {
    ok: boolean;
    error?: string;
}

export async function exportElementToPdf({
    elementId,
    filename,
    hideSelector = ".no-print",
}: ExportPdfOptions): Promise<ExportPdfResult> {
    const element = document.getElementById(elementId);
    if (!element) return { ok: false, error: "Element not found" };

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
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
