# VibeSDK API - Python on Cloudflare Workers

Complete API system with GitHub integration, web scraping, and API management - all running on Cloudflare Workers using Python + BeautifulSoup4.

## 🚀 Features

- ✅ **Web Scraping** with BeautifulSoup4
- ✅ **GitHub API Integration** 
- ✅ **API Key Management** (encrypted in KV)
- ✅ **Smart Extraction** (articles, products, tables)
- ✅ **Global Edge Deployment** (300+ locations)
- ✅ **Auto-Deploy** from GitHub

## 📦 What's Included

- Web scraping with CSS selectors
- Article/product extraction
- HTML table parsing
- GitHub file reading
- API key storage (OpenAI, Anthropic, etc.)
- All on Cloudflare - no third-party services

## 🔧 Deployment

This repo auto-deploys to Cloudflare Workers when you push to main.

### First-Time Setup

1. **Create KV Namespaces**
   ```bash
   wrangler kv:namespace create "API_KEYS"
   wrangler kv:namespace create "GITHUB_CACHE"
   ```

2. **Update `wrangler.toml`**
   
   Replace the KV namespace IDs with the ones from step 1.

3. **Set Secrets (Optional)**
   ```bash
   wrangler secret put GITHUB_TOKEN
   wrangler secret put OPENAI_API_KEY
   wrangler secret put ANTHROPIC_API_KEY
   ```

4. **Deploy**
   ```bash
   wrangler deploy
   ```

### Auto-Deploy from GitHub

Every time you push to `main`, Cloudflare automatically deploys!

## 📚 API Endpoints

### Web Scraping

```bash
# Scrape with BeautifulSoup
POST /api/scrape/url
{
  "url": "https://example.com",
  "extract_links": true,
  "extract_images": true
}

# Quick scrape
GET /api/scrape/quick?url=https://example.com

# Custom CSS selectors
POST /api/scrape/extract
{
  "url": "https://example.com",
  "selectors": {
    "title": "h1.main-title",
    "price": "span.price"
  }
}

# Smart article extraction
POST /api/scrape/article
{
  "url": "https://example.com/article"
}

# Smart product extraction
POST /api/scrape/product
{
  "url": "https://example.com/product"
}

# Extract HTML table
POST /api/scrape/table
{
  "url": "https://example.com",
  "table_selector": "table.data"
}
```

### GitHub Integration

```bash
# Get file from repository
GET /api/github/file/owner/repo?file_path=README.md

# Get repository info
GET /api/github/repo-info?repo_url=https://github.com/owner/repo
```

### API Key Management

```bash
# Store API key (encrypted)
POST /api/config/store
{
  "provider": "openai",
  "api_key": "sk-..."
}

# Make API call with stored key
POST /api/config/call
{
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1/models",
  "method": "GET"
}
```

## 💻 Local Development

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Run locally
wrangler dev

# Deploy
wrangler deploy
```

## 🔐 Environment Variables

Set these via `wrangler secret put`:

- `GITHUB_TOKEN` - GitHub personal access token (for private repos)
- `OPENAI_API_KEY` - OpenAI API key (optional)
- `ANTHROPIC_API_KEY` - Anthropic API key (optional)

KV Namespaces (configure in `wrangler.toml`):
- `API_KEYS` - For storing encrypted API keys
- `GITHUB_CACHE` - For caching GitHub API responses

## 📖 Documentation

See `docs/` folder for:
- Complete API reference
- Usage examples
- Deployment guide

## 🎯 Use Cases

- **Content Aggregation** - Scrape multiple news sites
- **Price Monitoring** - Track product prices
- **Data Collection** - Extract structured data
- **API Orchestration** - Combine multiple APIs
- **GitHub Automation** - Read/analyze repositories

## 🛠️ Tech Stack

- **Python 3.11** (via Pyodide)
- **BeautifulSoup4** - HTML parsing
- **Cloudflare Workers** - Serverless compute
- **Cloudflare KV** - Key-value storage
- **GitHub API** - Repository access

## 📊 Performance

- **Free Tier**: 100,000 requests/day
- **Cold Start**: ~50ms
- **Response Time**: <100ms (edge network)
- **Locations**: 300+ globally

## 🔄 Updates

Push to main branch and Cloudflare auto-deploys:

```bash
git add .
git commit -m "Update API"
git push origin main
```

## 📝 License

MIT License - feel free to use in your projects!

## 🆘 Support

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **API Issues**: Open a GitHub issue
- **Questions**: Check the docs/ folder

---

**Built for production. Powered by Cloudflare Workers.** ⚡
