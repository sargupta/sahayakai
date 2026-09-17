/**
 * Class gate for the 2026-09-11 icon mismatch.
 *
 * The founder saw the browser-tab icon and the in-page header logo showing two
 * different SahayakAI logos. Three separate defects sat behind that:
 *
 *   1. src/app/favicon.ico was committed in the 2026-01-15 squash and never
 *      touched again, while public/icons/* were rebranded on 2026-04-11
 *      (da9d51713). Nothing connected the two, so the tab kept the old mark
 *      for five months and no test noticed.
 *   2. icon-192x192.png had the wordmark "SahayakAI" baked into the artwork
 *      and was rendered immediately beside the text "SahayakAI" in four
 *      components. At 32px the baked wordmark is illegible and the name
 *      appears twice.
 *   3. icon-192x192.png was actually 1024x1024 (as were icon-512x512 and both
 *      maskable icons) while the manifest declared 192 and 512.
 *
 * This gate does not assert "the favicon is the book logo". It asserts the
 * CLASS: every icon is derived from one source mark, every filename agrees
 * with its own pixels, and the components that sit beside the wordmark use the
 * wordmark-free asset. Any future icon added or edited by hand fails here.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ICONS_DIR = join(ROOT, "public/icons");

/**
 * True if any pixel is not fully opaque. Palette PNGs carry transparency in a
 * tRNS chunk whose entries are per-index alpha bytes; a value below 255 means
 * some index is see-through. Truecolour+alpha is reported by colour type.
 */
function hasTransparentPixel(b: Buffer): boolean {
    const colourType = b.readUInt8(25);
    if (colourType === 6 || colourType === 4) return true; // carries a real alpha channel
    const i = b.indexOf(Buffer.from("tRNS", "ascii"));
    if (i === -1) return false;
    const len = b.readUInt32BE(i - 4);
    for (let k = 0; k < len; k++) {
        if (b.readUInt8(i + 4 + k) < 255) return true;
    }
    return false;
}

const LOCK = JSON.parse(readFileSync(join(ICONS_DIR, "icons.lock.json"), "utf8")) as {
    source: string;
    sourceSha256: string;
    files: Record<string, string>;
};

const sha = (rel: string) => createHash("sha256").update(readFileSync(join(ROOT, rel))).digest("hex");

/** width/height out of a PNG IHDR chunk (bytes 16..24). */
function pngSize(rel: string): { w: number; h: number } {
    const b = readFileSync(join(ROOT, rel));
    expect(b.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

/** the sizes present in an .ico directory (0 means 256 in the ICO format). */
function icoSizes(rel: string): number[] {
    const b = readFileSync(join(ROOT, rel));
    const count = b.readUInt16LE(4);
    return Array.from({ length: count }, (_, i) => b.readUInt8(6 + i * 16) || 256).sort((a, b2) => a - b2);
}

describe("every icon comes from the one source mark", () => {
    it("the source mark is the one the icons were generated from", () => {
        expect(sha(LOCK.source)).toBe(LOCK.sourceSha256);
    });

    it.each(Object.keys(LOCK.files))("%s still matches the generated output", (rel) => {
        // Fails if someone hand-edits an icon, or regenerates the set from a
        // new source without committing every derived file.
        expect(sha(rel)).toBe(LOCK.files[rel]);
    });

    it("locks every PNG in public/icons — a new icon must be generated, not dropped in", () => {
        const onDisk = readdirSync(ICONS_DIR).filter((f) => f.endsWith(".png")).sort();
        const locked = Object.keys(LOCK.files)
            .filter((f) => f.startsWith("public/icons/") && f.endsWith(".png"))
            .map((f) => f.replace("public/icons/", ""))
            .sort();
        expect(onDisk).toEqual(locked);
    });
});

describe("the icons are the format their extension claims", () => {
    const pngs = readdirSync(ICONS_DIR).filter((f) => f.endsWith(".png"));

    it.each(pngs)("%s is a real PNG, not a JPEG wearing a .png extension", (file) => {
        // Every icon on main was a JPEG named .png. JPEG has no alpha channel,
        // which is why the mark always carried an opaque white box behind it,
        // and why the maskable icons could never be masked.
        const b = readFileSync(join(ICONS_DIR, file));
        expect(b.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    });

    it.each(["icon-48x48", "icon-72x72", "icon-96x96", "icon-144x144", "icon-192x192", "icon-512x512", "apple-touch-icon"])(
        "%s.png is fully opaque — a purpose:any icon must not bake in its own corners",
        (name) => {
            // Shipped 2026-09-17 with rounded corners, so the four corners were
            // alpha 0. Android composites a purpose:"any" icon onto the launcher's
            // own backing plate, so transparent corners render as a rounded square
            // inside a second square. The platform owns the radius, not us.
            const b = readFileSync(join(ICONS_DIR, `${name}.png`));
            expect(hasTransparentPixel(b)).toBe(false);
        },
    );

    it("mark.png is the one that stays transparent — it sits on a translucent nav", () => {
        expect(hasTransparentPixel(readFileSync(join(ICONS_DIR, "mark.png")))).toBe(true);
    });

    it("the transparent mark really is transparent", () => {
        // The header logo sits on a translucent nav, so an opaque mark would
        // show as a white box — which is exactly what the JPEGs did.
        // Transparency is either colour type 6 (truecolour+alpha) or colour
        // type 3 (palette) carrying a tRNS chunk. These are palette PNGs.
        const b = readFileSync(join(ICONS_DIR, "mark.png"));
        const colourType = b.readUInt8(25);
        const hasTrns = b.includes(Buffer.from("tRNS", "ascii"));
        expect(colourType === 6 || colourType === 4 || (colourType === 3 && hasTrns)).toBe(true);
    });
});

describe("filenames agree with actual pixels", () => {
    const sized = readdirSync(ICONS_DIR).filter((f) => /-(\d+)x(\d+)\.png$/.test(f));

    it("finds the sized icons", () => expect(sized.length).toBeGreaterThanOrEqual(8));

    it.each(sized)("%s is the size its name claims", (file) => {
        const [, w, h] = file.match(/-(\d+)x(\d+)\.png$/)!;
        // icon-192x192.png shipped as 1024x1024 for five months. This is that bug.
        expect(pngSize(`public/icons/${file}`)).toEqual({ w: Number(w), h: Number(h) });
    });

    it("apple-touch-icon is 180x180", () => {
        expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({ w: 180, h: 180 });
    });

    it("the manifest only references icons that exist at the declared size", () => {
        const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.json"), "utf8")) as {
            icons: Array<{ src: string; sizes: string }>;
        };
        for (const icon of manifest.icons) {
            const rel = `public/${icon.src.replace(/^\//, "")}`;  // manifest paths are web-root relative
            const [w, h] = icon.sizes.split("x").map(Number);
            expect(pngSize(rel)).toEqual({ w, h });
        }
    });
});

describe("the favicon is a real multi-resolution icon of the same mark", () => {
    it("carries 16, 32 and 48 px frames", () => {
        expect(icoSizes("src/app/favicon.ico")).toEqual([16, 32, 48]);
    });

    it("is generated from the source mark, not committed by hand", () => {
        expect(LOCK.files["src/app/favicon.ico"]).toBeDefined();
        expect(sha("src/app/favicon.ico")).toBe(LOCK.files["src/app/favicon.ico"]);
    });
});

describe("logos rendered beside the wordmark use the wordmark-free mark", () => {
    // These four render an <img> immediately next to the text "SahayakAI".
    const beside = [
        "src/components/logo.tsx",
        "src/components/landing/landing-nav.tsx",
        "src/components/landing/landing-footer.tsx",
        "src/components/auth/auth-dialog.tsx",
    ];

    it.each(beside)("%s uses /icons/mark.png", (file) => {
        const src = readFileSync(join(ROOT, file), "utf8");
        expect(src).toMatch(/src="\/icons\/mark\.png"/);
    });

    it.each(beside)("%s does not reuse a tile icon that has the wordmark baked in", (file) => {
        const src = readFileSync(join(ROOT, file), "utf8");
        expect(src).not.toMatch(/\/icons\/(icon-\d+x\d+|apple-touch-icon|maskable-\d+x\d+)\.png/);
    });

    it.each(beside)("%s does not crop the mark with object-cover", (file) => {
        // object-cover on a square mark clips its edges; the book's corners went first.
        const src = readFileSync(join(ROOT, file), "utf8");
        expect(src).not.toMatch(/mark\.png"[\s\S]{0,200}?object-cover/);
    });
});
