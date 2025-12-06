/**
 * EPUB Deconstructor Service
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 * 
 * Extracts content from existing EPUB files to allow editing or rebuilding
 * with different settings.
 */

import { join, basename, extname } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';

import type {
    NovelMetadata,
    VolumeData,
    VolumeMetadata,
    ChapterContent,
    DeconstructOptions,
} from '../types';
import { ensureDir, writeJson, fileExistsWithContent } from '../utils/fs';
import { formatFilename } from '../utils/text';
import { ContentProcessor } from './content-processor';
import { PATHS } from '../config/constants';

/**
 * Represents a parsed TOC entry
 */
interface TocEntry {
    title: string;
    href: string;
    children?: TocEntry[];
}

/**
 * Represents a volume definition parsed from TOC
 */
interface VolumeDefinition {
    name: string;
    order: number;
    hrefs: Set<string>;
}

/**
 * Represents an item in the EPUB manifest
 */
interface ManifestItem {
    id: string;
    href: string;
    mediaType: string;
}

/**
 * EpubDeconstructor extracts content from EPUB files into the same format
 * as downloaded content, allowing for editing and rebuilding.
 */
export class EpubDeconstructor {
    private epubPath: string;
    private outputDir: string;
    private cleanVolumeName: ((name: string) => string) | undefined;
    private contentProcessor: ContentProcessor;

    private zip: JSZip | null = null;
    private novelName: string = 'Unknown Novel';
    private saveDir: string = '';
    private imagesDir: string = '';

    // Parsed EPUB data
    private manifest: Map<string, ManifestItem> = new Map();
    private spine: string[] = [];
    private toc: TocEntry[] = [];
    private opfBasePath: string = '';

    // Image tracking
    private imageMap: Map<string, string> = new Map();

    constructor(epubPath: string, options?: DeconstructOptions) {
        this.epubPath = epubPath;
        this.outputDir = options?.outputDir || PATHS.DATA_DIR;
        this.cleanVolumeName = options?.cleanVolumeName;
        this.contentProcessor = new ContentProcessor();
    }

    /**
     * Load and parse the EPUB file
     */
    private async loadEpub(): Promise<void> {
        if (!(await fileExistsWithContent(this.epubPath))) {
            throw new Error(`EPUB file not found: ${this.epubPath}`);
        }

        const epubBuffer = await readFile(this.epubPath);
        this.zip = await JSZip.loadAsync(epubBuffer);

        // Find and parse container.xml to get OPF path
        const containerXml = await this.zip.file('META-INF/container.xml')?.async('string');
        if (!containerXml) {
            throw new Error('Invalid EPUB: Missing container.xml');
        }

        const $container = cheerio.load(containerXml, { xmlMode: true });
        const opfPath = $container('rootfile').attr('full-path');
        if (!opfPath) {
            throw new Error('Invalid EPUB: Cannot find OPF path');
        }

        // Store base path for resolving relative paths
        this.opfBasePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        // Parse OPF file
        const opfContent = await this.zip.file(opfPath)?.async('string');
        if (!opfContent) {
            throw new Error('Invalid EPUB: Cannot read OPF file');
        }

        await this.parseOpf(opfContent);
    }

    /**
     * Parse the OPF (Open Packaging Format) file
     */
    private async parseOpf(opfContent: string): Promise<void> {
        const $ = cheerio.load(opfContent, { xmlMode: true });

        // Extract title
        const title = $('dc\\:title, title').first().text();
        if (title) {
            this.novelName = title;
        }

        // Parse manifest
        $('manifest item').each((_, el) => {
            const $el = $(el);
            const id = $el.attr('id') || '';
            const href = $el.attr('href') || '';
            const mediaType = $el.attr('media-type') || '';

            if (id && href) {
                this.manifest.set(id, { id, href, mediaType });
            }
        });

        // Parse spine
        $('spine itemref').each((_, el) => {
            const idref = $(el).attr('idref');
            if (idref) {
                this.spine.push(idref);
            }
        });

        // Find and parse TOC
        await this.parseToc($);
    }

    /**
     * Parse the Table of Contents (NCX or NAV)
     */
    private async parseToc($opf: cheerio.CheerioAPI): Promise<void> {
        // Try to find NAV document first (EPUB 3)
        const navItem = Array.from(this.manifest.values()).find(
            (item) => item.mediaType === 'application/xhtml+xml' && item.href.includes('nav')
        );

        if (navItem) {
            const navPath = this.opfBasePath + navItem.href;
            const navContent = await this.zip?.file(navPath)?.async('string');
            if (navContent) {
                this.parseNavToc(navContent);
                return;
            }
        }

        // Fall back to NCX (EPUB 2)
        const ncxId = $opf('spine').attr('toc');
        if (ncxId) {
            const ncxItem = this.manifest.get(ncxId);
            if (ncxItem) {
                const ncxPath = this.opfBasePath + ncxItem.href;
                const ncxContent = await this.zip?.file(ncxPath)?.async('string');
                if (ncxContent) {
                    this.parseNcxToc(ncxContent);
                }
            }
        }
    }

    /**
     * Parse NAV document (EPUB 3 TOC)
     */
    private parseNavToc(navContent: string): void {
        const $ = cheerio.load(navContent, { xmlMode: false });

        const parseOl = (ol: ReturnType<typeof $>): TocEntry[] => {
            const entries: TocEntry[] = [];
            ol.children('li').each((_, li) => {
                const $li = $(li);
                const $a = $li.children('a').first();
                const title = $a.text().trim();
                const href = $a.attr('href')?.split('#')[0] || '';

                if (title) {
                    const entry: TocEntry = { title, href };
                    const childOl = $li.children('ol');
                    if (childOl.length) {
                        entry.children = parseOl(childOl);
                    }
                    entries.push(entry);
                }
            });
            return entries;
        };

        const navOl = $('nav[epub\\:type="toc"] ol, nav#toc ol').first();
        if (navOl.length) {
            this.toc = parseOl(navOl);
        }
    }

    /**
     * Parse NCX document (EPUB 2 TOC)
     */
    private parseNcxToc(ncxContent: string): void {
        const $ = cheerio.load(ncxContent, { xmlMode: true });

        const parseNavPoints = (parent: ReturnType<typeof $>): TocEntry[] => {
            const entries: TocEntry[] = [];
            parent.children('navPoint').each((_, np) => {
                const $np = $(np);
                const title = $np.children('navLabel').children('text').text().trim();
                const href = $np.children('content').attr('src')?.split('#')[0] || '';

                if (title) {
                    const entry: TocEntry = { title, href };
                    const children = parseNavPoints($np);
                    if (children.length) {
                        entry.children = children;
                    }
                    entries.push(entry);
                }
            });
            return entries;
        };

        const navMap = $('navMap');
        if (navMap.length) {
            this.toc = parseNavPoints(navMap);
        }
    }


    /**
     * Extract metadata from the EPUB
     * Requirement: 7.1 - Extract metadata (title, author, description, tags)
     */
    extractMetadata(): Omit<NovelMetadata, 'volumes' | 'coverImageLocal'> {
        if (!this.zip) {
            throw new Error('EPUB not loaded');
        }

        return {
            novelName: this.novelName,
            author: 'Unknown',
            tags: [],
            summary: '',
            url: '',
        };
    }

    /**
     * Extract full metadata including author, tags, and description from OPF
     */
    private async extractFullMetadata(): Promise<Omit<NovelMetadata, 'volumes' | 'coverImageLocal'>> {
        if (!this.zip) {
            throw new Error('EPUB not loaded');
        }

        // Find OPF path again
        const containerXml = await this.zip.file('META-INF/container.xml')?.async('string');
        if (!containerXml) {
            return this.extractMetadata();
        }

        const $container = cheerio.load(containerXml, { xmlMode: true });
        const opfPath = $container('rootfile').attr('full-path');
        if (!opfPath) {
            return this.extractMetadata();
        }

        const opfContent = await this.zip.file(opfPath)?.async('string');
        if (!opfContent) {
            return this.extractMetadata();
        }

        const $ = cheerio.load(opfContent, { xmlMode: true });

        const author = $('dc\\:creator, creator').first().text() || 'Unknown';
        const summary = $('dc\\:description, description').first().text() || '';
        const tags: string[] = [];
        $('dc\\:subject, subject').each((_, el) => {
            const tag = $(el).text().trim();
            if (tag) tags.push(tag);
        });

        return {
            novelName: this.novelName,
            author,
            tags,
            summary,
            url: '',
        };
    }

    /**
     * Extract and save the cover image
     * Requirement: 7.2 - Extract and save all images
     */
    private async extractCover(): Promise<string> {
        if (!this.zip) return '';

        // Find OPF to get cover metadata
        const containerXml = await this.zip.file('META-INF/container.xml')?.async('string');
        if (!containerXml) return '';

        const $container = cheerio.load(containerXml, { xmlMode: true });
        const opfPath = $container('rootfile').attr('full-path');
        if (!opfPath) return '';

        const opfContent = await this.zip.file(opfPath)?.async('string');
        if (!opfContent) return '';

        const $ = cheerio.load(opfContent, { xmlMode: true });

        // Try to find cover from meta tag
        let coverId = $('meta[name="cover"]').attr('content');

        // Try properties="cover-image" (EPUB 3)
        if (!coverId) {
            const coverItem = $('manifest item[properties*="cover-image"]');
            if (coverItem.length) {
                coverId = coverItem.attr('id');
            }
        }

        if (!coverId) return '';

        const coverManifest = this.manifest.get(coverId);
        if (!coverManifest) return '';

        const coverPath = this.opfBasePath + coverManifest.href;
        const coverData = await this.zip.file(coverPath)?.async('nodebuffer');
        if (!coverData) return '';

        // Determine extension
        let ext = extname(coverManifest.href).toLowerCase().slice(1);
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            ext = 'jpeg';
        }

        const coverFilename = `main_cover.${ext}`;
        const coverSavePath = join(this.imagesDir, coverFilename);
        await writeFile(coverSavePath, coverData);

        this.imageMap.set(coverPath, `images/${coverFilename}`);
        return `images/${coverFilename}`;
    }

    /**
     * Update HTML content by extracting and renaming images
     * Requirement: 7.2 - Extract and save all images to images folder
     */
    private async updateHtmlContent(
        content: string,
        volSlug: string,
        chapterIndex: number,
        chapterItemHref: string
    ): Promise<string> {
        if (!content || !this.zip) return '';

        const $ = cheerio.load(content, { xmlMode: false });

        // Get base path for resolving relative image paths
        const chapterBasePath = chapterItemHref.includes('/')
            ? chapterItemHref.substring(0, chapterItemHref.lastIndexOf('/') + 1)
            : '';

        const images = $('img').toArray();
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const src = $(img).attr('src');
            if (!src) {
                $(img).remove();
                continue;
            }

            // Resolve relative path
            let imagePath = src;
            if (!src.startsWith('/') && !src.startsWith('http')) {
                imagePath = chapterBasePath + src;
            }
            // Normalize path (remove ./ and resolve ..)
            imagePath = imagePath.replace(/^\.\//, '');

            // Check if already processed
            if (this.imageMap.has(imagePath)) {
                $(img).attr('src', this.imageMap.get(imagePath)!);
                continue;
            }

            // Try to find the image in the EPUB
            const fullImagePath = this.opfBasePath + imagePath;
            let imageData = await this.zip.file(fullImagePath)?.async('nodebuffer');

            // Try without opfBasePath if not found
            if (!imageData) {
                imageData = await this.zip.file(imagePath)?.async('nodebuffer');
            }

            // Try to find by basename
            if (!imageData) {
                const srcBasename = basename(imagePath);
                for (const item of this.manifest.values()) {
                    if (item.mediaType.startsWith('image/') && basename(item.href) === srcBasename) {
                        const itemPath = this.opfBasePath + item.href;
                        imageData = await this.zip.file(itemPath)?.async('nodebuffer');
                        if (imageData) break;
                    }
                }
            }

            if (!imageData) {
                console.warn(`Could not find image: ${src} in chapter ${chapterIndex}`);
                $(img).remove();
                continue;
            }

            // Determine extension
            let ext = extname(imagePath).toLowerCase().slice(1);
            if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                ext = 'jpeg';
            }

            // Save image with consistent naming
            const newFilename = `${volSlug}_chap_${chapterIndex}_img_${i}.${ext}`;
            const newFilePath = join(this.imagesDir, newFilename);
            await writeFile(newFilePath, imageData);

            const newSrcPath = `images/${newFilename}`;
            $(img).attr('src', newSrcPath);
            this.imageMap.set(imagePath, newSrcPath);
        }

        return $.html() || '';
    }


    /**
     * Process a chapter item into ChapterContent
     * Requirement: 7.4, 7.5 - Generate JSON files and process content
     */
    private async processChapterItem(
        itemHref: string,
        tocTitle: string,
        volSlug: string,
        chapterIndex: number
    ): Promise<ChapterContent | null> {
        if (!this.zip) return null;

        const fullPath = this.opfBasePath + itemHref;
        const content = await this.zip.file(fullPath)?.async('string');
        if (!content) return null;

        // Parse to get title if not provided
        let title = tocTitle;
        if (!title) {
            const $ = cheerio.load(content, { xmlMode: false });
            const titleTag = $('h1, h2, h3').first();
            title = titleTag.text().trim() || `Chapter ${chapterIndex + 1}`;
        }

        // Check if this is a cover or TOC page (skip)
        const $ = cheerio.load(content, { xmlMode: false });
        const textLen = $.text().trim().length;

        if (textLen < 100 && title.toLowerCase().includes('cover')) {
            return null;
        }
        if (textLen < 50 && ['toc', 'contents', 'mục lục'].some(t => title.toLowerCase().includes(t))) {
            return null;
        }

        // Update image paths
        const updatedContent = await this.updateHtmlContent(content, volSlug, chapterIndex, itemHref);

        // Extract body content
        const $updated = cheerio.load(updatedContent, { xmlMode: false });
        const body = $updated('body');
        let bodyContent: string;
        if (body.length) {
            bodyContent = body.html() || '';
        } else {
            bodyContent = updatedContent;
        }

        // Process footnotes
        const chapterSlug = `${volSlug}_chap_${chapterIndex}`;
        const contentWithNotes = this.contentProcessor.processFootnotes(bodyContent, chapterSlug);

        // Clean up HTML
        const finalContent = this.contentProcessor.cleanHtml(contentWithNotes);

        return {
            title,
            url: '',
            content: finalContent,
            index: chapterIndex,
        };
    }

    /**
     * Build volume definitions from TOC
     * Requirement: 7.3 - Parse table of contents for volume/chapter structure
     */
    private buildVolumeDefinitions(): VolumeDefinition[] {
        const volumes: VolumeDefinition[] = [];

        // Check if TOC has nested structure (multi-volume)
        const hasNestedToc = this.toc.some(entry => entry.children && entry.children.length > 0);

        if (hasNestedToc) {
            let order = 0;
            for (const entry of this.toc) {
                if (entry.children && entry.children.length > 0) {
                    const hrefs = new Set<string>();
                    for (const child of entry.children) {
                        if (child.href) hrefs.add(child.href);
                    }
                    if (hrefs.size > 0) {
                        let name = entry.title;
                        if (this.cleanVolumeName) {
                            name = this.cleanVolumeName(name);
                        }
                        volumes.push({ name, order: order++, hrefs });
                    }
                }
            }
        }

        // If no nested structure or no volumes found, treat as single volume
        if (volumes.length === 0) {
            const hrefs = new Set<string>();
            const collectHrefs = (entries: TocEntry[]) => {
                for (const entry of entries) {
                    if (entry.href) hrefs.add(entry.href);
                    if (entry.children) collectHrefs(entry.children);
                }
            };
            collectHrefs(this.toc);

            if (hrefs.size > 0) {
                volumes.push({ name: this.novelName, order: 0, hrefs });
            }
        }

        return volumes;
    }

    /**
     * Get ordered chapter hrefs from spine for a volume
     */
    private getOrderedChapterHrefs(volumeHrefs: Set<string>, processedHrefs: Set<string>): string[] {
        const orderedHrefs: string[] = [];

        // Get hrefs in spine order
        for (const itemId of this.spine) {
            const item = this.manifest.get(itemId);
            if (item && volumeHrefs.has(item.href) && !processedHrefs.has(item.href)) {
                orderedHrefs.push(item.href);
            }
        }

        // If spine order didn't work, use TOC order
        if (orderedHrefs.length === 0) {
            for (const href of volumeHrefs) {
                if (!processedHrefs.has(href)) {
                    orderedHrefs.push(href);
                }
            }
        }

        return orderedHrefs;
    }

    /**
     * Main deconstruction method
     * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
     */
    async deconstruct(): Promise<void> {
        console.log(`Loading EPUB: ${this.epubPath}`);
        await this.loadEpub();

        // Set up directories
        this.saveDir = join(this.outputDir, formatFilename(this.novelName));
        this.imagesDir = join(this.saveDir, 'images');
        await ensureDir(this.saveDir);
        await ensureDir(this.imagesDir);

        console.log(`Deconstructing '${this.novelName}'...`);
        console.log(`Output directory: ${this.saveDir}`);

        // Extract metadata
        const metadata = await this.extractFullMetadata();

        // Extract cover
        const coverPath = await this.extractCover();

        // Build volume definitions from TOC
        const volumeDefinitions = this.buildVolumeDefinitions();

        if (volumeDefinitions.length === 0) {
            console.warn('No volumes found in TOC. Falling back to spine order.');
            // Create single volume from all spine items
            const hrefs = new Set<string>();
            for (const itemId of this.spine) {
                const item = this.manifest.get(itemId);
                if (item && item.mediaType === 'application/xhtml+xml') {
                    hrefs.add(item.href);
                }
            }
            volumeDefinitions.push({ name: this.novelName, order: 0, hrefs });
        }

        // Process volumes
        const processedHrefs = new Set<string>();
        const volumeMetadataList: VolumeMetadata[] = [];
        const finalVolumes: Array<{ name: string; order: number; chapters: ChapterContent[] }> = [];

        for (const volDef of volumeDefinitions) {
            const volSlug = formatFilename(volDef.name).toLowerCase();
            const orderedHrefs = this.getOrderedChapterHrefs(volDef.hrefs, processedHrefs);

            if (orderedHrefs.length === 0) continue;

            console.log(`Processing volume: ${volDef.name}`);
            const volumeChapters: ChapterContent[] = [];

            // Build title map from TOC
            const titleMap = new Map<string, string>();
            const buildTitleMap = (entries: TocEntry[]) => {
                for (const entry of entries) {
                    if (entry.href) titleMap.set(entry.href, entry.title);
                    if (entry.children) buildTitleMap(entry.children);
                }
            };
            buildTitleMap(this.toc);

            for (let i = 0; i < orderedHrefs.length; i++) {
                const href = orderedHrefs[i];
                const tocTitle = titleMap.get(href) || '';

                const chapterData = await this.processChapterItem(href, tocTitle, volSlug, i);
                if (chapterData) {
                    volumeChapters.push(chapterData);
                }
                processedHrefs.add(href);
            }

            if (volumeChapters.length > 0) {
                finalVolumes.push({
                    name: volDef.name,
                    order: volDef.order,
                    chapters: volumeChapters,
                });
            }
        }

        // Create JSON files
        console.log(`Found ${finalVolumes.length} volumes.`);

        for (const vol of finalVolumes) {
            // Re-index chapters
            for (let i = 0; i < vol.chapters.length; i++) {
                vol.chapters[i].index = i;
            }

            const volumeData: VolumeData = {
                volumeName: vol.name,
                volumeUrl: '',
                coverImageLocal: '',
                chapters: vol.chapters,
            };

            const volFilename = formatFilename(vol.name) + '.json';
            const volPath = join(this.saveDir, volFilename);
            await writeJson(volPath, volumeData);
            console.log(`Saved volume data to ${volPath}`);

            volumeMetadataList.push({
                order: vol.order,
                name: vol.name,
                filename: volFilename,
                url: '',
            });
        }

        // Create metadata.json
        const fullMetadata: NovelMetadata = {
            ...metadata,
            coverImageLocal: coverPath,
            volumes: volumeMetadataList,
        };

        const metaPath = join(this.saveDir, 'metadata.json');
        await writeJson(metaPath, fullMetadata);
        console.log(`Saved metadata to ${metaPath}`);

        console.log(`\nSuccessfully deconstructed EPUB into '${this.saveDir}'`);
    }

    /**
     * Get the output directory path
     */
    getOutputDir(): string {
        return this.saveDir;
    }

    /**
     * Get the novel name extracted from the EPUB
     */
    getNovelName(): string {
        return this.novelName;
    }
}
