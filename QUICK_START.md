# 🚀 Quick Start Guide

## Prerequisites

- Docker & Docker Compose
- Git
- Anthropic or OpenAI API key

## 1. Push to GitHub (If not done yet)

```bash
cd /app
./PUSH_TO_GITHUB.sh
```

Or manually:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/emergent-clone.git
git push -u origin main
```

## 2. Configure Environment

```bash
# Edit backend environment
cp backend/.env.example backend/.env
nano backend/.env

# Add at minimum:
ANTHROPIC_API_KEY=your_key_here
JWT_SECRET=$(openssl rand -hex 32)
```

## 3. Start Application

```bash
# Option A: Using setup script
./scripts/setup.sh

# Option B: Using Make
make start

# Option C: Using Docker Compose directly
docker-compose up -d
```

## 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs

## 5. Test It Out

Open http://localhost:3000 and try:
- "Hello, who are you?"
- "Create a simple TODO app with FastAPI and React"
- "Write a function to calculate fibonacci numbers"

## 6. Monitor

```bash
# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Check health
curl http://localhost:8001/health
```

## Common Commands

```bash
# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Clean up everything
docker-compose down -v
```

## Troubleshooting

### Services won't start
```bash
docker-compose logs
docker-compose down -v
docker-compose up -d
```

### Backend errors
```bash
# Check backend logs
docker-compose logs backend

# Check environment
docker-compose exec app env | grep API_KEY
```

### Frontend can't connect
- Verify `REACT_APP_BACKEND_URL` in frontend/.env
- Check backend is running: `curl http://localhost:8001/health`

## Next Steps

1. Read [README.md](README.md) for full documentation
2. Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
3. Review [GITHUB_SETUP.md](GITHUB_SETUP.md) for GitHub integration

## Architecture

```
┌─────────────┐
│   Frontend  │  React on port 3000
│   (React)   │
└──────┬──────┘
       │
       ▼
┌──────────────┐
│   Backend    │  FastAPI on port 8001
│  (FastAPI)   │
└──────┬───────┘
       │
   ┌───┴────┬────────┐
   ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────┐
│Mongo │ │Redis │ │ LLM  │
│ DB   │ │Cache │ │ API  │
└──────┘ └──────┘ └──────┘
```

## Support

- Issues: GitHub Issues
- Documentation: See /docs folder
- Logs: `docker-compose logs`

---

Made with ⚡ by following the complete implementation guide
