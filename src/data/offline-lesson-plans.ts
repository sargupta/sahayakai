import { LessonPlanOutput } from "@/ai/flows/lesson-plan-generator";

/**
 * Pre-written lesson plans for offline usage.
 * These are manually curated or pre-generated plans that are bundled with the app.
 * Keys are the NCERT Chapter IDs.
 */
export const offlineLessonPlans: Record<string, LessonPlanOutput> = {
    // Science - Photosynthesis
    'sci-7-1': {
        title: "Nutrition in Plants: Understanding Photosynthesis",
        gradeLevel: "7th Grade",
        subject: "Science",
        duration: "45 minutes",
        objectives: [
            "Define photosynthesis and its importance.",
            "Identify the raw materials required for photosynthesis.",
            "Explain the role of chlorophyll and sunlight."
        ],
        materials: [
            "Chalk and Blackboard",
            "Green leaf from school garden",
            "Textbook (Chapter 1)"
        ],
        activities: [
            {
                name: "Introduction (The Hungry Plant)",
                description: "Ask students: 'We eat food to get energy. Do plants eat food? How do they get energy?' Discuss their answers. Introduce the concept that plants 'cook' their own food using sunlight.",
                duration: "10 minutes"
            },
            {
                name: "The Kitchen of the Plant",
                description: "Draw a simple diagram of a plant on the blackboard. Label the leaf as the 'Kitchen'. Explain how roots bring water (ingredients) and leaves take sunlight (fire) to cook food.",
                duration: "20 minutes"
            },
            {
                name: "Leaf Observation",
                description: "Take students outside or bring leaves to class. Ask them to observe the green color (Chlorophyll) and explain that this green color helps catch sunlight.",
                duration: "15 minutes"
            }
        ],
        assessment: "Ask 3 students to explain the process of photosynthesis in their own words using the 'Kitchen' analogy."
    },

    // Math - Fractions
    'math-6-7': {
        title: "Introduction to Fractions",
        gradeLevel: "6th Grade",
        subject: "Mathematics",
        duration: "40 minutes",
        objectives: [
            "Understand the concept of a fraction as a part of a whole.",
            "Identify numerator and denominator.",
            "Represent simple fractions like 1/2, 1/4 visually."
        ],
        materials: [
            "Chalk and Blackboard",
            "Paper sheets (for folding)",
            "Roti or Bread (optional real-life example)"
        ],
        activities: [
            {
                name: "Paper Folding Activity",
                description: "Give each student a sheet of paper. Ask them to fold it once to make 2 equal parts. Explain that each part is 1/2. Fold again to make 4 parts (1/4).",
                duration: "15 minutes"
            },
            {
                name: "Blackboard Visualization",
                description: "Draw a circle (Roti) on the board. Divide it into 4 parts. Shade 1 part. Write '1/4' and explain: 1 is the shaded part (Numerator), 4 is the total parts (Denominator).",
                duration: "15 minutes"
            },
            {
                name: "Real-life Quiz",
                description: "Ask: 'If you share one guava equally with your friend, how much do you get?' (Answer: 1/2).",
                duration: "10 minutes"
            }
        ],
        assessment: "Draw different shapes on the board with shaded regions and ask students to write the fraction."
    },

    // Social Studies - Solar System
    'sst-6-geo-1': {
        title: "The Earth in the Solar System",
        gradeLevel: "6th Grade",
        subject: "Social Studies",
        duration: "45 minutes",
        objectives: [
            "Name the planets in the solar system.",
            "Understand the position of Earth.",
            "Differentiate between stars and planets."
        ],
        materials: [
            "Chalk and Blackboard",
            "Stones or balls of different sizes (to represent planets)"
        ],
        activities: [
            {
                name: "The Solar Family",
                description: "Draw the Sun on the left side of the board. Explain it is the head of the family. Draw planets in order. Use a mnemonic: 'My Very Efficient Mother Just Served Us Nuts' (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune).",
                duration: "20 minutes"
            },
            {
                name: "Role Play: Orbiting Planets",
                description: "Take students to the ground. One student is the Sun. Others are planets. Ask them to walk in circles (orbits) around the Sun at different speeds.",
                duration: "20 minutes"
            }
        ],
        assessment: "Ask students to draw the solar system in their notebooks and label Earth."
    }
};
