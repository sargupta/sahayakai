export const GRADE_LEVELS = [
    "Nursery",
    "LKG",
    "UKG",
    "1st Grade",
    "2nd Grade",
    "3rd Grade",
    "4th Grade",
    "5th Grade",
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade",
    "11th Grade",
    "12th Grade",
    "College",
    "Professional",
] as const;

export const LANGUAGES = [
    "English",
    "Hindi",
    "Bengali",
    "Telugu",
    "Marathi",
    "Tamil",
    "Urdu",
    "Gujarati",
    "Kannada",
    "Odia",
    "Malayalam",
    "Punjabi",
    "Assamese",
    "Maithili",
    "Sanskrit",
] as const;

export type GradeLevel = typeof GRADE_LEVELS[number];
export type Language = typeof LANGUAGES[number];
