/**
 * @fileOverview Reads a generated worksheet's Markdown back into its parts so
 * the worksheet can be laid out as a printed sheet (title block, objectives,
 * instructions, numbered activities with answer space, answer key on its own
 * page) instead of one long prose column.
 *
 * The input is what `renderWorksheetMarkdown` (src/ai/flows/worksheet-markdown.ts)
 * writes — the only shape the worksheet flow produces:
 *
 *   # Title
 *   **Class**: X | **Subject**: Y
 *   ## I. Learning Objectives      (bullets)
 *   ## II. Student Instructions    (prose)
 *   ## III. Activities             (### Activity N blocks, each ending in *note*)
 *   ## IV. Answer Key              (**Activity N**: answer lines)
 *
 * Section words are matched by their roman numeral, not their English text,
 * so a worksheet whose headings were translated still parses. Anything that
 * does not have an activities section returns null and the caller renders the
 * Markdown as-is — older saved worksheets keep working.
 */

export type AnswerSpace = "none" | "short" | "long";

export interface WorksheetActivity {
    /** The activity number as written in its heading (1-based). */
    number: number;
    /** Markdown body of the activity (question, table, options, blanks…). */
    content: string;
    /** The italic teaching note that closes the activity, without the asterisks. */
    note?: string;
    /** Writing room the printed sheet leaves under the activity. */
    answerSpace: AnswerSpace;
}

export interface WorksheetStructure {
    title: string;
    /** "Class: Class 5" style pairs from the line under the title. */
    meta: { label: string; value: string }[];
    objectives: string[];
    instructions: string;
    activities: WorksheetActivity[];
    answers: { number: number; text: string }[];
}

const SECTION_RE = /^##\s+(I{1,3}|IV)\.\s*(.*)$/;
const ACTIVITY_RE = /^###\s+.*?(\d+)\s*$/;

/**
 * How much writing room an activity needs on paper. An activity that already
 * carries its own answer place (blanks, a table, lettered options) gets none;
 * one asking the student to explain or write gets a long block; anything else
 * gets a few lines.
 */
export function answerSpaceFor(content: string): AnswerSpace {
    if (/_{3,}/.test(content)) return "none";
    if (/^\s*\|.*\|\s*$/m.test(content)) return "none";
    if (/^\s*(?:[-*]\s+)?\(?[a-dA-D][.)]\s+\S/m.test(content)) return "none";
    if (/\b(explain|describe|write|why|story|paragraph|essay|draw|compare|justify|discuss)\b/i.test(content)) return "long";
    return "short";
}

function splitNote(body: string): { content: string; note?: string } {
    const trimmed = body.replace(/\n-{3,}\s*$/, "").trim();
    const paragraphs = trimmed.split(/\n\s*\n/);
    const last = paragraphs[paragraphs.length - 1]?.trim() ?? "";
    // A single-asterisk italic paragraph (not **bold**) is the activity's note.
    const m = last.match(/^\*(?!\*)([\s\S]+?)\*$/);
    if (m && paragraphs.length > 1) {
        return { content: paragraphs.slice(0, -1).join("\n\n").trim(), note: m[1].trim() };
    }
    return { content: trimmed };
}

export function parseWorksheetMarkdown(markdown: string): WorksheetStructure | null {
    if (!markdown || typeof markdown !== "string") return null;
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");

    let title = "";
    const meta: WorksheetStructure["meta"] = [];
    const buckets: Record<string, string[]> = { I: [], II: [], III: [], IV: [] };
    let current: string | null = null;

    for (const line of lines) {
        const h1 = !title && line.match(/^#\s+(.+)$/);
        if (h1) {
            title = h1[1].trim();
            continue;
        }
        const section = line.match(SECTION_RE);
        if (section) {
            current = section[1];
            continue;
        }
        if (current) {
            buckets[current].push(line);
            continue;
        }
        // Before the first section: the "**Class**: X | **Subject**: Y" line.
        if (/\*\*[^*]+\*\*\s*:/.test(line)) {
            for (const part of line.split("|")) {
                const m = part.match(/\*\*([^*]+)\*\*\s*:\s*(.*)$/);
                if (m && m[2].trim()) meta.push({ label: m[1].trim(), value: m[2].trim() });
            }
        }
    }

    const activities: WorksheetActivity[] = [];
    let block: { number: number; lines: string[] } | null = null;
    const flush = () => {
        if (!block) return;
        const { content, note } = splitNote(block.lines.join("\n"));
        if (content || note) {
            activities.push({ number: block.number, content, note, answerSpace: answerSpaceFor(content) });
        }
    };
    for (const line of buckets.III) {
        const m = line.match(ACTIVITY_RE);
        if (m) {
            flush();
            block = { number: Number(m[1]), lines: [] };
        } else if (block) {
            block.lines.push(line);
        }
    }
    flush();
    if (!activities.length) return null;

    const objectives = buckets.I
        .map((l) => l.match(/^\s*[-*]\s+(.+)$/)?.[1]?.trim())
        .filter((o): o is string => !!o);

    const instructions = buckets.II.join("\n").replace(/\n-{3,}\s*$/, "").trim();

    const answers = buckets.IV.flatMap((l) => {
        const m = l.match(/^\s*\*\*[^*]*?(\d+)\*\*\s*:\s*(.+)$/);
        return m ? [{ number: Number(m[1]), text: m[2].trim() }] : [];
    });

    return { title, meta, objectives, instructions, activities, answers };
}

export type SheetBlock =
    | { kind: "markdown"; text: string }
    | { kind: "table"; header: string[]; rows: string[][] };

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_RULE_RE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/**
 * Split an activity's Markdown into prose and pipe tables. The app renders
 * Markdown without GFM, so a `| a | b |` table would print as raw pipes;
 * tables come back as rows to draw as a real ruled table. In the prose, a
 * single newline becomes a hard break, so lettered options and numbered
 * blanks the model puts one per line stay one per line on paper.
 */
export function splitSheetBlocks(markdown: string): SheetBlock[] {
    const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
    const blocks: SheetBlock[] = [];
    let prose: string[] = [];
    const flushProse = () => {
        const text = prose
            .join("\n")
            // Hard-break single newlines between two non-blank, non-list lines.
            .replace(/([^\n])\n(?=[^\n])(?!\s*(?:[-*+]|\d+[.)])\s)/g, "$1  \n")
            .trim();
        if (text) blocks.push({ kind: "markdown", text });
        prose = [];
    };
    for (let i = 0; i < lines.length; i++) {
        if (TABLE_ROW_RE.test(lines[i]) && i + 1 < lines.length && TABLE_RULE_RE.test(lines[i + 1])) {
            flushProse();
            const header = cells(lines[i]);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && TABLE_ROW_RE.test(lines[i])) rows.push(cells(lines[i++]));
            i--;
            blocks.push({ kind: "table", header, rows });
        } else {
            prose.push(lines[i]);
        }
    }
    flushProse();
    return blocks;
}
