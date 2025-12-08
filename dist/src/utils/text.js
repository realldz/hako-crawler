/**
 * Text utility functions
 * Requirements: 10.1, 10.2
 */
import { DOMAINS } from '../config/constants';
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
export function formatFilename(name) {
    // Remove invalid filename characters
    let formatted = name.replace(/[\\/*?:"<>|]/g, '');
    // Replace spaces with underscores
    formatted = formatted.replace(/ /g, '_');
    // Trim whitespace
    formatted = formatted.trim();
    // Limit length to 100 characters
    return formatted.slice(0, 100);
}
/**
 * Converts a relative URL to an absolute URL using the appropriate domain
 * - If URL is already absolute (starts with http), returns as-is
 * - Otherwise, prepends the domain from the base URL
 *
 * @param baseUrl - The base URL to extract domain from
 * @param url - The URL to reformat (can be relative or absolute)
 * @returns An absolute URL
 */
export function reformatUrl(baseUrl, url) {
    // If already absolute, return as-is
    if (url.startsWith('http')) {
        return url;
    }
    // Find the matching domain from base URL
    let domain = 'docln.net'; // default
    for (const d of DOMAINS) {
        if (baseUrl.includes(d)) {
            domain = d;
            break;
        }
    }
    // Build absolute URL
    if (url.startsWith('/')) {
        return `https://${domain}${url}`;
    }
    return `https://${domain}/${url}`;
}
//# sourceMappingURL=text.js.map