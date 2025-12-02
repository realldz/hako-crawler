import os
import json
from bs4 import BeautifulSoup, NavigableString

ROOT = "data"
OUT_ROOT = "output"


# =============================
# 0. PARSED RUNS FROM PARAGRAPH
# =============================
def parse_runs(elem):
    runs = []

    def add(text, bold=False, italic=False, fid=None):
        if text.strip():
            run_data = {"text": text}
            if bold:
                run_data["isBold"] = True
            if italic:
                run_data["isItalic"] = True
            if fid:
                run_data["footnoteId"] = fid

            runs.append(run_data)

    for child in elem.children:
        if isinstance(child, NavigableString):
            add(str(child))

        elif child.name in ["strong", "b"]:
            add(child.get_text(), bold=True)

        elif child.name in ["em", "i"]:
            add(child.get_text(), italic=True)

        # --- FOOTNOTE REF (rare inside note) ---
        elif child.name == "a" and child.get("epub:type") == "noteref":
            fid = child.get("href", "").replace("#", "")
            add(child.get_text(), fid=fid)

        else:
            add(child.get_text())

    return runs


def parse_metadata_description(description_html):
    """
    Parse HTML content in metadata description and convert it to structured runs format
    """
    if not description_html or not isinstance(description_html, str):
        return []

    # Create a temporary wrapper to parse the HTML content using the existing parse_runs function
    temp_wrapper = f"<div>{description_html}</div>"
    soup = BeautifulSoup(temp_wrapper, "html.parser")

    # Get the wrapper div and parse its contents using the existing parse_runs function
    wrapper_div = soup.find("div")
    if wrapper_div:
        # Use the existing parse_runs logic by treating the content as if it were a paragraph
        return parse_runs(wrapper_div)

    # Fallback if parsing fails
    return [{"text": description_html}] if description_html.strip() else []


def parse_paragraph(p):
    text = p.get_text(strip=True)
    has_strong = p.find("strong") is not None

    if has_strong and len(p.contents) == 1:
        return {"$type": "Heading", "level": 2, "content": text}

    return {"$type": "Text", "runs": parse_runs(p)}


def parse_image(img):
    src = img.get("src")
    filename = os.path.basename(src)

    return {"$type": "Image", "assetFilename": filename, "caption": None}


# =============================
# 1. PARSE FOOTNOTE INTO SEGMENTS
# =============================
def parse_footnote_segments(aside):
    segments = []
    for elem in aside.children:
        if elem.name == "p":
            segments.append(parse_paragraph(elem))
        elif elem.name == "img":
            segments.append(parse_image(elem))
    return segments


# =============================
# 2. EXTRACT FOOTNOTES (NOW PARSED)
# =============================
def extract_footnotes(html):
    soup = BeautifulSoup(html, "html.parser")
    notes = {}

    for aside in soup.find_all("aside", {"epub:type": "footnote"}):
        fid = aside.get("id")
        segments = parse_footnote_segments(aside)

        notes[fid] = {"$type": "Footnote", "segments": segments}

    return notes


# =============================
# 3. CONVERT CHAPTER
# =============================
def convert_chapter(chapter):
    html = chapter["content"]
    soup = BeautifulSoup(html, "html.parser")

    container = soup.find(id="chapter-content")

    # 🌟 Now footnotes are parsed segments instead of raw HTML
    footnotes = extract_footnotes(html)

    segments = []
    for elem in container.children:
        if elem.name == "p":
            img = elem.find("img")
            if img:
                segments.append(parse_image(img))
            else:
                segments.append(parse_paragraph(elem))

        elif elem.name == "img":
            segments.append(parse_image(elem))

    out = {
        "title": chapter["title"],
        "order": chapter.get("index", 0),
        "footnotes": footnotes,  # 🌟 new cleaned structured format
        "segments": segments,
    }

    return out


# =============================
# 4. CONVERT VOLUME
# =============================
def convert_volume(book_name, volume_path, output_dir):
    with open(volume_path, "r", encoding="utf-8") as f:
        vol = json.load(f)

    chapters = vol.get("chapters", [])
    vol_name = vol.get("volume_name") or os.path.basename(volume_path)

    for chap in chapters:
        converted = convert_chapter(chap)

        out_name = f"{book_name}_vol_{vol_name}_chap_{chap.get('index', 0)}.json"
        out_file = os.path.join(output_dir, out_name)

        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(converted, f, indent=2, ensure_ascii=False)

        print(f"✔ Converted chapter → {out_file}")


# =============================
# 5. CONVERT METADATA
# =============================
def convert_metadata(book_path, output_dir):
    metadata_path = os.path.join(book_path, "metadata.json")

    if not os.path.exists(metadata_path):
        print(f"No metadata.json found in {book_path}, skipping metadata conversion")
        return

    with open(metadata_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    # Parse the summary/description field which may contain HTML
    original_summary = metadata.get("summary", "")
    if original_summary:
        # Convert HTML in summary to structured runs format
        parsed_runs = parse_metadata_description(original_summary)
        # Store both the original and parsed versions
        converted_metadata = {
            "novel_name": metadata.get("novel_name", ""),
            "author": metadata.get("author", ""),
            "tags": metadata.get("tags", []),
            "summary": parsed_runs,  # This is now a list of runs instead of raw HTML
            "summary_raw": original_summary,  # Keep the original as backup
            "cover_image_local": metadata.get("cover_image_local", ""),
            "url": metadata.get("url", ""),
            "volumes": metadata.get("volumes", []),
        }
    else:
        # If no summary, just convert the metadata as is
        converted_metadata = {
            "novel_name": metadata.get("novel_name", ""),
            "author": metadata.get("author", ""),
            "tags": metadata.get("tags", []),
            "summary": [],
            "cover_image_local": metadata.get("cover_image_local", ""),
            "url": metadata.get("url", ""),
            "volumes": metadata.get("volumes", []),
        }

    out_file = os.path.join(output_dir, "metadata.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(converted_metadata, f, indent=2, ensure_ascii=False)

    print(f"✔ Converted metadata → {out_file}")


# =============================
# 5. CONVERT BOOK
# =============================
def convert_book(book_path):
    book_name = os.path.basename(book_path)
    out_dir = os.path.join(OUT_ROOT, book_name)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n=== PROCESSING BOOK: {book_name} ===")

    # Convert metadata first
    convert_metadata(book_path, out_dir)

    # Then convert volumes
    for filename in os.listdir(book_path):
        if not filename.lower().endswith(".json"):
            continue
        if filename == "metadata.json":
            continue

        fullpath = os.path.join(book_path, filename)
        convert_volume(book_name, fullpath, out_dir)


# =============================
# 6. ENTRY POINT
# =============================
def convert_all():
    for name in os.listdir(ROOT):
        path = os.path.join(ROOT, name)
        if os.path.isdir(path):
            convert_book(path)


if __name__ == "__main__":
    convert_all()
