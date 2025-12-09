# Implementation Plan

- [x] 1. Add proxy dependencies and types

  - [x] 1.1 Add proxy-related dependencies

    - Add `socks-proxy-agent` for SOCKS5 proxy support
    - Add `undici` for HTTP/HTTPS proxy support with fetch
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Define proxy types in src/types/index.ts

    - Add ProxyProtocol type ('http' | 'https' | 'socks5')
    - Add ProxyConfig interface (protocol, host, port, username?, password?)
    - Add ProxyInput type (string | string[])
    - Add NetworkOptions interface with proxy field
    - Update DownloadOptions and add ParseOptions with proxy field
    - _Requirements: 4.1, 4.2_

- [x] 2. Implement proxy URL validation and parsing

  - [x] 2.1 Create proxy utility module src/utils/proxy.ts

    - Implement isValidProxyUrl function to validate proxy URL format
    - Implement parseProxyUrl function to parse URL into ProxyConfig
    - Implement sanitizeForDisplay function to remove credentials from URL
    - Support http://, https://, socks5:// protocols
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [x] 2.2 Write property test for proxy URL validation

    - **Property 1: Proxy URL Validation Consistency**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 2.3 Write property test for unsupported protocol rejection

    - **Property 2: Unsupported Protocol Rejection**
    - **Validates: Requirements 2.4**

  - [x] 2.4 Write property test for credential parsing

    - **Property 3: Credential Parsing Round-Trip**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.5 Write property test for credential sanitization

    - **Property 4: Credential Sanitization**
    - **Validates: Requirements 5.3**

- [x] 3. Implement ProxyPool service

  - [x] 3.1 Create proxy pool service src/services/proxy-pool.ts

    - Implement ProxyPool class with constructor accepting ProxyInput
    - Implement getNextProxy method with round-robin selection
    - Implement getAlternativeProxy method for failover
    - Implement size and getAllProxies methods
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 3.2 Write property test for round-robin distribution

    - **Property 5: Round-Robin Distribution**
    - **Validates: Requirements 7.2**

- [x] 4. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend NetworkManager with proxy support

  - [x] 5.1 Update NetworkManager constructor to accept NetworkOptions

    - Add optional proxy parameter to constructor
    - Initialize ProxyPool if proxy is provided
    - Store proxy configuration for use in requests
    - _Requirements: 4.1_

  - [x] 5.2 Implement proxy-aware fetch method

    - Create fetchViaProxy method using undici ProxyAgent for HTTP/HTTPS
    - Create fetchViaSocks method using socks-proxy-agent for SOCKS5
    - Update fetchWithRetry to use proxy when configured
    - _Requirements: 1.1, 2.1, 2.2, 2.3_

  - [x] 5.3 Implement proxy authentication support

    - Pass credentials to proxy agents when username/password provided
    - Handle authentication errors appropriately
    - _Requirements: 3.1, 3.2, 6.2_

  - [x] 5.4 Implement proxy failover logic

    - On proxy failure, try next proxy from pool
    - Track attempted proxies to avoid infinite loops
    - Return error only when all proxies have been tried
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Write property test for failover attempts

    - **Property 6: Failover Attempts All Proxies**
    - **Validates: Requirements 8.1, 8.4**

  - [x] 5.6 Implement proxy error handling

    - Create specific error messages for connection failures
    - Create specific error messages for authentication failures
    - Create specific error messages for timeouts
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 6. Update API functions with proxy support

  - [x] 6.1 Update parseNovel function

    - Add optional proxy parameter
    - Pass proxy to NetworkManager
    - _Requirements: 4.2_

  - [x] 6.2 Update downloadVolume and downloadNovel functions

    - Add proxy to DownloadOptions
    - Pass proxy to NetworkManager
    - _Requirements: 4.2_

  - [x] 6.3 Export proxy utilities from index.ts
    - Export parseProxyUrl, isValidProxyUrl, sanitizeForDisplay
    - Export ProxyConfig, ProxyInput types
    - _Requirements: 4.2_

- [x] 7. Add CLI proxy support

  - [x] 7.1 Add --proxy argument to CLI

    - Add --proxy option accepting comma-separated proxy URLs
    - Validate proxy URLs before use
    - _Requirements: 5.1_

  - [x] 7.2 Pass proxy configuration to crawler operations

    - Update parse command to use proxy
    - Update download command to use proxy
    - Update build command (if network operations needed)
    - _Requirements: 5.2_

  - [x] 7.3 Display proxy info in verbose output
    - Show sanitized proxy URL (without credentials) when verbose
    - Show which proxy is being used for requests
    - _Requirements: 5.3_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
