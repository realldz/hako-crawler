/**
 * hako-crawler - Light novel crawler for Hako websites with EPUB generation
 *
 * Main entry point for the module API
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
// Re-export classes for advanced usage
export { NetworkManager } from './services/network';
export { NovelParser, serializeNovel, deserializeNovel } from './services/parser';
export { NovelDownloader } from './services/downloader';
export { EpubBuilder } from './services/epub-builder';
export { EpubDeconstructor } from './services/epub-deconstructor';
export { ContentProcessor } from './services/content-processor';
// Re-export utility functions for books list management (Requirement 10.6)
export { readBooksList, writeBooksList, addBookToList, removeBookFromList, isBookInList, } from './utils/books';
// Import for API functions
import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { NetworkManager } from './services/network';
import { NovelParser } from './services/parser';
import { NovelDownloader } from './services/downloader';
import { EpubBuilder } from './services/epub-builder';
import { EpubDeconstructor } from './services/epub-deconstructor';
import { PATHS } from './config/constants';
import { formatFilename } from './utils/text';
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
export async function parseNovel(url) {
    const network = new NetworkManager();
    const parser = new NovelParser(network);
    return parser.parse(url);
}
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
export async function downloadVolume(novel, volume, options) {
    const baseFolder = options?.baseFolder || join(PATHS.DATA_DIR, formatFilename(novel.name));
    const network = new NetworkManager();
    const downloader = new NovelDownloader(novel, baseFolder, network);
    // Create metadata file first
    await downloader.createMetadataFile();
    // Download the volume
    await downloader.downloadVolume(volume, options?.onProgress);
}
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
export async function downloadNovel(novel, options) {
    const baseFolder = options?.baseFolder || join(PATHS.DATA_DIR, formatFilename(novel.name));
    const network = new NetworkManager();
    const downloader = new NovelDownloader(novel, baseFolder, network);
    // Create metadata file first
    await downloader.createMetadataFile();
    // Download all volumes
    for (const volume of novel.volumes) {
        await downloader.downloadVolume(volume, options?.onProgress);
    }
}
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
export async function buildEpub(dataPath, options) {
    const builder = new EpubBuilder(dataPath, {
        compressImages: options.compressImages,
        outputDir: options.outputDir,
    });
    // Find all volume JSON files
    const files = await readdir(dataPath);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');
    if (jsonFiles.length === 0) {
        throw new Error(`No volume JSON files found in ${dataPath}`);
    }
    const mode = options.mode || 'merged';
    const results = [];
    if (mode === 'merged') {
        const epubPath = await builder.buildMerged(jsonFiles);
        results.push(epubPath);
    }
    else {
        for (const jsonFile of jsonFiles) {
            const epubPath = await builder.buildVolume(jsonFile);
            results.push(epubPath);
        }
    }
    return results;
}
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
export async function deconstructEpub(epubPath, options) {
    const deconstructor = new EpubDeconstructor(epubPath, options);
    await deconstructor.deconstruct();
}
//# sourceMappingURL=index.js.map