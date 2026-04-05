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

    // School-wide export → always async background job
    if (schoolExport && schoolNormalized) {
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

    // Build ZIP inline using archiver
    const archiver = (await import('archiver')).default;
    const { PassThrough } = await import('stream');

    const passThrough = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(passThrough);

    for (const [path, buffer] of fileMap) {
      archive.append(buffer, { name: path });
    }
    await archive.finalize();

    // Collect chunks into a single buffer
    const chunks: Buffer[] = [];
    for await (const chunk of passThrough) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const zipBuffer = Buffer.concat(chunks);

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `sahayakai_export_${timestamp}.zip`;

    logger.info('Individual export completed', 'EXPORT', { userId, fileCount: fileMap.size });

    return new NextResponse(zipBuffer, {
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
