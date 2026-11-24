#!/usr/bin/env bash
# Regenerate requirements.lock: every dependency, transitive ones included,
# pinned to an exact version with sha256 hashes, for the image's target
# (CPython 3.12 on linux x86_64, manylinux_2_28, as python:3.12-slim runs on
# Cloud Run), from PyPI AS IT STOOD AT A FIXED TIME.
#
#   scripts/lock.sh                         the pinned cutoff below
#   scripts/lock.sh 2026-12-01T00:00:00Z    a deliberate upgrade: its own
#                                           reviewed change, and PINNED_CUTOFF
#                                           (here, PROMOTE.md and the
#                                           cloudbuild.yaml header) moves with it
#
# Do NOT run this as part of a promotion: the committed lock IS the reviewed
# dependency set, and the Dockerfile installs ONLY from it (--require-hashes).
#
# PINNED_CUTOFF is when the source revision 00037's image was built from was
# uploaded (2026-10-01T10:36:44Z, epoch 1790851004). Nothing published after
# that can be in 00037, so resolving with it is the closest recoverable match
# to what production runs without pulling the image.
#
# Needs uv and network access to PyPI.
set -euo pipefail
PINNED_CUTOFF="2026-10-01T10:36:44Z"
CUTOFF="${1:-$PINNED_CUTOFF}"
if [[ ! "$CUTOFF" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
  echo "lock.sh: the cutoff must be a UTC time like $PINNED_CUTOFF" >&2
  exit 2
fi
cd "$(dirname "$0")/.."
uv pip compile requirements.in --python-version 3.12 --python-platform x86_64-manylinux_2_28 \
  --generate-hashes --no-annotate --exclude-newer "$CUTOFF" -o requirements.lock
echo "Wrote $(pwd)/requirements.lock ($(grep -c '==' requirements.lock) pinned packages, PyPI as of $CUTOFF)."
