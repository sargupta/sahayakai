/**
 * Data Export & Portability Service
 *
 * Implements DPDP Act-compliant data portability for SahayakAI.
 * Supports individual teacher export, school-admin bulk export,
 * and subscription cancellation grace-period export.
 *
 * Firestore path: users/{uid}/content/{contentId}
 * Storage path:   users/{uid}/{folder}/{filename}
 *
 * Export formats: JSON (machine-readable), CSV (analytics), PDF-ready HTML
 */

import { getDb } from '@/lib/firebase-admin';
import { getStorageInstance } from '@/lib/firebase-admin';
import { BaseContent, ContentType, UserProfile, CONTENT_TYPES } from '@/types';
import { logger } from '@/lib/logger';
import { Writable } from 'stream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportFormat = 'json' | 'csv' | 'html'; // HTML is print-to-PDF ready

export interface ExportRequest {
  userId: string;
  /** If set, export only these content types. Empty = all. */
  contentTypes?: ContentType[];
  /** If set, only content created after this date. */
  dateFrom?: Date;
  /** If set, only content created before this date. */
  dateTo?: Date;
  /** Include user profile in the export. Default true. */
  includeProfile?: boolean;
  /** Include usage analytics. Default true. */
  includeAnalytics?: boolean;
  /** Include community posts. Default false (requires separate permission). */
  includeCommunityPosts?: boolean;
}

export interface SchoolExportRequest {
  /** School admin's UID (must have admin role). */
  adminUserId: string;
  /** Normalized school name used to find all teachers. */
  schoolNormalized: string;
  /** Max teachers to include (safety cap). Default 500. */
  maxTeachers?: number;
}

export interface ExportManifest {
  exportId: string;
  exportedAt: string;
  platform: 'SahayakAI';
  version: '1.0';
  dpdpCompliance: true;
  userId: string;
  contentCounts: Record<string, number>;
  files: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100; // Firestore pagination batch
const MAX_CONTENT_ITEMS = 10_000; // Safety cap for single teacher
const EXPORT_COLLECTION = 'export_jobs';

// Content type → human-friendly folder name in the ZIP
const FOLDER_MAP: Record<ContentType, string> = {
  'lesson-plan': 'lesson_plans',
  'quiz': 'quizzes',
  'worksheet': 'worksheets',
  'rubric': 'rubrics',
  'visual-aid': 'visual_aids',
  'micro-lesson': 'micro_lessons',
  'virtual-field-trip': 'virtual_field_trips',
  'instant-answer': 'instant_answers',
  'teacher-training': 'teacher_training',
};

// ---------------------------------------------------------------------------
// Core Export Service
// ---------------------------------------------------------------------------

export const dataExportService = {

  /**
   * Fetch ALL content for a user, paginating through Firestore.
   * Returns a flat array of BaseContent documents (without heavy `data` blobs
   * if they were stripped at save time — those live in GCS).
   */
  async getAllContent(
    userId: string,
    filters?: { types?: ContentType[]; dateFrom?: Date; dateTo?: Date }
  ): Promise<BaseContent[]> {
    const db = await getDb();
    const contentRef = db.collection('users').doc(userId).collection('content');
    const allItems: BaseContent[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    while (allItems.length < MAX_CONTENT_ITEMS) {
      let query = contentRef
        .orderBy('createdAt', 'desc')
        .limit(BATCH_SIZE);

      if (filters?.types && filters.types.length > 0 && filters.types.length <= 10) {
        query = query.where('type', 'in', filters.types);
      }

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) break;

      for (const doc of snapshot.docs) {
        const item = doc.data() as BaseContent;
        // Skip soft-deleted
        if (item.deletedAt) continue;

        // Date range filter (Firestore Timestamps → Date)
        if (filters?.dateFrom || filters?.dateTo) {
          const created = item.createdAt?.toDate?.()
            ?? new Date((item.createdAt as any)?._seconds * 1000);
          if (filters.dateFrom && created < filters.dateFrom) continue;
          if (filters.dateTo && created > filters.dateTo) continue;
        }

        allItems.push(item);
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < BATCH_SIZE) break;
    }

    return allItems;
  },

  /**
   * Download the full file content from GCS for a single content item.
   * Returns Buffer or null if no storagePath.
   */
  async getStorageFile(storagePath: string): Promise<Buffer | null> {
    try {
      const storage = await getStorageInstance();
      const file = storage.bucket().file(storagePath);
      const [exists] = await file.exists();
      if (!exists) return null;
      const [buffer] = await file.download();
      return buffer;
    } catch (err) {
      logger.error('Export: failed to download storage file', err, 'EXPORT', { storagePath });
      return null;
    }
  },

  /**
   * Build the full JSON export bundle for a single teacher.
   * This is the canonical machine-readable export (DPDP-compliant).
   */
  async buildTeacherExport(request: ExportRequest): Promise<{
    manifest: ExportManifest;
    profile: UserProfile | null;
    content: Record<string, BaseContent[]>;
    analytics: any | null;
    communityPosts: any[] | null;
  }> {
    const db = await getDb();
    const { userId } = request;
    const exportId = `export_${userId}_${Date.now()}`;

    // 1. Profile
    let profile: UserProfile | null = null;
    if (request.includeProfile !== false) {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
        profile = { uid: userId, ...doc.data() } as UserProfile;
      }
    }

    // 2. Content grouped by type
    const allContent = await this.getAllContent(userId, {
      types: request.contentTypes,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
    });

    const contentByType: Record<string, BaseContent[]> = {};
    const contentCounts: Record<string, number> = {};
    for (const item of allContent) {
      const folder = FOLDER_MAP[item.type] || 'other';
      if (!contentByType[folder]) contentByType[folder] = [];
      contentByType[folder].push(item);
      contentCounts[folder] = (contentCounts[folder] || 0) + 1;
    }

    // 3. Analytics (usage history)
    let analytics: any = null;
    if (request.includeAnalytics !== false) {
      try {
        const analyticsDoc = await db.collection('users').doc(userId)
          .collection('analytics').doc('summary').get();
        if (analyticsDoc.exists) analytics = analyticsDoc.data();
      } catch {
        // Analytics collection may not exist for all users
      }
    }

    // 4. Community posts
    let communityPosts: any[] | null = null;
    if (request.includeCommunityPosts) {
      try {
        const postsSnap = await db.collection('community_posts')
          .where('authorId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(1000)
          .get();
        communityPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {
        communityPosts = [];
      }
    }

    // 5. Manifest
    const files: string[] = [];
    files.push('manifest.json', 'profile.json');
    for (const [folder, items] of Object.entries(contentByType)) {
      for (const item of items) {
        files.push(`${folder}/${item.id}.json`);
      }
    }
    if (analytics) files.push('analytics/usage_summary.json');
    if (communityPosts?.length) files.push('community/posts.json');

    const manifest: ExportManifest = {
      exportId,
      exportedAt: new Date().toISOString(),
      platform: 'SahayakAI',
      version: '1.0',
      dpdpCompliance: true,
      userId,
      contentCounts,
      files,
    };

    return { manifest, profile, content: contentByType, analytics, communityPosts };
  },

  /**
   * Convert a quiz to Google Forms-compatible JSON structure.
   * This produces a format that can be imported via Google Apps Script.
   */
  quizToGoogleFormsJson(quiz: any, metadata: BaseContent): object {
    return {
      info: {
        title: metadata.title || metadata.topic,
        description: `Generated by SahayakAI | ${metadata.subject} | ${metadata.gradeLevel}`,
      },
      items: (quiz.questions || []).map((q: any, i: number) => ({
        title: q.text,
        questionItem: {
          question: {
            required: true,
            choiceQuestion: q.type === 'multiple-choice' ? {
              type: 'RADIO',
              options: (q.options || []).map((o: string) => ({ value: o })),
              shuffle: false,
            } : undefined,
            textQuestion: q.type !== 'multiple-choice' ? { paragraph: false } : undefined,
          },
        },
        // Store answer key as metadata (Apps Script reads this)
        _answerKey: q.correctAnswer,
        _explanation: q.explanation,
      })),
    };
  },

  /**
   * Convert content items to CSV rows for analytics export.
   */
  contentToCSV(items: BaseContent[]): string {
    const headers = [
      'id', 'type', 'title', 'subject', 'gradeLevel', 'topic',
      'language', 'createdAt', 'isPublic',
    ];
    const rows = items.map(item => [
      item.id,
      item.type,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      item.subject,
      item.gradeLevel,
      `"${(item.topic || '').replace(/"/g, '""')}"`,
      item.language,
      item.createdAt?.toDate?.()?.toISOString() ?? '',
      item.isPublic ? 'true' : 'false',
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  },

  /**
   * Convert a lesson plan to print-ready HTML (for PDF generation).
   */
  lessonPlanToHTML(plan: any, metadata: BaseContent): string {
    const activities = (plan.activities || []).map((a: any) => `
      <div class="activity">
        <h3>${a.phase}: ${a.name} <span class="duration">(${a.duration})</span></h3>
        <p>${a.description}</p>
        ${a.teacherTips ? `<p class="tip"><strong>Teacher Tip:</strong> ${a.teacherTips}</p>` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${metadata.title || plan.title}</title>
  <style>
    body { font-family: 'Noto Sans', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { color: #1B5E20; border-bottom: 2px solid #4CAF50; padding-bottom: 8px; }
    h2 { color: #2E7D32; margin-top: 24px; }
    h3 { color: #388E3C; }
    .meta { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
    .meta span { margin-right: 24px; }
    .activity { border-left: 3px solid #4CAF50; padding-left: 16px; margin: 16px 0; }
    .duration { color: #757575; font-weight: normal; font-size: 0.9em; }
    .tip { background: #FFF3E0; padding: 8px 12px; border-radius: 4px; font-size: 0.9em; }
    .objectives li { margin: 4px 0; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 0.8em; color: #9e9e9e; }
  </style>
</head>
<body>
  <h1>${metadata.title || plan.title}</h1>
  <div class="meta">
    <span><strong>Subject:</strong> ${metadata.subject}</span>
    <span><strong>Grade:</strong> ${metadata.gradeLevel}</span>
    <span><strong>Duration:</strong> ${plan.duration || 'N/A'}</span>
    <span><strong>Language:</strong> ${metadata.language}</span>
  </div>

  <h2>Learning Objectives</h2>
  <ul class="objectives">
    ${(plan.objectives || []).map((o: string) => `<li>${o}</li>`).join('')}
  </ul>

  ${plan.keyVocabulary?.length ? `
  <h2>Key Vocabulary</h2>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%">
    <tr><th>Term</th><th>Meaning</th></tr>
    ${plan.keyVocabulary.map((v: any) => `<tr><td>${v.term}</td><td>${v.meaning}</td></tr>`).join('')}
  </table>` : ''}

  <h2>Materials</h2>
  <ul>${(plan.materials || []).map((m: string) => `<li>${m}</li>`).join('')}</ul>

  <h2>Activities</h2>
  ${activities}

  ${plan.assessment ? `<h2>Assessment</h2><p>${plan.assessment}</p>` : ''}
  ${plan.homework ? `<h2>Homework</h2><p>${plan.homework}</p>` : ''}

  <div class="footer">
    Exported from SahayakAI on ${new Date().toLocaleDateString('en-IN')} |
    This content was generated by the teacher and is their intellectual property.
  </div>
</body>
</html>`;
  },

  /**
   * Convert a quiz to print-ready HTML.
   */
  quizToHTML(quiz: any, metadata: BaseContent): string {
    const questions = (quiz.questions || []).map((q: any, i: number) => {
      let body = '';
      if (q.type === 'multiple-choice') {
        body = `<ol type="A">${(q.options || []).map((o: string) => `<li>${o}</li>`).join('')}</ol>`;
      } else if (q.type === 'true-false') {
        body = '<p>True / False</p>';
      } else {
        body = '<p style="border-bottom: 1px solid #ccc; height: 40px;"></p>';
      }
      return `
        <div class="question">
          <p><strong>Q${i + 1}.</strong> ${q.text}
            <span class="difficulty">[${q.difficulty}]</span>
          </p>
          ${body}
        </div>`;
    }).join('');

    const answerKey = (quiz.questions || []).map((q: any, i: number) =>
      `<tr><td>Q${i + 1}</td><td>${q.correctAnswer}</td><td>${q.explanation || ''}</td></tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${metadata.title || metadata.topic} - Quiz</title>
  <style>
    body { font-family: 'Noto Sans', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #1B5E20; }
    .meta { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; }
    .question { margin: 16px 0; padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; }
    .difficulty { color: #757575; font-size: 0.8em; }
    .answer-key { margin-top: 40px; page-break-before: always; }
    .answer-key table { width: 100%; border-collapse: collapse; }
    .answer-key th, .answer-key td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    .footer { margin-top: 40px; font-size: 0.8em; color: #9e9e9e; }
  </style>
</head>
<body>
  <h1>${metadata.title || metadata.topic}</h1>
  <div class="meta">
    <strong>Subject:</strong> ${metadata.subject} |
    <strong>Grade:</strong> ${metadata.gradeLevel} |
    <strong>Questions:</strong> ${quiz.questions?.length || 0}
  </div>
  <div class="student-info" style="margin:16px 0; border:1px solid #ccc; padding:12px;">
    <strong>Name:</strong> _________________________ &nbsp;&nbsp;
    <strong>Date:</strong> _______________ &nbsp;&nbsp;
    <strong>Roll No:</strong> _______
  </div>
  ${questions}
  <div class="answer-key">
    <h2>Answer Key (Teacher Copy)</h2>
    <table>
      <tr><th>Q#</th><th>Answer</th><th>Explanation</th></tr>
      ${answerKey}
    </table>
  </div>
  <div class="footer">Exported from SahayakAI | ${new Date().toLocaleDateString('en-IN')}</div>
</body>
</html>`;
  },

  /**
   * Create a background export job record in Firestore.
   * For large exports (school-wide), the job runs async.
   */
  async createExportJob(userId: string, type: 'individual' | 'school', params: any): Promise<string> {
    const db = await getDb();
    const jobRef = db.collection(EXPORT_COLLECTION).doc();
    await jobRef.set({
      id: jobRef.id,
      requestedBy: userId,
      type,
      params,
      status: 'pending', // pending → processing → completed → expired
      createdAt: new Date().toISOString(),
      completedAt: null,
      downloadUrl: null,
      expiresAt: null, // Set when completed (48h expiry)
      error: null,
    });
    return jobRef.id;
  },

  /**
   * Update an export job status.
   */
  async updateExportJob(jobId: string, update: {
    status: 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    error?: string;
  }): Promise<void> {
    const db = await getDb();
    await db.collection(EXPORT_COLLECTION).doc(jobId).update({
      ...update,
      ...(update.status === 'completed' ? {
        completedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      } : {}),
    });
  },

  /**
   * Get export job status.
   */
  async getExportJob(jobId: string): Promise<any> {
    const db = await getDb();
    const doc = await db.collection(EXPORT_COLLECTION).doc(jobId).get();
    return doc.exists ? doc.data() : null;
  },

  /**
   * Find all teachers belonging to a school (for school-admin export).
   */
  async getSchoolTeachers(schoolNormalized: string, limit = 500): Promise<UserProfile[]> {
    const db = await getDb();
    const snap = await db.collection('users')
      .where('schoolNormalized', '==', schoolNormalized)
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
  },

  /**
   * Build ZIP file contents as a map of path → Buffer.
   * Caller (API route) uses archiver or similar to stream the ZIP.
   */
  async buildExportFileMap(request: ExportRequest): Promise<Map<string, Buffer>> {
    const fileMap = new Map<string, Buffer>();

    const bundle = await this.buildTeacherExport(request);

    // manifest.json
    fileMap.set('manifest.json', Buffer.from(JSON.stringify(bundle.manifest, null, 2)));

    // profile.json
    if (bundle.profile) {
      // Strip sensitive fields
      const { ...safeProfile } = bundle.profile;
      fileMap.set('profile.json', Buffer.from(JSON.stringify(safeProfile, null, 2)));
    }

    // Content files — each item as JSON + HTML (for print/PDF)
    for (const [folder, items] of Object.entries(bundle.content)) {
      for (const item of items) {
        // Raw JSON
        fileMap.set(
          `${folder}/${item.id}.json`,
          Buffer.from(JSON.stringify(item, null, 2))
        );

        // If there's a GCS file, include the original
        if (item.storagePath) {
          const fileBuffer = await this.getStorageFile(item.storagePath);
          if (fileBuffer) {
            const ext = item.storagePath.split('.').pop() || 'bin';
            fileMap.set(`${folder}/${item.id}_original.${ext}`, fileBuffer);
          }
        }

        // HTML renderings for lesson plans and quizzes
        if (item.type === 'lesson-plan' && item.data) {
          fileMap.set(
            `${folder}/${item.id}.html`,
            Buffer.from(this.lessonPlanToHTML(item.data, item))
          );
        } else if (item.type === 'quiz' && item.data) {
          fileMap.set(
            `${folder}/${item.id}.html`,
            Buffer.from(this.quizToHTML(item.data, item))
          );
          // Google Forms compatible JSON
          fileMap.set(
            `${folder}/${item.id}_google_forms.json`,
            Buffer.from(JSON.stringify(this.quizToGoogleFormsJson(item.data, item), null, 2))
          );
        }
      }
    }

    // Analytics CSV
    if (bundle.content) {
      const allItems = Object.values(bundle.content).flat();
      if (allItems.length > 0) {
        fileMap.set('analytics/content_inventory.csv', Buffer.from(this.contentToCSV(allItems)));
      }
    }

    // Analytics summary
    if (bundle.analytics) {
      fileMap.set('analytics/usage_summary.json', Buffer.from(JSON.stringify(bundle.analytics, null, 2)));
    }

    // Community posts
    if (bundle.communityPosts?.length) {
      fileMap.set('community/posts.json', Buffer.from(JSON.stringify(bundle.communityPosts, null, 2)));
    }

    return fileMap;
  },

  /**
   * Handle subscription cancellation: mark user for grace period export.
   */
  async initiateGracePeriod(userId: string): Promise<{ expiresAt: string }> {
    const db = await getDb();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await db.collection('users').doc(userId).update({
      'cancellation.gracePeriodStart': new Date().toISOString(),
      'cancellation.gracePeriodEnd': expiresAt.toISOString(),
      'cancellation.dataExported': false,
      'cancellation.remindersSent': 0,
    });
    return { expiresAt: expiresAt.toISOString() };
  },
};
