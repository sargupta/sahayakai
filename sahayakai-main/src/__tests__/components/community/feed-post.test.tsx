/**
 * Tests for src/components/community/feed-post.tsx.
 *
 * Covers the translation fallback (Phase 1 commit 83be980) and the link
 * attachment branch added at the same time, plus the basic post rendering.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import FeedPost from '@/components/community/feed-post';
import type { GroupPost } from '@/types/community';

// Mock useLanguage so we can drive language-dependent paths.
let currentLanguage = 'English';
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ language: currentLanguage, t: (s: string) => s }),
}));

// Mock next/navigation router (FeedPost calls router.push for profile clicks).
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

const basePost: GroupPost = {
    id: 'p1',
    groupId: 'g1',
    authorUid: 'uid-author',
    authorName: 'Anita Sharma',
    authorPhotoURL: null,
    content: 'Today I tried teaching fractions using chapatis. Great results!',
    postType: 'share',
    attachments: [],
    likesCount: 5,
    commentsCount: 2,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
};

beforeEach(() => {
    currentLanguage = 'English';
});

describe('FeedPost', () => {
    it('renders the author name, content, and stats', () => {
        render(<FeedPost post={basePost} />);
        expect(screen.getByText('Anita Sharma')).toBeInTheDocument();
        expect(screen.getByText(/teaching fractions/i)).toBeInTheDocument();
        expect(screen.getByText(/5 likes/i)).toBeInTheDocument();
        expect(screen.getByText(/2 comments/i)).toBeInTheDocument();
    });

    it('renders the post type badge', () => {
        render(<FeedPost post={basePost} />);
        expect(screen.getByText(/i tried this/i)).toBeInTheDocument(); // 'share' label
    });

    it('falls back to original content when no translation matches the language', () => {
        currentLanguage = 'Hindi';
        render(<FeedPost post={basePost} />);
        // No translations field → English content shows
        expect(screen.getByText(/teaching fractions/i)).toBeInTheDocument();
    });

    it('shows the translated content when translations[language] exists', () => {
        currentLanguage = 'Hindi';
        const translatedPost: GroupPost = {
            ...basePost,
            translations: { Hindi: 'आज मैंने भिन्न पढ़ाने के लिए चपाती का उपयोग किया।' },
        };
        render(<FeedPost post={translatedPost} />);
        expect(screen.getByText(/आज मैंने/)).toBeInTheDocument();
        // English original should NOT be visible.
        expect(screen.queryByText(/teaching fractions/i)).not.toBeInTheDocument();
    });

    it('renders a link attachment as an <a> with target=_blank rel=noopener', () => {
        const postWithLink: GroupPost = {
            ...basePost,
            attachments: [{ type: 'link', title: 'CBSE circular', url: 'https://cbse.gov.in/circular' }],
        };
        const { container } = render(<FeedPost post={postWithLink} />);
        const link = container.querySelector('a[href="https://cbse.gov.in/circular"]');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders a non-link attachment as a static row (no anchor)', () => {
        const postWithFile: GroupPost = {
            ...basePost,
            attachments: [{ type: 'pdf', title: 'lesson-plan.pdf' }],
        };
        const { container } = render(<FeedPost post={postWithFile} />);
        // Should NOT render an <a>
        expect(container.querySelector('a[href]')).toBeNull();
        expect(screen.getByText('lesson-plan.pdf')).toBeInTheDocument();
    });

    it('expands and collapses long content via Read more / Show less', () => {
        const long = 'X'.repeat(400); // > READ_MORE_THRESHOLD (280)
        const longPost: GroupPost = { ...basePost, content: long };
        render(<FeedPost post={longPost} />);
        expect(screen.getByText(/read more/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText(/read more/i));
        expect(screen.getByText(/show less/i)).toBeInTheDocument();
    });

    it('clicking Like fires onLike with the post id', () => {
        const onLike = jest.fn();
        render(<FeedPost post={basePost} onLike={onLike} />);
        fireEvent.click(screen.getByRole('button', { name: /like/i }));
        expect(onLike).toHaveBeenCalledWith('p1');
    });
});
