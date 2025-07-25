// src/lib/firestore-models.ts

// Represents a user of the application, typically a teacher.
export interface User {
  uid: string; // Corresponds to Firebase Auth UID
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date;
}

// Represents a generated lesson plan.
export interface LessonPlan {
  id: string;
  userId: string; // UID of the user who created it
  topic: string;
  gradeLevels: string[];
  language: string;
  content: object; // The generated lesson plan content
  createdAt: Date;
  isPublic: boolean; // Whether it's shared with the community
}

// Represents a generated quiz.
export interface Quiz {
  id: string;
  userId: string; // UID of the user who created it
  topic: string;
  gradeLevels: string[];
  language: string;
  content: object; // The generated quiz content
  createdAt: Date;
  isPublic: boolean; // Whether it's shared with the community
}

// Represents a generated rubric.
export interface Rubric {
  id: string;
  userId: string; // UID of the user who created it
  topic: string;
  gradeLevels: string[];
  language: string;
  content: object; // The generated rubric content
  createdAt: Date;
  isPublic: boolean; // Whether it's shared with the community
}

// Represents content shared in the community library.
export interface CommunityContent {
  id: string;
  originalContentId: string; // ID of the original lesson plan, quiz, etc.
  contentType: 'lessonPlan' | 'quiz' | 'rubric';
  authorId: string; // UID of the original author
  authorName: string;
  authorPhotoURL: string;
  topic: string;
  gradeLevels: string[];
  language: string;
  likes: number;
  shares: number;
  createdAt: Date;
}
