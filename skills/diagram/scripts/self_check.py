#!/usr/bin/env python3
"""Self-check a generated diagram HTML file, with no third-party deps.

Ships inside the skill so an agent can verify its own output:

    python <skill-dir>/scripts/self_check.py my-diagram.html

Checks, for v0.1 (static, editorial HTML/SVG):

1. The accessible-SVG contract: every non-aria-hidden <svg> carries
   role="img", aria-labelledby naming a diagram-prefixed <title> then
   <desc>, and <title> is the first child.
2. Single-file safety: no remote assets beyond the approved Google Fonts
   /css2 stylesheet, no executable attributes, no <base>/<embed>/<object>/
   <iframe>, no data: URLs beyond images, and no <script> (v0.1 is static).
3. Connector geometry (HARD-GATE 2/3): no diagonal <line> connectors and no
   straight slanted <path> segments; every arrow-label mask sits at least 6px
   clear of the nearest connector stroke.

Diagnostics go to stderr. Exit 0 = clean, 1 = failures, 2 = usage error.
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

REFERENCE_ATTRS = {"src", "href", "xlink:href", "poster", "srcset", "action", "formaction"}

RECT_RE = re.compile(
    r"<rect\b[^>]*?"
    r'\bx="(?P<x>-?[\d.]+)"\s+'
    r'y="(?P<y>-?[\d.]+)"\s+'
    r'width="(?P<w>[\d.]+)"\s+'
    r'height="(?P<h>[\d.]+)"',
    re.IGNORECASE,
)
LINE_RE = re.compile(
    r"<line\b[^>]*?"
    r'\bx1="(?P<x1>-?[\d.]+)"\s+'
    r'y1="(?P<y1>-?[\d.]+)"\s+'
    r'x2="(?P<x2>-?[\d.]+)"\s+'
    r'y2="(?P<y2>-?[\d.]+)"',
    re.IGNORECASE,
)
PATH_RE = re.compile(r'<path\b[^>]*?\bd="(?P<d>[^"]*)"', re.IGNORECASE)
TEXT_RE = re.compile(
    r"<text\b[^>]*?"
    r'\bx="(?P<x>-?[\d.]+)"\s+'
    r'y="(?P<y>-?[\d.]+)"[^>]*>',
    re.IGNORECASE,
)

NODE_MIN_W = 60.0
NODE_MIN_H = 40.0
MASK_MIN_W = 20.0
MASK_MAX_W = 120.0
MASK_MIN_H = 8.0
MASK_MAX_H = 14.0
LABEL_GAP = 6.0
EPSILON = 0.5


class Rect:
    __slots__ = ("x", "y", "w", "h")

    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    @property
    def right(self):
        return self.x + self.w

    @property
    def bottom(self):
        return self.y + self.h


class DiagramParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.unsafe = []
        self.references = []
        self.scripts = 0
        self.svgs = []
        self._svg_depth = 0
        self._current_svg = None
        self._capture = None

    def handle_starttag(self, tag, attrs):
        tag = tag.casefold()
        normalized = [(k.casefold(), v or "") for k, v in attrs]
        data = {k: v for k, v in normalized}
        if tag in {"base", "embed", "object", "iframe"}:
            self.unsafe.append(f"<{tag}> is not allowed in a diagram file")
        for key, value in normalized:
            if key.startswith("on"):
                self.unsafe.append(f"executable attribute {key} on <{tag}>")
            if key == "srcdoc":
                self.unsafe.append(f"srcdoc attribute on <{tag}>")
            if key in REFERENCE_ATTRS:
                self.references.append((tag, data.get("rel", ""), value))
        if tag == "script":
            self.scripts += 1
        if tag == "svg" and self._svg_depth == 0:
            self._svg_depth = 1
            self._current_svg = {"attrs": data, "first": None, "title": {}, "desc": {}}
            self.svgs.append(self._current_svg)
            return
        if self._svg_depth:
            self._svg_depth += 1
            if self._current_svg is not None:
                if self._svg_depth == 2 and self._current_svg["first"] is None:
                    self._current_svg["first"] = tag
                if self._svg_depth == 2 and tag in {"title", "desc"}:
                    self._current_svg[tag] = {"attrs": data, "text": ""}
                    self._capture = tag

    def handle_endtag(self, tag):
        tag = tag.casefold()
        if self._svg_depth:
            if tag in {"title", "desc"}:
                self._capture = None
            self._svg_depth -= 1
            if self._svg_depth == 0:
                self._current_svg = None

    def handle_data(self, data):
        if self._capture and self._current_svg:
            node = self._current_svg[self._capture]
            node["text"] = str(node.get("text", "")) + data


def is_approved_google_fonts_stylesheet(value):
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname is not None
        and parsed.hostname.casefold() == "fonts.googleapis.com"
        and parsed.port is None
        and parsed.path == "/css2"
        and not parsed.fragment
    )


def reference_error(tag, rel, value):
    stripped = value.strip()
    lowered = stripped.casefold()
    if not stripped or stripped.startswith("#"):
        return None
    if lowered.startswith("javascript:") or lowered.startswith("data:text/html"):
        return f"executable URL on <{tag}>: {stripped[:80]}"
    remote = lowered.startswith(("http://", "https://", "//")) or (
        ":" in stripped.split("/", 1)[0] and not lowered.startswith("data:")
    )
    if not remote:
        if lowered.startswith("data:") and not lowered.startswith("data:image/"):
            return f"non-image data URL on <{tag}>: {stripped[:80]}"
        return None
    if tag == "link" and "stylesheet" in rel.casefold().split():
        if is_approved_google_fonts_stylesheet(stripped):
            return None
        return f"remote stylesheet is not the approved Google Fonts /css2 URL: {stripped[:80]}"
    return f"remote reference on <{tag}>: {stripped[:80]}"


def check_svgs(parser, errors):
    checkable = [
        svg
        for svg in parser.svgs
        if str(svg["attrs"].get("aria-hidden", "")).casefold() != "true"
    ]
    if not checkable:
        errors.append("diagram file needs at least one accessible (non-aria-hidden) SVG")
    for number, svg in enumerate(checkable, 1):
        attrs = svg["attrs"]
        if attrs.get("role") != "img":
            errors.append(f"svg {number} needs role=img")
        labelled = attrs.get("aria-labelledby", "").split()
        title = svg["title"]
        desc = svg["desc"]
        if svg["first"] != "title":
            errors.append(f"svg {number} title must be its first child")
        if not str(title.get("text", "")).strip() or not str(desc.get("text", "")).strip():
            errors.append(f"svg {number} needs non-empty title and desc")
        title_id = title.get("attrs", {}).get("id", "")
        desc_id = desc.get("attrs", {}).get("id", "")
        if title_id in {"", "title"} or desc_id in {"", "desc"}:
            errors.append(f"svg {number} title/desc IDs must be diagram-prefixed, never bare")
        if labelled != [title_id, desc_id]:
            errors.append(f"svg {number} aria-labelledby must name title then desc")


def _path_commands(d):
    """Yield (command, [args]) tokens from an SVG path `d` string."""
    tokens = re.findall(r"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?", d)
    i = 0
    while i < len(tokens):
        if re.fullmatch(r"[A-Za-z]", tokens[i]):
            cmd = tokens[i]
            i += 1
        else:
            cmd = None
        args = []
        while i < len(tokens) and not re.fullmatch(r"[A-Za-z]", tokens[i]):
            args.append(float(tokens[i]))
            i += 1
        yield cmd, args


def path_straight_segments(d):
    """Yield (x1,y1,x2,y2) straight segments from an SVG path."""
    segments = []
    x = y = 0.0
    start_x = start_y = 0.0
    for cmd, args in _path_commands(d):
        if cmd in "Mm":
            for k in range(0, len(args) - 1, 2):
                dx, dy = args[k], args[k + 1]
                if cmd == "M":
                    x, y = dx, dy
                else:
                    x, y = x + dx, y + dy
                start_x, start_y = x, y
        elif cmd in "Ll":
            for k in range(0, len(args) - 1, 2):
                nx = args[k] if cmd == "L" else x + args[k]
                ny = args[k + 1] if cmd == "L" else y + args[k + 1]
                segments.append((x, y, nx, ny))
                x, y = nx, ny
        elif cmd in "Hh":
            for a in args:
                nx = a if cmd == "H" else x + a
                segments.append((x, y, nx, y))
                x = nx
        elif cmd in "Vv":
            for a in args:
                ny = a if cmd == "V" else y + a
                segments.append((x, y, x, ny))
                y = ny
        elif cmd in "Qq":
            for k in range(0, len(args) - 3, 4):
                if cmd == "Q":
                    x, y = args[k + 2], args[k + 3]
                else:
                    x, y = x + args[k + 2], y + args[k + 3]
        elif cmd in "Cc":
            for k in range(0, len(args) - 5, 6):
                if cmd == "C":
                    x, y = args[k + 4], args[k + 5]
                else:
                    x, y = x + args[k + 4], y + args[k + 5]
        elif cmd in "Tt":
            for k in range(0, len(args) - 1, 2):
                if cmd == "T":
                    x, y = args[k], args[k + 1]
                else:
                    x, y = x + args[k], y + args[k + 1]
        elif cmd in "Ss":
            for k in range(0, len(args) - 3, 4):
                if cmd == "S":
                    x, y = args[k + 2], args[k + 3]
                else:
                    x, y = x + args[k + 2], y + args[k + 3]
        elif cmd in "Aa":
            for k in range(0, len(args) - 6, 7):
                if cmd == "A":
                    x, y = args[k + 5], args[k + 6]
                else:
                    x, y = x + args[k + 5], y + args[k + 6]
        elif cmd in "Zz":
            x, y = start_x, start_y
    return segments


def _point_to_rect_distance(px, py, rect):
    dx = max(rect.x - px, 0.0, px - rect.right)
    dy = max(rect.y - py, 0.0, py - rect.bottom)
    return math.hypot(dx, dy)


def _segment_rect_distance(x1, y1, x2, y2, rect):
    best = math.inf
    steps = 32
    for i in range(steps + 1):
        t = i / steps
        px = x1 + (x2 - x1) * t
        py = y1 + (y2 - y1) * t
        best = min(best, _point_to_rect_distance(px, py, rect))
    return best


def check_geometry(source, errors):
    rects = [Rect(float(m["x"]), float(m["y"]), float(m["w"]), float(m["h"])) for m in RECT_RE.finditer(source)]
    nodes = [r for r in rects if r.w >= NODE_MIN_W and r.h >= NODE_MIN_H]
    masks = [r for r in rects if MASK_MIN_W <= r.w <= MASK_MAX_W and MASK_MIN_H <= r.h <= MASK_MAX_H]

    segments = []
    for m in LINE_RE.finditer(source):
        x1, y1 = float(m["x1"]), float(m["y1"])
        x2, y2 = float(m["x2"]), float(m["y2"])
        if abs(x2 - x1) > EPSILON and abs(y2 - y1) > EPSILON:
            errors.append("diagonal <line> connector (HARD-GATE 2): off-axis nodes must use orthogonal elbows")
            continue
        segments.append((x1, y1, x2, y2))

    for m in PATH_RE.finditer(source):
        for x1, y1, x2, y2 in path_straight_segments(m["d"]):
            if abs(x2 - x1) > EPSILON and abs(y2 - y1) > EPSILON:
                errors.append("diagonal straight segment in <path> (HARD-GATE 2): use orthogonal elbows")
            segments.append((x1, y1, x2, y2))

    def contained(inner, outer):
        return (
            inner.x >= outer.x - EPSILON
            and inner.y >= outer.y - EPSILON
            and inner.right <= outer.right + EPSILON
            and inner.bottom <= outer.bottom + EPSILON
        )

    for mask in masks:
        if any(contained(mask, node) for node in nodes):
            continue  # badge chip inside a node — legal
        nearest = min(
            (_segment_rect_distance(x1, y1, x2, y2, mask) for x1, y1, x2, y2 in segments),
            default=math.inf,
        )
        if nearest < LABEL_GAP - EPSILON:
            errors.append(
                f"arrow-label mask at ({mask.x:g},{mask.y:g}) sits {nearest:.2f}px from a connector "
                f"(HARD-GATE 3): needs a 6-10px gap off the stroke"
            )


def verify(path):
    source = path.read_text(encoding="utf-8")
    parser = DiagramParser()
    parser.feed(source)
    parser.close()

    errors = []
    errors.extend(parser.unsafe)
    for tag, rel, value in parser.references:
        finding = reference_error(tag, rel, value)
        if finding:
            errors.append(finding)
    if parser.scripts:
        errors.append(f"found {parser.scripts} <script> tag(s): v0.1 diagrams are static — no scripts allowed")
    check_svgs(parser, errors)
    check_geometry(source, errors)
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path, help="HTML diagrams to check")
    args = parser.parse_args()

    failed = False
    for path in args.files:
        try:
            errors = verify(path)
        except (OSError, UnicodeError) as exc:
            errors = [str(exc)]
        if errors:
            failed = True
            print(f"FAIL {path}", file=sys.stderr)
            for error in errors:
                print(f"  - {error}", file=sys.stderr)
        else:
            print(f"OK {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
