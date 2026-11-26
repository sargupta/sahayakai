/**
 * Class gate: every public time-saved or price figure comes from one model.
 *
 * WHAT HAPPENED (founder reports, 2026-11-26)
 * 1. The homepage proof strip said "2+ hrs saved daily" next to "~200 hrs/year
 *    per teacher", while /for-schools said "Six hours per teacher per week".
 *    Three different rates were live at once.
 * 2. Asked for a decision-maker page, the founder's condition was that the
 *    site must not show "different things in different places".
 *
 * The founder-approved savings methodology already lives in
 * src/lib/school-pricing.ts (10.8 hrs/week x 38 weeks = 410 hrs/year,
 * Rs 10,000 per teacher per year) and /school-pricing reads it. The other
 * pages had typed their own numbers.
 *
 * WHAT THIS GATE CATCHES
 * Not "this number" but the class: a marketing surface quoting an hours or
 * price figure that the model does not produce.
 *   - The homepage's yearly figure must equal the model's, in English and in
 *     every locale, and its daily figure must multiply out to it.
 *   - /for-schools must contain no typed hours or price figure at all; it has
 *     to read the model's constants.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  SAVINGS_HOURS_PER_TEACHER_YEAR,
  SAVINGS_WEEKLY_HOURS,
  SCHOOL_PRICING,
} from "@/lib/school-pricing";

const SRC = path.resolve(__dirname, "..", "..");
const HERO = path.join(SRC, "components", "landing", "landing-hero.tsx");
const FOR_SCHOOLS = path.join(SRC, "app", "(marketing)", "for-schools", "for-schools-client.tsx");
const LOCALES = path.join(SRC, "locales");

const MIN_DAYS = 180;
const MAX_DAYS = 220;
const NATIVE_DIGITS = "০১২৩৪৫৬৭৮৯୦୧୨୩୪୫୬୭୮୯";
const toLatinDigits = (s: string) =>
  s.replace(/[০-৯୦-୯]/g, (ch) => String(NATIVE_DIGITS.indexOf(ch) % 10));

describe("homepage time-saved figures come from the savings model", () => {
  const hero = readFileSync(HERO, "utf8");
  const yearly = hero.match(/t\("~(\d+) hrs\/year"\)/);
  const daily = hero.match(/t\("(\d+(?:\.\d+)?)\+ hrs"\)/);

  it("quotes the model's yearly hours", () => {
    expect(yearly).not.toBeNull();
    expect(Number(yearly![1])).toBe(SAVINGS_HOURS_PER_TEACHER_YEAR);
  });

  it("quotes a daily figure the model supports and that multiplies out to the yearly one", () => {
    expect(daily).not.toBeNull();
    const perDay = Number(daily![1]);
    expect(perDay).toBeLessThanOrEqual(SAVINGS_WEEKLY_HOURS / 5);
    expect(SAVINGS_HOURS_PER_TEACHER_YEAR).toBeGreaterThanOrEqual(perDay * MIN_DAYS);
    expect(SAVINGS_HOURS_PER_TEACHER_YEAR).toBeLessThanOrEqual(perDay * MAX_DAYS);
  });

  it("quotes no separate weekly rate", () => {
    expect(/hours? per teacher per week|per teacher\/week|hrs saved weekly/i.test(hero)).toBe(false);
  });

  it.each(readdirSync(LOCALES).filter((f) => f.endsWith(".json")))(
    "%s translates the yearly figure with the same number",
    (file) => {
      const dict = JSON.parse(readFileSync(path.join(LOCALES, file), "utf8")) as Record<string, string>;
      const value = dict[`~${SAVINGS_HOURS_PER_TEACHER_YEAR} hrs/year`];
      expect(value).toBeDefined();
      expect(toLatinDigits(value)).toContain(String(SAVINGS_HOURS_PER_TEACHER_YEAR));
    },
  );
});

describe("/for-schools types no figure of its own", () => {
  // Comments may explain the numbers; only code and copy are checked.
  const code = readFileSync(FOR_SCHOOLS, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("reads hours, weeks and price from src/lib/school-pricing.ts", () => {
    for (const name of [
      "SAVINGS_HOURS_PER_TEACHER_YEAR",
      "SAVINGS_WEEKLY_HOURS",
      "SAVINGS_CAPABILITIES",
      "SCHOOL_PRICING.annualPerTeacher",
      "estimateSchoolSavings",
    ]) {
      expect(code).toContain(name);
    }
  });

  it("contains no typed hours figure", () => {
    expect(code.match(/\d+(?:\.\d+)?\+?\s*(?:hrs?|hours?)\b/gi) ?? []).toEqual([]);
  });

  it("contains no typed price", () => {
    const price = SCHOOL_PRICING.annualPerTeacher;
    expect(code).not.toContain(String(price));
    expect(code).not.toContain(price.toLocaleString("en-IN"));
  });

  it("carries no testimonial or usage claim", () => {
    expect(/<blockquote|<figcaption|pilot school|Live with \d+/i.test(code)).toBe(false);
  });
});
