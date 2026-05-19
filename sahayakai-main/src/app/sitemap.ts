import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://sahayakai.com';

  return [
    // ââ Homepage ââ
    {
      url: `${baseUrl}/`,
      lastModified: '2026-05-09',
      changeFrequency: 'weekly',
      priority: 1.0,
    },

    // ââ Public marketing pages ââ
    {
      url: `${baseUrl}/about`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-schools`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: '2026-04-01',
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy-for-teachers`,
      lastModified: '2026-04-01',
      changeFrequency: 'yearly',
      priority: 0.3,
    },

    // ââ Feature pages (public, pre-auth landing) ââ
    {
      url: `${baseUrl}/lesson-plan`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/quiz-generator`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/worksheet-wizard`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/rubric-generator`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/visual-aid-designer`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/virtual-field-trip`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/video-storyteller`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/instant-answer`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/teacher-training`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/content-creator`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/attendance`,
      lastModified: '2026-05-01',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/community`,
      lastModified: '2026-05-01',
      changeFrequency: 'daily',
      priority: 0.7,
    },

    // ââ Blog posts (SEO-critical content) ââ
    {
      url: `${baseUrl}/blog`,
      lastModified: '2026-05-09',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/ai-lesson-plan-generator-india`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/ncert-lesson-plan-tool`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/quiz-generator-cbse-icse`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/teaching-assistant-app-indian-languages`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/offline-teaching-app-india`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/sahayak-ai-kya-hai`,
      lastModified: '2026-05-10',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/sahayakai-vs-chatgpt`,
      lastModified: '2026-05-10',
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog/sahayakai-vs-diksha`,
      lastModified: '2026-05-10',
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // ââ Hindi vernacular pages ââ
    {
      url: `${baseUrl}/hi`,
      lastModified: '2026-05-09',
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hi/ai-se-lesson-plan-kaise-banaye`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hi/ncert-lesson-plan-hindi`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/hi/shikshak-ke-liye-ai-app`,
      lastModified: '2026-05-01',
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // ââ Bengali vernacular pages ââ
    {
      url: `${baseUrl}/bn`,
      lastModified: '2026-05-09',
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // ââ Kannada vernacular pages ââ
    {
      url: `${baseUrl}/kn`,
      lastModified: '2026-05-09',
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // ââ Tamil vernacular pages ââ
    {
      url: `${baseUrl}/ta`,
      lastModified: '2026-05-09',
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // NOTE: Auth-gated pages (/my-library, /profile, /impact-dashboard,
    // /messages) are intentionally excluded. Googlebot cannot access them
    // and including them causes crawl errors.
  ];
}
