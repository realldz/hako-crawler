/**
 * Books List Management Utilities
 * Requirement: 10.6 - Maintain books.json file tracking all downloaded novels
 */
/**
 * Reads the books list from books.json
 * @returns Array of book folder names
 */
export declare function readBooksList(): Promise<string[]>;
/**
 * Writes the books list to books.json
 * @param books - Array of book folder names
 */
export declare function writeBooksList(books: string[]): Promise<void>;
/**
 * Adds a book to the books list if not already present
 * @param folderName - The folder name of the book to add
 * @returns true if the book was added, false if it already existed
 */
export declare function addBookToList(folderName: string): Promise<boolean>;
/**
 * Removes a book from the books list
 * @param folderName - The folder name of the book to remove
 * @returns true if the book was removed, false if it wasn't in the list
 */
export declare function removeBookFromList(folderName: string): Promise<boolean>;
/**
 * Checks if a book is in the books list
 * @param folderName - The folder name to check
 * @returns true if the book is in the list
 */
export declare function isBookInList(folderName: string): Promise<boolean>;
//# sourceMappingURL=books.d.ts.map