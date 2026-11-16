/**
 * The routed exam-paper form (src/app/exam-paper) — subject field.
 *
 * The 2026-08-25 founder bug (a typed subject wiped on every keystroke when
 * the board/class has no blueprint) was fixed only in the unrouted
 * src/features/exam-paper copy; the live page kept the broken effect. The
 * class gate: for EVERY board × class the picker offers, with the blueprint
 * list both loaded and unavailable, a typed subject must survive.
 */
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { EDUCATION_BOARDS } from "@/types";
import { GRADE_OPTIONS } from "@/app/exam-paper/types";
import { useExamPaperForm } from "@/app/exam-paper/hooks/use-exam-paper-form";

jest.mock("@/lib/get-auth-token", () => ({ getAuthToken: jest.fn().mockResolvedValue("test-token") }));
jest.mock("@/context/language-context", () => ({ useLanguage: () => ({ t: (s: string) => s }) }));
jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));

const CBSE_MATHS = {
    board: "CBSE",
    gradeLevel: "Class 10",
    subject: "Mathematics",
    duration: 180,
    maxMarks: 80,
    generalInstructions: [],
    sections: [],
};

function mockBlueprints(ok: boolean) {
    (global as any).fetch = jest.fn().mockResolvedValue({ ok, json: async () => (ok ? [CBSE_MATHS] : []) });
}

beforeEach(() => {
    (useSearchParams as jest.Mock).mockReturnValue({ get: () => null });
});

function typeSubject(set: (v: string) => void, value: string) {
    for (let i = 1; i <= value.length; i++) act(() => set(value.slice(0, i)));
}

describe("useExamPaperForm (routed page) — typed subject survives", () => {
    it.each([true, false])("blueprints loaded=%p: every board × class keeps a typed subject", async (loaded) => {
        mockBlueprints(loaded);
        const { result } = renderHook(() => useExamPaperForm(null));
        await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
        for (const board of EDUCATION_BOARDS) {
            for (const grade of GRADE_OPTIONS) {
                act(() => result.current.setBoard(board));
                act(() => result.current.setGradeLevel(grade));
                if (result.current.availableSubjects.length > 0) continue; // a picker, not free text
                typeSubject(result.current.setSubject, "History");
                expect([board, grade, result.current.subject]).toEqual([board, grade, "History"]);
            }
        }
    });

    it("still defaults to the blueprint's subject where one exists", async () => {
        mockBlueprints(true);
        const { result } = renderHook(() => useExamPaperForm(null));
        await waitFor(() => expect(result.current.availableSubjects).toEqual(["Mathematics"]));
        expect(result.current.subject).toBe("Mathematics");
        expect(result.current.matchedBlueprint?.maxMarks).toBe(80);
    });
});
