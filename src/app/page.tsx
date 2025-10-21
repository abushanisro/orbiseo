'use client';

import React, { useTransition, useActionState, useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, Tag, Building, Search, FileText, BarChart, AlertTriangle, 
  CheckCircle2, Lightbulb, Target, TrendingUp, Layout, ChevronDown, 
  ChevronUp, Copy, Download, Info, XCircle, Zap, AlertCircle
} from 'lucide-react';
import { crawlUrlAction, type CrawlState } from '@/app/actions';
import { LoginPromptDialog } from '@/components/login-prompt-dialog';
import { useUser } from '@/firebase';

const initialState: CrawlState = null;

interface SemanticGap {
  gap_type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affected_topics: string[];
  solution: string;
  recommended_keywords?: string[];
  content_suggestions?: string[];
}

export default function AiCrawlPage() {
  const [state, formAction] = useActionState(crawlUrlAction, initialState);
  const [isCrawling, startCrawlTransition] = useTransition();
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [expandedGap, setExpandedGap] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { user } = useUser();

  useEffect(() => {
    if (state?.error === 'LOGIN_REQUIRED') {
      setLoginPromptOpen(true);
    }
    if (state) {
      console.log('[Frontend] Full state:', JSON.stringify(state, null, 2));
    }
  }, [state]);

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (!user) {
      setLoginPromptOpen(true);
      return;
    }
    formData.append('uid', user.uid);
    startCrawlTransition(() => {
      formAction(formData);
    });
  };

  const hasResults = state && !state.error && 
    (state.entities?.length || state.tags?.length || state.keywords?.length);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const exportGapsToJSON = () => {
    if (!state) return;
    const exportData = {
      url: state.url ?? 'Unknown',
      title: state.title ?? 'No Title',
      analyzed_at: new Date().toISOString(),
      metrics: {
        content_quality_score: state.content_quality_score ?? 0,
        seo_score: state.seo_score ?? 0,
        readability_score: state.readability_score ?? 0,
        topic_relevance_score: state.topic_relevance_score ?? 0,
        word_count: state.word_count ?? 0
      },
      semantic_gaps: semanticGaps,
      content_gaps: state.content_gaps ?? [],
      recommended_topics: state.recommended_topics ?? [],
      keywords: state.keywords ?? [],
      entities: state.entities ?? [],
      tags: state.tags ?? []
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `content-analysis-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportActionableReport = () => {
    if (!state) return;
    
    let markdown = `# Content Analysis Report\n\n`;
    markdown += `**URL:** ${state.url ?? 'Unknown'}\n`;
    markdown += `**Title:** ${state.title ?? 'No Title'}\n`;
    markdown += `**Analyzed:** ${new Date().toLocaleDateString()}\n\n`;
    markdown += `## Executive Summary\n\n`;
    markdown += `- **Content Quality:** ${((state.content_quality_score ?? 0) * 100).toFixed(0)}%\n`;
    markdown += `- **SEO Score:** ${((state.seo_score ?? 0) * 100).toFixed(0)}%\n`;
    markdown += `- **Readability:** ${((state.readability_score ?? 0) * 100).toFixed(0)}%\n`;
    markdown += `- **Word Count:** ${state.word_count ?? 0}\n`;
    markdown += `- **Issues Found:** ${semanticGaps.length} (${highPriorityGaps} high, ${mediumPriorityGaps} medium, ${lowPriorityGaps} low)\n\n`;
    
    if (highPriorityGaps > 0) {
      markdown += `## High Priority Issues (${highPriorityGaps})\n\n`;
      const highGaps = semanticGaps.filter(g => g.severity === 'high');
      highGaps.forEach((gap, idx) => {
        markdown += `### ${idx + 1}. ${gap.description}\n\n`;
        markdown += `**Affected Areas:** ${gap.affected_topics.join(', ')}\n\n`;
        markdown += `**Solution:**\n${gap.solution}\n\n`;
        if (gap.content_suggestions && gap.content_suggestions.length > 0) {
          markdown += `**Action Steps:**\n`;
          gap.content_suggestions.forEach(s => markdown += `- [ ] ${s}\n`);
          markdown += `\n`;
        }
        if (gap.recommended_keywords && gap.recommended_keywords.length > 0) {
          markdown += `**Keywords to Add:** ${gap.recommended_keywords.join(', ')}\n\n`;
        }
        markdown += `---\n\n`;
      });
    }
    
    if (mediumPriorityGaps > 0) {
      markdown += `## ⚠️ Medium Priority Issues (${mediumPriorityGaps})\n\n`;
      const medGaps = semanticGaps.filter(g => g.severity === 'medium');
      medGaps.forEach((gap, idx) => {
        markdown += `### ${idx + 1}. ${gap.description}\n\n`;
        markdown += `**Solution:** ${gap.solution}\n\n`;
        markdown += `---\n\n`;
      });
    }
    
    if (lowPriorityGaps > 0) {
      markdown += `## ℹ️ Low Priority Improvements (${lowPriorityGaps})\n\n`;
      const lowGaps = semanticGaps.filter(g => g.severity === 'low');
      lowGaps.forEach((gap, idx) => {
        markdown += `- ${gap.description}: ${gap.solution}\n`;
      });
      markdown += `\n`;
    }
    
    markdown += `## Detailed Metrics\n\n`;
    markdown += `- **Topics Covered:** ${state.key_topics?.length ?? 0}/8\n`;
    markdown += `- **Topic Relevance:** ${((state.topic_relevance_score ?? 0) * 100).toFixed(0)}%\n`;
    markdown += `- **Semantic Clusters:** ${Object.keys(state.semantic_clusters ?? {}).length}\n\n`;
    
    if (state.recommended_topics && state.recommended_topics.length > 0) {
      markdown += `## Recommended Topics to Cover\n\n`;
      state.recommended_topics.forEach(topic => markdown += `- ${topic}\n`);
      markdown += `\n`;
    }
    
    markdown += `## Top Keywords\n\n`;
    if (state.keywords && state.keywords.length > 0) {
      state.keywords.slice(0, 15).forEach(kw => markdown += `- ${kw}\n`);
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `action-plan-${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const severityConfig = {
    high: { 
      color: 'destructive' as const,
      bgColor: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900', 
      textColor: 'text-red-700 dark:text-red-300',
      badgeColor: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-800',
      icon: XCircle
    },
    medium: { 
      color: 'default' as const,
      bgColor: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900', 
      textColor: 'text-yellow-700 dark:text-yellow-300',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-800',
      icon: AlertTriangle
    },
    low: { 
      color: 'secondary' as const,
      bgColor: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900', 
      textColor: 'text-blue-700 dark:text-blue-300',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
      icon: Info
    }
  };

  const gapTypeIcons: Record<string, any> = {
    missing_topic: Target,
    shallow_coverage: TrendingUp,
    structural: Layout,
    missing_subtopic: Lightbulb
  };

  const semanticGaps: SemanticGap[] = React.useMemo(() => {
    if (!state?.semantic_gaps) {
      console.log('[Frontend] No semantic_gaps in state');
      return [];
    }
    
    console.log('[Frontend] Raw semantic_gaps:', state.semantic_gaps);
    
    if (Array.isArray(state.semantic_gaps)) {
      console.log(`[Frontend] Found ${state.semantic_gaps.length} semantic gaps`);
      return state.semantic_gaps as SemanticGap[];
    }
    
    if (typeof state.semantic_gaps === 'object' && state.semantic_gaps !== null) {
      console.log('[Frontend] Converting object to array');
      return Object.values(state.semantic_gaps) as SemanticGap[];
    }
    
    console.log('[Frontend] Unrecognized semantic_gaps format:', state.semantic_gaps);
    return [];
  }, [state?.semantic_gaps]);

  const highPriorityGaps = semanticGaps.filter(g => g.severity === 'high').length;
  const mediumPriorityGaps = semanticGaps.filter(g => g.severity === 'medium').length;
  const lowPriorityGaps = semanticGaps.filter(g => g.severity === 'low').length;

  useEffect(() => {
    if (hasResults) {
      console.log('[Frontend] Analysis Results:', {
        hasSemanticGaps: !!state?.semantic_gaps,
        gapsCount: semanticGaps.length,
        breakdown: { high: highPriorityGaps, medium: mediumPriorityGaps, low: lowPriorityGaps },
        wordCount: state?.word_count,
        qualityScore: state?.content_quality_score,
        seoScore: state?.seo_score,
        rawResponse: state
      });
    }
  }, [hasResults, semanticGaps, state]);

  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <div className="container mx-auto flex-1 space-y-6 sm:space-y-8 lg:space-y-12 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        {/* Hero Section - Responsive */}
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                AI Content Analyzer
              </h1>
            </div>
            <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl lg:max-w-2xl mx-auto leading-relaxed px-4 sm:px-0">
              NLP-powered semantic analysis with gap detection and actionable insights
            </p>
          </div>

          {/* Export Actions - Responsive */}
          {hasResults && semanticGaps.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 pt-4">
              <Button variant="outline" size="sm" onClick={exportActionableReport} className="w-full sm:w-auto">
                <FileText className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Download Action Plan</span>
                <span className="sm:hidden">Action Plan</span>
              </Button>
              <Button variant="outline" size="sm" onClick={exportGapsToJSON} className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export Analysis</span>
                <span className="sm:hidden">Export</span>
              </Button>
            </div>
          )}
        </div>

        {/* Main Content - Responsive Layout */}
        <div className="w-full max-w-xs sm:max-w-2xl lg:max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* URL Input Card - Enhanced Design */}
          <Card className="shadow-lg">
            <form onSubmit={handleFormSubmit}>
              <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6">
                <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold">Enter URL to Analyze</CardTitle>
                <CardDescription className="text-xs sm:text-sm lg:text-base text-muted-foreground max-w-sm sm:max-w-md mx-auto">
                  Get comprehensive semantic analysis with NLP gap detection and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 lg:px-8">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input
                    name="url"
                    type="url"
                    placeholder="https://example.com/your-content"
                    required
                    disabled={isCrawling}
                    className="pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-center pt-4 sm:pt-6 pb-6 sm:pb-8 px-4 sm:px-6">
                <Button
                  type="submit"
                  disabled={isCrawling}
                  size="default"
                  className="w-full sm:w-auto px-6 sm:px-8 py-2 sm:py-3"
                >
                  {isCrawling ? (
                    <>
                      <Zap className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3 animate-pulse" />
                      <span className="text-sm sm:text-base">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-3" />
                      <span className="text-sm sm:text-base">Analyze Content</span>
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Loading State */}
          {isCrawling && (
            <Card className="shadow-lg border-0">
              <ResultsSkeleton />
            </Card>
          )}

          {/* Error States */}
          {state?.error && state.error !== 'LOGIN_REQUIRED' && (
            <Alert variant="destructive" className="shadow-sm mx-4 sm:mx-0">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm sm:text-base">Analysis Failed</AlertTitle>
              <AlertDescription className="text-sm">{state.error}</AlertDescription>
            </Alert>
          )}

          {state?.warning && (
            <Alert variant="default" className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-900 shadow-sm mx-4 sm:mx-0">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertTitle className="text-yellow-900 dark:text-yellow-100 text-sm sm:text-base">Warning</AlertTitle>
              <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">{state.warning}</AlertDescription>
            </Alert>
          )}

          {/* Results Section */}
          {hasResults && (
            <div className="space-y-6 sm:space-y-8">
              {/* Metrics Overview */}
              <div className="text-center space-y-3 sm:space-y-4 px-4 sm:px-0">
                <h2 className="text-xl sm:text-2xl font-semibold text-foreground">Analysis Results</h2>
                <p className="text-sm sm:text-base text-muted-foreground">Comprehensive content analysis and recommendations</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-0">
                <MetricCard 
                  title="Content Quality" 
                  value={(state.content_quality_score ?? 0) * 100} 
                  target={70}
                  suffix="%"
                  icon={BarChart}
                  color="blue"
                />
                <MetricCard 
                  title="SEO Score" 
                  value={(state.seo_score ?? 0) * 100} 
                  target={70}
                  suffix="%"
                  icon={TrendingUp}
                  color="green"
                />
                <MetricCard 
                  title="Word Count" 
                  value={state.word_count ?? 0} 
                  target={1200}
                  icon={FileText}
                  color="purple"
                />
                <MetricCard 
                  title="Issues Found" 
                  value={semanticGaps.length} 
                  severity={highPriorityGaps > 0 ? 'high' : mediumPriorityGaps > 0 ? 'medium' : 'low'}
                  icon={AlertTriangle}
                  color="red"
                />
              </div>

              {semanticGaps.length > 0 && (
                <Alert className={
                  highPriorityGaps > 0 
                    ? "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900"
                    : "border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-900"
                }>
                  <AlertCircle className={`h-4 w-4 ${highPriorityGaps > 0 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />
                  <AlertTitle className={`font-semibold ${highPriorityGaps > 0 ? 'text-red-900 dark:text-red-100' : 'text-orange-900 dark:text-orange-100'}`}>
                    {highPriorityGaps > 0 ? 'Critical Issues Detected' : 'Improvements Recommended'}
                  </AlertTitle>
                  <AlertDescription className={highPriorityGaps > 0 ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}>
                    Found <strong>{highPriorityGaps} high-priority</strong>,{' '}
                    <strong>{mediumPriorityGaps} medium-priority</strong>, and{' '}
                    <strong>{lowPriorityGaps} low-priority</strong> gaps. Review the Gaps tab for detailed action items.
                  </AlertDescription>
                </Alert>
              )}

              {semanticGaps.length === 0 && hasResults && (
                <Alert variant="default" className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100">No Gaps Detected</AlertTitle>
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    The content appears to cover the target topic (cryptocurrency) comprehensively. 
                    Consider analyzing a different URL or adjusting the target topic in the backend configuration for more specific gap detection.
                  </AlertDescription>
                </Alert>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto">
                  <TabsTrigger value="overview" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
                    <Info className="h-4 w-4" />
                    <span>Overview</span>
                  </TabsTrigger>
                  <TabsTrigger value="gaps" className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm ${semanticGaps.length > 0 && highPriorityGaps > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    <AlertTriangle className="h-4 w-4" />
                    <span className="whitespace-nowrap">Gaps ({semanticGaps.length})</span>
                  </TabsTrigger>
                  <TabsTrigger value="keywords" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
                    <Search className="h-4 w-4" />
                    <span className="whitespace-nowrap"><span className="hidden sm:inline">Keywords </span>({state.keywords?.length ?? 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="entities" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
                    <Building className="h-4 w-4" />
                    <span className="whitespace-nowrap"><span className="hidden sm:inline">Entities </span>({state.entities?.length ?? 0})</span>
                  </TabsTrigger>
                  <TabsTrigger value="tags" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
                    <Tag className="h-4 w-4" />
                    <span className="whitespace-nowrap"><span className="hidden sm:inline">Tags </span>({state.tags?.length ?? 0})</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Page Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {state.title && (
                        <div>
                          <p className="text-sm text-muted-foreground">Title</p>
                          <p className="font-medium text-lg">{state.title}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">URL</p>
                        <p className="text-sm break-all text-blue-600 dark:text-blue-400">{state.url}</p>
                      </div>
                      {state.content_summary && (
                        <div>
                          <p className="text-sm text-muted-foreground">Content Summary</p>
                          <p className="text-sm leading-relaxed">{state.content_summary}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t dark:border-gray-700">
                        <div>
                          <p className="text-xs text-muted-foreground">Readability</p>
                          <p className="text-lg font-semibold">{((state.readability_score ?? 0) * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Topic Relevance</p>
                          <p className="text-lg font-semibold">{((state.topic_relevance_score ?? 0) * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Topics Covered</p>
                          <p className="text-lg font-semibold">{state.key_topics?.length ?? 0}/8</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Clusters</p>
                          <p className="text-lg font-semibold">{Object.keys(state.semantic_clusters ?? {}).length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {semanticGaps.length > 0 && (
                    <Card className="border-amber-200 dark:border-amber-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                          <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          Quick Issues Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {semanticGaps.slice(0, 3).map((gap, idx) => (
                          <div key={idx} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                            <Badge variant={severityConfig[gap.severity].color} className="mt-0.5">
                              {gap.severity}
                            </Badge>
                            <p className="text-sm flex-1">{gap.description}</p>
                          </div>
                        ))}
                        {semanticGaps.length > 3 && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => setActiveTab('gaps')}
                          >
                            View All {semanticGaps.length} Issues →
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {state.semantic_clusters && Object.keys(state.semantic_clusters).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Semantic Clusters</CardTitle>
                        <CardDescription>Keyword groupings by topic</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(state.semantic_clusters).map(([cluster, keywords]) => (
                          <div key={cluster} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                            <h4 className="font-semibold text-sm mb-2">{cluster}</h4>
                            <div className="flex flex-wrap gap-1">
                              {(keywords as string[]).map((kw, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {kw}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {state.recommended_topics && state.recommended_topics.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-600" />
                          Recommended Topics to Add
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {state.recommended_topics.map((topic, idx) => (
                            <Badge key={idx} variant="outline" className="text-sm">
                              <Target className="h-3 w-3 mr-1" />
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="gaps" className="space-y-4 mt-6">
                  <GapAnalysisSection 
                    gaps={semanticGaps}
                    expandedGap={expandedGap}
                    setExpandedGap={setExpandedGap}
                    copiedIndex={copiedIndex}
                    copyToClipboard={copyToClipboard}
                    severityConfig={severityConfig}
                    gapTypeIcons={gapTypeIcons}
                  />
                </TabsContent>

                <TabsContent value="keywords" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Extracted Keywords</CardTitle>
                      <CardDescription>
                        SEO keywords and important phrases found in the content
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {state.keywords && state.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.keywords.map((keyword, index) => (
                            <Badge key={index} variant="outline" className="text-sm">
                              <Search className="h-3 w-3 mr-1" />
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No keywords found</p>
                      )}
                    </CardContent>
                  </Card>

                  {state.keyword_density && Object.keys(state.keyword_density).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Keyword Density</CardTitle>
                        <CardDescription>Frequency analysis of top keywords</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {Object.entries(state.keyword_density)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .map(([keyword, density]) => (
                          <div key={keyword} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{keyword}</span>
                              <span className="text-muted-foreground">{(density as number).toFixed(2)}%</span>
                            </div>
                            <Progress value={Math.min((density as number) * 10, 100)} className="h-2" />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="entities" className="space-y-3 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Named Entities</CardTitle>
                      <CardDescription>
                        People, organizations, products, and key concepts identified
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {state.entities && state.entities.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.entities.map((entity, index) => (
                            <Badge key={index} variant="default" className="text-sm">
                              <Building className="h-3 w-3 mr-1" />
                              {entity}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No entities found</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tags" className="space-y-3 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Content Tags</CardTitle>
                      <CardDescription>
                        Categorical tags describing main topics and themes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {state.tags && state.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {state.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-sm">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No tags found</p>
                      )}
                    </CardContent>
                  </Card>

                  {state.key_topics && state.key_topics.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Key Topics Identified</CardTitle>
                        <CardDescription>Main topics covered in the content</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {state.key_topics.map((topic, idx) => (
                            <Badge key={idx} variant="default" className="text-sm">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!isCrawling && !hasResults && !state?.error && <EmptyState />}
        </div>
        
        <LoginPromptDialog open={loginPromptOpen} onOpenChange={setLoginPromptOpen} />
      </div>
    </Suspense>
  );
}

function MetricCard({ 
  title, 
  value, 
  target, 
  suffix = '', 
  icon: Icon, 
  color = 'blue',
  severity
}: { 
  title: string; 
  value: number; 
  target?: number; 
  suffix?: string; 
  icon: any; 
  color?: string;
  severity?: 'high' | 'medium' | 'low';
}) {
  const percentage = target ? (value / target) * 100 : null;
  const isGood = percentage ? percentage >= 100 : value === 0;
  
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: severity === 'high' ? 'text-red-600 dark:text-red-400' : severity === 'medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${colorClasses[color as keyof typeof colorClasses]}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(0) : value}{suffix}
        </div>
        {target && (
          <>
            <Progress 
              value={Math.min(percentage || 0, 100)} 
              className="h-1.5 mt-2" 
            />
            <p className="text-xs text-muted-foreground mt-1">
              Target: {target}{suffix} {isGood && '✓'}
            </p>
          </>
        )}
        {severity && (
          <p className="text-xs text-muted-foreground mt-1">
            {severity === 'high' ? 'Needs attention' : severity === 'medium' ? 'Monitor' : 'Looking good'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GapAnalysisSection({ 
  gaps, 
  expandedGap, 
  setExpandedGap, 
  copiedIndex, 
  copyToClipboard,
  severityConfig,
  gapTypeIcons
}: any) {
  if (!gaps || gaps.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3 dark:text-green-400" />
        <CardTitle>No Critical Gaps Found</CardTitle>
        <CardDescription className="mt-2">
          Your content meets quality standards. Continue optimizing for better results!
        </CardDescription>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {gaps.map((gap: SemanticGap, index: number) => {
        const config = severityConfig[gap.severity];
        const GapIcon = gapTypeIcons[gap.gap_type] || Target;
        const SeverityIcon = config.icon;
        const isExpanded = expandedGap === index;

        return (
          <Card key={index} className={`${config.bgColor} border-2`}>
            <CardHeader 
              className="cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => setExpandedGap(isExpanded ? null : index)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <GapIcon className={`h-5 w-5 mt-0.5 ${config.textColor}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={config.color} className={`${config.badgeColor} text-xs font-semibold`}>
                        <SeverityIcon className="h-3 w-3 mr-1" />
                        {gap.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {gap.gap_type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-base mb-1">{gap.description}</CardTitle>
                    <CardDescription className="text-sm">
                      <strong>Affects:</strong> {gap.affected_topics.join(', ')}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4 pt-0">
                <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 border-2 border-green-200 dark:border-green-800">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0 dark:text-green-400" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-2 text-green-900 dark:text-green-100">
                        Recommended Solution
                      </h4>
                      <p className="text-sm text-gray-800 leading-relaxed dark:text-gray-200">{gap.solution}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(gap.solution, index);
                      }}
                      className="flex-shrink-0"
                    >
                      {copiedIndex === index ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {gap.content_suggestions && gap.content_suggestions.length > 0 && (
                  <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 border-2 border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Content Suggestions</h4>
                    </div>
                    <ul className="space-y-2">
                      {gap.content_suggestions.map((suggestion: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-600 mt-0.5 font-bold dark:text-amber-400">→</span>
                          <span className="text-gray-800 dark:text-gray-200">{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {gap.recommended_keywords && gap.recommended_keywords.length > 0 && (
                  <div className="bg-white/70 dark:bg-gray-800/70 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Search className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Keywords to Include</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {gap.recommended_keywords.map((keyword: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-24" />
              ))}
            </div>
            <div className="space-y-3 mt-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex h-full min-h-[30vh] sm:min-h-[40vh] flex-col items-center justify-center p-4 sm:p-6 lg:p-8 text-center bg-card/50 border-dashed mx-4 sm:mx-0">
      <Globe className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-3 sm:mb-4" />
      <CardTitle className="text-base sm:text-lg lg:text-xl font-semibold">Ready to Analyze</CardTitle>
      <CardDescription className="mt-2 max-w-sm sm:max-w-md text-xs sm:text-sm lg:text-base px-2 sm:px-0">
        Enter any publicly accessible URL to get comprehensive semantic analysis, gap detection, and actionable optimization recommendations powered by NLP
      </CardDescription>
      <div className="mt-4 sm:mt-6 flex flex-wrap gap-1.5 sm:gap-2 justify-center px-2 sm:px-0">
        <Badge variant="outline" className="text-xs">Semantic Analysis</Badge>
        <Badge variant="outline" className="text-xs">Gap Detection</Badge>
        <Badge variant="outline" className="text-xs">SEO Optimization</Badge>
        <Badge variant="outline" className="text-xs">Content Suggestions</Badge>
        <Badge variant="outline" className="text-xs">NLP</Badge>
      </div>
    </Card>
  );
}