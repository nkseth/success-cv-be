# Docker Deployment Guide - Success CV Backend

This guide covers deploying the Success-CV Backend using Docker.

## Prerequisites

- Docker installed (v20.10+)
- Docker Compose installed (v2.0+)

## Quick Start

### 1. Environment Configuration

Your environment variables are already configured in `.env` file. The configuration includes:

- **Database**: External Postgres database connection
- **JWT**: Access and refresh token secrets
- **Azure Services**: Communication, AI, and Storage services
- **Redis**: Cache and queue configuration
- **Email**: Brevo API integration
- **Resume Parser**: Unstructured.ai API

### 2. Build and Run with Docker Compose

Start the application:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f app
```

Check container status:

```bash
docker-compose ps
```

### 3. Access the Application

The application will be available at:
- API: http://localhost:8000
- Health Check: http://localhost:8000/health

### 4. Stop Services

```bash
docker-compose down
```

## Production Deployment

### Build Docker Image

```bash
docker build -t successcv-backend:latest .
```

### Tag for Production

```bash
docker tag successcv-backend:latest successcv-backend:v1.0.0
```

### Run Container Directly

```bash
docker run -d \
  --name successcv-backend \
  -p 8000:8000 \
  --env-file .env \
  successcv-backend:latest
```

## Cloud Deployment Options

### 1. AWS Elastic Container Service (ECS)

#### Push to Amazon ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag successcv-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/successcv-backend:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/successcv-backend:latest
```

#### Deploy to ECS
1. Create ECS Task Definition with environment variables from `.env`
2. Create ECS Service
3. Configure Application Load Balancer
4. Set up CloudWatch Logs

### 2. Azure Container Instances

```bash
# Create resource group
az group create --name successcv-rg --location eastus

# Create container registry
az acr create --resource-group successcv-rg --name successcvacr --sku Basic

# Login to ACR
az acr login --name successcvacr

# Tag and push
docker tag successcv-backend:latest successcvacr.azurecr.io/successcv-backend:latest
docker push successcvacr.azurecr.io/successcv-backend:latest

# Deploy container
az container create \
  --resource-group successcv-rg \
  --name successcv-backend \
  --image successcvacr.azurecr.io/successcv-backend:latest \
  --dns-name-label successcv-api \
  --ports 8000 \
  --environment-variables \
    NODE_ENV=production \
    PORT=8000 \
  --secure-environment-variables \
    DATABASE_URL="$DATABASE_URL" \
    JWT_SECRET_ACCESS_KEY="$JWT_SECRET_ACCESS_KEY" \
    JWT_SECRET_REFRESH_KEY="$JWT_SECRET_REFRESH_KEY"
```

### 3. Google Cloud Run

```bash
# Configure gcloud
gcloud config set project YOUR_PROJECT_ID

# Build and push to Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/successcv-backend

# Deploy to Cloud Run
gcloud run deploy successcv-backend \
  --image gcr.io/YOUR_PROJECT_ID/successcv-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000 \
  --set-env-vars NODE_ENV=production,PORT=8000 \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,JWT_SECRET_ACCESS_KEY=JWT_SECRET_ACCESS_KEY:latest
```

### 4. Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Deploy:
```bash
railway up
```

4. Set environment variables in Railway dashboard or via CLI:
```bash
railway variables set DATABASE_URL="your-database-url"
```

### 5. Render

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Render will automatically detect the Dockerfile
4. Add environment variables in the Render dashboard
5. Deploy!

### 6. DigitalOcean App Platform

1. Push your code to GitHub
2. Create new App in DigitalOcean
3. Select Dockerfile as build method
4. Configure environment variables
5. Deploy

## Docker Commands Reference

### Build Commands

```bash
# Build image
docker build -t successcv-backend:latest .

# Build with no cache
docker build --no-cache -t successcv-backend:latest .

# Build for specific platform
docker build --platform linux/amd64 -t successcv-backend:latest .
```

### Container Management

```bash
# Run container
docker run -d --name successcv-backend -p 8000:8000 --env-file .env successcv-backend:latest

# Stop container
docker stop successcv-backend

# Start container
docker start successcv-backend

# Restart container
docker restart successcv-backend

# Remove container
docker rm successcv-backend

# View logs
docker logs -f successcv-backend

# Execute command in container
docker exec -it successcv-backend sh

# View container stats
docker stats successcv-backend
```

### Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f app

# Rebuild and start
docker-compose up -d --build

# Scale services (if needed)
docker-compose up -d --scale app=3
```

### Image Management

```bash
# List images
docker images

# Remove image
docker rmi successcv-backend:latest

# Remove unused images
docker image prune

# Tag image
docker tag successcv-backend:latest successcv-backend:v1.0.0
```

## Monitoring and Troubleshooting

### View Application Logs

```bash
docker-compose logs -f app
```

### Check Container Health

```bash
docker inspect --format='{{.State.Health.Status}}' successcv-backend
```

### Access Container Shell

```bash
docker-compose exec app sh
```

### Debug Container

```bash
# Run with interactive mode
docker run -it --rm --env-file .env successcv-backend:latest sh
```

### Check Resource Usage

```bash
docker stats successcv-backend
```

## Environment Variables

Your application uses the following environment variables (stored in `.env`):

### Database
- `DATABASE_URL` - PostgreSQL connection string

### JWT Authentication
- `JWT_SECRET_ACCESS_KEY` - Access token secret
- `JWT_SECRET_REFRESH_KEY` - Refresh token secret
- `ACCESS_EXPIRES_IN` - Access token expiration
- `REFRESH_EXPIRES_IN` - Refresh token expiration

### Server
- `PORT` - Server port (default: 8000)
- `NODE_ENV` - Environment mode
- `ALLOWED_ORIGINS` - CORS allowed origins
- `FRONTEND_URL` - Frontend application URL

### Azure Services
- Azure Communication Services (Email)
- Azure AI Services
- Azure Storage (Blob storage)

### Redis
- Connection and configuration for caching and queues

### External APIs
- Brevo API (Email service)
- Country API
- Unstructured.ai (Resume parser)

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use secrets management** in production:
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager
   - HashiCorp Vault

3. **Rotate credentials regularly** - Especially JWT secrets and API keys

4. **Use HTTPS** in production - Configure SSL/TLS certificates

5. **Limit container resources**:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

6. **Run security scans**:
```bash
docker scan successcv-backend:latest
```

## Performance Optimization

### Multi-stage Build
The Dockerfile uses multi-stage builds to minimize image size:
- Build stage: Installs dependencies
- Production stage: Copies only necessary files

### Image Size Optimization
```bash
# Check image size
docker images successcv-backend

# Analyze layers
docker history successcv-backend:latest
```

### Caching
- Node modules are cached in Docker layers
- Redis is configured for application caching

## Backup and Recovery

### Create Backup of Environment Variables

```bash
cp .env .env.backup
```

### Export Docker Image

```bash
docker save successcv-backend:latest | gzip > successcv-backend.tar.gz
```

### Import Docker Image

```bash
docker load < successcv-backend.tar.gz
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Build Docker image
        run: docker build -t successcv-backend:latest .
      
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push successcv-backend:latest
```

## Support

For issues or questions:
1. Check container logs: `docker-compose logs -f app`
2. Verify environment variables are set correctly
3. Ensure external services (Redis, Database, Azure) are accessible
4. Check Docker daemon status: `docker info`

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
