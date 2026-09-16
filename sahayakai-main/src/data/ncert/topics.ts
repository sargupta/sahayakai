/**
 * @fileOverview First-class NCERT topic taxonomy (Phase 4).
 *
 * Promotes topics to **chapter-independent** entries so a topic move becomes a
 * pure membership edit (zero re-tag) and a topic drop is a live `isActive` flip
 * — the cases chapter-level currency filtering cannot see (PLAN §5.3, §7).
 *
 * Scope (Decision M2): launch = CBSE **Class 9 & 10, Science & Mathematics** —
 * the only cells with blueprints + PYQ data. Other grades/subjects intentionally
 * carry no topics and degrade to chapter-level retrieval.
 *
 * Authoring source (Decision C — machine-seed then curate): topic titles are
 * grounded in the free-text `topic` clusters of `src/ai/data/pyq/consolidated_pyqs.json`
 * (the real questions) plus each chapter's `keywords`/`learningOutcomes`. Clean and
 * non-overlapping matters more than exhaustive; the Curriculum Owner refines later.
 *
 * Invariant 1 (retain, don't delete): topics removed from the current syllabus
 * are marked `isActive:false` and KEPT — the classification menu still offers
 * them so old PYQs map, but active-topic retrieval excludes them.
 *
 * Hindi titles (`titleHindi`) mirror the chapter-level `titleHindi` convention
 * and use standard NCERT Devanagari terminology. Currently internal classification
 * metadata (not yet user-visible) — groundwork so topic menus/labels can render
 * in Hindi without a re-authoring pass.
 *
 * Exports: `NCERTTopic`, `ALL_TOPICS`, `CHAPTER_TOPIC_IDS`, `getTopicById`.
 * Chapter-facing accessors (`getTopicMenu` / `getActiveTopicIds` / `isTopicActive`)
 * live in `src/ai/data/ncert-chapters.ts` — the seam other flows import.
 */

export interface NCERTTopic {
    /** Stable, opaque id. Scheme: `${subjectPrefix}-${grade}-t-${slug}`
     *  (e.g. 'sci-10-t-refraction'). Board is a FIELD, never encoded here (F3). */
    topicId: string;
    board: string;
    grade: number;
    /** Canonical NCERTSubject value, e.g. 'Science' | 'Mathematics'. */
    subject: string;
    title: string;
    titleHindi?: string;
    /** Former / variant titles that resolve to this topic (rename resilience). */
    aliases?: string[];
    /** Default true (undefined ⇒ active). false = off current syllabus, RETAINED. */
    isActive?: boolean;
    /** OPTIONAL — omit until the first split/merge (F12). */
    lineage?: { splitInto?: string[]; mergedInto?: string; supersededBy?: string };
}

/** Authoring shape — board/grade/subject are derived from the chapter id. */
interface TopicSeed {
    slug: string;
    title: string;
    /** Standard NCERT Devanagari rendering of `title`. Required at authoring time
     *  so no seed ships without a Hindi label. */
    titleHindi: string;
    aliases?: string[];
    /** true ⇒ rationalized out of the current syllabus (retained, not deleted). */
    inactive?: boolean;
}

const SUBJECT_BY_PREFIX: Record<string, string> = {
    sci: 'Science',
    math: 'Mathematics',
};

/**
 * Chapter → member topics. Keyed by the stable `NCERTChapter.id` (the join key
 * PYQ retrieval already uses). Slugs are unique within a `(prefix, grade)` since
 * the grade is baked into the topic id.
 */
const CHAPTER_TOPIC_SEEDS: Record<string, TopicSeed[]> = {
    // ─── Mathematics · Class 10 ───────────────────────────────────────────────
    'math-10-1': [
        { slug: 'fundamental-theorem-of-arithmetic', title: 'Fundamental Theorem of Arithmetic', titleHindi: 'अंकगणित की आधारभूत प्रमेय' },
        { slug: 'hcf-and-lcm', title: 'HCF and LCM', titleHindi: 'महत्तम समापवर्तक और लघुत्तम समापवर्त्य' },
        { slug: 'irrational-numbers', title: 'Irrational Numbers', titleHindi: 'अपरिमेय संख्याएँ' },
        { slug: 'terminating-decimals', title: 'Terminating and Non-Terminating Decimals', titleHindi: 'सांत और असांत दशमलव' },
        { slug: 'euclids-division-lemma', title: "Euclid's Division Lemma", titleHindi: 'यूक्लिड विभाजन प्रमेयिका', inactive: true },
    ],
    'math-10-2': [
        { slug: 'zeroes-of-a-polynomial', title: 'Zeroes of a Polynomial', titleHindi: 'बहुपद के शून्यक' },
        { slug: 'zeroes-and-coefficients', title: 'Relationship Between Zeroes and Coefficients', titleHindi: 'शून्यकों और गुणांकों के बीच संबंध' },
        { slug: 'forming-polynomial-from-zeroes', title: 'Forming a Polynomial from Zeroes', titleHindi: 'शून्यकों से बहुपद बनाना' },
        { slug: 'graphical-representation-of-polynomials', title: 'Graphical Representation of Polynomials', titleHindi: 'बहुपदों का आलेखीय निरूपण' },
        { slug: 'polynomial-division-algorithm', title: 'Division Algorithm for Polynomials', titleHindi: 'बहुपदों के लिए विभाजन एल्गोरिथ्म', inactive: true },
    ],
    'math-10-3': [
        { slug: 'graphical-method', title: 'Graphical Method of Solution', titleHindi: 'हल की आलेखीय विधि' },
        { slug: 'algebraic-methods', title: 'Algebraic Methods (Substitution and Elimination)', titleHindi: 'बीजगणितीय विधियाँ (प्रतिस्थापन और विलोपन)' },
        { slug: 'consistency-of-linear-equations', title: 'Consistency of a Pair of Linear Equations', titleHindi: 'रैखिक समीकरण युग्म की संगतता' },
        { slug: 'word-problems-linear-equations', title: 'Word Problems on Linear Equations', titleHindi: 'रैखिक समीकरणों पर शाब्दिक समस्याएँ' },
        { slug: 'cross-multiplication-method', title: 'Cross-Multiplication Method', titleHindi: 'वज्र-गुणन विधि', inactive: true },
        { slug: 'equations-reducible-to-linear', title: 'Equations Reducible to Linear Form', titleHindi: 'रैखिक रूप में समानेय समीकरण', inactive: true },
    ],
    'math-10-4': [
        { slug: 'roots-of-quadratic-equations', title: 'Roots of a Quadratic Equation', titleHindi: 'द्विघात समीकरण के मूल' },
        { slug: 'solving-by-factorisation', title: 'Solving by Factorisation', titleHindi: 'गुणनखंड द्वारा हल करना' },
        { slug: 'quadratic-formula', title: 'Solving by the Quadratic Formula', titleHindi: 'द्विघात सूत्र द्वारा हल करना' },
        { slug: 'nature-of-roots-discriminant', title: 'Nature of Roots and the Discriminant', titleHindi: 'मूलों की प्रकृति और विविक्तकर' },
        { slug: 'word-problems-quadratic', title: 'Word Problems on Quadratic Equations', titleHindi: 'द्विघात समीकरणों पर शाब्दिक समस्याएँ' },
    ],
    'math-10-5': [
        { slug: 'nth-term-of-ap', title: 'nth Term of an AP', titleHindi: 'समांतर श्रेढ़ी का n वाँ पद' },
        { slug: 'sum-of-ap', title: 'Sum of n Terms of an AP', titleHindi: 'समांतर श्रेढ़ी के n पदों का योग' },
        { slug: 'common-difference', title: 'Common Difference and Forming an AP', titleHindi: 'सार्व अंतर और समांतर श्रेढ़ी बनाना' },
        { slug: 'applications-of-ap', title: 'Applications of AP', titleHindi: 'समांतर श्रेढ़ी के अनुप्रयोग' },
    ],
    'math-10-6': [
        { slug: 'basic-proportionality-theorem', title: 'Basic Proportionality Theorem', titleHindi: 'आधारभूत समानुपातिकता प्रमेय', aliases: ['Thales Theorem'] },
        { slug: 'similarity-criteria', title: 'Criteria for Similarity of Triangles', titleHindi: 'त्रिभुजों की समरूपता की कसौटियाँ' },
        { slug: 'pythagoras-theorem', title: 'Pythagoras Theorem', titleHindi: 'पाइथागोरस प्रमेय' },
        { slug: 'areas-of-similar-triangles', title: 'Areas of Similar Triangles', titleHindi: 'समरूप त्रिभुजों के क्षेत्रफल', inactive: true },
    ],
    'math-10-7': [
        { slug: 'distance-formula', title: 'Distance Formula', titleHindi: 'दूरी सूत्र' },
        { slug: 'section-formula', title: 'Section Formula', titleHindi: 'विभाजन सूत्र' },
        { slug: 'midpoint-formula', title: 'Mid-point Formula', titleHindi: 'मध्य-बिंदु सूत्र' },
        { slug: 'collinearity-of-points', title: 'Collinearity of Points', titleHindi: 'बिंदुओं की संरेखता' },
        { slug: 'area-of-triangle-coordinate', title: 'Area of a Triangle (Coordinate Geometry)', titleHindi: 'त्रिभुज का क्षेत्रफल (निर्देशांक ज्यामिति)', inactive: true },
    ],
    'math-10-8': [
        { slug: 'trigonometric-ratios', title: 'Trigonometric Ratios', titleHindi: 'त्रिकोणमितीय अनुपात' },
        { slug: 'trig-ratios-specific-angles', title: 'Trigonometric Ratios of Specific Angles', titleHindi: 'कुछ विशिष्ट कोणों के त्रिकोणमितीय अनुपात' },
        { slug: 'trigonometric-identities', title: 'Trigonometric Identities', titleHindi: 'त्रिकोणमितीय सर्वसमिकाएँ' },
        { slug: 'complementary-angles', title: 'Trigonometric Ratios of Complementary Angles', titleHindi: 'पूरक कोणों के त्रिकोणमितीय अनुपात' },
    ],
    'math-10-9': [
        { slug: 'heights-and-distances', title: 'Heights and Distances', titleHindi: 'ऊँचाई और दूरी' },
        { slug: 'angle-of-elevation', title: 'Angle of Elevation', titleHindi: 'उन्नयन कोण' },
        { slug: 'angle-of-depression', title: 'Angle of Depression', titleHindi: 'अवनमन कोण' },
    ],
    'math-10-10': [
        { slug: 'tangent-to-a-circle', title: 'Tangent to a Circle', titleHindi: 'वृत्त की स्पर्श रेखा' },
        { slug: 'tangents-from-external-point', title: 'Number of Tangents from an External Point', titleHindi: 'बाह्य बिंदु से स्पर्श रेखाओं की संख्या' },
        { slug: 'tangent-perpendicular-radius', title: 'Tangent Perpendicular to the Radius', titleHindi: 'त्रिज्या पर लंब स्पर्श रेखा' },
    ],
    'math-10-11': [
        { slug: 'area-of-sector', title: 'Area of a Sector', titleHindi: 'त्रिज्यखंड का क्षेत्रफल' },
        { slug: 'area-of-segment', title: 'Area of a Segment', titleHindi: 'वृत्तखंड का क्षेत्रफल' },
        { slug: 'combinations-of-figures', title: 'Areas of Combinations of Plane Figures', titleHindi: 'समतल आकृतियों के संयोजनों के क्षेत्रफल' },
        { slug: 'perimeter-of-circle', title: 'Perimeter and Circumference', titleHindi: 'परिमाप और परिधि' },
    ],
    'math-10-12': [
        { slug: 'surface-area-combined-solids', title: 'Surface Area of a Combination of Solids', titleHindi: 'ठोसों के संयोजन का पृष्ठीय क्षेत्रफल' },
        { slug: 'volume-combined-solids', title: 'Volume of a Combination of Solids', titleHindi: 'ठोसों के संयोजन का आयतन' },
        { slug: 'volume-conservation', title: 'Conversion of Solids (Volume Conservation)', titleHindi: 'ठोसों का रूपांतरण (आयतन संरक्षण)' },
        { slug: 'frustum-of-cone', title: 'Frustum of a Cone', titleHindi: 'शंकु का छिन्नक', inactive: true },
    ],
    'math-10-13': [
        { slug: 'mean-grouped-data', title: 'Mean of Grouped Data', titleHindi: 'वर्गीकृत आँकड़ों का माध्य' },
        { slug: 'median-grouped-data', title: 'Median of Grouped Data', titleHindi: 'वर्गीकृत आँकड़ों की माध्यिका' },
        { slug: 'mode-grouped-data', title: 'Mode of Grouped Data', titleHindi: 'वर्गीकृत आँकड़ों का बहुलक' },
        { slug: 'empirical-relationship', title: 'Empirical Relationship (Mean, Median, Mode)', titleHindi: 'आनुभविक संबंध (माध्य, माध्यिका, बहुलक)' },
        { slug: 'ogive', title: 'Cumulative Frequency and Ogive', titleHindi: 'संचयी बारंबारता और तोरण', inactive: true },
    ],
    'math-10-14': [
        { slug: 'classical-probability', title: 'Classical (Theoretical) Probability', titleHindi: 'चिरसम्मत (सैद्धांतिक) प्रायिकता' },
        { slug: 'probability-dice', title: 'Probability with Dice', titleHindi: 'पासों के साथ प्रायिकता' },
        { slug: 'probability-cards', title: 'Probability with Playing Cards', titleHindi: 'ताश के पत्तों के साथ प्रायिकता' },
        { slug: 'complementary-events-probability', title: 'Complementary Events', titleHindi: 'पूरक घटनाएँ' },
    ],

    // ─── Mathematics · Class 9 ────────────────────────────────────────────────
    'math-9-1': [
        { slug: 'irrational-numbers', title: 'Irrational Numbers', titleHindi: 'अपरिमेय संख्याएँ' },
        { slug: 'rationalisation', title: 'Rationalisation of Surds', titleHindi: 'करणी का परिमेयकरण' },
        { slug: 'laws-of-exponents', title: 'Laws of Exponents for Real Numbers', titleHindi: 'वास्तविक संख्याओं के लिए घातांक के नियम' },
        { slug: 'operations-on-real-numbers', title: 'Operations on Real Numbers', titleHindi: 'वास्तविक संख्याओं पर संक्रियाएँ' },
        { slug: 'recurring-decimals', title: 'Representing Decimals as Fractions', titleHindi: 'दशमलव को भिन्न के रूप में निरूपित करना' },
    ],
    'math-9-2': [
        { slug: 'remainder-theorem', title: 'Remainder Theorem', titleHindi: 'शेषफल प्रमेय' },
        { slug: 'factor-theorem', title: 'Factor Theorem', titleHindi: 'गुणनखंड प्रमेय' },
        { slug: 'algebraic-identities', title: 'Algebraic Identities', titleHindi: 'बीजगणितीय सर्वसमिकाएँ' },
        { slug: 'factorisation-of-polynomials', title: 'Factorisation of Polynomials', titleHindi: 'बहुपदों का गुणनखंडन' },
        { slug: 'zeroes-and-degree', title: 'Zeroes and Degree of a Polynomial', titleHindi: 'बहुपद के शून्यक और घात' },
    ],
    'math-9-3': [
        { slug: 'cartesian-plane', title: 'The Cartesian Plane', titleHindi: 'कार्तीय तल' },
        { slug: 'quadrants-and-axes', title: 'Quadrants and Axes', titleHindi: 'चतुर्थांश और अक्ष' },
        { slug: 'plotting-points', title: 'Plotting a Point in the Plane', titleHindi: 'तल में बिंदु आलेखित करना' },
    ],
    'math-9-4': [
        { slug: 'solutions-linear-equations', title: 'Solutions of a Linear Equation', titleHindi: 'रैखिक समीकरण के हल' },
        { slug: 'graph-of-linear-equation', title: 'Graph of a Linear Equation', titleHindi: 'रैखिक समीकरण का आलेख' },
        { slug: 'word-problems-linear', title: 'Word Problems on Linear Equations', titleHindi: 'रैखिक समीकरणों पर शाब्दिक समस्याएँ' },
    ],
    'math-9-5': [
        { slug: 'euclids-axioms', title: "Euclid's Axioms and Postulates", titleHindi: 'यूक्लिड के अभिगृहीत और अभिधारणाएँ' },
        { slug: 'euclids-definitions', title: "Euclid's Definitions", titleHindi: 'यूक्लिड की परिभाषाएँ' },
    ],
    'math-9-6': [
        { slug: 'parallel-lines-transversal', title: 'Parallel Lines and a Transversal', titleHindi: 'समांतर रेखाएँ और एक तिर्यक रेखा' },
        { slug: 'angle-sum-triangle', title: 'Angle Sum Property of a Triangle', titleHindi: 'त्रिभुज का कोण योग गुणधर्म' },
        { slug: 'pairs-of-angles', title: 'Pairs of Angles (Supplementary, Vertically Opposite)', titleHindi: 'कोणों के युग्म (संपूरक, शीर्षाभिमुख)' },
    ],
    'math-9-7': [
        { slug: 'congruence-criteria', title: 'Congruence Criteria (SSS, SAS, ASA)', titleHindi: 'सर्वांगसमता की कसौटियाँ (SSS, SAS, ASA)' },
        { slug: 'isosceles-triangle-properties', title: 'Properties of Isosceles Triangles', titleHindi: 'समद्विबाहु त्रिभुजों के गुणधर्म' },
        { slug: 'triangle-inequalities', title: 'Inequalities in a Triangle', titleHindi: 'त्रिभुज में असमिकाएँ' },
    ],
    'math-9-8': [
        { slug: 'properties-of-parallelograms', title: 'Properties of a Parallelogram', titleHindi: 'समांतर चतुर्भुज के गुणधर्म' },
        { slug: 'angle-sum-quadrilateral', title: 'Angle Sum Property of a Quadrilateral', titleHindi: 'चतुर्भुज का कोण योग गुणधर्म' },
        { slug: 'midpoint-theorem', title: 'Mid-point Theorem', titleHindi: 'मध्य-बिंदु प्रमेय' },
    ],
    'math-9-9': [
        { slug: 'angle-subtended-by-arc', title: 'Angle Subtended by a Chord or Arc', titleHindi: 'जीवा या चाप द्वारा अंतरित कोण' },
        { slug: 'equal-chords', title: 'Equal Chords and Their Distances from the Centre', titleHindi: 'बराबर जीवाएँ और केंद्र से उनकी दूरियाँ' },
        { slug: 'perpendicular-from-centre', title: 'Perpendicular from the Centre to a Chord', titleHindi: 'केंद्र से जीवा पर लंब' },
        { slug: 'cyclic-quadrilaterals', title: 'Cyclic Quadrilaterals', titleHindi: 'चक्रीय चतुर्भुज' },
    ],
    'math-9-10': [
        { slug: 'heron-triangle-area', title: "Area of a Triangle by Heron's Formula", titleHindi: 'हीरोन के सूत्र द्वारा त्रिभुज का क्षेत्रफल' },
        { slug: 'heron-application', title: "Application of Heron's Formula", titleHindi: 'हीरोन के सूत्र का अनुप्रयोग' },
    ],
    'math-9-11': [
        { slug: 'cylinder-surface-volume', title: 'Surface Area and Volume of a Cylinder', titleHindi: 'बेलन का पृष्ठीय क्षेत्रफल और आयतन' },
        { slug: 'cone-surface-volume', title: 'Surface Area and Volume of a Cone', titleHindi: 'शंकु का पृष्ठीय क्षेत्रफल और आयतन' },
        { slug: 'sphere-surface-volume', title: 'Surface Area and Volume of a Sphere and Hemisphere', titleHindi: 'गोले और अर्धगोले का पृष्ठीय क्षेत्रफल और आयतन' },
        { slug: 'volume-conservation', title: 'Conversion of Solids (Volume Conservation)', titleHindi: 'ठोसों का रूपांतरण (आयतन संरक्षण)' },
    ],
    'math-9-12': [
        { slug: 'frequency-distribution', title: 'Frequency Distribution', titleHindi: 'बारंबारता बंटन' },
        { slug: 'mean-of-data', title: 'Mean of Data', titleHindi: 'आँकड़ों का माध्य' },
        { slug: 'median-mode-ungrouped', title: 'Median and Mode of Ungrouped Data', titleHindi: 'अवर्गीकृत आँकड़ों की माध्यिका और बहुलक' },
        { slug: 'bar-graphs-histograms', title: 'Bar Graphs and Histograms', titleHindi: 'दंड आलेख और आयतचित्र', inactive: true },
    ],
    'math-9-13': [
        { slug: 'empirical-probability', title: 'Empirical (Experimental) Probability', titleHindi: 'आनुभविक (प्रायोगिक) प्रायिकता' },
        { slug: 'probability-from-data', title: 'Probability from Frequency Data', titleHindi: 'बारंबारता आँकड़ों से प्रायिकता' },
    ],

    // ─── Science · Class 10 ───────────────────────────────────────────────────
    'sci-10-1': [
        { slug: 'balancing-equations', title: 'Balancing Chemical Equations', titleHindi: 'रासायनिक समीकरणों को संतुलित करना' },
        { slug: 'types-of-reactions', title: 'Types of Chemical Reactions', titleHindi: 'रासायनिक अभिक्रियाओं के प्रकार' },
        { slug: 'redox-reactions', title: 'Oxidation and Reduction (Redox)', titleHindi: 'उपचयन और अपचयन (रेडॉक्स)' },
        { slug: 'exothermic-endothermic', title: 'Exothermic and Endothermic Reactions', titleHindi: 'ऊष्माक्षेपी और ऊष्माशोषी अभिक्रियाएँ' },
        { slug: 'corrosion-rancidity', title: 'Corrosion and Rancidity', titleHindi: 'संक्षारण और विकृतगंधिता' },
    ],
    'sci-10-2': [
        { slug: 'ph-scale', title: 'The pH Scale', titleHindi: 'pH मापक्रम' },
        { slug: 'indicators', title: 'Acid-Base Indicators', titleHindi: 'अम्ल-क्षार सूचक' },
        { slug: 'acid-base-reactions', title: 'Chemical Properties of Acids and Bases', titleHindi: 'अम्लों और क्षारकों के रासायनिक गुणधर्म' },
        { slug: 'neutralisation', title: 'Neutralisation', titleHindi: 'उदासीनीकरण' },
        { slug: 'important-salts', title: 'Important Salts (Baking Soda, Washing Soda, Plaster of Paris)', titleHindi: 'महत्वपूर्ण लवण (खाने का सोडा, धोने का सोडा, प्लास्टर ऑफ पेरिस)' },
        { slug: 'water-of-crystallisation', title: 'Water of Crystallisation', titleHindi: 'क्रिस्टलन जल' },
        { slug: 'chlor-alkali-process', title: 'Chlor-Alkali Process', titleHindi: 'क्लोर-क्षार प्रक्रम' },
    ],
    'sci-10-3': [
        { slug: 'properties-metals-nonmetals', title: 'Physical Properties of Metals and Non-metals', titleHindi: 'धातुओं और अधातुओं के भौतिक गुणधर्म' },
        { slug: 'reactivity-series', title: 'Reactivity Series', titleHindi: 'सक्रियता श्रेणी' },
        { slug: 'metals-with-acids', title: 'Reactions of Metals with Acids', titleHindi: 'धातुओं की अम्लों के साथ अभिक्रियाएँ' },
        { slug: 'ionic-compounds', title: 'Ionic Compounds', titleHindi: 'आयनिक यौगिक' },
        { slug: 'extraction-of-metals', title: 'Extraction of Metals (Metallurgy)', titleHindi: 'धातुओं का निष्कर्षण (धातुकर्म)' },
        { slug: 'corrosion-metals', title: 'Corrosion and Its Prevention', titleHindi: 'संक्षारण और उसकी रोकथाम' },
        { slug: 'amphoteric-oxides', title: 'Amphoteric Oxides', titleHindi: 'उभयधर्मी ऑक्साइड' },
    ],
    'sci-10-4': [
        { slug: 'covalent-bonding', title: 'Covalent Bonding in Carbon', titleHindi: 'कार्बन में सहसंयोजक आबंधन' },
        { slug: 'catenation-tetravalency', title: 'Catenation and Tetravalency', titleHindi: 'शृंखलन और चतुःसंयोजकता' },
        { slug: 'hydrocarbons', title: 'Saturated and Unsaturated Hydrocarbons', titleHindi: 'संतृप्त और असंतृप्त हाइड्रोकार्बन' },
        { slug: 'homologous-series', title: 'Homologous Series', titleHindi: 'समजातीय श्रेणी' },
        { slug: 'nomenclature', title: 'Nomenclature of Carbon Compounds', titleHindi: 'कार्बन यौगिकों का नामकरण' },
        { slug: 'ethanol-ethanoic-acid', title: 'Ethanol and Ethanoic Acid', titleHindi: 'एथेनॉल और एथेनोइक अम्ल' },
        { slug: 'soaps-detergents', title: 'Soaps and Detergents', titleHindi: 'साबुन और अपमार्जक' },
        { slug: 'isomerism', title: 'Structural Isomerism', titleHindi: 'संरचनात्मक समावयवता', inactive: true },
    ],
    'sci-10-5': [
        { slug: 'photosynthesis', title: 'Nutrition in Plants (Photosynthesis)', titleHindi: 'पादपों में पोषण (प्रकाश संश्लेषण)' },
        { slug: 'nutrition-human', title: 'Nutrition in Human Beings', titleHindi: 'मनुष्यों में पोषण' },
        { slug: 'respiration', title: 'Respiration (Aerobic and Anaerobic)', titleHindi: 'श्वसन (वायवीय और अवायवीय)' },
        { slug: 'transportation-human', title: 'Transportation in Human Beings', titleHindi: 'मनुष्यों में परिवहन' },
        { slug: 'transportation-plants', title: 'Transportation in Plants', titleHindi: 'पादपों में परिवहन' },
        { slug: 'excretion', title: 'Excretion', titleHindi: 'उत्सर्जन' },
    ],
    'sci-10-6': [
        { slug: 'nervous-system', title: 'The Nervous System', titleHindi: 'तंत्रिका तंत्र' },
        { slug: 'reflex-action', title: 'Reflex Action', titleHindi: 'प्रतिवर्ती क्रिया' },
        { slug: 'human-brain', title: 'The Human Brain', titleHindi: 'मानव मस्तिष्क' },
        { slug: 'endocrine-hormones', title: 'Endocrine Glands and Hormones', titleHindi: 'अंतःस्रावी ग्रंथियाँ और हार्मोन' },
        { slug: 'plant-coordination', title: 'Coordination in Plants (Tropic Movements)', titleHindi: 'पादपों में समन्वय (अनुवर्तन गतियाँ)' },
        { slug: 'plant-hormones', title: 'Plant Hormones', titleHindi: 'पादप हार्मोन' },
    ],
    'sci-10-7': [
        { slug: 'asexual-reproduction', title: 'Asexual Reproduction', titleHindi: 'अलैंगिक जनन' },
        { slug: 'sexual-reproduction-plants', title: 'Sexual Reproduction in Flowering Plants', titleHindi: 'पुष्पी पादपों में लैंगिक जनन' },
        { slug: 'human-reproductive-system', title: 'Human Reproductive System', titleHindi: 'मानव जनन तंत्र' },
        { slug: 'reproductive-health', title: 'Reproductive Health and Contraception', titleHindi: 'जनन स्वास्थ्य और गर्भनिरोधन' },
    ],
    'sci-10-8': [
        { slug: 'mendels-laws', title: "Mendel's Laws of Inheritance", titleHindi: 'मेंडल के वंशागति के नियम' },
        { slug: 'monohybrid-dihybrid', title: 'Monohybrid and Dihybrid Crosses', titleHindi: 'एकसंकर और द्विसंकर संकरण' },
        { slug: 'sex-determination', title: 'Sex Determination', titleHindi: 'लिंग निर्धारण' },
        { slug: 'dominant-recessive-traits', title: 'Dominant and Recessive Traits', titleHindi: 'प्रभावी और अप्रभावी लक्षण' },
        { slug: 'evolution-natural-selection', title: 'Evolution and Natural Selection', titleHindi: 'विकास और प्राकृतिक चयन', inactive: true },
        { slug: 'evidence-for-evolution', title: 'Evidence for Evolution (Fossils, Homologous Organs)', titleHindi: 'विकास के प्रमाण (जीवाश्म, समजात अंग)', inactive: true },
        { slug: 'speciation', title: 'Speciation', titleHindi: 'जातिउद्भवन', inactive: true },
    ],
    'sci-10-9': [
        { slug: 'reflection-mirrors', title: 'Reflection of Light by Spherical Mirrors', titleHindi: 'गोलीय दर्पणों द्वारा प्रकाश का परावर्तन' },
        { slug: 'mirror-formula', title: 'Mirror Formula and Magnification', titleHindi: 'दर्पण सूत्र और आवर्धन' },
        { slug: 'refraction', title: 'Refraction of Light', titleHindi: 'प्रकाश का अपवर्तन' },
        { slug: 'refractive-index', title: 'Refractive Index', titleHindi: 'अपवर्तनांक' },
        { slug: 'glass-slab', title: 'Refraction through a Glass Slab', titleHindi: 'काँच के स्लैब से अपवर्तन' },
        { slug: 'lenses', title: 'Image Formation by Lenses', titleHindi: 'लेंसों द्वारा प्रतिबिंब निर्माण' },
        { slug: 'lens-formula', title: 'Lens Formula and Magnification', titleHindi: 'लेंस सूत्र और आवर्धन' },
        { slug: 'power-of-lens', title: 'Power of a Lens', titleHindi: 'लेंस की क्षमता' },
    ],
    'sci-10-10': [
        { slug: 'human-eye', title: 'The Human Eye — Structure and Function', titleHindi: 'मानव नेत्र — संरचना और कार्य' },
        { slug: 'defects-of-vision', title: 'Defects of Vision and Their Correction', titleHindi: 'दृष्टि दोष और उनका संशोधन' },
        { slug: 'dispersion', title: 'Dispersion of Light through a Prism', titleHindi: 'प्रिज्म द्वारा प्रकाश का विक्षेपण' },
        { slug: 'atmospheric-refraction', title: 'Atmospheric Refraction', titleHindi: 'वायुमंडलीय अपवर्तन' },
        { slug: 'scattering', title: 'Scattering of Light', titleHindi: 'प्रकाश का प्रकीर्णन' },
        { slug: 'rainbow', title: 'Formation of a Rainbow', titleHindi: 'इंद्रधनुष का बनना' },
    ],
    'sci-10-11': [
        { slug: 'current-and-potential', title: 'Electric Current and Potential Difference', titleHindi: 'विद्युत धारा और विभवांतर' },
        { slug: 'ohms-law', title: "Ohm's Law", titleHindi: 'ओम का नियम' },
        { slug: 'resistance-resistivity', title: 'Resistance and Resistivity', titleHindi: 'प्रतिरोध और प्रतिरोधकता' },
        { slug: 'resistors-series', title: 'Resistors in Series', titleHindi: 'श्रेणीक्रम में प्रतिरोधक' },
        { slug: 'resistors-parallel', title: 'Resistors in Parallel', titleHindi: 'पार्श्वक्रम में प्रतिरोधक' },
        { slug: 'heating-effect', title: 'Heating Effect of Electric Current', titleHindi: 'विद्युत धारा का ऊष्मीय प्रभाव' },
        { slug: 'electric-power', title: 'Electric Power and Energy', titleHindi: 'विद्युत शक्ति और ऊर्जा' },
    ],
    'sci-10-12': [
        { slug: 'magnetic-field-conductor', title: 'Magnetic Field due to a Current-Carrying Conductor', titleHindi: 'धारावाही चालक के कारण चुंबकीय क्षेत्र' },
        { slug: 'solenoid', title: 'Magnetic Field of a Solenoid', titleHindi: 'परिनालिका का चुंबकीय क्षेत्र' },
        { slug: 'force-on-conductor', title: "Force on a Conductor (Fleming's Left-Hand Rule)", titleHindi: 'चालक पर बल (फ्लेमिंग का वाम-हस्त नियम)' },
        { slug: 'electric-motor', title: 'Electric Motor', titleHindi: 'विद्युत मोटर' },
        { slug: 'electromagnetic-induction', title: 'Electromagnetic Induction', titleHindi: 'विद्युतचुंबकीय प्रेरण' },
        { slug: 'electric-generator', title: 'Electric Generator', titleHindi: 'विद्युत जनित्र' },
        { slug: 'domestic-circuits', title: 'Domestic Electric Circuits', titleHindi: 'घरेलू विद्युत परिपथ' },
    ],
    'sci-10-13': [
        { slug: 'ecosystem', title: 'Ecosystem and Its Components', titleHindi: 'पारितंत्र और उसके घटक' },
        { slug: 'food-chains', title: 'Food Chains and Food Webs', titleHindi: 'आहार शृंखला और आहार जाल' },
        { slug: 'energy-flow', title: 'Energy Flow and Trophic Levels', titleHindi: 'ऊर्जा प्रवाह और पोषी स्तर' },
        { slug: 'biomagnification', title: 'Biological Magnification', titleHindi: 'जैविक आवर्धन', aliases: ['Biomagnification'] },
        { slug: 'ozone-layer', title: 'Depletion of the Ozone Layer', titleHindi: 'ओज़ोन परत का ह्रास' },
        { slug: 'waste-management', title: 'Waste Management', titleHindi: 'अपशिष्ट प्रबंधन' },
    ],

    // ─── Science · Class 9 ────────────────────────────────────────────────────
    'sci-9-1': [
        { slug: 'states-of-matter', title: 'States of Matter', titleHindi: 'द्रव्य की अवस्थाएँ' },
        { slug: 'change-of-state', title: 'Change of State', titleHindi: 'अवस्था परिवर्तन' },
        { slug: 'evaporation', title: 'Evaporation', titleHindi: 'वाष्पन' },
        { slug: 'latent-heat', title: 'Latent Heat', titleHindi: 'गुप्त ऊष्मा' },
    ],
    'sci-9-2': [
        { slug: 'mixtures-pure-substances', title: 'Mixtures and Pure Substances', titleHindi: 'मिश्रण और शुद्ध पदार्थ' },
        { slug: 'solutions', title: 'Solutions and Concentration', titleHindi: 'विलयन और सांद्रता' },
        { slug: 'separation-methods', title: 'Separation of Mixtures', titleHindi: 'मिश्रणों का पृथक्करण' },
        { slug: 'colloids-suspensions', title: 'Colloids and Suspensions', titleHindi: 'कोलॉइड और निलंबन' },
    ],
    'sci-9-3': [
        { slug: 'laws-chemical-combination', title: 'Laws of Chemical Combination', titleHindi: 'रासायनिक संयोजन के नियम' },
        { slug: 'mole-concept', title: 'Mole Concept', titleHindi: 'मोल संकल्पना' },
        { slug: 'atomic-molecular-mass', title: 'Atomic and Molecular Mass', titleHindi: 'परमाणु और आण्विक द्रव्यमान' },
        { slug: 'chemical-formulae', title: 'Writing Chemical Formulae', titleHindi: 'रासायनिक सूत्र लिखना' },
        { slug: 'percentage-composition', title: 'Percentage Composition', titleHindi: 'प्रतिशत संघटन' },
    ],
    'sci-9-4': [
        { slug: 'subatomic-particles', title: 'Subatomic Particles', titleHindi: 'अवपरमाणुक कण' },
        { slug: 'atomic-models', title: 'Models of the Atom (Rutherford, Bohr)', titleHindi: 'परमाणु के मॉडल (रदरफोर्ड, बोर)' },
        { slug: 'electronic-configuration', title: 'Electronic Configuration and Valency', titleHindi: 'इलेक्ट्रॉनिक विन्यास और संयोजकता' },
        { slug: 'isotopes-isobars', title: 'Isotopes and Isobars', titleHindi: 'समस्थानिक और समभारिक' },
    ],
    'sci-9-5': [
        { slug: 'cell-organelles', title: 'Cell Structure and Organelles', titleHindi: 'कोशिका संरचना और कोशिकांग' },
        { slug: 'prokaryotic-eukaryotic', title: 'Prokaryotic and Eukaryotic Cells', titleHindi: 'प्रोकैरियोटिक और यूकैरियोटिक कोशिकाएँ' },
        { slug: 'osmosis', title: 'Cell Membrane, Osmosis and Diffusion', titleHindi: 'कोशिका झिल्ली, परासरण और विसरण' },
        { slug: 'plant-animal-cells', title: 'Plant vs Animal Cells', titleHindi: 'पादप बनाम जंतु कोशिकाएँ' },
    ],
    'sci-9-6': [
        { slug: 'plant-tissues', title: 'Plant Tissues', titleHindi: 'पादप ऊतक' },
        { slug: 'complex-tissues', title: 'Complex Permanent Tissues (Xylem, Phloem)', titleHindi: 'जटिल स्थायी ऊतक (जाइलम, फ्लोएम)' },
        { slug: 'animal-tissues', title: 'Animal Tissues', titleHindi: 'जंतु ऊतक' },
    ],
    'sci-9-7': [
        { slug: 'distance-displacement', title: 'Distance and Displacement', titleHindi: 'दूरी और विस्थापन' },
        { slug: 'speed-velocity', title: 'Speed and Velocity', titleHindi: 'चाल और वेग' },
        { slug: 'acceleration', title: 'Acceleration', titleHindi: 'त्वरण' },
        { slug: 'equations-of-motion', title: 'Equations of Motion', titleHindi: 'गति के समीकरण' },
        { slug: 'uniform-circular-motion', title: 'Uniform Circular Motion', titleHindi: 'एकसमान वृत्तीय गति' },
    ],
    'sci-9-8': [
        { slug: 'newtons-laws', title: "Newton's Laws of Motion", titleHindi: 'न्यूटन के गति के नियम' },
        { slug: 'inertia', title: 'Inertia', titleHindi: 'जड़त्व' },
        { slug: 'momentum', title: 'Momentum', titleHindi: 'संवेग' },
        { slug: 'conservation-of-momentum', title: 'Conservation of Momentum', titleHindi: 'संवेग संरक्षण' },
    ],
    'sci-9-9': [
        { slug: 'universal-gravitation', title: 'Universal Law of Gravitation', titleHindi: 'गुरुत्वाकर्षण का सार्वत्रिक नियम' },
        { slug: 'acceleration-gravity', title: 'Acceleration Due to Gravity', titleHindi: 'गुरुत्वीय त्वरण' },
        { slug: 'free-fall', title: 'Free Fall', titleHindi: 'मुक्त पतन' },
        { slug: 'mass-weight', title: 'Mass and Weight', titleHindi: 'द्रव्यमान और भार' },
        { slug: 'buoyancy', title: 'Thrust, Pressure and Buoyancy', titleHindi: 'प्रणोद, दाब और उत्प्लावकता' },
        { slug: 'archimedes-principle', title: "Archimedes' Principle", titleHindi: 'आर्किमिडीज़ का सिद्धांत' },
    ],
    'sci-9-10': [
        { slug: 'work-done', title: 'Work Done', titleHindi: 'किया गया कार्य' },
        { slug: 'kinetic-energy', title: 'Kinetic Energy', titleHindi: 'गतिज ऊर्जा' },
        { slug: 'potential-energy', title: 'Potential Energy', titleHindi: 'स्थितिज ऊर्जा' },
        { slug: 'conservation-of-energy', title: 'Conservation of Energy', titleHindi: 'ऊर्जा संरक्षण' },
        { slug: 'power', title: 'Power', titleHindi: 'शक्ति' },
    ],
    'sci-9-11': [
        { slug: 'propagation-of-sound', title: 'Propagation of Sound', titleHindi: 'ध्वनि का संचरण' },
        { slug: 'sound-wave-characteristics', title: 'Characteristics of a Sound Wave', titleHindi: 'ध्वनि तरंग के अभिलक्षण' },
        { slug: 'echo', title: 'Reflection of Sound and Echo', titleHindi: 'ध्वनि का परावर्तन और प्रतिध्वनि' },
        { slug: 'reverberation', title: 'Reverberation', titleHindi: 'अनुरणन' },
        { slug: 'sonar', title: 'SONAR', titleHindi: 'सोनार' },
        { slug: 'human-ear', title: 'Structure of the Human Ear', titleHindi: 'मानव कान की संरचना' },
    ],
    'sci-9-12': [
        { slug: 'crop-production', title: 'Crop Production and Management', titleHindi: 'फसल उत्पादन और प्रबंधन' },
        { slug: 'crop-improvement', title: 'Crop Improvement', titleHindi: 'फसल सुधार' },
        { slug: 'animal-husbandry', title: 'Animal Husbandry', titleHindi: 'पशुपालन' },
        { slug: 'food-preservation', title: 'Food Preservation', titleHindi: 'खाद्य परिरक्षण' },
    ],
};

// ─── Build the flat registry + membership map ────────────────────────────────

/** Chapter id → its member topic ids (MEMBERSHIP), in authored order. */
export const CHAPTER_TOPIC_IDS: Record<string, string[]> = {};
export const ALL_TOPICS: NCERTTopic[] = [];
const TOPIC_BY_ID = new Map<string, NCERTTopic>();

for (const [chapterId, seeds] of Object.entries(CHAPTER_TOPIC_SEEDS)) {
    const [prefix, gradeStr] = chapterId.split('-');
    const grade = Number(gradeStr);
    const subject = SUBJECT_BY_PREFIX[prefix];
    const ids: string[] = [];
    for (const s of seeds) {
        const topicId = `${prefix}-${grade}-t-${s.slug}`;
        const topic: NCERTTopic = {
            topicId,
            board: 'CBSE',
            grade,
            subject,
            title: s.title,
            titleHindi: s.titleHindi,
            ...(s.aliases && s.aliases.length > 0 ? { aliases: s.aliases } : {}),
            ...(s.inactive ? { isActive: false } : {}),
        };
        ALL_TOPICS.push(topic);
        TOPIC_BY_ID.set(topicId, topic);
        ids.push(topicId);
    }
    CHAPTER_TOPIC_IDS[chapterId] = ids;
}

/** O(1) topic lookup by stable id. Unknown id → undefined. */
export function getTopicById(topicId: string): NCERTTopic | undefined {
    return TOPIC_BY_ID.get(topicId);
}
