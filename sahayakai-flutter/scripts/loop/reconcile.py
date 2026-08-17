#!/usr/bin/env python3
"""Recompute LOOP_STATE.machine from the repository, then assert every
agent-written claim against it.

WHY THIS EXISTS
---------------
The four state trackers this harness replaces all lied, and they lied the same
way: one hand wrote both the claim and its evidence, and nothing ever re-read
the repo afterwards. BUILD_STATE.json said `"branch": "develop"` because a
human typed it once. It said Firebase was deferred while firebase_auth sat in
pubspec.yaml. It reported i18n as 262 keys / 21 translated when the real
numbers were 971 / 495. PILLAR_BUILD_STATE.json went 60 commits stale with no
mechanism that could ever notice.

Three structural defences, each aimed at one of those failures:

  1. MACHINE vs CLAIMS SPLIT. Everything an agent could get wrong by typing
     prose is derived here and overwritten wholesale every wake. There is no
     hand-writable `branch` field, so no one can mistype it.

  2. EVERY MEASUREMENT CARRIES ITS SHA. A result whose atSha is not HEAD is
     voided — set to -1, not left green. This is what kills "analyze was clean"
     when analyze was clean sixty commits ago.

  3. CLAIMS AUTO-DECAY. A unit marked done at verifiedAtSha is demoted to
     `stale` the moment a later commit touches its declared files. Nothing did
     this before, which is exactly how a tracker drifts 60 commits behind
     reality while still reading green.

Exit 0 = state reconciled and consistent.
Exit 1 = integrity violation. The wake may then do NOTHING except repair the
         tracker, commit that repair, and reschedule.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
GITPFX = "sahayakai-flutter/"
STATE = APP_ROOT / "docs/flutter/loop/LOOP_STATE.json"
WAKE_LOG = APP_ROOT / "docs/flutter/loop/WAKE_LOG.jsonl"

# git env vars leak in from hooks and silently retarget every git call.
CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}


def sh(cmd: str, cwd: Path = APP_ROOT) -> str:
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd, env=CLEAN_ENV,
                           capture_output=True, text=True, timeout=120)
        return r.stdout.strip()
    except Exception:
        return ""


def sh_int(cmd: str, default: int = 0) -> int:
    out = sh(cmd)
    m = re.search(r"-?\d+", out)
    return int(m.group()) if m else default


# ---------------------------------------------------------------- machine ---

def derive_git() -> dict:
    counts = sh("git rev-list --left-right --count origin/main...HEAD")
    behind, ahead = (counts.split() + ["0", "0"])[:2] if counts else ("0", "0")
    # Pathspec is CWD-relative (`.` == the app root); the OUTPUT it prints is
    # repo-root-relative and therefore carries GITPFX. See _env.sh.
    status = sh("git status --porcelain -- .")
    dirty, untracked = [], []
    for line in status.splitlines():
        if not line.strip():
            continue
        code, _, path = line[:2], line[2], line[3:]
        (untracked if code.strip() == "??" else dirty).append(path)
    return {
        "appRoot": str(APP_ROOT),
        "gitPathPrefix": GITPFX,
        "branch": sh("git rev-parse --abbrev-ref HEAD"),
        "head": sh("git rev-parse HEAD"),
        "headShort": sh("git rev-parse --short HEAD"),
        "headEpoch": sh_int("git log -1 --format=%ct"),
        "remoteUrl": sh("git remote get-url origin"),
        "aheadOfOriginMain": int(ahead or 0),
        "behindOriginMain": int(behind or 0),
        "dirtyPaths": dirty,
        "untrackedPaths": untracked,
    }


def derive_code() -> dict:
    find = ("find lib -name '*.dart' ! -name '*.g.dart' "
            "! -path 'lib/core/i18n/gen/*'")
    return {
        "dartFiles": sh_int(f"{find} | wc -l"),
        "dartLoc": sh_int(f"{find} -exec cat {{}} + | wc -l"),
        "features": sh_int("find lib/features -maxdepth 1 -mindepth 1 -type d | wc -l"),
        "routes": sh_int("grep -c 'GoRoute(' lib/core/router/app_router.dart"),
    }


def derive_tests() -> dict:
    return {
        "files": sh_int("find test -name '*_test.dart' | wc -l"),
        "declarations": sh_int(
            r"grep -rhoE '^[[:space:]]*(test|testWidgets)\(' test | wc -l"),
        "skipped": sh_int(r"grep -rhoE 'skip:[[:space:]]*(true|[\"'\''])' test | wc -l"),
        "goldenCallSites": sh_int("grep -rho matchesGoldenFile test | wc -l"),
        "goldenBaselinePngs": sh_int(
            "find test -path '*golden*' -name '*.png' | wc -l"),
    }


def derive_i18n() -> dict:
    arb = APP_ROOT / "lib/core/i18n/arb"
    per_locale, template = {}, 0
    if arb.is_dir():
        for p in sorted(arb.glob("app_*.arb")):
            loc = p.stem[4:]
            try:
                d = json.loads(p.read_text(encoding="utf-8"))
            except Exception:
                continue
            n = len([k for k in d if not k.startswith("@")])
            if loc == "en":
                template = n
            else:
                per_locale[loc] = n
    return {
        "templateKeys": template,
        "perLocaleKeys": per_locale,
        "untranslatedTotal": sh_int("bash scripts/loop/i18n_count.sh untranslated", -1),
        "identicalToEnglishTotal": sh_int("bash scripts/loop/i18n_count.sh identical", -1),
    }


def derive_claims() -> dict:
    raw = sh("bash scripts/loop/doc_truth_guard.sh --json")
    try:
        return json.loads(raw)
    except Exception:
        return {"green": -1, "red": -1, "redIds": []}


def derive_machine() -> dict:
    gradle = APP_ROOT / "android/app/build.gradle.kts"
    gradle_txt = gradle.read_text(encoding="utf-8") if gradle.exists() else ""
    aab = APP_ROOT / "build/app/outputs/bundle/release/app-release.aab"
    return {
        "reconciledAtEpoch": int(time.time()),
        "git": derive_git(),
        "code": derive_code(),
        "tests": derive_tests(),
        "i18n": derive_i18n(),
        "fonts": {
            "families": sh_int("bash scripts/loop/font_count.sh families"),
            "googleFontsDep": sh_int("bash scripts/loop/font_count.sh google_fonts_dep"),
        },
        "lints": {"activeRules": sh_int("bash scripts/loop/lint_count.sh")},
        "signing": {
            # A release signingConfig that merely *exists* is not enough — the
            # untouched template assigns the DEBUG config to release builds.
            "releaseConfigPresent": 'signingConfigs.getByName("debug")' not in gradle_txt
                                    and "signingConfigs" in gradle_txt,
            "keyPropertiesPresent": (APP_ROOT / "android/key.properties").exists(),
            "aabPresent": aab.exists(),
            "aabBytes": aab.stat().st_size if aab.exists() else 0,
            "aabSignerVerified": sh_int("bash scripts/loop/verify_aab_signer.sh --quiet") == 1,
        },
        "ci": {
            "flutterWorkflowFiles": [
                f for f in sh("grep -rl 'flutter analyze' ../.github/workflows/ 2>/dev/null").splitlines() if f
            ],
        },
        "claims": derive_claims(),
    }


# ------------------------------------------------------------- assertions ---

# `verifiedAtSha` and `files[]` are AGENT-WRITTEN fields — precisely the inputs
# this harness is built to distrust. They never reach a shell: argv-form only,
# so a malformed or hostile value in LOOP_STATE.json is a failed git call, not
# an executed command.
def git_argv(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=APP_ROOT, env=CLEAN_ENV,
                          capture_output=True, text=True, timeout=120)


SHA_RE = re.compile(r"^[0-9a-fA-F]{7,40}$")


def is_ancestor(sha: str) -> bool:
    if not sha or not SHA_RE.match(sha):
        return False
    return git_argv(["merge-base", "--is-ancestor", sha, "HEAD"]).returncode == 0


# The loop's own bookkeeping changes on EVERY wake by definition: each unit
# writes its outcome into LOOP_STATE.json and appends to WAKE_LOG.jsonl. If
# auto-decay counted those, the unit that created the tracker (U0.1, whose
# declared files include docs/flutter/loop/) would be demoted to `stale` by the
# very commit recording it as done, and would be re-selected forever. Observed
# on the first wake after U0.1 landed.
#
# Excluding them is narrow and safe: they carry no logic, only state this
# script recomputes anyway. Everything else — including the harness SCRIPTS —
# still decays normally, so a later change to gate.sh does re-open U0.1.
BOOKKEEPING = {
    "sahayakai-flutter/docs/flutter/loop/LOOP_STATE.json",
    "sahayakai-flutter/docs/flutter/loop/WAKE_LOG.jsonl",
    "sahayakai-flutter/docs/flutter/loop/last_gate_run.json",
}


def files_changed_since(sha: str, files: list[str]) -> list[str]:
    if not sha or not files or not SHA_RE.match(sha):
        return []
    # Unprefixed: these are pathspecs, resolved relative to the app root.
    paths = [f for f in files if isinstance(f, str) and f]
    if not paths:
        return []
    r = git_argv(["diff", "--name-only", f"{sha}..HEAD", "--", *paths])
    return [l for l in r.stdout.splitlines()
            if l.strip() and l.strip() not in BOOKKEEPING]


def reconcile(state: dict) -> list[dict]:
    """Mutates state in place. Returns the list of integrity violations."""
    violations: list[dict] = []
    now = int(time.time())

    def viol(assertion, expected, actual):
        violations.append({"assertion": assertion, "expected": expected,
                           "actual": actual, "detectedAtEpoch": now})

    machine = derive_machine()
    state["machine"] = machine
    head = machine["git"]["head"]

    # A1 — a `done` unit must carry a verifiedAtSha that really is in history.
    #      Without this, "done" is just a word an agent typed.
    for u in state.get("queue", []):
        if u.get("status") != "done":
            continue
        sha = u.get("verifiedAtSha")
        if not sha:
            viol("done unit has a verifiedAtSha", f"sha for {u['id']}", "null")
        elif not is_ancestor(sha):
            viol("verifiedAtSha is an ancestor of HEAD",
                 f"{u['id']} @ {sha[:9]} in history", "not an ancestor")

    # A2 — auto-decay. A later unit touching an earlier unit's files invalidates
    #      that earlier verification. This is a downgrade, not a violation.
    for u in state.get("queue", []):
        if u.get("status") != "done":
            continue
        changed = files_changed_since(u.get("verifiedAtSha", ""), u.get("files", []))
        if changed:
            u["status"] = "stale"
            u.setdefault("notes", []).append(
                f"auto-demoted to stale at {now}: {len(changed)} declared file(s) "
                f"changed since {u.get('verifiedAtSha', '')[:9]} — re-gate required")

    # A3 — void any measurement not taken at HEAD. Never leave it green.
    for key in ("analyze", "testRun"):
        m = state.get("measurements", {}).get(key)
        if isinstance(m, dict) and m.get("atSha") and m["atSha"] != head:
            m["exit"] = -1
            m["voidedReason"] = f"measured at {m['atSha'][:9]}, HEAD is {head[:9]}"

    # A4/A5 — the cheapest ways to turn a red gate green without doing the work
    #         are deleting a test and marking one skipped. Both are mechanical
    #         to detect, and neither is visible to any other rung.
    prev = {}
    if WAKE_LOG.exists():
        lines = [l for l in WAKE_LOG.read_text(encoding="utf-8").splitlines() if l.strip()]
        if lines:
            try:
                prev = json.loads(lines[-1])
            except Exception:
                prev = {}
    prev_decls = int(prev.get("testDeclarations", 0) or 0)
    prev_skipped = int(prev.get("testsSkipped", 0) or 0)
    cur_decls = machine["tests"]["declarations"]
    cur_skipped = machine["tests"]["skipped"]

    declared_removal = any(
        "testsRemoved" in n
        for u in state.get("queue", [])
        if u.get("status") in ("done", "stale")
        for n in u.get("notes", [])
    )
    if prev_decls and cur_decls < prev_decls and not declared_removal:
        viol("test count does not regress", f">= {prev_decls}",
             f"{cur_decls} (no unit declared testsRemoved)")
    if prev_skipped and cur_skipped > prev_skipped:
        viol("skipped tests do not grow", f"<= {prev_skipped}", str(cur_skipped))

    integ = state.setdefault("integrity", {})
    integ["violations"] = violations
    integ["status"] = "violation" if violations else "ok"
    integ["checkedAtEpoch"] = now
    integ["checkedAtSha"] = head
    integ["consecutiveViolationWakes"] = (
        int(integ.get("consecutiveViolationWakes", 0)) + 1 if violations else 0
    )
    return violations


def main() -> int:
    if not STATE.exists():
        print(f"reconcile: LOOP_STATE.json missing at {STATE}", file=sys.stderr)
        return 1
    state = json.loads(STATE.read_text(encoding="utf-8"))
    violations = reconcile(state)
    STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n",
                     encoding="utf-8")

    m = state["machine"]
    print(f"reconcile: head={m['git']['headShort']} branch={m['git']['branch']} "
          f"tests={m['tests']['declarations']} goldens={m['tests']['goldenCallSites']} "
          f"i18n_missing={m['i18n']['untranslatedTotal']} "
          f"claims={m['claims']['green']}g/{m['claims']['red']}r")

    if violations:
        print(f"reconcile: {len(violations)} INTEGRITY VIOLATION(S)")
        for v in violations:
            print(f"  - {v['assertion']}: expected {v['expected']}, got {v['actual']}")
        return 1
    print("reconcile: integrity OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
