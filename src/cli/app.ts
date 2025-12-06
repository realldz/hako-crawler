/**
 * CLI Application for hako-crawler
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { join } from 'node:path';
import { readdir, access } from 'node:fs/promises';
import { select, checkbox, input } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

import { NetworkManager } from '../services/network';
import { NovelParser } from '../services/parser';
import { NovelDownloader } from '../services/downloader';
import { EpubBuilder } from '../services/epub-builder';
import { EpubDeconstructor } from '../services/epub-deconstructor';
import { PATHS } from '../config/constants';
import { formatFilename } from '../utils/text';
import { ensureDir } from '../utils/fs';
import { readBooksList, addBookToList } from '../utils/books';
import type { LightNovel } from '../types';

/**
 * Main CLI Application class
 * Requirement: 8.1 - Interactive menu for action selection
 */
export class Application {
    private cliUrl?: string;
    private network: NetworkManager;

    constructor(url?: string) {
        this.cliUrl = url;
        this.network = new NetworkManager();
    }

    /**
     * Main entry point for the CLI application
     */
    async run(): Promise<void> {
        console.log(chalk.cyan('\n📚 Hako Crawler - Light Novel Downloader\n'));

        try {
            const action = await this.showMainMenu();
            await this.handleAction(action);
        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.log(chalk.yellow('\nGoodbye! 👋'));
                return;
            }
            console.error(chalk.red('\nError:'), error);
        }
    }

    /**
     * Display main menu and get user selection
     * Requirement: 8.1
     */
    private async showMainMenu(): Promise<string> {
        return select({
            message: 'Select Action:',
            choices: [
                { name: 'Download (Create JSONs)', value: 'download' },
                { name: 'Build EPUB (From JSONs)', value: 'build' },
                { name: 'Deconstruct EPUB', value: 'deconstruct' },
                { name: 'Full Process', value: 'full' },
                { name: 'Batch Build (from books.json)', value: 'batch' },
            ],
        });
    }


    /**
     * Route action to appropriate handler
     */
    private async handleAction(action: string): Promise<void> {
        switch (action) {
            case 'download':
                await this.handleDownload();
                break;
            case 'build':
                await this.handleBuildEpub();
                break;
            case 'deconstruct':
                await this.handleDeconstruct();
                break;
            case 'full':
                await this.handleFullProcess();
                break;
            case 'batch':
                await this.handleBatchBuild();
                break;
        }
    }

    /**
     * Get novel URL from CLI argument or prompt
     * Requirement: 8.6
     */
    private async getNovelUrl(): Promise<string> {
        if (this.cliUrl) {
            return this.cliUrl;
        }
        return input({
            message: 'Light Novel URL:',
            validate: (value) => {
                if (!value.trim()) return 'URL is required';
                try {
                    new URL(value);
                    return true;
                } catch {
                    return 'Please enter a valid URL';
                }
            },
        });
    }

    /**
     * Parse novel from URL with spinner
     */
    private async parseNovel(url: string): Promise<LightNovel | null> {
        const spinner = ora('Fetching novel information...').start();

        try {
            const parser = new NovelParser(this.network);
            const result = await parser.parse(url);

            if (!result.success) {
                spinner.fail(chalk.red(`Failed to parse: ${result.error}`));
                return null;
            }

            spinner.succeed(chalk.green(`Found: ${result.data.name}`));
            console.log(chalk.gray(`  Author: ${result.data.author || 'Unknown'}`));
            console.log(chalk.gray(`  Volumes: ${result.data.volumes.length}`));

            return result.data;
        } catch (error) {
            spinner.fail(chalk.red('Failed to fetch novel'));
            throw error;
        }
    }

    /**
     * Handle download action
     * Requirements: 8.2, 8.5
     */
    private async handleDownload(): Promise<void> {
        const url = await this.getNovelUrl();
        const novel = await this.parseNovel(url);
        if (!novel) return;

        await this.downloadVolumes(novel);
    }

    /**
     * Download selected volumes
     * Requirements: 8.2, 8.5
     */
    private async downloadVolumes(novel: LightNovel): Promise<void> {
        const saveDir = join(PATHS.DATA_DIR, formatFilename(novel.name));

        // Select volumes
        const volumeChoices = novel.volumes.map((v, i) => ({
            name: v.name,
            value: i,
        }));

        const selectedIndices = await checkbox({
            message: 'Select Volumes to download:',
            choices: volumeChoices,
        });

        if (selectedIndices.length === 0) {
            console.log(chalk.yellow('No volumes selected.'));
            return;
        }

        const downloader = new NovelDownloader(novel, saveDir, this.network);

        // Create metadata file
        const metaSpinner = ora('Creating metadata...').start();
        await downloader.createMetadataFile();
        metaSpinner.succeed('Metadata created');

        // Download each selected volume
        for (const idx of selectedIndices) {
            const volume = novel.volumes[idx];
            console.log(chalk.cyan(`\n📖 Downloading: ${volume.name}`));

            const spinner = ora('Downloading...').start();
            let lastTotal = 0;

            await downloader.downloadVolume(volume, (current, total) => {
                lastTotal = total;
                spinner.text = `Downloading chapters: ${current}/${total}`;
            });

            spinner.succeed(chalk.green(`Downloaded ${lastTotal} chapters`));
        }

        // Update books list
        await addBookToList(formatFilename(novel.name));

        console.log(chalk.green(`\n✅ Download complete! Data saved to: ${saveDir}`));
    }


    /**
     * Handle build EPUB action
     * Requirements: 8.3, 8.4
     */
    private async handleBuildEpub(): Promise<void> {
        // Check if data directory exists
        try {
            await access(PATHS.DATA_DIR);
        } catch {
            console.log(chalk.yellow(`No '${PATHS.DATA_DIR}' directory found.`));
            return;
        }

        // List available folders
        const folders = await this.getDataFolders();
        if (folders.length === 0) {
            console.log(chalk.yellow('No downloaded novels found.'));
            return;
        }

        const selectedFolder = await select({
            message: 'Select Novel:',
            choices: folders.map(f => ({ name: f, value: f })),
        });

        const saveDir = join(PATHS.DATA_DIR, selectedFolder);
        await this.buildEpubFromFolder(saveDir);
    }

    /**
     * Build EPUB from a data folder
     * Requirements: 8.3, 8.4
     */
    private async buildEpubFromFolder(saveDir: string): Promise<void> {
        // Get volume JSON files
        const files = await readdir(saveDir);
        const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');

        if (jsonFiles.length === 0) {
            console.log(chalk.yellow('No volume JSONs found.'));
            return;
        }

        // Select image quality (Requirement 8.4)
        const compressChoice = await select({
            message: 'Image Quality for EPUB:',
            choices: [
                { name: 'Optimized (Small File Size - JPEG 75)', value: true },
                { name: 'Original (Max Quality - Keep PNG/GIF)', value: false },
            ],
        });

        // Select build mode (Requirement 8.3)
        const buildMode = await select({
            message: 'Build Mode:',
            choices: [
                { name: 'Separate EPUBs', value: 'separate' },
                { name: 'Merged EPUB', value: 'merged' },
            ],
        });

        // Select volumes
        const selectedJsons = await checkbox({
            message: 'Select Volumes:',
            choices: jsonFiles.map(f => ({ name: f, value: f })),
        });

        if (selectedJsons.length === 0) {
            console.log(chalk.yellow('No volumes selected.'));
            return;
        }

        const builder = new EpubBuilder(saveDir, { compressImages: compressChoice });

        if (buildMode === 'merged') {
            const spinner = ora('Building merged EPUB...').start();
            try {
                const outputPath = await builder.buildMerged(selectedJsons);
                spinner.succeed(chalk.green(`Created: ${outputPath}`));
            } catch (error) {
                spinner.fail(chalk.red('Failed to build merged EPUB'));
                throw error;
            }
        } else {
            for (const jsonFile of selectedJsons) {
                const spinner = ora(`Building: ${jsonFile}...`).start();
                try {
                    const outputPath = await builder.buildVolume(jsonFile);
                    spinner.succeed(chalk.green(`Created: ${outputPath}`));
                } catch (error) {
                    spinner.fail(chalk.red(`Failed to build: ${jsonFile}`));
                    console.error(error);
                }
            }
        }

        console.log(chalk.green('\n✅ EPUB build complete!'));
    }

    /**
     * Handle deconstruct EPUB action
     * Requirement: 7.1
     */
    private async handleDeconstruct(): Promise<void> {
        // Check if input directory exists
        try {
            await access(PATHS.INPUT_DIR);
        } catch {
            await ensureDir(PATHS.INPUT_DIR);
            console.log(chalk.yellow(`Created '${PATHS.INPUT_DIR}' directory. Place EPUB files there to deconstruct.`));
            return;
        }

        // List EPUB files
        const files = await readdir(PATHS.INPUT_DIR);
        const epubFiles = files.filter(f => f.endsWith('.epub'));

        if (epubFiles.length === 0) {
            console.log(chalk.yellow(`No .epub files found in '${PATHS.INPUT_DIR}'.`));
            return;
        }

        const selectedEpub = await select({
            message: 'Select EPUB to deconstruct:',
            choices: epubFiles.map(f => ({ name: f, value: f })),
        });

        const epubPath = join(PATHS.INPUT_DIR, selectedEpub);
        const spinner = ora('Deconstructing EPUB...').start();

        try {
            const deconstructor = new EpubDeconstructor(epubPath);
            await deconstructor.deconstruct();
            spinner.succeed(chalk.green('EPUB deconstructed successfully!'));
        } catch (error) {
            spinner.fail(chalk.red('Failed to deconstruct EPUB'));
            throw error;
        }
    }


    /**
     * Handle full process action (download + build)
     */
    private async handleFullProcess(): Promise<void> {
        const url = await this.getNovelUrl();
        const novel = await this.parseNovel(url);
        if (!novel) return;

        // Download volumes
        await this.downloadVolumes(novel);

        // Build EPUB
        const saveDir = join(PATHS.DATA_DIR, formatFilename(novel.name));
        console.log(chalk.cyan('\n📕 Building EPUB...'));
        await this.buildEpubFromFolder(saveDir);
    }

    /**
     * Handle batch build action
     */
    private async handleBatchBuild(): Promise<void> {
        const booksList = await readBooksList();

        if (booksList.length === 0) {
            console.log(chalk.yellow(`'${PATHS.BOOKS_FILE}' is empty. Nothing to build.`));
            return;
        }

        console.log(chalk.cyan(`Found ${booksList.length} books. Starting batch process...\n`));

        for (const bookFolder of booksList) {
            const bookPath = join(PATHS.DATA_DIR, bookFolder);

            try {
                await access(bookPath);
            } catch {
                console.log(chalk.yellow(`Book folder '${bookFolder}' not found. Skipping.`));
                continue;
            }

            const files = await readdir(bookPath);
            const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'metadata.json');

            if (jsonFiles.length === 0) {
                console.log(chalk.yellow(`No volume JSONs found for '${bookFolder}'. Skipping.`));
                continue;
            }

            console.log(chalk.cyan(`\n>>> Processing: ${bookFolder}`));

            // Build both compressed and original versions
            for (const compressMode of [true, false]) {
                const modeName = compressMode ? 'Optimized' : 'Original';
                console.log(chalk.gray(`   > Building Mode: ${modeName}`));

                const builder = new EpubBuilder(bookPath, { compressImages: compressMode });

                // Build merged
                try {
                    console.log(chalk.gray('   - Building Merged EPUB...'));
                    await builder.buildMerged(jsonFiles);
                } catch (error) {
                    console.log(chalk.red(`   - Failed to build merged: ${error}`));
                }

                // Build separate
                for (const jsonFile of jsonFiles) {
                    try {
                        await builder.buildVolume(jsonFile);
                    } catch (error) {
                        console.log(chalk.red(`   - Failed to build ${jsonFile}: ${error}`));
                    }
                }

                builder.clearCache();
            }
        }

        console.log(chalk.green('\n✅ Batch process finished!'));
    }

    /**
     * Get list of data folders
     */
    private async getDataFolders(): Promise<string[]> {
        try {
            const entries = await readdir(PATHS.DATA_DIR, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory())
                .map(e => e.name);
        } catch {
            return [];
        }
    }

}
