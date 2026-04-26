#!/usr/bin/env bash
# audit-i18n-source.sh
#
# Scans React component source files for hard-coded user-visible
# strings that are NOT wrapped in `t("...")`. The audit that should
# have caught the landing-page i18n regression at commit time, before
# anything shipped.
#
# Heuristic, not perfect — it errs on the side of reporting more
# rather than less so reviewers actually look. Patterns it flags:
#
#   1. JSX text nodes with 2+ words between > and <
#        e.g.  >Sign in to share<           → flag
#              >Loading...<                 → ignored (no spaces)
#              >{t("Sign in to share")}<    → ignored (already wrapped)
#   2. JSX attribute strings on user-visible attrs
#        e.g.  placeholder="Search lessons"  → flag
#              aria-label="Open Staff Room"  → flag
#              title="Sign in to continue"   → flag
#              alt="SahayakAI logo"          → flag (could be a brand
#                                              alt — review)
#
# Scope: src/components/landing, src/components/community,
# src/app/page.tsx, src/app/community, src/app/(marketing). Skips
# tests, types, hooks, helpers, schemas, dictionaries.
#
# Exit codes:
#   0  no flagged strings
#   1  one or more flagged strings (intended for CI / pre-commit)
#
# Usage:
#   ./scripts/audit-i18n-source.sh                       # all default scope
#   ./scripts/audit-i18n-source.sh src/components/community  # custom scope

set -euo pipefail

SCOPE_DEFAULT=(
    "src/components/landing"
    "src/components/community"
    "src/app/page.tsx"
    "src/app/community"
    "src/app/(marketing)"
)
SCOPE=("$@")
[[ "${#SCOPE[@]}" -eq 0 ]] && SCOPE=("${SCOPE_DEFAULT[@]}")

# Existing scope paths only — silently drop missing.
EXISTING=()
for p in "${SCOPE[@]}"; do [[ -e "$p" ]] && EXISTING+=("$p"); done
[[ "${#EXISTING[@]}" -eq 0 ]] && { echo "no existing scope paths"; exit 0; }

# When all scope paths are individual files (not directories), treat
# the run as "scoped" — typical for pre-commit-hook invocation. We
# want to skip the early-exit "no existing" check and avoid the
# `--include` glob noise from the directory-recursive grep below.
ALL_FILES=true
for p in "${EXISTING[@]}"; do
    [[ -d "$p" ]] && { ALL_FILES=false; break; }
done

# JSX text node: > Some Words With Spaces <
# Skips `>{t(...)}<` and template-literal forms.
PAT_JSX_TEXT='>[[:space:]]*[A-Z][A-Za-z][A-Za-z'"'"'… ,.\!?:;-]{6,}[[:space:]]*<'

# JSX attribute strings on user-visible attributes
PAT_ATTR='(placeholder|aria-label|title|alt|label)=[\"][^\"{}]{4,}[\"]'

# Lines we never want to flag (exclusions)
EXCLUDE_PATTERNS=(
    'className='
    '://'                    # URLs
    'href=\"http'
    'src=\"/'
    'src=\"http'
    'data-'                  # data-attributes
    '\{\s*t\('               # already wrapped
    '\{t\('                  # already wrapped (no leading space)
    'process.env'
    'console\.'
    '/\*'                    # comment lines
    '^\s*\*'                 # comment continuation
    '^\s*//'                 # single-line comment
)

build_exclude_args() {
    local args=()
    for p in "${EXCLUDE_PATTERNS[@]}"; do
        args+=( -e "$p" )
    done
    printf '%s\0' "${args[@]}"
}

EXCLUDE_REGEX="$(printf '%s' "${EXCLUDE_PATTERNS[@]/#/|}" | sed 's/^|//')"

count=0
echo "── i18n source audit ─────────────────────────────────────────"
echo "Scope: ${EXISTING[*]}"
echo

scan_one() {
    local pattern="$1"; local label="$2"
    local grep_args=( -En "$pattern" )
    if $ALL_FILES; then
        # Argument list is explicit files — grep them directly, no recursion.
        grep_args=( -En "$pattern" "${EXISTING[@]}" )
    else
        # Recursive scan with TSX/TS-only filter.
        grep_args=( -rEn --include="*.tsx" --include="*.ts" "$pattern" "${EXISTING[@]}" )
    fi
    while IFS= read -r line; do
        if echo "$line" | grep -Eq "${EXCLUDE_REGEX}"; then
            continue
        fi
        printf "  %s  %s\n" "$label" "$line"
        count=$((count + 1))
    done < <(grep "${grep_args[@]}" 2>/dev/null || true)
}

scan_one "$PAT_JSX_TEXT" "[JSX-text]"
scan_one "$PAT_ATTR"     "[attr]    "

echo
echo "Total flagged: $count"
echo
if [[ "$count" -gt 0 ]]; then
    echo "✗ Hard-coded user-visible strings detected. Wrap each in t(\"...\")"
    echo "  and add the key to src/context/language-context.tsx with values"
    echo "  for all 11 languages, then re-run."
    exit 1
fi
echo "✓ No hard-coded user-visible strings in scope."
exit 0
