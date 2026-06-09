"""EXIF metadata extraction service using Pillow."""
from datetime import datetime
from typing import Optional
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
from io import BytesIO


class ExifData:
    """Structured EXIF metadata extracted from an image."""

    def __init__(self):
        self.capture_date: Optional[datetime] = None
        self.camera_model: Optional[str] = None
        self.lens_model: Optional[str] = None
        self.iso: Optional[int] = None
        self.aperture: Optional[str] = None
        self.shutter_speed: Optional[str] = None
        self.latitude: Optional[float] = None
        self.longitude: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "capture_date": self.capture_date.isoformat() if self.capture_date else None,
            "camera_model": self.camera_model,
            "lens_model": self.lens_model,
            "iso": self.iso,
            "aperture": self.aperture,
            "shutter_speed": self.shutter_speed,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


def _get_exif_dict(image: Image.Image) -> dict:
    """Get a decoded EXIF dictionary from a Pillow Image."""
    raw_exif = image.getexif()
    exif_dict = {}
    for tag_id, value in raw_exif.items():
        tag = TAGS.get(tag_id, tag_id)
        exif_dict[tag] = value
    return exif_dict


def _convert_to_degrees(value) -> Optional[float]:
    """Convert GPS coordinates stored as rationals to decimal degrees."""
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except (TypeError, IndexError, ZeroDivisionError):
        return None


def _extract_gps(image: Image.Image) -> tuple[Optional[float], Optional[float]]:
    """Extract latitude and longitude from image EXIF GPS data."""
    raw_exif = image.getexif()
    gps_ifd = raw_exif.get_ifd(0x8825)  # GPSInfo IFD

    if not gps_ifd:
        return None, None

    gps_data = {}
    for key, val in gps_ifd.items():
        tag = GPSTAGS.get(key, key)
        gps_data[tag] = val

    lat = _convert_to_degrees(gps_data.get("GPSLatitude"))
    lon = _convert_to_degrees(gps_data.get("GPSLongitude"))

    if lat and gps_data.get("GPSLatitudeRef") == "S":
        lat = -lat
    if lon and gps_data.get("GPSLongitudeRef") == "W":
        lon = -lon

    return lat, lon


def _parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """Parse EXIF datetime string to Python datetime."""
    if not dt_str:
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y:%m:%d"):
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None


def extract_exif(file_bytes: bytes) -> ExifData:
    """Extract EXIF metadata from raw image bytes.

    Args:
        file_bytes: Raw bytes of the image file.

    Returns:
        ExifData object containing extracted metadata fields.
    """
    data = ExifData()

    try:
        image = Image.open(BytesIO(file_bytes))
    except Exception:
        return data

    exif_dict = _get_exif_dict(image)

    # Camera model
    data.camera_model = exif_dict.get("Model")

    # Lens model
    data.lens_model = exif_dict.get("LensModel")

    # ISO
    iso_val = exif_dict.get("ISOSpeedRatings")
    if isinstance(iso_val, (list, tuple)):
        data.iso = int(iso_val[0]) if iso_val else None
    elif iso_val is not None:
        try:
            data.iso = int(iso_val)
        except (ValueError, TypeError):
            pass

    # Aperture (FNumber)
    fnumber = exif_dict.get("FNumber")
    if fnumber is not None:
        try:
            data.aperture = f"f/{float(fnumber):.1f}"
        except (ValueError, TypeError):
            pass

    # Shutter speed (ExposureTime)
    exposure = exif_dict.get("ExposureTime")
    if exposure is not None:
        try:
            exp_float = float(exposure)
            if exp_float >= 1:
                data.shutter_speed = f"{exp_float:.1f}s"
            else:
                denominator = round(1 / exp_float)
                data.shutter_speed = f"1/{denominator}s"
        except (ValueError, TypeError, ZeroDivisionError):
            pass

    # Capture date
    dt_original = exif_dict.get("DateTimeOriginal") or exif_dict.get("DateTime")
    if isinstance(dt_original, str):
        data.capture_date = _parse_datetime(dt_original)

    # GPS coordinates
    data.latitude, data.longitude = _extract_gps(image)

    return data
