/**
 * Novel Downloader for hako-crawler
 * Handles downloading chapters, images, and managing cache
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 10.3
 */
import type { LightNovel, Volume, ChapterContent, ProgressCallback } from '../types';
import { NetworkManager } from './network';
/**
 * NovelDownloader handles downloading novel content with smart caching
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 10.3
 */
export declare class NovelDownloader {
    private readonly novel;
    private readonly baseFolder;
    private readonly network;
    private readonly imagesFolder;
    private readonly contentProcessor;
    constructor(novel: LightNovel, baseFolder: string, network: NetworkManager);
    /**
     * Creates the metadata.json file for the novel
     * Requirements: 4.4, 10.3
     */
    createMetadataFile(): Promise<void>;
    /**
     * Downloads a volume with all its chapters
     * Requirements: 4.1, 4.2, 4.3, 4.6
     *
     * @param volume - The volume to download
     * @param onProgress - Optional progress callback
     */
    downloadVolume(volume: Volume, onProgress?: ProgressCallback): Promise<void>;
    /**
     * Processes a single chapter - downloads content and images
     * Requirements: 4.1, 4.6
     *
     * @param index - Chapter index in the volume
     * @param chapter - Chapter metadata
     * @param imgPrefix - Prefix for image filenames (volume slug)
     * @returns ChapterContent or null if processing failed
     */
    private processChapter;
    /**
     * Downloads and renames images in chapter content
     * Requirement: 4.6 - Download and rename chapter images with consistent naming convention
     *
     * @param $ - Cheerio instance
     * @param contentDiv - The content div element
     * @param imgPrefix - Prefix for image filenames (volume slug)
     * @param chapterIndex - Chapter index
     */
    private downloadChapterImages;
    /**
     * Validates a cached chapter by checking if all referenced images exist
     * Requirements: 4.2, 4.3
     *
     * @param chapterData - The cached chapter data
     * @returns true if cache is valid, false otherwise
     */
    validateCachedChapter(chapterData: ChapterContent): boolean;
    /**
     * Synchronous file existence check for cache validation
     */
    private fileExistsSync;
    /**
     * Loads existing chapters from a volume JSON file
     *
     * @param jsonPath - Path to the volume JSON file
     * @returns Map of chapter URL to chapter data
     */
    private loadExistingChapters;
    /**
     * Extracts image extension from URL
     */
    private getImageExtension;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Gets the base folder path
     */
    getBaseFolder(): string;
    /**
     * Gets the images folder path
     */
    getImagesFolder(): string;
}
//# sourceMappingURL=downloader.d.ts.map