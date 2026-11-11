from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.auth import auth_router, demo_router, guests_router
from app.api.documents import documents_router
from app.api.dungeons import dungeons_router
from app.api.health import health_router
from app.api.progress import progress_router
from app.api.runs import runs_router
from app.core.config import settings
from app.core.errors import (
    generic_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Idempotent startup seed for demo & pack content (P1 fix)
    try:
        from app.core.database import AsyncSessionLocal
        from app.demo.seed import seed_demo_dungeon
        async with AsyncSessionLocal() as session:
            await seed_demo_dungeon(session)
    except Exception as e:
        import logging
        logging.getLogger("studydungeon").warning("Startup seed notice: %s", str(e))
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    allowed_origins = list(set([settings.FRONTEND_ORIGIN] + settings.CORS_ORIGINS))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception Handlers
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Routers
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(demo_router)
    app.include_router(guests_router)
    app.include_router(documents_router)
    app.include_router(dungeons_router)
    app.include_router(runs_router)
    app.include_router(progress_router)

    return app


app = create_app()
