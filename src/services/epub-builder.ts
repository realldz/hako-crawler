/**
 * EPUB Builder Service
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import { join, extname } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import epub, { type Chapter as EpubChapter, type Options as EpubGenOptions } from 'epub-gen-memory';
import * as cheerio from 'cheerio';
import sharp from 'sharp';

import type { NovelMetadata, VolumeData, EpubOptions as BuilderOptions } from '../types';
import { ensureDir, readJson, fileExistsWithContent } from '../utils/fs';
import { formatFilename } from '../utils/text';
import { PATHS } from '../config/constants';

/**
 * Processed image result
 */
interface ProcessedImage {
    data: Buffer;
    mimeType: string;
    newPath: string;
}

/**
 * CSS styling for EPUB content
 */
const EPUB_CSS = `
body { margin: 0; padding: 5px; text-align: justify; line-height: 1.4em; font-family: serif; }
h1, h2, h3 { text-align: center; margin: 1em 0; font-weight: bold; }
img { display: block; margin: 10px auto; max-width: 100%; height: auto; }
p { margin-bottom: 1em; text-indent: 1em; }
.center { text-align: center; }
nav#toc ol { list-style-type: none; padding-left: 0; }
nav#toc > ol > li { margin-top: 1em; font-weight: bold; }
nav#toc > ol > li > ol { list-style-type: none; padding-left: 1.5em; font-weight: normal; }
nav#toc > ol > li > ol > li { margin-top: 0.5em; }
nav#toc a { text-decoration: none; color: inherit; }
nav#toc a:hover { text-decoration: underline; color: blue; }
a.footnote-link { vertical-align: super; font-size: 0.75em; text-decoration: none; color: #007bff; margin-left: 2px; }
aside.footnote-content { margin-top: 1em; padding: 0.5em; border-top: 1px solid #ccc; font-size: 0.9em; color: #333; background-color: #f9f9f9; display: block; }
aside.footnote-content p { margin: 0; text-indent: 0; }
aside.footnote-content div.note-header { font-weight: bold; margin-bottom: 0.5em; color: #555; }
`.trim();

/**
 * EpubBuilder class for generating EPUB files from downloaded novel data
 */
export class EpubBuilder {
    private baseFolder: string;
    private compressImages: boolean;
    private outputDir: string;
    private metadata: NovelMetadata | null = null;
    private imageCache: Map<string, ProcessedImage> = new Map();

    constructor(baseFolder: string, options: BuilderOptions) {
        this.baseFolder = baseFolder;
        this.compressImages = options.compressImages;
        this.outputDir = options.outputDir || PATHS.RESULT_DIR;
    }

    /**
     * Load metadata from the base folder
     */
    private async loadMetadata(): Promise<NovelMetadata> {
        if (this.metadata) {
            return this.metadata;
        }

        const metaPath = join(this.baseFolder, 'metadata.json');
        try {
            this.metadata = await readJson<NovelMetadata>(metaPath);
            return this.metadata;
        } catch {
            // Return default metadata if file doesn't exist
            this.metadata = {
                novelName: 'Unknown',
                author: 'Unknown',
                summary: '',
                coverImageLocal: '',
                tags: [],
                url: '',
                volumes: [],
            };
            return this.metadata;
        }
    }


    /**
     * Load volume data from a JSON file
     */
    private async loadVolumeData(jsonFile: string): Promise<VolumeData> {
        const filePath = join(this.baseFolder, jsonFile);
        return readJson<VolumeData>(filePath);
    }

    /**
     * Sanitize HTML content for EPUB compatibility
     */
    private sanitizeXhtml(html: string): string {
        if (!html) return '';

        let safe = html;
        // Replace &nbsp; with numeric entity
        safe = safe.replace(/&nbsp;/g, '&#160;');
        // Remove empty paragraphs
        safe = safe.replace(/<p[^>]*>(\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p>/gi, '');
        // Reduce excessive line breaks
        safe = safe.replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');

        return safe.trim();
    }

    /**
     * Escape HTML special characters
     */
    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Get the output path for an EPUB file based on build mode
     * - Merged + Original -> result/<BookName - Full>.epub
     * - Compressed (Any) -> result/<BookName>/compressed/<filename>
     * - Separate + Original -> result/<BookName>/original/<filename>
     */
    getOutputPath(filename: string, isMerged: boolean): string {
        const meta = this.metadata!;
        const bookNameSlug = formatFilename(meta.novelName);

        // Case 1: Merged & Original (Special Case)
        if (isMerged && !this.compressImages) {
            return join(this.outputDir, filename);
        }

        // Determine subfolder
        const subfolder = this.compressImages ? 'compressed' : 'original';

        // Path: result/<BookName>/<subfolder>/
        return join(this.outputDir, bookNameSlug, subfolder, filename);
    }

    /**
     * Process an image file with optional compression
     * Requirements: 6.4, 6.5, 6.6
     */
    async processImage(relPath: string): Promise<ProcessedImage | null> {
        if (!relPath) return null;

        // Check cache first
        if (this.imageCache.has(relPath)) {
            return this.imageCache.get(relPath)!;
        }

        const fullPath = join(this.baseFolder, relPath);

        // Check if file exists
        if (!(await fileExistsWithContent(fullPath))) {
            return null;
        }

        try {
            const imageBuffer = await readFile(fullPath);

            if (!this.compressImages) {
                // Preserve original format
                const ext = extname(relPath).toLowerCase();
                let mimeType = 'image/jpeg';
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.gif') mimeType = 'image/gif';
                else if (ext === '.webp') mimeType = 'image/webp';

                const result: ProcessedImage = {
                    data: imageBuffer,
                    mimeType,
                    newPath: relPath,
                };
                this.imageCache.set(relPath, result);
                return result;
            }

            // Compress to JPEG quality 75
            try {
                const compressedBuffer = await sharp(imageBuffer)
                    .jpeg({ quality: 75 })
                    .toBuffer();

                // Change extension to .jpg
                const baseName = relPath.replace(/\.[^.]+$/, '');
                const newPath = `${baseName}.jpg`;

                const result: ProcessedImage = {
                    data: compressedBuffer,
                    mimeType: 'image/jpeg',
                    newPath,
                };
                this.imageCache.set(relPath, result);
                return result;
            } catch (sharpError) {
                // If sharp fails (unsupported format), return original as-is
                console.error(`\nFailed to compress image ${relPath}, using original:`, sharpError);
                const ext = extname(relPath).toLowerCase();
                let mimeType = 'image/jpeg';
                if (ext === '.png') mimeType = 'image/png';
                else if (ext === '.gif') mimeType = 'image/gif';
                else if (ext === '.webp') mimeType = 'image/webp';

                const result: ProcessedImage = {
                    data: imageBuffer,
                    mimeType,
                    newPath: relPath,
                };
                this.imageCache.set(relPath, result);
                return result;
            }
        } catch (error) {
            console.error(`\nFailed to process image ${relPath}:`, error);
            return null;
        }
    }


    /**
     * Create intro page with cover and metadata
     * Uses base64 data URIs for images
     */
    private async makeIntroPage(volName: string = ''): Promise<{ content: string; coverData: Buffer | null }> {
        const meta = this.metadata!;
        const summaryHtml = this.sanitizeXhtml(meta.summary);
        const title = this.escapeHtml(meta.novelName);
        const author = this.escapeHtml(meta.author);
        const tagsStr = meta.tags.join(', ');
        const tagsHtml = tagsStr ? `<p><b>Thể loại:</b> ${tagsStr}</p>` : '';

        let coverHtml = '<hr/>';
        let coverData: Buffer | null = null;

        if (meta.coverImageLocal) {
            const processed = await this.processImage(meta.coverImageLocal);
            if (processed) {
                coverData = processed.data;
                // Convert to base64 data URI
                const base64 = processed.data.toString('base64');
                const dataUri = `data:${processed.mimeType};base64,${base64}`;
                coverHtml = `<div style="text-align:center; margin: 2em 0; page-break-after: always; break-after: page;"><img src="${dataUri}" alt="Cover"/></div>`;
            }
        }

        const content = `
            <div style="text-align: center; margin-top: 5%;">
                <h1>${title}</h1>
                <h3 style="margin-bottom: 0.5em;">${volName}</h3>
                <p><b>Tác giả:</b> ${author}</p>
                ${tagsHtml}
                ${coverHtml}
                <div style="text-align: justify;">
                    ${summaryHtml}
                </div>
            </div>
        `;

        return { content, coverData };
    }

    /**
     * Process chapter content and extract/update image references
     * Converts images to base64 data URIs for epub-gen-memory compatibility
     */
    private async processChapterContent(content: string): Promise<{ html: string; images: ProcessedImage[] }> {
        const $ = cheerio.load(content, { xmlMode: false });
        const images: ProcessedImage[] = [];

        const imgElements = $('img').toArray();
        for (const img of imgElements) {
            const src = $(img).attr('src');
            if (src) {
                const processed = await this.processImage(src);
                if (processed) {
                    // Convert to base64 data URI for epub-gen-memory
                    const base64 = processed.data.toString('base64');
                    const dataUri = `data:${processed.mimeType};base64,${base64}`;
                    $(img).attr('src', dataUri);
                    images.push(processed);
                } else {
                    // Remove image if processing failed
                    $(img).remove();
                }
            }
        }

        return {
            html: this.sanitizeXhtml($.html()),
            images,
        };
    }

    /**
     * Build a merged EPUB containing all volumes
     * Requirements: 6.2, 6.7
     */
    async buildMerged(jsonFiles: string[]): Promise<string> {
        const meta = await this.loadMetadata();

        // Sort by volume order if available
        if (meta.volumes.length > 0) {
            const orderMap = new Map(meta.volumes.map((v) => [v.filename, v.order]));
            jsonFiles.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));
        }

        // Create intro page
        const { content: introContent, coverData } = await this.makeIntroPage('Toàn tập');

        // Build chapters array for epub-gen-memory
        const chapters: EpubChapter[] = [];
        const allImages: Map<string, ProcessedImage> = new Map();

        // Add intro chapter
        chapters.push({
            title: 'Giới thiệu',
            content: introContent,
        });

        // Process each volume
        for (let volIndex = 0; volIndex < jsonFiles.length; volIndex++) {
            const jsonFile = jsonFiles[volIndex];
            console.log(`Merging: ${jsonFile}`);

            const volData = await this.loadVolumeData(jsonFile);

            // Create volume separator page
            let volHtmlContent = '';
            if (volData.coverImageLocal) {
                const processed = await this.processImage(volData.coverImageLocal);
                if (processed) {
                    allImages.set(processed.newPath, processed);
                    // Convert to base64 data URI
                    const base64 = processed.data.toString('base64');
                    const dataUri = `data:${processed.mimeType};base64,${base64}`;
                    volHtmlContent += `<img src="${dataUri}" alt="Vol Cover" style="max-height: 50vh;"/>`;
                }
            }
            volHtmlContent += `<h1>${this.escapeHtml(volData.volumeName)}</h1>`;

            const sepContent = `
                <div style="text-align: center; margin-top: 30vh;">
                    ${volHtmlContent}
                </div>
            `;

            chapters.push({
                title: volData.volumeName,
                content: sepContent,
            });

            // Process each chapter in the volume
            for (const chap of volData.chapters) {
                const { html, images } = await this.processChapterContent(chap.content);
                for (const img of images) {
                    allImages.set(img.newPath, img);
                }

                chapters.push({
                    title: chap.title,
                    content: `<h2>${this.escapeHtml(chap.title)}</h2>${html}`,
                });
            }
        }

        // Add cover image to allImages if exists
        if (coverData && meta.coverImageLocal) {
            const processed = await this.processImage(meta.coverImageLocal);
            if (processed) {
                allImages.set(processed.newPath, processed);
            }
        }

        // Build EPUB options
        const epubOptions: EpubGenOptions = {
            title: meta.novelName,
            author: meta.author,
            lang: 'vi',
            description: meta.summary,
            css: EPUB_CSS,
        };

        // Generate EPUB
        const epubBuffer = await epub(epubOptions, chapters);

        // Determine output path
        const baseFilename = formatFilename(`${meta.novelName} Full`);
        const filename = `${baseFilename}.epub`;
        const outputPath = this.getOutputPath(filename, true);

        // Ensure output directory exists and write file
        await ensureDir(join(outputPath, '..'));
        await writeFile(outputPath, epubBuffer);

        console.log(`Created Merged EPUB: ${outputPath}`);
        return outputPath;
    }


    /**
     * Build a single volume EPUB
     * Requirements: 6.3
     */
    async buildVolume(jsonFile: string): Promise<string> {
        const meta = await this.loadMetadata();
        const volData = await this.loadVolumeData(jsonFile);

        // Create intro page with volume name
        const { content: introContent, coverData } = await this.makeIntroPage(volData.volumeName);

        // Build chapters array
        const chapters: EpubChapter[] = [];
        const allImages: Map<string, ProcessedImage> = new Map();

        // Add intro chapter
        chapters.push({
            title: 'Giới thiệu',
            content: introContent,
        });

        // Process each chapter
        for (const chap of volData.chapters) {
            const { html, images } = await this.processChapterContent(chap.content);
            for (const img of images) {
                allImages.set(img.newPath, img);
            }

            chapters.push({
                title: chap.title,
                content: `<h2>${this.escapeHtml(chap.title)}</h2>${html}`,
            });
        }

        // Add cover image if exists
        if (coverData && meta.coverImageLocal) {
            const processed = await this.processImage(meta.coverImageLocal);
            if (processed) {
                allImages.set(processed.newPath, processed);
            }
        }

        // Build EPUB options
        const epubOptions: EpubGenOptions = {
            title: `${volData.volumeName} - ${meta.novelName}`,
            author: meta.author,
            lang: 'vi',
            css: EPUB_CSS,
        };

        // Generate EPUB
        const epubBuffer = await epub(epubOptions, chapters);

        // Determine output path
        const baseFilename = formatFilename(`${volData.volumeName} - ${meta.novelName}`);
        const filename = `${baseFilename}.epub`;
        const outputPath = this.getOutputPath(filename, false);

        // Ensure output directory exists and write file
        await ensureDir(join(outputPath, '..'));
        await writeFile(outputPath, epubBuffer);

        console.log(`Created: ${outputPath}`);
        return outputPath;
    }

    /**
     * Clear the image cache
     */
    clearCache(): void {
        this.imageCache.clear();
    }
}
