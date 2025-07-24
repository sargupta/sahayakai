'use server';

/**
 * @fileOverview Plans virtual field trips using Google Earth.
 *
 * - planVirtualFieldTrip - A function that takes a topic and returns a planned virtual field trip.
 * - VirtualFieldTripInput - The input type for the planVirtualFieldTrip function.
 * - VirtualFieldTripOutput - The return type for the planVirtualFieldTrip function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VirtualFieldTripInputSchema = z.object({
  topic: z.string().describe('The topic or theme for the virtual field trip.'),
  language: z.string().optional().describe('The language for the trip descriptions.'),
  gradeLevel: z.string().optional().describe('The grade level the trip should be tailored for.'),
});
export type VirtualFieldTripInput = z.infer<typeof VirtualFieldTripInputSchema>;

const VirtualFieldTripOutputSchema = z.object({
  title: z.string().describe('An engaging title for the virtual field trip.'),
  stops: z.array(z.object({
    name: z.string().describe('The name of the location or stop on the tour.'),
    description: z.string().describe('A brief, engaging description of the stop, suitable for the specified grade level.'),
    googleEarthUrl: z.string().url().describe('A Google Earth URL for the location. This should be a direct link that opens the location in Google Earth (e.g., "https://earth.google.com/web/search/...")'),
  })).describe('An array of stops for the virtual field trip.'),
});
export type VirtualFieldTripOutput = z.infer<typeof VirtualFieldTripOutputSchema>;

export async function planVirtualFieldTrip(input: VirtualFieldTripInput): Promise<VirtualFieldTripOutput> {
  return virtualFieldTripFlow(input);
}

const virtualFieldTripPrompt = ai.definePrompt({
  name: 'virtualFieldTripPrompt',
  input: {schema: VirtualFieldTripInputSchema},
  output: {schema: VirtualFieldTripOutputSchema},
  prompt: `You are an expert curriculum designer who creates exciting virtual field trips for students using Google Earth.

**Instructions:**
1.  **Create a Title:** Generate a short, engaging title for the field trip based on the user's topic.
2.  **Plan Stops:** Identify 3-5 key locations relevant to the topic.
3.  **Write Descriptions:** For each stop, write a concise, age-appropriate description (for the given \`gradeLevel\`) that highlights its significance.
4.  **Generate Google Earth URLs:** For each location, you MUST create a valid Google Earth search URL. The format is \`https://earth.google.com/web/search/YOUR_LOCATION_HERE\`, where spaces in the location name are replaced with \`+\`. For example, for "The Taj Mahal", the URL would be "https://earth.google.com/web/search/The+Taj+Mahal".
5.  **Language:** Respond in the specified \`language\`.
6.  **JSON Output:** You MUST conform to the required JSON output format.

**User's Request:**
-   **Topic:** {{{topic}}}
-   **Grade Level:** {{{gradeLevel}}}
-   **Language:** {{{language}}}
`,
});

const virtualFieldTripFlow = ai.defineFlow(
  {
    name: 'virtualFieldTripFlow',
    inputSchema: VirtualFieldTripInputSchema,
    outputSchema: VirtualFieldTripOutputSchema,
  },
  async input => {
    const {output} = await virtualFieldTripPrompt(input);
    return output!;
  }
);
