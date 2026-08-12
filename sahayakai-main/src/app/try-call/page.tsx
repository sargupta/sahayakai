import type { Metadata } from 'next';
import { TryCallForm } from './try-call-form';
import { TryCallHero, TryCallFeatures } from './try-call-hero';

export const metadata: Metadata = {
    title: 'Hear the Call — SahayakAI',
    description:
        'Every parent picks up a phone call. Hear SahayakAI call your own phone in your language, in 30 seconds.',
};

/**
 * Public lead-magnet page ("Hear the Call" demo).
 * Spec: docs/PARENT_CALL_DEMO_SPEC.md
 * Copy: company/marketing/lead_magnet_parent_call_demo.md
 * Visible copy lives in the client TryCallHero/TryCallFeatures/TryCallForm
 * components so it localises into all 11 languages (this page is a server
 * component and can't use the client language context directly).
 */
export default function TryCallPage() {
    return (
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-4 py-12 sm:py-16">
            <TryCallHero />
            <TryCallForm />
            <TryCallFeatures />
        </main>
    );
}
