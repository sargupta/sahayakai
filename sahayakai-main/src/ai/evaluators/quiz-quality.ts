import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the evaluator
ai.defineEvaluator(
  {
    name: 'sahayak/quizQuality',
    displayName: 'Quiz Quality',
    definition: 'Evaluates quiz generation quality across correctness, difficulty spread, and distractor plausibility',
  },
  async (datapoint) => {
    const output = datapoint.output as any;
    const reference = datapoint.reference as any;

    if (!output || !output.questions) {
      return {
        testCaseId: datapoint.testCaseId,
        evaluation: {
          score: 0,
          details: { reasoning: 'No quiz output or questions array' },
        },
      };
    }

    const scores: Array<{ score: number; details: { reasoning: string } }> = [];

    // 1. Answer Correctness (LLM-as-judge)
    // Use ai.generate to judge if each question's correctAnswer is factually correct
    const correctnessPromises = output.questions.map(async (q: any) => {
      try {
        const result = await ai.generate({
          model: 'googleai/gemini-2.0-flash',
          prompt: `You are an expert teacher evaluating a quiz question for factual accuracy.

Question: ${q.questionText || q.question || q.text}
Correct Answer: ${q.correctAnswer || q.answer}
Grade Level: ${reference?.gradeLevel || 'Not specified'}
Subject: ${reference?.expectedSubject || reference?.subject || 'Not specified'}

Is this answer factually correct for this grade level?
Respond with ONLY a JSON object: {"correct": true/false, "reasoning": "brief explanation"}`,
          output: { format: 'json' },
        });
        const parsed = result.output as any;
        return parsed?.correct ? 1 : 0;
      } catch {
        return 0.5; // Uncertain
      }
    });

    const correctnessResults = await Promise.all(correctnessPromises);
    const answerCorrectness = correctnessResults.reduce((a, b) => a + b, 0) / correctnessResults.length;

    // 2. Difficulty Spread (heuristic)
    const difficulties = output.questions.map((q: any) => (q.difficultyLevel || q.difficulty || 'medium').toLowerCase());
    const diffCounts = { easy: 0, medium: 0, hard: 0 };
    difficulties.forEach((d: string) => {
      if (d in diffCounts) diffCounts[d as keyof typeof diffCounts]++;
    });
    const totalQuestions = output.questions.length;
    // Score based on how well-distributed the difficulties are
    const nonEmptyBuckets = Object.values(diffCounts).filter(c => c > 0).length;
    const difficultySpread = totalQuestions <= 2 ? 1 : nonEmptyBuckets / 3;

    // 3. Distractor Plausibility (for MCQs, LLM-as-judge)
    const mcqs = output.questions.filter((q: any) =>
      q.questionType === 'multiple_choice' || q.type === 'multiple_choice' || q.type === 'mcq' || (q.options && q.options.length > 0)
    );

    let distractorScore = 1; // Default perfect if no MCQs
    if (mcqs.length > 0) {
      const distractorChecks = mcqs.slice(0, 5).map(async (q: any) => { // Sample up to 5
        try {
          const options = q.options || [];
          const result = await ai.generate({
            model: 'googleai/gemini-2.0-flash',
            prompt: `You are evaluating MCQ distractors (wrong answer choices) for educational quality.

Question: ${q.questionText || q.question || q.text}
Options: ${JSON.stringify(options)}
Correct Answer: ${q.correctAnswer || q.answer}

Rate the distractors (incorrect options) on a scale of 0-1:
- 1.0 = Distractors are plausible misconceptions that test understanding
- 0.5 = Distractors are somewhat plausible but obvious
- 0.0 = Distractors are absurd or unrelated

Respond with ONLY: {"score": 0.X, "reasoning": "brief explanation"}`,
            output: { format: 'json' },
          });
          return (result.output as any)?.score ?? 0.5;
        } catch {
          return 0.5;
        }
      });
      const distractorResults = await Promise.all(distractorChecks);
      distractorScore = distractorResults.reduce((a, b) => a + b, 0) / distractorResults.length;
    }

    // Composite score (weighted average)
    const compositeScore = (answerCorrectness * 0.5) + (difficultySpread * 0.2) + (distractorScore * 0.3);

    return {
      testCaseId: datapoint.testCaseId,
      evaluation: [
        { id: 'answerCorrectness', score: answerCorrectness },
        { id: 'difficultySpread', score: difficultySpread },
        { id: 'distractorPlausibility', score: distractorScore },
        {
          id: 'composite',
          score: compositeScore,
          details: {
            reasoning: JSON.stringify({
              answerCorrectness,
              difficultySpread,
              distractorPlausibility: distractorScore,
              questionCount: totalQuestions,
              mcqCount: mcqs.length,
            }),
          },
        },
      ],
    };
  }
);
