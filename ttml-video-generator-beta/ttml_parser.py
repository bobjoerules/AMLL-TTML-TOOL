"""
TTML Parser Module.
Extracts timed lines and word-synchronized lyrics from standard and Apple-style TTML XML documents.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import xml.etree.ElementTree as ET


@dataclass
class LyricWord:
    text: str
    start_time: float  # seconds
    end_time: float    # seconds
    is_bg: bool = False

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)


@dataclass
class LyricLine:
    words: List[LyricWord] = field(default_factory=list)
    start_time: float = 0.0  # seconds
    end_time: float = 0.0    # seconds
    is_bg: bool = False
    translation: str = ""
    romanization: str = ""

    @property
    def text(self) -> str:
        return "".join(w.text for w in self.words)

    @property
    def duration(self) -> float:
        return max(0.0, self.end_time - self.start_time)


@dataclass
class TTMLDocument:
    title: str = ""
    artist: str = ""
    album: str = ""
    lines: List[LyricLine] = field(default_factory=list)

    @property
    def total_duration(self) -> float:
        if not self.lines:
            return 0.0
        return max(line.end_time for line in self.lines)


def parse_timestamp(ts: Optional[str]) -> float:
    """Parses a TTML timestamp string (e.g. '01:23.456', '00:01:23.456', '83.456s') to seconds."""
    if not ts:
        return 0.0
    ts = ts.strip()
    if ts.endswith("s"):
        try:
            return float(ts[:-1])
        except ValueError:
            return 0.0

    parts = ts.split(":")
    try:
        if len(parts) == 3:
            hours = float(parts[0])
            minutes = float(parts[1])
            seconds = float(parts[2])
            return hours * 3600.0 + minutes * 60.0 + seconds
        elif len(parts) == 2:
            minutes = float(parts[0])
            seconds = float(parts[1])
            return minutes * 60.0 + seconds
        elif len(parts) == 1:
            return float(parts[0])
    except ValueError:
        return 0.0
    return 0.0


def _clean_tag(tag: str) -> str:
    """Strips namespace prefix from XML tag."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _is_bg_elem(elem) -> bool:
    """Checks whether an XML element is tagged with a background vocal role."""
    for k, v in elem.attrib.items():
        if "role" in k.lower() and ("bg" in v.lower() or "background" in v.lower()):
            return True
    return False


def parse_ttml(xml_content: str) -> TTMLDocument:
    """
    Parses TTML XML content into structured TTMLDocument.
    Cleanly separates lead vocals and background vocals (x-bg) so that
    overlapping background ad-libs do not disrupt lead vocal syllable sync.
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid TTML XML: {e}")

    doc = TTMLDocument()
    head = None
    body = None

    for child in root:
        tag = _clean_tag(child.tag).lower()
        if tag == "head":
            head = child
        elif tag == "body":
            body = child

    if head is not None:
        for elem in head.iter():
            tag = _clean_tag(elem.tag).lower()
            if tag == "title" and elem.text and not doc.title:
                doc.title = elem.text.strip()
            elif tag in ("agent", "artist") and elem.text and not doc.artist:
                doc.artist = elem.text.strip()

    if body is None:
        return doc

    for p in body.iter():
        if _clean_tag(p.tag).lower() != "p":
            continue

        p_begin = parse_timestamp(p.attrib.get("begin"))
        p_end = parse_timestamp(p.attrib.get("end"))
        is_p_bg = _is_bg_elem(p)

        line = LyricLine(start_time=p_begin, end_time=p_end, is_bg=is_p_bg)
        main_words: List[LyricWord] = []
        bg_lines_from_p: List[LyricLine] = []

        if p.text and p.text.strip():
            main_words.append(LyricWord(text=p.text, start_time=p_begin, end_time=p_end, is_bg=is_p_bg))

        child_spans = list(p)
        for i, span in enumerate(child_spans):
            span_tag = _clean_tag(span.tag).lower()
            if span_tag == "span":
                span_begin_str = span.attrib.get("begin")
                span_end_str = span.attrib.get("end")

                w_start = parse_timestamp(span_begin_str) if span_begin_str else p_begin
                w_end = parse_timestamp(span_end_str) if span_end_str else p_end

                is_span_bg = is_p_bg or _is_bg_elem(span)
                if is_span_bg and not is_p_bg:
                    # Nested background vocal span inside a lead vocal <p>
                    # Check for sub-spans inside the background span
                    sub_spans = [s for s in span if _clean_tag(s.tag).lower() == "span"]
                    bg_words: List[LyricWord] = []
                    if sub_spans:
                        for s_i, sub in enumerate(sub_spans):
                            sub_b = parse_timestamp(sub.attrib.get("begin")) if sub.attrib.get("begin") else w_start
                            sub_e = parse_timestamp(sub.attrib.get("end")) if sub.attrib.get("end") else w_end
                            sub_text = "".join(sub.itertext())
                            if s_i < len(sub_spans) - 1 and sub.tail and not sub_text.endswith(" ") and any(c.isspace() for c in sub.tail):
                                sub_text += " "
                            if sub_text:
                                bg_words.append(LyricWord(text=sub_text, start_time=sub_b, end_time=sub_e, is_bg=True))
                    else:
                        span_text = "".join(span.itertext())
                        if span_text:
                            bg_words.append(LyricWord(text=span_text, start_time=w_start, end_time=w_end, is_bg=True))
                    if bg_words:
                        bg_line_start = min(w.start_time for w in bg_words)
                        bg_line_end = max(w.end_time for w in bg_words)
                        bg_lines_from_p.append(LyricLine(start_time=bg_line_start, end_time=bg_line_end, is_bg=True, words=bg_words))
                    continue

                span_text = "".join(span.itertext())
                if i < len(child_spans) - 1 and span.tail and not span_text.endswith(" ") and any(c.isspace() for c in span.tail):
                    span_text += " "

                if span_text:
                    main_words.append(
                        LyricWord(
                            text=span_text,
                            start_time=w_start,
                            end_time=w_end,
                            is_bg=is_p_bg,
                        )
                    )
            elif span.tail and span.tail.strip():
                main_words.append(
                    LyricWord(
                        text=span.tail,
                        start_time=p_begin,
                        end_time=p_end,
                        is_bg=is_p_bg,
                    )
                )

        if not main_words and not bg_lines_from_p:
            full_text = "".join(p.itertext()).strip()
            if full_text:
                main_words.append(
                    LyricWord(
                        text=full_text,
                        start_time=p_begin,
                        end_time=p_end,
                        is_bg=is_p_bg,
                    )
                )

        line.words = main_words
        if line.end_time <= line.start_time and main_words:
            line.end_time = max(w.end_time for w in main_words)
        if line.start_time == 0.0 and main_words:
            line.start_time = min(w.start_time for w in main_words)

        if line.words:
            doc.lines.append(line)
        if bg_lines_from_p:
            doc.lines.extend(bg_lines_from_p)

    # Sort lines chronologically
    doc.lines.sort(key=lambda l: l.start_time)

    return doc


def parse_ttml_file(file_path: str) -> TTMLDocument:
    """Reads a TTML file from disk and parses it."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return parse_ttml(content)
