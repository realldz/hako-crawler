/**
 * File system utility functions
 * Requirements: 10.1, 10.2
 */
/**
 * Ensures a directory exists, creating it recursively if needed
 *
 * @param dirPath - The directory path to ensure exists
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Reads and parses a JSON file
 *
 * @param filePath - Path to the JSON file
 * @returns The parsed JSON data
 * @throws Error if file doesn't exist or JSON is invalid
 */
export declare function readJson<T>(filePath: string): Promise<T>;
/**
 * Writes data to a JSON file with pretty formatting
 * Creates parent directories if they don't exist
 *
 * @param filePath - Path to write the JSON file
 * @param data - The data to serialize to JSON
 */
export declare function writeJson<T>(filePath: string, data: T): Promise<void>;
/**
 * Checks if a file exists and has non-zero size
 *
 * @param filePath - Path to the file to check
 * @returns true if file exists with size > 0, false otherwise
 */
export declare function fileExistsWithContent(filePath: string): Promise<boolean>;
//# sourceMappingURL=fs.d.ts.map