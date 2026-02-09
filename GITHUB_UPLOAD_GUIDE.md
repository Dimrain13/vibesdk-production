# Upload to GitHub Instructions

## Step 1: Extract the Archive

```bash
tar -xzf vibesdk-github-upload.tar.gz
cd vibesdk-github-ready
```

## Step 2: Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit: VibeSDK API with Python + BeautifulSoup"
```

## Step 3: Create GitHub Repository

Go to https://github.com/new and create a new repository:
- Name: `vibesdk-api` (or whatever you prefer)
- Description: "VibeSDK API - Python on Cloudflare Workers"
- Public or Private (your choice)
- **DON'T** add README, .gitignore, or license (we already have them)

## Step 4: Push to GitHub

```bash
# Replace with your GitHub username and repo name
git remote add origin https://github.com/YOUR_USERNAME/vibesdk-api.git
git branch -M main
git push -u origin main
```

## Step 5: Setup Auto-Deploy

### Option A: GitHub Actions (Recommended)

1. Get your Cloudflare API Token:
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use template: "Edit Cloudflare Workers"
   - Copy the token

2. Add to GitHub Secrets:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Paste your token
   - Click "Add secret"

3. Done! Now every push to `main` auto-deploys!

### Option B: Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com
2. Workers & Pages → Create application → Pages
3. Connect to Git → Select your repository
4. Framework preset: Workers
5. Deploy!

## Step 6: Configure KV Namespaces

Before first deploy, you need KV namespaces:

```bash
# Install Wrangler if you haven't
npm install -g wrangler

# Login
wrangler login

# Create namespaces
wrangler kv:namespace create "API_KEYS"
wrangler kv:namespace create "GITHUB_CACHE"
```

You'll get IDs like:
```
{ binding = "API_KEYS", id = "abc123..." }
{ binding = "GITHUB_CACHE", id = "def456..." }
```

Update `wrangler.toml` with these IDs:

```toml
[[kv_namespaces]]
binding = "API_KEYS"
id = "abc123..."  # Your actual ID

[[kv_namespaces]]
binding = "GITHUB_CACHE"
id = "def456..."  # Your actual ID
```

Commit and push:
```bash
git add wrangler.toml
git commit -m "Configure KV namespaces"
git push
```

## Step 7: Set Secrets (Optional)

```bash
# For GitHub private repos
wrangler secret put GITHUB_TOKEN
# Enter your token: ghp_...

# For OpenAI (optional)
wrangler secret put OPENAI_API_KEY
# Enter your key: sk-...

# For Anthropic (optional)
wrangler secret put ANTHROPIC_API_KEY
# Enter your key: sk-ant-...
```

## Step 8: Test Your Deployment

After GitHub Actions finishes (check Actions tab):

```bash
# Get your worker URL from Cloudflare dashboard or GitHub Actions output
curl "https://your-worker.workers.dev/api/scrape/quick?url=https://example.com"
```

## That's It!

Now every time you push to `main`:
1. GitHub Actions triggers
2. Cloudflare deploys your worker
3. Your API is live globally!

## File Structure

```
vibesdk-github-ready/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Auto-deploy workflow
├── docs/
│   └── EXAMPLES.md             # Usage examples
├── src/
│   └── main.py                 # Your Python code
├── .gitignore                  # Git ignore rules
├── README.md                   # Main documentation
├── QUICKSTART.md               # Quick start guide
└── wrangler.toml               # Cloudflare config
```

## Common Issues

### "Missing KV namespace IDs"
- Run the `wrangler kv:namespace create` commands
- Update `wrangler.toml` with the IDs

### "GitHub Actions failing"
- Make sure you added `CLOUDFLARE_API_TOKEN` to secrets
- Check the Actions tab for error messages

### "Can't push to GitHub"
- Make sure you replaced `YOUR_USERNAME` with your GitHub username
- Check you created the repository on GitHub

### "Import errors in Python"
- BeautifulSoup4 is built-in, no imports needed
- Make sure you're using supported packages

## Next Steps

1. ✅ Customize `src/main.py` for your needs
2. ✅ Add more endpoints
3. ✅ Test thoroughly
4. ✅ Monitor in Cloudflare dashboard
5. ✅ Build amazing things!

## Resources

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Python Workers](https://developers.cloudflare.com/workers/languages/python/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

**Questions? Open an issue on GitHub!** 🚀
