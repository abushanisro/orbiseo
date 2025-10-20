#!/bin/bash

# OrbiSEO Docker Production Deployment Script
# Deploy using Docker Compose for containerized deployment

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

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        if ! command -v docker compose &> /dev/null; then
            print_error "Docker Compose is not installed. Please install Docker Compose first."
            exit 1
        fi
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi

    print_success "Docker and Docker Compose are available"
}

setup_environment() {
    print_status "Setting up environment..."

    # Check if .env.production exists
    if [[ ! -f .env.production ]]; then
        print_warning ".env.production not found. Creating from template..."
        cp .env.production.template .env.production
        print_warning "Please edit .env.production with your actual values before continuing."
        read -p "Press Enter when you've updated .env.production..."
    fi

    # Create necessary directories
    mkdir -p data/models
    mkdir -p nginx/ssl
    mkdir -p logs

    print_success "Environment setup complete"
}

build_images() {
    print_status "Building Docker images..."

    # Build all images
    $DOCKER_COMPOSE -f docker-compose.prod.yml build --no-cache

    print_success "Docker images built successfully"
}

start_services() {
    print_status "Starting services..."

    # Start all services
    $DOCKER_COMPOSE -f docker-compose.prod.yml up -d

    # Wait for services to start
    sleep 10

    print_success "Services started"
}

check_health() {
    print_status "Checking service health..."

    # Check backend services
    for i in {1..30}; do
        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            print_success "Main API is healthy"
            break
        else
            if [[ $i -eq 30 ]]; then
                print_error "Main API health check failed after 30 attempts"
            else
                echo -n "."
                sleep 2
            fi
        fi
    done

    for i in {1..30}; do
        if curl -f http://localhost:8001/health > /dev/null 2>&1; then
            print_success "Crawl API is healthy"
            break
        else
            if [[ $i -eq 30 ]]; then
                print_error "Crawl API health check failed after 30 attempts"
            else
                echo -n "."
                sleep 2
            fi
        fi
    done

    # Check frontend
    if curl -f http://localhost:9002 > /dev/null 2>&1; then
        print_success "Frontend is accessible"
    else
        print_warning "Frontend health check failed"
    fi
}

setup_ssl() {
    print_status "Setting up SSL certificates..."

    read -p "Enter your domain name (e.g., orbiseo.com): " DOMAIN

    if [[ -n "$DOMAIN" ]]; then
        # Create SSL directory
        mkdir -p nginx/ssl

        # Generate self-signed certificate for development
        # In production, replace with proper certificates
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/key.pem \
            -out nginx/ssl/cert.pem \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

        print_success "SSL certificate generated for $DOMAIN"
        print_warning "This is a self-signed certificate. For production, use proper SSL certificates."
    else
        print_warning "Skipping SSL setup - no domain provided"
    fi
}

show_status() {
    print_status "Current service status:"
    $DOCKER_COMPOSE -f docker-compose.prod.yml ps
}

show_logs() {
    echo
    read -p "Do you want to view logs? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE -f docker-compose.prod.yml logs --tail=50
    fi
}

print_summary() {
    echo
    echo "=========================================="
    echo "  OrbiSEO Docker Deployment Complete!"
    echo "=========================================="
    echo
    echo "Services:"
    echo "- Frontend: http://localhost:9002"
    echo "- Main API: http://localhost:8000"
    echo "- Crawl API: http://localhost:8001"
    echo "- Nginx Proxy: http://localhost"
    echo
    echo "Useful Commands:"
    echo "- View logs: $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f"
    echo "- Stop services: $DOCKER_COMPOSE -f docker-compose.prod.yml down"
    echo "- Restart services: $DOCKER_COMPOSE -f docker-compose.prod.yml restart"
    echo "- View status: $DOCKER_COMPOSE -f docker-compose.prod.yml ps"
    echo
    echo "To update the application:"
    echo "1. Pull latest code"
    echo "2. Run: $DOCKER_COMPOSE -f docker-compose.prod.yml build"
    echo "3. Run: $DOCKER_COMPOSE -f docker-compose.prod.yml up -d"
    echo
}

cleanup() {
    print_status "Cleaning up old containers and images..."
    docker system prune -f
    print_success "Cleanup complete"
}

# Main deployment process
main() {
    print_status "Starting OrbiSEO Docker deployment..."

    check_docker
    setup_environment

    # Build and start
    build_images
    start_services

    # Health checks
    check_health

    # Optional SSL setup
    read -p "Do you want to set up SSL certificates? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_ssl
    fi

    # Show status
    show_status
    show_logs

    # Cleanup
    cleanup

    print_summary
}

# Handle script arguments
case "${1:-}" in
    "stop")
        print_status "Stopping all services..."
        $DOCKER_COMPOSE -f docker-compose.prod.yml down
        print_success "Services stopped"
        ;;
    "restart")
        print_status "Restarting services..."
        $DOCKER_COMPOSE -f docker-compose.prod.yml restart
        print_success "Services restarted"
        ;;
    "logs")
        $DOCKER_COMPOSE -f docker-compose.prod.yml logs -f
        ;;
    "status")
        $DOCKER_COMPOSE -f docker-compose.prod.yml ps
        ;;
    "update")
        print_status "Updating application..."
        $DOCKER_COMPOSE -f docker-compose.prod.yml build --no-cache
        $DOCKER_COMPOSE -f docker-compose.prod.yml up -d
        print_success "Application updated"
        ;;
    *)
        main "$@"
        ;;
esac