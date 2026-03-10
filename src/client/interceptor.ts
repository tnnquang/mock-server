import type { MockSchema, MockServerOptions, GeneratorOptions } from '../core/types.js';
import { generateMockData } from '../core/generator/index.js';
import { validateSchema } from '../core/schema/index.js';

/**
 * Intercepts fetch and XMLHttpRequest calls to mock server URLs.
 * Uses fetch/XHR patching (not Service Worker) for zero-config setup.
 */
export class FetchInterceptor {
  private originalFetch: typeof globalThis.fetch | null = null;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null;
  private enabled = false;

  private baseURL: string;
  private delay: number;
  private logging: boolean;
  private registeredTypes: Map<string, string>;
  private generatorOptions: GeneratorOptions;

  constructor(options: MockServerOptions = {}) {
    this.baseURL = (options.baseURL || 'http://localhost:3000').replace(/\/$/, '');
    this.delay = options.delay ?? 0;
    this.logging = options.logging ?? false;
    this.registeredTypes = new Map(Object.entries(options.types ?? {}));
    this.generatorOptions = {
      locale: options.locale || this.detectLocale(),
      ...options.generator,
    };
  }

  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    this.patchFetch();
    this.patchXHR();
  }

  disable(): void {
    if (!this.enabled) return;
    this.enabled = false;
    this.restoreFetch();
    this.restoreXHR();
  }

  registerType(name: string, definition: string): void {
    this.registeredTypes.set(name, definition);
  }

  unregisterType(name: string): void {
    this.registeredTypes.delete(name);
  }

  generate(schema: MockSchema): unknown {
    return generateMockData(schema, this.registeredTypes, this.generatorOptions);
  }

  // ─── Fetch patching ────────────────────────────────────────

  private patchFetch(): void {
    if (typeof globalThis.fetch === 'undefined') return;

    this.originalFetch = globalThis.fetch;
    const self = this;

    globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = self.extractURL(input);

      if (url && self.shouldIntercept(url)) {
        return self.handleFetchRequest(url, init);
      }

      return self.originalFetch!.call(globalThis, input, init);
    };
  }

  private restoreFetch(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }

  private async handleFetchRequest(url: string, init?: RequestInit): Promise<Response> {
    const method = init?.method || 'GET';
    const body = await this.extractFetchBody(init);

    if (this.logging) {
      console.log(`[mock-server] ${method} ${url}`, body);
    }

    try {
      const schema = this.parseSchema(body);
      const data = this.generate(schema);

      if (this.delay > 0) {
        await this.sleep(this.delay);
      }

      if (this.logging) {
        console.log(`[mock-server] Response:`, data);
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Mock-Server': 'true',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[mock-server] Error:`, message);

      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // ─── XHR patching ─────────────────────────────────────────

  private patchXHR(): void {
    if (typeof XMLHttpRequest === 'undefined') return;

    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalXHRSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _mockURL?: string; _mockMethod?: string },
      method: string,
      url: string | URL,
      ...args: any[]
    ) {
      const urlStr = url.toString();
      this._mockURL = urlStr;
      this._mockMethod = method;
      return self.originalXHROpen!.apply(this, [method, url, ...args] as any);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _mockURL?: string; _mockMethod?: string },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const url = this._mockURL;

      if (url && self.shouldIntercept(url)) {
        self.handleXHRRequest(this, url, body);
        return;
      }

      return self.originalXHRSend!.call(this, body);
    };
  }

  private restoreXHR(): void {
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen as any;
      this.originalXHROpen = null;
    }
    if (this.originalXHRSend) {
      XMLHttpRequest.prototype.send = this.originalXHRSend;
      this.originalXHRSend = null;
    }
  }

  private handleXHRRequest(
    xhr: XMLHttpRequest,
    url: string,
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const bodyStr = typeof body === 'string' ? body : '';

    if (this.logging) {
      console.log(`[mock-server] XHR ${url}`, bodyStr);
    }

    const doRespond = () => {
      try {
        const schema = this.parseSchema(bodyStr);
        const data = this.generate(schema);
        const responseText = JSON.stringify(data);

        Object.defineProperty(xhr, 'readyState', { writable: true, value: 4 });
        Object.defineProperty(xhr, 'status', { writable: true, value: 200 });
        Object.defineProperty(xhr, 'statusText', { writable: true, value: 'OK' });
        Object.defineProperty(xhr, 'responseText', { writable: true, value: responseText });
        Object.defineProperty(xhr, 'response', { writable: true, value: responseText });
        Object.defineProperty(xhr, 'responseURL', { writable: true, value: url });

        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('load'));
        xhr.dispatchEvent(new Event('loadend'));
      } catch (error) {
        Object.defineProperty(xhr, 'readyState', { writable: true, value: 4 });
        Object.defineProperty(xhr, 'status', { writable: true, value: 400 });
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.dispatchEvent(new Event('error'));
      }
    };

    if (this.delay > 0) {
      setTimeout(doRespond, this.delay);
    } else {
      // Use microtask to simulate async
      Promise.resolve().then(doRespond);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private shouldIntercept(url: string): boolean {
    return url.startsWith(this.baseURL);
  }

  private extractURL(input: RequestInfo | URL): string | null {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    if (input instanceof Request) return input.url;
    return null;
  }

  private async extractFetchBody(init?: RequestInit): Promise<string> {
    if (!init?.body) return '';
    if (typeof init.body === 'string') return init.body;
    if (init.body instanceof ArrayBuffer) {
      return new TextDecoder().decode(init.body);
    }
    if (init.body instanceof Blob) {
      return await init.body.text();
    }
    return '';
  }

  private parseSchema(body: string): MockSchema {
    if (!body || body.trim() === '') {
      throw new Error('Request body is empty. Provide a MockSchema JSON in the request body.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error('Invalid JSON in request body. Expected a MockSchema object.');
    }

    const validation = validateSchema(parsed);
    if (!validation.valid) {
      throw new Error(`Invalid schema: ${validation.errors.join('; ')}`);
    }

    return parsed as MockSchema;
  }

  private detectLocale(): string {
    try {
      if (typeof navigator !== 'undefined' && navigator.language) {
        return navigator.language.split('-')[0];
      }
    } catch {}
    return 'en';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
