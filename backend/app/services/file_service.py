import os
import uuid
from datetime import datetime

UPLOAD_DIR = os.path.expanduser("~/.omni/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_upload(file_content: bytes, original_name: str, module: str) -> dict:
    ext = os.path.splitext(original_name)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    date_dir = datetime.now().strftime("%Y%m%d")
    dir_path = os.path.join(UPLOAD_DIR, module, date_dir)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, stored_name)
    with open(file_path, "wb") as f:
        f.write(file_content)
    return {
        "stored_name": stored_name,
        "path": file_path,
        "original_name": original_name,
        "size": len(file_content),
    }
