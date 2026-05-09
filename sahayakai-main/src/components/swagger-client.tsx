'use client';

import { useEffect, useRef } from 'react';

declare global {
    interface Window {
        SwaggerUIBundle?: any;
    }
}

type Props = {
    spec: Record<string, any>;
};

const SWAGGER_VERSION = '5.17.14';
const SCRIPT_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`;
const CSS_URL = `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`;

/**
 * Swagger UI host. Loads the standalone swagger-ui-dist bundle from CDN at
 * runtime to sidestep the swagger-ui-react bundler regression around the
 * @swagger-api/apidom-reference module (OpenAPI 3.1 dereferencer cannot be
 * resolved by Next.js Webpack as of Next 15.5).
 */
export default function SwaggerClient({ spec }: Props) {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        const ensureCss = () => {
            if (document.querySelector(`link[href="${CSS_URL}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = CSS_URL;
            document.head.appendChild(link);
        };

        const ensureScript = () =>
            new Promise<void>((resolve, reject) => {
                if (window.SwaggerUIBundle) return resolve();
                const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`) as HTMLScriptElement | null;
                if (existing) {
                    existing.addEventListener('load', () => resolve());
                    existing.addEventListener('error', () => reject(new Error('failed to load swagger-ui-bundle')));
                    return;
                }
                const script = document.createElement('script');
                script.src = SCRIPT_URL;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('failed to load swagger-ui-bundle'));
                document.head.appendChild(script);
            });

        const render = async () => {
            ensureCss();
            await ensureScript();
            if (cancelled || !hostRef.current || !window.SwaggerUIBundle) return;
            window.SwaggerUIBundle({
                spec,
                domNode: hostRef.current,
                docExpansion: 'list',
                defaultModelsExpandDepth: -1,
                displayRequestDuration: true,
                tryItOutEnabled: true,
                persistAuthorization: true,
            });
        };

        render().catch((err) => console.error('[swagger-ui] init failed', err));

        return () => {
            cancelled = true;
        };
    }, [spec]);

    return <div ref={hostRef} className="swagger-ui-host bg-white rounded-lg p-2" />;
}
