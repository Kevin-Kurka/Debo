import { chromium, firefox, webkit } from 'playwright';

export class BrowserAutomation {
  constructor() {
    this.browsers = {};
    this.pages = {};
  }

  async init() {
    this.browsers.chromium = await chromium.launch({ headless: false });
    this.browsers.firefox = await firefox.launch({ headless: false });
  }

  async launchSite(url, browser = 'chromium') {
    const context = await this.browsers[browser].newContext();
    const page = await context.newPage();
    
    await page.goto(url);
    const pageId = `${browser}_${Date.now()}`;
    this.pages[pageId] = page;
    
    return pageId;
  }

  async interactWithElement(pageId, selector, action, value = null) {
    const page = this.pages[pageId];
    
    switch (action) {
      case 'click':
        await page.click(selector);
        break;
      case 'type':
        await page.fill(selector, value);
        break;
      case 'screenshot':
        return await page.screenshot({ path: `screenshots/${pageId}.png` });
    }
  }

  async runPerformanceAudit(pageId) {
    const page = this.pages[pageId];
    const metrics = await page.evaluate(() => {
      return {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      };
    });
    return metrics;
  }

  async testResponsiveness(pageId, viewports) {
    const page = this.pages[pageId];
    const results = {};
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      results[`${viewport.width}x${viewport.height}`] = await page.screenshot();
    }
    
    return results;
  }
}
