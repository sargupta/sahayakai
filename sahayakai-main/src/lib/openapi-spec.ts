/**
 * Programmatic OpenAPI 3.0 spec for the SahayakAI Next.js API.
 *
 * Replaces the previous swagger-jsdoc generator (which scanned route files for
 * JSDoc annotations and produced an empty spec because routes have no JSDoc).
 *
 * The spec is built from `scripts/api-test/route-manifest.ts` so it stays
 * 1:1 with what the test harness exercises. `scripts/api-test/check-coverage.ts`
 * guarantees every route file is in the manifest.
 *
 * Served from /api/api-docs (consumed by /api-docs Swagger UI page).
 */
import { NEXT_ENDPOINTS, type EndpointSpec } from '../../scripts/api-test/route-manifest';

interface OpenAPIOperation {
  tags: string[];
  summary: string;
  security?: { BearerAuth: string[] }[];
  parameters?: Array<{
    name: string;
    in: 'query' | 'path' | 'header';
    required: boolean;
    schema: { type: string };
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: { type: string }; example?: unknown }>;
  };
  responses: Record<string, { description: string }>;
}

function pathTemplate(p: string): string {
  // [orgId] -> {orgId} for OpenAPI
  return p.replace(/\[([^\]]+)\]/g, '{$1}');
}

function buildOperation(spec: EndpointSpec): OpenAPIOperation {
  const op: OpenAPIOperation = {
    tags: [spec.tag],
    summary: spec.summary,
    responses: {
      '200': { description: 'Success' },
      '401': { description: 'Unauthorized' },
      '500': { description: 'Internal error' },
    },
  };

  if (spec.auth === 'bearer') op.security = [{ BearerAuth: [] }];

  // Path parameters from `[name]` segments
  const pathParams = Array.from(spec.path.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1]);
  const params: NonNullable<OpenAPIOperation['parameters']> = pathParams.map((name) => ({
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
  }));

  // Query params from `query` fixture (excluding ones already used as path params)
  if (spec.query) {
    for (const [name, value] of Object.entries(spec.query)) {
      if (pathParams.includes(name)) continue;
      params.push({
        name,
        in: 'query' as const,
        required: false,
        schema: { type: typeof value === 'number' ? 'integer' : 'string' },
      });
    }
  }
  if (params.length) op.parameters = params;

  if (spec.body !== undefined && spec.method !== 'GET' && spec.method !== 'DELETE') {
    const ct = spec.contentType || 'application/json';
    const schemaType = typeof spec.body === 'string' ? 'string' : 'object';
    op.requestBody = {
      required: true,
      content: {
        [ct]: {
          schema: { type: schemaType },
          example: spec.body,
        },
      },
    };
  }

  return op;
}

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  components: {
    securitySchemes: Record<string, unknown>;
  };
  tags: { name: string }[];
  paths: Record<string, Record<string, OpenAPIOperation>>;
}

export async function getApiDocs(): Promise<OpenAPISpec> {
  const paths: OpenAPISpec['paths'] = {};
  const tags = new Set<string>();

  for (const spec of NEXT_ENDPOINTS) {
    const apiPath = `/api${pathTemplate(spec.path)}`;
    if (!paths[apiPath]) paths[apiPath] = {};
    paths[apiPath][spec.method.toLowerCase()] = buildOperation(spec);
    tags.add(spec.tag);
  }

  return {
    openapi: '3.0.0',
    info: {
      title: 'SahayakAI API',
      version: '1.0.0',
      description:
        'API documentation for the SahayakAI Next.js app. Most endpoints require ' +
        'a Firebase ID token in the `Authorization: Bearer <jwt>` header. Cron ' +
        'endpoints require `x-cron-secret`. Webhooks are signed by the provider.',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local dev' },
      { url: 'https://sahayakai.com', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token (sign in via Google → copy from auth state).',
        },
      },
    },
    tags: Array.from(tags).sort().map((name) => ({ name })),
    paths,
  };
}
