from __future__ import annotations

import html
import hashlib
import io
import re
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _safe_text(value: Any, limit: int = 2_000_000) -> str:
    return str(value or "")[:limit]


def extract_docx(path: Path, max_chars: int = 200_000) -> dict[str, Any]:
    paragraphs: list[str] = []
    with zipfile.ZipFile(path) as archive:
        data = archive.read("word/document.xml")
        media = [
            {"name": name, "size": archive.getinfo(name).file_size}
            for name in archive.namelist()
            if name.startswith("word/media/") and not name.endswith("/")
        ]
    root = ET.fromstring(data)
    for paragraph in root.iter(f"{{{WORD_NS}}}p"):
        text = "".join(node.text or "" for node in paragraph.iter(f"{{{WORD_NS}}}t")).strip()
        if text:
            paragraphs.append(text)
    content = "\n".join(paragraphs)
    return {
        "format": "docx",
        "content": content[:max_chars],
        "paragraph_count": len(paragraphs),
        "embedded_media": media[:100],
        "embedded_media_count": len(media),
        "truncated": len(content) > max_chars,
    }


def extract_pdf(path: Path, max_chars: int = 200_000) -> dict[str, Any]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise RuntimeError("PDF support is unavailable because the bundled pypdf package is missing.") from exc
    reader = PdfReader(str(path))
    pages: list[str] = []
    page_layout: list[dict[str, Any]] = []
    embedded_images: list[dict[str, Any]] = []
    total = 0
    truncated = False
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            width = float(page.mediabox.width)
            height = float(page.mediabox.height)
        except (TypeError, ValueError):
            width = height = 0.0
        page_images: list[str] = []
        try:
            for image in page.images:
                name = str(getattr(image, "name", "") or f"page-{page_number}-image")
                page_images.append(name)
                embedded_images.append({"page": page_number, "name": name})
        except Exception:
            pass
        page_layout.append({"page": page_number, "width_points": round(width, 2), "height_points": round(height, 2), "embedded_image_count": len(page_images)})
        text = page.extract_text() or ""
        remaining = max_chars - total
        if remaining <= 0:
            truncated = True
            break
        pages.append(text[:remaining])
        total += min(len(text), remaining)
        if len(text) > remaining:
            truncated = True
            break
    return {
        "format": "pdf",
        "content": "\n\n".join(pages),
        "page_count": len(reader.pages),
        "pages_extracted": len(pages),
        "page_layout": page_layout[:200],
        "embedded_images": embedded_images[:200],
        "embedded_image_count": len(embedded_images),
        "truncated": truncated or len(pages) < len(reader.pages),
    }


def extract_document(path: Path, max_chars: int = 200_000) -> dict[str, Any]:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        result = extract_docx(path, max_chars)
    elif suffix == ".pdf":
        result = extract_pdf(path, max_chars)
    elif suffix in {".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm"}:
        content = path.read_text(encoding="utf-8", errors="replace")
        result = {"format": suffix.removeprefix("."), "content": content[:max_chars], "truncated": len(content) > max_chars}
    else:
        raise ValueError(f"Unsupported document format: {suffix or '<none>'}")
    result.update({"path": str(path), "size": path.stat().st_size})
    return result


def _paragraph_xml(text: str, style: str = "") -> str:
    value = html.escape(text)
    props = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    return f'<w:p>{props}<w:r><w:t xml:space="preserve">{value}</w:t></w:r></w:p>'


def _document_xml(title: str, content: str) -> str:
    blocks: list[str] = []
    if title.strip():
        blocks.append(_paragraph_xml(title.strip(), "Title"))
    for raw in _safe_text(content).splitlines():
        line = raw.rstrip()
        if not line:
            blocks.append("<w:p/>")
        elif line.startswith("### "):
            blocks.append(_paragraph_xml(line[4:], "Heading3"))
        elif line.startswith("## "):
            blocks.append(_paragraph_xml(line[3:], "Heading2"))
        elif line.startswith("# "):
            blocks.append(_paragraph_xml(line[2:], "Heading1"))
        elif re.match(r"^\s*[-*]\s+", line):
            blocks.append(_paragraph_xml("• " + re.sub(r"^\s*[-*]\s+", "", line)))
        else:
            blocks.append(_paragraph_xml(line))
    body = "".join(blocks) + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' \
        f'<w:document xmlns:w="{WORD_NS}"><w:body>{body}</w:body></w:document>'


def create_docx(path: Path, title: str, content: str, *, overwrite: bool = False) -> dict[str, Any]:
    if path.exists() and not overwrite:
        raise FileExistsError(f"Target already exists: {path.name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''
    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''
    styles = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="{WORD_NS}">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:eastAsia="Microsoft YaHei"/><w:sz w:val="21"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="25"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>
</w:styles>'''
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/_rels/document.xml.rels", doc_rels)
        archive.writestr("word/styles.xml", styles)
        archive.writestr("word/document.xml", _document_xml(title, content))
    temp = path.with_name(f".{path.name}.tmp")
    temp.write_bytes(buffer.getvalue())
    temp.replace(path)
    return {"format": "docx", "path": str(path), "size": path.stat().st_size}


def create_text_document(path: Path, content: str, *, overwrite: bool = False) -> dict[str, Any]:
    """Write generated Markdown or plain text atomically and return verification metadata."""
    suffix = path.suffix.lower()
    if suffix not in {".md", ".txt"}:
        raise ValueError("Text document target must end with .md or .txt.")
    if path.exists() and not overwrite:
        raise FileExistsError(f"Target already exists: {path.name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    data = _safe_text(content).encode("utf-8")
    temp = path.with_name(f".{path.name}.tmp")
    temp.write_bytes(data)
    temp.replace(path)
    text = data.decode("utf-8")
    return {
        "format": suffix.removeprefix("."),
        "path": str(path),
        "size": len(data),
        "line_count": len(text.splitlines()),
        "sha256": hashlib.sha256(data).hexdigest(),
        "preview": text.splitlines()[:8],
    }


def convert_document(source: Path, target: Path, *, overwrite: bool = False) -> dict[str, Any]:
    if target.suffix.lower() != ".docx":
        raise ValueError("The current document converter outputs .docx files only.")
    extracted = extract_document(source)
    created = create_docx(target, source.stem, str(extracted.get("content", "")), overwrite=overwrite)
    return {"source": str(source), "target": created["path"], "source_format": extracted["format"], "size": created["size"]}
