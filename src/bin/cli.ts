#!/usr/bin/env node
/**
 * CLI Entry Point for hako-crawler
 * Requirement: 8.6 - Accept URL as command-line argument
 * Proxy Requirement: 5.1, 5.2 - Accept --proxy argument
 */

import { Command } from 'commander';
import { Application } from '../cli/app';
import { isValidProxyUrl } from '../utils/proxy';

const program = new Command();

program
    .name('hako-crawler')
    .description('Light novel crawler for Hako websites with EPUB generation')
    .version('1.0.0')
    .argument('[url]', 'Novel URL to process (optional)')
    .option(
        '-p, --proxy <urls>',
        'Proxy URL(s) to use (comma-separated for multiple proxies)',
        (value) => {
            const urls = value.split(',').map(u => u.trim()).filter(u => u);
            for (const url of urls) {
                if (!isValidProxyUrl(url)) {
                    console.error(`Invalid proxy URL: ${url}`);
                    console.error('Supported formats: http://host:port, socks5://host:port');
                    process.exit(1);
                }
            }
            return urls.length === 1 ? urls[0] : urls;
        }
    )
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (url: string | undefined, options: { proxy?: string | string[]; verbose?: boolean }) => {
        const app = new Application(url, {
            proxy: options.proxy,
            verbose: options.verbose,
        });
        await app.run();
    });

program.parse();
