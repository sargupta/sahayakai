/**
 * POST /api/export — Request a data export
 * GET  /api/export — Stream a ZIP download (small exports, < 500 items)
 *
 * For large exports (school-wide), POST returns a jobId; poll /api/export/status?jobId=xxx
 *
 * DPDP Act compliance: every user has the right to export all their data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataExportService, ExportRequest } from '@/lib/services/data-export-service';
import { logger } from '@/lib/logger';
import { isAdmin } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 min for large exports

// ---------------------------------------------------------------------------
// POST: Initiate export (returns jobId for large, or inline ZIP for small)
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      contentTypes,
      dateFrom,
      dateTo,
      includeProfile = true,
      includeAnalytics = true,
      includeCommunityPosts = false,
      schoolExport = false,
      schoolNormalized,
    } = body;

    // School-wide export → always async background job.
    // SECURITY (C6): a school export bundles EVERY teacher's data for the
    // given school. There is no self-serve "school admin of <schoolNormalized>"
    // authority a caller can prove without self-asserting a profile field
    // (schoolNormalized/administrativeRole are both user-editable), so a
    // signed-in teacher could previously export any school's data. Until an
    // org-scoped, server-verified school-admin model exists, restrict this
    // bulk-PII operation to platform admins only. Individual self-export
    // (below) remains open to every authenticated user.
    if (schoolExport && schoolNormalized) {
      if (!(await isAdmin(userId))) {
        logger.warn('Blocked non-admin school export attempt', 'EXPORT', { userId });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const jobId = await dataExportService.createExportJob(userId, 'school', {
        schoolNormalized,
        contentTypes,
      });
      // In production, this would trigger a Cloud Task / Pub/Sub to process.
      // For now we return the jobId for polling.
      logger.info('School export job created', 'EXPORT', { userId, jobId });
      return NextResponse.json({ jobId, status: 'pending', message: 'School export started. Poll /api/export/status for progress.' });
    }

    // Individual teacher export → attempt inline
    const exportReq: ExportRequest = {
      userId,
      contentTypes: contentTypes?.length ? contentTypes : undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      includeProfile,
      includeAnalytics,
      includeCommunityPosts,
    };

    const fileMap = await dataExportService.buildExportFileMap(exportReq);

    // If too large, fall back to async job
    if (fileMap.size > 500) {
      const jobId = await dataExportService.createExportJob(userId, 'individual', exportReq);
      logger.info('Large individual export → async job', 'EXPORT', { userId, jobId, fileCount: fileMap.size });
      return NextResponse.json({ jobId, status: 'pending', fileCount: fileMap.size });
    }

    // Build ZIP inline using archiver.
    //
    // BUG #31 (2026-05-28): The previous implementation called
    // `await archive.finalize()` BEFORE draining the PassThrough, then
    // iterated the stream. Archiver pipes into the PassThrough's bounded
    // internal buffer (default 16KB highWaterMark); once that buffer fills
    // and nobody is reading, archiver's writes back-pressure and
    // `finalize()`'s promise NEVER resolves — so the `await` hung forever and
    // the client spinner spun indefinitely. There was also no 'error'
    // listener, so an archiver error would leave the stream unended and the
    // (old) `for await` loop hanging too.
    //
    // Fix: collect chunks via event listeners that run CONCURRENTLY with
    // finalize, resolve on 'end', reject on any 'error', and guard the whole
    // thing with a timeout so the request can never hang past maxDuration.
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 6 } });

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        reject(new Error('ZIP build timed out'));
      }, 90_000); // well under maxDuration (120s) so we 500 cleanly, not hang

      archive.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      archive.on('warning', (err: Error) => {
        logger.warn('Archiver warning during export', 'EXPORT', { userId, error: String(err) });
      });
      archive.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
      archive.on('end', () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });

      for (const [path, buffer] of fileMap) {
        archive.append(buffer, { name: path });
      }
      // finalize() kicks off streaming; the 'end' handler above resolves.
      // We intentionally do NOT await it here — draining happens via the
      // 'data' listener concurrently, avoiding the back-pressure deadlock.
      archive.finalize().catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `sahayakai_export_${timestamp}.zip`;

    logger.info('Individual export completed', 'EXPORT', { userId, fileCount: fileMap.size });

    // Use a Uint8Array view so the body type matches BodyInit regardless of
    // the resolved Buffer ArrayBuffer variant.
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });

  } catch (error) {
    logger.error('Export API failed', error, 'EXPORT', { userId: request.headers.get('x-user-id') });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET: Check quick export size estimate
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Quick count of all content types
    const allContent = await dataExportService.getAllContent(userId);
    const counts: Record<string, number> = {};
    for (const item of allContent) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }

    return NextResponse.json({
      totalItems: allContent.length,
      countsByType: counts,
      estimatedSizeMB: Math.round(allContent.length * 0.05 * 10) / 10, // ~50KB avg per item
      formats: ['json', 'html', 'csv'],
      dpdpCompliance: true,
    });

  } catch (error) {
    logger.error('Export estimate failed', error, 'EXPORT');
    return NextResponse.json({ error: 'Failed to estimate export' }, { status: 500 });
  }
}
