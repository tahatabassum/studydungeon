class FileLimitExceededError(Exception):
    def __init__(self, code: str, message: str, limit: int, found: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.limit = limit
        self.found = found

