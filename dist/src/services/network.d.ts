/**
 * Network Manager for hako-crawler
 * Handles HTTP requests with retry logic, domain rotation, and anti-ban measures
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import type { FetchOptions } from '../types';
/**
 * NetworkManager handles all HTTP operations with built-in resilience features:
 * - Exponential backoff retry (3 retries)
 * - Domain rotation for Hako domains
 * - Anti-ban pause every 100 requests
 * - Stream downloads for large files
 */
export declare class NetworkManager {
    private requestCount;
    private readonly domains;
    private readonly imageDomains;
    private readonly headers;
    constructor();
    /**
     * Fetches a URL with retry logic and exponential backoff
     * Requirements: 3.1, 3.2
     *
     * @param url - The URL to fetch
     * @param options - Optional fetch configuration
     * @returns The fetch Response
     * @throws Error after all retries are exhausted
     */
    fetchWithRetry(url: string, options?: FetchOptions): Promise<Response>;
    /**
     * Downloads a file from URL to disk using streaming
     * Skips download if file already exists with non-zero size
     * Requirements: 3.3, 3.5, 3.6
     *
     * @param url - The URL to download from
     * @param savePath - The local path to save the file
     * @returns true if file exists or download succeeded, false on failure
     */
    downloadToFile(url: string, savePath: string): Promise<boolean>;
    /**
     * Checks if a URL belongs to an internal Hako domain
     * Requirements: 3.6
     *
     * @param url - The URL to check
     * @returns true if URL is from a Hako domain or image domain
     */
    isInternalDomain(url: string): boolean;
    /**
     * Attempts to fetch from alternative domains when the primary fails
     * Requirements: 3.2
     *
     * @param originalUrl - The original URL that failed
     * @param headers - Headers to use for the request
     * @param timeout - Request timeout in milliseconds
     * @returns Response if successful, null if all domains fail
     */
    private rotateDomainsAndRetry;
    /**
     * Applies anti-ban pause after every N requests
     * Requirements: 3.4
     */
    private applyAntiBan;
    /**
     * Sleep utility function
     * @param ms - Milliseconds to sleep
     */
    private sleep;
    /**
     * Gets the current request count (useful for testing/monitoring)
     */
    getRequestCount(): number;
    /**
     * Resets the request count (useful for testing)
     */
    resetRequestCount(): void;
}
//# sourceMappingURL=network.d.ts.map