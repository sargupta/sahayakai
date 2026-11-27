"use client";

import Link from "next/link";
import { useLanguage } from "@/context/language-context";
import { LanguageSwitcher } from "@/components/marketing/language-switcher";
import { useAccessMode } from "../use-access-mode";
import { CONTACT_EMAIL, CONTACT_PHONE, demoHref } from "./home-links";

/*
 * Header and footer shared by the homepage and /features.
 * Every in-page link is absolute ("/#features"), never a bare "#features":
 * the same header renders on /features, where those sections do not exist
 * (class gate: src/__tests__/components/landing-chrome-anchors.test.ts).
 */

export function HomeHeader({ onAuthClick }: { onAuthClick: () => void }) {
  const { t } = useLanguage();
  const gated = useAccessMode() === "enforce";

  return (
    <header className="hp-header">
      <div className="wrap hp-header-row">
        <Link href="/" className="hp-brand" aria-label={t("SahayakAI home")}>
          <img
            src="/icons/mark.png"
            alt=""
            width={36}
            height={36}
            className="hp-brand-mark"
          />
          <span className="d hp-brand-name">SahayakAI</span>
          <span className="hp-brand-by">{t("by SARGVISION Intelligence")}</span>
        </Link>
        <nav className="hp-nav" aria-label={t("Main")}>
          <a href="/features" className="navl navl-keep">
            {t("All features")}
          </a>
          <a href="/#nep" className="navl">
            {t("NEP 2020")}
          </a>
          <a href="/#community" className="navl">
            {t("Teachers community")}
          </a>
          <LanguageSwitcher />
          <button type="button" onClick={onAuthClick} className="hp-login">
            {t("Log in")}
          </button>
          {gated ? (
            <Link
              href="/request-access"
              className="hp-btn hp-btn-saffron hp-btn-sm"
            >
              {t("Request access")}
            </Link>
          ) : (
            <a
              href={demoHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="hp-btn hp-btn-saffron hp-btn-sm"
            >
              {t("Book a demo")}
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export function HomeFooter() {
  const { t } = useLanguage();
  return (
    <footer className="hp-footer">
      <div className="wrap hp-footer-row">
        <div className="hp-footer-brand">
          <img src="/icons/mark.png" alt="" width={28} height={28} />
          <span className="d hp-footer-name">SahayakAI</span>
          <span aria-hidden="true" className="hp-footer-rule" />
          <span className="hp-footer-of">{t("A product of SARGVISION")}</span>
        </div>
        <div className="hp-footer-links">
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>
            {CONTACT_PHONE}
          </a>
          <Link href="/features">{t("All features")}</Link>
          <Link href="/for-schools">{t("For schools")}</Link>
          <Link href="/pricing">{t("Pricing")}</Link>
          <Link href="/about">{t("About")}</Link>
          <Link href="/privacy-for-teachers">{t("Privacy")}</Link>
          <Link href="/terms">{t("Terms")}</Link>
        </div>
        <div>
          {t("© {year} SARGVISION Intelligence Private Limited").replace(
            "{year}",
            String(new Date().getFullYear()),
          )}
        </div>
      </div>
    </footer>
  );
}
