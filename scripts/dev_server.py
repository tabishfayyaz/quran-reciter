#!/usr/bin/env python3
"""Serve the static app locally with HTTP byte-range support for audio seeking."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import sys


class RangeRequestHandler(SimpleHTTPRequestHandler):
    def send_range_error(self, size, message):
        self.send_response(416, message)
        self.send_header("Content-Range", f"bytes */{size}")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def send_head(self):
        self._byte_range = None
        range_header = self.headers.get("Range")
        if not range_header:
            return super().send_head()

        path = Path(self.translate_path(self.path))
        if path.is_dir():
            return super().send_head()
        try:
            source = path.open("rb")
            size = path.stat().st_size
        except OSError:
            self.send_error(404, "File not found")
            return None

        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match or (not match.group(1) and not match.group(2)):
            source.close()
            self.send_range_error(size, "Invalid byte range")
            return None

        first, last = match.groups()
        if first:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        else:
            suffix_length = int(last)
            start = max(0, size - suffix_length)
            end = size - 1
        if start >= size or end < start or size == 0:
            source.close()
            self.send_range_error(size, "Range not satisfiable")
            return None

        self._byte_range = (start, end)
        source.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        if self._byte_range is None:
            return super().copyfile(source, outputfile)
        remaining = self._byte_range[1] - self._byte_range[0] + 1
        while remaining:
            block = source.read(min(64 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(RangeRequestHandler, directory=str(root))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"Serving {root} at http://localhost:{port}/ (Ctrl-C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
