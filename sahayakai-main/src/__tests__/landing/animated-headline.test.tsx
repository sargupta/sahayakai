/**
 * Class gate for the hero headline overlap reported 2026-09-11.
 *
 * The rotating phrase used AnimatePresence mode="popLayout" with a slow
 * spring. popLayout lifts the exiting phrase out of flow and positions it
 * over the incoming one, so for most of a second two different phrases were
 * legible on top of each other — "a prep desk." reading through "a parent
 * hotline.". Sampling the live DOM showed up to six phrase spans coexisting
 * inside the wrapper, not two.
 *
 * The wrapper also reserved `min-h-[1.15em]` and no width at all, so the hero
 * resized every 2.2s as phrases of different length rotated through, and the
 * longest wrapped to a second line on mobile.
 *
 * The gate asserts the CLASS: whatever the animation library does, the
 * rotating region must reserve space for every phrase and must never present
 * more than one readable phrase.
 */
import { render, screen } from "@testing-library/react";
import { AnimatedHeadline } from "@/components/landing/animated-headline";
import { pillars, pillarText } from "@/components/landing/pillar-data";

jest.mock("@/context/language-context", () => ({
    useLanguage: () => ({ t: (s: string) => s, language: "english" }),
}));

// motion/react is animation-only here; render its elements as plain spans so
// the structural contract can be asserted in jsdom.
jest.mock("motion/react", () => ({
    __esModule: true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: new Proxy({}, {
        get: () => ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
            const { initial, animate, exit, transition, ...rest } = props as Record<string, unknown>;
            void initial; void animate; void exit; void transition;
            return <span {...(rest as object)}>{children}</span>;
        },
    }),
    useReducedMotion: () => false,
}));

const wrapper = (container: HTMLElement) => container.querySelector("h1")!.children[1] as HTMLElement;

describe("AnimatedHeadline", () => {
    it("renders exactly one readable phrase", () => {
        const { container } = render(<AnimatedHeadline titleIndex={2} />);
        const readable = [...wrapper(container).children].filter(
            (el) => el.getAttribute("aria-hidden") !== "true",
        );
        expect(readable).toHaveLength(1);
        expect(readable[0].textContent).toBe(pillarText((s: string) => s, pillars[2], "rotating"));
    });

    it("reserves space for every phrase in the rotation, not just the current one", () => {
        // This is what stops the hero resizing under the reader. Without the
        // sizers the box is only as wide as whichever phrase is showing.
        const { container } = render(<AnimatedHeadline titleIndex={0} />);
        const sizers = [...wrapper(container).children].filter(
            (el) => el.getAttribute("aria-hidden") === "true",
        );
        expect(sizers).toHaveLength(pillars.length);
        expect(sizers.map((s) => s.textContent).sort()).toEqual(
            pillars.map((p) => pillarText((s: string) => s, p, "rotating")).sort(),
        );
    });

    it("stacks every phrase into one grid cell so they cannot push each other around", () => {
        const { container } = render(<AnimatedHeadline titleIndex={1} />);
        const box = wrapper(container);
        expect(box.className).toMatch(/\bgrid\b/);
        for (const child of [...box.children]) {
            expect(child.className).toMatch(/col-start-1/);
            expect(child.className).toMatch(/row-start-1/);
        }
    });

    it("does not reserve height with a one-line min-height", () => {
        // min-h-[1.15em] was the old reservation: one line tall, zero wide.
        const { container } = render(<AnimatedHeadline titleIndex={0} />);
        expect(wrapper(container).className).not.toMatch(/min-h-\[/);
    });

    it("keeps the sizers out of the accessibility tree", () => {
        // Six copies of the phrase list would otherwise be announced.
        render(<AnimatedHeadline titleIndex={3} />);
        const heading = screen.getByRole("heading", { level: 1 });
        const announced = heading.textContent ?? "";
        for (const p of pillars) {
            const phrase = pillarText((s: string) => s, p, "rotating");
            if (p !== pillars[3]) continue;
            expect(announced).toContain(phrase);
        }
        // exactly one phrase is visible to AT: the live one
        const hidden = heading.querySelectorAll('[aria-hidden="true"]');
        expect(hidden.length).toBe(pillars.length);
    });

    it("every phrase carries the underline, so the rule tracks the text width", () => {
        const { container } = render(<AnimatedHeadline titleIndex={4} />);
        for (const child of [...wrapper(container).children]) {
            expect(child.className).toMatch(/border-b-\[4px\]/);
        }
    });
});
