import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { allNCERTChapters } from '@/data/ncert';

export async function GET() {
    try {
        const db = await getDb();
        const batch = db.batch();
        let count = 0;

        for (const chapter of allNCERTChapters) {
            const docRef = db.collection('ncert_curriculum').doc(chapter.id);
            batch.set(docRef, chapter);
            count++;
        }

        await batch.commit();
        return NextResponse.json({ success: true, count, message: "Migration completed successfully" });
    } catch (error: any) {
        console.error("Migration failed:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
