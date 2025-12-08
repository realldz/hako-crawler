/**
 * Novel Parser for hako-crawler
 * Parses novel pages from Hako websites to extract metadata and volume/chapter information
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
import * as cheerio from 'cheerio';
import { reformatUrl } from '../utils/text';
import { DOMAINS } from '../config/constants';
/**
 * NovelParser handles parsing of Hako novel pages
 * Extracts metadata, volumes, and chapters from HTML content
 */
export class NovelParser {
    network;
    constructor(network) {
        this.network = network;
    }
    /**
     * Parses a novel page from the given URL
     * Requirements: 2.1, 2.2, 2.3, 2.4
     *
     * @param url - The URL of the novel page to parse
     * @returns ParseResult containing LightNovel data or error message
     */
    async parse(url) {
        // Validate URL format (Requirement 2.4)
        const validationError = this.validateUrl(url);
        if (validationError) {
            return { success: false, error: validationError };
        }
        try {
            const response = await this.network.fetchWithRetry(url);
            const html = await response.text();
            const $ = cheerio.load(html);
            const novel = this.parseHtml($, url);
            return { success: true, data: novel };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { success: false, error: `Failed to parse novel: ${message}` };
        }
    }
    /**
     * Parses HTML content directly (useful for testing)
     * @param html - The HTML content to parse
     * @param baseUrl - The base URL for resolving relative links
     * @returns LightNovel object
     */
    parseFromHtml(html, baseUrl) {
        const $ = cheerio.load(html);
        return this.parseHtml($, baseUrl);
    }
    /**
     * Internal method to parse cheerio document
     */
    parseHtml($, url) {
        const novel = {
            name: '',
            url: url,
            author: '',
            summary: '',
            mainCover: '',
            tags: [],
            volumes: [],
        };
        // Extract metadata (Requirement 2.1)
        novel.name = this.extractName($);
        novel.author = this.extractAuthor($);
        novel.summary = this.extractSummary($);
        novel.mainCover = this.extractMainCover($);
        novel.tags = this.extractTags($);
        // Extract volumes with chapters (Requirements 2.2, 2.3)
        novel.volumes = this.extractVolumes($, url);
        return novel;
    }
    /**
     * Validates that the URL is a valid Hako URL
     * Requirement: 2.4
     */
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return 'URL is required and must be a string';
        }
        try {
            const urlObj = new URL(url);
            // Check protocol
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return `Invalid URL protocol: ${urlObj.protocol}. Must be http or https`;
            }
            // Check if it's a Hako domain
            const hostname = urlObj.hostname.toLowerCase();
            const isHakoDomain = DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
            if (!isHakoDomain) {
                return `Invalid domain: ${hostname}. Must be a Hako domain (${DOMAINS.join(', ')})`;
            }
            return null;
        }
        catch {
            return `Invalid URL format: ${url}`;
        }
    }
    /**
     * Extracts the novel name from the page
     */
    extractName($) {
        const nameTag = $('span.series-name');
        return nameTag.text().trim() || 'Unknown';
    }
    /**
     * Extracts the author from the page
     */
    extractAuthor($) {
        const infoDiv = $('div.series-information');
        if (!infoDiv.length)
            return '';
        let author = '';
        infoDiv.find('div.info-item').each((_, item) => {
            const label = $(item).find('span.info-name');
            if (label.text().includes('Tác giả')) {
                const val = $(item).find('span.info-value');
                author = val.text().trim();
            }
        });
        return author;
    }
    /**
     * Extracts the summary/description from the page
     */
    extractSummary($) {
        const sumDiv = $('div.summary-content');
        if (!sumDiv.length)
            return '';
        // Remove unwanted elements
        sumDiv.find('a.see-more, div.less-state, div.more-state, span.see-more, span.less-state, span.more-state').remove();
        // Get inner HTML
        return sumDiv.html()?.trim() || '';
    }
    /**
     * Extracts the main cover image URL from the page
     */
    extractMainCover($) {
        const coverDiv = $('div.series-cover');
        if (!coverDiv.length)
            return '';
        const imgDiv = coverDiv.find('div.img-in-ratio');
        if (!imgDiv.length)
            return '';
        const style = imgDiv.attr('style');
        if (!style)
            return '';
        // Extract URL from background-image style
        const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        return match ? match[1] : '';
    }
    /**
     * Extracts tags/genres from the page
     */
    extractTags($) {
        const tags = [];
        // Handle both "series-gernes" (typo in original) and "series-genres"
        const genreDiv = $('div.series-gernes, div.series-genres');
        if (!genreDiv.length)
            return tags;
        genreDiv.find('a').each((_, el) => {
            const tag = $(el).text().trim();
            if (tag) {
                tags.push(tag);
            }
        });
        return tags;
    }
    /**
     * Extracts all volumes with their chapters from the page
     * Requirements: 2.2, 2.3
     */
    extractVolumes($, baseUrl) {
        const volumes = [];
        $('section.volume-list').each((_, sect) => {
            const volume = {
                url: '',
                name: '',
                coverImg: '',
                chapters: [],
            };
            // Extract volume name
            const title = $(sect).find('span.sect-title');
            volume.name = title.text().trim() || 'Unknown Volume';
            // Extract volume cover and URL
            const vCover = $(sect).find('div.volume-cover');
            if (vCover.length) {
                const link = vCover.find('a');
                if (link.length) {
                    const href = link.attr('href');
                    if (href) {
                        volume.url = reformatUrl(baseUrl, href);
                    }
                }
                const img = vCover.find('div.img-in-ratio');
                if (img.length) {
                    const style = img.attr('style');
                    if (style) {
                        const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
                        if (match) {
                            volume.coverImg = match[1];
                        }
                    }
                }
            }
            // Extract chapters (Requirement 2.3)
            volume.chapters = this.extractChapters($, sect, baseUrl);
            volumes.push(volume);
        });
        return volumes;
    }
    /**
     * Extracts chapters from a volume section
     * Requirement: 2.3
     */
    extractChapters($, volumeElement, baseUrl) {
        const chapters = [];
        const ul = $(volumeElement).find('ul.list-chapters');
        if (!ul.length)
            return chapters;
        ul.find('li').each((_, li) => {
            const link = $(li).find('a');
            if (link.length) {
                const href = link.attr('href');
                const name = link.text().trim();
                if (href && name) {
                    chapters.push({
                        name,
                        url: reformatUrl(baseUrl, href),
                    });
                }
            }
        });
        return chapters;
    }
}
/**
 * Serializes a LightNovel object to JSON string
 * Requirement: 2.5
 *
 * @param novel - The LightNovel object to serialize
 * @returns JSON string representation
 */
export function serializeNovel(novel) {
    return JSON.stringify(novel, null, 2);
}
/**
 * Deserializes a JSON string to a LightNovel object
 * Requirement: 2.6
 *
 * @param json - The JSON string to parse
 * @returns LightNovel object
 * @throws Error if JSON is invalid or doesn't match LightNovel structure
 */
export function deserializeNovel(json) {
    const parsed = JSON.parse(json);
    // Validate required fields
    if (typeof parsed.name !== 'string') {
        throw new Error('Invalid LightNovel: missing or invalid "name" field');
    }
    if (typeof parsed.url !== 'string') {
        throw new Error('Invalid LightNovel: missing or invalid "url" field');
    }
    if (!Array.isArray(parsed.volumes)) {
        throw new Error('Invalid LightNovel: missing or invalid "volumes" field');
    }
    // Validate volumes structure
    for (const vol of parsed.volumes) {
        if (typeof vol.name !== 'string') {
            throw new Error('Invalid Volume: missing or invalid "name" field');
        }
        if (!Array.isArray(vol.chapters)) {
            throw new Error('Invalid Volume: missing or invalid "chapters" field');
        }
        // Validate chapters structure
        for (const chap of vol.chapters) {
            if (typeof chap.name !== 'string') {
                throw new Error('Invalid Chapter: missing or invalid "name" field');
            }
            if (typeof chap.url !== 'string') {
                throw new Error('Invalid Chapter: missing or invalid "url" field');
            }
        }
    }
    return {
        name: parsed.name,
        url: parsed.url,
        author: parsed.author ?? '',
        summary: parsed.summary ?? '',
        mainCover: parsed.mainCover ?? '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        volumes: parsed.volumes.map((vol) => ({
            url: vol.url ?? '',
            name: vol.name,
            coverImg: vol.coverImg ?? '',
            chapters: vol.chapters.map((chap) => ({
                name: chap.name,
                url: chap.url,
            })),
        })),
    };
}
//# sourceMappingURL=parser.js.map