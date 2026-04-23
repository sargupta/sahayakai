import { NextRequest, NextResponse } from 'next/server';
import { generateParentMessage } from '@/ai/flows/parent-message-generator';
import { withPlanCheck } from '@/lib/plan-guard';

async function _handler(req: NextRequest) {
    const userId = req.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();

        if (!body.studentName || !body.className || !body.subject || !body.reason || !body.parentLanguage) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Derive a one-line performance summary from structured context so the
        // prompt template (simple Handlebars — no array iteration) can cite it.
        const performanceSummary = body.performanceContext
            ? buildPerformanceSummary(body.performanceContext)
            : undefined;

        const result = await generateParentMessage({ ...body, userId, performanceSummary });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[parent-message] Error:', error);
        return NextResponse.json({ error: error.message ?? 'Failed to generate message' }, { status: 500 });
    }
}

/** "Maths Unit Test 1: 18/25 (72%), Science Mid-term: 34/50 (68%)" */
function buildPerformanceSummary(ctx: {
    subjectBreakdown?: { subject: string; name: string; marksObtained: number; maxMarks: number; percentage: number }[];
    latestPercentage?: number;
    isAtRisk?: boolean;
}): string | undefined {
    if (!ctx.subjectBreakdown || ctx.subjectBreakdown.length === 0) return undefined;
    const parts = ctx.subjectBreakdown.slice(0, 3).map((a) =>
        `${a.subject} ${shortenName(a.name)}: ${a.marksObtained}/${a.maxMarks} (${Math.round(a.percentage)}%)`,
    );
    const tail = typeof ctx.latestPercentage === 'number'
        ? ` · overall ${Math.round(ctx.latestPercentage)}%${ctx.isAtRisk ? ' (below the 35% at-risk line)' : ''}`
        : '';
    return parts.join(', ') + tail;
}

function shortenName(name: string): string {
    // "Unit Test 1 — Fractions & Decimals" → "Unit Test 1"
    const dash = name.indexOf('—');
    if (dash > 0) return name.slice(0, dash).trim();
    const hyphen = name.indexOf(' - ');
    if (hyphen > 0) return name.slice(0, hyphen).trim();
    return name.length > 24 ? name.slice(0, 24) + '…' : name;
}

export const POST = withPlanCheck('parent-message')(_handler);
