
import { getApiDocs } from '@/lib/swagger';
import SwaggerClient from '@/components/swagger-client';

export default async function ApiDocsPage() {
    const spec = await getApiDocs();
    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">SahayakAI API Documentation</h1>
            <SwaggerClient spec={spec} />
        </div>
    );
}
