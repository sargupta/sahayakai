/**
 * GET  /api/user/consent — Get user's consent preferences
 * POST /api/user/consent — Update consent preferences
 *
 * DPDP Act Section 6 — Consent must be free, specific, informed, unconditional, unambiguous.
 * Each consent category is independently toggleable.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ConsentPreferences {
  /** Core AI content generation — required for app to function */
  coreAiProcessing: true; // Always true — can't use app without it
  /** Analytics & usage tracking for improving features */
  analytics: boolean;
  /** Community features (profile visible to other teachers) */
  communityVisibility: boolean;
  /** Receive product updates and feature announcements */
  productUpdates: boolean;
  /** Allow anonymized content to be used for AI model improvement */
  aiTrainingData: boolean;
  /** Last updated timestamp */
  updatedAt: string;
}

const DEFAULT_CONSENT: ConsentPreferences = {
  coreAiProcessing: true,
  analytics: true,
  communityVisibility: true,
  productUpdates: true,
  aiTrainingData: false, // Opt-in by default (DPDP conservative)
  updatedAt: new Date().toISOString(),
};

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();
    const doc = await db.collection('users').doc(userId).get();
    const consent = doc.data()?.consent || DEFAULT_CONSENT;

    return NextResponse.json({ consent });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch consent' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { getDb } = await import('@/lib/firebase-admin');
    const db = await getDb();

    // Validate: only allow known boolean fields
    const allowed = ['analytics', 'communityVisibility', 'productUpdates', 'aiTrainingData'];
    const update: Record<string, boolean | string> = {};
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') {
        update[`consent.${key}`] = body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid consent fields provided' }, { status: 400 });
    }

    update['consent.updatedAt'] = new Date().toISOString();
    update['consent.coreAiProcessing'] = true; // Always true

    await db.collection('users').doc(userId).update(update);

    // Log consent change for audit
    await db.collection('users').doc(userId).collection('consent_log').add({
      changes: body,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 });
  }
}
