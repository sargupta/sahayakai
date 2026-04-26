"use client";

import { useLanguage } from "@/context/language-context";

export function LandingFooter() {
  const { t } = useLanguage();
  return (
    <footer id="community" className="bg-[#fafafa] border-t border-neutral-200 px-6 sm:px-11 py-12 scroll-mt-24">
      <div className="max-w-[1040px] mx-auto grid gap-10 md:grid-cols-3 text-[13px] text-neutral-600">
        <div>
          <div className="flex items-center gap-2 font-headline font-bold text-[16px] tracking-tight text-foreground">
            <img
              src="/icons/icon-192x192.png"
              alt={t("SahayakAI logo")}
              className="h-7 w-7 rounded-md object-cover"
            />
            SahayakAI
          </div>
          <p className="mt-3 max-w-[28ch] leading-[1.55]">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 mb-3">
            {t("Product")}
          </div>
          <ul className="space-y-1.5">
            <li className="hover:text-foreground cursor-pointer transition-colors">{t("Product")}</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">{t("Pricing")}</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">{t("Community")}</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">{t("Privacy")}</li>
            <li className="hover:text-foreground cursor-pointer transition-colors">{t("Terms")}</li>
          </ul>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400 mb-3">
            {t("Contact")}
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
                {t("Book a school demo")}
              </a>
            </li>
            <li className="text-neutral-500">{t("Made in Bharat 🇮🇳")}</li>
          </ul>
        </div>
      </div>
      <div className="max-w-[1040px] mx-auto mt-10 pt-6 border-t border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-neutral-500">
        <div>{t("footer.copyright").replace("{year}", String(new Date().getFullYear()))}</div>
        <div className="tracking-wide">{t("footer.byline")}</div>
      </div>
    </footer>
  );
}
