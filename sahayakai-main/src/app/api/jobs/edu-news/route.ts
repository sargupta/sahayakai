/**
 * POST /api/jobs/edu-news
 *
 * Daily cron job (6 AM IST / 0:30 UTC) that scrapes CBSE circular pages
 * for new education updates and posts them to the community "education_updates" group.
 *
 * Setup (run once in GCP):
 *   gcloud scheduler jobs create http sahayakai-edu-news \
 *     --schedule="30 0 * * *" \
 *     --time-zone="Asia/Kolkata" \
 *     --uri="https://<your-app>/api/jobs/edu-news" \
 *     --http-method=POST \
 *     --oidc-service-account-email=<sa>@<project>.iam.gserviceaccount.com \
 *     --oidc-token-audience="https://<your-app>" \
 *     --location=asia-south1
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 120; // 2 minutes for scraping

const SYSTEM_UID = 'SYSTEM_SAHAYAKAI';
const SYSTEM_NAME = 'SahayakAI';
const GROUP_ID = 'education_updates';

const CBSE_CIRCULARS_URL = 'https://www.cbse.gov.in/cbsenew/circular.html';
const CBSE_ACADEMIC_URL = 'https://cbseacademic.nic.in/';
const CBSE_BASE_URL = 'https://www.cbse.gov.in/cbsenew/';

interface Circular {
    title: string;
    url: string;
    date: string; // raw date string from the page
}

/**
 * Parse CBSE circulars page HTML for circular links.
 * The page typically has <a> tags with href pointing to PDF circulars
 * inside table rows with date information.
 */
function parseCbseCirculars(html: string): Circular[] {
    const circulars: Circular[] = [];

    // Match table rows containing circular links — pattern: date text + <a href="...">title</a>
    // CBSE circulars page uses <tr> with <td> containing dates and links
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
        // Extract link
        const linkMatch = row.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;

        let href = linkMatch[1].trim();
        const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();

        if (!title || title.length < 5) continue;

        // Resolve relative URLs
        if (href && !href.startsWith('http')) {
            href = `${CBSE_BASE_URL}${href.replace(/^\.\//, '')}`;
        }

        // Extract date if present (dd/mm/yyyy or dd.mm.yyyy patterns)
        const dateMatch = row.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
        const date = dateMatch ? dateMatch[1] : '';

        circulars.push({ title, url: href, date });
    }

    return circulars;
}

/**
 * Parse CBSE Academic page for latest updates/notifications.
 */
function parseCbseAcademic(html: string): Circular[] {
    const circulars: Circular[] = [];

    // CBSE Academic typically has a marquee or news section with links
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        let href = match[1].trim();
        const title = match[2].replace(/<[^>]+>/g, '').trim();

        // Only capture PDF links or links that look like circulars/notifications
        if (!title || title.length < 10) continue;
        if (!href.includes('.pdf') && !href.includes('circular') && !href.includes('notification')) continue;

        if (!href.startsWith('http')) {
            href = `https://cbseacademic.nic.in/${href.replace(/^\.\//, '')}`;
        }

        const dateMatch = title.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
        const date = dateMatch ? dateMatch[1] : '';

        circulars.push({ title, url: href, date });
    }

    return circulars;
}

async function fetchPage(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'SahayakAI/1.0 (Education Updates Bot)' },
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
            logger.warn(`Failed to fetch ${url}: ${res.status}`, 'EDU_NEWS');
            return null;
        }
        return await res.text();
    } catch (err: any) {
        logger.warn(`Fetch error for ${url}: ${err?.message}`, 'EDU_NEWS');
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const { getDb } = await import('@/lib/firebase-admin');
        const { FieldValue } = await import('firebase-admin/firestore');
        const db = await getDb();

        // ── 1. Get last check timestamp ──────────────────────────────
        const configRef = db.doc('system_config/edu_news_last_check');
        const configSnap = await configRef.get();
        const lastCheckMs: number = configSnap.exists
            ? (configSnap.data()?.lastCheckAt?.toMillis?.() ?? 0)
            : 0;

        // Track already-posted URLs to deduplicate
        const postedUrlsSnap = await db
            .collection(`groups/${GROUP_ID}/posts`)
            .where('authorUid', '==', SYSTEM_UID)
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        const postedUrls = new Set<string>();
        postedUrlsSnap.docs.forEach((doc) => {
            const attachments = doc.data().attachments;
            if (Array.isArray(attachments)) {
                attachments.forEach((a: { url?: string }) => {
                    if (a.url) postedUrls.add(a.url);
                });
            }
        });

        // ── 2. Scrape sources ────────────────────────────────────────
        const [cbseHtml, academicHtml] = await Promise.all([
            fetchPage(CBSE_CIRCULARS_URL),
            fetchPage(CBSE_ACADEMIC_URL),
        ]);

        const allCirculars: Circular[] = [];
        if (cbseHtml) allCirculars.push(...parseCbseCirculars(cbseHtml));
        if (academicHtml) allCirculars.push(...parseCbseAcademic(academicHtml));

        // Deduplicate by URL
        const seen = new Set<string>();
        const uniqueCirculars = allCirculars.filter((c) => {
            if (seen.has(c.url) || postedUrls.has(c.url)) return false;
            seen.add(c.url);
            return true;
        });

        // Cap at 10 per run to avoid flooding
        const newCirculars = uniqueCirculars.slice(0, 10);

        logger.info(
            `Scraped ${allCirculars.length} total, ${newCirculars.length} new circulars`,
            'EDU_NEWS',
        );

        if (newCirculars.length === 0) {
            await configRef.set({ lastCheckAt: FieldValue.serverTimestamp() }, { merge: true });
            return NextResponse.json({ ok: true, posted: 0, message: 'No new circulars' });
        }

        // ── 3. Ensure education_updates group exists ─────────────────
        const groupRef = db.doc(`groups/${GROUP_ID}`);
        const groupSnap = await groupRef.get();

        if (!groupSnap.exists) {
            await groupRef.set({
                name: 'Education Updates',
                description:
                    'Official CBSE circulars, board notifications, and education policy updates — auto-posted daily by SahayakAI.',
                type: 'interest',
                coverColor: 'linear-gradient(135deg, #f97316, #dc2626)',
                createdBy: SYSTEM_UID,
                createdAt: new Date().toISOString(),
                lastActivityAt: FieldValue.serverTimestamp(),
                memberCount: 0,
                autoJoinRules: {},
                isSystem: true,
            });
            logger.info('Created education_updates group', 'EDU_NEWS');
        }

        // ── 4. Create posts for each new circular ────────────────────
        const batch = db.batch();

        for (const circular of newCirculars) {
            const postRef = db.collection(`groups/${GROUP_ID}/posts`).doc();
            batch.set(postRef, {
                groupId: GROUP_ID,
                authorUid: SYSTEM_UID,
                authorName: SYSTEM_NAME,
                authorPhotoURL: null,
                content: `📋 ${circular.title}${circular.date ? `\n\n📅 ${circular.date}` : ''}\n\n🔗 ${circular.url}`,
                postType: 'share' as const,
                attachments: [
                    {
                        type: 'lesson-plan' as const, // closest type for official docs
                        url: circular.url,
                        title: circular.title,
                    },
                ],
                likesCount: 0,
                commentsCount: 0,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        // Update group activity
        batch.update(groupRef, { lastActivityAt: FieldValue.serverTimestamp() });

        // Update last check timestamp
        batch.set(configRef, { lastCheckAt: FieldValue.serverTimestamp() }, { merge: true });

        await batch.commit();

        logger.info(`Posted ${newCirculars.length} new education updates`, 'EDU_NEWS');

        return NextResponse.json({
            ok: true,
            posted: newCirculars.length,
            titles: newCirculars.map((c) => c.title),
        });
    } catch (error) {
        logger.error('Education news cron failed', error, 'EDU_NEWS');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
