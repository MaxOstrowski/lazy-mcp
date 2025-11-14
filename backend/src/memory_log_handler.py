import logging


class MemoryLogHandler(logging.Handler):
    """In-memory log handler for collecting logs during LLMClient operations."""

    def __init__(self) -> None:
        """Initialize the memory log handler."""
        super().__init__()
        self.records: list[dict[str, str]] = []

    def emit(self, record: logging.LogRecord) -> None:
        """Store a log record in memory."""
        self.records.append(
            {
                "level": record.levelname,
                "message": record.getMessage(),
                "time": self.formatTime(record),
            }
        )

    def formatTime(self, record: logging.LogRecord) -> str:
        """Format the log record time as a string."""
        import datetime

        ct = datetime.datetime.fromtimestamp(record.created)
        return ct.strftime("%Y-%m-%d %H:%M:%S")

    def get_and_clear_logs(self) -> list[dict[str, str]]:
        """Return and clear all stored log records."""
        logs = self.records.copy()
        self.records.clear()
        return logs
