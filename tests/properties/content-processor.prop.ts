/**
 * Property-based tests for ContentProcessor
 * **Feature: hako-crawler-nodejs, Property 7: HTML Cleaning Removes Unwanted Elements**
 * **Feature: hako-crawler-nodejs, Property 9: Footnote Extraction Completeness**
 * **Feature: hako-crawler-nodejs, Property 10: Footnote ID Uniqueness**
 * **Validates: Requirements 4.5, 5.1, 5.2, 5.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ContentProcessor } from '../../src/services/content-processor';

// Generator for safe alphanumeric strings (no HTML special chars)
const safeString = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
    minLength: 1,
    maxLength: 30
});

describe('ContentProcessor property tests', () => {
    const processor = new ContentProcessor();

    /**
     * Property 7: HTML Cleaning Removes Unwanted Elements
     * For any HTML string containing comments, hidden divs (class="d-none"),
     * or ad elements, cleanHtml() should return HTML without those elements
     * while preserving main content.
     */
    describe('Property 7: HTML Cleaning Removes Unwanted Elements', () => {
        it('should remove HTML comments', () => {
            fc.assert(
                fc.property(safeString, safeString, (commentContent, mainContent) => {
                    const html = `<div><!-- ${commentContent} --><p>${mainContent}</p></div>`;
                    const result = processor.cleanHtml(html);

                    // Should not contain the comment
                    expect(result).not.toContain(`<!-- ${commentContent} -->`);
                    // Should preserve main content
                    expect(result).toContain(mainContent);
                }),
                { numRuns: 100 }
            );
        });

        it('should remove elements with d-none class', () => {
            fc.assert(
                fc.property(safeString, safeString, (hiddenContent, visibleContent) => {
                    const html = `<div><div class="d-none">${hiddenContent}</div><p>${visibleContent}</p></div>`;
                    const result = processor.cleanHtml(html);

                    // Should not contain hidden content class
                    expect(result).not.toContain(`class="d-none"`);
                    // Should preserve visible content
                    expect(result).toContain(visibleContent);
                }),
                { numRuns: 100 }
            );
        });

        it('should remove elements with target="_blank"', () => {
            fc.assert(
                fc.property(safeString, safeString, (linkText, mainContent) => {
                    const html = `<div><a href="http://ad.com" target="_blank">${linkText}</a><p>${mainContent}</p></div>`;
                    const result = processor.cleanHtml(html);

                    // Should not contain target="_blank" links
                    expect(result).not.toContain('target="_blank"');
                    // Should preserve main content
                    expect(result).toContain(mainContent);
                }),
                { numRuns: 100 }
            );
        });

        it('should preserve content with images', () => {
            fc.assert(
                fc.property(safeString, (imgName) => {
                    const html = `<div><p><img src="${imgName}.jpg"/></p></div>`;
                    const result = processor.cleanHtml(html);

                    // Should preserve img elements
                    expect(result).toContain('<img');
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 9: Footnote Extraction Completeness
     * For any HTML containing footnote definitions (div with id matching /note\d+/),
     * processFootnotes() should extract all definitions and convert corresponding
     * markers to noteref links.
     */
    describe('Property 9: Footnote Extraction Completeness', () => {
        it('should extract all footnote definitions', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 })
                        .map(ids => [...new Set(ids)]) // Ensure unique IDs
                        .filter(ids => ids.length > 0),
                    safeString,
                    (noteIds, contentBase) => {
                        // Generate HTML with footnote definitions
                        const footnoteDivs = noteIds.map(id =>
                            `<div id="note${id}"><span class="note-content_real">${contentBase}${id}</span></div>`
                        ).join('');

                        const html = `<div>${footnoteDivs}</div>`;
                        const footnoteMap = processor.extractFootnoteDefinitions(html);

                        // Should extract all footnotes
                        expect(footnoteMap.size).toBe(noteIds.length);

                        // Each footnote should be extracted
                        for (const id of noteIds) {
                            expect(footnoteMap.has(`note${id}`)).toBe(true);
                            expect(footnoteMap.get(`note${id}`)).toBe(`${contentBase}${id}`);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should convert footnote markers to noteref links', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100 }),
                    safeString,
                    safeString,
                    (noteNum, noteContent, chapterSlug) => {
                        const footnoteMap = new Map<string, string>();
                        footnoteMap.set(`note${noteNum}`, noteContent);

                        const html = `<p>Some text [note${noteNum}] more text</p>`;
                        const { html: result, usedNotes } = processor.convertFootnoteMarkers(
                            html,
                            footnoteMap,
                            chapterSlug
                        );

                        // Should convert marker to noteref link
                        expect(result).toContain('epub:type="noteref"');
                        expect(result).toContain(`href="#${chapterSlug}_note${noteNum}"`);

                        // Should track used notes
                        expect(usedNotes).toContain(`note${noteNum}`);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    /**
     * Property 10: Footnote ID Uniqueness
     * For any processed chapter, all generated footnote aside elements
     * should have unique IDs within that chapter.
     */
    describe('Property 10: Footnote ID Uniqueness', () => {
        it('should generate unique IDs for footnote asides', () => {
            fc.assert(
                fc.property(
                    // Generate unique footnote IDs
                    fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 })
                        .map(ids => [...new Set(ids)])
                        .filter(ids => ids.length > 0),
                    safeString,
                    (noteIds, chapterSlug) => {
                        const footnoteMap = new Map<string, string>();
                        const usedNotes: string[] = [];

                        for (const id of noteIds) {
                            const noteId = `note${id}`;
                            footnoteMap.set(noteId, `Content for note ${id}`);
                            usedNotes.push(noteId);
                        }

                        const result = processor.generateFootnoteAsides(
                            usedNotes,
                            footnoteMap,
                            chapterSlug,
                            false
                        );

                        // Extract all IDs from the result
                        const idMatches = result.match(/id="([^"]+)"/g) || [];
                        const ids = idMatches.map(m => m.replace(/id="|"/g, ''));

                        // All IDs should be unique
                        const uniqueIds = new Set(ids);
                        expect(uniqueIds.size).toBe(ids.length);

                        // All IDs should contain the chapter slug for uniqueness
                        for (const id of ids) {
                            expect(id).toContain(chapterSlug);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should generate different IDs for different chapters', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100 }),
                    safeString,
                    safeString,
                    safeString,
                    (noteNum, noteContent, slug1, slug2) => {
                        // Ensure slugs are different
                        const safeSlug1 = slug1 + 'a';
                        const safeSlug2 = slug2 + 'b';

                        const footnoteMap = new Map<string, string>();
                        footnoteMap.set(`note${noteNum}`, noteContent);
                        const usedNotes = [`note${noteNum}`];

                        const result1 = processor.generateFootnoteAsides(usedNotes, footnoteMap, safeSlug1, false);
                        const result2 = processor.generateFootnoteAsides(usedNotes, footnoteMap, safeSlug2, false);

                        // Extract IDs
                        const id1Match = result1.match(/id="([^"]+)"/);
                        const id2Match = result2.match(/id="([^"]+)"/);

                        if (id1Match && id2Match) {
                            // IDs should be different for different chapters
                            expect(id1Match[1]).not.toBe(id2Match[1]);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
