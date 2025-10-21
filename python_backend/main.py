from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import logging
import time
from pinecone import Pinecone, ServerlessSpec
from pinecone_text.sparse import BM25Encoder
from pathlib import Path
import os
from dotenv import load_dotenv
import traceback

load_dotenv()

# ============================================
# ENHANCED LOGGING CONFIGURATION
# ============================================
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create separate loggers for different components
search_logger = logging.getLogger("search")
intent_logger = logging.getLogger("intent")
serp_logger = logging.getLogger("serp")

app = FastAPI(title="Semantic SEO API", version="6.2.0-debug")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# GLOBAL VARIABLES
# ============================================

model = None
pc = None
index = None
bm25_encoder = None
startup_time = time.time()

# Intent classification templates
INTENT_TEMPLATES = {
    "informational": [
        "how to do something",
        "what is this",
        "why does this happen",
        "when should I do this",
        "where can I find information",
        "tutorial guide explanation",
        "learn about topic",
        "understand concept",
        "definition meaning"
    ],
    "transactional": [
        "buy product now",
        "purchase item online",
        "order service",
        "subscribe download",
        "get discount deal",
        "checkout cart",
        "register sign up",
        "book appointment"
    ],
    "commercial": [
        "best product review",
        "top rated comparison",
        "compare products",
        "which is better",
        "product vs alternative",
        "recommended options",
        "affordable cheap",
        "reviews ratings"
    ],
    "navigational": [
        "website login",
        "brand official site",
        "company homepage",
        "social media page",
        "specific website",
        "sign in account"
    ]
}

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = "us-east-1"
PINECONE_INDEX_NAME = "orbiseo"

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

# ============================================
# MODELS
# ============================================

class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    topK: int = Field(default=20, ge=1, le=100)
    includeIntent: bool = True
    minSimilarity: float = Field(default=0.5, ge=0.0, le=1.0)
    useDataForSEO: bool = True
    includeMetrics: bool = True
    locationCode: int = Field(default=2840)
    languageCode: str = Field(default="en")

class KeywordExpansionRequest(BaseModel):
    seed_keyword: str = Field(..., min_length=1)
    expansion_count: int = Field(default=50, ge=5, le=200)
    include_dataforseo: bool = True
    include_ai: bool = True
    include_metrics: bool = True
    locationCode: int = Field(default=2840)
    languageCode: str = Field(default="en")

class SERPAnalysisRequest(BaseModel):
    keyword: str = Field(..., min_length=1)
    locationCode: int = Field(default=2840)
    languageCode: str = Field(default="en")

# ============================================
# HELPER FUNCTIONS
# ============================================

def safe_float(value, default=0.0):
    """Safely convert value to float with debug logging"""
    try:
        if value is None:
            logger.debug(f"safe_float: None value, returning default {default}")
            return default
        if isinstance(value, (int, float)):
            if np.isnan(value) or np.isinf(value):
                logger.debug(f"safe_float: NaN/Inf value {value}, returning default {default}")
                return default
            return float(value)
        logger.debug(f"safe_float: Invalid type {type(value)}, returning default {default}")
        return default
    except Exception as e:
        logger.error(f"safe_float error: {e}, value={value}")
        return default

def safe_int(value, default=0):
    """Safely convert value to int with debug logging"""
    try:
        if value is None:
            return default
        result = int(value)
        logger.debug(f"safe_int: Converted {value} to {result}")
        return result
    except Exception as e:
        logger.error(f"safe_int error: {e}, value={value}")
        return default

def safe_str(value, default=""):
    """Safely convert value to string with debug logging"""
    try:
        if value is None or (isinstance(value, float) and np.isnan(value)):
            return default
        return str(value)
    except Exception as e:
        logger.error(f"safe_str error: {e}, value={value}")
        return default

def classify_intent_with_embeddings(query: str) -> tuple:
    """Classify intent using SentenceTransformer with debug logging"""
    global model
    
    intent_logger.info(f"🎯 Starting intent classification for: '{query}'")
    
    if model is None:
        intent_logger.warning("⚠️ Model not loaded, using rule-based fallback")
        return classify_intent_fallback(query), 0.6
    
    try:
        intent_logger.debug("Encoding query...")
        query_embedding = model.encode([query])[0]
        intent_logger.debug(f"Query embedding shape: {query_embedding.shape}")
        
        intent_scores = {}
        
        for intent_name, templates in INTENT_TEMPLATES.items():
            intent_logger.debug(f"Processing intent: {intent_name} with {len(templates)} templates")
            
            template_embeddings = model.encode(templates)
            intent_logger.debug(f"Template embeddings shape: {template_embeddings.shape}")
            
            similarities = cosine_similarity(
                query_embedding.reshape(1, -1),
                template_embeddings
            )[0]
            
            intent_scores[intent_name] = float(np.max(similarities))
            intent_logger.debug(f"{intent_name}: max_similarity={intent_scores[intent_name]:.4f}")
        
        best_intent = max(intent_scores, key=intent_scores.get)
        confidence = intent_scores[best_intent]
        
        intent_logger.info(f"✅ Intent scores: {intent_scores}")
        intent_logger.info(f"✅ Selected: {best_intent} (confidence: {confidence:.3f})")
        
        if confidence < 0.3:
            intent_logger.info("⚠️ Low confidence, using rule-based fallback")
            return classify_intent_fallback(query), 0.6
        
        return best_intent, confidence
        
    except Exception as e:
        intent_logger.error(f"❌ Error in intent classification: {e}")
        intent_logger.error(traceback.format_exc())
        return classify_intent_fallback(query), 0.6

def classify_intent_fallback(query: str) -> str:
    """Rule-based intent classification with debug logging"""
    query_lower = query.lower()
    intent_logger.debug(f"Using fallback classification for: '{query_lower}'")
    
    transactional_keywords = [
        'buy', 'purchase', 'order', 'shop', 'cart', 'checkout', 'price',
        'cost', 'cheap', 'discount', 'deal', 'sale', 'coupon', 'free shipping',
        'buy now', 'get', 'subscribe', 'sign up', 'register', 'download'
    ]
    if any(keyword in query_lower for keyword in transactional_keywords):
        intent_logger.info(f"✅ Intent: transactional (keyword match)")
        return "transactional"
    
    commercial_keywords = [
        'best', 'top', 'review', 'comparison', 'vs', 'versus', 'alternative',
        'compare', 'better', 'recommended', 'which', 'should i', 'worth it',
        'pros and cons', 'affordable'
    ]
    if any(keyword in query_lower for keyword in commercial_keywords):
        intent_logger.info(f"✅ Intent: commercial (keyword match)")
        return "commercial"
    
    navigational_patterns = [
        'login', 'sign in', 'website', 'official site', 'facebook', 'twitter',
        'youtube', 'instagram', 'linkedin'
    ]
    if any(pattern in query_lower for pattern in navigational_patterns):
        intent_logger.info(f"✅ Intent: navigational (pattern match)")
        return "navigational"
    
    if len(query_lower.split()) <= 2 and not any(
        word in query_lower for word in ['how', 'what', 'why', 'when', 'where', 'who']
    ):
        intent_logger.info(f"✅ Intent: navigational (short query)")
        return "navigational"
    
    informational_keywords = [
        'how', 'what', 'why', 'when', 'where', 'who', 'guide', 'tutorial',
        'tips', 'learn', 'explain', 'meaning', 'definition', 'examples',
        'ways to', 'benefits of', 'types of', 'list of', 'ideas'
    ]
    if any(keyword in query_lower for keyword in informational_keywords):
        intent_logger.info(f"✅ Intent: informational (keyword match)")
        return "informational"
    
    intent_logger.info(f"✅ Intent: informational (default)")
    return "informational"

def build_full_keyword_object(metadata: dict, score: float, rank: int) -> dict:
    """Build complete keyword object with debug logging"""
    logger.debug(f"Building keyword object for rank {rank}, score {score:.4f}")
    logger.debug(f"Metadata keys: {list(metadata.keys())}")
    
    result = {
        "keyword": safe_str(metadata.get("keyword", metadata.get("Keyword", ""))),
        "score": round(score, 4),
        "rank": rank,
        "source": "pinecone_vector_db"
    }
    
    # Intent & Search Stage
    result["intent"] = safe_str(metadata.get("intent", metadata.get("Intent", ""))).lower()
    result["intent_strength"] = safe_float(metadata.get("intent_strength", metadata.get("Intent_Strength")))
    result["searcher_stage"] = safe_str(metadata.get("searcher_stage", metadata.get("Searcher_Stage", "")))
    
    # Volume & Difficulty
    result["search_volume"] = safe_int(metadata.get("search_volume", metadata.get("Search_Volume")))
    result["keyword_difficulty"] = safe_int(metadata.get("keyword_difficulty", metadata.get("Keyword_Difficulty")))
    result["personal_kd"] = safe_int(metadata.get("personal_kd", metadata.get("Personal_KD")))
    
    # Cost & Semantic
    result["cpc"] = safe_float(metadata.get("cpc", metadata.get("CPC_INR")))
    result["semantic_similarity"] = safe_int(metadata.get("semantic_similarity", metadata.get("Semantic_Similarity")))
    result["semantic_cluster"] = safe_str(metadata.get("semantic_cluster", metadata.get("Semantic_Cluster", "")))
    
    # Entity & Intent Vector
    result["entity_link_strength"] = safe_str(metadata.get("entity_link_strength", metadata.get("Entity_Link_Strength", "")))
    result["search_intent_vector"] = safe_str(metadata.get("search_intent_vector", metadata.get("Search_Intent_Vector", "")))
    
    # Content Gap
    result["serp_content_gap"] = safe_str(metadata.get("serp_content_gap", metadata.get("SERP_Content_Gap", "")))
    result["content_gap_coverage"] = safe_int(metadata.get("content_gap_coverage", metadata.get("Content_Gap_Coverage")))
    result["missing_entities"] = safe_str(metadata.get("missing_entities", metadata.get("Missing_Entities", "")))
    
    # Authority & Topic
    result["topical_authority"] = safe_float(metadata.get("topical_authority", metadata.get("Topical_Authority")))
    result["parent_topic"] = safe_str(metadata.get("parent_topic", metadata.get("Parent_Topic", "")))
    
    # Optimization
    result["optimization_score"] = safe_float(metadata.get("optimization_score", metadata.get("Optimization_Score")))
    result["optimization_factors"] = safe_str(metadata.get("optimization_factors", metadata.get("Optimization_Factors", "")))
    
    # Rankings
    result["authority_rank"] = safe_int(metadata.get("authority_rank", metadata.get("Authority_Rank")))
    result["opportunity_rank"] = safe_int(metadata.get("opportunity_rank", metadata.get("Opportunity_Rank")))
    
    # Seasonality
    result["seasonality_index"] = safe_int(metadata.get("seasonality_index", metadata.get("Seasonality_Index")))
    result["seasonality_pattern"] = safe_str(metadata.get("seasonality_pattern", metadata.get("Seasonality_Pattern", "")))
    
    # Competitors - Comp1
    result["comp1_url"] = safe_str(metadata.get("comp1_url", metadata.get("Comp1_URL", "")))
    result["comp1_domain"] = safe_str(metadata.get("comp1_domain", metadata.get("Comp1_Domain", "")))
    result["comp1_rank"] = safe_int(metadata.get("comp1_rank", metadata.get("Comp1_Rank")))
    result["comp1_da"] = safe_int(metadata.get("comp1_da", metadata.get("Comp1_DA")))
    result["comp1_backlinks"] = safe_int(metadata.get("comp1_backlinks", metadata.get("Comp1_Backlinks")))
    result["comp1_traffic"] = safe_int(metadata.get("comp1_traffic", metadata.get("Comp1_Traffic")))
    result["comp1_content_gap"] = safe_int(metadata.get("comp1_content_gap", metadata.get("Comp1_Content_Gap")))
    result["comp1_semantic_score"] = safe_int(metadata.get("comp1_semantic_score", metadata.get("Comp1_Semantic_Score")))
    result["comp1_opportunity"] = safe_int(metadata.get("comp1_opportunity", metadata.get("Comp1_Opportunity")))
    
    # Competitors - Comp2
    result["comp2_url"] = safe_str(metadata.get("comp2_url", metadata.get("Comp2_URL", "")))
    result["comp2_domain"] = safe_str(metadata.get("comp2_domain", metadata.get("Comp2_Domain", "")))
    result["comp2_rank"] = safe_int(metadata.get("comp2_rank", metadata.get("Comp2_Rank")))
    result["comp2_da"] = safe_int(metadata.get("comp2_da", metadata.get("Comp2_DA")))
    result["comp2_backlinks"] = safe_int(metadata.get("comp2_backlinks", metadata.get("Comp2_Backlinks")))
    result["comp2_traffic"] = safe_int(metadata.get("comp2_traffic", metadata.get("Comp2_Traffic")))
    result["comp2_content_gap"] = safe_int(metadata.get("comp2_content_gap", metadata.get("Comp2_Content_Gap")))
    result["comp2_semantic_score"] = safe_int(metadata.get("comp2_semantic_score", metadata.get("Comp2_Semantic_Score")))
    result["comp2_opportunity"] = safe_int(metadata.get("comp2_opportunity", metadata.get("Comp2_Opportunity")))
    
    # Competitors - Comp3
    result["comp3_url"] = safe_str(metadata.get("comp3_url", metadata.get("Comp3_URL", "")))
    result["comp3_domain"] = safe_str(metadata.get("comp3_domain", metadata.get("Comp3_Domain", "")))
    result["comp3_rank"] = safe_int(metadata.get("comp3_rank", metadata.get("Comp3_Rank")))
    result["comp3_da"] = safe_int(metadata.get("comp3_da", metadata.get("Comp3_DA")))
    result["comp3_backlinks"] = safe_int(metadata.get("comp3_backlinks", metadata.get("Comp3_Backlinks")))
    result["comp3_traffic"] = safe_int(metadata.get("comp3_traffic", metadata.get("Comp3_Traffic")))
    result["comp3_content_gap"] = safe_int(metadata.get("comp3_content_gap", metadata.get("Comp3_Content_Gap")))
    result["comp3_semantic_score"] = safe_int(metadata.get("comp3_semantic_score", metadata.get("Comp3_Semantic_Score")))
    result["comp3_opportunity"] = safe_int(metadata.get("comp3_opportunity", metadata.get("Comp3_Opportunity")))
    
    # Aggregate Competitor Metrics
    result["avg_competitor_da"] = safe_float(metadata.get("avg_competitor_da", metadata.get("Avg_Competitor_DA")))
    result["total_competitor_traffic"] = safe_int(metadata.get("total_competitor_traffic", metadata.get("Total_Competitor_Traffic")))
    result["avg_competitor_gap"] = safe_float(metadata.get("avg_competitor_gap", metadata.get("Avg_Competitor_Gap")))
    result["best_opportunity_rank"] = safe_int(metadata.get("best_opportunity_rank", metadata.get("Best_Opportunity_Rank")))
    
    logger.debug(f"✅ Built keyword object: {result['keyword']}")
    return result

def init_pinecone():
    """Initialize Pinecone with debug logging"""
    global pc, index
    
    logger.info("🔌 Initializing Pinecone connection...")
    
    try:
        if not PINECONE_API_KEY:
            logger.error("❌ PINECONE_API_KEY not found in environment")
            logger.error(f"Environment variables: {list(os.environ.keys())}")
            return False
        
        logger.debug(f"API Key (first 10 chars): {PINECONE_API_KEY[:10]}...")
        logger.debug(f"Index name: {PINECONE_INDEX_NAME}")
        
        pc = Pinecone(api_key=PINECONE_API_KEY)
        logger.info("✅ Pinecone client initialized")
        
        index = pc.Index(PINECONE_INDEX_NAME)
        logger.info(f"✅ Connected to index: {PINECONE_INDEX_NAME}")
        
        stats = index.describe_index_stats()
        logger.info(f"✅ Index statistics:")
        logger.info(f"   - Total vectors: {stats.total_vector_count}")
        logger.info(f"   - Dimension: {stats.dimension}")
        logger.info(f"   - Namespaces: {stats.namespaces}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize Pinecone: {e}")
        logger.error(traceback.format_exc())
        return False

def create_sparse_vector(text: str):
    """Create sparse vector with debug logging"""
    global bm25_encoder
    
    logger.debug(f"Creating sparse vector for: '{text[:50]}...'")
    
    if bm25_encoder is None:
        logger.warning("⚠️ BM25 encoder not initialized")
        return {'indices': [], 'values': []}
    
    try:
        sparse_vec = bm25_encoder.encode_queries(text)
        logger.debug(f"Sparse vector type: {type(sparse_vec)}")
        
        if isinstance(sparse_vec, dict):
            indices = sparse_vec.get('indices', [])
            values = sparse_vec.get('values', [])
            
            if hasattr(indices, 'tolist'):
                indices = indices.tolist()
            if hasattr(values, 'tolist'):
                values = values.tolist()
            elif not isinstance(indices, list):
                indices = list(indices) if indices else []
            if not isinstance(values, list):
                values = list(values) if values else []
        else:
            indices = getattr(sparse_vec, 'indices', [])
            values = getattr(sparse_vec, 'values', [])
            
            if hasattr(indices, 'tolist'):
                indices = indices.tolist()
            if hasattr(values, 'tolist'):
                values = values.tolist()
        
        logger.debug(f"✅ Sparse vector created: {len(indices)} indices")
        return {'indices': indices, 'values': values}
        
    except Exception as e:
        logger.error(f"❌ Error encoding sparse vector: {e}")
        logger.error(traceback.format_exc())
        return {'indices': [], 'values': []}

def search_pinecone(query: str, top_k: int = 20, min_similarity: float = 0.5):
    """Search Pinecone with comprehensive debug logging"""
    global index
    
    search_logger.info(f"🔍 Searching Pinecone for: '{query}' (top_k={top_k}, min_sim={min_similarity})")
    
    if index is None:
        search_logger.error("❌ Index not initialized")
        return []
    
    try:
        search_logger.debug("Creating sparse vector...")
        sparse_vec = create_sparse_vector(query)
        
        if not sparse_vec['indices']:
            search_logger.warning("⚠️ Empty sparse vector generated")
            return []
        
        search_logger.debug(f"Querying index with {len(sparse_vec['indices'])} sparse indices...")
        
        query_response = index.query(
            vector=[],
            sparse_vector=sparse_vec,
            top_k=top_k * 3,
            include_metadata=True
        )
        
        search_logger.info(f"✅ Received {len(query_response.matches)} matches from Pinecone")
        
        results = []
        for i, match in enumerate(query_response.matches):
            similarity = float(match.score)
            search_logger.debug(f"Match {i+1}: score={similarity:.4f}, id={match.id}")
            
            if similarity < 0.01:
                search_logger.debug(f"Skipping match {i+1}: score too low ({similarity:.4f})")
                continue
            
            metadata = match.metadata or {}
            search_logger.debug(f"Match {i+1} metadata keys: {list(metadata.keys())[:10]}")
            
            result = build_full_keyword_object(metadata, similarity, len(results) + 1)
            results.append(result)
            
            if len(results) >= top_k:
                search_logger.debug(f"Reached top_k limit ({top_k})")
                break
        
        results.sort(key=lambda x: x['score'], reverse=True)
        for i, result in enumerate(results):
            result['rank'] = i + 1
        
        search_logger.info(f"✅ Returning {len(results)} filtered and ranked results")
        return results
        
    except Exception as e:
        search_logger.error(f"❌ Pinecone search error: {e}")
        search_logger.error(traceback.format_exc())
        return []

# ============================================
# STARTUP
# ============================================

@app.on_event("startup")
async def startup_event():
    global model, bm25_encoder
    
    logger.info("=" * 80)
    logger.info("🚀 Starting Semantic SEO API v6.2.0-debug")
    logger.info("=" * 80)
    
    # Load embedding model
    try:
        logger.info("📦 Loading SentenceTransformer model...")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info(f"✅ SentenceTransformer model loaded successfully")
        logger.info(f"   - Model: all-MiniLM-L6-v2")
        logger.info(f"   - Embedding dimension: {model.get_sentence_embedding_dimension()}")
    except Exception as e:
        logger.error(f"❌ Model load failed: {e}")
        logger.error(traceback.format_exc())
        raise
    
    # Initialize BM25 encoder
    try:
        logger.info("📦 Initializing BM25 encoder...")
        bm25_encoder = BM25Encoder.default()
        logger.info("✅ BM25 encoder initialized successfully")
    except Exception as e:
        logger.warning(f"⚠️ BM25 encoder init failed: {e}")
        logger.warning(traceback.format_exc())
    
    # Initialize Pinecone
    if init_pinecone():
        logger.info(f"✅ Pinecone ready: {PINECONE_INDEX_NAME}")
    else:
        logger.warning("⚠️ Pinecone not loaded - searches will fail")
    
    logger.info("=" * 80)
    logger.info("✅ API Ready with Full Debug Logging!")
    logger.info("=" * 80)

# ============================================
# ROUTES
# ============================================

@app.get("/")
async def root():
    logger.info("📍 Root endpoint accessed")
    return {
        "name": "Semantic SEO API",
        "version": "6.2.0-debug",
        "status": "operational",
        "database": "Pinecone (orbiseo)",
        "debug_mode": True,
        "features": [
            "Sparse vector search (BM25)",
            "Semantic intent detection (SentenceTransformer)",
            "Full debug logging",
            "Enhanced SERP analysis",
            "Complete metadata return"
        ]
    }

@app.get("/health")
async def health_check():
    logger.debug("🏥 Health check requested")
    
    index_stats = None
    if index:
        try:
            stats = index.describe_index_stats()
            index_stats = {
                "total_vectors": stats.total_vector_count,
                "dimension": stats.dimension
            }
            logger.debug(f"Index stats: {index_stats}")
        except Exception as e:
            logger.error(f"Error getting index stats: {e}")
    
    health_data = {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_name": "all-MiniLM-L6-v2" if model else None,
        "intent_method": "semantic_embeddings",
        "pinecone_connected": index is not None,
        "pinecone_index": PINECONE_INDEX_NAME,
        "bm25_encoder_ready": bm25_encoder is not None,
        "index_stats": index_stats,
        "uptime": round(time.time() - startup_time, 2),
        "debug_mode": True
    }
    
    logger.info(f"✅ Health check: {health_data}")
    return health_data

@app.post("/api/semantic-search-live")
async def semantic_search_live(request: SemanticSearchRequest):
    """Enhanced search with comprehensive debug logging"""
    logger.info("=" * 80)
    logger.info(f"🔍 SEMANTIC SEARCH REQUEST")
    logger.info(f"   Query: '{request.query}'")
    logger.info(f"   TopK: {request.topK}")
    logger.info(f"   Include Intent: {request.includeIntent}")
    logger.info(f"   Min Similarity: {request.minSimilarity}")
    logger.info("=" * 80)
    
    if not index:
        logger.error("❌ Pinecone not connected")
        raise HTTPException(status_code=503, detail="Pinecone not connected")
    
    try:
        # Search Pinecone
        logger.info("🔎 Starting Pinecone search...")
        matches = search_pinecone(
            query=request.query,
            top_k=request.topK,
            min_similarity=request.minSimilarity
        )
        logger.info(f"✅ Found {len(matches)} matches")
        
        # Classify intent
        intent = "informational"
        intent_confidence = 0.5
        intent_method = "default"
        
        if request.includeIntent:
            logger.info("🎯 Classifying intent...")
            try:
                intent, intent_confidence = classify_intent_with_embeddings(request.query)
                intent_method = "semantic_embeddings"
                logger.info(f"✅ Intent: {intent} (confidence: {intent_confidence:.3f}, method: {intent_method})")
            except Exception as e:
                logger.error(f"❌ Intent detection error: {e}")
                logger.error(traceback.format_exc())
                intent = classify_intent_fallback(request.query)
                intent_confidence = 0.6
                intent_method = "rule_based"
        
        # Calculate aggregate metrics
        logger.debug("📊 Calculating aggregate metrics...")
        total_volume = sum(m.get('search_volume', 0) for m in matches)
        difficulties = [m.get('keyword_difficulty', 0) for m in matches if m.get('keyword_difficulty', 0) > 0]
        cpcs = [m.get('cpc', 0) for m in matches if m.get('cpc', 0) > 0]
        
        avg_difficulty = np.mean(difficulties) if difficulties else 0
        avg_cpc = np.mean(cpcs) if cpcs else 0
        
        logger.info(f"📊 Metrics: volume={total_volume}, avg_kd={avg_difficulty:.2f}, avg_cpc={avg_cpc:.2f}")
        
        response_data = {
            "query": request.query,
            "intent": intent,
            "intent_confidence": round(float(intent_confidence), 3),
            "intent_method": intent_method,
            "matches": matches,
            "total_results": len(matches),
            "aggregate_metrics": {
                "total_search_volume": int(total_volume),
                "avg_keyword_difficulty": round(float(avg_difficulty), 2),
                "avg_cpc": round(float(avg_cpc), 2),
                "high_volume_count": sum(1 for m in matches if m.get('search_volume', 0) > 10000)
            },
            "database": "Pinecone (orbiseo)"
        }
        
        logger.info("✅ Search completed successfully")
        logger.info("=" * 80)
        return response_data
    
    except Exception as e:
        logger.error(f"❌ Search error: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/expand-keywords")
async def expand_keywords(request: KeywordExpansionRequest):
    """Keyword expansion with full debug logging"""
    logger.info("=" * 80)
    logger.info(f"📈 KEYWORD EXPANSION REQUEST")
    logger.info(f"   Seed: '{request.seed_keyword}'")
    logger.info(f"   Count: {request.expansion_count}")
    logger.info("=" * 80)
    
    if not index:
        logger.error("❌ Pinecone not connected")
        raise HTTPException(status_code=503, detail="Pinecone not connected")
    
    try:
        logger.info("🔎 Expanding keywords...")
        expanded = search_pinecone(
            query=request.seed_keyword,
            top_k=request.expansion_count,
            min_similarity=0.3
        )
        logger.info(f"✅ Expanded to {len(expanded)} keywords")
        
        # Calculate metrics
        logger.debug("📊 Calculating expansion metrics...")
        total_volume = sum(kw.get("search_volume", 0) for kw in expanded)
        comps = [kw.get("keyword_difficulty", 0) for kw in expanded if kw.get("keyword_difficulty", 0) > 0]
        cpcs = [kw.get("cpc", 0) for kw in expanded if kw.get("cpc", 0) > 0]
        
        avg_comp = np.mean(comps) if comps else 0
        avg_cpc_val = np.mean(cpcs) if cpcs else 0
        
        logger.info(f"📊 Expansion metrics: volume={total_volume}, avg_comp={avg_comp:.2f}")
        
        response_data = {
            "seed_keyword": request.seed_keyword,
            "expanded_keywords": expanded,
            "total_keywords": len(expanded),
            "metrics_summary": {
                "total_search_volume": int(total_volume),
                "avg_competition": round(float(avg_comp), 2),
                "avg_cpc": round(float(avg_cpc_val), 2),
                "high_volume_keywords": sum(1 for k in expanded if k.get("search_volume", 0) > 1000)
            }
        }
        
        logger.info("✅ Expansion completed successfully")
        logger.info("=" * 80)
        return response_data
    
    except Exception as e:
        logger.error(f"❌ Expansion error: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# REPLACE the serp_analysis endpoint in your main.py with this fixed version

@app.post("/api/dataforseo/serp-analysis")
async def serp_analysis(request: SERPAnalysisRequest):
    """
    Enhanced SERP analysis with comprehensive debug logging and NaN handling
    """
    serp_logger.info("=" * 80)
    serp_logger.info(f"🌐 SERP ANALYSIS REQUEST")
    serp_logger.info(f"   Keyword: '{request.keyword}'")
    serp_logger.info(f"   Location: {request.locationCode}")
    serp_logger.info(f"   Language: {request.languageCode}")
    serp_logger.info("=" * 80)
    
    if not index:
        serp_logger.error("❌ Pinecone not connected")
        raise HTTPException(status_code=503, detail="Pinecone not connected")
    
    try:
        # Search for the keyword and related terms
        serp_logger.info("🔎 Searching for keyword and related terms...")
        matches = search_pinecone(
            query=request.keyword,
            top_k=20,
            min_similarity=0.5
        )
        serp_logger.info(f"✅ Found {len(matches)} matches")
        
        # Classify intent
        serp_logger.info("🎯 Classifying search intent...")
        intent, intent_confidence = classify_intent_with_embeddings(request.keyword)
        serp_logger.info(f"✅ Intent: {intent} (confidence: {intent_confidence:.3f})")
        
        # Extract organic results from competitor data
        serp_logger.info("🏆 Extracting competitor data...")
        organic_results = []
        seen_urls = set()
        
        for match_idx, match in enumerate(matches):
            serp_logger.debug(f"Processing match {match_idx + 1}/{len(matches)}")
            
            # Add competitor URLs as organic results
            for i in range(1, 4):  # comp1, comp2, comp3
                url = match.get(f'comp{i}_url', '')
                domain = match.get(f'comp{i}_domain', '')
                rank = match.get(f'comp{i}_rank', 0)
                da = match.get(f'comp{i}_da', 0)
                traffic = match.get(f'comp{i}_traffic', 0)
                backlinks = match.get(f'comp{i}_backlinks', 0)
                
                if url and url not in seen_urls and rank > 0:
                    organic_results.append({
                        'position': rank,
                        'url': url,
                        'domain': domain,
                        'title': f"{match.get('keyword', '')} - {domain}",
                        'description': f"Ranking page for '{match.get('keyword', '')}' with DA {da}",
                        'domain_authority': da,
                        'traffic': traffic,
                        'keyword': match.get('keyword', ''),
                        'keyword_difficulty': match.get('keyword_difficulty', 0),
                        'backlinks': backlinks,
                        'content_gap': match.get(f'comp{i}_content_gap', 0) if f'comp{i}_content_gap' in match else match.get(f'comp{i}_gap', 0),
                        'semantic_score': match.get(f'comp{i}_semantic_score', 0) if f'comp{i}_semantic_score' in match else match.get(f'comp{i}_semantic', 0),
                        'opportunity': match.get(f'comp{i}_opportunity', 0)
                    })
                    seen_urls.add(url)
                    serp_logger.debug(f"   Added competitor {i}: {domain} (rank={rank}, DA={da})")
        
        # Sort by position
        organic_results.sort(key=lambda x: x['position'])
        serp_logger.info(f"✅ Extracted {len(organic_results)} organic results")
        
        # Generate related searches from semantic matches
        serp_logger.info("🔗 Generating related searches...")
        related_searches = [
            m.get('keyword', '') 
            for m in matches[:15] 
            if m.get('keyword') and m.get('keyword') != request.keyword
        ]
        serp_logger.info(f"✅ Found {len(related_searches)} related searches")
        
        # Calculate SERP metrics with proper NaN handling
        serp_logger.info("📊 Calculating SERP metrics...")
        
        # Calculate average DA
        da_values = [r['domain_authority'] for r in organic_results if r.get('domain_authority', 0) > 0]
        avg_da = float(np.mean(da_values)) if da_values else 0.0
        if np.isnan(avg_da) or np.isinf(avg_da):
            avg_da = 0.0
        
        # Calculate total traffic
        total_traffic = sum(r.get('traffic', 0) for r in organic_results)
        
        # Calculate average KD
        kd_values = [r['keyword_difficulty'] for r in organic_results if r.get('keyword_difficulty', 0) > 0]
        avg_kd = float(np.mean(kd_values)) if kd_values else 0.0
        if np.isnan(avg_kd) or np.isinf(avg_kd):
            avg_kd = 0.0
        
        # Calculate average backlinks (with proper NaN handling)
        backlink_values = [r.get('backlinks', 0) for r in organic_results if r.get('backlinks', 0) > 0]
        avg_backlinks = float(np.mean(backlink_values)) if backlink_values else 0.0
        if np.isnan(avg_backlinks) or np.isinf(avg_backlinks):
            avg_backlinks = 0.0
        
        serp_logger.info(f"   Avg DA: {avg_da:.2f}")
        serp_logger.info(f"   Avg KD: {avg_kd:.2f}")
        serp_logger.info(f"   Total Traffic: {total_traffic}")
        serp_logger.info(f"   Avg Backlinks: {avg_backlinks:.0f}")
        
        # Generate AI recommendations based on data
        serp_logger.info("🤖 Generating AI recommendations...")
        ai_recommendations = []
        
        # Intent-based recommendations
        if intent == "informational":
            ai_recommendations.append(f"Create comprehensive guide content about '{request.keyword}' with tutorials and examples")
            ai_recommendations.append("Focus on answering common questions and providing educational value")
            ai_recommendations.append("Include how-to guides, definitions, and step-by-step instructions")
        elif intent == "transactional":
            ai_recommendations.append(f"Optimize product/service pages for '{request.keyword}' with clear CTAs")
            ai_recommendations.append("Include pricing, features, and customer testimonials")
            ai_recommendations.append("Add trust signals like guarantees, secure checkout badges, and reviews")
        elif intent == "commercial":
            ai_recommendations.append(f"Create comparison and review content for '{request.keyword}'")
            ai_recommendations.append("Include pros/cons, alternatives, and buying guides")
            ai_recommendations.append("Add comparison tables, feature matrices, and expert recommendations")
        elif intent == "navigational":
            ai_recommendations.append(f"Ensure brand pages are optimized for '{request.keyword}'")
            ai_recommendations.append("Focus on brand authority and direct navigation paths")
            ai_recommendations.append("Optimize homepage and key landing pages for brand searches")
        
        # Competition-based recommendations
        if avg_da > 60:
            ai_recommendations.append(f"⚠️ Very high competition (Avg DA: {avg_da:.0f}). Focus on long-tail variations and niche angles")
            ai_recommendations.append(f"Consider targeting keywords with DA < 40 for quicker wins")
        elif avg_da > 40:
            ai_recommendations.append(f"Moderate-high competition (Avg DA: {avg_da:.0f}). Build topical authority with supporting content")
        else:
            ai_recommendations.append(f"✅ Lower competition (Avg DA: {avg_da:.0f}). Good opportunity for ranking with quality content")
        
        # Keyword difficulty recommendations
        if avg_kd > 60:
            ai_recommendations.append(f"High keyword difficulty ({avg_kd:.0f}). Plan 6-12 month SEO campaign with strong backlink strategy")
        elif avg_kd > 40:
            ai_recommendations.append(f"Moderate keyword difficulty ({avg_kd:.0f}). Focus on content quality and on-page optimization")
        else:
            ai_recommendations.append(f"Lower keyword difficulty ({avg_kd:.0f}). Quick win opportunity with solid content")
        
        # Backlink recommendations
        if avg_backlinks > 1000:
            ai_recommendations.append(f"Competitors have strong backlink profiles (avg {avg_backlinks:.0f} links). Prioritize link building")
        elif avg_backlinks > 100:
            ai_recommendations.append(f"Moderate backlink requirement (avg {avg_backlinks:.0f} links). Focus on quality over quantity")
        
        # Content gap recommendations
        if matches:
            missing_entities_set = set()
            for m in matches[:5]:
                entities = m.get('missing_entities', '')
                if entities and entities != '-':
                    missing_entities_set.update([e.strip() for e in entities.split(',') if e.strip()])
            
            if missing_entities_set:
                entities_list = list(missing_entities_set)[:5]
                ai_recommendations.append(f"📝 Cover missing entities: {', '.join(entities_list)}")
                serp_logger.debug(f"   Missing entities: {entities_list}")
        
        # Topical authority recommendation
        parent_topics = set(m.get('parent_topic', '') for m in matches[:10] if m.get('parent_topic') and m.get('parent_topic') != '-')
        if parent_topics:
            topics_list = list(parent_topics)[:3]
            ai_recommendations.append(f"🎯 Build topical authority around: {', '.join(topics_list)}")
            serp_logger.debug(f"   Parent topics: {topics_list}")
        
        # Volume and content recommendations
        total_search_volume = sum(m.get('search_volume', 0) for m in matches[:5])
        ai_recommendations.append(f"📊 Target search volume: {total_search_volume:,} (top 5 related keywords)")
        
        if avg_kd > 50:
            ai_recommendations.append(f"📝 Recommended content depth: 2000+ words with comprehensive semantic keyword coverage")
        elif avg_kd > 30:
            ai_recommendations.append(f"📝 Recommended content depth: 1500+ words with good semantic keyword coverage")
        else:
            ai_recommendations.append(f"📝 Recommended content depth: 1000+ words with focused keyword targeting")
        
        # Semantic cluster recommendations
        clusters = set(m.get('semantic_cluster', '') for m in matches if m.get('semantic_cluster') and m.get('semantic_cluster') != '-')
        if clusters:
            ai_recommendations.append(f"🔗 Create content hubs around semantic clusters: {', '.join(list(clusters)[:3])}")
        
        serp_logger.info(f"✅ Generated {len(ai_recommendations)} recommendations")
        
        # Content opportunities
        serp_logger.info("💡 Identifying content opportunities...")
        high_volume_kws = [m['keyword'] for m in matches if m.get('search_volume', 0) > 1000][:10]
        low_comp_kws = [m['keyword'] for m in matches if m.get('keyword_difficulty', 100) < 30][:10]
        semantic_clusters = list(set(m.get('semantic_cluster', '') for m in matches if m.get('semantic_cluster') and m.get('semantic_cluster') != '-'))[:5]
        
        serp_logger.info(f"   High volume keywords: {len(high_volume_kws)}")
        serp_logger.info(f"   Low competition keywords: {len(low_comp_kws)}")
        serp_logger.info(f"   Semantic clusters: {len(semantic_clusters)}")
        
        # Determine competition level
        if avg_da > 60:
            competition_level = "Very High"
        elif avg_da > 40:
            competition_level = "High"
        elif avg_da > 25:
            competition_level = "Moderate"
        else:
            competition_level = "Low"
        
        # Build final response with all values properly sanitized
        response_data = {
            "keyword": request.keyword,
            "intent": intent,
            "intent_confidence": round(float(intent_confidence), 3),
            "organic_results": organic_results[:20],  # Top 20 results
            "total_organic_results": len(organic_results),
            "related_searches": related_searches,
            "serp_metrics": {
                "avg_domain_authority": round(float(avg_da), 2),
                "total_competitor_traffic": int(total_traffic),
                "avg_keyword_difficulty": round(float(avg_kd), 2),
                "avg_backlinks": round(float(avg_backlinks), 2),
                "top_position": min((r['position'] for r in organic_results), default=0),
                "serp_diversity": len(set(r['domain'] for r in organic_results)),
                "competition_level": competition_level
            },
            "ai_recommendations": ai_recommendations,
            "content_opportunities": {
                "high_volume_keywords": high_volume_kws,
                "low_competition_keywords": low_comp_kws,
                "semantic_clusters": semantic_clusters,
                "total_opportunity_score": len(high_volume_kws) + len(low_comp_kws) * 2
            },
            "database": "Pinecone (orbiseo)",
            "analysis_timestamp": time.time()
        }
        
        serp_logger.info("✅ SERP analysis completed successfully")
        serp_logger.info("=" * 80)
        return response_data
    
    except Exception as e:
        serp_logger.error(f"❌ SERP analysis error: {e}")
        serp_logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"SERP analysis failed: {str(e)}")

@app.get("/debug/test-search/{query}")
async def test_search(query: str, top_k: int = 5):
    """Test search functionality for debugging"""
    logger.info(f"🧪 Testing search for: '{query}' (top_k={top_k})")
    
    try:
        results = search_pinecone(query, top_k=top_k)
        
        return {
            "query": query,
            "results_count": len(results),
            "results": results,
            "index_connected": index is not None,
            "bm25_ready": bm25_encoder is not None
        }
    except Exception as e:
        logger.error(f"Error in test search: {e}")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

@app.get("/debug/logs/recent")
async def get_recent_logs():
    """Get recent log entries (if using file logging)"""
    return {
        "message": "Check console output for logs",
        "log_level": "DEBUG",
        "components": ["main", "search", "intent", "serp"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="debug"
    )