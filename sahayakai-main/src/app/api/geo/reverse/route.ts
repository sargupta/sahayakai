import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { INDIAN_STATES } from '@/types';
import { logger } from '@/lib/logger';

/**
 * POST /api/geo/reverse
 * Body: { lat: number, lng: number }
 *
 * Reverse-geocodes via Google Maps and returns the matched Indian state
 * (one of INDIAN_STATES) + district if we can extract one. Pure pre-fill
 * helper for the onboarding form — fails silently with `null` when the
 * Maps key is missing or the request times out so the UI doesn't block.
 */
export async function POST(req: Request) {
    const headersList = await headers();
    const userId = headersList.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let lat: number, lng: number;
    try {
        const body = await req.json();
        lat = Number(body.lat);
        lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json({ error: 'Invalid coords' }, { status: 400 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    const apiKey =
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        // No key configured — return graceful empty so the UI just skips the prefill.
        return NextResponse.json({ state: null, district: null, configured: false });
    }

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=administrative_area_level_1|administrative_area_level_2|locality`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        const data = await res.json();
        if (data.status !== 'OK' || !Array.isArray(data.results)) {
            return NextResponse.json({ state: null, district: null });
        }
        let state: string | null = null;
        let district: string | null = null;
        for (const result of data.results) {
            for (const comp of result.address_components || []) {
                const types: string[] = comp.types || [];
                if (!state && types.includes('administrative_area_level_1')) {
                    const candidate = comp.long_name as string;
                    const match = (INDIAN_STATES as readonly string[]).find(
                        s => s.toLowerCase() === candidate.toLowerCase(),
                    );
                    if (match) state = match;
                }
                if (!district && types.includes('administrative_area_level_2')) {
                    district = comp.long_name as string;
                }
            }
            if (state) break;
        }
        return NextResponse.json({ state, district });
    } catch (err) {
        logger.warn('reverse geocode failed', String(err));
        return NextResponse.json({ state: null, district: null });
    }
}
