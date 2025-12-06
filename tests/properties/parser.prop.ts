/**
 * Property-based tests for NovelParser
 * **Feature: hako-crawler-nodejs, Property 1: Novel Data Serialization Round-Trip**
 * **Feature: hako-crawler-nodejs, Property 2: HTML Parsing Extracts All Volumes**
 * **Feature: hako-crawler-nodejs, Property 3: Invalid URL Returns Error**
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { serializeNovel, deserializeNovel, NovelParser } from '../../src/services/parser';
import { NetworkManager } from '../../src/services/network';
import type { LightNovel, Volume, Chapter } from '../../src/types';

// Arbitrary generators for novel data structures
const chapterArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.webUrl(),
});

const volumeArb = fc.record({
    url: fc.webUrl(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    coverImg: fc.webUrl(),
    chapters: fc.array(chapterArb, { minLength: 0, maxLength: 10 }),
});

const lightNovelArb = fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    url: fc.webUrl(),
    author: fc.string({ minLength: 0, maxLength: 100 }),
    summary: fc.string({ minLength: 0, maxLength: 500 }),
    mainCover: fc.webUrl(),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
    volumes: fc.array(volumeArb, { minLength: 0, maxLength: 5 }),
});

describe('NovelParser property tests', () => {
    /**
     * Property 1: Novel Data Serialization Round-Trip
     * For any valid LightNovel object, serializing it to JSON using serializeNovel()
     * and then deserializing using deserializeNovel() should produce an equivalent LightNovel object.
     */
    describe('Property 1: Novel Data Serialization Round-Trip', () => {
        it('should produce equivalent data after serialize/deserialize', () => {
            fc.assert(
                fc.property(lightNovelArb, (novel) => {
                    const serialized = serializeNovel(novel);
                    const deserialized = deserializeNovel(serialized);

                    // Check all fields are preserved
                    expect(deserialized.name).toBe(novel.name);
                    expect(deserialized.url).toBe(novel.url);
                    expect(deserialized.author).toBe(novel.author);
                    expect(deserialized.summary).toBe(novel.summary);
                    expect(deserialized.mainCover).toBe(novel.mainCover);
                    expect(deserialized.tags).toEqual(novel.tags);
                    expect(deserialized.volumes.length).toBe(novel.volumes.length);

                    // Check volumes
                    for (let i = 0; i < novel.volumes.length; i++) {
                        expect(deserialized.volumes[i].name).toBe(novel.volumes[i].name);
                        expect(deserialized.volumes[i].url).toBe(novel.volumes[i].url);
                        expect(deserialized.volumes[i].coverImg).toBe(novel.volumes[i].coverImg);
                        expect(deserialized.volumes[i].chapters.length).toBe(novel.volumes[i].chapters.length);
                    }
                }),
                { numRuns: 100 }
            );
        });

        it('should be idempotent - multiple round trips produce same result', () => {
            fc.assert(
                fc.property(lightNovelArb, (novel) => {
                    const once = deserializeNovel(serializeNovel(novel));
                    const twice = deserializeNovel(serializeNovel(once));

                    expect(serializeNovel(once)).toBe(serializeNovel(twice));
                }),
                { numRuns: 100 }
            );
        });
    });

    /**
     * Property 2: HTML Parsing Extracts All Volumes
     * For any valid Hako novel page HTML containing N volumes,
     * the parser should extract exactly N Volume objects with non-empty names.
     */
    describe('Property 2: HTML Parsing Extracts All Volumes', () => {
        it('should extract correct number of volumes from generated HTML', () => {
            fc.assert(
                fc.property(
                    fc.array(
                        fc.record({
                            name: fc.string({ minLength: 1, maxLength: 50 }),
                            chapters: fc.array(
                                fc.record({
                                    name: fc.string({ minLength: 1, maxLength: 50 }),
                                    url: fc.string({ minLength: 1, maxLength: 50 }),
                                }),
                                { minLength: 1, maxLength: 5 }
                            ),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                    (volumeData) => {
                        // Generate HTML with the specified volumes
                        const volumesHtml = volumeData.map((vol, i) => {
                            const chaptersHtml = vol.chapters.map((ch, j) =>
                                `<li><a href="/chapter/${i}/${j}">${ch.name}</a></li>`
                            ).join('');

                            return `
                                <section class="volume-list">
                                    <span class="sect-title">${vol.name}</span>
                                    <div class="volume-cover">
                                        <a href="/volume/${i}">
                                            <div class="img-in-ratio" style="background-image: url('cover${i}.jpg')"></div>
                                        </a>
                                    </div>
                                    <ul class="list-chapters">${chaptersHtml}</ul>
                                </section>
                            `;
                        }).join('');

                        const html = `
                            <html>
                            <body>
                                <span class="series-name">Test Novel</span>
                                <div class="series-information">
                                    <div class="info-item">
                                        <span class="info-name">Tác giả</span>
                                        <span class="info-value">Test Author</span>
                                    </div>
                                </div>
                                <div class="summary-content">Test summary</div>
                                <div class="series-cover">
                                    <div class="img-in-ratio" style="background-image: url('main.jpg')"></div>
                                </div>
                                ${volumesHtml}
                            </body>
                            </html>
                        `;

                        const network = new NetworkManager();
                        const parser = new NovelParser(network);
                        const result = parser.parseFromHtml(html, 'https://docln.net/test');

                        // Should extract exactly N volumes
                        expect(result.volumes.length).toBe(volumeData.length);

                        // Each volume should have non-empty name
                        for (const vol of result.volumes) {
                            expect(vol.name.length).toBeGreaterThan(0);
                        }
                    }
                ),
                { numRuns: 50 }
            );
        });
    });

    /**
     * Property 3: Invalid URL Returns Error
     * For any malformed URL or URL pointing to non-existent resource,
     * the parser should return/throw a descriptive error rather than returning partial data.
     */
    describe('Property 3: Invalid URL Returns Error', () => {
        it('should return error for non-Hako domains', async () => {
            const externalDomains = ['google.com', 'example.com', 'github.com'];

            for (const domain of externalDomains) {
                const network = new NetworkManager();
                const parser = new NovelParser(network);
                const result = await parser.parse(`https://${domain}/some/path`);

                expect(result.success).toBe(false);
                if (!result.success) {
                    expect(result.error).toContain('Invalid domain');
                }
            }
        });

        it('should return error for invalid URL formats', () => {
            fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('://')),
                    async (invalidUrl) => {
                        const network = new NetworkManager();
                        const parser = new NovelParser(network);
                        const result = await parser.parse(invalidUrl);

                        expect(result.success).toBe(false);
                    }
                ),
                { numRuns: 20 }
            );
        });
    });
});
