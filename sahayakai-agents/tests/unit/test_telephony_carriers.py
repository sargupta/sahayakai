"""Plivo and Exotel on the Riya bridge: frames, chunking, token isolation, hangup.

Each test pins a property that, if wrong, produces a call that connects and then sits in
silence (or one that never ends) with nothing in any log to say why.
"""

from __future__ import annotations

import base64
import json
import sys
from array import array

import pytest

from sahayakai_agents.telephony import carriers
from sahayakai_agents.telephony.audio import pcm16_to_ulaw, ulaw_to_pcm16
from sahayakai_agents.telephony.carriers import CARRIERS, PlivoStyleCodec, hangup_call, new_codec
from sahayakai_agents.telephony.exotel_frames import (
    EXOTEL_CHUNK_MULTIPLE,
    EXOTEL_MIN_CHUNK_BYTES,
    ExotelCodec,
    parse_exotel_inbound,
)
from sahayakai_agents.telephony.tokens import VobizDomain
from sahayakai_agents.telephony.vobiz_frames import InboundKind, parse_inbound

pytestmark = pytest.mark.unit

FRAME = bytes(range(0, 160))  # one 20 ms mu-law frame


def _pcm_le(samples: list[int]) -> bytes:
    a = array("h", samples)
    if sys.byteorder == "big":
        a.byteswap()
    return a.tobytes()


class TestExotelInbound:
    def test_start_carries_stream_and_call_ids(self) -> None:
        f = parse_exotel_inbound(json.dumps({
            "event": "start", "sequence_number": 1, "stream_sid": "S1",
            "start": {"stream_sid": "S1", "call_sid": "C9", "media_format": {"encoding": "audio/x-raw", "sample_rate": "8000"}},
        }))
        assert f.kind is InboundKind.START
        assert f.stream_id == "S1"
        assert f.call_id == "C9"
        assert "audio/x-raw" in (f.media_format or "")

    def test_media_pcm16_le_is_converted_to_the_bridges_mulaw(self) -> None:
        samples = [0, 1000, -1000, 32000, -32000] * 32  # 160 samples = 20 ms
        payload = base64.b64encode(_pcm_le(samples)).decode()
        f = parse_exotel_inbound(json.dumps({"event": "media", "stream_sid": "S1", "media": {"chunk": 1, "timestamp": "0", "payload": payload}}))
        assert f.kind is InboundKind.MEDIA
        assert f.audio == pcm16_to_ulaw(array("h", samples))
        assert len(f.audio or b"") == 160  # one mu-law byte per sample: same timing as Vobiz frames

    def test_stop_mark_and_unknown_events(self) -> None:
        assert parse_exotel_inbound('{"event":"stop","stream_sid":"S1","stop":{"reason":"callended"}}').kind is InboundKind.STOP
        mark = parse_exotel_inbound('{"event":"mark","stream_sid":"S1","mark":{"name":"m1"}}')
        assert mark.kind is InboundKind.PLAYED and mark.name == "m1"
        assert parse_exotel_inbound('{"event":"connected"}').kind is InboundKind.UNKNOWN
        assert parse_exotel_inbound('{"event":"dtmf","dtmf":{"digit":"1"}}').kind is InboundKind.UNKNOWN
        assert parse_exotel_inbound("not json").kind is InboundKind.INVALID


class TestExotelOutbound:
    def test_holds_frames_until_a_full_exotel_chunk(self) -> None:
        codec = ExotelCodec()
        frames_per_chunk = EXOTEL_MIN_CHUNK_BYTES // (len(FRAME) * 2)  # 10 x 20 ms
        out = [codec.play("S1", FRAME) for _ in range(frames_per_chunk)]
        assert all(m is None for m in out[:-1])
        msg = json.loads(out[-1] or "{}")
        assert msg["event"] == "media" and msg["stream_sid"] == "S1"
        pcm = base64.b64decode(msg["media"]["payload"])
        assert len(pcm) >= EXOTEL_MIN_CHUNK_BYTES
        assert len(pcm) % EXOTEL_CHUNK_MULTIPLE == 0

    def test_payload_is_the_frames_decoded_to_pcm16_le(self) -> None:
        codec = ExotelCodec()
        msg = None
        for _ in range(10):
            msg = codec.play("S1", FRAME) or msg
        pcm = base64.b64decode(json.loads(msg or "{}")["media"]["payload"])
        expected = ulaw_to_pcm16(FRAME * 10)
        got = array("h")
        got.frombytes(pcm)
        if sys.byteorder == "big":
            got.byteswap()
        assert list(got) == list(expected)

    def test_flush_pads_the_tail_to_a_valid_chunk(self) -> None:
        codec = ExotelCodec()
        assert codec.play("S1", FRAME) is None
        msg = json.loads(codec.flush("S1") or "{}")
        pcm = base64.b64decode(msg["media"]["payload"])
        assert len(pcm) == EXOTEL_MIN_CHUNK_BYTES
        assert codec.flush("S1") is None  # nothing left

    def test_clear_drops_held_audio_and_tells_exotel(self) -> None:
        codec = ExotelCodec()
        codec.play("S1", FRAME)
        assert json.loads(codec.clear("S1")) == {"event": "clear", "stream_sid": "S1"}
        assert codec.flush("S1") is None


class TestPlivoFrames:
    def test_plivo_start_shape_and_call_id(self) -> None:
        f = parse_inbound(json.dumps({
            "event": "start", "sequenceNumber": 0,
            "start": {"callId": "abc-uuid", "streamId": "st-1", "accountId": "MA1", "tracks": ["inbound"],
                      "mediaFormat": {"encoding": "audio/x-mulaw", "sampleRate": 8000}},
        }))
        assert f.kind is InboundKind.START and f.stream_id == "st-1" and f.call_id == "abc-uuid"

    def test_plivo_played_alias_is_a_checkpoint(self) -> None:
        assert parse_inbound('{"event":"played","streamId":"st-1","name":"x"}').kind is InboundKind.PLAYED

    def test_plivo_codec_batches_100ms_vobiz_unchanged(self) -> None:
        codec = new_codec(CARRIERS["plivo"])
        assert isinstance(codec, PlivoStyleCodec)
        # Plivo: 100 ms per playAudio (5 frames), so tunnel jitter cannot break words up.
        out = [codec.play("st-1", FRAME) for _ in range(5)]
        assert out[:4] == [None] * 4
        msg = json.loads(out[4] or "{}")
        assert msg["event"] == "playAudio" and msg["streamId"] == "st-1"
        assert msg["media"]["contentType"] == "audio/x-mulaw" and msg["media"]["sampleRate"] == 8000
        assert len(base64.b64decode(msg["media"]["payload"])) == 800
        assert codec.play("st-1", FRAME) is None
        assert len(base64.b64decode(json.loads(codec.flush("st-1") or "{}")["media"]["payload"])) == 160
        assert codec.flush("st-1") is None
        vobiz = new_codec(CARRIERS["vobiz"])  # Vobiz unchanged: one 20 ms frame per message
        assert json.loads(vobiz.play("s", FRAME) or "{}")["event"] == "playAudio"
        assert json.loads(codec.clear("st-1")) == {"event": "clearAudio", "streamId": "st-1"}


class TestCarrierIsolation:
    def test_every_carrier_has_its_own_stream_domain(self) -> None:
        domains = [c.stream_domain for c in CARRIERS.values()]
        assert len(set(domains)) == len(domains)
        assert CARRIERS["vobiz"].stream_domain is VobizDomain.STREAM  # unchanged for Vobiz
        assert CARRIERS["plivo"].stream_domain.value == "plivo-call"
        assert CARRIERS["exotel"].stream_domain.value == "exotel-call"

    def test_a_token_for_one_carrier_never_opens_another(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import hashlib
        import hmac
        import time

        from sahayakai_agents.telephony import tokens

        key = "k" * 64

        class _S:
            class request_signing_key:  # noqa: N801 — mimics SecretStr
                @staticmethod
                def get_secret_value() -> str:
                    return key

        monkeypatch.setattr(tokens, "get_settings", lambda: _S)
        exp = int(time.time()) + 60
        ref = "sampark~org1~" + "a" * 32
        msg = tokens.vobiz_token_message(VobizDomain.PLIVO_STREAM, ref, exp).encode()
        sig = base64.urlsafe_b64encode(hmac.new(key.encode(), msg, hashlib.sha256).digest()).rstrip(b"=").decode()
        token = f"{ref}.{exp}.{sig}"
        assert tokens.verify_vobiz_token(VobizDomain.PLIVO_STREAM, token) == ref
        assert tokens.verify_vobiz_token(VobizDomain.STREAM, token) is None
        assert tokens.verify_vobiz_token(VobizDomain.EXOTEL_STREAM, token) is None


class TestExotelAdmissionToken:
    """Exotel drops the stream URL's query string and echoes its pairs back in the first frames."""

    TOKEN = "sampark~sargvision-local~" + "a" * 32 + ".1795504854." + "fj9sUBDe790jReftkIuhR60v1ILkq74CqqkjKVB3Iuk"

    def test_found_in_start_custom_parameters_object(self) -> None:
        from sahayakai_agents.telephony.router import exotel_token_from_frame

        raw = json.dumps({"event": "start", "start": {"stream_sid": "S", "call_sid": "C", "custom_parameters": {"t": self.TOKEN}}})
        assert exotel_token_from_frame(raw) == self.TOKEN

    def test_found_percent_encoded_or_as_a_string(self) -> None:
        from urllib.parse import quote

        from sahayakai_agents.telephony.router import exotel_token_from_frame

        raw = json.dumps({"event": "connected", "CustomParameters": f"t={quote(self.TOKEN, safe='')}"})
        assert exotel_token_from_frame(raw) == self.TOKEN

    def test_absent_or_malformed_is_none(self) -> None:
        from sahayakai_agents.telephony.router import exotel_token_from_frame

        assert exotel_token_from_frame('{"event":"connected"}') is None
        assert exotel_token_from_frame('{"event":"start","start":{"custom_parameters":{"t":"sampark~x~short.1.sig"}}}') is None


class TestCarrierFrames:
    """A carrier may send its JSON as text OR binary WebSocket frames; both must reach the parser."""

    class _Ws:
        def __init__(self, messages: list[dict]) -> None:
            self.messages = messages

        async def receive(self) -> dict:
            return self.messages.pop(0)

    @pytest.mark.asyncio
    async def test_text_and_binary_frames_read_alike(self) -> None:
        from sahayakai_agents.telephony.router import _carrier_frame

        start = json.dumps({"event": "start", "start": {"streamId": "st-1", "callId": "c-1"}})
        ws = self._Ws([{"type": "websocket.receive", "text": start}, {"type": "websocket.receive", "bytes": start.encode()}])
        for _ in range(2):
            f = parse_inbound(await _carrier_frame(ws))  # type: ignore[arg-type]
            assert f.kind is InboundKind.START and f.stream_id == "st-1" and f.call_id == "c-1"

    @pytest.mark.asyncio
    async def test_disconnect_raises_like_receive_text(self) -> None:
        from starlette.websockets import WebSocketDisconnect

        from sahayakai_agents.telephony.router import _carrier_frame

        with pytest.raises(WebSocketDisconnect):
            await _carrier_frame(self._Ws([{"type": "websocket.disconnect", "code": 1000}]))  # type: ignore[arg-type]


class TestHangup:
    @pytest.mark.asyncio
    async def test_exotel_hangup_makes_no_request(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import httpx

        def _boom(*_a: object, **_k: object) -> None:
            raise AssertionError("no REST call for Exotel")

        monkeypatch.setattr(httpx, "AsyncClient", _boom)
        await hangup_call(CARRIERS["exotel"], "C9")

    @pytest.mark.asyncio
    async def test_plivo_hangup_is_a_basic_auth_delete_of_that_call(self, monkeypatch: pytest.MonkeyPatch) -> None:
        import httpx

        seen: dict[str, object] = {}

        class _Client:
            def __init__(self, **_k: object) -> None: ...
            async def __aenter__(self) -> _Client:
                return self
            async def __aexit__(self, *_a: object) -> None: ...
            async def delete(self, url: str, auth: tuple[str, str]) -> None:
                seen["url"], seen["auth"] = url, auth

        monkeypatch.setattr(httpx, "AsyncClient", _Client)
        monkeypatch.setenv("PLIVO_AUTH_ID", "MAXXXXXXXXXXXXXXXXXX")
        monkeypatch.setenv("PLIVO_AUTH_TOKEN", "tok")
        monkeypatch.delenv("PLIVO_BASE_URL", raising=False)
        await hangup_call(CARRIERS["plivo"], "call-uuid-1")
        assert seen["url"] == "https://api.plivo.com/v1/Account/MAXXXXXXXXXXXXXXXXXX/Call/call-uuid-1/"
        assert seen["auth"] == ("MAXXXXXXXXXXXXXXXXXX", "tok")

    @pytest.mark.asyncio
    async def test_plivo_hangup_without_credentials_is_silent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PLIVO_AUTH_ID", raising=False)
        monkeypatch.delenv("PLIVO_AUTH_TOKEN", raising=False)
        await hangup_call(carriers.CARRIERS["plivo"], "x")
