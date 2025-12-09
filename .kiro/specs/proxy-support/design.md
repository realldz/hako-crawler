# Design Document: Proxy Support

## Overview

This design document describes the architecture and implementation approach for adding proxy support to the hako-crawler library. The implementation will extend the existing `NetworkManager` class to support routing HTTP requests through proxy servers, with support for multiple proxy protocols (HTTP, HTTPS, SOCKS5), authentication, multi-proxy pools with round-robin distribution, and automatic failover.

## Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        API["API Functions\nparseNovel, downloadVolume"]
        CLI["CLI\n--proxy argument"]
    end

    subgraph Network["Network Layer"]
        NM["NetworkManager"]
        PP["ProxyPool"]
        PV["ProxyValidator"]
    end

    subgraph Proxy["Proxy Connections"]
        HTTP["HTTP Proxy\nhttp://"]
        HTTPS["HTTPS Proxy\nhttps://"]
        SOCKS5["SOCKS5 Proxy\nsocks5://"]
        Direct["Direct Connection\nNo Proxy"]
    end

    subgraph External["External"]
        Hako["Hako Websites\ndocln.net, ln.hako.vn"]
    end

    API --> NM
    CLI --> API
    NM --> PP
    NM --> PV
    PP --> HTTP
    PP --> HTTPS
    PP --> SOCKS5
    NM --> Direct
    HTTP --> Hako
    HTTPS --> Hako
    SOCKS5 --> Hako
    Direct --> Hako
```

### Request Flow with Proxy Pool

```mermaid
sequenceDiagram
    participant Client
    participant NM as NetworkManager
    participant PP as ProxyPool
    participant Proxy1
    participant Proxy2
    participant Target as Hako Website

    Client->>NM: fetchWithRetry(url)
    NM->>PP: getNextProxy()
    PP-->>NM: Proxy1
    NM->>Proxy1: Request via Proxy1
    Proxy1--xNM: Connection Failed
    NM->>PP: getNextProxy()
    PP-->>NM: Proxy2
    NM->>Proxy2: Request via Proxy2
    Proxy2->>Target: Forward Request
    Target-->>Proxy2: Response
    Proxy2-->>NM: Response
    NM-->>Client: Response
```

## Components and Interfaces

### 1. Proxy Configuration Types (`src/types/index.ts`)

```typescript
/**
 * Supported proxy protocols
 */
type ProxyProtocol = 'http' | 'https' | 'socks5';

/**
 * Parsed proxy configuration
 */
interface ProxyConfig {
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * Proxy input - can be a single URL or array of URLs
 */
type ProxyInput = string | string[];

/**
 * Network manager options
 */
interface NetworkOptions {
  proxy?: ProxyInput;
  timeout?: number;
}
```

### 2. Proxy Validator (`src/utils/proxy.ts`)

Validates and parses proxy URLs.

```typescript
interface ProxyValidator {
  /**
   * Validates a proxy URL string
   * @returns true if valid, false otherwise
   */
  isValidProxyUrl(url: string): boolean;

  /**
   * Parses a proxy URL into ProxyConfig
   * @throws Error if URL is invalid
   */
  parseProxyUrl(url: string): ProxyConfig;

  /**
   * Sanitizes proxy URL for display (removes credentials)
   */
  sanitizeForDisplay(url: string): string;
}
```

### 3. Proxy Pool (`src/services/proxy-pool.ts`)

Manages multiple proxies with round-robin distribution and failover.

```typescript
interface ProxyPool {
  /**
   * Gets the next proxy in round-robin order
   */
  getNextProxy(): ProxyConfig | null;

  /**
   * Gets a different proxy than the one provided (for failover)
   */
  getAlternativeProxy(excludeIndex: number): ProxyConfig | null;

  /**
   * Returns the number of proxies in the pool
   */
  size(): number;

  /**
   * Returns all proxies (for iteration during failover)
   */
  getAllProxies(): ProxyConfig[];
}
```

### 4. Extended NetworkManager (`src/services/network.ts`)

Updated to support proxy configuration.

```typescript
interface NetworkManager {
  constructor(options?: NetworkOptions);

  /**
   * Fetches URL with retry, using proxy if configured
   */
  fetchWithRetry(url: string, options?: FetchOptions): Promise<Response>;

  /**
   * Downloads file to disk, using proxy if configured
   */
  downloadToFile(url: string, savePath: string): Promise<boolean>;
}
```

### 5. Updated API Functions (`src/index.ts`)

```typescript
interface DownloadOptions {
  baseFolder?: string;
  onProgress?: ProgressCallback;
  proxy?: ProxyInput; // NEW
}

interface ParseOptions {
  proxy?: ProxyInput; // NEW
}
```

## Data Models

### Proxy URL Format

```
protocol://[username:password@]host:port

Examples:
- http://proxy.example.com:8080
- https://user:pass@proxy.example.com:443
- socks5://admin:secret@192.168.1.1:1080
```

### Proxy Pool State

```typescript
interface ProxyPoolState {
  proxies: ProxyConfig[];
  currentIndex: number; // For round-robin
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Proxy URL Validation Consistency

_For any_ input string, the proxy validator SHALL correctly identify valid proxy URLs (matching the format `protocol://[user:pass@]host:port` where protocol is http, https, or socks5) and reject all other strings.

**Validates: Requirements 1.3, 1.4**

### Property 2: Unsupported Protocol Rejection

_For any_ proxy URL with a protocol other than http, https, or socks5, the validator SHALL return an error indicating the protocol is not supported.

**Validates: Requirements 2.4**

### Property 3: Credential Parsing Round-Trip

_For any_ valid proxy URL containing credentials, parsing the URL and reconstructing it SHALL preserve the username, password, host, and port values.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Credential Sanitization

_For any_ proxy URL containing credentials, the sanitized display string SHALL NOT contain the username or password, but SHALL contain the host and port.

**Validates: Requirements 5.3**

### Property 5: Round-Robin Distribution

_For any_ proxy pool with N proxies (N > 0) and M consecutive requests (M >= N), each proxy SHALL be selected at least floor(M/N) times, ensuring even distribution.

**Validates: Requirements 7.2**

### Property 6: Failover Attempts All Proxies

_For any_ proxy pool with N proxies, when a request fails on all proxies, the system SHALL have attempted exactly N different proxies before returning a failure.

**Validates: Requirements 8.1, 8.4**

## Error Handling

### Error Categories

1. **Invalid Proxy URL**: Malformed URL string

   - Error: "Invalid proxy URL format: {url}"

2. **Unsupported Protocol**: Protocol not in [http, https, socks5]

   - Error: "Unsupported proxy protocol: {protocol}. Supported: http, https, socks5"

3. **Proxy Connection Failed**: Cannot connect to proxy server

   - Error: "Proxy connection failed: {host}:{port}"

4. **Proxy Authentication Failed**: Invalid credentials

   - Error: "Proxy authentication failed: {host}:{port}"

5. **Proxy Timeout**: Proxy connection timed out

   - Error: "Proxy connection timed out: {host}:{port}"

6. **All Proxies Failed**: Every proxy in pool failed
   - Error: "All proxies failed. Tried {count} proxies."

### Error Handling Strategy

```typescript
try {
  const response = await this.fetchViaProxy(url, proxy);
  return response;
} catch (error) {
  if (this.proxyPool && this.proxyPool.size() > 1) {
    // Try failover to another proxy
    return this.fetchWithFailover(url, currentProxyIndex);
  }
  throw new ProxyError(error.message, proxy);
}
```

## Testing Strategy

### Unit Testing

Unit tests will verify:

- Proxy URL validation logic
- Proxy URL parsing (protocol, host, port, credentials)
- Credential sanitization for display
- Proxy pool round-robin selection
- Proxy pool failover logic

### Property-Based Testing

Property-based tests will use the `fast-check` library to verify correctness properties:

- **URL Validation**: Generate random strings and valid/invalid proxy URLs, verify correct classification
- **Credential Parsing**: Generate random credentials and verify round-trip consistency
- **Sanitization**: Generate URLs with credentials and verify credentials are removed
- **Round-Robin**: Generate proxy pools and request sequences, verify even distribution
- **Failover**: Generate proxy pools and simulate failures, verify all proxies are attempted

Each property-based test will be configured to run a minimum of 100 iterations.

Each property-based test will be tagged with a comment in the format:
`**Feature: proxy-support, Property {number}: {property_text}**`

### Integration Testing

Manual integration tests will verify:

- End-to-end proxy usage with real proxy servers
- CLI --proxy argument functionality
- Multi-proxy failover with actual network failures
