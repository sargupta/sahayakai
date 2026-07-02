#!/usr/bin/env bash
# F8-05 — Punjabi speech recognition tag verification
# No pure HTTP repro — requires placing a real Twilio call with Punjabi speech.
# This script generates the test plan + a snippet you paste into Twilio Console.
set -euo pipefail

cat <<'EOF'
Manual verification — Twilio Console procedure:

1. Seed a Punjabi outreach (parentLanguage: "Punjabi") and call your own
   Indian-phone-number test line via the existing outreach create flow.
2. When picked up, speak the Punjabi phrase:
     "ਮੇਰਾ ਬੱਚਾ ਅੱਜ ਸਕੂਲ ਨਹੀਂ ਆ ਸਕਦਾ"
3. In Twilio Console → Programmable Voice → Logs → your call →
   Speech Recognition tab. Verify the "Language" field equals "pa-IN".
4. If "Language" shows "en-US" or another fallback, F8-05 is confirmed
   (pa-Guru-IN was unrecognised and Twilio fell back).

Reference: https://www.twilio.com/docs/voice/twiml/gather#languagetags
EOF
