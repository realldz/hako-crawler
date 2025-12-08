/**
 * Represents a single chapter in a volume
 */
export interface Chapter {
    name: string;
    url: string;
}
/**
 * Represents a volume in a light novel
 */
export interface Volume {
    url: string;
    name: string;
    coverImg: string;
    chapters: Chapter[];
}
/**
 * Represents a complete light novel with all its metadata and volumes
 */
export interface LightNovel {
    name: string;
    url: string;
    author: string;
    summary: string;
    mainCover: string;
    tags: string[];
    volumes: Volume[];
}
/**
 * Represents the content of a downloaded chapter
 */
export interface ChapterContent {
    title: string;
    url: string;
    content: string;
    index: number;
}
/**
 * Represents downloaded volume data with all chapters
 */
export interface VolumeData {
    volumeName: string;
    volumeUrl: string;
    coverImageLocal: string;
    chapters: ChapterContent[];
}
/**
 * Metadata for a single volume in the metadata.json file
 */
export interface VolumeMetadata {
    order: number;
    name: string;
    filename: string;
    url: string;
}
/**
 * Complete novel metadata stored in metadata.json
 */
export interface NovelMetadata {
    novelName: string;
    author: string;
    tags: string[];
    summary: string;
    coverImageLocal: string;
    url: string;
    volumes: VolumeMetadata[];
}
/**
 * Options for downloading volumes
 */
export interface DownloadOptions {
    baseFolder: string;
    onProgress?: (current: number, total: number) => void;
}
/**
 * Options for EPUB generation
 */
export interface EpubOptions {
    compressImages: boolean;
    outputDir?: string;
}
/**
 * Options for EPUB deconstruction
 */
export interface DeconstructOptions {
    outputDir?: string;
    cleanVolumeName?: (name: string) => string;
}
/**
 * Options for network fetch operations
 */
export interface FetchOptions {
    headers?: Record<string, string>;
    timeout?: number;
}
/**
 * Result of a parse operation
 */
export type ParseResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number) => void;
//# sourceMappingURL=index.d.ts.map