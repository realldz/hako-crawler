#!/usr/bin/env node
/**
 * CLI Entry Point for hako-crawler
 * Requirement: 8.6 - Accept URL as command-line argument
 */
import { Command } from 'commander';
import { Application } from '../cli/app';
const program = new Command();
program
    .name('hako-crawler')
    .description('Light novel crawler for Hako websites with EPUB generation')
    .version('1.0.0')
    .argument('[url]', 'Novel URL to process (optional)')
    .action(async (url) => {
    const app = new Application(url);
    await app.run();
});
program.parse();
//# sourceMappingURL=cli.js.map