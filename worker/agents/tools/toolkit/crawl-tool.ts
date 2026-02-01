import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Crawl Tool
 * 
 * Fetches and extracts content from webpages.
 * Returns clean, formatted text from URLs.
 */

export function createCrawlTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'crawl_tool',
        description: `Fetch and extract content from webpages.

Use this tool to:
- Scrape documentation pages
- Extract content from URLs provided by users
- Get text content from public webpages

Returns clean, formatted markdown text.
Cannot access authenticated or paywalled content.`,
        args: {
            url: t.string().describe('The URL to crawl (must be valid HTTP/HTTPS)'),
            question: t.string().optional().describe('What information do you need from this URL?'),
        },
        run: async ({ url, question }) => {
            logger.info('Crawl tool invoked', { url });

            streamCb('\n\n🌐 **Crawl Tool**\n\n');
            streamCb(`Fetching: ${url}\n\n`);

            try {
                // Validate URL
                const parsedUrl = new URL(url);
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    throw new Error('Only HTTP/HTTPS URLs are supported');
                }

                // Fetch the page
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; VibeSDK/1.0)',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const html = await response.text();

                // Basic HTML to text conversion
                let text = html
                    // Remove script and style tags
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                    // Remove HTML comments
                    .replace(/<!--[\s\S]*?-->/g, '')
                    // Convert common tags to markdown
                    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
                    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
                    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
                    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
                    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
                    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
                    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '\n```\n$1\n```\n')
                    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
                    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
                    // Remove remaining HTML tags
                    .replace(/<[^>]+>/g, '')
                    // Decode HTML entities
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    // Clean up whitespace
                    .replace(/\n\s*\n\s*\n/g, '\n\n')
                    .trim();

                // Truncate if too long
                const maxLength = 8000;
                if (text.length > maxLength) {
                    text = text.slice(0, maxLength) + '\n\n... [Content truncated]';
                }

                streamCb('**Extracted Content:**\n\n');
                streamCb(text.slice(0, 2000) + (text.length > 2000 ? '\n\n...' : ''));
                streamCb('\n\n');

                if (question) {
                    streamCb(`**Your Question:** ${question}\n`);
                    streamCb('The content above should help answer your question.\n');
                }

                toolRenderer({ name: 'crawl_tool', status: 'success', result: url });

                return {
                    success: true,
                    url,
                    content: text,
                    content_length: text.length,
                    truncated: text.length >= maxLength,
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                streamCb(`**Error:** ${errorMessage}\n`);
                
                toolRenderer({ name: 'crawl_tool', status: 'error', result: errorMessage });

                return {
                    success: false,
                    url,
                    error: errorMessage,
                };
            }
        },
    });
}
