
import { NextResponse } from 'next/server';
import { dbAdapter } from '@/lib/db/adapter';

/**
 * @swagger
 * /api/auth/profile-check:
 *   get:
 *     summary: Check if user profile exists
 *     description: Returns true if the user has a completed profile (school name set).
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: uid
 *         required: true
 *         description: Firebase UID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Missing UID
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
        return NextResponse.json({ error: 'UID required' }, { status: 400 });
    }

    try {
        const profile = await dbAdapter.getUser(uid);
        // We consider profile existing if they have set their school name
        return NextResponse.json({
            exists: !!(profile && profile.schoolName)
        });
    } catch (error) {
        console.error("Profile check error:", error);
        return NextResponse.json({ exists: false });
    }
}
