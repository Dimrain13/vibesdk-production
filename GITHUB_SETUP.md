# GitHub Setup & Deployment Guide

## Step 1: Initialize Git Repository

```bash
cd /app
git init
git add .
git commit -m "Initial commit: Complete Emergent Clone implementation"
```

## Step 2: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `emergent-clone`)
3. **Do NOT initialize** with README, .gitignore, or license
4. Copy the repository URL

## Step 3: Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/emergent-clone.git
git branch -M main
git push -u origin main
```

## Step 4: Configure Secrets

### Required Environment Variables

You need to set these up before deployment:

1. **ANTHROPIC_API_KEY** or **OPENAI_API_KEY** (required)
   - Get from: https://console.anthropic.com/ or https://platform.openai.com/
   
2. **JWT_SECRET** (required)
   - Generate: `openssl rand -hex 32`

3. **Optional**:
   - BRAVE_SEARCH_API_KEY (for web search)
   - STRIPE_API_KEY (for payments)

## Step 5: Local Development

```bash
# Edit environment files
nano backend/.env
nano frontend/.env

# Add your API keys to backend/.env:
ANTHROPIC_API_KEY=your_key_here
JWT_SECRET=your_generated_secret

# Start services
./scripts/setup.sh

# Or manually:
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
open http://localhost:3000
```

## Step 6: Deployment Options

### Option A: Docker (Recommended)

Already configured! Just run:
```bash
docker-compose up -d
```

### Option B: Deploy to Cloud

#### DigitalOcean App Platform
1. Connect your GitHub repository
2. Configure build settings (use Dockerfile)
3. Add environment variables in the dashboard
4. Deploy

#### AWS, GCP, Azure
See DEPLOYMENT.md for detailed instructions

## Step 7: Verify Installation

```bash
# Check backend
curl http://localhost:8001/health

# Check frontend
curl http://localhost:3000

# Test agent
curl -X POST http://localhost:8001/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "request": "Hello", "tier": "e1"}'
```

## Project Structure

```
emergent-clone/
├── backend/              # FastAPI backend
│   ├── agents/          # AI agents (E1, E1.5, E2, Design, Testing, Integration)
│   ├── api/             # REST API routes
│   ├── auth/            # Authentication system
│   ├── core/            # Core services (AgentManager, Cache, Context)
│   ├── llm/             # LLM clients (Anthropic, OpenAI)
│   ├── tools/           # Agent tools (file ops, bash, web search, etc.)
│   ├── server.py        # Main FastAPI application
│   └── requirements.txt # Python dependencies
│
├── frontend/            # React frontend
│   ├── public/
│   ├── src/
│   │   ├── api/        # API clients
│   │   ├── components/ # React components
│   │   ├── context/    # React context (AgentContext)
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
│
├── scripts/            # Utility scripts
├── docker-compose.yml  # Docker orchestration
├── Dockerfile         # Container definition
├── Makefile          # Build commands
└── README.md         # Documentation
```

## Quick Commands

```bash
# Start
make start

# Stop
make stop

# Logs
make logs

# Clean
make clean

# Test
make test

# Lint
make lint
```

## Troubleshooting

### Services won't start
```bash
docker-compose logs
docker-compose down -v
docker-compose up -d --build
```

### Database connection issues
```bash
docker-compose exec mongo mongosh
```

### Frontend can't reach backend
- Check REACT_APP_BACKEND_URL in frontend/.env
- Ensure backend is running: `curl http://localhost:8001/health`

## Next Steps

1. ✅ Push code to GitHub
2. ✅ Add API keys to environment
3. ✅ Start services locally
4. ✅ Test the application
5. ✅ Deploy to production

## Support

- Issues: Create an issue on GitHub
- Documentation: See README.md and DEPLOYMENT.md
