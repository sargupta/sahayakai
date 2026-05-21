/**
 * Regional Anchors Database
 *
 * State-level hyperlocal context for AI lesson planning. The default
 * `IndianContext` in `indian-context.ts` is pan-India generic — good
 * enough for "use rupees and rotis" but not enough to make a Karnataka
 * teacher's gravity lesson feel like it belongs in their classroom
 * (coconut tree at the village temple) versus a Punjab teacher's
 * (sarson cycle, Lohri).
 *
 * Seed coverage: 11 states + 1 generic fallback for unmapped states.
 * v1 is a static lookup. Future v2 may add district-level overrides
 * sourced from teacher community contributions.
 *
 * Format note: each list is intentionally short (10-15 items) so the
 * prompt context block stays ~250-400 tokens per lesson. Larger lists
 * burn tokens without measurably improving output quality and risk
 * displacing the actual pedagogy from the model's attention window.
 */

export interface RegionalAnchors {
    /** Canonical state name as used in `UserProfile.state`. */
    state: string;
    /** Common name (for prompt readability). */
    displayName: string;
    /** Staple crops grown locally — anchor for biology, economics, geography. */
    crops: string[];
    /** Local fruits — anchor for maths word problems, science (parts of plant). */
    fruits: string[];
    /** Trees common to the landscape — anchor for gravity, photosynthesis, ecology. */
    trees: string[];
    /** Festivals — anchor for social science, language, dates. */
    festivals: string[];
    /** Geographic features — anchor for geography, water cycle, climate. */
    geography: string[];
    /** Animals locally familiar — anchor for biology, food chains. */
    animals: string[];
    /** Local markets and produce — anchor for maths money problems. */
    markets: string[];
    /** Common professions and crafts — anchor for civics, economics, careers. */
    professions: string[];
    /** Iconic local foods — anchor for word problems, cultural relevance. */
    foods: string[];
    /** Common languages spoken in the state (for cultural references). */
    languages: string[];
}

const ANCHORS: Record<string, RegionalAnchors> = {
    karnataka: {
        state: 'Karnataka',
        displayName: 'Karnataka',
        crops: ['ragi', 'jowar', 'rice', 'sugarcane', 'coffee', 'arecanut', 'cotton'],
        fruits: ['mango (Alphonso)', 'jackfruit', 'banana', 'coconut', 'sapota'],
        trees: ['coconut tree', 'neem', 'banyan', 'sandalwood', 'jackfruit tree', 'tamarind'],
        festivals: ['Mysore Dasara', 'Ugadi', 'Karaga', 'Makara Sankranti', 'Ganesh Chaturthi'],
        geography: ['Western Ghats', 'Kaveri (Cauvery) river', 'Tungabhadra river', 'Jog Falls', 'Coorg hills', 'Bandipur forest'],
        animals: ['Indian elephant', 'tiger (Bandipur)', 'cow', 'bullock', 'peacock', 'hornbill'],
        markets: ['Devaraja Market (Mysore)', 'KR Market (Bengaluru)', 'Sunday santhe (village market)'],
        professions: ['silk weaver (Mysore)', 'coffee farmer (Coorg)', 'agarbatti maker', 'sandalwood artisan'],
        foods: ['ragi mudde', 'bisi bele bath', 'dosa', 'idli', 'kesari bath', 'Mysore pak'],
        languages: ['Kannada', 'Tulu', 'Konkani'],
    },
    'west bengal': {
        state: 'West Bengal',
        displayName: 'West Bengal',
        crops: ['paddy (rice)', 'jute', 'mustard', 'potato', 'tea (Darjeeling)', 'sugarcane'],
        fruits: ['mango (Himsagar)', 'lychee', 'banana', 'guava', 'jackfruit'],
        trees: ['mango tree', 'banyan', 'palm', 'sal', 'sundari (Sundarbans)', 'krishnachura'],
        festivals: ['Durga Puja', 'Poila Boishakh (Bengali New Year)', 'Saraswati Puja', 'Kali Puja', 'Rath Yatra'],
        geography: ['Sundarbans mangroves', 'Ganga (Hooghly)', 'Darjeeling tea gardens', 'Bay of Bengal', 'Kanchenjunga'],
        animals: ['Royal Bengal tiger', 'hilsa fish', 'rohu', 'cow', 'crocodile (Sundarbans)'],
        markets: ['New Market (Kolkata)', 'Gariahat', 'haat (village market)', 'Manicktala bazaar'],
        professions: ['paddy farmer', 'jute mill worker', 'fisherman', 'tea plucker (Darjeeling)', 'sweet maker'],
        foods: ['bhaat-machher jhol (rice and fish curry)', 'mishti doi', 'rasgulla', 'shorshe ilish', 'chingri malai curry'],
        languages: ['Bengali', 'Hindi', 'Nepali', 'Santali'],
    },
    'tamil nadu': {
        state: 'Tamil Nadu',
        displayName: 'Tamil Nadu',
        crops: ['rice', 'sugarcane', 'banana', 'cotton', 'turmeric', 'groundnut'],
        fruits: ['banana', 'mango', 'jackfruit', 'tamarind', 'coconut', 'guava'],
        trees: ['coconut palm', 'palmyra palm', 'tamarind', 'banyan', 'neem', 'mango'],
        festivals: ['Pongal', 'Tamil New Year (Puthandu)', 'Aadi Perukku', 'Karthigai Deepam', 'Mahamaham'],
        geography: ['Cauvery delta', 'Eastern Ghats', 'Nilgiri hills (Ooty)', 'Marina Beach', 'Vaigai river', 'Palar river'],
        animals: ['cow', 'temple elephant', 'goat', 'paddy field birds', 'jallikattu bull'],
        markets: ['Koyambedu (Chennai)', 'Pothys', 'T. Nagar shopping', 'village uzhavar santhai (farmers market)'],
        professions: ['rice farmer', 'silk weaver (Kanchipuram)', 'fisherman (Rameswaram)', 'temple priest', 'cotton mill worker'],
        foods: ['idli', 'dosa', 'pongal', 'sambar', 'rasam', 'murukku', 'chettinad chicken', 'kothu parotta'],
        languages: ['Tamil'],
    },
    kerala: {
        state: 'Kerala',
        displayName: 'Kerala',
        crops: ['rice', 'rubber', 'coconut', 'pepper', 'cardamom', 'tea', 'coffee', 'banana'],
        fruits: ['banana (nendran)', 'jackfruit', 'mango', 'coconut', 'pineapple'],
        trees: ['coconut palm', 'rubber tree', 'jackfruit', 'mango', 'teak', 'sandalwood'],
        festivals: ['Onam', 'Vishu', 'Thrissur Pooram', 'Eid', 'Christmas'],
        geography: ['backwaters (Vembanad)', 'Western Ghats', 'Arabian Sea coast', 'Munnar hills', 'Periyar river'],
        animals: ['Indian elephant', 'fish (sardine, mackerel)', 'cow', 'parakeet'],
        markets: ['Connemara Market', 'Broadway (Kochi)', 'spice market (Mattancherry)'],
        professions: ['fisherman', 'coir worker', 'spice farmer', 'rubber tapper', 'kathakali artist', 'snake boat oarsman'],
        foods: ['puttu and kadala curry', 'appam and stew', 'fish moilee', 'banana chips', 'sadya'],
        languages: ['Malayalam'],
    },
    punjab: {
        state: 'Punjab',
        displayName: 'Punjab',
        crops: ['wheat', 'sarson (mustard)', 'sugarcane', 'rice', 'cotton', 'maize'],
        fruits: ['kinnow (orange)', 'mango', 'guava', 'pear'],
        trees: ['peepal', 'banyan', 'shisham', 'mango', 'kikar'],
        festivals: ['Lohri', 'Baisakhi', 'Gurpurab', 'Hola Mohalla', 'Teej'],
        geography: ['Sutlej river', 'Beas river', 'Bhakra dam', 'Punjab plains', 'Harike wetland'],
        animals: ['buffalo', 'cow', 'bullock', 'horse', 'sparrow'],
        markets: ['Sadar Bazaar (Amritsar)', 'mandi (grain market)', 'village haveli shop'],
        professions: ['wheat farmer', 'dairy farmer', 'truck driver', 'mandi commission agent', 'phulkari embroiderer'],
        foods: ['makki di roti and sarson da saag', 'chole bhature', 'lassi', 'paratha with white butter', 'kheer'],
        languages: ['Punjabi', 'Hindi'],
    },
    maharashtra: {
        state: 'Maharashtra',
        displayName: 'Maharashtra',
        crops: ['jowar', 'bajra', 'sugarcane', 'cotton', 'soybean', 'grapes (Nashik)', 'pulses'],
        fruits: ['Alphonso mango', 'banana', 'grape', 'pomegranate', 'orange (Nagpur)'],
        trees: ['mango', 'tamarind', 'neem', 'banyan', 'cashew (Konkan)', 'jamun'],
        festivals: ['Ganesh Chaturthi', 'Gudi Padwa', 'Diwali', 'Pola (bullock festival)', 'Nag Panchami'],
        geography: ['Western Ghats (Sahyadri)', 'Godavari river', 'Krishna river', 'Konkan coast', 'Lonar crater lake'],
        animals: ['bullock', 'cow', 'tiger (Tadoba)', 'peacock', 'goat'],
        markets: ['Crawford Market (Mumbai)', 'Pune Mandai', 'APMC mandi', 'weekly bazaar'],
        professions: ['sugarcane farmer', 'cotton farmer', 'fisherman (Koli)', 'warkari (pilgrim)', 'lavani performer'],
        foods: ['vada pav', 'misal pav', 'puran poli', 'modak', 'bhakri and pitla', 'shrikhand'],
        languages: ['Marathi', 'Hindi', 'Konkani'],
    },
    gujarat: {
        state: 'Gujarat',
        displayName: 'Gujarat',
        crops: ['cotton', 'groundnut', 'castor', 'cumin', 'mustard', 'wheat', 'bajra'],
        fruits: ['mango (Kesar)', 'chikoo', 'guava', 'banana'],
        trees: ['neem', 'mango', 'babul', 'banyan', 'rayan'],
        festivals: ['Navratri (garba)', 'Uttarayan (kite flying)', 'Diwali', 'Janmashtami', 'Rann Utsav'],
        geography: ['Rann of Kutch (white desert)', 'Gir forest', 'Narmada river', 'Sabarmati river', 'Arabian Sea coast'],
        animals: ['Asiatic lion (Gir)', 'camel (Kutch)', 'cow', 'buffalo', 'flamingo'],
        markets: ['Manek Chowk (Ahmedabad)', 'Law Garden', 'village haat'],
        professions: ['cotton farmer', 'diamond polisher (Surat)', 'salt pan worker (Kutch)', 'bandhani artisan'],
        foods: ['dhokla', 'thepla', 'undhiyu', 'fafda', 'khandvi', 'shrikhand', 'gujarati thali'],
        languages: ['Gujarati', 'Hindi'],
    },
    'uttar pradesh': {
        state: 'Uttar Pradesh',
        displayName: 'Uttar Pradesh',
        crops: ['wheat', 'sugarcane', 'rice', 'potato', 'mustard', 'mango', 'pulses'],
        fruits: ['mango (Dasheri, Langda)', 'guava (Allahabad)', 'banana', 'amla'],
        trees: ['mango', 'neem', 'peepal', 'banyan', 'mahua', 'eucalyptus'],
        festivals: ['Diwali', 'Holi', 'Eid', 'Chhath', 'Ram Navami', 'Krishna Janmashtami', 'Kumbh Mela'],
        geography: ['Ganga river', 'Yamuna river', 'Sangam (Prayagraj)', 'Vindhya hills', 'Terai grasslands'],
        animals: ['cow', 'buffalo', 'monkey (Mathura)', 'sarus crane', 'tiger (Dudhwa)'],
        markets: ['Hazratganj (Lucknow)', 'Chowk (Lucknow)', 'mandi (sugar town)', 'weekly haat'],
        professions: ['wheat farmer', 'sugarcane farmer', 'chikankari embroiderer (Lucknow)', 'brass artisan (Moradabad)'],
        foods: ['tunday kababi', 'litti chokha', 'puri-sabzi', 'jalebi', 'galouti kebab', 'malaiyo'],
        languages: ['Hindi', 'Urdu', 'Awadhi', 'Bhojpuri'],
    },
    bihar: {
        state: 'Bihar',
        displayName: 'Bihar',
        crops: ['rice', 'wheat', 'maize', 'sugarcane', 'pulses', 'litchi (Muzaffarpur)', 'makhana (foxnut)'],
        fruits: ['mango', 'litchi (Muzaffarpur)', 'banana (Hajipur)', 'guava'],
        trees: ['mango', 'litchi', 'banyan', 'peepal', 'bamboo'],
        festivals: ['Chhath Puja', 'Diwali', 'Holi', 'Eid', 'Sonepur Mela', 'Sama Chakeva'],
        geography: ['Ganga river', 'Kosi river', 'Gandak river', 'Bodh Gaya', 'Rajgir hills'],
        animals: ['cow', 'buffalo', 'gangetic dolphin', 'tiger (Valmiki)'],
        markets: ['Patna Market', 'mandi', 'village haat'],
        professions: ['paddy farmer', 'makhana cultivator', 'litchi orchard worker', 'Madhubani painter'],
        foods: ['litti chokha', 'sattu paratha', 'makhana kheer', 'thekua', 'dal pitha'],
        languages: ['Hindi', 'Bhojpuri', 'Maithili', 'Magahi'],
    },
    'andhra pradesh': {
        state: 'Andhra Pradesh',
        displayName: 'Andhra Pradesh',
        crops: ['rice', 'chili (Guntur)', 'cotton', 'sugarcane', 'turmeric', 'tobacco', 'groundnut'],
        fruits: ['mango (Banganapalli)', 'banana', 'guava', 'sapota'],
        trees: ['coconut', 'mango', 'tamarind', 'palmyra', 'neem'],
        festivals: ['Ugadi', 'Sankranti', 'Bonalu', 'Brahmotsavam (Tirupati)', 'Atla Tadde'],
        geography: ['Krishna river', 'Godavari river', 'Eastern Ghats', 'Araku valley', 'Bay of Bengal coast'],
        animals: ['cow', 'buffalo', 'fish (Krishna delta)', 'peacock'],
        markets: ['Rythu Bazaar (farmer market)', 'Sultan Bazaar', 'fish landing centre'],
        professions: ['paddy farmer', 'chili farmer (Guntur)', 'kalamkari artisan', 'fisherman'],
        foods: ['gongura pachadi', 'Andhra meals', 'pulihora', 'pesarattu', 'Hyderabadi biryani', 'pootharekulu'],
        languages: ['Telugu', 'Urdu'],
    },
    telangana: {
        state: 'Telangana',
        displayName: 'Telangana',
        crops: ['rice', 'cotton', 'maize', 'turmeric', 'chili', 'pulses'],
        fruits: ['mango', 'guava', 'banana', 'custard apple'],
        trees: ['neem', 'banyan', 'tamarind', 'palmyra'],
        festivals: ['Bonalu', 'Bathukamma', 'Ugadi', 'Sankranti', 'Ramzan'],
        geography: ['Krishna river', 'Godavari river', 'Hussain Sagar lake', 'Deccan plateau'],
        animals: ['cow', 'buffalo', 'goat', 'peacock'],
        markets: ['Charminar bazaar', 'Sultan Bazaar', 'Rythu Bazaar'],
        professions: ['paddy farmer', 'cotton farmer', 'pearl artisan (Hyderabad)', 'weaver (Pochampally)'],
        foods: ['Hyderabadi biryani', 'haleem', 'sarva pindi', 'Bagara baingan', 'qubani ka meetha'],
        languages: ['Telugu', 'Urdu'],
    },
    odisha: {
        state: 'Odisha',
        displayName: 'Odisha',
        crops: ['rice', 'pulses', 'jute', 'sugarcane', 'cashew', 'turmeric'],
        fruits: ['mango', 'cashew', 'banana', 'jackfruit'],
        trees: ['sal', 'mango', 'mahua', 'coconut', 'kendu'],
        festivals: ['Rath Yatra (Puri)', 'Durga Puja', 'Raja parba', 'Kartik Purnima', 'Nuakhai'],
        geography: ['Mahanadi river', 'Chilika lake', 'Bay of Bengal', 'Simlipal forest', 'Konark coast'],
        animals: ['Olive Ridley turtle', 'elephant', 'cow', 'tiger (Simlipal)'],
        markets: ['Bada Bazaar (Cuttack)', 'Unit-1 market', 'haat'],
        professions: ['paddy farmer', 'fisherman (Chilika)', 'Pattachitra painter', 'sand sculptor'],
        foods: ['dalma', 'pakhala bhata', 'chhena poda', 'macha besara', 'rasgulla (Pahala)'],
        languages: ['Odia'],
    },
    rajasthan: {
        state: 'Rajasthan',
        displayName: 'Rajasthan',
        crops: ['bajra', 'jowar', 'wheat', 'mustard', 'guar (cluster bean)', 'gram'],
        fruits: ['kinnow', 'ber (Indian jujube)', 'date palm', 'pomegranate'],
        trees: ['khejri (state tree)', 'babul', 'neem', 'rohida', 'banyan'],
        festivals: ['Teej', 'Gangaur', 'Pushkar fair', 'Marwar festival', 'Diwali'],
        geography: ['Thar desert', 'Aravalli hills', 'Chambal river', 'Sambhar salt lake', 'Mount Abu'],
        animals: ['camel (state animal)', 'cow', 'goat', 'blackbuck', 'chinkara', 'peacock'],
        markets: ['Johari Bazaar (Jaipur)', 'Bapu Bazaar', 'haveli market'],
        professions: ['camel herder', 'bajra farmer', 'block printer (Bagru)', 'blue pottery artisan (Jaipur)', 'folk singer'],
        foods: ['dal baati churma', 'gatte ki sabzi', 'ker sangri', 'ghevar', 'pyaaz kachori'],
        languages: ['Hindi', 'Rajasthani', 'Marwari'],
    },
    delhi: {
        state: 'Delhi',
        displayName: 'Delhi',
        crops: ['wheat', 'mustard', 'vegetables (peri-urban)'],
        fruits: ['mango', 'guava', 'banana'],
        trees: ['neem', 'peepal', 'banyan', 'amaltas'],
        festivals: ['Diwali', 'Holi', 'Eid', 'Republic Day parade', 'Lohri', 'Dussehra (Ramlila)'],
        geography: ['Yamuna river', 'Aravalli ridge', 'Red Fort area', 'India Gate'],
        animals: ['cow', 'monkey', 'pigeon', 'peacock (Lodhi gardens)'],
        markets: ['Chandni Chowk', 'Sarojini Nagar', 'Khan Market', 'Azadpur mandi (Asia\'s largest)'],
        professions: ['shopkeeper', 'auto driver', 'street food vendor', 'civil servant'],
        foods: ['chole bhature', 'paratha (Chandni Chowk)', 'butter chicken', 'rajma chawal', 'kulfi'],
        languages: ['Hindi', 'Urdu', 'Punjabi', 'English'],
    },
    haryana: {
        state: 'Haryana',
        displayName: 'Haryana',
        crops: ['wheat', 'rice', 'sugarcane', 'mustard', 'bajra', 'cotton'],
        fruits: ['mango', 'guava', 'kinnow'],
        trees: ['peepal', 'banyan', 'shisham', 'neem'],
        festivals: ['Lohri', 'Baisakhi', 'Teej', 'Holi', 'Gugga Navami'],
        geography: ['Yamuna river', 'Aravalli foothills', 'Sutlej-Yamuna canal'],
        animals: ['buffalo (Murrah)', 'cow', 'horse', 'bullock'],
        markets: ['grain mandi', 'Sadar Bazaar'],
        professions: ['dairy farmer', 'wheat farmer', 'wrestler (akhara)', 'phulkari artisan'],
        foods: ['bajra khichdi', 'kadhi pakora', 'lassi', 'churma', 'singri ki sabzi'],
        languages: ['Hindi', 'Haryanvi', 'Punjabi'],
    },
    'madhya pradesh': {
        state: 'Madhya Pradesh',
        displayName: 'Madhya Pradesh',
        crops: ['soybean', 'wheat', 'gram', 'maize', 'rice', 'cotton'],
        fruits: ['mango', 'orange (Indore)', 'banana', 'custard apple'],
        trees: ['sal', 'teak', 'mahua', 'mango', 'banyan'],
        festivals: ['Diwali', 'Holi', 'Lok Rang', 'Khajuraho dance festival', 'Eid'],
        geography: ['Narmada river', 'Vindhya range', 'Satpura range', 'Kanha national park', 'Pachmarhi hills'],
        animals: ['tiger (Bandhavgarh, Kanha)', 'cow', 'goat', 'barasingha'],
        markets: ['Sarafa Bazaar (Indore)', 'mandi', 'haat'],
        professions: ['soybean farmer', 'Chanderi weaver', 'bidi roller', 'forest guard'],
        foods: ['poha-jalebi (Indore)', 'bhutte ki kees', 'dal bafla', 'sabudana khichdi', 'malpua'],
        languages: ['Hindi', 'Bundeli', 'Malvi'],
    },
    'jammu and kashmir': {
        state: 'Jammu and Kashmir',
        displayName: 'Jammu and Kashmir',
        crops: ['rice', 'apple', 'saffron', 'walnut', 'cherry', 'wheat'],
        fruits: ['apple (Kashmiri)', 'cherry', 'walnut', 'apricot', 'pear'],
        trees: ['chinar', 'deodar', 'walnut', 'apple', 'willow'],
        festivals: ['Eid', 'Navroz', 'Lohri', 'Baisakhi', 'Hemis festival (Ladakh)'],
        geography: ['Himalayas', 'Dal Lake', 'Jhelum river', 'Chenab river', 'Pir Panjal range'],
        animals: ['Kashmiri goat (pashmina)', 'sheep', 'yak (Ladakh)', 'hangul deer'],
        markets: ['Lal Chowk (Srinagar)', 'floating market (Dal Lake)'],
        professions: ['apple orchard worker', 'saffron farmer (Pampore)', 'pashmina weaver', 'shikara boatman'],
        foods: ['rogan josh', 'yakhni', 'kahwa', 'Kashmiri pulao', 'tabak maaz'],
        languages: ['Kashmiri', 'Urdu', 'Dogri', 'Ladakhi'],
    },
    assam: {
        state: 'Assam',
        displayName: 'Assam',
        crops: ['tea', 'rice', 'jute', 'sugarcane', 'mustard'],
        fruits: ['banana', 'pineapple', 'mango', 'coconut', 'oranges'],
        trees: ['hollong (state tree)', 'sal', 'bamboo', 'tea plant'],
        festivals: ['Bihu (Rongali, Bhogali, Kongali)', 'Durga Puja', 'Ambubachi mela', 'Eid'],
        geography: ['Brahmaputra river', 'Kaziranga national park', 'Majuli river island', 'tea gardens'],
        animals: ['one-horned rhinoceros (Kaziranga)', 'elephant', 'gangetic dolphin', 'cow'],
        markets: ['Fancy Bazaar (Guwahati)', 'weekly haat'],
        professions: ['tea plucker', 'paddy farmer', 'silk weaver (Sualkuchi muga)', 'mahout (elephant keeper)'],
        foods: ['masor tenga (sour fish curry)', 'pitha', 'khar', 'duck with pumpkin', 'jolpan'],
        languages: ['Assamese', 'Bodo', 'Bengali'],
    },
    chhattisgarh: {
        state: 'Chhattisgarh',
        displayName: 'Chhattisgarh',
        crops: ['rice', 'maize', 'pulses', 'oilseeds', 'sugarcane'],
        fruits: ['mango', 'guava', 'banana', 'jamun'],
        trees: ['sal', 'teak', 'mahua', 'tendu (bidi leaf)', 'bamboo'],
        festivals: ['Hareli', 'Pola', 'Bastar Dussehra', 'Diwali'],
        geography: ['Mahanadi river', 'Chitrakote falls (India\'s Niagara)', 'Bastar forests'],
        animals: ['wild buffalo (state animal)', 'tiger', 'cow', 'sloth bear'],
        markets: ['weekly haat bazaar', 'Sadar Bazaar (Raipur)'],
        professions: ['paddy farmer', 'tendu leaf collector', 'mahua liquor maker', 'Bastar tribal artisan'],
        foods: ['chila', 'faraa', 'aamat', 'bafauri', 'tilgur'],
        languages: ['Hindi', 'Chhattisgarhi', 'Gondi'],
    },
    jharkhand: {
        state: 'Jharkhand',
        displayName: 'Jharkhand',
        crops: ['rice', 'maize', 'pulses', 'wheat'],
        fruits: ['mango', 'jackfruit', 'guava', 'litchi'],
        trees: ['sal', 'mahua', 'palash', 'bamboo'],
        festivals: ['Sarhul', 'Karma', 'Sohrai', 'Tusu Parab', 'Chhath'],
        geography: ['Damodar river', 'Subarnarekha river', 'Chota Nagpur plateau', 'Hundru falls', 'Netarhat hills'],
        animals: ['Indian elephant', 'tiger (Betla)', 'cow'],
        markets: ['Main Road (Ranchi)', 'haat bazaar'],
        professions: ['paddy farmer', 'mineworker (coal/iron)', 'Sohrai painter', 'tribal artisan'],
        foods: ['dhuska', 'pittha', 'litti chokha', 'thekua', 'rugra (mushroom curry)'],
        languages: ['Hindi', 'Santali', 'Ho', 'Mundari'],
    },
};

/**
 * Generic fallback used when teacher's state is missing or not in the
 * seed list. Intentionally pan-India so the lesson still feels Indian
 * (rupees, monsoon, festivals) — just not state-specific.
 */
const GENERIC_INDIA: RegionalAnchors = {
    state: 'India (generic)',
    displayName: 'India',
    crops: ['rice', 'wheat', 'sugarcane', 'cotton', 'pulses'],
    fruits: ['mango', 'banana', 'guava', 'coconut'],
    trees: ['mango tree', 'neem', 'banyan', 'peepal', 'coconut palm'],
    festivals: ['Diwali', 'Holi', 'Eid', 'Pongal', 'Onam'],
    geography: ['Ganga river', 'Himalayas', 'Western Ghats', 'monsoon plains'],
    animals: ['cow', 'buffalo', 'peacock', 'elephant'],
    markets: ['local mandi', 'sabzi mandi (vegetable market)', 'weekly haat'],
    professions: ['farmer', 'shopkeeper', 'teacher', 'weaver'],
    foods: ['roti', 'dal', 'rice', 'sabzi'],
    languages: ['Hindi', 'English'],
};

function normaliseStateKey(state: string | undefined | null): string | null {
    if (!state) return null;
    return state.trim().toLowerCase();
}

/**
 * Resolve the anchors for a given state. Returns the generic India
 * fallback if the state is missing or not in the seed list.
 *
 * Match is case-insensitive and trims whitespace. Common alias handling
 * (e.g. "J&K" → "jammu and kashmir") is best-effort — we keep the alias
 * map small and only add aliases that appear in real user profiles.
 */
export function getRegionalAnchors(state: string | undefined | null): RegionalAnchors {
    const key = normaliseStateKey(state);
    if (!key) return GENERIC_INDIA;

    // Direct lookup
    if (ANCHORS[key]) return ANCHORS[key];

    // Common aliases / spellings we've seen in user data
    const ALIASES: Record<string, string> = {
        'j&k': 'jammu and kashmir',
        'jk': 'jammu and kashmir',
        'tn': 'tamil nadu',
        'ka': 'karnataka',
        'wb': 'west bengal',
        'mp': 'madhya pradesh',
        'up': 'uttar pradesh',
        'ap': 'andhra pradesh',
        'tg': 'telangana',
        'mh': 'maharashtra',
        'gj': 'gujarat',
        'rj': 'rajasthan',
        'pb': 'punjab',
        'hr': 'haryana',
        'br': 'bihar',
        'jh': 'jharkhand',
        'or': 'odisha',
        'odisha (orissa)': 'odisha',
        'orissa': 'odisha',
        'pondicherry': 'tamil nadu', // Cultural proximity; better than generic
    };
    const aliasResolved = ALIASES[key];
    if (aliasResolved && ANCHORS[aliasResolved]) return ANCHORS[aliasResolved];

    return GENERIC_INDIA;
}

/**
 * Render the anchors as a compact prompt context block. The block is
 * intentionally explicit ("USE these examples, NOT these other ones")
 * because soft suggestions get diluted across the long lesson prompt.
 *
 * Length: ~250-400 tokens depending on state. Cost analysis in the
 * commit footer.
 */
export function renderRegionalContextBlock(
    state: string | undefined | null,
    subject?: string,
): string {
    const anchors = getRegionalAnchors(state);
    const isGeneric = anchors.state === 'India (generic)';
    const subjectHint = subject ? ` (this lesson is on ${subject})` : '';

    const header = isGeneric
        ? `**HYPERLOCAL EXAMPLES (use Indian context throughout)${subjectHint}:**`
        : `**HYPERLOCAL EXAMPLES — teacher is in ${anchors.displayName}${subjectHint}:**`;

    return `
${header}
Every concrete example, word problem, name, food, plant, animal, festival, market, currency or scenario you mention MUST be drawn from this teacher's region. Generic textbook examples (Western apples, dollars, snowmen, autumn leaves) are a critical failure for this lesson.

Use these state-specific anchors as your example pool:
- Crops grown locally: ${anchors.crops.join(', ')}
- Local fruits: ${anchors.fruits.join(', ')}
- Trees a student would see daily: ${anchors.trees.join(', ')}
- Festivals familiar to the child: ${anchors.festivals.join(', ')}
- Geographic features nearby: ${anchors.geography.join(', ')}
- Animals locally known: ${anchors.animals.join(', ')}
- Markets and shops: ${anchors.markets.join(', ')}
- Common adult professions in the area: ${anchors.professions.join(', ')}
- Foods on the family dinner plate: ${anchors.foods.join(', ')}
- Languages spoken at home: ${anchors.languages.join(', ')}

Concrete anchoring rules:
1. Open the Engage phase with a sensory hook that uses one of the items above (a coconut falling, mustard fields turning yellow, a mandi vendor weighing chillies). Do NOT open with Newton's apple, a snowman, a hamburger, or a generic "imagine a plant".
2. All money problems use ₹ (rupees) and prices realistic to a small Indian market. Never dollars/cents/pounds.
3. All weights/measures use kilograms, litres, metres. Never pounds/gallons/miles.
4. Any historical or biographical reference defaults to Indian figures and Indian history.
5. If the topic genuinely requires a non-Indian example (e.g. solar system, world wars), explicitly say "scientists in India and across the world…" — do not let the lesson drift into a Western-only frame.
6. ${isGeneric ? 'State not specified — use pan-India anchors above and avoid state-specific claims (no "in your district" phrasing).' : `When relevant, name the local geographic feature directly ("Kaveri river" not "a river", "Western Ghats" not "some hills").`}
`;
}

/**
 * Exported for tests and tooling. Number of states currently seeded.
 */
export const SEEDED_STATE_COUNT = Object.keys(ANCHORS).length;

/**
 * Exported for tests. Returns the full anchor map so test fixtures can
 * iterate without re-reading the file.
 */
export function _getAnchorMapForTesting(): Record<string, RegionalAnchors> {
    return ANCHORS;
}
