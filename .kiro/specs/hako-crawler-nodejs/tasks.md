# Implementation Plan

- [x] 1. Project Setup & Configuration

  - [x] 1.1 Initialize Bun project with TypeScript

    - Create package.json with dual entry points (main for module, bin for CLI)
    - Configure tsconfig.json for ES modules and strict mode
    - Set up project directory structure (src/, tests/, bin/)
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Install dependencies

    - Add runtime dependencies: cheerio, sharp, @inquirer/prompts, commander, ora, chalk
    - Add dev dependencies: typescript, vitest, fast-check, @types/node
    - _Requirements: 1.4_

  - [x] 1.3 Create type definitions

    - Define all interfaces in src/types/index.ts (LightNovel, Volume, Chapter, etc.)
    - Export types from main entry point
    - _Requirements: 1.5, 9.6_

- [x] 2. Core Utilities & Constants

  - [x] 2.1 Implement constants module

    - Create src/config/constants.ts with DOMAINS, IMAGE_DOMAINS, HEADERS, PATHS
    - _Requirements: 3.2, 3.6_

  - [x] 2.2 Implement utility functions

    - Create src/utils/text.ts with formatFilename, reformatUrl
    - Create src/utils/fs.ts with ensureDir, readJson, writeJson
    - _Requirements: 10.1, 10.2_

  - [x]\* 2.3 Write property test for formatFilename

    - **Property 8: Image Naming Convention**
    - **Validates: Requirements 4.6**

- [x] 3. Network Manager

  - [x] 3.1 Implement NetworkManager class

    - Create src/services/network.ts
    - Implement fetchWithRetry with exponential backoff (3 retries)
    - Implement domain rotation logic
    - Implement anti-ban pause every 100 requests
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 3.2 Implement downloadToFile method

    - Stream download for large files
    - Skip if file exists with non-zero size
    - Handle external vs internal URLs
    - _Requirements: 3.3, 3.5, 3.6_

  - [x]\* 3.3 Write property tests for NetworkManager

    - **Property 4: Domain Classification Correctness**
    - **Property 5: Existing File Skip**
    - **Validates: Requirements 3.5, 3.6**

- [x] 4. Novel Parser

  - [x] 4.1 Implement NovelParser class

    - Create src/services/parser.ts
    - Parse novel page HTML using cheerio
    - Extract metadata: name, author, summary, cover, tags
    - Extract volumes with chapters
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Implement serialization functions

    - Create serializeNovel() for JSON output
    - Create deserializeNovel() for JSON parsing
    - _Requirements: 2.5, 2.6_

  - [x] 4.3 Implement error handling

    - Return descriptive errors for invalid URLs
    - Handle missing elements gracefully
    - _Requirements: 2.4_

  - [x]\* 4.4 Write property tests for parser

    - **Property 1: Novel Data Serialization Round-Trip**
    - **Property 2: HTML Parsing Extracts All Volumes**
    - **Property 3: Invalid URL Returns Error**
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

- [x] 5. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Content Processor

  - [x] 6.1 Implement ContentProcessor class

    - Create src/services/content-processor.ts
    - Implement cleanHtml() to remove unwanted elements
    - Implement sanitizeXhtml() for EPUB compatibility
    - _Requirements: 4.5_

  - [x] 6.2 Implement footnote processing

    - Extract footnote definitions from HTML
    - Convert inline markers to noteref links
    - Generate EPUB-compatible aside elements
    - Handle multiple footnote formats (Note:, [note1], etc.)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x]\* 6.3 Write property tests for ContentProcessor

    - **Property 7: HTML Cleaning Removes Unwanted Elements**
    - **Property 9: Footnote Extraction Completeness**
    - **Property 10: Footnote ID Uniqueness**
    - **Validates: Requirements 4.5, 5.1, 5.2, 5.3**

- [x] 7. Novel Downloader

  - [x] 7.1 Implement NovelDownloader class

    - Create src/services/downloader.ts
    - Implement createMetadataFile() to save novel metadata
    - Implement downloadVolume() with progress callback
    - _Requirements: 4.4, 10.3_

  - [x] 7.2 Implement chapter processing

    - Download and process chapter content
    - Download and rename chapter images
    - Handle footnotes in chapter content
    - _Requirements: 4.1, 4.6_

  - [x] 7.3 Implement caching logic

    - Validate cached chapters (check images exist)
    - Skip valid cached chapters
    - Re-download invalid/missing chapters
    - _Requirements: 4.2, 4.3_

  - [x]\* 7.4 Write property tests for Downloader

    - **Property 6: Cache Validation Checks Images**
    - **Validates: Requirements 4.2, 4.3**

- [x] 8. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. EPUB Builder

  - [x] 9.1 Implement EpubBuilder class

    - Create src/services/epub-builder.ts
    - Load metadata and volume data from JSON files
    - Set up EPUB structure with CSS styling
    - _Requirements: 6.1, 6.8_

  - [x] 9.2 Implement image processing

    - Process images with optional compression (sharp)
    - Convert to JPEG quality 75 when compress enabled
    - Preserve original format when compress disabled
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 9.3 Implement buildMerged method

    - Combine multiple volumes into single EPUB
    - Generate hierarchical table of contents
    - Create intro page with cover and metadata

    - _Requirements: 6.2, 6.7_

  - [x] 9.4 Implement buildVolume method
    - Create individual EPUB for single volume
    - Include volume-specific navigation
    - _Requirements: 6.3_
  - [x]\* 9.5 Write property tests for EpubBuilder

    - **Property 11: EPUB Contains All Volumes (Merged)**
    - **Property 12: Separate EPUB Count**
    - **Property 13: Image Compression Mode**
    - **Validates: Requirements 6.2, 6.3, 6.5, 6.6**

- [x] 10. EPUB Deconstructor

  - [x] 10.1 Implement EpubDeconstructor class

    - Create src/services/epub-deconstructor.ts
    - Read EPUB file and extract metadata
    - Parse table of contents for volume/chapter structure
    - _Requirements: 7.1, 7.3_

  - [x] 10.2 Implement content extraction

    - Extract and save all images to images folder
    - Process chapter content with HTML cleanup
    - Generate JSON files matching download format
    - _Requirements: 7.2, 7.4, 7.5_

  - [x]\* 10.3 Write property tests for EpubDeconstructor

    - **Property 14: EPUB Deconstruction Extracts All Images**
    - **Property 15: Deconstruction Output Format Consistency**
    - **Validates: Requirements 7.2, 7.4**

- [x] 11. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Module API

  - [x] 12.1 Create public API entry point

    - Update src/index.ts with all exports
    - Export parseNovel, downloadVolume, buildEpub, deconstructEpub functions
    - Re-export NetworkManager, NovelParser, EpubBuilder, EpubDeconstructor classes
    - Re-export serializeNovel, deserializeNovel utility functions
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]\* 12.2 Write property test for API exports

    - **Property 16: Metadata JSON Schema Compliance**
    - **Property 17: Books List Update**
    - **Validates: Requirements 10.3, 10.6**

- [x] 13. CLI Application

  - [x] 13.1 Implement CLI entry point

    - Create src/bin/cli.ts with commander setup
    - Accept URL as optional argument
    - Wire up to Application class
    - _Requirements: 8.6_

  - [x] 13.2 Implement Application class

    - Create src/cli/app.ts
    - Implement main menu with @inquirer/prompts
    - Handle action selection (Download, Build EPUB, Deconstruct, Full Process, Batch)
    - Use chalk for colored output and ora for spinners
    - _Requirements: 8.1_

  - [x] 13.3 Implement download workflow
    - Prompt for novel URL if not provided
    - Volume selection with checkboxes
    - Progress display with ora spinner
    - _Requirements: 8.2, 8.5_
  - [x] 13.4 Implement build workflow

    - Mode selection (merged/separate)
    - Image quality selection (optimized/original)
    - Volume selection for building
    - _Requirements: 8.3, 8.4_

  - [x] 13.5 Implement deconstruct workflow
    - List EPUB files from input directory
    - Interactive volume name cleaning
    - _Requirements: 7.1_

- [x] 14. Books List Management

  - [x] 14.1 Implement books list functions

    - Create readBooksList, writeBooksList, addBookToList in src/utils/books.ts
    - Maintain books.json file
    - _Requirements: 10.6_

- [x] 15. Final Integration & Polish

  - [x] 15.1 Configure package.json for publishing
    - Set up bin entry for CLI (already configured: "hako-crawler": "./dist/bin/cli.js")
    - Configure exports for module usage (already configured)
    - Add scripts for build, test, lint (already configured)
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 15.2 Create README documentation

    - Document CLI usage
    - Document module API with examples
    - _Requirements: 1.1_

- [x] 16. Final Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.
