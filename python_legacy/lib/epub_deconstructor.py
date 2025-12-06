import json
import logging
import os
from os.path import basename, exists, join
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from ebooklib import epub
import questionary

from .constants import DATA_DIR
from .utils import ContentCleaner, TextUtils, add_book_to_list

logger = logging.getLogger(__name__)


class EpubDeconstructor:
    def __init__(self, epub_path: str):
        if not exists(epub_path):
            raise FileNotFoundError(f"EPUB file not found: {epub_path}")
        logger.info(f"Reading EPUB: {epub_path}")
        self.epub_path = epub_path
        self.book = epub.read_epub(epub_path)

        self.novel_name = "Unknown Novel"
        titles = self.book.get_metadata("DC", "title")
        if titles:
            self.novel_name = titles[0][0]

        self.save_dir = join(DATA_DIR, TextUtils.format_filename(self.novel_name))
        self.images_dir = join(self.save_dir, "images")

        if not exists(self.save_dir):
            os.makedirs(self.save_dir)
        if not exists(self.images_dir):
            os.makedirs(self.images_dir)
        logger.info(f"Output directory: {self.save_dir}")

    def _update_html_content(
        self,
        content: str,
        vol_slug: str,
        chapter_index: int,
        image_map: dict,
        chapter_item_name: str,
    ) -> str:
        """
        Updates image paths in HTML content, extracts images, and renames them.
        """
        if not content:
            return ""
        soup = BeautifulSoup(content, "html.parser")

        items_by_href = {item.get_name(): item for item in self.book.get_items()}

        for i, img in enumerate(soup.find_all("img")):
            src = img.get("src")
            if not src:
                img.decompose()
                continue

            base_url = (
                chapter_item_name.rsplit("/", 1)[0] + "/"
                if "/" in chapter_item_name
                else ""
            )
            original_epub_path = urljoin(base_url, src)
            if original_epub_path.startswith("./"):
                original_epub_path = original_epub_path[2:]

            if original_epub_path in image_map:
                img["src"] = image_map[original_epub_path]
                continue

            image_item = items_by_href.get(original_epub_path)

            if not image_item:
                src_basename = basename(original_epub_path)
                for item_href, item in items_by_href.items():
                    if (
                        basename(item_href) == src_basename
                        and item.get_type() == epub.ebooklib.ITEM_IMAGE
                    ):
                        image_item = item
                        break

            if not image_item:
                logger.warning(
                    f"Could not find image item for src: {src} in {chapter_item_name}. Decomposing image."
                )
                img.decompose()
                continue

            try:
                ext = basename(image_item.get_name()).split(".")[-1].lower()
                if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
                    ext = "jpeg"

                new_filename = f"{vol_slug}_chap_{chapter_index}_img_{i}.{ext}"
                new_filepath = join(self.images_dir, new_filename)

                with open(new_filepath, "wb") as f:
                    f.write(image_item.get_content())

                new_src_path = f"images/{new_filename}"
                img["src"] = new_src_path
                image_map[original_epub_path] = new_src_path
            except Exception as e:
                logger.error(f"Failed to save image {original_epub_path}: {e}")
                img.decompose()

        return str(soup)

    def _process_chapter_item(
        self, item, toc_title, vol_slug, chapter_index, image_map
    ):
        """Processes a document item into a chapter dictionary."""
        if not item:
            return None

        title = toc_title
        if not title:
            content_for_title = item.get_content().decode("utf-8", "ignore")
            soup_for_title = BeautifulSoup(content_for_title, "html.parser")
            title_tag = soup_for_title.find(["h1", "h2", "h3"])
            if title_tag:
                title = title_tag.get_text(strip=True)
            else:
                title = f"Chapter {chapter_index + 1}"

        logger.info(f"Processing chapter {chapter_index + 1}: {title}")

        content = item.get_content().decode("utf-8", "ignore")
        
        # Preliminary check on the raw content
        soup = BeautifulSoup(content, "html.parser")
        text_len = len(soup.get_text(strip=True))

        if text_len < 100 and "cover" in title.lower():
            logger.info(f"Skipping likely cover page: '{title}'")
            return None
        if text_len < 50 and any(
            t in title.lower() for t in ["toc", "contents", "mục lục"]
        ):
            logger.info(f"Skipping likely ToC page: '{title}'")
            return None

        # 1. Process images. This works on the full document context.
        updated_content_full = self._update_html_content(
            content, vol_slug, chapter_index, image_map, item.get_name()
        )

        # 2. Now, extract only the body's content for further processing.
        soup = BeautifulSoup(updated_content_full, "html.parser")
        body = soup.find('body')
        if body:
            # We only want the content, not the body tag itself
            content_html = "".join(str(c) for c in body.contents)
        else:
            # Fallback if no body tag is found
            content_html = updated_content_full

        # 3. Process notes on the extracted body content
        chapter_slug = f"{vol_slug}_chap_{chapter_index}"
        content_with_notes = ContentCleaner.process_notes(content_html, chapter_slug)

        # 4. Clean up the resulting HTML aggressively
        final_content = ContentCleaner.cleanup_html(content_with_notes)

        return {
            "title": title,
            "url": "",
            "content": final_content,
            "index": chapter_index,
        }

    def deconstruct(self):
        """Main deconstruction method."""
        print(f"Deconstructing '{self.novel_name}'...")
        
        image_map = {}

        # --- Metadata ---
        author = "Unknown"
        authors = self.book.get_metadata("DC", "creator")
        if authors:
            author = authors[0][0]

        summary = ""
        descriptions = self.book.get_metadata("DC", "description")
        if descriptions:
            summary = descriptions[0][0]

        tags = []
        subjects = self.book.get_metadata("DC", "subject")
        if subjects:
            tags = [s[0] for s in subjects]

        # --- Cover ---
        cover_path = ""
        try:
            cover_uid = self.book.get_metadata("OPF", "cover")[0][1]["content"]
            cover_item = self.book.get_item_with_id(cover_uid)
            if cover_item:
                ext = basename(cover_item.get_name()).split(".")[-1].lower()
                if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
                    ext = "jpeg"
                cover_filename = f"main_cover.{ext}"
                with open(join(self.images_dir, cover_filename), "wb") as f:
                    f.write(cover_item.get_content())
                cover_path = f"images/{cover_filename}"
                image_map[cover_item.get_name()] = cover_path
        except (IndexError, KeyError):
            logger.warning("Could not find specified cover image.")
        logger.info(f"Using cover image: {cover_path}")

        # --- Volumes and Chapters ---
        logger.info("Processing volumes and chapters...")

        spine_items = [
            self.book.get_item_with_id(item_id)
            for item_id, _ in self.book.spine
            if self.book.get_item_with_id(item_id).get_type()
            == epub.ebooklib.ITEM_DOCUMENT
        ]
        spine_hrefs = [item.get_name() for item in spine_items]
        docs_by_href = {item.get_name(): item for item in spine_items}

        toc_title_map = {}

        def build_title_map(toc_items):
            for item in toc_items:
                if isinstance(item, epub.Link):
                    href = item.href.split("#")[0]
                    toc_title_map[href] = item.title
                elif isinstance(item, tuple):
                    section_link, child_links = item
                    href = section_link.href.split("#")[0]
                    if href:
                        toc_title_map[href] = section_link.title
                    build_title_map(child_links)

        build_title_map(self.book.toc)

        volume_definitions = []
        misc_toc_hrefs = set()
        is_multi_volume = any(isinstance(item, tuple) for item in self.book.toc)

        if is_multi_volume:
            for item in self.book.toc:
                if isinstance(item, tuple):
                    section_link, child_links = item
                    section_name = section_link.title
                    section_hrefs = {l.href.split("#")[0] for l in child_links}
                    volume_definitions.append(
                        {"name": section_name, "hrefs": section_hrefs}
                    )
                elif isinstance(item, epub.Link):
                    misc_toc_hrefs.add(item.href.split("#")[0])
        else:
            all_toc_hrefs = {
                l.href.split("#")[0] for l in self.book.toc if isinstance(l, epub.Link)
            }
            if all_toc_hrefs:
                volume_definitions.append(
                    {"name": self.novel_name, "hrefs": all_toc_hrefs}
                )

        # --- Interactive Volume Name Cleaning (Batch) ---
        if volume_definitions:
            original_names = [v["name"] for v in volume_definitions]
            
            # Show up to 3 examples
            examples = original_names[:3]
            examples_str = "', '".join(examples)

            # Q1: Are they from merged EPUBs?
            if questionary.confirm(
                f"Found volumes like: '{examples_str}'. Are these from merged EPUBs (e.g., 'vol-1-book-name.epub')?"
            ).ask():
                
                # Q2: Should a common book name part be removed?
                book_name_to_remove = ""
                if questionary.confirm(
                    "Should a common book name part be removed from the end of these names?"
                ).ask():
                    book_name_to_remove = questionary.text(
                        "Enter the book name part to remove from all volumes:"
                    ).ask()

                # Generate a preview of the changes
                new_names = []
                changes = []
                for name in original_names:
                    # Rule 1: Clean .epub and hyphens
                    cleaned_name = name.replace(".epub", "").replace("-", " ")
                    
                    # Rule 2: Remove book name
                    if book_name_to_remove:
                        cleaned_input = book_name_to_remove.replace("-", " ")
                        cleaned_name = cleaned_name.replace(cleaned_input, "").strip()
                    
                    new_names.append(cleaned_name)
                    if name != cleaned_name:
                        changes.append(f"  - '{name}' -> '{cleaned_name}'")

                # Final confirmation for all changes
                if changes:
                    print("\nProposed changes:")
                    for change in changes:
                        print(change)
                    
                    if questionary.confirm("\nApply these changes to all volumes?").ask():
                        for i, vol_def in enumerate(volume_definitions):
                            vol_def["name"] = new_names[i]
                        print("Volume names have been updated.")
                else:
                    print("No changes to apply based on the provided rules.")
        # --- End Interactive Cleaning ---

        final_volumes = []
        processed_hrefs = set()
        volume_order_counter = 0

        for vol_def in volume_definitions:
            vol_name = vol_def["name"]
            vol_hrefs = vol_def["hrefs"]
            vol_slug = TextUtils.format_filename(vol_name).lower()

            ordered_chap_hrefs = [
                href
                for href in spine_hrefs
                if href in vol_hrefs and href not in processed_hrefs
            ]

            if not ordered_chap_hrefs:
                ordered_chap_hrefs = [
                    href for href in vol_hrefs if href not in processed_hrefs
                ]

            if not ordered_chap_hrefs:
                continue

            logger.info(f"Processing volume: {vol_name}")
            volume_chapters = []
            for i, href in enumerate(ordered_chap_hrefs):
                item = docs_by_href.get(href)
                toc_title = toc_title_map.get(href)
                chapter_data = self._process_chapter_item(
                    item, toc_title, vol_slug, i, image_map
                )
                if chapter_data:
                    volume_chapters.append(chapter_data)
                processed_hrefs.add(href)

            if volume_chapters:
                final_volumes.append(
                    {
                        "name": vol_name,
                        "order": volume_order_counter,
                        "chapters": volume_chapters,
                    }
                )
                volume_order_counter += 1

        if not final_volumes:
            logger.warning(
                "ToC parsing yielded no volumes. Falling back to full spine order."
            )
            all_chapters = []
            vol_slug = TextUtils.format_filename(self.novel_name).lower()
            for i, href in enumerate(spine_hrefs):
                item = docs_by_href.get(href)
                toc_title = toc_title_map.get(href)
                chapter_data = self._process_chapter_item(
                    item, toc_title, vol_slug, i, image_map
                )
                if chapter_data:
                    all_chapters.append(chapter_data)
            if all_chapters:
                final_volumes.append(
                    {"name": self.novel_name, "order": 0, "chapters": all_chapters}
                )

        # --- Create JSONs ---
        logger.info(f"Found {len(final_volumes)} volumes.")
        volume_metadata_list = []
        for vol in final_volumes:
            for i, chap in enumerate(vol["chapters"]):
                chap["index"] = i

            volume_data = {
                "volume_name": vol["name"],
                "volume_url": "",
                "cover_image_local": "",
                "chapters": vol["chapters"],
            }

            vol_filename = TextUtils.format_filename(vol["name"]) + ".json"
            vol_path = join(self.save_dir, vol_filename)
            with open(vol_path, "w", encoding="utf-8") as f:
                json.dump(volume_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved volume data to {vol_path}")

            volume_metadata_list.append(
                {
                    "order": vol["order"],
                    "name": vol["name"],
                    "filename": vol_filename,
                    "url": "",
                }
            )

        metadata = {
            "novel_name": self.novel_name,
            "author": author,
            "tags": tags,
            "summary": summary,
            "cover_image_local": cover_path,
            "url": "",
            "volumes": volume_metadata_list,
        }

        meta_path = join(self.save_dir, "metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved metadata to {meta_path}")

        add_book_to_list(basename(self.save_dir))
        print(f"\nSuccessfully deconstructed EPUB into '{self.save_dir}'")
