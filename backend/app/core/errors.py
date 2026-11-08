from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        detail = {"code": f"HTTP_{exc.status_code}", "message": detail}
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": detail},
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
    )
