import { getSecret } from './secrets';

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    channelId?: string;
    publishedAt: string;
    duration?: string;
    viewCount?: string;
}

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const cache: Record<string, { data: YouTubeVideo[]; timestamp: number }> = {};

/**
 * Searches for videos on YouTube using the provided query.
 * Implements basic in-memory caching to save API quota.
 * Uses regionCode=IN and videoCategoryId=27 (Education) for Bharat-First results.
 */
export async function searchYouTube(query: string, maxResults = 5): Promise<YouTubeVideo[]> {
    let apiKey = '';
    try {
        apiKey = await getSecret('YOUTUBE_API_KEY');
    } catch (e) {
        console.error('[YouTube] Failed to get YOUTUBE_API_KEY:', e);
        return [];
    }

    if (!apiKey) {
        console.error('[YouTube] YOUTUBE_API_KEY is empty after retrieval.');
        return [];
    }

    // Check cache
    const cacheKey = `${query}:${maxResults}`;
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const params = new URLSearchParams({
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults: String(maxResults),
            regionCode: 'IN',
            relevanceLanguage: 'hi,en',
            key: apiKey,
        });

        const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[YouTube] API Error:', response.status, JSON.stringify(errorData));
            return [];
        }

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            console.warn(`[YouTube] No results for query: "${query}"`);
            return [];
        }

        const videos: YouTubeVideo[] = data.items
            .filter((item: any) => item.id?.videoId) // skip playlist/channel results
            .map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnail:
                    item.snippet.thumbnails?.high?.url ||
                    item.snippet.thumbnails?.medium?.url ||
                    item.snippet.thumbnails?.default?.url,
                channelTitle: item.snippet.channelTitle,
                channelId: item.snippet.channelId,
                publishedAt: item.snippet.publishedAt,
            }));

        // Update cache
        cache[cacheKey] = { data: videos, timestamp: Date.now() };

        return videos;
    } catch (error) {
        console.error('[YouTube] Failed to fetch:', error);
        return [];
    }
}

/**
 * Fetches videos for multiple categories IN PARALLEL for speed.
 * Takes the first non-empty query for each category.
 */
export async function getCategorizedVideos(
    queriesByCategory: Record<string, string[]>
): Promise<Record<string, YouTubeVideo[]>> {
    const categories = Object.keys(queriesByCategory);

    // Fetch ALL categories in parallel
    const results = await Promise.all(
        categories.map(async (category) => {
            const queries = queriesByCategory[category];
            const categoryVideos: YouTubeVideo[] = [];
            const seenIds = new Set<string>();

            // Still use top 2 queries per category, but run THOSE in parallel too
            const videoArrays = await Promise.all(
                queries.slice(0, 2).map((q) => searchYouTube(q, 3))
            );

            for (const videos of videoArrays) {
                for (const v of videos) {
                    if (!seenIds.has(v.id)) {
                        categoryVideos.push(v);
                        seenIds.add(v.id);
                    }
                }
            }

            return [category, categoryVideos] as [string, YouTubeVideo[]];
        })
    );

    return Object.fromEntries(results);
}
