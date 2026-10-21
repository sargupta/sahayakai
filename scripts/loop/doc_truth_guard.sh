#!/usr/bin/env bash
# Runs every verify_command in CLAIMS.tsv and compares against `expected`.
#
# Exit 0 = every claim the docs are allowed to make is currently true.
# Exit 1 = at least one claim is false. During Band B0 that is EXPECTED and
#          informative; the gate profiles treat it as advisory until the B0
#          exit unit, which requires a clean sweep. Use --strict to fail hard.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

STRICT=0
JSON=0
for a in "$@"; do
  case "$a" in
    --strict) STRICT=1 ;;
    --json)   JSON=1 ;;
  esac
done

[ -f "$CLAIMS_TSV" ] || { echo "doc_truth_guard: CLAIMS.tsv missing at $CLAIMS_TSV"; exit 1; }

red=0; green=0
declare -a RED_IDS=()
[ "$JSON" -eq 0 ] && printf '%-32s %-8s %-8s %s\n' "CLAIM" "ACTUAL" "EXPECT" "VERDICT"

while IFS=$'\t' read -r id assertion cmd expect; do
  case "$id" in ''|\#*) continue ;; esac
  [ -z "${expect:-}" ] && continue

  actual="$(eval "$cmd" 2>/dev/null | tr -d '[:space:]')"
  [ -z "$actual" ] && actual="ERR"

  verdict="RED"
  if [[ "$actual" =~ ^-?[0-9]+$ ]]; then
    op="${expect:0:2}"; num="${expect:2}"
    case "$op" in
      '==') [ "$actual" -eq "$num" ] && verdict="GREEN" ;;
      '>=') [ "$actual" -ge "$num" ] && verdict="GREEN" ;;
      '<=') [ "$actual" -le "$num" ] && verdict="GREEN" ;;
    esac
  fi

  if [ "$verdict" = GREEN ]; then green=$((green+1)); else red=$((red+1)); RED_IDS+=("$id"); fi
  [ "$JSON" -eq 0 ] && printf '%-32s %-8s %-8s %s\n' "$id" "$actual" "$expect" "$verdict"
done < "$CLAIMS_TSV"

if [ "$JSON" -eq 1 ]; then
  printf '{"green":%d,"red":%d,"redIds":[' "$green" "$red"
  for i in "${!RED_IDS[@]}"; do [ "$i" -gt 0 ] && printf ','; printf '"%s"' "${RED_IDS[$i]}"; done
  printf ']}\n'
else
  echo
  echo "doc_truth_guard: $green green / $red red"
  [ "$red" -gt 0 ] && echo "  red: ${RED_IDS[*]}"
fi

if [ "$red" -gt 0 ] && [ "$STRICT" -eq 1 ]; then exit 1; fi
exit 0
