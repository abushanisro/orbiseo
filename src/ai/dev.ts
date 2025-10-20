import { config } from 'dotenv';
config();

import '@/ai/flows/cluster-keywords-by-intent.ts';
import '@/ai/flows/generate-ai-content-suggestions.ts';
import '@/ai/flows/generate-keyword-embeddings.ts';
import '@/ai/flows/query-vector-database-semantically.ts';
import '@/ai/flows/crawl-and-extract-entities.ts';
import '@/ai/flows/upsert-keywords-to-vector-database.ts';
