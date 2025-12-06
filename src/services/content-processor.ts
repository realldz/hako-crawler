/**
 * Content Processor for hako-crawler
 * Handles HTML cleaning, XHTML sanitization, and footnote processing
 * Requirements: 4.5, 5.1, 5.2, 5.3, 5.4
 */

import * as cheerio from 'cheerio';

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
export class ContentProcessor {
    /**
     * Cleans HTML content by removing unwanted elements
     * Requirement: 4.5 - Remove unwanted HTML elements (ads, hidden divs, comments)
     * 
     * @param html - The HTML content to clean
     * @returns Cleaned HTML string
     */
    cleanHtml(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        const $ = cheerio.load(html, { xmlMode: false });

        // Remove HTML comments
        $('*').contents().filter(function () {
            return this.type === 'comment';
        }).remove();

        // Remove elements with target="_blank" or target="__blank" (external links/ads)
        $('[target="_blank"], [target="__blank"]').remove();

        // Remove hidden elements (d-none class)
        $('.d-none').remove();

        // Remove responsive hidden elements
        $('.d-md-block').remove();

        // Remove flex containers (often used for ads)
        $('.flex').remove();

        // Remove note-content elements (footnote definitions are processed separately)
        $('.note-content').remove();

        // Remove empty paragraphs, divs, and spans (no text and no images)
        $('p, div, span').each((_, el) => {
            const $el = $(el);
            const hasText = $el.text().trim().length > 0;
            const hasImages = $el.find('img').length > 0;
            if (!hasText && !hasImages) {
                $el.remove();
            }
        });

        return $.html() || '';
    }


    /**
     * Sanitizes HTML content for EPUB XHTML compatibility
     * Converts HTML to valid XHTML that can be embedded in EPUB files
     * 
     * @param html - The HTML content to sanitize
     * @returns Sanitized XHTML string
     */
    sanitizeXhtml(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        let safe = html;

        // Replace &nbsp; with numeric entity for XHTML compatibility
        safe = safe.replace(/&nbsp;/g, '&#160;');

        // Remove empty paragraphs (containing only whitespace, &nbsp;, &#160;, or <br>)
        const emptyParagraphPattern = /<p[^>]*>(\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi;
        safe = safe.replace(emptyParagraphPattern, '');

        // Collapse multiple consecutive <br> tags (3 or more) into just two
        const multipleBrPattern = /(<br\s*\/?>\s*){3,}/gi;
        safe = safe.replace(multipleBrPattern, '<br/><br/>');

        // Collapse multiple newlines (3 or more) into two
        safe = safe.replace(/\n{3,}/g, '\n\n');

        return safe.trim();
    }

    /**
     * Extracts footnote definitions from HTML content
     * Requirement: 5.1 - Detect and extract footnote definitions
     * 
     * Looks for div elements with id matching /note\d+/ pattern
     * 
     * @param html - The HTML content containing footnote definitions
     * @returns Map of footnote ID to content
     */
    extractFootnoteDefinitions(html: string): Map<string, string> {
        const footnoteMap = new Map<string, string>();

        if (!html || typeof html !== 'string') {
            return footnoteMap;
        }

        const $ = cheerio.load(html, { xmlMode: false });

        // Find all div elements with id matching note\d+ pattern
        $('div[id]').each((_, el) => {
            const $el = $(el);
            const id = $el.attr('id');

            if (id && /^note\d+$/.test(id)) {
                // Look for the actual content in span.note-content_real
                const contentSpan = $el.find('span.note-content_real');
                let content: string;

                if (contentSpan.length) {
                    content = contentSpan.text().trim();
                } else {
                    // Fallback to the div's text content
                    content = $el.text().trim();
                }

                if (content) {
                    footnoteMap.set(id, content);
                }
            }
        });

        return footnoteMap;
    }


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
    convertFootnoteMarkers(
        html: string,
        footnoteMap: Map<string, string>,
        chapterSlug: string
    ): { html: string; usedNotes: string[] } {
        if (!html || typeof html !== 'string') {
            return { html: '', usedNotes: [] };
        }

        const usedNotes: string[] = [];
        let footnoteCounter = 1;

        // Pattern 1: Match [noteN] markers with optional preceding number
        // Examples: [note1], (1)[note1], [2][note2]
        const notePattern = /(\(\d+\)|\[\d+\])?\s*\[(note\d+)\]/g;

        let processedHtml = html.replace(notePattern, (match, precedingText, noteId) => {
            // Check if this footnote exists in our map
            if (!footnoteMap.has(noteId)) {
                return match; // Keep original if footnote not found
            }

            // Avoid duplicates in usedNotes
            if (!usedNotes.includes(noteId)) {
                usedNotes.push(noteId);
            }

            // Determine the label for the link
            let label: string;
            if (precedingText) {
                label = precedingText.trim();
            } else {
                label = `[${footnoteCounter}]`;
                footnoteCounter++;
            }

            // Generate unique ID for this chapter
            const uniqueId = `${chapterSlug}_${noteId}`;

            return `<a epub:type="noteref" href="#${uniqueId}" class="footnote-link">${label}</a>`;
        });

        // Pattern 2: Handle <a> tags that link to #noteN
        // Example: <a href="#note1">1</a>
        const anchorPattern = /<a[^>]*href=["']#(note\d+)["'][^>]*>([^<]*)<\/a>/gi;

        processedHtml = processedHtml.replace(anchorPattern, (match, noteId, linkText) => {
            if (!footnoteMap.has(noteId)) {
                return match;
            }

            if (!usedNotes.includes(noteId)) {
                usedNotes.push(noteId);
            }

            const uniqueId = `${chapterSlug}_${noteId}`;
            const label = linkText.trim() || `[${footnoteCounter++}]`;

            return `<a epub:type="noteref" href="#${uniqueId}" class="footnote-link">${label}</a>`;
        });

        return { html: processedHtml, usedNotes };
    }

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
    generateFootnoteAsides(
        usedNotes: string[],
        footnoteMap: Map<string, string>,
        chapterSlug: string,
        includeUnused: boolean = true
    ): string {
        let footnotesHtml = '';

        const createFootnoteBlock = (noteId: string, content: string, title: string): string => {
            const uniqueId = `${chapterSlug}_${noteId}`;
            return `
                <aside id="${uniqueId}" epub:type="footnote" class="footnote-content">
                    <div class="note-header">${title}:</div>
                    <p>${content}</p>
                </aside>
            `;
        };

        // First, add footnotes that were referenced (in order of reference)
        for (const noteId of usedNotes) {
            const content = footnoteMap.get(noteId);
            if (content) {
                footnotesHtml += createFootnoteBlock(noteId, content, 'Ghi chú');
            }
        }

        // Then, optionally add footnotes that weren't referenced
        if (includeUnused) {
            for (const [noteId, content] of footnoteMap) {
                if (!usedNotes.includes(noteId)) {
                    footnotesHtml += createFootnoteBlock(noteId, content, 'Ghi chú (Thêm)');
                }
            }
        }

        return footnotesHtml;
    }


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
    processFootnotes(html: string, chapterSlug: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        const $ = cheerio.load(html, { xmlMode: false });

        // Step 1: Extract footnote definitions before removing them
        const footnoteMap = new Map<string, string>();

        $('div[id]').each((_, el) => {
            const $el = $(el);
            const id = $el.attr('id');

            if (id && /^note\d+$/.test(id)) {
                const contentSpan = $el.find('span.note-content_real');
                let content: string;

                if (contentSpan.length) {
                    content = contentSpan.text().trim();
                } else {
                    content = $el.text().trim();
                }

                if (content) {
                    footnoteMap.set(id, content);
                }

                // Remove the footnote definition element
                $el.remove();
            }
        });

        // Remove note-reg container if present
        $('.note-reg').remove();

        // Step 2: Get the HTML content after removing footnote definitions
        let processedHtml = $.html() || '';

        // Step 3: Convert inline markers to noteref links
        const { html: markedHtml, usedNotes } = this.convertFootnoteMarkers(
            processedHtml,
            footnoteMap,
            chapterSlug
        );

        // Step 4: Generate and append footnote asides
        const footnotesHtml = this.generateFootnoteAsides(
            usedNotes,
            footnoteMap,
            chapterSlug,
            true // Include unused footnotes
        );

        return markedHtml + footnotesHtml;
    }

    /**
     * Full content processing pipeline
     * Combines HTML cleaning, footnote processing, and XHTML sanitization
     * 
     * @param html - Raw HTML content from chapter
     * @param chapterSlug - Unique identifier for the chapter
     * @returns Fully processed content ready for EPUB
     */
    processContent(html: string, chapterSlug: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Step 1: Clean HTML (remove ads, hidden elements, etc.)
        let processed = this.cleanHtml(html);

        // Step 2: Process footnotes
        processed = this.processFootnotes(processed, chapterSlug);

        // Step 3: Sanitize for XHTML compatibility
        processed = this.sanitizeXhtml(processed);

        return processed;
    }
}
