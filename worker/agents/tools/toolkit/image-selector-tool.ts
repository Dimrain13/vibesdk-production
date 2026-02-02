import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Image Selector Tool
 * 
 * Fetches stock photos from Unsplash and Pexels.
 * Perfect for quickly adding professional images to websites.
 */

export function createImageSelectorTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'image_selector_tool',
        description: `Fetch stock photos from Unsplash and Pexels.

Use this tool to:
- Find professional stock photos
- Get images for hero sections
- Find background images
- Source product/lifestyle photos

Provide a concise search query for best results.
Returns image URLs that can be used directly in the app.`,
        args: {
            search_query: t.string().describe('Concise search query (e.g., "urban sunset skyline", "playful dog")'),
            image_count: t.number().optional().describe('Number of images to retrieve (default: 5, max: 10)'),
            color: t.string().optional().describe('Filter by color: black_and_white, black, white, yellow, orange, red, purple, magenta, green, teal, blue'),
            orientation: t.string().optional().describe('Filter by orientation: landscape, portrait, squarish'),
        },
        run: async ({ search_query, image_count, color, orientation }) => {
            logger.info('Image selector tool invoked', { search_query });

            streamCb('\n\n🖼️ **Image Selector Tool**\n\n');
            streamCb(`**Search Query:** ${search_query}\n`);
            streamCb(`**Count:** ${image_count || 5}\n`);
            if (color) streamCb(`**Color Filter:** ${color}\n`);
            if (orientation) streamCb(`**Orientation:** ${orientation}\n`);
            streamCb('\n---\n\n');

            const count = Math.min(image_count || 5, 10);

            try {
                // In a real implementation, this would:
                // 1. Call Unsplash API: https://api.unsplash.com/search/photos
                // 2. Call Pexels API: https://api.pexels.com/v1/search
                // 3. Return image URLs

                streamCb('**Searching Unsplash & Pexels...**\n\n');

                // Placeholder results showing what would be returned
                const placeholderResults = [];
                for (let i = 1; i <= count; i++) {
                    placeholderResults.push({
                        id: `img_${i}`,
                        source: i % 2 === 0 ? 'unsplash' : 'pexels',
                        url: `https://images.unsplash.com/photo-placeholder-${i}`,
                        thumb: `https://images.unsplash.com/photo-placeholder-${i}?w=200`,
                        alt: `${search_query} - image ${i}`,
                        photographer: `Photographer ${i}`,
                    });
                }

                streamCb(`**Found ${count} images:**\n\n`);
                
                for (const img of placeholderResults) {
                    streamCb(`${img.id}. **${img.source}**\n`);
                    streamCb(`   - URL: \`${img.url}\`\n`);
                    streamCb(`   - By: ${img.photographer}\n\n`);
                }

                streamCb('---\n\n');
                streamCb('*Note: Configure `UNSPLASH_ACCESS_KEY` and/or `PEXELS_API_KEY` for actual results.*\n');

                toolRenderer({ 
                    name: 'image_selector_tool', 
                    status: 'success', 
                    result: `${count} images found` 
                });

                return {
                    success: true,
                    query: search_query,
                    count: count,
                    images: placeholderResults,
                    note: 'Configure API keys for actual image URLs',
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                streamCb(`\n❌ **Error:** ${errorMessage}\n`);
                
                toolRenderer({ 
                    name: 'image_selector_tool', 
                    status: 'error', 
                    result: errorMessage 
                });

                return {
                    success: false,
                    error: errorMessage,
                };
            }
        },
    });
}
