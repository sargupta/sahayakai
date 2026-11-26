/**
 * Class gate: the public time-saved claims agree with each other.
 *
 * WHAT HAPPENED (founder report, 2026-11-26)
 * The homepage proof strip said "2+ hrs saved daily" next to "~200 hrs/year
 * per teacher", while /for-schools said "Six hours per teacher per week" and
 * "6 hrs saved per teacher/week". Two hours a day over a school year is about
 * 400 hours, not 200, and three different rates were live at once.
 *
 * WHAT THIS GATE CATCHES
 * Not "this number" but the class: a per-day figure and a per-year figure
 * that do not multiply out, or two marketing surfaces quoting different
 * figures. The founder's chosen basis is 2+ hours a day; a school year is
 * taken as 180 to 220 teaching days.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const SURFACES = {
  "landing hero": path.join(SRC, "components", "landing", "landing-hero.tsx"),
  "for-schools": path.join(SRC, "app", "(marketing)", "for-schools", "for-schools-client.tsx"),
};
const MIN_DAYS = 180;
const MAX_DAYS = 220;

function claims(file: string) {
  const src = readFileSync(file, "utf8");
  const daily = src.match(/(\d+(?:\.\d+)?)\+? hrs["')}\s]+label=\{?(?:t\()?"saved daily"/);
  const yearly = src.match(/~(\d+) hrs\/year/);
  const weekly = /hours? per teacher per week|per teacher\/week|hrs saved weekly/i.test(src);
  return {
    daily: daily ? Number(daily[1]) : null,
    yearly: yearly ? Number(yearly[1]) : null,
    weekly,
  };
}

describe("time-saved claims are arithmetically consistent", () => {
  const found = Object.entries(SURFACES).map(([name, file]) => ({ name, ...claims(file) }));

  it.each(found)("$name: yearly hours equal daily hours times a school year", ({ daily, yearly }) => {
    expect(daily).not.toBeNull();
    expect(yearly).not.toBeNull();
    expect(yearly as number).toBeGreaterThanOrEqual((daily as number) * MIN_DAYS);
    expect(yearly as number).toBeLessThanOrEqual((daily as number) * MAX_DAYS);
  });

  it.each(found)("$name: quotes no separate weekly rate", ({ weekly }) => {
    expect(weekly).toBe(false);
  });

  it("every surface quotes the same figures", () => {
    const pairs = new Set(found.map((f) => `${f.daily}/${f.yearly}`));
    expect([...pairs]).toHaveLength(1);
  });
});
