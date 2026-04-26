#!/usr/bin/env bash
# Apply Firestore TTL policies for sahayakai-agents collections.
#
# Two TTL fields are required before the first shadow ramp:
#
#   agent_sessions/{callSid}                 .expireAt   (24h)
#   agent_shadow_diffs/{date}/calls/{id}     .expireAt   (14d)
#
# Phase 2 will add a third for `agent_voice_sessions/{callSid}` (24h);
# this script accepts a `--include-voice` flag to enable it once the
# voice sub-router lands.
#
# Idempotent: re-applying an existing TTL is a no-op. The `gcloud
# firestore fields ttl update` command silently succeeds when the
# field is already configured.
#
# Usage:
#   bash scripts/apply-firestore-ttl.sh \
#       --project sahayakai-b4248 \
#       --database "(default)" \
#       [--include-voice]
#
# Required permissions for the caller:
#   - roles/datastore.owner OR
#   - roles/datastore.indexAdmin (TTL is a special index)
#
# Round-2 audit reference: P0 TTL-1.

set -euo pipefail

PROJECT_ID=""
DATABASE="(default)"
INCLUDE_VOICE=0

usage() {
  echo "Usage: $0 --project <project-id> [--database <id>] [--include-voice]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --database) DATABASE="$2"; shift 2 ;;
    --include-voice) INCLUDE_VOICE=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$PROJECT_ID" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

apply_ttl() {
  local collection="$1"
  local field="$2"
  info "Applying TTL: ${collection}.${field}"
  gcloud firestore fields ttl update "${field}" \
    --collection-group="${collection}" \
    --enable-ttl \
    --database="${DATABASE}" \
    --project="${PROJECT_ID}" \
    --quiet >/dev/null
  ok "  ${collection}.${field} TTL enabled"
}

apply_ttl agent_sessions expireAt
apply_ttl calls expireAt   # `calls` is the leaf collection-group under agent_shadow_diffs/{date}

if [[ "$INCLUDE_VOICE" == "1" ]]; then
  apply_ttl agent_voice_sessions expireAt
fi

echo
ok "Firestore TTL policies applied."
echo
echo "Verify in Cloud Console:"
echo "  https://console.cloud.google.com/firestore/databases/${DATABASE}/data?project=${PROJECT_ID}"
echo "  → Indexes tab → TTL"
