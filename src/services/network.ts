/**
 * Network Manager for hako-crawler
 * Handles HTTP requests with retry logic, domain rotation, and anti-ban measures
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { dirname } from 'node:path';

import { DOMAINS, IMAGE_DOMAINS, HEADERS, NETWORK } from '../config/constants';
import { ensureDir, fileExistsWithContent } from '../utils/fs';
import type { FetchOptions } from '../types';

/**
 * NetworkManager handles all HTTP operations with built-in resilience features:
 * - Exponential backoff retry (3 retries)
 * - Domain rotation for Hako domains
 * - Anti-ban pause every 100 requests
 * - Stream downloads for large files
 */
export class NetworkManager {
    private requestCount: number = 0;
    private readonly domains: readonly string[];
    private readonly imageDomains: readonly string[];
    private readonly headers: Record<string, string>;

    constructor() {
        this.domains = DOMAINS;
        this.imageDomains = IMAGE_DOMAINS;
        this.headers = { ...HEADERS };
    }

    /**
     * Fetches a URL with retry logic and exponential backoff
     * Requirements: 3.1, 3.2
     *
     * @param url - The URL to fetch
     * @param options - Optional fetch configuration
     * @returns The fetch Response
     * @throws Error after all retries are exhausted
     */
    async fetchWithRetry(url: string, options?: FetchOptions): Promise<Response> {
        await this.applyAntiBan();

        const timeout = options?.timeout ?? NETWORK.TIMEOUT;
        const headers = { ...this.headers, ...options?.headers };

        let lastError: Error | null = null;
        let rateLimitRetries = 0;
        const maxRateLimitRetries = 5; // Extra retries for 429 errors

        for (let attempt = 0; attempt < NETWORK.MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    headers,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);
                this.requestCount++;

                if (response.ok) {
                    return response;
                }

                // Handle rate limiting (429) with exponential backoff and extra retries
                if (response.status === 429) {
                    rateLimitRetries++;
                    if (rateLimitRetries <= maxRateLimitRetries) {
                        const waitTime = Math.min(30 * rateLimitRetries, 120); // 30s, 60s, 90s, 120s max
                        console.log(`\nRate limited (429). Waiting ${waitTime}s before retry ${rateLimitRetries}/${maxRateLimitRetries}...`);
                        await this.sleep(waitTime * 1000);
                        attempt--; // Don't count 429 as a regular retry
                        continue;
                    }
                    lastError = new Error(`HTTP 429: Rate limited after ${maxRateLimitRetries} retries`);
                    break;
                }

                // If response is not ok, try domain rotation for internal URLs
                if (this.isInternalDomain(url)) {
                    const rotatedResponse = await this.rotateDomainsAndRetry(url, headers, timeout);
                    if (rotatedResponse) {
                        return rotatedResponse;
                    }
                }

                lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Try domain rotation for internal URLs on network errors
                if (this.isInternalDomain(url)) {
                    const rotatedResponse = await this.rotateDomainsAndRetry(url, headers, timeout);
                    if (rotatedResponse) {
                        return rotatedResponse;
                    }
                }
            }

            // Exponential backoff: 1s, 2s, 4s
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
        // Skip if file already exists with content (Requirement 3.5)
        if (await fileExistsWithContent(savePath)) {
            return true;
        }

        try {
            // Ensure directory exists
            await ensureDir(dirname(savePath));

            const response = await this.fetchWithRetry(url);

            if (!response.body) {
                return false;
            }

            // Stream download for large files (Requirement 3.3)
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
     *
     * @param url - The URL to check
     * @returns true if URL is from a Hako domain or image domain
     */
    isInternalDomain(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // Check against main domains
            for (const domain of this.domains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }

            // Check against image domains
            for (const domain of this.imageDomains) {
                if (hostname === domain || hostname.endsWith(`.${domain}`)) {
                    return true;
                }
            }

            return false;
        } catch {
            // Invalid URL
            return false;
        }
    }

    /**
     * Attempts to fetch from alternative domains when the primary fails
     * Requirements: 3.2
     *
     * @param originalUrl - The original URL that failed
     * @param headers - Headers to use for the request
     * @param timeout - Request timeout in milliseconds
     * @returns Response if successful, null if all domains fail
     */
    private async rotateDomainsAndRetry(
        originalUrl: string,
        headers: Record<string, string>,
        timeout: number
    ): Promise<Response | null> {
        const urlObj = new URL(originalUrl);
        const originalHost = urlObj.hostname.toLowerCase();

        // Determine which domain list to use
        const isImageUrl = this.imageDomains.some(
            (d) => originalHost === d || originalHost.endsWith(`.${d}`)
        );
        const domainList = isImageUrl ? this.imageDomains : this.domains;

        for (const domain of domainList) {
            if (domain === originalHost) {
                continue; // Skip the original domain
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
     * @param ms - Milliseconds to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Gets the current request count (useful for testing/monitoring)
     */
    getRequestCount(): number {
        return this.requestCount;
    }

    /**
     * Resets the request count (useful for testing)
     */
    resetRequestCount(): void {
        this.requestCount = 0;
    }
}
