"""
Post-call analysis — extracts structured insights from completed transcripts.

Uses Gemini to analyze the conversation and extract:
  - Parent sentiment, concerns, commitments
  - Communication style (defensive, cooperative, emotional, etc.)
  - What approach worked (empathy, practical suggestion, reassurance)
  - Topics raised (fees, health, family, work, etc.)
  - Structured concerns with category and severity
  - Actionable follow-ups with owner and priority
  - Agent quality assessment

Runs asynchronously after call ends — doesn't block the call pipeline.
Output feeds into call_store.py tables: call_insights, parent_concerns, follow_ups.
"""

import asyncio
import json
import os

from loguru import logger

try:
    from google import genai
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False
    logger.warning("google-genai not available — call analysis disabled")


# Every post-call analysis gets at most this long. google-genai sets no
# client timeout by default, and the analysis runs after the call: the
# transcript, the summary and the handler's Cloud Run slot wait on it
# (final-0b #5). Both the request itself and each caller's await are bounded.
ANALYSIS_TIMEOUT_SECONDS = 20.0


async def bounded_analysis(analysis):
    """Await `analysis` (an analyze_call coroutine) for at most ANALYSIS_TIMEOUT_SECONDS.

    A timeout is reported and gives None, like any other failed analysis.
    """
    try:
        return await asyncio.wait_for(analysis, ANALYSIS_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.error(f"Post-call analysis gave no answer within {ANALYSIS_TIMEOUT_SECONDS:.0f}s; going on without it")
        return None


_ANALYSIS_PROMPT = """Analyze this parent-teacher phone call transcript. The teacher called the parent about a student.

Call context:
- Student: {student_name}, {class_name}
- Reason for call: {reason}
- Teacher: {teacher_name}, {school_name}
- Parent's language: {parent_language}

Transcript:
{transcript_text}

Respond ONLY with a JSON object (no markdown, no code fences):
{{
  "parentSentiment": "<cooperative|concerned|grateful|upset|indifferent|confused>",
  "callQuality": "<productive|brief|difficult|unanswered>",
  "parentResponse": "<1-2 sentence summary of what the parent said/felt>",
  "communicationStyle": "<defensive|cooperative|emotional|brief|talkative|aggressive>",
  "topicsRaised": ["<fees|health|family|behavior|academics|logistics|other>"],
  "guidanceGiven": ["<advice/suggestion given>"],
  "parentCommitments": ["<what parent agreed to do>"],
  "effectiveApproach": "<empathy|practical_suggestion|reassurance|listening|de_escalation|none>",
  "approachDetails": "<what specifically worked or didn't work in this call>",
  "agentStayedInCharacter": <true|false>,
  "conversationNatural": <true|false>,
  "parentEngaged": <true|false>,
  "concerns": [
    {{
      "text": "<specific concern in parent's words>",
      "category": "<fees|health|academics|behavior|logistics|family|other>",
      "severity": "<low|medium|high|critical>"
    }}
  ],
  "followUps": [
    {{
      "description": "<specific action to take>",
      "owner": "<teacher|school|parent>",
      "priority": "<low|medium|high|urgent>"
    }}
  ],
  "optOut": {{
    "requested": <true ONLY if the parent clearly asked the school to stop calling them altogether; false for 'not now', 'call later', 'I am busy' or a preferred time>,
    "quote": "<the parent's exact words asking not to be called again, copied character for character from a Parent line above, or empty>",
    "quoteInEnglish": "<that quote translated into English, or empty>"{flagged_field}
  }}
}}"""

# Asked only when the call itself noticed a possible stop: the teacher's note
# quotes those words, with this translation.
_FLAGGED_FIELD = (
    ',\n    "flaggedInEnglish": "<English translation of these words the parent said: {words}>"'
)


async def analyze_call(
    call_context: dict,
    transcript: list[dict],
    api_key: str | None = None,
    backend=None,
    flagged_words: str | None = None,
) -> dict | None:
    """Analyze a completed call transcript and return structured insights.

    Returns dict with keys matching call_insights + concerns + followUps.
    `backend` is a gemini_backend.GeminiBackend; Vertex needs no API key.
    Without one (or with the AI Studio backend) the key is used as before.
    `flagged_words`: the parent's words the call noticed as a possible stop;
    the result's optOut.flaggedInEnglish then carries their translation.
    """
    if not _HAS_GENAI:
        logger.warning("Skipping call analysis — google-genai not installed")
        return None

    if not transcript or len(transcript) < 2:
        logger.debug("Skipping analysis — transcript too short")
        return None

    use_vertex = backend is not None and getattr(backend, "is_vertex", False)
    key = api_key or os.environ.get("GOOGLE_GENAI_API_KEY", "")
    if not key and not use_vertex:
        logger.warning("Skipping call analysis — no API key")
        return None

    # Format transcript
    transcript_lines = []
    for turn in transcript:
        role = "Teacher" if turn.get("role") == "agent" else "Parent"
        transcript_lines.append(f"{role}: {turn.get('text', '')}")
    transcript_text = "\n".join(transcript_lines)

    prompt = _ANALYSIS_PROMPT.format(
        student_name=call_context.get("studentName", "student"),
        class_name=call_context.get("className", ""),
        reason=call_context.get("reason", ""),
        teacher_name=call_context.get("teacherName", "Teacher"),
        school_name=call_context.get("schoolName", "School"),
        parent_language=call_context.get("parentLanguage", "Hindi"),
        transcript_text=transcript_text,
        flagged_field=_FLAGGED_FIELD.format(words=json.dumps(flagged_words, ensure_ascii=False))
        if isinstance(flagged_words, str) and flagged_words.strip() else "",
    )

    try:
        client = genai.Client(**backend.genai_client_kwargs()) if use_vertex else genai.Client(api_key=key)
        response = await asyncio.wait_for(client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=800,
            ),
        ), ANALYSIS_TIMEOUT_SECONDS)

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        insights = json.loads(text)
        logger.info(
            f"Call analysis complete — sentiment={insights.get('parentSentiment')}, "
            f"quality={insights.get('callQuality')}, "
            f"concerns={len(insights.get('concerns', []))}, "
            f"followUps={len(insights.get('followUps', []))}"
        )
        return insights

    except json.JSONDecodeError as e:
        logger.error(f"Call analysis JSON parse error: {e}")
        return None
    except Exception as e:
        logger.error(f"Call analysis error: {e}")
        return None
