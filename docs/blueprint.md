# **App Name**: Semantic SEO Analyzer

## Core Features:

- Keyword Collection: Collect keywords from various sources (CSV upload, Google Keyword Planner, etc.)
- Embedding Generation: Generate embeddings for each keyword using the Gemini API (Google's Vertex AI models) to represent semantic meaning.  This process relies on a tool to pick the ideal embedding dimension size.
- Vector Database Storage: Store keyword embeddings in a vector database (Firestore) for semantic search.
- Semantic Querying: Query the vector database with a new keyword or topic to find semantically similar keywords.
- Keyword Clustering: Use KMeans clustering on keyword embeddings to group related keywords by intent, leveraging Gemini to give human-readable names to the cluster. This requires the use of a tool to determine a usable cluster count.
- AI Content Suggestions: Feed semantic clusters into Gemini to generate AI-driven content suggestions based on related topics. The generation of a content suggestion relies on a tool that verifies the result of the prompt.
- Dashboard UI: Build a dashboard UI with Next.js to display keyword clusters, search results, and content suggestions.

## Style Guidelines:

- Primary color: A vibrant blue (#29ABE2) to evoke trust and intelligence, suitable for an SEO tool.
- Background color: Light gray (#F0F2F5) to ensure comfortable readability and a clean interface.
- Accent color: A contrasting orange (#FF9933) to highlight important actions and elements.
- Body and headline font: 'Inter', a grotesque-style sans-serif font, for its modern, neutral, machined look suitable for both headlines and body text.
- Use clear, professional icons to represent different data points and functionalities within the tool.
- A clean, organized layout that allows users to easily navigate and understand the data. Use clear section headings and a logical flow.
- Subtle animations on data updates and AI content generation to provide feedback to the user.