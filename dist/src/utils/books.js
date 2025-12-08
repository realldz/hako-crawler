/**
 * Books List Management Utilities
 * Requirement: 10.6 - Maintain books.json file tracking all downloaded novels
 */
import { PATHS } from '../config/constants';
import { readJson, writeJson } from './fs';
/**
 * Reads the books list from books.json
 * @returns Array of book folder names
 */
export async function readBooksList() {
    try {
        const data = await readJson(PATHS.BOOKS_FILE);
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}
/**
 * Writes the books list to books.json
 * @param books - Array of book folder names
 */
export async function writeBooksList(books) {
    await writeJson(PATHS.BOOKS_FILE, books);
}
/**
 * Adds a book to the books list if not already present
 * @param folderName - The folder name of the book to add
 * @returns true if the book was added, false if it already existed
 */
export async function addBookToList(folderName) {
    const booksList = await readBooksList();
    if (booksList.includes(folderName)) {
        return false;
    }
    booksList.push(folderName);
    await writeBooksList(booksList);
    return true;
}
/**
 * Removes a book from the books list
 * @param folderName - The folder name of the book to remove
 * @returns true if the book was removed, false if it wasn't in the list
 */
export async function removeBookFromList(folderName) {
    const booksList = await readBooksList();
    const index = booksList.indexOf(folderName);
    if (index === -1) {
        return false;
    }
    booksList.splice(index, 1);
    await writeBooksList(booksList);
    return true;
}
/**
 * Checks if a book is in the books list
 * @param folderName - The folder name to check
 * @returns true if the book is in the list
 */
export async function isBookInList(folderName) {
    const booksList = await readBooksList();
    return booksList.includes(folderName);
}
//# sourceMappingURL=books.js.map