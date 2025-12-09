/**
 * Proxy Pool Service
 * Manages multiple proxies with round-robin distribution and failover
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.3
 */

import type { ProxyConfig, ProxyInput } from '../types';
import { parseProxyUrl } from '../utils/proxy';

/**
 * ProxyPool manages a collection of proxy servers with round-robin distribution
 * and failover capabilities.
 */
export class ProxyPool {
    private readonly proxies: ProxyConfig[];
    private currentIndex: number = 0;

    /**
     * Creates a new ProxyPool from proxy input
     * Requirements: 7.1
     *
     * @param input - Single proxy URL or array of proxy URLs
     * @throws Error if any proxy URL is invalid
     */
    constructor(input: ProxyInput) {
        const urls = Array.isArray(input) ? input : [input];

        if (urls.length === 0) {
            throw new Error('ProxyPool requires at least one proxy URL');
        }

        this.proxies = urls.map((url) => parseProxyUrl(url));
    }

    /**
     * Gets the next proxy in round-robin order
     * Requirements: 7.2, 7.3
     *
     * @returns The next ProxyConfig in rotation
     */
    getNextProxy(): ProxyConfig {
        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy!;
    }

    /**
     * Gets a proxy at a specific index
     *
     * @param index - The index of the proxy to get
     * @returns The ProxyConfig at the index, or undefined if out of bounds
     */
    getProxyAt(index: number): ProxyConfig | undefined {
        return this.proxies[index];
    }

    /**
     * Gets an alternative proxy different from the one at excludeIndex
     * Used for failover when a proxy fails
     * Requirements: 8.1, 8.3
     *
     * @param excludeIndex - Index of the proxy to exclude
     * @returns Alternative ProxyConfig, or undefined if no alternatives exist
     */
    getAlternativeProxy(excludeIndex: number): ProxyConfig | undefined {
        if (this.proxies.length <= 1) {
            return undefined;
        }

        // Get the next proxy that isn't the excluded one
        let nextIndex = (excludeIndex + 1) % this.proxies.length;
        if (nextIndex === excludeIndex) {
            return undefined;
        }

        return this.proxies[nextIndex];
    }

    /**
     * Returns the number of proxies in the pool
     * Requirements: 7.4
     *
     * @returns Number of proxies
     */
    size(): number {
        return this.proxies.length;
    }

    /**
     * Returns all proxies in the pool
     * Used for iterating during failover
     *
     * @returns Array of all ProxyConfig objects
     */
    getAllProxies(): ProxyConfig[] {
        return [...this.proxies];
    }

    /**
     * Gets the current rotation index (useful for testing)
     *
     * @returns Current index in the rotation
     */
    getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Resets the rotation to the beginning
     */
    reset(): void {
        this.currentIndex = 0;
    }
}
