/**
 * File system utility functions
 * Requirements: 10.1, 10.2
 */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
/**
 * Ensures a directory exists, creating it recursively if needed
 *
 * @param dirPath - The directory path to ensure exists
 */
export async function ensureDir(dirPath) {
    await mkdir(dirPath, { recursive: true });
}
/**
 * Reads and parses a JSON file
 *
 * @param filePath - Path to the JSON file
 * @returns The parsed JSON data
 * @throws Error if file doesn't exist or JSON is invalid
 */
export async function readJson(filePath) {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
}
/**
 * Writes data to a JSON file with pretty formatting
 * Creates parent directories if they don't exist
 *
 * @param filePath - Path to write the JSON file
 * @param data - The data to serialize to JSON
 */
export async function writeJson(filePath, data) {
    // Ensure parent directory exists (only if not root level)
    const dir = dirname(filePath);
    if (dir && dir !== '.' && dir !== '/') {
        await ensureDir(dir);
    }
    const content = JSON.stringify(data, null, 2);
    await writeFile(filePath, content, 'utf-8');
}
/**
 * Checks if a file exists and has non-zero size
 *
 * @param filePath - Path to the file to check
 * @returns true if file exists with size > 0, false otherwise
 */
export async function fileExistsWithContent(filePath) {
    try {
        const stats = await stat(filePath);
        return stats.isFile() && stats.size > 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=fs.js.map