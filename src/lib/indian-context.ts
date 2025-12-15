/**
 * Indian Context Examples Database
 * Provides culturally relevant examples for rural Indian classrooms
 */

export const IndianContext = {
    // Food & Daily Life
    food: {
        common: ['roti', 'dal', 'rice', 'sabzi', 'chapati', 'paratha'],
        snacks: ['samosa', 'pakora', 'vada', 'bhujia', 'chivda'],
        sweets: ['jalebi', 'ladoo', 'barfi', 'gulab jamun', 'rasgulla'],
    },

    // Agriculture (very relevant for rural students)
    agriculture: {
        crops: ['wheat', 'rice', 'sugarcane', 'cotton', 'bajra', 'jowar', 'maize'],
        seasons: ['kharif', 'rabi', 'zaid'],
        tools: ['plough', 'sickle', 'spade', 'hoe', 'bullock cart'],
        activities: ['sowing', 'harvesting', 'threshing', 'winnowing', 'irrigation'],
    },

    // Weather & Seasons
    weather: {
        seasons: ['summer', 'monsoon', 'winter', 'spring', 'autumn'],
        phenomena: ['monsoon rains', 'heat wave', 'dust storm', 'fog', 'hailstorm'],
        temperatures: ['45°C in summer', '5°C in winter', '30°C average'],
    },

    // Geography
    geography: {
        rivers: ['Ganga', 'Yamuna', 'Brahmaputra', 'Narmada', 'Godavari', 'Krishna'],
        mountains: ['Himalayas', 'Western Ghats', 'Eastern Ghats', 'Aravalli', 'Vindhyas'],
        states: ['Maharashtra', 'Uttar Pradesh', 'Bihar', 'Rajasthan', 'Punjab', 'Tamil Nadu'],
        cities: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bangalore', 'Jaipur'],
    },

    // Festivals & Culture
    festivals: {
        major: ['Diwali', 'Holi', 'Eid', 'Christmas', 'Durga Puja', 'Pongal', 'Onam'],
        harvest: ['Baisakhi', 'Pongal', 'Makar Sankranti', 'Onam'],
        activities: ['rangoli', 'diyas', 'fireworks', 'sweets distribution', 'family gatherings'],
    },

    // Animals (familiar to rural students)
    animals: {
        domestic: ['cow', 'buffalo', 'goat', 'hen', 'dog', 'cat', 'bullock'],
        wild: ['elephant', 'tiger', 'peacock', 'monkey', 'snake', 'deer'],
        birds: ['crow', 'sparrow', 'parrot', 'pigeon', 'peacock', 'eagle'],
    },

    // Currency & Measurements
    money: {
        currency: '₹',
        common: ['₹1', '₹2', '₹5', '₹10', '₹20', '₹50', '₹100', '₹500'],
        contexts: ['buying vegetables', 'school fees', 'bus fare', 'selling crops'],
    },

    measurements: {
        traditional: ['bigha', 'katha', 'gaj', 'ser', 'maund'],
        modern: ['meter', 'kilometer', 'kilogram', 'liter'],
    },

    // Daily Activities
    dailyLife: {
        morning: ['fetching water', 'morning prayers', 'going to school', 'helping parents'],
        chores: ['sweeping', 'washing utensils', 'feeding animals', 'collecting firewood'],
        play: ['cricket', 'kabaddi', 'kho-kho', 'gilli-danda', 'marbles'],
    },

    // Transportation
    transport: {
        common: ['bus', 'bicycle', 'auto-rickshaw', 'bullock cart', 'tractor', 'train'],
        rural: ['walking', 'bicycle', 'bullock cart', 'tractor'],
    },

    // Historical Figures (Indian heroes)
    heroes: {
        freedom: ['Mahatma Gandhi', 'Bhagat Singh', 'Subhash Chandra Bose', 'Rani Lakshmibai'],
        scientists: ['C.V. Raman', 'APJ Abdul Kalam', 'Homi Bhabha', 'Vikram Sarabhai'],
        social: ['Dr. B.R. Ambedkar', 'Mother Teresa', 'Savitribai Phule'],
    },

    // School Context
    school: {
        subjects: ['Hindi', 'English', 'Mathematics', 'Science', 'Social Studies', 'Sanskrit'],
        activities: ['morning assembly', 'mid-day meal', 'sports period', 'library period'],
        items: ['slate', 'chalk', 'notebook', 'textbook', 'school bag', 'water bottle'],
    },
};

/**
 * Get context-appropriate examples for different subjects
 */
export function getContextExamples(subject: string, topic: string): string[] {
    const examples: Record<string, string[]> = {
        mathematics: [
            'If a farmer harvests 250 kg of wheat from one bigha and sells it at ₹25 per kg...',
            'A bus travels from Delhi to Jaipur (280 km) at 70 km/h...',
            'During Diwali, if you buy 5 boxes of sweets at ₹120 each...',
            'A rectangular field is 50 meters long and 30 meters wide...',
        ],
        science: [
            'Why do we see more mosquitoes during the monsoon season?',
            'How does a hand pump bring water from underground?',
            'Why do farmers use different crops in kharif and rabi seasons?',
            'What happens to water when we boil dal?',
        ],
        social_studies: [
            'How did the monsoon affect ancient Indian civilizations?',
            'Why is the Ganga considered important for North Indian agriculture?',
            'How did Mahatma Gandhi use non-violence in the freedom struggle?',
        ],
        english: [
            'Write a letter to your friend describing Diwali celebrations',
            'Describe a visit to a local market',
            'Write about helping your parents in farming',
        ],
    };

    return examples[subject.toLowerCase().replace(' ', '_')] || [];
}

/**
 * Replace Western examples with Indian equivalents
 */
export const exampleReplacements: Record<string, string> = {
    // Food
    pizza: 'paratha',
    burger: 'vada pav',
    sandwich: 'samosa',
    cake: 'ladoo',
    'ice cream': 'kulfi',

    // Weather
    snow: 'monsoon rain',
    winter: 'winter fog',
    autumn: 'post-monsoon season',

    // Geography
    'New York': 'Delhi',
    London: 'Mumbai',
    Paris: 'Jaipur',
    mountain: 'Himalayas',
    river: 'Ganga',

    // Currency
    dollar: 'rupee',
    '$': '₹',
    cent: 'paisa',

    // Sports
    football: 'cricket',
    baseball: 'kabaddi',

    // Animals
    reindeer: 'camel',
    'polar bear': 'elephant',
};

/**
 * Generate Indian context prompt addition
 */
export function getIndianContextPrompt(isRural: boolean = true): string {
    if (!isRural) return '';

    return `
**IMPORTANT - Indian Rural Context:**
- Use examples from Indian daily life (farming, local markets, festivals)
- Reference Indian geography (Ganga, Himalayas, monsoon, etc.)
- Use Indian currency (₹) and measurements
- Include culturally relevant examples (Diwali, cricket, roti, dal, etc.)
- Avoid Western examples (pizza, snow, dollars, etc.)
- Consider agricultural context (most families are farmers)
- Use simple, relatable scenarios from rural Indian life
- Reference Indian heroes and historical figures when relevant
`;
}

export default IndianContext;
