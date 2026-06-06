import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

// Cached file contents (read once per server instance to avoid blocking the event loop)
let cachedContent: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function loadContent(): Promise<string> {
  const now = Date.now();
  if (cachedContent !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedContent;
  }
  const filePath = path.join(process.cwd(), 'public', 'llms-full.txt');
  const content = await fs.readFile(filePath, 'utf-8');
  cachedContent = content;
  cachedAt = now;
  return content;
}

export async function GET() {
  try {
    const content = await loadContent();
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse('# SahayakAI — Full Reference\n\n> The Operating System for Teaching in India\n\nFor complete information visit https://sahayakai.com', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}
