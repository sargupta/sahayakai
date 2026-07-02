
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF hardening for server-side image fetches.
 *
 * `fetchImageAsBase64` runs on the server with a caller-supplied URL, so an
 * unguarded fetch let an attacker point it at internal services — most
 * critically the cloud metadata endpoint (169.254.169.254) to steal the
 * instance service-account token. We defend in depth:
 *   1. https only (data: URIs short-circuit before any network call)
 *   2. host allowlist — only the buckets/CDNs the app actually serves images from
 *   3. resolved-IP check — reject if the host resolves to a private / link-local
 *      / loopback address (blocks DNS-rebinding and raw-IP hosts)
 *   4. no redirects (a 3xx to an internal URL would bypass the checks above)
 *   5. response size cap
 */
const ALLOWED_IMAGE_HOSTS: readonly string[] = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'lh3.googleusercontent.com',
    'placehold.co',
];

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB

function isDisallowedIp(ip: string): boolean {
    // IPv4 private / loopback / link-local (incl. 169.254.169.254 metadata) / unspecified
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true;       // link-local + cloud metadata
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
        return false;
    }
    // IPv6 loopback / unspecified / unique-local / link-local
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
    if (lower.startsWith('fe80')) return true;                          // link-local
    // IPv4-mapped IPv6 (::ffff:169.254.169.254)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isDisallowedIp(mapped[1]);
    return false;
}

async function assertSafeImageUrl(imageUrl: string): Promise<void> {
    let url: URL;
    try {
        url = new URL(imageUrl);
    } catch {
        throw new Error('Invalid image URL');
    }
    if (url.protocol !== 'https:') {
        throw new Error('Blocked image URL: only https is allowed');
    }
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_IMAGE_HOSTS.includes(host)) {
        throw new Error(`Blocked image URL: host not allowed (${host})`);
    }
    // Guard against a raw-IP host and DNS-rebinding: resolve and inspect every
    // returned address. If the literal host is an IP, check it directly.
    if (isIP(host)) {
        if (isDisallowedIp(host)) throw new Error('Blocked image URL: private address');
    } else {
        const results = await lookup(host, { all: true });
        for (const { address } of results) {
            if (isDisallowedIp(address)) {
                throw new Error('Blocked image URL: host resolves to a private address');
            }
        }
    }
}

/**
 * Fetches an image from a URL and converts it to a base64 string.
 * Optimized to handle large buffers and minimize memory footprint.
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
    // If it's already a data URI, just return it (no network call).
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }

    await assertSafeImageUrl(imageUrl);

    const startTime = Date.now();
    try {
        // redirect:'error' — a 3xx to an internal URL would bypass the guard.
        const response = await fetch(imageUrl, { redirect: 'error' });
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        // Reject oversized bodies early via Content-Length when present.
        const declaredLen = Number(response.headers.get('content-length') ?? '0');
        if (declaredLen && declaredLen > MAX_IMAGE_BYTES) {
            throw new Error('Image exceeds maximum allowed size');
        }

        // Use arrayBuffer() which is often more memory-efficient in Node/Next environments
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
            throw new Error('Image exceeds maximum allowed size');
        }
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        console.log(`[ImageUtils] Fetched and converted image in ${Date.now() - startTime}ms. Size: ${Math.round(buffer.length / 1024)}KB`);

        return `data:${mimeType};base64,${base64}`;
    } catch (error) {
        console.error('[ImageUtils] Error fetching image:', error);
        throw error;
    }
}
