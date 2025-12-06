# Requirements Document

## Introduction

Convert the hako-crawler tool from Python to Node.js (Bun runtime) to download light novels from Hako websites (docln.net, ln.hako.vn, docln.sbs) and convert them to EPUB format. The application should support both modes: running directly from CLI and using as a module in other projects.

## Glossary

- **Hako_Crawler**: The main system that performs downloading and converting light novels
- **Light_Novel**: Object containing information about a novel series (name, author, volumes, chapters)
- **Volume**: A volume in the novel series, containing multiple chapters
- **Chapter**: A chapter within a volume, containing HTML content and images
- **EPUB**: Standard e-book format
- **CLI_Mode**: Application mode running from command line with interactive interface
- **Module_Mode**: Mode for using as a library in other Node.js projects
- **Metadata**: Descriptive information about the novel (name, author, tags, summary, cover)
- **Smart_Cache**: Mechanism to store downloaded data to avoid re-downloading

## Requirements

### Requirement 1: Project Setup & Dual-Mode Architecture

**User Story:** As a developer, I want the project to support both CLI and module usage, so that I can use it standalone or integrate it into other projects.

#### Acceptance Criteria

1. THE Hako_Crawler SHALL expose a programmatic API that allows importing and using core functions as a Node.js module
2. THE Hako_Crawler SHALL provide a CLI entry point that can be executed directly using `bun run` or as a global command
3. WHEN the package is installed as a dependency THEN the Hako_Crawler SHALL allow importing specific functions without side effects
4. THE Hako_Crawler SHALL use TypeScript for type safety and better developer experience
5. THE Hako_Crawler SHALL define clear interfaces for all public APIs

### Requirement 2: Novel Information Parsing

**User Story:** As a user, I want to fetch novel information from Hako websites, so that I can see available volumes and chapters before downloading.

#### Acceptance Criteria

1. WHEN a user provides a valid Hako URL THEN the Hako_Crawler SHALL parse and return the novel name, author, summary, cover image, tags, and volume list
2. WHEN parsing a novel page THEN the Hako_Crawler SHALL extract all volumes with their names, cover images, and chapter lists
3. WHEN parsing chapter information THEN the Hako_Crawler SHALL extract chapter names and URLs for each volume
4. IF the provided URL is invalid or inaccessible THEN the Hako_Crawler SHALL return a descriptive error message
5. THE Hako_Crawler SHALL provide a pretty-printer function to serialize parsed novel data to JSON format
6. WHEN serializing novel data to JSON and parsing it back THEN the Hako_Crawler SHALL produce equivalent data structures

### Requirement 3: Network Management

**User Story:** As a user, I want reliable downloads that handle network issues gracefully, so that I don't lose progress due to temporary failures.

#### Acceptance Criteria

1. WHEN a request fails THEN the Hako_Crawler SHALL retry up to 3 times with exponential backoff
2. WHEN a domain is unavailable THEN the Hako_Crawler SHALL automatically try alternative domains from the configured list
3. WHEN downloading images THEN the Hako_Crawler SHALL support streaming to disk to handle large files efficiently
4. THE Hako_Crawler SHALL implement anti-ban measures by pausing after every 100 requests
5. IF an image already exists locally with non-zero size THEN the Hako_Crawler SHALL skip re-downloading that image
6. THE Hako_Crawler SHALL properly handle both internal Hako domains and external image URLs

### Requirement 4: Chapter Download & Caching

**User Story:** As a user, I want to download chapters with smart caching, so that I can resume interrupted downloads without re-fetching completed content.

#### Acceptance Criteria

1. WHEN downloading a chapter THEN the Hako_Crawler SHALL extract the main content, process images, and handle footnotes
2. WHEN a chapter is already cached and valid THEN the Hako_Crawler SHALL use the cached version instead of re-downloading
3. WHEN validating cached chapters THEN the Hako_Crawler SHALL verify that all referenced images exist locally
4. THE Hako_Crawler SHALL save chapter data as JSON files organized by volume
5. WHEN processing chapter content THEN the Hako_Crawler SHALL remove unwanted HTML elements (ads, hidden divs, comments)
6. THE Hako_Crawler SHALL download and rename chapter images with consistent naming convention

### Requirement 5: Footnote Processing

**User Story:** As a user, I want footnotes to be properly formatted in the EPUB, so that I can read translator notes without disrupting the main content.

#### Acceptance Criteria

1. WHEN processing chapter content THEN the Hako_Crawler SHALL detect and extract footnote definitions
2. THE Hako_Crawler SHALL convert inline footnote markers to EPUB-compatible noteref links
3. THE Hako_Crawler SHALL generate proper EPUB footnote aside elements with unique IDs
4. WHEN multiple footnote formats exist THEN the Hako_Crawler SHALL handle all common patterns (Note:, [note1], etc.)

### Requirement 6: EPUB Generation

**User Story:** As a user, I want to generate well-formatted EPUB files from downloaded content, so that I can read novels on my e-reader.

#### Acceptance Criteria

1. THE Hako_Crawler SHALL generate valid EPUB 3.0 files with proper metadata (title, author, language, tags)
2. WHEN building a merged EPUB THEN the Hako_Crawler SHALL combine multiple volumes into a single file with proper navigation
3. WHEN building separate EPUBs THEN the Hako_Crawler SHALL create individual files for each volume
4. THE Hako_Crawler SHALL embed images within the EPUB with proper content types
5. WHEN compress mode is enabled THEN the Hako_Crawler SHALL convert images to optimized JPEG (quality 75)
6. WHEN compress mode is disabled THEN the Hako_Crawler SHALL preserve original image formats
7. THE Hako_Crawler SHALL generate a table of contents with hierarchical volume/chapter structure
8. THE Hako_Crawler SHALL apply consistent CSS styling for readable content

### Requirement 7: EPUB Deconstruction

**User Story:** As a user, I want to extract content from existing EPUB files, so that I can edit or rebuild them with different settings.

#### Acceptance Criteria

1. WHEN deconstructing an EPUB THEN the Hako_Crawler SHALL extract metadata (title, author, description, tags)
2. THE Hako_Crawler SHALL extract and save all images from the EPUB to the images folder
3. THE Hako_Crawler SHALL parse the table of contents to identify volumes and chapters
4. THE Hako_Crawler SHALL generate JSON files in the same format as downloaded content
5. WHEN processing deconstructed content THEN the Hako_Crawler SHALL clean up HTML and process footnotes

### Requirement 8: CLI Interface

**User Story:** As a user, I want an interactive command-line interface, so that I can easily select novels and volumes to download.

#### Acceptance Criteria

1. THE Hako_Crawler SHALL provide an interactive menu to select actions (Download, Build EPUB, Deconstruct, Full Process)
2. WHEN downloading THEN the Hako_Crawler SHALL allow selecting specific volumes via checkbox interface
3. WHEN building EPUBs THEN the Hako_Crawler SHALL allow choosing between merged and separate modes
4. WHEN building EPUBs THEN the Hako_Crawler SHALL allow choosing image quality (optimized vs original)
5. THE Hako_Crawler SHALL display progress information during downloads and builds
6. THE Hako_Crawler SHALL accept a URL as command-line argument to skip the URL prompt

### Requirement 9: Module API

**User Story:** As a developer, I want a clean programmatic API, so that I can integrate hako-crawler functionality into my own applications.

#### Acceptance Criteria

1. THE Hako_Crawler SHALL export a `parseNovel(url)` function that returns novel information
2. THE Hako_Crawler SHALL export a `downloadVolume(novel, volume, options)` function for downloading specific volumes
3. THE Hako_Crawler SHALL export an `buildEpub(dataPath, options)` function for EPUB generation
4. THE Hako_Crawler SHALL export a `deconstructEpub(epubPath, options)` function for EPUB extraction
5. ALL exported functions SHALL return Promises and support async/await
6. THE Hako_Crawler SHALL export TypeScript type definitions for all public interfaces

### Requirement 10: Data Storage & File Organization

**User Story:** As a user, I want downloaded data to be organized consistently, so that I can easily find and manage my novel files.

#### Acceptance Criteria

1. THE Hako_Crawler SHALL store downloaded data in a `data/<novel-name>/` directory structure
2. THE Hako_Crawler SHALL store generated EPUBs in a `result/` directory with configurable subfolders
3. THE Hako_Crawler SHALL create a `metadata.json` file containing novel information and volume list
4. THE Hako_Crawler SHALL create separate JSON files for each volume containing chapter data
5. THE Hako_Crawler SHALL store images in a `data/<novel-name>/images/` subdirectory
6. THE Hako_Crawler SHALL maintain a `books.json` file tracking all downloaded novels
