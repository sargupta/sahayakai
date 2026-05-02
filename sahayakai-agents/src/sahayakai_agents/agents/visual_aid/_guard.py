"""Behavioural guard for visual aid designer (Phase E.3).

Image bytes themselves don't go through the forbidden-phrase scan
(can't grep an image), but the metadata text (pedagogicalContext +
discussionSpark + subject) does.

Image data URI shape is also validated: the frontend only renders
`data:image/<mime>;base64,<body>` URIs; a model that returned a raw
base64 string or a url-form would break rendering.
"""
from __future__ import annotations

import re

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)

_DATA_URI_RE = re.compile(
    r"^data:image/(?P<subtype>[a-z0-9.+-]+)(?:;[^;,]+)*;base64,[A-Za-z0-9+/=]+$",
)


def assert_image_data_uri_shape(uri: str) -> None:
    """Validate the image data URI is well-shaped + has a sane MIME
    subtype. Defends downstream rendering."""
    assert _DATA_URI_RE.match(uri), (
        "imageDataUri must be data:image/<subtype>;base64,<body> form"
    )
    # Reject obvious non-image MIME subtypes that pass regex.
    valid_subtypes = {"png", "jpeg", "jpg", "webp", "gif", "svg+xml"}
    match = _DATA_URI_RE.match(uri)
    if match:
        subtype = match.group("subtype").lower()
        assert subtype in valid_subtypes, (
            f"imageDataUri MIME subtype {subtype!r} not in known image set "
            f"({', '.join(sorted(valid_subtypes))})"
        )


def assert_visual_aid_response_rules(
    *,
    image_data_uri: str,
    pedagogical_context: str,
    discussion_spark: str,
    subject: str,
    language: str,
) -> None:
    """Composite assertion. Three checks:
    - image data URI shape
    - forbidden-phrase scan across pedagogicalContext + discussionSpark
      (subject is short / typically one word so we scan it too)
    - script-match on pedagogicalContext + discussionSpark (subject is
      kept in English per the prompt; not script-checked)
    """
    assert_image_data_uri_shape(image_data_uri)
    text_to_scan = " ".join([pedagogical_context, discussion_spark, subject])
    assert_no_forbidden_phrases(text_to_scan)
    # Subject stays in English by prompt design — only check the prose
    # surfaces against the user's language.
    prose = " ".join([pedagogical_context, discussion_spark])
    assert_script_matches_language(prose, language)


__all__ = [
    "assert_image_data_uri_shape",
    "assert_visual_aid_response_rules",
]
