# API Usage Examples

## Web Scraping Examples

### Basic Page Scraping

```bash
curl -X POST https://your-worker.workers.dev/api/scrape/url \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "extract_links": true,
    "extract_images": true
  }'
```

Response:
```json
{
  "url": "https://example.com",
  "status_code": 200,
  "title": "Example Domain",
  "meta_description": "Example website",
  "text_content": "Example Domain This domain is for...",
  "links": [
    {
      "text": "More information",
      "href": "/info",
      "absolute_url": "https://example.com/info"
    }
  ],
  "images": [],
  "scraped_at": "2024-02-09T22:45:00"
}
```

### Quick Scrape (GET)

```bash
curl "https://your-worker.workers.dev/api/scrape/quick?url=https://example.com"
```

### Extract with CSS Selectors

```bash
curl -X POST https://your-worker.workers.dev/api/scrape/extract \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://news.ycombinator.com",
    "selectors": {
      "top_story": "tr.athing:first-child .titleline > a",
      "points": "span.score:first-child",
      "comments": "tr.athing + tr a:last-child"
    }
  }'
```

Response:
```json
{
  "url": "https://news.ycombinator.com",
  "top_story": "Show HN: My Cool Project",
  "points": "245 points",
  "comments": "123 comments",
  "scraped_at": "2024-02-09T22:45:00"
}
```

### Smart Article Extraction

```bash
curl -X POST https://your-worker.workers.dev/api/scrape/article \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/blog/my-post"
  }'
```

Response:
```json
{
  "url": "https://example.com/blog/my-post",
  "title": "My Awesome Blog Post",
  "author": "John Doe",
  "published_date": "2024-02-09",
  "content": "This is the main article content...",
  "scraped_at": "2024-02-09T22:45:00"
}
```

### Smart Product Extraction

```bash
curl -X POST https://your-worker.workers.dev/api/scrape/product \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/products/widget"
  }'
```

Response:
```json
{
  "url": "https://example.com/products/widget",
  "name": "Super Widget Pro",
  "price": "$99.99",
  "description": "The best widget on the market...",
  "images": [
    {
      "src": "/images/widget.jpg",
      "absolute_url": "https://example.com/images/widget.jpg",
      "alt": "Super Widget Pro"
    }
  ],
  "scraped_at": "2024-02-09T22:45:00"
}
```

### Extract HTML Table

```bash
curl -X POST https://your-worker.workers.dev/api/scrape/table \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/data",
    "table_selector": "table.pricing"
  }'
```

Response:
```json
{
  "url": "https://example.com/data",
  "rows_count": 3,
  "data": [
    {
      "Plan": "Basic",
      "Price": "$9/mo",
      "Features": "10 GB storage"
    },
    {
      "Plan": "Pro",
      "Price": "$29/mo",
      "Features": "100 GB storage"
    },
    {
      "Plan": "Enterprise",
      "Price": "$99/mo",
      "Features": "Unlimited"
    }
  ]
}
```

## GitHub Examples

### Get File Content

```bash
curl "https://your-worker.workers.dev/api/github/file/octocat/Hello-World?file_path=README"
```

Response:
```json
{
  "file_path": "README",
  "content": "Hello World!\n\nThis is a sample repository...",
  "size": 142
}
```

### Get Repository Info

```bash
curl "https://your-worker.workers.dev/api/github/repo-info?repo_url=https://github.com/octocat/Hello-World"
```

Response:
```json
{
  "name": "Hello-World",
  "full_name": "octocat/Hello-World",
  "description": "My first repository on GitHub!",
  "stars": 2145,
  "forks": 1523,
  "default_branch": "master",
  "language": "JavaScript"
}
```

## API Key Management Examples

### Store OpenAI Key

```bash
curl -X POST https://your-worker.workers.dev/api/config/store \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "sk-proj-..."
  }'
```

Response:
```json
{
  "status": "success",
  "message": "API key for openai stored successfully"
}
```

### Use Stored Key to Call OpenAI

```bash
curl -X POST https://your-worker.workers.dev/api/config/call \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "method": "POST",
    "data": {
      "model": "gpt-3.5-turbo",
      "messages": [
        {
          "role": "user",
          "content": "Hello, how are you?"
        }
      ]
    }
  }'
```

Response:
```json
{
  "status": "success",
  "status_code": 200,
  "data": {
    "choices": [
      {
        "message": {
          "role": "assistant",
          "content": "I'm doing well, thank you! How can I help you today?"
        }
      }
    ]
  }
}
```

## JavaScript/TypeScript Examples

### Using in Your App

```javascript
// Scrape a website
async function scrapeWebsite(url) {
  const response = await fetch('https://your-worker.workers.dev/api/scrape/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url,
      extract_links: true,
      extract_images: true
    })
  });
  
  const data = await response.json();
  return data;
}

// Get GitHub file
async function getGitHubFile(owner, repo, path) {
  const response = await fetch(
    `https://your-worker.workers.dev/api/github/file/${owner}/${repo}?file_path=${path}`
  );
  
  const data = await response.json();
  return data.content;
}

// Store and use API key
async function setupAndUseOpenAI(apiKey) {
  // Store key
  await fetch('https://your-worker.workers.dev/api/config/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai',
      api_key: apiKey
    })
  });
  
  // Use key
  const response = await fetch('https://your-worker.workers.dev/api/config/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai',
      endpoint: 'https://api.openai.com/v1/models',
      method: 'GET'
    })
  });
  
  return await response.json();
}

// Usage
const data = await scrapeWebsite('https://news.ycombinator.com');
console.log(data.title, data.links.length);
```

## Python Examples

### Using requests

```python
import requests

# Scrape website
response = requests.post(
    'https://your-worker.workers.dev/api/scrape/url',
    json={
        'url': 'https://example.com',
        'extract_links': True
    }
)
data = response.json()
print(f"Title: {data['title']}")
print(f"Links: {len(data['links'])}")

# Extract article
response = requests.post(
    'https://your-worker.workers.dev/api/scrape/article',
    json={'url': 'https://example.com/blog/post'}
)
article = response.json()
print(f"Article: {article['title']}")
print(f"Author: {article['author']}")

# Get GitHub file
response = requests.get(
    'https://your-worker.workers.dev/api/github/file/owner/repo',
    params={'file_path': 'README.md'}
)
file_data = response.json()
print(file_data['content'])
```

## Real-World Use Cases

### Price Monitoring

```python
import requests
import time

def monitor_price(product_url, target_price):
    while True:
        response = requests.post(
            'https://your-worker.workers.dev/api/scrape/product',
            json={'url': product_url}
        )
        
        product = response.json()
        current_price = float(product['price'].replace('$', ''))
        
        print(f"Current price: ${current_price}")
        
        if current_price <= target_price:
            print(f"🎉 Price dropped to ${current_price}!")
            # Send notification
            break
        
        time.sleep(3600)  # Check every hour

monitor_price('https://example.com/products/widget', 79.99)
```

### News Aggregator

```python
import requests

news_sites = [
    'https://news.ycombinator.com',
    'https://lobste.rs',
    'https://reddit.com/r/programming'
]

articles = []

for site in news_sites:
    response = requests.post(
        'https://your-worker.workers.dev/api/scrape/extract',
        json={
            'url': site,
            'selectors': {
                'headlines': 'a.storylink',  # Adjust selectors per site
                'points': 'span.score'
            }
        }
    )
    
    data = response.json()
    articles.append(data)

print(f"Collected {len(articles)} news sources")
```

### GitHub Repository Analysis

```python
import requests

def analyze_repo(repo_url):
    # Get repo info
    info_response = requests.get(
        'https://your-worker.workers.dev/api/github/repo-info',
        params={'repo_url': repo_url}
    )
    
    info = info_response.json()
    
    # Get README
    owner, repo = repo_url.split('/')[-2:]
    readme_response = requests.get(
        f'https://your-worker.workers.dev/api/github/file/{owner}/{repo}',
        params={'file_path': 'README.md'}
    )
    
    readme = readme_response.json()
    
    return {
        'name': info['name'],
        'stars': info['stars'],
        'description': info['description'],
        'readme_length': len(readme.get('content', ''))
    }

analysis = analyze_repo('https://github.com/octocat/Hello-World')
print(analysis)
```

## Error Handling

```javascript
async function safeScrap(url) {
  try {
    const response = await fetch('https://your-worker.workers.dev/api/scrape/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      console.error('Scraping error:', data.error);
      return null;
    }
    
    return data;
    
  } catch (error) {
    console.error('Request failed:', error);
    return null;
  }
}
```

---

For more examples, see the main README.md and API documentation.
