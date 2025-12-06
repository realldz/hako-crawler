# Design Document: hako-crawler-nodejs

## Overview

Chuyển đổi hako-crawler từ Python sang Node.js/TypeScript sử dụng Bun runtime. Dự án được thiết kế theo kiến trúc modular, hỗ trợ cả CLI và programmatic API. Sử dụng các thư viện hiện đại của Node.js ecosystem để đảm bảo hiệu suất và khả năng bảo trì.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Entry Points                             │
├─────────────────────────────────────────────────────────────────┤
│  CLI (bin/cli.ts)              │  Module API (src/index.ts)     │
│  - Interactive prompts         │  - parseNovel()                │
│  - Command-line args           │  - downloadVolume()            │
│  - Progress display            │  - buildEpub()                 │
│                                │  - deconstructEpub()           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Services                             │
├─────────────────────────────────────────────────────────────────┤
│  NovelParser      │  Downloader       │  EpubBuilder            │
│  - parseNovelPage │  - downloadChapter│  - buildMerged          │
│  - extractVolumes │  - downloadImage  │  - buildVolume          │
│  - extractChapters│  - validateCache  │  - processImages        │
├───────────────────┼───────────────────┼─────────────────────────┤
│  EpubDeconstructor│  ContentProcessor │  NetworkManager         │
│  - extractMetadata│  - cleanHtml      │  - fetchWithRetry       │
│  - extractChapters│  - processFootnotes│ - downloadStream       │
│  - extractImages  │  - sanitizeXhtml  │  - domainRotation       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  Models (types/)   │  Storage (utils/) │  Constants (config/)   │
│  - LightNovel      │  - readJson       │  - DOMAINS             │
│  - Volume          │  - writeJson      │  - HEADERS             │
│  - Chapter         │  - ensureDir      │  - PATHS               │
│  - Metadata        │  - formatFilename │                        │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Type Definitions (`src/types/index.ts`)

```typescript
export interface Chapter {
  name: string;
  url: string;
}

export interface Volume {
  url: string;
  name: string;
  coverImg: string;
  chapters: Chapter[];
}

export interface LightNovel {
  name: string;
  url: string;
  author: string;
  summary: string;
  mainCover: string;
  tags: string[];
  volumes: Volume[];
}

export interface ChapterContent {
  title: string;
  url: string;
  content: string;
  index: number;
}

export interface VolumeData {
  volumeName: string;
  volumeUrl: string;
  coverImageLocal: string;
  chapters: ChapterContent[];
}

export interface NovelMetadata {
  novelName: string;
  author: string;
  tags: string[];
  summary: string;
  coverImageLocal: string;
  url: string;
  volumes: VolumeMetadata[];
}

export interface VolumeMetadata {
  order: number;
  name: string;
  filename: string;
  url: string;
}

export interface DownloadOptions {
  baseFolder: string;
  onProgress?: (current: number, total: number) => void;
}

export interface EpubOptions {
  compressImages: boolean;
  outputDir?: string;
}

export interface DeconstructOptions {
  outputDir?: string;
  cleanVolumeName?: (name: string) => string;
}
```

### 2. Network Manager (`src/services/network.ts`)

```typescript
export class NetworkManager {
  private requestCount: number = 0;
  private readonly domains: string[];
  private readonly imageDomains: string[];
  private readonly headers: Record<string, string>;

  async fetchWithRetry(url: string, options?: FetchOptions): Promise<Response>;
  async downloadToFile(url: string, savePath: string): Promise<boolean>;
  isInternalDomain(url: string): boolean;
  private rotateDomainsAndRetry(
    path: string,
    isImage: boolean
  ): Promise<Response>;
  private applyAntiBan(): Promise<void>;
}
```

### 3. Novel Parser (`src/services/parser.ts`)

```typescript
export class NovelParser {
  constructor(private network: NetworkManager);

  async parse(url: string): Promise<LightNovel>;
  private extractMetadata(document: Document): Partial<LightNovel>;
  private extractVolumes(document: Document, baseUrl: string): Volume[];
  private extractChapters(volumeElement: Element, baseUrl: string): Chapter[];
}

// Pretty printer for serialization
export function serializeNovel(novel: LightNovel): string;
export function deserializeNovel(json: string): LightNovel;
```

### 4. Downloader (`src/services/downloader.ts`)

```typescript
export class NovelDownloader {
  constructor(
    private novel: LightNovel,
    private baseFolder: string,
    private network: NetworkManager
  );

  async createMetadataFile(): Promise<void>;
  async downloadVolume(
    volume: Volume,
    options?: DownloadOptions
  ): Promise<void>;
  private processChapter(
    index: number,
    chapter: Chapter,
    imgPrefix: string
  ): Promise<ChapterContent | null>;
  private validateCachedChapter(chapterData: ChapterContent): boolean;
  private downloadChapterImages(
    content: Document,
    imgPrefix: string,
    chapterIndex: number
  ): Promise<void>;
}
```

### 5. Content Processor (`src/services/content-processor.ts`)

```typescript
export class ContentProcessor {
  cleanHtml(html: string): string;
  processFootnotes(html: string, chapterSlug: string): string;
  sanitizeXhtml(html: string): string;

  private extractFootnoteDefinitions(document: Document): Map<string, string>;
  private convertFootnoteMarkers(
    html: string,
    footnoteMap: Map<string, string>
  ): string;
  private generateFootnoteAsides(
    usedNotes: string[],
    footnoteMap: Map<string, string>
  ): string;
}
```

### 6. EPUB Builder (`src/services/epub-builder.ts`)

```typescript
export class EpubBuilder {
  constructor(private baseFolder: string, private options: EpubOptions);

  async buildMerged(jsonFiles: string[]): Promise<string>;
  async buildVolume(jsonFile: string): Promise<string>;

  private processImage(
    relPath: string
  ): Promise<{ item: EpubItem | null; newPath: string }>;
  private makeIntroPage(
    volName: string
  ): Promise<{ page: EpubHtml; coverItem: EpubItem | null }>;
  private getOutputPath(filename: string, isMerged: boolean): string;
}
```

### 7. EPUB Deconstructor (`src/services/epub-deconstructor.ts`)

```typescript
export class EpubDeconstructor {
  constructor(epubPath: string, options?: DeconstructOptions);

  async deconstruct(): Promise<void>;

  private extractMetadata(): NovelMetadata;
  private extractCover(): Promise<string>;
  private processChapterItem(
    item: EpubItem,
    tocTitle: string,
    volSlug: string,
    index: number
  ): ChapterContent | null;
  private updateHtmlContent(
    content: string,
    volSlug: string,
    chapterIndex: number
  ): string;
}
```

### 8. CLI Application (`src/cli/app.ts`)

```typescript
export class Application {
  constructor(private cliUrl?: string);

  async run(): Promise<void>;

  private showMainMenu(): Promise<string>;
  private handleDownload(): Promise<void>;
  private handleBuildEpub(): Promise<void>;
  private handleDeconstruct(): Promise<void>;
  private handleFullProcess(): Promise<void>;
  private handleBatchBuild(): Promise<void>;
}
```

### 9. Public Module API (`src/index.ts`)

```typescript
// Re-export types
export * from './types';

// Main API functions
export async function parseNovel(url: string): Promise<LightNovel>;
export async function downloadNovel(
  url: string,
  options?: DownloadOptions
): Promise<void>;
export async function downloadVolume(
  novel: LightNovel,
  volume: Volume,
  options?: DownloadOptions
): Promise<void>;
export async function buildEpub(
  dataPath: string,
  options?: EpubOptions
): Promise<string[]>;
export async function deconstructEpub(
  epubPath: string,
  options?: DeconstructOptions
): Promise<void>;

// Utility exports
export { NetworkManager } from './services/network';
export {
  NovelParser,
  serializeNovel,
  deserializeNovel,
} from './services/parser';
export { EpubBuilder } from './services/epub-builder';
export { EpubDeconstructor } from './services/epub-deconstructor';
```

## Data Models

### Directory Structure

```
project-root/
├── data/
│   └── <novel-name>/
│       ├── metadata.json
│       ├── <volume-1>.json
│       ├── <volume-2>.json
│       └── images/
│           ├── main_cover.jpg
│           ├── vol_cover_<volume>.jpg
│           └── <volume>_chap_<n>_img_<m>.jpg
├── result/
│   ├── <Novel_Name_Full>.epub          # Merged + Original
│   └── <Novel_Name>/
│       ├── compressed/
│       │   └── <Volume> - <Novel>.epub
│       └── original/
│           └── <Volume> - <Novel>.epub
├── input/                               # For EPUB deconstruction
│   └── *.epub
└── books.json                           # Track downloaded novels
```

### JSON Schemas

**metadata.json:**

```json
{
  "novelName": "string",
  "author": "string",
  "tags": ["string"],
  "summary": "string (HTML)",
  "coverImageLocal": "images/main_cover.jpg",
  "url": "string",
  "volumes": [
    {
      "order": 1,
      "name": "Volume 1",
      "filename": "Volume_1.json",
      "url": "string"
    }
  ]
}
```

**<volume>.json:**

```json
{
  "volumeName": "string",
  "volumeUrl": "string",
  "coverImageLocal": "images/vol_cover_<name>.jpg",
  "chapters": [
    {
      "title": "string",
      "url": "string",
      "content": "string (HTML)",
      "index": 0
    }
  ]
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following properties have been identified after eliminating redundancy:

### Property 1: Novel Data Serialization Round-Trip

_For any_ valid LightNovel object, serializing it to JSON using `serializeNovel()` and then deserializing using `deserializeNovel()` should produce an equivalent LightNovel object.
**Validates: Requirements 2.5, 2.6**

### Property 2: HTML Parsing Extracts All Volumes

_For any_ valid Hako novel page HTML containing N volumes, the parser should extract exactly N Volume objects with non-empty names.
**Validates: Requirements 2.2, 2.3**

### Property 3: Invalid URL Returns Error

_For any_ malformed URL or URL pointing to non-existent resource, the parser should return/throw a descriptive error rather than returning partial data.
**Validates: Requirements 2.4**

### Property 4: Domain Classification Correctness

_For any_ URL string, `isInternalDomain()` should return true if and only if the URL's domain matches one of the configured Hako domains or image domains.
**Validates: Requirements 3.6**

### Property 5: Existing File Skip

_For any_ image URL where the target file already exists with size > 0, `downloadToFile()` should return true without making a network request.
**Validates: Requirements 3.5**

### Property 6: Cache Validation Checks Images

_For any_ cached chapter containing image references, `validateCachedChapter()` should return false if any referenced image file is missing or has zero size.
**Validates: Requirements 4.2, 4.3**

### Property 7: HTML Cleaning Removes Unwanted Elements

_For any_ HTML string containing comments, hidden divs (class="d-none"), or ad elements, `cleanHtml()` should return HTML without those elements while preserving main content.
**Validates: Requirements 4.5**

### Property 8: Image Naming Convention

_For any_ downloaded chapter image, the filename should match the pattern `{volumeSlug}_chap_{chapterIndex}_img_{imageIndex}.{ext}`.
**Validates: Requirements 4.6**

### Property 9: Footnote Extraction Completeness

_For any_ HTML containing footnote definitions (div with id matching /note\d+/), `processFootnotes()` should extract all definitions and convert corresponding markers to noteref links.
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: Footnote ID Uniqueness

_For any_ processed chapter, all generated footnote aside elements should have unique IDs within that chapter.
**Validates: Requirements 5.3**

### Property 11: EPUB Contains All Volumes (Merged)

_For any_ set of N volume JSON files passed to `buildMerged()`, the resulting EPUB should contain exactly N volume sections in its table of contents.
**Validates: Requirements 6.2**

### Property 12: Separate EPUB Count

_For any_ list of N volume JSON files, calling `buildVolume()` for each should produce exactly N EPUB files.
**Validates: Requirements 6.3**

### Property 13: Image Compression Mode

_For any_ image processed with `compressImages: true`, the output should be JPEG format. _For any_ image processed with `compressImages: false`, the output should preserve the original format.
**Validates: Requirements 6.5, 6.6**

### Property 14: EPUB Deconstruction Extracts All Images

_For any_ EPUB file containing N images, deconstruction should save exactly N image files to the images directory.
**Validates: Requirements 7.2**

### Property 15: Deconstruction Output Format Consistency

_For any_ deconstructed EPUB, the generated JSON files should conform to the same schema as downloaded content (VolumeData interface).
**Validates: Requirements 7.4**

### Property 16: Metadata JSON Schema Compliance

_For any_ downloaded novel, the generated metadata.json should contain all required fields: novelName, author, tags, summary, coverImageLocal, url, and volumes array.
**Validates: Requirements 10.3**

### Property 17: Books List Update

_For any_ newly downloaded novel, the books.json file should contain the novel's folder name after download completes.
**Validates: Requirements 10.6**

## Error Handling

### Network Errors

- **Retry Strategy**: Exponential backoff with 3 retries (delays: 1s, 2s, 4s)
- **Domain Rotation**: On failure, try next domain in list before retrying
- **Timeout**: 30 seconds per request
- **Anti-Ban**: 30-second pause every 100 requests

### File System Errors

- **Missing Directory**: Auto-create with `fs.mkdir({ recursive: true })`
- **Corrupt JSON**: Log warning and treat as cache miss
- **Corrupt Image**: Delete file and mark for re-download

### Parsing Errors

- **Missing Elements**: Return null/undefined for optional fields
- **Invalid HTML**: Use lenient parser (cheerio with xmlMode: false)
- **Encoding Issues**: Default to UTF-8, handle BOM

## Testing Strategy

### Unit Testing Framework

- **Framework**: Vitest (Bun-compatible, fast, TypeScript-native)
- **Mocking**: Built-in vi.mock for network and file system
- **Coverage**: Target 80% line coverage for core services

### Property-Based Testing

- **Framework**: fast-check
- **Focus Areas**:
  - Serialization round-trips (Property 1)
  - HTML parsing (Properties 2, 7, 9)
  - Domain classification (Property 4)
  - File naming conventions (Property 8)
  - ID uniqueness (Property 10)

### Test Organization

```
tests/
├── unit/
│   ├── parser.test.ts
│   ├── network.test.ts
│   ├── content-processor.test.ts
│   ├── epub-builder.test.ts
│   └── epub-deconstructor.test.ts
├── properties/
│   ├── serialization.prop.ts
│   ├── parsing.prop.ts
│   ├── footnotes.prop.ts
│   └── epub.prop.ts
├── fixtures/
│   ├── sample-novel-page.html
│   ├── sample-chapter.html
│   └── sample-metadata.json
└── integration/
    └── full-workflow.test.ts
```

### Key Test Scenarios

1. **Parser Tests**

   - Parse valid novel page → extract all metadata
   - Parse page with missing elements → handle gracefully
   - Parse various volume/chapter structures

2. **Network Tests**

   - Successful request → return response
   - Failed request → retry with backoff
   - Domain unavailable → rotate to next domain

3. **Content Processor Tests**

   - Clean HTML with ads → remove ads
   - Process footnotes → convert to EPUB format
   - Sanitize XHTML → valid output

4. **EPUB Builder Tests**

   - Build merged → single file with all volumes
   - Build separate → one file per volume
   - Compress images → JPEG output
   - Original images → preserve format

5. **Property Tests**
   - Round-trip serialization
   - Footnote ID uniqueness
   - Image naming convention

## Dependencies

```json
{
  "dependencies": {
    "cheerio": "^1.0.0",
    "epub-gen-memory": "^1.0.0",
    "sharp": "^0.33.0",
    "@inquirer/prompts": "^5.0.0",
    "commander": "^12.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "fast-check": "^3.0.0",
    "@types/node": "^20.0.0"
  }
}
```
