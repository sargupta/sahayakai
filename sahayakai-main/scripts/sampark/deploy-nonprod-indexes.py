#!/usr/bin/env python3
"""Create Sampark's composite indexes in a named Firestore database (default: sampark-nonprod).

`firebase deploy --only firestore:indexes` only targets the (default) database, so a staging
service that points SAMPARK_FIRESTORE_DATABASE at `sampark-nonprod` has no composite indexes
and every dispatcher tick fails with FAILED_PRECONDITION ("The query requires an index").

Reads firestore.indexes.json (the single source of truth) and creates every index whose
collection group starts with `sampark_`. Safe to re-run: an index that already exists is skipped.

    python3 scripts/sampark/deploy-nonprod-indexes.py [--database sampark-nonprod] [--project ID] [--dry-run]
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database", default="sampark-nonprod")
    ap.add_argument("--project", default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if args.database == "(default)":
        sys.exit("refusing: the default database is deployed with `firebase deploy --only firestore:indexes`")

    indexes = json.loads((ROOT / "firestore.indexes.json").read_text())["indexes"]
    wanted = [i for i in indexes if i["collectionGroup"].startswith("sampark_")]
    failed = 0
    for i in wanted:
        cmd = ["gcloud", "firestore", "indexes", "composite", "create", f"--database={args.database}",
               f"--collection-group={i['collectionGroup']}", f"--query-scope={i['queryScope']}", "--async", "--quiet"]
        if args.project:
            cmd.append(f"--project={args.project}")
        for f in i["fields"]:
            kind = f"order={f['order'].lower()}" if "order" in f else f"array-config={f['arrayConfig'].lower()}"
            cmd.append(f"--field-config=field-path={f['fieldPath']},{kind}")
        label = f"{i['collectionGroup']}: " + ", ".join(f["fieldPath"] for f in i["fields"])
        if args.dry_run:
            print("would create", label)
            continue
        out = subprocess.run(cmd, capture_output=True, text=True)
        if out.returncode == 0:
            print("creating", label)
        elif "already exists" in (out.stderr + out.stdout).lower():
            print("exists  ", label)
        else:
            failed += 1
            print("FAILED  ", label, "\n   ", (out.stderr or out.stdout).strip().splitlines()[-1])
    print(f"{len(wanted)} Sampark indexes considered, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
