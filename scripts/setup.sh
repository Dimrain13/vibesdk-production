#!/bin/bash
set -e
echo "Setting up Emergent Clone..."
[ ! -f backend/.env ] && cp backend/.env.example backend/.env && echo "Edit backend/.env with your API keys"
[ ! -f frontend/.env ] && cp frontend/.env.example frontend/.env
mkdir -p memory test_reports logs
docker-compose build
docker-compose up -d
echo "Setup complete! Frontend: http://localhost:3000"
