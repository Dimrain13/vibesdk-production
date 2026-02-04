import { tool, t } from '../types';

interface SerpApiResponse {
    knowledge_graph?: {
        title?: string;
        description?: string;
        source?: { link?: string };
    };
    answer_box?: {
        answer?: string;
        snippet?: string;
        title?: string;
        link?: string;
    };
    organic_results?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
    }>;
    local_results?: Array<{
        title?: string;
        address?: string;
        phone?: string;
        rating?: number;
    }>;
    error?: string;
}

// Store API key from environment (set during tool building)
let serpApiKey: string | undefined;

/**
 * Set the SERPAPI key from environment
 * Call this when building tools with access to env
 */
export function setSerpApiKey(key: string | undefined): void {
    serpApiKey = key;
}

const createSearchUrl = (query: string, apiKey: string, numResults: number) => {
    const url = new URL('https://serpapi.com/search');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', Math.min(numResults, 10).toString());
    return url.toString();
};

const formatSearchResults = (
    data: SerpApiResponse,
    query: string,
    numResults: number,
): string => {
    const results: string[] = [];

    // Knowledge graph
    if (data.knowledge_graph?.title && data.knowledge_graph.description) {
        results.push(
            `**${data.knowledge_graph.title}**\n${data.knowledge_graph.description}`,
        );
        if (data.knowledge_graph.source?.link)
            results.push(`Source: ${data.knowledge_graph.source.link}`);
    }

    // Answer box
    if (data.answer_box) {
        const { answer, snippet, title, link } = data.answer_box;
        if (answer) results.push(`**Answer**: ${answer}`);
        else if (snippet) results.push(`**${title || 'Answer'}**: ${snippet}`);
        if (link) results.push(`Source: ${link}`);
    }

    // Organic results
    if (data.organic_results?.length) {
        results.push('\n**Search Results:**');
        data.organic_results.slice(0, numResults).forEach((result, index) => {
            if (result.title && result.link) {
                const text = [`${index + 1}. **${result.title}**`];
                if (result.snippet) text.push(`   ${result.snippet}`);
                text.push(`   Link: ${result.link}`);
                results.push(text.join('\n'));
            }
        });
    }

    // Local results
    if (data.local_results?.length) {
        results.push('\n**Local Results:**');
        data.local_results.slice(0, 3).forEach((result, index) => {
            if (result.title) {
                const text = [`${index + 1}. **${result.title}**`];
                if (result.address) text.push(`   Address: ${result.address}`);
                if (result.phone) text.push(`   Phone: ${result.phone}`);
                if (result.rating)
                    text.push(`   Rating: ${result.rating} stars`);
                results.push(text.join('\n'));
            }
        });
    }

    return results.length
        ? `🔍 Search results for "${query}":\n\n${results.join('\n\n')}`
        : `No results found for "${query}". Try: https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

async function performWebSearch(
    query: string,
    numResults = 5,
): Promise<string> {
    const apiKey = serpApiKey;
    if (!apiKey) {
        return `🔍 Web search requires SerpAPI key. Get one at https://serpapi.com/\n\nFallback: https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }

    try {
        const response = await fetch(
            createSearchUrl(query, apiKey, numResults),
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; WebBot/1.0)',
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            },
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`SerpAPI returned ${response.status}: ${errorText}`);
        }

        const data: SerpApiResponse = await response.json();
        if (data.error) throw new Error(`SerpAPI error: ${data.error}`);

        return formatSearchResults(data, query, numResults);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('abort');
        const fallback = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        
        console.error('Web search error:', errorMsg);
        return `Search failed: ${isTimeout ? 'Request timed out' : errorMsg}\n\nTry manually: ${fallback}`;
    }
}

/**
 * Extract readable text from HTML
 * Improved version with better handling of edge cases
 */
const extractTextFromHtml = (html: string): string => {
    let sanitized = html;
    let previousLength: number;
    
    // Remove script, style, noscript, svg, and other non-content tags
    const tagsToRemove = ['script', 'style', 'noscript', 'svg', 'head', 'nav', 'footer', 'aside', 'iframe'];
    for (const tag of tagsToRemove) {
        const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
        do {
            previousLength = sanitized.length;
            sanitized = sanitized.replace(regex, '');
        } while (sanitized.length < previousLength);
    }
    
    // Remove HTML comments
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
    
    // Keep removing all HTML tags until no more are found
    do {
        previousLength = sanitized.length;
        sanitized = sanitized.replace(/<[^>]*>/g, ' ');
    } while (sanitized.length !== previousLength);
    
    // Decode HTML entities
    sanitized = sanitized
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => 
            String.fromCharCode(parseInt(hex, 16))
        )
        .replace(/&#(\d+);/g, (_, dec) => 
            String.fromCharCode(parseInt(dec, 10))
        )
        .replace(/&amp;/g, '&');
    
    // Clean up whitespace
    return sanitized
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
};

/**
 * Fetch and extract content from a URL
 * Improved with better error handling and content type support
 */
async function fetchWebContent(url: string): Promise<string> {
    // Validate URL
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error(`Invalid URL: ${url}`);
    }
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: controller.signal,
            redirect: 'follow',
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        
        // Handle different content types
        if (contentType.includes('application/json')) {
            const json = await response.json();
            return `JSON content from ${url}:\n\n\`\`\`json\n${JSON.stringify(json, null, 2).slice(0, 4000)}\n\`\`\``;
        }
        
        if (contentType.includes('text/plain')) {
            const text = await response.text();
            return `Content from ${url}:\n\n${text.slice(0, 5000)}${text.length > 5000 ? '\n\n...(truncated)' : ''}`;
        }
        
        if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
            const html = await response.text();
            const text = extractTextFromHtml(html);
            
            if (!text || text.length < 50) {
                return `Page at ${url} has minimal readable content. It may be a single-page app requiring JavaScript.`;
            }
            
            return `Content from ${url}:\n\n${text.slice(0, 5000)}${text.length > 5000 ? '\n\n...(truncated)' : ''}`;
        }
        
        // For other content types, return info about the resource
        const size = response.headers.get('content-length');
        return `Resource at ${url}:\n- Type: ${contentType}\n- Size: ${size ? `${Math.round(parseInt(size) / 1024)}KB` : 'unknown'}`;
        
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after 15 seconds`);
            }
            throw new Error(`Failed to fetch ${url}: ${error.message}`);
        }
        throw new Error(`Failed to fetch ${url}: Unknown error`);
    }
}

type WebSearchArgs = {
    query?: string;
    url?: string;
    num_results: number;
};

type WebSearchResult = { content?: string; error?: string };

const toolWebSearch = async (args: WebSearchArgs): Promise<WebSearchResult> => {
    const { query, url, num_results } = args;
    
    try {
        if (typeof url === 'string' && url.trim()) {
            const content = await fetchWebContent(url.trim());
            return { content };
        }
        
        if (typeof query === 'string' && query.trim()) {
            const content = await performWebSearch(query.trim(), num_results || 5);
            return { content };
        }
        
        return { error: 'Either query or url parameter is required' };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Web search/fetch error:', errorMsg);
        return { error: errorMsg };
    }
};

export const toolWebSearchDefinition = tool({
    name: 'web_search',
    description: `Search the web or fetch content from URLs.

**Search Mode:** Provide 'query' to search Google via SerpAPI
**Fetch Mode:** Provide 'url' to fetch and extract content from a webpage

Examples:
- Search: { "query": "React hooks tutorial" }
- Fetch: { "url": "https://example.com/article" }`,
    args: {
        query: t.string().optional().describe('Search query for Google search'),
        url: t.string().optional().describe('URL to fetch content from'),
        num_results: t.number().default(5).describe('Number of results (1-10, default: 5)'),
    },
    run: toolWebSearch,
});
