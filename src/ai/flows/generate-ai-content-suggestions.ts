'use server';
/**
 * @fileOverview A flow that generates AI-driven content suggestions based on semantic clusters.
 *
 * - generateAiContentSuggestions - A function that handles the generation of content suggestions.
 * - GenerateAiContentSuggestionsInput - The input type for the generateAiContentSuggestions function.
 * - GenerateAiContentSuggestionsOutput - The return type for the generateAiContentSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateAiContentSuggestionsInputSchema = z.object({
  semanticClusters: z
    .array(z.string())
    .describe('An array of semantic clusters representing related topics.'),
});
export type GenerateAiContentSuggestionsInput = z.infer<typeof GenerateAiContentSuggestionsInputSchema>;

const GenerateAiContentSuggestionsOutputSchema = z.object({
  contentSuggestions: z
    .array(z.string())
    .describe('An array of AI-driven content suggestions based on the semantic clusters.'),
});
export type GenerateAiContentSuggestionsOutput = z.infer<typeof GenerateAiContentSuggestionsOutputSchema>;

export async function generateAiContentSuggestions(
  input: GenerateAiContentSuggestionsInput
): Promise<GenerateAiContentSuggestionsOutput> {
  return generateAiContentSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAiContentSuggestionsPrompt',
  input: {schema: GenerateAiContentSuggestionsInputSchema},
  output: {schema: GenerateAiContentSuggestionsOutputSchema},
  prompt: `You are an AI-powered content creation assistant.
  Given the following semantic clusters of keywords, generate content suggestions that align with the topics.
  Return the suggestions as a numbered list. Limit suggestions to under 100 words.

  Semantic Clusters:
  {{#each semanticClusters}}
    - {{{this}}}
  {{/each}}`,
});

const generateAiContentSuggestionsFlow = ai.defineFlow(
  {
    name: 'generateAiContentSuggestionsFlow',
    inputSchema: GenerateAiContentSuggestionsInputSchema,
    outputSchema: GenerateAiContentSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      return {contentSuggestions: []};
    }
    return {contentSuggestions: output.contentSuggestions || []};
  }
);
