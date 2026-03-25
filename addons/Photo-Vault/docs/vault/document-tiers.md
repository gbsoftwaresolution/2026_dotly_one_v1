# Document support tiers (preview + thumbnails)

Booster Vault can **upload any file type** (stored as an encrypted blob). In-app **preview and thumbnails are best-effort** and depend on the file format.

Notes:
- All previews/thumbnails are generated client-side from decrypted bytes.
- Derived assets (thumbnails) are encrypted with the per-media key before upload.

## Tier 1 — must-have (very common)

These formats have in-app preview support and dedicated thumbnails.

- **PDF**: `.pdf` (`application/pdf`)
  - Preview: rich PDF viewer
  - Thumbnail: page-1 render (PNG)

- **Microsoft Office (modern)**
  - Word: `.docx` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
    - Preview: rendered document
    - Thumbnail: offscreen render + screenshot (PNG)
  - Excel: `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
    - Preview: grid renderer (supports empty cells + merges)
    - Thumbnail: mini-grid (PNG)
  - PowerPoint: `.pptx` (`application/vnd.openxmlformats-officedocument.presentationml.presentation`)
    - Preview: text extraction (best-effort)
    - Thumbnail: slide-text thumbnail (PNG)

- **Microsoft Office (legacy)**: `.doc/.xls/.ppt`
  - Upload: allowed
  - Preview: not supported (download-only). Convert to `.docx/.xlsx/.pptx` for preview.

- **Plain text**: `.txt` (`text/plain`)
  - Preview: text
  - Thumbnail: text snippet (PNG)

- **CSV**: `.csv` (`text/csv`)
  - Preview: table (best-effort)
  - Thumbnail: mini-table (PNG)

- **ZIP**: `.zip` (`application/zip`)
  - Preview: entry listing (best-effort)
  - Thumbnail: listing thumbnail (PNG)

## Tier 2 — common in tech/teams (safe previews)

These formats have basic previews (sanitized or text-based) and text-style thumbnails.

- **Markdown**: `.md` (`text/markdown`)
  - Preview: rendered Markdown (sanitized)
  - Thumbnail: rendered preview (sanitized) or snippet fallback (PNG)

- **HTML**: `.html/.htm` (`text/html`)
  - Preview: sanitized HTML
  - Thumbnail: rendered preview (sanitized) or snippet fallback (PNG)

- **Rich Text**: `.rtf` (`application/rtf` / `text/rtf`)
  - Preview: best-effort text extraction
  - Thumbnail: snippet (PNG)

- **JSON**: `.json` (`application/json`)
  - Preview: text (pretty-printed when possible)
  - Thumbnail: snippet (PNG)

- **XML**: `.xml` (`application/xml` / `text/xml`)
  - Preview: text
  - Thumbnail: snippet (PNG)

- **YAML**: `.yml/.yaml` (`application/yaml` / `text/yaml` when provided)
  - Preview: text
  - Thumbnail: snippet (PNG)

- **Log files**: `.log` (usually `text/plain`)
  - Preview: text
  - Thumbnail: snippet (PNG)

## Tier 3 — open standards (international)

- **OpenDocument Text**: `.odt` (`application/vnd.oasis.opendocument.text`)
  - Preview: download-only (no in-app preview)
  - Thumbnail: snippet (PNG)

- **OpenDocument Spreadsheet**: `.ods` (`application/vnd.oasis.opendocument.spreadsheet`)
  - Preview: download-only (no in-app preview)
  - Thumbnail: snippet (PNG)

- **OpenDocument Presentation**: `.odp` (`application/vnd.oasis.opendocument.presentation`)
  - Preview: download-only (no in-app preview)
  - Thumbnail: snippet (PNG)

## Tier 4 — nice-to-have / non-trivial

- **EPUB**: `.epub` (`application/epub+zip`)
  - Preview: download-only
  - Thumbnail: cover extraction when available, else snippet (PNG)

- **MOBI**: `.mobi`
  - Upload: allowed
  - Preview: download-only

- **Email**: `.eml` (`message/rfc822`), Outlook `.msg`
  - Upload: allowed
  - Preview: download-only

- **Archives beyond zip**: `.7z`, `.rar`, `.tar.gz`, etc.
  - Upload: allowed
  - Preview: download-only

## What happens for unknown formats?

- Upload: allowed (encrypted)
- Preview: download-only
- Thumbnail: generic document badge (PNG), or snippet if it can be treated as text
