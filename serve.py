#!/usr/bin/env python3
"""Tiny static server for the EKH pro app.  Usage: python3 serve.py [port]

Binds to 0.0.0.0 so other devices on the same network (phone on the same
Wi-Fi / hotspot) can reach it at http://<this-machine-LAN-IP>:<port>.
"""
import os, sys, socket, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173

def lan_ip():
    """Best-effort LAN IP: open a throwaway UDP socket and read the local end."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))

if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    ip = lan_ip()
    print("the EKH pro is running:")
    print(f"  on this computer   http://localhost:{PORT}")
    print(f"  on the same Wi-Fi  http://{ip}:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), handler).serve_forever()
