"use client";

type Props = {
  onAuthClick: () => void;
};

export function LandingNav({ onAuthClick }: Props) {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-6 sm:px-11 py-[22px] bg-white/70 backdrop-blur-md border-b border-black/5">
      <div className="flex items-center gap-2 font-headline font-bold text-[18px] tracking-tight text-foreground">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-saffron text-white text-[11px] font-extrabold">
          S
        </span>
        <span className="flex items-baseline gap-1.5">
          SahayakAI
          <span className="text-[10px] font-medium tracking-wide uppercase text-neutral-400">
            by SARGVISION Intelligence
          </span>
        </span>
      </div>

      <div className="hidden md:flex gap-7 text-[13px] text-neutral-600 font-medium">
        <a href="#product" className="hover:text-foreground transition-colors">
          Product
        </a>
        <a href="/pricing" className="hover:text-foreground transition-colors">
          Pricing
        </a>
      </div>

      <div className="flex gap-2.5 items-center">
        <button
          type="button"
          onClick={onAuthClick}
          className="hidden sm:inline text-[13px] text-neutral-600 font-medium hover:text-foreground cursor-pointer transition-colors"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={onAuthClick}
          className="inline-flex items-center text-[13px] bg-[#0b0b0f] text-white px-[18px] py-[9px] rounded-full font-medium hover:bg-[#1c1c21] transition-colors cursor-pointer"
        >
          Start free
        </button>
      </div>
    </nav>
  );
}
