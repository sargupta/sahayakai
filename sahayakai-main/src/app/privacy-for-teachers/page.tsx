import { PrivacyConsentForm } from './consent-form';
import { PrivacyMasthead, PrivacyCommitments, PrivacyFooter } from './privacy-content';

export const metadata = {
    title: 'Privacy for teachers — SahayakAI',
    description:
        'How SahayakAI handles teacher data. Not for monitoring teachers. Not for inspector reports. Private by default, deletable anytime.',
};

export default function PrivacyForTeachersPage() {
    return (
        <div className="force-light min-h-[calc(100vh-4rem)] bg-background text-foreground">
            <div
                className="relative"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 40% at 50% 10%, hsl(28 75% 96%) 0%, hsl(40 20% 99.5%) 55%, transparent 100%)',
                }}
            >
                <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-20 sm:pb-28">
                    {/* Masthead (client, localized by UI language) */}
                    <PrivacyMasthead />

                    {/* Commitments as editorial list (client, localized by UI language) */}
                    <PrivacyCommitments />

                    {/* Consent capture (client) */}
                    <PrivacyConsentForm />

                    {/* Footer (client, localized by UI language) */}
                    <PrivacyFooter />
                </div>
            </div>
        </div>
    );
}
