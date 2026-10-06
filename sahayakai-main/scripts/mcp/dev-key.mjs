#!/usr/bin/env node
/**
 * Set up a LOCAL-ONLY API key for Sahayak's MCP servers.
 *
 *   npm run mcp:dev-key
 *
 * Adds two lines to sahayakai-main/.env.local (gitignored) if they are not
 * already there:
 *   MCP_API_KEY_PEPPER=<random>          server-side pepper (any MCP server needs it)
 *   MCP_LOCAL_DEV_API_KEY=sk_sahayak_…   a key accepted ONLY by `next dev`
 *
 * Nothing is written to Firestore and the key can never work against a
 * deployed server (it is honoured only when NODE_ENV === 'development').
 * Restart `npm run dev` afterwards so Next.js picks the variables up.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envFile = join(appRoot, '.env.local');
const current = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const has = (name) => new RegExp(`^${name}=\\S+`, 'm').test(current);

const lines = [];
if (!has('MCP_API_KEY_PEPPER')) lines.push(`MCP_API_KEY_PEPPER=${randomBytes(32).toString('base64url')}`);
if (!has('MCP_LOCAL_DEV_API_KEY')) {
    lines.push(`MCP_LOCAL_DEV_API_KEY=sk_sahayak_${randomBytes(8).toString('hex')}_${randomBytes(32).toString('base64url')}`);
}

if (lines.length === 0) {
    console.log(`MCP local dev key already configured in ${envFile}. Nothing to do.`);
} else {
    const prefix = current === '' || current.endsWith('\n') ? '' : '\n';
    appendFileSync(envFile, `${prefix}# Sahayak MCP — local development only (npm run mcp:dev-key)\n${lines.join('\n')}\n`);
    console.log(`Added ${lines.map((l) => l.split('=')[0]).join(' and ')} to ${envFile}.`);
    console.log('Restart `npm run dev`, then run `npm run mcp:lesson-planner:demo` (or mcp:exam-paper:demo). The dev key holds every MCP scope.');
}
