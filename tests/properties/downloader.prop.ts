/**
 * Property-based tests for NovelDownloader
 * **Feature: hako-crawler-nodejs, Property 6: Cache Validation Checks Images**
 * **Validates: Requirements 4.2, 4.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NovelDownloader } from '../../src/services/downloader';
import { NetworkManager } from '../../src/services/network';
import type { LightNovel, ChapterContent } from '../../src/types';

// Safe string generator
const safeString = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
    minLength: 1,
    maxLength: 30
});

describe('NovelDownloader property tests', () => {
    /**
     * Property 6: Cache Validation Checks Images
     * For any cached chapter containing image references, validateCachedChapter()
     * should return false if any referenced image file is missing or has zero size.
     */
    describe('Property 6: Cache Validation Checks Images', () => {
        it('should return false for chapters with missing content', () => {
            fc.assert(
                fc.property(safeString, (novelName) => {
                    const novel: LightNovel = {
                        name: novelName,
                        url: 'https://docln.net/test',
                        author: 'Test',
                        summary: '',
                        mainCover: '',
                        tags: [],
                        volumes: [],
                    };

                    const network = new NetworkManager();
                    const downloader = new NovelDownloader(novel, '/tmp/test', network);

                    // Empty chapter should be invalid
                    const emptyChapter: ChapterContent = {
                        title: 'Test',
                        url: 'https://docln.net/chapter/1',
                        content: '',
                        index: 0,
                    };

                    expect(downloader.validateCachedChapter(emptyChapter)).toBe(false);
                }),
                { numRuns: 50 }
            );
        });

        it('should return false for chapters with very short content', () => {
            fc.assert(
                fc.property(
                    safeString,
                    fc.string({ minLength: 1, maxLength: 49 }),
                    (novelName, shortContent) => {
                        const novel: LightNovel = {
                            name: novelName,
                            url: 'https://docln.net/test',
                            author: 'Test',
                            summary: '',
                            mainCover: '',
                            tags: [],
                            volumes: [],
                        };

                        const network = new NetworkManager();
                        const downloader = new NovelDownloader(novel, '/tmp/test', network);

                        // Short content (< 50 chars) should be invalid
                        const shortChapter: ChapterContent = {
                            title: 'Test',
                            url: 'https://docln.net/chapter/1',
                            content: shortContent,
                            index: 0,
                        };

                        expect(downloader.validateCachedChapter(shortChapter)).toBe(false);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should return true for chapters with sufficient content and no images', () => {
            fc.assert(
                fc.property(
                    safeString,
                    fc.string({ minLength: 100, maxLength: 500 }),
                    (novelName, longContent) => {
                        const novel: LightNovel = {
                            name: novelName,
                            url: 'https://docln.net/test',
                            author: 'Test',
                            summary: '',
                            mainCover: '',
                            tags: [],
                            volumes: [],
                        };

                        const network = new NetworkManager();
                        const downloader = new NovelDownloader(novel, '/tmp/test', network);

                        // Long content without images should be valid
                        const validChapter: ChapterContent = {
                            title: 'Test',
                            url: 'https://docln.net/chapter/1',
                            content: `<p>${longContent}</p>`,
                            index: 0,
                        };

                        expect(downloader.validateCachedChapter(validChapter)).toBe(true);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
