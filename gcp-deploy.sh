#!/bin/bash

# OrbiSEO Google Cloud Production Deployment Script
# Deploy to Google App Engine for orbiseo.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud CLI not found. Please install it first:"
        print_error "https://cloud.google.com/sdk/docs/install"
        exit 1
    fi

    # Check if authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        print_error "Not authenticated with Google Cloud. Please run:"
        print_error "gcloud auth login"
        exit 1
    fi

    # Check if project is set
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [[ -z "$PROJECT_ID" ]]; then
        print_error "No project set. Please run:"
        print_error "gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi

    print_success "Prerequisites check passed"
    print_status "Active project: $PROJECT_ID"
}

build_frontend() {
    print_status "Building Next.js frontend for production..."

    # Install dependencies
    npm ci --only=production

    # Build for production
    NODE_ENV=production npm run build

    print_success "Frontend build completed"
}

deploy_backend_api() {
    print_status "Deploying main API service..."

    cd python_backend

    # Deploy to App Engine
    gcloud app deploy app.yaml --quiet --promote

    cd ..
    print_success "Main API deployed successfully"
}

deploy_crawl_service() {
    print_status "Deploying AI crawl service..."

    cd python_backend

    # Deploy crawl service
    gcloud app deploy crawl-app.yaml --quiet

    cd ..
    print_success "AI crawl service deployed successfully"
}

deploy_frontend() {
    print_status "Deploying Next.js frontend..."

    # Deploy frontend to App Engine
    gcloud app deploy app.yaml --quiet --promote

    print_success "Frontend deployed successfully"
}

setup_custom_domain() {
    print_status "Setting up custom domain mapping..."

    read -p "Do you want to map orbiseo.com to this deployment? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Mapping custom domain..."

        # Map domain (you need to verify domain ownership first)
        gcloud app domain-mappings create orbiseo.com --certificate-management=AUTOMATIC
        gcloud app domain-mappings create www.orbiseo.com --certificate-management=AUTOMATIC

        print_success "Domain mapping configured"
        print_warning "Don't forget to update your DNS records:"
        print_warning "1. Point orbiseo.com A record to Google App Engine IP"
        print_warning "2. Point www.orbiseo.com CNAME to ghs.googlehosted.com"
    fi
}

enable_apis() {
    print_status "Enabling required Google Cloud APIs..."

    gcloud services enable appengine.googleapis.com
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable storage.googleapis.com

    print_success "APIs enabled successfully"
}

check_deployment() {
    print_status "Checking deployment status..."

    # Get the deployed URLs
    DEFAULT_URL=$(gcloud app browse --no-launch-browser 2>/dev/null || echo "https://$PROJECT_ID.appspot.com")
    API_URL="https://api-orbiseo-dot-$PROJECT_ID.uc.r.appspot.com"
    CRAWL_URL="https://crawl-orbiseo-dot-$PROJECT_ID.uc.r.appspot.com"

    print_success "Deployment completed successfully!"
    echo
    echo "=========================================="
    echo "  OrbiSEO Production Deployment Complete!"
    echo "=========================================="
    echo
    echo "Deployed Services:"
    echo "- Frontend: $DEFAULT_URL"
    echo "- Main API: $API_URL"
    echo "- AI Crawl: $CRAWL_URL"
    echo
    echo "Custom Domain (if configured):"
    echo "- https://orbiseo.com"
    echo "- https://www.orbiseo.com"
    echo
    echo "Health Check URLs:"
    echo "- API Health: $API_URL/health"
    echo "- Crawl Health: $CRAWL_URL/health"
    echo
    echo "Next Steps:"
    echo "1. Update DNS records if using custom domain"
    echo "2. Configure Firebase authorized domains"
    echo "3. Update reCAPTCHA authorized domains"
    echo "4. Test all functionality"
    echo
}

# Main deployment process
main() {
    print_status "Starting OrbiSEO Google Cloud deployment..."
    echo

    check_prerequisites
    enable_apis

    # Build and deploy
    build_frontend
    deploy_backend_api
    deploy_crawl_service
    deploy_frontend

    # Optional domain setup
    setup_custom_domain

    # Final checks
    check_deployment
}

# Handle script arguments
case "${1:-}" in
    "frontend")
        build_frontend
        deploy_frontend
        ;;
    "backend")
        deploy_backend_api
        ;;
    "crawl")
        deploy_crawl_service
        ;;
    "domain")
        setup_custom_domain
        ;;
    "check")
        check_deployment
        ;;
    *)
        main "$@"
        ;;
esac