export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    duration?: string;
    viewCount?: string;
}

const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const cache: Record<string, { data: YouTubeVideo[]; timestamp: number }> = {};

import { getSecret } from './secrets';

/**
 * Searches for videos on YouTube using the provided query.
 * Implements basic in-memory caching to save API quota.
 */
export async function searchYouTube(query: string, maxResults = 5): Promise<YouTubeVideo[]> {
    let apiKey = '';
    try {
        apiKey = await getSecret('YOUTUBE_API_KEY');
    } catch (e) {
        console.error('Failed to get YOUTUBE_API_KEY:', e);
        return [];
    }

    // Check cache
    const cached = cache[query];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
                query
            )}&type=video&maxResults=${maxResults}&key=${apiKey}`
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error('YouTube API Error:', errorData);
            return [];
        }

        const data = await response.json();
        const videos: YouTubeVideo[] = data.items.map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
        }));

        // Update cache
        cache[query] = { data: videos, timestamp: Date.now() };

        return videos;
    } catch (error) {
        console.error('Failed to fetch from YouTube:', error);
        return [];
    }
}

/**
 * Categorizes and fetches videos for multiple categories.
 */
export async function getCategorizedVideos(
    queriesByCategory: Record<string, string[]>
): Promise<Record<string, YouTubeVideo[]>> {
    const results: Record<string, YouTubeVideo[]> = {};

    const categories = Object.keys(queriesByCategory);

    for (const category of categories) {
        const queries = queriesByCategory[category];
        // Take the first 2 queries from each category to fetch a mix
        const categoryVideos: YouTubeVideo[] = [];
        const seenIds = new Set<string>();

        for (const query of queries.slice(0, 2)) {
            const videos = await searchYouTube(query, 3);
            for (const v of videos) {
                if (!seenIds.has(v.id)) {
                    categoryVideos.push(v);
                    seenIds.add(v.id);
                }
            }
        }

        results[category] = categoryVideos;
    }

    return results;
}
