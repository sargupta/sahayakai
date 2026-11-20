/**
 * Name pools for the demo school, drawn from the communities of Siliguri and the
 * Darjeeling hills. Children's first names carry a hand-written spelling in each
 * script the school's parents use. These are the "reviewed" spoken-name fields
 * the CRM stores; names are never machine-transliterated (a transliterator turns
 * Aarav into Bengali আরব, which reads "Arab"; the correct spelling is আরভ).
 *
 * hi = Hindi (Devanagari), ne = Nepali (Devanagari, Nepali orthography, e.g.
 * final ङ in तेन्जिङ), bn = Bengali script.
 */

export type Lang = 'en' | 'hi' | 'bn' | 'ne';
export type Gender = 'female' | 'male';

export interface ChildName {
    en: string;
    hi: string;
    bn: string;
    ne: string;
    gender: Gender;
}

const n = (gender: Gender, en: string, hi: string, bn: string, ne: string): ChildName => ({ en, hi, bn, ne, gender });

/** Buddhist Himalayan names (Sherpa, Tamang, Lepcha, Lama, Gurung families). */
export const HIMALAYAN_NAMES: readonly ChildName[] = [
    n('female', 'Pema', 'पेमा', 'পেমা', 'पेमा'),
    n('male', 'Tenzing', 'तेनज़िंग', 'তেনজিং', 'तेन्जिङ'),
    n('male', 'Sonam', 'सोनम', 'সোনম', 'सोनम'),
    n('male', 'Nima', 'नीमा', 'নিমা', 'निमा'),
    n('male', 'Dawa', 'दावा', 'দাওয়া', 'दावा'),
    n('male', 'Karma', 'कर्मा', 'কর্মা', 'कर्मा'),
    n('male', 'Dorjee', 'दोरजी', 'দোরজি', 'दोर्जे'),
    n('female', 'Dolma', 'डोल्मा', 'ডোলমা', 'डोल्मा'),
    n('female', 'Yangchen', 'यांगचेन', 'ইয়াংচেন', 'याङ्चेन'),
    n('female', 'Diki', 'डिकी', 'ডিকি', 'डिकी'),
    n('female', 'Sonam', 'सोनम', 'সোনম', 'सोनम'),
];

/** Nepali names common in Hindu Nepali-speaking families (Chhetri, Thapa, Pradhan, Subba, Rai, Limbu, Gurung). */
export const NEPALI_NAMES: readonly ChildName[] = [
    n('male', 'Aarav', 'आरव', 'আরভ', 'आरव'),
    n('male', 'Bikash', 'विकास', 'বিকাশ', 'विकास'),
    n('male', 'Suraj', 'सूरज', 'সূরজ', 'सुरज'),
    n('male', 'Prajwal', 'प्रज्वल', 'প্রজ্বল', 'प्रज्वल'),
    n('male', 'Aayush', 'आयुष', 'আয়ুষ', 'आयुष'),
    n('male', 'Sujan', 'सुजन', 'সুজন', 'सुजन'),
    n('male', 'Anish', 'अनीश', 'অনীশ', 'अनिश'),
    n('male', 'Bibek', 'विवेक', 'বিবেক', 'विवेक'),
    n('male', 'Nischal', 'निश्चल', 'নিশ্চল', 'निश्चल'),
    n('male', 'Roshan', 'रोशन', 'রোশন', 'रोशन'),
    n('male', 'Sagar', 'सागर', 'সাগর', 'सागर'),
    n('male', 'Ujjwal', 'उज्ज्वल', 'উজ্জ্বল', 'उज्ज्वल'),
    n('female', 'Srijana', 'सृजना', 'সৃজনা', 'सृजना'),
    n('female', 'Prakriti', 'प्रकृति', 'প্রকৃতি', 'प्रकृति'),
    n('female', 'Sushmita', 'सुष्मिता', 'সুস্মিতা', 'सुस्मिता'),
    n('female', 'Kripa', 'कृपा', 'কৃপা', 'कृपा'),
    n('female', 'Asmita', 'अस्मिता', 'অস্মিতা', 'अस्मिता'),
    n('female', 'Nisha', 'निशा', 'নিশা', 'निशा'),
    n('female', 'Sabina', 'सबीना', 'সাবিনা', 'सबिना'),
    n('female', 'Pratiksha', 'प्रतीक्षा', 'প্রতীক্ষা', 'प्रतीक्षा'),
    n('female', 'Aakriti', 'आकृति', 'আকৃতি', 'आकृति'),
    n('female', 'Smriti', 'स्मृति', 'স্মৃতি', 'स्मृति'),
    n('female', 'Anjali', 'अंजलि', 'অঞ্জলি', 'अञ्जली'),
];

export const BENGALI_NAMES: readonly ChildName[] = [
    n('male', 'Aarav', 'आरव', 'আরভ', 'आरव'),
    n('male', 'Arnab', 'अर्नब', 'অর্ণব', 'अर्नब'),
    n('male', 'Sourav', 'सौरव', 'সৌরভ', 'सौरभ'),
    n('male', 'Aniket', 'अनिकेत', 'অনিকেত', 'अनिकेत'),
    n('male', 'Debayan', 'देबायन', 'দেবায়ন', 'देबायन'),
    n('male', 'Ritwik', 'ऋत्विक', 'ঋত্বিক', 'ऋत्विक'),
    n('male', 'Soham', 'सोहम', 'সোহম', 'सोहम'),
    n('male', 'Anirban', 'अनिर्बान', 'অনির্বাণ', 'अनिर्बाण'),
    n('male', 'Arijit', 'अरिजीत', 'অরিজিৎ', 'अरिजित'),
    n('male', 'Subhajit', 'शुभजीत', 'শুভজিৎ', 'शुभजित'),
    n('male', 'Ayan', 'अयान', 'অয়ন', 'अयन'),
    n('male', 'Pritam', 'प्रीतम', 'প্রীতম', 'प्रीतम'),
    n('male', 'Sayan', 'सायन', 'সায়ন', 'सायन'),
    n('female', 'Ananya', 'अनन्या', 'অনন্যা', 'अनन्या'),
    n('female', 'Riya', 'रिया', 'রিয়া', 'रिया'),
    n('female', 'Priyanka', 'प्रियंका', 'প্রিয়াঙ্কা', 'प्रियङ्का'),
    n('female', 'Shreya', 'श्रेया', 'শ্রেয়া', 'श्रेया'),
    n('female', 'Moumita', 'मौमिता', 'মৌমিতা', 'मौमिता'),
    n('female', 'Tanushree', 'तनुश्री', 'তনুশ্রী', 'तनुश्री'),
    n('female', 'Ishita', 'इशिता', 'ঈশিতা', 'इशिता'),
    n('female', 'Debolina', 'देबोलीना', 'দেবলীনা', 'देबलिना'),
    n('female', 'Anwesha', 'अन्वेषा', 'অন্বেষা', 'अन्वेषा'),
    n('female', 'Oindrila', 'ऐंद्रिला', 'ঐন্দ্রিলা', 'ऐन्द्रिला'),
    n('female', 'Poulami', 'पौलमी', 'পৌলমী', 'पौलमी'),
    n('female', 'Swastika', 'स्वस्तिका', 'স্বস্তিকা', 'स्वस्तिका'),
];

export const HINDI_NAMES: readonly ChildName[] = [
    n('male', 'Aarav', 'आरव', 'আরভ', 'आरव'),
    n('male', 'Aditya', 'आदित्य', 'আদিত্য', 'आदित्य'),
    n('male', 'Arjun', 'अर्जुन', 'অর্জুন', 'अर्जुन'),
    n('male', 'Vivek', 'विवेक', 'বিবেক', 'विवेक'),
    n('male', 'Rahul', 'राहुल', 'রাহুল', 'राहुल'),
    n('male', 'Harsh', 'हर्ष', 'হর্ষ', 'हर्ष'),
    n('male', 'Ayush', 'आयुष', 'আয়ুষ', 'आयुष'),
    n('male', 'Kunal', 'कुणाल', 'কুণাল', 'कुणाल'),
    n('male', 'Nikhil', 'निखिल', 'নিখিল', 'निखिल'),
    n('male', 'Saurabh', 'सौरभ', 'সৌরভ', 'सौरभ'),
    n('male', 'Ankit', 'अंकित', 'অঙ্কিত', 'अङ्कित'),
    n('male', 'Yash', 'यश', 'যশ', 'यश'),
    n('female', 'Ananya', 'अनन्या', 'অনন্যা', 'अनन्या'),
    n('female', 'Priya', 'प्रिया', 'প্রিয়া', 'प्रिया'),
    n('female', 'Khushi', 'ख़ुशी', 'খুশি', 'खुसी'),
    n('female', 'Neha', 'नेहा', 'নেহা', 'नेहा'),
    n('female', 'Pooja', 'पूजा', 'পূজা', 'पूजा'),
    n('female', 'Shruti', 'श्रुति', 'শ্রুতি', 'श्रुति'),
    n('female', 'Aditi', 'अदिति', 'অদিতি', 'अदिति'),
    n('female', 'Sneha', 'स्नेहा', 'স্নেহা', 'स्नेहा'),
    n('female', 'Kavya', 'काव्या', 'কাব্যা', 'काव्या'),
    n('female', 'Nandini', 'नंदिनी', 'নন্দিনী', 'नन्दिनी'),
];

/** Names in English-preferring (often Christian or mixed) families. */
export const ENGLISH_NAMES: readonly ChildName[] = [
    n('male', 'Ryan', 'रायन', 'রায়ান', 'रायन'),
    n('male', 'Kevin', 'केविन', 'কেভিন', 'केभिन'),
    n('male', 'Aaron', 'एरन', 'অ্যারন', 'एरन'),
    n('male', 'Joel', 'जोएल', 'জোয়েল', 'जोएल'),
    n('male', 'Nathan', 'नेथन', 'নেথান', 'नेथन'),
    n('male', 'Daniel', 'डैनियल', 'ড্যানিয়েল', 'डेनियल'),
    n('male', 'Samuel', 'सैमुअल', 'স্যামুয়েল', 'स्यामुएल'),
    n('female', 'Grace', 'ग्रेस', 'গ্রেস', 'ग्रेस'),
    n('female', 'Sarah', 'सारा', 'সারা', 'सारा'),
    n('female', 'Rebecca', 'रेबेका', 'রেবেকা', 'रेबेका'),
    n('female', 'Angela', 'एंजेला', 'অ্যাঞ্জেলা', 'एन्जेला'),
    n('female', 'Michelle', 'मिशेल', 'মিশেল', 'मिसेल'),
    n('female', 'Tanya', 'तान्या', 'তানিয়া', 'तान्या'),
];

export interface Community {
    surnames: readonly string[];
    childNames: readonly ChildName[];
    fathers: readonly string[];
    mothers: readonly string[];
}

const NEPALI_FATHERS = ['Dilip', 'Ram Bahadur', 'Suman', 'Rajesh', 'Bishnu', 'Kamal', 'Deepak', 'Ganesh', 'Hari', 'Prem', 'Nabin', 'Bikram'];
const NEPALI_MOTHERS = ['Sita', 'Maya', 'Sarita', 'Kamala', 'Laxmi', 'Sangita', 'Anita', 'Sunita', 'Radhika', 'Bimala', 'Mina', 'Rita'];
const HIMALAYAN_FATHERS = ['Pasang', 'Ang Dorjee', 'Mingma', 'Tshering', 'Lhakpa', 'Phurba', 'Nima', 'Karma'];
const HIMALAYAN_MOTHERS = ['Pema', 'Dolma', 'Lhamu', 'Yangzom', 'Doma', 'Chhoden', 'Diki', 'Sonam'];

export const COMMUNITIES: Record<Lang, readonly Community[]> = {
    ne: [
        {
            surnames: ['Sherpa', 'Tamang', 'Lepcha', 'Lama'],
            childNames: HIMALAYAN_NAMES,
            fathers: HIMALAYAN_FATHERS,
            mothers: HIMALAYAN_MOTHERS,
        },
        {
            surnames: ['Gurung', 'Rai', 'Limbu'],
            childNames: [...HIMALAYAN_NAMES, ...NEPALI_NAMES],
            fathers: [...NEPALI_FATHERS, ...HIMALAYAN_FATHERS],
            mothers: [...NEPALI_MOTHERS, ...HIMALAYAN_MOTHERS],
        },
        {
            surnames: ['Chhetri', 'Thapa', 'Pradhan', 'Subba'],
            childNames: NEPALI_NAMES,
            fathers: NEPALI_FATHERS,
            mothers: NEPALI_MOTHERS,
        },
    ],
    bn: [
        {
            surnames: ['Das', 'Ghosh', 'Sarkar', 'Chakraborty', 'Roy', 'Bose', 'Saha', 'Dey'],
            childNames: BENGALI_NAMES,
            fathers: ['Subrata', 'Partha', 'Amit', 'Sanjay', 'Tapas', 'Debashis', 'Sudip', 'Pranab', 'Biswajit', 'Arup', 'Goutam'],
            mothers: ['Mousumi', 'Rina', 'Soma', 'Sharmila', 'Sutapa', 'Madhumita', 'Paramita', 'Rupa', 'Kakali', 'Mitali'],
        },
    ],
    hi: [
        {
            surnames: ['Agarwal', 'Prasad', 'Jha', 'Singh', 'Gupta', 'Sharma', 'Mishra', 'Yadav'],
            childNames: HINDI_NAMES,
            fathers: ['Rakesh', 'Manoj', 'Sunil', 'Ajay', 'Vinod', 'Pankaj', 'Sanjeev', 'Ashok', 'Dinesh', 'Ramesh'],
            mothers: ['Sunita', 'Rekha', 'Kiran', 'Anita', 'Meena', 'Suman', 'Seema', 'Poonam', 'Neelam', 'Kavita'],
        },
    ],
    en: [
        {
            surnames: ['Lepcha', 'Lama', 'Mukhia', 'Pradhan', 'Thomas', 'Gomes'],
            childNames: ENGLISH_NAMES,
            fathers: ['Peter', 'Samuel', 'John', 'Anand', 'Norbu', 'Vikram'],
            mothers: ['Mary', 'Grace', 'Deepa', 'Nisha', 'Lhamu', 'Esther'],
        },
        {
            surnames: ['Roy', 'Sharma', 'Rai', 'Gurung', 'Das'],
            childNames: [...ENGLISH_NAMES, ...NEPALI_NAMES.slice(0, 6), ...BENGALI_NAMES.slice(0, 4), ...HINDI_NAMES.slice(0, 4)],
            fathers: ['Rohit', 'Arun', 'Suresh', 'Kiran', 'Rajiv', 'Andrew'],
            mothers: ['Priya', 'Shalini', 'Rachel', 'Nandita', 'Tara', 'Asha'],
        },
    ],
};

/** Grandparents and other relatives who are a child's guardian of record. */
export const GUARDIAN_OTHER_FIRST_NAMES: Record<Lang, readonly string[]> = {
    ne: ['Man Bahadur', 'Padam', 'Dhan Maya', 'Chandra'],
    bn: ['Haradhan', 'Nirmal', 'Shefali', 'Arati'],
    hi: ['Ram Prasad', 'Shyam', 'Kamla', 'Savitri'],
    en: ['George', 'Ruth', 'Albert', 'Margaret'],
};
