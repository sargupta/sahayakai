/**
 * Quick Templates Database
 * Pre-defined templates for common topics to speed up lesson planning
 */

export interface QuickTemplate {
    id: string;
    title: string;
    titleHindi: string;
    topic: string;
    subject: string;
    gradeLevel: string;
    icon: string;
    color: string;
}

export const quickTemplates: QuickTemplate[] = [
    // Mathematics
    {
        id: 'math-fractions',
        title: 'Fractions',
        titleHindi: 'भिन्न',
        topic: 'Introduction to Fractions using daily life examples',
        subject: 'Mathematics',
        gradeLevel: '5th Grade',
        icon: 'Slice',
        color: 'bg-blue-100 text-blue-700',
    },
    {
        id: 'math-shapes',
        title: 'Basic Shapes',
        titleHindi: 'मूल आकार',
        topic: 'Identifying 2D shapes (Circle, Square, Triangle) in the classroom',
        subject: 'Mathematics',
        gradeLevel: '3rd Grade',
        icon: 'Triangle',
        color: 'bg-indigo-100 text-indigo-700',
    },
    {
        id: 'math-profit-loss',
        title: 'Profit & Loss',
        titleHindi: 'लाभ और हानि',
        topic: 'Understanding Profit and Loss using a village market scenario',
        subject: 'Mathematics',
        gradeLevel: '7th Grade',
        icon: 'Coins',
        color: 'bg-green-100 text-green-700',
    },

    // Science
    {
        id: 'sci-photosynthesis',
        title: 'Photosynthesis',
        titleHindi: 'प्रकाश संश्लेषण',
        topic: 'How plants make food (Photosynthesis) using sunlight',
        subject: 'Science',
        gradeLevel: '7th Grade',
        icon: 'Sprout',
        color: 'bg-emerald-100 text-emerald-700',
    },
    {
        id: 'sci-water-cycle',
        title: 'Water Cycle',
        titleHindi: 'जल चक्र',
        topic: 'The Water Cycle: Evaporation, Condensation, Precipitation',
        subject: 'Science',
        gradeLevel: '6th Grade',
        icon: 'Droplets',
        color: 'bg-cyan-100 text-cyan-700',
    },
    {
        id: 'sci-digestive',
        title: 'Digestive System',
        titleHindi: 'पाचन तंत्र',
        topic: 'Human Digestive System and healthy eating habits',
        subject: 'Science',
        gradeLevel: '7th Grade',
        icon: 'Apple',
        color: 'bg-rose-100 text-rose-700',
    },

    // Social Studies
    {
        id: 'sst-solar-system',
        title: 'Solar System',
        titleHindi: 'सौर मंडल',
        topic: 'The Solar System: Planets and the Sun',
        subject: 'Social Studies',
        gradeLevel: '6th Grade',
        icon: 'Orbit',
        color: 'bg-purple-100 text-purple-700',
    },
    {
        id: 'sst-india-map',
        title: 'Map of India',
        titleHindi: 'भारत का नक्शा',
        topic: 'States and Capitals of India',
        subject: 'Social Studies',
        gradeLevel: '5th Grade',
        icon: 'Map',
        color: 'bg-orange-100 text-orange-700',
    },
    {
        id: 'sst-panchayat',
        title: 'Gram Panchayat',
        titleHindi: 'ग्राम पंचायत',
        topic: 'Role and functions of Gram Panchayat in villages',
        subject: 'Social Studies',
        gradeLevel: '6th Grade',
        icon: 'Vote',
        color: 'bg-amber-100 text-amber-700',
    },

    // Languages
    {
        id: 'lang-noun',
        title: 'Nouns',
        titleHindi: 'संज्ञा',
        topic: 'Naming words (Nouns): Person, Place, Animal, Thing',
        subject: 'English',
        gradeLevel: '4th Grade',
        icon: 'FileEdit',
        color: 'bg-pink-100 text-pink-700',
    },
];
