
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const SwaggerClient = dynamic(() => import('@/components/swagger-client'), { ssr: false });

export default function ApiDocsPage() {
    const [spec, setSpec] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        fetch('/api/api-docs')
            .then(r => r.json())
            .then(setSpec)
            .catch(console.error);
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">SahayakAI API Documentation</h1>
            {spec ? <SwaggerClient spec={spec} /> : <p>Loading API docs...</p>}
        </div>
    );
}
