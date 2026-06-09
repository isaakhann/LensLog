import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.endpoints import auth, users, photos, collections, social

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS setup
origins = [origin.strip() for origin in settings.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]
allow_credentials = True
if "*" in origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure local upload dir exists
if settings.STORAGE_PROVIDER == "local":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount(
        "/static",
        StaticFiles(directory="static"),
        name="static"
    )

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(photos.router, prefix="/photos", tags=["photos"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(social.router, prefix="/social", tags=["social"])
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}
