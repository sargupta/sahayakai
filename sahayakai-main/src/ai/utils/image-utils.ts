
import fetch from 'node-fetch';

/**
 * Fetches an image from a URL and converts it to a base64 data URI.
 * Handles both existing Data URIs (pass-through) and HTTP URLs.
 * 
 * @param imageUrl The URL or Data URI of the image.
 * @returns A promise that resolves to the base64 Data URI string.
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    // 1. If it's already a Data URI, return it as is.
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    // 2. Fetch the image from the URL.
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        return `data:${contentType};base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error("Error fetching image for AI context:", error);
        throw new Error(`Failed to process context image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
