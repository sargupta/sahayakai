"""G.711 mu-law codec and the resampling the telephony bridge needs.

WHY THIS IS HAND-WRITTEN

The obvious implementation is `audioop`, which is what the Suraksha agent uses.
It is deprecated and **removed in Python 3.13**; this package pins
`>=3.12,<3.13`, so adopting it would plant a landmine that detonates on the next
interpreter bump, in the audio path of a live phone call. `numpy` is not a
dependency of this service and pulling one in for four functions is a worse
trade. Everything here is stdlib and precomputed at import.

THE TWO CONVERSIONS

A phone leg and a Live model do not agree on anything about audio:

    Vobiz  ->  mu-law, 8 kHz   ->  Live wants  PCM16, 16 kHz
    Live   ->  PCM16, 24 kHz   ->  Vobiz wants mu-law, 8 kHz

The downsample is the one with a trap in it. Decimating 24 kHz to 8 kHz throws
away two of every three samples, and any energy above 4 kHz in the discarded
band does not vanish — it aliases back into the audible range as spurious tones.
The Suraksha build hit exactly this and heard it as a metallic warble behind the
voice. So `pcm24k_to_ulaw8k` low-passes first and decimates second, which is the
whole reason it is not a three-line function.
"""

from __future__ import annotations

import math
from array import array

__all__ = [
    "ULAW_SILENCE",
    "ulaw_to_pcm16",
    "pcm16_to_ulaw",
    "upsample_8k_to_16k",
    "downsample_24k_to_8k",
    "ulaw8k_to_pcm16k",
    "pcm24k_to_ulaw8k",
]

_BIAS = 0x84
_CLIP = 32635

#: A mu-law byte that decodes to (near) zero. Used to pad, never to pause —
#: telephony carriers expect a continuous frame cadence, and a gap in the
#: stream is heard as a click rather than as silence.
ULAW_SILENCE = 0xFF


def _build_decode_table() -> list[int]:
    """The classic G.711 expansion, precomputed for all 256 byte values."""
    table = []
    for byte in range(256):
        u = ~byte & 0xFF
        magnitude = ((u & 0x0F) << 3) + _BIAS
        magnitude <<= (u & 0x70) >> 4
        table.append(_BIAS - magnitude if (u & 0x80) else magnitude - _BIAS)
    return table


_DECODE = _build_decode_table()

# G.711 encodes from a **14-bit** magnitude, not a 16-bit one. The first version
# here applied the 16-bit variant (CLIP 32635, BIAS 0x84, mantissa shift
# exponent+3) and disagreed with the stdlib on 32,548 of the 65,536 possible
# samples — every disagreement one step in the mantissa, which on a call is a
# permanent quantisation error rather than an obvious break. The oracle test
# against `audioop` is what caught it; the constants below are the real ones.
_CLIP_14 = 8159
_BIAS_14 = _BIAS >> 2  # 33

#: Upper bound of each mu-law segment, in the 14-bit domain.
_SEGMENT_END = (0x3F, 0x7F, 0xFF, 0x1FF, 0x3FF, 0x7FF, 0xFFF, 0x1FFF)


def _segment(value: int) -> int:
    """Which mu-law segment a biased 14-bit magnitude falls in."""
    for index, upper in enumerate(_SEGMENT_END):
        if value <= upper:
            return index
    return len(_SEGMENT_END)


def _encode_sample(sample: int) -> int:
    """One PCM16 sample -> one mu-law byte (G.711, via the 14-bit domain)."""
    pcm = sample >> 2  # 16-bit linear down to the 14-bit domain mu-law is defined on
    if pcm < 0:
        pcm = -pcm
        mask = 0x7F  # mu-law inverts all bits; negatives keep the sign bit clear
    else:
        mask = 0xFF
    pcm = min(pcm, _CLIP_14)
    pcm += _BIAS_14
    seg = _segment(pcm)
    if seg >= len(_SEGMENT_END):
        return 0x7F ^ mask
    return (((seg << 4) | ((pcm >> (seg + 1)) & 0x0F)) & 0xFF) ^ mask


_ENCODE = [_encode_sample(s) for s in range(-32768, 32768)]


def ulaw_to_pcm16(payload: bytes) -> array[int]:
    """Expand mu-law bytes into signed 16-bit samples."""
    out = array("h", bytes(2 * len(payload)))
    for i, byte in enumerate(payload):
        out[i] = _DECODE[byte]
    return out


def pcm16_to_ulaw(samples: array[int]) -> bytes:
    """Compress signed 16-bit samples into mu-law bytes."""
    # Offset indexing into the precomputed table: the encode path runs on every
    # frame the model speaks, so it must not do arithmetic per sample.
    return bytes(_ENCODE[s + 32768] for s in samples)


def upsample_8k_to_16k(samples: array[int]) -> array[int]:
    """Double the rate by linear interpolation.

    Interpolating rather than repeating each sample matters: sample-and-hold
    introduces a staircase whose harmonics sit right in the band the recogniser
    listens to. The final sample is held because there is no next sample to
    interpolate towards; at 8 kHz that is one eighth of a millisecond.
    """
    n = len(samples)
    out = array("h", bytes(4 * n))
    for i in range(n):
        current = samples[i]
        nxt = samples[i + 1] if i + 1 < n else current
        out[2 * i] = current
        out[2 * i + 1] = (current + nxt) // 2
    return out


def _build_lowpass(taps: int, cutoff_hz: float, sample_rate: int) -> list[float]:
    """Windowed-sinc low-pass, normalised to unity gain at DC.

    Cutoff sits below the 4 kHz Nyquist of the 8 kHz output so the transition
    band has somewhere to live; a filter that is flat to exactly Nyquist still
    passes the energy that aliases.
    """
    fc = cutoff_hz / sample_rate
    mid = (taps - 1) / 2
    kernel = []
    for i in range(taps):
        x = i - mid
        sinc = 2 * fc if x == 0 else math.sin(2 * math.pi * fc * x) / (math.pi * x)
        # Hamming window: cheap, and its sidelobes are well below the level
        # where aliasing becomes audible on a phone.
        window = 0.54 - 0.46 * math.cos(2 * math.pi * i / (taps - 1))
        kernel.append(sinc * window)
    total = sum(kernel)
    return [k / total for k in kernel]


_DECIMATE_TAPS = 31
_LOWPASS_24K = _build_lowpass(_DECIMATE_TAPS, 3400.0, 24000)


def downsample_24k_to_8k(
    samples: array[int], tail: array[int] | None = None
) -> tuple[array[int], array[int]]:
    """Low-pass then take every third sample.

    `tail` carries the last taps-1 samples of the previous chunk back in, so the
    filter does not restart at zero on every chunk. Without it each chunk
    boundary gets its own little fade-in and the speech acquires a periodic
    stutter at the chunk rate — audible, and maddening to diagnose, because each
    chunk sounds correct in isolation.

    Returns the decimated samples and the new tail to pass to the next call.
    """
    history = tail if tail is not None else array("h", bytes(2 * (_DECIMATE_TAPS - 1)))
    buf = array("h", history)
    buf.extend(samples)

    out = array("h")
    kernel = _LOWPASS_24K
    # Start where a full window is available, and step by 3 to decimate.
    for centre in range(_DECIMATE_TAPS - 1, len(buf), 3):
        acc = 0.0
        base = centre - (_DECIMATE_TAPS - 1)
        for k in range(_DECIMATE_TAPS):
            acc += buf[base + k] * kernel[k]
        value = int(acc)
        # Clamp: the filter can overshoot slightly on transients, and wrapping a
        # 16-bit sample turns an overshoot into a loud click.
        out.append(32767 if value > 32767 else (-32768 if value < -32768 else value))

    new_tail = buf[-(_DECIMATE_TAPS - 1):] if len(buf) >= _DECIMATE_TAPS - 1 else buf
    return out, array("h", new_tail)


def ulaw8k_to_pcm16k(payload: bytes) -> bytes:
    """Carrier inbound -> what the Live model expects."""
    return upsample_8k_to_16k(ulaw_to_pcm16(payload)).tobytes()


def pcm24k_to_ulaw8k(
    pcm: bytes, tail: array[int] | None = None
) -> tuple[bytes, array[int]]:
    """Live outbound -> what the carrier expects, without aliasing."""
    samples = array("h")
    # An odd trailing byte would raise; a short read on the socket is not worth
    # dropping a frame of speech over, so the dangling byte is discarded.
    samples.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
    decimated, new_tail = downsample_24k_to_8k(samples, tail)
    return pcm16_to_ulaw(decimated), new_tail
