"""Assignment-assessor ADK agent.

Single-stage vision+reasoning agent that grades ONE handwritten student
assignment against an optional rubric. Mirrors the Genkit flow
`sahayakai-main/src/ai/flows/assignment-assessor.ts` and ports the
companion `assignment-assessor-validation.ts` post-hoc guard as an
internal helper (`validate_assessment`) that runs before the wire
response is returned.
"""
from .router import assignment_assessor_router
from .schemas import (
    AssessAssignmentRequest,
    AssessAssignmentResponse,
    PerCriterionScore,
    RubricCriterion,
    RubricLevel,
    RubricSnapshot,
)

__all__ = [
    "AssessAssignmentRequest",
    "AssessAssignmentResponse",
    "PerCriterionScore",
    "RubricCriterion",
    "RubricLevel",
    "RubricSnapshot",
    "assignment_assessor_router",
]
