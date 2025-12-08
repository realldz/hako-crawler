/**
 * Text utility functions
 * Requirements: 10.1, 10.2
 */
/**
 * Formats a string to be safe for use as a filename
 * - Removes invalid characters: \ / * ? : " < > |
 * - Replaces spaces with underscores
 * - Trims whitespace
 * - Limits length to 100 characters
 *
 * @param name - The string to format
 * @returns A safe filename string
 */
export declare function formatFilename(name: string): string;
/**
 * Converts a relative URL to an absolute URL using the appropriate domain
 * - If URL is already absolute (starts with http), returns as-is
 * - Otherwise, prepends the domain from the base URL
 *
 * @param baseUrl - The base URL to extract domain from
 * @param url - The URL to reformat (can be relative or absolute)
 * @returns An absolute URL
 */
export declare function reformatUrl(baseUrl: string, url: string): string;
//# sourceMappingURL=text.d.ts.map