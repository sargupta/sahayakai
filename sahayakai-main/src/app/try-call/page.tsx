import type { Metadata } from 'next';
import { PhoneCall, Languages, Smartphone } from 'lucide-react';
import { TryCallForm } from './try-call-form';

export const metadata: Metadata = {
    title: 'Hear the Call — SahayakAI',
    description:
        'Every parent picks up a phone call. Hear SahayakAI call your own phone in your language, in 30 seconds.',
};

/**
 * Public lead-magnet page ("Hear the Call" demo).
 * Spec: docs/PARENT_CALL_DEMO_SPEC.md
 * Copy: company/marketing/lead_magnet_parent_call_demo.md
 */
export default function TryCallPage() {
    return (
        <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-4 py-12 sm:py-16">
            <section className="space-y-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                    When did a parent last read the note you sent in the school diary?
                    <br className="hidden sm:block" />
                    {' '}And how many chairs were filled at your last parent meeting?
                </p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Every parent picks up a phone call.
                    <span className="block text-primary">Hear it on your own phone in 30 seconds.</span>
                </h1>
                <p className="text-base text-muted-foreground">
                    SahayakAI calls parents for you, in their language, with the message you choose.
                    Try it on yourself right now.
                </p>
            </section>

            <TryCallForm />

            <section className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                    <Languages className="h-6 w-6 text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                        Speaks 11 Indian languages, from Bengali to Tamil to Malayalam
                    </p>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                    <Smartphone className="h-6 w-6 text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                        Parents need no app, no smartphone, no reading. A ringing phone is enough
                    </p>
                </div>
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center">
                    <PhoneCall className="h-6 w-6 text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                        One tap sends the call to every parent in your class
                    </p>
                </div>
            </section>
        </main>
    );
}
