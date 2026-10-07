from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any


HTTP_SESSION_TTL_SECONDS = 60 * 60
MAX_TRACKED_SESSION_ALIASES = 512


@dataclass
class HTTPSessionRecord:
    runtime: Any
    last_seen: float


class HTTPSessionManager:
    """Route all authenticated HTTP sessions through one shared Runtime.

    Tunnel clients may create a fresh MCP session for nearly every command.
    Protocol ids are lightweight aliases; commands, outputs, caches and task
    state remain process-global.
    """

    def __init__(self, runtime: Any) -> None:
        self._runtime = runtime
        self._sessions: dict[str, HTTPSessionRecord] = {}
        self._lock = threading.Lock()
        self._closed = False

    def create(self) -> Any:
        self.prune()
        with self._lock:
            if self._closed:
                raise RuntimeError("HTTP session manager is closed")
            self._sessions[self._runtime.http_session_id] = HTTPSessionRecord(
                runtime=self._runtime,
                last_seen=time.time(),
            )
            self._trim_locked()
            return self._runtime

    def get(self, session_id: str) -> Any | None:
        self.prune()
        with self._lock:
            if self._closed:
                return None
            # An authenticated session id is an alias for the process Runtime.
            # This keeps reconnects working when a proxy retains an old id.
            self._sessions[session_id] = HTTPSessionRecord(
                runtime=self._runtime,
                last_seen=time.time(),
            )
            self._trim_locked()
            return self._runtime

    def delete(self, session_id: str) -> bool:
        with self._lock:
            if self._closed:
                return False
            self._sessions.pop(session_id, None)
            return True

    def prune(self) -> None:
        cutoff = time.time() - HTTP_SESSION_TTL_SECONDS
        with self._lock:
            expired = [
                session_id
                for session_id, record in self._sessions.items()
                if record.last_seen < cutoff
            ]
            for session_id in expired:
                self._sessions.pop(session_id, None)
            self._trim_locked()

    def _trim_locked(self) -> None:
        if len(self._sessions) <= MAX_TRACKED_SESSION_ALIASES:
            return
        newest = sorted(
            self._sessions.items(),
            key=lambda item: item[1].last_seen,
            reverse=True,
        )[:MAX_TRACKED_SESSION_ALIASES]
        self._sessions = dict(newest)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "tracked_aliases": len(self._sessions),
                "shared_runtimes": 0 if self._closed else 1,
            }

    def close(self) -> None:
        with self._lock:
            self._closed = True
            self._sessions.clear()
