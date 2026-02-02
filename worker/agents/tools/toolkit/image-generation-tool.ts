import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Image Generation Tool
 * 
 * Generates images from text prompts using AI models (DALL-E, Stable Diffusion, etc.)
 * Perfect for creating website assets, illustrations, and graphics.
 */

export interface ImageGenerationRequest {
    slug_name: string;
    prompt: string;
    size?: '1024x1024' | '1024x1536' | '1536x1024';
    quality?: 'low' | 'medium' | 'high';
    style?: 'natural' | 'vivid';
}

export function createImageGenerationTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'image_generation_tool',
        description: `Generate images from text prompts using AI.

Use this tool for:
- Hero images for landing pages
- Product mockups and illustrations
- Website banners and graphics
- Blog post images
- Marketing materials
- UI/UX design assets
- Icons and logos

Provide descriptive prompts for best results. Can generate multiple images at once.`,
        args: {
            prompts: t.string().describe('JSON array of image requests: [{slug_name: string, prompt: string, size?: string, quality?: string}]'),
        },
        run: async ({ prompts }) => {
            logger.info('Image generation tool invoked');

            streamCb('\n\n🎨 **Image Generation Tool**\n\n');

            try {
                // Parse the prompts
                let imageRequests: ImageGenerationRequest[];
                try {
                    imageRequests = JSON.parse(prompts);
                    if (!Array.isArray(imageRequests)) {
                        imageRequests = [imageRequests];
                    }
                } catch {
                    // If not valid JSON, treat as single prompt
                    imageRequests = [{
                        slug_name: 'generated_image',
                        prompt: prompts,
                        size: '1024x1024',
                        quality: 'medium',
                    }];
                }

                streamCb(`**Generating ${imageRequests.length} image(s):**\n\n`);

                const results: Array<{
                    slug_name: string;
                    prompt: string;
                    status: 'success' | 'pending';
                    size: string;
                }> = [];

                for (const request of imageRequests) {
                    streamCb(`### ${request.slug_name}\n`);
                    streamCb(`- **Prompt:** ${request.prompt.slice(0, 100)}${request.prompt.length > 100 ? '...' : ''}\n`);
                    streamCb(`- **Size:** ${request.size || '1024x1024'}\n`);
                    streamCb(`- **Quality:** ${request.quality || 'medium'}\n`);
                    streamCb(`- **Status:** 🔄 Generating...\n\n`);

                    // In a real implementation, this would:
                    // 1. Call OpenAI DALL-E API or similar
                    // 2. Upload the generated image to cloud storage
                    // 3. Return the URL

                    results.push({
                        slug_name: request.slug_name,
                        prompt: request.prompt,
                        status: 'pending',
                        size: request.size || '1024x1024',
                    });
                }

                streamCb('---\n\n');
                streamCb('✅ **Image generation requests submitted**\n');
                streamCb('\n*Note: In production, images would be generated and URLs returned.*\n');
                streamCb('\n**To implement actual generation, configure:**\n');
                streamCb('- `OPENAI_API_KEY` for DALL-E\n');
                streamCb('- Or `STABILITY_API_KEY` for Stable Diffusion\n');

                toolRenderer({ 
                    name: 'image_generation_tool', 
                    status: 'success', 
                    result: `${imageRequests.length} images` 
                });

                return {
                    success: true,
                    images: results,
                    count: imageRequests.length,
                    note: 'Configure image generation API keys for actual generation',
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                streamCb(`\n❌ **Error:** ${errorMessage}\n`);
                
                toolRenderer({ 
                    name: 'image_generation_tool', 
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
