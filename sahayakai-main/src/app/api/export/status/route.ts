/**
 * GET /api/export/status?jobId=xxx — Poll export job status
 */

import { NextRequest, NextResponse } from 'next/server';
import { dataExportService } from '@/lib/services/data-export-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  const job = await dataExportService.getExportJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Export job not found' }, { status: 404 });
  }

  // Security: only the requester can see the job
  if (job.requestedBy !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    downloadUrl: job.downloadUrl,
    expiresAt: job.expiresAt,
    error: job.error,
  });
}
