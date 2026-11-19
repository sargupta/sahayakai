"""CLASS GATE — one stream token, one spelling, one stream.

Security review of 2fc691707: the single-use record was keyed on sha256 of the
raw token string, while verify_stream_token accepted more than one spelling of
the same token (int() reads "0179…", "+179…", " 179…", "1_79…" and even
Arabic-Indic digits as the same expiry). With one valid stream URL an attacker
could reconnect with an equivalent spelling that hashed differently, and the
replay check never fired.

The class is "two encodings of one credential are both honoured". The gate
builds, for one genuine token, every equivalent or near spelling we can think
of (leading zeros, signs, whitespace, digit separators, non-ASCII digits,
padding, the standard base64 alphabet, a non-canonical final character, case
changes, trailing separators) and requires each to be either rejected by the
parser or refused as already used once the genuine token has connected; then
checks the same through the real Vobiz handler. A token minted the way the web
app mints it (Node's base64url) must still be accepted.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import shutil
import subprocess
import time

import pytest

from bot_harness import (
    RECORDER,
    SIGNING_KEY,
    FakeAsyncFirestore,
    FakeCallStore,
    count_context_loads,
    import_main,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD
from src.stream_tokens import StreamUse, consume_stream_token, parse_stream_token

OID = "OutreachFs0000000001"
_B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"


def _sign(outreach_id: str, exp: int, key: str = SIGNING_KEY) -> str:
    digest = hmac.new(key.encode(), f"vobiz-call.{outreach_id}.{exp}".encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def _genuine() -> tuple[str, int, str]:
    """A valid token whose signature contains '-' or '_', so the alphabet swap is a real variant."""
    base = int(time.time()) + 300
    for exp in range(base, base + 500):
        sig = _sign(OID, exp)
        if "-" in sig or "_" in sig:
            return OID, exp, sig
    raise AssertionError("no signature with - or _ found")


def variants(outreach_id: str, exp: int, sig: str) -> dict[str, str]:
    e = str(exp)
    last = _B64URL.index(sig[-1])
    out = {
        "exp leading zero": f"{outreach_id}.0{e}.{sig}",
        "exp two leading zeros": f"{outreach_id}.00{e}.{sig}",
        "exp plus sign": f"{outreach_id}.+{e}.{sig}",
        "exp leading space": f"{outreach_id}. {e}.{sig}",
        "exp trailing space": f"{outreach_id}.{e} .{sig}",
        "exp digit separators": f"{outreach_id}.{exp:_}.{sig}",
        "exp arabic-indic digits": f"{outreach_id}.{e.translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))}.{sig}",
        "exp fullwidth digits": f"{outreach_id}.{e.translate(str.maketrans('0123456789', '０１２３４５６７８９'))}.{sig}",
        "sig one pad": f"{outreach_id}.{e}.{sig}=",
        "sig two pads": f"{outreach_id}.{e}.{sig}==",
        "sig standard alphabet": f"{outreach_id}.{e}.{sig.replace('-', '+').replace('_', '/')}",
        "sig non-canonical last char": f"{outreach_id}.{e}.{sig[:-1]}{_B64URL[last | 1]}",
        "sig swapped case": f"{outreach_id}.{e}.{sig.swapcase()}",
        "id swapped case": f"{outreach_id.swapcase()}.{e}.{sig}",
        "trailing dot": f"{outreach_id}.{e}.{sig}.",
        "trailing ampersand": f"{outreach_id}.{e}.{sig}&",
        "trailing space": f"{outreach_id}.{e}.{sig} ",
        "trailing newline": f"{outreach_id}.{e}.{sig}\n",
        "leading space": f" {outreach_id}.{e}.{sig}",
        "leading dot": f".{outreach_id}.{e}.{sig}",
        "extra segment": f"{outreach_id}.{e}.{sig}.x",
    }
    genuine = f"{outreach_id}.{e}.{sig}"
    assert all(v != genuine for v in out.values())
    return out


OUTREACH, EXP, SIG = _genuine()
GENUINE = f"{OUTREACH}.{EXP}.{SIG}"
VARIANTS = variants(OUTREACH, EXP, SIG)


def _verify(token: str):
    with stubbed_runtime():
        from src.vobiz import verify_stream_token

        return verify_stream_token(token, SIGNING_KEY)


def test_the_genuine_token_verifies():
    assert _verify(GENUINE) == OUTREACH
    assert parse_stream_token(GENUINE) is not None


def test_there_are_enough_variants_to_mean_something():
    assert len(VARIANTS) >= 20


@pytest.mark.parametrize("name", sorted(VARIANTS))
def test_each_variant_is_rejected_or_refused_as_used(name):
    variant = VARIANTS[name]
    db = FakeAsyncFirestore()
    assert asyncio.run(consume_stream_token(db, GENUINE, OUTREACH)) is StreamUse.FIRST
    if _verify(variant) is None:
        return  # rejected by the parser / verifier
    assert asyncio.run(consume_stream_token(db, variant, OUTREACH)) is StreamUse.REPLAY, name


# A case change yields a DIFFERENT, well-formed token (ids and signatures are
# case-sensitive); the HMAC rejects it, which the gate above checks.
DIFFERENT_TOKENS = {"sig swapped case", "id swapped case"}


@pytest.mark.parametrize("name", sorted(set(VARIANTS) - DIFFERENT_TOKENS))
def test_the_parser_accepts_no_other_spelling_of_the_same_token(name):
    """Stronger than the gate requires: exactly one spelling of a token parses."""
    assert parse_stream_token(VARIANTS[name]) is None


@pytest.mark.parametrize("name", sorted(DIFFERENT_TOKENS))
def test_a_case_changed_token_fails_the_signature(name):
    assert _verify(VARIANTS[name]) is None


def test_no_variant_opens_a_second_stream_through_the_handler(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", OUTREACH): RECORD})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        loads = count_context_loads(main)

        async def go():
            first = await run_vobiz_path(main, db, outreach_id=OUTREACH, token=GENUINE)
            assert first.closed is None
            reads = len(loads)
            bots = len(RECORDER.instances_of("PipelineTask"))
            opened = []
            for name, variant in VARIANTS.items():
                ws = await run_vobiz_path(main, db, outreach_id=OUTREACH, token=variant)
                if ws.closed is None:
                    opened.append(name)
            return reads, bots, opened

        reads, bots, opened = asyncio.run(go())
        bots_after = len(RECORDER.instances_of("PipelineTask"))
    assert opened == [], f"variants that opened a second stream: {opened}"
    assert len(loads) == reads == 1, "only the genuine stream loaded call context"
    assert bots_after == bots == 1


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed here")
def test_a_token_minted_the_web_apps_way_is_accepted():
    """src/lib/vobiz/tokens.ts: `${outreachId}.${exp}.${hmac.digest('base64url')}`."""
    exp = int(time.time()) + 300
    script = (
        "const c=require('crypto');const [id,exp,key]=process.argv.slice(1);"
        "const sig=c.createHmac('sha256',key).update(`vobiz-call.${id}.${exp}`,'utf8').digest('base64url');"
        "process.stdout.write(`${id}.${exp}.${sig}`)"
    )
    token = subprocess.run(["node", "-e", script, OUTREACH, str(exp), SIGNING_KEY],
                           capture_output=True, text=True, check=True, timeout=30).stdout
    assert parse_stream_token(token) is not None
    assert _verify(token) == OUTREACH


def test_the_shared_token_format_fixture_is_exactly_what_the_engine_accepts():
    """The web side checks its minted tokens against this fixture on every PR."""
    import json
    from pathlib import Path

    from src import stream_tokens

    fixture = json.loads((Path(__file__).parent / "fixtures" / "stream_token_format.json").read_text(encoding="utf-8"))
    assert fixture["domain"] == stream_tokens.STREAM_DOMAIN
    assert fixture["outreach_id"] == stream_tokens._OUTREACH_ID.pattern
    assert fixture["exp"] == stream_tokens._EXPIRY.pattern
    assert fixture["signature"] == stream_tokens._SIGNATURE.pattern
