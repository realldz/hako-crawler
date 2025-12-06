import os
import json
import requests
import mimetypes

# Cấu hình API
API_URL = "http://localhost:5062/api/v1"
CONVERTER_OUTPUT_DIR = "output_grimoire"


class GrimoireImporter:
    def __init__(self, api_url):
        self.api_url = api_url

    def upload_file(self, file_path, series_id=None):
        """Upload file lên Grimoire và trả về đường dẫn assets"""
        if not file_path or not os.path.exists(file_path):
            print(f"   ⚠️ File not found: {file_path}")
            return None

        # Xác định endpoint upload
        # Nếu có series_id, dùng endpoint series upload để quản lý file gọn hơn (nếu API hỗ trợ)
        # Nếu không, dùng endpoint upload chung (như trong bài test: /file/upload/{seriesId})
        target_id = series_id if series_id else "common"
        url = f"{self.api_url}/file/upload/{target_id}"

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                files = {"file": (os.path.basename(file_path), f, mime_type)}
                # Query param file=Cover hoặc file=Image tùy logic, ở đây để default
                response = requests.post(url, files=files)
                response.raise_for_status()
                return response.json().get(
                    "path"
                )  # Giả sử API trả về { "path": "..." }
        except Exception as e:
            print(f"   ❌ Upload failed: {e}")
            return None

    def process_content_images(self, segments, assets_root, series_id):
        """Duyệt qua các segment, nếu là Image thì upload và thay thế path"""
        for seg in segments:
            if seg.get("$type") == "Image":
                local_rel_path = seg.get("localPath")
                if local_rel_path:
                    # Ghép đường dẫn gốc data với đường dẫn tương đối của ảnh
                    full_local_path = os.path.join(assets_root, local_rel_path)

                    print(f"     -> Uploading content image: {local_rel_path}")
                    remote_path = self.upload_file(full_local_path, series_id)

                    if remote_path:
                        # Cập nhật segment để trỏ tới ảnh trên server
                        seg["path"] = remote_path
                        # Xóa trường localPath để sạch data
                        del seg["localPath"]
        return segments

    def import_book(self, bundle_path):
        with open(bundle_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        print(f"=== Importing: {data['title']} ===")
        assets_root = data["assets_root"]

        # 1. Create Series
        series_payload = {
            "title": data["title"],
            "description": data["description"],  # API có thể cần parse raw text
            "author": data["author"],
            "tags": data["tags"],
        }
        res = requests.post(f"{self.api_url}/series", json=series_payload)
        res.raise_for_status()
        series_id = res.json().get("id")
        print(f"✅ Created Series: {series_id}")

        # 2. Upload Series Cover
        if data.get("coverImageLocal"):
            cover_path = os.path.join(assets_root, data["coverImageLocal"])
            print(f"   -> Uploading Series Cover...")
            remote_cover = self.upload_file(cover_path, series_id)
            if remote_cover:
                # Update Series với cover mới
                requests.put(
                    f"{self.api_url}/series/{series_id}",
                    json={"metadata": {"coverImage": remote_cover}},
                )

        # 3. Create Volumes
        for vol in data["volumes"]:
            vol_payload = {
                "seriesId": series_id,
                "title": vol["title"],
                "order": vol["order"],
                # Nếu volume có cover riêng, xử lý tương tự series cover
            }
            res = requests.post(f"{self.api_url}/volume", json=vol_payload)
            res.raise_for_status()
            vol_id = res.json().get("id")
            print(f"  📂 Created Volume: {vol['title']} ({vol_id})")

            # 4. Create Chapters
            for chap in vol["chapters"]:
                # Xử lý ảnh trong nội dung TRƯỚC KHI tạo chapter
                processed_content = self.process_content_images(
                    chap["content"], assets_root, series_id
                )

                # Xử lý ảnh trong Footnotes (nếu có)
                for note in chap.get("footnotes", []):
                    for seg in note.get("segments", []):
                        # Recursively check segments in footnotes (simplified)
                        if seg.get("$type") == "Image":
                            # (Lặp lại logic upload image cho footnote nếu cần)
                            pass

                chap_payload = {
                    "volumeId": vol_id,
                    "title": chap["title"],
                    "index": chap["index"],
                    "content": processed_content,
                    "footnotes": chap.get("footnotes", []),
                }

                requests.post(f"{self.api_url}/chapter", json=chap_payload)
                print(f"    📄 Imported Chapter: {chap['title']}")


def main():
    importer = GrimoireImporter(API_URL)

    # Quét folder output của Converter
    if not os.path.exists(CONVERTER_OUTPUT_DIR):
        print("No converted data found.")
        return

    for book_folder in os.listdir(CONVERTER_OUTPUT_DIR):
        bundle_file = os.path.join(
            CONVERTER_OUTPUT_DIR, book_folder, "import_bundle.json"
        )
        if os.path.exists(bundle_file):
            try:
                importer.import_book(bundle_file)
            except Exception as e:
                print(f"❌ Error importing {book_folder}: {e}")


if __name__ == "__main__":
    main()
