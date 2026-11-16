/** @jest-environment node */
/**
 * VIDYA follows the design system (docs/design-system §5.12): saffron while idle, listening and
 * speaking; indigo only while connecting/thinking; the teacher home shows VidyaPresence at
 * size="workspace". Regression: the WebGL sphere turned leaf-green while speaking and the home
 * page drew that sphere instead of the design-system orb.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VIDYA_SPHERE_PALETTES } from '@/components/vidya/vidya-sphere';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('VIDYA colours and size follow the design system', () => {
    it('saffron for every state except thinking (indigo)', () => {
        expect(VIDYA_SPHERE_PALETTES).toEqual({ idle: 'saffron', listening: 'saffron', thinking: 'indigo', speaking: 'saffron', error: 'saffron' });
    });

    it('the sphere never uses the leaf (green) speaking palette', () => {
        const src = read('src/components/vidya/vidya-sphere.tsx');
        expect(src).not.toMatch(/--vidya-speaking-\d/);
        expect(src).not.toMatch(/var\(--orb-live-speaking\)/);
    });

    it('VIDYA on Home has one fixed size in every state', () => {
        const src = read('src/components/dashboard/dashboard-home.tsx');
        // The design-system orb (VidyaPresence) at the one fixed Home size.
        expect(src).toMatch(/data-testid="vidya-home-live"[\s\S]{0,120}<VidyaPresence\s+size="compact"\s+className="h-40 w-40 shrink-0 md:h-52 md:w-52"/);
    });

    it('VIDYA is centred; she moves aside ONLY while the messages panel is open', () => {
        const src = read('src/components/dashboard/dashboard-home.tsx');
        expect(src).toMatch(/messagesOpen && "[^"]*xl:pr-\[384px\]"/);
        expect(src).not.toMatch(/^\s*"xl:pr-\[384px\]",/m);
        // and the panel never opens by itself
        expect(read('src/components/community/community-messages-context.tsx')).not.toMatch(/matchMedia/);
    });
});
