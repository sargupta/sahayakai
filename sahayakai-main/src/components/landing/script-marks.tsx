/**
 * Ghosted Devanagari / Kannada / Tamil / Bengali / Gujarati / Gurmukhi script
 * marks scattered across the landing hero background as cultural texture.
 * Non-interactive. Rendered once at very low opacity so they read as ambient
 * warmth rather than literal translations.
 */
export function ScriptMarks() {
  return (
    <div
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <span className="absolute top-[110px] left-[58px] text-[112px] font-bold text-saffron opacity-[0.07] font-serif">
        अ
      </span>
      <span className="absolute top-[170px] right-[80px] text-[88px] font-bold text-saffron opacity-[0.07] font-serif">
        க
      </span>
      <span className="absolute bottom-[120px] left-[96px] text-[72px] font-bold text-saffron opacity-[0.06] font-serif">
        আ
      </span>
      <span className="absolute bottom-[180px] right-[120px] text-[96px] font-bold text-saffron opacity-[0.06] font-serif">
        ಅ
      </span>
      <span className="absolute top-[340px] left-[140px] text-[58px] font-bold text-saffron opacity-[0.055] font-serif">
        ગ
      </span>
      <span className="absolute top-[380px] right-[160px] text-[64px] font-bold text-saffron opacity-[0.055] font-serif">
        ਅ
      </span>
    </div>
  );
}
