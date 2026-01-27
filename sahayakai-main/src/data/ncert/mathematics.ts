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
            { id: 'math-5-1', number: 1, title: 'The Fish Tale', titleHindi: 'मछली की कहानी', learningOutcomes: ['Understand large numbers'], keywords: ['large numbers'], estimatedPeriods: 8 },
            { id: 'math-5-2', number: 2, title: 'Shapes and Angles', titleHindi: 'आकार और कोण', learningOutcomes: ['Identify angles'], keywords: ['angles', 'shapes'], estimatedPeriods: 10 },
            { id: 'math-5-3', number: 3, title: 'How Many Squares?', titleHindi: 'कितने वर्ग?', learningOutcomes: ['Calculate area'], keywords: ['area', 'squares'], estimatedPeriods: 7 },
            { id: 'math-5-4', number: 4, title: 'Parts and Wholes', titleHindi: 'भाग और पूर्ण', learningOutcomes: ['Understand fractions'], keywords: ['fractions'], estimatedPeriods: 12 },
            { id: 'math-5-5', number: 5, title: 'Does it Look the Same?', titleHindi: 'क्या यह एक जैसा दिखता है?', learningOutcomes: ['Symmetry'], keywords: ['symmetry'], estimatedPeriods: 6 },
            { id: 'math-5-6', number: 6, title: 'Be My Multiple, I\'ll Be Your Factor', titleHindi: 'मैं तेरा गुणनखंड, तू मेरा गुणज', learningOutcomes: ['Factors and Multiples'], keywords: ['factors', 'multiples'], estimatedPeriods: 10 },
            { id: 'math-5-7', number: 7, title: 'Can You See the Pattern?', titleHindi: 'क्या तुम्हें पैटर्न दिखा?', learningOutcomes: ['Pattern recognition'], keywords: ['patterns'], estimatedPeriods: 8 },
            { id: 'math-5-8', number: 8, title: 'Mapping Your Way', titleHindi: 'नक्शा', learningOutcomes: ['Direction and maps'], keywords: ['maps', 'direction'], estimatedPeriods: 8 },
        ],
    },
    {
        grade: 6,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-6-1', number: 1, title: 'Knowing Our Numbers', titleHindi: 'अपनी संख्याओं को जानना', learningOutcomes: ['Large numbers'], keywords: ['numbers'], estimatedPeriods: 8 },
            { id: 'math-6-2', number: 2, title: 'Whole Numbers', titleHindi: 'पूर्ण संख्याएँ', learningOutcomes: ['Properties of whole numbers'], keywords: ['whole numbers'], estimatedPeriods: 10 },
            { id: 'math-6-3', number: 3, title: 'Playing with Numbers', titleHindi: 'संख्याओं के साथ खेलना', learningOutcomes: ['HCF and LCM'], keywords: ['HCF', 'LCM'], estimatedPeriods: 12 },
            { id: 'math-6-4', number: 4, title: 'Basic Geometrical Ideas', titleHindi: 'मूल ज्यामितीय विचार', learningOutcomes: ['Points, lines, planes'], keywords: ['geometry'], estimatedPeriods: 10 },
            { id: 'math-6-5', number: 5, title: 'Understanding Elementary Shapes', titleHindi: 'प्रारंभिक आकृतियों को समझना', learningOutcomes: ['Measure and classify angles'], keywords: ['shapes'], estimatedPeriods: 8 },
            { id: 'math-6-6', number: 6, title: 'Integers', titleHindi: 'पूर्णांक', learningOutcomes: ['Positive and negative numbers'], keywords: ['integers'], estimatedPeriods: 10 },
            { id: 'math-6-7', number: 7, title: 'Fractions', titleHindi: 'भिन्न', learningOutcomes: ['Compare fractions'], keywords: ['fractions'], estimatedPeriods: 12 },
            { id: 'math-6-8', number: 8, title: 'Decimals', titleHindi: 'दशमलव', learningOutcomes: ['Decimal notation'], keywords: ['decimals'], estimatedPeriods: 10 },
            { id: 'math-6-9', number: 9, title: 'Data Handling', titleHindi: 'आँकड़ों का प्रबंधन', learningOutcomes: ['Recording and organizing data'], keywords: ['data', 'graphs'], estimatedPeriods: 8 },
            { id: 'math-6-10', number: 10, title: 'Mensuration', titleHindi: 'क्षेत्रमिति', learningOutcomes: ['Perimeter and area'], keywords: ['mensuration', 'area'], estimatedPeriods: 10 },
            { id: 'math-6-11', number: 11, title: 'Algebra', titleHindi: 'बीजगणित', learningOutcomes: ['Introduction to variables'], keywords: ['algebra', 'variables'], estimatedPeriods: 10 },
            { id: 'math-6-12', number: 12, title: 'Ratio and Proportion', titleHindi: 'अनुपात और समानुपात', learningOutcomes: ['Compare quantities'], keywords: ['ratio', 'proportion'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 7,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-7-1', number: 1, title: 'Integers', titleHindi: 'पूर्णांक', learningOutcomes: ['Multiplication and division of integers'], keywords: ['integers'], estimatedPeriods: 10 },
            { id: 'math-7-2', number: 2, title: 'Fractions and Decimals', titleHindi: 'भिन्न और दशमलव', learningOutcomes: ['Multiply fractions'], keywords: ['fractions', 'decimals'], estimatedPeriods: 12 },
            { id: 'math-7-3', number: 3, title: 'Data Handling', titleHindi: 'आँकड़ों का प्रबंधन', learningOutcomes: ['Mean, median, mode'], keywords: ['data', 'statistics'], estimatedPeriods: 10 },
            { id: 'math-7-4', number: 4, title: 'Simple Equations', titleHindi: 'सरल समीकरण', learningOutcomes: ['Set up equations'], keywords: ['equations', 'algebra'], estimatedPeriods: 12 },
            { id: 'math-7-5', number: 5, title: 'Lines and Angles', titleHindi: 'रेखाएँ और कोण', learningOutcomes: ['Pairs of angles'], keywords: ['geometry'], estimatedPeriods: 10 },
            { id: 'math-7-6', number: 6, title: 'The Triangle and its Properties', titleHindi: 'त्रिभुज और उसके गुण', learningOutcomes: ['Sum of angles'], keywords: ['triangles'], estimatedPeriods: 10 },
            { id: 'math-7-7', number: 7, title: 'Congruence of Triangles', titleHindi: 'त्रिभुजों की सर्वांगसमता', learningOutcomes: ['ASA, SSS criteria'], keywords: ['triangles', 'congruence'], estimatedPeriods: 10 },
            { id: 'math-7-8', number: 8, title: 'Comparing Quantities', titleHindi: 'राशियों की तुलना', learningOutcomes: ['Percentage and profit/loss'], keywords: ['percentage', 'profit'], estimatedPeriods: 12 },
            { id: 'math-7-9', number: 9, title: 'Rational Numbers', titleHindi: 'परिमेय संख्याएँ', learningOutcomes: ['Addition and subtraction'], keywords: ['rational'], estimatedPeriods: 10 },
            { id: 'math-7-10', number: 10, title: 'Practical Geometry', titleHindi: 'प्रायोगिक ज्यामिति', learningOutcomes: ['Constructions'], keywords: ['geometry'], estimatedPeriods: 8 },
            { id: 'math-7-11', number: 11, title: 'Perimeter and Area', titleHindi: 'परिमाप और क्षेत्रफल', learningOutcomes: ['Circle area'], keywords: ['mensuration'], estimatedPeriods: 10 },
            { id: 'math-7-12', number: 12, title: 'Algebraic Expressions', titleHindi: 'बीजगणितीय व्यंजक', learningOutcomes: ['Terms and variables'], keywords: ['algebra'], estimatedPeriods: 10 },
            { id: 'math-7-13', number: 13, title: 'Exponents and Powers', titleHindi: 'घातांक और घात', learningOutcomes: ['Laws of exponents'], keywords: ['exponents'], estimatedPeriods: 8 },
        ],
    },
    {
        grade: 8,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-8-1', number: 1, title: 'Rational Numbers', titleHindi: 'परिमेय संख्याएँ', learningOutcomes: ['Closure properties'], keywords: ['rational'], estimatedPeriods: 12 },
            { id: 'math-8-2', number: 2, title: 'Linear Equations in One Variable', titleHindi: 'एक चर वाले रैखिक समीकरण', learningOutcomes: ['Solving equations'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-8-3', number: 3, title: 'Understanding Quadrilaterals', titleHindi: 'चतुर्भुजों को समझना', learningOutcomes: ['Polygons'], keywords: ['geometry'], estimatedPeriods: 10 },
            { id: 'math-8-4', number: 4, title: 'Introduction to Graphs', titleHindi: 'आलेखों से परिचय', learningOutcomes: ['Coordinate system'], keywords: ['graphs'], estimatedPeriods: 10 },
            { id: 'math-8-5', number: 5, title: 'Squares and Square Roots', titleHindi: 'वर्ग और वर्गमूल', learningOutcomes: ['Find roots'], keywords: ['roots', 'squares'], estimatedPeriods: 10 },
            { id: 'math-8-6', number: 6, title: 'Cubes and Cube Roots', titleHindi: 'घन और घनमूल', learningOutcomes: ['Volume correlation'], keywords: ['roots', 'cubes'], estimatedPeriods: 8 },
            { id: 'math-8-7', number: 7, title: 'Comparing Quantities', titleHindi: 'राशियों की तुलना', learningOutcomes: ['Compound interest'], keywords: ['interest', 'discount'], estimatedPeriods: 12 },
            { id: 'math-8-8', number: 8, title: 'Algebraic Expressions and Identities', titleHindi: 'बीजगणितीय व्यंजक और सर्वसमिकाएँ', learningOutcomes: ['Identities'], keywords: ['algebra'], estimatedPeriods: 12 },
            { id: 'math-8-9', number: 9, title: 'Mensuration', titleHindi: 'क्षेत्रमिति', learningOutcomes: ['Surface area and volume'], keywords: ['mensuration'], estimatedPeriods: 12 },
            { id: 'math-8-10', number: 10, title: 'Exponents and Powers', titleHindi: 'घातांक और घात', learningOutcomes: ['Negative exponents'], keywords: ['exponents'], estimatedPeriods: 10 },
            { id: 'math-8-11', number: 11, title: 'Direct and Inverse Proportions', titleHindi: 'सीधा और प्रतिलोम समानुपात', learningOutcomes: ['Proportional variations'], keywords: ['ratio'], estimatedPeriods: 10 },
            { id: 'math-8-12', number: 12, title: 'Factorization', titleHindi: 'गुणनखंडन', learningOutcomes: ['Common factors'], keywords: ['algebra'], estimatedPeriods: 12 },
        ],
    },
    {
        grade: 9,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-9-1', number: 1, title: 'Number Systems', titleHindi: 'संख्या पद्धति', learningOutcomes: ['Irrational numbers'], keywords: ['real numbers'], estimatedPeriods: 14 },
            { id: 'math-9-2', number: 2, title: 'Polynomials', titleHindi: 'बहुपद', learningOutcomes: ['Remainder theorem'], keywords: ['algebra'], estimatedPeriods: 16 },
            { id: 'math-9-3', number: 3, title: 'Coordinate Geometry', titleHindi: 'निर्देशांक ज्यामिति', learningOutcomes: ['Cartesian plane'], keywords: ['coordinates'], estimatedPeriods: 10 },
            { id: 'math-9-4', number: 4, title: 'Linear Equations in Two Variables', titleHindi: 'दो चर वाले रैखिक समीकरण', learningOutcomes: ['Graph equations'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-9-5', number: 5, title: 'Introduction to Euclid\'s Geometry', titleHindi: 'यूक्लिड की ज्यामिति का परिचय', learningOutcomes: ['Axioms and postulates'], keywords: ['geometry'], estimatedPeriods: 8 },
            { id: 'math-9-6', number: 6, title: 'Lines and Angles', titleHindi: 'रेखाएँ और कोण', learningOutcomes: ['Theorems on angles'], keywords: ['geometry'], estimatedPeriods: 12 },
            { id: 'math-9-7', number: 7, title: 'Triangles', titleHindi: 'त्रिभुज', learningOutcomes: ['SSS, SAS congruence'], keywords: ['triangles'], estimatedPeriods: 16 },
            { id: 'math-9-8', number: 8, title: 'Quadrilaterals', titleHindi: 'चतुर्भुज', learningOutcomes: ['Properties of parallelograms'], keywords: ['geometry'], estimatedPeriods: 12 },
            { id: 'math-9-9', number: 10, title: 'Circles', titleHindi: 'वृत्त', learningOutcomes: ['Circle theorems'], keywords: ['geometry'], estimatedPeriods: 14 },
            { id: 'math-9-10', number: 12, title: 'Heron\'s Formula', titleHindi: 'हीरोन का सूत्र', learningOutcomes: ['Area of triangle'], keywords: ['mensuration'], estimatedPeriods: 8 },
            { id: 'math-9-11', number: 13, title: 'Surface Areas and Volumes', titleHindi: 'पृष्ठीय क्षेत्रफल और आयतन', learningOutcomes: ['Cones and spheres'], keywords: ['mensuration'], estimatedPeriods: 12 },
            { id: 'math-9-12', number: 14, title: 'Statistics', titleHindi: 'सांख्यिकी', learningOutcomes: ['Bar graphs and histograms'], keywords: ['data'], estimatedPeriods: 12 },
        ],
    },
    {
        grade: 10,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-10-1', number: 1, title: 'Real Numbers', titleHindi: 'वास्तविक संख्याएँ', learningOutcomes: ['Fundamental theorem of arithmetic'], keywords: ['real numbers'], estimatedPeriods: 12 },
            { id: 'math-10-2', number: 2, title: 'Polynomials', titleHindi: 'बहुपद', learningOutcomes: ['Zeros and coefficients'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-10-3', number: 3, title: 'Pair of Linear Equations in Two Variables', titleHindi: 'दो चर वाले रैखिक समीकरणों का युग्म', learningOutcomes: ['Simultaneous solutions'], keywords: ['algebra'], estimatedPeriods: 16 },
            { id: 'math-10-4', number: 4, title: 'Quadratic Equations', titleHindi: 'द्विघात समीकरण', learningOutcomes: ['Nature of roots'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-10-5', number: 5, title: 'Arithmetic Progressions', titleHindi: 'समांतर श्रेणियाँ', learningOutcomes: ['Sum of n terms'], keywords: ['sequences'], estimatedPeriods: 12 },
            { id: 'math-10-6', number: 6, title: 'Triangles', titleHindi: 'त्रिभुज', learningOutcomes: ['Similarity rules'], keywords: ['triangles'], estimatedPeriods: 16 },
            { id: 'math-10-7', number: 7, title: 'Coordinate Geometry', titleHindi: 'निर्देशांक ज्यामिति', learningOutcomes: ['Section formula'], keywords: ['coordinates'], estimatedPeriods: 12 },
            { id: 'math-10-8', number: 8, title: 'Introduction to Trigonometry', titleHindi: 'त्रिकोणमिति का परिचय', learningOutcomes: ['Trigonometric ratios'], keywords: ['trigonometry'], estimatedPeriods: 14 },
            { id: 'math-10-9', number: 9, title: 'Some Applications of Trigonometry', titleHindi: 'त्रिकोणमिति के कुछ अनुप्रयोग', learningOutcomes: ['Heights and distances'], keywords: ['trigonometry'], estimatedPeriods: 12 },
            { id: 'math-10-10', number: 10, title: 'Circles', titleHindi: 'वृत्त', learningOutcomes: ['Tangent theorems'], keywords: ['geometry'], estimatedPeriods: 12 },
            { id: 'math-10-11', number: 12, title: 'Areas Related to Circles', titleHindi: 'वृत्तों से संबंधित क्षेत्रफल', learningOutcomes: ['Sector area'], keywords: ['mensuration'], estimatedPeriods: 10 },
            { id: 'math-10-12', number: 13, title: 'Surface Areas and Volumes', titleHindi: 'पृष्ठीय क्षेत्रफल और आयतन', learningOutcomes: ['Frustum properties'], keywords: ['mensuration'], estimatedPeriods: 14 },
            { id: 'math-10-13', number: 14, title: 'Statistics', titleHindi: 'सांख्यिकी', learningOutcomes: ['Mean of grouped data'], keywords: ['data'], estimatedPeriods: 12 },
            { id: 'math-10-14', number: 15, title: 'Probability', titleHindi: 'प्रायिकता', learningOutcomes: ['Theoretical probability'], keywords: ['probability'], estimatedPeriods: 10 },
        ],
    },
];

export default NCERTMathematics;
