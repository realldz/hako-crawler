import os
import json
import shutil  # <--- Thêm thư viện này
from bs4 import BeautifulSoup, NavigableString

ROOT_DATA = "data"
OUTPUT_DIR = "target_dir"


# ... (Giữ nguyên class ContentParser y hệt như cũ) ...
class ContentParser:
    def __init__(self):
        self.footnotes = []
        self.footnote_map = {}

    def parse_runs(self, element):
        # ... (Giữ nguyên logic parse_runs cũ) ...
        runs = []

        def process_node(node, style={}):
            if isinstance(node, NavigableString):
                text = str(node)
                if text:
                    run = {"text": text}
                    if style.get("bold"):
                        run["isBold"] = True
                    if style.get("italic"):
                        run["isItalic"] = True
                    if style.get("footnoteId"):
                        run["footnoteId"] = style["footnoteId"]
                    runs.append(run)
                return
            if node.name == "br":
                runs.append({"text": "\n"})
                return
            current_style = style.copy()
            if node.name in ["strong", "b"]:
                current_style["bold"] = True
            if node.name in ["em", "i"]:
                current_style["italic"] = True
            if node.name == "a" and node.get("epub:type") == "noteref":
                href = node.get("href", "").replace("#", "")
                if href in self.footnote_map:
                    current_style["footnoteId"] = self.footnote_map[href]
            for child in node.children:
                process_node(child, current_style)

        process_node(element)
        return runs

    def extract_footnotes_from_html(self, soup):
        # ... (Giữ nguyên logic cũ) ...
        self.footnotes = []
        self.footnote_map = {}
        aside_nodes = soup.find_all("aside", {"epub:type": "footnote"})
        for aside in aside_nodes:
            html_id = aside.get("id")
            note_segments = []
            for child in aside.children:
                if child.name in ["p", "div"]:
                    note_segments.append(
                        {"$type": "Text", "runs": self.parse_runs(child)}
                    )
            self.footnotes.append(
                {"$type": "Footnote", "initialId": html_id, "segments": note_segments}
            )
            self.footnote_map[html_id] = html_id
            aside.decompose()

    def parse(self, html_content):
        # ... (Giữ nguyên logic cũ) ...
        if not html_content:
            return [], []
        soup = BeautifulSoup(html_content, "html.parser")
        self.extract_footnotes_from_html(soup)
        segments = []
        container = soup.find(id="chapter-content") or soup.body or soup
        for elem in container.children:
            if isinstance(elem, NavigableString):
                text = str(elem).strip()
                if text:
                    segments.append({"$type": "Text", "runs": [{"text": text}]})
                continue
            if elem.name == "img":
                segments.append(
                    {"$type": "Image", "assetKey": elem.get("src"), "caption": None}
                )
                continue
            if elem.name in ["p", "div", "blockquote"]:
                img = elem.find("img")
                if img and not elem.get_text(strip=True):
                    segments.append(
                        {"$type": "Image", "assetKey": img.get("src"), "caption": None}
                    )
                else:
                    runs = self.parse_runs(elem)
                    if runs:
                        segments.append({"$type": "Text", "runs": runs})
        return segments, self.footnotes


# ... (Hết phần Parser) ...


def convert_book(book_folder):
    src_path = os.path.join(ROOT_DATA, book_folder)
    dist_path = os.path.join(OUTPUT_DIR, book_folder)

    # Tạo lại folder đích sạch sẽ
    if os.path.exists(dist_path):
        shutil.rmtree(dist_path)
    os.makedirs(dist_path, exist_ok=True)

    print(f"Converting: {book_folder}...")

    # --- 1. COPY ASSETS (Logic Mới) ---
    src_images = os.path.join(src_path, "images")
    dist_images = os.path.join(dist_path, "images")

    if os.path.exists(src_images):
        print(f"   -> Copying images to bundle...")
        shutil.copytree(src_images, dist_images)
    # ----------------------------------

    try:
        with open(os.path.join(src_path, "metadata.json"), "r", encoding="utf-8") as f:
            old_meta = json.load(f)
    except FileNotFoundError:
        print(" -> Skip: No metadata.json")
        return

    parser = ContentParser()
    desc_segments, _ = parser.parse(old_meta.get("summary", ""))

    new_meta = {
        "title": old_meta["novel_name"],
        "metadata": {
            "authors": [old_meta.get("author", "Unknown")],
            "tags": old_meta.get("tags", []),
            "description": desc_segments,
            "coverImage": old_meta.get("cover_image_local", ""),
        },
        "volumes": [],
        # QUAN TRỌNG: Đánh dấu asset nằm ngay tại folder hiện tại
        "_assetsRoot": ".",
    }

    for vol_info in old_meta.get("volumes", []):
        vol_filename = vol_info.get("filename")
        vol_file_path = os.path.join(src_path, vol_filename)

        if not os.path.exists(vol_file_path):
            continue

        with open(vol_file_path, "r", encoding="utf-8") as f:
            old_vol = json.load(f)

        new_chapters = []
        for chap in old_vol.get("chapters", []):
            c_parser = ContentParser()
            segments, footnotes = c_parser.parse(chap["content"])
            new_chapters.append(
                {
                    "title": chap["title"],
                    "order": chap.get("index", 0),
                    "footnotes": footnotes,
                    "content": segments,
                }
            )

        new_meta["volumes"].append(
            {
                "title": old_vol["volume_name"],
                "order": vol_info.get("order", 0),
                "chapters": new_chapters,
            }
        )

    with open(os.path.join(dist_path, "bundle.json"), "w", encoding="utf-8") as f:
        json.dump(new_meta, f, ensure_ascii=False, indent=2)

    print(f" -> Done. Bundle ready at: {dist_path}")


if __name__ == "__main__":
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    if os.path.exists(ROOT_DATA):
        for book in os.listdir(ROOT_DATA):
            if os.path.isdir(os.path.join(ROOT_DATA, book)):
                convert_book(book)
    else:
        print(f"Folder {ROOT_DATA} not found.")
