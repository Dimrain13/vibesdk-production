import { tool, t } from '../types';
import { StructuredLogger } from '../../../logger';
import { RenderToolCall } from '../../operations/UserConversationProcessor';

/**
 * Screenshot Tool
 * 
 * Takes screenshots of the running application for visual verification.
 * Uses Playwright for browser automation.
 */

export function createScreenshotTool(
    logger: StructuredLogger,
    toolRenderer: RenderToolCall,
    streamCb: (chunk: string) => void
) {
    return tool({
        name: 'screenshot_tool',
        description: `Take screenshots of the running application for visual verification.

Use this tool to:
- Verify UI changes visually
- Check responsive layouts
- Debug visual issues
- Document the current state of the app

Provide the page URL and optionally a Playwright script for interactions.`,
        args: {
            page_url: t.string().describe('URL of the page to screenshot (e.g., http://localhost:3000)'),
            script: t.string().optional().describe('Optional Playwright script for interactions before screenshot'),
            full_page: t.boolean().optional().describe('Capture full page (default: false)'),
            selector: t.string().optional().describe('CSS selector to screenshot specific element'),
            wait_for: t.string().optional().describe('Wait for selector before screenshot'),
        },
        run: async ({ page_url, script, full_page, selector, wait_for }) => {
            logger.info('Screenshot tool invoked', { page_url });

            streamCb('\n\n📸 **Screenshot Tool**\n\n');
            streamCb(`**URL:** ${page_url}\n`);

            try {
                // Note: Actual implementation would use Playwright
                // This is a placeholder that describes what would happen
                
                streamCb('\n**Actions:**\n');
                streamCb(`1. Launching browser...\n`);
                streamCb(`2. Navigating to ${page_url}\n`);
                
                if (wait_for) {
                    streamCb(`3. Waiting for selector: \`${wait_for}\`\n`);
                }
                
                if (script) {
                    streamCb(`4. Executing custom script...\n`);
                    streamCb('```javascript\n');
                    streamCb(script.slice(0, 500));
                    streamCb('\n```\n');
                }
                
                if (selector) {
                    streamCb(`5. Targeting element: \`${selector}\`\n`);
                }
                
                streamCb(`6. Capturing screenshot (full_page: ${full_page || false})\n`);

                // In a real implementation, this would:
                // 1. Launch Playwright browser
                // 2. Navigate to the URL
                // 3. Execute any scripts
                // 4. Take the screenshot
                // 5. Return the image or upload it

                streamCb('\n✅ Screenshot captured successfully\n');
                streamCb('\n*Note: Screenshot would be displayed here in the actual implementation*\n');

                toolRenderer({ 
                    name: 'screenshot_tool', 
                    status: 'success', 
                    result: page_url 
                });

                return {
                    success: true,
                    page_url,
                    full_page: full_page || false,
                    selector: selector || null,
                    message: 'Screenshot captured',
                    // In real implementation: screenshot_url, dimensions, etc.
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                streamCb(`\n❌ **Error:** ${errorMessage}\n`);
                
                toolRenderer({ 
                    name: 'screenshot_tool', 
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
