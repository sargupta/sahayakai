"""Behavioural guard for avatar generator agent (Phase F.2).

Avatar generation only returns an image (no text). The guard checks:

- The image data URI is well-shaped: `data:image/<subtype>;base64,<body>`.
- The MIME subtype is a known image type.

There is no language / forbidden-phrase scan — the image bytes have
no scannable text surface, and the request has no narrative output.
"""
from __future__ import annotations

import re

_DATA_URI_RE = re.compile(
    r"^data:image/(?P<subtype>[a-z0-9.+-]+)(?:;[^;,]+)*;base64,[A-Za-z0-9+/=]+$",
)


def assert_image_data_uri_shape(uri: str) -> None:
    """Validate the image data URI is well-shaped + has a known MIME
    subtype. Defends downstream rendering."""
    assert _DATA_URI_RE.match(uri), (
        "imageDataUri must be data:image/<subtype>;base64,<body> form"
    )
    valid_subtypes = {"png", "jpeg", "jpg", "webp", "gif"}
    match = _DATA_URI_RE.match(uri)
    if match:
        subtype = match.group("subtype").lower()
        assert subtype in valid_subtypes, (
            f"imageDataUri MIME subtype {subtype!r} not in known image set "
            f"({', '.join(sorted(valid_subtypes))})"
        )


def assert_avatar_response_rules(*, image_data_uri: str) -> None:
    """Composite assertion. Just the image data URI shape check."""
    assert_image_data_uri_shape(image_data_uri)


__all__ = [
    "assert_avatar_response_rules",
    "assert_image_data_uri_shape",
]
