'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating embeddings for keywords using the Gemini API.
 *
 * The flow takes a list of keywords as input and returns a list of embeddings.
 * The embeddings are generated using the 'googleai/embedding-004' model.
 *
 * @interface GenerateKeywordEmbeddingsInput - The input type for the generateKeywordEmbeddings function.
 * @interface GenerateKeywordEmbeddingsOutput - The output type for the generateKeywordEmbeddings function.
 * @function generateKeywordEmbeddings - A function that handles the generation of keyword embeddings.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateKeywordEmbeddingsInputSchema = z.object({
  keywords: z.array(z.string()).describe('An array of keywords to generate embeddings for.'),
});

export type GenerateKeywordEmbeddingsInput = z.infer<typeof GenerateKeywordEmbeddingsInputSchema>;

const GenerateKeywordEmbeddingsOutputSchema = z.object({
  embeddings: z.array(
    z.array(z.number()).describe('An array of floating-point numbers representing the embedding.')
  ).describe('The generated embeddings for the keywords.'),
});

export type GenerateKeywordEmbeddingsOutput = z.infer<typeof GenerateKeywordEmbeddingsOutputSchema>;

export async function generateKeywordEmbeddings(
  input: GenerateKeywordEmbeddingsInput
): Promise<GenerateKeywordEmbeddingsOutput> {
  return generateKeywordEmbeddingsFlow(input);
}

const generateKeywordEmbeddingsFlow = ai.defineFlow(
  {
    name: 'generateKeywordEmbeddingsFlow',
    inputSchema: GenerateKeywordEmbeddingsInputSchema,
    outputSchema: GenerateKeywordEmbeddingsOutputSchema,
  },
  async input => {
    // Call Gemini API to generate embeddings for each keyword
    const embeddings = [];
    for (const keyword of input.keywords) {
      const {output} = await ai.generate({
        model: 'googleai/embedding-004',
        prompt: keyword,
      });
      if (output && Array.isArray(output)) {
        embeddings.push(output);
      } else {
        console.warn('Unexpected output from embedding model:', output);
        // Handle the case where the output is not an array (e.g., return an empty array or throw an error)
        embeddings.push([]); // Or throw an error if appropriate
      }
    }

    return {embeddings};
  }
);
