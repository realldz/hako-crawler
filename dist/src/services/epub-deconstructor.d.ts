/**
 * EPUB Deconstructor Service
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 *
 * Extracts content from existing EPUB files to allow editing or rebuilding
 * with different settings.
 */
import type { NovelMetadata, DeconstructOptions } from '../types';
/**
 * EpubDeconstructor extracts content from EPUB files into the same format
 * as downloaded content, allowing for editing and rebuilding.
 */
export declare class EpubDeconstructor {
    private epubPath;
    private outputDir;
    private cleanVolumeName;
    private contentProcessor;
    private zip;
    private novelName;
    private saveDir;
    private imagesDir;
    private manifest;
    private spine;
    private toc;
    private opfBasePath;
    private imageMap;
    constructor(epubPath: string, options?: DeconstructOptions);
    /**
     * Load and parse the EPUB file
     */
    private loadEpub;
    /**
     * Parse the OPF (Open Packaging Format) file
     */
    private parseOpf;
    /**
     * Parse the Table of Contents (NCX or NAV)
     */
    private parseToc;
    /**
     * Parse NAV document (EPUB 3 TOC)
     */
    private parseNavToc;
    /**
     * Parse NCX document (EPUB 2 TOC)
     */
    private parseNcxToc;
    /**
     * Extract metadata from the EPUB
     * Requirement: 7.1 - Extract metadata (title, author, description, tags)
     */
    extractMetadata(): Omit<NovelMetadata, 'volumes' | 'coverImageLocal'>;
    /**
     * Extract full metadata including author, tags, and description from OPF
     */
    private extractFullMetadata;
    /**
     * Extract and save the cover image
     * Requirement: 7.2 - Extract and save all images
     */
    private extractCover;
    /**
     * Update HTML content by extracting and renaming images
     * Requirement: 7.2 - Extract and save all images to images folder
     */
    private updateHtmlContent;
    /**
     * Process a chapter item into ChapterContent
     * Requirement: 7.4, 7.5 - Generate JSON files and process content
     */
    private processChapterItem;
    /**
     * Build volume definitions from TOC
     * Requirement: 7.3 - Parse table of contents for volume/chapter structure
     */
    private buildVolumeDefinitions;
    /**
     * Get ordered chapter hrefs from spine for a volume
     */
    private getOrderedChapterHrefs;
    /**
     * Main deconstruction method
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
     */
    deconstruct(): Promise<void>;
    /**
     * Get the output directory path
     */
    getOutputDir(): string;
    /**
     * Get the novel name extracted from the EPUB
     */
    getNovelName(): string;
}
//# sourceMappingURL=epub-deconstructor.d.ts.map