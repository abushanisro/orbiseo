'use server';
/**
 * @fileOverview This file defines a Genkit flow for clustering keywords by intent using KMeans and Gemini.
 *
 * It includes:
 * - clusterKeywordsByIntent: An async function that clusters keywords and names the clusters.
 * - ClusterKeywordsByIntentInput: The input type for the clusterKeywordsByIntent function.
 * - ClusterKeywordsByIntentOutput: The output type for the clusterKeywordsByIntent function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Helper function to calculate Euclidean distance
function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    // This should not happen if data is clean, but it's a good safeguard.
    console.error("Embeddings have different dimensions.");
    return Infinity;
  }
  return Math.sqrt(a.reduce((sum, val, i) => sum + (val - b[i]) ** 2, 0));
}


// Helper function to initialize centroids
function initializeCentroids(embeddings: number[][], k: number): number[][] {
  const centroids: number[][] = [];
  // Take k unique embeddings as initial centroids
  const uniqueEmbeddings = Array.from(new Set(embeddings.map(e => JSON.stringify(e)))).map(s => JSON.parse(s));
  const take = Math.min(uniqueEmbeddings.length, k);
  
  const shuffled = uniqueEmbeddings.sort(() => 0.5 - Math.random());
  for(let i = 0; i < take; i++) {
    centroids.push(shuffled[i]);
  }
  return centroids;
}

// K-Means clustering implementation
function kmeans(embeddings: number[][], k: number, maxIterations = 100): number[] {
    if (embeddings.length === 0 || k === 0) {
      return [];
    }

    if (embeddings.length < k) {
        // Not enough data points to form k clusters, assign each to its own cluster index
        console.warn(`Warning: Fewer embeddings (${embeddings.length}) than requested clusters (k=${k}). Assigning each embedding to its own cluster.`);
        return embeddings.map((_, i) => i);
    }

  let centroids = initializeCentroids(embeddings, k);
  if (centroids.length < k) {
    console.warn(`Could only initialize ${centroids.length} unique centroids for k=${k}.`);
    k = centroids.length;
    if (k === 0) return new Array(embeddings.length).fill(0);
  }

  let assignments: number[] = new Array(embeddings.length).fill(0);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    // Assign each embedding to the nearest centroid
    for (let i = 0; i < embeddings.length; i++) {
      let minDistance = Infinity;
      let closestCentroidIndex = 0;
      for (let j = 0; j < centroids.length; j++) {
        const distance = euclideanDistance(embeddings[i], centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroidIndex = j;
        }
      }
      if (assignments[i] !== closestCentroidIndex) {
        assignments[i] = closestCentroidIndex;
        changed = true;
      }
    }

    // If no assignments changed, we've converged.
    if (!changed) break;

    // Update centroids
    const newCentroids: number[][] = [];
    const counts: number[] = new Array(k).fill(0);
    const sums: number[][] = new Array(k).fill(0).map(() => new Array(embeddings[0].length).fill(0));

    for (let i = 0; i < embeddings.length; i++) {
        const clusterIndex = assignments[i];
        counts[clusterIndex]++;
        for (let d = 0; d < embeddings[i].length; d++) {
            sums[clusterIndex][d] += embeddings[i][d];
        }
    }
    
    let converged = true;
    for (let i = 0; i < k; i++) {
        if(counts[i] > 0) {
            const mean = sums[i].map(sum => sum / counts[i]);
            if (!centroids[i] || euclideanDistance(mean, centroids[i]) > 1e-4) {
                converged = false;
            }
            newCentroids[i] = mean;
        } else {
            // Re-initialize centroid if cluster becomes empty
            console.warn(`Cluster ${i} became empty. Re-initializing centroid.`);
            newCentroids[i] = embeddings[Math.floor(Math.random() * embeddings.length)];
            converged = false;
        }
    }

    centroids = newCentroids;
    if (converged) break;
  }

  return assignments;
}

const ClusterKeywordsByIntentInputSchema = z.object({
  keywords: z.array(z.string()).describe('An array of SEO keywords.'),
  embeddings: z.array(z.array(z.number())).describe('An array of embeddings corresponding to the keywords.'),
  clusterCount: z.number().int().min(1).describe('The number of clusters to create.'),
});
export type ClusterKeywordsByIntentInput = z.infer<typeof ClusterKeywordsByIntentInputSchema>;

const ClusterKeywordsByIntentOutputSchema = z.record(z.string(), z.array(z.string())).describe('A record mapping cluster names to arrays of keywords.');
export type ClusterKeywordsByIntentOutput = z.infer<typeof ClusterKeywordsByIntentOutputSchema>;

export async function clusterKeywordsByIntent(input: ClusterKeywordsByIntentInput): Promise<ClusterKeywordsByIntentOutput> {
  return clusterKeywordsByIntentFlow(input);
}

const nameClustersTool = ai.defineTool(
  {
    name: 'nameClusters',
    description: 'Given a list of clusters of keywords, provide a human-readable name for each cluster that represents the intent of the keywords.',
    inputSchema: z.object({
      clusters: z.record(z.string(), z.array(z.string())).describe('A record mapping cluster IDs to arrays of keywords.'),
    }),
    outputSchema: z.record(z.string(), z.string()).describe('A record mapping cluster IDs to human-readable names.'),
  },
  async input => {
    const clusterNames: Record<string, string> = {};
    for (const clusterId in input.clusters) {
      const keywords = input.clusters[clusterId];
      if (keywords.length === 0) continue;
      try {
        const {output} = await ai.generate({
          prompt: `You are an expert SEO analyst. Here is a cluster of keywords: ${keywords.join(
            ', '
          )}. What is the user's intent behind these keywords? Give a short, concise name for this cluster, between 2-5 words.`,
        });
        clusterNames[clusterId] = (output as string).replace(/"/g, '');
      } catch (e) {
        console.error(`Failed to name cluster for keywords: ${keywords.join(', ')}`, e);
        // Assign a generic name if naming fails
        clusterNames[clusterId] = `Topic: ${keywords[0]}`;
      }
    }
    return clusterNames;
  }
);


const clusterKeywordsByIntentFlow = ai.defineFlow(
  {
    name: 'clusterKeywordsByIntentFlow',
    inputSchema: ClusterKeywordsByIntentInputSchema,
    outputSchema: ClusterKeywordsByIntentOutputSchema,
  },
  async input => {
    const { keywords, embeddings, clusterCount } = input;
    
    if (!keywords || keywords.length === 0 || !embeddings || embeddings.length === 0) {
      return {};
    }

    // Ensure clusterCount is not greater than the number of keywords
    const adjustedClusterCount = Math.min(clusterCount, keywords.length);

    if (adjustedClusterCount <= 0) {
      return {};
    }
    
    // Perform k-means clustering
    const assignments = kmeans(embeddings, adjustedClusterCount);

    // Group keywords into clusters
    const clusterResults: Record<string, string[]> = {};
    for (let i = 0; i < assignments.length; i++) {
        const clusterIndex = assignments[i];
        const clusterId = `cluster${clusterIndex}`;
        if (!clusterResults[clusterId]) {
            clusterResults[clusterId] = [];
        }
        clusterResults[clusterId].push(keywords[i]);
    }
    
    // Filter out empty clusters before naming
    const nonEmptyClusters: Record<string, string[]> = {};
    for(const clusterId in clusterResults) {
        if(clusterResults[clusterId] && clusterResults[clusterId].length > 0) {
            nonEmptyClusters[clusterId] = clusterResults[clusterId];
        }
    }

    if (Object.keys(nonEmptyClusters).length === 0) {
      return {};
    }

    const namedClusters = await nameClustersTool({
      clusters: nonEmptyClusters,
    });

    const finalResults: Record<string, string[]> = {};
    for (const clusterId in namedClusters) {
      if(nonEmptyClusters[clusterId]) {
        finalResults[namedClusters[clusterId]] = nonEmptyClusters[clusterId];
      }
    }

    return finalResults;
  }
);
