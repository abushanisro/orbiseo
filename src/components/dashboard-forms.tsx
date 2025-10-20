"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  searchSimilarKeywords,
  type SearchState,
  type AnalysisState,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, FileText } from "lucide-react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, Firestore } from "firebase/firestore";

interface DashboardFormsProps {
    onAnalyze: (formData: FormData) => void;
    isAnalyzing: boolean;
    analysisState: AnalysisState;
    setLoginPromptOpen: (open: boolean) => void;
}

export function DashboardForms({ onAnalyze, isAnalyzing, setLoginPromptOpen }: DashboardFormsProps) {
  const { toast } = useToast();
  const [isSearching, startSearchTransition] = useTransition();

  const [searchState, setSearchState] = useState<SearchState>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [keywords, setKeywords] = useState("");
  const { user } = useUser();
  const firestore = useFirestore();
  
  useEffect(() => {
    if (searchState?.error === 'LOGIN_REQUIRED') {
      setLoginPromptOpen(true);
    }
  }, [searchState, setLoginPromptOpen]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("query") as string;

    if (!user) {
      setLoginPromptOpen(true);
      return;
    }
    formData.append('uid', user.uid);

    startSearchTransition(async () => {
      const result = await searchSimilarKeywords(searchState, formData);
      if (result?.error && result.error !== 'LOGIN_REQUIRED') {
        toast({
          variant: "destructive",
          title: "Search Failed",
          description: result.error,
        });
      } else if (!result?.error) {
        // Save to history on successful search
        const historyCollection = collection(firestore as Firestore, 'users', user.uid, 'search_history');
        try {
          await addDoc(historyCollection, {
              query: query,
              timestamp: serverTimestamp(),
              userId: user.uid,
          });
        } catch (historyError: any) {
          // Log history error but don't block the user from seeing results
          console.error("Failed to save search history:", historyError);
        }
      }
      setSearchState(result);
    });
  };

  const handleAnalysis = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    onAnalyze(formData);
  }

  return (
    <>
      <Card>
        <form onSubmit={handleSearch}>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <span>Semantic Keyword Search</span>
            </CardTitle>
            <CardDescription>
                Find semantically similar keywords from a vector database.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Input
                name="query" 
                placeholder="e.g. best EV brands" 
                required 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
            />
            </CardContent>
            <CardFooter>
            <Button type="submit" disabled={isSearching} variant="secondary" className="w-full">
                {isSearching ? "Searching..." : "Find Similar Keywords"}
            </Button>
            </CardFooter>
        </form>
      </Card>

      <SearchResults results={searchState?.matches} />
      
      <Card>
        <form onSubmit={handleAnalysis}>
            <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>Keyword Input</span>
            </CardTitle>
            <CardDescription>
                Enter a list of keywords, one per line, to analyze and cluster.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Textarea
                name="keywords"
                placeholder="e.g.
best electric car in India
affordable EVs for city driving
Tesla competitors in India"
                className="min-h-48 resize-y"
                required
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={isAnalyzing}
            />
            </CardContent>
            <CardFooter>
            <Button type="submit" disabled={isAnalyzing} className="w-full">
                {isAnalyzing ? "Analyzing..." : "Analyze Keywords"}
                <Sparkles className="ml-2 h-4 w-4" />
            </Button>
            </CardFooter>
        </form>
      </Card>
    </>
  );
}


function SearchResults({ results }: { results: string[] | undefined }) {
  if (!results) return null;
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No similar keywords found.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {results.map((match, i) => (
            <Badge key={i} variant="secondary">{match}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
