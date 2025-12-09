/**
 * Proxy URL validation and parsing utilities
 * Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 5.3
 */

import type { ProxyConfig, ProxyProtocol } from '../types';

/**
 * Supported proxy protocols
 */
const SUPPORTED_PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks5'];

/**
 * Validates if a string is a valid proxy URL
 * Requirements: 1.3, 1.4
 *
 * @param url - The URL string to validate
 * @returns true if valid proxy URL, false otherwise
 */
export function isValidProxyUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const protocol = parsed.protocol.replace(':', '') as ProxyProtocol;

        // Check if protocol is supported
        if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
            return false;
        }

        // Must have a host
        if (!parsed.hostname) {
            return false;
        }

        // Must have a port (either explicit or default)
        const port = parsed.port || getDefaultPort(protocol);
        if (!port || isNaN(Number(port))) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}

/**
 * Parses a proxy URL string into a ProxyConfig object
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3
 *
 * @param url - The proxy URL to parse
 * @returns ProxyConfig object
 * @throws Error if URL is invalid or protocol is unsupported
 */
export function parseProxyUrl(url: string): ProxyConfig {
    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`Invalid proxy URL format: ${url}`);
    }

    const protocol = parsed.protocol.replace(':', '') as ProxyProtocol;

    // Validate protocol
    if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
        throw new Error(
            `Unsupported proxy protocol: ${protocol}. Supported: ${SUPPORTED_PROTOCOLS.join(', ')}`
        );
    }

    // Validate host
    if (!parsed.hostname) {
        throw new Error(`Invalid proxy URL format: missing host`);
    }

    // Get port (use default if not specified)
    const portStr = parsed.port || getDefaultPort(protocol);
    const port = Number(portStr);

    if (isNaN(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid proxy port: ${portStr}`);
    }

    const config: ProxyConfig = {
        protocol,
        host: parsed.hostname,
        port,
    };

    // Add credentials if present (Requirements: 3.1, 3.2, 3.3)
    if (parsed.username) {
        config.username = decodeURIComponent(parsed.username);
    }
    if (parsed.password) {
        config.password = decodeURIComponent(parsed.password);
    }

    return config;
}

/**
 * Sanitizes a proxy URL for display by removing credentials
 * Requirements: 5.3
 *
 * @param url - The proxy URL to sanitize
 * @returns URL string without credentials
 */
export function sanitizeForDisplay(url: string): string {
    try {
        const parsed = new URL(url);
        // Remove credentials
        parsed.username = '';
        parsed.password = '';
        return parsed.toString();
    } catch {
        // If URL is invalid, return a masked version
        return url.replace(/\/\/[^@]+@/, '//***@');
    }
}

/**
 * Reconstructs a proxy URL from a ProxyConfig
 *
 * @param config - The proxy configuration
 * @returns Proxy URL string
 */
export function buildProxyUrl(config: ProxyConfig): string {
    let url = `${config.protocol}://`;

    if (config.username) {
        url += encodeURIComponent(config.username);
        if (config.password) {
            url += `:${encodeURIComponent(config.password)}`;
        }
        url += '@';
    }

    url += config.host;
    url += `:${config.port}`;

    return url;
}

/**
 * Gets the default port for a proxy protocol
 *
 * @param protocol - The proxy protocol
 * @returns Default port number as string, or empty string if unknown
 */
function getDefaultPort(protocol: ProxyProtocol): string {
    switch (protocol) {
        case 'http':
            return '80';
        case 'https':
            return '443';
        case 'socks5':
            return '1080';
        default:
            return '';
    }
}
