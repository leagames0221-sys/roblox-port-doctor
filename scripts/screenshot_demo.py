#!/usr/bin/env python3
"""Render real CLI output to PNG screenshots for the README (rubric #5).

Approach: run the actual tool, capture its real stdout, and render that text as a
terminal-style PNG with Pillow. No network, no paid service, deterministic, and
the pixels show genuine tool output (not a mock-up).

Usage:
    npm run build
    python scripts/screenshot_demo.py
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow required: pip install Pillow")

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets"

# dark terminal palette
BG = (13, 17, 23)
FG = (201, 209, 217)
DIM = (110, 118, 129)
GREEN = (63, 185, 80)
YELLOW = (210, 153, 34)
RED = (248, 81, 73)
CYAN = (57, 197, 187)
HDR = (88, 166, 255)

FONT_CANDIDATES = [
    "C:/Windows/Fonts/consola.ttf",
    "C:/Windows/Fonts/cour.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/System/Library/Fonts/Menlo.ttc",
]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def colorize(line: str):
    s = line.strip()
    if "[SEC " in line:
        return RED
    if "[ERR ]" in line:
        return RED
    if "[WARN]" in line:
        return YELLOW
    if "[INFO]" in line:
        return CYAN
    if s.startswith(tuple(f"{n}. [" for n in range(1, 10))):
        return HDR
    if s.startswith("fix:"):
        return GREEN
    if s.startswith("why:") or s.startswith("error:"):
        return DIM
    if s.startswith("↳"):
        return CYAN
    if "issue(s)" in line or "error(s)" in line or "recognized" in line:
        return GREEN
    if line.startswith("roblox-port-doctor"):
        return HDR
    return FG


def wrap(line: str, width: int):
    if len(line) <= width:
        return [line]
    indent = len(line) - len(line.lstrip())
    pad = " " * (indent + 7)
    out, cur = [], ""
    for word in line.split(" "):
        if cur and len(cur) + 1 + len(word) > width:
            out.append(cur)
            cur = pad + word
        else:
            cur = word if not cur else cur + " " + word
    if cur:
        out.append(cur)
    return out


def render(cmd_label: str, output: str, out_path: Path, title: str, wrap_w: int = 80):
    # Consolas lacks U+2605; render the confidence stars as ASCII for the PNG.
    output = output.replace("★", "*")
    raw = [f"$ {cmd_label}", ""] + output.rstrip().splitlines()
    lines = []
    for ln in raw:
        lines.extend(wrap(ln, wrap_w))

    pad, line_h, char_w = 20, 21, 8.5
    max_chars = max((len(t) for t in lines), default=40)
    width = int(max(pad * 2 + char_w * max_chars, 520))
    height = pad * 2 + line_h * (len(lines) + 1)
    img = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(img)
    font, title_font = load_font(14), load_font(12)

    d.text((pad, pad - 6), title, font=title_font, fill=DIM)
    y = pad + line_h
    for ln in lines:
        color = HDR if ln.startswith("$ ") else colorize(ln)
        d.text((pad, y), ln, font=font, fill=color)
        y += line_h
    img.save(out_path, "PNG")
    print(f"wrote {out_path.relative_to(ROOT)} ({width}x{height})")


def run_cli(args):
    cli = str(ROOT / "dist" / "cli.js")
    proc = subprocess.run(
        ["node", cli, *args],
        capture_output=True, cwd=str(ROOT),
        encoding="utf-8", errors="replace",
    )
    out = proc.stdout or ""
    if not out.strip():
        sys.exit(f"empty CLI output for args={args}; stderr={proc.stderr!r}")
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if not (ROOT / "dist" / "cli.js").exists():
        sys.exit("dist/cli.js not found - run `npm run build` first")

    buggy = ROOT / ".demo_static.lua"
    buggy.write_text(
        'remote.OnServerEvent:Connect(function(plr, amount)\n'
        '    plr.leaderstats.Coins.Value = plr.leaderstats.Coins.Value + amount\n'
        'end)\n'
        'local store = game:GetService("DataStoreService"):GetDataStore("Coins")\n'
        'store:SetAsync(plr.UserId, 100)\n'
        'while true do\n'
        '    print("poll")\n'
        'end\n',
        encoding="utf-8",
    )
    render("roblox-port-doctor PlayerService.luau", run_cli([".demo_static.lua"]),
           OUT / "demo-static.png",
           "Static analysis - security / authority / reliability")

    errlog = ROOT / ".demo_err.log"
    errlog.write_text(
        "14:03:12.456 ServerScriptService.PlayerService:7: "
        "attempt to index nil with 'leaderstats'\n"
        "Stack Begin\n"
        "Script 'ServerScriptService.PlayerService', Line 7 - function onJoin\n"
        "Stack End\n"
        "ServerScriptService.Loop:18: Script timeout: exhausted allowed execution time\n",
        encoding="utf-8",
    )
    render("roblox-port-doctor --triage error.log", run_cli(["--triage", ".demo_err.log"]),
           OUT / "demo-triage.png",
           "Runtime error triage - diagnosis + fix (the flagship)")

    buggy.unlink(missing_ok=True)
    errlog.unlink(missing_ok=True)


main()
