/**
 * Constants for hako-crawler
 * Requirements: 3.2, 3.6
 */

/**
 * List of Hako domains for content fetching
 * Used for domain rotation when one domain is unavailable
 */
export const DOMAINS = ['docln.net', 'ln.hako.vn', 'docln.sbs'] as const;

/**
 * List of image hosting domains used by Hako
 * Used to identify internal vs external image URLs
 */
export const IMAGE_DOMAINS = [
    'i.hako.vip',
    'i.docln.net',
    'ln.hako.vn',
    'i2.docln.net',
    'i2.hako.vip',
] as const;

/**
 * HTTP headers for requests to avoid being blocked
 */
export const HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://docln.net/',
};

/**
 * Directory paths for data storage
 */
export const PATHS = {
    /** Directory for downloaded novel data */
    DATA_DIR: 'data',
    /** Directory for generated EPUB files */
    RESULT_DIR: 'result',
    /** Directory for EPUB files to deconstruct */
    INPUT_DIR: 'input',
    /** File tracking all downloaded novels */
    BOOKS_FILE: 'books.json',
} as const;

/**
 * Network configuration
 */
export const NETWORK = {
    /** Number of retry attempts for failed requests */
    MAX_RETRIES: 3,
    /** Request timeout in milliseconds */
    TIMEOUT: 30000,
    /** Number of requests before anti-ban pause */
    REQUESTS_BEFORE_PAUSE: 100,
    /** Anti-ban pause duration in milliseconds */
    ANTI_BAN_PAUSE: 30000,
} as const;

/**
 * Type definitions for constants
 */
export type Domain = (typeof DOMAINS)[number];
export type ImageDomain = (typeof IMAGE_DOMAINS)[number];
