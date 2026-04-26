"use client";

import { useEffect, useState } from "react";
import { LogIn, X } from "lucide-react";
import { useLanguage } from "@/context/language-context";

const STORAGE_KEY = "sahayakai:justSignedOut";
const AUTO_DISMISS_MS = 10_000;

// Wave 4: sessionStorage can throw in Safari private mode and inside iframes
// with restricted Storage APIs. Wrap reads/writes so the banner degrades to
// "no notice" instead of crashing the page.
function safeStorageGet(key: string): string | null {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
}
function safeStorageRemove(key: string): void {
    try { window.sessionStorage.removeItem(key); } catch { /* private mode */ }
}

/**
 * Thin banner pinned above the landing nav when a teacher has just signed out.
 *
 * Production trigger: the auth context (`src/context/auth-context.tsx`) writes
 * `sessionStorage.setItem("sahayakai:justSignedOut", displayName)` inside its
 * onAuthStateChanged listener whenever it detects the user → null transition.
 *
 * QA trigger: `?signedOut=Name` query param also works so the banner can be
 * previewed without an actual sign-out flow.
 *
 * Auto-dismisses after 10 seconds; can also be closed manually. Either action
 * clears the sessionStorage flag so refreshing does not re-show the banner.
 */
export function SignedOutBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const queryName = params.get("signedOut");
    const storedName = safeStorageGet(STORAGE_KEY);

    const resolvedName = queryName ?? storedName;
    if (!resolvedName) return;

    setName(resolvedName);
    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
      safeStorageRemove(STORAGE_KEY);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    if (typeof window !== "undefined") {
      safeStorageRemove(STORAGE_KEY);
    }
  };

  if (!visible) return null;

  return (
    <div className="relative z-40 w-full bg-saffron-50 border-b border-saffron-200 px-6 sm:px-11 py-3 flex items-center justify-between gap-3 text-[13px]">
      <div className="flex items-center gap-3 text-saffron-800 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-saffron flex-none" />
        <span className="font-medium">
          See you tomorrow{name && name.trim() ? `, ${name}` : ""}.
        </span>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 font-semibold hover:underline"
        >
          <LogIn className="w-[13px] h-[13px]" strokeWidth={2.4} />
          Sign back in
        </a>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("Dismiss signed-out notice")}
        className="text-saffron-700 hover:text-saffron-800 rounded-full p-1.5 hover:bg-saffron-100 transition-colors flex-none"
      >
        <X className="w-[15px] h-[15px]" strokeWidth={2.4} />
      </button>
    </div>
  );
}
