/**
 * Novel Parser for hako-crawler
 * Parses novel pages from Hako websites to extract metadata and volume/chapter information
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import type { LightNovel, ParseResult } from '../types';
import { NetworkManager } from './network';
/**
 * NovelParser handles parsing of Hako novel pages
 * Extracts metadata, volumes, and chapters from HTML content
 */
export declare class NovelParser {
    private network;
    constructor(network: NetworkManager);
    /**
     * Parses a novel page from the given URL
     * Requirements: 2.1, 2.2, 2.3, 2.4
     *
     * @param url - The URL of the novel page to parse
     * @returns ParseResult containing LightNovel data or error message
     */
    parse(url: string): Promise<ParseResult<LightNovel>>;
    /**
     * Parses HTML content directly (useful for testing)
     * @param html - The HTML content to parse
     * @param baseUrl - The base URL for resolving relative links
     * @returns LightNovel object
     */
    parseFromHtml(html: string, baseUrl: string): LightNovel;
    /**
     * Internal method to parse cheerio document
     */
    private parseHtml;
    /**
     * Validates that the URL is a valid Hako URL
     * Requirement: 2.4
     */
    private validateUrl;
    /**
     * Extracts the novel name from the page
     */
    private extractName;
    /**
     * Extracts the author from the page
     */
    private extractAuthor;
    /**
     * Extracts the summary/description from the page
     */
    private extractSummary;
    /**
     * Extracts the main cover image URL from the page
     */
    private extractMainCover;
    /**
     * Extracts tags/genres from the page
     */
    private extractTags;
    /**
     * Extracts all volumes with their chapters from the page
     * Requirements: 2.2, 2.3
     */
    private extractVolumes;
    /**
     * Extracts chapters from a volume section
     * Requirement: 2.3
     */
    private extractChapters;
}
/**
 * Serializes a LightNovel object to JSON string
 * Requirement: 2.5
 *
 * @param novel - The LightNovel object to serialize
 * @returns JSON string representation
 */
export declare function serializeNovel(novel: LightNovel): string;
/**
 * Deserializes a JSON string to a LightNovel object
 * Requirement: 2.6
 *
 * @param json - The JSON string to parse
 * @returns LightNovel object
 * @throws Error if JSON is invalid or doesn't match LightNovel structure
 */
export declare function deserializeNovel(json: string): LightNovel;
//# sourceMappingURL=parser.d.ts.map