/**
 * @fileOverview Exam-paper print/PDF builder — the self-contained HTML document a
 * teacher prints (or "Saves as PDF") for an exam paper. Lifted out of the Library
 * gallery so both the Library download and the multi-set download (question-sets
 * dialog) share one builder. Pagination is pure CSS handled by the browser's print
 * engine. Every user-visible label is resolved through the injected `t` so printed
 * output honours the app language (the paper's own content is already translated).
 */
"use client";

type Translate = (key: string) => string;

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHeader(content: any, subtitle?: string): string {
  let html = `<div style="text-align:center;font-size:1.3em;font-weight:bold;">${escapeHtml(content.board)}</div>`;
  html += `<div style="text-align:center;font-size:1.1em;font-weight:bold;margin-bottom:16px;">${escapeHtml(content.gradeLevel)} ${escapeHtml(content.subject)}</div>`;
  if (subtitle) {
    html += `<div style="text-align:center;font-size:1.05em;font-weight:bold;margin-bottom:16px;">${escapeHtml(subtitle)}</div>`;
  }
  return html;
}

// Only called from buildExamPaperBodyHtml, which already requires content.sections
// (it iterates them above), so no sections-guard is needed here.
const getQuestions = (content: any): any[] =>
  content.sections.flatMap((s: any) => s.questions || []);

function formatAnswerKey(content: any, t: Translate, subtitle?: string): string | null {
  const withAnswers = getQuestions(content).filter((q) => q.answerKey || q.answer);
  if (!withAnswers.length) return null;
  let html = formatHeader(content, subtitle ? `${subtitle} · ${t("Answer Key")}` : t("Answer Key"));
  withAnswers.forEach((q) => {
    const number = q.number ?? q.questionNumber;
    html += `<p><strong>${t("Q")}${escapeHtml(number)}:</strong> ${escapeHtml(q.answerKey ?? q.answer)}</p>`;
  });
  return html;
}

function formatMarkingScheme(content: any, t: Translate, subtitle?: string): string | null {
  const withScheme = getQuestions(content).filter((q) => q.markingScheme);
  if (!withScheme.length) return null;
  let html = formatHeader(content, subtitle ? `${subtitle} · ${t("Marking Scheme")}` : t("Marking Scheme"));
  withScheme.forEach((q) => {
    const number = q.number ?? q.questionNumber;
    html += `<p><strong>${t("Q")}${escapeHtml(number)}:</strong> ${escapeHtml(q.markingScheme)}</p>`;
  });
  return html;
}

/**
 * The inner print fragment for ONE paper: header + meta + general instructions +
 * sections + answer key + marking scheme. No `<!DOCTYPE>`/`<style>` shell (see
 * `wrapExamPaperDoc`). `subtitle` prints e.g. "Set B" under the header, and tags the
 * answer key / marking scheme headers so a combined multi-set doc stays legible.
 * Caller guarantees `content.sections` is a non-empty array.
 */
export function buildExamPaperBodyHtml(content: any, t: Translate, subtitle?: string): string {
  let header = formatHeader(content, subtitle);
  header += '<div class="meta">';
  header += `<span>${t("Duration:")} ${escapeHtml(content.duration)}</span>`;
  header += `<span>${t("Maximum Marks:")} ${escapeHtml(content.maxMarks)}</span>`;
  header += '</div>';
  if (content.generalInstructions && Array.isArray(content.generalInstructions) && content.generalInstructions.length) {
    header += `<h3>${t("General Instructions")}</h3><ol>`;
    content.generalInstructions.forEach((inst: string) => {
      header += `<li>${escapeHtml(inst)}</li>`;
    });
    header += '</ol>';
  }

  let sectionsHtml = '';
  content.sections.forEach((section: any, idx: number) => {
    sectionsHtml += `<div class="section${idx === 0 ? ' section-first' : ''}">`;
    sectionsHtml += `<h2 class="section-heading">${escapeHtml(section.name || section.label)}</h2>`;
    // Label + marks share the line below the heading, e.g.
    // "Multiple Choice Questions [20 marks]".
    const subParts: string[] = [];
    if (section.name && section.label) subParts.push(escapeHtml(section.label));
    if (section.totalMarks != null) subParts.push(`[${escapeHtml(section.totalMarks)} ${t("marks")}]`);
    if (subParts.length) {
      sectionsHtml += `<p class="section-marks">${subParts.join(' ')}</p>`;
    }
    if (section.instructions) {
      sectionsHtml += `<p class="section-instructions">${escapeHtml(section.instructions)}</p>`;
    }
    (section.questions || []).forEach((q: any) => {
      const number = q.number ?? q.questionNumber;
      sectionsHtml += `<div class="question"><p><strong>${t("Q")}${escapeHtml(number)}.</strong> ${escapeHtml(q.text || '')} <span class="marks">[${escapeHtml(q.marks)}${t("m")}]</span></p>`;
      if (q.options && Array.isArray(q.options) && q.options.length) {
        sectionsHtml += '<div class="options">';
        q.options.forEach((opt: string) => {
          // Options already carry their own (a)/(b)/(c)/(d) prefix
          // (see exam-paper-generator.ts schema + fixtures).
          sectionsHtml += `<p>${escapeHtml(opt)}</p>`;
        });
        sectionsHtml += '</div>';
      }
      sectionsHtml += '</div>';
    });
    sectionsHtml += '</div>';
  });

  const answerKey = formatAnswerKey(content, t, subtitle);
  const markingScheme = formatMarkingScheme(content, t, subtitle);

  return `${header}${sectionsHtml}`
    + (answerKey ? `<div class="answer-key">${answerKey}</div>` : '')
    + (markingScheme ? `<div class="marking-scheme">${markingScheme}</div>` : '');
}

/**
 * Wrap one or more paper bodies in a printable document. The browser's print engine
 * paginates from the inline CSS: section A starts on a fresh page after the
 * instructions, questions never split across a page, and each answer key / marking
 * scheme starts on its own page. For a multi-set document, each body is wrapped in a
 * `.exam-set` div so every set after the first starts on a new page.
 */
export function wrapExamPaperDoc(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  @media print { @page { margin: 15mm; } body { max-width: none; margin: 0; padding: 0; } }
  body { font-family: Arial, sans-serif; color: #000; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; }
  h3 { margin: 1em 0 0.3em; }
  ol { margin: 0 0 1em; padding-left: 1.5em; }
  .meta { display: flex; justify-content: space-between; margin: 8px 0 16px; font-weight: bold; }
  .exam-set + .exam-set { page-break-before: always; }
  .section-first { page-break-before: always; }
  .section-heading { text-align: center; font-weight: bold; margin: 1.4em 0 0.2em; }
  .section-marks { text-align: center; font-weight: normal; margin: 0 0 0.4em; }
  .section-instructions { text-align: center; font-style: italic; margin: 0 0 0.8em; }
  .question { page-break-inside: avoid; margin-bottom: 0.5em; }
  .options { margin-left: 24px; }
  .answer-key, .marking-scheme { page-break-before: always; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Open a self-contained HTML string in a new tab and auto-trigger the browser's print
 * dialog (teacher picks "Save as PDF"). Falls back to a direct `.html` download when
 * the popup is blocked, invoking `onPopupBlocked` so the caller can toast.
 */
export function openPrintBlob(html: string, cleanTitle: string, onPopupBlocked?: () => void): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.addEventListener('load', () => {
      try {
        printWindow.print();
      } catch {
        // print() can be blocked in some sandbox modes; the tab still shows the
        // content so the user can hit Ctrl/Cmd+P.
      }
    });
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = `SahayakAI_${cleanTitle}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onPopupBlocked?.();
  }
}
