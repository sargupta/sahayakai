/**
 * @jest-environment node
 *
 * CLASS GATE — the MCP demo's browser code can never hold or reach for the
 * MCP API key. Browser modules may only call /api/mcp-demo/* (server-side
 * MCP client); they must not read MCP env vars, embed key material, call the
 * MCP server directly, or import the server-only MCP client.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { basename, join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..');
const BROWSER_DIRS = ['src/features/mcp-demo', 'src/app/mcp-demo'];

function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
}
const browserFiles = BROWSER_DIRS.flatMap((d) => files(join(ROOT, d)));

it('covers the demo browser modules', () => {
    expect(browserFiles.length).toBeGreaterThanOrEqual(5);
});

it.each(browserFiles.map((f) => [f.slice(ROOT.length + 1), f]))('%s holds no MCP secret and never calls the MCP server directly', (_rel, file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/MCP_[A-Z_]*API_KEY|MCP_API_KEY_PEPPER|sk_sahayak_/);
    expect(src).not.toMatch(/['"`]\/api\/mcp\//); // only /api/mcp-demo/...
    expect(src).not.toMatch(/lib\/mcp-demo\/|@modelcontextprotocol\/sdk/);
});

const serverClients = files(join(ROOT, 'src/lib/mcp-demo'));

it('covers every demo (lesson planner, exam paper, quiz, calling)', () => {
    const names = serverClients.map((f) => basename(f));
    expect(names).toEqual(expect.arrayContaining(['lesson-planner-client.ts', 'exam-paper-client.ts', 'quiz-client.ts', 'calling-client.ts']));
});

it.each(serverClients.map((f) => [f.slice(ROOT.length + 1), f]))('%s (server-side MCP client) is marked server-only', (_rel, file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/^import 'server-only';/);
});
