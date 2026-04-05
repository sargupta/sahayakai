import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default: allow all search crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/settings', '/notifications', '/review-panel', '/actions'],
      },
      // AI RETRIEVAL BOTS — ALLOW (these cite your content in search results)
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/settings'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: ['/api/', '/admin/', '/settings'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/settings'],
      },
      {
        userAgent: 'Claude-SearchBot',
        allow: '/',
        disallow: ['/api/', '/admin/', '/settings'],
      },
      // AI TRAINING BOTS — BLOCK (scrape for model training without attribution)
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'ClaudeBot',
        disallow: ['/'],
      },
      {
        userAgent: 'Google-Extended',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
      {
        userAgent: 'anthropic-ai',
        disallow: ['/'],
      },
      {
        userAgent: 'Bytespider',
        disallow: ['/'],
      },
    ],
    sitemap: 'https://sahayakai.com/sitemap.xml',
  };
}
