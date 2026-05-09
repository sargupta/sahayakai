import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/openapi-spec';

export async function GET() {
    const spec = await getApiDocs();
    return NextResponse.json(spec);
}
