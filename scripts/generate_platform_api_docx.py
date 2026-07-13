#!/usr/bin/env python3
"""Generate Tractor Junction Platform API & Integration Overview Word document."""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Inches, Pt, RGBColor, Cm


OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "Tractor_Junction_Platform_API_Integration_Overview.docx"


def set_cell_shading(cell, hex_color: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tePr = cell._tc.get_or_add_tcPr()
    cell._tc.get_or_add_tcPr().append(shading)


def set_run_font(run, *, bold=False, italic=False, size=11, color=None, name="Calibri", mono=False):
    run.bold = bold
    run.italic = italic
    run.font.size = Pt(size)
    run.font.name = "Consolas" if mono else name
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:ascii"), "Consolas" if mono else name)
    rFonts.set(qn("w:hAnsi"), "Consolas" if mono else name)
    if color:
        run.font.color.rgb = RGBColor(*color)


def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.color.rgb = RGBColor(0x1A, 0x36, 0x5D)
    return p


def add_para(doc, text, *, bold=False, italic=False, size=11, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    # Handle simple **bold** and `code` segments
    parts = []
    i = 0
    while i < len(text):
        if text.startswith("**", i):
            end = text.find("**", i + 2)
            if end != -1:
                parts.append(("bold", text[i + 2 : end]))
                i = end + 2
                continue
        if text.startswith("`", i):
            end = text.find("`", i + 1)
            if end != -1:
                parts.append(("code", text[i + 1 : end]))
                i = end + 1
                continue
        # plain until next marker
        next_bold = text.find("**", i)
        next_code = text.find("`", i)
        candidates = [x for x in (next_bold, next_code) if x != -1]
        nxt = min(candidates) if candidates else len(text)
        if nxt > i:
            parts.append(("plain", text[i:nxt]))
        i = nxt if candidates else len(text)

    for kind, chunk in parts:
        run = p.add_run(chunk)
        if kind == "bold":
            set_run_font(run, bold=True, size=size)
        elif kind == "code":
            set_run_font(run, size=size - 1, mono=True, color=(0x1F, 0x29, 0x37))
        else:
            set_run_font(run, bold=bold, italic=italic, size=size)
    return p


def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.autofit = True

    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        run = p.add_run(h)
        set_run_font(run, bold=True, size=9, color=(0xFF, 0xFF, 0xFF))
        set_cell_shading(hdr[i], "1A365D")

    for r_idx, row in enumerate(rows):
        cells = table.rows[r_idx + 1].cells
        bg = "F7FAFC" if r_idx % 2 == 0 else "FFFFFF"
        for c_idx, val in enumerate(row):
            cells[c_idx].text = ""
            p = cells[c_idx].paragraphs[0]
            # light markdown in cells
            text = str(val)
            if text.startswith("**") and text.endswith("**") and text.count("**") == 2:
                run = p.add_run(text.strip("*"))
                set_run_font(run, bold=True, size=9)
            else:
                # split on backticks for code
                segments = text.split("`")
                for si, seg in enumerate(segments):
                    if not seg:
                        continue
                    run = p.add_run(seg)
                    if si % 2 == 1:
                        set_run_font(run, size=8, mono=True)
                    else:
                        set_run_font(run, size=9)
            set_cell_shading(cells[c_idx], bg)

    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                if i < len(row.cells):
                    row.cells[i].width = Inches(w)

    doc.add_paragraph()
    return table


def add_code_block(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.left_indent = Inches(0.15)
    run = p.add_run(text)
    set_run_font(run, size=8, mono=True, color=(0x1F, 0x29, 0x37))
    # light background via shading on paragraph
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), "F1F5F9")
    pPr.append(shd)
    return p


def add_note(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.left_indent = Inches(0.1)
    run = p.add_run(text)
    set_run_font(run, italic=True, size=10, color=(0x4A, 0x55, 0x68))
    return p


def add_numbered(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Number")
        p.clear()
        # reuse markdown-ish parsing via add_para style inline
        parts = []
        text = item
        i = 0
        while i < len(text):
            if text.startswith("**", i):
                end = text.find("**", i + 2)
                if end != -1:
                    parts.append(("bold", text[i + 2 : end]))
                    i = end + 2
                    continue
            if text.startswith("`", i):
                end = text.find("`", i + 1)
                if end != -1:
                    parts.append(("code", text[i + 1 : end]))
                    i = end + 1
                    continue
            next_bold = text.find("**", i)
            next_code = text.find("`", i)
            candidates = [x for x in (next_bold, next_code) if x != -1]
            nxt = min(candidates) if candidates else len(text)
            if nxt > i:
                parts.append(("plain", text[i:nxt]))
            i = nxt if candidates else len(text)
        for kind, chunk in parts:
            run = p.add_run(chunk)
            if kind == "bold":
                set_run_font(run, bold=True, size=11)
            elif kind == "code":
                set_run_font(run, size=10, mono=True)
            else:
                set_run_font(run, size=11)


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.clear()
        run = p.add_run(item)
        # simple: whole item may contain backticks
        p.clear()
        segments = item.split("`")
        for si, seg in enumerate(segments):
            if not seg:
                continue
            run = p.add_run(seg)
            if si % 2 == 1:
                set_run_font(run, size=10, mono=True)
            else:
                set_run_font(run, size=11)


def build():
    doc = Document()

    # Page setup
    for section in doc.sections:
        section.top_margin = Cm(1.8)
        section.bottom_margin = Cm(1.8)
        section.left_margin = Cm(2.0)
        section.right_margin = Cm(2.0)

    # Title
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("Tractor Junction — Platform API & Integration Overview")
    set_run_font(run, bold=True, size=22, color=(0x1A, 0x36, 0x5D), name="Calibri")

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("Backend / Platform technical reference")
    set_run_font(run, italic=True, size=12, color=(0x4A, 0x55, 0x68))

    add_table(
        doc,
        ["Field", "Value"],
        [
            ["Document owner", "Backend / Platform (Tech Lead)"],
            ["Audience", "Engineering, QA, SRE, Product, Partner integrations"],
            ["Scope", "Tractor Junction web + mobile backend (tractorjunction repo)"],
            ["Source of truth date", "2026-07-13"],
            ["Primary API surface", "API V3 (/api/v3/{locale}/…)"],
            ["Docs UI", "/api/v3/documentation (basic auth in production)"],
        ],
        col_widths=[2.2, 5.0],
    )

    # --- 0 ---
    add_heading(doc, "0. Executive summary (Tech Lead)", 1)
    add_para(
        doc,
        "This repository is the **public marketplace + mobile API backend**. It is **not** the CRM application itself. CRM is integrated as:",
    )
    add_numbered(
        doc,
        [
            "A **separate MySQL database** (`CRMDB` → `leads` table via `App\\Model\\CRMLead`)",
            "An **outbound HTTP CRM service** (`CRMS_URL` / `UPDATE_CRMS_URL`)",
        ],
    )
    add_para(
        doc,
        "**BMS** is **not present** in this codebase. If stakeholders refer to “BMS”, confirm whether they mean **CRMS** (CRM service) or another internal system outside this repo.",
    )
    add_para(
        doc,
        "**Postman collections are not checked into git.** The maintained machine-readable catalog is **OpenAPI V3** (Swagger), generated from route catalogs. Teams should export Postman from OpenAPI or maintain collections in a shared Postman workspace and link them here.",
    )
    add_para(
        doc,
        "**Production response times (p50/p95/p99) are not stored in this repository.** Section 2 includes module inventories and a **measurement backlog** for SRE/APM to fill.",
    )

    # --- 1 ---
    add_heading(doc, "1. Postman / API collections", 1)
    add_heading(doc, "1.1 Current state", 2)
    add_table(
        doc,
        ["Asset", "Location", "Status"],
        [
            ["Postman collection (.postman_collection.json)", "—", "**Not in repo**"],
            ["Insomnia / Hoppscotch exports", "—", "**Not in repo**"],
            ["OpenAPI route catalog (locale)", "app/Swagger/V3/routes-catalog.php", "**Canonical** (~338 operations)"],
            ["OpenAPI route catalog (global)", "app/Swagger/V3/routes-catalog-global.php", "**Canonical** (7 operations)"],
            ["Generator", "scripts/generate-v3-openapi.php", "composer swagger:generate"],
            [
                "Generated OpenAPI JSON",
                "storage/api-docs/v3-api-docs.json",
                "Runtime / committed publish copy under public/api-docs/ (direct public access blocked via .htaccess)",
            ],
            [
                "Swagger UI",
                "GET /api/v3/documentation",
                "Production: HTTP Basic Auth (LOGVIEWER_USERNAME / LOGVIEWER_PASSWORD)",
            ],
            ["OpenAPI JSON (Laravel)", "GET /api/v3/docs", "Same basic auth in production"],
        ],
    )

    add_heading(doc, "1.2 Recommended Postman operating model", 2)
    add_numbered(
        doc,
        [
            "Treat **Swagger OpenAPI** as source of truth for V3.",
            "After each API change: update `routes/api.php` (or `routes/services.php` / `central_api.php` as applicable); add/update entry in `routes-catalog.php` or `routes-catalog-global.php`; run `composer swagger:generate`; commit updated `public/api-docs/v3-api-docs.json` (if still used as artifact).",
            "Import OpenAPI into Postman: Postman → Import → `v3-api-docs.json` **or** URL `https://<host>/api/v3/docs` (auth required on prod).",
            "Maintain **workspace collections** (not git) for Mobile App (V3), Partner Services (TractorBazzi / Escort / FinJ / VMS), Central / Location masters, Legacy V1 / V2 (if still used by clients).",
        ],
    )

    add_heading(doc, "1.3 Collection inventory (to be maintained by team)", 2)
    add_table(
        doc,
        ["Collection name", "Consumers", "Base path", "Source", "Owner", "Last verified"],
        [
            ["TJ Mobile API V3", "Android / iOS", "/api/v3/{locale}", "OpenAPI / Swagger", "Backend", "TBD — export from OpenAPI"],
            ["TJ Partner Services", "TractorBazzi, Escort, FinJ, VMS", "/api/service/…", "routes/services.php", "Backend", "TBD"],
            ["TJ Central Location API", "Internal / shared masters", "/central_api/…", "routes/central_api.php", "Backend", "TBD"],
            ["TJ API V1 (legacy)", "Older clients", "/api/v1/…", "routes/api.php", "Backend", "TBD"],
            ["TJ API V2 (legacy)", "Locale clients", "/api/v2/{locale}/…", "routes/api.php", "Backend", "TBD"],
            ["TJ TVF", "TVF integration", "/api/tvf/…", "routes/tvf.php", "Backend", "TBD"],
            ["Credit Score (web package)", "Web flows", "/check-credit-score/…", "packages/creditscore", "Creditscore", "TBD"],
        ],
    )
    add_note(doc, "Action: Attach Postman workspace links / collection UIDs in the table above once exported.")

    # --- 2 ---
    add_heading(doc, "2. APIs by module (master + application surfaces)", 1)
    add_heading(doc, "2.1 How routes are mounted", 2)
    add_table(
        doc,
        ["Route file", "Prefix", "Middleware", "Status"],
        [
            ["routes/api.php", "/api", "api", "**Active**"],
            ["routes/services.php", "/api", "api", "**Active**"],
            ["routes/tvf.php", "/api", "api", "**Active**"],
            ["routes/central_api.php", "/central_api", "(namespace only)", "**Active**"],
            ["routes/web.php", "/", "web", "**Active**"],
            [
                "routes/admin.php",
                "intended /{locale}/manage/",
                "—",
                "**Registration commented out** in RouteServiceProvider — confirm per environment",
            ],
            ["routes/dealer.php, routes/manufacturer.php", "—", "—", "Mapping commented out"],
        ],
    )
    add_para(doc, "Registration: `app/Providers/RouteServiceProvider.php`.")

    add_heading(doc, "2.2 API generations", 2)
    add_table(
        doc,
        ["Generation", "Pattern", "Auth", "Notes"],
        [
            ["**V3 (primary)**", "/api/v3/{locale}/… (en|hi|te|ta|mr)", "X-API-KEY (+ Passport auth:api on user routes)", "Mobile app; documented in Swagger"],
            ["**V3 global**", "/api/v3/… (no locale)", "X-API-KEY", "Search, FinJ candidate, brochure, legacy geo fallbacks"],
            ["**V2**", "/api/v2/{locale}/…", "Mix of key / Passport", "Legacy locale API"],
            ["**V1**", "/api/v1/…", "App-level checks", "Legacy"],
            ["**Services**", "/api/service/{partner}/…", "Partner-specific (e.g. vms_service)", "Inbound partner APIs"],
            ["**Central**", "/central_api/…", "As implemented in controller", "Location master-style HTTP API"],
        ],
    )

    add_heading(doc, "2.3 API V3 modules (from OpenAPI catalog)", 2)
    add_para(
        doc,
        "Counts = catalog entries (locale + global). **Prod latency columns must be filled from APM** (New Relic / Datadog / CloudWatch / access logs). Values below are placeholders.",
    )
    add_table(
        doc,
        ["Module (Swagger tag)", "Approx. ops", "Typical consumers", "Master / lookup?", "Prod p50 (ms)", "Prod p95 (ms)", "Notes"],
        [
            ["Tractors", "37", "App / web", "Partial", "TBD", "TBD", "New tractor catalog"],
            ["Community", "33", "App", "No", "TBD", "TBD", "Social / Q&A"],
            ["General", "27", "App", "Yes (lookups)", "TBD", "TBD", "States, districts, tehsils, HP, hours, etc."],
            ["Used Tractors", "25", "App / web", "Partial", "TBD", "TBD", "Inventory + leads"],
            ["News", "19", "App", "No", "TBD", "TBD", ""],
            ["Leads", "18", "App / CRM path", "No", "TBD", "TBD", "Often fans out to CRMS"],
            ["Certified Dealers", "17", "App", "Partial geo", "TBD", "TBD", "Includes geo masters"],
            ["User Account", "17", "App", "No", "TBD", "TBD", "Passport"],
            ["Brands", "13", "App", "Yes", "TBD", "TBD", ""],
            ["Filters", "13", "App", "Yes", "TBD", "TBD", ""],
            ["Home", "13", "App", "No", "TBD", "TBD", "Widgets / home feed"],
            ["Used Products", "13", "App", "Partial", "TBD", "TBD", ""],
            ["Auth", "10", "App", "No", "TBD", "TBD", "OTP / login"],
            ["Implements", "8", "App", "Partial", "TBD", "TBD", ""],
            ["Dealers", "8", "App", "Partial", "TBD", "TBD", "On-road price related"],
            ["Referral & Wallet", "7", "App", "No", "TBD", "TBD", "May call referral service"],
            ["Tractor Recommendation", "6", "App", "Yes (crop/budget)", "TBD", "TBD", ""],
            ["Comparison", "5", "App", "No", "TBD", "TBD", ""],
            ["Inventory", "5", "App", "No", "TBD", "TBD", "Sell forms"],
            ["Payment", "5", "App", "No", "TBD", "TBD", "Razorpay"],
            ["Score Game", "5", "App", "No", "TBD", "TBD", ""],
            ["Search", "5", "App", "No", "TBD", "TBD", ""],
            ["Tyres", "5", "App", "Partial", "TBD", "TBD", ""],
            ["Brand Series", "4", "App", "Yes", "TBD", "TBD", ""],
            ["E-Commerce", "3", "App", "No", "TBD", "TBD", ""],
            ["Favourites", "3", "App", "No", "TBD", "TBD", ""],
            ["FCM", "3", "App", "No", "TBD", "TBD", "Push tokens"],
            ["Mandi Price", "3", "App", "No", "TBD", "TBD", ""],
            ["Showrooms", "3", "App", "Partial", "TBD", "TBD", ""],
            ["EMI Calculator", "2", "App", "No", "TBD", "TBD", ""],
            ["Listings", "2", "App", "No", "TBD", "TBD", ""],
            ["Reviews", "2", "App / web", "No", "TBD", "TBD", ""],
            ["Tracking", "2", "App", "No", "TBD", "TBD", ""],
            ["Analytics", "1", "App", "No", "TBD", "TBD", ""],
            ["Deep Linking", "1", "App", "No", "TBD", "TBD", ""],
            ["Geo Location", "1", "App", "Partial", "TBD", "TBD", ""],
            ["Static Data", "1", "App", "Yes", "TBD", "TBD", ""],
            ["**Total (catalog)**", "**~345**", "", "", "", "", "Locale 338 + global 7"],
        ],
    )
    add_para(doc, "Full path-level detail: `app/Swagger/V3/routes-catalog.php` and Swagger UI.")

    add_heading(doc, "2.4 Master / reference APIs (cross-cutting)", 2)
    add_para(
        doc,
        "These are the **location & catalog masters** used across CRM flows, app filters, and partner services.",
    )
    add_table(
        doc,
        ["Master domain", "Backend (this app)", "Downstream when Elastic enabled", "Central API mirror"],
        [
            [
                "States",
                "V1/V2/V3 states/get, DB states",
                "{ELASTIC_SEARCH_URL}location-master/api/get_all_states_list",
                "POST /central_api/get_all_state_list",
            ],
            [
                "Districts",
                "districts/{stateId}, DB districts",
                "…/get_all_districts_list(_by_state_id)",
                "POST /central_api/get_all_district_list_by_state_id",
            ],
            [
                "Tehsils",
                "getTehsils, DB tehsils",
                "…/get_all_tehsils_list(_by_district_id|_by_state_id)",
                "POST /central_api/get_all_tehsil_list_by_district_id",
            ],
            [
                "Keyword location",
                "V3 /location/search",
                "…/get_location_by_keyword / slug helpers",
                "GET /central_api/get_location_by_keyword",
            ],
            [
                "Brands / models",
                "V3 Brands + partner service brand/model routes",
                "Local DB (brands, tractors, …)",
                "Partner: TractorBazzi / Escort / FinJ / VMS",
            ],
            ["HP / hours / conditions", "General / Filters modules", "Local DB", "—"],
        ],
    )
    add_para(
        doc,
        "**Feature flag:** `ENABLE_ELASTIC` / `config('app.ENABLE_ELASTIC_SEARCH')` — when not `Y`, code falls back to MySQL masters.",
    )

    add_heading(doc, "2.5 Partner / service APIs (routes/services.php)", 2)
    add_table(
        doc,
        ["Partner", "Base path", "Key endpoints", "Auth"],
        [
            [
                "TractorBazzi",
                "/api/service/tractorbazzi",
                "used-tractor add/update/status; brands; models; states",
                "As implemented in controller",
            ],
            ["Escort", "/api/service/escort", "brands; models; price-valuation", "As implemented"],
            ["FinJ", "/api/service/finj", "brands; models; purchase_request add/get", "Inbound FinJ"],
            [
                "VMS",
                "/api/service/vms",
                "used-tractors CRUD-ish; centers; model-details; id lookup",
                "vms_service middleware + VMS_SERVICE_API_KEY",
            ],
        ],
    )

    add_heading(doc, "2.6 CRM vs backend — latency ownership", 2)
    add_table(
        doc,
        ["Surface", "System of record", "Latency to measure"],
        [
            ["Mobile / web APIs", "This Laravel app (+ Redis, MySQL, Elastic location-master)", "Endpoint p95 on /api/v3/…"],
            ["CRM UI / CRM APIs", "**Separate CRM stack** (not this repo)", "CRM team APM"],
            ["Lead sync from TJ → CRM", "Outbound CRMS_URL / UPDATE_CRMS_URL", "Downstream HTTP time inside lead jobs/controllers"],
            ["CRM DB read from TJ", "CRMDB connection → leads", "DB query time on CRM MySQL"],
        ],
    )

    add_heading(doc, "2.7 How to populate production response times", 2)
    add_numbered(
        doc,
        [
            "Enable/confirm APM on production PHP (or parse access logs for `/api/v3/`).",
            "Export last 7 / 30 days: p50, p95, error rate by route group.",
            "Fill Section 2.3 columns; attach dashboard link here: `_TBD_`.",
            "For master APIs, also capture **downstream** time (location-master / CRMS) separately from TJ PHP time.",
        ],
    )

    # --- 3 ---
    add_heading(doc, "3. Frequently used backend tables", 1)
    add_para(
        doc,
        "Core tables inferred from models and high-churn controllers (used inventory, catalog, leads, geo).",
    )
    add_table(
        doc,
        ["Table", "Model (typical)", "Connection", "Domain"],
        [
            ["users", "App\\User", "default", "Auth / profile (Passport)"],
            ["old_tractors", "App\\Model\\OldTractor", "default", "Used tractor inventory (highest churn)"],
            ["tractors", "App\\Model\\Tractor", "default", "New tractor catalog"],
            ["tractors_trans", "(trans)", "default", "Localized tractor content"],
            ["brands / brands_trans", "App\\Model\\Brand", "default", "Brand master"],
            ["states", "App\\Model\\State", "default", "Geo master (fallback if Elastic off)"],
            ["districts", "App\\Model\\District", "default", "Geo master"],
            ["tehsils", "App\\Model\\Tehsil", "default", "Geo master"],
            ["purchaserequest", "App\\Model\\PurchaseRequest", "default", "Buyer / seller requests"],
            ["leads", "App\\Model\\CRMLead", "**CRMDB**", "CRM leads"],
            ["loans", "App\\Model\\Loan", "default", "Finance leads"],
            ["dealers", "App\\Model\\Dealer", "default", "Dealer network"],
            ["certified_dealers", "App\\Model\\CertifiedDealer", "default", "Certified network"],
            ["implements / harvesters", "Implement / Harvester models", "default", "Implements / harvesters"],
            ["news (+ trans)", "App\\Model\\News", "default", "Content"],
            ["community_posts / community_topics (+ related)", "Community models", "default", "Community"],
            ["ecom_products / ecom_orders (+ related)", "E-com models", "default", "E-commerce"],
            ["elastic_modules", "(config table)", "default", "Which modules use Elastic"],
        ],
    )
    add_para(
        doc,
        "**Other DBs (config present):** blog (`tgblog`), LMS (`DB_CONNECTION_LMS`), CRM (`DB_*_CRM`).",
    )
    add_note(
        doc,
        'Exact "top N by query volume" requires production slow-query / APM table metrics — not available in git. Prefer measuring old_tractors, users, geo tables, purchaserequest, and CRM leads first.',
    )

    # --- 4 ---
    add_heading(doc, "4. Vendor & internal downstream integrations", 1)
    add_heading(doc, "4.1 Integration map", 2)
    add_code_block(
        doc,
        """┌─────────────────────────────────────────────────────────────────┐
│                     Clients (App / Web / Partners)              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Tractor Junction Laravel 8 (this repo)             │
│  API V1/V2/V3 · Services · Central API · Queues (Redis)         │
└───┬───────────┬───────────┬───────────┬───────────┬─────────────┘
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
 MySQL TJ   CRMDB      location-master   CRMS HTTP   Payments / SMS /
 (default)  (leads)    (Elastic HTTP)    (CRM svc)   Firebase / OLX / …""",
    )

    add_heading(doc, "4.2 Catalog of integrations", 2)
    add_table(
        doc,
        ["Integration", "Direction", "Config / env", "Timeout handling (code)", "Failure behaviour (observed pattern)"],
        [
            [
                "CRMS (CRM HTTP) — not BMS",
                "Outbound",
                "CRMS_URL, UPDATE_CRMS_URL, vehicle/VAHAN: CRMS_VEHICLE_DETAILS_*, CRMS_VAHAN_XAPI_KEY",
                "Guzzle commonly timeout=10, connect_timeout=5",
                "Caller-dependent; lead push / vehicle lookup",
            ],
            ["CRM MySQL", "DB", "DB_*_CRM → CRMDB", "DB driver defaults", "Eloquent on leads"],
            [
                "Location master",
                "Outbound HTTP",
                "ENABLE_ELASTIC / ELASTIC_SEARCH_URL, index name default location-master",
                "curl CURLOPT_TIMEOUT 5 / 8 / 15 (helper-specific)",
                "If Elastic disabled → MySQL geo tables",
            ],
            [
                "Elasticsearch PHP client",
                "Outbound",
                "ELASTICSEARCH_HOST/PORT/SCHEME/USER/PASS",
                "Client config",
                "Separate from location-master HTTP helpers",
            ],
            ["Razorpay", "Outbound", "RAZORPAY_TEST_* / RAZORPAY_LIVE_*", "SDK defaults", "Payment controllers V1/V3"],
            ["PayPhi", "Outbound", "PAYPHI_MERCHANT_ID, PAYPHI_AGGREGATOR_ID", "Controller-specific", "PayPhi controller"],
            [
                "Firebase / FCM",
                "Outbound",
                "FIREBASE_CREDENTIALS, FCM_SERVER_KEY",
                "SDK / HTTP",
                "Community notifications, FCM token APIs",
            ],
            [
                "SMS (Textlocal / MSG91)",
                "Outbound",
                "SMS_SERVICE, TEXTLOCAL_*, MSG91_*",
                "Job $timeout e.g. SendSmsJob 30s",
                "Queued where configured",
            ],
            [
                "OTP service",
                "Outbound",
                "OTP_SERVICE_API_KEY, OTP_SERVICE_BASE_URL (default https://crs.farmjunction.in/api)",
                "Service client",
                "Auth / OTP flows",
            ],
            ["Referral API", "Outbound", "REFERRAL_API_URL, REFERRAL_API_KEY", "Http::timeout(10)", "PushReferralStatus"],
            ["OLX", "Outbound", "OLX_* (config/services.php)", "Http::timeout(20|25)", "App\\Services\\Olx\\OlxClient"],
            ["Auction", "Outbound", "AUCTION_TRACTOR_API_URL", "timeout => 15", "Share-to-auction command"],
            ["Google Geocoding", "Outbound", "GOOGLE_GEOCODING_API_KEY", "Service-specific", "GoogleGeocodingService"],
            ["IP geolocation", "Outbound", "ENABLE_IP_API_LOCATION", "timeout => 1", "Fast-fail in LocationTrait"],
            [
                "Credit score",
                "Outbound",
                "CIBIL_SERVICE, INTEGRITY_MASTER_*, CREDISURE_*",
                "Package services",
                "packages/creditscore",
            ],
            ["IFFCO", "Outbound", "IFFCO_*", "Config URLs", "Offer / token flows"],
            ["AWS S3", "Outbound", "AWS_*", "SDK", "Media / assets"],
            [
                "VMS / FinJ / Escort / TractorBazzi",
                "Inbound",
                "e.g. VMS_SERVICE_API_KEY",
                "N/A (we are server)",
                "routes/services.php",
            ],
            ["BMS", "—", "—", "—", "**Not found in this repository**"],
        ],
    )

    add_heading(doc, "4.3 Location-master endpoints used from Helpers", 2)
    add_para(doc, "Base: `{ELASTIC_SEARCH_URL}location-master/api/…` (see `app/Http/Helpers.php`)")
    add_para(doc, "Examples:", space_after=4)
    add_bullets(
        doc,
        [
            "get_all_states_list",
            "get_all_districts_list / get_all_districts_list_by_state_id",
            "get_all_tehsils_list / …_by_district_id / …_by_state_id",
            "get_location_by_id",
            "get_location_by_keyword / slug helpers",
        ],
    )
    add_para(
        doc,
        "**Timeout strategy:** per-helper curl timeouts (5–15s). No global circuit breaker in code — failures should degrade to DB masters when Elastic flag is off; when Elastic is on, callers must handle empty/error responses.",
    )

    add_heading(doc, "4.4 CRMS timeout strategy", 2)
    add_para(doc, "Common Guzzle pattern in Helpers / lead-related code:")
    add_code_block(doc, "new GuzzleHttp\\Client(['timeout' => 10, 'connect_timeout' => 5]);")
    add_para(
        doc,
        "**Guidance:** Treat 10s as soft SLA for CRMS fan-out inside request lifecycle. Prefer queueing lead updates for user-facing APIs that must stay under app UX budgets (~2–3s).",
    )

    # --- 5 ---
    add_heading(doc, "5. Timeout configuration & architectural overview", 1)
    add_heading(doc, "5.1 Timeout matrix (code-derived)", 2)
    add_table(
        doc,
        ["Layer", "Typical value", "Where"],
        [
            ["Guzzle HTTP (CRMS, many helpers)", "**10s** total, **5s** connect", "app/Http/Helpers.php, lead/on-road flows"],
            ["Location-master curl", "**5 / 8 / 15s**", "Helpers.php elastic* functions"],
            ["OLX", "**20–25s**", "OlxClient"],
            ["Referral push", "**10s**", "Http::timeout(10)"],
            ["Auction share", "**15s**", "command client"],
            ["IP API", "**1s**", "LocationTrait"],
            ["Redis RW", "**2s** default", "REDIS_READ_WRITE_TIMEOUT"],
            ["Queue job", "SMS 30s; sitemap 600s; export 7200s", "Job $timeout"],
            ["CLI set_time_limit", "60–600s", "various commands/reports"],
        ],
    )
    add_para(
        doc,
        "**Not defined in repo:** Apache/PHP-FPM `max_execution_time` for production workers — confirm on server images (`Dockerfile` uses `php:7.4.30-apache`).",
    )

    add_heading(doc, "5.2 Architectural overview", 2)
    add_code_block(
        doc,
        """                    ┌──────────────┐
   Mobile App ─────►│   CDN / DNS  │◄──── Web browsers
   Partners   ─────►└──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Apache + PHP │  Docker: php:7.4-apache
                    │ Laravel 8    │  Docroot: public/
                    └──────┬───────┘
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
     ┌──────────┐   ┌──────────┐    ┌──────────────┐
     │ MySQL TJ │   │ Redis    │    │ Outbound HTTP│
     │ + CRMDB  │   │ cache/q  │    │ CRMS, LM, …  │
     └──────────┘   └──────────┘    └──────────────┘""",
    )

    add_para(doc, "**Stack highlights**", space_after=4)
    add_table(
        doc,
        ["Concern", "Choice"],
        [
            ["Framework", "Laravel ^8.65, PHP ^7.3|^8.0 (Docker PHP 7.4)"],
            ["API auth", "X-API-KEY (V3) + Laravel Passport (auth:api)"],
            ["Locales", "en, hi, te, ta, mr"],
            ["Queue / cache", "Redis (QUEUE_CONNECTION=redis)"],
            ["Docs", "L5-Swagger + custom OpenAPI generator"],
            ["Payments", "Razorpay (+ PayPhi)"],
            ["Push", "Firebase / FCM"],
            ["Search / geo service", "location-master over HTTP (+ ES client package)"],
            ["Packages (path)", "packages/creditscore, packages/appsinsight"],
        ],
        col_widths=[2.2, 5.0],
    )

    add_para(doc, "**API V3 request profile**", space_after=4)
    add_numbered(
        doc,
        [
            "Client → `GET/POST /api/v3/{locale}/…`",
            "Middleware `api` (+ route middleware such as `auth:api`, `vms_service`)",
            "Many V3 controllers validate `X-API-KEY`",
            "Controller / service may hit MySQL, Redis, location-master, CRMS, payment, SMS",
            "JSON response to mobile app",
        ],
    )
    add_para(
        doc,
        "**Security note (Tech Lead):** The V3 API key appears in source and frontend assets. Do not treat Swagger key descriptions as the only exposure. Docs UI is basic-auth protected in production; rotate keys via coordinated release if policy requires.",
    )

    add_heading(doc, "5.3 Environments & docs access", 2)
    add_table(
        doc,
        ["Env", "Swagger UI", "Basic auth"],
        [
            ["Local / non-production", "/api/v3/documentation", "No (middleware no-op)"],
            ["Production", "same", "Yes — LOGVIEWER_USERNAME / LOGVIEWER_PASSWORD"],
            ["Static /api-docs/*.json", "Blocked by public/api-docs/.htaccess", "Use /api/v3/docs instead"],
        ],
    )

    # --- 6 ---
    add_heading(doc, "6. Gaps & follow-up actions (ownership)", 1)
    add_table(
        doc,
        ["#", "Gap", "Owner", "Priority", "Done when"],
        [
            ["1", "Postman collections not in repo / workspace links empty", "Backend + Mobile", "P1", "Section 1.3 filled with Postman URLs"],
            ["2", "Production p50/p95 per module unknown", "SRE / Backend", "P0", "Section 2.3 latency columns populated"],
            ["3", 'Confirm whether "BMS" maps to CRMS or external system', "Product + Backend", "P1", "Glossary entry updated"],
            ["4", "Admin routes registration commented — confirm prod admin path", "Backend", "P2", "Doc updated with live admin entrypoint"],
            ["5", "Centralize HTTP client timeouts (single config)", "Backend", "P2", "config/http_clients.php (or similar) adopted"],
            ["6", "Circuit breaker / retry policy for location-master & CRMS", "Backend", "P2", "Documented + implemented"],
            ["7", "Top tables by prod query volume", "DBA / SRE", "P2", "Section 3 rewritten from metrics"],
        ],
    )

    # --- 7 ---
    add_heading(doc, "7. Quick reference — key files", 1)
    add_code_block(
        doc,
        """routes/api.php
routes/services.php
routes/central_api.php
routes/tvf.php
app/Providers/RouteServiceProvider.php
app/Swagger/V3/routes-catalog.php
app/Swagger/V3/routes-catalog-global.php
scripts/generate-v3-openapi.php
config/l5-swagger.php
config/app.php                 # CRMS, Elastic flags
config/services.php            # OTP, OLX, referral, auction, SSO
config/sms.php
config/elasticsearch.php
config/firebase.php
config/logviewer.php           # Basic auth credentials for Swagger in prod
app/Http/Helpers.php           # location-master + many Guzzle clients
app/Http/Middleware/CustomBasicAuthMiddleware.php
packages/creditscore/
Dockerfile
composer.json""",
    )

    # --- 8 ---
    add_heading(doc, "8. Change log", 1)
    add_table(
        doc,
        ["Date", "Author", "Change"],
        [
            [
                "2026-07-13",
                "Tech Lead (engineering)",
                "Initial document from repository audit; Postman/latency marked TBD; BMS noted as absent (CRMS present)",
            ],
        ],
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    build()
