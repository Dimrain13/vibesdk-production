# Deployment Guide

## Prerequisites

- Docker & Docker Compose
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt recommended)
- Cloud provider account (AWS, GCP, Azure, or DigitalOcean)

## Environment Variables

### Required
```bash
ANTHROPIC_API_KEY=your_key  # OR OPENAI_API_KEY
JWT_SECRET=random-secret-key-generate-this
MONGO_URL=mongodb://mongo:27017
REDIS_URL=redis://redis:6379
```

### Optional
```bash
BRAVE_SEARCH_API_KEY=your_key
STRIPE_API_KEY=your_key
SENDGRID_API_KEY=your_key
```

## Docker Deployment

### 1. Clone Repository
```bash
git clone <your-repo>
cd emergent-clone
```

### 2. Configure Environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit files with production values
nano backend/.env
nano frontend/.env
```

### 3. Build and Deploy
```bash
docker-compose up -d --build
```

## Cloud Deployment Options

### Option 1: DigitalOcean App Platform

1. Connect GitHub repository
2. Configure build settings:
   - Backend: Dockerfile
   - Frontend: Node.js (static site)
3. Add environment variables
4. Deploy

### Option 2: AWS ECS

1. Push Docker image to ECR
2. Create ECS cluster
3. Define task definitions
4. Configure load balancer
5. Deploy service

### Option 3: Google Cloud Run

```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/emergent-clone

# Deploy
gcloud run deploy emergent-clone \
  --image gcr.io/PROJECT_ID/emergent-clone \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 4: Kubernetes

See `k8s/` directory for Kubernetes manifests.

## Database Setup

### Production MongoDB

**Option 1: MongoDB Atlas (Recommended)**
- Create cluster at mongodb.com/atlas
- Get connection string
- Update MONGO_URL in .env

**Option 2: Self-hosted**
- Use Docker volume for persistence
- Enable authentication
- Regular backups

### Production Redis

**Option 1: Redis Cloud**
- Create database at redis.com
- Get connection string
- Update REDIS_URL in .env

**Option 2: Self-hosted**
- Enable persistence (AOF + RDB)
- Configure maxmemory-policy
- Regular backups

## SSL/HTTPS Setup

### Using Nginx + Let's Encrypt

1. Install Certbot:
```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. Get certificate:
```bash
sudo certbot --nginx -d yourdomain.com
```

3. Configure Nginx (see nginx.conf.example)

## Monitoring

### Health Checks

```bash
# Application health
curl https://yourdomain.com/api/health

# Database connectivity
docker exec emergent_mongo mongosh --eval "db.adminCommand('ping')"

# Cache status
docker exec emergent_redis redis-cli ping
```

### Logging

```bash
# View all logs
docker-compose logs -f

# Backend only
docker-compose logs -f app | grep backend

# Errors only
docker-compose logs app | grep -i error
```

## Backup Strategy

### Automated Backups

```bash
# Run backup script
./scripts/backup-advanced.sh

# Schedule with cron (daily at 2 AM)
0 2 * * * /path/to/emergent-clone/scripts/backup-advanced.sh
```

### Restore from Backup

```bash
# MongoDB
docker exec -i emergent_mongo mongorestore --archive < backup/mongo.gz --gzip

# Redis
docker cp backup/redis.rdb emergent_redis:/data/dump.rdb
docker-compose restart redis
```

## Scaling

### Horizontal Scaling

1. Use load balancer (Nginx, HAProxy, or cloud LB)
2. Run multiple app containers
3. Use external MongoDB cluster
4. Use Redis Sentinel for HA

### Resource Limits

Update docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Monitor logs for suspicious activity
- [ ] Use secrets management (AWS Secrets Manager, etc.)
- [ ] Enable firewall rules
- [ ] Regular backups

## Troubleshooting

### App won't start
```bash
# Check logs
docker-compose logs app

# Check environment
docker-compose exec app env | grep -E 'MONGO|REDIS|API_KEY'

# Restart
docker-compose restart app
```

### Database connection issues
```bash
# Test MongoDB connection
docker-compose exec mongo mongosh

# Test Redis connection
docker-compose exec redis redis-cli ping
```

### High memory usage
```bash
# Check container stats
docker stats

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL

# Restart app
docker-compose restart app
```

## Production Checklist

- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Database backups automated
- [ ] Monitoring configured
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Log aggregation setup
- [ ] Performance testing completed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on operations