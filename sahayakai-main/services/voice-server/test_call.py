"""Quick test: trigger a Twilio call that connects to voice-server via WebSocket.

Usage:
  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... ... python3 test_call.py [scenario]

Scenarios:
  001 — Low attendance (Aarav, Class 5, Hindi)
  002 — Poor exam performance (Priya, Class 8, Hindi)
  003 — Behavioral issues (Rohit, Class 7, Hindi)
  004 — Homework + fees (Kavya, Class 4, Kannada)
"""

import os
import sys
import base64
import json
import urllib.parse
import urllib.request

# Scenario from CLI arg (default: 001)
scenario = sys.argv[1] if len(sys.argv) > 1 else "001"
outreach_id = f"__test__{scenario}"

# Twilio creds from environment
ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
TO_NUMBER = os.environ.get("TWILIO_TO_NUMBER", "")

# Voice server WebSocket URL (ngrok or deployed)
NGROK_URL = os.environ.get("NGROK_URL", "")

if not all([ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER, TO_NUMBER, NGROK_URL]):
    print("Missing env vars. Set: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, "
          "TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER, NGROK_URL")
    sys.exit(1)

WS_URL = NGROK_URL.replace("https://", "wss://") + "/ws/call"

# TwiML that connects to our voice server
TWIML = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{WS_URL}">
      <Parameter name="outreachId" value="{outreach_id}" />
    </Stream>
  </Connect>
</Response>"""

print(f"Scenario: {outreach_id}")
print(f"Calling {TO_NUMBER} from {FROM_NUMBER}")
print(f"Stream URL: {WS_URL}")

# Twilio REST API — Create Call with inline Twiml
url = f"https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Calls.json"
auth = base64.b64encode(f"{ACCOUNT_SID}:{AUTH_TOKEN}".encode()).decode()

data = urllib.parse.urlencode({
    "To": TO_NUMBER,
    "From": FROM_NUMBER,
    "Twiml": TWIML,
    "StatusCallbackEvent": "initiated ringing answered completed",
    "Timeout": "30",
}).encode()

req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"Basic {auth}")
req.add_header("Content-Type", "application/x-www-form-urlencoded")

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"Call initiated! SID: {result['sid']}")
        print(f"  Status: {result['status']}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Twilio error {e.code}: {body}")
except Exception as e:
    print(f"Error: {e}")
