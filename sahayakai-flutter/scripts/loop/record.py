#!/usr/bin/env python3
"""Record a unit's outcome into LOOP_STATE.json and WAKE_LOG.jsonl.

    python3 scripts/loop/record.py --unit U0.1 --status done \
        [--commit <sha>] [--note "..."] [--blocked-kind human --blocked-detail "..."]

WHY THIS IS A SCRIPT AND NOT SOMETHING THE AGENT WRITES BY HAND
The evidence for a unit — which gates ran, what they returned, how long they
took, the tail of any failure — is copied verbatim from gate.sh's own output
file. The agent never retypes it, never summarises it, never decides what was
important. That separation is the whole point: the previous generation of
trackers in this repo failed because one hand wrote both the claim and its
evidence, and prose is where the drift entered.

`verifiedAtSha` is set to the CURRENT HEAD, not to anything passed in, and
reconcile.py independently asserts that it is a real ancestor. So a unit cannot
be marked done at a sha that does not exist or does not contain the work.

A unit may only be recorded `done` if the recorded gate run PASSED at the
current HEAD. Attempting otherwise is refused, loudly.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
STATE = APP_ROOT / "docs/flutter/loop/LOOP_STATE.json"
WAKE_LOG = APP_ROOT / "docs/flutter/loop/WAKE_LOG.jsonl"
GATE_RUN = APP_ROOT / "docs/flutter/loop/last_gate_run.json"

CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}

VALID_STATUS = {"pending", "in_progress", "done", "stale",
                "failed", "blocked", "quarantined", "superseded"}
VALID_BLOCKED = {"human", "branch-policy", "backend", "credential"}


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], cwd=APP_ROOT, env=CLEAN_ENV,
                       capture_output=True, text=True)
    return r.stdout.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--unit", required=True)
    ap.add_argument("--status", required=True, choices=sorted(VALID_STATUS))
    ap.add_argument("--commit")
    ap.add_argument("--note", action="append", default=[])
    ap.add_argument("--blocked-kind", choices=sorted(VALID_BLOCKED))
    ap.add_argument("--blocked-detail")
    ap.add_argument("--noop", action="store_true",
                    help="this wake advanced nothing; recorded as such")
    ap.add_argument("--dry-run", action="store_true",
                    help="run every refusal check but write nothing. Used by "
                         "selftest.sh, which must be able to prove the "
                         "cross-unit evidence check still refuses WITHOUT "
                         "corrupting real state if that check has regressed.")
    a = ap.parse_args()

    state = json.loads(STATE.read_text(encoding="utf-8"))
    unit = next((u for u in state["queue"] if u["id"] == a.unit), None)
    if unit is None:
        print(f"record: no unit {a.unit} in the queue", file=sys.stderr)
        return 1

    head = git("rev-parse", "HEAD")
    now = int(time.time())

    gate = {}
    if GATE_RUN.exists():
        try:
            gate = json.loads(GATE_RUN.read_text(encoding="utf-8"))
        except Exception:
            gate = {}

    # A unit is `done` only on evidence of a passing gate at THIS head.
    if a.status == "done":
        if not gate:
            print("record: REFUSED — status=done with no recorded gate run.",
                  file=sys.stderr)
            return 2
        if gate.get("exit") != 0:
            print(f"record: REFUSED — status=done but the recorded gate FAILED "
                  f"at rung '{gate.get('failedRung')}'.", file=sys.stderr)
            return 2
        # Evidence must belong to THIS unit. Without this binding any unit could
        # cite the most recent green run as its own proof, which is how a
        # not-yet-started unit gets marked done.
        if gate.get("unit") != a.unit:
            print(f"record: REFUSED — the recorded gate was run for "
                  f"{gate.get('unit') or 'no unit'}, not {a.unit}. "
                  f"Re-run: UNIT_ID={a.unit} UNIT_FILES=... "
                  f"bash scripts/loop/gate.sh {unit.get('gateProfile')}",
                  file=sys.stderr)
            return 2
        # And it must be AT LEAST the profile this unit requires. A `fast` run
        # is not evidence for a unit demanding `release` — but a `native` run is
        # perfectly good evidence for one demanding `standard`, because the
        # profiles are strictly nested supersets. Requiring exact equality
        # rejected a unit that had just passed a STRONGER ladder, which pushes
        # toward running the weaker gate to satisfy the bookkeeping — exactly
        # backwards.
        STRENGTH = {"fast": 0, "standard": 1, "i18n": 2, "native": 3, "release": 4}
        want = unit.get("gateProfile")
        if want:
            need = STRENGTH.get(want, 1)
            have = STRENGTH.get(gate.get("profile", ""), -1)
            if have < need:
                print(f"record: REFUSED — {a.unit} requires gate profile "
                      f"'{want}' or stronger, but the recorded run was "
                      f"'{gate.get('profile')}'.", file=sys.stderr)
                return 2
        # The gate runs on the working tree BEFORE the commit, so its recorded
        # sha is the commit's parent. Both are valid evidence for this unit and
        # nothing else is: `parent` proves the gate judged exactly the tree that
        # became this commit, `head` covers a gate re-run afterwards. Any other
        # sha means the gate judged a different tree.
        parent = git("rev-parse", "HEAD^") if git("rev-list", "--count", "HEAD") != "1" else ""
        if gate.get("atSha") not in (head, parent):
            print(f"record: REFUSED — the gate ran at {str(gate.get('atSha'))[:9]}, "
                  f"which is neither HEAD ({head[:9]}) nor its parent "
                  f"({parent[:9] or 'none'}). Re-run the gate.", file=sys.stderr)
            return 2

    if a.dry_run:
        print(f"record: DRY RUN — {a.unit} would be recorded {a.status}; "
              f"all refusal checks passed. Nothing written.")
        return 0

    unit["status"] = a.status
    unit["attempts"] = int(unit.get("attempts", 0)) + 1
    if a.commit:
        unit["commit"] = a.commit
    if a.status == "done":
        unit["verifiedAtSha"] = head
        unit["failure"] = None
    if gate:
        unit.setdefault("evidence", {})["gatesRun"] = gate.get("gates", [])
        unit["evidence"]["gateProfile"] = gate.get("profile")
        unit["evidence"]["gateExit"] = gate.get("exit")
        unit["evidence"]["gateAtSha"] = gate.get("atSha")
    if a.status == "failed" and gate:
        failed = next((g for g in gate.get("gates", [])
                       if g.get("exit") not in (0, None)), {})
        unit["failure"] = {
            "gate": gate.get("failedRung"),
            "exit": failed.get("exit"),
            # Verbatim from the gate's own capture. Never an agent's rewording.
            "tail": failed.get("tail"),
            "atEpoch": now,
        }
    if a.blocked_kind:
        unit["blockedBy"] = {"kind": a.blocked_kind,
                             "detail": a.blocked_detail or ""}
    for n in a.note:
        unit.setdefault("notes", []).append(n)

    loop = state.setdefault("loop", {})
    loop["wakeCount"] = int(loop.get("wakeCount", 0)) + 1
    advanced = a.status in ("done", "failed", "blocked", "quarantined")
    loop["consecutiveNoProgressWakes"] = (
        0 if advanced and not a.noop
        else int(loop.get("consecutiveNoProgressWakes", 0)) + 1)

    STATE.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n",
                     encoding="utf-8")

    m = state.get("machine", {})
    entry = {
        "wake": loop["wakeCount"],
        "atEpoch": now,
        "unit": a.unit,
        "status": a.status,
        "commit": a.commit or unit.get("commit"),
        "head": head,
        "gateProfile": gate.get("profile"),
        "gateExit": gate.get("exit"),
        "failedRung": gate.get("failedRung"),
        # Carried so reconcile can assert these never regress between wakes.
        "testDeclarations": m.get("tests", {}).get("declarations"),
        "testsSkipped": m.get("tests", {}).get("skipped"),
        "i18nUntranslated": m.get("i18n", {}).get("untranslatedTotal"),
        "goldenCallSites": m.get("tests", {}).get("goldenCallSites"),
        "claimsRed": m.get("claims", {}).get("red"),
        "notes": a.note,
    }
    with WAKE_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"record: {a.unit} -> {a.status} (wake {loop['wakeCount']}, "
          f"gate={gate.get('profile')}:{gate.get('exit')}, head={head[:9]})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
