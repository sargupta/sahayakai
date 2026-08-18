#!/usr/bin/env bash
# Flags an added comment that asserts a non-implementation sitting next to code
# that plainly implements.
#
# Derived from a real defect in this repo: lib/core/network/auth_interceptor.dart
# carried the comment "The stub token provider returns null, so no retry happens
# until auth is wired" directly above three lines that force-refresh a real
# Firebase ID token and retry correctly. That comment then propagated into four
# state-tracker documents as "Firebase is deferred", and steered weeks of work.
#
# A hit is NOT an automatic failure. It is a mandatory attestation: the
# HONESTY-AUDITOR reviewer must rule each hit `accurate` or `contradicted`.
# The point is that the claim can no longer pass unexamined.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

DIFF_FILE="$(mktemp -t cg_diff)"
trap 'rm -f "$DIFF_FILE"' EXIT
# Via worktree_diff.sh so UNTRACKED files are covered too: `git diff HEAD`
# cannot see a new file, and a false comment in a newly written file is exactly
# the case this guard exists for.
bash "$(dirname "${BASH_SOURCE[0]}")/worktree_diff.sh" --worktree > "$DIFF_FILE" 2>/dev/null

[ ! -s "$DIFF_FILE" ] && { echo "contradiction_guard: no diff to inspect"; exit 0; }

python3 - "$DIFF_FILE" <<'PY'
import re, sys

# An added comment claiming the thing is not built.
ASSERT = re.compile(
    r'(//|#|\*)\s*.*\b('
    r'stub|placeholder|not\s+(yet\s+)?(implemented|wired|built)|'
    r'deferred|no-?op|returns?\s+null|awaiting\s+firebase|pending-firebase'
    r')\b', re.I)

# Nearby code that plainly does the work.
IMPL = re.compile(
    r'\b(FirebaseAuth|GoogleSignIn|FirebaseFirestore|await\s+\w+\.(get|post|put|delete|call)'
    r'|_dio\.|\.post\(|\.get\(|Repository\(|ref\.read\(|ref\.watch\(|getIdToken)')

# An explicit, greppable opt-out for lines that legitimately discuss a stub
# without being one — documentation about this guard, a changelog entry, a
# quoted example. Same shape as secret_scan's marker. Per-line and reasoned,
# never per-file: a file-level exclusion would silently cover a real
# contradiction added to that file later.
ALLOW = 'contradiction-guard: allow'

lines = open(sys.argv[1], encoding='utf-8', errors='replace').read().splitlines()
hits = []
current_file = '?'
for i, l in enumerate(lines):
    if l.startswith('+++ b/'):
        current_file = l[6:]
        continue
    if not l.startswith('+') or l.startswith('+++'):
        continue
    if ALLOW in l:
        continue
    if not ASSERT.search(l):
        continue
    # Look ahead a few lines for contradicting implementation. A marked line is
    # excluded in BOTH roles — as the claim and as the evidence — otherwise a
    # marked line still gets pulled in as the "code" half of someone else's hit.
    for j in range(i + 1, min(i + 8, len(lines))):
        nxt = lines[j]
        if ALLOW in nxt:
            continue
        if nxt.startswith(('+', ' ')) and IMPL.search(nxt):
            hits.append((current_file, l.strip(), nxt.strip()))
            break

for f, c, code in hits:
    print(f'CONTRADICTION? {f}')
    print(f'   comment: {c}')
    print(f'   code:    {code}')

if hits:
    print(f'\ncontradiction_guard: {len(hits)} hit(s) — the HONESTY-AUDITOR must rule each')
    print('accurate or contradicted. Do not commit with an unaddressed hit.')
    raise SystemExit(1)
print('contradiction_guard: OK')
PY
