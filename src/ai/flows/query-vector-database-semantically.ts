'use server';
/**
 * @fileOverview A flow that queries a Pinecone vector database with a new keyword or topic to find semantically similar keywords.
 *
 * - queryVectorDatabaseSemantically - A function that handles the querying of the vector database.
 * - QueryVectorDatabaseSemanticallyInput - The input type for the queryVectorDatabaseSemantically function.
 * - QueryVectorDatabaseSemanticallyOutput - The return type for the queryVectorDatabaseSemantically function.
 */

import {z} from 'genkit';
import {generateKeywordEmbeddings} from './generate-keyword-embeddings';
import {Pinecone} from '@pinecone-database/pinecone';

const QueryVectorDatabaseSemanticallyInputSchema = z.object({
  query: z.string().describe('The keyword or topic to query with.'),
  topK: z.number().describe('The number of results to return.').default(5),
});
export type QueryVectorDatabaseSemanticallyInput = z.infer<typeof QueryVectorDatabaseSemanticallyInputSchema>;

const QueryVectorDatabaseSemanticallyOutputSchema = z.object({
  matches: z.array(z.string()).describe('The semantically similar keywords.'),
});
export type QueryVectorDatabaseSemanticallyOutput = z.infer<typeof QueryVectorDatabaseSemanticallyOutputSchema>;

// Initialize Pinecone
if (!process.env.PINECONE_API_KEY) {
  throw new Error(
    'PINECONE_API_KEY is not set. Please set it in your .env file.'
  );
}
if (!process.env.PINECONE_INDEX_NAME) {
  throw new Error(
    'PINECONE_INDEX_NAME is not set. Please set it in your .env file.'
  );
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pc.index(process.env.PINECONE_INDEX_NAME);

export async function queryVectorDatabaseSemantically(
  input: QueryVectorDatabaseSemanticallyInput
): Promise<QueryVectorDatabaseSemanticallyOutput> {
  try {
    // 1. Generate an embedding for the input query.
    const embeddingResult = await generateKeywordEmbeddings({
      keywords: [input.query],
    });
    const queryEmbedding = embeddingResult.embeddings[0];

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Failed to generate a valid embedding for the query.');
    }

    // 2. Query the Pinecone index.
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: input.topK,
      includeMetadata: true, // Assuming you store the keyword text in metadata
    });

    // 3. Extract the keyword text from the matches' metadata.
    // This assumes your vectors are stored with metadata like: { "text": "keyword" }
    const matches =
      queryResponse.matches?.map(match =>
        (match.metadata?.text as string) || ''
      ) || [];

    return {matches};
  } catch (error: any) {
    console.error('Error querying vector database:', error);
    // Provide a more informative error message to the user
    throw new Error(`Failed to query vector database: ${error.message}`);
  }
}