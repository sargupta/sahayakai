#!/usr/bin/env node
/**
 * Read-only verification that the cloned Riya agent matches Varunesh's source agent.
 *
 * Makes ONLY GET requests:
 *   GET /v1/convai/agents/{id}[?branch_id=]        source and target configuration
 *   GET /v1/convai/phone-numbers/{phone_number_id} the number the clone would call from
 * It never creates, duplicates, updates, publishes or reassigns anything.
 *
 * The API key is read from ELEVENLABS_API_KEY in the shell and is never printed or written.
 * Phone numbers, e-mail addresses, SIP hosts and SIP usernames are masked; prompts are
 * compared by hash, never printed.
 *
 * Usage — Windows PowerShell (the key stays in your shell session):
 *   $env:ELEVENLABS_API_KEY = (Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText)
 *   node scripts/sampark/verify-riya-clone.mjs `
 *     --target agent_2401m4zy4gyaev48rz65wfmf5yr2 --target-branch agtbrch_1201m4zy4kczesra3jkmv9fpdtj2 `
 *     --source-file E:\sargvision\sahayakcallagentvarunesh.txt `
 *     [--source <source agent id>]  [--phone-number-id phnum_...]  [--out riya-clone-report.md]
 *
 * --source-file: the JSON export (any e-mail text before the first "{" is ignored). It is
 *   read, never modified. --source additionally fetches the live source agent (proves it
 *   exists in this account). Give at least one of them.
 *
 * Every check prints PASS, FAIL or UNVERIFIED. Exit code: 0 = no FAIL; 1 = at least one
 * FAIL; 2 = could not run (missing key or arguments, or the target could not be fetched).
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1];
const KEY = process.env.ELEVENLABS_API_KEY?.trim();
const BASE = 'https://api.elevenlabs.io';
const PURPOSES = ['absence_notice', 'emergency_closure', 'event_invitation', 'exam_schedule_notice', 'holiday_notice', 'ptm_invitation'];
// Copies of src/lib/sampark/conversation/riya-purposes.ts (RIYA_VARIABLES, RIYA_OPENING_TEMPLATE);
// riya-agent-sync.test.ts fails if they drift.
export const SAHAYAK_VARIABLES = ['school_name', 'call_purpose', 'student_name', 'class_name', 'section_name', 'event_name', 'event_date', 'event_time', 'holiday_dates', 'exam_schedule', 'absence_date', 'closure_date', 'closure_reason', 'transport_information'];
export const OPENING_TEMPLATE = 'Hello, this is Riya, calling from {{school_name}}, with an important update. Is this a good time to talk?';
/** Word sequence, ignoring case, punctuation and the agent's pause dots ("Hello..... this"). */
export const words = (s) => String(s ?? '').toLowerCase().replace(/\{\{\s*(\w+)\s*\}\}/g, ' var_$1 ').replace(/[^a-z0-9_]+/g, ' ').trim();

export function mask(text) {
    return String(text)
        .replace(/\+?\d[\d\s-]{8,}\d/g, (m) => `…${m.replace(/\D/g, '').slice(-4)}`)
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
        .replace(/\b[0-9a-f]{8}\.sip\.[\w.]+/gi, '<sip-host>')
        .replace(/("username"\s*:\s*")[^"]*/g, '$1<redacted>');
}
const short = (id) => (id ? `…${String(id).slice(-6)}` : 'none');
const sha = (s) => createHash('sha256').update(String(s ?? '')).digest('hex').slice(0, 12);
const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const vars = (s) => [...new Set(String(s ?? '').match(/\{\{\s*(\w+)\s*\}\}/g) ?? [])].map((m) => m.replace(/[{}\s]/g, '')).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function fetchJson(path) {
    const res = await fetch(`${BASE}${path}`, { headers: { 'xi-api-key': KEY } });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: await res.json() };
}

export function loadExport(path) {
    const text = readFileSync(path, 'utf8');
    const start = text.indexOf('{');
    if (start < 0) throw new Error('no JSON object found in --source-file');
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            if (c === '\\') i++;
            else if (c === '"') inString = false;
        } else if (c === '"') inString = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
    throw new Error('unterminated JSON object in --source-file');
}

/** Order-independent workflow shape: node types + prompt hashes, edges by source/target/condition. */
function workflowShape(a) {
    const nodes = get(a, 'workflow.nodes') ?? {};
    const edges = get(a, 'workflow.edges') ?? {};
    const purposeOfNode = {};
    for (const e of Object.values(edges)) {
        const left = get(e, 'forward_condition.expression.left.name');
        const value = get(e, 'forward_condition.expression.right.value');
        if (left === 'call_purpose' && value) purposeOfNode[e.target] = value;
    }
    const label = (id) => (nodes[id]?.type === 'start' ? 'start' : purposeOfNode[id] ?? `node:${nodes[id]?.type ?? '?'}`);
    const nodeShape = Object.entries(nodes).map(([id, n]) => ({
        node: label(id),
        type: n.type,
        prompt: n.additional_prompt ? sha(n.additional_prompt) : null,
        overrides: sha(JSON.stringify(n.conversation_config ?? null)),
    })).sort((x, y) => x.node.localeCompare(y.node));
    const edgeShape = Object.values(edges).map((e) => ({
        from: label(e.source),
        to: label(e.target),
        forward: sha(JSON.stringify(e.forward_condition ?? null)),
        backward: sha(JSON.stringify(e.backward_condition ?? null)),
    })).sort((x, y) => `${x.from}>${x.to}`.localeCompare(`${y.from}>${y.to}`));
    const branchPrompts = {};
    for (const [id, p] of Object.entries(purposeOfNode)) branchPrompts[p] = { sha: sha(nodes[id]?.additional_prompt), variables: vars(nodes[id]?.additional_prompt) };
    const fallback = Object.values(edges).some((e) => e.source && nodes[e.source]?.type === 'start' && get(e, 'forward_condition.type') !== 'expression');
    return { nodeShape, edgeShape, branchPrompts, fallback };
}

function fingerprint(a) {
    const ag = get(a, 'conversation_config.agent') ?? {};
    return {
        agentId: a.agent_id,
        name: a.name,
        branchId: a.branch_id ?? null,
        mainBranchId: a.main_branch_id ?? null,
        versionId: a.version_id ?? null,
        firstMessage: ag.first_message ?? null,
        prompt: sha(get(ag, 'prompt.prompt')),
        promptVariables: vars(get(ag, 'prompt.prompt')),
        allVariables: vars(JSON.stringify({ p: get(ag, 'prompt.prompt'), f: get(ag, 'first_message'), w: get(a, 'workflow') ?? null })).filter((v) => !v.startsWith('system__')),
        llm: get(ag, 'prompt.llm'),
        temperature: get(ag, 'prompt.temperature'),
        tools: (get(ag, 'prompt.tools') ?? []).map((t) => `${t.name}:${get(t, 'params.system_tool_type') ?? t.type}`).sort(),
        language: ag.language,
        voice: {
            voiceId: get(a, 'conversation_config.tts.voice_id'),
            model: get(a, 'conversation_config.tts.model_id'),
            stability: get(a, 'conversation_config.tts.stability'),
            similarity: get(a, 'conversation_config.tts.similarity_boost'),
            speed: get(a, 'conversation_config.tts.speed'),
            outputFormat: get(a, 'conversation_config.tts.agent_output_audio_format'),
        },
        pronunciation: sha(JSON.stringify(get(a, 'conversation_config.tts.pronunciation_dictionary_locators') ?? [])),
        asr: sha(JSON.stringify(get(a, 'conversation_config.asr') ?? null)),
        turn: sha(JSON.stringify(get(a, 'conversation_config.turn') ?? null)),
        maxDurationSeconds: get(a, 'conversation_config.conversation.max_duration_seconds'),
        placeholders: Object.keys(get(ag, 'dynamic_variables.dynamic_variable_placeholders') ?? {}).sort(),
        workflow: workflowShape(a),
        dataCollection: sha(JSON.stringify(get(a, 'platform_settings.data_collection') ?? {})),
        dataCollectionKeys: Object.keys(get(a, 'platform_settings.data_collection') ?? {}).sort(),
        privacy: get(a, 'platform_settings.privacy') ?? null,
        auth: { enable_auth: get(a, 'platform_settings.auth.enable_auth') ?? null, allowlist: (get(a, 'platform_settings.auth.allowlist') ?? []).length },
        callLimits: get(a, 'platform_settings.call_limits') ?? null,
        webhooks: get(a, 'platform_settings.workspace_overrides.webhooks') ?? null,
        overrides: get(a, 'platform_settings.overrides') ?? null,
        phones: (a.phone_numbers ?? []).map((p) => ({ id: p.phone_number_id, assignedTo: p.assigned_agent?.agent_id ?? null })),
    };
}

function checks(src, dst, phone, phoneId, liveSource) {
    const out = [];
    const add = (id, status, detail) => out.push({ id, status, detail });
    const cmp = (id, a, b, show = true) => add(id, same(a, b) ? 'PASS' : 'FAIL', same(a, b) ? (show ? mask(JSON.stringify(b)).slice(0, 120) : 'identical') : `source ${mask(JSON.stringify(a)).slice(0, 90)} ≠ target ${mask(JSON.stringify(b)).slice(0, 90)}`);

    add('1 ids and name', dst.agentId && src.agentId !== dst.agentId && src.name === dst.name ? 'PASS' : 'FAIL', `source ${short(src.agentId)} "${src.name}" · target ${short(dst.agentId)} "${dst.name}"`);
    add('2 source exists in this account', liveSource === true ? 'PASS' : liveSource === false ? 'FAIL' : 'UNVERIFIED', liveSource === null ? 'compared against the export file only; pass --source to fetch the live source' : '');
    add('3 target fetched from ElevenLabs', 'PASS', `branch ${short(dst.branchId)}, version ${short(dst.versionId)}`);
    cmp('4a workflow nodes (types, prompts, overrides)', src.workflow.nodeShape, dst.workflow.nodeShape, false);
    cmp('4b workflow edges (endpoints and conditions)', src.workflow.edgeShape, dst.workflow.edgeShape, false);
    cmp('5a main prompt (sha256)', src.prompt, dst.prompt);
    cmp('5b first message', src.firstMessage, dst.firstMessage);
    for (const p of PURPOSES) cmp(`5c ${p} prompt and variables`, src.workflow.branchPrompts[p] ?? null, dst.workflow.branchPrompts[p] ?? null);
    cmp('6a LLM and temperature', [src.llm, src.temperature], [dst.llm, dst.temperature]);
    cmp('6b voice and TTS settings', src.voice, dst.voice);
    cmp('6c pronunciation dictionaries', src.pronunciation, dst.pronunciation);
    cmp('6d ASR and turn settings', [src.asr, src.turn], [dst.asr, dst.turn], false);
    add('7 six call_purpose branches', PURPOSES.every((p) => dst.workflow.branchPrompts[p]) ? 'PASS' : 'FAIL', PURPOSES.filter((p) => !dst.workflow.branchPrompts[p]).join(', ') || 'all six present');
    cmp('8a dynamic-variable placeholders', src.placeholders, dst.placeholders);
    cmp('8b prompt variables', src.promptVariables, dst.promptVariables, false);
    cmp('8c data-collection fields', src.dataCollection, dst.dataCollection, false);
    const unsupplied = dst.allVariables.filter((v) => !SAHAYAK_VARIABLES.includes(v));
    add('8d every agent variable is supplied by Sahayak', unsupplied.length === 0 ? 'PASS' : 'FAIL', unsupplied.length ? `not sent by Sahayak: ${unsupplied.join(', ')}` : `${dst.allVariables.length} variables, all in Sahayak's 14`);
    const unused = SAHAYAK_VARIABLES.filter((v) => !dst.allVariables.includes(v));
    add('8e Sahayak variables the agent never reads', unused.length === 0 ? 'PASS' : 'UNVERIFIED', unused.length ? `sent but unused: ${unused.join(', ')}` : 'none');
    add('5d preview opening = agent first message', words(dst.firstMessage) === words(OPENING_TEMPLATE) ? 'PASS' : 'FAIL', words(dst.firstMessage) === words(OPENING_TEMPLATE) ? 'word for word' : `agent says "${mask(dst.firstMessage ?? '').slice(0, 160)}"; update RIYA_OPENING_TEMPLATE so the preview shows what the agent says`);
    cmp('9 end-call tool', src.tools, dst.tools);
    add('10 branch / version', dst.branchId && (!args['target-branch'] || dst.branchId === args['target-branch']) ? 'PASS' : 'FAIL', `target branch ${short(dst.branchId)} (expected ${short(args['target-branch'])}), main ${short(dst.mainBranchId)}`);

    if (!phoneId) add('11 phone number', dst.phones.length ? 'UNVERIFIED' : 'FAIL', dst.phones.length ? `${dst.phones.length} number(s) assigned; pass --phone-number-id to check one` : 'no number is assigned to the target agent');
    else if (!phone || phone.error) add('11 phone number', 'FAIL', `${short(phoneId)} could not be read (${phone?.error ?? 'not fetched'})`);
    else {
        const assigned = phone.assigned_agent?.agent_id;
        add('11a number assigned to the clone', assigned === dst.agentId ? 'PASS' : 'FAIL', `assigned to ${short(assigned)}${assigned === src.agentId ? ' (the SOURCE agent)' : ''}`);
        add('11b outbound SIP trunk configured', phone.provider === 'sip_trunk' ? (phone.outbound_trunk || phone.provider_config?.has_outbound_trunk ? 'PASS' : 'FAIL') : 'UNVERIFIED', `provider ${phone.provider}`);
        const inbound = phone.inbound_trunk?.allowed_addresses ?? [];
        add('11d outbound calls enabled', phone.supports_outbound === true ? 'PASS' : 'FAIL', `supports_outbound=${phone.supports_outbound}`);
        const ob = phone.outbound_trunk ?? phone.provider_config ?? {};
        add('11e outbound transport', ['tcp', 'tls'].includes(String(ob.transport ?? '').toLowerCase()) ? 'PASS' : 'FAIL', `transport ${ob.transport ?? 'unset'}, codecs ${(ob.enabled_codecs ?? []).join(' ') || 'default'}, media encryption ${ob.media_encryption ?? 'unset'}`);
        add('11f outbound authentication configured', ob.has_auth_credentials === true ? 'PASS' : 'FAIL', `has_auth_credentials=${ob.has_auth_credentials} (username and password are never printed)`);
        add('11c inbound restricted', !phone.supports_inbound ? 'PASS' : inbound.includes('0.0.0.0/0') || inbound.length === 0 ? 'FAIL' : 'PASS', `inbound ${phone.supports_inbound ? 'on' : 'off'}, allowed ${inbound.length ? inbound.map(mask).join(' ') : 'any'}`);
    }
    if (liveSource === true) {
        const kept = src.phones.filter((p) => p.assignedTo === src.agentId).length;
        add('11g original agent keeps its own number', kept > 0 ? 'PASS' : 'FAIL', `${kept} number(s) still assigned to the source agent`);
    } else add('11g original agent keeps its own number', 'UNVERIFIED', 'pass --source to fetch the live source agent');
    const pv = dst.privacy ?? {};
    add('12a recording / retention', !pv.record_voice || (pv.retention_days ?? -1) > 0 || pv.zero_retention_mode ? 'PASS' : 'FAIL', `record_voice=${pv.record_voice}, retention_days=${pv.retention_days}, zero_retention=${pv.zero_retention_mode}, delete_audio=${pv.delete_audio}`);
    add('12h transcript retention (separate from audio)', (pv.retention_days ?? -1) > 0 || pv.delete_transcript_and_pii || pv.zero_retention_mode ? 'PASS' : 'FAIL', `retention_days=${pv.retention_days} (applies to transcripts even when record_voice=false), delete_transcript_and_pii=${pv.delete_transcript_and_pii}`);
    add('12b agent access (auth)', dst.auth.enable_auth ? 'PASS' : 'FAIL', `enable_auth=${dst.auth.enable_auth}`);
    add('12c post-call webhook', dst.webhooks?.post_call_webhook_id ? 'PASS' : 'FAIL', `webhook ${short(dst.webhooks?.post_call_webhook_id)}, events ${JSON.stringify(dst.webhooks?.events ?? [])}, audio ${dst.webhooks?.send_audio}`);
    add('12d call limits', (dst.callLimits?.daily_limit ?? 1e9) <= 1000 && (dst.callLimits?.agent_concurrency_limit ?? -1) > 0 ? 'PASS' : 'FAIL', JSON.stringify(dst.callLimits));
    add('12e AI disclosure in first message', /\bAI\b/.test(dst.firstMessage ?? '') ? 'PASS' : 'FAIL', 'the first message must say Riya is an AI assistant');
    add('12f client overrides locked', !JSON.stringify(dst.overrides ?? {}).match(/"(first_message|prompt|voice_id|llm)":true/) ? 'PASS' : 'FAIL', 'first message, prompt, LLM and voice may not be overridden by a caller');
    add('12g fallback for unknown call_purpose', dst.workflow.fallback ? 'PASS' : 'FAIL', 'a start-node edge that catches values other than the six');
    return out;
}

async function main() {
    if ((!args.target && !args['phone-number-id']) || (!args.source && !args['source-file'])) {
        console.error('Usage: --target <clone agent id> (or --phone-number-id phnum_… to use the agent that number is assigned to) and at least one of --source <agent id> / --source-file <export>.');
        process.exit(2);
    }
    if (!KEY) {
        console.error('ELEVENLABS_API_KEY is not set in this shell.');
        process.exit(2);
    }
    if (!args.target) {
        // Resolve the agent from the number's live assignment instead of assuming an id.
        const pn = await fetchJson(`/v1/convai/phone-numbers/${encodeURIComponent(args['phone-number-id'])}`);
        const assigned = pn.data?.assigned_agent;
        if (pn.error || !assigned?.agent_id) {
            console.error(`Phone number ${short(args['phone-number-id'])}: ${pn.error ?? 'not assigned to any agent'}`);
            process.exit(2);
        }
        args.target = assigned.agent_id;
        if (!args['target-branch'] && assigned.branch_id) args['target-branch'] = assigned.branch_id;
        console.log(`Number ${short(args['phone-number-id'])} is assigned to agent ${assigned.agent_id} ("${mask(assigned.agent_name ?? '')}"), branch ${assigned.branch_id ?? 'none (main)'}.`);
        // Machine-readable for Deploy-Riya-Staging.ps1 (ids only; they are configuration, not secrets).
        console.log(`RIYA_TARGET agent=${assigned.agent_id} branch=${assigned.branch_id ?? ''}`);
    }
    const target = await fetchJson(`/v1/convai/agents/${encodeURIComponent(args.target)}${args['target-branch'] ? `?branch_id=${encodeURIComponent(args['target-branch'])}` : ''}`);
    if (target.error) {
        console.error(`Target ${short(args.target)}: ${target.error}`);
        process.exit(2);
    }
    let liveSource = null;
    let srcRaw = null;
    // The source agent id is in the export; read it (GET only) so checks 2 and 11g use the live source.
    if (!args.source && args['source-file']) args.source = loadExport(args['source-file']).agent_id ?? undefined;
    if (args.source) {
        const s = await fetchJson(`/v1/convai/agents/${encodeURIComponent(args.source)}`);
        liveSource = !s.error;
        srcRaw = s.data ?? null;
    }
    if (!srcRaw && args['source-file']) srcRaw = loadExport(args['source-file']);
    if (!srcRaw) {
        console.error('The source could not be read.');
        process.exit(2);
    }
    const phoneId = args['phone-number-id'] ?? process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID ?? null;
    const phone = phoneId ? await fetchJson(`/v1/convai/phone-numbers/${encodeURIComponent(phoneId)}`).then((r) => r.data ?? { error: r.error }) : null;

    const src = fingerprint(srcRaw);
    const dst = fingerprint(target.data);
    const results = checks(src, dst, phone, phoneId, liveSource);
    const lines = [
        `# Riya clone verification — ${new Date().toISOString()}`,
        '',
        `Source ${short(src.agentId)} (${liveSource === null ? 'export file' : 'live'}), target ${short(dst.agentId)}, branch ${short(dst.branchId)}, version ${short(dst.versionId)}. Read-only; no values that could identify a person or a credential are shown.`,
        '',
        '| Check | Status | Detail |',
        '|---|---|---|',
        ...results.map((r) => `| ${r.id} | ${r.status} | ${String(r.detail).replace(/\|/g, '/')} |`),
        '',
        `PASS ${results.filter((r) => r.status === 'PASS').length} · FAIL ${results.filter((r) => r.status === 'FAIL').length} · UNVERIFIED ${results.filter((r) => r.status === 'UNVERIFIED').length}`,
    ];
    const report = lines.join('\n');
    console.log(report);
    if (args.out) writeFileSync(args.out, `${report}\n`);
    process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('verify-riya-clone.mjs')) main();
