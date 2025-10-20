"use client";

import React, { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { 
  Search, Brain, Target, TrendingUp, Layers, 
  Sparkles, Globe, BarChart3, Lightbulb, Download, AlertCircle
} from "lucide-react";
import { backendAPI } from "@/lib/api";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SearchResult {
  query: string;
  intent: string;
  intent_confidence: number;
  intent_method?: string;
  matches: KeywordMatch[];
  total_results: number;
  aggregate_metrics?: {
    total_search_volume: number;
    avg_keyword_difficulty: number;
    avg_cpc: number;
    high_volume_count: number;
  };
  clusters?: Record<string, string[]>;
  database: string;
}

interface KeywordMatch {
  keyword: string;
  score: number;
  rank: number;
  intent: string;
  intent_strength?: number;
  searcher_stage?: string;
  search_volume: number;
  keyword_difficulty: number;
  personal_kd?: number;
  cpc: number;
  semantic_similarity?: number;
  semantic_cluster?: string;
  entity_link_strength?: string;
  search_intent_vector?: string;
  serp_content_gap?: string;
  content_gap_coverage?: number;
  missing_entities?: string;
  topical_authority?: number;
  parent_topic?: string;
  optimization_score?: number;
  optimization_factors?: string;
  authority_rank?: number;
  opportunity_rank?: number;
  seasonality_index?: number;
  seasonality_pattern?: string;
  comp1_url?: string;
  comp1_domain?: string;
  comp1_rank?: number;
  comp1_da?: number;
  comp1_backlinks?: number;
  comp1_traffic?: number;
  comp2_url?: string;
  comp2_domain?: string;
  comp3_url?: string;
  comp3_domain?: string;
  avg_competitor_da?: number;
  total_competitor_traffic?: number;
  source: string;
}

interface ExpansionResult {
  seed_keyword: string;
  expanded_keywords: KeywordMatch[];
  total_keywords: number;
  metrics_summary: {
    total_search_volume: number;
    avg_competition: number;
    avg_cpc: number;
    high_volume_keywords: number;
  };
}

interface SERPResult {
  keyword: string;
  intent: string;
  intent_confidence: number;
  organic_results: OrganicResult[];
  total_organic_results: number;
  related_searches: string[];
  serp_metrics: {
    avg_domain_authority: number;
    total_competitor_traffic: number;
    avg_keyword_difficulty: number;
    avg_backlinks?: number;
    top_position: number;
    serp_diversity: number;
    competition_level: string;
  };
  ai_recommendations: string[];
  content_opportunities: {
    high_volume_keywords: string[];
    low_competition_keywords: string[];
    semantic_clusters: string[];
    total_opportunity_score: number;
  };
  database: string;
}

interface OrganicResult {
  position: number;
  url: string;
  domain: string;
  title: string;
  description: string;
  domain_authority: number;
  traffic: number;
  keyword: string;
  keyword_difficulty: number;
  backlinks?: number;
  content_gap?: number;
  semantic_score?: number;
  opportunity?: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useUser();
  
  // States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, startSearch] = useTransition();
  
  const [expandQuery, setExpandQuery] = useState("");
  const [expandResults, setExpandResults] = useState<ExpansionResult | null>(null);
  const [isExpanding, startExpand] = useTransition();
  
  const [serpKeyword, setSerpKeyword] = useState("");
  const [serpResults, setSerpResults] = useState<SERPResult | null>(null);
  const [isAnalyzingSERP, startSERPAnalysis] = useTransition();

  // Utility functions
  const safeGet = (obj: any, path: string, defaultValue: any = 0) => {
    try {
      const value = path.split('.').reduce((acc, part) => acc?.[part], obj);
      return value !== undefined && value !== null ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handlers
  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please login to use this feature",
      });
      return;
    }

    startSearch(async () => {
      try {
        const result = await backendAPI.semanticSearch({
          query: searchQuery,
          topK: 20,
          includeIntent: true,
          useDataForSEO: true,
          includeMetrics: true,
        }) as SearchResult;
        
        setSearchResults(result);
        toast({
          title: "Search Complete",
          description: `Found ${result.total_results} results`,
        });
      } catch (error: any) {
        console.error('Search error:', error);
        toast({
          variant: "destructive",
          title: "Search Failed",
          description: error.message || "An error occurred",
        });
      }
    });
  };

  const handleKeywordExpansion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandQuery.trim()) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please login to use this feature",
      });
      return;
    }

    startExpand(async () => {
      try {
        const result = await backendAPI.expandKeywords({
          seed_keyword: expandQuery,
          expansion_count: 50,
          include_dataforseo: true,
          include_ai: true,
          include_metrics: true,
        }) as ExpansionResult;
        
        setExpandResults(result);
        toast({
          title: "Expansion Complete",
          description: `Generated ${result.total_keywords} keywords`,
        });
      } catch (error: any) {
        console.error('Expansion error:', error);
        toast({
          variant: "destructive",
          title: "Expansion Failed",
          description: error.message || "An error occurred",
        });
      }
    });
  };

  const handleSERPAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serpKeyword.trim()) return;

    if (!user) {
      toast({
        variant: "destructive",
        title: "Login Required",
        description: "Please login to use this feature",
      });
      return;
    }

    startSERPAnalysis(async () => {
      try {
        const result = await backendAPI.serpAnalysis({
          keyword: serpKeyword,
        }) as SERPResult;
        
        setSerpResults(result);
        toast({
          title: "SERP Analysis Complete",
          description: `Analyzed ${result.organic_results?.length || 0} results`,
        });
      } catch (error: any) {
        console.error('SERP analysis error:', error);
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: error.message || "An error occurred",
        });
      }
    });
  };

  // DataTable Component
  const MatchesTable = ({ matches }: { matches: KeywordMatch[] }) => {
    if (!matches || matches.length === 0) return null;

    return (
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-200 dark:bg-slate-700 sticky top-0">
            <tr>
              <th className="p-2 text-left font-semibold border-b text-black dark:text-white">Keyword</th>
              <th className="p-2 text-left font-semibold border-b text-black dark:text-white">Intent</th>
              <th className="p-2 text-right font-semibold border-b text-black dark:text-white">Volume</th>
              <th className="p-2 text-right font-semibold border-b text-black dark:text-white">KD</th>
              <th className="p-2 text-right font-semibold border-b text-black dark:text-white">CPC</th>
              <th className="p-2 text-right font-semibold border-b text-black dark:text-white">Score</th>
              <th className="p-2 text-left font-semibold border-b text-black dark:text-white">Details</th>
            </tr>
          </thead>
          <tbody className="text-black dark:text-white">
            {matches.map((match, idx) => (
              <tr key={idx} className="hover:bg-slate-100 dark:hover:bg-slate-800 border-b text-black dark:text-white">
                <td className="p-2 font-medium">{match.keyword || '-'}</td>
                <td className="p-2">{match.intent || '-'}</td>
                <td className="p-2 text-right">{match.search_volume?.toLocaleString() || 0}</td>
                <td className="p-2 text-right">{match.keyword_difficulty || 0}</td>
                <td className="p-2 text-right">${match.cpc?.toFixed(2) || '0.00'}</td>
                <td className="p-2 text-right">{(match.score * 100).toFixed(1)}%</td>
                <td className="p-2">
                  <Accordion type="single" collapsible>
                    <AccordionItem value={`match-${idx}`}>
                      <AccordionTrigger className="text-black dark:text-white">More</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-2 text-xs text-black dark:text-white">
                          <div><strong>Searcher Stage:</strong> {match.searcher_stage || '-'}</div>
                          <div><strong>Similarity:</strong> {match.semantic_similarity || 0}</div>
                          <div><strong>Cluster:</strong> {match.semantic_cluster || '-'}</div>
                          <div><strong>Parent Topic:</strong> {match.parent_topic || '-'}</div>
                          <div><strong>Authority:</strong> {match.topical_authority?.toFixed(2) || '-'}</div>
                          <div><strong>Opt Score:</strong> {match.optimization_score?.toFixed(1) || '-'}</div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-black dark:text-white">OrbiSEO Semantic SEO Dashboard</h1>
        <p className="text-muted-foreground text-gray-600 dark:text-gray-400">
          AI-powered keyword research with SERP data
        </p>
      </div>

      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="search">Semantic Search</TabsTrigger>
          <TabsTrigger value="expand">Keyword Expansion</TabsTrigger>
          <TabsTrigger value="serp">SERP Analysis</TabsTrigger>
        </TabsList>

        {/* SEMANTIC SEARCH TAB */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <Search className="w-5 h-5" />
                Semantic Keyword Search
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Find semantically related keywords
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSemanticSearch} className="flex gap-4">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter a keyword or phrase..."
                  className="flex-1"
                />
                <Button type="submit" disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {searchResults && (
            <div className="space-y-4">
              {/* Intent Badge */}
              {searchResults.intent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <Brain className="w-5 h-5" />
                      Query Intent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Badge className="text-lg px-4 py-2 text-black dark:text-white">
                        {searchResults.intent}
                      </Badge>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Confidence: {(searchResults.intent_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Aggregate Metrics */}
              {searchResults.aggregate_metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <BarChart3 className="w-5 h-5" />
                      Aggregate Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-2xl font-bold text-black dark:text-white">
                          {searchResults.aggregate_metrics.total_search_volume.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-2xl font-bold text-black dark:text-white">
                          {searchResults.aggregate_metrics.avg_keyword_difficulty.toFixed(1)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg KD</div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-2xl font-bold text-black dark:text-white">
                          ${searchResults.aggregate_metrics.avg_cpc.toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Avg CPC</div>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="text-2xl font-bold text-black dark:text-white">
                          {searchResults.aggregate_metrics.high_volume_count}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">High Volume</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Matches Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-black dark:text-white">
                    Top Matches ({searchResults.matches?.length || 0})
                  </CardTitle>
                  {searchResults.matches?.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => exportToCSV(searchResults.matches, `semantic-matches-${searchQuery}.csv`)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {searchResults.matches?.length > 0 ? (
                    <div className="max-h-[600px] overflow-auto">
                      <MatchesTable matches={searchResults.matches} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No matches found</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clusters */}
              {searchResults.clusters && Object.keys(searchResults.clusters).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <Layers className="w-5 h-5" />
                      Topic Clusters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(searchResults.clusters).map(([name, keywords]) => (
                        <div key={name} className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                          <h3 className="font-semibold mb-2 text-black dark:text-white">{name}</h3>
                          <div className="flex flex-wrap gap-2">
                            {keywords.slice(0, 10).map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-black dark:text-white">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* KEYWORD EXPANSION TAB */}
        <TabsContent value="expand" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <Sparkles className="w-5 h-5" />
                Keyword Expansion
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Generate hundreds of related keywords with metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleKeywordExpansion} className="flex gap-4">
                <Input
                  value={expandQuery}
                  onChange={(e) => setExpandQuery(e.target.value)}
                  placeholder="Enter seed keyword..."
                  className="flex-1"
                />
                <Button type="submit" disabled={isExpanding}>
                  {isExpanding ? "Expanding..." : "Expand"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {expandResults && (
            <div className="space-y-4">
              {/* Metrics Summary */}
              <Card className="bg-slate-50 dark:bg-slate-800">
                <CardHeader className="bg-slate-100 dark:bg-slate-700">
                  <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                    <BarChart3 className="w-5 h-5" />
                    Metrics Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-black dark:text-white">
                        {expandResults.metrics_summary.total_search_volume.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Volume</div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-black dark:text-white">
                        {expandResults.metrics_summary.avg_competition.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Avg Competition</div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-black dark:text-white">
                        ${expandResults.metrics_summary.avg_cpc.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Avg CPC</div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg">
                      <div className="text-2xl font-bold text-black dark:text-white">
                        {expandResults.metrics_summary.high_volume_keywords}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">High Volume KWs</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Keywords Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-black dark:text-white">
                    Expanded Keywords ({expandResults.total_keywords})
                  </CardTitle>
                  {expandResults.expanded_keywords?.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => exportToCSV(expandResults.expanded_keywords, `expansion-${expandQuery}.csv`)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {expandResults.expanded_keywords?.length > 0 ? (
                    <div className="max-h-[600px] overflow-auto">
                      <MatchesTable matches={expandResults.expanded_keywords} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No keywords found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* SERP ANALYSIS TAB */}
        <TabsContent value="serp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                <Globe className="w-5 h-5" />
                SERP Analysis
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Analyze search results and find content opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSERPAnalysis} className="flex gap-4">
                <Input
                  value={serpKeyword}
                  onChange={(e) => setSerpKeyword(e.target.value)}
                  placeholder="Enter keyword to analyze..."
                  className="flex-1"
                />
                <Button type="submit" disabled={isAnalyzingSERP}>
                  {isAnalyzingSERP ? "Analyzing..." : "Analyze"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {serpResults && (
            <div className="space-y-4">
              {/* Intent & Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                    <Target className="w-5 h-5" />
                    Search Intent & SERP Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Intent</div>
                      <div className="text-xl font-bold text-black dark:text-white capitalize mt-2">
                        {serpResults.intent}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {(serpResults.intent_confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Avg DA</div>
                      <div className="text-xl font-bold text-black dark:text-white">
                        {serpResults.serp_metrics.avg_domain_authority.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {serpResults.serp_metrics.competition_level}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Avg KD</div>
                      <div className="text-xl font-bold text-black dark:text-white">
                        {serpResults.serp_metrics.avg_keyword_difficulty.toFixed(0)}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Total Traffic</div>
                      <div className="text-xl font-bold text-black dark:text-white">
                        {serpResults.serp_metrics.total_competitor_traffic.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Diversity</div>
                      <div className="text-xl font-bold text-black dark:text-white">
                        {serpResults.serp_metrics.serp_diversity}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">unique domains</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Organic Results */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-black dark:text-white">
                    Top Organic Results ({serpResults.total_organic_results})
                  </CardTitle>
                  {serpResults.organic_results?.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => exportToCSV(serpResults.organic_results, `serp-${serpKeyword}.csv`)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {serpResults.organic_results?.length > 0 ? (
                    serpResults.organic_results.slice(0, 20).map((result, idx) => (
                      <div 
                        key={idx} 
                        className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="text-black dark:text-white">#{result.position}</Badge>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                DA: {result.domain_authority}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                KD: {result.keyword_difficulty}
                              </span>
                              {result.traffic > 0 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Traffic: {result.traffic.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline block mb-1"
                            >
                              {result.title}
                            </a>
                            <div className="text-sm text-green-600 dark:text-green-400 mb-2">
                              {result.domain}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {result.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No organic results found</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Content Opportunities */}
              {serpResults.content_opportunities && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <TrendingUp className="w-5 h-5" />
                      Content Opportunities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {serpResults.content_opportunities.high_volume_keywords?.length > 0 && (
                        <AccordionItem value="high-volume">
                          <AccordionTrigger className="text-black dark:text-white">
                            High Volume Keywords ({serpResults.content_opportunities.high_volume_keywords.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2">
                              {serpResults.content_opportunities.high_volume_keywords.map((kw, i) => (
                                <Badge key={i} variant="secondary" className="text-black dark:text-white">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {serpResults.content_opportunities.low_competition_keywords?.length > 0 && (
                        <AccordionItem value="low-competition">
                          <AccordionTrigger className="text-black dark:text-white">
                            Low Competition Keywords ({serpResults.content_opportunities.low_competition_keywords.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2">
                              {serpResults.content_opportunities.low_competition_keywords.map((kw, i) => (
                                <Badge key={i} variant="outline" className="text-black dark:text-white">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}

                      {serpResults.content_opportunities.semantic_clusters?.length > 0 && (
                        <AccordionItem value="clusters">
                          <AccordionTrigger className="text-black dark:text-white">
                            Semantic Clusters ({serpResults.content_opportunities.semantic_clusters.length})
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="flex flex-wrap gap-2">
                              {serpResults.content_opportunities.semantic_clusters.map((cluster, i) => (
                                cluster && (
                                  <Badge key={i} className="text-black dark:text-white">
                                    {cluster}
                                  </Badge>
                                )
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>

                    <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                        Total Opportunity Score: {serpResults.content_opportunities.total_opportunity_score}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Related Searches */}
              {serpResults.related_searches?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <Layers className="w-5 h-5" />
                      Related Searches
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {serpResults.related_searches.map((term, idx) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer text-black dark:text-white"
                          onClick={() => {
                            setSerpKeyword(term);
                            // Trigger analysis with new keyword
                            setTimeout(() => {
                              document.querySelector<HTMLFormElement>('form')?.requestSubmit();
                            }, 100);
                          }}
                        >
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Recommendations */}
              {serpResults.ai_recommendations?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                      <Lightbulb className="w-5 h-5" />
                      AI Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {serpResults.ai_recommendations.map((rec, idx) => (
                        <li 
                          key={idx} 
                          className="flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-3 rounded transition-colors"
                        >
                          <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm flex-shrink-0">
                            {idx + 1}
                          </div>
                          <p className="text-sm text-black dark:text-white">{rec}</p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}