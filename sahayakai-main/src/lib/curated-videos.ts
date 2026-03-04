/**
 * Curated fallback educational videos for Indian teachers.
 * These are used when YouTube API search returns empty results or fails.
 * Sourced from top Indian educational YouTube channels.
 */
import { YouTubeVideo } from './youtube';

export const CURATED_INDIAN_EDU_VIDEOS: Record<string, YouTubeVideo[]> = {
    pedagogy: [
        {
            id: 'wYCiJxGTGqA',
            title: 'NEP 2020 Key Highlights for Teachers | National Education Policy India',
            description: 'Complete overview of NEP 2020 implementation for classroom teachers.',
            thumbnail: 'https://i.ytimg.com/vi/wYCiJxGTGqA/hqdefault.jpg',
            channelTitle: 'Ministry of Education India',
            publishedAt: '2021-08-01T00:00:00Z',
        },
        {
            id: 'aQpVGK_3FAI',
            title: 'Active Learning Methods | NCF Classroom Strategies for Teachers',
            description: 'Engaging active learning techniques from NCERT curriculum framework.',
            thumbnail: 'https://i.ytimg.com/vi/aQpVGK_3FAI/hqdefault.jpg',
            channelTitle: 'NCERT Official',
            publishedAt: '2022-03-15T00:00:00Z',
        },
        {
            id: '9qVrWKBnHpk',
            title: 'Experiential Learning in Indian Schools | NEP Pedagogy Guide',
            description: 'How to implement experiential and activity-based learning in your classroom.',
            thumbnail: 'https://i.ytimg.com/vi/9qVrWKBnHpk/hqdefault.jpg',
            channelTitle: 'DIKSHA Official',
            publishedAt: '2022-07-20T00:00:00Z',
        },
    ],
    storytelling: [
        {
            id: 'iZVNGpSzKpY',
            title: 'Science Stories for Kids | Animated Stories for Class 4-8',
            description: 'Engaging animated science stories perfect for classroom use.',
            thumbnail: 'https://i.ytimg.com/vi/iZVNGpSzKpY/hqdefault.jpg',
            channelTitle: 'Khan Academy India',
            publishedAt: '2022-01-10T00:00:00Z',
        },
        {
            id: 'm8GKG_l7S7M',
            title: 'History of India | Animated Stories for Students | Class 6-8',
            description: 'Beautifully narrated stories of Indian history for young learners.',
            thumbnail: 'https://i.ytimg.com/vi/m8GKG_l7S7M/hqdefault.jpg',
            channelTitle: 'Lets Tute',
            publishedAt: '2021-11-05T00:00:00Z',
        },
        {
            id: 'jEHpSwn2Gos',
            title: 'Maths Made Easy | Story-Based Concepts for Class 5-7',
            description: 'Math concepts explained through engaging stories and illustrations.',
            thumbnail: 'https://i.ytimg.com/vi/jEHpSwn2Gos/hqdefault.jpg',
            channelTitle: 'Vedantu',
            publishedAt: '2022-05-18T00:00:00Z',
        },
    ],
    govtUpdates: [
        {
            id: 'Ns6NaFlzj2I',
            title: 'DIKSHA Portal for Teachers | How to Use DIKSHA for Digital Learning',
            description: 'Complete guide to using DIKSHA platform for teacher professional development.',
            thumbnail: 'https://i.ytimg.com/vi/Ns6NaFlzj2I/hqdefault.jpg',
            channelTitle: 'DIKSHA Official',
            publishedAt: '2022-09-01T00:00:00Z',
        },
        {
            id: '5j-xWxaL-OU',
            title: 'SWAYAM Online Courses for Teachers | Free Certification Courses India',
            description: 'Guide to enrolling in free teacher training courses on SWAYAM platform.',
            thumbnail: 'https://i.ytimg.com/vi/5j-xWxaL-OU/hqdefault.jpg',
            channelTitle: 'SWAYAM NPTEL',
            publishedAt: '2021-12-15T00:00:00Z',
        },
        {
            id: 'nLqPXEIW5lA',
            title: 'Right to Education Act | Key Points Every Teacher Must Know',
            description: 'Important provisions of Right to Education Act explained for teachers.',
            thumbnail: 'https://i.ytimg.com/vi/nLqPXEIW5lA/hqdefault.jpg',
            channelTitle: 'Unacademy',
            publishedAt: '2022-02-28T00:00:00Z',
        },
    ],
    courses: [
        {
            id: '4YdUBVIjlYI',
            title: 'Teacher Training Course | Classroom Management Techniques India',
            description: 'Proven classroom management strategies for Indian school teachers.',
            thumbnail: 'https://i.ytimg.com/vi/4YdUBVIjlYI/hqdefault.jpg',
            channelTitle: 'Teach India',
            publishedAt: '2022-04-10T00:00:00Z',
        },
        {
            id: 'BnK7iiD9FnA',
            title: 'Digital Tools for Teachers | Google Classroom & EdTech Tutorial',
            description: 'How to use digital tools to enhance your teaching effectiveness.',
            thumbnail: 'https://i.ytimg.com/vi/BnK7iiD9FnA/hqdefault.jpg',
            channelTitle: 'Google for Education',
            publishedAt: '2022-06-22T00:00:00Z',
        },
        {
            id: 'd_-H4yZ4ZbE',
            title: 'Remedial Teaching Strategies | How to Help Weak Students',
            description: 'Effective remedial teaching techniques for inclusive classrooms.',
            thumbnail: 'https://i.ytimg.com/vi/d_-H4yZ4ZbE/hqdefault.jpg',
            channelTitle: 'Vedantu Pro',
            publishedAt: '2021-10-08T00:00:00Z',
        },
    ],
    topRecommended: [
        {
            id: 'OmJ-4B-mS-Y',
            title: 'Khan Academy India | Best Channel for All Subjects',
            description: 'World-class education content in Hindi and English for Indian students.',
            thumbnail: 'https://i.ytimg.com/vi/OmJ-4B-mS-Y/hqdefault.jpg',
            channelTitle: 'Khan Academy India',
            publishedAt: '2022-08-15T00:00:00Z',
        },
        {
            id: 'Uqz5mXp7Tic',
            title: 'NCERT Class 5 Full Syllabus | All Subjects Explained Simply',
            description: 'Complete NCERT curriculum for Class 5 with simple explanations.',
            thumbnail: 'https://i.ytimg.com/vi/Uqz5mXp7Tic/hqdefault.jpg',
            channelTitle: 'Magnet Brains',
            publishedAt: '2022-03-01T00:00:00Z',
        },
        {
            id: 'oKKPuRRYlJQ',
            title: 'India\'s Best Teachers | Motivational Classroom Stories',
            description: 'Inspiring stories of teachers transforming rural Indian classrooms.',
            thumbnail: 'https://i.ytimg.com/vi/oKKPuRRYlJQ/hqdefault.jpg',
            channelTitle: 'Teach For India',
            publishedAt: '2021-09-20T00:00:00Z',
        },
    ],
};

/**
 * Returns curated videos for a category if live results are sparse.
 * Merges live results first, then fills with curated ones (deduplication).
 */
export function mergeCuratedVideos(
    liveVideos: Record<string, YouTubeVideo[]>
): Record<string, YouTubeVideo[]> {
    const result: Record<string, YouTubeVideo[]> = {};

    const categories = ['pedagogy', 'storytelling', 'govtUpdates', 'courses', 'topRecommended'];
    for (const cat of categories) {
        const live = liveVideos[cat] || [];
        const curated = CURATED_INDIAN_EDU_VIDEOS[cat] || [];

        // Deduplicate by id, prefer live results
        const seenIds = new Set(live.map(v => v.id));
        const extras = curated.filter(v => !seenIds.has(v.id));

        // Show live first, then curated to always ensure minimum 3 videos per category
        result[cat] = [...live, ...extras].slice(0, 6);
    }

    return result;
}
