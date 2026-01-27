'use server';

/**
 * @fileOverview Plans virtual field trips using Google Earth.
 *
 * - planVirtualFieldTrip - A function that takes a topic and returns a planned virtual field trip.
 * - VirtualFieldTripInput - The input type for the planVirtualFieldTrip function.
 * - VirtualFieldTripOutput - The return type for the planVirtualFieldTrip function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const VirtualFieldTripInputSchema = z.object({
  topic: z.string().describe('The topic or theme for the virtual field trip.'),
  language: z.string().optional().describe('The language for the trip descriptions.'),
  gradeLevel: z.string().optional().describe('The grade level the trip should be tailored for.'),
  userId: z.string().optional().describe('The ID of the user for whom the trip is being generated.'),
});
export type VirtualFieldTripInput = z.infer<typeof VirtualFieldTripInputSchema>;

const VirtualFieldTripOutputSchema = z.object({
  title: z.string().describe('An engaging title for the virtual field trip.'),
  stops: z.array(z.object({
    name: z.string().describe('The name of the location.'),
    description: z.string().describe('A brief, engaging description of the stop.'),
    educationalFact: z.string().describe('A "wow-factor" educational fact about this location.'),
    reflectionPrompt: z.string().describe('A critical thinking question for students to answer at this stop.'),
    googleEarthUrl: z.string().describe('A valid Google Earth search URL.'),
  })).describe('An array of stops.'),
});
export type VirtualFieldTripOutput = z.infer<typeof VirtualFieldTripOutputSchema>;

export async function planVirtualFieldTrip(input: VirtualFieldTripInput): Promise<VirtualFieldTripOutput> {
  return virtualFieldTripFlow(input);
}

const virtualFieldTripPrompt = ai.definePrompt({
  name: 'virtualFieldTripPrompt',
  input: { schema: VirtualFieldTripInputSchema },
  output: { schema: VirtualFieldTripOutputSchema },
  prompt: `You are an expert geography teacher and curriculum designer. Create an immersive virtual field trip using Google Earth.

**Instructions:**
1.  **Title**: Create an adventurous and educational title.
2.  **Curated Stops**: Identify 3-5 locations that perfectly illustrate the topic.
3.  **Content per Stop**:
    - **Description**: Age-appropriate narrative of what students are seeing.
    - **Educational Fact**: A specific, high-value fact that isn't common knowledge.
    - **Reflection Prompt**: A question that forces students to observe and think critically about the landscape or site.
4.  **Google Earth URLs**: Format as \`https://earth.google.com/web/search/LOCATION+NAME\`.
5.  **Language**: Respond in \`{{{language}}}\`.

**Context:**
- **Topic**: {{{topic}}}
- **Grade**: {{{gradeLevel}}}
`,
});

const virtualFieldTripFlow = ai.defineFlow(
  {
    name: 'virtualFieldTripFlow',
    inputSchema: VirtualFieldTripInputSchema,
    outputSchema: VirtualFieldTripOutputSchema,
  },
  async input => {
    const { output } = await virtualFieldTripPrompt(input);

    if (!output) {
      throw new Error('The AI model failed to generate a valid virtual field trip. The returned output was null.');
    }

    if (input.userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.json`;
      const filePath = `users/${input.userId}/virtual-field-trips/${fileName}`;

      const storage = await getStorageInstance();
      const file = storage.bucket().file(filePath);

      await file.save(JSON.stringify(output), {
        contentType: 'application/json',
      });

      const db = await getDb();
      await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
        type: 'virtual-field-trip',
        topic: input.topic,
        gradeLevels: [input.gradeLevel],
        language: input.language,
        storagePath: filePath,
        createdAt: now,
        isPublic: false,
      });
    }

    return output;
  }
);
