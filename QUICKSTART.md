# Quick Start Guide

## 1. Fork/Clone This Repo

```bash
git clone https://github.com/yourusername/vibesdk-api.git
cd vibesdk-api
```

## 2. Install Wrangler

```bash
npm install -g wrangler
```

## 3. Login to Cloudflare

```bash
wrangler login
```

## 4. Create KV Namespaces

```bash
wrangler kv:namespace create "API_KEYS"
wrangler kv:namespace create "GITHUB_CACHE"
```

You'll get output like:
```
🌀 Creating namespace with title "vibesdk-api-API_KEYS"
✨ Success!
Add the following to your wrangler.toml:
{ binding = "API_KEYS", id = "abc123..." }
```

## 5. Update wrangler.toml

Replace the empty `id = ""` fields with your IDs:

```toml
[[kv_namespaces]]
binding = "API_KEYS"
id = "abc123..."  # Your ID here

[[kv_namespaces]]
binding = "GITHUB_CACHE"
id = "def456..."  # Your ID here
```

## 6. Set Secrets (Optional)

```bash
# For private GitHub repos
wrangler secret put GITHUB_TOKEN
# Enter your GitHub token when prompted

# For OpenAI integration (optional)
wrangler secret put OPENAI_API_KEY
# Enter your OpenAI key

# For Anthropic integration (optional)
wrangler secret put ANTHROPIC_API_KEY
# Enter your Anthropic key
```

## 7. Deploy!

```bash
wrangler deploy
```

You'll get a URL like: `https://vibesdk-api.your-subdomain.workers.dev`

## 8. Test It

```bash
# Test scraping
curl "https://your-worker.workers.dev/api/scrape/quick?url=https://example.com"

# Test with BeautifulSoup
curl -X POST https://your-worker.workers.dev/api/scrape/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "extract_links": true}'
```

## 9. Setup Auto-Deploy from GitHub

### Option A: GitHub Actions (Recommended)

1. Go to your GitHub repo → Settings → Secrets and variables → Actions
2. Add secret: `CLOUDFLARE_API_TOKEN`
   - Get token from: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token" → Use "Edit Cloudflare Workers" template
3. Push to main branch → Auto-deploys!

```bash
git add .
git commit -m "Update"
git push origin main
# ✅ Cloudflare auto-deploys!
```

### Option B: Cloudflare Pages

1. Go to Cloudflare Dashboard → Workers & Pages → Create
2. Connect your GitHub repository
3. Select "Workers" preset
4. Deploy!

Now every push to `main` auto-deploys!

## 10. Usage Examples

### Scrape a Website
```bash
curl -X POST https://your-worker.workers.dev/api/scrape/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://news.ycombinator.com",
    "extract_links": true
  }'
```

### Extract Article
```bash
curl -X POST https://your-worker.workers.dev/api/scrape/article \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/blog/post"}'
```

### Get GitHub File
```bash
curl "https://your-worker.workers.dev/api/github/file/octocat/Hello-World?file_path=README"
```

### Store API Key
```bash
curl -X POST https://your-worker.workers.dev/api/config/store \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "sk-..."
  }'
```

### Use Stored API Key
```bash
curl -X POST https://your-worker.workers.dev/api/config/call \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1/models",
    "method": "GET"
  }'
```

## Troubleshooting

### "Namespace not found"
- Make sure you updated the IDs in `wrangler.toml`
- IDs should look like: `abc123def456...`

### "Deploy failed"
- Run `wrangler whoami` to check you're logged in
- Check your Cloudflare account has Workers enabled

### "Module not found: bs4"
- This is normal! BeautifulSoup4 is built-in to Python Workers
- No installation needed

### "CORS error"
- API includes CORS headers by default
- Check if you're making requests from allowed origin

## Next Steps

1. ✅ Customize the API for your needs
2. ✅ Add more endpoints in `src/main.py`
3. ✅ Set up monitoring in Cloudflare dashboard
4. ✅ Build amazing things!

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Python Workers Guide](https://developers.cloudflare.com/workers/languages/python/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [BeautifulSoup Docs](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)

## Need Help?

- Check the full README.md
- Open a GitHub issue
- Check Cloudflare documentation

---

**Ready to deploy? Run: `wrangler deploy`** 🚀
