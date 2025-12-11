# hako-crawler

A Node.js/Bun tool to download light novels from Hako websites (docln.net, ln.hako.vn, docln.sbs) and convert them into EPUB format for offline reading.

## Features

- **Dual Mode**: Use as CLI application or import as a module in your projects
- **Interactive CLI**: Guides you through selecting novels and volumes to download
- **EPUB Generation**: Converts downloaded content into well-formatted EPUB 3.0 files
- **Flexible Build Options**:
  - **Merged EPUB**: Combine all volumes into a single file
  - **Separate EPUBs**: Create individual files for each volume
  - **Image Compression**: Optional JPEG compression for smaller file sizes
- **Smart Caching**: Saves downloaded chapters locally, re-downloads only if data is missing or incomplete
- **Image & Footnote Handling**: Downloads and embeds images, processes footnotes for clean reading
- **EPUB Deconstruction**: Extract content from existing EPUBs for editing and rebuilding
- **Resilient Networking**: Automatic retries with exponential backoff and domain rotation
- **Proxy Support**: Route requests through HTTP or SOCKS5 proxies with multi-proxy failover

## Installation

```bash
# Using bun (recommended)
bun install

# Using npm
npm install
```

## CLI Usage

### Run directly with Bun

```bash
# Interactive mode
bun run dev

# With URL argument
bun run dev "https://docln.net/truyen/12345"

# With proxy
bun run dev --proxy "http://proxy.example.com:8080"

# With multiple proxies (round-robin with failover)
bun run dev --proxy "http://proxy1.com:8080,socks5://proxy2.com:1080"

# Verbose mode (shows proxy info)
bun run dev --proxy "http://proxy.example.com:8080" --verbose
```

### Build and run

```bash
# Build the project
bun run build

# Run the CLI
bun run start
```

### Available Actions

1. **Download (Create JSONs)** - Download novel chapters and save as JSON
2. **Build EPUB (From JSONs)** - Generate EPUB files from downloaded data
3. **Deconstruct EPUB** - Extract content from existing EPUB files
4. **Full Process** - Download and build EPUB in one step
5. **Batch Build** - Build EPUBs for all novels in books.json

## Module API

Use hako-crawler as a library in your Node.js/Bun projects:

```typescript
import {
  parseNovel,
  downloadVolume,
  buildEpub,
  deconstructEpub,
} from 'hako-crawler';

// Parse novel information
const result = await parseNovel('https://docln.net/truyen/12345');
if (result.success) {
  console.log(result.data.name);
  console.log(`Volumes: ${result.data.volumes.length}`);
}

// Download a specific volume
await downloadVolume(result.data, result.data.volumes[0], {
  onProgress: (current, total) => console.log(`${current}/${total}`),
});

// Build EPUB
const epubPaths = await buildEpub('./data/my-novel', {
  compressImages: true,
  mode: 'merged', // or 'separate'
});

// Deconstruct an existing EPUB
await deconstructEpub('./input/novel.epub', {
  outputDir: './data',
});
```

### Using Proxy

```typescript
import { parseNovel, downloadVolume } from 'hako-crawler';

// Single proxy
const result = await parseNovel('https://docln.net/truyen/12345', {
  proxy: 'http://proxy.example.com:8080',
});

// Multiple proxies with round-robin and failover
const result = await parseNovel('https://docln.net/truyen/12345', {
  proxy: ['http://proxy1.example.com:8080', 'socks5://proxy2.example.com:1080'],
});

// Download with proxy
await downloadVolume(result.data, result.data.volumes[0], {
  proxy: 'socks5://proxy.example.com:1080',
  onProgress: (current, total) => console.log(`${current}/${total}`),
});
```

### Proxy Utilities

```typescript
import {
  isValidProxyUrl,
  parseProxyUrl,
  sanitizeForDisplay,
  ProxyPool,
} from 'hako-crawler';

// Validate proxy URL
isValidProxyUrl('http://proxy.example.com:8080'); // true
isValidProxyUrl('invalid-url'); // false

// Parse proxy URL
const config = parseProxyUrl('socks5://user:pass@proxy.com:1080');
// { protocol: 'socks5', host: 'proxy.com', port: 1080, username: 'user', password: 'pass' }

// Sanitize for display (removes credentials)
sanitizeForDisplay('http://user:pass@proxy.com:8080');
// 'http://proxy.com:8080/'

// Create proxy pool for advanced usage
const pool = new ProxyPool(['http://p1.com:8080', 'http://p2.com:8080']);
const proxy = pool.getNextProxy(); // Round-robin selection
```

### Exported Functions

| Function                                  | Description                          |
| ----------------------------------------- | ------------------------------------ |
| `parseNovel(url, options?)`               | Parse novel metadata from a Hako URL |
| `downloadVolume(novel, volume, options?)` | Download a specific volume           |
| `downloadNovel(novel, options?)`          | Download all volumes                 |
| `buildEpub(dataPath, options)`            | Generate EPUB files                  |
| `deconstructEpub(epubPath, options?)`     | Extract content from EPUB            |
| `isValidProxyUrl(url)`                    | Validate proxy URL format            |
| `parseProxyUrl(url)`                      | Parse proxy URL to config object     |
| `sanitizeForDisplay(url)`                 | Remove credentials from proxy URL    |

### Exported Classes

| Class               | Description                                     |
| ------------------- | ----------------------------------------------- |
| `NetworkManager`    | HTTP client with retry, rotation, and proxy     |
| `NovelParser`       | HTML parser for Hako pages                      |
| `NovelDownloader`   | Chapter and image downloader                    |
| `EpubBuilder`       | EPUB file generator                             |
| `EpubDeconstructor` | EPUB content extractor                          |
| `ContentProcessor`  | HTML cleaning and footnote processing           |
| `ProxyPool`         | Multi-proxy manager with round-robin & failover |
| `ProxyError`        | Proxy-specific error class                      |

### Utility Functions

| Function                 | Description                  |
| ------------------------ | ---------------------------- |
| `serializeNovel(novel)`  | Serialize LightNovel to JSON |
| `deserializeNovel(json)` | Parse JSON to LightNovel     |
| `readBooksList()`        | Read books.json              |
| `addBookToList(name)`    | Add book to books.json       |

## Directory Structure

```
project/
├── data/                    # Downloaded novel data
│   └── <novel-name>/
│       ├── metadata.json
│       ├── <volume>.json
│       └── images/
├── result/                  # Generated EPUB files
│   ├── <Novel_Full>.epub    # Merged + Original
│   └── <Novel>/
│       ├── compressed/
│       └── original/
├── input/                   # EPUBs for deconstruction
└── books.json               # List of downloaded novels
```

## Development

```bash
# Run tests
bun run test

# Type check
bun run lint

# Build
bun run build
```

## Requirements

- Bun >= 1.0 or Node.js >= 18
- TypeScript 5.x

## License

MIT
