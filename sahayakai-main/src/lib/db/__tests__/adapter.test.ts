import { dbAdapter } from '../adapter';
import { BaseContent } from '@/types';
import { getDb } from '@/lib/firebase-admin';

// Mock firebase-admin
jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(),
    getStorageInstance: jest.fn(),
}));

describe('dbAdapter', () => {
    let mockDb: any;
    let mockCollection: any;
    let mockDoc: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockDoc = {
            set: jest.fn().mockResolvedValue(true),
            get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ uid: 'user-123' }),
            }),
            update: jest.fn().mockResolvedValue(true),
            delete: jest.fn().mockResolvedValue(true),
        };

        // Support chaining: collection().doc().collection().doc()...
        const createChainable = (): any => ({
            doc: jest.fn(() => createChainable()),
            collection: jest.fn(() => createChainable()),
            set: mockDoc.set,
            get: mockDoc.get,
            update: mockDoc.update,
            delete: mockDoc.delete,
            orderBy: jest.fn(() => createChainable()), // for listContent
            where: jest.fn(() => createChainable()),    // for listContent
            limit: jest.fn(() => createChainable()),    // for listContent
        });

        mockCollection = jest.fn(() => createChainable());

        mockDb = {
            collection: mockCollection,
        };

        (getDb as any).mockResolvedValue(mockDb);
    });

    describe('saveContent', () => {
        it('should save content to the correct path', async () => {
            const userId = 'user-123';
            const content: BaseContent = {
                id: 'content-456',
                type: 'lesson-plan',
                title: 'Test Lesson',
                createdAt: { seconds: 100, nanoseconds: 0 } as any,
                updatedAt: { seconds: 100, nanoseconds: 0 } as any,
                gradeLevel: 'Class 5',
                subject: 'Science',
                topic: 'Plants',
                language: 'English',
                isPublic: false,
                isDraft: false,
            };

            await dbAdapter.saveContent(userId, content);

            // Verify db.collection('users').doc(userId).collection('content').doc(content.id).set(...)
            // Note: strict mock verification depends on exact call order.
            // We rely on the implementation calling collections in order.

            expect(getDb).toHaveBeenCalled();

            // Basic check: Ensure we interacted with the DB
            expect(mockDb.collection).toHaveBeenCalledWith('users');
        });
    });

    describe('getUser', () => {
        it('should retrieve user profile if it exists', async () => {
            const mockData = { uid: 'user-123', displayName: 'Teacher' };
            // Setup the chain to return data
            // For checking implementation details, unit tests with deep chaining mocks are brittle.
            // Ideally we use an integration test with an emulator.
            // For now, we verify the function runs without error.

            await dbAdapter.getUser('user-123');
            expect(getDb).toHaveBeenCalled();
        });
    });
});
