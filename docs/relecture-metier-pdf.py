#!/usr/bin/env python3
"""E1-12 — convertit docs/RELECTURE_METIER.md en PDF imprimable.

Rendu direct du Markdown (pas de duplication de texte) : ce script parse le
sous-ensemble de syntaxe utilisé dans le document (titres, gras/italique,
listes, tableaux, séparateurs de page, blocs de code = espace d'annotation)
et le reconstruit avec reportlab. Toute modification du .md se propage donc
au PDF sans réécriture manuelle.

    pip install reportlab
    python docs/relecture-metier-pdf.py

Nécessite les polices Arial de Windows (C:/Windows/Fonts) pour couvrir les
caractères hors Latin-1 du document (≤, ≈, →) ; à adapter si exécuté ailleurs.

Le hash de commit imprimé en pied de page n'est pas celui qui ajoute ce
fichier au dépôt (chronologiquement impossible à connaître avant le commit),
mais celui auquel le moteur a produit les chiffres du document — voir
docs/relecture-metier.data.json, extrait par
apps/api/src/scripts/relecture-metier-extract.ts à ce même commit.
"""

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

DOCS_DIR = Path(__file__).resolve().parent
SOURCE_MD = DOCS_DIR / "RELECTURE_METIER.md"
OUTPUT_PDF = DOCS_DIR / "RELECTURE_METIER.pdf"

# Commit auquel le moteur a produit les chiffres de ce document (cf. docstring).
ENGINE_COMMIT = "0e8e245"

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("Body", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("Body-Bold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("Body-Italic", str(FONT_DIR / "ariali.ttf")))
pdfmetrics.registerFont(TTFont("Body-BoldItalic", str(FONT_DIR / "arialbi.ttf")))
registerFontFamily(
    "Body",
    normal="Body",
    bold="Body-Bold",
    italic="Body-Italic",
    boldItalic="Body-BoldItalic",
)

STYLE_TITLE = ParagraphStyle(
    "DocTitle", fontName="Body-Bold", fontSize=18, leading=22, spaceAfter=14,
)
STYLE_H2 = ParagraphStyle(
    "H2", fontName="Body-Bold", fontSize=14, leading=18, spaceBefore=6, spaceAfter=8,
)
STYLE_BODY = ParagraphStyle(
    "Body", fontName="Body", fontSize=10, leading=14, spaceAfter=8, alignment=TA_LEFT,
)
STYLE_BULLET = ParagraphStyle(
    "Bullet", parent=STYLE_BODY, leftIndent=14, bulletIndent=0, spaceAfter=4,
)
STYLE_NUMBERED = ParagraphStyle(
    "Numbered", parent=STYLE_BODY, leftIndent=14, spaceAfter=2,
)
STYLE_CELL = ParagraphStyle(
    "Cell", fontName="Body", fontSize=8, leading=10,
)
STYLE_CELL_HEAD = ParagraphStyle(
    "CellHead", fontName="Body-Bold", fontSize=8.5, leading=10, textColor=colors.white,
)


BREAK_MARKER = "\x00BR\x00"


def join_raw(lines) -> str:
    """Joint des lignes brutes (retour à la ligne Markdown ` \\` -> marqueur de
    saut) AVANT toute conversion inline, pour qu'un **gras**/*italique* qui
    s'étend sur plusieurs lignes source reste reconnaissable comme une seule
    chaîne au moment de la conversion."""
    prepped = []
    for raw in lines:
        line = raw.rstrip()
        if line.endswith("\\"):
            prepped.append(line[:-1].rstrip() + " " + BREAK_MARKER)
        else:
            prepped.append(line)
    return " ".join(prepped)


def inline_md_to_rl(text: str) -> str:
    """Convertit gras/italique/retour-ligne forcé Markdown vers le balisage reportlab."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = text.replace(BREAK_MARKER, "<br/>")
    return text


def flush_paragraph(story, lines, style=STYLE_BODY):
    if not lines:
        return
    story.append(Paragraph(inline_md_to_rl(join_raw(lines)), style))
    lines.clear()


def render_table(story, rows):
    header, *data = rows
    table_data = [[Paragraph(inline_md_to_rl(c), STYLE_CELL_HEAD) for c in header]]
    for row in data:
        table_data.append([Paragraph(inline_md_to_rl(c), STYLE_CELL) for c in row])
    n_cols = len(header)
    page_width = A4[0] - 4 * cm
    col_widths = [page_width * w for w in [0.30, 0.20, 0.20, 0.30]][:n_cols]
    if n_cols != 4:
        col_widths = [page_width / n_cols] * n_cols
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f4858")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#999999")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 10))


def render_annotation_box(story):
    box = Table([[""]], colWidths=[A4[0] - 4 * cm], rowHeights=[2.8 * cm])
    box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor("#999999")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(box)
    story.append(Spacer(1, 10))


def parse_segment(story, segment_lines):
    """Parse un segment de Markdown (entre deux séparateurs `---`) en flowables."""
    paragraph_buffer = []
    table_buffer = []
    i = 0
    n = len(segment_lines)
    while i < n:
        raw = segment_lines[i]
        line = raw.rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph(story, paragraph_buffer)
            i += 1
            while i < n and not segment_lines[i].strip().startswith("```"):
                i += 1
            i += 1  # skip closing fence
            render_annotation_box(story)
            continue

        if stripped.startswith("| "):
            flush_paragraph(story, paragraph_buffer)
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if not re.match(r"^:?-+:?$", cells[0]):
                table_buffer.append(cells)
            i += 1
            continue
        elif table_buffer:
            render_table(story, table_buffer)
            table_buffer = []

        if stripped.startswith("# "):
            flush_paragraph(story, paragraph_buffer)
            story.append(Paragraph(inline_md_to_rl(stripped[2:]), STYLE_TITLE))
            i += 1
            continue

        if stripped.startswith("## "):
            flush_paragraph(story, paragraph_buffer)
            story.append(Paragraph(inline_md_to_rl(stripped[3:]), STYLE_H2))
            i += 1
            continue

        if stripped.startswith("- "):
            flush_paragraph(story, paragraph_buffer)
            item_lines = [stripped[2:]]
            i += 1
            while i < n and segment_lines[i].startswith("  ") and segment_lines[i].strip():
                item_lines.append(segment_lines[i].strip())
                i += 1
            text = inline_md_to_rl(join_raw(item_lines))
            story.append(Paragraph(f"&bull;&nbsp;&nbsp;{text}", STYLE_BULLET))
            continue

        m = re.match(r"^(\d+)\.\s(.*)$", stripped)
        if m:
            flush_paragraph(story, paragraph_buffer)
            item_lines = [m.group(2)]
            i += 1
            while i < n and segment_lines[i].startswith("   ") and segment_lines[i].strip():
                item_lines.append(segment_lines[i].strip())
                i += 1
            text = inline_md_to_rl(join_raw(item_lines))
            story.append(Paragraph(f"{m.group(1)}.&nbsp;&nbsp;{text}", STYLE_NUMBERED))
            continue

        if not stripped:
            flush_paragraph(story, paragraph_buffer)
            i += 1
            continue

        paragraph_buffer.append(stripped)
        i += 1

    if table_buffer:
        render_table(story, table_buffer)
    flush_paragraph(story, paragraph_buffer)


def build_story(markdown_text: str):
    story = []
    segments = re.split(r"\n---\n", markdown_text)
    for idx, segment in enumerate(segments):
        if idx > 0:
            story.append(PageBreak())
        parse_segment(story, segment.splitlines())
    return story


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Body", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    text = (
        f"Toisé — relecture métier des sept listes d'achat — "
        f"chiffres produits par le moteur au commit {ENGINE_COMMIT} — "
        f"page {canvas.getPageNumber()}"
    )
    canvas.drawCentredString(A4[0] / 2, 1.2 * cm, text)
    canvas.restoreState()


def main():
    markdown_text = SOURCE_MD.read_text(encoding="utf-8")
    story = build_story(markdown_text)
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2.2 * cm,
        title="Relecture métier des sept listes d'achat",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"[relecture-metier-pdf] écrit : {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
