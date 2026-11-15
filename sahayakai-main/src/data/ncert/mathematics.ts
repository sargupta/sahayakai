/**
 * CLASS IX UPDATED FOR CBSE 2026-27 (NCF-2023 scheme of studies).
 *
 * CBSE implemented the NCF-2023 scheme in Class IX from session 2026-27
 * (Circular Acad-14/2026, 01.04.2026). The grade-9 block below is rewritten
 * from the official syllabus:
 *   https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf
 *
 * 13 chapters -> 15. Renamed: Polynomials -> Introduction to Polynomials;
 * Triangles -> Triangles – Congruence Theorems (en dash, U+2013);
 * Quadrilaterals -> 4-gons (Quadrilaterals); Introduction to Euclid's Geometry
 * -> ...: Axioms and Postulates. NEW: Sequences and Progressions, Exploring
 * Algebraic Identities, Introduction to Probability. DROPPED: Heron's Formula,
 * Areas. Unit marks changed: 07/20/04/25/14/10 = 80 (was 10/20/04/27/13/06).
 * CBSE no longer prints a subject code for Class IX Mathematics.
 *
 * `estimatedPeriods` is DERIVED: CBSE publishes period totals per UNIT
 * (12/66/6/69/27/24) but not per chapter. `learningOutcomes` and `keywords`
 * are authored — CBSE publishes neither at chapter level.
 *
 * Class X is UNCHANGED for 2026-27 and is untouched here.
 * An optional Mathematics Advanced paper exists for Class IX 2026-27
 * (Sets, Logarithms, Relations and Functions, Coordinate Geometry,
 * Combinatorics, Exploring some more Progressions) — not yet modelled.
 */
/**
 * NCERT Mathematics Curriculum - Grades 1-12
 * Based on official NCERT syllabus
 */

export interface NCERTChapter {
    id: string;
    number: number;
    title: string;
    titleHindi?: string;
    textbookName: string;
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
        grade: 1,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-1-1', number: 1, title: 'Shapes and Space', titleHindi: 'आकृतियाँ और स्थान', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Identify basic shapes', 'Understand spatial positions'], keywords: ['shapes', 'space'], estimatedPeriods: 6 },
            { id: 'math-1-2', number: 2, title: 'Numbers from One to Nine', titleHindi: 'एक से नौ तक', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Count and write 1-9', 'One-to-one correspondence'], keywords: ['counting', 'numbers'], estimatedPeriods: 8 },
            { id: 'math-1-3', number: 3, title: 'Addition', titleHindi: 'जोड़', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Add single digit numbers', 'Understand addition concept'], keywords: ['addition', 'plus'], estimatedPeriods: 8 },
            { id: 'math-1-4', number: 4, title: 'Subtraction', titleHindi: 'घटाना', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Subtract single digit numbers', 'Understand subtraction'], keywords: ['subtraction', 'minus'], estimatedPeriods: 8 },
            { id: 'math-1-5', number: 5, title: 'Numbers from Ten to Twenty', titleHindi: 'दस से बीस तक', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Count 10-20', 'Place value of tens and ones'], keywords: ['numbers', 'tens'], estimatedPeriods: 7 },
            { id: 'math-1-6', number: 6, title: 'Time', titleHindi: 'समय', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Tell time on a clock', 'Days of the week'], keywords: ['time', 'clock', 'days'], estimatedPeriods: 6 },
            { id: 'math-1-7', number: 7, title: 'Measurement', titleHindi: 'मापन', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Compare length and weight', 'Non-standard measurement'], keywords: ['measurement', 'length'], estimatedPeriods: 6 },
            { id: 'math-1-8', number: 8, title: 'Numbers from Twenty-one to Fifty', titleHindi: 'इक्कीस से पचास तक', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Count 21-50', 'Two-digit numbers'], keywords: ['numbers', 'counting'], estimatedPeriods: 7 },
            { id: 'math-1-9', number: 9, title: 'Data Handling', titleHindi: 'आँकड़े', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Collect and organise data', 'Simple pictographs'], keywords: ['data', 'pictograph'], estimatedPeriods: 5 },
            { id: 'math-1-10', number: 10, title: 'Patterns', titleHindi: 'पैटर्न', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Identify and extend patterns'], keywords: ['patterns', 'sequence'], estimatedPeriods: 5 },
            { id: 'math-1-11', number: 11, title: 'Numbers from Fifty-one to One Hundred', titleHindi: 'इक्यावन से सौ तक', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Count beyond 50', 'Compare numbers'], keywords: ['numbers', 'hundred'], estimatedPeriods: 7 },
            { id: 'math-1-12', number: 12, title: 'Money', titleHindi: 'पैसा', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Identify coins and notes', 'Simple transactions'], keywords: ['money', 'coins', 'rupees'], estimatedPeriods: 5 },
            { id: 'math-1-13', number: 13, title: 'How Many?', titleHindi: 'कितने?', textbookName: 'Ganita ka Jadu / Math Magic 1', learningOutcomes: ['Estimate quantities', 'Count in groups'], keywords: ['counting', 'grouping'], estimatedPeriods: 5 },
        ],
    },
    {
        grade: 2,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-2-1', number: 1, title: 'What is Long, What is Round?', titleHindi: 'क्या लंबा है, क्या गोल है?', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Compare shapes', 'Identify 3D shapes'], keywords: ['shapes', 'measurement'], estimatedPeriods: 6 },
            { id: 'math-2-2', number: 2, title: 'Counting in Groups', titleHindi: 'समूहों में गिनना', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Count in 2s, 3s, 5s, 10s', 'Skip counting'], keywords: ['counting', 'groups'], estimatedPeriods: 8 },
            { id: 'math-2-3', number: 3, title: 'How Much Can You Carry?', titleHindi: 'तुम कितना उठा सकते हो?', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Compare weights', 'Use balance scale'], keywords: ['weight', 'balance'], estimatedPeriods: 6 },
            { id: 'math-2-4', number: 4, title: 'Counting in Tens', titleHindi: 'दहाई में गिनना', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Bundle tens', 'Place value up to 99'], keywords: ['tens', 'place value'], estimatedPeriods: 8 },
            { id: 'math-2-5', number: 5, title: 'Patterns', titleHindi: 'पैटर्न', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Extend number patterns', 'Repeating patterns'], keywords: ['patterns', 'sequence'], estimatedPeriods: 6 },
            { id: 'math-2-6', number: 6, title: 'Footprints', titleHindi: 'पैरों के निशान', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Measure area using non-standard units'], keywords: ['area', 'measurement'], estimatedPeriods: 5 },
            { id: 'math-2-7', number: 7, title: 'Jugs and Mugs', titleHindi: 'जग और मग', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Compare capacities', 'Measure liquids'], keywords: ['capacity', 'volume'], estimatedPeriods: 6 },
            { id: 'math-2-8', number: 8, title: 'Tens and Ones', titleHindi: 'दहाई और इकाई', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Understand place value', 'Add two-digit numbers'], keywords: ['place value', 'addition'], estimatedPeriods: 8 },
            { id: 'math-2-9', number: 9, title: 'My Funday', titleHindi: 'मेरा मज़ेदार दिन', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Read calendar', 'Days and months'], keywords: ['calendar', 'time', 'months'], estimatedPeriods: 5 },
            { id: 'math-2-10', number: 10, title: 'Add Our Points', titleHindi: 'हमारे अंक जोड़ो', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Addition with two-digit numbers', 'Word problems'], keywords: ['addition', 'word problems'], estimatedPeriods: 7 },
            { id: 'math-2-11', number: 11, title: 'Lines and Lines', titleHindi: 'रेखाएँ', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Identify straight and curved lines', 'Draw shapes'], keywords: ['lines', 'shapes', 'geometry'], estimatedPeriods: 5 },
            { id: 'math-2-12', number: 12, title: 'Give and Take', titleHindi: 'देना और लेना', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Subtraction with two-digit numbers'], keywords: ['subtraction'], estimatedPeriods: 8 },
            { id: 'math-2-13', number: 13, title: 'The Longest Step', titleHindi: 'सबसे लंबा कदम', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Measure length in non-standard units'], keywords: ['length', 'measurement'], estimatedPeriods: 5 },
            { id: 'math-2-14', number: 14, title: 'Birds Come, Birds Go', titleHindi: 'पक्षी आते हैं, पक्षी जाते हैं', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Addition and subtraction in context'], keywords: ['addition', 'subtraction'], estimatedPeriods: 6 },
            { id: 'math-2-15', number: 15, title: 'How Many Ponytails?', titleHindi: 'कितनी चोटियाँ?', textbookName: 'Ganita ka Jadu / Math Magic 2', learningOutcomes: ['Represent data', 'Read tally marks'], keywords: ['data', 'tally'], estimatedPeriods: 5 },
        ],
    },
    {
        grade: 3,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-3-1', number: 1, title: 'Where to Look From', titleHindi: 'किस दिशा से देखें', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Different perspectives', 'Top, front, side views'], keywords: ['perspective', 'shapes'], estimatedPeriods: 6 },
            { id: 'math-3-2', number: 2, title: 'Fun with Numbers', titleHindi: 'संख्याओं के साथ मज़ा', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Numbers up to 999', 'Comparison and ordering'], keywords: ['numbers', 'hundreds'], estimatedPeriods: 8 },
            { id: 'math-3-3', number: 3, title: 'Give and Take', titleHindi: 'देना और लेना', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Three-digit addition and subtraction', 'Carry and borrow'], keywords: ['addition', 'subtraction', '3-digit'], estimatedPeriods: 10 },
            { id: 'math-3-4', number: 4, title: 'Long and Short', titleHindi: 'लंबा और छोटा', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Measure in centimetres', 'Estimate and compare'], keywords: ['length', 'centimetre'], estimatedPeriods: 6 },
            { id: 'math-3-5', number: 5, title: 'Shapes and Designs', titleHindi: 'आकृतियाँ और डिज़ाइन', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Identify 2D shapes', 'Create patterns'], keywords: ['shapes', 'patterns', 'design'], estimatedPeriods: 7 },
            { id: 'math-3-6', number: 6, title: 'Fun with Give and Take', titleHindi: 'देने-लेने का मज़ा', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Word problems on addition and subtraction'], keywords: ['word problems', 'addition', 'subtraction'], estimatedPeriods: 8 },
            { id: 'math-3-7', number: 7, title: 'Time Goes On', titleHindi: 'समय चलता रहता है', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Read clock to 5 minutes', 'Duration of time'], keywords: ['time', 'clock', 'duration'], estimatedPeriods: 6 },
            { id: 'math-3-8', number: 8, title: 'Who is Heavier?', titleHindi: 'कौन भारी है?', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Weigh objects in grams and kilograms'], keywords: ['weight', 'grams', 'kilograms'], estimatedPeriods: 6 },
            { id: 'math-3-9', number: 9, title: 'How Many Times?', titleHindi: 'कितनी बार?', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Concept of multiplication', 'Repeated addition'], keywords: ['multiplication', 'repeated addition'], estimatedPeriods: 8 },
            { id: 'math-3-10', number: 10, title: 'Play with Patterns', titleHindi: 'पैटर्न से खेलो', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Extend and create number patterns'], keywords: ['patterns', 'sequences'], estimatedPeriods: 6 },
            { id: 'math-3-11', number: 11, title: 'Jugs and Mugs', titleHindi: 'जग और मग', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Measure capacity in litres'], keywords: ['capacity', 'litres'], estimatedPeriods: 6 },
            { id: 'math-3-12', number: 12, title: 'Can We Share?', titleHindi: 'क्या हम बाँट सकते हैं?', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Concept of division', 'Equal sharing'], keywords: ['division', 'sharing'], estimatedPeriods: 8 },
            { id: 'math-3-13', number: 13, title: 'Smart Charts!', titleHindi: 'स्मार्ट चार्ट!', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Collect data and make charts', 'Pictograph and bar graph'], keywords: ['data', 'charts', 'pictograph'], estimatedPeriods: 6 },
            { id: 'math-3-14', number: 14, title: 'Rupees and Paise', titleHindi: 'रुपये और पैसे', textbookName: 'Ganita ka Jadu / Math Magic 3', learningOutcomes: ['Money transactions'], keywords: ['money', 'rupees', 'paise'], estimatedPeriods: 7 },
        ],
    },
    {
        grade: 4,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-4-1', number: 1, title: 'Building with Bricks', titleHindi: 'ईंटों से बनाना', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Understand 3D shapes', 'Faces, edges, vertices'], keywords: ['3D shapes', 'geometry'], estimatedPeriods: 6 },
            { id: 'math-4-2', number: 2, title: 'Long and Short', titleHindi: 'लंबा और छोटा', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Measure in metres and centimetres', 'Convert units'], keywords: ['length', 'metres'], estimatedPeriods: 7 },
            { id: 'math-4-3', number: 3, title: 'A Trip to Bhopal', titleHindi: 'भोपाल की यात्रा', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Large number arithmetic', 'Word problems'], keywords: ['large numbers', 'word problems'], estimatedPeriods: 8 },
            { id: 'math-4-4', number: 4, title: 'Tick-Tick-Tick', titleHindi: 'टिक-टिक-टिक', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Read time to minutes', 'Calculate elapsed time'], keywords: ['time', 'minutes', 'clock'], estimatedPeriods: 6 },
            { id: 'math-4-5', number: 5, title: 'The Way the World Looks', titleHindi: 'दुनिया इस तरह दिखती है', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Map reading', 'Top view perspective'], keywords: ['map', 'direction', 'view'], estimatedPeriods: 6 },
            { id: 'math-4-6', number: 6, title: 'The Junk Seller', titleHindi: 'कबाड़ीवाला', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Multiplication up to 3 digits', 'Mental maths'], keywords: ['multiplication', 'mental maths'], estimatedPeriods: 10 },
            { id: 'math-4-7', number: 7, title: 'Jugs and Mugs', titleHindi: 'जग और मग', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Capacity in litres and millilitres'], keywords: ['capacity', 'litres'], estimatedPeriods: 6 },
            { id: 'math-4-8', number: 8, title: 'Carts and Wheels', titleHindi: 'गाड़ियाँ और पहिये', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Circles and their properties', 'Radius and diameter'], keywords: ['circles', 'radius', 'geometry'], estimatedPeriods: 6 },
            { id: 'math-4-9', number: 9, title: 'Halves and Quarters', titleHindi: 'आधे और चौथाई', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Fractions: half, quarter, three-quarter'], keywords: ['fractions', 'half', 'quarter'], estimatedPeriods: 8 },
            { id: 'math-4-10', number: 10, title: 'Play with Patterns', titleHindi: 'पैटर्न से खेलो', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Number patterns', 'Patterns in shapes'], keywords: ['patterns', 'sequences'], estimatedPeriods: 6 },
            { id: 'math-4-11', number: 11, title: 'Tables and Shares', titleHindi: 'टेबल और हिस्से', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Multiplication tables', 'Division as sharing'], keywords: ['multiplication tables', 'division'], estimatedPeriods: 10 },
            { id: 'math-4-12', number: 12, title: 'How Heavy? How Light?', titleHindi: 'कितना भारी? कितना हल्का?', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Measure weight', 'Kilogram and gram problems'], keywords: ['weight', 'kg'], estimatedPeriods: 7 },
            { id: 'math-4-13', number: 13, title: 'Fields and Fences', titleHindi: 'खेत और बाड़', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Calculate perimeter', 'Area using unit squares'], keywords: ['perimeter', 'area'], estimatedPeriods: 8 },
            { id: 'math-4-14', number: 14, title: 'Smart Charts!', titleHindi: 'स्मार्ट चार्ट!', textbookName: 'Ganita ka Jadu / Math Magic 4', learningOutcomes: ['Bar graphs and pictographs', 'Interpret data'], keywords: ['data', 'bar graph'], estimatedPeriods: 6 },
        ],
    },
    {
        grade: 5,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-5-1', number: 1, title: 'The Fish Tale', titleHindi: 'मछली की कहानी', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Understand large numbers'], keywords: ['large numbers'], estimatedPeriods: 8 },
            { id: 'math-5-2', number: 2, title: 'Shapes and Angles', titleHindi: 'आकार और कोण', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Identify angles'], keywords: ['angles', 'shapes'], estimatedPeriods: 10 },
            { id: 'math-5-3', number: 3, title: 'How Many Squares?', titleHindi: 'कितने वर्ग?', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Calculate area'], keywords: ['area', 'squares'], estimatedPeriods: 7 },
            { id: 'math-5-4', number: 4, title: 'Parts and Wholes', titleHindi: 'भाग और पूर्ण', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Understand fractions'], keywords: ['fractions'], estimatedPeriods: 12 },
            { id: 'math-5-5', number: 5, title: 'Does it Look the Same?', titleHindi: 'क्या यह एक जैसा दिखता है?', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Symmetry'], keywords: ['symmetry'], estimatedPeriods: 6 },
            { id: 'math-5-6', number: 6, title: 'Be My Multiple, I\'ll Be Your Factor', titleHindi: 'मैं तेरा गुणनखंड, तू मेरा गुणज', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Factors and Multiples'], keywords: ['factors', 'multiples'], estimatedPeriods: 10 },
            { id: 'math-5-7', number: 7, title: 'Can You See the Pattern?', titleHindi: 'क्या तुम्हें पैटर्न दिखा?', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Pattern recognition'], keywords: ['patterns'], estimatedPeriods: 8 },
            { id: 'math-5-8', number: 8, title: 'Mapping Your Way', titleHindi: 'नक्शा', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Direction and maps'], keywords: ['maps', 'direction'], estimatedPeriods: 8 },
            { id: 'math-5-9', number: 9, title: 'Boxes and Sketches', titleHindi: 'बक्से और रेखाचित्र', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['3D shapes and nets'], keywords: ['3D', 'nets'], estimatedPeriods: 7 },
            { id: 'math-5-10', number: 10, title: 'Tenths and Hundredths', titleHindi: 'दसवाँ और सौवाँ', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Decimals'], keywords: ['decimals', 'fractions'], estimatedPeriods: 8 },
            { id: 'math-5-11', number: 11, title: 'Area and its Boundary', titleHindi: 'क्षेत्र और सीमा', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Perimeter and area relationship'], keywords: ['area', 'perimeter'], estimatedPeriods: 8 },
            { id: 'math-5-12', number: 12, title: 'Smart Charts', titleHindi: 'स्मार्ट चार्ट', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Bar graphs', 'Data interpretation'], keywords: ['data', 'charts'], estimatedPeriods: 6 },
            { id: 'math-5-13', number: 13, title: 'Ways to Multiply and Divide', titleHindi: 'गुणा और भाग के तरीके', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Multi-digit multiplication and division'], keywords: ['multiplication', 'division'], estimatedPeriods: 10 },
            { id: 'math-5-14', number: 14, title: 'How Big? How Heavy?', titleHindi: 'कितना बड़ा? कितना भारी?', textbookName: 'Ganita ka Jadu / Math Magic 5', learningOutcomes: ['Volume and weight estimation'], keywords: ['volume', 'weight'], estimatedPeriods: 7 },
        ],
    },
    {
        grade: 6,
        subject: 'Mathematics',
        chapters: [
            // NCF-2023 textbook "Ganita Prakash" (2024) — replaced the old
            // rationalized "Mathematics" book. Verified against Tiwari Academy
            // + Vedantu chapter lists, 2026-08-13.
            { id: 'math-6-1', number: 1, title: 'Patterns in Mathematics', titleHindi: 'गणित में पैटर्न', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Recognise number and shape sequences', 'Relate patterns to rules'], keywords: ['patterns', 'sequences'], estimatedPeriods: 8 },
            { id: 'math-6-2', number: 2, title: 'Lines and Angles', titleHindi: 'रेखाएँ और कोण', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Identify points, lines, rays and segments', 'Measure and classify angles'], keywords: ['lines', 'angles', 'geometry'], estimatedPeriods: 10 },
            { id: 'math-6-3', number: 3, title: 'Number Play', titleHindi: 'संख्याओं का खेल', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Explore properties of numbers through games', 'Estimate and compare numbers'], keywords: ['numbers', 'estimation'], estimatedPeriods: 10 },
            { id: 'math-6-4', number: 4, title: 'Data Handling and Presentation', titleHindi: 'आँकड़ों का प्रबंधन और प्रस्तुतिकरण', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Collect and organise data', 'Draw and read pictographs and bar graphs'], keywords: ['data', 'graphs', 'pictograph'], estimatedPeriods: 8 },
            { id: 'math-6-5', number: 5, title: 'Prime Time', titleHindi: 'अभाज्य समय', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Identify prime and composite numbers', 'Find factors and multiples'], keywords: ['primes', 'factors', 'multiples'], estimatedPeriods: 10 },
            { id: 'math-6-6', number: 6, title: 'Perimeter and Area', titleHindi: 'परिमाप और क्षेत्रफल', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Compute perimeter and area of simple figures'], keywords: ['perimeter', 'area', 'mensuration'], estimatedPeriods: 10 },
            { id: 'math-6-7', number: 7, title: 'Fractions', titleHindi: 'भिन्न', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Represent and compare fractions', 'Add and subtract simple fractions'], keywords: ['fractions'], estimatedPeriods: 12 },
            { id: 'math-6-8', number: 8, title: 'Playing with Constructions', titleHindi: 'रचनाओं के साथ खेलना', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Use ruler and compass for basic constructions'], keywords: ['constructions', 'geometry', 'compass'], estimatedPeriods: 8 },
            { id: 'math-6-9', number: 9, title: 'Symmetry', titleHindi: 'सममिति', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Identify lines of symmetry', 'Recognise rotational symmetry'], keywords: ['symmetry', 'reflection'], estimatedPeriods: 6 },
            { id: 'math-6-10', number: 10, title: 'The Other Side of Zero', titleHindi: 'शून्य के दूसरी ओर', textbookName: 'Ganita Prakash 6', learningOutcomes: ['Understand negative numbers on the number line', 'Add and subtract integers'], keywords: ['integers', 'negative numbers', 'zero'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 7,
        subject: 'Mathematics',
        chapters: [
            // NCF-2023 "Ganita Prakash" Grade 7 (2025) — Part 1 ch.1-8, Part 2 ch.9-15
            // (book restarts numbering in Part 2; we number continuously for stable ids).
            { id: 'math-7-1', number: 1, title: 'Large Numbers Around Us', titleHindi: 'हमारे आस-पास बड़ी संख्याएँ', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Read and compare large numbers'], keywords: ['large numbers', 'estimation'], estimatedPeriods: 8 },
            { id: 'math-7-2', number: 2, title: 'Arithmetic Expressions', titleHindi: 'अंकगणितीय व्यंजक', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Evaluate expressions with brackets'], keywords: ['expressions', 'operations'], estimatedPeriods: 8 },
            { id: 'math-7-3', number: 3, title: 'A Peek Beyond the Point', titleHindi: 'दशमलव बिंदु से परे एक झलक', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Understand decimal quantities'], keywords: ['decimals', 'measurement'], estimatedPeriods: 10 },
            { id: 'math-7-4', number: 4, title: 'Expressions using Letter-Numbers', titleHindi: 'अक्षर-संख्याओं से व्यंजक', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Use letters to represent numbers'], keywords: ['algebra', 'variables'], estimatedPeriods: 10 },
            { id: 'math-7-5', number: 5, title: 'Parallel and Intersecting Lines', titleHindi: 'समांतर और प्रतिच्छेदी रेखाएँ', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Identify parallel and intersecting lines'], keywords: ['parallel lines', 'geometry'], estimatedPeriods: 8 },
            { id: 'math-7-6', number: 6, title: 'Number Play', titleHindi: 'संख्याओं का खेल', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Explore number patterns and puzzles'], keywords: ['numbers', 'patterns', 'puzzles'], estimatedPeriods: 8 },
            { id: 'math-7-7', number: 7, title: 'A Tale of Three Intersecting Lines', titleHindi: 'तीन प्रतिच्छेदी रेखाओं की कहानी', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Triangles and their properties'], keywords: ['triangles', 'geometry'], estimatedPeriods: 10 },
            { id: 'math-7-8', number: 8, title: 'Working with Fractions', titleHindi: 'भिन्नों के साथ काम', textbookName: 'Ganita Prakash 7 (Part 1)', learningOutcomes: ['Multiply and divide fractions'], keywords: ['fractions', 'operations'], estimatedPeriods: 12 },
            { id: 'math-7-9', number: 9, title: 'Geometric Twins', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Congruence of figures'], keywords: ['congruence', 'geometry'], estimatedPeriods: 8 },
            { id: 'math-7-10', number: 10, title: 'Operations with Integers', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Add, subtract, multiply and divide integers'], keywords: ['integers', 'operations'], estimatedPeriods: 10 },
            { id: 'math-7-11', number: 11, title: 'Finding Common Ground', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Common multiples and factors in context'], keywords: ['LCM', 'HCF', 'multiples'], estimatedPeriods: 8 },
            { id: 'math-7-12', number: 12, title: 'Another Peek Beyond the Point', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Operations on decimals'], keywords: ['decimals', 'operations'], estimatedPeriods: 10 },
            { id: 'math-7-13', number: 13, title: 'Connecting the Dots…', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Data representation and interpretation'], keywords: ['data', 'graphs'], estimatedPeriods: 8 },
            { id: 'math-7-14', number: 14, title: 'Constructions and Tilings', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Geometric constructions and tiling patterns'], keywords: ['constructions', 'tilings', 'geometry'], estimatedPeriods: 8 },
            { id: 'math-7-15', number: 15, title: 'Finding the Unknown', textbookName: 'Ganita Prakash 7 (Part 2)', learningOutcomes: ['Simple equations and solving for unknowns'], keywords: ['equations', 'algebra'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 8,
        subject: 'Mathematics',
        chapters: [
            // NCF-2023 "Ganita Prakash" Grade 8 (2025-26) — Part 1 ch.1-7, Part 2 ch.8-14
            // (continuous numbering convention; verified vs ncert.nic.in prelims TOCs).
            { id: 'math-8-1', number: 1, title: 'A Square and A Cube', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Squares, cubes and their roots'], keywords: ['squares', 'cubes', 'roots'], estimatedPeriods: 10 },
            { id: 'math-8-2', number: 2, title: 'Power Play', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Laws of exponents'], keywords: ['exponents', 'powers'], estimatedPeriods: 8 },
            { id: 'math-8-3', number: 3, title: 'A Story of Numbers', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Evolution of number systems'], keywords: ['number systems', 'history'], estimatedPeriods: 8 },
            { id: 'math-8-4', number: 4, title: 'Quadrilaterals', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Properties of quadrilaterals'], keywords: ['quadrilaterals', 'geometry'], estimatedPeriods: 10 },
            { id: 'math-8-5', number: 5, title: 'Number Play', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Number patterns and puzzles'], keywords: ['numbers', 'patterns', 'puzzles'], estimatedPeriods: 8 },
            { id: 'math-8-6', number: 6, title: 'We Distribute, Yet Things Multiply', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Distributivity and multiplication'], keywords: ['distributive law', 'multiplication'], estimatedPeriods: 8 },
            { id: 'math-8-7', number: 7, title: 'Proportional Reasoning-1', textbookName: 'Ganita Prakash 8 (Part 1)', learningOutcomes: ['Ratio and proportion in context'], keywords: ['ratio', 'proportion'], estimatedPeriods: 10 },
            { id: 'math-8-8', number: 8, title: 'Fractions in Disguise', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Rational numbers and their forms'], keywords: ['fractions', 'rational numbers'], estimatedPeriods: 10 },
            { id: 'math-8-9', number: 9, title: 'The Baudhayana-Pythagoras Theorem', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Right triangles and the Baudhayana-Pythagoras relation'], keywords: ['Pythagoras', 'Baudhayana', 'triangles'], estimatedPeriods: 10 },
            { id: 'math-8-10', number: 10, title: 'Proportional Reasoning-2', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Direct and inverse proportion'], keywords: ['proportion', 'variation'], estimatedPeriods: 10 },
            { id: 'math-8-11', number: 11, title: 'Exploring Some Geometric Themes', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Geometric explorations and patterns'], keywords: ['geometry', 'themes'], estimatedPeriods: 8 },
            { id: 'math-8-12', number: 12, title: 'Tales by Dots and Lines', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Graphs and networks with dots and lines'], keywords: ['graphs', 'networks'], estimatedPeriods: 8 },
            { id: 'math-8-13', number: 13, title: 'Algebra Play', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Algebraic expressions and identities'], keywords: ['algebra', 'expressions'], estimatedPeriods: 10 },
            { id: 'math-8-14', number: 14, title: 'Area', textbookName: 'Ganita Prakash 8 (Part 2)', learningOutcomes: ['Areas of plane figures'], keywords: ['area', 'mensuration'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 9,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-9-1', number: 1, title: 'Number System', titleHindi: 'संख्या पद्धति', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Irrational numbers, laws of exponents'], keywords: ['NCF-2023'], estimatedPeriods: 12 },
            { id: 'math-9-2', number: 2, title: 'Introduction to Polynomials', titleHindi: 'बहुपद', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Polynomials in one variable, remainder and factor theorem'], keywords: ['NCF-2023'], estimatedPeriods: 17 },
            { id: 'math-9-3', number: 3, title: 'Sequences and Progressions', titleHindi: 'अनुक्रम एवं श्रेढ़ियाँ', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Patterns leading to arithmetic progressions'], keywords: ['NCF-2023'], estimatedPeriods: 17 },
            { id: 'math-9-4', number: 4, title: 'Exploring Algebraic Identities', titleHindi: 'बीजीय सर्वसमिकाएँ', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Algebraic identities and their applications'], keywords: ['NCF-2023'], estimatedPeriods: 16 },
            { id: 'math-9-5', number: 5, title: 'Linear Equations in Two Variables', titleHindi: 'दो चर वाले रैखिक समीकरण', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Graph of a linear equation in two variables'], keywords: ['NCF-2023'], estimatedPeriods: 16 },
            { id: 'math-9-6', number: 6, title: 'Coordinate Geometry', titleHindi: 'निर्देशांक ज्यामिति', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Cartesian plane, plotting points'], keywords: ['NCF-2023'], estimatedPeriods: 6 },
            { id: 'math-9-7', number: 7, title: 'Introduction to Euclid\'s Geometry: Axioms and Postulates', titleHindi: 'यूक्लिड की ज्यामिति का परिचय', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Axioms, postulates and theorems'], keywords: ['NCF-2023'], estimatedPeriods: 13 },
            { id: 'math-9-8', number: 8, title: 'Lines and Angles', titleHindi: 'रेखाएँ और कोण', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Angle-pair theorems'], keywords: ['NCF-2023'], estimatedPeriods: 14 },
            { id: 'math-9-9', number: 9, title: 'Triangles – Congruence Theorems', titleHindi: 'त्रिभुज', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['SSS, SAS, ASA, RHS congruence'], keywords: ['NCF-2023'], estimatedPeriods: 14 },
            { id: 'math-9-10', number: 10, title: '4-gons (Quadrilaterals)', titleHindi: 'चतुर्भुज', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Properties of parallelograms'], keywords: ['NCF-2023'], estimatedPeriods: 14 },
            { id: 'math-9-11', number: 11, title: 'Circles', titleHindi: 'वृत्त', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Chord and angle theorems'], keywords: ['NCF-2023'], estimatedPeriods: 14 },
            { id: 'math-9-12', number: 12, title: 'Area and Perimeter', titleHindi: 'क्षेत्रफल एवं परिमाप', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Area of triangles and quadrilaterals'], keywords: ['NCF-2023'], estimatedPeriods: 13 },
            { id: 'math-9-13', number: 13, title: 'Surface Area and Volume', titleHindi: 'पृष्ठीय क्षेत्रफल और आयतन', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Cones, spheres, hemispheres'], keywords: ['NCF-2023'], estimatedPeriods: 14 },
            { id: 'math-9-14', number: 14, title: 'Statistics', titleHindi: 'सांख्यिकी', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Data handling, measures of central tendency'], keywords: ['NCF-2023'], estimatedPeriods: 12 },
            { id: 'math-9-15', number: 15, title: 'Introduction to Probability', titleHindi: 'प्रायिकता का परिचय', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Experimental probability'], keywords: ['NCF-2023'], estimatedPeriods: 12 },
        ],
    },
    {
        grade: 10,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-10-1', number: 1, title: 'Real Numbers', titleHindi: 'वास्तविक संख्याएँ', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Fundamental theorem of arithmetic'], keywords: ['real numbers'], estimatedPeriods: 12 },
            { id: 'math-10-2', number: 2, title: 'Polynomials', titleHindi: 'बहुपद', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Zeros and coefficients'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-10-3', number: 3, title: 'Pair of Linear Equations in Two Variables', titleHindi: 'दो चर वाले रैखिक समीकरणों का युग्म', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Simultaneous solutions'], keywords: ['algebra'], estimatedPeriods: 16 },
            { id: 'math-10-4', number: 4, title: 'Quadratic Equations', titleHindi: 'द्विघात समीकरण', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Nature of roots'], keywords: ['algebra'], estimatedPeriods: 14 },
            { id: 'math-10-5', number: 5, title: 'Arithmetic Progressions', titleHindi: 'समांतर श्रेणियाँ', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Sum of n terms'], keywords: ['sequences'], estimatedPeriods: 12 },
            { id: 'math-10-6', number: 6, title: 'Triangles', titleHindi: 'त्रिभुज', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Similarity rules'], keywords: ['triangles'], estimatedPeriods: 16 },
            { id: 'math-10-7', number: 7, title: 'Coordinate Geometry', titleHindi: 'निर्देशांक ज्यामिति', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Section formula'], keywords: ['coordinates'], estimatedPeriods: 12 },
            { id: 'math-10-8', number: 8, title: 'Introduction to Trigonometry', titleHindi: 'त्रिकोणमिति का परिचय', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Trigonometric ratios'], keywords: ['trigonometry'], estimatedPeriods: 14 },
            { id: 'math-10-9', number: 9, title: 'Some Applications of Trigonometry', titleHindi: 'त्रिकोणमिति के कुछ अनुप्रयोग', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Heights and distances'], keywords: ['trigonometry'], estimatedPeriods: 12 },
            { id: 'math-10-10', number: 10, title: 'Circles', titleHindi: 'वृत्त', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Tangent theorems'], keywords: ['geometry'], estimatedPeriods: 12 },
            { id: 'math-10-11', number: 11, title: 'Areas Related to Circles', titleHindi: 'वृत्तों से संबंधित क्षेत्रफल', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Sector area'], keywords: ['mensuration'], estimatedPeriods: 10 },
            { id: 'math-10-12', number: 12, title: 'Surface Areas and Volumes', titleHindi: 'पृष्ठीय क्षेत्रफल और आयतन', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Frustum properties'], keywords: ['mensuration'], estimatedPeriods: 14 },
            { id: 'math-10-13', number: 13, title: 'Statistics', titleHindi: 'सांख्यिकी', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Mean of grouped data'], keywords: ['data'], estimatedPeriods: 12 },
            { id: 'math-10-14', number: 14, title: 'Probability', titleHindi: 'प्रायिकता', textbookName: 'Ganit / Mathematics (NCERT)', learningOutcomes: ['Theoretical probability'], keywords: ['probability'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 11,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-11-1', number: 1, title: 'Sets', titleHindi: 'समुच्चय', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Set notation', 'Operations on sets'], keywords: ['sets', 'union', 'intersection'], estimatedPeriods: 14 },
            { id: 'math-11-2', number: 2, title: 'Relations and Functions', titleHindi: 'संबंध और फलन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Domain and range', 'Types of functions'], keywords: ['functions', 'relations'], estimatedPeriods: 16 },
            { id: 'math-11-3', number: 3, title: 'Trigonometric Functions', titleHindi: 'त्रिकोणमितीय फलन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Trigonometric identities', 'Graphs of trig functions'], keywords: ['trigonometry', 'sine', 'cosine'], estimatedPeriods: 18 },
            { id: 'math-11-4', number: 4, title: 'Principle of Mathematical Induction', titleHindi: 'गणितीय आगमन का सिद्धान्त', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Proof by induction'], keywords: ['induction', 'proof'], estimatedPeriods: 10 },
            { id: 'math-11-5', number: 5, title: 'Complex Numbers and Quadratic Equations', titleHindi: 'सम्मिश्र संख्याएँ और द्विघात समीकरण', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Imaginary unit', 'Argand plane'], keywords: ['complex numbers', 'quadratic'], estimatedPeriods: 16 },
            { id: 'math-11-6', number: 6, title: 'Linear Inequalities', titleHindi: 'रैखिक असमिकाएँ', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Solve inequalities', 'Graphical representation'], keywords: ['inequalities', 'algebra'], estimatedPeriods: 12 },
            { id: 'math-11-7', number: 7, title: 'Permutations and Combinations', titleHindi: 'क्रमचय और संचय', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Fundamental principle of counting', 'nCr and nPr'], keywords: ['permutations', 'combinations', 'counting'], estimatedPeriods: 16 },
            { id: 'math-11-8', number: 8, title: 'Binomial Theorem', titleHindi: 'द्विपद प्रमेय', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Binomial expansion', 'Pascal\'s triangle'], keywords: ['binomial', 'expansion'], estimatedPeriods: 14 },
            { id: 'math-11-9', number: 9, title: 'Sequences and Series', titleHindi: 'अनुक्रम और श्रेणी', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['AP and GP', 'Sum of series'], keywords: ['sequences', 'AP', 'GP'], estimatedPeriods: 16 },
            { id: 'math-11-10', number: 10, title: 'Straight Lines', titleHindi: 'सरल रेखाएँ', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Equation of line', 'Distance formula'], keywords: ['lines', 'slope', 'coordinate'], estimatedPeriods: 16 },
            { id: 'math-11-11', number: 11, title: 'Conic Sections', titleHindi: 'शंकु परिच्छेद', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Circle, ellipse, parabola, hyperbola'], keywords: ['conic sections', 'parabola', 'ellipse'], estimatedPeriods: 18 },
            { id: 'math-11-12', number: 12, title: 'Introduction to Three Dimensional Geometry', titleHindi: 'त्रिविमीय ज्यामिति का परिचय', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Coordinates in 3D', 'Distance in 3D'], keywords: ['3D geometry', 'coordinates'], estimatedPeriods: 12 },
            { id: 'math-11-13', number: 13, title: 'Limits and Derivatives', titleHindi: 'सीमा और अवकलज', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Concept of limit', 'First principles derivative'], keywords: ['limits', 'derivatives', 'calculus'], estimatedPeriods: 18 },
            { id: 'math-11-14', number: 14, title: 'Mathematical Reasoning', titleHindi: 'गणितीय विवेचन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Statements and connectives', 'Contrapositive'], keywords: ['logic', 'reasoning'], estimatedPeriods: 10 },
            { id: 'math-11-15', number: 15, title: 'Statistics', titleHindi: 'सांख्यिकी', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Mean deviation', 'Variance and standard deviation'], keywords: ['statistics', 'variance'], estimatedPeriods: 14 },
            { id: 'math-11-16', number: 16, title: 'Probability', titleHindi: 'प्रायिकता', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Random experiments', 'Event and probability'], keywords: ['probability', 'events'], estimatedPeriods: 14 },
        ],
    },
    {
        grade: 12,
        subject: 'Mathematics',
        chapters: [
            { id: 'math-12-1', number: 1, title: 'Relations and Functions', titleHindi: 'संबंध और फलन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Equivalence relations', 'Composite functions', 'Inverse functions'], keywords: ['functions', 'bijective'], estimatedPeriods: 16 },
            { id: 'math-12-2', number: 2, title: 'Inverse Trigonometric Functions', titleHindi: 'प्रतिलोम त्रिकोणमितीय फलन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Domain and range of inverse trig'], keywords: ['inverse', 'trigonometry'], estimatedPeriods: 14 },
            { id: 'math-12-3', number: 3, title: 'Matrices', titleHindi: 'आव्यूह', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Matrix operations', 'Types of matrices'], keywords: ['matrices', 'algebra'], estimatedPeriods: 16 },
            { id: 'math-12-4', number: 4, title: 'Determinants', titleHindi: 'सारणिक', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Evaluate determinants', 'Adjoint and inverse'], keywords: ['determinants'], estimatedPeriods: 16 },
            { id: 'math-12-5', number: 5, title: 'Continuity and Differentiability', titleHindi: 'सांतत्य और अवकलनीयता', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Continuous functions', 'Chain rule'], keywords: ['calculus', 'continuity', 'derivatives'], estimatedPeriods: 20 },
            { id: 'math-12-6', number: 6, title: 'Application of Derivatives', titleHindi: 'अवकलज के अनुप्रयोग', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Rate of change', 'Maxima and minima'], keywords: ['derivatives', 'optimization'], estimatedPeriods: 18 },
            { id: 'math-12-7', number: 7, title: 'Integrals', titleHindi: 'समाकलन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Indefinite integrals', 'Integration techniques'], keywords: ['integration', 'calculus'], estimatedPeriods: 22 },
            { id: 'math-12-8', number: 8, title: 'Application of Integrals', titleHindi: 'समाकलन के अनुप्रयोग', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Area under curves'], keywords: ['area', 'integration'], estimatedPeriods: 14 },
            { id: 'math-12-9', number: 9, title: 'Differential Equations', titleHindi: 'अवकल समीकरण', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Order and degree', 'Solving differential equations'], keywords: ['differential equations'], estimatedPeriods: 16 },
            { id: 'math-12-10', number: 10, title: 'Vector Algebra', titleHindi: 'सदिश बीजगणित', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Vector operations', 'Dot and cross product'], keywords: ['vectors', 'algebra'], estimatedPeriods: 16 },
            { id: 'math-12-11', number: 11, title: 'Three Dimensional Geometry', titleHindi: 'त्रिविमीय ज्यामिति', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Lines in 3D', 'Planes', 'Angle between planes'], keywords: ['3D geometry', 'planes'], estimatedPeriods: 18 },
            { id: 'math-12-12', number: 12, title: 'Linear Programming', titleHindi: 'रैखिक प्रोग्रामन', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Formulate LPP', 'Graphical method'], keywords: ['linear programming', 'optimization'], estimatedPeriods: 12 },
            { id: 'math-12-13', number: 13, title: 'Probability', titleHindi: 'प्रायिकता', textbookName: 'Ganit / Mathematics Part I & II', learningOutcomes: ['Conditional probability', 'Bayes theorem', 'Binomial distribution'], keywords: ['probability', 'Bayes theorem'], estimatedPeriods: 18 },
        ],
    },
];

export default NCERTMathematics;
