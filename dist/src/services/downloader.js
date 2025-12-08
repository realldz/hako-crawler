/**
 * Novel Downloader for hako-crawler
 * Handles downloading chapters, images, and managing cache
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 10.3
 */
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { ContentProcessor } from './content-processor';
import { ensureDir, readJson, writeJson } from '../utils/fs';
import { formatFilename } from '../utils/text';
/**
 * NovelDownloader handles downloading novel content with smart caching
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 10.3
 */
export class NovelDownloader {
    novel;
    baseFolder;
    network;
    imagesFolder;
    contentProcessor;
    constructor(novel, baseFolder, network) {
        this.novel = novel;
        this.baseFolder = baseFolder;
        this.network = network;
        this.imagesFolder = join(baseFolder, 'images');
        this.contentProcessor = new ContentProcessor();
    }
    /**
     * Creates the metadata.json file for the novel
     * Requirements: 4.4, 10.3
     */
    async createMetadataFile() {
        // Ensure directories exist
        await ensureDir(this.baseFolder);
        await ensureDir(this.imagesFolder);
        console.log(`Updating metadata for: ${this.novel.name}`);
        // Download main cover image
        let localCoverPath = '';
        if (this.novel.mainCover) {
            const ext = this.getImageExtension(this.novel.mainCover);
            const fname = `main_cover.${ext}`;
            const savePath = join(this.imagesFolder, fname);
            if (await this.network.downloadToFile(this.novel.mainCover, savePath)) {
                localCoverPath = `images/${fname}`;
            }
        }
        // Build volume list for metadata
        const volumeList = this.novel.volumes.map((vol, i) => ({
            order: i + 1,
            name: vol.name,
            filename: formatFilename(vol.name) + '.json',
            url: vol.url,
        }));
        const metadata = {
            novelName: this.novel.name,
            author: this.novel.author,
            tags: this.novel.tags,
            summary: this.novel.summary,
            coverImageLocal: localCoverPath,
            url: this.novel.url,
            volumes: volumeList,
        };
        await writeJson(join(this.baseFolder, 'metadata.json'), metadata);
    }
    /**
     * Downloads a volume with all its chapters
     * Requirements: 4.1, 4.2, 4.3, 4.6
     *
     * @param volume - The volume to download
     * @param onProgress - Optional progress callback
     */
    async downloadVolume(volume, onProgress) {
        await ensureDir(this.baseFolder);
        await ensureDir(this.imagesFolder);
        const jsonFilename = formatFilename(volume.name) + '.json';
        const jsonPath = join(this.baseFolder, jsonFilename);
        const volSlug = formatFilename(volume.name).toLowerCase();
        // Load existing chapters for cache validation
        const existingChapters = await this.loadExistingChapters(jsonPath);
        const finalChapters = [];
        const tasksToDownload = [];
        // Note: Progress info is handled by the caller via onProgress callback
        let cachedCount = 0;
        // Check cache for each chapter
        for (let i = 0; i < volume.chapters.length; i++) {
            const chapter = volume.chapters[i];
            const cachedData = existingChapters.get(chapter.url);
            if (cachedData && this.validateCachedChapter(cachedData)) {
                // Use cached version (Requirement 4.2)
                cachedData.index = i;
                finalChapters.push(cachedData);
                cachedCount++;
            }
            else {
                // Need to download (Requirement 4.3)
                tasksToDownload.push({ index: i, chapter });
            }
        }
        // Cached info can be logged by caller if needed
        // Download chapters that need updating
        const total = tasksToDownload.length;
        for (let i = 0; i < tasksToDownload.length; i++) {
            const { index, chapter } = tasksToDownload[i];
            if (onProgress) {
                onProgress(i + 1, total);
            }
            const chapterContent = await this.processChapter(index, chapter, volSlug);
            if (chapterContent) {
                finalChapters.push(chapterContent);
            }
            // Small delay between requests
            await this.sleep(500);
        }
        // Sort chapters by index
        finalChapters.sort((a, b) => a.index - b.index);
        // Download volume cover
        let volCoverLocal = '';
        if (volume.coverImg) {
            const ext = this.getImageExtension(volume.coverImg);
            const fname = `vol_cover_${formatFilename(volume.name)}.${ext}`;
            const savePath = join(this.imagesFolder, fname);
            if (await this.network.downloadToFile(volume.coverImg, savePath)) {
                volCoverLocal = `images/${fname}`;
            }
        }
        // Save volume data
        const volumeData = {
            volumeName: volume.name,
            volumeUrl: volume.url,
            coverImageLocal: volCoverLocal,
            chapters: finalChapters,
        };
        await writeJson(jsonPath, volumeData);
        // Saved info is handled by the caller
    }
    /**
     * Processes a single chapter - downloads content and images
     * Requirements: 4.1, 4.6
     *
     * @param index - Chapter index in the volume
     * @param chapter - Chapter metadata
     * @param imgPrefix - Prefix for image filenames (volume slug)
     * @returns ChapterContent or null if processing failed
     */
    async processChapter(index, chapter, imgPrefix) {
        try {
            const response = await this.network.fetchWithRetry(chapter.url);
            const html = await response.text();
            const $ = cheerio.load(html);
            const contentDiv = $('#chapter-content');
            if (!contentDiv.length) {
                console.error(`No content found for chapter: ${chapter.name}`);
                return null;
            }
            // Remove HTML comments
            contentDiv.contents().filter(function () {
                return this.type === 'comment';
            }).remove();
            // Remove elements with target="_blank" or target="__blank"
            contentDiv.find('[target="_blank"], [target="__blank"]').remove();
            // Remove unwanted elements
            contentDiv.find('.d-none, .d-md-block, .flex, .note-content').remove();
            // Process images (Requirement 4.6)
            await this.downloadChapterImages($, contentDiv, imgPrefix, index);
            // Remove empty elements
            contentDiv.find('p, div, span').each((_, el) => {
                const $el = $(el);
                const hasText = $el.text().trim().length > 0;
                const hasImages = $el.find('img').length > 0;
                if (!hasText && !hasImages) {
                    $el.remove();
                }
            });
            // Extract footnotes before removing their definitions
            const footnoteMap = new Map();
            $('div[id]').each((_, el) => {
                const $el = $(el);
                const id = $el.attr('id');
                if (id && /^note\d+$/.test(id)) {
                    const contentSpan = $el.find('span.note-content_real');
                    const content = contentSpan.length
                        ? contentSpan.text().trim()
                        : $el.text().trim();
                    if (content) {
                        footnoteMap.set(id, content);
                    }
                    $el.remove();
                }
            });
            // Remove note-reg container
            $('.note-reg').remove();
            let htmlContent = contentDiv.html() || '';
            // Process footnote markers
            const chapterSlug = `${imgPrefix}_ch${index}`;
            const { html: processedHtml, usedNotes } = this.contentProcessor.convertFootnoteMarkers(htmlContent, footnoteMap, chapterSlug);
            // Generate footnote asides
            const footnotesHtml = this.contentProcessor.generateFootnoteAsides(usedNotes, footnoteMap, chapterSlug, true);
            let finalHtml = processedHtml + footnotesHtml;
            // Clean up multiple newlines
            finalHtml = finalHtml.replace(/\n{3,}/g, '\n\n');
            return {
                title: chapter.name,
                url: chapter.url,
                content: finalHtml,
                index,
            };
        }
        catch (error) {
            console.error(`\nError processing chapter ${chapter.url}:`, error);
            return null;
        }
    }
    /**
     * Downloads and renames images in chapter content
     * Requirement: 4.6 - Download and rename chapter images with consistent naming convention
     *
     * @param $ - Cheerio instance
     * @param contentDiv - The content div element
     * @param imgPrefix - Prefix for image filenames (volume slug)
     * @param chapterIndex - Chapter index
     */
    async downloadChapterImages($, contentDiv, imgPrefix, chapterIndex) {
        const images = contentDiv.find('img').toArray();
        for (let i = 0; i < images.length; i++) {
            const img = $(images[i]);
            const src = img.attr('src');
            // Skip banner images or images without src
            if (!src || src.includes('chapter-banners')) {
                img.remove();
                continue;
            }
            // Determine extension from URL
            const ext = this.getImageExtension(src);
            // Generate consistent filename (Requirement 4.6)
            // Pattern: {volumeSlug}_chap_{chapterIndex}_img_{imageIndex}.{ext}
            const localName = `${imgPrefix}_chap_${chapterIndex}_img_${i}.${ext}`;
            const savePath = join(this.imagesFolder, localName);
            // Download image
            const success = await this.network.downloadToFile(src, savePath);
            if (success) {
                // Update src to local path
                img.attr('src', `images/${localName}`);
                // Remove unwanted attributes
                img.removeAttr('style');
                img.removeAttr('onclick');
            }
            else {
                // Remove image if download failed
                img.remove();
            }
        }
    }
    /**
     * Validates a cached chapter by checking if all referenced images exist
     * Requirements: 4.2, 4.3
     *
     * @param chapterData - The cached chapter data
     * @returns true if cache is valid, false otherwise
     */
    validateCachedChapter(chapterData) {
        if (!chapterData || !chapterData.content) {
            return false;
        }
        // Check minimum content length
        if (chapterData.content.length < 50) {
            return false;
        }
        try {
            const $ = cheerio.load(chapterData.content);
            const images = $('img').toArray();
            // Check each image exists locally with non-zero size
            for (const imgEl of images) {
                const src = $(imgEl).attr('src');
                if (src && src.startsWith('images/')) {
                    const fullPath = join(this.baseFolder, src);
                    // Use synchronous check for validation
                    if (!this.fileExistsSync(fullPath)) {
                        return false;
                    }
                }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Synchronous file existence check for cache validation
     */
    fileExistsSync(filePath) {
        try {
            const fs = require('node:fs');
            const stats = fs.statSync(filePath);
            return stats.isFile() && stats.size > 0;
        }
        catch {
            return false;
        }
    }
    /**
     * Loads existing chapters from a volume JSON file
     *
     * @param jsonPath - Path to the volume JSON file
     * @returns Map of chapter URL to chapter data
     */
    async loadExistingChapters(jsonPath) {
        const existingChapters = new Map();
        try {
            const oldData = await readJson(jsonPath);
            if (oldData && oldData.chapters) {
                for (const ch of oldData.chapters) {
                    existingChapters.set(ch.url, ch);
                }
            }
        }
        catch {
            // File doesn't exist or is corrupt - start fresh
        }
        return existingChapters;
    }
    /**
     * Extracts image extension from URL
     */
    getImageExtension(url) {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('png'))
            return 'png';
        if (lowerUrl.includes('gif'))
            return 'gif';
        if (lowerUrl.includes('webp'))
            return 'webp';
        return 'jpg';
    }
    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Gets the base folder path
     */
    getBaseFolder() {
        return this.baseFolder;
    }
    /**
     * Gets the images folder path
     */
    getImagesFolder() {
        return this.imagesFolder;
    }
}
//# sourceMappingURL=downloader.js.map