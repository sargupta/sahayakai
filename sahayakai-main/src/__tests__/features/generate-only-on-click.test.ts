/** @jest-environment node */
/**
 * Quiz and Rubric only generate when the teacher presses the Generate button. A link that carries
 * a topic (VIDYA, home suggestions) pre-fills the form and then waits: the teacher may still want
 * to change the options. Regression: both hooks auto-submitted 300 ms after opening.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe.each([
    'src/features/quiz-generator/hooks/use-quiz-generator.ts',
    'src/features/rubric-generator/hooks/use-rubric-generator.ts',
])('%s', (file) => {
    it('never schedules a submit by itself', () => {
        expect(read(file)).not.toMatch(/setTimeout\(\(\) => \{\s*form\.handleSubmit\(onSubmit\)\(\);/);
    });
});
