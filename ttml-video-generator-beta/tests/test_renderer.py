"""
Automated unit and integration tests for the Transparent Karaoke Video Generator.
"""

import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ttml_parser import LyricLine, LyricWord, TTMLDocument, parse_ttml
from renderer import (
    LineLayout,
    VideoStyleConfig,
    build_line_schedule,
    render_single_frame,
    render_karaoke_video,
    resolve_font,
    load_bounce_image_sprite,
)
from PIL import Image, ImageDraw


SAMPLE_TTML = """<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal">
  <head>
    <metadata>
      <title>Test Transparent Video</title>
      <agent>Test Artist</agent>
    </metadata>
  </head>
  <body>
    <div>
      <p begin="00:00.500" end="00:03.500">
        <span begin="00:00.500" end="00:01.200">Hello </span>
        <span begin="00:01.200" end="00:02.000">beautiful </span>
        <span begin="00:02.000" end="00:03.500">world</span>
      </p>
    </div>
  </body>
</tt>
"""


class TestVideoRenderer(unittest.TestCase):
    def setUp(self):
        self.doc = parse_ttml(SAMPLE_TTML)
        self.style = VideoStyleConfig(
            width=640,
            height=360,
            fps=30.0,
            font_size=28,
            baseline_y_ratio=0.50,
            bounce_height=20.0,
            enable_bounce=True,
            format_type="prores",
        )

    def test_ttml_parsed_correctly(self):
        self.assertEqual(self.doc.title, "Test Transparent Video")
        self.assertEqual(len(self.doc.lines), 1)
        line = self.doc.lines[0]
        self.assertEqual(len(line.words), 3)
        self.assertEqual(line.words[0].text, "Hello ")
        self.assertEqual(line.words[1].text, "beautiful ")
        self.assertEqual(line.words[2].text, "world")

    def test_layout_and_ball_centering(self):
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = (self.style.height / 2.0) + (self.style.bounce_height / 2.0)
        layout = LineLayout(self.doc.lines[0], 0, font, self.style, baseline_y)

        self.assertEqual(len(layout.words), 3)
        self.assertGreater(layout.total_width, 50)
        # Check centering
        self.assertAlmostEqual(layout.start_x, (self.style.width - layout.total_width) / 2.0, delta=1.0)
        # Check monotonic progression
        self.assertLess(layout.words[0].x_start, layout.words[1].x_start)
        self.assertLess(layout.words[1].x_start, layout.words[2].x_start)

        # Check that the ball lands squarely in the center of word 0 at word 0 start time (0.500s)
        bx0, by0 = layout.get_ball_pos(0.500)
        self.assertAlmostEqual(bx0, layout.words[0].centroid_x, delta=0.5)
        self.assertAlmostEqual(by0, layout.ground_y, delta=0.5)

        # Check that the ball lands squarely in the center of word 1 at word 1 start time (1.200s)
        bx1, by1 = layout.get_ball_pos(1.200)
        self.assertAlmostEqual(bx1, layout.words[1].centroid_x, delta=0.5)
        self.assertAlmostEqual(by1, layout.ground_y, delta=0.5)

    def test_line_schedule_guarantees(self):
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = (self.style.height / 2.0) + (self.style.bounce_height / 2.0)
        layouts = [LineLayout(line, idx, font, self.style, baseline_y) for idx, line in enumerate(self.doc.lines)]
        schedule = build_line_schedule(self.doc, layouts)

        self.assertEqual(len(schedule), 1)
        # Must show at or before vocals start
        self.assertLessEqual(schedule[0].show_start, self.doc.lines[0].start_time)
        self.assertGreaterEqual(schedule[0].show_end, self.doc.lines[0].end_time)

    def test_frame_alpha_transparency(self):
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = (self.style.height / 2.0) + (self.style.bounce_height / 2.0)
        layouts = [LineLayout(line, idx, font, self.style, baseline_y) for idx, line in enumerate(self.doc.lines)]
        schedule = build_line_schedule(self.doc, layouts)

        frame = render_single_frame(1.5, schedule, font, self.style)

        self.assertEqual(frame.size, (self.style.width, self.style.height))
        self.assertEqual(frame.mode, "RGBA")

        # Top-left corner must be completely transparent (alpha = 0)
        corner_pixel = frame.getpixel((10, 10))
        self.assertEqual(corner_pixel[3], 0)

        # Frame must contain visible pixels for text and ball
        ext = frame.getextrema()
        self.assertEqual(ext[3][0], 0, "Background should have zero alpha")
        self.assertGreater(ext[3][1], 150, "Lyrics/ball should have visible alpha")

    def test_skip_short_words(self):
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = 540.0
        # Create line with a very short syllable (0.10s) between two words
        short_line = LyricLine(
            start_time=1.0,
            end_time=3.0,
            words=[
                LyricWord("wan", 1.0, 1.3),
                LyricWord("na ", 1.3, 1.4),   # 0.10s duration -> should be skipped
                LyricWord("grow", 1.4, 2.0),
            ],
        )
        style_skip = VideoStyleConfig(skip_short_words=True, min_bounce_duration=0.20)
        layout_skip = LineLayout(short_line, 0, font, style_skip, baseline_y)
        self.assertEqual(len(layout_skip.bounce_words), 2)
        self.assertEqual(layout_skip.bounce_words[0].text, "wan")
        self.assertEqual(layout_skip.bounce_words[1].text, "grow")

        style_no_skip = VideoStyleConfig(skip_short_words=False)
        layout_no_skip = LineLayout(short_line, 0, font, style_no_skip, baseline_y)
        self.assertEqual(len(layout_no_skip.bounce_words), 3)

    def test_render_karaoke_video_prores(self):
        with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as f:
            temp_path = f.name

        try:
            ok, res = render_karaoke_video(self.doc, temp_path, self.style)
            self.assertTrue(ok, f"Rendering failed: {res}")
            self.assertTrue(os.path.isfile(temp_path))
            self.assertGreater(os.path.getsize(temp_path), 5000)
        finally:
            if os.path.isfile(temp_path):
                os.remove(temp_path)

    def test_lyrics_position_presets(self):
        font = resolve_font(self.style.font_name, self.style.font_size)

        style_top = VideoStyleConfig(width=1920, height=1080, position="top")
        style_mid = VideoStyleConfig(width=1920, height=1080, position="middle")
        style_bot = VideoStyleConfig(width=1920, height=1080, position="bottom")

        # Baseline Y calculations
        base_top = (style_top.height * 0.22) + (style_top.bounce_height / 2.0)
        base_mid = (style_mid.height / 2.0) + (style_mid.bounce_height / 2.0)
        base_bot = style_bot.height * 0.78

        self.assertLess(base_top, base_mid, "Top position should have smaller Y coordinate than middle")
        self.assertLess(base_mid, base_bot, "Middle position should have smaller Y coordinate than bottom")

        layout_top = LineLayout(self.doc.lines[0], 0, font, style_top, base_top)
        layout_bot = LineLayout(self.doc.lines[0], 0, font, style_bot, base_bot)
        self.assertLess(layout_top.baseline_y, layout_bot.baseline_y)

    def test_custom_background_image_rendering(self):
        from PIL import Image
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = (self.style.height / 2.0) + (self.style.bounce_height / 2.0)
        layouts = [LineLayout(line, idx, font, self.style, baseline_y) for idx, line in enumerate(self.doc.lines)]
        schedule = build_line_schedule(self.doc, layouts)

        # Create solid blue background image
        bg = Image.new("RGBA", (self.style.width, self.style.height), (0, 0, 255, 255))
        frame = render_single_frame(1.5, schedule, font, self.style, bg_img=bg)

        self.assertEqual(frame.size, (self.style.width, self.style.height))
        # Non-text corner pixel should equal the background color with 100% alpha (255)
        corner_pixel = frame.getpixel((5, 5))
        self.assertEqual(corner_pixel, (0, 0, 255, 255))

    def test_render_karaoke_video_mp4_with_background(self):
        from PIL import Image
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f_bg:
            bg_path = f_bg.name
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f_out:
            out_path = f_out.name

        try:
            # Create a 640x360 test background image
            test_bg = Image.new("RGB", (640, 360), (30, 40, 60))
            test_bg.save(bg_path, format="PNG")

            mp4_style = VideoStyleConfig(
                width=640,
                height=360,
                fps=30.0,
                font_size=28,
                position="bottom",
                format_type="mp4",
                background_image=bg_path,
            )

            ok, res = render_karaoke_video(self.doc, out_path, mp4_style)
            self.assertTrue(ok, f"MP4 rendering failed: {res}")
            self.assertTrue(os.path.isfile(out_path))
            self.assertGreater(os.path.getsize(out_path), 5000)
        finally:
            if os.path.isfile(bg_path):
                os.remove(bg_path)
            if os.path.isfile(out_path):
                os.remove(out_path)

    def test_glowing_dot_sprite(self):
        from renderer import create_glow_sprite
        sprite = create_glow_sprite(18.0, (255, 60, 95, 255))
        self.assertEqual(sprite.mode, "RGBA")
        self.assertGreater(sprite.width, 36)
        center = sprite.width // 2
        center_px = sprite.getpixel((center, center))
        # Center should be bright (hot core)
        self.assertGreater(center_px[0], 200)
        self.assertGreater(center_px[1], 100)
        self.assertEqual(center_px[3], 255)
        # Outer edge should fade softly to transparent
        edge_px = sprite.getpixel((0, 0))
        self.assertLess(edge_px[3], 15)

    def test_two_line_mode_schedule_and_rendering(self):
        sample_two_lines = """<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml">
  <body>
    <div>
      <p begin="00:01.000" end="00:03.000">
        <span begin="00:01.000" end="00:03.000">First line</span>
      </p>
      <p begin="00:03.200" end="00:05.000">
        <span begin="00:03.200" end="00:05.000">Second line</span>
      </p>
    </div>
  </body>
</tt>"""
        doc2 = parse_ttml(sample_two_lines)
        font = resolve_font(self.style.font_name, self.style.font_size)
        style_2line = VideoStyleConfig(single_line_mode=False)

        line_spacing = style_2line.font_size * 1.55
        slot_a_y = 540.0 - line_spacing * 0.55
        slot_b_y = 540.0 + line_spacing * 0.55

        layouts = [
            LineLayout(doc2.lines[0], 0, font, style_2line, slot_a_y),
            LineLayout(doc2.lines[1], 1, font, style_2line, slot_b_y),
        ]
        sched = build_line_schedule(doc2, layouts, single_line_mode=False)

        # In two-line mode, line 1 is visible as a preview during line 0
        self.assertLessEqual(sched[1].show_start, 2.0)
        self.assertGreaterEqual(sched[0].show_end, 2.0)

        # At t=2.0s, frame should render both lines
        frame = render_single_frame(2.0, sched, font, style_2line)
        self.assertEqual(frame.size, (style_2line.width, style_2line.height))

    def test_custom_bounce_image(self):
        # 1. Invalid or missing path
        self.assertIsNone(load_bounce_image_sprite(None, 20))
        self.assertIsNone(load_bounce_image_sprite("/non/existent/path.png", 20))

        # 2. Test opaque image -> should get circular avatar mask
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            opaque_path = f.name
        try:
            opaque_img = Image.new("RGB", (200, 200), (255, 100, 50))
            opaque_img.save(opaque_path, "JPEG")

            sprite = load_bounce_image_sprite(opaque_path, size=24)
            self.assertIsNotNone(sprite)
            self.assertEqual(sprite.mode, "RGBA")
            self.assertEqual(sprite.size, (48, 48))
            # Corner should be masked out (transparent alpha = 0)
            self.assertEqual(sprite.getpixel((0, 0))[3], 0)
            # Center should be completely visible (alpha = 255)
            self.assertEqual(sprite.getpixel((24, 24))[3], 255)
        finally:
            if os.path.isfile(opaque_path):
                os.remove(opaque_path)

        # 3. Test transparent PNG -> should preserve transparency
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            trans_path = f.name
        try:
            trans_img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
            d = ImageDraw.Draw(trans_img)
            d.rectangle((20, 20, 80, 80), fill=(0, 200, 255, 255))
            trans_img.save(trans_path, "PNG")

            sprite_trans = load_bounce_image_sprite(trans_path, size=20)
            self.assertIsNotNone(sprite_trans)
            self.assertEqual(sprite_trans.mode, "RGBA")
            self.assertLessEqual(sprite_trans.width, 40)
            self.assertLessEqual(sprite_trans.height, 40)
        finally:
            if os.path.isfile(trans_path):
                os.remove(trans_path)

        # 4. Test render_single_frame with custom_bounce_sprite
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = 540.0
        layouts = [LineLayout(line, idx, font, self.style, baseline_y) for idx, line in enumerate(self.doc.lines)]
        schedule = build_line_schedule(self.doc, layouts)

        custom_sprite = Image.new("RGBA", (36, 36), (255, 0, 128, 255))
        style_custom = VideoStyleConfig(bounce_shape="custom")
        frame = render_single_frame(
            1.5,
            schedule,
            font,
            style_custom,
            custom_bounce_sprite=custom_sprite,
        )
        self.assertEqual(frame.size, (style_custom.width, style_custom.height))
        # Verify non-empty alpha
        ext = frame.getextrema()
        self.assertGreater(ext[3][1], 0)

    def test_stderr_drain_and_proc_callback(self):
        """Verify on_proc_started callback fires and render completes without pipe deadlock."""
        started_procs = []
        with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as f:
            out_path = f.name
        try:
            style = VideoStyleConfig(width=320, height=180, fps=15.0)
            ok, res = render_karaoke_video(
                doc=self.doc,
                output_path=out_path,
                style=style,
                on_proc_started=lambda p: started_procs.append(p),
            )
            self.assertTrue(ok)
            self.assertEqual(len(started_procs), 1)
            self.assertTrue(os.path.isfile(out_path))
            self.assertGreater(os.path.getsize(out_path), 0)
        finally:
            if os.path.isfile(out_path):
                os.remove(out_path)

    def test_bounce_size_customization(self):
        """Verify that bounce_size can be customized, scales correctly, and renders properly."""
        font = resolve_font(self.style.font_name, self.style.font_size)
        baseline_y = 540.0

        # Test small, standard, and large bounce sizes
        for size in [8, 18, 36, 60]:
            style = VideoStyleConfig(
                width=1920,
                height=1080,
                bounce_size=size,
                enable_bounce=True,
            )
            layout = LineLayout(self.doc.lines[0], 0, font, style, baseline_y)
            self.assertEqual(layout.bounce_size, size)

            # Ball should land on beat without error
            bx, by = layout.get_ball_pos(0.500)
            self.assertAlmostEqual(bx, layout.words[0].centroid_x, delta=0.5)
            self.assertAlmostEqual(by, layout.ground_y, delta=0.5)

    def test_background_vocals_parsing_and_sync(self):
        """Verify that nested and overlapping background vocals do not pollute lead line sync."""
        sample_ttml_with_bg = """<?xml version="1.0" encoding="utf-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <body>
    <div>
      <p begin="00:10.000" end="00:14.000">
        <span begin="00:10.000" end="00:11.000">Lead </span>
        <span begin="00:11.000" end="00:12.500">singer </span>
        <span begin="00:12.500" end="00:14.000">verse</span>
        <span ttm:role="x-bg" begin="00:11.500" end="00:13.000">
          <span begin="00:11.500" end="00:13.000">(Backing)</span>
        </span>
      </p>
      <p begin="00:14.500" end="00:18.000">
        <span begin="00:14.500" end="00:16.000">Next </span>
        <span begin="00:16.000" end="00:18.000">line</span>
      </p>
    </div>
  </body>
</tt>"""
        doc = parse_ttml(sample_ttml_with_bg)
        # Should have separated lead lines and background lines
        self.assertEqual(len(doc.lines), 3)

        lead_line1 = doc.lines[0]
        self.assertFalse(lead_line1.is_bg)
        self.assertEqual(len(lead_line1.words), 3)
        self.assertEqual([w.text.strip() for w in lead_line1.words], ["Lead", "singer", "verse"])
        # Words must be strictly monotonic in time
        for i in range(len(lead_line1.words) - 1):
            self.assertLessEqual(lead_line1.words[i].start_time, lead_line1.words[i + 1].start_time)

        bg_line = [l for l in doc.lines if l.is_bg][0]
        self.assertTrue(bg_line.is_bg)
        self.assertEqual(bg_line.words[0].text.strip(), "(Backing)")

        # Verify rendering with filter_background_vocals=True filters out bg lines
        font = resolve_font(self.style.font_name, self.style.font_size)
        filtered_lines = [l for l in doc.lines if not l.is_bg]
        self.assertEqual(len(filtered_lines), 2)
        layouts = [LineLayout(l, idx, font, self.style, 180.0) for idx, l in enumerate(filtered_lines)]
        filtered_doc = TTMLDocument(lines=filtered_lines)
        schedule = build_line_schedule(filtered_doc, layouts, single_line_mode=True)

        # Lead line 1 must not be truncated by the overlapping backing vocal
        self.assertGreaterEqual(schedule[0].show_end, lead_line1.end_time)

        # Ball must remain active on lead line while singing
        bx, by = layouts[0].get_ball_pos(12.800)
        self.assertIsNotNone(bx)
        self.assertIsNotNone(by)


if __name__ == "__main__":
    unittest.main()


