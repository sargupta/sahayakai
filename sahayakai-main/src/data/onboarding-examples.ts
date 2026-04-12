/**
 * Pre-generated lesson plan examples for the onboarding "aha moment."
 * These are shown instantly (no API call) during Step 2 of onboarding,
 * matched to the teacher's selected subject + grade range + language.
 */

export interface OnboardingExample {
    id: string;
    subject: string;
    gradeRange: [number, number]; // [min, max] inclusive
    language: 'English' | 'Hindi';
    title: string;
    duration: string;
    objectives: string[];
    activities: {
        phase: string;
        title: string;
        description: string;
        duration: string;
    }[];
    assessment: string;
}

const examples: OnboardingExample[] = [
    // ─── ENGLISH EXAMPLES ───────────────────────────────────────────
    {
        id: 'science-6-photosynthesis',
        subject: 'Science',
        gradeRange: [6, 8],
        language: 'English',
        title: 'How Plants Make Food: Photosynthesis',
        duration: '40 minutes',
        objectives: [
            'Explain the process of photosynthesis in simple terms',
            'Identify the raw materials and products of photosynthesis',
            'Conduct a simple leaf experiment',
        ],
        activities: [
            { phase: 'Engage', title: 'Why are leaves green?', description: 'Ask students to observe leaves in the school garden. Discuss why most leaves are green and what happens to them in winter.', duration: '5 min' },
            { phase: 'Explore', title: 'Leaf Experiment', description: 'Cover part of a leaf with black paper for 2 days (pre-prepared). Test with iodine to show starch presence only in exposed areas.', duration: '10 min' },
            { phase: 'Explain', title: 'The Food Factory', description: 'Draw the photosynthesis equation on the board. Use a simple diagram: sunlight + water + CO2 = glucose + oxygen. Relate to the experiment.', duration: '10 min' },
            { phase: 'Elaborate', title: 'Real World Connections', description: 'Discuss: Why do farmers need sunlight? Why do underwater plants have air bubbles? Students draw their own photosynthesis diagram.', duration: '10 min' },
            { phase: 'Evaluate', title: 'Quick Check', description: '5-question oral quiz: What do plants need to make food? What gas do they release? Students share their diagrams with a partner.', duration: '5 min' },
        ],
        assessment: 'Students label a blank photosynthesis diagram and write 2 sentences explaining the process in their own words.',
    },
    {
        id: 'math-5-fractions',
        subject: 'Mathematics',
        gradeRange: [4, 6],
        language: 'English',
        title: 'Introduction to Fractions Using Daily Life',
        duration: '40 minutes',
        objectives: [
            'Understand what a fraction represents',
            'Identify numerator and denominator',
            'Relate fractions to equal sharing in daily life',
        ],
        activities: [
            { phase: 'Engage', title: 'Sharing a Roti', description: 'Show a paper circle (roti). Ask: If I share this equally with one friend, how much does each person get? Cut it in half. Introduce 1/2.', duration: '5 min' },
            { phase: 'Explore', title: 'Folding Paper', description: 'Give each student a paper strip. Fold into 2, 4, 8 equal parts. Shade different portions. Write the fraction for each.', duration: '10 min' },
            { phase: 'Explain', title: 'Numerator and Denominator', description: 'Use the paper strips to show: denominator = total equal parts, numerator = shaded parts. Practice reading fractions aloud.', duration: '10 min' },
            { phase: 'Elaborate', title: 'Fractions Around Us', description: 'Students find fractions in the classroom: half a blackboard, quarter of a window pane, 3/4 of an attendance register filled.', duration: '10 min' },
            { phase: 'Evaluate', title: 'Draw and Label', description: 'Students draw shapes, divide into equal parts, shade a fraction, and write the fraction. Peer check with partners.', duration: '5 min' },
        ],
        assessment: 'Worksheet: match pictures to fractions, shade the correct portion, and write one real-life example of a fraction.',
    },
    {
        id: 'social-8-constitution',
        subject: 'Social Science',
        gradeRange: [7, 10],
        language: 'English',
        title: 'Understanding the Indian Constitution',
        duration: '45 minutes',
        objectives: [
            'Explain why India needed a constitution',
            'Identify the key features: Preamble, Fundamental Rights, Directive Principles',
            'Relate constitutional rights to students\' daily lives',
        ],
        activities: [
            { phase: 'Engage', title: 'Classroom Rules', description: 'Ask students: What if there were no school rules? Discuss for 3 minutes. Connect: A country also needs rules. That\'s the Constitution.', duration: '5 min' },
            { phase: 'Explore', title: 'Reading the Preamble', description: 'Display the Preamble. Read aloud together. Students underline key words: sovereign, socialist, secular, democratic, republic. Discuss each.', duration: '10 min' },
            { phase: 'Explain', title: 'Rights We Have', description: 'Present 6 Fundamental Rights with simple examples. Right to Education = you can go to school. Right to Equality = no discrimination.', duration: '10 min' },
            { phase: 'Elaborate', title: 'Rights in Action', description: 'Give 5 scenarios. Students identify which Fundamental Right is being used or violated. Group discussion on each.', duration: '15 min' },
            { phase: 'Evaluate', title: 'My Rights Poster', description: 'In pairs, students pick one Fundamental Right and create a mini poster explaining it with an example from their life.', duration: '5 min' },
        ],
        assessment: 'Students write a paragraph: "If I could add one new right to the Constitution, it would be..." with reasoning.',
    },
    {
        id: 'english-4-story',
        subject: 'English',
        gradeRange: [3, 5],
        language: 'English',
        title: 'Story Time: Reading Comprehension',
        duration: '35 minutes',
        objectives: [
            'Read a short story with proper pronunciation',
            'Answer questions about the story (who, what, where, when)',
            'Identify the moral of the story',
        ],
        activities: [
            { phase: 'Engage', title: 'Picture Walk', description: 'Show illustrations from the story. Ask: What do you think this story is about? Who are the characters? Collect predictions.', duration: '5 min' },
            { phase: 'Explore', title: 'Shared Reading', description: 'Teacher reads the story aloud with expression. Students follow along. Pause at key moments to check predictions.', duration: '8 min' },
            { phase: 'Explain', title: 'Vocabulary Builder', description: 'Pick 5 new words from the story. Write on the board. Students guess meaning from context, then confirm with simple definitions.', duration: '7 min' },
            { phase: 'Elaborate', title: 'Story Map', description: 'Students fill in a story map: Characters, Setting, Problem, Solution, Moral. Work in pairs and share with the class.', duration: '10 min' },
            { phase: 'Evaluate', title: 'Retell and Reflect', description: 'One student per group retells the story in their own words. Class votes on the best retelling.', duration: '5 min' },
        ],
        assessment: 'Students write 3 sentences answering: Who is your favorite character and why? What did you learn from this story?',
    },
    {
        id: 'math-9-algebra',
        subject: 'Mathematics',
        gradeRange: [9, 12],
        language: 'English',
        title: 'Introduction to Linear Equations',
        duration: '45 minutes',
        objectives: [
            'Define a linear equation in one variable',
            'Solve simple linear equations step by step',
            'Apply linear equations to word problems',
        ],
        activities: [
            { phase: 'Engage', title: 'The Balance Game', description: 'Show a balance scale image. If 2x + 3 = 9, what is x? Let students guess. Relate equation solving to keeping a balance.', duration: '5 min' },
            { phase: 'Explore', title: 'Step-by-Step Solving', description: 'Work through 3 equations together on the board. Students copy each step. Emphasize: what you do to one side, do to the other.', duration: '10 min' },
            { phase: 'Explain', title: 'Rules of the Game', description: 'Summarize the steps: simplify, isolate variable term, divide. Show common mistakes to avoid.', duration: '10 min' },
            { phase: 'Elaborate', title: 'Word Problem Challenge', description: '"Ravi has some marbles. If he gives 5 to his friend, he has 12 left. How many did he start with?" Students write and solve the equation.', duration: '15 min' },
            { phase: 'Evaluate', title: 'Exit Ticket', description: 'Solve 2 equations independently. Submit on a slip of paper. Teacher scans for common errors.', duration: '5 min' },
        ],
        assessment: 'Homework: 5 linear equations of increasing difficulty + 2 word problems.',
    },
    {
        id: 'evs-3-water',
        subject: 'Environmental Studies (EVS)',
        gradeRange: [1, 5],
        language: 'English',
        title: 'Water: Where Does It Come From?',
        duration: '35 minutes',
        objectives: [
            'Identify different sources of water',
            'Understand the water cycle in simple terms',
            'Explain why saving water is important',
        ],
        activities: [
            { phase: 'Engage', title: 'Water in My Day', description: 'Ask: How many times did you use water today? Drinking, brushing, bathing, cooking. Make a list on the board.', duration: '5 min' },
            { phase: 'Explore', title: 'Sources of Water', description: 'Show pictures: river, well, rain, tap, borewell. Students sort into natural vs man-made sources.', duration: '8 min' },
            { phase: 'Explain', title: 'The Water Cycle', description: 'Simple diagram on board: sun heats water, clouds form, rain falls, water flows to rivers. Students repeat in their own words.', duration: '8 min' },
            { phase: 'Elaborate', title: 'Save Water Challenge', description: 'In groups, students list 5 ways to save water at home and school. Each group shares their best idea.', duration: '9 min' },
            { phase: 'Evaluate', title: 'Draw the Cycle', description: 'Students draw a simple water cycle with labels: evaporation, clouds, rain, river.', duration: '5 min' },
        ],
        assessment: 'Students draw their favorite water source and write 2 sentences about why saving water matters.',
    },

    // ─── HINDI EXAMPLES ─────────────────────────────────────────────
    {
        id: 'hindi-7-kavita',
        subject: 'Hindi',
        gradeRange: [6, 9],
        language: 'Hindi',
        title: 'कविता पाठ: प्रकृति से प्रेम',
        duration: '40 मिनट',
        objectives: [
            'कविता को सही लय और उच्चारण के साथ पढ़ना',
            'कविता के भाव और अर्थ को समझना',
            'प्रकृति से जुड़े अनुभवों को शब्दों में व्यक्त करना',
        ],
        activities: [
            { phase: 'Engage', title: 'प्रकृति चित्र', description: 'बच्चों को प्रकृति के चित्र दिखाएँ: पहाड़, नदी, पेड़, बारिश। पूछें: इन्हें देखकर आपको कैसा लगता है?', duration: '5 मिनट' },
            { phase: 'Explore', title: 'कविता वाचन', description: 'शिक्षक कविता को भाव पूर्वक पढ़ें। फिर बच्चे मिलकर दोहराएँ। कठिन शब्दों पर रुकें।', duration: '10 मिनट' },
            { phase: 'Explain', title: 'शब्द और अर्थ', description: 'कठिन शब्दों के अर्थ बताएँ। कविता की मुख्य भावना पर चर्चा करें। अलंकारों की पहचान करें।', duration: '10 मिनट' },
            { phase: 'Elaborate', title: 'मेरी कविता', description: 'बच्चे प्रकृति पर 4 पंक्तियाँ लिखें। जोड़ी में एक-दूसरे को सुनाएँ।', duration: '10 मिनट' },
            { phase: 'Evaluate', title: 'प्रस्तुति', description: 'कुछ बच्चे कक्षा में अपनी कविता सुनाएँ। सबसे अच्छी कविता पर तालियाँ।', duration: '5 मिनट' },
        ],
        assessment: 'बच्चे कविता के आधार पर एक चित्र बनाएँ और 3 वाक्यों में कविता का सार लिखें।',
    },
    {
        id: 'science-6-photosynthesis-hi',
        subject: 'Science',
        gradeRange: [6, 8],
        language: 'Hindi',
        title: 'पौधे भोजन कैसे बनाते हैं: प्रकाश संश्लेषण',
        duration: '40 मिनट',
        objectives: [
            'प्रकाश संश्लेषण की प्रक्रिया को सरल शब्दों में समझाना',
            'प्रकाश संश्लेषण के कच्चे माल और उत्पादों की पहचान करना',
            'एक सरल पत्ती प्रयोग करना',
        ],
        activities: [
            { phase: 'Engage', title: 'पत्तियाँ हरी क्यों?', description: 'बच्चों से कहें कि स्कूल के बगीचे में पत्तियाँ देखें। चर्चा करें: अधिकतर पत्तियाँ हरी क्यों होती हैं?', duration: '5 मिनट' },
            { phase: 'Explore', title: 'पत्ती का प्रयोग', description: 'एक पत्ती के हिस्से को काले कागज़ से 2 दिन ढकें (पहले से तैयार)। आयोडीन से जाँचें कि स्टार्च कहाँ है।', duration: '10 मिनट' },
            { phase: 'Explain', title: 'भोजन की फ़ैक्ट्री', description: 'बोर्ड पर प्रकाश संश्लेषण का समीकरण बनाएँ: सूर्य का प्रकाश + पानी + CO2 = ग्लूकोज़ + ऑक्सीजन। प्रयोग से जोड़कर समझाएँ।', duration: '10 मिनट' },
            { phase: 'Elaborate', title: 'दैनिक जीवन में', description: 'चर्चा करें: किसानों को धूप क्यों चाहिए? पानी के अंदर के पौधों में बुलबुले क्यों दिखते हैं? बच्चे अपना चित्र बनाएँ।', duration: '10 मिनट' },
            { phase: 'Evaluate', title: 'त्वरित जाँच', description: '5 मौखिक प्रश्न: पौधों को भोजन बनाने के लिए क्या चाहिए? वे कौन सी गैस छोड़ते हैं? बच्चे अपने चित्र साझा करें।', duration: '5 मिनट' },
        ],
        assessment: 'बच्चे एक खाली प्रकाश संश्लेषण चित्र में लेबल लगाएँ और 2 वाक्यों में प्रक्रिया समझाएँ।',
    },
    {
        id: 'math-5-fractions-hi',
        subject: 'Mathematics',
        gradeRange: [4, 6],
        language: 'Hindi',
        title: 'भिन्नों का परिचय: रोज़मर्रा की ज़िंदगी से',
        duration: '40 मिनट',
        objectives: [
            'समझना कि भिन्न क्या दर्शाता है',
            'अंश और हर की पहचान करना',
            'दैनिक जीवन में बराबर बाँटने से भिन्नों को जोड़ना',
        ],
        activities: [
            { phase: 'Engage', title: 'रोटी बाँटना', description: 'एक गोल कागज़ (रोटी) दिखाएँ। पूछें: अगर मैं इसे एक दोस्त के साथ बराबर बाँटूँ तो हर एक को कितना मिलेगा? आधा काटें। 1/2 बताएँ।', duration: '5 मिनट' },
            { phase: 'Explore', title: 'कागज़ मोड़ना', description: 'हर बच्चे को एक कागज़ की पट्टी दें। 2, 4, 8 बराबर हिस्सों में मोड़ें। अलग-अलग हिस्से रंगें। हर एक का भिन्न लिखें।', duration: '10 मिनट' },
            { phase: 'Explain', title: 'अंश और हर', description: 'कागज़ की पट्टियों से दिखाएँ: हर = कुल बराबर हिस्से, अंश = रंगे हुए हिस्से। भिन्नों को ज़ोर से पढ़ने का अभ्यास करें।', duration: '10 मिनट' },
            { phase: 'Elaborate', title: 'हमारे चारों ओर भिन्न', description: 'बच्चे कक्षा में भिन्न खोजें: आधा ब्लैकबोर्ड, खिड़की का चौथाई हिस्सा, हाज़िरी रजिस्टर का 3/4 भरा हुआ।', duration: '10 मिनट' },
            { phase: 'Evaluate', title: 'बनाओ और लिखो', description: 'बच्चे आकृतियाँ बनाएँ, बराबर हिस्सों में बाँटें, भिन्न रंगें और लिखें। जोड़ीदार से जाँच करवाएँ।', duration: '5 मिनट' },
        ],
        assessment: 'कार्यपत्रक: चित्रों को भिन्नों से मिलाएँ, सही हिस्सा रंगें, और एक वास्तविक उदाहरण लिखें।',
    },
    {
        id: 'social-8-constitution-hi',
        subject: 'Social Science',
        gradeRange: [7, 10],
        language: 'Hindi',
        title: 'भारतीय संविधान को समझना',
        duration: '45 मिनट',
        objectives: [
            'बताना कि भारत को संविधान की ज़रूरत क्यों पड़ी',
            'प्रस्तावना, मौलिक अधिकार, नीति निर्देशक तत्वों की पहचान करना',
            'संवैधानिक अधिकारों को अपने दैनिक जीवन से जोड़ना',
        ],
        activities: [
            { phase: 'Engage', title: 'कक्षा के नियम', description: 'बच्चों से पूछें: अगर स्कूल में कोई नियम न हों तो क्या होगा? 3 मिनट चर्चा करें। जोड़ें: देश को भी नियम चाहिए, वही संविधान है।', duration: '5 मिनट' },
            { phase: 'Explore', title: 'प्रस्तावना पढ़ना', description: 'प्रस्तावना दिखाएँ। सब मिलकर ज़ोर से पढ़ें। मुख्य शब्दों को रेखांकित करें: संप्रभु, समाजवादी, पंथनिरपेक्ष, लोकतांत्रिक, गणराज्य।', duration: '10 मिनट' },
            { phase: 'Explain', title: 'हमारे अधिकार', description: '6 मौलिक अधिकार सरल उदाहरणों से समझाएँ। शिक्षा का अधिकार = आप स्कूल जा सकते हैं। समानता का अधिकार = कोई भेदभाव नहीं।', duration: '10 मिनट' },
            { phase: 'Elaborate', title: 'अधिकार कार्य में', description: '5 परिस्थितियाँ दें। बच्चे पहचानें कौन सा मौलिक अधिकार इस्तेमाल हो रहा है या उल्लंघन हो रहा है। समूह चर्चा करें।', duration: '15 मिनट' },
            { phase: 'Evaluate', title: 'मेरे अधिकार पोस्टर', description: 'जोड़ी में बच्चे एक मौलिक अधिकार चुनें और अपने जीवन से उदाहरण देकर एक छोटा पोस्टर बनाएँ।', duration: '5 मिनट' },
        ],
        assessment: 'बच्चे एक पैराग्राफ लिखें: "अगर मैं संविधान में एक नया अधिकार जोड़ सकता/सकती तो वह होता..." कारण सहित।',
    },
    {
        id: 'math-9-algebra-hi',
        subject: 'Mathematics',
        gradeRange: [9, 12],
        language: 'Hindi',
        title: 'रैखिक समीकरणों का परिचय',
        duration: '45 मिनट',
        objectives: [
            'एक चर वाले रैखिक समीकरण को परिभाषित करना',
            'सरल रैखिक समीकरणों को चरणबद्ध तरीके से हल करना',
            'शब्द समस्याओं में रैखिक समीकरण लागू करना',
        ],
        activities: [
            { phase: 'Engage', title: 'तराज़ू का खेल', description: 'तराज़ू का चित्र दिखाएँ। अगर 2x + 3 = 9, तो x क्या है? बच्चों से अनुमान लगवाएँ। समीकरण हल करना = संतुलन बनाए रखना।', duration: '5 मिनट' },
            { phase: 'Explore', title: 'चरणबद्ध हल', description: 'बोर्ड पर 3 समीकरण मिलकर हल करें। बच्चे हर चरण नोट करें। ज़ोर दें: एक तरफ़ जो करो, दूसरी तरफ़ भी करो।', duration: '10 मिनट' },
            { phase: 'Explain', title: 'खेल के नियम', description: 'चरणों का सारांश: सरल करो, चर पद को अलग करो, भाग दो। आम ग़लतियाँ बताएँ।', duration: '10 मिनट' },
            { phase: 'Elaborate', title: 'शब्द समस्या', description: '"रवि के पास कुछ कंचे हैं। अगर वह 5 दोस्त को दे दे तो 12 बचते हैं। शुरू में कितने थे?" बच्चे समीकरण बनाएँ और हल करें।', duration: '15 मिनट' },
            { phase: 'Evaluate', title: 'एग्ज़िट टिकट', description: 'स्वतंत्र रूप से 2 समीकरण हल करें। पर्ची पर लिखकर जमा करें। शिक्षक आम त्रुटियाँ जाँचें।', duration: '5 मिनट' },
        ],
        assessment: 'गृहकार्य: बढ़ती कठिनाई के 5 रैखिक समीकरण + 2 शब्द समस्याएँ।',
    },
    {
        id: 'evs-3-water-hi',
        subject: 'Environmental Studies (EVS)',
        gradeRange: [1, 5],
        language: 'Hindi',
        title: 'पानी: यह कहाँ से आता है?',
        duration: '35 मिनट',
        objectives: [
            'पानी के विभिन्न स्रोतों की पहचान करना',
            'जल चक्र को सरल शब्दों में समझना',
            'बताना कि पानी बचाना क्यों ज़रूरी है',
        ],
        activities: [
            { phase: 'Engage', title: 'मेरे दिन में पानी', description: 'पूछें: आज आपने कितनी बार पानी इस्तेमाल किया? पीना, ब्रश, नहाना, खाना बनाना। बोर्ड पर सूची बनाएँ।', duration: '5 मिनट' },
            { phase: 'Explore', title: 'पानी के स्रोत', description: 'चित्र दिखाएँ: नदी, कुआँ, बारिश, नल, बोरवेल। बच्चे प्राकृतिक और मानव-निर्मित स्रोतों में बाँटें।', duration: '8 मिनट' },
            { phase: 'Explain', title: 'जल चक्र', description: 'बोर्ड पर सरल चित्र: सूरज पानी गर्म करता है, बादल बनते हैं, बारिश होती है, पानी नदियों में बहता है। बच्चे अपने शब्दों में दोहराएँ।', duration: '8 मिनट' },
            { phase: 'Elaborate', title: 'पानी बचाओ चुनौती', description: 'समूहों में बच्चे घर और स्कूल में पानी बचाने के 5 तरीके लिखें। हर समूह अपना सबसे अच्छा विचार बताए।', duration: '9 मिनट' },
            { phase: 'Evaluate', title: 'चक्र बनाओ', description: 'बच्चे लेबल के साथ सरल जल चक्र बनाएँ: वाष्पीकरण, बादल, बारिश, नदी।', duration: '5 मिनट' },
        ],
        assessment: 'बच्चे अपना पसंदीदा जल स्रोत बनाएँ और 2 वाक्यों में लिखें कि पानी बचाना क्यों ज़रूरी है।',
    },
];

/** Map language strings to our example language keys */
function resolveExampleLanguage(lang?: string): 'English' | 'Hindi' {
    if (!lang) return 'English';
    if (lang === 'Hindi') return 'Hindi';
    return 'English';
}

/**
 * Match an onboarding example to the teacher's subject + grade + language.
 * Tries exact language match first, falls back to English.
 */
export function getOnboardingExample(
    subjects: string[],
    gradeLevels: string[],
    preferredLanguage?: string
): OnboardingExample {
    const lang = resolveExampleLanguage(preferredLanguage);

    // Parse grade numbers
    const gradeNums = gradeLevels
        .map(g => {
            const match = g.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null);

    const midGrade = gradeNums.length > 0
        ? gradeNums[Math.floor(gradeNums.length / 2)]
        : 6;

    // Map profile subjects to example subjects
    const subjectMap: Record<string, string[]> = {
        'Mathematics': ['Mathematics'],
        'Science': ['Science'],
        'Social Science': ['Social Science'],
        'History': ['Social Science'],
        'Geography': ['Social Science'],
        'Civics': ['Social Science'],
        'English': ['English'],
        'Hindi': ['Hindi'],
        'Environmental Studies (EVS)': ['Environmental Studies (EVS)'],
    };

    // Try preferred language first, then fallback to English
    const langPriority = lang === 'Hindi' ? ['Hindi', 'English'] as const : ['English', 'Hindi'] as const;

    for (const tryLang of langPriority) {
        for (const subj of subjects) {
            const exampleSubjects = subjectMap[subj] || [subj];
            for (const es of exampleSubjects) {
                const match = examples.find(
                    e => e.language === tryLang && e.subject === es && midGrade >= e.gradeRange[0] && midGrade <= e.gradeRange[1]
                );
                if (match) return match;
            }
        }
    }

    // Fallback: closest grade match in preferred language
    for (const tryLang of langPriority) {
        const byGrade = examples.find(
            e => e.language === tryLang && midGrade >= e.gradeRange[0] && midGrade <= e.gradeRange[1]
        );
        if (byGrade) return byGrade;
    }

    // Ultimate fallback
    return examples[0];
}
