/**
 * YouTube RSS Feed Engine
 *
 * Uses YouTube's public RSS feeds to fetch channel videos with:
 * - ZERO API quota consumption
 * - NO API key required
 * - Works from any server (Cloud Run, local, anywhere)
 * - No HTTP referrer restrictions
 *
 * RSS Feed URL: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
 * Each feed returns the 15 most recent videos from a channel.
 */

import { YouTubeVideo } from './youtube';

const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const CHANNEL_CACHE_TTL = 60 * 60 * 1000; // 1 hour in-process

// L1: In-memory channel RSS cache (per Cloud Run instance)
const rssCache = new Map<string, { videos: YouTubeVideo[]; expiresAt: number }>();

/**
 * Parses a YouTube RSS/Atom feed XML string into YouTubeVideo objects.
 * Uses regex-based parsing to avoid any additional dependencies.
 */
function parseRssFeed(xml: string, channelName: string): YouTubeVideo[] {
    const videos: YouTubeVideo[] = [];

    // Extract all <entry> blocks
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let entryMatch: RegExpExecArray | null;

    while ((entryMatch = entryRegex.exec(xml)) !== null) {
        const entry = entryMatch[1];

        const id = (/<yt:videoId>(.*?)<\/yt:videoId>/.exec(entry))?.[1]?.trim();
        const channelId = (/<yt:channelId>(.*?)<\/yt:channelId>/.exec(entry))?.[1]?.trim();
        const title = (/<title>(.*?)<\/title>/.exec(entry))?.[1]?.trim();
        const published = (/<published>(.*?)<\/published>/.exec(entry))?.[1]?.trim();
        const description = (/<media:description>([\s\S]*?)<\/media:description>/.exec(entry))?.[1]?.trim() || '';
        const thumbnail = (/<media:thumbnail url="(.*?)"/.exec(entry))?.[1]?.trim();

        if (!id || !title) continue;

        videos.push({
            id,
            title: decodeXmlEntities(title),
            description: decodeXmlEntities(description).slice(0, 200),
            thumbnail: thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            channelTitle: channelName,
            channelId: channelId,
            publishedAt: published || new Date().toISOString(),
        });
    }

    return videos;
}

/** Decode common XML entities for clean display text */
function decodeXmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/**
 * Fetches the latest videos from a single YouTube channel via RSS.
 * Results are cached in-memory for CHANNEL_CACHE_TTL duration.
 *
 * @param channelId - YouTube channel ID (e.g. UC1mITbFJjhqbC2LVMn3Bpeg)
 * @param channelName - Human-readable name for display
 * @param maxResults - Max videos to return (default 5)
 */
export async function fetchChannelRSS(
    channelId: string,
    channelName: string,
    maxResults = 5
): Promise<YouTubeVideo[]> {
    const now = Date.now();

    // L1 cache hit
    const cached = rssCache.get(channelId);
    if (cached && cached.expiresAt > now) {
        return cached.videos.slice(0, maxResults);
    }

    try {
        const url = `${RSS_BASE}${channelId}`;
        const response = await fetch(url, {
            headers: {
                // Identify as a feed reader, not a browser - YouTube doesn't restrict this
                'User-Agent': 'SahayakAI-FeedReader/1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml',
            },
            // 8 second timeout
            signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
            console.warn(`[RSS] Channel ${channelId} returned ${response.status}`);
            return [];
        }

        const xml = await response.text();
        const videos = parseRssFeed(xml, channelName);

        // Store in L1 cache
        rssCache.set(channelId, { videos, expiresAt: now + CHANNEL_CACHE_TTL });
        console.log(`[RSS] ✅ Loaded ${videos.length} videos from ${channelName}`);

        return videos.slice(0, maxResults);
    } catch (error: any) {
        if (error.name === 'TimeoutError') {
            console.warn(`[RSS] Timeout fetching channel ${channelName}`);
        } else {
            console.error(`[RSS] Failed to fetch ${channelName}:`, error.message);
        }
        return [];
    }
}

/**
 * Fetches videos from multiple channels in PARALLEL.
 * Aggregates and deduplicates results.
 *
 * @param channels - Array of {id, name} channel definitions
 * @param maxPerChannel - Videos to take per channel
 */
export async function fetchMultipleChannelsRSS(
    channels: Array<{ id: string; name: string }>,
    maxPerChannel = 3
): Promise<YouTubeVideo[]> {
    if (!channels.length) return [];

    const results = await Promise.allSettled(
        channels.map((ch) => fetchChannelRSS(ch.id, ch.name, maxPerChannel))
    );

    const seenIds = new Set<string>();
    const videos: YouTubeVideo[] = [];

    for (const result of results) {
        if (result.status === 'fulfilled') {
            for (const v of result.value) {
                if (!seenIds.has(v.id)) {
                    videos.push(v);
                    seenIds.add(v.id);
                }
            }
        }
    }

    return videos;
}

/**
 * Invalidates the RSS cache for a specific channel.
 * Call this if you detect stale data.
 */
export function invalidateChannelCache(channelId: string): void {
    rssCache.delete(channelId);
}

/** Get current RSS cache stats — useful for monitoring */
export function getRssCacheStats(): { size: number; channels: string[] } {
    return {
        size: rssCache.size,
        channels: Array.from(rssCache.keys()),
    };
}
