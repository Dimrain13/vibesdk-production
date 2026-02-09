"""
VibeSDK API - Python on Cloudflare Workers
WITH BeautifulSoup4 Support!
"""

from bs4 import BeautifulSoup
from js import Response, fetch, Headers
import json
import re
from urllib.parse import urlparse, urljoin
import base64

# ============================================
# WEB SCRAPING WITH BEAUTIFULSOUP
# ============================================

async def scrape_url(url, options=None):
    """
    Scrape a URL and extract content using BeautifulSoup
    """
    options = options or {}
    
    try:
        # Fetch the page
        response = await fetch(url, {
            "headers": Headers.new({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
        })
        
        if response.status != 200:
            return {"error": f"HTTP {response.status}"}
        
        html = await response.text()
        
        # Parse with BeautifulSoup
        soup = BeautifulSoup(html, 'lxml')
        
        # Extract data
        result = {
            "url": url,
            "status_code": response.status,
            "title": extract_title(soup),
            "meta_description": extract_meta_description(soup),
            "text_content": extract_text(soup),
            "scraped_at": get_timestamp()
        }
        
        # Optional extractions
        if options.get("extract_links"):
            result["links"] = extract_links(soup, url)
        
        if options.get("extract_images"):
            result["images"] = extract_images(soup, url)
        
        # Structured data
        result["structured_data"] = extract_structured_data(soup)
        
        return result
        
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


def extract_title(soup):
    """Extract page title"""
    title_tag = soup.find('title')
    return title_tag.get_text(strip=True) if title_tag else None


def extract_meta_description(soup):
    """Extract meta description"""
    meta = soup.find('meta', attrs={'name': 'description'})
    return meta.get('content') if meta else None


def extract_text(soup):
    """Extract clean text content using BeautifulSoup"""
    # Remove script and style elements
    for script in soup(['script', 'style']):
        script.decompose()
    
    # Get text
    text = soup.get_text()
    
    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text


def extract_links(soup, base_url):
    """Extract all links from page"""
    links = []
    
    for a in soup.find_all('a', href=True):
        href = a['href']
        absolute_url = urljoin(base_url, href)
        
        links.append({
            "text": a.get_text(strip=True),
            "href": href,
            "absolute_url": absolute_url
        })
    
    return links


def extract_images(soup, base_url):
    """Extract all images from page"""
    images = []
    
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if src:
            absolute_url = urljoin(base_url, src)
            
            images.append({
                "src": src,
                "absolute_url": absolute_url,
                "alt": img.get('alt', ''),
                "title": img.get('title', '')
            })
    
    return images


def extract_structured_data(soup):
    """Extract JSON-LD structured data"""
    structured_data = {}
    
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                structured_data.update(data)
            elif isinstance(data, list):
                structured_data['items'] = data
        except:
            continue
    
    return structured_data


async def extract_with_selectors(url, selectors):
    """
    Extract specific data using CSS selectors (BeautifulSoup)
    """
    try:
        response = await fetch(url)
        html = await response.text()
        
        soup = BeautifulSoup(html, 'lxml')
        
        result = {
            "url": url,
            "scraped_at": get_timestamp()
        }
        
        # Extract data for each selector
        for field_name, selector in selectors.items():
            element = soup.select_one(selector)
            if element:
                result[field_name] = element.get_text(strip=True)
            else:
                result[field_name] = None
        
        return result
        
    except Exception as e:
        return {"error": str(e)}


async def extract_article(url):
    """
    Smart article extraction
    """
    try:
        response = await fetch(url)
        html = await response.text()
        
        soup = BeautifulSoup(html, 'lxml')
        
        article_data = {
            "url": url,
            "title": extract_article_title(soup),
            "author": extract_author(soup),
            "published_date": extract_date(soup),
            "content": extract_article_content(soup),
            "scraped_at": get_timestamp()
        }
        
        return article_data
        
    except Exception as e:
        return {"error": str(e)}


def extract_article_title(soup):
    """Try multiple methods to find article title"""
    selectors = [
        'h1.article-title',
        'h1.entry-title',
        'article h1',
        'h1',
        '[itemprop="headline"]'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return extract_title(soup)


def extract_author(soup):
    """Extract author name"""
    selectors = [
        '[rel="author"]',
        '.author',
        '[itemprop="author"]',
        '.byline'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return None


def extract_date(soup):
    """Extract publication date"""
    selectors = [
        'time[datetime]',
        '[itemprop="datePublished"]',
        '.published-date',
        '.post-date'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get('datetime') or element.get_text(strip=True)
    
    return None


def extract_article_content(soup):
    """Extract main article content"""
    selectors = [
        'article',
        '.article-content',
        '.entry-content',
        '.post-content',
        '[itemprop="articleBody"]'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return ""


async def extract_product(url):
    """
    Smart product extraction
    """
    try:
        response = await fetch(url)
        html = await response.text()
        
        soup = BeautifulSoup(html, 'lxml')
        
        product_data = {
            "url": url,
            "name": extract_product_name(soup),
            "price": extract_price(soup),
            "description": extract_product_description(soup),
            "images": extract_images(soup, url),
            "scraped_at": get_timestamp()
        }
        
        return product_data
        
    except Exception as e:
        return {"error": str(e)}


def extract_product_name(soup):
    """Extract product name"""
    selectors = [
        'h1.product-title',
        '[itemprop="name"]',
        '.product-name',
        'h1'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return None


def extract_price(soup):
    """Extract product price"""
    selectors = [
        '[itemprop="price"]',
        '.price',
        '.product-price',
        'span.price'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return None


def extract_product_description(soup):
    """Extract product description"""
    selectors = [
        '[itemprop="description"]',
        '.product-description',
        '.description'
    ]
    
    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            return element.get_text(strip=True)
    
    return ""


async def extract_table(url, table_selector="table"):
    """
    Extract HTML table as structured data
    """
    try:
        response = await fetch(url)
        html = await response.text()
        
        soup = BeautifulSoup(html, 'lxml')
        
        table = soup.select_one(table_selector)
        if not table:
            return {"error": f"Table not found with selector: {table_selector}"}
        
        # Extract headers
        headers = []
        header_row = table.find('thead')
        if header_row:
            headers = [th.get_text(strip=True) for th in header_row.find_all('th')]
        else:
            first_row = table.find('tr')
            if first_row:
                headers = [th.get_text(strip=True) for th in first_row.find_all(['th', 'td'])]
        
        # Extract rows
        rows = []
        tbody = table.find('tbody') or table
        for tr in tbody.find_all('tr'):
            cells = [td.get_text(strip=True) for td in tr.find_all('td')]
            if cells:
                if headers and len(cells) == len(headers):
                    rows.append(dict(zip(headers, cells)))
                else:
                    rows.append({"data": cells})
        
        return {
            "url": url,
            "rows_count": len(rows),
            "data": rows
        }
        
    except Exception as e:
        return {"error": str(e)}


# ============================================
# GITHUB INTEGRATION (Same as before)
# ============================================

async def get_github_file(owner, repo, file_path, github_token=None):
    """Get file content from GitHub"""
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}/contents/{file_path}"
        
        headers = Headers.new()
        headers.set("User-Agent", "VibeSDK-Python-Worker")
        headers.set("Accept", "application/vnd.github.v3.raw")
        
        if github_token:
            headers.set("Authorization", f"token {github_token}")
        
        response = await fetch(url, {"headers": headers})
        
        if response.status == 404:
            return {"error": "File not found"}
        
        content = await response.text()
        
        return {
            "file_path": file_path,
            "content": content,
            "size": len(content)
        }
        
    except Exception as e:
        return {"error": str(e)}


async def get_repo_info(owner, repo, github_token=None):
    """Get repository information"""
    try:
        url = f"https://api.github.com/repos/{owner}/{repo}"
        
        headers = Headers.new()
        headers.set("User-Agent", "VibeSDK-Python-Worker")
        
        if github_token:
            headers.set("Authorization", f"token {github_token}")
        
        response = await fetch(url, {"headers": headers})
        data = await response.json()
        
        return {
            "name": data.get("name"),
            "full_name": data.get("full_name"),
            "description": data.get("description"),
            "stars": data.get("stargazers_count"),
            "forks": data.get("forks_count"),
            "default_branch": data.get("default_branch"),
            "language": data.get("language")
        }
        
    except Exception as e:
        return {"error": str(e)}


def parse_github_url(url):
    """Parse GitHub URL to extract owner and repo"""
    match = re.search(r'github\.com/([^/]+)/([^/]+)', url)
    if not match:
        raise ValueError("Invalid GitHub URL")
    
    owner = match.group(1)
    repo = match.group(2).replace('.git', '')
    
    return owner, repo


# ============================================
# API KEY MANAGEMENT (Same as before)
# ============================================

async def store_api_key(kv_store, provider, api_key, user_id="default"):
    """Store API key in KV (encrypted)"""
    try:
        encrypted = base64.b64encode(f"{provider}:{api_key}".encode()).decode()
        
        key = f"{user_id}:{provider}"
        await kv_store.put(key, encrypted)
        
        return {
            "status": "success",
            "message": f"API key for {provider} stored successfully"
        }
        
    except Exception as e:
        return {"error": str(e)}


async def get_api_key(kv_store, provider, user_id="default"):
    """Retrieve API key from KV"""
    try:
        key = f"{user_id}:{provider}"
        encrypted = await kv_store.get(key)
        
        if not encrypted:
            return None
        
        decrypted = base64.b64decode(encrypted).decode()
        api_key = decrypted.split(':', 1)[1]
        
        return api_key
        
    except Exception as e:
        return None


async def make_api_call(kv_store, provider, endpoint, method="GET", data=None):
    """Make API call using stored credentials"""
    try:
        api_key = await get_api_key(kv_store, provider)
        
        if not api_key:
            return {"error": f"No API key found for {provider}"}
        
        headers = Headers.new()
        headers.set("Content-Type", "application/json")
        
        if provider == "openai":
            headers.set("Authorization", f"Bearer {api_key}")
        elif provider == "anthropic":
            headers.set("x-api-key", api_key)
            headers.set("anthropic-version", "2023-06-01")
        
        options = {"method": method, "headers": headers}
        
        if method != "GET" and data:
            options["body"] = json.dumps(data)
        
        response = await fetch(endpoint, options)
        result = await response.json()
        
        return {
            "status": "success",
            "status_code": response.status,
            "data": result
        }
        
    except Exception as e:
        return {"error": str(e)}


# ============================================
# MAIN WORKER HANDLER
# ============================================

async def on_fetch(request, env):
    """Main request handler for Cloudflare Worker"""
    url_obj = urlparse(request.url)
    path = url_obj.path
    
    # Parse request body
    async def get_json():
        try:
            text = await request.text()
            return json.loads(text) if text else {}
        except:
            return {}
    
    # Parse query params
    def get_query_params():
        query = url_obj.query
        params = {}
        for param in query.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                params[key] = value
        return params
    
    # SCRAPING ROUTES
    if path == "/api/scrape/url" and request.method == "POST":
        body = await get_json()
        result = await scrape_url(body.get("url"), body)
        return json_response(result)
    
    if path.startswith("/api/scrape/quick"):
        params = get_query_params()
        result = await scrape_url(params.get("url"))
        return json_response(result)
    
    if path == "/api/scrape/extract" and request.method == "POST":
        body = await get_json()
        result = await extract_with_selectors(body.get("url"), body.get("selectors", {}))
        return json_response(result)
    
    if path == "/api/scrape/article" and request.method == "POST":
        body = await get_json()
        result = await extract_article(body.get("url"))
        return json_response(result)
    
    if path == "/api/scrape/product" and request.method == "POST":
        body = await get_json()
        result = await extract_product(body.get("url"))
        return json_response(result)
    
    if path == "/api/scrape/table" and request.method == "POST":
        body = await get_json()
        result = await extract_table(body.get("url"), body.get("table_selector", "table"))
        return json_response(result)
    
    # GITHUB ROUTES
    if path.startswith("/api/github/file/"):
        parts = path.split('/')
        owner = parts[4]
        repo = parts[5]
        params = get_query_params()
        file_path = params.get("file_path", "")
        
        github_token = getattr(env, 'GITHUB_TOKEN', None)
        result = await get_github_file(owner, repo, file_path, github_token)
        return json_response(result)
    
    if path == "/api/github/repo-info":
        params = get_query_params()
        repo_url = params.get("repo_url", "")
        
        try:
            owner, repo = parse_github_url(repo_url)
            github_token = getattr(env, 'GITHUB_TOKEN', None)
            result = await get_repo_info(owner, repo, github_token)
            return json_response(result)
        except Exception as e:
            return json_response({"error": str(e)}, 400)
    
    # API CONFIG ROUTES
    if path == "/api/config/store" and request.method == "POST":
        body = await get_json()
        result = await store_api_key(
            env.API_KEYS,
            body.get("provider"),
            body.get("api_key")
        )
        return json_response(result)
    
    if path == "/api/config/call" and request.method == "POST":
        body = await get_json()
        result = await make_api_call(
            env.API_KEYS,
            body.get("provider"),
            body.get("endpoint"),
            body.get("method", "GET"),
            body.get("data")
        )
        return json_response(result)
    
    # DEFAULT RESPONSE
    return json_response({
        "message": "VibeSDK API - Python + BeautifulSoup on Cloudflare",
        "features": [
            "✅ Web Scraping with BeautifulSoup4",
            "✅ GitHub API Integration",
            "✅ API Key Management",
            "✅ Smart Article/Product Extraction",
            "✅ Table Extraction"
        ],
        "endpoints": {
            "scraping": [
                "POST /api/scrape/url",
                "GET  /api/scrape/quick?url=...",
                "POST /api/scrape/extract",
                "POST /api/scrape/article",
                "POST /api/scrape/product",
                "POST /api/scrape/table"
            ],
            "github": [
                "GET /api/github/file/{owner}/{repo}?file_path=...",
                "GET /api/github/repo-info?repo_url=..."
            ],
            "api_config": [
                "POST /api/config/store",
                "POST /api/config/call"
            ]
        }
    })


def json_response(data, status=200):
    """Create JSON response"""
    headers = Headers.new()
    headers.set("Content-Type", "application/json")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type")
    
    return Response.new(
        json.dumps(data, indent=2),
        {
            "status": status,
            "headers": headers
        }
    )


def get_timestamp():
    """Get current timestamp"""
    try:
        from datetime import datetime
        return datetime.now().isoformat()
    except:
        return "2024-01-01T00:00:00"
