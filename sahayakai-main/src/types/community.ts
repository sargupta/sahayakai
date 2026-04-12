// Group types
export type GroupType = 'subject_grade' | 'school' | 'region' | 'interest';

export interface Group {
  id: string;
  name: string;
  description: string;
  type: GroupType;
  coverColor: string; // Tailwind gradient class
  memberCount: number;
  autoJoinRules: {
    subjects?: string[];
    grades?: string[];
    board?: string;
    school?: string;
    state?: string;
  };
  lastActivityAt: string;
  createdAt: string;
  createdBy: 'system' | string; // 'system' for auto-created, uid for user-created
}

export interface GroupMember {
  uid: string;
  joinedAt: string;
  role: 'member' | 'moderator';
}

// Post types
export type PostType = 'share' | 'ask_help' | 'celebrate' | 'resource';

export interface PostAttachment {
  type: string; // ContentType or 'image' | 'audio'
  resourceId?: string;
  url?: string;
  title?: string;
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  postType: PostType;
  attachments: PostAttachment[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  /** Multilingual translations keyed by Language name (e.g. "Hindi", "Tamil") */
  translations?: Record<string, string>;
}

// Group chat message (reuses shape from community chat)
export interface GroupChatMessage {
  id: string;
  groupId: string;
  text: string;
  audioUrl?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  createdAt: any; // Firestore Timestamp on read, null on optimistic
}

// Feed types - union of different content types that appear in the unified feed
export type FeedItemType = 'group_post' | 'resource_share' | 'connection_suggestion' | 'chat_highlight' | 'group_suggestion';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  groupId?: string;
  groupName?: string;
  timestamp: string;
  // Polymorphic payload
  post?: GroupPost;
  resource?: {
    id: string;
    title: string;
    type: string;
    authorName: string;
    authorUid: string;
    likes: number;
    language: string;
  };
  connectionSuggestion?: {
    uid: string;
    displayName: string;
    photoURL?: string;
    reason: string;
    sharedSubjects?: string[];
  };
  chatHighlight?: {
    groupId: string;
    groupName: string;
    messageCount: number;
    latestMessage?: string;
  };
  groupSuggestion?: Group;
}

// Share composer template config
export interface ShareTemplate {
  id: PostType;
  label: string;
  prompt: string;
  placeholder: string;
  icon: string; // Lucide icon name reference
  color: string; // Tailwind color class
}

// Constants for share templates
export const SHARE_TEMPLATES: ShareTemplate[] = [
  {
    id: 'share',
    label: 'I Tried This',
    prompt: 'What did you try? How did it go?',
    placeholder: 'Today I tried teaching fractions using chapati cutting. The kids finally understood...',
    icon: 'Lightbulb',
    color: 'text-amber-500',
  },
  {
    id: 'resource',
    label: 'Share Resource',
    prompt: 'Share something you created',
    placeholder: 'I made this worksheet for Class 8 Science on photosynthesis...',
    icon: 'FileUp',
    color: 'text-blue-500',
  },
  {
    id: 'ask_help',
    label: 'Ask for Help',
    prompt: 'What do you need help with?',
    placeholder: 'Has anyone dealt with students who won\'t speak up in English class?',
    icon: 'HelpCircle',
    color: 'text-purple-500',
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    prompt: 'What\'s the win?',
    placeholder: 'My Class 10 results came — 94% pass rate! Last year was 78%...',
    icon: 'Trophy',
    color: 'text-emerald-500',
  },
];

// Group color palettes for deterministic assignment (CSS gradient strings for inline styles)
export const GROUP_COLORS: string[] = [
  'linear-gradient(135deg, #fb923c, #f59e0b)',  // orange to amber
  'linear-gradient(135deg, #60a5fa, #6366f1)',  // blue to indigo
  'linear-gradient(135deg, #34d399, #14b8a6)',  // emerald to teal
  'linear-gradient(135deg, #a78bfa, #8b5cf6)',  // purple to violet
  'linear-gradient(135deg, #fb7185, #ec4899)',  // rose to pink
  'linear-gradient(135deg, #38bdf8, #06b6d4)',  // sky to cyan
];

export function getGroupColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GROUP_COLORS[((hash % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length];
}
