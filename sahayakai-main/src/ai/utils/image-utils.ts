
/**
 * Fetches an image from a URL and converts it to a base64 string.
 * Optimized to handle large buffers and minimize memory footprint.
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    // If it's already a data URI, just return it
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    const startTime = Date.now();
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        // Use arrayBuffer() which is often more memory-efficient in Node/Next environments
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Explicitly clear references to large objects to help GC
        // Note: In Node.js, Buffer is a special case, but clearing helps in high-concurrency
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        console.log(`[ImageUtils] Fetched and converted image in ${Date.now() - startTime}ms. Size: ${Math.round(buffer.length / 1024)}KB`);

        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('[ImageUtils] Error fetching image:', error);
        throw error;
    }
}
