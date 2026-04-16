#!/bin/bash

# WeSupport Quick Start Script
# Run this to get the project up and running

set -e

echo "🚀 WeSupport Setup Script"
echo "========================"

# Check Node version
echo "✓ Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "  Node version: $(node --version)"

# Check npm
echo "✓ Checking npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found."
    exit 1
fi

# Check PostgreSQL
echo "✓ Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Install with: brew install postgresql@15"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create database
echo ""
echo "📦 Setting up database..."
if ! psql -l 2>/dev/null | grep -q wesupport; then
    echo "  Creating 'wesupport' database..."
    createdb wesupport 2>/dev/null || echo "  Database may already exist"
else
    echo "  Database 'wesupport' already exists"
fi

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install --workspaces --legacy-peer-deps || true

# Setup environment files
echo ""
echo "🔑 Setting up environment files..."

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "  ✓ Created backend/.env (add your API keys!)"
else
    echo "  ✓ backend/.env already exists"
fi

if [ ! -f "frontend/.env.local" ]; then
    cp frontend/.env.local.example frontend/.env.local
    echo "  ✓ Created frontend/.env.local"
else
    echo "  ✓ frontend/.env.local already exists"
fi

# Setup database schema
echo ""
echo "🗄️  Setting up database schema..."
cd backend
npm run prisma:generate 2>/dev/null || true
npm run prisma:migrate -- --skip-generate 2>/dev/null || true
cd ..

# Done
echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Edit backend/.env and add your API keys:"
echo "     - FRONT_API_KEY"
echo "     - INTERCOM_ACCESS_TOKEN"
echo "     - LUCIQ_API_KEY"
echo "  2. Run: npm run dev"
echo "  3. Open: http://localhost:3000"
echo ""
echo "📚 Documentation:"
echo "  - README.md - Full documentation"
echo "  - BUILD_SUMMARY.md - What was built"
echo "  - API_SETUP_GUIDE.md - API configuration steps"
echo "  - USER_GUIDE.md - How to use the dashboard"
echo ""
