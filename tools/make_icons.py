#!/usr/bin/env python3
"""Draws the extension icons (a pawn emitting sound waves) at 16, 48 and 128 px.

Usage:  python3 tools/make_icons.py        (needs Pillow)
Output: icons/icon16.png, icons/icon48.png, icons/icon128.png
"""
import os

from PIL import Image, ImageDraw

BG = (27, 31, 39, 255)
PAWN = (233, 237, 244, 255)
WAVE = (38, 194, 163, 255)
S = 1024  # drawing size, scaled down afterwards for smooth edges


def draw_master():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, S - 1, S - 1), radius=210, fill=BG)

    # pawn, left of centre
    cx = 380
    d.ellipse((cx - 105, 215, cx + 105, 425), fill=PAWN)  # head
    d.rounded_rectangle((cx - 120, 420, cx + 120, 480), radius=30, fill=PAWN)  # collar
    d.polygon([(cx - 80, 470), (cx + 80, 470), (cx + 175, 720), (cx - 175, 720)], fill=PAWN)  # body
    d.rounded_rectangle((cx - 225, 700, cx + 225, 800), radius=45, fill=PAWN)  # base

    # sound waves, right of the pawn
    ox, oy = 610, 500
    for r, w in ((120, 50), (230, 50), (340, 50)):
        d.arc((ox - r, oy - r, ox + r, oy + r), start=-42, end=42, fill=WAVE, width=w)
    return img


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
    os.makedirs(out, exist_ok=True)
    master = draw_master()
    for size in (16, 48, 128):
        master.resize((size, size), Image.LANCZOS).save(os.path.join(out, f"icon{size}.png"))
        print("wrote", f"icon{size}.png")


if __name__ == "__main__":
    main()
