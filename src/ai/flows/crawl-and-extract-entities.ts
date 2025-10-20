'use server';
/**
 * @fileOverview A flow that crawls a URL by calling Python backend for entity extraction
 */

import { z } from 'genkit';
import fetch from 'node-fetch';

const CrawlAndExtractEntitiesInputSchema = z.object({
  url: z.string().url().describe('The URL of the webpage to crawl.'),
});
export type CrawlAndExtractEntitiesInput = z.infer<typeof CrawlAndExtractEntitiesInputSchema>;

const CrawlAndExtractEntitiesOutputSchema = z.object({
  entities: z.array(z.string()).describe('A list of named entities (people, places, organizations) found on the page.'),
  tags: z.array(z.string()).describe('A list of relevant topic tags for the page content.'),
});
export type CrawlAndExtractEntitiesOutput = z.infer<typeof CrawlAndExtractEntitiesOutputSchema>;

// Python backend URL - configure this based on your setup
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:5000';

export async function crawlAndExtractEntities(
  input: CrawlAndExtractEntitiesInput
): Promise<CrawlAndExtractEntitiesOutput> {
  try {
    // Call Python backend
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/crawl-and-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: input.url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || `Python backend error: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      entities: result.entities || [],
      tags: result.tags || [],
    };
  } catch (error: any) {
    console.error('Error calling Python backend:', error);
    throw new Error(`Failed to extract entities: ${error.message}`);
  }
}
