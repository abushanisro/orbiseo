'use server';

import { revalidatePath } from 'next/cache';

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface AnalysisRow {
  id: number;
  user_id: string;
  keywords: unknown;
  clusters: unknown;
  suggestions: unknown;
  created_at: string;
}

interface SearchRow {
  id: number;
  user_id: string;
  query: string;
  created_at: string;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AnalysisState = {
  keywords?: string[];
  clusters?: Record<string, string[]>;
  suggestions?: string[];
  error?: string;
  analysisId?: string;
} | null;

export type SearchState = {
  matches?: string[];
  error?: string;
} | null;

export type SaveState = {
  success?: boolean;
  error?: string;
} | null;

export type EnhancedSearchState = {
  query?: string;
  intent?: string;
  matches?: Array<{
    keyword: string;
    score: number;
    relevance: string;
    cluster?: string;
  }>;
  clusters?: Record<string, string[]>;
  error?: string;
} | null;

export type SemanticGap = {
  gap_type: 'missing_topic' | 'shallow_coverage' | 'structural' | 'missing_subtopic';
  description: string;
  severity: 'high' | 'medium' | 'low';
  affected_topics: string[];
  solution: string;
  recommended_keywords?: string[];
  content_suggestions?: string[];
};

export type CrawlState = {
  url?: string;
  title?: string;
  word_count?: number;
  entities?: string[];
  tags?: string[];
  keywords?: string[];
  key_topics?: string[];
  content_summary?: string;
  semantic_clusters?: Record<string, string[]>;
  topic_relevance_score?: number;
  content_quality_score?: number;
  content_gaps?: string[];
  semantic_gaps?: SemanticGap[];
  missing_entities?: string[];
  recommended_topics?: string[];
  seo_score?: number;
  readability_score?: number;
  keyword_density?: Record<string, number>;
  crawl_timestamp?: number;
  indexed_to_pinecone?: boolean;
  error?: string;
  warning?: string;
} | null;

export type KeywordAnalysis = {
  id: string;
  user_id: string;
  keywords: string[];
  clusters: Record<string, string[]>;
  suggestions: string[];
  created_at: Date;
};

export type SearchQuery = {
  id: string;
  query: string;
  user_id: string;
  created_at: Date;
};

export type HistoryState = {
  analyses?: KeywordAnalysis[];
  searchHistory?: SearchQuery[];
  error?: string;
};

export type PineconeSearchState = {
  query?: string;
  total_results?: number;
  keywords?: Array<{
    keyword: string;
    score?: number;
    search_volume?: number;
    keyword_difficulty?: number;
    personal_kd?: number;
    cpc?: number;
    intent?: string;
    intent_strength?: number;
    searcher_stage?: string;
    semantic_cluster?: string;
    optimization_score?: number;
    parent_topic?: string;
    authority_rank?: number;
    opportunity_rank?: number;
    source?: string;
    rank?: number;
    comp1_url?: string;
    comp1_domain?: string;
    comp1_rank?: number;
    comp1_da?: number;
    comp1_traffic?: number;
    comp2_url?: string;
    comp2_domain?: string;
    comp2_rank?: number;
    comp2_da?: number;
    comp2_traffic?: number;
    comp3_url?: string;
    comp3_domain?: string;
    comp3_rank?: number;
    comp3_da?: number;
    comp3_traffic?: number;
  }>;
  aggregations?: {
    intent_distribution?: Record<string, number>;
    total_search_volume?: number;
  };
  clusters_found?: string[];
  avg_metrics?: {
    avg_search_volume?: number;
    avg_keyword_difficulty?: number;
    avg_cpc?: number;
    avg_optimization_score?: number;
  };
  error?: string;
} | null;

export type CompetitorAnalysisState = {
  keyword?: string;
  competitors?: Array<{
    rank: number;
    url: string;
    domain: string;
    domain_authority: number;
    traffic: number;
  }>;
  opportunity_analysis?: {
    keyword_difficulty?: number;
    search_volume?: number;
    optimization_score?: number;
  };
  content_gaps?: string[];
  recommendations?: string[];
  error?: string;
} | null;

export type SERPAnalysisState = {
  keyword?: string;
  intent?: string;
  intent_confidence?: number;
  organic_results?: Array<{
    position: number;
    url: string;
    domain: string;
    title: string;
    description: string;
    domain_authority: number;
    traffic: number;
    keyword: string;
    keyword_difficulty: number;
    backlinks: number;
    content_gap: number;
    semantic_score: number;
    opportunity: number;
  }>;
  total_organic_results?: number;
  related_searches?: string[];
  serp_metrics?: {
    avg_domain_authority: number;
    total_competitor_traffic: number;
    avg_keyword_difficulty: number;
    avg_backlinks: number;
    top_position: number;
    serp_diversity: number;
    competition_level: string;
  };
  ai_recommendations?: string[];
  content_opportunities?: {
    high_volume_keywords: string[];
    low_competition_keywords: string[];
    semantic_clusters: string[];
    total_opportunity_score: number;
  };
  error?: string;
} | null;

// ============================================================================
// API CONFIGURATION
// ============================================================================

const API_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';
const AI_CRAWL_URL = process.env.AI_CRAWL_URL || 'http://localhost:8001';

// ============================================================================
// DATABASE HELPER FUNCTIONS
// ============================================================================

/**
 * Save a search query to the database
 */
async function saveSearch(userId: string, query: string): Promise<{ success: boolean; error?: string }> {
  try {
    // TODO: Implement database save logic
    // This is a placeholder - replace with your actual database call
    // Example using Supabase, Prisma, or any other DB client:
    // await db.searches.create({ user_id: userId, query, created_at: new Date() });
    
    console.log(`[DB] Saving search - User: ${userId}, Query: ${query}`);
    return { success: true };
  } catch (error: any) {
    console.error('[DB] Error saving search:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Save keyword analysis results to the database
 */
async function saveAnalysis(
  userId: string,
  keywords: string[],
  clusters: Record<string, string[]>,
  suggestions: string[]
): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  try {
    // TODO: Implement database save logic
    // This is a placeholder - replace with your actual database call
    // Example:
    // const result = await db.analyses.create({
    //   user_id: userId,
    //   keywords: JSON.stringify(keywords),
    //   clusters: JSON.stringify(clusters),
    //   suggestions: JSON.stringify(suggestions),
    //   created_at: new Date()
    // });
    
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[DB] Saving analysis - User: ${userId}, ID: ${analysisId}`);
    
    return { 
      success: true, 
      analysisId 
    };
  } catch (error: any) {
    console.error('[DB] Error saving analysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Retrieve analysis history for a user
 */
export async function getAnalysisHistory(userId: string): Promise<KeywordAnalysis[]> {
  try {
    // TODO: Implement database retrieval logic
    // Example:
    // const rows = await db.analyses.findMany({
    //   where: { user_id: userId },
    //   orderBy: { created_at: 'desc' },
    //   limit: 50
    // });
    
    console.log(`[DB] Fetching analysis history for user: ${userId}`);
    return [];
  } catch (error) {
    console.error('[DB] Error fetching analysis history:', error);
    return [];
  }
}

/**
 * Retrieve search history for a user
 */
export async function getSearchHistory(userId: string): Promise<SearchQuery[]> {
  try {
    // TODO: Implement database retrieval logic
    // Example:
    // const rows = await db.searches.findMany({
    //   where: { user_id: userId },
    //   orderBy: { created_at: 'desc' },
    //   limit: 100
    // });
    
    console.log(`[DB] Fetching search history for user: ${userId}`);
    return [];
  } catch (error) {
    console.error('[DB] Error fetching search history:', error);
    return [];
  }
}

// ============================================================================
// AI CRAWL URL ACTION
// ============================================================================

export async function crawlUrlAction(
  prevState: CrawlState,
  formData: FormData
): Promise<CrawlState> {
  const url = formData.get('url') as string;
  const uid = formData.get('uid') as string;

  if (!url) {
    console.error('[AI Crawl] No URL provided');
    return { error: 'No URL provided.' };
  }
  if (!uid) {
    console.error('[AI Crawl] No user ID provided');
    return { error: 'LOGIN_REQUIRED' };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.error('[AI Crawl] Invalid URL format:', url);
    return { error: 'Invalid URL format. Please enter a valid URL.' };
  }

  console.log(`[AI Crawl] Analyzing: ${url} for user: ${uid}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(`${AI_CRAWL_URL}/api/crawl-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        max_content_length: 50000,
        extract_entities: true,
        extract_tags: true,
        extract_keywords: true,
        analyze_competitors: false,
        perform_gap_analysis: true,
        auto_index_pinecone: false,
        target_topic: 'cryptocurrency',
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Crawl] Error ${response.status}:`, errorText);
      let errorDetail = `API Error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        errorDetail = errorText || errorDetail;
      }
      throw new Error(errorDetail);
    }

    const result = await response.json();

    // Validate semantic_gaps
    let validatedSemanticGaps: SemanticGap[] = [];
    if (Array.isArray(result.semantic_gaps)) {
      validatedSemanticGaps = result.semantic_gaps.map((gap: any) => ({
        gap_type: gap.gap_type || 'structural',
        description: gap.description || 'Unknown gap',
        severity: gap.severity || 'medium',
        affected_topics: Array.isArray(gap.affected_topics) ? gap.affected_topics : [],
        solution: gap.solution || 'No solution provided',
        recommended_keywords: Array.isArray(gap.recommended_keywords) ? gap.recommended_keywords : [],
        content_suggestions: Array.isArray(gap.content_suggestions) ? gap.content_suggestions : [],
      }));
    }

    const returnState: CrawlState = {
      url: result.url,
      title: result.title,
      word_count: result.word_count || 0,
      entities: result.entities || [],
      tags: result.tags || [],
      keywords: result.keywords || [],
      key_topics: result.key_topics || [],
      content_summary: result.content_summary,
      semantic_clusters: result.semantic_clusters || {},
      topic_relevance_score: result.topic_relevance_score || 0,
      content_quality_score: result.content_quality_score || 0,
      content_gaps: result.content_gaps || [],
      semantic_gaps: validatedSemanticGaps,
      missing_entities: result.missing_entities || [],
      recommended_topics: result.recommended_topics || [],
      seo_score: result.seo_score || 0,
      readability_score: result.readability_score || 0,
      keyword_density: result.keyword_density || {},
      crawl_timestamp: result.crawl_timestamp || Date.now() / 1000,
      indexed_to_pinecone: result.indexed_to_pinecone || false,
    };

    if (validatedSemanticGaps.length === 0) {
      returnState.warning = 'No semantic gaps detected.';
    }

    return returnState;
  } catch (error: any) {
    console.error('[AI Crawl] Error:', error.message);
    return {
      error: `Crawl failed: ${error.message || 'Make sure AI Crawler is running on port 8001'}`,
    };
  }
}

// ============================================================================
// SEMANTIC SEARCH FUNCTIONS
// ============================================================================

export async function searchSimilarKeywords(
  prevState: SearchState,
  formData: FormData
): Promise<SearchState> {
  const query = formData.get('query') as string;
  const uid = formData.get('uid') as string;

  if (!query) {
    return { error: 'No search query provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  try {
    // Save search to history
    await saveSearch(uid, query);

    const response = await fetch(`${API_URL}/api/semantic-search-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topK: 20,
        includeIntent: true,
        minSimilarity: 0.5,
        includeMetrics: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return {
      matches: result.matches?.map((m: any) => m.keyword || m) || [],
    };
  } catch (error: any) {
    console.error('[Search] Error during semantic search:', error);
    return { error: `Failed to perform search: ${error.message}` };
  }
}

export async function performEnhancedSearch(
  prevState: EnhancedSearchState,
  formData: FormData
): Promise<EnhancedSearchState> {
  const query = formData.get('query') as string;
  const topK = parseInt(formData.get('topK') as string) || 20;
  const uid = formData.get('uid') as string;

  if (!query) {
    return { error: 'No query provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  try {
    // Save search to history
    await saveSearch(uid, query);

    const response = await fetch(`${API_URL}/api/semantic-search-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topK,
        includeIntent: true,
        minSimilarity: 0.5,
        includeMetrics: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return {
      query: result.query,
      intent: result.intent,
      matches: result.matches || [],
      clusters: result.clusters || {},
    };
  } catch (error: any) {
    console.error('[Search] Error in enhanced search:', error);
    return { error: `Enhanced search failed: ${error.message}` };
  }
}

export async function pineconeSemanticSearch(
  prevState: PineconeSearchState,
  formData: FormData
): Promise<PineconeSearchState> {
  const query = formData.get('query') as string;
  const topK = parseInt(formData.get('topK') as string) || 20;
  const uid = formData.get('uid') as string;

  if (!query) {
    return { error: 'No query provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  try {
    // Save search to history
    await saveSearch(uid, query);

    const response = await fetch(`${API_URL}/api/semantic-search-live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topK,
        includeIntent: true,
        minSimilarity: 0.5,
        includeMetrics: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return {
      query: result.query,
      total_results: result.total_results || result.matches?.length || 0,
      keywords: result.matches || [],
      aggregations: result.aggregate_metrics || {},
      clusters_found: result.clusters_found || [],
      avg_metrics: {
        avg_search_volume: result.aggregate_metrics?.total_search_volume || 0,
        avg_keyword_difficulty: result.aggregate_metrics?.avg_keyword_difficulty || 0,
        avg_cpc: result.aggregate_metrics?.avg_cpc || 0,
        avg_optimization_score: 0,
      },
    };
  } catch (error: any) {
    console.error('[Search] Error in Pinecone search:', error);
    return { error: `Pinecone search failed: ${error.message}` };
  }
}

export async function expandKeywords(
  seedKeyword: string,
  expansionCount: number = 50,
  uid: string
): Promise<PineconeSearchState> {
  if (!seedKeyword) {
    return { error: 'No seed keyword provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  try {
    const response = await fetch(`${API_URL}/api/expand-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seed_keyword: seedKeyword,
        expansion_count: expansionCount,
        include_metrics: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return {
      query: seedKeyword,
      total_results: result.total_keywords || 0,
      keywords: result.expanded_keywords || [],
      avg_metrics: result.metrics_summary || {},
    };
  } catch (error: any) {
    console.error('[Expand] Error in keyword expansion:', error);
    return { error: `Keyword expansion failed: ${error.message}` };
  }
}

export async function serpAnalysis(
  prevState: SERPAnalysisState,
  formData: FormData
): Promise<SERPAnalysisState> {
  const keyword = formData.get('keyword') as string;
  const uid = formData.get('uid') as string;

  if (!keyword) {
    return { error: 'No keyword provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  try {
    const response = await fetch(`${API_URL}/api/dataforseo/serp-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        locationCode: 2840,
        languageCode: 'en',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    const result = await response.json();
    return {
      keyword: result.keyword,
      intent: result.intent,
      intent_confidence: result.intent_confidence,
      organic_results: result.organic_results || [],
      total_organic_results: result.total_organic_results || 0,
      related_searches: result.related_searches || [],
      serp_metrics: result.serp_metrics || {},
      ai_recommendations: result.ai_recommendations || [],
      content_opportunities: result.content_opportunities || {},
    };
  } catch (error: any) {
    console.error('[SERP] Error in SERP analysis:', error);
    return { error: `SERP analysis failed: ${error.message}` };
  }
}

// ============================================================================
// KEYWORD ANALYSIS
// ============================================================================

export async function analyzeKeywords(
  prevState: AnalysisState,
  formData: FormData
): Promise<AnalysisState> {
  const keywordsStr = formData.get('keywords') as string;
  const uid = formData.get('uid') as string;

  if (!keywordsStr) {
    return { error: 'No keywords provided.' };
  }
  if (!uid) {
    return { error: 'LOGIN_REQUIRED' };
  }

  const keywords = keywordsStr.split('\n').filter((kw) => kw.trim() !== '');
  if (keywords.length === 0) {
    return { error: 'Please enter at least one keyword.' };
  }

  try {
    const response = await fetch(`${API_URL}/api/cluster-keywords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        n_clusters: Math.min(5, Math.max(2, Math.floor(keywords.length / 2))),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Clustering failed');
    }

    const clusterResult = await response.json();
    const suggestions = [
      `Complete guide to ${keywords[0]}`,
      `Top 10 tips for ${keywords[0]}`,
      `How to optimize ${keywords[0]}`,
      `${keywords[0]} best practices`,
      `Common mistakes with ${keywords[0]}`,
    ];

    // Save analysis to database
    const saveResult = await saveAnalysis(
      uid,
      keywords,
      clusterResult.clusters || {},
      suggestions
    );

    return {
      keywords,
      clusters: clusterResult.clusters || {},
      suggestions,
      analysisId: saveResult.analysisId,
    };
  } catch (error: any) {
    console.error('[Analysis] Error during keyword analysis:', error);
    return { error: `Analysis Error: ${error.message}` };
  }
}