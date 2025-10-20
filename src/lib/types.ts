export type Cluster = Record<string, string[]>;

export type Suggestion = string;

export type AnalysisResult = {
  clusters: Cluster;
  suggestions: Suggestion[];
};

export type SearchResult = {
  matches: string[];
};
