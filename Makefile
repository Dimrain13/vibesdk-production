.PHONY: help install start stop restart logs clean test lint

help:
	@echo "Available commands:"
	@echo "  make install  - Install all dependencies"
	@echo "  make start    - Start all services"
	@echo "  make stop     - Stop all services"
	@echo "  make restart  - Restart all services"
	@echo "  make logs     - View logs"
	@echo "  make clean    - Clean up containers and volumes"
	@echo "  make test     - Run tests"
	@echo "  make lint     - Run linters"

install:
	@echo "Installing dependencies..."
	cd backend && pip install -r requirements.txt
	cd frontend && yarn install
	@echo "Installation complete!"

start:
	@echo "Starting services..."
	docker-compose up -d
	@echo "Services started!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:8001"

stop:
	@echo "Stopping services..."
	docker-compose down
	@echo "Services stopped!"

restart:
	@echo "Restarting services..."
	docker-compose restart
	@echo "Services restarted!"

logs:
	docker-compose logs -f

clean:
	@echo "Cleaning up..."
	docker-compose down -v
	rm -rf backend/__pycache__
	rm -rf backend/**/__pycache__
	rm -rf frontend/node_modules
	rm -rf frontend/build
	@echo "Cleanup complete!"

test:
	@echo "Running tests..."
	cd backend && pytest
	cd frontend && yarn test
	@echo "Tests complete!"

lint:
	@echo "Running linters..."
	cd backend && ruff check .
	cd frontend && yarn lint
	@echo "Linting complete!"