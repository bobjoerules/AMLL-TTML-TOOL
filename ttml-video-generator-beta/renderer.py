"""
Video Rendering Engine Module.
Renders sub-pixel word-synchronized karaoke lyrics with bouncing objects
directly into transparent alpha video (Apple ProRes 4444 MOV, QuickTime Animation RLE, WebM VP9, or PNG MOV).
"""

from dataclasses import dataclass
import collections
import glob
import math
import os
import shutil
import subprocess
import sys
import threading
import time
from typing import Callable, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
from ttml_parser import LyricLine, LyricWord, TTMLDocument


@dataclass
class VideoStyleConfig:
    width: int = 1920
    height: int = 1080
    fps: float = 60.0                                                 # 60 fps default for ultra-smooth fluid animation
    position: str = "middle"                                          # "top", "middle" (center), or "bottom"
    baseline_y_ratio: float = 0.50                                    # 0.22 = top, 0.50 = middle, 0.78 = bottom
    font_name: str = "Open Sans"
    font_size: int = 68
    inactive_color: Tuple[int, int, int, int] = (210, 210, 220, 180)  # Silver/gray semi-transparent
    active_color: Tuple[int, int, int, int] = (255, 215, 40, 255)     # Golden yellow
    shadow_color: Tuple[int, int, int, int] = (0, 0, 0, 160)          # Soft drop shadow
    shadow_offset: Tuple[int, int] = (2, 3)
    enable_shadow: bool = True
    enable_bounce: bool = True
    bounce_shape: str = "circle"                                      # "circle", "star", "note", "glow"
    bounce_color: Tuple[int, int, int, int] = (255, 60, 95, 255)      # Vibrant coral/pink
    bounce_size: int = 18                                             # Radius in pixels
    bounce_height: float = 60.0                                       # Arc peak height in pixels
    single_line_mode: bool = True
    format_type: str = "prores"                                       # "prores", "qtrle", "webm", "png_mov", "mp4"
    skip_short_words: bool = True                                     # Skip bouncing on micro-syllables near another word
    min_bounce_duration: float = 0.22                                 # Duration threshold in seconds for skipping
    background_image: Optional[str] = None                            # Optional path to custom background image
    bounce_image: Optional[str] = None                                # Optional path to custom bounce object image (PNG/JPG)
    filter_background_vocals: bool = True                             # Filter out background vocals (x-bg) to preserve lead vocal sync


def resolve_font(font_name: str, size: int) -> ImageFont.FreeTypeFont:
    """Finds a matching system or local TTF/OTF font file and loads it."""
    if os.path.isfile(font_name):
        try:
            return ImageFont.truetype(font_name, size)
        except Exception:
            pass

    font_dirs = [
        "/System/Library/Fonts",
        "/System/Library/Fonts/Supplemental",
        "/Library/Fonts",
        os.path.expanduser("~/Library/Fonts"),
        "C:\\Windows\\Fonts",
        "/usr/share/fonts",
        "/usr/local/share/fonts",
    ]

    target = font_name.lower().replace(" ", "").replace("-", "")

    if target in ("opensans", "sans", "sansserif"):
        candidates = ["OpenSans-Bold.ttf", "OpenSans.ttf", "SFPro-Bold.ttf", "Arial Bold.ttf", "Helvetica.ttc", "Arial.ttf"]
    else:
        candidates = [f"{font_name}.ttf", f"{font_name}-Bold.ttf", f"{font_name}.otf", f"{font_name}.ttc"]

    for d in font_dirs:
        if not os.path.isdir(d):
            continue
        for c in candidates:
            p = os.path.join(d, c)
            if os.path.isfile(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass

        for f in glob.glob(os.path.join(d, "*.*")):
            b = os.path.basename(f).lower().replace(" ", "").replace("-", "")
            if target in b and f.lower().endswith((".ttf", ".otf", ".ttc")):
                try:
                    return ImageFont.truetype(f, size)
                except Exception:
                    pass

    for fallback in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNSText.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]:
        if os.path.isfile(fallback):
            try:
                return ImageFont.truetype(fallback, size)
            except Exception:
                pass

    return ImageFont.load_default()


@dataclass
class WordLayout:
    word: LyricWord
    index: int
    text: str
    x_start: float
    x_end: float
    centroid_x: float  # Center of visible characters (excluding trailing space)
    width: float


class LineLayout:
    """Pre-computed layout and rasterized layers for a single line of lyrics."""
    def __init__(
        self,
        line: LyricLine,
        index: int,
        font: ImageFont.FreeTypeFont,
        style: VideoStyleConfig,
        baseline_y: float,
    ):
        self.line = line
        self.index = index
        self.baseline_y = baseline_y
        ref_size = 18.0 * (style.height / 1080.0)
        self.ground_y = baseline_y - (style.font_size * 0.16) - (style.bounce_size - ref_size)
        self.bounce_height = style.bounce_height
        self.bounce_size = style.bounce_size

        dummy_img = Image.new("RGBA", (1, 1))
        draw = ImageDraw.Draw(dummy_img)

        # 1. Measure all words using typographic advance
        word_layouts: List[WordLayout] = []
        current_x = 0.0

        # Ensure words are sorted monotonically by start_time
        sorted_words = sorted(line.words, key=lambda w: w.start_time)
        for i, w in enumerate(sorted_words):
            advance_w = max(1.0, float(draw.textlength(w.text, font=font)))
            # Compute center of visible letters (excluding trailing whitespace)
            clean_text = w.text.rstrip()
            clean_w = float(draw.textlength(clean_text, font=font)) if clean_text else advance_w
            cx = current_x + (clean_w / 2.0)

            word_layouts.append(
                WordLayout(
                    word=w,
                    index=i,
                    text=w.text,
                    x_start=current_x,
                    x_end=current_x + advance_w,
                    centroid_x=cx,
                    width=advance_w,
                )
            )
            current_x += advance_w

        self.words = word_layouts
        self.total_width = current_x

        # 2. Horizontally center line on screen
        start_x = (style.width - self.total_width) / 2.0
        self.start_x = start_x

        for wl in self.words:
            wl.x_start += start_x
            wl.x_end += start_x
            wl.centroid_x += start_x

        # 3. Pre-rasterize base (inactive) image with shadow
        self.base_img = Image.new("RGBA", (style.width, style.height), (0, 0, 0, 0))
        d_base = ImageDraw.Draw(self.base_img)

        if style.enable_shadow:
            sx, sy = style.shadow_offset
            for wl in self.words:
                d_base.text((wl.x_start + sx, self.baseline_y + sy), wl.text, font=font, fill=style.shadow_color)

        for wl in self.words:
            d_base.text((wl.x_start, self.baseline_y), wl.text, font=font, fill=style.inactive_color)

        # 4. Pre-rasterize active (highlighted) image
        self.active_img = Image.new("RGBA", (style.width, style.height), (0, 0, 0, 0))
        d_active = ImageDraw.Draw(self.active_img)

        if style.enable_shadow:
            sx, sy = style.shadow_offset
            for wl in self.words:
                d_active.text((wl.x_start + sx, self.baseline_y + sy), wl.text, font=font, fill=style.shadow_color)

        for wl in self.words:
            d_active.text((wl.x_start, self.baseline_y), wl.text, font=font, fill=style.active_color)

        # 5. Select bounce targets (optionally skipping rapid micro-syllables near other words)
        if style.skip_short_words:
            self.bounce_words = self._select_bounce_words(self.words, style.min_bounce_duration)
        else:
            self.bounce_words = self.words

    @staticmethod
    def _select_bounce_words(words: List[WordLayout], min_duration: float = 0.22) -> List[WordLayout]:
        """Filters out very short micro-syllables that are close to another word to keep bounce rhythm smooth."""
        if len(words) <= 2:
            return words

        selected: List[WordLayout] = [words[0]]

        for i in range(1, len(words) - 1):
            prev_target = selected[-1]
            cur_w = words[i]
            next_w = words[i + 1]

            dur = cur_w.word.duration
            time_from_prev = cur_w.word.start_time - prev_target.word.start_time
            time_to_next = next_w.word.start_time - cur_w.word.start_time

            # If this word is very short and close to previous or next word, skip it so the ball arcs across smoothly
            if dur < min_duration and (time_from_prev < 0.32 or time_to_next < 0.32):
                continue

            selected.append(cur_w)

        if selected[-1] != words[-1]:
            selected.append(words[-1])

        return selected

    def get_reveal_x(self, t: float) -> float:
        """Returns the horizontal cutoff coordinate X up to which lyrics are highlighted in active color."""
        if not self.words:
            return 0.0

        first_w = self.words[0].word
        last_w = self.words[-1].word

        if t < first_w.start_time:
            return 0.0
        if t >= last_w.end_time:
            return self.words[-1].x_end

        # Check each word
        for wl in self.words:
            w = wl.word
            if t < w.start_time:
                # Ahead of current time
                continue
            elif w.start_time <= t < w.end_time:
                # Progressive sweep across word
                dur = max(0.001, w.duration)
                p = max(0.0, min(1.0, (t - w.start_time) / dur))
                return wl.x_start + (wl.width * p)
            elif t >= w.end_time:
                # Fully sung
                continue

        # If in gap between words, reveal up to the last sung word's end
        for i in range(len(self.words) - 1):
            if self.words[i].word.end_time <= t < self.words[i + 1].word.start_time:
                return self.words[i].x_end

        return 0.0

    def get_ball_pos(self, t: float) -> Optional[Tuple[float, float]]:
        """
        Calculates fluid, continuous bouncing ball trajectory (x, y).
        The ball arcs in from the left and impacts (bounces) squarely in the middle
        of each word/syllable (centroid_x) at the exact moment it is sung, and smoothly
        arcs between words without vanishing or starting prematurely in the middle.
        """
        if not self.bounce_words:
            return None

        words = self.bounce_words
        first_w = words[0]
        last_w = words[-1]

        # Left starting position (comfortably to the left of the first word's letters)
        left_start_x = first_w.x_start - max(36.0, self.bounce_height * 0.5, float(self.bounce_size) * 2.2)

        # 1. Before first word of the line
        if t < first_w.word.start_time:
            lead = first_w.word.start_time - t
            # Don't show the ball if line is displayed far in advance (> 1.2s before vocals)
            if lead > 1.2:
                return None
            elif lead > 0.65:
                # Rest at the left of the first word waiting to bounce in (never in the middle!)
                return (left_start_x, self.ground_y)
            else:
                # Arc gracefully IN from the left, landing right in the middle of the first word on beat!
                tau = max(0.0, min(1.0, (0.65 - lead) / 0.65))
                x = left_start_x + tau * (first_w.centroid_x - left_start_x)
                y = self.ground_y - 4.0 * self.bounce_height * tau * (1.0 - tau)
                return (x, y)

        # 2. On or after last word of the line: bounce OFF to the right!
        if t >= last_w.word.start_time:
            dur = max(0.001, last_w.word.duration)
            exit_dur = max(0.40, min(0.85, dur))
            p = (t - last_w.word.start_time) / exit_dur
            if p <= 1.0:
                # Arcs from last word's center up and OUT past the right of the line
                exit_x = last_w.x_end + max(60.0, self.bounce_height * 1.1, float(self.bounce_size) * 2.5)
                x = last_w.centroid_x + p * (exit_x - last_w.centroid_x)
                y = self.ground_y - 4.0 * self.bounce_height * p * (1.0 - p)
                return (x, y)
            else:
                # Has bounced off and exited the line
                return None

        # 3. Between consecutive words in the line
        for i in range(len(words) - 1):
            w_cur = words[i]
            w_next = words[i + 1]
            t_start = w_cur.word.start_time
            t_next = w_next.word.start_time

            if t_start <= t < t_next:
                gap = max(0.001, t_next - t_start)
                if gap <= 2.2:
                    # Natural continuous parabolic arc when word is sung, landing on next word on beat!
                    tau = (t - t_start) / gap
                    tau = max(0.0, min(1.0, tau))
                    x = w_cur.centroid_x + tau * (w_next.centroid_x - w_cur.centroid_x)
                    y = self.ground_y - 4.0 * self.bounce_height * tau * (1.0 - tau)
                    return (x, y)
                else:
                    # Rare long gap (> 2.2s): bounce on current word when sung, rest during silence, then arc into next
                    bounce_dur = min(0.65, w_cur.word.duration)
                    if t < t_start + bounce_dur:
                        tau = (t - t_start) / max(0.001, bounce_dur)
                        y = self.ground_y - 4.0 * self.bounce_height * tau * (1.0 - tau)
                        return (w_cur.centroid_x, y)
                    elif t < t_next - 0.5:
                        return (w_cur.centroid_x, self.ground_y)
                    else:
                        tau = (t - (t_next - 0.5)) / 0.5
                        tau = max(0.0, min(1.0, tau))
                        x = w_cur.centroid_x + tau * (w_next.centroid_x - w_cur.centroid_x)
                        y = self.ground_y - 4.0 * self.bounce_height * tau * (1.0 - tau)
                        return (x, y)

        return (last_w.centroid_x, self.ground_y)


@dataclass
class LineSchedule:
    line_layout: LineLayout
    show_start: float
    show_end: float


def build_line_schedule(
    doc: TTMLDocument,
    layouts: List[LineLayout],
    single_line_mode: bool = True,
) -> List[LineSchedule]:
    """
    Pre-schedules display windows for every line.
    - Single Line Mode: Exactly one line visible at a time.
    - Two-Line Mode: Alternating slots (Slot A / Slot B), previewing the next line while current line is sung.
    """
    schedule: List[LineSchedule] = []
    num_lines = len(doc.lines)
    if num_lines == 0:
        return schedule

    if single_line_mode:
        for i in range(num_lines):
            line = doc.lines[i]
            layout = layouts[i]

            if i == 0:
                show_start = 0.0
            else:
                prev_line = doc.lines[i - 1]
                gap = line.start_time - prev_line.end_time
                if gap <= 0:
                    # When lines overlap in audio, ensure previous line completes its vocals
                    show_start = max(line.start_time, prev_line.end_time)
                elif gap > 3.5:
                    show_start = line.start_time - 2.5
                else:
                    hold = min(0.5, gap * 0.35)
                    show_start = prev_line.end_time + hold

            show_end = max(line.end_time + 0.6, show_start + 0.5)
            schedule.append(LineSchedule(layout, show_start, show_end))

        for i in range(num_lines - 1):
            if not doc.lines[i].is_bg and doc.lines[i + 1].is_bg:
                # Next line is a background line, do not let it truncate the lead line!
                continue
            next_show_start = schedule[i + 1].show_start
            if next_show_start > schedule[i].show_start:
                schedule[i].show_end = min(schedule[i].show_end, next_show_start)
    else:
        # Two-line mode (alternating slots: even lines in Slot A, odd lines in Slot B)
        for i in range(num_lines):
            line = doc.lines[i]
            layout = layouts[i]

            if i in (0, 1):
                show_start = 0.0
            else:
                prev_same_slot = doc.lines[i - 2]
                gap = line.start_time - prev_same_slot.end_time
                if gap > 4.0:
                    show_start = line.start_time - 2.5
                else:
                    show_start = prev_same_slot.end_time + 0.3

            show_end = line.end_time + 0.6
            schedule.append(LineSchedule(layout, show_start, show_end))

        for i in range(num_lines):
            if i + 2 < num_lines:
                schedule[i].show_end = min(schedule[i].show_end, schedule[i + 2].show_start)

    return schedule


def create_glow_sprite(size: float, color: Tuple[int, int, int, int]) -> Image.Image:
    """Generates a smooth, radiant, anti-aliased neon glow sprite with a bright core and soft falloff."""
    r, g, b, a = color
    int_size = max(4, int(round(size)))
    radius = int(int_size * 2.8)
    dim = radius * 2 + 1
    center = radius

    img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))

    # 1. Broad soft ambient glow
    ambient = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    da = ImageDraw.Draw(ambient)
    da.ellipse((center - int_size * 2.0, center - int_size * 2.0, center + int_size * 2.0, center + int_size * 2.0), fill=(r, g, b, 230))
    ambient = ambient.filter(ImageFilter.GaussianBlur(radius=int_size * 0.9))

    # 2. Medium bloom
    bloom = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    db = ImageDraw.Draw(bloom)
    db.ellipse((center - int_size * 1.1, center - int_size * 1.1, center + int_size * 1.1, center + int_size * 1.1), fill=(r, g, b, 255))
    bloom = bloom.filter(ImageFilter.GaussianBlur(radius=int_size * 0.45))

    # 3. Inner hot core with slight blur for perfect anti-aliasing
    core = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    dc = ImageDraw.Draw(core)
    dc.ellipse((center - int_size * 0.75, center - int_size * 0.75, center + int_size * 0.75, center + int_size * 0.75), fill=(r, g, b, 255))
    wh_r = int((r + 255 * 2) / 3)
    wh_g = int((g + 255 * 2) / 3)
    wh_b = int((b + 255 * 2) / 3)
    dc.ellipse((center - int_size * 0.35, center - int_size * 0.35, center + int_size * 0.35, center + int_size * 0.35), fill=(wh_r, wh_g, wh_b, 255))
    core = core.filter(ImageFilter.GaussianBlur(radius=int_size * 0.2))

    img = Image.alpha_composite(img, ambient)
    img = Image.alpha_composite(img, bloom)
    img = Image.alpha_composite(img, core)
    return img


def load_bounce_image_sprite(image_path: Optional[str], size: float) -> Optional[Image.Image]:
    """
    Loads and prepares a custom image sprite for the bouncing object.
    - If transparent (alpha cutout), fits into size maintaining aspect ratio.
    - If opaque (JPEG / non-alpha PNG), applies a smooth anti-aliased circular avatar mask.
    Returns an RGBA Image sprite or None if image_path is invalid.
    """
    if not image_path or not os.path.isfile(image_path):
        return None
    try:
        raw_img = Image.open(image_path).convert("RGBA")
        target_diam = max(8, int(round(size * 2)))

        # Check if the image contains significant transparency (cutout shape/emoji)
        has_transparency = False
        extrema = raw_img.getextrema()
        if len(extrema) >= 4 and extrema[3][0] < 250:
            has_transparency = True

        if has_transparency:
            # Preserve aspect ratio for cutout logos, icons, stickers
            raw_img.thumbnail((target_diam, target_diam), Image.Resampling.LANCZOS)
            return raw_img
        else:
            # Crop to square and apply smooth anti-aliased circular avatar mask
            fitted = ImageOps.fit(raw_img, (target_diam, target_diam), method=Image.Resampling.LANCZOS)
            mask_hi = Image.new("L", (target_diam * 2, target_diam * 2), 0)
            d_mask = ImageDraw.Draw(mask_hi)
            d_mask.ellipse((0, 0, target_diam * 2 - 1, target_diam * 2 - 1), fill=255)
            mask = mask_hi.resize((target_diam, target_diam), Image.Resampling.LANCZOS)

            avatar = Image.new("RGBA", (target_diam, target_diam), (0, 0, 0, 0))
            avatar.paste(fitted, (0, 0), mask)
            return avatar
    except Exception as e:
        print(f"[Warning] Failed to load bounce image sprite '{image_path}': {e}")
        return None


def draw_bounce_shape(
    draw: ImageDraw.ImageDraw,
    shape: str,
    cx: float,
    cy: float,
    size: float,
    color: Tuple[int, int, int, int],
    font: Optional[ImageFont.FreeTypeFont] = None,
    frame: Optional[Image.Image] = None,
    glow_sprite: Optional[Image.Image] = None,
    custom_sprite: Optional[Image.Image] = None,
):
    """Draws an anti-aliased shape, glowing orb, or custom image sprite at center (cx, cy)."""
    s = shape.lower()
    if (custom_sprite is not None or "image" in s or "custom" in s) and custom_sprite is not None and frame is not None:
        ix = int(round(cx - custom_sprite.width / 2.0))
        iy = int(round(cy - custom_sprite.height / 2.0))
        frame.paste(custom_sprite, (ix, iy), custom_sprite)
    elif "star" in s:
        # 4-point diamond star
        points = [
            (cx, cy - size * 1.3),
            (cx + size * 0.4, cy - size * 0.4),
            (cx + size * 1.3, cy),
            (cx + size * 0.4, cy + size * 0.4),
            (cx, cy + size * 1.3),
            (cx - size * 0.4, cy + size * 0.4),
            (cx - size * 1.3, cy),
            (cx - size * 0.4, cy - size * 0.4),
        ]
        draw.polygon(points, fill=color)
    elif "note" in s:
        # Musical note
        note_size = int(round(size * 2.2))
        try:
            n_font = ImageFont.truetype("/System/Library/Fonts/Apple Symbols.ttf", note_size)
        except Exception:
            n_font = font
        draw.text((cx - size * 0.6, cy - size * 1.1), "♪", font=n_font, fill=color)
    elif "glow" in s:
        # Authentic radiant glowing neon bloom
        if glow_sprite is not None and frame is not None:
            gx = int(round(cx - glow_sprite.width / 2.0))
            gy = int(round(cy - glow_sprite.height / 2.0))
            frame.paste(glow_sprite, (gx, gy), glow_sprite)
        else:
            draw.ellipse((cx - size, cy - size, cx + size, cy + size), fill=color)
    else:
        # Default smooth circle
        draw.ellipse((cx - size, cy - size, cx + size, cy + size), fill=color)


def render_single_frame(
    time_sec: float,
    schedule: List[LineSchedule],
    font: ImageFont.FreeTypeFont,
    style: VideoStyleConfig,
    bg_img: Optional[Image.Image] = None,
    glow_sprite: Optional[Image.Image] = None,
    custom_bounce_sprite: Optional[Image.Image] = None,
) -> Image.Image:
    """Renders a frame with sub-pixel word highlight and bouncing ball, supporting single or multi-line layout."""
    if bg_img is not None:
        frame = bg_img.copy()
    else:
        frame = Image.new("RGBA", (style.width, style.height), (0, 0, 0, 0))

    # Find all visible lines scheduled at this time
    visible_layouts: List[LineLayout] = []
    for entry in schedule:
        if entry.show_start <= time_sec <= entry.show_end:
            visible_layouts.append(entry.line_layout)

    if not visible_layouts:
        return frame

    # Determine active singing line (prefer lead vocal over background vocal)
    active_layout: Optional[LineLayout] = None
    for layout in visible_layouts:
        line = layout.line
        if not line.is_bg and line.start_time <= time_sec <= line.end_time:
            active_layout = layout
            break

    if active_layout is None:
        for layout in visible_layouts:
            line = layout.line
            if line.start_time <= time_sec <= line.end_time:
                active_layout = layout
                break

    # If in gap between lines, select the upcoming line if preparing to sing
    if active_layout is None:
        for layout in visible_layouts:
            line = layout.line
            if not line.is_bg and 0.0 <= line.start_time - time_sec <= 2.0:
                active_layout = layout
                break

    if active_layout is None:
        for layout in visible_layouts:
            line = layout.line
            if 0.0 <= line.start_time - time_sec <= 2.0:
                active_layout = layout
                break

    # Fallback to the most recently sung visible line
    if active_layout is None and visible_layouts:
        for layout in reversed(visible_layouts):
            if time_sec >= layout.line.end_time:
                active_layout = layout
                break

    # 1. Base inactive text for ALL visible lines
    for layout in visible_layouts:
        if bg_img is not None:
            frame.paste(layout.base_img, (0, 0), layout.base_img)
        else:
            frame.paste(layout.base_img, (0, 0))

    # 2. For active line: progressive active highlight sweep
    if active_layout is not None:
        reveal_x = active_layout.get_reveal_x(time_sec)
        if reveal_x > 0:
            crop_w = int(math.ceil(reveal_x))
            if crop_w > 0:
                crop_rect = (0, 0, min(style.width, crop_w), style.height)
                cropped_active = active_layout.active_img.crop(crop_rect)
                frame.paste(cropped_active, (0, 0), cropped_active)

        # 3. Fluid Bouncing Ball / Glowing Object on active line
        if style.enable_bounce:
            ball_pos = active_layout.get_ball_pos(time_sec)
            if ball_pos is not None:
                ball_x, ball_y = ball_pos
                draw = ImageDraw.Draw(frame)
                draw_bounce_shape(
                    draw=draw,
                    shape=style.bounce_shape,
                    cx=ball_x,
                    cy=ball_y,
                    size=style.bounce_size,
                    color=style.bounce_color,
                    font=font,
                    frame=frame,
                    glow_sprite=glow_sprite,
                    custom_sprite=custom_bounce_sprite,
                )

    return frame



def render_karaoke_video(
    doc: TTMLDocument,
    output_path: str,
    style: VideoStyleConfig,
    audio_path: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int, float, float], None]] = None,
    cancel_check: Optional[Callable[[], bool]] = None,
    on_proc_started: Optional[Callable[[subprocess.Popen], None]] = None,
) -> Tuple[bool, str]:
    """
    Renders the entire song to a transparent alpha or background video file.
    Streams frames directly to FFmpeg stdin for optimal speed and memory use.
    """
    if not doc.lines:
        return False, "TTML document has no lyrics lines."

    ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg" or "/usr/local/bin/ffmpeg"
    if not os.path.isfile(ffmpeg_bin):
        return False, "FFmpeg was not found. Please ensure FFmpeg is installed."

    total_duration = doc.total_duration + 2.0
    total_frames = max(30, int(round(total_duration * style.fps)))

    font = resolve_font(style.font_name, style.font_size)

    # Compute vertical baseline positions for single line and two-line modes
    pos = (style.position or "middle").lower()
    line_spacing = style.font_size * 1.55

    if "top" in pos:
        ratio = style.baseline_y_ratio if style.baseline_y_ratio <= 0.35 else 0.22
        baseline_y = (style.height * ratio) + (style.bounce_height / 2.0)
        slot_a_y = baseline_y
        slot_b_y = baseline_y + line_spacing
    elif "bot" in pos or "lower" in pos:
        ratio = style.baseline_y_ratio if style.baseline_y_ratio >= 0.65 else 0.78
        baseline_y = style.height * ratio
        slot_a_y = baseline_y - line_spacing
        slot_b_y = baseline_y
    elif "center" in pos or "mid" in pos:
        baseline_y = (style.height / 2.0) + (style.bounce_height / 2.0)
        slot_a_y = baseline_y - line_spacing * 0.55
        slot_b_y = baseline_y + line_spacing * 0.55
    else:
        baseline_y = style.height * style.baseline_y_ratio
        slot_a_y = baseline_y - line_spacing * 0.55
        slot_b_y = baseline_y + line_spacing * 0.55

    # Pre-load and scale background image if provided
    bg_img: Optional[Image.Image] = None
    if style.background_image and os.path.isfile(style.background_image):
        try:
            raw_bg = Image.open(style.background_image).convert("RGBA")
            bg_img = ImageOps.fit(raw_bg, (style.width, style.height), method=Image.Resampling.LANCZOS)
        except Exception as e:
            print(f"[Warning] Failed to load background image '{style.background_image}': {e}")

    # Filter background vocals if enabled (standard practice for clean lead vocal sync)
    if style.filter_background_vocals:
        lines_to_render = [line for line in doc.lines if not line.is_bg]
        if not lines_to_render:
            lines_to_render = doc.lines  # Fallback if TTML contains only background lines
    else:
        lines_to_render = doc.lines

    # Pre-calculate layout and pre-render text layers for all lines
    if style.single_line_mode:
        layouts = [
            LineLayout(line, idx, font, style, baseline_y)
            for idx, line in enumerate(lines_to_render)
        ]
    else:
        layouts = [
            LineLayout(line, idx, font, style, slot_a_y if idx % 2 == 0 else slot_b_y)
            for idx, line in enumerate(lines_to_render)
        ]

    active_doc = TTMLDocument(
        title=doc.title,
        artist=doc.artist,
        lines=lines_to_render,
    )
    schedule = build_line_schedule(active_doc, layouts, single_line_mode=style.single_line_mode)

    # Pre-compute glow sprite or custom image sprite if enabled
    glow_sprite: Optional[Image.Image] = None
    if style.enable_bounce and "glow" in style.bounce_shape.lower():
        glow_sprite = create_glow_sprite(style.bounce_size, style.bounce_color)

    custom_bounce_sprite: Optional[Image.Image] = None
    if style.enable_bounce and (style.bounce_image or "image" in style.bounce_shape.lower() or "custom" in style.bounce_shape.lower()):
        custom_bounce_sprite = load_bounce_image_sprite(style.bounce_image, style.bounce_size)

    # Build FFmpeg command
    cmd = [
        ffmpeg_bin, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{style.width}x{style.height}",
        "-pix_fmt", "rgba",
        "-r", str(style.fps),
        "-i", "-",
    ]

    has_audio = audio_path and os.path.isfile(audio_path)
    if has_audio:
        cmd.extend(["-i", audio_path, "-c:a", "aac", "-b:a", "320k"])

    fmt = style.format_type.lower()
    if fmt == "mp4":
        cmd.extend([
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "18",
            output_path,
        ])
    elif fmt == "webm":
        cmd.extend([
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-b:v", "0",
            "-crf", "26",
            output_path,
        ])
    elif fmt == "qtrle":
        # Apple QuickTime Animation RLE - ultra-fast, native Mac/DaVinci alpha playback
        cmd.extend([
            "-c:v", "qtrle",
            "-pix_fmt", "argb",
            output_path,
        ])
    elif fmt == "png_mov":
        cmd.extend([
            "-c:v", "png",
            "-pix_fmt", "rgba",
            output_path,
        ])
    else:
        # Default: Apple ProRes 4444 MOV with 12-bit studio alpha
        cmd.extend([
            "-c:v", "prores_ks",
            "-profile:v", "4",
            "-pix_fmt", "yuva444p10le",
            output_path,
        ])

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except Exception as e:
        return False, f"Failed to start FFmpeg: {e}"

    if on_proc_started:
        on_proc_started(proc)

    # Continuously drain stderr in a background thread to prevent OS pipe deadlocks.
    # FFmpeg writes encoding progress stats to stderr for every frame/chunk.
    # Without continuous reading, the 64KB OS pipe buffer fills up around ~9,000 frames,
    # causing FFmpeg to block on write, which in turn blocks Python on stdin.write.
    stderr_lines = collections.deque(maxlen=100)

    def _drain_stderr():
        try:
            for line in iter(proc.stderr.readline, b""):
                stderr_lines.append(line.decode("utf-8", errors="replace"))
        except Exception:
            pass
        finally:
            try:
                proc.stderr.close()
            except Exception:
                pass

    stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
    stderr_thread.start()

    start_wall_time = time.time()
    dt = 1.0 / style.fps

    try:
        for frame_idx in range(total_frames):
            if cancel_check and cancel_check():
                try:
                    proc.stdin.close()
                except Exception:
                    pass
                proc.terminate()
                return False, "Render cancelled by user."

            current_time_sec = frame_idx * dt
            frame_img = render_single_frame(
                current_time_sec,
                schedule,
                font,
                style,
                bg_img=bg_img,
                glow_sprite=glow_sprite,
                custom_bounce_sprite=custom_bounce_sprite,
            )

            proc.stdin.write(frame_img.tobytes())

            # Progress tracking
            if progress_callback and (frame_idx % max(1, int(style.fps / 2)) == 0 or frame_idx == total_frames - 1):
                elapsed = max(0.001, time.time() - start_wall_time)
                enc_fps = (frame_idx + 1) / elapsed
                remaining_frames = total_frames - (frame_idx + 1)
                eta = remaining_frames / max(0.1, enc_fps)
                progress_callback(frame_idx + 1, total_frames, enc_fps, eta)

        try:
            proc.stdin.close()
        except Exception:
            pass

        proc.wait()
        stderr_thread.join(timeout=2.0)
        stderr = "".join(stderr_lines)

        if proc.returncode != 0:
            return False, f"FFmpeg error (code {proc.returncode}): {stderr[-600:]}"

        return True, output_path
    except Exception as e:
        try:
            proc.terminate()
        except Exception:
            pass
        return False, f"Rendering error: {e}"
