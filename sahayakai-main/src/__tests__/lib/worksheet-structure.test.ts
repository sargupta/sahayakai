/**
 * The printed worksheet is laid out from the parsed Markdown, so the parser
 * must round-trip exactly what the flow writes (renderWorksheetMarkdown) — if
 * the renderer's shape changes, this fails rather than the sheet silently
 * falling back to plain prose.
 */
import { renderWorksheetMarkdown } from "@/ai/flows/worksheet-markdown";
import { answerSpaceFor, parseWorksheetMarkdown, splitSheetBlocks } from "@/lib/worksheet-structure";

const source = {
    title: "Plants Make Food",
    gradeLevel: "Class 5",
    subject: "Science",
    learningObjectives: ["Name the parts of a leaf", "Explain photosynthesis"],
    studentInstructions: "Read each activity carefully.\nUse a pencil.",
    activities: [
        { content: "Fill in the blank: Plants need ________ to make food.", explanation: "Think of the sunny field." },
        { content: "Which part makes food?\n\na) Root\nb) Leaf\nc) Stem", explanation: "Look at a mango tree." },
        { content: "| Part | Job |\n|---|---|\n| Root | |\n| Leaf | |", explanation: "Complete the table." },
        { content: "Explain why leaves are green. Use $6CO_2$ in your answer.", explanation: "Chlorophyll is the key." },
        { content: "Name one plant in your school garden.", explanation: "Go and look!" },
    ],
    answerKey: [
        { activityIndex: 0, answer: "sunlight" },
        { activityIndex: 1, answer: "b) Leaf" },
    ],
};

describe("parseWorksheetMarkdown", () => {
    const parsed = parseWorksheetMarkdown(renderWorksheetMarkdown(source))!;

    it("recovers the title block", () => {
        expect(parsed.title).toBe("Plants Make Food");
        expect(parsed.meta).toEqual([
            { label: "Class", value: "Class 5" },
            { label: "Subject", value: "Science" },
        ]);
    });

    it("recovers objectives and instructions", () => {
        expect(parsed.objectives).toEqual(source.learningObjectives);
        expect(parsed.instructions).toBe(source.studentInstructions);
    });

    it("recovers every activity, its note, and numbers it", () => {
        expect(parsed.activities.map((a) => a.number)).toEqual([1, 2, 3, 4, 5]);
        expect(parsed.activities[0].content).toBe(source.activities[0].content);
        expect(parsed.activities[2].content).toBe(source.activities[2].content);
        expect(parsed.activities.map((a) => a.note)).toEqual(source.activities.map((a) => a.explanation));
        expect(parsed.activities[4].content).not.toMatch(/---/);
    });

    it("picks answer space by what the activity already provides", () => {
        expect(parsed.activities.map((a) => a.answerSpace)).toEqual(["none", "none", "none", "long", "short"]);
    });

    it("recovers the answer key", () => {
        expect(parsed.answers).toEqual([
            { number: 1, text: "sunlight" },
            { number: 2, text: "b) Leaf" },
        ]);
    });

    it("returns null for Markdown without an activities section", () => {
        expect(parseWorksheetMarkdown("# Just a story\n\nOnce upon a time…")).toBeNull();
        expect(parseWorksheetMarkdown("")).toBeNull();
    });

    it("matches sections by numeral, so translated headings still parse", () => {
        const hindi = renderWorksheetMarkdown(source)
            .replace("Learning Objectives", "सीखने के उद्देश्य")
            .replace("## III. Activities", "## III. गतिविधियाँ")
            .replace(/### Activity (\d+)/g, "### गतिविधि $1");
        const p = parseWorksheetMarkdown(hindi)!;
        expect(p.activities).toHaveLength(5);
        expect(p.objectives).toHaveLength(2);
    });
});

describe("answerSpaceFor", () => {
    it("gives writing room only where the activity has none of its own", () => {
        expect(answerSpaceFor("Describe your village.")).toBe("long");
        expect(answerSpaceFor("What is 2 + 3?")).toBe("short");
        expect(answerSpaceFor("2 + 3 = ____")).toBe("none");
    });
});

describe("splitSheetBlocks", () => {
    it("pulls pipe tables out as rows, keeping the prose around them", () => {
        const blocks = splitSheetBlocks("Complete the table.\n\n| Part | Job |\n|---|---|\n| Root | |\n| Leaf | makes food |\n\nThen colour it.");
        expect(blocks).toEqual([
            { kind: "markdown", text: "Complete the table." },
            { kind: "table", header: ["Part", "Job"], rows: [["Root", ""], ["Leaf", "makes food"]] },
            { kind: "markdown", text: "Then colour it." },
        ]);
    });

    it("keeps one option per line", () => {
        const [b] = splitSheetBlocks("Which part makes food?\n\na) Root\nb) Leaf\nc) Stem");
        expect(b.kind === "markdown" && b.text).toBe("Which part makes food?\n\na) Root  \nb) Leaf  \nc) Stem");
    });

    it("leaves Markdown lists alone", () => {
        const [b] = splitSheetBlocks("Fill in:\n\n1. One ____\n2. Two ____");
        expect(b.kind === "markdown" && b.text).toBe("Fill in:\n\n1. One ____\n2. Two ____");
    });
});
