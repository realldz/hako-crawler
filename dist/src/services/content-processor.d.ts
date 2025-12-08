/**
 * Content Processor for hako-crawler
 * Handles HTML cleaning, XHTML sanitization, and footnote processing
 * Requirements: 4.5, 5.1, 5.2, 5.3, 5.4
 */
/**
 * Represents a footnote definition extracted from HTML
 */
export interface FootnoteDefinition {
    id: string;
    content: string;
}
/**
 * Result of footnote processing
 */
export interface FootnoteProcessResult {
    html: string;
    footnotes: FootnoteDefinition[];
}
/**
 * ContentProcessor handles HTML cleaning and footnote processing for EPUB compatibility
 */
export declare class ContentProcessor {
    /**
     * Cleans HTML content by removing unwanted elements
     * Requirement: 4.5 - Remove unwanted HTML elements (ads, hidden divs, comments)
     *
     * @param html - The HTML content to clean
     * @returns Cleaned HTML string
     */
    cleanHtml(html: string): string;
    /**
     * Sanitizes HTML content for EPUB XHTML compatibility
     * Converts HTML to valid XHTML that can be embedded in EPUB files
     *
     * @param html - The HTML content to sanitize
     * @returns Sanitized XHTML string
     */
    sanitizeXhtml(html: string): string;
    /**
     * Extracts footnote definitions from HTML content
     * Requirement: 5.1 - Detect and extract footnote definitions
     *
     * Looks for div elements with id matching /note\d+/ pattern
     *
     * @param html - The HTML content containing footnote definitions
     * @returns Map of footnote ID to content
     */
    extractFootnoteDefinitions(html: string): Map<string, string>;
    /**
     * Converts inline footnote markers to EPUB-compatible noteref links
     * Requirements: 5.2, 5.4 - Convert inline footnote markers to EPUB-compatible noteref links
     *
     * Handles multiple footnote formats (Requirement 5.4):
     * - [note1], [note2], etc.
     * - (1)[note1], [2][note2], etc. (with preceding number)
     * - Note: text patterns (inline notes without IDs)
     * - <sup> elements containing note references
     *
     * @param html - The HTML content with footnote markers
     * @param footnoteMap - Map of footnote IDs to their content
     * @param chapterSlug - Unique identifier for the chapter (for ID uniqueness)
     * @returns Object containing processed HTML and list of used footnote IDs
     */
    convertFootnoteMarkers(html: string, footnoteMap: Map<string, string>, chapterSlug: string): {
        html: string;
        usedNotes: string[];
    };
    /**
     * Generates EPUB-compatible footnote aside elements
     * Requirement: 5.3 - Generate proper EPUB footnote aside elements with unique IDs
     *
     * @param usedNotes - Array of footnote IDs that were referenced in the content
     * @param footnoteMap - Map of footnote IDs to their content
     * @param chapterSlug - Unique identifier for the chapter (for ID uniqueness)
     * @param includeUnused - Whether to include footnotes that weren't referenced
     * @returns HTML string containing all footnote aside elements
     */
    generateFootnoteAsides(usedNotes: string[], footnoteMap: Map<string, string>, chapterSlug: string, includeUnused?: boolean): string;
    /**
     * Processes footnotes in HTML content - main entry point for footnote handling
     * Requirements: 5.1, 5.2, 5.3, 5.4
     *
     * This method:
     * 1. Extracts footnote definitions from the HTML
     * 2. Removes footnote definition elements from the content
     * 3. Converts inline markers to noteref links
     * 4. Appends footnote aside elements at the end
     *
     * @param html - The full HTML content (including footnote definitions)
     * @param chapterSlug - Unique identifier for the chapter
     * @returns Processed HTML with EPUB-compatible footnotes
     */
    processFootnotes(html: string, chapterSlug: string): string;
    /**
     * Full content processing pipeline
     * Combines HTML cleaning, footnote processing, and XHTML sanitization
     *
     * @param html - Raw HTML content from chapter
     * @param chapterSlug - Unique identifier for the chapter
     * @returns Fully processed content ready for EPUB
     */
    processContent(html: string, chapterSlug: string): string;
}
//# sourceMappingURL=content-processor.d.ts.map