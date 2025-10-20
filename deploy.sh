#!/bin/bash

# OrbiSEO Production Deployment Script
# Professional deployment for the semantic SEO platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="orbiseo"
DEPLOY_DIR="/opt/orbiseo"
BACKUP_DIR="/opt/orbiseo-backup"
NGINX_AVAILABLE="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
SYSTEMD_DIR="/etc/systemd/system"

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

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

install_dependencies() {
    print_status "Installing system dependencies..."

    # Update package list
    apt-get update

    # Install required packages
    apt-get install -y \
        nginx \
        python3 \
        python3-pip \
        python3-venv \
        nodejs \
        npm \
        curl \
        git \
        supervisor \
        certbot \
        python3-certbot-nginx \
        ufw \
        htop \
        fail2ban

    print_success "System dependencies installed"
}

setup_firewall() {
    print_status "Configuring firewall..."

    # Enable UFW
    ufw --force enable

    # Allow SSH, HTTP, HTTPS
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Allow specific application ports (for development/monitoring)
    ufw allow 8000/tcp comment "OrbiSEO Main API"
    ufw allow 8001/tcp comment "OrbiSEO Crawl API"
    ufw allow 9002/tcp comment "OrbiSEO Frontend"

    print_success "Firewall configured"
}

create_user() {
    print_status "Creating application user..."

    # Create app user if doesn't exist
    if ! id "orbiseo" &>/dev/null; then
        useradd -r -s /bin/false orbiseo
        print_success "User 'orbiseo' created"
    else
        print_warning "User 'orbiseo' already exists"
    fi
}

setup_directories() {
    print_status "Setting up directories..."

    # Create deployment directory
    mkdir -p $DEPLOY_DIR
    mkdir -p $DEPLOY_DIR/data
    mkdir -p $DEPLOY_DIR/logs
    mkdir -p $BACKUP_DIR

    # Copy application files
    cp -r . $DEPLOY_DIR/

    # Set ownership
    chown -R orbiseo:orbiseo $DEPLOY_DIR
    chmod -R 755 $DEPLOY_DIR

    print_success "Directories created and configured"
}

setup_python_backend() {
    print_status "Setting up Python backend..."

    cd $DEPLOY_DIR/python_backend

    # Create virtual environment
    python3 -m venv venv

    # Activate and install requirements
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt

    # Set ownership
    chown -R orbiseo:orbiseo venv

    print_success "Python backend configured"
}

setup_frontend() {
    print_status "Setting up Next.js frontend..."

    cd $DEPLOY_DIR

    # Install dependencies
    npm ci --only=production

    # Build application
    npm run build

    # Set ownership
    chown -R orbiseo:orbiseo .next node_modules

    print_success "Frontend built and configured"
}

setup_systemd_services() {
    print_status "Setting up systemd services..."

    # Copy service files
    cp $DEPLOY_DIR/systemd/orbiseo-main.service $SYSTEMD_DIR/
    cp $DEPLOY_DIR/systemd/orbiseo-crawl.service $SYSTEMD_DIR/

    # Reload systemd
    systemctl daemon-reload

    # Enable services
    systemctl enable orbiseo-main.service
    systemctl enable orbiseo-crawl.service

    print_success "Systemd services configured"
}

setup_nginx() {
    print_status "Setting up Nginx..."

    # Copy nginx configuration
    cp $DEPLOY_DIR/nginx/nginx.conf $NGINX_AVAILABLE/orbiseo

    # Enable site
    ln -sf $NGINX_AVAILABLE/orbiseo $NGINX_ENABLED/orbiseo

    # Remove default site
    rm -f $NGINX_ENABLED/default

    # Test nginx configuration
    nginx -t

    print_success "Nginx configured"
}

start_services() {
    print_status "Starting services..."

    # Start backend services
    systemctl start orbiseo-main.service
    systemctl start orbiseo-crawl.service

    # Start nginx
    systemctl restart nginx

    # Enable services to start on boot
    systemctl enable nginx

    print_success "All services started"
}

setup_ssl() {
    print_status "Setting up SSL certificates..."

    read -p "Enter your domain name (e.g., orbiseo.com): " DOMAIN

    if [[ -n "$DOMAIN" ]]; then
        # Generate SSL certificate
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

        # Setup auto-renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -

        print_success "SSL certificate configured for $DOMAIN"
    else
        print_warning "Skipping SSL setup - no domain provided"
    fi
}

check_health() {
    print_status "Checking application health..."

    # Wait a moment for services to start
    sleep 5

    # Check backend services
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        print_success "Main API is healthy"
    else
        print_error "Main API health check failed"
    fi

    if curl -f http://localhost:8001/health > /dev/null 2>&1; then
        print_success "Crawl API is healthy"
    else
        print_error "Crawl API health check failed"
    fi

    # Check nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx is running"
    else
        print_error "Nginx is not running"
    fi
}

create_backup() {
    print_status "Creating backup of current deployment..."

    if [[ -d $DEPLOY_DIR ]]; then
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        cp -r $DEPLOY_DIR $BACKUP_DIR/orbiseo_backup_$TIMESTAMP
        print_success "Backup created at $BACKUP_DIR/orbiseo_backup_$TIMESTAMP"
    fi
}

setup_monitoring() {
    print_status "Setting up basic monitoring..."

    # Create log rotation
    cat > /etc/logrotate.d/orbiseo << EOF
$DEPLOY_DIR/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 orbiseo orbiseo
    postrotate
        systemctl reload orbiseo-main orbiseo-crawl
    endscript
}
EOF

    print_success "Log rotation configured"
}

print_summary() {
    echo
    echo "=========================================="
    echo "  OrbiSEO Deployment Complete!"
    echo "=========================================="
    echo
    echo "Services Status:"
    echo "- Main API (Port 8000): $(systemctl is-active orbiseo-main.service)"
    echo "- Crawl API (Port 8001): $(systemctl is-active orbiseo-crawl.service)"
    echo "- Nginx: $(systemctl is-active nginx)"
    echo
    echo "URLs:"
    echo "- Main Application: http://localhost/"
    echo "- Main API: http://localhost:8000/"
    echo "- Crawl API: http://localhost:8001/"
    echo
    echo "Useful Commands:"
    echo "- Check logs: journalctl -u orbiseo-main.service -f"
    echo "- Restart services: systemctl restart orbiseo-main orbiseo-crawl"
    echo "- Check status: systemctl status orbiseo-main"
    echo
    echo "Next Steps:"
    echo "1. Configure your domain in DNS"
    echo "2. Run SSL setup if not done: certbot --nginx"
    echo "3. Monitor logs for any issues"
    echo "4. Set up backup procedures"
    echo
}

# Main deployment process
main() {
    print_status "Starting OrbiSEO production deployment..."

    check_root

    # Create backup if existing deployment
    create_backup

    # Install and configure
    install_dependencies
    setup_firewall
    create_user
    setup_directories
    setup_python_backend
    setup_frontend
    setup_systemd_services
    setup_nginx
    start_services
    setup_monitoring

    # Health check
    check_health

    # Optional SSL setup
    read -p "Do you want to set up SSL certificates now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_ssl
    fi

    print_summary
}

# Run main function
main "$@"