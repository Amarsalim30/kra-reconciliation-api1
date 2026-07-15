from typing import Any, Dict, Optional
import threading


class SettingsCache:
    """
    In-memory configuration cache manager. Thread-safe and invalidation-capable.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._cache: Dict[str, Any] = {}
        self._cached_version: Optional[int] = None

    def get_cached(self, version: int) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._cached_version == version:
                return dict(self._cache)
            return None

    def set_cached(self, version: int, data: Dict[str, Any]) -> None:
        with self._lock:
            self._cached_version = version
            self._cache = dict(data)

    def invalidate(self) -> None:
        with self._lock:
            self._cached_version = None
            self._cache.clear()

    @property
    def current_version(self) -> Optional[int]:
        with self._lock:
            return self._cached_version


settings_cache = SettingsCache()
