/**
 * The saved FIELD MAPPING (R2-4): a config object stored on `school.crm.mapping`
 * that lets a real tool's endpoint paths (or MCP tool names), pagination
 * parameters and field names land on the canonical contract of crm/schema.ts
 * WITHOUT code changes. REST and MCP share it; the importer never sees the
 * difference.
 *
 * What a mapping can do
 *   - rest.endpoints / mcp.tools   where each entity lives (students, guardians, attendance, ... consent)
 *   - pagination                   limit/cursor/updatedSince parameter names, cursor- or page-number style,
 *                                  and where the list and the next cursor sit in the response
 *   - fields[entity]               canonical target path  <-  source path in the tool's record
 *                                  ("phone": "mobile_no", "consent.notices.status": "sms_ok").
 *                                  `[]` maps list elements: "guardians[].guardianId": "parents[].pid"
 *   - valueMaps[entity]            translate the tool's values ("relation": {"Mother": "mother"})
 *   - defaults[entity]             a constant for a field the tool does not have ("timezone"-style facts)
 *
 * What a mapping can NOT do (fail-closed by construction)
 *   - invent safety facts: defaults may not target consent.*, doNotContact, synthetic or deleted. A tool that
 *     does not say whether a family consented yields NO consent, and the policy gate blocks that guardian.
 *   - reach prototype keys or arbitrary code: paths are a strict grammar, lookups use own-properties only.
 *   - skip validation: every mapped record still goes through the canonical zod schemas, row by row.
 *
 * Mapped records that fail validation are quarantined with a reason like any other.
 */

import { z } from 'zod';

export const CRM_ENTITIES = [
    'school',
    'students',
    'guardians',
    'attendance',
    'hpcEntries',
    'assessments',
    'meetings',
    'incidents',
    'feeDues',
    'consent',
] as const;
export type CrmEntity = (typeof CRM_ENTITIES)[number];

/** Where the canonical contract (and the dummy CRM) serves each entity. Consent has no canonical endpoint. */
export const CANONICAL_REST_PATHS: Partial<Record<CrmEntity, string>> = {
    school: '/v1/school',
    students: '/v1/students',
    guardians: '/v1/guardians',
    attendance: '/v1/attendance',
    hpcEntries: '/v1/hpc/entries',
    assessments: '/v1/assessments',
    meetings: '/v1/meetings',
    incidents: '/v1/incidents',
    feeDues: '/v1/fees/dues',
};

export function entityForCanonicalPath(path: string): CrmEntity | null {
    for (const [entity, p] of Object.entries(CANONICAL_REST_PATHS)) if (p === path) return entity as CrmEntity;
    return null;
}

// ── Path grammar ────────────────────────────────────────────────────────────

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const SEGMENT = /^[A-Za-z0-9_$-]{1,60}$/;

/** `a.b.c`, optionally with ONE `[]` marking a list ("guardians[].guardianId", "sensitiveFlags[]"). */
export function isValidMappingPath(path: string): boolean {
    if (path.length === 0 || path.length > 200) return false;
    const brackets = path.split('[]').length - 1;
    if (brackets > 1) return false;
    const flat = path.replace('[]', '');
    if (brackets === 1 && !/^[^[\]]+\[\](\..+)?$/.test(path)) return false;
    return flat.split('.').every((seg) => SEGMENT.test(seg) && !FORBIDDEN_SEGMENTS.has(seg));
}

const MappingPath = z.string().refine(isValidMappingPath, 'not a valid field path (letters, digits, _ $ -, dots, at most one [])');
const PlainPath = z.string().refine((p) => p === '$' || (isValidMappingPath(p) && !p.includes('[]')), 'not a valid path (use $ for a top-level list)');
const ParamName = z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,39}$/, 'not a valid parameter name');
const ToolName = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/, 'not a valid MCP tool name');
const RestPath = z
    .string()
    .regex(/^\/[A-Za-z0-9/_.-]{0,200}$/, 'endpoint must be a path like /api/students')
    .refine((p) => !p.includes('..') && !p.includes('//'), 'endpoint must not contain .. or //');
const Scalar = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

function perEntity<T extends z.ZodTypeAny>(inner: T) {
    const shape = Object.fromEntries(CRM_ENTITIES.map((e) => [e, inner.optional()])) as Record<CrmEntity, z.ZodOptional<T>>;
    return z.object(shape).strict();
}
const boundedRecord = <V extends z.ZodTypeAny>(key: z.ZodType<string>, value: V, max = 80) =>
    z.record(key, value).refine((o) => Object.keys(o).length <= max, `at most ${max} entries`);

const PaginationSchema = z
    .object({
        /** `cursor`: the response carries the next cursor. `page`: a page number that counts up until a short/empty page. */
        style: z.enum(['cursor', 'page']).default('cursor'),
        limitParam: ParamName.default('limit'),
        /** The cursor parameter (cursor style) or the page-number parameter (page style). */
        cursorParam: ParamName.default('cursor'),
        /** Null: the tool has no updated-since filter; every pull is a full snapshot. */
        updatedSinceParam: ParamName.nullable().default('updatedSince'),
        pageSize: z.number().int().min(1).max(500).default(200),
        /** First page number for the page style. */
        pageStart: z.union([z.literal(0), z.literal(1)]).default(1),
        /** Where the list of records sits in the response ('$' = the response IS the list). */
        dataPath: PlainPath.default('data'),
        /** Where the next cursor sits (cursor style). Null/absent value = last page. */
        nextCursorPath: PlainPath.nullable().default('nextCursor'),
    })
    .strict();

/** Targets a mapping may never default: the facts the gate relies on must come from the school's data. */
const NO_DEFAULT_TARGETS = /^(consent(\.|$)|doNotContact$|synthetic$|deleted$)/;

export const CrmMappingSchema = z
    .object({
        rest: z.object({ endpoints: perEntity(RestPath).default({}) }).strict().default({}),
        mcp: z
            .object({
                /** Tool name per entity. students and guardians are required to use the MCP adapter. */
                tools: perEntity(ToolName).default({}),
                /** Extra constant arguments sent on every call of that entity's tool. */
                args: perEntity(boundedRecord(ParamName, z.union([z.string().max(200), z.number(), z.boolean()]), 20)).default({}),
            })
            .strict()
            .default({}),
        pagination: PaginationSchema.default({}),
        fields: perEntity(boundedRecord(MappingPath, MappingPath)).default({}),
        valueMaps: perEntity(boundedRecord(MappingPath, boundedRecord(z.string().max(100), Scalar, 200), 40)).default({}),
        defaults: perEntity(boundedRecord(MappingPath, Scalar, 40)).default({}),
    })
    .strict()
    .superRefine((m, ctx) => {
        for (const [entity, targets] of Object.entries(m.defaults)) {
            for (const target of Object.keys(targets ?? {})) {
                if (NO_DEFAULT_TARGETS.test(target)) {
                    ctx.addIssue({ code: 'custom', path: ['defaults', entity, target], message: `${target} cannot have a default: it must come from the school's own data` });
                }
            }
        }
        for (const [entity, table] of Object.entries(m.fields)) {
            for (const [target, source] of Object.entries(table ?? {})) {
                if (target.includes('[]') !== source.includes('[]')) {
                    ctx.addIssue({ code: 'custom', path: ['fields', entity, target], message: 'a list mapping needs [] on both sides' });
                }
            }
        }
    });

export type CrmMapping = z.infer<typeof CrmMappingSchema>;
export type CrmMappingInput = z.input<typeof CrmMappingSchema>;

/** The canonical contract as-is. */
export function identityMapping(): CrmMapping {
    return CrmMappingSchema.parse({});
}

/** Parse a stored or typed mapping; null/undefined = identity. Throws ZodError. */
export function parseMapping(raw: unknown): CrmMapping {
    return CrmMappingSchema.parse(raw ?? {});
}

// ── Applying a mapping to ONE record ────────────────────────────────────────

type Json = Record<string, unknown>;
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

export function getPath(obj: unknown, path: string): unknown {
    let cur: unknown = obj;
    for (const seg of path.split('.')) {
        if (cur === null || typeof cur !== 'object' || !hasOwn(cur, seg)) return undefined;
        cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
}

/** Copy-on-write set: never mutates the input or anything it shares. `undefined` deletes. */
function setPath(obj: Json, path: string, value: unknown): Json {
    const [head, ...rest] = path.split('.');
    const out: Json = { ...obj };
    if (rest.length === 0) {
        if (value === undefined) delete out[head as string];
        else out[head as string] = value;
        return out;
    }
    const child = hasOwn(obj, head as string) && isObject(obj[head as string]) ? (obj[head as string] as Json) : {};
    const next = setPath(child, rest.join('.'), value);
    if (value === undefined && Object.keys(next).length === 0 && !hasOwn(obj, head as string)) return out;
    out[head as string] = next;
    return out;
}

function splitList(path: string): { list: string; rest: string } {
    const i = path.indexOf('[]');
    const rest = path.slice(i + 2);
    return { list: path.slice(0, i), rest: rest.startsWith('.') ? rest.slice(1) : rest };
}

function mapScalar(table: Record<string, unknown>, v: unknown): unknown {
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return v;
    const key = String(v);
    return hasOwn(table, key) ? table[key] : v;
}

export function mapRecord(entity: CrmEntity, raw: unknown, mapping: CrmMapping): unknown {
    const fields = mapping.fields[entity];
    const maps = mapping.valueMaps[entity];
    const defaults = mapping.defaults[entity];
    if (!fields && !maps && !defaults) return raw;
    if (!isObject(raw)) return raw; // the schema rejects it with its own reason
    let out: Json = { ...raw };

    // Fields. Plain paths first, then each list group once.
    const groups = new Map<string, { target: { list: string; rest: string }; source: { list: string; rest: string } }[]>();
    for (const [target, source] of Object.entries(fields ?? {})) {
        if (target.includes('[]')) {
            const t = splitList(target);
            const s = splitList(source);
            const key = `${t.list}\u0000${s.list}`;
            groups.set(key, [...(groups.get(key) ?? []), { target: t, source: s }]);
            continue;
        }
        out = setPath(out, target, getPath(raw, source));
    }
    for (const group of groups.values()) {
        const items = getPath(raw, (group[0] as (typeof group)[number]).source.list);
        const targetList = (group[0] as (typeof group)[number]).target.list;
        if (!Array.isArray(items)) {
            out = setPath(out, targetList, undefined);
            continue;
        }
        const scalarMode = group.some((g) => g.target.rest === '');
        out = setPath(
            out,
            targetList,
            items.map((el) => {
                if (scalarMode) {
                    const g = group.find((x) => x.target.rest === '') as (typeof group)[number];
                    return g.source.rest === '' ? el : getPath(el, g.source.rest);
                }
                let item: Json = {};
                for (const g of group) item = setPath(item, g.target.rest, g.source.rest === '' ? el : getPath(el, g.source.rest));
                return item;
            }),
        );
    }

    // Value maps.
    for (const [target, table] of Object.entries(maps ?? {})) {
        if (target.includes('[]')) {
            const { list, rest } = splitList(target);
            const arr = getPath(out, list);
            if (!Array.isArray(arr)) continue;
            out = setPath(
                out,
                list,
                arr.map((el) => {
                    if (rest === '') return mapScalar(table, el);
                    if (!isObject(el)) return el;
                    return setPath(el, rest, mapScalar(table, getPath(el, rest)));
                }),
            );
            continue;
        }
        const cur = getPath(out, target);
        if (cur !== undefined) out = setPath(out, target, mapScalar(table, cur));
    }

    // Defaults: only where the tool gave nothing.
    for (const [target, value] of Object.entries(defaults ?? {})) {
        if (getPath(out, target) === undefined) out = setPath(out, target, value);
    }
    return out;
}
