import { buildDirectConversationId } from '@/types/messages';

describe('buildDirectConversationId', () => {
    it('sorts UIDs alphabetically and joins with underscore', () => {
        expect(buildDirectConversationId('user-b', 'user-a')).toBe('user-a_user-b');
    });

    it('returns same ID regardless of argument order', () => {
        const id1 = buildDirectConversationId('alice', 'bob');
        const id2 = buildDirectConversationId('bob', 'alice');
        expect(id1).toBe(id2);
        expect(id1).toBe('alice_bob');
    });

    it('handles identical UIDs', () => {
        expect(buildDirectConversationId('same', 'same')).toBe('same_same');
    });

    it('handles UIDs with special characters', () => {
        const id = buildDirectConversationId('user_123', 'user_456');
        expect(id).toBe('user_123_user_456');
    });
});
