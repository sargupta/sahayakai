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

import json
import os

from loguru import logger

try:
    from google import genai
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False
    logger.warning("google-genai not available — call analysis disabled")


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
  ]
}}"""


async def analyze_call(
    call_context: dict,
    transcript: list[dict],
    api_key: str | None = None,
) -> dict | None:
    """Analyze a completed call transcript and return structured insights.

    Returns dict with keys matching call_insights + concerns + followUps.
    """
    if not _HAS_GENAI:
        logger.warning("Skipping call analysis — google-genai not installed")
        return None

    if not transcript or len(transcript) < 2:
        logger.debug("Skipping analysis — transcript too short")
        return None

    key = api_key or os.environ.get("GOOGLE_GENAI_API_KEY", "")
    if not key:
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
    )

    try:
        client = genai.Client(api_key=key)
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=800,
            ),
        )

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
