/**
 * EPUB Builder Service
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */
import type { EpubOptions as BuilderOptions } from '../types';
/**
 * Processed image result
 */
interface ProcessedImage {
    data: Buffer;
    mimeType: string;
    newPath: string;
}
/**
 * EpubBuilder class for generating EPUB files from downloaded novel data
 */
export declare class EpubBuilder {
    private baseFolder;
    private compressImages;
    private outputDir;
    private metadata;
    private imageCache;
    constructor(baseFolder: string, options: BuilderOptions);
    /**
     * Load metadata from the base folder
     */
    private loadMetadata;
    /**
     * Load volume data from a JSON file
     */
    private loadVolumeData;
    /**
     * Sanitize HTML content for EPUB compatibility
     */
    private sanitizeXhtml;
    /**
     * Escape HTML special characters
     */
    private escapeHtml;
    /**
     * Get the output path for an EPUB file based on build mode
     * - Merged + Original -> result/<BookName - Full>.epub
     * - Compressed (Any) -> result/<BookName>/compressed/<filename>
     * - Separate + Original -> result/<BookName>/original/<filename>
     */
    getOutputPath(filename: string, isMerged: boolean): string;
    /**
     * Process an image file with optional compression
     * Requirements: 6.4, 6.5, 6.6
     */
    processImage(relPath: string): Promise<ProcessedImage | null>;
    /**
     * Create intro page with cover and metadata
     * Uses base64 data URIs for images
     */
    private makeIntroPage;
    /**
     * Process chapter content and extract/update image references
     * Converts images to base64 data URIs for epub-gen-memory compatibility
     */
    private processChapterContent;
    /**
     * Build a merged EPUB containing all volumes
     * Requirements: 6.2, 6.7
     */
    buildMerged(jsonFiles: string[]): Promise<string>;
    /**
     * Build a single volume EPUB
     * Requirements: 6.3
     */
    buildVolume(jsonFile: string): Promise<string>;
    /**
     * Clear the image cache
     */
    clearCache(): void;
}
export {};
//# sourceMappingURL=epub-builder.d.ts.map