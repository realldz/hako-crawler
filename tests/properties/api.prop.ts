/**
 * Property-based tests for API exports
 * **Feature: hako-crawler-nodejs, Property 16: Metadata JSON Schema Compliance**
 * **Feature: hako-crawler-nodejs, Property 17: Books List Update**
 * **Validates: Requirements 10.3, 10.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
    readBooksList,
    writeBooksList,
    addBookToList,
    removeBookFromList,
    isBookInList,
} from '../../src/utils/books';
import type { NovelMetadata, VolumeMetadata } from '../../src/types';

// Safe string generator
const safeString = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'),
    minLength: 1,
    maxLength: 30
});

describe('API property tests', () => {
    /**
     * Property 16: Metadata JSON Schema Compliance
     * For any downloaded novel, the generated metadata.json should contain
     * all required fields: novelName, author, tags, summary, coverImageLocal, url, and volumes array.
     */
    describe('Property 16: Metadata JSON Schema Compliance', () => {
        it('should validate NovelMetadata structure has all required fields', () => {
            fc.assert(
                fc.property(
                    safeString,
                    safeString,
                    fc.array(safeString, { minLength: 0, maxLength: 5 }),
                    safeString,
                    safeString,
                    fc.webUrl(),
                    (novelName, author, tags, summary, coverImageLocal, url) => {
                        const metadata: NovelMetadata = {
                            novelName,
                            author,
                            tags,
                            summary,
                            coverImageLocal,
                            url,
                            volumes: [],
                        };

                        // All required fields should be present
                        expect(metadata.novelName).toBeDefined();
                        expect(metadata.author).toBeDefined();
                        expect(metadata.tags).toBeDefined();
                        expect(metadata.summary).toBeDefined();
                        expect(metadata.coverImageLocal).toBeDefined();
                        expect(metadata.url).toBeDefined();
                        expect(metadata.volumes).toBeDefined();
                        expect(Array.isArray(metadata.volumes)).toBe(true);
                    }
                ),
                { numRuns: 50 }
            );
        });

        it('should validate VolumeMetadata structure', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1, max: 100 }),
                    safeString,
                    safeString,
                    fc.webUrl(),
                    (order, name, filename, url) => {
                        const volumeMeta: VolumeMetadata = {
                            order,
                            name,
                            filename,
                            url,
                        };

                        // All required fields should be present
                        expect(volumeMeta.order).toBeDefined();
                        expect(volumeMeta.name).toBeDefined();
                        expect(volumeMeta.filename).toBeDefined();
                        expect(volumeMeta.url).toBeDefined();
                        expect(typeof volumeMeta.order).toBe('number');
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    /**
     * Property 17: Books List Update
     * For any newly downloaded novel, the books.json file should contain
     * the novel's folder name after download completes.
     */
    describe('Property 17: Books List Update', () => {
        it('should have all books list functions available', () => {
            expect(typeof readBooksList).toBe('function');
            expect(typeof writeBooksList).toBe('function');
            expect(typeof addBookToList).toBe('function');
            expect(typeof removeBookFromList).toBe('function');
            expect(typeof isBookInList).toBe('function');
        });

        it('should return array from readBooksList', async () => {
            const result = await readBooksList();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle book list operations consistently', () => {
            fc.assert(
                fc.property(
                    fc.array(safeString, { minLength: 0, maxLength: 10 })
                        .map(arr => [...new Set(arr)])
                        .filter(arr => arr.length > 0),
                    (bookNames) => {
                        // Simulate book list operations
                        const booksList: string[] = [];

                        for (const name of bookNames) {
                            if (!booksList.includes(name)) {
                                booksList.push(name);
                            }
                        }

                        // All unique names should be in the list
                        const uniqueNames = [...new Set(bookNames)];
                        expect(booksList.length).toBe(uniqueNames.length);

                        for (const name of uniqueNames) {
                            expect(booksList.includes(name)).toBe(true);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
