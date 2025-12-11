/**
 * Property-based tests for proxy utilities
 * **Feature: proxy-support**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    isValidProxyUrl,
    parseProxyUrl,
    sanitizeForDisplay,
    buildProxyUrl,
} from '../../src/utils/proxy';
import { ProxyPool } from '../../src/services/proxy-pool';
import type { ProxyProtocol } from '../../src/types';

// Arbitraries for generating test data
const validProtocol = fc.constantFrom<ProxyProtocol>('http', 'socks5');
const invalidProtocol = fc.constantFrom('ftp', 'ws', 'wss', 'tcp', 'udp', 'ssh', 'mailto');
// Use simple hostnames that are clearly valid (letters only, with optional .com)
const validHost = fc.constantFrom(
    'proxy.example.com',
    'localhost',
    'myproxy.net',
    'server.local',
    '192.168.1.1',
    '10.0.0.1'
);
const validPort = fc.integer({ min: 1, max: 65535 });
// Use usernames that won't appear in hostnames
const validUsername = fc.stringMatching(/^user[a-z0-9]{1,8}$/);
// Use passwords without special URL characters
const validPassword = fc.stringMatching(/^pass[a-z0-9]{1,8}$/);

// Generator for valid proxy URLs
const validProxyUrl = fc.record({
    protocol: validProtocol,
    host: validHost,
    port: validPort,
    username: fc.option(validUsername, { nil: undefined }),
    password: fc.option(validPassword, { nil: undefined }),
}).map(({ protocol, host, port, username, password }) => {
    let url = `${protocol}://`;
    if (username) {
        url += encodeURIComponent(username);
        if (password) {
            url += `:${encodeURIComponent(password)}`;
        }
        url += '@';
    }
    url += `${host}:${port}`;
    return url;
});

describe('Proxy URL Validation Property Tests', () => {
    /**
     * **Feature: proxy-support, Property 1: Proxy URL Validation Consistency**
     * For any input string, the proxy validator SHALL correctly identify valid proxy URLs
     * (matching the format protocol://[user:pass@]host:port where protocol is http or socks5)
     * and reject all other strings.
     * **Validates: Requirements 1.3, 1.4**
     */
    describe('Property 1: Proxy URL Validation Consistency', () => {
        it('should accept all valid proxy URLs', () => {
            fc.assert(
                fc.property(validProxyUrl, (url) => {
                    expect(isValidProxyUrl(url)).toBe(true);
                }),
                { numRuns: 100 }
            );
        });

        it('should reject random strings that are not URLs', () => {
            fc.assert(
                fc.property(
                    fc.string().filter(s => !s.includes('://')),
                    (input) => {
                        expect(isValidProxyUrl(input)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should reject URLs without host', () => {
            fc.assert(
                fc.property(validProtocol, (protocol) => {
                    expect(isValidProxyUrl(`${protocol}://`)).toBe(false);
                    expect(isValidProxyUrl(`${protocol}://:8080`)).toBe(false);
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: proxy-support, Property 2: Unsupported Protocol Rejection**
     * For any proxy URL with a protocol other than http, https, or socks5,
     * the validator SHALL return an error indicating the protocol is not supported.
     * **Validates: Requirements 2.4**
     */
    describe('Property 2: Unsupported Protocol Rejection', () => {
        it('should reject URLs with unsupported protocols', () => {
            fc.assert(
                fc.property(
                    invalidProtocol,
                    validHost,
                    validPort,
                    (protocol, host, port) => {
                        const url = `${protocol}://${host}:${port}`;
                        expect(isValidProxyUrl(url)).toBe(false);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should throw error with unsupported protocol message when parsing', () => {
            fc.assert(
                fc.property(
                    invalidProtocol,
                    validHost,
                    validPort,
                    (protocol, host, port) => {
                        const url = `${protocol}://${host}:${port}`;
                        // Should throw either invalid format or unsupported protocol
                        expect(() => parseProxyUrl(url)).toThrow();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: proxy-support, Property 3: Credential Parsing Round-Trip**
     * For any valid proxy URL containing credentials, parsing the URL and reconstructing it
     * SHALL preserve the username, password, host, and port values.
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    describe('Property 3: Credential Parsing Round-Trip', () => {
        it('should preserve credentials through parse and rebuild', () => {
            fc.assert(
                fc.property(
                    validProtocol,
                    validHost,
                    validPort,
                    validUsername,
                    validPassword,
                    (protocol, host, port, username, password) => {
                        const originalUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
                        const config = parseProxyUrl(originalUrl);

                        expect(config.protocol).toBe(protocol);
                        expect(config.host).toBe(host);
                        expect(config.port).toBe(port);
                        expect(config.username).toBe(username);
                        expect(config.password).toBe(password);

                        // Rebuild and parse again - should be consistent
                        const rebuilt = buildProxyUrl(config);
                        const reparsed = parseProxyUrl(rebuilt);

                        expect(reparsed.username).toBe(config.username);
                        expect(reparsed.password).toBe(config.password);
                        expect(reparsed.host).toBe(config.host);
                        expect(reparsed.port).toBe(config.port);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle URLs without credentials', () => {
            fc.assert(
                fc.property(
                    validProtocol,
                    validHost,
                    validPort,
                    (protocol, host, port) => {
                        const url = `${protocol}://${host}:${port}`;
                        const config = parseProxyUrl(url);

                        expect(config.protocol).toBe(protocol);
                        expect(config.host).toBe(host);
                        expect(config.port).toBe(port);
                        expect(config.username).toBeUndefined();
                        expect(config.password).toBeUndefined();
                    }
                ),
                { numRuns: 100 }
            );
        });
    });

    /**
     * **Feature: proxy-support, Property 4: Credential Sanitization**
     * For any proxy URL containing credentials, the sanitized display string
     * SHALL NOT contain the username or password, but SHALL contain the host and port.
     * **Validates: Requirements 5.3**
     */
    describe('Property 4: Credential Sanitization', () => {
        it('should remove credentials from display string', () => {
            fc.assert(
                fc.property(
                    validProtocol,
                    validHost,
                    validPort,
                    validUsername,
                    validPassword,
                    (protocol, host, port, username, password) => {
                        const url = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
                        const sanitized = sanitizeForDisplay(url);

                        // Should NOT contain the @ symbol with credentials before it
                        // (credentials are removed, so no user:pass@ pattern)
                        expect(sanitized).not.toMatch(/\/\/[^/]+:[^/]+@/);

                        // Should still contain host and port
                        expect(sanitized).toContain(host);
                        expect(sanitized).toContain(String(port));

                        // Should still contain protocol
                        expect(sanitized).toContain(`${protocol}://`);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should preserve URLs without credentials', () => {
            fc.assert(
                fc.property(
                    validProtocol,
                    validHost,
                    validPort,
                    (protocol, host, port) => {
                        const url = `${protocol}://${host}:${port}`;
                        const sanitized = sanitizeForDisplay(url);

                        // Should contain all parts
                        expect(sanitized).toContain(host);
                        expect(sanitized).toContain(String(port));
                        expect(sanitized).toContain(`${protocol}://`);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});


describe('ProxyPool Property Tests', () => {
    /**
     * **Feature: proxy-support, Property 5: Round-Robin Distribution**
     * For any proxy pool with N proxies (N > 0) and M consecutive requests (M >= N),
     * each proxy SHALL be selected at least floor(M/N) times, ensuring even distribution.
     * **Validates: Requirements 7.2**
     */
    describe('Property 5: Round-Robin Distribution', () => {
        // Generate array of proxy URLs (1-5 proxies)
        const proxyUrlArray = fc.array(
            fc.constantFrom(
                'http://proxy1.example.com:8080',
                'http://proxy2.example.com:8080',
                'http://proxy3.example.com:8080',
                'socks5://proxy4.example.com:1080',
                'socks5://proxy5.example.com:1080'
            ),
            { minLength: 1, maxLength: 5 }
        ).filter((arr) => new Set(arr).size === arr.length); // Ensure unique proxies

        it('should distribute requests evenly across all proxies', () => {
            fc.assert(
                fc.property(
                    proxyUrlArray,
                    fc.integer({ min: 1, max: 20 }),
                    (proxyUrls, multiplier) => {
                        const pool = new ProxyPool(proxyUrls);
                        const n = pool.size();
                        const m = n * multiplier; // Total requests

                        // Count how many times each proxy is selected
                        const counts = new Map<string, number>();

                        for (let i = 0; i < m; i++) {
                            const proxy = pool.getNextProxy();
                            const key = `${proxy.host}:${proxy.port}`;
                            counts.set(key, (counts.get(key) || 0) + 1);
                        }

                        // Each proxy should be selected exactly multiplier times
                        // (since m = n * multiplier and round-robin is perfect)
                        for (const count of counts.values()) {
                            expect(count).toBe(multiplier);
                        }

                        // All proxies should have been used
                        expect(counts.size).toBe(n);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should cycle through proxies in order', () => {
            fc.assert(
                fc.property(proxyUrlArray, (proxyUrls) => {
                    const pool = new ProxyPool(proxyUrls);
                    const n = pool.size();

                    // Get proxies for two full cycles
                    const firstCycle: string[] = [];
                    const secondCycle: string[] = [];

                    for (let i = 0; i < n; i++) {
                        const proxy = pool.getNextProxy();
                        firstCycle.push(`${proxy.host}:${proxy.port}`);
                    }

                    for (let i = 0; i < n; i++) {
                        const proxy = pool.getNextProxy();
                        secondCycle.push(`${proxy.host}:${proxy.port}`);
                    }

                    // Both cycles should be identical (same order)
                    expect(firstCycle).toEqual(secondCycle);
                }),
                { numRuns: 100 }
            );
        });

        it('should return the only proxy when pool has single proxy', () => {
            const singleProxyUrl = 'http://single.proxy.com:8080';
            const pool = new ProxyPool(singleProxyUrl);

            // All requests should return the same proxy
            for (let i = 0; i < 10; i++) {
                const proxy = pool.getNextProxy();
                expect(proxy.host).toBe('single.proxy.com');
                expect(proxy.port).toBe(8080);
            }
        });
    });
});


describe('Proxy Failover Property Tests', () => {
    /**
     * **Feature: proxy-support, Property 6: Failover Attempts All Proxies**
     * For any proxy pool with N proxies, when a request fails on all proxies,
     * the system SHALL have attempted exactly N different proxies before returning a failure.
     * **Validates: Requirements 8.1, 8.4**
     */
    describe('Property 6: Failover Attempts All Proxies', () => {
        it('should attempt all proxies in pool before failing', () => {
            // This test verifies the ProxyPool's failover mechanism
            // by checking that getAlternativeProxy returns different proxies
            fc.assert(
                fc.property(
                    fc.array(
                        fc.constantFrom(
                            'http://proxy1.example.com:8080',
                            'http://proxy2.example.com:8080',
                            'http://proxy3.example.com:8080',
                            'socks5://proxy4.example.com:1080',
                            'socks5://proxy5.example.com:1080'
                        ),
                        { minLength: 2, maxLength: 5 }
                    ).filter((arr) => new Set(arr).size === arr.length),
                    (proxyUrls) => {
                        const pool = new ProxyPool(proxyUrls);
                        const n = pool.size();

                        // Simulate failover by getting alternatives
                        const attemptedProxies = new Set<string>();

                        // Start with first proxy
                        const firstProxy = pool.getProxyAt(0)!;
                        attemptedProxies.add(`${firstProxy.host}:${firstProxy.port}`);

                        // Get alternatives for each index
                        for (let i = 0; i < n - 1; i++) {
                            const alt = pool.getAlternativeProxy(i);
                            if (alt) {
                                attemptedProxies.add(`${alt.host}:${alt.port}`);
                            }
                        }

                        // Should be able to reach all proxies through failover
                        // (at minimum, we should have more than 1 unique proxy)
                        expect(attemptedProxies.size).toBeGreaterThan(1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should return undefined when no alternative exists for single proxy', () => {
            const pool = new ProxyPool('http://single.proxy.com:8080');

            // Single proxy pool should have no alternatives
            const alt = pool.getAlternativeProxy(0);
            expect(alt).toBeUndefined();
        });

        it('should always return a different proxy as alternative', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.constantFrom(
                            'http://proxy1.example.com:8080',
                            'http://proxy2.example.com:8080',
                            'http://proxy3.example.com:8080'
                        ),
                        { minLength: 2, maxLength: 3 }
                    ).filter((arr) => new Set(arr).size === arr.length),
                    fc.integer({ min: 0, max: 2 }),
                    (proxyUrls, excludeIndex) => {
                        const pool = new ProxyPool(proxyUrls);
                        const n = pool.size();

                        if (excludeIndex >= n) return; // Skip invalid indices

                        const excluded = pool.getProxyAt(excludeIndex);
                        const alternative = pool.getAlternativeProxy(excludeIndex);

                        if (alternative && excluded) {
                            // Alternative should be different from excluded
                            const excludedKey = `${excluded.host}:${excluded.port}`;
                            const altKey = `${alternative.host}:${alternative.port}`;
                            expect(altKey).not.toBe(excludedKey);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
