#!/bin/bash

# OrbiSEO Google Cloud Platform Deployment Script
# Complete automated deployment of OrbiSEO on GCP

set -e  # Exit on any error

# Configuration
PROJECT_ID="orbiseo"
PROJECT_NUMBER="687670877631"
REGION="us-central1"
REGISTRY_URL="us-central1-docker.pkg.dev/$PROJECT_ID/orbiseo-repo"

echo "🚀 Deploying OrbiSEO to Google Cloud Platform"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."
if ! command_exists gcloud; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

if ! command_exists docker; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Step 1: Set up Google Cloud project
echo "📋 Setting up Google Cloud project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable dns.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable monitoring.googleapis.com

# Step 2: Create Artifact Registry repository
echo "📦 Creating Artifact Registry repository..."
if ! gcloud artifacts repositories describe orbiseo-repo --location=$REGION > /dev/null 2>&1; then
    gcloud artifacts repositories create orbiseo-repo \
        --repository-format=docker \
        --location=$REGION \
        --description="OrbiSEO Docker images"
    echo "✅ Created Artifact Registry repository"
else
    echo "✅ Artifact Registry repository already exists"
fi

# Configure Docker authentication
gcloud auth configure-docker $REGION-docker.pkg.dev

# Step 3: Create secrets
echo "🔒 Creating secrets in Secret Manager..."

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2

    if gcloud secrets describe $secret_name > /dev/null 2>&1; then
        echo "📝 Updating secret: $secret_name"
        echo "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    else
        echo "✅ Creating secret: $secret_name"
        echo "$secret_value" | gcloud secrets create $secret_name --data-file=-
    fi
}

# Create secrets
create_or_update_secret "pinecone-api-key" "pcsk_5tgCig_HMWycqqQtk8ybJxw6nLx2c9TnRgqHAJMTiCGwAY3hZqzc32eDtfQSmunRTVmaz3"
create_or_update_secret "google-client-secret" "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"
create_or_update_secret "app-secret-key" "$(openssl rand -hex 32)"
create_or_update_secret "recaptcha-secret-key" "your_recaptcha_secret_key_here"

echo "✅ All secrets created"

# Step 4: Build and push Docker images
echo "🔨 Building and pushing Docker images..."

# Build and push Frontend
echo "Building Frontend..."
docker build -f Dockerfile.frontend -t $REGISTRY_URL/orbiseo-frontend:latest .
docker push $REGISTRY_URL/orbiseo-frontend:latest

# Build and push Main API
echo "Building Main API..."
docker build -f Dockerfile.main -t $REGISTRY_URL/orbiseo-main-api:latest .
docker push $REGISTRY_URL/orbiseo-main-api:latest

# Build and push Crawl API
echo "Building Crawl API..."
docker build -f Dockerfile.crawl -t $REGISTRY_URL/orbiseo-crawl-api:latest .
docker push $REGISTRY_URL/orbiseo-crawl-api:latest

echo "✅ All images built and pushed"

# Step 5: Deploy to Cloud Run
echo "☁️ Deploying services to Cloud Run..."

# Deploy Main API
echo "Deploying Main API..."
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
    --set-env-vars="CORS_ORIGINS=[\"https://orbiseo.com\",\"https://www.orbiseo.com\"]" \
    --set-env-vars="PINECONE_ENVIRONMENT=us-east-1,PINECONE_INDEX_NAME=orbiseo" \
    --set-env-vars="PINECONE_HOST=https://orbiseo-j8k3wcb.svc.aped-4627-b74a.pinecone.io" \
    --set-env-vars="PINECONE_METRIC=dotproduct,PINECONE_CLOUD=aws,PINECONE_REGION=us-east-1" \
    --set-env-vars="SENTENCE_TRANSFORMER_MODEL=all-MiniLM-L6-v2,MODEL_CACHE_DIR=./data/models" \
    --set-env-vars="PROJECT_NAME=Semantic SEO Backend,VERSION=1.0.0,API_V1_STR=/api/v1" \
    --set-secrets="PINECONE_API_KEY=pinecone-api-key:latest" \
    --set-secrets="SECRET_KEY=app-secret-key:latest" \
    --set-secrets="GOOGLE_CLIENT_SECRET=google-client-secret:latest" \
    --set-secrets="RECAPTCHA_SECRET_KEY=recaptcha-secret-key:latest"

# Deploy Crawl API
echo "Deploying Crawl API..."
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
    --set-env-vars="CORS_ORIGINS=[\"https://orbiseo.com\",\"https://www.orbiseo.com\"]"

# Get API URLs
MAIN_API_URL=$(gcloud run services describe orbiseo-main-api --region=$REGION --format="value(status.url)")
CRAWL_API_URL=$(gcloud run services describe orbiseo-crawl-api --region=$REGION --format="value(status.url)")

echo "Main API URL: $MAIN_API_URL"
echo "Crawl API URL: $CRAWL_API_URL"

# Deploy Frontend
echo "Deploying Frontend..."
gcloud run deploy orbiseo-frontend \
    --image=$REGISTRY_URL/orbiseo-frontend:latest \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated \
    --port=3000 \
    --memory=512Mi \
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

echo "✅ All services deployed successfully"

# Step 6: Setup Load Balancer and Custom Domain
echo "🌐 Setting up Load Balancer and Custom Domain..."

# Create static IP
if ! gcloud compute addresses describe orbiseo-ip --global > /dev/null 2>&1; then
    gcloud compute addresses create orbiseo-ip --global
    echo "✅ Created static IP"
else
    echo "✅ Static IP already exists"
fi

STATIC_IP=$(gcloud compute addresses describe orbiseo-ip --global --format="value(address)")
echo "Static IP: $STATIC_IP"

# Create SSL certificate
if ! gcloud compute ssl-certificates describe orbiseo-ssl-cert --global > /dev/null 2>&1; then
    gcloud compute ssl-certificates create orbiseo-ssl-cert \
        --domains=orbiseo.com,www.orbiseo.com,api.orbiseo.com,crawl.orbiseo.com \
        --global
    echo "✅ Created SSL certificate"
else
    echo "✅ SSL certificate already exists"
fi

# Create Network Endpoint Groups
echo "Creating Network Endpoint Groups..."
for service in frontend main-api crawl-api; do
    neg_name="orbiseo-${service}-neg"
    service_name="orbiseo-${service}"

    if ! gcloud compute network-endpoint-groups describe $neg_name --region=$REGION > /dev/null 2>&1; then
        gcloud compute network-endpoint-groups create $neg_name \
            --region=$REGION \
            --network-endpoint-type=serverless \
            --cloud-run-service=$service_name
        echo "✅ Created NEG: $neg_name"
    else
        echo "✅ NEG already exists: $neg_name"
    fi
done

# Create Backend Services
echo "Creating Backend Services..."
for service in frontend main-api crawl-api; do
    backend_name="orbiseo-${service}-backend"
    neg_name="orbiseo-${service}-neg"

    if ! gcloud compute backend-services describe $backend_name --global > /dev/null 2>&1; then
        gcloud compute backend-services create $backend_name --global
        gcloud compute backend-services add-backend $backend_name \
            --global \
            --network-endpoint-group=$neg_name \
            --network-endpoint-group-region=$REGION
        echo "✅ Created backend service: $backend_name"
    else
        echo "✅ Backend service already exists: $backend_name"
    fi
done

echo "✅ Load balancer setup completed"

# Get service URLs
echo ""
echo "🎉 Deployment Complete!"
echo "======================================"
echo "Service URLs:"
echo "- Frontend: $FRONTEND_URL"
echo "- Main API: $MAIN_API_URL"
echo "- Crawl API: $CRAWL_API_URL"
echo ""
echo "Static IP: $STATIC_IP"
echo ""
echo "Next Steps:"
echo "1. Complete load balancer setup:"
echo "   - Create URL map"
echo "   - Create HTTPS proxy"
echo "   - Create forwarding rules"
echo ""
echo "2. Setup DNS records pointing to: $STATIC_IP"
echo "   - orbiseo.com → $STATIC_IP"
echo "   - www.orbiseo.com → $STATIC_IP"
echo "   - api.orbiseo.com → $STATIC_IP"
echo "   - crawl.orbiseo.com → $STATIC_IP"
echo ""
echo "3. Wait for SSL certificate provisioning"
echo "4. Test all endpoints"
echo "======================================"