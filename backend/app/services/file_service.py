import os
import uuid
from datetime import datetime
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_upload(file_content: bytes, original_name: str, module: str) -> dict:
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    date_dir = datetime.now().strftime("%Y%m%d")
    dir_path = UPLOAD_DIR / module / date_dir
    dir_path.mkdir(parents=True, exist_ok=True)
    file_path = dir_path / stored_name
    with open(file_path, "wb") as f:
        f.write(file_content)
    return {
        "stored_name": stored_name,
        "path": str(file_path),
        "original_name": original_name,
        "size": len(file_content),
    }
