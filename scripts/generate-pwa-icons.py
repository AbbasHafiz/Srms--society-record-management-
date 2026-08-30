#!/usr/bin/env python3
"""Generate teal/slate PWA PNG icons without extra Python deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

TEAL = (17, 94, 89, 255)  # #115e59
TEAL_DARK = (15, 76, 71, 255)
SLATE = (15, 23, 42, 255)  # #0f172a
WHITE = (255, 255, 255, 255)


def write_png(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        row = y * width
        for x in range(width):
            raw.extend(pixels[row + x])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def rounded_rect(x: int, y: int, size: int, radius: int) -> bool:
    # Circle-quadrant corners on a size×size box at origin 0,0
    if x < 0 or y < 0 or x >= size or y >= size:
        return False
    cx = [radius - 1, size - radius]
    cy = [radius - 1, size - radius]
    if x >= radius and x < size - radius:
        return True
    if y >= radius and y < size - radius:
        return True
    for rx in cx:
        for ry in cy:
            if (x - rx) ** 2 + (y - ry) ** 2 <= radius**2:
                return True
    return False


def letter_s(nx: float, ny: float) -> bool:
    # Unit-space S made of three bars + two stems.
    if 0.18 <= nx <= 0.82 and 0.16 <= ny <= 0.30:
        return True
    if 0.18 <= nx <= 0.82 and 0.43 <= ny <= 0.57:
        return True
    if 0.18 <= nx <= 0.82 and 0.70 <= ny <= 0.84:
        return True
    if 0.18 <= nx <= 0.34 and 0.16 <= ny <= 0.57:
        return True
    if 0.66 <= nx <= 0.82 and 0.43 <= ny <= 0.84:
        return True
    return False


def letter_r(nx: float, ny: float) -> bool:
    if 0.18 <= nx <= 0.34 and 0.16 <= ny <= 0.84:
        return True
    if 0.18 <= nx <= 0.82 and 0.16 <= ny <= 0.30:
        return True
    if 0.18 <= nx <= 0.82 and 0.43 <= ny <= 0.57:
        return True
    if 0.66 <= nx <= 0.82 and 0.16 <= ny <= 0.57:
        return True
    # Leg
    if 0.50 <= nx <= 0.82 and abs((ny - 0.57) - (nx - 0.50) * 0.85) < 0.08 and ny >= 0.55:
        return True
    return False


def paint_icon(size: int) -> list[tuple[int, int, int, int]]:
    pad = int(size * 0.06)
    box = size - pad * 2
    radius = int(box * 0.18)
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(size):
        for x in range(size):
            # Transparent padding so maskable icons keep the mark in the safe zone
            lx, ly = x - pad, y - pad
            if not rounded_rect(lx, ly, box, radius):
                pixels.append((0, 0, 0, 0))
                continue
            # Subtle vertical gradient
            t = ly / max(box - 1, 1)
            r = int(TEAL[0] * (1 - t) + TEAL_DARK[0] * t)
            g = int(TEAL[1] * (1 - t) + TEAL_DARK[1] * t)
            b = int(TEAL[2] * (1 - t) + TEAL_DARK[2] * t)
            # Slate bar at the bottom
            if ly > box * 0.78:
                r, g, b, _ = SLATE
            # Letters SR in the upper 70%
            nx = (lx / box - 0.08) / 0.40
            ny = (ly / box - 0.14) / 0.58
            nx2 = (lx / box - 0.52) / 0.40
            if 0 <= nx <= 1 and 0 <= ny <= 1 and letter_s(nx, ny):
                pixels.append(WHITE)
            elif 0 <= nx2 <= 1 and 0 <= ny <= 1 and letter_r(nx2, ny):
                pixels.append(WHITE)
            else:
                pixels.append((r, g, b, 255))
    return pixels


def main() -> None:
    public = Path(__file__).resolve().parents[1] / "public"
    public.mkdir(exist_ok=True)
    for size, name in ((192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")):
        write_png(public / name, size, size, paint_icon(size))
        print(f"wrote {public / name}")


if __name__ == "__main__":
    main()
