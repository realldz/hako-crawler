/**
 * Network Manager for hako-crawler
 * Handles HTTP requests with retry logic, domain rotation, anti-ban measures, and proxy support
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, Proxy: 1.1, 2.1-2.3, 3.1-3.2, 6.1-6.3, 8.1-8.4
 */

import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname } from 'node:path';

import { DOMAINS, IMAGE_DOMAINS, HEADERS, NETWORK } from '../config/constants';
import { ensureDir, fileExistsWithContent } from '../utils/fs';
import { ProxyPool } from './proxy-pool';
import type { FetchOptions, NetworkOptions, ProxyConfig } from '../types';

// Import proxy agents
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksClient } from 'socks';
import * as tls from 'node:tls';

/**
 * Custom error class for proxy-related errors
 */
export class ProxyError extends Error {
    constructor(
        message: string,
        public readonly proxyHost?: string,
        public readonly proxyPort?: number
    ) {
        super(message);
        this.name = 'ProxyError';
    }
}

/**
 * NetworkManager handles all HTTP operations with built-in resilience features:
 * - Exponential backoff retry (3 retries)
 * - Domain rotation for Hako domains
 * - Anti-ban pause every 100 requests
 * - Stream downloads for large files
 * - Proxy support with round-robin and failover
 */
export class NetworkManager {
    private requestCount: number = 0;
    private readonly domains: readonly string[];
    private readonly imageDomains: readonly string[];
    private readonly headers: Record<string, string>;
    private readonly proxyPool: ProxyPool | null;
    private readonly timeout: number;

    /**
     * Creates a new NetworkManager
     * Requirements: Proxy 4.1
     *
     * @param options - Optional network configuration including proxy settings
     */
    constructor(options?: NetworkOptions) {
        this.domains = DOMAINS;
        this.imageDomains = IMAGE_DOMAINS;
        this.headers = { ...HEADERS };
        this.timeout = options?.timeout ?? NETWORK.TIMEOUT;

        // Initialize proxy pool if proxy is configured
        if (options?.proxy) {
            this.proxyPool = new ProxyPool(options.proxy);
        } else {
            this.proxyPool = null;
        }
    }


    /**
     * Builds a proxy URL from ProxyConfig
     */
    private buildProxyUrl(proxy: ProxyConfig): string {
        let url = `${proxy.protocol}://`;
        if (proxy.username) {
            url += encodeURIComponent(proxy.username);
            if (proxy.password) {
                url += `:${encodeURIComponent(proxy.password)}`;
            }
            url += '@';
        }
        url += `${proxy.host}:${proxy.port}`;
        return url;
    }

    /**
     * Fetches a URL using a specific proxy
     * Requirements: Proxy 1.1, 6.1, 6.2, 6.3
     *
     * @param url - The URL to fetch
     * @param proxy - The proxy configuration to use
     * @param headers - Request headers
     * @param timeout - Request timeout
     * @returns The fetch Response
     */
    private async fetchViaProxy(
        url: string,
        proxy: ProxyConfig,
        headers: Record<string, string>,
        timeout: number
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const proxyUrl = this.buildProxyUrl(proxy);


            if (proxy.protocol === 'socks5') {
                // Use socks package directly for SOCKS5 (Bun compatible)
                const parsedUrl = new URL(url);
                const isHttps = parsedUrl.protocol === 'https:';
                const targetPort = parseInt(parsedUrl.port) || (isHttps ? 443 : 80);



                // Create SOCKS connection
                const socksOptions = {
                    proxy: {
                        host: proxy.host,
                        port: proxy.port,
                        type: 5 as const,
                        ...(proxy.username && proxy.password ? {
                            userId: proxy.username,
                            password: proxy.password,
                        } : {}),
                    },
                    command: 'connect' as const,
                    destination: {
                        host: parsedUrl.hostname,
                        port: targetPort,
                    },
                    timeout: timeout,
                };

                const { socket } = await SocksClient.createConnection(socksOptions);

                // For HTTPS, wrap socket with TLS
                let finalSocket: typeof socket | tls.TLSSocket = socket;
                if (isHttps) {
                    finalSocket = tls.connect({
                        socket: socket,
                        servername: parsedUrl.hostname,
                    });
                    await new Promise<void>((resolve, reject) => {
                        (finalSocket as tls.TLSSocket).once('secureConnect', resolve);
                        (finalSocket as tls.TLSSocket).once('error', reject);
                    });
                }

                // Build HTTP request
                const path = parsedUrl.pathname + parsedUrl.search;
                const headerLines = Object.entries(headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\r\n');
                const httpRequest = `GET ${path} HTTP/1.1\r\nHost: ${parsedUrl.hostname}\r\n${headerLines}\r\nConnection: close\r\n\r\n`;

                // Send request and read response
                return new Promise<Response>((resolve, reject) => {
                    const chunks: Buffer[] = [];

                    finalSocket.on('data', (chunk: Buffer) => chunks.push(chunk));
                    finalSocket.on('end', () => {
                        clearTimeout(timeoutId);
                        this.requestCount++;

                        const rawResponse = Buffer.concat(chunks).toString();
                        const headerEndIndex = rawResponse.indexOf('\r\n\r\n');
                        const headerPart = rawResponse.substring(0, headerEndIndex);
                        const bodyPart = rawResponse.substring(headerEndIndex + 4);

                        // Parse status line
                        const statusLine = headerPart.split('\r\n')[0];
                        const statusMatch = statusLine?.match(/HTTP\/\d\.\d (\d+) (.+)/);
                        const status = statusMatch ? parseInt(statusMatch[1]) : 200;
                        const statusText = statusMatch ? statusMatch[2] : 'OK';



                        resolve(new Response(bodyPart, {
                            status,
                            statusText,
                        }));
                    });
                    finalSocket.on('error', (err: Error) => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });

                    controller.signal.addEventListener('abort', () => {
                        finalSocket.destroy();
                        reject(new Error('Request aborted'));
                    });

                    finalSocket.write(httpRequest);
                });
            } else {
                // Use https-proxy-agent for HTTP/HTTPS proxy (works with Bun and Node)
                const agent = new HttpsProxyAgent(proxyUrl);

                const { default: https } = await import('node:https');
                const { default: http } = await import('node:http');

                return new Promise((resolve, reject) => {
                    const parsedUrl = new URL(url);
                    const isHttps = parsedUrl.protocol === 'https:';
                    const client = isHttps ? https : http;

                    const req = client.request(url, {
                        method: 'GET',
                        headers,
                        agent: agent as any,
                        signal: controller.signal,
                    }, (res) => {
                        const chunks: Buffer[] = [];
                        res.on('data', (chunk) => chunks.push(chunk));
                        res.on('end', () => {
                            clearTimeout(timeoutId);
                            this.requestCount++;
                            const body = Buffer.concat(chunks);
                            resolve(new Response(body, {
                                status: res.statusCode || 200,
                                statusText: res.statusMessage || 'OK',
                                headers: res.headers as any,
                            }));
                        });
                    });

                    req.on('error', (err) => {
                        clearTimeout(timeoutId);
                        reject(err);
                    });

                    req.end();
                });
            }
        } catch (error) {
            clearTimeout(timeoutId);

            const errorMessage = error instanceof Error ? error.message : String(error);

            // Categorize proxy errors
            if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
                throw new ProxyError(
                    `Proxy connection failed: ${proxy.host}:${proxy.port}`,
                    proxy.host,
                    proxy.port
                );
            }

            if (errorMessage.includes('407') || errorMessage.includes('authentication')) {
                throw new ProxyError(
                    `Proxy authentication failed: ${proxy.host}:${proxy.port}`,
                    proxy.host,
                    proxy.port
                );
            }

            if (errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
                throw new ProxyError(
                    `Proxy connection timed out: ${proxy.host}:${proxy.port}`,
                    proxy.host,
                    proxy.port
                );
            }

            throw error;
        }
    }

    /**
     * Fetches a URL with proxy failover support
     * Requirements: Proxy 8.1, 8.2, 8.3, 8.4
     *
     * @param url - The URL to fetch
     * @param headers - Request headers
     * @param timeout - Request timeout
     * @returns The fetch Response
     */
    private async fetchWithProxyFailover(
        url: string,
        headers: Record<string, string>,
        timeout: number
    ): Promise<Response> {
        if (!this.proxyPool) {
            throw new Error('No proxy pool configured');
        }

        const proxies = this.proxyPool.getAllProxies();
        const errors: Error[] = [];

        // Try each proxy in the pool
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i]!;

            try {
                return await this.fetchViaProxy(url, proxy, headers, timeout);
            } catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)));
                // Continue to next proxy
            }
        }

        // All proxies failed
        throw new ProxyError(
            `All proxies failed. Tried ${proxies.length} proxies. Last error: ${errors[errors.length - 1]?.message}`
        );
    }


    /**
     * Fetches a URL with retry logic and exponential backoff
     * Requirements: 3.1, 3.2, Proxy 1.1, 1.2
     *
     * @param url - The URL to fetch
     * @param options - Optional fetch configuration
     * @returns The fetch Response
     * @throws Error after all retries are exhausted
     */
    async fetchWithRetry(url: string, options?: FetchOptions): Promise<Response> {
        await this.applyAntiBan();

        const timeout = options?.timeout ?? this.timeout;
        const headers = { ...this.headers, ...options?.headers };

        let lastError: Error | null = null;
        let rateLimitRetries = 0;
        const maxRateLimitRetries = 5;

        for (let attempt = 0; attempt < NETWORK.MAX_RETRIES; attempt++) {
            try {
                let response: Response;

                // Use proxy if configured, otherwise direct fetch
                if (this.proxyPool) {
                    response = await this.fetchWithProxyFailover(url, headers, timeout);
                } else {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    response = await fetch(url, {
                        headers,
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);
                    this.requestCount++;
                }

                if (response.ok) {
                    return response;
                }

                // Handle rate limiting (429)
                if (response.status === 429) {
                    rateLimitRetries++;
                    if (rateLimitRetries <= maxRateLimitRetries) {
                        const waitTime = Math.min(30 * rateLimitRetries, 120);
                        console.log(`\nRate limited (429). Waiting ${waitTime}s before retry ${rateLimitRetries}/${maxRateLimitRetries}...`);
                        await this.sleep(waitTime * 1000);
                        attempt--;
                        continue;
                    }
                    lastError = new Error(`HTTP 429: Rate limited after ${maxRateLimitRetries} retries`);
                    break;
                }

                // Try domain rotation for internal URLs (only for non-proxy requests)
                if (!this.proxyPool && this.isInternalDomain(url)) {
                    const rotatedResponse = await this.rotateDomainsAndRetry(url, headers, timeout);
                    if (rotatedResponse) {
                        return rotatedResponse;
                    }
                }

                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // For proxy errors, don't retry with domain rotation
                if (error instanceof ProxyError) {
                    throw error;
                }

                // Try domain rotation for internal URLs on network errors (non-proxy only)
                if (!this.proxyPool && this.isInternalDomain(url)) {
                    const rotatedResponse = await this.rotateDomainsAndRetry(url, headers, timeout);
                    if (rotatedResponse) {
                        return rotatedResponse;
                    }
                }
            }

            // Exponential backoff
            if (attempt < NETWORK.MAX_RETRIES - 1) {
                const delay = Math.pow(2, attempt) * 1000;
                await this.sleep(delay);
            }
        }

        throw lastError ?? new Error(`Failed to fetch ${url} after ${NETWORK.MAX_RETRIES} retries`);
    }

    /**
     * Downloads a file from URL to disk using streaming
     * Skips download if file already exists with non-zero size
     * Requirements: 3.3, 3.5, 3.6
     *
     * @param url - The URL to download from
     * @param savePath - The local path to save the file
     * @returns true if file exists or download succeeded, false on failure
     */
    async downloadToFile(url: string, savePath: string): Promise<boolean> {
        if (await fileExistsWithContent(savePath)) {
            return true;
        }

        try {
            await ensureDir(dirname(savePath));
            const response = await this.fetchWithRetry(url);

            if (!response.body) {
                return false;
            }

            const writeStream = createWriteStream(savePath);
            const readable = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

            await pipeline(readable, writeStream);
            return true;
        } catch (error) {
            console.error(`Failed to download ${url}:`, error);
            return false;
        }
    }

    /**
     * Checks if a URL belongs to an internal Hako domain
     * Requirements: 3.6
     */
    isInternalDomain(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            for (const domain of this.domains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }

            for (const domain of this.imageDomains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * Attempts to fetch from alternative domains when the primary fails
     * Requirements: 3.2
     */
    private async rotateDomainsAndRetry(
        originalUrl: string,
        headers: Record<string, string>,
        timeout: number
    ): Promise<Response | null> {
        const urlObj = new URL(originalUrl);
        const originalHost = urlObj.hostname.toLowerCase();

        const isImageUrl = this.imageDomains.some(
            (d) => originalHost === d || originalHost.endsWith(`.${d}`)
        );
        const domainList = isImageUrl ? this.imageDomains : this.domains;

        for (const domain of domainList) {
            if (domain === originalHost) {
                continue;
            }

            try {
                const newUrl = new URL(originalUrl);
                newUrl.hostname = domain;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(newUrl.toString(), {
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                this.requestCount++;

                if (response.ok) {
                    return response;
                }
            } catch {
                // Continue to next domain
            }
        }

        return null;
    }

    /**
     * Applies anti-ban pause after every N requests
     * Requirements: 3.4
     */
    private async applyAntiBan(): Promise<void> {
        if (this.requestCount > 0 && this.requestCount % NETWORK.REQUESTS_BEFORE_PAUSE === 0) {
            console.log(`\nAnti-ban pause: waiting ${NETWORK.ANTI_BAN_PAUSE / 1000}s after ${this.requestCount} requests...`);
            await this.sleep(NETWORK.ANTI_BAN_PAUSE);
        }
    }

    /**
     * Sleep utility function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Gets the current request count
     */
    getRequestCount(): number {
        return this.requestCount;
    }

    /**
     * Resets the request count
     */
    resetRequestCount(): void {
        this.requestCount = 0;
    }

    /**
     * Checks if proxy is configured
     */
    hasProxy(): boolean {
        return this.proxyPool !== null;
    }

    /**
     * Gets the number of proxies in the pool
     */
    getProxyCount(): number {
        return this.proxyPool?.size() ?? 0;
    }
}
