#!/usr/bin/env python3
"""Fail if any workflow job that installs Playwright runs on a floating runner.

Playwright ships browser builds per OS release. When GitHub moved
`ubuntu-latest` to Ubuntu 26.04 (24 Oct 2026), `playwright install` stopped
working ("Playwright does not support chromium on ubuntu26.04-x64") and the
E2E smoke check went red on every PR. A job that installs Playwright must name
an exact runner image, such as `ubuntu-24.04`, and move to a new one on purpose.

Text-based on purpose: the runner image has no YAML library, and our workflows
keep jobs as two-space-indented keys under a top-level `jobs:`.
"""
import pathlib
import re
import sys

WORKFLOWS = pathlib.Path(__file__).resolve().parents[1] / "workflows"
JOB_KEY = re.compile(r"^  ([A-Za-z0-9_-]+):\s*$")
RUNS_ON = re.compile(r"^\s+runs-on:\s*(.+?)\s*$", re.M)
INSTALLS_PLAYWRIGHT = re.compile(r"playwright\s+install")


def jobs(text):
    """Yield (job_name, job_block) for each job under the top-level jobs: key."""
    lines = text.splitlines()
    try:
        start = lines.index("jobs:") + 1
    except ValueError:
        return
    name, block = None, []
    for line in lines[start:]:
        if line and not line.startswith(" ") and not line.startswith("#"):
            break  # next top-level key
        match = JOB_KEY.match(line)
        if match:
            if name:
                yield name, "\n".join(block)
            name, block = match.group(1), []
        elif name:
            block.append(line)
    if name:
        yield name, "\n".join(block)


def main():
    problems = []
    for path in sorted(WORKFLOWS.glob("*.y*ml")):
        for name, block in jobs(path.read_text()):
            if not INSTALLS_PLAYWRIGHT.search(block):
                continue
            runs_on = RUNS_ON.search(block)
            runner = runs_on.group(1) if runs_on else "(none)"
            if not runs_on or "latest" in runner or "${{" in runner:
                problems.append(f"{path.name}: job '{name}' installs Playwright on '{runner}'")
    if problems:
        print("Jobs that install Playwright must pin an exact runner image (e.g. ubuntu-24.04):")
        print("\n".join(f"  - {p}" for p in problems))
        return 1
    print("OK: every job that installs Playwright pins its runner image.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
