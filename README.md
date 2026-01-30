# Emergent Clone

A full-featured AI-powered development agent platform built with FastAPI, React, and MongoDB.

## Features

- 🤖 **Multi-tier AI Agents**: E1 (fast), E1.5 (thorough), E2 (expert)
- 💻 **Code Editor**: Monaco-based editor with syntax highlighting
- 📁 **File Explorer**: Browse and manage project files
- 🖥️ **Integrated Terminal**: Execute commands directly
- 🎨 **Design Agent**: Automated UI/UX design generation
- 🧪 **Testing Agent**: Comprehensive automated testing
- 🔌 **Integration Agent**: Third-party API integration playbooks
- 💬 **Real-time Chat**: WebSocket-based agent communication
- 🔐 **Authentication**: JWT-based user authentication

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **MongoDB**: NoSQL database via Motor (async)
- **Redis**: Caching and session storage
- **Anthropic Claude**: Primary LLM (or OpenAI)
- **Playwright**: Browser automation for testing

### Frontend
- **React 18**: UI framework
- **Monaco Editor**: Code editing
- **React Markdown**: Markdown rendering with syntax highlighting
- **WebSocket**: Real-time communication

## Quick Start

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd emergent-clone
```

### 2. Environment Setup

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env and add your API keys
```

### 3. Start with Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

## Configuration

### Required Environment Variables

```bash
# Backend (.env)
ANTHROPIC_API_KEY=your_key  # OR OPENAI_API_KEY
MONGO_URL=mongodb://mongo:27017
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secret-key

# Frontend (.env)
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload

# Frontend
cd frontend
yarn install
yarn start
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.

## License

MIT License