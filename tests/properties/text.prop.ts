/**
 * Property-based tests for text utilities
 * **Feature: hako-crawler-nodejs, Property 8: Image Naming Convention**
 * **Validates: Requirements 4.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatFilename } from '../../src/utils/text';

describe('formatFilename property tests', () => {
    /**
     * Property 8: Image Naming Convention
     * For any input string, formatFilename should produce a valid filename
     * that doesn't contain invalid characters and follows naming conventions.
     */
    it('should never contain invalid filename characters', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const result = formatFilename(input);
                // Should not contain any of these invalid characters
                const invalidChars = /[\\/*?:"<>|]/;
                expect(invalidChars.test(result)).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should replace spaces with underscores', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const result = formatFilename(input);
                // Result should not contain spaces
                expect(result.includes(' ')).toBe(false);
            }),
            { numRuns: 100 }
        );
    });

    it('should limit length to 100 characters', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const result = formatFilename(input);
                expect(result.length).toBeLessThanOrEqual(100);
            }),
            { numRuns: 100 }
        );
    });

    it('should preserve alphanumeric characters', () => {
        fc.assert(
            fc.property(
                fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') }),
                (input) => {
                    const result = formatFilename(input);
                    // For alphanumeric-only input, result should equal input (up to length limit)
                    expect(result).toBe(input.slice(0, 100));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('should be idempotent - formatting twice gives same result', () => {
        fc.assert(
            fc.property(fc.string(), (input) => {
                const once = formatFilename(input);
                const twice = formatFilename(once);
                expect(twice).toBe(once);
            }),
            { numRuns: 100 }
        );
    });
});
