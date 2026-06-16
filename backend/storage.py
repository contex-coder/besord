"""
Cloudinary storage adapter for Besord.
Handles image upload, deletion, and URL generation.
Free tier: 25 GB storage, 25 credits/month.
"""

import base64
import os
import uuid
from typing import List, Optional

import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
    secure=True,
)

UPLOAD_FOLDER = "besord_posts"
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB max per image


def _sanitize_base64(data: str) -> bytes:
    """Strip data URI prefix if present, return raw bytes."""
    if not data:
        raise ValueError("Empty image data")
    if "," in data and data.startswith("data:"):
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    if len(raw) > MAX_SIZE_BYTES:
        raise ValueError(f"Image too large: {len(raw)} bytes (max {MAX_SIZE_BYTES})")
    return raw


def upload_image(base64_str: str, public_id: Optional[str] = None) -> str:
    """
    Upload a single base64 image to Cloudinary.
    Returns the secure HTTPS URL.
    """
    raw = _sanitize_base64(base64_str)
    pid = public_id or f"{UPLOAD_FOLDER}/{uuid.uuid4().hex}"
    result = cloudinary.uploader.upload(
        raw,
        public_id=pid,
        folder=UPLOAD_FOLDER,
        resource_type="image",
        overwrite=False,
        quality="auto:good",          # Automatic compression without visible loss
        fetch_format="auto",          # Serve WebP/AVIF based on browser
        flags="lossy",
    )
    return result.get("secure_url", "")


def upload_images(base64_list: List[str]) -> List[str]:
    """Upload multiple images. Returns list of secure URLs."""
    urls: List[str] = []
    for b64 in base64_list:
        if b64 and len(b64) > 50:
            try:
                urls.append(upload_image(b64))
            except Exception:
                continue  # Skip failed uploads
    return urls


def delete_image(public_id: str) -> bool:
    """Delete an image from Cloudinary by public_id."""
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
        return True
    except Exception:
        return False


def is_configured() -> bool:
    """Check if Cloudinary credentials are set."""
    return bool(
        os.getenv("CLOUDINARY_CLOUD_NAME")
        and os.getenv("CLOUDINARY_API_KEY")
        and os.getenv("CLOUDINARY_API_SECRET")
    )
