/**
 * Gate for the public account-deletion page that Google Play links to.
 *
 * Class of bug: the Play listing's "delete account" URL drifting away from
 * what the app and API actually do — the page 404s, gets wrapped in the
 * signed-in app chrome, or promises deletion of data the API no longer
 * removes (a false Data Safety declaration).
 */
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import DeleteAccountPage from '@/app/delete-account/page';

const SRC = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

describe('/delete-account (Play account-deletion URL)', () => {
    it('tells people how to delete in the app and without it', () => {
        render(<DeleteAccountPage />);
        expect(screen.getByRole('heading', { level: 1, name: /delete your account/i })).toBeTruthy();
        expect(document.body.textContent).toMatch(/Settings/);
        const mail = screen.getByRole('link', { name: /@/ });
        expect(mail.getAttribute('href')).toMatch(/^mailto:/);
    });

    it('is rendered without the signed-in app chrome and listed in the sitemap', () => {
        expect(read('app/app-shell.tsx')).toMatch(/MARKETING_PATHS = \[[^\]]*"\/delete-account"/);
        expect(read('app/sitemap.ts')).toContain('/delete-account');
    });

    it('only claims deletion of collections the delete-account route really deletes', () => {
        const route = read('app/api/user/delete-account/route.ts');
        // Each item the page says is "deleted straight away" maps to a delete in the route.
        for (const evidence of [
            "collection('connections')",
            "collection('content')",
            "collection('teacher_analytics')",
            "collection('vidya_sessions')",
            "collection('usage')",
            'auth.deleteUser(userId)',
            'removeTeacher(',
        ]) {
            expect(route).toContain(evidence);
        }
        // The page says Community content is NOT removed automatically; if the
        // route starts purging it, update the page (and the Play Data Safety form).
        expect(route).toMatch(/community posts .* are NOT purged here/s);
    });
});
