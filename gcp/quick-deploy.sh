#!/bin/bash

# Quick OrbiSEO GCP Deployment - Using Existing Project
# Project: gen-lang-client-0965623259
# Project Number: 687670877631

set -e

PROJECT_ID="gen-lang-client-0965623259"
PROJECT_NUMBER="687670877631"
REGION="us-central1"
REGISTRY_URL="us-central1-docker.pkg.dev/$PROJECT_ID/orbiseo-repo"

echo "🚀 Quick Deploy OrbiSEO to GCP"
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"

# Set the project
gcloud config set project $PROJECT_ID

# Enable APIs
echo "🔌 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com

# Create Artifact Registry
echo "📦 Creating Artifact Registry..."
gcloud artifacts repositories create orbiseo-repo \
    --repository-format=docker \
    --location=$REGION \
    --description="OrbiSEO Docker images" || echo "Repository already exists"

# Configure Docker
gcloud auth configure-docker $REGION-docker.pkg.dev

# Create secrets
echo "🔒 Creating secrets..."
echo "pcsk_5tgCig_HMWycqqQtk8ybJxw6nLx2c9TnRgqHAJMTiCGwAY3hZqzc32eDtfQSmunRTVmaz3" | \
gcloud secrets create pinecone-api-key --data-file=- || \
echo "pcsk_5tgCig_HMWycqqQtk8ybJxw6nLx2c9TnRgqHAJMTiCGwAY3hZqzc32eDtfQSmunRTVmaz3" | \
gcloud secrets versions add pinecone-api-key --data-file=-

echo "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" | \
gcloud secrets create google-client-secret --data-file=- || \
echo "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" | \
gcloud secrets versions add google-client-secret --data-file=-

openssl rand -hex 32 | \
gcloud secrets create app-secret-key --data-file=- || \
openssl rand -hex 32 | \
gcloud secrets versions add app-secret-key --data-file=-

# Build and push images
echo "🔨 Building and pushing Docker images..."

# Frontend
docker build -f Dockerfile.frontend -t $REGISTRY_URL/orbiseo-frontend:latest .
docker push $REGISTRY_URL/orbiseo-frontend:latest

# Main API
docker build -f Dockerfile.main -t $REGISTRY_URL/orbiseo-main-api:latest .
docker push $REGISTRY_URL/orbiseo-main-api:latest

# Crawl API
docker build -f Dockerfile.crawl -t $REGISTRY_URL/orbiseo-crawl-api:latest .
docker push $REGISTRY_URL/orbiseo-crawl-api:latest

echo "✅ Images pushed successfully"

# Deploy Main API
echo "☁️ Deploying Main API..."
gcloud run deploy orbiseo-main-api \
    --image=$REGISTRY_URL/orbiseo-main-api:latest \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=8000 \
    --memory=2Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --set-env-vars="HOST=0.0.0.0,PORT=8000,DEBUG=false,LOG_LEVEL=INFO" \
    --set-env-vars="CORS_ORIGINS=[\"*\"]" \
    --set-env-vars="PINECONE_ENVIRONMENT=us-east-1,PINECONE_INDEX_NAME=orbiseo" \
    --set-env-vars="PINECONE_HOST=https://orbiseo-j8k3wcb.svc.aped-4627-b74a.pinecone.io" \
    --set-env-vars="PINECONE_METRIC=dotproduct,PINECONE_CLOUD=aws,PINECONE_REGION=us-east-1" \
    --set-env-vars="SENTENCE_TRANSFORMER_MODEL=all-MiniLM-L6-v2,MODEL_CACHE_DIR=./data/models" \
    --set-secrets="PINECONE_API_KEY=pinecone-api-key:latest" \
    --set-secrets="SECRET_KEY=app-secret-key:latest" \
    --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest"

# Deploy Crawl API
echo "☁️ Deploying Crawl API..."
gcloud run deploy orbiseo-crawl-api \
    --image=$REGISTRY_URL/orbiseo-crawl-api:latest \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=8001 \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=5 \
    --set-env-vars="HOST=0.0.0.0,PORT=8001,LOG_LEVEL=INFO" \
    --set-env-vars="CORS_ORIGINS=[\"*\"]"

# Get API URLs
MAIN_API_URL=$(gcloud run services describe orbiseo-main-api --region=$REGION --format="value(status.url)")
CRAWL_API_URL=$(gcloud run services describe orbiseo-crawl-api --region=$REGION --format="value(status.url)")

echo "Main API URL: $MAIN_API_URL"
echo "Crawl API URL: $CRAWL_API_URL"

# Deploy Frontend
echo "☁️ Deploying Frontend..."
gcloud run deploy orbiseo-frontend \
    --image=$REGISTRY_URL/orbiseo-frontend:latest \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=3000 \
    --memory=1Gi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="NEXT_PUBLIC_API_URL=$MAIN_API_URL" \
    --set-env-vars="NEXT_PUBLIC_AI_CRAWL_URL=$CRAWL_API_URL" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBztRu3Cv_GqCZ8eVT_l6LTryQRx42RYQ4" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-7522026757-cda8b.firebaseapp.com" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-7522026757-cda8b" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=studio-7522026757-cda8b.firebasestorage.app" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=989057558837" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_APP_ID=1:989057558837:web:f3f42b558e2672f886c47c" \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-FEH6N1H3MK" \
    --set-env-vars="NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeZrPArAAAAAPy3T_UpsOmyINJ0VV6q_hShnX7S"

FRONTEND_URL=$(gcloud run services describe orbiseo-frontend --region=$REGION --format="value(status.url)")

echo ""
echo "🎉 Quick Deployment Complete!"
echo "======================================"
echo "🌐 Your OrbiSEO Application URLs:"
echo "📱 Frontend: $FRONTEND_URL"
echo "🔗 Main API: $MAIN_API_URL"
echo "🤖 AI Crawl API: $CRAWL_API_URL"
echo ""
echo "✅ All services are live and running!"
echo "🔧 Test the APIs:"
echo "   curl $MAIN_API_URL/health"
echo "   curl $CRAWL_API_URL/health"
echo ""
echo "📋 Next Steps for Custom Domain (orbiseo.com):"
echo "1. Set up Load Balancer (run full deploy script)"
echo "2. Configure DNS records"
echo "3. Setup SSL certificate"
echo "======================================"