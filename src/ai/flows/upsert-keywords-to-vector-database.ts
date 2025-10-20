'use server';
/**
 * @fileOverview A flow that generates embeddings for keywords and upserts them into a Pinecone vector database.
 *
 * - upsertKeywordsToVectorDatabase - A function that handles adding keywords and their vectors to the database.
 * - UpsertKeywordsToVectorDatabaseInput - The input type for the function.
 * - UpsertKeywordsToVectorDatabaseOutput - The return type for the function.
 */

import {z} from 'genkit';
import {generateKeywordEmbeddings} from './generate-keyword-embeddings';
import {Pinecone} from '@pinecone-database/pinecone';

const UpsertKeywordsToVectorDatabaseInputSchema = z.object({
  keywords: z.array(z.string()).describe('An array of keywords to store in the vector database.'),
});
export type UpsertKeywordsToVectorDatabaseInput = z.infer<typeof UpsertKeywordsToVectorDatabaseInputSchema>;

const UpsertKeywordsToVectorDatabaseOutputSchema = z.object({
  success: z.boolean(),
  upsertedCount: z.number().optional(),
  error: z.string().optional(),
});
export type UpsertKeywordsToVectorDatabaseOutput = z.infer<typeof UpsertKeywordsToVectorDatabaseOutputSchema>;

// Initialize Pinecone
if (!process.env.PINECONE_API_KEY) {
  throw new Error('PINECONE_API_KEY is not set. Please set it in your .env file.');
}
if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_INDEX_NAME is not set. Please set it in your .env file.');
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pc.index(process.env.PINECONE_INDEX_NAME);

export async function upsertKeywordsToVectorDatabase(
  input: UpsertKeywordsToVectorDatabaseInput
): Promise<UpsertKeywordsToVectorDatabaseOutput> {
  try {
    const {keywords} = input;
    if (!keywords || keywords.length === 0) {
      return {success: true, upsertedCount: 0};
    }

    // 1. Generate embeddings for the keywords.
    const embeddingResult = await generateKeywordEmbeddings({keywords});
    const {embeddings} = embeddingResult;

    if (!embeddings || embeddings.length !== keywords.length) {
      throw new Error('Failed to generate embeddings for all keywords.');
    }

    // 2. Prepare vectors for Pinecone upsert.
    const vectors = keywords.map((keyword, i) => ({
      id: keyword, // Using the keyword itself as the unique ID.
      values: embeddings[i],
      metadata: {
        text: keyword, // Storing the original keyword in metadata.
      },
    }));

    // 3. Upsert vectors into the Pinecone index.
    await index.upsert(vectors);

    return {success: true, upsertedCount: vectors.length};
  } catch (error: any) {
    console.error('Error upserting keywords to vector database:', error);
    return {
      success: false,
      error: `Failed to upsert keywords: ${error.message}`,
    };
  }
}
