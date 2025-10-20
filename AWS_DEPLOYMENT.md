# OrbiSEO AWS Deployment Guide

Complete step-by-step guide to deploy OrbiSEO on AWS with Frontend (Next.js) + 2 Backend APIs (FastAPI).

## Architecture Overview

```
Internet → CloudFront → ALB → ECS Services
                              ├── Frontend (Next.js)
                              ├── Main API (FastAPI)
                              └── AI Crawl API (FastAPI)
```

**Services:**
- **Frontend**: Next.js on ECS Fargate
- **Main API**: FastAPI on ECS Fargate (Port 8000)
- **AI Crawl API**: FastAPI on ECS Fargate (Port 8001)
- **Load Balancer**: Application Load Balancer (ALB)
- **CDN**: CloudFront for static assets
- **DNS**: Route 53 for orbiseo.com

## Prerequisites

1. **AWS Account** with administrative access
2. **AWS CLI** installed and configured
3. **Docker** installed locally
4. **Domain**: orbiseo.com (can transfer to Route 53)

## Step 1: AWS CLI Setup

```bash
# Install AWS CLI (if not installed)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

## Step 2: Create ECR Repositories

```bash
# Create ECR repositories for your Docker images
aws ecr create-repository --repository-name orbiseo-frontend --region us-east-1
aws ecr create-repository --repository-name orbiseo-main-api --region us-east-1
aws ecr create-repository --repository-name orbiseo-crawl-api --region us-east-1
```

## Step 3: Build and Push Docker Images

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build and push Frontend
docker build -f Dockerfile.frontend -t orbiseo-frontend .
docker tag orbiseo-frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-frontend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-frontend:latest

# Build and push Main API
docker build -f Dockerfile.main -t orbiseo-main-api .
docker tag orbiseo-main-api:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-main-api:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-main-api:latest

# Build and push Crawl API
docker build -f Dockerfile.crawl -t orbiseo-crawl-api .
docker tag orbiseo-crawl-api:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-crawl-api:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-crawl-api:latest
```

## Step 4: Create VPC and Networking

```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=orbiseo-vpc}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=orbiseo-igw}]'

# Create Subnets (2 public subnets for ALB, 2 private for ECS)
aws ec2 create-subnet --vpc-id vpc-xxxxxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxxxxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
aws ec2 create-subnet --vpc-id vpc-xxxxxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxxxxx --cidr-block 10.0.4.0/24 --availability-zone us-east-1b
```

## Step 5: Create Application Load Balancer

```bash
# Create Security Group for ALB
aws ec2 create-security-group --group-name orbiseo-alb-sg --description "Security group for OrbiSEO ALB" --vpc-id vpc-xxxxxx

# Create Application Load Balancer
aws elbv2 create-load-balancer \
    --name orbiseo-alb \
    --subnets subnet-xxxxx subnet-yyyyy \
    --security-groups sg-xxxxxx \
    --scheme internet-facing \
    --type application
```

## Step 6: Create ECS Cluster

```bash
# Create ECS Cluster
aws ecs create-cluster --cluster-name orbiseo-cluster --capacity-providers FARGATE
```

## Step 7: Create Task Definitions

### Frontend Task Definition (task-def-frontend.json):
```json
{
  "family": "orbiseo-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-frontend:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "NEXT_PUBLIC_API_URL",
          "value": "https://api.orbiseo.com"
        },
        {
          "name": "NEXT_PUBLIC_AI_CRAWL_URL",
          "value": "https://crawl.orbiseo.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/orbiseo-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### Main API Task Definition (task-def-main-api.json):
```json
{
  "family": "orbiseo-main-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "main-api",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-main-api:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "8000"
        },
        {
          "name": "CORS_ORIGINS",
          "value": "[\"https://orbiseo.com\", \"https://www.orbiseo.com\"]"
        }
      ],
      "secrets": [
        {
          "name": "PINECONE_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:orbiseo/pinecone-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/orbiseo-main-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### AI Crawl API Task Definition (task-def-crawl-api.json):
```json
{
  "family": "orbiseo-crawl-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "crawl-api",
      "image": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/orbiseo-crawl-api:latest",
      "portMappings": [
        {
          "containerPort": 8001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "PORT",
          "value": "8001"
        },
        {
          "name": "CORS_ORIGINS",
          "value": "[\"https://orbiseo.com\", \"https://www.orbiseo.com\"]"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/orbiseo-crawl-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Step 8: Register Task Definitions

```bash
# Register task definitions
aws ecs register-task-definition --cli-input-json file://task-def-frontend.json
aws ecs register-task-definition --cli-input-json file://task-def-main-api.json
aws ecs register-task-definition --cli-input-json file://task-def-crawl-api.json
```

## Step 9: Create Target Groups

```bash
# Create target groups for each service
aws elbv2 create-target-group \
    --name orbiseo-frontend-tg \
    --protocol HTTP \
    --port 3000 \
    --vpc-id vpc-xxxxxx \
    --target-type ip \
    --health-check-path /

aws elbv2 create-target-group \
    --name orbiseo-main-api-tg \
    --protocol HTTP \
    --port 8000 \
    --vpc-id vpc-xxxxxx \
    --target-type ip \
    --health-check-path /health

aws elbv2 create-target-group \
    --name orbiseo-crawl-api-tg \
    --protocol HTTP \
    --port 8001 \
    --vpc-id vpc-xxxxxx \
    --target-type ip \
    --health-check-path /health
```

## Step 10: Create ALB Listeners and Rules

```bash
# Create HTTPS listener (after SSL certificate)
aws elbv2 create-listener \
    --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:loadbalancer/app/orbiseo-alb/xxxxxxxxxx \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=arn:aws:acm:us-east-1:YOUR_ACCOUNT_ID:certificate/xxxxxxxxx \
    --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-frontend-tg/xxxxxxxxxx

# Create rules for API routing
aws elbv2 create-rule \
    --listener-arn arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:listener/app/orbiseo-alb/xxxxxxxxxx/xxxxxxxxxx \
    --priority 100 \
    --conditions Field=host-header,Values=api.orbiseo.com \
    --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-main-api-tg/xxxxxxxxxx

aws elbv2 create-rule \
    --listener-arn arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:listener/app/orbiseo-alb/xxxxxxxxxx/xxxxxxxxxx \
    --priority 200 \
    --conditions Field=host-header,Values=crawl.orbiseo.com \
    --actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-crawl-api-tg/xxxxxxxxxx
```

## Step 11: Create ECS Services

```bash
# Create Frontend Service
aws ecs create-service \
    --cluster orbiseo-cluster \
    --service-name orbiseo-frontend-service \
    --task-definition orbiseo-frontend:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxxx],assignPublicIp=ENABLED}" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-frontend-tg/xxxxxxxxxx,containerName=frontend,containerPort=3000

# Create Main API Service
aws ecs create-service \
    --cluster orbiseo-cluster \
    --service-name orbiseo-main-api-service \
    --task-definition orbiseo-main-api:1 \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxxx],assignPublicIp=ENABLED}" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-main-api-tg/xxxxxxxxxx,containerName=main-api,containerPort=8000

# Create Crawl API Service
aws ecs create-service \
    --cluster orbiseo-cluster \
    --service-name orbiseo-crawl-api-service \
    --task-definition orbiseo-crawl-api:1 \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxxx],assignPublicIp=ENABLED}" \
    --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:YOUR_ACCOUNT_ID:targetgroup/orbiseo-crawl-api-tg/xxxxxxxxxx,containerName=crawl-api,containerPort=8001
```

## Step 12: Set up Route 53 DNS

```bash
# Create hosted zone (if not exists)
aws route53 create-hosted-zone --name orbiseo.com --caller-reference $(date +%s)

# Create DNS records
# Main domain
aws route53 change-resource-record-sets --hosted-zone-id Z1234567890 --change-batch file://dns-main.json

# API subdomain
aws route53 change-resource-record-sets --hosted-zone-id Z1234567890 --change-batch file://dns-api.json

# Crawl subdomain
aws route53 change-resource-record-sets --hosted-zone-id Z1234567890 --change-batch file://dns-crawl.json
```

## Step 13: SSL Certificate (ACM)

```bash
# Request SSL certificate
aws acm request-certificate \
    --domain-name orbiseo.com \
    --subject-alternative-names www.orbiseo.com api.orbiseo.com crawl.orbiseo.com \
    --validation-method DNS \
    --region us-east-1
```

## Step 14: CloudFront Distribution (Optional)

```bash
# Create CloudFront distribution for better performance
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

## Step 15: Secrets Manager (for API Keys)

```bash
# Store Pinecone API key securely
aws secretsmanager create-secret \
    --name orbiseo/pinecone-api-key \
    --description "Pinecone API key for OrbiSEO" \
    --secret-string "pcsk_5tgCig_HMWycqqQtk8ybJxw6nLx2c9TnRgqHAJMTiCGwAY3hZqzc32eDtfQSmunRTVmaz3"
```

## Final Architecture

```
Internet
    ↓
Route 53 (orbiseo.com)
    ↓
CloudFront CDN
    ↓
Application Load Balancer
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│  ECS Service    │  ECS Service    │  ECS Service    │
│  Frontend       │  Main API       │  Crawl API      │
│  (Next.js)      │  (FastAPI)      │  (FastAPI)      │
│  Port: 3000     │  Port: 8000     │  Port: 8001     │
└─────────────────┴─────────────────┴─────────────────┘
```

## Cost Optimization

1. **Use t4g.small instances** for lower costs
2. **Auto Scaling** based on CPU/Memory
3. **Spot instances** for non-critical workloads
4. **CloudWatch** for monitoring and cost tracking

## Monitoring & Logging

1. **CloudWatch Logs** for application logs
2. **CloudWatch Metrics** for performance monitoring
3. **AWS X-Ray** for distributed tracing
4. **Health checks** on all target groups

## Security Best Practices

1. **Security Groups** with minimal required ports
2. **IAM roles** with least privilege
3. **Secrets Manager** for API keys
4. **WAF** for web application firewall
5. **VPC** with private subnets for ECS tasks

This deployment will give you a production-ready, scalable architecture on AWS for your OrbiSEO application with all three services properly configured and secured.