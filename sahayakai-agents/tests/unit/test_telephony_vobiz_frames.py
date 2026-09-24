"""Frame protocol. The assertions name the Twilio-shaped mistakes explicitly,
because that is the form the next regression will take."""

from __future__ import annotations

import base64
import json

from sahayakai_agents.telephony.vobiz_frames import (
    InboundKind,
    build_clear_audio,
    build_play_audio,
    parse_inbound,
)


class TestParsing:
    def test_reads_the_stream_id_from_the_top_level(self) -> None:
        f = parse_inbound(json.dumps({"event": "start", "streamId": "s1"}))
        assert f.kind is InboundKind.START and f.stream_id == "s1"

    def test_reads_the_stream_id_nested_under_start(self) -> None:
        f = parse_inbound(json.dumps({"event": "start", "start": {"streamId": "s2"}}))
        assert f.kind is InboundKind.START and f.stream_id == "s2"

    def test_decodes_media_payloads(self) -> None:
        f = parse_inbound(json.dumps({"event": "media", "media": {"payload": base64.b64encode(b"\xff\x7f").decode()}}))
        assert f.kind is InboundKind.MEDIA and f.audio == b"\xff\x7f"

    def test_treats_an_empty_media_frame_as_no_audio_not_an_error(self) -> None:
        f = parse_inbound(json.dumps({"event": "media", "media": {}}))
        assert f.kind is InboundKind.MEDIA and f.audio == b""

    def test_recognises_stop(self) -> None:
        assert parse_inbound(json.dumps({"event": "stop"})).kind is InboundKind.STOP

    def test_ignores_an_unknown_event_rather_than_dropping_the_call(self) -> None:
        # Carriers add events over time; an unknown one must not be fatal.
        assert parse_inbound(json.dumps({"event": "somethingNew"})).kind is InboundKind.UNKNOWN

    def test_never_raises_on_junk(self) -> None:
        for junk in ("", "not json", "[]", "null", b"\x00\x01"):
            assert parse_inbound(junk).kind in (InboundKind.INVALID, InboundKind.UNKNOWN)

    def test_reports_undecodable_audio_as_invalid(self) -> None:
        f = parse_inbound(json.dumps({"event": "media", "media": {"payload": "!!!not base64!!!"}}))
        assert f.kind is InboundKind.INVALID


class TestOutbound:
    def test_play_audio_uses_the_vobiz_event_name_and_key(self) -> None:
        frame = json.loads(build_play_audio("s1", b"\xff" * 160))
        # Twilio's names are "media" and "streamSid"; either one here is a
        # silent no-op on the carrier and the parent hears nothing at all.
        assert frame["event"] == "playAudio"
        assert "streamId" in frame and "streamSid" not in frame
        assert base64.b64decode(frame["media"]["payload"]) == b"\xff" * 160

    def test_play_audio_declares_the_format_it_is_sending(self) -> None:
        frame = json.loads(build_play_audio("s1", b"\xff"))
        assert frame["media"]["contentType"] == "audio/x-mulaw"
        assert frame["media"]["sampleRate"] == 8000

    def test_clear_audio_uses_the_vobiz_event_name(self) -> None:
        frame = json.loads(build_clear_audio("s1"))
        assert frame["event"] == "clearAudio"  # Twilio calls this "clear"
        assert frame["streamId"] == "s1"
