from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List, Optional, Dict
import re
import time
import requests
from bs4 import BeautifulSoup
from collections import Counter, defaultdict
from urllib.parse import urlparse
import logging
import os
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Get CORS origins from environment variable
cors_origins = os.getenv("CORS_ORIGINS", '["*"]')
try:
    import json
    origins = json.loads(cors_origins)
except (json.JSONDecodeError, TypeError):
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CrawlRequest(BaseModel):
    url: HttpUrl
    max_content_length: int = 50000
    extract_entities: bool = True
    extract_tags: bool = True
    extract_keywords: bool = True
    analyze_competitors: bool = False
    perform_gap_analysis: bool = True
    auto_index_pinecone: bool = False
    target_topic: Optional[str] = "cryptocurrency"


class SemanticGap(BaseModel):
    gap_type: str
    description: str
    severity: str
    affected_topics: List[str]
    solution: str
    recommended_keywords: List[str] = []
    content_suggestions: List[str] = []


class CrawlResponse(BaseModel):
    url: str
    title: Optional[str] = None
    word_count: int = 0
    entities: List[str] = []
    tags: List[str] = []
    keywords: List[str] = []
    key_topics: List[str] = []
    content_summary: Optional[str] = None
    semantic_clusters: Dict[str, List[str]] = {}
    topic_relevance_score: float = 0.0
    content_quality_score: float = 0.0
    content_gaps: List[str] = []
    semantic_gaps: List[SemanticGap] = []
    missing_entities: List[str] = []
    recommended_topics: List[str] = []
    seo_score: float = 0.0
    readability_score: float = 0.0
    keyword_density: Dict[str, float] = {}
    crawl_timestamp: float = 0.0
    indexed_to_pinecone: bool = False
    error: Optional[str] = None
    warning: Optional[str] = None


CRYPTO_TAXONOMY = {
    "Fundamentals": {
        "keywords": [
            "blockchain", "bitcoin", "ethereum", "cryptocurrency", "decentralized",
            "consensus", "mining", "proof of work", "proof of stake", "distributed ledger",
            "cryptography", "hash", "node", "network"
        ],
        "subtopics": [
            "What is blockchain", "How crypto works", "Consensus mechanisms",
            "Cryptography basics", "Network architecture"
        ],
        "importance": "critical",
        "min_word_count": 150,
    },
    "Trading": {
        "keywords": [
            "trading", "exchange", "buy", "sell", "order", "market", "limit", "stop loss",
            "candlestick", "technical analysis", "volume", "liquidity", "volatility",
            "arbitrage", "portfolio", "token swap", "conversion", "swap"
        ],
        "subtopics": [
            "Trading strategies", "Chart patterns", "Risk management", "Order types",
            "Market analysis", "Token swap process", "Conversion mechanics"
        ],
        "importance": "high",
        "min_word_count": 100,
    },
    "DeFi": {
        "keywords": [
            "defi", "yield", "liquidity", "amm", "dex", "lending", "borrowing", "staking",
            "farming", "protocol", "smart contract", "uniswap", "compound", "aave"
        ],
        "subtopics": [
            "Liquidity pools", "Yield farming", "Lending protocols", "DEX mechanics",
            "Impermanent loss"
        ],
        "importance": "high",
        "min_word_count": 100,
    },
    "Security": {
        "keywords": [
            "wallet", "private key", "seed phrase", "security", "custody", "cold storage",
            "hardware wallet", "2fa", "phishing", "multisig", "recovery", "backup"
        ],
        "subtopics": [
            "Wallet security", "Key management", "Scam prevention", "Best practices",
            "Recovery methods"
        ],
        "importance": "critical",
        "min_word_count": 100,
    },
    "NFTs": {
        "keywords": [
            "nft", "non-fungible", "collectible", "metadata", "opensea", "mint", "royalty",
            "erc-721", "erc-1155", "digital art"
        ],
        "subtopics": [
            "NFT standards", "Minting process", "NFT marketplaces", "Use cases", "Valuation"
        ],
        "importance": "medium",
        "min_word_count": 80,
    },
    "Regulation": {
        "keywords": [
            "regulation", "compliance", "kyc", "aml", "tax", "legal", "sec", "license",
            "government", "law"
        ],
        "subtopics": [
            "Regulatory landscape", "Tax implications", "Compliance requirements",
            "Legal considerations"
        ],
        "importance": "high",
        "min_word_count": 100,
    },
    "Technology": {
        "keywords": [
            "smart contract", "solidity", "evm", "layer 2", "scalability", "sharding",
            "rollup", "oracle", "consensus", "validator"
        ],
        "subtopics": [
            "Smart contracts", "Scaling solutions", "Layer 2", "Cross-chain", "Oracles"
        ],
        "importance": "high",
        "min_word_count": 100,
    },
    "Economics": {
        "keywords": [
            "tokenomics", "inflation", "deflation", "supply", "distribution", "halving",
            "burning", "vesting", "market cap", "utility"
        ],
        "subtopics": [
            "Token economics", "Monetary policy", "Distribution models",
            "Incentive structures"
        ],
        "importance": "medium",
        "min_word_count": 80,
    },
}

CRYPTO_ENTITIES = [
    "Bitcoin", "BTC", "Ethereum", "ETH", "Binance", "BNB", "Cardano", "Solana",
    "Polygon", "Avalanche", "DeFi", "NFT", "DAO", "Web3", "MetaMask", "Coinbase",
    "Uniswap", "OpenSea", "Chainlink"
]

STOP_WORDS = {
    "the", "and", "for", "that", "this", "with", "from", "have", "been", "will",
    "your", "more", "when", "about", "they", "their", "which", "would", "there",
    "these", "what", "some", "other", "into", "than", "them", "could", "only",
    "over", "such", "our", "also", "where", "after", "just", "very", "even"
}


def calculate_sentence_complexity(text: str) -> float:
    """Calculate average sentence complexity using word count and word length metrics."""
    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    if not sentences:
        return 0.0

    total_complexity = 0.0
    for sentence in sentences:
        words = sentence.split()
        word_count = len(words)
        avg_word_len = sum(len(w) for w in words) / max(word_count, 1)
        complexity = (word_count / 15) + (avg_word_len / 5)
        total_complexity += min(complexity, 2.0)

    return total_complexity / len(sentences)


def extract_semantic_structure(text: str, soup: BeautifulSoup) -> Dict[str, any]:
    """Extract structural elements of the webpage for analysis."""
    structure = {
        "has_introduction": False,
        "has_conclusion": False,
        "heading_count": 0,
        "h1_count": 0,
        "h2_count": 0,
        "h3_count": 0,
        "sections": [],
        "list_count": 0,
        "image_count": 0,
        "link_count": 0,
        "internal_links": 0,
        "external_links": 0,
        "code_blocks": 0,
        "table_count": 0,
        "paragraph_count": 0,
        "avg_paragraph_length": 0,
        "has_toc": False,
    }

    h1s = soup.find_all("h1")
    h2s = soup.find_all("h2")
    h3s = soup.find_all("h3")
    structure["h1_count"] = len(h1s)
    structure["h2_count"] = len(h2s)
    structure["h3_count"] = len(h3s)
    structure["heading_count"] = len(h1s) + len(h2s) + len(h3s)
    structure["sections"] = [h.get_text().strip() for h in (h1s + h2s + h3s)[:15]]

    toc_indicators = ["table of contents", "contents", "in this article", "overview"]
    if any(indicator in text.lower()[:800] for indicator in toc_indicators):
        structure["has_toc"] = True

    intro_patterns = [
        "introduction", "overview", "what is", "getting started", "in this guide",
        "this article", "welcome to", "learn about"
    ]
    first_section = text.lower()[:600]
    structure["has_introduction"] = any(pattern in first_section for pattern in intro_patterns)

    conclusion_patterns = [
        "conclusion", "summary", "final thoughts", "in summary", "to sum up",
        "wrapping up", "key takeaways", "in closing"
    ]
    last_section = text.lower()[-600:]
    structure["has_conclusion"] = any(pattern in last_section for pattern in conclusion_patterns)

    structure["list_count"] = len(soup.find_all(["ul", "ol"]))
    structure["image_count"] = len(soup.find_all("img"))
    structure["table_count"] = len(soup.find_all("table"))
    structure["code_blocks"] = len(soup.find_all(["code", "pre"]))

    all_links = soup.find_all("a", href=True)
    structure["link_count"] = len(all_links)
    parsed_url = urlparse(str(soup))
    for link in all_links:
        href = link.get("href", "")
        if href.startswith("http"):
            link_domain = urlparse(href).netloc
            if link_domain == parsed_url.netloc:
                structure["internal_links"] += 1
            else:
                structure["external_links"] += 1
        elif href.startswith("/") or href.startswith("#"):
            structure["internal_links"] += 1

    paragraphs = soup.find_all("p")
    structure["paragraph_count"] = len(paragraphs)
    if paragraphs:
        para_lengths = [len(p.get_text().split()) for p in paragraphs]
        structure["avg_paragraph_length"] = sum(para_lengths) / len(para_lengths)

    return structure


def analyze_topic_depth(text: str, topic: str, keywords: List[str]) -> Dict[str, any]:
    """Analyze the depth of coverage for a specific topic."""
    text_lower = text.lower()
    mentions = []
    for keyword in keywords:
        pattern = rf".{{0,100}}{re.escape(keyword)}.{0,100}"
        matches = re.finditer(pattern, text_lower, re.IGNORECASE)
        mentions.extend(matches)

    total_mentions = len(mentions)
    unique_contexts = len(set(match.group() for match in mentions))
    topic_word_count = sum(len(match.group().split()) for match in mentions)

    return {
        "total_mentions": total_mentions,
        "unique_contexts": unique_contexts,
        "estimated_word_count": topic_word_count,
        "depth_score": min(topic_word_count / 100, 1.0),
    }


def perform_semantic_gap_analysis(
    text: str,
    structure: Dict,
    topics_found: Dict[str, float],
    word_count: int,
    keywords: List[str],
) -> List[SemanticGap]:
    """Perform semantic gap analysis to identify content deficiencies."""
    gaps = []
    text_lower = text.lower()
    critical_gaps = 0
    high_gaps = 0

    logger.info(f"Starting gap analysis: word_count={word_count}, topics_found={topics_found}")
    logger.info(f"Structure: {structure}")
    logger.info(f"Keywords: {keywords[:10]}")

    # Word Count Analysis
    logger.info("Checking word count")
    if word_count < 300:
        logger.info("Word count critically short (<300)")
        gaps.append(
            SemanticGap(
                gap_type="shallow_coverage",
                description=f"Content is critically short ({word_count} words). Minimum 800-1000 words recommended for comprehensive coverage.",
                severity="high",
                affected_topics=["Content Depth"],
                solution=f"Expand content by adding {800 - word_count} words. Focus on explaining concepts in detail with examples.",
                recommended_keywords=keywords[:10],
                content_suggestions=[
                    "Add detailed explanations for each main concept",
                    "Include real-world examples and use cases",
                    "Provide step-by-step guides or tutorials",
                    "Add comparison tables or feature lists",
                ],
            )
        )
        critical_gaps += 1
    elif word_count < 600:
        logger.info("Word count needs expansion (<600)")
        gaps.append(
            SemanticGap(
                gap_type="shallow_coverage",
                description=f"Content needs expansion ({word_count} words). Aim for 1000-1500 words for better depth.",
                severity="medium",
                affected_topics=["Content Depth"],
                solution=f"Add {1000 - word_count} more words of valuable, relevant information.",
                recommended_keywords=keywords[:8],
                content_suggestions=[
                    "Elaborate on key points with more detail",
                    "Add supporting data and statistics",
                    "Include expert quotes or insights",
                ],
            )
        )
        high_gaps += 1

    # Structural Gaps
    logger.info("Checking structural elements")
    if structure["h1_count"] == 0:
        logger.info("Missing H1 heading")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description="Missing H1 heading - critical for SEO and content hierarchy",
                severity="high",
                affected_topics=["SEO", "Content Structure"],
                solution="Add a clear, keyword-rich H1 heading at the top of your content",
                recommended_keywords=[],
                content_suggestions=[
                    "H1 should summarize the main topic and include primary keyword"
                ],
            )
        )
        critical_gaps += 1

    if structure["h1_count"] > 1:
        logger.info(f"Multiple H1 tags found: {structure['h1_count']}")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description=f"Multiple H1 tags found ({structure['h1_count']}). Only one H1 per page is recommended.",
                severity="medium",
                affected_topics=["SEO", "Content Structure"],
                solution="Use only one H1 for the main title, convert others to H2 or H3",
                recommended_keywords=[],
                content_suggestions=["Main title = H1, Main sections = H2, Subsections = H3"],
            )
        )
        high_gaps += 1

    if structure["heading_count"] < 3 and word_count > 400:
        logger.info(f"Insufficient headings: {structure['heading_count']}")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description=f"Insufficient headings ({structure['heading_count']}) for {word_count} words",
                severity="high",
                affected_topics=["Content Structure", "Readability"],
                solution=f"Add {max(5 - structure['heading_count'], 3)} more section headings. Aim for one heading per 150-250 words.",
                recommended_keywords=[],
                content_suggestions=[
                    "Break long sections into subsections with H2/H3 tags",
                    "Use descriptive, keyword-rich headings",
                    "Create logical content hierarchy",
                ],
            )
        )
        critical_gaps += 1

    if not structure["has_introduction"]:
        logger.info("Missing introduction section")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description="No clear introduction section detected",
                severity="high",
                affected_topics=["Content Structure", "User Experience"],
                solution="Add an introduction (100-200 words) that explains what readers will learn",
                recommended_keywords=["introduction", "overview", "guide"],
                content_suggestions=[
                    "Start with a hook that captures attention",
                    "Outline what the article covers",
                    "Explain who the content is for",
                    "Set expectations for what readers will learn",
                ],
            )
        )
        critical_gaps += 1

    if not structure["has_conclusion"]:
        logger.info("Missing conclusion section")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description="Missing conclusion or summary section",
                severity="medium",
                affected_topics=["Content Structure", "User Experience"],
                solution="Add a conclusion summarizing key points and providing next steps",
                recommended_keywords=["conclusion", "summary", "takeaways"],
                content_suggestions=[
                    "Summarize 3-5 main points",
                    "Provide actionable next steps",
                    "Include a call-to-action (CTA)",
                    "Link to related resources",
                ],
            )
        )
        high_gaps += 1

    # Topic Coverage Analysis
    logger.info("Checking topic coverage")
    for topic, data in CRYPTO_TAXONOMY.items():
        logger.info(f"Analyzing topic: {topic}")
        keywords_found = [kw for kw in data["keywords"] if kw in text_lower]
        coverage_score = len(keywords_found) / len(data["keywords"])
        depth_analysis = analyze_topic_depth(text, topic, data["keywords"])
        logger.info(
            f"Topic {topic} - Coverage: {coverage_score:.2f}, Depth: {depth_analysis['estimated_word_count']} words"
        )

        if coverage_score == 0 and data["importance"] in ["critical", "high"]:
            logger.info(f"Missing topic: {topic}")
            gaps.append(
                SemanticGap(
                    gap_type="missing_topic",
                    description=f"Critical topic '{topic}' is completely absent",
                    severity="high" if data["importance"] == "critical" else "medium",
                    affected_topics=[topic],
                    solution=f"Add a dedicated section about {topic} ({data['min_word_count']}+ words)",
                    recommended_keywords=data["keywords"][:6],
                    content_suggestions=[
                        f"Explain {subtopic}" for subtopic in data["subtopics"][:3]
                    ],
                )
            )
            if data["importance"] == "critical":
                critical_gaps += 1
            else:
                high_gaps += 1
        elif 0 < coverage_score < 0.25:
            logger.info(f"Shallow coverage for topic: {topic}")
            missing_kws = [kw for kw in data["keywords"] if kw not in text_lower]
            gaps.append(
                SemanticGap(
                    gap_type="shallow_coverage",
                    description=f"Topic '{topic}' has minimal coverage ({len(keywords_found)}/{len(data['keywords'])} concepts covered)",
                    severity="medium",
                    affected_topics=[topic],
                    solution=f"Expand {topic} section with deeper explanations. Current: ~{depth_analysis['estimated_word_count']} words, Target: {data['min_word_count']}+ words",
                    recommended_keywords=missing_kws[:5],
                    content_suggestions=[
                        f"Add details about {subtopic}"
                        for subtopic in data["subtopics"][:2]
                    ],
                )
            )
            high_gaps += 1
        elif (
            0.25 <= coverage_score < 0.5
            and depth_analysis["estimated_word_count"] < data["min_word_count"]
        ):
            logger.info(f"Insufficient depth for topic: {topic}")
            gaps.append(
                SemanticGap(
                    gap_type="shallow_coverage",
                    description=f"Topic '{topic}' lacks depth (only ~{depth_analysis['estimated_word_count']} words, {int(coverage_score*100)}% keyword coverage)",
                    severity="low",
                    affected_topics=[topic],
                    solution=f"Add {data['min_word_count'] - depth_analysis['estimated_word_count']} more words explaining {topic} concepts in detail",
                    recommended_keywords=[
                        kw for kw in data["keywords"] if kw not in keywords_found
                    ][:4],
                    content_suggestions=[
                        "Provide more detailed explanations",
                        "Add practical examples",
                        "Include common mistakes or FAQs",
                    ],
                )
            )

    # Visual and Interactive Elements
    logger.info("Checking visual and interactive elements")
    if structure["image_count"] == 0 and word_count > 400:
        logger.info("No images found")
        gaps.append(
            SemanticGap(
                gap_type="missing_subtopic",
                description="No images or visual aids found",
                severity="medium",
                affected_topics=["Visual Content", "Engagement"],
                solution="Add 2-5 relevant images, diagrams, or infographics",
                recommended_keywords=[],
                content_suggestions=[
                    "Add diagrams for complex concepts",
                    "Include screenshots for tutorials",
                    "Use charts for data visualization",
                    "Add infographics for processes",
                ],
            )
        )
        high_gaps += 1

    if structure["list_count"] == 0 and word_count > 400:
        logger.info("No lists found")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description="No lists or bullet points - reduces scannability",
                severity="low",
                affected_topics=["Readability", "UX"],
                solution="Add 2-3 bulleted or numbered lists for better readability",
                recommended_keywords=[],
                content_suggestions=[
                    "Use bullets for feature lists",
                    "Create numbered lists for steps",
                    "Add quick tips or key points sections",
                ],
            )
        )

    if structure["table_count"] == 0 and word_count > 600:
        logger.info("No tables found")
        gaps.append(
            SemanticGap(
                gap_type="missing_subtopic",
                description="Consider adding comparison tables",
                severity="low",
                affected_topics=["Content Format", "Comparison"],
                solution="Add tables to compare features, prices, or options",
                recommended_keywords=[],
                content_suggestions=[
                    "Create comparison tables",
                    "Add data tables for statistics",
                    "Use tables for technical specifications",
                ],
            )
        )

    # Linking Strategy
    logger.info("Checking linking strategy")
    if structure["internal_links"] < 2 and word_count > 500:
        logger.info(f"Insufficient internal links: {structure['internal_links']}")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description=f"Insufficient internal linking ({structure['internal_links']} links found)",
                severity="medium",
                affected_topics=["SEO", "Navigation"],
                solution="Add 3-5 internal links to related content on your site",
                recommended_keywords=[],
                content_suggestions=[
                    "Link to related articles",
                    "Add contextual links for deeper topics",
                    "Link to your main pillar pages",
                ],
            )
        )
        high_gaps += 1

    if structure["external_links"] == 0 and word_count > 500:
        logger.info("No external links found")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description="No external references or sources cited",
                severity="low",
                affected_topics=["Credibility", "SEO"],
                solution="Add 2-3 links to authoritative external sources",
                recommended_keywords=[],
                content_suggestions=[
                    "Link to research studies or data",
                    "Reference industry authorities",
                    "Cite official documentation",
                ],
            )
        )

    # Paragraph Structure
    logger.info("Checking paragraph structure")
    if structure["avg_paragraph_length"] > 150 and structure["paragraph_count"] > 3:
        logger.info(f"Long paragraphs detected: avg {structure['avg_paragraph_length']} words")
        gaps.append(
            SemanticGap(
                gap_type="structural",
                description=f"Paragraphs are too long (avg {int(structure['avg_paragraph_length'])} words)",
                severity="low",
                affected_topics=["Readability"],
                solution="Break long paragraphs into shorter chunks (50-100 words each)",
                recommended_keywords=[],
                content_suggestions=[
                    "Aim for 2-4 sentences per paragraph",
                    "Use line breaks for better readability",
                    "Split complex ideas into separate paragraphs",
                ],
            )
        )

    severity_order = {"high": 0, "medium": 1, "low": 2}
    gaps.sort(key=lambda x: severity_order[x.severity])

    logger.info(f"Gap analysis completed: {critical_gaps} critical, {high_gaps} high, {len(gaps)} total gaps")
    return gaps


@app.get("/")
async def root():
    """Return service metadata."""
    return {
        "service": "OrbiSEO AI Crawler",
        "version": "1.0",
        "status": "active",
        "tagline": "See the meaning behind search",
        "description": "AI-powered content analysis and semantic gap detection for crypto SEO"
    }


@app.get("/health")
async def health():
    """Return service health status."""
    return {"status": "healthy", "version": "1.0", "nlp": "enabled", "service": "OrbiSEO AI Crawler"}


@app.post("/api/crawl-url", response_model=CrawlResponse)
async def crawl(req: CrawlRequest):
    """Crawl and analyze the provided URL for semantic gaps and SEO metrics."""
    logger.info(f"Starting analysis for URL: {req.url}")
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        response = requests.get(str(req.url), headers=headers, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")
        title = None
        if soup.find("title"):
            title = soup.find("title").get_text().strip()
        elif soup.find("h1"):
            title = soup.find("h1").get_text().strip()
        else:
            title = "Untitled Page"

        for element in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
            element.decompose()

        text = soup.get_text(separator=" ", strip=True)
        text = re.sub(r"\s+", " ", text).strip()
        words = text.split()
        word_count = len(words)

        logger.info(f"Title: {title[:60]}...")
        logger.info(f"Word count: {word_count}")

        structure = extract_semantic_structure(text, soup)
        logger.info(
            f"Structure: H1={structure['h1_count']}, H2={structure['h2_count']}, "
            f"H3={structure['h3_count']}, Lists={structure['list_count']}, "
            f"Images={structure['image_count']}, Links={structure['link_count']}"
        )

        entities = set()
        for term in CRYPTO_ENTITIES:
            if term.lower() in text.lower():
                entities.add(term)
        caps = re.findall(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b", text)
        entities.update([c for c in caps if len(c) > 4 and c not in STOP_WORDS][:25])
        entities = sorted(list(entities))[:30]

        words_lower = re.findall(r"\b[a-z]{3,}\b", text.lower())
        word_freq = Counter([w for w in words_lower if w not in STOP_WORDS])
        keywords = [w for w, _ in word_freq.most_common(40)]

        keyword_density = {}
        for kw in keywords[:15]:
            count = text.lower().count(kw)
            keyword_density[kw] = round((count / word_count) * 100, 2) if word_count > 0 else 0

        topics_found = {}
        for topic, data in CRYPTO_TAXONOMY.items():
            matches = sum(1 for kw in data["keywords"] if kw in text.lower())
            if matches > 0:
                topics_found[topic] = matches / len(data["keywords"])

        logger.info(f"Topics found: {list(topics_found.keys())}")

        tags = sorted(topics_found.items(), key=lambda x: x[1], reverse=True)[:6]
        tags = [topic for topic, _ in tags] if tags else ["Cryptocurrency", "General"]

        clusters = defaultdict(list)
        for kw in keywords[:25]:
            matched = False
            for topic, data in CRYPTO_TAXONOMY.items():
                if kw in [k.lower() for k in data["keywords"]]:
                    clusters[topic].append(kw)
                    matched = True
                    break
            if not matched:
                clusters["General"].append(kw)
        semantic_clusters = {k: v[:7] for k, v in clusters.items() if v}

        semantic_gaps = []
        if req.perform_gap_analysis:
            logger.info("Performing gap analysis")
            semantic_gaps = perform_semantic_gap_analysis(text, structure, topics_found, word_count, keywords)
            logger.info(f"Found {len(semantic_gaps)} semantic gaps")

        content_gaps = [gap.description for gap in semantic_gaps if gap.severity in ["high", "medium"]][:5]

        topic_coverage = len(topics_found) / len(CRYPTO_TAXONOMY)
        structure_score = 0
        structure_score += 0.15 if structure["has_introduction"] else 0
        structure_score += 0.15 if structure["has_conclusion"] else 0
        structure_score += 0.20 if structure["heading_count"] >= 5 else 0.10 if structure["heading_count"] >= 3 else 0
        structure_score += 0.15 if structure["list_count"] >= 2 else 0.05 if structure["list_count"] >= 1 else 0
        structure_score += 0.15 if structure["image_count"] >= 2 else 0.05 if structure["image_count"] >= 1 else 0
        structure_score += 0.10 if structure["link_count"] >= 5 else 0.05 if structure["link_count"] >= 2 else 0
        structure_score += 0.10 if structure["h1_count"] == 1 else 0

        word_count_score = min(word_count / 1200, 1.0)
        content_quality_score = topic_coverage * 0.35 + structure_score * 0.35 + word_count_score * 0.30
        topic_relevance_score = topic_coverage

        title_has_keyword = any(kw in title.lower() for kw in keywords[:15])
        meta_score = 0.25 if title_has_keyword else 0.10
        heading_score = 0.20 if structure["heading_count"] >= 5 else 0.10 if structure["heading_count"] >= 3 else 0
        content_score = 0.25 if word_count >= 800 else 0.15 if word_count >= 500 else 0.05
        link_score = 0.15 if structure["link_count"] >= 5 else 0.08 if structure["link_count"] >= 2 else 0
        media_score = 0.15 if structure["image_count"] >= 2 else 0.08 if structure["image_count"] >= 1 else 0
        seo_score = meta_score + heading_score + content_score + link_score + media_score

        if words_lower:
            avg_word_length = sum(len(w) for w in words_lower) / len(words_lower)
            sentences = [s for s in re.split(r"[.!?]+", text) if s.strip()]
            avg_sentence_length = len(words) / max(len(sentences), 1)
            word_length_score = max(0, 1 - abs(avg_word_length - 5.5) / 5)
            sentence_length_score = max(0, 1 - abs(avg_sentence_length - 17) / 20)
            readability_score = word_length_score * 0.6 + sentence_length_score * 0.4
        else:
            readability_score = 0.5

        sentences = [s.strip() for s in re.split(r"[.!?]+", text) if len(s.strip()) > 40]
        summary = sentences[0][:250] if sentences else text[:250] if text else "No content summary available."
        if len(summary) < 100 and len(sentences) > 1:
            summary += " " + sentences[1][:150]

        missing_critical_topics = [
            topic for topic, data in CRYPTO_TAXONOMY.items()
            if data["importance"] in ["critical", "high"] and topic not in topics_found
        ]
        recommended_topics = missing_critical_topics[:5]

        mentioned_entities_lower = [e.lower() for e in entities]
        missing_entities = [
            e for e in CRYPTO_ENTITIES[:15]
            if e.lower() not in mentioned_entities_lower and e.lower() not in text.lower()
        ][:10]

        logger.info(
            f"Scores - Quality: {content_quality_score:.2f}, SEO: {seo_score:.2f}, "
            f"Readability: {readability_score:.2f}, Topic Relevance: {topic_relevance_score:.2f}"
        )
        logger.info(f"Critical gaps: {len([g for g in semantic_gaps if g.severity == 'high'])}")

        response = CrawlResponse(
            url=str(req.url),
            title=title,
            word_count=word_count,
            entities=entities,
            keywords=keywords[:30],
            tags=tags,
            key_topics=list(topics_found.keys()),
            content_summary=summary,
            semantic_clusters=semantic_clusters,
            topic_relevance_score=round(topic_relevance_score, 3),
            content_quality_score=round(content_quality_score, 3),
            content_gaps=content_gaps,
            semantic_gaps=semantic_gaps,
            missing_entities=missing_entities,
            recommended_topics=recommended_topics,
            seo_score=round(seo_score, 3),
            readability_score=round(readability_score, 3),
            keyword_density=keyword_density,
            crawl_timestamp=time.time(),
            indexed_to_pinecone=False,
        )

        if req.perform_gap_analysis and not semantic_gaps:
            response.warning = (
                "No semantic gaps detected. The content may fully cover the target topic (cryptocurrency). "
                "Try a different URL or adjust the target topic for more specific analysis."
            )

        return response

    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {str(e)}")
        return CrawlResponse(
            url=str(req.url),
            error=f"Failed to fetch URL: {str(e)}",
            crawl_timestamp=time.time(),
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return CrawlResponse(
            url=str(req.url),
            error=f"Analysis failed: {str(e)}",
            crawl_timestamp=time.time(),
        )


@app.post("/api/test-gap-analysis", response_model=Dict[str, List[SemanticGap]])
async def test_gap_analysis():
    """Test semantic gap analysis with sample content."""
    logger.info("Starting test gap analysis")
    sample_text = """
    Bitcoin is a cryptocurrency. It uses blockchain technology. Ethereum is another popular coin.
    This article explains crypto basics. No conclusion here.
    """
    soup = BeautifulSoup(sample_text, "html.parser")
    word_count = len(sample_text.split())
    structure = extract_semantic_structure(sample_text, soup)
    topics_found = {"Fundamentals": 0.3}
    keywords = ["bitcoin", "blockchain", "ethereum", "cryptocurrency"]

    gaps = perform_semantic_gap_analysis(sample_text, structure, topics_found, word_count, keywords)
    logger.info(f"Test gap analysis completed: {len(gaps)} gaps found")
    return {"semantic_gaps": gaps}


if __name__ == "__main__":
    import uvicorn
    import os

    logger.info("Starting OrbiSEO AI Crawler v1.0")
    logger.info("See the meaning behind search")
    port = int(os.environ.get("PORT", 8001))
    logger.info(f"Server running on http://localhost:{port}")
    logger.info("API endpoints: POST /api/crawl-url, POST /api/test-gap-analysis")
    uvicorn.run(app, host="0.0.0.0", port=port)