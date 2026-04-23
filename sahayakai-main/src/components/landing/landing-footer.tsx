export function LandingFooter() {
  return (
    <footer id="community" className="bg-[#fafafa] border-t border-neutral-200 px-6 sm:px-11 py-12 scroll-mt-24">
      <div className="max-w-[1040px] mx-auto grid gap-10 md:grid-cols-3 text-[13px] text-neutral-600">
        <div>
          <div className="flex items-center gap-2 font-headline font-bold text-[16px] tracking-tight text-foreground">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-saffron text-white text-[11px] font-extrabold">
              S
            </span>
            SahayakAI
          </div>
          <p className="mt-3 max-w-[28ch] leading-[1.55]">
            The Operating System for Teaching in India. A product of SARGVISION Intelligence.
          </p>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 mb-3">
            Product
          </div>
          <ul className="space-y-1.5">
            <li className="hover:text-foreground cursor-pointer transition-colors">Product</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">Pricing</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">Community</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">Privacy</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">Terms</li>
          </ul>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 mb-3">
            Contact
          </div>
          <ul className="space-y-1.5">
            <li>
              <a
                href="mailto:contact@sargvision.com"
                className="hover:text-foreground transition-colors"
              >
                contact@sargvision.com
              </a>
            </li>
            <li>
              <a
                href="https://calendly.com/contact-sargvision/30min"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Book a school demo
              </a>
            </li>
            <li className="text-neutral-500">Made in Bharat 🇮🇳</li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1040px] mx-auto mt-10 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-500">
        <div>© {new Date().getFullYear()} SARGVISION Intelligence Pvt. Ltd. All rights reserved.</div>
        <div className="tracking-wide">SahayakAI is a product of SARGVISION Intelligence.</div>
      </div>
    </footer>
  );
}
