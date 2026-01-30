#!/bin/bash

echo "🚀 Pushing Emergent Clone to GitHub"
echo "===================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Check if in /app directory
if [ ! -f "README.md" ]; then
    echo "❌ Please run this script from the /app directory"
    exit 1
fi

echo "Step 1: Initialize Git Repository"
echo "-----------------------------------"
git init
git add .
git commit -m "Initial commit: Complete Emergent Clone implementation

Features:
- Multi-tier AI agents (E1, E1.5, E2)
- Design, Testing, and Integration specialist agents
- FastAPI backend with MongoDB and Redis
- React frontend with real-time chat
- Authentication system (JWT)
- Complete development environment
- Docker deployment ready"

echo ""
echo "✅ Git repository initialized and files committed"
echo ""

echo "Step 2: Create GitHub Repository"
echo "-----------------------------------"
echo "Please follow these steps:"
echo ""
echo "1. Go to: https://github.com/new"
echo "2. Repository name: emergent-clone (or your choice)"
echo "3. Description: AI-powered development agent platform"
echo "4. Public or Private: Your choice"
echo "5. DO NOT initialize with README, .gitignore, or license"
echo "6. Click 'Create repository'"
echo ""
echo "After creating, copy the repository URL (e.g., https://github.com/username/emergent-clone.git)"
echo ""

read -p "Enter your GitHub repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

echo ""
echo "Step 3: Add Remote and Push"
echo "-----------------------------------"

git remote add origin "$REPO_URL"
git branch -M main

echo ""
echo "Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🎉 Your repository is now live at:"
    echo "   $REPO_URL"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Edit backend/.env and add your API keys"
    echo "   2. Run: ./scripts/setup.sh"
    echo "   3. Access: http://localhost:3000"
    echo ""
    echo "📚 Documentation:"
    echo "   - README.md: Project overview"
    echo "   - GITHUB_SETUP.md: Detailed setup guide"
    echo "   - DEPLOYMENT.md: Production deployment"
    echo "   - CHECKLIST.md: Implementation checklist"
else
    echo ""
    echo "❌ Push failed. Please check:"
    echo "   - GitHub repository exists"
    echo "   - You have push permissions"
    echo "   - URL is correct"
    echo ""
    echo "Manual push command:"
    echo "   git remote add origin $REPO_URL"
    echo "   git branch -M main"
    echo "   git push -u origin main"
fi
