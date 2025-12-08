/**
 * CLI Application for hako-crawler
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */
/**
 * Main CLI Application class
 * Requirement: 8.1 - Interactive menu for action selection
 */
export declare class Application {
    private cliUrl?;
    private network;
    constructor(url?: string);
    /**
     * Main entry point for the CLI application
     */
    run(): Promise<void>;
    /**
     * Display main menu and get user selection
     * Requirement: 8.1
     */
    private showMainMenu;
    /**
     * Route action to appropriate handler
     */
    private handleAction;
    /**
     * Get novel URL from CLI argument or prompt
     * Requirement: 8.6
     */
    private getNovelUrl;
    /**
     * Parse novel from URL with spinner
     */
    private parseNovel;
    /**
     * Handle download action
     * Requirements: 8.2, 8.5
     */
    private handleDownload;
    /**
     * Download selected volumes
     * Requirements: 8.2, 8.5
     */
    private downloadVolumes;
    /**
     * Handle build EPUB action
     * Requirements: 8.3, 8.4
     */
    private handleBuildEpub;
    /**
     * Build EPUB from a data folder
     * Requirements: 8.3, 8.4
     */
    private buildEpubFromFolder;
    /**
     * Handle deconstruct EPUB action
     * Requirement: 7.1
     */
    private handleDeconstruct;
    /**
     * Handle full process action (download + build)
     */
    private handleFullProcess;
    /**
     * Handle batch build action
     */
    private handleBatchBuild;
    /**
     * Get list of data folders
     */
    private getDataFolders;
}
//# sourceMappingURL=app.d.ts.map