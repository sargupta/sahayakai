/**
 * Gate for the privacy policy that Google Play links to (/privacy-for-teachers).
 *
 * Class of bug: the published policy drifting away from what the app really
 * collects and who really processes it. Play compares the policy with the
 * Data safety form; a data type or processor that the code uses but the policy
 * does not name is a policy violation and a rejection reason.
 *
 * - Every data type declared on the Play Data safety form must be named.
 * - Every third-party processor whose credentials the backend reads must be
 *   named. Adding a new provider without updating the policy fails here.
 */
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import { FullPrivacyPolicy, PRIVACY_CONTACT_EMAIL } from '@/app/privacy-for-teachers/full-policy';

const SRC = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function allSource(dir: string): string {
    let out = '';
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
            out += allSource(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
            out += fs.readFileSync(full, 'utf8');
        }
    }
    return out;
}

describe('/privacy-for-teachers (Play privacy-policy URL)', () => {
    it('is the page Play links to and renders the full policy', () => {
        expect(read('app/privacy-for-teachers/page.tsx')).toContain('<FullPrivacyPolicy />');
        render(<FullPrivacyPolicy />);
        expect(screen.getByRole('heading', { level: 2, name: /privacy policy/i })).toBeTruthy();
        expect(document.body.textContent).toMatch(/Effective \d{1,2} \w+ \d{4}/);
    });

    it('names every data type declared on the Play Data safety form', () => {
        render(<FullPrivacyPolicy />);
        const text = document.body.textContent ?? '';
        // Data safety: Name, Email, User IDs, Phone number, Other info, Other in-app
        // messages, Photos, Voice or sound recordings, Other user-generated content,
        // App interactions, Crash logs, Diagnostics, Device or other IDs.
        for (const declared of [
            /name/i,
            /email address/i,
            /user ID/i,
            /phone number/i,
            /school, district, state/i,
            /messages/i,
            /photos/i,
            /voice/i,
            /lesson plans, quizzes, worksheets/i,
            /which features you use/i,
            /crash logs/i,
            /diagnostics/i,
            /notification token/i,
        ]) {
            expect(text).toMatch(declared);
        }
    });

    it('names every third-party processor the backend has credentials for', () => {
        render(<FullPrivacyPolicy />);
        const text = document.body.textContent ?? '';
        const code = allSource(SRC);
        const processors: Array<[RegExp, RegExp]> = [
            [/SARVAM_AI_API_KEY/, /Sarvam AI/],
            [/BHASHINI_INFERENCE/, /Bhashini/],
            [/TWILIO_ACCOUNT_SID/, /Twilio/],
            [/VOBIZ_/, /Vobiz/],
            [/RAZORPAY_KEY_ID/, /Razorpay/],
            [/YOUTUBE_API_KEY/, /YouTube/],
            [/GOOGLE_GENAI_API_KEY/, /Gemini/],
        ];
        for (const [credential, named] of processors) {
            if (credential.test(code)) expect(text).toMatch(named);
        }
        // A provider SDK the list above does not know about yet must be added
        // to the policy and to this list before it ships.
        const pkg = read('../package.json');
        for (const unknownSdk of ['openai', '@anthropic-ai/sdk', 'posthog', 'mixpanel', '@sendgrid', 'resend']) {
            expect(pkg).not.toContain(`"${unknownSdk}"`);
        }
    });

    it('gives a working contact and points to the account deletion page', () => {
        render(<FullPrivacyPolicy />);
        const mail = screen.getByRole('link', { name: PRIVACY_CONTACT_EMAIL });
        expect(mail.getAttribute('href')).toBe(`mailto:${PRIVACY_CONTACT_EMAIL}`);
        const deletion = screen.getAllByRole('link', { name: /account deletion page/i });
        expect(deletion[0].getAttribute('href')).toBe('/delete-account');
        expect(read('app/delete-account/page.tsx')).toContain(`'${PRIVACY_CONTACT_EMAIL}'`);
    });
});
