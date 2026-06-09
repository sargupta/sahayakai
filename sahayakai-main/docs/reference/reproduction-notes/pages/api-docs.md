# API Docs - /api-docs

**File:** `src/app/api-docs/page.tsx`
**Auth:** Not required (`/api-docs` is on the middleware public allowlist)
**Snapshot:** 2026-06-10

---

## Purpose

Interactive Swagger/OpenAPI documentation for all public API endpoints. Uses dynamically generated swagger spec from JSDoc annotations on route files.

---

## Component Tree

```
ApiDocsPage
└── SwaggerClient
    └── SwaggerUI (from swagger-ui-react)
        └── Rendered OpenAPI spec (all endpoints, schemas, try-it-out)
```

---

## Data Flow

1. The page (client component) fetches the spec at runtime: `GET /api/api-docs`.
2. That route uses `swagger-jsdoc` to scan route files for JSDoc `@swagger` annotations and build the OpenAPI spec.
3. `SwaggerClient` (dynamic import, `ssr: false`) renders the spec via SwaggerUI; shows "Loading API docs..." until the fetch resolves.
4. "Try it out" buttons allow live API calls from the browser.

---

## Implementation

- `src/lib/swagger.ts` - swagger-jsdoc config (API info, paths to scan)
- `src/components/swagger-client.tsx` - client wrapper for SwaggerUI (requires dynamic import, no SSR)
- Each API route has JSDoc `@swagger` annotations documenting request/response schemas

---

## Design

- Full-page SwaggerUI render
- Standard Swagger styling (not customized to match app theme)
- Responsive (SwaggerUI handles its own responsive layout)
