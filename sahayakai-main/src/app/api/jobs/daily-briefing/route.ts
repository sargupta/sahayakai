/**
 * POST /api/jobs/daily-briefing
 *
 * Daily cron job (8 AM IST / 2:30 UTC) that:
 *   1. Scrapes CBSE circulars & academic updates
 *   2. Scrapes ICSE/CISCE council notifications
 *   3. Fetches AI-in-education news from Indian newspapers & EdTech blogs via Google News RSS
 *   4. Uses Gemini to curate and summarize the top 2–3 items into teacher-friendly posts
 *   5. Posts the briefing to the "daily_briefing" community group
 *
 * Replaces the old /api/jobs/edu-news job (which only covered CBSE circulars at 6 AM).
 *
 * Setup (run once in GCP — replaces the old sahayakai-edu-news scheduler):
 *
 *   # Delete old job
 *   gcloud scheduler jobs delete sahayakai-edu-news --location=asia-south1 --quiet
 *
 *   # Create new job
 *   gcloud scheduler jobs create http sahayakai-daily-briefing \
 *     --schedule="30 2 * * *" \
 *     --time-zone="Asia/Kolkata" \
 *     --uri="https://<your-app>/api/jobs/daily-briefing" \
 *     --http-method=POST \
 *     --oidc-service-account-email=<sa>@<project>.iam.gserviceaccount.com \
 *     --oidc-token-audience="https://<your-app>" \
 *     --location=asia-south1
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const maxDuration = 180; // 3 minutes — scraping + AI summarisation

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_UID = 'SYSTEM_SAHAYAKAI';
const SYSTEM_NAME = 'SahayakAI';
const GROUP_ID = 'daily_briefing';

/** Maximum articles to send to Gemini for curation */
const MAX_ARTICLES_FOR_AI = 20;
/** Number of curated items to post (the "2–3 reels") */
const CURATED_POST_COUNT = 3;

// ─── Source URLs ─────────────────────────────────────────────────────────────

// CBSE
const CBSE_CIRCULARS_URL = 'https://www.cbse.gov.in/cbsenew/circular.html';
const CBSE_ACADEMIC_URL = 'https://cbseacademic.nic.in/';
const CBSE_BASE_URL = 'https://www.cbse.gov.in/cbsenew/';

// ICSE / CISCE
const CISCE_URL = 'https://www.cisce.org/';
const CISCE_NOTIFICATIONS_URL = 'https://www.cisce.org/notifications.aspx';

// Google News RSS feeds — education + AI in education (India-focused)
const GOOGLE_NEWS_RSS_FEEDS = [
  // AI in Education India
  'https://news.google.com/rss/search?q=AI+education+India+teachers&hl=en-IN&gl=IN&ceid=IN:en',
  // CBSE / ICSE board news
  'https://news.google.com/rss/search?q=CBSE+ICSE+board+exam+2026&hl=en-IN&gl=IN&ceid=IN:en',
  // AI for teachers
  'https://news.google.com/rss/search?q=%22AI+for+teachers%22+OR+%22AI+in+classroom%22+India&hl=en-IN&gl=IN&ceid=IN:en',
  // Education policy India
  'https://news.google.com/rss/search?q=NEP+education+policy+India+2026&hl=en-IN&gl=IN&ceid=IN:en',
];

// Indian EdTech & education blog RSS feeds
const EDTECH_RSS_FEEDS = [
  'https://indianexpress.com/section/education/feed/',
  'https://timesofindia.indiatimes.com/rssfeeds/913168846.cms', // TOI Education
  'https://www.thehindu.com/education/feeder/default.rss',
  'https://www.ndtv.com/education/latest/feed', // NDTV Education
];

// Trusted source domains (for filtering Google News results)
const TRUSTED_DOMAINS = [
  'timesofindia.indiatimes.com',
  'indianexpress.com',
  'thehindu.com',
  'ndtv.com',
  'hindustantimes.com',
  'livemint.com',
  'economictimes.indiatimes.com',
  'edtechreview.in',
  'teacherplus.org',
  'scroll.in',
  'thewire.in',
  'news18.com',
  'india.com',
  'deccanherald.com',
  'telegraphindia.com',
  'edexlive.com',
  'news.google.com', // keep Google News links as fallback
];

// ─── State → Language Mapping ────────────────────────────────────────────────

/** Primary regional language for each Indian state */
const STATE_LANGUAGE_MAP: Record<string, string> = {
  'Karnataka': 'Kannada',
  'Maharashtra': 'Marathi',
  'Tamil Nadu': 'Tamil',
  'Andhra Pradesh': 'Telugu',
  'Telangana': 'Telugu',
  'West Bengal': 'Bengali',
  'Kerala': 'Malayalam',
  'Gujarat': 'Gujarati',
  'Punjab': 'Punjabi',
  'Odisha': 'Odia',
  // All other states default to Hindi
};

const ALL_LANGUAGES = [
  'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi',
  'Bengali', 'Gujarati', 'Punjabi', 'Malayalam', 'Odia',
] as const;

function getStateLanguage(state: string): string {
  return STATE_LANGUAGE_MAP[state] || 'Hindi';
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
}

/** Build a Google News RSS URL for state-level education news */
function stateNewsRssUrl(state: string): string {
  const q = encodeURIComponent(`education ${state} board exam school 2026`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RawArticle {
  title: string;
  url: string;
  source: string;       // e.g. "CBSE", "ICSE", "Times of India", "Google News"
  category: 'board_circular' | 'board_news' | 'ai_education' | 'education_policy';
  date: string;         // raw date string
  snippet?: string;     // short excerpt if available
  state?: string;       // e.g. "Karnataka" — set for state-level articles
}

interface CuratedItem {
  headline: string;
  summary: string;       // 2–3 line teacher-friendly summary
  sourceLabel: string;   // e.g. "Times of India"
  url: string;
  category: string;
  emoji: string;         // leading emoji for visual flair
}

// ─── HTML / RSS Parsers ──────────────────────────────────────────────────────

/**
 * Fetch a URL with timeout and User-Agent header.
 */
async function fetchPage(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SahayakAI/2.0 (Daily Briefing Bot)' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      logger.warn(`Fetch failed ${url}: ${res.status}`, 'DAILY_BRIEFING');
      return null;
    }
    return await res.text();
  } catch (err: any) {
    logger.warn(`Fetch error ${url}: ${err?.message}`, 'DAILY_BRIEFING');
    return null;
  }
}

/**
 * Parse CBSE circulars page HTML.
 */
function parseCbseCirculars(html: string): RawArticle[] {
  const articles: RawArticle[] = [];
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = html.match(rowRegex) || [];

  for (const row of rows) {
    const linkMatch = row.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    let href = linkMatch[1].trim();
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 5) continue;

    if (href && !href.startsWith('http')) {
      href = `${CBSE_BASE_URL}${href.replace(/^\.\//, '')}`;
    }

    const dateMatch = row.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
    articles.push({
      title,
      url: href,
      source: 'CBSE',
      category: 'board_circular',
      date: dateMatch ? dateMatch[1] : '',
    });
  }

  return articles;
}

/**
 * Parse CBSE Academic page.
 */
function parseCbseAcademic(html: string): RawArticle[] {
  const articles: RawArticle[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 10) continue;
    if (!href.includes('.pdf') && !href.includes('circular') && !href.includes('notification')) continue;

    if (!href.startsWith('http')) {
      href = `https://cbseacademic.nic.in/${href.replace(/^\.\//, '')}`;
    }

    const dateMatch = title.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
    articles.push({
      title,
      url: href,
      source: 'CBSE Academic',
      category: 'board_circular',
      date: dateMatch ? dateMatch[1] : '',
    });
  }

  return articles;
}

/**
 * Parse CISCE (ICSE/ISC) notifications page.
 */
function parseCisceNotifications(html: string): RawArticle[] {
  const articles: RawArticle[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 10) continue;
    // CISCE links are often PDFs or point to notification details
    if (!href.includes('.pdf') && !href.includes('notification') && !href.includes('circular') && !href.includes('notice')) continue;

    if (!href.startsWith('http')) {
      href = `https://www.cisce.org/${href.replace(/^\.\//, '')}`;
    }

    const dateMatch = title.match(/(\d{1,2}[\/.]\d{1,2}[\/.]\d{4})/);
    articles.push({
      title,
      url: href,
      source: 'CISCE (ICSE/ISC)',
      category: 'board_circular',
      date: dateMatch ? dateMatch[1] : '',
    });
  }

  return articles;
}

/**
 * Parse CISCE home page for latest news/marquee items.
 */
function parseCisceHome(html: string): RawArticle[] {
  const articles: RawArticle[] = [];
  // CISCE home often has marquee or news ticker sections
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (!title || title.length < 15) continue;
    // Filter for meaningful education content
    const lowerTitle = title.toLowerCase();
    if (!lowerTitle.includes('exam') && !lowerTitle.includes('result') &&
        !lowerTitle.includes('circular') && !lowerTitle.includes('notice') &&
        !lowerTitle.includes('syllabus') && !lowerTitle.includes('schedule') &&
        !lowerTitle.includes('admit') && !lowerTitle.includes('date')) continue;

    if (!href.startsWith('http')) {
      href = `https://www.cisce.org/${href.replace(/^\.\//, '')}`;
    }

    articles.push({
      title,
      url: href,
      source: 'CISCE (ICSE/ISC)',
      category: 'board_news',
      date: '',
    });
  }

  return articles;
}

/**
 * Parse a Google News or standard RSS XML feed.
 */
function parseRssFeed(xml: string, source: string, category: RawArticle['category']): RawArticle[] {
  const articles: RawArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const item = itemMatch[1];

    const titleMatch = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]>|<title>([\s\S]*?)<\/title>/);
    const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descMatch = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]>|<description>([\s\S]*?)<\/description>/);

    const title = (titleMatch?.[1] || titleMatch?.[2] || '').replace(/<[^>]+>/g, '').trim();
    const link = (linkMatch?.[1] || '').trim();
    const pubDate = (pubDateMatch?.[1] || '').trim();
    const desc = (descMatch?.[1] || descMatch?.[2] || '').replace(/<[^>]+>/g, '').trim();

    if (!title || !link) continue;

    // Extract actual source from Google News title (format: "Title - Source Name")
    let actualSource = source;
    const sourceMatch = title.match(/\s-\s([^-]+)$/);
    if (sourceMatch) {
      actualSource = sourceMatch[1].trim();
    }

    // Check freshness: only include articles from last 48 hours
    if (pubDate) {
      const articleDate = new Date(pubDate);
      const now = new Date();
      const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 48) continue;
    }

    articles.push({
      title: title.replace(/\s-\s[^-]+$/, '').trim(), // Remove "- Source" suffix
      url: link,
      source: actualSource,
      category,
      date: pubDate,
      snippet: desc.slice(0, 200),
    });
  }

  return articles;
}

// ─── AI Curation with Gemini ─────────────────────────────────────────────────

/**
 * Use Gemini to curate and summarise the top articles into teacher-friendly posts.
 */
async function curateWithGemini(articles: RawArticle[]): Promise<CuratedItem[]> {
  const { ai } = await import('@/ai/genkit');
  const { runResiliently } = await import('@/ai/genkit');

  // Build a numbered list of articles for the prompt
  const articleList = articles
    .slice(0, MAX_ARTICLES_FOR_AI)
    .map((a, i) => `${i + 1}. [${a.category}] "${a.title}" — ${a.source}${a.date ? ` (${a.date})` : ''}${a.snippet ? `\n   Excerpt: ${a.snippet}` : ''}\n   URL: ${a.url}`)
    .join('\n\n');

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  const prompt = `You are the SahayakAI Morning Briefing editor for Indian school teachers.

Today is ${today}.

Below are ${articles.length} education articles/circulars from CBSE, ICSE/CISCE, and Indian news sources.

YOUR TASK: Pick the ${CURATED_POST_COUNT} most important and DIFFERENT items for Indian school teachers.

SELECTION CRITERIA (in priority order):
1. Official board circulars (CBSE/ICSE) that affect teachers directly — exam dates, syllabus changes, grading policies
2. AI-in-education news teachers can act on — new tools, classroom strategies, policy changes
3. Education policy updates (NEP, state-level) that impact daily teaching
4. Avoid duplicate topics — pick diverse items across categories

FORMAT — STRICT. The summary becomes a single bullet line in a busy
teacher's morning feed. Be a wire-service editor, not a marketer.

FOR EACH SELECTED ITEM, produce:
- headline: ≤ 70 chars. No clickbait. Lead with the actor + action.
    Good: "CBSE: Shorthand Hindi (826) capacity-building workshop"
    Bad:  "Wonderful Opportunity for Hindi Teachers!"
- summary: ONE sentence, ≤ 140 chars. Tell the teacher what happened
    and (if relevant) what to do. No exclamation marks. No "let's
    explore", "wonderful opportunity", "stay tuned", "this reminds
    us". No salesy adjectives. Drop the emoji from this field — it
    goes in the emoji field below.
    Good: "Register via circular if you teach skill subject 826."
    Bad:  "This is a wonderful opportunity! Let's explore how to..."
- sourceLabel: Short publication name (max 25 chars). e.g. "CBSE",
    "Times of India", "The Hindu", "Indian Express", "Jagran Josh".
    Drop the word "Official". No "https://".
- url: The original article URL — copy EXACTLY from the list.
- category: One of "board_circular", "board_news", "ai_education", "education_policy"
- emoji: One relevant emoji. 📋 board circulars, 🤖 AI news,
    📚 policy, 🎓 exams, 🏫 school operations, 📊 results.

ARTICLES:
${articleList}

Respond ONLY with a valid JSON array of ${CURATED_POST_COUNT} objects. No markdown, no commentary.
Example: [{"headline":"...","summary":"...","sourceLabel":"...","url":"...","category":"...","emoji":"..."}]`;

  try {
    const result = await runResiliently(async (resilienceConfig) => {
      return await ai.generate({
        prompt,
        ...resilienceConfig,
        output: { format: 'json' },
      });
    }, 'dailyBriefing.curate');

    const output = result.output;

    // Validate the output is an array of CuratedItem objects
    if (Array.isArray(output) && output.length > 0) {
      return output.slice(0, CURATED_POST_COUNT).map((item: any) => ({
        headline: String(item.headline || ''),
        summary: String(item.summary || ''),
        sourceLabel: String(item.sourceLabel || ''),
        url: String(item.url || ''),
        category: String(item.category || 'board_news'),
        emoji: String(item.emoji || '📰'),
      }));
    }

    logger.warn('Gemini returned non-array output, falling back', 'DAILY_BRIEFING');
    return [];
  } catch (err: any) {
    logger.error('Gemini curation failed', err, 'DAILY_BRIEFING');
    return [];
  }
}

/**
 * Fallback: if Gemini fails, create simple posts from raw articles.
 */
function fallbackCuration(articles: RawArticle[]): CuratedItem[] {
  const emojiMap: Record<string, string> = {
    board_circular: '📋',
    board_news: '🎓',
    ai_education: '🤖',
    education_policy: '📚',
  };

  // Pick up to CURATED_POST_COUNT from different categories
  const byCategory = new Map<string, RawArticle[]>();
  for (const a of articles) {
    const existing = byCategory.get(a.category) || [];
    existing.push(a);
    byCategory.set(a.category, existing);
  }

  const picked: RawArticle[] = [];
  const categories = ['board_circular', 'ai_education', 'education_policy', 'board_news'];
  for (const cat of categories) {
    if (picked.length >= CURATED_POST_COUNT) break;
    const items = byCategory.get(cat) || [];
    if (items.length > 0) picked.push(items[0]);
  }

  // Fill remaining slots
  for (const a of articles) {
    if (picked.length >= CURATED_POST_COUNT) break;
    if (!picked.some(p => p.url === a.url)) picked.push(a);
  }

  return picked.map(a => ({
    headline: a.title.slice(0, 80),
    summary: a.snippet || a.title,
    sourceLabel: a.source,
    url: a.url,
    category: a.category,
    emoji: emojiMap[a.category] || '📰',
  }));
}

// ─── Translation with Gemini ────────────────────────────────────────────────

/**
 * Translate a briefing text into multiple languages in a single Gemini call.
 * Returns a map: { Hindi: "...", Kannada: "...", ... }
 */
async function translateBriefing(
  englishContent: string,
  targetLanguages: readonly string[],
): Promise<Record<string, string>> {
  const { ai } = await import('@/ai/genkit');
  const { runResiliently } = await import('@/ai/genkit');

  const langList = targetLanguages.join(', ');

  const prompt = `You are a professional translator for Indian education content.

Translate the following education news briefing into these languages: ${langList}

RULES:
- Keep the structure identical (numbering, line breaks, links)
- Translate naturally for teachers — not word-by-word
- Keep proper nouns (CBSE, ICSE, names) in English
- Keep URLs exactly as-is (do not translate URLs)
- Keep emojis as-is

TEXT TO TRANSLATE:
${englishContent}

Respond with a JSON object where keys are language names and values are the translated text.
Example: {"Hindi": "...", "Kannada": "...", "Tamil": "..."}`;

  try {
    const result = await runResiliently(async (resilienceConfig) => {
      return await ai.generate({
        prompt,
        ...resilienceConfig,
        output: { format: 'json' },
      });
    }, 'dailyBriefing.translate');

    const output = result.output;
    if (output && typeof output === 'object' && !Array.isArray(output)) {
      // Validate each key is a known language
      const translations: Record<string, string> = {};
      for (const lang of targetLanguages) {
        if (typeof output[lang] === 'string' && output[lang].length > 0) {
          translations[lang] = output[lang];
        }
      }
      return translations;
    }

    logger.warn('Translation returned unexpected format', 'DAILY_BRIEFING');
    return {};
  } catch (err: any) {
    logger.error('Translation failed, posting English-only', err, 'DAILY_BRIEFING');
    return {};
  }
}

/**
 * Curate state-level news: pick 1-2 stories per state from the fetched articles.
 */
async function curateStateNews(
  articlesByState: Map<string, RawArticle[]>,
): Promise<Map<string, CuratedItem[]>> {
  const { ai } = await import('@/ai/genkit');
  const { runResiliently } = await import('@/ai/genkit');

  const stateResults = new Map<string, CuratedItem[]>();

  // Process all states in parallel (max 10 concurrent)
  const states = Array.from(articlesByState.entries()).filter(([, articles]) => articles.length > 0);

  const curateOne = async (state: string, articles: RawArticle[]): Promise<[string, CuratedItem[]]> => {
    const articleList = articles
      .slice(0, 10)
      .map((a, i) => `${i + 1}. "${a.title}" — ${a.source}${a.date ? ` (${a.date})` : ''}${a.snippet ? `\n   Excerpt: ${a.snippet}` : ''}\n   URL: ${a.url}`)
      .join('\n\n');

    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Kolkata',
    });

    const prompt = `You are the SahayakAI Local News editor for ${state}, India. Today is ${today}.

Below are ${articles.length} education articles about ${state}.

Select the 1-2 most important items for school teachers in ${state}. Prefer:
1. State board exam/result updates
2. Local education policy changes
3. School-related news in ${state}

FOR EACH SELECTED ITEM, produce:
- headline: Short clear headline (max 80 chars)
- summary: 2-3 sentence teacher-friendly summary in simple English
- sourceLabel: Publication name
- url: Exact URL from the list
- category: "board_news" or "education_policy"
- emoji: A relevant emoji

ARTICLES:
${articleList}

Respond with a JSON array of 1-2 objects. No markdown.`;

    try {
      const result = await runResiliently(async (resilienceConfig) => {
        return await ai.generate({
          prompt,
          ...resilienceConfig,
          output: { format: 'json' },
        });
      }, `dailyBriefing.stateNews.${normalizeKey(state)}`);

      const output = result.output;
      if (Array.isArray(output) && output.length > 0) {
        const items = output.slice(0, 2).map((item: any) => ({
          headline: String(item.headline || ''),
          summary: String(item.summary || ''),
          sourceLabel: String(item.sourceLabel || ''),
          url: String(item.url || ''),
          category: String(item.category || 'board_news'),
          emoji: String(item.emoji || '📰'),
        }));
        return [state, items];
      }
    } catch (err: any) {
      logger.warn(`State curation failed for ${state}: ${err?.message}`, 'DAILY_BRIEFING');
    }

    return [state, []];
  };

  const results = await Promise.all(
    states.map(([state, articles]) => curateOne(state, articles)),
  );

  for (const [state, items] of results) {
    if (items.length > 0) stateResults.set(state, items);
  }

  return stateResults;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const { getDb } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    const db = await getDb();

    // ── 1. Get last check timestamp & posted URLs for dedup ─────────
    const configRef = db.doc('system_config/daily_briefing_last_check');
    const configSnap = await configRef.get();
    const lastCheckMs: number = configSnap.exists
      ? (configSnap.data()?.lastCheckAt?.toMillis?.() ?? 0)
      : 0;

    const postedUrlsSnap = await db
      .collection(`groups/${GROUP_ID}/posts`)
      .where('authorUid', '==', SYSTEM_UID)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const postedUrls = new Set<string>();
    postedUrlsSnap.docs.forEach((doc) => {
      const attachments = doc.data().attachments;
      if (Array.isArray(attachments)) {
        attachments.forEach((a: { url?: string }) => {
          if (a.url) postedUrls.add(a.url);
        });
      }
      // Also check content for URLs
      const content = doc.data().content || '';
      const urlMatches = content.match(/https?:\/\/[^\s)]+/g) || [];
      urlMatches.forEach((u: string) => postedUrls.add(u));
    });

    logger.info(`Loaded ${postedUrls.size} previously posted URLs for dedup`, 'DAILY_BRIEFING');

    // ── 2. Scrape all sources in parallel ───────────────────────────
    const [
      cbseHtml,
      academicHtml,
      cisceHomeHtml,
      cisceNotifHtml,
      ...rssFeedResults
    ] = await Promise.all([
      fetchPage(CBSE_CIRCULARS_URL),
      fetchPage(CBSE_ACADEMIC_URL),
      fetchPage(CISCE_URL),
      fetchPage(CISCE_NOTIFICATIONS_URL),
      ...GOOGLE_NEWS_RSS_FEEDS.map(url => fetchPage(url)),
      ...EDTECH_RSS_FEEDS.map(url => fetchPage(url)),
    ]);

    // ── 2b. Query active states & scrape state-level news ─────────
    const usersSnap = await db.collection('users').select('state').get();
    const stateCounts = new Map<string, number>();
    for (const doc of usersSnap.docs) {
      const st = doc.data().state;
      if (st && typeof st === 'string') {
        stateCounts.set(st, (stateCounts.get(st) || 0) + 1);
      }
    }
    const activeStates = Array.from(stateCounts.keys()).filter(s => (stateCounts.get(s) || 0) >= 1);
    logger.info(`Active states: ${activeStates.join(', ')} (${activeStates.length} total)`, 'DAILY_BRIEFING');

    const stateRssResults = await Promise.all(
      activeStates.map(async (state) => {
        const xml = await fetchPage(stateNewsRssUrl(state));
        return { state, xml };
      }),
    );

    // ── 3. Parse all sources ────────────────────────────────────────
    const allArticles: RawArticle[] = [];

    if (cbseHtml) allArticles.push(...parseCbseCirculars(cbseHtml));
    if (academicHtml) allArticles.push(...parseCbseAcademic(academicHtml));
    if (cisceHomeHtml) allArticles.push(...parseCisceHome(cisceHomeHtml));
    if (cisceNotifHtml) allArticles.push(...parseCisceNotifications(cisceNotifHtml));

    // Google News RSS feeds
    const googleNewsCount = GOOGLE_NEWS_RSS_FEEDS.length;
    for (let i = 0; i < googleNewsCount; i++) {
      const xml = rssFeedResults[i];
      if (xml) {
        const category = i <= 1 ? 'board_news' : (i === 2 ? 'ai_education' : 'education_policy');
        allArticles.push(...parseRssFeed(xml, 'Google News', category as RawArticle['category']));
      }
    }

    // EdTech blog RSS feeds
    for (let i = googleNewsCount; i < rssFeedResults.length; i++) {
      const xml = rssFeedResults[i];
      if (xml) {
        const sourceUrl = EDTECH_RSS_FEEDS[i - googleNewsCount];
        const sourceName = sourceUrl.includes('indianexpress') ? 'Indian Express'
          : sourceUrl.includes('timesofindia') ? 'Times of India'
          : sourceUrl.includes('thehindu') ? 'The Hindu'
          : sourceUrl.includes('ndtv') ? 'NDTV'
          : 'EdTech Blog';
        allArticles.push(...parseRssFeed(xml, sourceName, 'ai_education'));
      }
    }

    // State-level articles (parsed separately, tagged with state)
    const stateArticles = new Map<string, RawArticle[]>();
    for (const { state, xml } of stateRssResults) {
      if (xml) {
        const articles = parseRssFeed(xml, 'Google News', 'board_news')
          .map(a => ({ ...a, state }));
        stateArticles.set(state, articles);
      }
    }

    // ── 4. Deduplicate ──────────────────────────────────────────────
    const seen = new Set<string>();
    const uniqueArticles = allArticles.filter((a) => {
      const key = a.url || a.title;
      if (seen.has(key) || postedUrls.has(a.url)) return false;
      seen.add(key);
      return true;
    });

    logger.info(
      `Scraped ${allArticles.length} total articles, ${uniqueArticles.length} unique & new`,
      'DAILY_BRIEFING',
    );

    if (uniqueArticles.length === 0) {
      await configRef.set({ lastCheckAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({
        ok: true,
        posted: 0,
        message: 'No new articles found across all sources',
        scrapedTotal: allArticles.length,
        durationMs: Date.now() - startTime,
      });
    }

    // ── 5. AI Curation with Gemini ──────────────────────────────────
    let curatedItems = await curateWithGemini(uniqueArticles);

    // Fallback if Gemini returns nothing
    if (curatedItems.length === 0) {
      logger.warn('Using fallback curation (Gemini returned empty)', 'DAILY_BRIEFING');
      curatedItems = fallbackCuration(uniqueArticles);
    }

    if (curatedItems.length === 0) {
      await configRef.set({ lastCheckAt: FieldValue.serverTimestamp() }, { merge: true });
      return NextResponse.json({
        ok: true,
        posted: 0,
        message: 'No suitable articles for curation',
        scrapedTotal: allArticles.length,
        uniqueNew: uniqueArticles.length,
        durationMs: Date.now() - startTime,
      });
    }

    // ── 6. Ensure daily_briefing group exists ───────────────────────
    const groupRef = db.doc(`groups/${GROUP_ID}`);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      await groupRef.set({
        name: 'Daily Briefing',
        description:
          'Your morning education briefing — CBSE & ICSE circulars, AI in education news, and policy updates curated daily by SahayakAI for Indian school teachers.',
        type: 'interest',
        coverColor: 'linear-gradient(135deg, #f97316, #6366f1)',
        createdBy: SYSTEM_UID,
        createdAt: new Date().toISOString(),
        lastActivityAt: FieldValue.serverTimestamp(),
        memberCount: 0,
        autoJoinRules: {},
        isSystem: true,
      });
      logger.info('Created daily_briefing group', 'DAILY_BRIEFING');
    }

    // ── 7. Curate state-level news (parallel with national) ────────
    // Dedup state articles against national posted URLs
    const dedupedStateArticles = new Map<string, RawArticle[]>();
    for (const [state, articles] of stateArticles) {
      const unique = articles.filter(a => !postedUrls.has(a.url) && !seen.has(a.url));
      if (unique.length > 0) dedupedStateArticles.set(state, unique);
    }

    const curatedStateNews = dedupedStateArticles.size > 0
      ? await curateStateNews(dedupedStateArticles)
      : new Map<string, CuratedItem[]>();

    logger.info(
      `State news: ${curatedStateNews.size} states with curated items`,
      'DAILY_BRIEFING',
    );

    // ── 8. Build the morning briefing post ──────────────────────────
    // Tight wire-service format: one bullet per item, source + domain
    // suffix. No "Good Morning Teachers", no "Stay inspired" footer —
    // teachers scan this on commute, not at a tea ceremony. The full
    // article URL goes into `attachments` (rendered as a linkable card)
    // so the body doesn't carry the long ugly tracker URLs inline.
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });

    const domainOf = (raw: string): string => {
      try { return new URL(raw).hostname.replace(/^www\./, ''); }
      catch { return ''; }
    };

    const briefingContent = [
      `🗓 Daily Briefing — ${today}`,
      ...curatedItems.map((item) => {
        const domain = domainOf(item.url);
        const sourceLine = domain
          ? `   ↪ ${item.sourceLabel} · ${domain}`
          : `   ↪ ${item.sourceLabel}`;
        return [
          `${item.emoji} ${item.headline}`,
          `   ${item.summary}`,
          sourceLine,
        ].join('\n');
      }),
    ].join('\n\n');

    const attachments = curatedItems.map(item => ({
      type: 'link' as const,
      url: item.url,
      title: `${item.emoji} ${item.headline}`,
    }));

    // ── 9. Translate national briefing to all languages ─────────────
    const translations = await translateBriefing(briefingContent, ALL_LANGUAGES);
    logger.info(
      `Translated national briefing to ${Object.keys(translations).length} languages`,
      'DAILY_BRIEFING',
    );

    // ── 10. Write national briefing to Firestore ────────────────────
    const batch = db.batch();

    const postRef = db.collection(`groups/${GROUP_ID}/posts`).doc();
    batch.set(postRef, {
      groupId: GROUP_ID,
      authorUid: SYSTEM_UID,
      authorName: SYSTEM_NAME,
      authorPhotoURL: null,
      content: briefingContent,
      postType: 'resource' as const,
      attachments,
      likesCount: 0,
      commentsCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      ...(Object.keys(translations).length > 0 ? { translations } : {}),
    });

    // Update group activity
    batch.update(groupRef, { lastActivityAt: FieldValue.serverTimestamp() });

    // Update last check timestamp
    batch.set(configRef, { lastCheckAt: FieldValue.serverTimestamp() }, { merge: true });

    await batch.commit();

    // ── 11. Post state-level briefings to state groups ──────────────
    let statePostCount = 0;

    for (const [state, items] of curatedStateNews) {
      const stateGroupId = `state_${normalizeKey(state)}`;
      const stateGroupRef = db.doc(`groups/${stateGroupId}`);
      const stateGroupSnap = await stateGroupRef.get();

      // Only post to groups that already exist (created by auto-join)
      if (!stateGroupSnap.exists) continue;

      const stateContent = [
        `🗓 ${state} Update — ${today}`,
        ...items.map((item) => {
          const domain = domainOf(item.url);
          const sourceLine = domain
            ? `   ↪ ${item.sourceLabel} · ${domain}`
            : `   ↪ ${item.sourceLabel}`;
          return [
            `${item.emoji} ${item.headline}`,
            `   ${item.summary}`,
            sourceLine,
          ].join('\n');
        }),
      ].join('\n\n');

      const stateAttachments = items.map(item => ({
        type: 'link' as const,
        url: item.url,
        title: `${item.emoji} ${item.headline}`,
      }));

      // Translate to state's regional language
      const regionalLang = getStateLanguage(state);
      let stateTranslations: Record<string, string> = {};
      if (regionalLang !== 'English') {
        stateTranslations = await translateBriefing(stateContent, [regionalLang]);
      }

      const stateBatch = db.batch();

      const statePostRef = db.collection(`groups/${stateGroupId}/posts`).doc();
      stateBatch.set(statePostRef, {
        groupId: stateGroupId,
        authorUid: SYSTEM_UID,
        authorName: SYSTEM_NAME,
        authorPhotoURL: null,
        content: stateContent,
        postType: 'resource' as const,
        attachments: stateAttachments,
        likesCount: 0,
        commentsCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        ...(Object.keys(stateTranslations).length > 0
          ? { translations: stateTranslations }
          : {}),
      });

      stateBatch.update(stateGroupRef, { lastActivityAt: FieldValue.serverTimestamp() });

      await stateBatch.commit();
      statePostCount++;
    }

    const durationMs = Date.now() - startTime;
    logger.info(
      `Posted daily briefing: ${curatedItems.length} national + ${statePostCount} state posts (${durationMs}ms)`,
      'DAILY_BRIEFING',
    );

    return NextResponse.json({
      ok: true,
      posted: curatedItems.length,
      statePostsCount: statePostCount,
      items: curatedItems.map(c => c.headline),
      stateItems: Object.fromEntries(
        Array.from(curatedStateNews.entries()).map(([s, items]) => [s, items.map(i => i.headline)]),
      ),
      translatedLanguages: Object.keys(translations),
      scrapedTotal: allArticles.length,
      uniqueNew: uniqueArticles.length,
      durationMs,
    });
  } catch (error) {
    logger.error('Daily briefing cron failed', error, 'DAILY_BRIEFING');
    return NextResponse.json(
      { error: 'Internal Server Error', durationMs: Date.now() - startTime },
      { status: 500 },
    );
  }
}
