# API Docs — /api-docs

**File:** `src/app/api-docs/page.tsx`
**Auth:** Not required

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

1. `swagger-jsdoc` scans route files for JSDoc `@swagger` annotations
2. Generates OpenAPI 3.0 spec object
3. `SwaggerUI` renders the spec as interactive documentation
4. "Try it out" buttons allow live API calls from the browser

---

## Implementation

- `src/lib/swagger.ts` — swagger-jsdoc config (API info, paths to scan)
- `src/components/swagger-client.tsx` — client wrapper for SwaggerUI (requires dynamic import, no SSR)
- Each API route has JSDoc `@swagger` annotations documenting request/response schemas

---

## Design

- Full-page SwaggerUI render
- Standard Swagger styling (not customized to match app theme)
- Responsive (SwaggerUI handles its own responsive layout)
