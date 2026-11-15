from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings


def _cors_headers_for_request(request: Request) -> dict[str, str]:
    headers = {}
    origin = request.headers.get("origin")
    allowed_origins = set([settings.FRONTEND_ORIGIN] + settings.CORS_ORIGINS)
    if origin and (origin in allowed_origins or "*" in allowed_origins):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Vary"] = "Origin"
    return headers


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        detail = {"code": f"HTTP_{exc.status_code}", "message": detail}
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
        headers=_cors_headers_for_request(request),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Sanitize errors to ensure JSON serializability across all pydantic custom validators
    safe_errors = []
    for err in exc.errors():
        err_copy = dict(err)
        if "ctx" in err_copy and "error" in err_copy["ctx"]:
            err_copy["ctx"]["error"] = str(err_copy["ctx"]["error"])
        safe_errors.append(err_copy)

    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request parameters or payload",
                "errors": safe_errors,
            }
        },
        headers=_cors_headers_for_request(request),
    )


async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
            }
        },
        headers=_cors_headers_for_request(request),
    )
