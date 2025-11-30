import json
import logging
import re
from os.path import exists
from typing import List

from bs4 import BeautifulSoup, Comment

from .constants import BOOKS_FILE, DOMAINS

logger = logging.getLogger(__name__)


class ContentCleaner:
    @staticmethod
    def cleanup_html(html_content: str) -> str:
        """
        Cleans up HTML content by removing unwanted tags, attributes, and comments.
        """
        if not html_content:
            return ""
        soup = BeautifulSoup(html_content, "html.parser")

        # Remove comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()

        # Whitelist of allowed attributes for specific tags
        allowed_attrs = {
            'img': ['src', 'alt'],
            'a': ['href', 'epub:type', 'class'],  # Keep class for footnote-link
            'aside': ['id', 'epub:type', 'class']  # Keep class for footnote-content
        }

        for tag in soup.find_all(True):
            # Get the whitelisted attributes for this tag, or an empty list
            whitelist = allowed_attrs.get(tag.name, [])

            # Create a copy of the attributes dictionary to iterate over
            attrs = dict(tag.attrs)
            for attr, value in attrs.items():
                if attr not in whitelist:
                    del tag[attr]

        # Remove empty tags after cleanup
        for el in soup.find_all(["p", "div", "span"]):
            if not el.get_text(strip=True) and not el.find("img"):
                el.decompose()

        return str(soup)

    @staticmethod
    def process_notes(html_content: str, chapter_slug: str) -> str:
        if not html_content:
            return ""

        soup = BeautifulSoup(html_content, "html.parser")
        body = soup.find("body") or soup

        def normalize_text(text: str) -> str:
            return "".join(filter(str.isalnum, text)).lower()

        footnote_counter = 1
        footnotes_to_add = []
        processed_notes_count = 0

        # --- Format 2: (Note: ...) with corresponding div ---
        note_defs = {}
        note_divs = body.find_all("div", id=re.compile(r"note\d+"))

        for note_div in note_divs:
            temp_div = BeautifulSoup(str(note_div), "html.parser")
            for a_tag in temp_div.find_all("a"):
                a_tag.decompose()

            text_container = temp_div.find("div", class_="series-gerne-item") or temp_div
            note_text = text_container.get_text(strip=True)

            if note_text:
                normalized_text = normalize_text(note_text)
                if normalized_text and normalized_text not in note_defs:
                    note_defs[normalized_text] = {
                        "div": note_div,
                        "used": False,
                        "original_text": note_text,
                    }

        note_pattern = re.compile(r"\(Note:\s*(.*?)\)", re.DOTALL)

        for element in body.find_all(text=True, string=True):
            if element.parent.name in ["style", "script", "a"]:
                continue

            text = str(element)
            if "(Note:" not in text:
                continue

            matches = list(note_pattern.finditer(text))
            if not matches:
                continue

            new_html_parts = []
            last_end = 0
            should_replace = False

            for match in matches:
                note_content = match.group(1).strip()
                normalized_content = normalize_text(note_content)

                if normalized_content in note_defs:
                    should_replace = True
                    note_id = f"note_{chapter_slug}_{footnote_counter}"

                    new_html_parts.append(text[last_end:match.start()])

                    label = f"[{footnote_counter}]"
                    link = f'<a epub:type="noteref" href="#{note_id}" class="footnote-link">{label}</a>'
                    new_html_parts.append(link)

                    original_note_text = note_defs[normalized_content]["original_text"]
                    footnotes_to_add.append(f"""
                    <aside id="{note_id}" epub:type="footnote" class="footnote-content">
                        <div class="note-header">Note:</div>
                        <p>{original_note_text}</p>
                    </aside>
                    """)

                    note_defs[normalized_content]["used"] = True
                    footnote_counter += 1
                    processed_notes_count += 1
                    last_end = match.end()

            if should_replace:
                new_html_parts.append(text[last_end:])
                element.replace_with(BeautifulSoup("".join(new_html_parts), "html.parser"))

        for note_data in note_defs.values():
            if note_data["used"]:
                note_data["div"].decompose()

        # --- Format 1: (Note: "...") ---
        note_pattern_simple = re.compile(r"\(Note:\s*&quot;(.*?)&quot;\)", re.IGNORECASE)

        for element in body.find_all(text=True, string=True):
            if element.parent.name in ["style", "script", "a"]:
                continue

            text = str(element)
            matches = list(note_pattern_simple.finditer(text))

            if not matches:
                continue

            new_html_parts = []
            last_end = 0
            should_replace = False

            for match in matches:
                should_replace = True
                note_content = match.group(1)
                note_id = f"note_{chapter_slug}_{footnote_counter}"

                new_html_parts.append(text[last_end:match.start()])

                label = f"[{footnote_counter}]"
                link = f'<a epub:type="noteref" href="#{note_id}" class="footnote-link">{label}</a>'
                new_html_parts.append(link)

                footnotes_to_add.append(f"""
                <aside id="{note_id}" epub:type="footnote" class="footnote-content">
                    <div class="note-header">Note:</div>
                    <p>{note_content}</p>
                </aside>
                """)

                footnote_counter += 1
                processed_notes_count += 1
                last_end = match.end()

            if should_replace:
                new_html_parts.append(text[last_end:])
                element.replace_with(BeautifulSoup("".join(new_html_parts), "html.parser"))

        if footnotes_to_add:
            body.append(BeautifulSoup("".join(footnotes_to_add), "html.parser"))

        return str(soup)


# --- Book List Management ---


def read_books_list() -> List[str]:
    """Reads the list of book folders from books.json."""
    if not exists(BOOKS_FILE):
        with open(BOOKS_FILE, "w", encoding="utf-8") as f:
            json.dump({"books": []}, f)
        return []
    try:
        with open(BOOKS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("books", [])
    except (json.JSONDecodeError, IOError):
        return []


def write_books_list(books: List[str]):
    """Writes the list of book folders to books.json."""
    with open(BOOKS_FILE, "w", encoding="utf-8") as f:
        json.dump({"books": sorted(list(set(books)))}, f, ensure_ascii=False, indent=2)


def add_book_to_list(book_folder: str):
    """Adds a book folder to the books.json list if it's not already there."""
    books = read_books_list()
    if book_folder not in books:
        books.append(book_folder)
        write_books_list(books)
        logger.info(f"Added '{book_folder}' to {BOOKS_FILE}")


class TextUtils:
    @staticmethod
    def format_filename(name: str) -> str:
        name = re.sub(r"[\\/*?:\"<>|]", "", name)
        name = name.replace(" ", "_").strip()
        return name[:100]

    @staticmethod
    def reformat_url(base_url: str, url: str) -> str:
        if url.startswith("http"):
            return url
        domain = "docln.net"
        for d in DOMAINS:
            if d in base_url:
                domain = d
                break
        return (
            f"https://{domain}{url}"
            if url.startswith("/")
            else f"https://{domain}/{url}"
        )
