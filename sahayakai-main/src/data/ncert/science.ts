/**
 * NCERT Science / EVS Curriculum
 * Grades 3–5: EVS "Looking Around" (NCF-2023)
 * Grades 6–8: Science "Curiosity" (NCF-2023, new 2024–26 rollout)
 * Grades 9–10: Science NCERT (Rationalized-2022)
 */

import { NCERTGrade } from './mathematics';

export const NCERTScience: NCERTGrade[] = [
    // -----------------------------------------------------------------------
    // GRADES 3–5 — EVS "Looking Around"  (NCF-2023)
    // -----------------------------------------------------------------------
    {
        grade: 3,
        subject: 'Science',
        chapters: [
            { id: 'sci-3-1',  number: 1,  title: 'Poonam\'s Day Out',         titleHindi: 'पूनम का दिन',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Observe plants and animals in surroundings', 'Understand habitats'], keywords: ['animals', 'plants', 'habitat'], estimatedPeriods: 4 },
            { id: 'sci-3-2',  number: 2,  title: 'The Plant Fairy',            titleHindi: 'पौधों की परी',                    textbookName: 'Looking Around (EVS)', learningOutcomes: ['Types of plants', 'Parts of plants'], keywords: ['plants', 'leaves', 'stem'], estimatedPeriods: 5 },
            { id: 'sci-3-3',  number: 3,  title: 'Water O Water!',             titleHindi: 'पानी रे पानी!',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Sources of water', 'Water conservation', 'Uses of water'], keywords: ['water', 'rain', 'river'], estimatedPeriods: 5 },
            { id: 'sci-3-4',  number: 4,  title: 'Our First School',           titleHindi: 'हमारा पहला स्कूल',                textbookName: 'Looking Around (EVS)', learningOutcomes: ['Family as first learning environment', 'Roles in family'], keywords: ['family', 'home', 'school'], estimatedPeriods: 4 },
            { id: 'sci-3-5',  number: 5,  title: 'Chhotu\'s House',            titleHindi: 'छोटू का घर',                      textbookName: 'Looking Around (EVS)', learningOutcomes: ['Different types of homes', 'Materials used in houses'], keywords: ['house', 'shelter', 'materials'], estimatedPeriods: 4 },
            { id: 'sci-3-6',  number: 6,  title: 'Foods We Eat',               titleHindi: 'खाना खाएँ',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Variety of food', 'Food from plants and animals'], keywords: ['food', 'nutrition', 'plants'], estimatedPeriods: 5 },
            { id: 'sci-3-7',  number: 7,  title: 'Saying Without Speaking',    titleHindi: 'बिना बोले बात',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Body language', 'Sign language', 'Communication without words'], keywords: ['communication', 'senses'], estimatedPeriods: 4 },
            { id: 'sci-3-8',  number: 8,  title: 'Flying High',                titleHindi: 'उड़ान',                            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Birds and their features', 'How birds fly'], keywords: ['birds', 'wings', 'flight'], estimatedPeriods: 5 },
            { id: 'sci-3-9',  number: 9,  title: 'It\'s Raining',              titleHindi: 'बरसात',                           textbookName: 'Looking Around (EVS)', learningOutcomes: ['Water cycle', 'Rain and its uses'], keywords: ['rain', 'water cycle', 'clouds'], estimatedPeriods: 5 },
            { id: 'sci-3-10', number: 10, title: 'What is Cooking?',           titleHindi: 'खाना बनाना',                      textbookName: 'Looking Around (EVS)', learningOutcomes: ['How food is cooked', 'Heat and fire'], keywords: ['cooking', 'heat', 'fire'], estimatedPeriods: 4 },
            { id: 'sci-3-11', number: 11, title: 'From Here to There',         titleHindi: 'एक जगह से दूसरी जगह',            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Modes of transport', 'Changes in transport over time'], keywords: ['transport', 'travel'], estimatedPeriods: 4 },
            { id: 'sci-3-12', number: 12, title: 'Work We Do',                 titleHindi: 'हम सब काम करते हैं',              textbookName: 'Looking Around (EVS)', learningOutcomes: ['Dignity of labour', 'Different types of work'], keywords: ['work', 'occupation', 'labour'], estimatedPeriods: 4 },
            { id: 'sci-3-13', number: 13, title: 'Sharing Our Feelings',       titleHindi: 'भावनाएँ',                         textbookName: 'Looking Around (EVS)', learningOutcomes: ['Express emotions', 'Empathy'], keywords: ['feelings', 'emotions', 'sharing'], estimatedPeriods: 4 },
            { id: 'sci-3-14', number: 14, title: 'The Story of Food',          titleHindi: 'खाने की कहानी',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Food travels from farm to table', 'Farming practices'], keywords: ['food', 'farming', 'farmer'], estimatedPeriods: 5 },
            { id: 'sci-3-15', number: 15, title: 'Making Pots',                titleHindi: 'बर्तन बनाना',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Potter\'s craft', 'Clay as material', 'Traditional skills'], keywords: ['pottery', 'clay', 'craft'], estimatedPeriods: 4 },
            { id: 'sci-3-16', number: 16, title: 'Games We Play',              titleHindi: 'खेल खेलें',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Outdoor games', 'Teamwork and rules'], keywords: ['games', 'sports', 'teamwork'], estimatedPeriods: 4 },
            { id: 'sci-3-17', number: 17, title: 'Here Comes a Letter',        titleHindi: 'पत्र',                            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Communication through letters', 'Post office'], keywords: ['letter', 'communication', 'post'], estimatedPeriods: 4 },
            { id: 'sci-3-18', number: 18, title: 'A House Like This',          titleHindi: 'ऐसा घर',                          textbookName: 'Looking Around (EVS)', learningOutcomes: ['Homes in different climates', 'Adaptations in houses'], keywords: ['house', 'climate', 'adaptation'], estimatedPeriods: 4 },
            { id: 'sci-3-19', number: 19, title: 'Our Friends, Animals',       titleHindi: 'हमारे पशु-पक्षी मित्र',           textbookName: 'Looking Around (EVS)', learningOutcomes: ['Domestic and wild animals', 'Caring for animals'], keywords: ['animals', 'pets', 'wildlife'], estimatedPeriods: 5 },
            { id: 'sci-3-20', number: 20, title: 'Drop by Drop',               titleHindi: 'बूँद-बूँद',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Water scarcity', 'Saving water'], keywords: ['water', 'conservation', 'scarcity'], estimatedPeriods: 4 },
            { id: 'sci-3-21', number: 21, title: 'Families Can Be Different',  titleHindi: 'परिवार',                          textbookName: 'Looking Around (EVS)', learningOutcomes: ['Nuclear and joint families', 'Diversity in families'], keywords: ['family', 'diversity', 'values'], estimatedPeriods: 4 },
            { id: 'sci-3-22', number: 22, title: 'Left-Right',                 titleHindi: 'बाएँ-दाएँ',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Directions and orientation', 'Reading simple maps'], keywords: ['direction', 'left', 'right', 'map'], estimatedPeriods: 4 },
            { id: 'sci-3-23', number: 23, title: 'A Beautiful Cloth',          titleHindi: 'सुंदर कपड़ा',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Fibres and fabrics', 'Weaving and spinning'], keywords: ['cloth', 'fabric', 'weaving'], estimatedPeriods: 4 },
            { id: 'sci-3-24', number: 24, title: 'Web of Life',                titleHindi: 'जीवन का जाल',                    textbookName: 'Looking Around (EVS)', learningOutcomes: ['Interdependence of living things', 'Food chains'], keywords: ['food chain', 'ecosystem', 'interdependence'], estimatedPeriods: 5 },
        ],
    },
    {
        grade: 4,
        subject: 'Science',
        chapters: [
            { id: 'sci-4-1',  number: 1,  title: 'Going to School',            titleHindi: 'स्कूल चलें',                      textbookName: 'Looking Around (EVS)', learningOutcomes: ['Different modes of travel to school', 'Bridges and roads'], keywords: ['school', 'transport', 'bridges'], estimatedPeriods: 4 },
            { id: 'sci-4-2',  number: 2,  title: 'Ear to Ear',                 titleHindi: 'कान से कान',                      textbookName: 'Looking Around (EVS)', learningOutcomes: ['Sound and hearing', 'Different types of sounds'], keywords: ['sound', 'hearing', 'ear'], estimatedPeriods: 4 },
            { id: 'sci-4-3',  number: 3,  title: 'A Day with Nandu',           titleHindi: 'नंदू के साथ एक दिन',              textbookName: 'Looking Around (EVS)', learningOutcomes: ['Elephants and their care', 'Animal behaviour'], keywords: ['elephant', 'animals', 'care'], estimatedPeriods: 5 },
            { id: 'sci-4-4',  number: 4,  title: 'The Story of Amrita',        titleHindi: 'अमृता की कहानी',                  textbookName: 'Looking Around (EVS)', learningOutcomes: ['Tree conservation', 'Chipko movement'], keywords: ['trees', 'environment', 'Chipko'], estimatedPeriods: 5 },
            { id: 'sci-4-5',  number: 5,  title: 'Anita and the Honeybees',    titleHindi: 'अनीता और मधुमक्खियाँ',            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Bees and pollination', 'How honey is made'], keywords: ['bees', 'honey', 'pollination'], estimatedPeriods: 5 },
            { id: 'sci-4-6',  number: 6,  title: 'Omana\'s Journey',           titleHindi: 'ओमाना की यात्रा',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Train journey', 'Landscapes of India'], keywords: ['travel', 'train', 'India'], estimatedPeriods: 4 },
            { id: 'sci-4-7',  number: 7,  title: 'From the Window',            titleHindi: 'खिड़की से',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Observe changes in surroundings', 'Seasons and climate'], keywords: ['seasons', 'climate', 'observation'], estimatedPeriods: 4 },
            { id: 'sci-4-8',  number: 8,  title: 'Reaching Grandmother\'s House', titleHindi: 'नानी के घर',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Different modes of transport', 'Maps and routes'], keywords: ['transport', 'journey', 'map'], estimatedPeriods: 4 },
            { id: 'sci-4-9',  number: 9,  title: 'Changing Families',          titleHindi: 'बदलता परिवार',                    textbookName: 'Looking Around (EVS)', learningOutcomes: ['Family changes over time', 'Migration'], keywords: ['family', 'change', 'migration'], estimatedPeriods: 4 },
            { id: 'sci-4-10', number: 10, title: 'Hu Tu Tu, Hu Tu Tu',         titleHindi: 'हु तू तू',                        textbookName: 'Looking Around (EVS)', learningOutcomes: ['Kabaddi game', 'Breathing and exercise'], keywords: ['games', 'breathing', 'exercise'], estimatedPeriods: 4 },
            { id: 'sci-4-11', number: 11, title: 'The Valley of Flowers',      titleHindi: 'फूलों की घाटी',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Variety of flowers', 'Ecosystem of hills'], keywords: ['flowers', 'hills', 'ecosystem'], estimatedPeriods: 5 },
            { id: 'sci-4-12', number: 12, title: 'Changing Times',             titleHindi: 'बदलते समय',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Changes in lifestyle over generations', 'Technology changes'], keywords: ['change', 'technology', 'generations'], estimatedPeriods: 4 },
            { id: 'sci-4-13', number: 13, title: 'A River\'s Tale',            titleHindi: 'एक नदी की कहानी',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Life around a river', 'Pollution and conservation'], keywords: ['river', 'water', 'pollution'], estimatedPeriods: 5 },
            { id: 'sci-4-14', number: 14, title: 'Basva\'s Farm',              titleHindi: 'बसवा का खेत',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Farming methods', 'Crops and seasons'], keywords: ['farm', 'crops', 'seasons'], estimatedPeriods: 5 },
            { id: 'sci-4-15', number: 15, title: 'From Market to Home',        titleHindi: 'बाज़ार से घर तक',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Food journey from market to home', 'Fruits and vegetables'], keywords: ['market', 'food', 'vegetables'], estimatedPeriods: 4 },
            { id: 'sci-4-16', number: 16, title: 'A Busy Month',               titleHindi: 'एक व्यस्त महीना',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Calendar and months', 'Activities in different seasons'], keywords: ['calendar', 'seasons', 'months'], estimatedPeriods: 4 },
            { id: 'sci-4-17', number: 17, title: 'Nandita in Mumbai',          titleHindi: 'नंदिता मुंबई में',                textbookName: 'Looking Around (EVS)', learningOutcomes: ['City life', 'Urban problems and solutions'], keywords: ['city', 'urban', 'Mumbai'], estimatedPeriods: 4 },
            { id: 'sci-4-18', number: 18, title: 'Too Much Water, Too Little Water', titleHindi: 'पानी और हम',               textbookName: 'Looking Around (EVS)', learningOutcomes: ['Floods and droughts', 'Water management'], keywords: ['flood', 'drought', 'water management'], estimatedPeriods: 5 },
            { id: 'sci-4-19', number: 19, title: 'Abdul in the Garden',        titleHindi: 'अब्दुल का बगीचा',                textbookName: 'Looking Around (EVS)', learningOutcomes: ['Plants and their needs', 'Insects in the garden'], keywords: ['garden', 'plants', 'insects'], estimatedPeriods: 5 },
            { id: 'sci-4-20', number: 20, title: 'Eating Together',            titleHindi: 'साथ खाना',                        textbookName: 'Looking Around (EVS)', learningOutcomes: ['Food diversity in India', 'Cultural practices'], keywords: ['food', 'culture', 'diversity'], estimatedPeriods: 4 },
            { id: 'sci-4-21', number: 21, title: 'Food and Fun',               titleHindi: 'खाना और मज़ा',                    textbookName: 'Looking Around (EVS)', learningOutcomes: ['Festivals and food', 'Food preservation'], keywords: ['festival', 'food', 'preservation'], estimatedPeriods: 4 },
            { id: 'sci-4-22', number: 22, title: 'The World in My Home',       titleHindi: 'मेरे घर की दुनिया',               textbookName: 'Looking Around (EVS)', learningOutcomes: ['Media and communication', 'Technology in home'], keywords: ['media', 'communication', 'home'], estimatedPeriods: 4 },
            { id: 'sci-4-23', number: 23, title: 'Pochampalli',                titleHindi: 'पोचमपल्ली',                       textbookName: 'Looking Around (EVS)', learningOutcomes: ['Traditional weaving', 'Ikat craft', 'Artisans'], keywords: ['weaving', 'craft', 'artisan'], estimatedPeriods: 4 },
            { id: 'sci-4-24', number: 24, title: 'Home and Abroad',            titleHindi: 'घर और विदेश',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Life in other countries', 'Cultural similarities and differences'], keywords: ['countries', 'culture', 'diversity'], estimatedPeriods: 4 },
            { id: 'sci-4-25', number: 25, title: 'Defence Officer: Wahida',    titleHindi: 'वाहिदा',                          textbookName: 'Looking Around (EVS)', learningOutcomes: ['Women in defence forces', 'Inspiring role models'], keywords: ['defence', 'women', 'inspiration'], estimatedPeriods: 4 },
        ],
    },
    {
        grade: 5,
        subject: 'Science',
        chapters: [
            { id: 'sci-5-1',  number: 1,  title: 'Super Senses',               titleHindi: 'कैसे पहचाना चींटी ने अपने दोस्त को?', textbookName: 'Looking Around (EVS)', learningOutcomes: ['Understand super senses in animals', 'Animal communication'], keywords: ['senses', 'animals', 'perception'], estimatedPeriods: 6 },
            { id: 'sci-5-2',  number: 2,  title: 'A Snake Charmer\'s Story',   titleHindi: 'कहानी सपेरों की',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Snake charmer lifestyle', 'Snakes and wildlife'], keywords: ['snakes', 'traditional', 'wildlife'], estimatedPeriods: 5 },
            { id: 'sci-5-3',  number: 3,  title: 'From Tasting to Digesting',  titleHindi: 'चखने से पचने तक',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Understand digestion process', 'Role of different organs'], keywords: ['tasting', 'digestion', 'nutrition'], estimatedPeriods: 8 },
            { id: 'sci-5-4',  number: 4,  title: 'Mangoes Round the Year',     titleHindi: 'खाएँ आम बारहों महीने',            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Food preservation methods', 'Seasonal fruits'], keywords: ['food preservation', 'mangoes', 'seasons'], estimatedPeriods: 6 },
            { id: 'sci-5-5',  number: 5,  title: 'Seeds and Seeds',            titleHindi: 'बीज, बीज, बीज',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Germination process', 'Seed dispersal methods'], keywords: ['seeds', 'germination', 'dispersal'], estimatedPeriods: 7 },
            { id: 'sci-5-6',  number: 6,  title: 'Every Drop Counts',          titleHindi: 'बूँद-बूँद दरिया-दरिया',           textbookName: 'Looking Around (EVS)', learningOutcomes: ['Water conservation techniques', 'Traditional water systems'], keywords: ['water', 'heritage', 'conservation'], estimatedPeriods: 6 },
            { id: 'sci-5-7',  number: 7,  title: 'Experiments with Water',     titleHindi: 'पानी के प्रयोग',                  textbookName: 'Looking Around (EVS)', learningOutcomes: ['Properties of water', 'Buoyancy'], keywords: ['experiments', 'buoyancy', 'water'], estimatedPeriods: 6 },
            { id: 'sci-5-8',  number: 8,  title: 'A Treat for Mosquitoes',     titleHindi: 'मच्छरों की दावत',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Disease prevention', 'Breeding conditions of mosquitoes'], keywords: ['mosquitoes', 'health', 'disease'], estimatedPeriods: 8 },
            { id: 'sci-5-9',  number: 9,  title: 'Up You Go!',                 titleHindi: 'ऊपर चढ़ो!',                        textbookName: 'Looking Around (EVS)', learningOutcomes: ['Mountain climbing and altitude', 'Adaptation to cold climates'], keywords: ['mountains', 'altitude', 'adaptation'], estimatedPeriods: 5 },
            { id: 'sci-5-10', number: 10, title: 'Walls Tell Stories',         titleHindi: 'दीवारें बोलती हैं',               textbookName: 'Looking Around (EVS)', learningOutcomes: ['Historical structures', 'Reading history from buildings'], keywords: ['history', 'forts', 'walls'], estimatedPeriods: 5 },
            { id: 'sci-5-11', number: 11, title: 'Sunita in Space',            titleHindi: 'सुनीता अंतरिक्ष में',             textbookName: 'Looking Around (EVS)', learningOutcomes: ['Life in space', 'Astronauts and weightlessness'], keywords: ['space', 'astronaut', 'gravity'], estimatedPeriods: 6 },
            { id: 'sci-5-12', number: 12, title: 'What if it Finishes...?',    titleHindi: 'अगर यह खत्म हो जाए...?',         textbookName: 'Looking Around (EVS)', learningOutcomes: ['Non-renewable resources', 'Energy conservation'], keywords: ['resources', 'energy', 'fossil fuels'], estimatedPeriods: 6 },
            { id: 'sci-5-13', number: 13, title: 'A Shelter So High!',         titleHindi: 'इतनी ऊँचाई पर घर',                textbookName: 'Looking Around (EVS)', learningOutcomes: ['Homes in cold mountain regions', 'Adaptation of houses to climate'], keywords: ['shelter', 'cold', 'Ladakh'], estimatedPeriods: 5 },
            { id: 'sci-5-14', number: 14, title: 'When the Earth Shook!',      titleHindi: 'जब धरती काँपी',                   textbookName: 'Looking Around (EVS)', learningOutcomes: ['Earthquakes and their effects', 'Disaster preparedness'], keywords: ['earthquake', 'disaster', 'safety'], estimatedPeriods: 6 },
            { id: 'sci-5-15', number: 15, title: 'Blow Hot, Blow Cold',        titleHindi: 'गर्म और ठंडा',                    textbookName: 'Looking Around (EVS)', learningOutcomes: ['Properties of air', 'Hot and cold air experiments'], keywords: ['air', 'temperature', 'experiments'], estimatedPeriods: 5 },
            { id: 'sci-5-16', number: 16, title: 'Who Will Do This Work?',     titleHindi: 'यह काम कौन करेगा?',               textbookName: 'Looking Around (EVS)', learningOutcomes: ['Dignity of labour', 'Sanitation workers'], keywords: ['work', 'dignity', 'sanitation'], estimatedPeriods: 5 },
            { id: 'sci-5-17', number: 17, title: 'Across the Wall',            titleHindi: 'दीवार के उस पार',                 textbookName: 'Looking Around (EVS)', learningOutcomes: ['Children with disabilities', 'Inclusion and empathy'], keywords: ['disability', 'empathy', 'inclusion'], estimatedPeriods: 5 },
            { id: 'sci-5-18', number: 18, title: 'No Place for Us?',           titleHindi: 'हमारे लिए जगह नहीं?',            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Displacement and migration', 'Tribal communities'], keywords: ['displacement', 'tribal', 'forests'], estimatedPeriods: 5 },
            { id: 'sci-5-19', number: 19, title: 'A Seed Tells a Farmer\'s Story', titleHindi: 'एक बीज की कहानी',            textbookName: 'Looking Around (EVS)', learningOutcomes: ['Farming cycle', 'Types of seeds and crops'], keywords: ['farming', 'seeds', 'crops'], estimatedPeriods: 6 },
            { id: 'sci-5-20', number: 20, title: 'Whose Forests?',             titleHindi: 'किसके जंगल?',                     textbookName: 'Looking Around (EVS)', learningOutcomes: ['Forest rights', 'Tribal communities and forest dependence'], keywords: ['forests', 'tribal', 'rights'], estimatedPeriods: 6 },
            { id: 'sci-5-21', number: 21, title: 'Like Father, Like Daughter', titleHindi: 'पिता की परछाईं',                  textbookName: 'Looking Around (EVS)', learningOutcomes: ['Inherited traits', 'Heredity in plants and animals'], keywords: ['heredity', 'traits', 'inheritance'], estimatedPeriods: 5 },
            { id: 'sci-5-22', number: 22, title: 'On the Move Again',          titleHindi: 'फिर चले',                         textbookName: 'Looking Around (EVS)', learningOutcomes: ['Nomadic communities', 'Migration and lifestyle'], keywords: ['nomads', 'migration', 'community'], estimatedPeriods: 5 },
        ],
    },

    // -----------------------------------------------------------------------
    // GRADE 6 — Curiosity  (NCF-2023, textbookEdition set in flat export)
    // -----------------------------------------------------------------------
    {
        grade: 6,
        subject: 'Science',
        chapters: [
            { id: 'sci-6-1',  number: 1,  title: 'The Wonderful World of Science',            titleHindi: 'विज्ञान की अद्भुत दुनिया',            textbookName: 'Curiosity 6', learningOutcomes: ['Understand what science is', 'Scientific inquiry and observation', 'Role of science in daily life'], keywords: ['science', 'inquiry', 'observation', 'experiment'], estimatedPeriods: 6 },
            { id: 'sci-6-2',  number: 2,  title: 'Diversity in the Living World',              titleHindi: 'जीवित संसार में विविधता',             textbookName: 'Curiosity 6', learningOutcomes: ['Classify living organisms', 'Understand biodiversity', 'Observe plants and animals around us'], keywords: ['diversity', 'classification', 'living', 'organisms'], estimatedPeriods: 10 },
            { id: 'sci-6-3',  number: 3,  title: 'Mindful Eating: A Path to a Healthy Body',  titleHindi: 'सचेत खाना: स्वस्थ शरीर की राह',      textbookName: 'Curiosity 6', learningOutcomes: ['Understand nutrients in food', 'Learn about balanced diet', 'Effects of unhealthy eating'], keywords: ['nutrition', 'diet', 'health', 'food'], estimatedPeriods: 10 },
            { id: 'sci-6-4',  number: 4,  title: 'Exploring Magnets',                         titleHindi: 'चुंबकों की खोज',                      textbookName: 'Curiosity 6', learningOutcomes: ['Properties of magnets', 'Magnetic poles and field', 'Uses of magnets'], keywords: ['magnets', 'poles', 'magnetic field', 'attraction'], estimatedPeriods: 8 },
            { id: 'sci-6-5',  number: 5,  title: 'Measurement of Length and Motion',          titleHindi: 'लंबाई और गति का मापन',                textbookName: 'Curiosity 6', learningOutcomes: ['Standard units of measurement', 'Measure length accurately', 'Describe types of motion'], keywords: ['measurement', 'motion', 'length', 'units'], estimatedPeriods: 10 },
            { id: 'sci-6-6',  number: 6,  title: 'Materials Around Us',                       titleHindi: 'हमारे चारों ओर पदार्थ',              textbookName: 'Curiosity 6', learningOutcomes: ['Classify materials by properties', 'Understand solubility and density', 'Transparent vs opaque materials'], keywords: ['materials', 'properties', 'classification', 'solubility'], estimatedPeriods: 10 },
            { id: 'sci-6-7',  number: 7,  title: 'Temperature and its Measurement',           titleHindi: 'तापमान और उसका मापन',                 textbookName: 'Curiosity 6', learningOutcomes: ['Understand temperature', 'Use a thermometer', 'Distinguish between heat and temperature'], keywords: ['temperature', 'thermometer', 'heat', 'measurement'], estimatedPeriods: 8 },
            { id: 'sci-6-8',  number: 8,  title: 'A Journey through States of Water',         titleHindi: 'जल की अवस्थाओं की यात्रा',           textbookName: 'Curiosity 6', learningOutcomes: ['States of water and their properties', 'Water cycle', 'Evaporation and condensation'], keywords: ['water', 'states', 'evaporation', 'condensation', 'water cycle'], estimatedPeriods: 10 },
            { id: 'sci-6-9',  number: 9,  title: 'Methods of Separation in Everyday Life',    titleHindi: 'दैनिक जीवन में पृथक्करण की विधियाँ',  textbookName: 'Curiosity 6', learningOutcomes: ['Learn separation methods: sieving, filtering, evaporation', 'Apply separation in everyday contexts'], keywords: ['separation', 'filtration', 'evaporation', 'sieving'], estimatedPeriods: 10 },
            { id: 'sci-6-10', number: 10, title: 'Living Creatures: Exploring their Characteristics', titleHindi: 'जीवित प्राणी: उनकी विशेषताएँ',  textbookName: 'Curiosity 6', learningOutcomes: ['Characteristics of living organisms', 'Growth, reproduction, response to stimuli'], keywords: ['living', 'characteristics', 'growth', 'reproduction'], estimatedPeriods: 8 },
            { id: 'sci-6-11', number: 11, title: 'Nature\'s Treasures',                       titleHindi: 'प्रकृति के खज़ाने',                   textbookName: 'Curiosity 6', learningOutcomes: ['Natural resources and their types', 'Conservation of resources', 'Human dependence on nature'], keywords: ['natural resources', 'conservation', 'environment', 'nature'], estimatedPeriods: 8 },
            { id: 'sci-6-12', number: 12, title: 'Beyond Earth',                               titleHindi: 'पृथ्वी से परे',                       textbookName: 'Curiosity 6', learningOutcomes: ['Solar system and planets', 'Stars and constellations', 'Space exploration basics'], keywords: ['space', 'solar system', 'planets', 'stars'], estimatedPeriods: 8 },
        ],
    },

    // -----------------------------------------------------------------------
    // GRADE 7 — Curiosity  (NCF-2023)
    // -----------------------------------------------------------------------
    {
        grade: 7,
        subject: 'Science',
        chapters: [
            { id: 'sci-7-1',  number: 1,  title: 'The Ever-Evolving World of Science',        titleHindi: 'लगातार बदलती विज्ञान की दुनिया',    textbookName: 'Curiosity 7', learningOutcomes: ['Science as an ever-evolving field', 'Impact of science on society', 'Historical scientific discoveries'], keywords: ['science', 'evolution', 'discovery', 'history'], estimatedPeriods: 6 },
            { id: 'sci-7-2',  number: 2,  title: 'Exploring Substances: Acidic, Basic and Neutral', titleHindi: 'पदार्थों की खोज: अम्लीय, क्षारीय और उदासीन', textbookName: 'Curiosity 7', learningOutcomes: ['Properties of acids, bases, salts', 'Neutralisation reactions', 'Uses of acids and bases'], keywords: ['acids', 'bases', 'neutral', 'pH', 'salts'], estimatedPeriods: 10 },
            { id: 'sci-7-3',  number: 3,  title: 'Electricity: Circuits and their Components', titleHindi: 'विद्युत: परिपथ और उनके घटक',           textbookName: 'Curiosity 7', learningOutcomes: ['Components of electric circuits', 'Conductors and insulators', 'Simple circuit diagrams'], keywords: ['electricity', 'circuit', 'conductor', 'insulator'], estimatedPeriods: 10 },
            { id: 'sci-7-4',  number: 4,  title: 'The World of Metals and Non-metals',        titleHindi: 'धातुओं और अधातुओं की दुनिया',          textbookName: 'Curiosity 7', learningOutcomes: ['Physical and chemical properties of metals', 'Distinguish metals from non-metals', 'Uses in daily life'], keywords: ['metals', 'non-metals', 'properties', 'reactivity'], estimatedPeriods: 10 },
            { id: 'sci-7-5',  number: 5,  title: 'Changes Around Us: Physical and Chemical',  titleHindi: 'हमारे चारों ओर परिवर्तन: भौतिक और रासायनिक', textbookName: 'Curiosity 7', learningOutcomes: ['Distinguish physical from chemical changes', 'Examples of each type', 'Reversible and irreversible changes'], keywords: ['physical change', 'chemical change', 'reversible', 'irreversible'], estimatedPeriods: 8 },
            { id: 'sci-7-6',  number: 6,  title: 'Adolescence: A Stage of Growth and Change', titleHindi: 'किशोरावस्था: वृद्धि और परिवर्तन का चरण', textbookName: 'Curiosity 7', learningOutcomes: ['Physical and emotional changes during adolescence', 'Reproductive health', 'Balanced nutrition for teenagers'], keywords: ['adolescence', 'puberty', 'hormones', 'growth'], estimatedPeriods: 10 },
            { id: 'sci-7-7',  number: 7,  title: 'Heat Transfer in Nature',                   titleHindi: 'प्रकृति में ऊष्मा स्थानांतरण',          textbookName: 'Curiosity 7', learningOutcomes: ['Modes of heat transfer: conduction, convection, radiation', 'Application in daily life'], keywords: ['heat', 'conduction', 'convection', 'radiation', 'transfer'], estimatedPeriods: 10 },
            { id: 'sci-7-8',  number: 8,  title: 'Reproduction in Plants',                    titleHindi: 'पौधों में जनन',                        textbookName: 'Curiosity 7', learningOutcomes: ['Asexual and sexual reproduction in plants', 'Pollination and fertilisation', 'Seed dispersal'], keywords: ['reproduction', 'plants', 'pollination', 'seeds', 'asexual'], estimatedPeriods: 10 },
            { id: 'sci-7-9',  number: 9,  title: 'Motion and Time',                           titleHindi: 'गति और समय',                           textbookName: 'Curiosity 7', learningOutcomes: ['Measure speed and calculate time', 'Distance-time graphs', 'Uniform and non-uniform motion'], keywords: ['motion', 'speed', 'time', 'distance', 'graph'], estimatedPeriods: 10 },
            { id: 'sci-7-10', number: 10, title: 'Electric Current and its Effects',           titleHindi: 'विद्युत धारा और इसके प्रभाव',           textbookName: 'Curiosity 7', learningOutcomes: ['Heating and magnetic effects of current', 'Electromagnets', 'Applications of electric current'], keywords: ['electric current', 'electromagnet', 'heating effect', 'magnetic'], estimatedPeriods: 12 },
            { id: 'sci-7-11', number: 11, title: 'Light',                                      titleHindi: 'प्रकाश',                               textbookName: 'Curiosity 7', learningOutcomes: ['Reflection of light', 'Laws of reflection', 'Concave and convex mirrors'], keywords: ['light', 'reflection', 'mirror', 'refraction'], estimatedPeriods: 10 },
            { id: 'sci-7-12', number: 12, title: 'Forests: Our Lifeline',                     titleHindi: 'वन: हमारी जीवन रेखा',                  textbookName: 'Curiosity 7', learningOutcomes: ['Importance of forests', 'Forest ecosystem', 'Deforestation and its effects'], keywords: ['forest', 'ecosystem', 'biodiversity', 'deforestation'], estimatedPeriods: 8 },
            { id: 'sci-7-13', number: 13, title: 'Wastewater Story',                           titleHindi: 'अपशिष्ट जल की कहानी',                  textbookName: 'Curiosity 7', learningOutcomes: ['Sewage treatment processes', 'Importance of clean water', 'Sanitation and hygiene'], keywords: ['wastewater', 'sewage', 'sanitation', 'treatment'], estimatedPeriods: 8 },
        ],
    },

    // -----------------------------------------------------------------------
    // GRADE 8 — Curiosity  (NCF-2023, released 2025–26)
    // -----------------------------------------------------------------------
    {
        grade: 8,
        subject: 'Science',
        chapters: [
            { id: 'sci-8-1',  number: 1,  title: 'Crop Production and Management',            titleHindi: 'फसल उत्पादन एवं प्रबंध',               textbookName: 'Curiosity 8', learningOutcomes: ['Agricultural practices', 'Kharif and Rabi crops', 'Soil preparation and crop protection'], keywords: ['agriculture', 'crops', 'soil', 'irrigation'], estimatedPeriods: 10 },
            { id: 'sci-8-2',  number: 2,  title: 'Microorganisms: Friend and Foe',            titleHindi: 'सूक्ष्मजीव: मित्र एवं शत्रु',           textbookName: 'Curiosity 8', learningOutcomes: ['Types of microorganisms', 'Beneficial and harmful microorganisms', 'Disease-causing pathogens'], keywords: ['bacteria', 'virus', 'microorganisms', 'disease', 'fungi'], estimatedPeriods: 10 },
            { id: 'sci-8-3',  number: 3,  title: 'Coal and Petroleum',                        titleHindi: 'कोयला और पेट्रोलियम',                  textbookName: 'Curiosity 8', learningOutcomes: ['Formation of fossil fuels', 'Uses and environmental impact', 'Need for alternatives'], keywords: ['coal', 'petroleum', 'fossil fuels', 'energy'], estimatedPeriods: 10 },
            { id: 'sci-8-4',  number: 4,  title: 'Combustion and Flame',                      titleHindi: 'दहन और ज्वाला',                         textbookName: 'Curiosity 8', learningOutcomes: ['Conditions for combustion', 'Types of combustion', 'Structure of a flame'], keywords: ['fire', 'flame', 'combustion', 'fuel'], estimatedPeriods: 10 },
            { id: 'sci-8-5',  number: 5,  title: 'Conservation of Plants and Animals',        titleHindi: 'पौधों एवं जंतुओं का संरक्षण',           textbookName: 'Curiosity 8', learningOutcomes: ['Biodiversity conservation', 'Protected areas and sanctuaries', 'Endangered and extinct species'], keywords: ['wildlife', 'forests', 'conservation', 'endangered'], estimatedPeriods: 10 },
            { id: 'sci-8-6',  number: 6,  title: 'Reproduction in Animals',                   titleHindi: 'जंतुओं में जनन',                         textbookName: 'Curiosity 8', learningOutcomes: ['Sexual and asexual reproduction', 'Viviparous and oviparous animals', 'Fertilisation and development'], keywords: ['reproduction', 'viviparous', 'oviparous', 'fertilisation'], estimatedPeriods: 10 },
            { id: 'sci-8-7',  number: 7,  title: 'Force and Pressure',                        titleHindi: 'बल तथा दाब',                            textbookName: 'Curiosity 8', learningOutcomes: ['Types of forces', 'Pressure formula', 'Atmospheric pressure'], keywords: ['force', 'pressure', 'atmospheric', 'gravity'], estimatedPeriods: 12 },
            { id: 'sci-8-8',  number: 8,  title: 'Friction',                                  titleHindi: 'घर्षण',                                 textbookName: 'Curiosity 8', learningOutcomes: ['Nature of friction', 'Factors affecting friction', 'Advantages and disadvantages'], keywords: ['friction', 'motion', 'surface', 'lubrication'], estimatedPeriods: 10 },
            { id: 'sci-8-9',  number: 9,  title: 'Sound',                                     titleHindi: 'ध्वनि',                                 textbookName: 'Curiosity 8', learningOutcomes: ['Production and propagation of sound', 'Frequency and amplitude', 'Human ear and hearing'], keywords: ['sound', 'vibration', 'frequency', 'amplitude'], estimatedPeriods: 12 },
            { id: 'sci-8-10', number: 10, title: 'Chemical Effects of Electric Current',      titleHindi: 'विद्युत धारा के रासायनिक प्रभाव',       textbookName: 'Curiosity 8', learningOutcomes: ['Electrolysis', 'Electroplating', 'Conductors of electricity'], keywords: ['electric', 'chemical', 'electroplating', 'electrolysis'], estimatedPeriods: 10 },
            { id: 'sci-8-11', number: 11, title: 'Some Natural Phenomena',                    titleHindi: 'कुछ प्राकृतिक परिघटनाएँ',               textbookName: 'Curiosity 8', learningOutcomes: ['Lightning and thunderstorms', 'Earthquakes and their effects', 'Safety measures'], keywords: ['lightning', 'earthquake', 'thunderstorm', 'safety'], estimatedPeriods: 10 },
            { id: 'sci-8-12', number: 12, title: 'Light',                                     titleHindi: 'प्रकाश',                                textbookName: 'Curiosity 8', learningOutcomes: ['Laws of reflection', 'Dispersion of light', 'Human eye and vision'], keywords: ['eye', 'reflection', 'dispersion', 'rainbow'], estimatedPeriods: 12 },
            { id: 'sci-8-13', number: 13, title: 'Pollution of Air and Water',                titleHindi: 'वायु तथा जल का प्रदूषण',                textbookName: 'Curiosity 8', learningOutcomes: ['Air and water pollutants', 'Effects on health and environment', 'Measures to control pollution'], keywords: ['pollution', 'air', 'water', 'environment', 'health'], estimatedPeriods: 10 },
        ],
    },

    // -----------------------------------------------------------------------
    // GRADES 9–10 — Science NCERT (Rationalized-2022)
    // -----------------------------------------------------------------------
    {
        grade: 9,
        subject: 'Science',
        chapters: [
            { id: 'sci-9-1',  number: 1,  title: 'Matter in Our Surroundings',         titleHindi: 'हमारे आस-पास के पदार्थ',              textbookName: 'Science (NCERT)', learningOutcomes: ['States of matter', 'Changes of state and their conditions'], keywords: ['matter', 'solid', 'liquid', 'gas', 'states'], estimatedPeriods: 12 },
            { id: 'sci-9-2',  number: 2,  title: 'Is Matter Around Us Pure?',           titleHindi: 'क्या हमारे आस-पास के पदार्थ शुद्ध हैं?', textbookName: 'Science (NCERT)', learningOutcomes: ['Mixtures and compounds', 'Separation methods', 'Colloids and suspensions'], keywords: ['pure', 'mixture', 'compound', 'colloid'], estimatedPeriods: 10 },
            { id: 'sci-9-3',  number: 3,  title: 'Atoms and Molecules',                 titleHindi: 'परमाणु एवं अणु',                      textbookName: 'Science (NCERT)', learningOutcomes: ['Dalton\'s atomic theory', 'Atomic mass and molar mass', 'Chemical formulae'], keywords: ['atoms', 'molecules', 'atomic mass', 'formulae'], estimatedPeriods: 14 },
            { id: 'sci-9-4',  number: 4,  title: 'Structure of the Atom',               titleHindi: 'परमाणु की संरचना',                     textbookName: 'Science (NCERT)', learningOutcomes: ['Subatomic particles', 'Bohr\'s model', 'Electronic configuration'], keywords: ['electron', 'proton', 'neutron', 'atomic structure'], estimatedPeriods: 12 },
            { id: 'sci-9-5',  number: 5,  title: 'The Fundamental Unit of Life',        titleHindi: 'जीवन की मौलिक इकाई',                  textbookName: 'Science (NCERT)', learningOutcomes: ['Cell structure and organelles', 'Differences between plant and animal cells'], keywords: ['cell', 'organelles', 'nucleus', 'membrane'], estimatedPeriods: 12 },
            { id: 'sci-9-6',  number: 6,  title: 'Tissues',                             titleHindi: 'ऊतक',                                 textbookName: 'Science (NCERT)', learningOutcomes: ['Plant and animal tissues', 'Types and functions of tissues'], keywords: ['tissues', 'epithelial', 'meristematic', 'muscle'], estimatedPeriods: 10 },
            { id: 'sci-9-7',  number: 7,  title: 'Motion',                              titleHindi: 'गति',                                 textbookName: 'Science (NCERT)', learningOutcomes: ['Distance, displacement, speed, velocity', 'Equations of uniformly accelerated motion'], keywords: ['motion', 'acceleration', 'velocity', 'distance'], estimatedPeriods: 14 },
            { id: 'sci-9-8',  number: 8,  title: 'Force and Laws of Motion',            titleHindi: 'बल तथा गति के नियम',                  textbookName: 'Science (NCERT)', learningOutcomes: ['Newton\'s three laws of motion', 'Inertia and momentum'], keywords: ['force', 'inertia', 'Newton', 'momentum'], estimatedPeriods: 14 },
            { id: 'sci-9-9',  number: 9,  title: 'Gravitation',                         titleHindi: 'गुरुत्वाकर्षण',                        textbookName: 'Science (NCERT)', learningOutcomes: ['Universal law of gravitation', 'Free fall and acceleration due to gravity'], keywords: ['gravity', 'acceleration', 'gravitation', 'free fall'], estimatedPeriods: 12 },
            { id: 'sci-9-10', number: 10, title: 'Work and Energy',                     titleHindi: 'कार्य तथा ऊर्जा',                      textbookName: 'Science (NCERT)', learningOutcomes: ['Potential and kinetic energy', 'Work-energy theorem', 'Power'], keywords: ['work', 'energy', 'power', 'kinetic', 'potential'], estimatedPeriods: 12 },
            { id: 'sci-9-11', number: 11, title: 'Sound',                               titleHindi: 'ध्वनि',                               textbookName: 'Science (NCERT)', learningOutcomes: ['Propagation of sound', 'Frequency, amplitude, wavelength', 'Echo and reverberation'], keywords: ['sound', 'echo', 'frequency', 'wavelength'], estimatedPeriods: 12 },
            { id: 'sci-9-12', number: 12, title: 'Improvement in Food Resources',      titleHindi: 'खाद्य संसाधनों में सुधार',             textbookName: 'Science (NCERT)', learningOutcomes: ['Crops and animal husbandry', 'Sustainable farming practices'], keywords: ['agriculture', 'livestock', 'food resources', 'farming'], estimatedPeriods: 10 },
        ],
    },
    {
        grade: 10,
        subject: 'Science',
        chapters: [
            { id: 'sci-10-1',  number: 1,  title: 'Chemical Reactions and Equations',          titleHindi: 'रासायनिक अभिक्रियाएँ एवं समीकरण',    textbookName: 'Science (NCERT)', learningOutcomes: ['Write and balance equations', 'Types of chemical reactions'], keywords: ['reactions', 'equations', 'balancing', 'chemistry'], estimatedPeriods: 14 },
            { id: 'sci-10-2',  number: 2,  title: 'Acids, Bases and Salts',                    titleHindi: 'अम्ल, क्षारक एवं लवण',               textbookName: 'Science (NCERT)', learningOutcomes: ['pH scale and properties', 'Salts and their formation'], keywords: ['acids', 'bases', 'pH', 'salts'], estimatedPeriods: 12 },
            { id: 'sci-10-3',  number: 3,  title: 'Metals and Non-metals',                     titleHindi: 'धातु एवं अधातु',                      textbookName: 'Science (NCERT)', learningOutcomes: ['Extraction and properties', 'Reactivity series'], keywords: ['metals', 'reactivity', 'extraction', 'corrosion'], estimatedPeriods: 14 },
            { id: 'sci-10-4',  number: 4,  title: 'Carbon and its Compounds',                  titleHindi: 'कार्बन एवं उसके यौगिक',               textbookName: 'Science (NCERT)', learningOutcomes: ['Organic bonding', 'Functional groups', 'Carbon compounds in life'], keywords: ['carbon', 'organic', 'covalent', 'compounds'], estimatedPeriods: 16 },
            { id: 'sci-10-5',  number: 5,  title: 'Life Processes',                            titleHindi: 'जैव प्रक्रम',                         textbookName: 'Science (NCERT)', learningOutcomes: ['Nutrition, respiration, transport', 'Excretion'], keywords: ['nutrition', 'respiration', 'life processes', 'excretion'], estimatedPeriods: 16 },
            { id: 'sci-10-6',  number: 6,  title: 'Control and Coordination',                  titleHindi: 'नियंत्रण एवं समन्वय',                  textbookName: 'Science (NCERT)', learningOutcomes: ['Nervous system', 'Hormonal control', 'Reflex action'], keywords: ['brain', 'hormones', 'nervous system', 'coordination'], estimatedPeriods: 14 },
            { id: 'sci-10-7',  number: 7,  title: 'How do Organisms Reproduce?',               titleHindi: 'जीव जनन कैसे करते हैं?',              textbookName: 'Science (NCERT)', learningOutcomes: ['Asexual and sexual reproduction', 'Human reproductive system', 'Reproductive health'], keywords: ['reproduction', 'health', 'sexual', 'asexual'], estimatedPeriods: 16 },
            { id: 'sci-10-8',  number: 8,  title: 'Heredity',                                  titleHindi: 'आनुवंशिकता',                           textbookName: 'Science (NCERT)', learningOutcomes: ['Mendel\'s laws', 'Inheritance patterns', 'Sex determination'], keywords: ['heredity', 'inheritance', 'Mendel', 'genetics'], estimatedPeriods: 12 },
            { id: 'sci-10-9',  number: 9,  title: 'Light Reflection and Refraction',           titleHindi: 'प्रकाश - परावर्तन तथा अपवर्तन',      textbookName: 'Science (NCERT)', learningOutcomes: ['Lens and mirror formula', 'Total internal reflection', 'Refractive index'], keywords: ['light', 'refraction', 'mirror', 'lens'], estimatedPeriods: 18 },
            { id: 'sci-10-10', number: 10, title: 'The Human Eye and Colourful World',         titleHindi: 'मानव नेत्र तथा रंगबिरंगा संसार',     textbookName: 'Science (NCERT)', learningOutcomes: ['Vision defects and correction', 'Dispersion of light', 'Atmospheric scattering'], keywords: ['eye', 'dispersion', 'vision', 'rainbow'], estimatedPeriods: 12 },
            { id: 'sci-10-11', number: 11, title: 'Electricity',                               titleHindi: 'विद्युत',                             textbookName: 'Science (NCERT)', learningOutcomes: ['Ohm\'s law', 'Series and parallel circuits', 'Power and heating'], keywords: ['electricity', 'current', 'resistance', 'Ohm'], estimatedPeriods: 16 },
            { id: 'sci-10-12', number: 12, title: 'Magnetic Effects of Electric Current',      titleHindi: 'विद्युत धारा के चुंबकीय प्रभाव',     textbookName: 'Science (NCERT)', learningOutcomes: ['Electromagnetic induction', 'Motors and generators', 'Domestic wiring'], keywords: ['magnetic', 'induction', 'motor', 'generator'], estimatedPeriods: 16 },
            { id: 'sci-10-13', number: 13, title: 'Our Environment',                           titleHindi: 'हमारा पर्यावरण',                       textbookName: 'Science (NCERT)', learningOutcomes: ['Ecosystems and food chains', 'Environmental management'], keywords: ['environment', 'ecosystem', 'pollution', 'food chain'], estimatedPeriods: 10 },
        ],
    },
];

export default NCERTScience;

// -----------------------------------------------------------------------
// Flat exports consumed by index.ts
// -----------------------------------------------------------------------
import type { NCERTChapter } from './index';

export const evsChapters: NCERTChapter[] = NCERTScience
    .filter(g => g.grade <= 5)
    .flatMap(g => g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'EVS' as const,
        textbookEdition: 'NCF-2023' as const,
        isActive: true,
        dataVersion: '2025-ncert-ncf',
    })));

export const scienceChapters: NCERTChapter[] = NCERTScience
    .filter(g => g.grade >= 6)
    .flatMap(g => g.chapters.map(c => ({
        ...c,
        grade: g.grade,
        subject: 'Science' as const,
        textbookEdition: (g.grade <= 8 ? 'NCF-2023' : 'Rationalized-2022') as 'NCF-2023' | 'Rationalized-2022',
        isActive: true,
        dataVersion: g.grade <= 8 ? '2025-ncert-ncf' : '2025-ncert-rationalized',
    })));
