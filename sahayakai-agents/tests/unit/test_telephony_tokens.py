"""Class gate (Python half): purpose scoping holds across the language boundary.

The web runtime mints these tokens in TypeScript and this service verifies them
in Python. Two separate HMAC implementations agreeing is not something to assume
— so these tests mint with the *documented wire contract* rather than with the
verifier's own helper wherever that would be circular, and then assert the
isolation property in every direction.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time

import pytest

from sahayakai_agents.telephony.tokens import (
    VobizDomain,
    verify_vobiz_token,
    vobiz_token_message,
)

KEY = "k" * 64


@pytest.fixture(autouse=True)
def _signing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pin the signing key without touching real settings or Secret Manager."""

    class _Secret:
        @staticmethod
        def get_secret_value() -> str:
            return KEY

    class _Settings:
        request_signing_key = _Secret()

    def _get_settings() -> type[_Settings]:
        return _Settings

    monkeypatch.setattr("sahayakai_agents.telephony.tokens.get_settings", _get_settings)


def _sign(message: str) -> str:
    return (
        base64.urlsafe_b64encode(hmac.new(KEY.encode(), message.encode(), hashlib.sha256).digest())
        .rstrip(b"=")
        .decode()
    )


def _mint(domain: VobizDomain, outreach_id: str, ttl: int = 300) -> str:
    """Mint exactly the way the TypeScript side documents, not via the verifier."""
    exp = int(time.time()) + ttl
    return f"{outreach_id}.{exp}.{_sign(f'{domain.value}.{outreach_id}.{exp}')}"


ALL = list(VobizDomain)


class TestPurposeScoping:
    def test_accepts_a_token_for_its_own_domain(self) -> None:
        for domain in ALL:
            assert verify_vobiz_token(domain, _mint(domain, "outreach123")) == "outreach123"

    def test_refuses_a_token_presented_to_any_other_domain(self) -> None:
        # Every ordered pair, which is the class the gate exists to protect.
        for minted in ALL:
            token = _mint(minted, "outreach123")
            for presented in ALL:
                if presented is minted:
                    continue
                assert verify_vobiz_token(presented, token) is None

    def test_domain_tags_are_distinct(self) -> None:
        assert len({d.value for d in ALL}) == len(ALL)


class TestCrossSurfaceIsolation:
    def test_a_web_voice_token_cannot_open_a_telephony_endpoint(self) -> None:
        # The app's own stream token signs "<uid>.<exp>" with no domain tag.
        exp = int(time.time()) + 120
        web_token = f"firebaseUid.{exp}.{_sign(f'firebaseUid.{exp}')}"
        for domain in ALL:
            assert verify_vobiz_token(domain, web_token) is None

    def test_a_telephony_token_does_not_satisfy_the_web_scheme(self) -> None:
        for domain in ALL:
            token = _mint(domain, "outreach123")
            outreach_id, exp_raw, sig = token.split(".")
            # What `verify_stream_token` would compute for the same string.
            assert _sign(f"{outreach_id}.{exp_raw}") != sig


class TestHygiene:
    def test_rejects_an_expired_token(self) -> None:
        assert verify_vobiz_token(VobizDomain.STREAM, _mint(VobizDomain.STREAM, "o", ttl=-1)) is None

    def test_rejects_a_tampered_signature(self) -> None:
        token = _mint(VobizDomain.STREAM, "outreach123")
        outreach_id, exp, _ = token.split(".")
        assert verify_vobiz_token(VobizDomain.STREAM, f"{outreach_id}.{exp}.nope") is None

    def test_rejects_a_token_minted_for_another_record(self) -> None:
        token = _mint(VobizDomain.STREAM, "outreachA")
        assert verify_vobiz_token(VobizDomain.STREAM, token.replace("outreachA", "outreachB")) is None

    def test_rejects_malformed_input_without_raising(self) -> None:
        for bad in (None, "", "nodots", "a.b.c.d", "a.notanint.sig", ".100.sig"):
            assert verify_vobiz_token(VobizDomain.STREAM, bad) is None

    def test_message_format_matches_the_documented_contract(self) -> None:
        # Pins the exact string both languages must sign.
        assert vobiz_token_message(VobizDomain.STREAM, "abc", 1800000000) == "vobiz-call.abc.1800000000"
        assert vobiz_token_message(VobizDomain.ANSWER, "abc", 1800000000) == "vobiz-answer.abc.1800000000"
        assert vobiz_token_message(VobizDomain.STATUS, "abc", 1800000000) == "vobiz-status.abc.1800000000"


# Golden vectors: tokens produced by the TypeScript minter
# (sahayakai-main/src/lib/vobiz/tokens.ts) for key "k"*64, outreach id
# "outreach123" and exp 1800000000.
#
# Two independent HMAC implementations agreeing is an ASSUMPTION unless
# something pins it. These bytes are that pin, and the mirror-image assertion
# lives in the web runtime's own test file, so a change to either side that
# breaks the wire contract fails a test in BOTH repositories rather than
# silently rejecting every real call at 3am.
GOLDEN = {
    VobizDomain.ANSWER: "outreach123.1800000000.ask7khW1H9Lo-JxtHCCwDVACvBzN3MFU32ZRNvcnsJA",
    VobizDomain.STREAM: "outreach123.1800000000.KmcHAMBzSYe3TprTBG9q2ze6sDkYyNcwoJPLz4HEZyY",
    VobizDomain.STATUS: "outreach123.1800000000.tKiScWp9XnJMggkzYDUQgYyoFT6brSbtdJvQojPJ8c0",
}


class TestCrossLanguageContract:
    def test_verifies_tokens_minted_by_the_typescript_runtime(self) -> None:
        for domain, token in GOLDEN.items():
            assert verify_vobiz_token(domain, token) == "outreach123"

    def test_golden_vectors_remain_domain_isolated(self) -> None:
        # The same real tokens, not synthesised ones, must still refuse to cross.
        for minted, token in GOLDEN.items():
            for presented in ALL:
                if presented is minted:
                    continue
                assert verify_vobiz_token(presented, token) is None
