import React from 'react';

export function StructuredData() {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'EducationalOrganization'],
    name: 'SahayakAI',
    alternateName: ['Sahayak AI', 'SARGVISION'],
    url: 'https://sahayakai.com',
    logo: 'https://sahayakai.com/icons/icon-512x512.png',
    description:
      'The Operating System for Teaching in India. AI-powered teaching assistant for 1.01 crore Indian K-12 teachers across government and private schools. Voice-first, 11 Indian languages, 30 features, offline-optimized. Aligned to NCERT, CBSE, ICSE, and 28 state board curricula. Reduces lesson preparation time by 90%.',
    sameAs: [
      'https://twitter.com/sahayakai',
      'https://www.linkedin.com/company/sargvision',
      // Add these as profiles are created:
      // 'https://www.crunchbase.com/organization/sargvision',
      // 'https://www.g2.com/products/sahayakai',
      // 'https://www.producthunt.com/products/sahayakai',
      // 'https://angel.co/company/sargvision',
    ],
    foundingDate: '2024',
    areaServed: {
      '@type': 'Country',
      name: 'India',
      sameAs: 'https://en.wikipedia.org/wiki/India',
    },
    knowsAbout: [
      'K-12 Education',
      'EdTech',
      'AI Teaching Assistant',
      'Indian Curriculum',
      'NCERT',
      'CBSE',
      'ICSE',
      'State Board Education',
      'Lesson Planning',
      'NEP 2020',
    ],
    numberOfEmployees: {
      '@type': 'QuantitativeValue',
      minValue: 5,
      maxValue: 15,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      url: 'https://sahayakai.com',
      availableLanguage: ['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Kannada'],
    },
    founder: {
      '@type': 'Person',
      name: 'Sarit Arora',
      jobTitle: 'Founder & CEO',
      url: 'https://sahayakai.com/about',
      sameAs: [
        'https://www.linkedin.com/in/sarit-arora',
      ],
      worksFor: {
        '@type': 'Organization',
        name: 'SARGVISION',
      },
    },
  };

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SahayakAI',
    alternateName: 'Sahayak AI',
    description:
      'AI-powered lesson planning, quiz generation, worksheet creation, attendance tracking, and teaching assistant for Indian K-12 teachers. Supports 11 Indian languages, NCERT, CBSE, ICSE, and all state boards.',
    applicationCategory: 'EducationApplication',
    url: 'https://sahayakai.com',
    image: 'https://sahayakai.com/icons/icon-512x512.png',
    operatingSystem: 'Web',
    inLanguage: ['en', 'hi', 'bn', 'ta', 'te', 'kn', 'ml', 'gu', 'mr', 'pa', 'or'],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.7',
      ratingCount: '150',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'INR',
        description: '50 credits per month for individual teachers',
      },
      {
        '@type': 'Offer',
        name: 'Gold Plan',
        price: '149',
        priceCurrency: 'INR',
        description: '500 credits per month - ideal for active teachers',
      },
      {
        '@type': 'Offer',
        name: 'Premium Plan',
        price: '349',
        priceCurrency: 'INR',
        description: '2000 credits per month - for schools and institutions',
      },
    ],
    author: {
      '@type': 'Organization',
      name: 'SARGVISION',
      url: 'https://sahayakai.com',
    },
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: 'https://sahayakai.com',
    name: 'SahayakAI - The Operating System for Teaching in India',
    description:
      'AI-powered teaching assistant for Indian teachers. Lesson plans, quizzes, worksheets, visual aids, attendance tracking, and more.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://sahayakai.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const speakableSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'SahayakAI — The Operating System for Teaching in India',
    url: 'https://sahayakai.com',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: [
        'h1',
        '[data-speakable="true"]',
        '.answer-capsule',
        'meta[name="description"]',
      ],
    },
    inLanguage: ['en-IN', 'hi-IN'],
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is SahayakAI?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SahayakAI is an AI-powered teaching assistant built for India\'s 1.01 crore K-12 teachers across government and private schools. It reduces lesson preparation time by 90% (45 minutes to 5 minutes) through voice-first, multilingual AI that works in 11 Indian languages on low-bandwidth connections, aligned to NCERT, CBSE, ICSE, and 28 state board curricula.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which Indian languages does SahayakAI support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SahayakAI natively supports 11 Indian languages: Hindi, English, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Marathi, Punjabi, and Odia. All features including voice input, lesson planning, and quiz generation work in these languages.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does SahayakAI work offline?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. SahayakAI is built as an offline-first Progressive Web App (PWA) optimized for low-bandwidth connections common in rural and suburban India. Teachers can access previously generated content and core features without internet connectivity.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which curriculum boards does SahayakAI support?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SahayakAI supports all major Indian curriculum frameworks including NCERT, CBSE, ICSE, and all 28 state board curricula. It has 50,000+ curriculum mappings ensuring AI-generated content is aligned to the specific syllabus teachers need.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is SahayakAI free for teachers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SahayakAI offers a free plan with 50 credits per month for individual teachers. Schools and institutions can access the Gold plan at Rs 149/teacher/month (500 credits) or the Premium plan at Rs 349/teacher/month (2000 credits).',
        },
      },
      {
        '@type': 'Question',
        name: 'What features does SahayakAI offer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SahayakAI offers 30 AI-powered features including lesson plan generation, quiz creation, worksheet generation, visual aid creation, rubric builder, instant answers, teacher training modules, virtual field trips, attendance tracking, parent communication tools, and voice-to-text input in 11 languages.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is SahayakAI different from ChatGPT for teaching?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Unlike ChatGPT, SahayakAI has 50,000+ Indian curriculum mappings for NCERT, CBSE, ICSE and 28 state boards. It offers voice-first input in 11 Indian languages, works offline on low-bandwidth connections, and provides purpose-built teaching workflows (not general chat). ChatGPT has zero Indian curriculum mapping and requires English literacy.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(speakableSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
    </>
  );
}
