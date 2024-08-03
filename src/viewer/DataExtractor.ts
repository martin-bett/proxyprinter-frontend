import { JSDOM } from 'jsdom';

class DataExtractor {
  private static parseSelector(selector: string): { selector: string, attr?: string } {
    const parts = selector.split('|').map(s => s.trim());
    if (parts.length > 1) {
      const attrMatch = parts[1].match(/attr:(\w+)/);
      if (attrMatch) {
        return { selector: parts[0], attr: attrMatch[1] };
      }
    }
    return { selector: parts[0] };
  }

  static extractFromJson(data: any, path: string): any {
    return path.split('.').reduce((o, key) => o && o[key], data);
  }

  static extractFromHtml(html: string, selectorString: string): string[] {
    const { selector, attr } = this.parseSelector(selectorString);
    const dom = new JSDOM(html);
    const elements = dom.window.document.querySelectorAll(selector);
    return Array.from(elements).map(el => 
      attr ? el.getAttribute(attr) || '' : el.textContent || ''
    );
  }

  static extract(data: any, selectorString: string, format: 'json' | 'html'): any {
    if (format === 'json') {
      return this.extractFromJson(data, selectorString);
    } else {
      return this.extractFromHtml(data, selectorString);
    }
  }
}