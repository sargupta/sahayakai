"""Render the recorded opener in the cascade engine's voice (Sarvam Bulbul Neha).

The opener plays the instant a parent picks up, while the engine warms. It must
be the SAME voice that takes over, or the parent hears two people. The Gemini
Live engine uses `openers/`; the Neha cascade (`VOBIZ_ENGINE=cascade`) uses
`openers_neha/`, rendered here from the same reviewed lines
(`call_prompts.json`, exported from CALL_MENU_PROMPTS) as `generate_openers.py`.

Only languages the Neha engine is verified to speak are rendered: English and
Hindi. Any other language falls back to the English Neha opener.

Run (Git Bash, from sahayakai-agents; reads SARVAM_AI_API_KEY via gcloud into memory):
    PYTHONUTF8=1 PYTHONPATH=src python scripts/generate_neha_openers.py
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import httpx

from sahayakai_agents.telephony.audio import pcm24k_to_ulaw8k
from sahayakai_agents.telephony.cascade import CascadeConfig

ROOT = Path(__file__).resolve().parents[1] / "src" / "sahayakai_agents" / "telephony"
OUT = ROOT / "openers_neha"
LANGUAGES = {"English": "en-IN", "Hindi": "hi-IN"}


def main() -> None:
    key = os.environ.get("SARVAM_API_KEY") or subprocess.run(
        ["gcloud.cmd" if os.name == "nt" else "gcloud", "secrets", "versions", "access", "latest",
         "--secret", "SARVAM_AI_API_KEY", "--project", "sahayakai-b4248"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    prompts = json.loads((ROOT / "call_prompts.json").read_text(encoding="utf-8"))
    cfg = CascadeConfig()
    OUT.mkdir(exist_ok=True)
    for name, code in LANGUAGES.items():
        text = prompts[code]["greeting"]
        r = httpx.post(
            "https://api.sarvam.ai/text-to-speech/stream",
            headers={"api-subscription-key": key},
            json={"text": text, "target_language_code": code, "speaker": cfg.tts_speaker,
                  "model": cfg.tts_model, "speech_sample_rate": 24000,
                  "output_audio_codec": "linear16"},
            timeout=30,
        )
        r.raise_for_status()
        ulaw, _ = pcm24k_to_ulaw8k(r.content, None)
        (OUT / f"{name}.ulaw").write_bytes(ulaw)
        print(f"{name}: {len(ulaw) / 8000:.2f} s  ({cfg.tts_model} / {cfg.tts_speaker} / {code})")


if __name__ == "__main__":
    main()
