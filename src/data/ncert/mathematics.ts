/**
 * NCERT Mathematics Curriculum - Grades 5-10
 * Based on official NCERT syllabus
 */

export interface NCERTChapter {
    id: string;
    number: number;
    title: string;
    titleHindi?: string;
    learningOutcomes: string[];
    keywords: string[];
    estimatedPeriods: number;
}

export interface NCERTGrade {
    grade: number;
    subject: string;
    chapters: NCERTChapter[];
}

export const NCERTMathematics: NCERTGrade[] = [
    {
        grade: 5,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-5-1',
                number: 1,
                title: 'The Fish Tale',
                titleHindi: 'मछली की कहानी',
                learningOutcomes: [
                    'Understand large numbers up to 1 crore',
                    'Compare and order large numbers',
                    'Use place value in calculations',
                ],
                keywords: ['large numbers', 'place value', 'comparison', 'ordering'],
                estimatedPeriods: 8,
            },
            {
                id: 'math-5-2',
                number: 2,
                title: 'Shapes and Angles',
                titleHindi: 'आकार और कोण',
                learningOutcomes: [
                    'Identify different types of angles',
                    'Measure angles using protractor',
                    'Understand properties of triangles and quadrilaterals',
                ],
                keywords: ['angles', 'triangles', 'quadrilaterals', 'protractor', 'shapes'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-5-3',
                number: 3,
                title: 'How Many Squares?',
                titleHindi: 'कितने वर्ग?',
                learningOutcomes: [
                    'Calculate area using square units',
                    'Understand concept of area',
                    'Compare areas of different shapes',
                ],
                keywords: ['area', 'squares', 'measurement', 'units'],
                estimatedPeriods: 7,
            },
            {
                id: 'math-5-4',
                number: 4,
                title: 'Parts and Wholes',
                titleHindi: 'भाग और पूर्ण',
                learningOutcomes: [
                    'Understand fractions as parts of whole',
                    'Compare and order fractions',
                    'Add and subtract simple fractions',
                ],
                keywords: ['fractions', 'parts', 'whole', 'numerator', 'denominator'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-5-5',
                number: 5,
                title: 'Does it Look the Same?',
                titleHindi: 'क्या यह एक जैसा दिखता है?',
                learningOutcomes: [
                    'Identify symmetrical shapes',
                    'Draw lines of symmetry',
                    'Create symmetrical patterns',
                ],
                keywords: ['symmetry', 'patterns', 'reflection', 'mirror'],
                estimatedPeriods: 6,
            },
        ],
    },
    {
        grade: 6,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-6-1',
                number: 1,
                title: 'Knowing Our Numbers',
                titleHindi: 'अपनी संख्याओं को जानना',
                learningOutcomes: [
                    'Read and write large numbers',
                    'Compare numbers using symbols',
                    'Estimate and round off numbers',
                ],
                keywords: ['numbers', 'comparison', 'estimation', 'rounding'],
                estimatedPeriods: 8,
            },
            {
                id: 'math-6-2',
                number: 2,
                title: 'Whole Numbers',
                titleHindi: 'पूर्ण संख्याएँ',
                learningOutcomes: [
                    'Understand properties of whole numbers',
                    'Use number line for operations',
                    'Apply commutative and associative properties',
                ],
                keywords: ['whole numbers', 'properties', 'operations', 'number line'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-6-3',
                number: 3,
                title: 'Playing with Numbers',
                titleHindi: 'संख्याओं के साथ खेलना',
                learningOutcomes: [
                    'Find factors and multiples',
                    'Identify prime and composite numbers',
                    'Find HCF and LCM',
                ],
                keywords: ['factors', 'multiples', 'prime', 'composite', 'HCF', 'LCM'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-6-4',
                number: 4,
                title: 'Basic Geometrical Ideas',
                titleHindi: 'मूल ज्यामितीय विचार',
                learningOutcomes: [
                    'Identify points, lines, and planes',
                    'Understand line segments and rays',
                    'Recognize angles and their types',
                ],
                keywords: ['geometry', 'points', 'lines', 'angles', 'shapes'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-6-5',
                number: 5,
                title: 'Understanding Elementary Shapes',
                titleHindi: 'प्रारंभिक आकृतियों को समझना',
                learningOutcomes: [
                    'Measure and classify angles',
                    'Identify types of triangles',
                    'Understand properties of quadrilaterals',
                ],
                keywords: ['shapes', 'triangles', 'quadrilaterals', 'angles', 'measurement'],
                estimatedPeriods: 8,
            },
            {
                id: 'math-6-6',
                number: 6,
                title: 'Integers',
                titleHindi: 'पूर्णांक',
                learningOutcomes: [
                    'Understand positive and negative numbers',
                    'Represent integers on number line',
                    'Add and subtract integers',
                ],
                keywords: ['integers', 'positive', 'negative', 'number line', 'operations'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-6-7',
                number: 7,
                title: 'Fractions',
                titleHindi: 'भिन्न',
                learningOutcomes: [
                    'Compare and order fractions',
                    'Add and subtract fractions',
                    'Understand proper, improper, and mixed fractions',
                ],
                keywords: ['fractions', 'operations', 'comparison', 'mixed numbers'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-6-8',
                number: 8,
                title: 'Decimals',
                titleHindi: 'दशमलव',
                learningOutcomes: [
                    'Understand decimal notation',
                    'Compare and order decimals',
                    'Add, subtract, multiply, and divide decimals',
                ],
                keywords: ['decimals', 'place value', 'operations', 'money'],
                estimatedPeriods: 10,
            },
        ],
    },
    {
        grade: 7,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-7-1',
                number: 1,
                title: 'Integers',
                titleHindi: 'पूर्णांक',
                learningOutcomes: [
                    'Multiply and divide integers',
                    'Apply properties of integers',
                    'Solve problems involving integers',
                ],
                keywords: ['integers', 'multiplication', 'division', 'properties'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-7-2',
                number: 2,
                title: 'Fractions and Decimals',
                titleHindi: 'भिन्न और दशमलव',
                learningOutcomes: [
                    'Multiply and divide fractions',
                    'Convert fractions to decimals',
                    'Solve real-life problems',
                ],
                keywords: ['fractions', 'decimals', 'operations', 'conversion'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-7-3',
                number: 3,
                title: 'Data Handling',
                titleHindi: 'आँकड़ों का प्रबंधन',
                learningOutcomes: [
                    'Collect and organize data',
                    'Represent data using graphs',
                    'Calculate mean, median, and mode',
                ],
                keywords: ['data', 'graphs', 'mean', 'median', 'mode', 'statistics'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-7-4',
                number: 4,
                title: 'Simple Equations',
                titleHindi: 'सरल समीकरण',
                learningOutcomes: [
                    'Set up simple equations',
                    'Solve equations using trial and error',
                    'Apply equations to real-life situations',
                ],
                keywords: ['equations', 'variables', 'solving', 'algebra'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-7-5',
                number: 5,
                title: 'Lines and Angles',
                titleHindi: 'रेखाएँ और कोण',
                learningOutcomes: [
                    'Identify complementary and supplementary angles',
                    'Understand linear pairs',
                    'Work with parallel lines and transversals',
                ],
                keywords: ['lines', 'angles', 'parallel', 'transversal', 'geometry'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-7-6',
                number: 6,
                title: 'The Triangle and its Properties',
                titleHindi: 'त्रिभुज और उसके गुण',
                learningOutcomes: [
                    'Understand properties of triangles',
                    'Apply angle sum property',
                    'Identify congruent triangles',
                ],
                keywords: ['triangles', 'properties', 'angles', 'congruence'],
                estimatedPeriods: 10,
            },
        ],
    },
    {
        grade: 8,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-8-1',
                number: 1,
                title: 'Rational Numbers',
                titleHindi: 'परिमेय संख्याएँ',
                learningOutcomes: [
                    'Understand rational numbers',
                    'Represent rational numbers on number line',
                    'Perform operations on rational numbers',
                ],
                keywords: ['rational numbers', 'operations', 'number line', 'properties'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-8-2',
                number: 2,
                title: 'Linear Equations in One Variable',
                titleHindi: 'एक चर वाले रैखिक समीकरण',
                learningOutcomes: [
                    'Solve linear equations',
                    'Apply equations to word problems',
                    'Understand transposition method',
                ],
                keywords: ['equations', 'linear', 'variables', 'solving', 'word problems'],
                estimatedPeriods: 14,
            },
            {
                id: 'math-8-3',
                number: 3,
                title: 'Understanding Quadrilaterals',
                titleHindi: 'चतुर्भुजों को समझना',
                learningOutcomes: [
                    'Classify quadrilaterals',
                    'Understand properties of parallelograms',
                    'Calculate angles in quadrilaterals',
                ],
                keywords: ['quadrilaterals', 'parallelogram', 'properties', 'angles'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-8-4',
                number: 4,
                title: 'Practical Geometry',
                titleHindi: 'प्रायोगिक ज्यामिति',
                learningOutcomes: [
                    'Construct quadrilaterals',
                    'Use geometric tools accurately',
                    'Apply construction techniques',
                ],
                keywords: ['construction', 'geometry', 'quadrilaterals', 'tools'],
                estimatedPeriods: 8,
            },
        ],
    },
    {
        grade: 9,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-9-1',
                number: 1,
                title: 'Number Systems',
                titleHindi: 'संख्या पद्धति',
                learningOutcomes: [
                    'Understand real numbers',
                    'Represent irrational numbers on number line',
                    'Apply laws of exponents',
                ],
                keywords: ['real numbers', 'irrational', 'rational', 'exponents'],
                estimatedPeriods: 14,
            },
            {
                id: 'math-9-2',
                number: 2,
                title: 'Polynomials',
                titleHindi: 'बहुपद',
                learningOutcomes: [
                    'Identify polynomials',
                    'Factorize polynomials',
                    'Apply remainder theorem',
                ],
                keywords: ['polynomials', 'factorization', 'remainder theorem', 'algebra'],
                estimatedPeriods: 16,
            },
            {
                id: 'math-9-3',
                number: 3,
                title: 'Coordinate Geometry',
                titleHindi: 'निर्देशांक ज्यामिति',
                learningOutcomes: [
                    'Plot points on coordinate plane',
                    'Understand Cartesian system',
                    'Find distance between points',
                ],
                keywords: ['coordinates', 'cartesian plane', 'points', 'distance'],
                estimatedPeriods: 10,
            },
            {
                id: 'math-9-4',
                number: 4,
                title: 'Linear Equations in Two Variables',
                titleHindi: 'दो चर वाले रैखिक समीकरण',
                learningOutcomes: [
                    'Solve linear equations in two variables',
                    'Graph linear equations',
                    'Apply to real-life problems',
                ],
                keywords: ['linear equations', 'two variables', 'graphs', 'solutions'],
                estimatedPeriods: 14,
            },
            {
                id: 'math-9-5',
                number: 5,
                title: 'Introduction to Euclid\'s Geometry',
                titleHindi: 'यूक्लिड की ज्यामिति का परिचय',
                learningOutcomes: [
                    'Understand Euclid\'s definitions and axioms',
                    'Apply geometric reasoning',
                    'Prove simple theorems',
                ],
                keywords: ['Euclid', 'geometry', 'axioms', 'theorems', 'proofs'],
                estimatedPeriods: 8,
            },
        ],
    },
    {
        grade: 10,
        subject: 'Mathematics',
        chapters: [
            {
                id: 'math-10-1',
                number: 1,
                title: 'Real Numbers',
                titleHindi: 'वास्तविक संख्याएँ',
                learningOutcomes: [
                    'Apply Euclid\'s division algorithm',
                    'Find HCF using Euclid\'s algorithm',
                    'Understand fundamental theorem of arithmetic',
                ],
                keywords: ['real numbers', 'HCF', 'Euclid', 'prime factorization'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-10-2',
                number: 2,
                title: 'Polynomials',
                titleHindi: 'बहुपद',
                learningOutcomes: [
                    'Find zeros of polynomials',
                    'Understand relationship between zeros and coefficients',
                    'Divide polynomials',
                ],
                keywords: ['polynomials', 'zeros', 'coefficients', 'division'],
                estimatedPeriods: 14,
            },
            {
                id: 'math-10-3',
                number: 3,
                title: 'Pair of Linear Equations in Two Variables',
                titleHindi: 'दो चर वाले रैखिक समीकरणों का युग्म',
                learningOutcomes: [
                    'Solve simultaneous equations',
                    'Apply graphical method',
                    'Use algebraic methods (substitution, elimination)',
                ],
                keywords: ['linear equations', 'simultaneous', 'graphical', 'algebraic'],
                estimatedPeriods: 16,
            },
            {
                id: 'math-10-4',
                number: 4,
                title: 'Quadratic Equations',
                titleHindi: 'द्विघात समीकरण',
                learningOutcomes: [
                    'Solve quadratic equations by factorization',
                    'Apply quadratic formula',
                    'Understand nature of roots',
                ],
                keywords: ['quadratic', 'factorization', 'formula', 'roots', 'discriminant'],
                estimatedPeriods: 14,
            },
            {
                id: 'math-10-5',
                number: 5,
                title: 'Arithmetic Progressions',
                titleHindi: 'समांतर श्रेणियाँ',
                learningOutcomes: [
                    'Identify arithmetic progressions',
                    'Find nth term',
                    'Calculate sum of n terms',
                ],
                keywords: ['AP', 'arithmetic progression', 'nth term', 'sum', 'series'],
                estimatedPeriods: 12,
            },
            {
                id: 'math-10-6',
                number: 6,
                title: 'Triangles',
                titleHindi: 'त्रिभुज',
                learningOutcomes: [
                    'Prove similarity of triangles',
                    'Apply Pythagoras theorem',
                    'Use properties of similar triangles',
                ],
                keywords: ['triangles', 'similarity', 'Pythagoras', 'theorems', 'proofs'],
                estimatedPeriods: 16,
            },
        ],
    },
];

export default NCERTMathematics;
