# Requirements Document

## Introduction

This document specifies the requirements for adding proxy support to the hako-crawler library. Since the crawler fetches content from Hako websites (docln.net, ln.hako.vn), it may be blocked by the website's anti-bot measures. Proxy support allows users to route requests through proxy servers to avoid IP-based blocking, access geo-restricted content, and improve reliability when crawling.

## Glossary

- **Crawler**: The hako-crawler library that fetches and parses light novel content from Hako websites
- **Proxy**: An intermediary server that forwards HTTP requests on behalf of the client
- **HTTP Proxy**: A proxy server that handles HTTP/HTTPS traffic using the CONNECT method
- **SOCKS Proxy**: A proxy protocol that operates at a lower level, supporting various traffic types (SOCKS4, SOCKS5)
- **NetworkManager**: The existing class in hako-crawler that handles all HTTP operations
- **Proxy URL**: A URL string specifying the proxy server in format `protocol://[user:pass@]host:port`
- **Proxy Pool**: A collection of multiple proxy servers that can be used for load distribution
- **Per-Connection Classifier (PCC)**: A load balancing strategy that distributes requests across multiple proxies in round-robin fashion
- **Failover**: The process of automatically switching to a backup proxy when the current proxy fails

## Requirements

### Requirement 1

**User Story:** As a user, I want to configure a proxy server for the crawler, so that I can avoid IP-based blocking when crawling Hako websites.

#### Acceptance Criteria

1. WHEN a user provides a proxy URL configuration THEN the Crawler SHALL route all HTTP requests through the specified proxy server
2. WHEN a user does not provide a proxy configuration THEN the Crawler SHALL make direct HTTP requests without using any proxy
3. WHEN a proxy URL is provided THEN the Crawler SHALL validate the URL format before attempting to use it
4. WHEN an invalid proxy URL is provided THEN the Crawler SHALL return an error indicating the URL format is invalid

### Requirement 2

**User Story:** As a user, I want to use different proxy protocols, so that I can use whichever proxy type I have available.

#### Acceptance Criteria

1. THE Crawler SHALL support HTTP proxy protocol (http://)
2. THE Crawler SHALL support HTTPS proxy protocol (https://)
3. THE Crawler SHALL support SOCKS5 proxy protocol (socks5://)
4. WHEN an unsupported proxy protocol is specified THEN the Crawler SHALL return an error indicating the protocol is not supported

### Requirement 3

**User Story:** As a user, I want to use authenticated proxies, so that I can use private proxy servers that require credentials.

#### Acceptance Criteria

1. WHEN a proxy URL contains username and password THEN the Crawler SHALL include authentication credentials in proxy requests
2. WHEN a proxy URL does not contain credentials THEN the Crawler SHALL connect to the proxy without authentication
3. THE Crawler SHALL support the standard URL format for credentials: `protocol://username:password@host:port`

### Requirement 4

**User Story:** As a developer, I want to configure proxy settings programmatically, so that I can integrate proxy support into applications using the library.

#### Acceptance Criteria

1. THE Crawler SHALL accept proxy configuration through the NetworkManager constructor options
2. THE Crawler SHALL accept proxy configuration through individual function calls (parseNovel, downloadVolume, etc.)
3. WHEN proxy is configured at both NetworkManager and function level THEN the function-level configuration SHALL take precedence

### Requirement 5

**User Story:** As a CLI user, I want to specify a proxy via command line argument, so that I can easily use proxies without modifying code.

#### Acceptance Criteria

1. THE CLI SHALL accept a `--proxy` argument to specify the proxy URL
2. WHEN the `--proxy` argument is provided THEN the CLI SHALL pass the proxy configuration to all crawler operations
3. THE CLI SHALL display the proxy being used (without credentials) in verbose output

### Requirement 6

**User Story:** As a user, I want the crawler to handle proxy failures gracefully, so that I can understand when proxy issues occur.

#### Acceptance Criteria

1. WHEN a proxy connection fails THEN the Crawler SHALL return an error message indicating the proxy connection failed
2. WHEN a proxy authentication fails THEN the Crawler SHALL return an error message indicating authentication failed
3. WHEN a proxy times out THEN the Crawler SHALL return an error message indicating the proxy timed out

### Requirement 7

**User Story:** As a user, I want to configure multiple proxy servers, so that I can distribute requests across proxies and avoid overloading a single proxy.

#### Acceptance Criteria

1. THE Crawler SHALL accept an array of proxy URLs as configuration
2. WHEN multiple proxies are configured THEN the Crawler SHALL distribute requests across all proxies using round-robin (per-connection classifier)
3. WHEN a single proxy URL is provided THEN the Crawler SHALL use only that proxy for all requests
4. THE Crawler SHALL track which proxy is used for each request internally

### Requirement 8

**User Story:** As a user, I want the crawler to automatically failover to another proxy when one fails, so that my crawling operation continues without manual intervention.

#### Acceptance Criteria

1. WHEN a proxy fails during a request AND multiple proxies are configured THEN the Crawler SHALL retry the request using a different proxy from the pool
2. WHEN all proxies in the pool fail for a request THEN the Crawler SHALL return an error indicating all proxies failed
3. WHEN a proxy fails THEN the Crawler SHALL continue using other proxies for subsequent requests
4. THE Crawler SHALL attempt each proxy in the pool at least once before declaring total failure for a request
