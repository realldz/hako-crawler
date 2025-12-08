/**
 * Constants for hako-crawler
 * Requirements: 3.2, 3.6
 */
/**
 * List of Hako domains for content fetching
 * Used for domain rotation when one domain is unavailable
 */
export declare const DOMAINS: readonly ["docln.net", "ln.hako.vn", "docln.sbs"];
/**
 * List of image hosting domains used by Hako
 * Used to identify internal vs external image URLs
 */
export declare const IMAGE_DOMAINS: readonly ["i.hako.vip", "i.docln.net", "ln.hako.vn", "i2.docln.net", "i2.hako.vip"];
/**
 * HTTP headers for requests to avoid being blocked
 */
export declare const HEADERS: Record<string, string>;
/**
 * Directory paths for data storage
 */
export declare const PATHS: {
    /** Directory for downloaded novel data */
    readonly DATA_DIR: "data";
    /** Directory for generated EPUB files */
    readonly RESULT_DIR: "result";
    /** Directory for EPUB files to deconstruct */
    readonly INPUT_DIR: "input";
    /** File tracking all downloaded novels */
    readonly BOOKS_FILE: "books.json";
};
/**
 * Network configuration
 */
export declare const NETWORK: {
    /** Number of retry attempts for failed requests */
    readonly MAX_RETRIES: 3;
    /** Request timeout in milliseconds */
    readonly TIMEOUT: 30000;
    /** Number of requests before anti-ban pause */
    readonly REQUESTS_BEFORE_PAUSE: 100;
    /** Anti-ban pause duration in milliseconds */
    readonly ANTI_BAN_PAUSE: 30000;
};
/**
 * Type definitions for constants
 */
export type Domain = (typeof DOMAINS)[number];
export type ImageDomain = (typeof IMAGE_DOMAINS)[number];
//# sourceMappingURL=constants.d.ts.map