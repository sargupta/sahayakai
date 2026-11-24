#!/usr/bin/env bash
# audit-i18n-live.sh
#
# Verifies that a set of recently-added i18n dictionary keys are
# actually present in the deployed JavaScript bundle. Catches the
# class of bug where:
#
#   - You wrap a JSX string in t("Foo") locally
#   - You add "Foo" to the dictionary
#   - You commit and push
#   - But the deploy did NOT pick up your changes (raced by another
#     deploy, build cache stale, branch swap, etc.)
#
# Without this script, the breakage only shows up when a user opens
# the page and sees English where Hindi was expected.
#
# How: fetch the homepage HTML from the live URL, follow each
# referenced /_next/static/chunks/*.js URL, and grep the combined
# bundle for each known i18n key. If any key is absent, flag.
#
# Note on language switcher: the language is stored in localStorage
# (`sahayakai-lang`), not a cookie or header — so curl alone cannot
# render Hindi-vs-English. We instead verify that both the English
# fallback strings AND their translated counterparts exist in the
# JS bundle; if both are present, the React tree will render the
# right one once the user picks a language client-side.

set -euo pipefail

URL="${URL:-https://sahayakai-hotfix-resilience-640589855975.asia-southeast1.run.app}"

# Recently-added landing-i18n keys we want to verify shipped.
KEYS_TO_VERIFY=(
    "For schools, chains & governments"
    "Give your teachers"
    "Not just a lesson plan generator."
    "For governments →"
    "Indian languages"
    "state boards"
    "saved daily"
    "per teacher"
    "pillar.prep-desk.name"
    "pillar.ai-co-teacher.name"
    "pillar.parent-hotline.name"
    "pillar.staffroom.name"
    "pillar.pro-inbox.name"
    "pillar.operating-system.name"
    "pillar.prep-desk.rotating"
    "pillar.ai-co-teacher.rotating"
    "quote.lakshmi.body"
    "quote.lakshmi.attribution"
    "footer.tagline"
    "footer.copyright"
    "footer.byline"
    "Made in Bharat"
)

# Hindi-script tokens we expect to find — proves Devanagari values
# made it into the bundle, not just the English fallback strings.
HINDI_TOKENS=(
    "स्कूलों, चेन्स"          # "For schools, chains..."
    "अपने शिक्षकों को दें"     # "Give your teachers"
    "तैयारी डेस्क"             # "Prep desk"
    "AI सह-शिक्षक"            # "AI co-teacher"
    "अभिभावक हॉटलाइन"          # "Parent hotline"
    "रायचूर ज़िला"             # quote attribution
)

echo "── i18n live audit ─────────────────────────────────────────"
echo "URL: $URL"
echo

# Step 1: fetch homepage, extract chunk URLs
echo "▸ fetching homepage HTML..."
HOME_HTML=$(curl -sS "$URL" --max-time 20 || { echo "✗ ABORT: homepage fetch failed"; exit 2; })
[[ -z "$HOME_HTML" ]] && { echo "✗ ABORT: homepage HTML empty"; exit 2; }

CHUNKS=$(echo "$HOME_HTML" | grep -oE '/_next/static/chunks/[a-zA-Z0-9_./-]+\.js' | sort -u)
chunk_count=$(echo "$CHUNKS" | grep -c . || echo 0)
echo "  found $chunk_count chunk URLs to grep"

if [[ "$chunk_count" -eq 0 ]]; then
    echo "✗ ABORT: no /_next/static/chunks/*.js URLs found in homepage HTML"
    exit 2
fi

# Step 2: download all chunks once into a tmp file, grep the bundle
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

echo "▸ downloading chunks..."
i=0
while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    curl -sS "${URL}${path}" --max-time 20 >> "$TMP" || true
    i=$((i + 1))
done <<< "$CHUNKS"

bundle_kb=$(( $(wc -c < "$TMP") / 1024 ))
echo "  downloaded ${bundle_kb} KB across $i chunks"
echo

# Step 3: assert each key + Hindi token is present
echo "── Key presence ────────────────────────────────────────────"
fails=0
for key in "${KEYS_TO_VERIFY[@]}"; do
    if grep -qF "$key" "$TMP"; then
        printf "  ✓  %s\n" "$key"
    else
        printf "  ✗  %-60s  MISSING in bundle\n" "$key"
        fails=$((fails + 1))
    fi
done

echo
echo "── Hindi value presence ────────────────────────────────────"
for token in "${HINDI_TOKENS[@]}"; do
    if grep -qF "$token" "$TMP"; then
        printf "  ✓  %s\n" "$token"
    else
        printf "  ✗  %s  MISSING in bundle\n" "$token"
        fails=$((fails + 1))
    fi
done

echo
if [[ "$fails" -gt 0 ]]; then
    echo "✗ $fails missing — your latest i18n commit did NOT ship to the live URL."
    echo "  Likely causes: deploy raced and got clobbered, build cache stale,"
    echo "  or you forgot to push to main. Run safe-deploy.sh and re-flip"
    echo "  traffic; then re-run this audit."
    exit 1
fi
echo "✓ All ${#KEYS_TO_VERIFY[@]} keys + ${#HINDI_TOKENS[@]} Hindi tokens present in live bundle."
exit 0
