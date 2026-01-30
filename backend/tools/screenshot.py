from playwright.async_api import async_playwright
import base64
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)

async def screenshot(url: str, selector: Optional[str] = None, script: Optional[str] = None) -> Dict:
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="networkidle", timeout=30000)
            
            if script:
                await page.evaluate(f"(async () => {{{script}}})()")
            
            if selector:
                element = await page.query_selector(selector)
                if element:
                    screenshot_bytes = await element.screenshot()
                else:
                    return {"success": False, "error": f"Selector not found: {selector}"}
            else:
                screenshot_bytes = await page.screenshot(full_page=False)
            
            await browser.close()
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            return {"success": True, "screenshot": screenshot_base64, "url": url}
    except Exception as e:
        logger.error(f"screenshot failed: {str(e)}")
        return {"success": False, "error": str(e)}
