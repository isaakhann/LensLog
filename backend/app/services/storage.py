import os
import uuid
import shutil
from abc import ABC, abstractmethod
from fastapi import UploadFile
from app.core.config import settings

class StorageProvider(ABC):
    @abstractmethod
    def upload_file(self, file: UploadFile, folder: str = "photos") -> dict:
        """Uploads a file to the storage provider.
        Returns a dict containing:
        - "url": Public accessible URL
        - "storage_key": Key/ID to delete/retrieve the file later
        """
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        """Deletes a file from the storage provider using its storage key."""
        pass

class LocalStorageProvider(StorageProvider):
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    def upload_file(self, file: UploadFile, folder: str = "photos") -> dict:
        # Generate a unique secure filename
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{folder}/{uuid.uuid4()}{file_ext}"
        
        # Ensure subfolder exists
        target_path = os.path.join(self.upload_dir, folder)
        os.makedirs(target_path, exist_ok=True)
        
        full_dest_path = os.path.join(self.upload_dir, unique_filename)
        
        # Copy file content to local disk
        with open(full_dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Build local URL (relative to root server URL)
        url = f"/static/uploads/{unique_filename}"
        
        return {
            "url": url,
            "storage_key": unique_filename
        }

    def delete_file(self, storage_key: str) -> bool:
        full_path = os.path.join(self.upload_dir, storage_key)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False

class CloudinaryStorageProvider(StorageProvider):
    def __init__(self):
        import cloudinary
        import cloudinary.uploader
        
        # Configure Cloudinary credentials from settings
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True
        )
        self.uploader = cloudinary.uploader

    def upload_file(self, file: UploadFile, folder: str = "photos") -> dict:
        # Upload directly from file-like stream
        response = self.uploader.upload(
            file.file,
            folder=f"{settings.PROJECT_NAME.lower()}/{folder}"
        )
        return {
            "url": response.get("secure_url"),
            "storage_key": response.get("public_id")
        }

    def delete_file(self, storage_key: str) -> bool:
        import cloudinary.uploader
        response = cloudinary.uploader.destroy(storage_key)
        return response.get("result") == "ok"

def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_PROVIDER == "cloudinary":
        return CloudinaryStorageProvider()
    return LocalStorageProvider()
