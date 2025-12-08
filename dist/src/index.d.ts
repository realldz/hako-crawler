/**
 * hako-crawler - Light novel crawler for Hako websites with EPUB generation
 *
 * Main entry point for the module API
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
export type { Chapter, Volume, LightNovel, ChapterContent, VolumeData, VolumeMetadata, NovelMetadata, DownloadOptions, EpubOptions, DeconstructOptions, FetchOptions, ParseResult, ProgressCallback, } from './types/index';
export { NetworkManager } from './services/network';
export { NovelParser, serializeNovel, deserializeNovel } from './services/parser';
export { NovelDownloader } from './services/downloader';
export { EpubBuilder } from './services/epub-builder';
export { EpubDeconstructor } from './services/epub-deconstructor';
export { ContentProcessor } from './services/content-processor';
export { readBooksList, writeBooksList, addBookToList, removeBookFromList, isBookInList, } from './utils/books';
import type { LightNovel, Volume, DownloadOptions, EpubOptions, DeconstructOptions, ParseResult } from './types/index';
/**
 * Parses a novel page from a Hako URL
 * Requirement: 9.1 - Export parseNovel(url) function
 *
 * @param url - The URL of the novel page to parse
 * @returns ParseResult containing LightNovel data or error message
 *
 * @example
 * ```typescript
 * const result = await parseNovel('https://docln.net/truyen/12345');
 * if (result.success) {
 *   console.log(result.data.name);
 * }
 * ```
 */
export declare function parseNovel(url: string): Promise<ParseResult<LightNovel>>;
/**
 * Downloads a specific volume from a novel
 * Requirement: 9.2 - Export downloadVolume(novel, volume, options) function
 *
 * @param novel - The LightNovel object containing novel metadata
 * @param volume - The Volume to download
 * @param options - Optional download configuration
 *
 * @example
 * ```typescript
 * const result = await parseNovel(url);
 * if (result.success) {
 *   await downloadVolume(result.data, result.data.volumes[0], {
 *     baseFolder: './data/my-novel',
 *     onProgress: (current, total) => console.log(`${current}/${total}`)
 *   });
 * }
 * ```
 */
export declare function downloadVolume(novel: LightNovel, volume: Volume, options?: Partial<DownloadOptions>): Promise<void>;
/**
 * Downloads all volumes from a novel
 *
 * @param novel - The LightNovel object containing novel metadata
 * @param options - Optional download configuration
 *
 * @example
 * ```typescript
 * const result = await parseNovel(url);
 * if (result.success) {
 *   await downloadNovel(result.data, {
 *     onProgress: (current, total) => console.log(`${current}/${total}`)
 *   });
 * }
 * ```
 */
export declare function downloadNovel(novel: LightNovel, options?: Partial<DownloadOptions>): Promise<void>;
/**
 * Builds EPUB files from downloaded novel data
 * Requirement: 9.3 - Export buildEpub(dataPath, options) function
 *
 * @param dataPath - Path to the downloaded novel data folder
 * @param options - EPUB generation options
 * @returns Array of paths to generated EPUB files
 *
 * @example
 * ```typescript
 * // Build merged EPUB with compressed images
 * const epubPaths = await buildEpub('./data/my-novel', {
 *   compressImages: true,
 *   mode: 'merged'
 * });
 *
 * // Build separate EPUBs with original images
 * const epubPaths = await buildEpub('./data/my-novel', {
 *   compressImages: false,
 *   mode: 'separate'
 * });
 * ```
 */
export declare function buildEpub(dataPath: string, options: EpubOptions & {
    mode?: 'merged' | 'separate';
}): Promise<string[]>;
/**
 * Deconstructs an EPUB file into the same format as downloaded content
 * Requirement: 9.4 - Export deconstructEpub(epubPath, options) function
 *
 * @param epubPath - Path to the EPUB file to deconstruct
 * @param options - Deconstruction options
 *
 * @example
 * ```typescript
 * await deconstructEpub('./input/my-novel.epub', {
 *   outputDir: './data',
 *   cleanVolumeName: (name) => name.replace(/\s*-\s*Novel Name$/, '')
 * });
 * ```
 */
export declare function deconstructEpub(epubPath: string, options?: DeconstructOptions): Promise<void>;
//# sourceMappingURL=index.d.ts.map