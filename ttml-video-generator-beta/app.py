#!/usr/bin/env python3
"""
Transparent Karaoke Video Generator App.
Pre-renders word-synchronized animated lyrics with bouncing ball into transparent alpha video
(Apple ProRes 4444 .mov, WebM .webm, or QuickTime PNG .mov).
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from typing import Callable, Optional, Tuple

try:
    import tkinter as tk
    from tkinter import colorchooser, filedialog, messagebox, ttk
except ImportError:
    tk = None
    colorchooser = None
    filedialog = None
    messagebox = None
    ttk = None

from renderer import VideoStyleConfig, render_karaoke_video
from ttml_parser import parse_ttml_file


def hex_to_rgba(hex_code: str, alpha: int = 255) -> Tuple[int, int, int, int]:
    """Converts a hex string like #FFD728 to an RGBA tuple."""
    c = hex_code.strip().lstrip("#")
    if len(c) == 6:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), alpha)
    elif len(c) == 8:
        return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), int(c[6:8], 16))
    return (255, 255, 255, alpha)


_BaseCanvas = tk.Canvas if tk else object


def get_system_font(size: int = 12, weight: str = "normal") -> Tuple:
    """Returns the native system font tuple (.AppleSystemUIFont on macOS, Segoe UI on Windows)."""
    if sys.platform == "darwin":
        return (".AppleSystemUIFont", size, weight)
    elif sys.platform == "win32":
        return ("Segoe UI", size, weight)
    return ("Helvetica", size, weight)


class MacCard(tk.Frame):
    """macOS-style inset grouped section card with subtle uppercase caption and dark rounded body."""
    def __init__(self, parent, section_title: str = "", **kwargs):
        super().__init__(parent, bg="#1C1C1E", **kwargs)
        if section_title:
            head = tk.Frame(self, bg="#1C1C1E")
            head.pack(fill="x", padx=4, pady=(12, 4))
            tk.Label(
                head,
                text=section_title.upper(),
                font=get_system_font(10, "bold"),
                bg="#1C1C1E",
                fg="#8E8E93",
            ).pack(side="left")

        self.body = tk.Frame(
            self,
            bg="#252528",
            highlightthickness=1,
            highlightbackground="#343438",
            highlightcolor="#343438",
            padx=16,
            pady=12,
        )
        self.body.pack(fill="both", expand=True)


class MacColorWell(_BaseCanvas):
    """macOS-style color well pill with circular swatch preview and label."""
    def __init__(
        self,
        parent,
        label: str,
        color: str,
        command: Optional[Callable] = None,
        width: int = 135,
        height: int = 30,
        **kwargs,
    ):
        super().__init__(
            parent,
            width=width,
            height=height,
            bg=parent.cget("bg"),
            highlightthickness=0,
            cursor="hand2",
            **kwargs,
        )
        self.label = label
        self.color = color
        self.command = command
        self._hovered = False
        self.width = width
        self.height = height
        self.radius = 6
        self._poly_id = None
        self._oval_id = None
        self._text_id = None

        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<Button-1>", self._on_click)
        self._draw()

    def set_color(self, color: str):
        self.color = color
        if self._oval_id:
            self.itemconfig(self._oval_id, fill=self.color)
        else:
            self._draw()

    def _draw(self):
        w = self.winfo_width() or self.width
        h = self.winfo_height() or self.height
        if w <= 1 or h <= 1:
            return
        r = self.radius

        bg_fill = "#343438" if self._hovered else "#2A2A2D"
        border = "#525258" if self._hovered else "#38383E"

        if getattr(self, "_last_w", None) == w and getattr(self, "_last_h", None) == h and self._poly_id:
            self.itemconfig(self._poly_id, fill=bg_fill, outline=border)
            return

        self._last_w = w
        self._last_h = h

        points = [
            r, 0, w - r, 0, w, 0, w, r,
            w, h - r, w, h, w - r, h, r, h,
            0, h, 0, h - r, 0, r, 0, 0
        ]
        swatch_r = 7
        cx = 16
        cy = h // 2

        if self._poly_id:
            self.coords(self._poly_id, *points)
            self.itemconfig(self._poly_id, fill=bg_fill, outline=border)
            self.coords(self._oval_id, cx - swatch_r, cy - swatch_r, cx + swatch_r, cy + swatch_r)
            self.itemconfig(self._oval_id, fill=self.color)
            self.coords(self._text_id, cx + swatch_r + 8, cy)
            self.itemconfig(self._text_id, text=self.label)
        else:
            self._poly_id = self.create_polygon(points, fill=bg_fill, outline=border, width=1, smooth=True)
            self._oval_id = self.create_oval(cx - swatch_r, cy - swatch_r, cx + swatch_r, cy + swatch_r, fill=self.color, outline="#FFFFFF", width=1)
            font = get_system_font(10, "bold")
            self._text_id = self.create_text(cx + swatch_r + 8, cy, text=self.label, anchor="w", fill="#FFFFFF", font=font)

    def _on_enter(self, e):
        self._hovered = True
        if self._poly_id:
            self.itemconfig(self._poly_id, fill="#343438", outline="#525258")
        else:
            self._draw()

    def _on_leave(self, e):
        self._hovered = False
        if self._poly_id:
            self.itemconfig(self._poly_id, fill="#2A2A2D", outline="#38383E")
        else:
            self._draw()

    def _on_click(self, e):
        if self.command:
            self.command()


def make_mac_entry(parent, textvariable, **kwargs) -> tk.Entry:
    """Creates a macOS-styled dark text entry field with focus ring."""
    return tk.Entry(
        parent,
        textvariable=textvariable,
        font=get_system_font(11),
        bg="#1C1C1E",
        fg="#FFFFFF",
        insertbackground="#0A84FF",
        relief="flat",
        highlightthickness=1,
        highlightbackground="#38383C",
        highlightcolor="#0A84FF",
        bd=0,
        **kwargs,
    )


class ModernButton(_BaseCanvas):
    """macOS-styled smooth anti-aliased button with hover and active states."""
    def __init__(
        self,
        parent,
        text: str,
        command=None,
        bg_color: str = "#36363A",
        hover_color: str = "#44444A",
        active_color: str = "#2A2A2D",
        text_color: str = "#FFFFFF",
        font=None,
        height: int = 30,
        radius: int = 6,
        border_color: Optional[str] = "#48484E",
        **kwargs,
    ):
        super().__init__(
            parent,
            height=height,
            bg=parent.cget("bg"),
            highlightthickness=0,
            bd=0,
            cursor="hand2",
            **kwargs,
        )
        self.command = command
        self.bg_color = bg_color
        self.hover_color = hover_color
        self.active_color = active_color
        self.text_color = text_color
        self.font = font or get_system_font(11, "bold")
        self.radius = radius
        self.border_color = border_color
        self.text = text
        self._cur_bg = bg_color
        self._hovered = False
        self._enabled = True
        self._poly_id = None
        self._text_id = None

        self.bind("<Configure>", lambda e: self._draw())
        self.bind("<Enter>", self._on_enter)
        self.bind("<Leave>", self._on_leave)
        self.bind("<Button-1>", self._on_press)
        self.bind("<ButtonRelease-1>", self._on_release)

    def set_enabled(self, enabled: bool):
        self._enabled = enabled
        self.config(cursor="hand2" if enabled else "arrow")
        self._cur_bg = self.bg_color if enabled else "#28282B"
        self.text_color = "#FFFFFF" if enabled else "#636366"
        if self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg)
            self.itemconfig(self._text_id, fill=self.text_color)
        else:
            self._draw()

    def set_text(self, text: str):
        self.text = text
        if self._text_id:
            self.itemconfig(self._text_id, text=text)
        else:
            self._draw()

    def _draw(self):
        w = self.winfo_width()
        h = self.winfo_height()
        if w <= 1 or h <= 1:
            return

        outline_c = self.border_color if self.border_color else self._cur_bg
        if getattr(self, "_last_w", None) == w and getattr(self, "_last_h", None) == h and self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg, outline=outline_c)
            return

        self._last_w = w
        self._last_h = h

        r = min(self.radius, h // 2, w // 2)
        points = [
            r, 0,
            w - r, 0,
            w, 0,
            w, r,
            w, h - r,
            w, h,
            w - r, h,
            r, h,
            0, h,
            0, h - r,
            0, r,
            0, 0,
        ]

        if self._poly_id:
            self.coords(self._poly_id, *points)
            self.itemconfig(self._poly_id, fill=self._cur_bg, outline=outline_c)
            self.coords(self._text_id, w // 2, h // 2)
            self.itemconfig(self._text_id, text=self.text, fill=self.text_color, font=self.font)
        else:
            self._poly_id = self.create_polygon(points, fill=self._cur_bg, outline=outline_c, width=1, smooth=True)
            self._text_id = self.create_text(
                w // 2,
                h // 2,
                text=self.text,
                fill=self.text_color,
                font=self.font,
            )

    def _on_enter(self, event):
        if not self._enabled:
            return
        self._hovered = True
        self._cur_bg = self.hover_color
        if self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg)
        else:
            self._draw()

    def _on_leave(self, event):
        if not self._enabled:
            return
        self._hovered = False
        self._cur_bg = self.bg_color
        if self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg)
        else:
            self._draw()

    def _on_press(self, event):
        if not self._enabled:
            return
        self._cur_bg = self.active_color
        if self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg)
        else:
            self._draw()

    def _on_release(self, event):
        if not self._enabled:
            return
        self._cur_bg = self.hover_color if self._hovered else self.bg_color
        if self._poly_id:
            self.itemconfig(self._poly_id, fill=self._cur_bg)
        else:
            self._draw()
        if self._hovered and self.command:
            self.command()


class TransparentKaraokeApp:
    """Main desktop application window."""
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Karaoke Video Studio")
        self.root.geometry("700x950")
        self.root.minsize(640, 720)
        self.root.configure(bg="#1C1C1E")

        # Bring window to front
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after_idle(self.root.attributes, "-topmost", False)

        self.is_rendering = False
        self.cancel_requested = False
        self.current_output_path = ""

        # Configure macOS aqua styling if available
        if ttk:
            s = ttk.Style()
            try:
                s.theme_use("aqua")
            except Exception:
                pass

        self._build_ui()

    def _build_ui(self):
        # Main scrollable canvas container with native dark background and fine-grained 1-pixel scrolling
        canvas = tk.Canvas(self.root, bg="#1C1C1E", highlightthickness=0, yscrollincrement=1)
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#1C1C1E")

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        canvas_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")

        def _on_canvas_resize(event):
            canvas.itemconfig(canvas_window, width=event.width)
        canvas.bind("<Configure>", _on_canvas_resize)

        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # Smooth, throttled scrolling for macOS trackpads, mouse wheels, and keyboard navigation
        accumulated_scroll = 0
        scroll_job = None

        def _apply_smooth_scroll():
            nonlocal accumulated_scroll, scroll_job
            scroll_job = None
            if not self.root.winfo_exists():
                return
            if accumulated_scroll != 0:
                try:
                    canvas.yview_scroll(accumulated_scroll, "units")
                except tk.TclError:
                    pass
                accumulated_scroll = 0

        def _on_mousewheel(event):
            nonlocal accumulated_scroll, scroll_job
            if sys.platform == "darwin":
                d = event.delta
                # Scale delta for smooth 1:1 pixel velocity matching macOS inertia
                step = int(-4 * d)
                if step == 0 and d != 0:
                    step = -1 if d > 0 else 1
            else:
                # Windows / standard mouse wheels typically send 120 per notch
                step = int(-1 * (event.delta / 120) * 36)
            accumulated_scroll += step
            if scroll_job is None:
                scroll_job = self.root.after(10, _apply_smooth_scroll)

        def _on_page_scroll(direction: int):
            nonlocal accumulated_scroll, scroll_job
            accumulated_scroll += direction * 250
            if scroll_job is None:
                scroll_job = self.root.after(10, _apply_smooth_scroll)

        def _on_key_scroll(direction: int):
            nonlocal accumulated_scroll, scroll_job
            accumulated_scroll += direction * 35
            if scroll_job is None:
                scroll_job = self.root.after(10, _apply_smooth_scroll)

        # Bind all wheel gestures and keyboard scroll keys
        canvas.bind_all("<MouseWheel>", _on_mousewheel)
        canvas.bind_all("<Shift-MouseWheel>", _on_mousewheel)
        # Linux scroll support
        canvas.bind_all("<Button-4>", lambda e: _on_mousewheel(type("Event", (), {"delta": 120})()))
        canvas.bind_all("<Button-5>", lambda e: _on_mousewheel(type("Event", (), {"delta": -120})()))
        # Keyboard page up / page down / up / down
        self.root.bind("<Prior>", lambda e: _on_page_scroll(-1))
        self.root.bind("<Next>", lambda e: _on_page_scroll(1))
        self.root.bind("<Up>", lambda e: _on_key_scroll(-1))
        self.root.bind("<Down>", lambda e: _on_key_scroll(1))

        # Header Area
        header = tk.Frame(scrollable_frame, bg="#1C1C1E")
        header.pack(fill="x", padx=24, pady=(18, 6))

        top_row = tk.Frame(header, bg="#1C1C1E")
        top_row.pack(fill="x")

        tk.Label(
            top_row,
            text="🎬",
            font=("Apple Color Emoji", 20) if sys.platform == "darwin" else get_system_font(18),
            bg="#1C1C1E",
        ).pack(side="left", padx=(0, 10))

        tk.Label(
            top_row,
            text="Karaoke Video Studio",
            font=get_system_font(19, "bold"),
            bg="#1C1C1E",
            fg="#FFFFFF",
        ).pack(side="left", anchor="w")

        tk.Label(
            header,
            text="Export word-synced lyrics with bouncing ball animation as transparent alpha video for DaVinci Resolve & Final Cut Pro",
            font=get_system_font(11),
            bg="#1C1C1E",
            fg="#8E8E93",
        ).pack(anchor="w", pady=(4, 0))

        # Subtle macOS divider line
        tk.Frame(scrollable_frame, height=1, bg="#2C2C30").pack(fill="x", padx=24, pady=(8, 4))

        # 1. Input & Media Assets Card
        file_card = MacCard(scrollable_frame, section_title="Input & Media Assets")
        file_card.pack(fill="x", padx=24, pady=6)
        card1 = file_card.body

        # TTML file row
        tk.Label(card1, text="TTML Lyrics File:", font=get_system_font(11, "bold"), bg="#252528", fg="#E5E5EA").pack(anchor="w")
        ttml_row = tk.Frame(card1, bg="#252528")
        ttml_row.pack(fill="x", pady=(3, 6))

        self.ttml_var = tk.StringVar()
        self.ttml_entry = make_mac_entry(ttml_row, textvariable=self.ttml_var)
        self.ttml_entry.pack(side="left", fill="x", expand=True, padx=(0, 10), ipady=5)

        browse_ttml_btn = ModernButton(
            ttml_row,
            text="Browse...",
            command=self._browse_ttml,
            height=30,
            width=85,
            radius=6,
            font=get_system_font(10, "bold"),
        )
        browse_ttml_btn.pack(side="right")

        self.info_lbl = tk.Label(
            card1,
            text="No file loaded. Select a .ttml lyrics file.",
            font=get_system_font(10),
            bg="#252528",
            fg="#8E8E93",
            anchor="w",
        )
        self.info_lbl.pack(fill="x", pady=(0, 8))
        self.ttml_var.trace_add("write", lambda *a: self._on_ttml_changed())

        # Audio file row (optional)
        tk.Label(card1, text="Audio Track (Optional, to mux audio into video):", font=get_system_font(10), bg="#252528", fg="#8E8E93").pack(anchor="w")
        audio_row = tk.Frame(card1, bg="#252528")
        audio_row.pack(fill="x", pady=(2, 8))

        self.audio_var = tk.StringVar()
        self.audio_entry = make_mac_entry(audio_row, textvariable=self.audio_var)
        self.audio_entry.pack(side="left", fill="x", expand=True, padx=(0, 10), ipady=4)

        browse_audio_btn = ModernButton(
            audio_row,
            text="Browse...",
            command=self._browse_audio,
            height=28,
            width=85,
            radius=6,
            font=get_system_font(10),
        )
        browse_audio_btn.pack(side="right")

        # Custom background image row (optional)
        tk.Label(card1, text="Background Image (Optional, default is transparent alpha):", font=get_system_font(10), bg="#252528", fg="#8E8E93").pack(anchor="w")
        bg_row = tk.Frame(card1, bg="#252528")
        bg_row.pack(fill="x", pady=(2, 2))

        self.bg_var = tk.StringVar()
        self.bg_entry = make_mac_entry(bg_row, textvariable=self.bg_var)
        self.bg_entry.pack(side="left", fill="x", expand=True, padx=(0, 8), ipady=4)

        browse_bg_btn = ModernButton(
            bg_row,
            text="Browse...",
            command=self._browse_bg,
            height=28,
            width=80,
            radius=6,
            font=get_system_font(10),
        )
        browse_bg_btn.pack(side="left", padx=(0, 6))

        clear_bg_btn = ModernButton(
            bg_row,
            text="Clear",
            command=self._clear_bg,
            bg_color="#2A2A2D",
            hover_color="#36363A",
            active_color="#202022",
            border_color="#3E3E44",
            text_color="#8E8E93",
            font=get_system_font(10),
            height=28,
            width=50,
            radius=6,
        )
        clear_bg_btn.pack(side="left")

        # 2. Output Format & Resolution Card
        export_card = MacCard(scrollable_frame, section_title="Export Format & Resolution")
        export_card.pack(fill="x", padx=24, pady=6)
        card2 = export_card.body

        fmt_row = tk.Frame(card2, bg="#252528")
        fmt_row.pack(fill="x", pady=4)
        tk.Label(fmt_row, text="Video Codec:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.fmt_var = tk.StringVar(value="Apple ProRes 4444 Alpha (.mov)")
        fmt_combo = ttk.Combobox(
            fmt_row,
            textvariable=self.fmt_var,
            values=[
                "Apple ProRes 4444 Alpha (.mov)",
                "QuickTime Animation RLE Alpha (.mov)",
                "WebM VP9 Alpha (.webm)",
                "MP4 / H.264 (.mp4)",
                "QuickTime PNG Alpha (.mov)",
            ],
            state="readonly",
            width=34,
        )
        fmt_combo.pack(side="left")

        res_row = tk.Frame(card2, bg="#252528")
        res_row.pack(fill="x", pady=4)
        tk.Label(res_row, text="Resolution:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.res_var = tk.StringVar(value="1080p Full HD (1920x1080)")
        res_combo = ttk.Combobox(
            res_row,
            textvariable=self.res_var,
            values=[
                "1080p Full HD (1920x1080)",
                "4K Ultra HD (3840x2160)",
                "720p HD (1280x720)",
            ],
            state="readonly",
            width=28,
        )
        res_combo.pack(side="left")

        fps_row = tk.Frame(card2, bg="#252528")
        fps_row.pack(fill="x", pady=4)
        tk.Label(fps_row, text="Frame Rate:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.fps_var = tk.StringVar(value="60 fps (Ultra Smooth)")
        fps_combo = ttk.Combobox(
            fps_row,
            textvariable=self.fps_var,
            values=["60 fps (Ultra Smooth)", "30 fps", "24 fps", "29.97 fps"],
            state="readonly",
            width=24,
        )
        fps_combo.pack(side="left")

        # 3. Typography & Colors Card
        typo_card = MacCard(scrollable_frame, section_title="Typography & Colors")
        typo_card.pack(fill="x", padx=24, pady=6)
        card3 = typo_card.body

        # Font row
        font_row = tk.Frame(card3, bg="#252528")
        font_row.pack(fill="x", pady=4)
        tk.Label(font_row, text="Font Family:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")

        popular_fonts = [
            "Open Sans",
            "SF Pro Display",
            "Helvetica Neue",
            "Arial",
            "Impact",
            "Futura",
            "Avenir",
            "Trebuchet MS",
            "Georgia",
            "Times New Roman",
            "Verdana",
            "Comic Sans MS",
        ]
        self.font_var = tk.StringVar(value="Open Sans")
        self.font_combo = ttk.Combobox(
            font_row,
            textvariable=self.font_var,
            values=popular_fonts,
            width=24,
        )
        self.font_combo.pack(side="left", padx=(0, 8))

        browse_font_btn = ModernButton(
            font_row,
            text="Browse Font...",
            command=self._browse_font,
            height=28,
            width=100,
            radius=6,
            font=get_system_font(10),
        )
        browse_font_btn.pack(side="left")

        # Font Size row
        size_row = tk.Frame(card3, bg="#252528")
        size_row.pack(fill="x", pady=4)
        tk.Label(size_row, text="Font Size:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.font_size_var = tk.IntVar(value=68)
        size_spin = ttk.Spinbox(
            size_row,
            from_=24,
            to=160,
            textvariable=self.font_size_var,
            width=8,
        )
        size_spin.pack(side="left")
        tk.Label(size_row, text="px (1080p base, auto-scales for 4K / 720p)", bg="#252528", fg="#8E8E93", font=get_system_font(10)).pack(side="left", padx=(8, 0))

        # Color Scheme row with MacColorWell pills
        color_row = tk.Frame(card3, bg="#252528")
        color_row.pack(fill="x", pady=(8, 4))
        tk.Label(color_row, text="Color Scheme:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")

        self.active_color_var = tk.StringVar(value="#FFD728")
        self.inactive_color_var = tk.StringVar(value="#D2D2DC")
        self.bounce_color_var = tk.StringVar(value="#FF3C5F")

        self.active_btn = MacColorWell(
            color_row,
            label="Active Text",
            color=self.active_color_var.get(),
            command=lambda: self._pick_color("active"),
            width=130,
        )
        self.active_btn.pack(side="left", padx=(0, 8))

        self.inactive_btn = MacColorWell(
            color_row,
            label="Upcoming",
            color=self.inactive_color_var.get(),
            command=lambda: self._pick_color("inactive"),
            width=120,
        )
        self.inactive_btn.pack(side="left", padx=(0, 8))

        self.bounce_btn = MacColorWell(
            color_row,
            label="Ball / Glow",
            color=self.bounce_color_var.get(),
            command=lambda: self._pick_color("bounce"),
            width=125,
        )
        self.bounce_btn.pack(side="left")

        # Color Theme Presets row
        theme_row = tk.Frame(card3, bg="#252528")
        theme_row.pack(fill="x", pady=(4, 2))
        tk.Label(theme_row, text="Theme Presets:", bg="#252528", fg="#8E8E93", font=get_system_font(10), width=15, anchor="w").pack(side="left")
        self.theme_preset_var = tk.StringVar(value="Classic Gold & Pink")
        theme_combo = ttk.Combobox(
            theme_row,
            textvariable=self.theme_preset_var,
            values=[
                "Classic Gold & Pink",
                "Cyberpunk Neon (Cyan & Magenta)",
                "Fire & Flame (Yellow & Red)",
                "Emerald & Mint (Green & Lime)",
                "Studio White & Gold",
            ],
            state="readonly",
            width=30,
        )
        theme_combo.pack(side="left")
        theme_combo.bind("<<ComboboxSelected>>", self._on_theme_preset_changed)

        # 4. Animation & Lyrics Position Card
        anim_card = MacCard(scrollable_frame, section_title="Animation & Lyrics Position")
        anim_card.pack(fill="x", padx=24, pady=6)
        card4 = anim_card.body

        self.single_line_var = tk.BooleanVar(value=True)
        tk.Checkbutton(
            card4,
            text="Single Line Mode (Uncheck for classic 2-line alternating karaoke display)",
            variable=self.single_line_var,
            bg="#252528",
            fg="#FFFFFF",
            selectcolor="#1C1C1E",
            activebackground="#252528",
            activeforeground="#FFFFFF",
            font=get_system_font(11),
            cursor="hand2",
        ).pack(anchor="w", pady=2)

        self.bounce_var = tk.BooleanVar(value=True)
        tk.Checkbutton(
            card4,
            text="Bounce object over words in rhythm",
            variable=self.bounce_var,
            bg="#252528",
            fg="#FFFFFF",
            selectcolor="#1C1C1E",
            activebackground="#252528",
            activeforeground="#FFFFFF",
            font=get_system_font(11),
            cursor="hand2",
        ).pack(anchor="w", pady=2)

        self.skip_short_var = tk.BooleanVar(value=True)
        tk.Checkbutton(
            card4,
            text="Skip bouncing on rapid micro-syllables (< 0.22s) near another word",
            variable=self.skip_short_var,
            bg="#252528",
            fg="#FFFFFF",
            selectcolor="#1C1C1E",
            activebackground="#252528",
            activeforeground="#FFFFFF",
            font=get_system_font(11),
            cursor="hand2",
        ).pack(anchor="w", pady=2)

        self.filter_bg_var = tk.BooleanVar(value=True)
        tk.Checkbutton(
            card4,
            text="Filter background vocals (recommended: preserves lead vocal sync & rhythm)",
            variable=self.filter_bg_var,
            bg="#252528",
            fg="#FFFFFF",
            selectcolor="#1C1C1E",
            activebackground="#252528",
            activeforeground="#FFFFFF",
            font=get_system_font(11),
            cursor="hand2",
        ).pack(anchor="w", pady=2)

        shape_row = tk.Frame(card4, bg="#252528")
        shape_row.pack(fill="x", pady=4)
        tk.Label(shape_row, text="Bounce Shape:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.shape_var = tk.StringVar(value="Glowing Dot")
        shape_combo = ttk.Combobox(
            shape_row,
            textvariable=self.shape_var,
            values=["Glowing Dot", "Classic Ball (Circle)", "Star", "Musical Note", "Custom Image"],
            state="readonly",
            width=24,
        )
        shape_combo.pack(side="left")
        shape_combo.bind("<<ComboboxSelected>>", self._on_shape_changed)

        # Bounce Size row
        bounce_size_row = tk.Frame(card4, bg="#252528")
        bounce_size_row.pack(fill="x", pady=4)
        tk.Label(bounce_size_row, text="Bounce Size:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.bounce_size_var = tk.IntVar(value=18)
        bounce_size_spin = ttk.Spinbox(
            bounce_size_row,
            from_=6,
            to=120,
            textvariable=self.bounce_size_var,
            width=8,
        )
        bounce_size_spin.pack(side="left")
        tk.Label(
            bounce_size_row,
            text="px radius (scales ball, glow & custom images, auto-scales for 4K)",
            bg="#252528",
            fg="#8E8E93",
            font=get_system_font(10),
        ).pack(side="left", padx=(8, 0))

        # Bounce Image row
        bounce_img_row = tk.Frame(card4, bg="#252528")
        bounce_img_row.pack(fill="x", pady=4)
        tk.Label(bounce_img_row, text="Bounce Image:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.bounce_image_var = tk.StringVar()
        self.bounce_image_entry = make_mac_entry(bounce_img_row, textvariable=self.bounce_image_var)
        self.bounce_image_entry.pack(side="left", fill="x", expand=True, padx=(0, 6), ipady=4)

        browse_bounce_img_btn = ModernButton(
            bounce_img_row,
            text="Browse...",
            command=self._browse_bounce_image,
            height=28,
            width=75,
            radius=6,
            font=get_system_font(10),
        )
        browse_bounce_img_btn.pack(side="left", padx=(0, 4))

        clear_bounce_img_btn = ModernButton(
            bounce_img_row,
            text="Clear",
            command=self._clear_bounce_image,
            bg_color="#2A2A2D",
            hover_color="#36363A",
            active_color="#202022",
            border_color="#3E3E44",
            text_color="#8E8E93",
            font=get_system_font(10),
            height=28,
            width=50,
            radius=6,
        )
        clear_bounce_img_btn.pack(side="left")

        # Position Preset combobox
        pos_preset_row = tk.Frame(card4, bg="#252528")
        pos_preset_row.pack(fill="x", pady=4)
        tk.Label(pos_preset_row, text="Lyrics Position:", bg="#252528", fg="#E5E5EA", font=get_system_font(11), width=15, anchor="w").pack(side="left")
        self.pos_preset_var = tk.StringVar(value="Middle (Center)")
        self.pos_preset_combo = ttk.Combobox(
            pos_preset_row,
            textvariable=self.pos_preset_var,
            values=["Middle (Center)", "Bottom (Subtitles)", "Top"],
            state="readonly",
            width=24,
        )
        self.pos_preset_combo.pack(side="left")
        self.pos_preset_combo.bind("<<ComboboxSelected>>", self._on_pos_preset_changed)

        # Baseline slider for fine adjustments
        pos_row = tk.Frame(card4, bg="#252528")
        pos_row.pack(fill="x", pady=4)
        tk.Label(pos_row, text="Fine Baseline Y:", bg="#252528", fg="#8E8E93", font=get_system_font(10), width=15, anchor="w").pack(side="left")
        self.pos_var = tk.DoubleVar(value=0.50)
        self.pos_badge = tk.Label(
            pos_row,
            text="50% (Middle)",
            bg="#1C1C1E",
            fg="#0A84FF",
            font=get_system_font(10, "bold"),
            width=13,
            highlightthickness=1,
            highlightbackground="#38383C",
            relief="flat",
            padx=4,
            pady=2,
        )
        self.pos_badge.pack(side="right", padx=(8, 0))
        self.pos_scale = tk.Scale(
            pos_row,
            from_=0.15,
            to=0.90,
            resolution=0.01,
            orient="horizontal",
            variable=self.pos_var,
            command=self._on_baseline_scale_changed,
            bg="#252528",
            fg="#FFFFFF",
            troughcolor="#1C1C1E",
            activebackground="#0A84FF",
            highlightthickness=0,
            showvalue=False,
        )
        self.pos_scale.pack(side="left", fill="x", expand=True)

        # 5. Actions & Status Frame
        action_frame = tk.Frame(scrollable_frame, bg="#1C1C1E")
        action_frame.pack(fill="x", padx=24, pady=(14, 24))

        self.progress_bar = ttk.Progressbar(action_frame, orient="horizontal", mode="determinate")
        self.progress_bar.pack(fill="x", pady=(0, 8))

        self.status_lbl = tk.Label(
            action_frame,
            text="● Ready to export transparent video.",
            font=get_system_font(11),
            bg="#1C1C1E",
            fg="#8E8E93",
            anchor="w",
        )
        self.status_lbl.pack(fill="x", pady=(0, 10))

        btn_row = tk.Frame(action_frame, bg="#1C1C1E")
        btn_row.pack(fill="x")

        self.render_btn = ModernButton(
            btn_row,
            text="Render Karaoke Video",
            command=self._start_render,
            bg_color="#0A84FF",
            hover_color="#2B93FF",
            active_color="#0067DB",
            text_color="#FFFFFF",
            font=get_system_font(13, "bold"),
            height=42,
            radius=8,
        )
        self.render_btn.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.cancel_btn = ModernButton(
            btn_row,
            text="Cancel",
            command=self._cancel_render,
            bg_color="#28282B",
            hover_color="#36363A",
            active_color="#1E1E20",
            border_color="#404046",
            text_color="#8E8E93",
            font=get_system_font(12),
            height=42,
            width=95,
            radius=8,
        )
        self.cancel_btn.pack(side="right")
        self.cancel_btn.set_enabled(False)

    def _browse_ttml(self):
        fn = filedialog.askopenfilename(
            filetypes=[("TTML Lyrics Files", "*.ttml"), ("XML Files", "*.xml"), ("All Files", "*.*")]
        )
        if fn:
            self.ttml_var.set(fn)

    def _browse_font(self):
        fn = filedialog.askopenfilename(
            filetypes=[("Font Files", "*.ttf *.otf *.ttc"), ("All Files", "*.*")]
        )
        if fn:
            self.font_var.set(fn)

    def _pick_color(self, target: str):
        if not colorchooser:
            return
        if target == "active":
            cur = self.active_color_var.get()
            title = "Pick Active (Highlighted) Lyrics Color"
        elif target == "inactive":
            cur = self.inactive_color_var.get()
            title = "Pick Upcoming Lyrics Color"
        else:
            cur = self.bounce_color_var.get()
            title = "Pick Bouncing Object / Glow Color"

        chosen = colorchooser.askcolor(color=cur, title=title, parent=self.root)
        if chosen and chosen[1]:
            hex_c = chosen[1].upper()
            if target == "active":
                self.active_color_var.set(hex_c)
                self.active_btn.set_color(hex_c)
            elif target == "inactive":
                self.inactive_color_var.set(hex_c)
                self.inactive_btn.set_color(hex_c)
            else:
                self.bounce_color_var.set(hex_c)
                self.bounce_btn.set_color(hex_c)

    def _on_theme_preset_changed(self, event=None):
        theme = self.theme_preset_var.get()
        if "Cyberpunk" in theme:
            active, inactive, bounce = "#00F0FF", "#608090", "#FF0055"
        elif "Fire" in theme:
            active, inactive, bounce = "#FFE000", "#906040", "#FF2200"
        elif "Emerald" in theme:
            active, inactive, bounce = "#00FF88", "#70A090", "#33FF33"
        elif "White" in theme:
            active, inactive, bounce = "#FFFFFF", "#9999AA", "#FFD700"
        else:
            # Default Classic Gold & Pink
            active, inactive, bounce = "#FFD728", "#D2D2DC", "#FF3C5F"

        self.active_color_var.set(active)
        self.active_btn.set_color(active)
        self.inactive_color_var.set(inactive)
        self.inactive_btn.set_color(inactive)
        self.bounce_color_var.set(bounce)
        self.bounce_btn.set_color(bounce)

    def _browse_audio(self):
        fn = filedialog.askopenfilename(
            filetypes=[("Audio Files", "*.mp3 *.wav *.m4a *.aac *.flac"), ("All Files", "*.*")]
        )
        if fn:
            self.audio_var.set(fn)

    def _browse_bg(self):
        fn = filedialog.askopenfilename(
            filetypes=[
                ("Image Files", "*.png *.jpg *.jpeg *.webp *.bmp *.tif *.tiff"),
                ("All Files", "*.*"),
            ]
        )
        if fn:
            self.bg_var.set(fn)

    def _clear_bg(self):
        self.bg_var.set("")

    def _on_shape_changed(self, event=None):
        if self.shape_var.get() == "Custom Image" and not self.bounce_image_var.get().strip():
            self._browse_bounce_image()

    def _browse_bounce_image(self):
        fn = filedialog.askopenfilename(
            title="Select Custom Bounce Object Image",
            filetypes=[
                ("Image Files", "*.png *.jpg *.jpeg *.webp *.bmp *.gif"),
                ("PNG with Alpha", "*.png"),
                ("All Files", "*.*"),
            ],
        )
        if fn:
            self.bounce_image_var.set(fn)
            self.shape_var.set("Custom Image")

    def _clear_bounce_image(self):
        self.bounce_image_var.set("")
        if self.shape_var.get() == "Custom Image":
            self.shape_var.set("Glowing Dot")

    def _on_pos_preset_changed(self, event=None):
        choice = self.pos_preset_var.get()
        if "Top" in choice:
            self.pos_var.set(0.22)
            self.pos_badge.config(text="22% (Top)")
        elif "Bottom" in choice:
            self.pos_var.set(0.78)
            self.pos_badge.config(text="78% (Bottom)")
        else:
            self.pos_var.set(0.50)
            self.pos_badge.config(text="50% (Middle)")

    def _on_baseline_scale_changed(self, val_str):
        try:
            v = float(val_str)
        except ValueError:
            return
        pct = int(round(v * 100))
        if v <= 0.35:
            self.pos_badge.config(text=f"{pct}% (Top)")
            self.pos_preset_var.set("Top")
        elif v >= 0.65:
            self.pos_badge.config(text=f"{pct}% (Bottom)")
            self.pos_preset_var.set("Bottom (Subtitles)")
        else:
            self.pos_badge.config(text=f"{pct}% (Middle)")
            self.pos_preset_var.set("Middle (Center)")

    def _on_ttml_changed(self):
        p = self.ttml_var.get().strip()
        if not p or not os.path.isfile(p):
            self.info_lbl.config(text="Select a valid .ttml lyrics file.", fg="#FF453A")
            return
        try:
            doc = parse_ttml_file(p)
            mins = int(doc.total_duration // 60)
            secs = int(doc.total_duration % 60)
            title = doc.title or os.path.basename(p)
            self.info_lbl.config(
                text=f"✓ Loaded: {title}  •  {len(doc.lines)} lines  •  {mins}:{secs:02d} duration",
                fg="#30D158",
            )
        except Exception as e:
            self.info_lbl.config(text=f"✕ Error parsing TTML: {e}", fg="#FF453A")

    def _resolve_codec_and_ext(self) -> Tuple[str, str]:
        v = self.fmt_var.get().lower()
        if "mp4" in v:
            return "mp4", ".mp4"
        elif "webm" in v:
            return "webm", ".webm"
        elif "rle" in v or "animation" in v or "qtrle" in v:
            return "qtrle", ".mov"
        elif "png" in v:
            return "png_mov", ".mov"
        return "prores", ".mov"

    def _resolve_resolution(self) -> Tuple[int, int]:
        v = self.res_var.get()
        if "4K" in v:
            return 3840, 2160
        elif "720p" in v:
            return 1280, 720
        return 1920, 1080

    def _resolve_fps(self) -> float:
        v = self.fps_var.get()
        if "60" in v:
            return 60.0
        elif "24" in v:
            return 24.0
        elif "29.97" in v:
            return 29.97
        return 30.0

    def _start_render(self):
        if self.is_rendering:
            return

        ttml_path = self.ttml_var.get().strip()
        if not ttml_path or not os.path.isfile(ttml_path):
            messagebox.showerror("Error", "Please select a valid .ttml lyrics file first.")
            return

        fmt, ext = self._resolve_codec_and_ext()
        default_out = ttml_path.rsplit(".", 1)[0] + "_transparent_karaoke" + ext

        save_path = filedialog.asksaveasfilename(
            defaultextension=ext,
            filetypes=[("Video File", f"*{ext}"), ("All Files", "*.*")],
            initialfile=os.path.basename(default_out),
        )
        if not save_path:
            return

        self.current_output_path = save_path
        self.is_rendering = True
        self.cancel_requested = False
        self.render_btn.set_enabled(False)
        self.cancel_btn.set_enabled(True)
        self.progress_bar["value"] = 0
        self.status_lbl.config(text="Initializing FFmpeg encoding pipeline...", fg="#4da6ff")

        # Start render in background thread
        thread = threading.Thread(target=self._render_worker, args=(ttml_path, save_path, fmt), daemon=True)
        thread.start()

    def _cancel_render(self):
        self.cancel_requested = True
        self.status_lbl.config(text="Cancelling render...", fg="#ff8080")
        if getattr(self, "_active_ffmpeg_proc", None):
            try:
                self._active_ffmpeg_proc.terminate()
            except Exception:
                pass

    def _render_worker(self, ttml_path: str, output_path: str, fmt: str):
        try:
            doc = parse_ttml_file(ttml_path)
            w, h = self._resolve_resolution()
            fps = self._resolve_fps()

            # Dynamic font sizing relative to resolution
            scale_factor = h / 1080.0
            base_font_size = self.font_size_var.get() if hasattr(self, "font_size_var") else 68
            font_size = int(round(base_font_size * scale_factor))
            try:
                base_bounce_size = int(self.bounce_size_var.get()) if hasattr(self, "bounce_size_var") else 18
            except Exception:
                base_bounce_size = 18
            base_bounce_size = max(4, min(150, base_bounce_size))
            bounce_size = max(4, int(round(base_bounce_size * scale_factor)))
            base_bounce_height = max(65.0, base_bounce_size * 2.5)
            bounce_height = base_bounce_height * scale_factor

            bg_path = self.bg_var.get().strip()
            if not bg_path or not os.path.isfile(bg_path):
                bg_path = None

            bounce_img_path = self.bounce_image_var.get().strip()
            if not bounce_img_path or not os.path.isfile(bounce_img_path):
                bounce_img_path = None

            pos_choice = self.pos_preset_var.get()
            if "Top" in pos_choice:
                pos_val = "top"
            elif "Bottom" in pos_choice:
                pos_val = "bottom"
            else:
                pos_val = "middle"

            active_c = hex_to_rgba(self.active_color_var.get(), 255)
            inactive_c = hex_to_rgba(self.inactive_color_var.get(), 180)
            bounce_c = hex_to_rgba(self.bounce_color_var.get(), 255)

            style = VideoStyleConfig(
                width=w,
                height=h,
                fps=fps,
                position=pos_val,
                baseline_y_ratio=self.pos_var.get(),
                font_name=self.font_var.get().strip() or "Open Sans",
                font_size=font_size,
                active_color=active_c,
                inactive_color=inactive_c,
                bounce_color=bounce_c,
                enable_bounce=self.bounce_var.get(),
                bounce_shape=self.shape_var.get(),
                bounce_size=bounce_size,
                bounce_height=bounce_height,
                single_line_mode=self.single_line_var.get(),
                format_type=fmt,
                skip_short_words=self.skip_short_var.get(),
                background_image=bg_path,
                bounce_image=bounce_img_path,
                filter_background_vocals=self.filter_bg_var.get() if hasattr(self, "filter_bg_var") else True,
            )

            audio_path = self.audio_var.get().strip()
            if not audio_path or not os.path.isfile(audio_path):
                audio_path = None

            def on_progress(cur: int, total: int, enc_fps: float, eta: float):
                pct = (cur / total) * 100.0
                mins = int(eta // 60)
                secs = int(eta % 60)
                txt = f"Rendering: {pct:.1f}% (Frame {cur}/{total}) • {enc_fps:.1f} fps • ETA: {mins}:{secs:02d}"
                self.root.after(0, lambda: self._update_progress_ui(pct, txt))

            ok, res = render_karaoke_video(
                doc=doc,
                output_path=output_path,
                style=style,
                audio_path=audio_path,
                progress_callback=on_progress,
                cancel_check=lambda: self.cancel_requested,
                on_proc_started=lambda p: setattr(self, "_active_ffmpeg_proc", p),
            )

            self.root.after(0, lambda: self._finish_render(ok, res))
        except Exception as e:
            self.root.after(0, lambda: self._finish_render(False, str(e)))

    def _update_progress_ui(self, pct: float, text: str):
        self.progress_bar["value"] = pct
        self.status_lbl.config(text=f"● {text}", fg="#0A84FF")

    def _finish_render(self, ok: bool, message: str):
        self.is_rendering = False
        self._active_ffmpeg_proc = None
        self.render_btn.set_enabled(True)
        self.cancel_btn.set_enabled(False)

        if ok:
            self.progress_bar["value"] = 100
            self.status_lbl.config(text=f"✓ Complete: {os.path.basename(message)}", fg="#30D158")
            ans = messagebox.askyesno(
                "Export Complete!",
                f"Transparent karaoke video rendered successfully:\n\n{message}\n\nWould you like to reveal the file in Finder?",
            )
            if ans:
                if sys.platform == "darwin":
                    subprocess.run(["open", "-R", message])
                elif sys.platform == "win32":
                    subprocess.run(f'explorer /select,"{message}"')
        else:
            self.status_lbl.config(text=f"✕ Error: {message}", fg="#FF453A")
            messagebox.showerror("Export Failed", message)


def main():
    parser = argparse.ArgumentParser(description="Transparent Karaoke Video Generator")
    parser.add_argument("-i", "--input", help="Path to input TTML lyrics file")
    parser.add_argument("-o", "--output", help="Path to output video file")
    parser.add_argument("-a", "--audio", help="Optional path to audio track to mux")
    parser.add_argument("--format", choices=["prores", "qtrle", "webm", "png_mov", "mp4"], default="prores", help="Video codec format")
    parser.add_argument("--res", choices=["1080p", "4k", "720p"], default="1080p", help="Resolution preset")
    parser.add_argument("--fps", type=float, default=60.0, help="Frame rate (default 60 fps for smooth motion)")
    parser.add_argument("--position", choices=["top", "middle", "bottom", "center", "lower_third"], default="middle", help="Lyrics vertical position preset")
    parser.add_argument("--baseline", type=float, default=None, help="Custom baseline Y ratio (0.15 to 0.90)")
    parser.add_argument("--background", "--bg-image", dest="bg_image", help="Optional path to custom background image (PNG, JPG, etc.)")
    parser.add_argument("--font", default="Open Sans", help="Font family name or path to font file")
    parser.add_argument("--font-size", type=int, default=68, help="Base font size in pixels (default: 68)")
    parser.add_argument("--active-color", default="#FFD728", help="Active sung lyrics color in hex (default: #FFD728)")
    parser.add_argument("--inactive-color", default="#D2D2DC", help="Upcoming lyrics color in hex (default: #D2D2DC)")
    parser.add_argument("--bounce-color", default="#FF3C5F", help="Bouncing object color in hex (default: #FF3C5F)")
    parser.add_argument("--bounce-image", help="Optional path to custom bouncing object image (PNG, JPG, etc.)")
    parser.add_argument("--single-line", action=argparse.BooleanOptionalAction, default=True, help="Single line mode (disable with --no-single-line for 2-line mode)")
    parser.add_argument("--no-bounce", action="store_true", help="Disable bouncing object")
    parser.add_argument("--shape", default="glow", help="Shape (glow, circle, star, note)")
    parser.add_argument("--skip-short", action=argparse.BooleanOptionalAction, default=True, help="Skip bouncing on rapid micro-syllables (< 0.22s) near other words")
    parser.add_argument("--min-bounce-dur", type=float, default=0.22, help="Minimum duration threshold for micro-syllable bounce")
    parser.add_argument("--keep-bg", action="store_true", help="Keep background vocals instead of filtering them for lead sync")
    args, _ = parser.parse_known_args()

    # CLI mode
    if args.input:
        if not os.path.isfile(args.input):
            print(f"[Error] File not found: {args.input}")
            sys.exit(1)

        doc = parse_ttml_file(args.input)
        if args.format == "mp4":
            ext = ".mp4"
        elif args.format == "webm":
            ext = ".webm"
        else:
            ext = ".mov"
        out_path = args.output or (args.input.rsplit(".", 1)[0] + "_karaoke" + ext)

        res_map = {"1080p": (1920, 1080), "4k": (3840, 2160), "720p": (1280, 720)}
        w, h = res_map.get(args.res.lower(), (1920, 1080))
        scale = h / 1080.0

        pos = args.position.lower()
        if args.baseline is not None:
            pos_ratio = args.baseline
        elif pos == "top":
            pos_ratio = 0.22
        elif pos in ("bottom", "lower_third"):
            pos_ratio = 0.78
        else:
            pos_ratio = 0.50

        active_c = hex_to_rgba(args.active_color, 255)
        inactive_c = hex_to_rgba(args.inactive_color, 180)
        bounce_c = hex_to_rgba(args.bounce_color, 255)

        style = VideoStyleConfig(
            width=w,
            height=h,
            fps=args.fps,
            position=pos,
            baseline_y_ratio=pos_ratio,
            font_name=args.font,
            font_size=int(round(args.font_size * scale)),
            active_color=active_c,
            inactive_color=inactive_c,
            bounce_color=bounce_c,
            bounce_height=60.0 * scale,
            bounce_size=int(round(18 * scale)),
            enable_bounce=not args.no_bounce,
            bounce_shape=args.shape,
            single_line_mode=args.single_line,
            format_type=args.format,
            skip_short_words=args.skip_short,
            min_bounce_duration=args.min_bounce_dur,
            background_image=args.bg_image,
            bounce_image=args.bounce_image,
            filter_background_vocals=not args.keep_bg,
        )

        bg_info = f", background: '{os.path.basename(args.bg_image)}'" if args.bg_image else ", transparent alpha"
        print(f"[Info] Rendering karaoke video ({w}x{h} @ {args.fps}fps, position: {pos}{bg_info}) to: {out_path}")

        def print_progress(cur, total, fps, eta):
            pct = (cur / total) * 100.0
            print(f"\rProgress: {pct:5.1f}% | Frame {cur}/{total} | {fps:5.1f} fps | ETA: {int(eta)}s", end="", flush=True)

        ok, res = render_karaoke_video(
            doc=doc,
            output_path=out_path,
            style=style,
            audio_path=args.audio,
            progress_callback=print_progress,
        )
        print()
        if ok:
            print(f"[Success] Video exported: {res}")
        else:
            print(f"[Error] {res}")
            sys.exit(1)
        return

    # GUI Mode
    if not tk:
        print("[Error] Tkinter is not available on this Python installation. Use CLI arguments (-i / -o).")
        sys.exit(1)

    root = tk.Tk()
    app = TransparentKaraokeApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
