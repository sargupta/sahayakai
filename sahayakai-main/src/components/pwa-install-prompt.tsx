'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Pages where the PWA install prompt may appear. On all other pages the
// VIDYA orb is the primary floating element and showing the install card
// would crowd a 375px viewport (see FLOATING_CHROME_AUDIT §6). The prompt
// re-appears the next time the teacher visits the home page.
const PWA_PROMPT_ALLOWED_ROUTES = new Set<string>(['/', '/onboarding']);

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject Apple PWA meta tags — Next.js 15 strips them from <head> and metadata API
  useEffect(() => {
    const head = document.head;
    const created: HTMLElement[] = [];
    function addMeta(name: string, content: string) {
      if (!head.querySelector(`meta[name="${name}"]`)) {
        const el = document.createElement('meta');
        el.setAttribute('name', name);
        el.setAttribute('content', content);
        head.appendChild(el);
        created.push(el);
      }
    }
    function addLink(rel: string, href: string) {
      if (!head.querySelector(`link[rel="${rel}"]`)) {
        const el = document.createElement('link');
        el.setAttribute('rel', rel);
        el.setAttribute('href', href);
        head.appendChild(el);
        created.push(el);
      }
    }
    addMeta('apple-mobile-web-app-capable', 'yes');
    addMeta('apple-mobile-web-app-status-bar-style', 'default');
    addMeta('apple-mobile-web-app-title', 'SahayakAI');
    addMeta('mobile-web-app-capable', 'yes');
    addLink('apple-touch-icon', '/icons/apple-touch-icon.png');
    return () => { created.forEach(el => el.remove()); };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    try {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (dismissed) {
        const dismissedAt = parseInt(dismissed, 10);
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedAt < sevenDays) return;
      }
    } catch { /* localStorage unavailable */ }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      timerRef.current = setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
    } catch { /* prompt already used or dismissed by browser */ }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try { localStorage.setItem('pwa-install-dismissed', Date.now().toString()); } catch {}
  };

  if (!showPrompt || isInstalled) return null;
  if (!PWA_PROMPT_ALLOWED_ROUTES.has(pathname)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-orange-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-96x96.png"
            alt="SahayakAI"
            className="h-12 w-12 rounded-xl"
          />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-stone-900">
              Install SahayakAI
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Add to home screen for quick access & offline use
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              होम स्क्रीन पर जोड़ें — ऑफलाइन भी चलेगा
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-stone-400 hover:text-stone-600"
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Not Now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 active:bg-orange-700"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
