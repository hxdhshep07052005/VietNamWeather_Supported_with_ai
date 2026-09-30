import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_deck():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Theme Colors
    BG_COLOR = RGBColor(13, 19, 34)       # #0D1322
    CARD_BG = RGBColor(22, 32, 54)        # #162036
    CARD_BG_LIGHT = RGBColor(30, 41, 59)  # #1E293B
    BORDER_COLOR = RGBColor(51, 65, 85)   # #334155
    BORDER_CYAN = RGBColor(56, 189, 248)  # #38BDF8
    TEXT_MAIN = RGBColor(248, 250, 252)   # #F8FAFC
    TEXT_MUTED = RGBColor(148, 163, 184)  # #94A3B8
    TEXT_DIM = RGBColor(100, 116, 139)    # #64748B
    ACCENT_CYAN = RGBColor(56, 189, 248)  # #38BDF8
    ACCENT_GREEN = RGBColor(74, 222, 128) # #4ADE80
    ACCENT_AMBER = RGBColor(251, 191, 36) # #FBBF24
    ACCENT_RED = RGBColor(248, 113, 113)  # #F87171

    TOTAL_SLIDES = 24

    def add_slide_base(current_idx):
        slide = prs.slides.add_slide(blank_layout)
        # Background
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = BG_COLOR

        # Footer tags (USTH bottom-left, page number bottom-right)
        # Left tag: USTH
        tx_box_l = slide.shapes.add_textbox(Inches(0.8), Inches(7.0), Inches(4.0), Inches(0.4))
        tf_l = tx_box_l.text_frame
        tf_l.word_wrap = True
        tf_l.margin_left = tf_l.margin_right = tf_l.margin_top = tf_l.margin_bottom = 0
        p_l = tf_l.paragraphs[0]
        p_l.text = "USTH"
        p_l.font.size = Pt(11)
        p_l.font.bold = True
        p_l.font.color.rgb = TEXT_DIM
        p_l.font.name = "Arial"

        # Right tag: Page number
        tx_box_r = slide.shapes.add_textbox(Inches(10.5), Inches(7.0), Inches(2.0), Inches(0.4))
        tf_r = tx_box_r.text_frame
        tf_r.word_wrap = True
        tf_r.margin_left = tf_r.margin_right = tf_r.margin_top = tf_r.margin_bottom = 0
        p_r = tf_r.paragraphs[0]
        p_r.alignment = PP_ALIGN.RIGHT
        p_r.text = f"{current_idx:02d} / {TOTAL_SLIDES:02d}"
        p_r.font.size = Pt(11)
        p_r.font.bold = True
        p_r.font.color.rgb = ACCENT_CYAN
        p_r.font.name = "Consolas"

        return slide

    def add_header(slide, tag, title, subtitle=None):
        tx_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.5), Inches(11.7), Inches(1.2))
        tf = tx_box.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0

        # Tag
        p_tag = tf.paragraphs[0]
        p_tag.text = tag
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = ACCENT_CYAN
        p_tag.font.name = "Consolas"

        # Title
        p_title = tf.add_paragraph()
        p_title.text = title
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = TEXT_MAIN
        p_title.font.name = "Arial"
        p_title.space_before = Pt(4)

        if subtitle:
            p_sub = tf.add_paragraph()
            p_sub.text = subtitle
            p_sub.font.size = Pt(11)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.font.name = "Arial"
            p_sub.space_before = Pt(2)

    def add_notes(slide, notes_text):
        notes_slide = slide.notes_slide
        tf = notes_slide.notes_text_frame
        tf.text = notes_text

    def add_notice_bar(slide, left, top, width, height, label, text):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        shape.fill.solid()
        shape.fill.fore_color.rgb = CARD_BG_LIGHT
        shape.line.color.rgb = BORDER_COLOR
        shape.line.width = Pt(1)
        tf = shape.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.margin_left = Inches(0.2)
        tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        r1 = p.add_run()
        r1.text = label + " "
        r1.font.bold = True
        r1.font.size = Pt(11)
        r1.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = text
        r2.font.bold = True
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MAIN

    # =========================================================================
    # SLIDE 1: Title Page
    # =========================================================================
    s1 = add_slide_base(1)
    # USTH Logo
    logo_path = "report/figures/logo/usth.png"
    if os.path.exists(logo_path):
        s1.shapes.add_picture(logo_path, Inches(5.4), Inches(0.8), height=Inches(1.2))

    tx1 = s1.shapes.add_textbox(Inches(1.0), Inches(2.3), Inches(11.33), Inches(4.5))
    tf1 = tx1.text_frame
    tf1.word_wrap = True

    p = tf1.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "UNIVERSITY OF SCIENCE AND TECHNOLOGY OF HANOI (USTH)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Arial"

    p = tf1.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.text = "DEPARTMENT OF INFORMATION AND COMMUNICATION TECHNOLOGY"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED
    p.font.name = "Arial"
    p.space_before = Pt(4)

    p = tf1.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.text = "INTELLIGENT WEATHER-AWARE TRAVEL ASSISTANT\nFOR VIETNAM INTEGRATING AI"
    p.font.size = Pt(28)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p.font.name = "Arial"
    p.space_before = Pt(20)

    p = tf1.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.text = "VietForecast — Multimodal Hazard Synthesis, Spatial Routing & Grounded LLM"
    p.font.size = Pt(14)
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Consolas"
    p.space_before = Pt(10)

    # Candidate & Supervisors card
    card_meta = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.2), Inches(5.1), Inches(8.93), Inches(1.4))
    card_meta.fill.solid()
    card_meta.fill.fore_color.rgb = CARD_BG
    card_meta.line.color.rgb = BORDER_COLOR
    card_meta.line.width = Pt(1)
    tf_m = card_meta.text_frame
    tf_m.word_wrap = True
    tf_m.margin_left = Inches(0.4)
    tf_m.margin_right = Inches(0.4)
    tf_m.margin_top = Inches(0.2)

    p = tf_m.paragraphs[0]
    r = p.add_run()
    r.text = "CANDIDATE: "
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = TEXT_DIM
    r = p.add_run()
    r.text = "ĐẶNG ĐÌNH HÒA  (ID: 23BI14169)  •  Major: Data Science\n"
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = TEXT_MAIN

    r = p.add_run()
    r.text = "SUPERVISORS: "
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = TEXT_DIM
    r = p.add_run()
    r.text = "MSc. Vũ Hà My (External)   |   Dr. Nghiêm Thị Phương (Internal)"
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = TEXT_MAIN

    tx_date = s1.shapes.add_textbox(Inches(4.0), Inches(6.6), Inches(5.33), Inches(0.4))
    p = tx_date.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Hanoi, September 2026"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_DIM
    p.font.name = "Consolas"

    add_notes(s1, "Good morning, respected members of the Defense Committee, professors, and faculty members of the Department of Information and Communication Technology at USTH.\n\nMy name is Dang Dinh Hoa, majoring in Data Science. Today, I am honored to present my graduation thesis entitled: 'Intelligent Weather-Aware Travel Assistant for Vietnam Integrating AI' (VietForecast), supervised by MSc. Vu Ha My and Dr. Nghiem Thi Phuong.")

    # =========================================================================
    # SLIDE 2: Background (Part 1 - Geography & Terrain)
    # =========================================================================
    s2 = add_slide_base(2)
    add_header(s2, "01 • BACKGROUND & PRACTICAL MOTIVATION", "Geography & Climate Disparity Across Vietnam's 1,650 km Spine")

    # Left: Map Image
    map_path = "artifacts/presentation/images/vietnam_political_map.jpg"
    if os.path.exists(map_path):
        s2.shapes.add_picture(map_path, Inches(1.0), Inches(1.8), height=Inches(4.8))

    # Right: Bullets
    tx2 = s2.shapes.add_textbox(Inches(5.6), Inches(1.8), Inches(6.9), Inches(4.5))
    tf2 = tx2.text_frame
    tf2.word_wrap = True
    p = tf2.paragraphs[0]
    p.text = "Vietnam spans 1,650 km North-to-South with 3,260 km of coastline, creating severe microclimate variations across distinct zones:"
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_MAIN
    p.font.bold = True
    p.line_spacing = 1.3

    bullets = [
        ("Northern Highlands & Mountain Passes: ", "Freezing winter cold, dense mountain pass fog, frost, and high landslide risks (Sa Pa, O Quy Ho, Pha Din)."),
        ("Central Coast & Mountain Passes: ", "High-frequency tropical typhoons, torrential localized rains, and gale-force crosswinds over coastal bridges (Hai Van Pass)."),
        ("Southern Delta & Urban Centers: ", "Sudden tropical convective cloudbursts causing severe urban and tidal inundation (Ho Chi Minh City, Mekong Delta).")
    ]
    for b_title, b_desc in bullets:
        p = tf2.add_paragraph()
        p.space_before = Pt(16)
        r = p.add_run()
        r.text = "• " + b_title
        r.font.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(13)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s2, Inches(5.6), Inches(5.8), Inches(6.9), Inches(0.7), "Notice:", "1,650 km North-to-South spine across 3 divergent climate zones.")
    add_notes(s2, "Vietnam extends over 1,650 km North-to-South with diverse microclimates: Northern cold mountain fog, Central coastal typhoons and crosswinds, and Southern sudden flash cloudbursts. A commuter leaving Hanoi in clear weather can face zero-visibility fog in Yen Bai within 2 hours and severe storms in Lao Cai by evening.")

    # =========================================================================
    # SLIDE 3: Background (Part 2 - Two-Wheeler Commuters)
    # =========================================================================
    s3 = add_slide_base(3)
    add_header(s3, "01 • BACKGROUND & PRACTICAL MOTIVATION", "Two-Wheeler Commuting Culture & Physical Vulnerability")

    # Left: Dual Images
    img1 = "artifacts/presentation/images/vietnam_motorcyclists_city.jpg"
    img2 = "artifacts/presentation/images/vietnam_driving_traffic.jpg"
    if os.path.exists(img1):
        s3.shapes.add_picture(img1, Inches(0.8), Inches(1.8), width=Inches(2.7), height=Inches(4.5))
    if os.path.exists(img2):
        s3.shapes.add_picture(img2, Inches(3.6), Inches(1.8), width=Inches(2.7), height=Inches(4.5))

    # Right: Bullets
    tx3 = s3.shapes.add_textbox(Inches(6.6), Inches(1.8), Inches(5.9), Inches(4.5))
    tf3 = tx3.text_frame
    tf3.word_wrap = True
    p = tf3.paragraphs[0]
    p.text = "Vietnam's transport sector is fundamentally distinct from Western automobile-dominated traffic:"
    p.font.size = Pt(14)
    p.font.color.rgb = TEXT_MAIN
    p.font.bold = True

    b_s3 = [
        ("> 72 Million Registered Motorcycles: ", "Constitutes upwards of 85% of active personal trips across Vietnam."),
        ("Zero Protective Cabin: ", "Riders directly absorb the physical impact of tropical downpours and cold winds."),
        ("Aerodynamic Overturning Moments: ", "Lateral wind gusts exceeding 40 km/h threaten vehicle stability across coastal bridges and passes."),
        ("Aquaplaning & Loss of Grip: ", "Water films on asphalt severely degrade tire traction, tripling braking distances.")
    ]
    for b_title, b_desc in b_s3:
        p = tf3.add_paragraph()
        p.space_before = Pt(12)
        r = p.add_run()
        r.text = "• " + b_title
        r.font.bold = True
        r.font.size = Pt(12.5)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = b_desc
        r2.font.size = Pt(12.5)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s3, Inches(6.6), Inches(5.8), Inches(5.9), Inches(0.7), "Notice:", "Routing algorithms must incorporate vehicle-differentiated sensitivity profiles.")
    add_notes(s3, "Unlike automobile drivers protected by enclosed cabins, Vietnam's 72+ million motorcycle riders bear direct physical exposure to weather hazards. Wind gusts on bridges generate lateral overturning torque, while hydroplaning over water films dramatically increases stopping distance.")

    # =========================================================================
    # SLIDE 4: Background (Part 3 - Technology Gap)
    # =========================================================================
    s4 = add_slide_base(4)
    add_header(s4, "01 • BACKGROUND & PRACTICAL MOTIVATION", "The Navigation Technology Gap: Existing Tools vs. VietForecast")

    # Left: Google Maps & Windy cards
    card_g = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(2.2))
    card_g.fill.solid()
    card_g.fill.fore_color.rgb = CARD_BG
    card_g.line.color.rgb = BORDER_COLOR
    tf_g = card_g.text_frame
    tf_g.margin_left = Inches(0.9)
    tf_g.margin_top = Inches(0.2)
    p = tf_g.paragraphs[0]
    p.text = "Google Maps"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p = tf_g.add_paragraph()
    p.text = "Turn-by-turn Navigation\n"
    p.font.size = Pt(10)
    p.font.color.rgb = TEXT_MUTED
    p = tf_g.add_paragraph()
    r = p.add_run()
    r.text = "✓ Pros: "
    r.font.bold = True
    r.font.color.rgb = ACCENT_GREEN
    r = p.add_run()
    r.text = "Best routing, live traffic jams, precise ETA.\n"
    r.font.color.rgb = TEXT_MAIN
    r = p.add_run()
    r.text = "✕ Cons: "
    r.font.bold = True
    r.font.color.rgb = ACCENT_RED
    r = p.add_run()
    r.text = "Weather-blind; treats atmosphere as neutral; routes into storms."
    r.font.color.rgb = TEXT_MUTED
    # Logo Google
    g_logo = "artifacts/presentation/images/google_maps_logo.png"
    if os.path.exists(g_logo):
        s4.shapes.add_picture(g_logo, Inches(1.0), Inches(2.0), width=Inches(0.6))

    card_w = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.3), Inches(5.6), Inches(2.2))
    card_w.fill.solid()
    card_w.fill.fore_color.rgb = CARD_BG
    card_w.line.color.rgb = BORDER_COLOR
    tf_w = card_w.text_frame
    tf_w.margin_left = Inches(0.9)
    tf_w.margin_top = Inches(0.2)
    p = tf_w.paragraphs[0]
    p.text = "Windy"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p = tf_w.add_paragraph()
    p.text = "Global Weather Radar\n"
    p.font.size = Pt(10)
    p.font.color.rgb = TEXT_MUTED
    p = tf_w.add_paragraph()
    r = p.add_run()
    r.text = "✓ Pros: "
    r.font.bold = True
    r.font.color.rgb = ACCENT_GREEN
    r = p.add_run()
    r.text = "Accurate radar, live wind gusts, storm layers.\n"
    r.font.color.rgb = TEXT_MAIN
    r = p.add_run()
    r.text = "✕ Cons: "
    r.font.bold = True
    r.font.color.rgb = ACCENT_RED
    r = p.add_run()
    r.text = "Point-based only; zero route integration; cannot trace a trip."
    r.font.color.rgb = TEXT_MUTED
    # Logo Windy
    w_logo = "artifacts/presentation/images/windy_logo.png"
    if os.path.exists(w_logo):
        s4.shapes.add_picture(w_logo, Inches(1.0), Inches(4.5), width=Inches(0.6))

    # Right: VietForecast card
    card_vf = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.7))
    card_vf.fill.solid()
    card_vf.fill.fore_color.rgb = CARD_BG
    card_vf.line.color.rgb = BORDER_COLOR
    tf_vf = card_vf.text_frame
    tf_vf.margin_left = Inches(0.4)
    tf_vf.margin_right = Inches(0.4)
    tf_vf.margin_top = Inches(0.3)

    p = tf_vf.paragraphs[0]
    p.text = "VietForecast: The Missing Solution"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    p = tf_vf.add_paragraph()
    p.text = "Weather-Aware Travel Assistant"
    p.font.size = Pt(11)
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Consolas"

    p = tf_vf.add_paragraph()
    p.space_before = Pt(14)
    r = p.add_run()
    r.text = "✓ PROS (Key Capabilities):\n"
    r.font.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = ACCENT_GREEN

    vf_pros = [
        "Routes around rain, wind, fog & storms along highways.",
        "Predicts hazards dynamically at your exact arrival time (ETA).",
        "Empirically eliminates 87.2% of extreme danger points.",
        "Specifically calibrated for two-wheeler vulnerability."
    ]
    for pro in vf_pros:
        p = tf_vf.add_paragraph()
        r = p.add_run()
        r.text = "• " + pro
        r.font.size = Pt(11.5)
        r.font.color.rgb = TEXT_MAIN

    p = tf_vf.add_paragraph()
    p.space_before = Pt(14)
    r = p.add_run()
    r.text = "✕ CONS (Current Boundaries):\n"
    r.font.bold = True
    r.font.size = Pt(13)
    r.font.color.rgb = ACCENT_RED

    vf_cons = [
        "No live satellite cloud radar animation stream like Windy.",
        "Requires active internet connectivity for dynamic rerouting."
    ]
    for con in vf_cons:
        p = tf_vf.add_paragraph()
        r = p.add_run()
        r.text = "• " + con
        r.font.size = Pt(11.5)
        r.font.color.rgb = TEXT_MUTED

    add_notes(s4, "Current software creates an impossible trade-off: Google Maps offers turn-by-turn routing but is completely blind to weather; Windy offers rich weather data but in complete isolation from driving routes. VietForecast bridges this gap by incorporating spatial weather into route computation.")

    # =========================================================================
    # SLIDE 5: SOTA Comparison Table
    # =========================================================================
    s5 = add_slide_base(5)
    add_header(s5, "02 • STATE-OF-THE-ART SURVEY & BENCHMARK", "Systematic Feature Comparison: Existing Platforms vs. VietForecast")

    # Table
    rows = 7
    cols = 5
    table_shape = s5.shapes.add_table(rows, cols, Inches(0.8), Inches(1.8), Inches(11.73), Inches(4.5))
    t5 = table_shape.table
    t5.columns[0].width = Inches(4.53)
    t5.columns[1].width = Inches(1.8)
    t5.columns[2].width = Inches(1.8)
    t5.columns[3].width = Inches(1.8)
    t5.columns[4].width = Inches(1.8)

    headers = ["Evaluated Capability Dimension", "Google Maps", "Windy / Weather", "Generic LLMs", "VietForecast"]
    for j, h in enumerate(headers):
        cell = t5.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG_LIGHT
        cell.text = h
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(11)
        p.font.color.rgb = ACCENT_CYAN if j == 4 else TEXT_MAIN
        p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    data_s5 = [
        ("Turn-by-turn inter-provincial routing", "Yes", "No", "No", "Yes"),
        ("Real-time verified weather observations", "No", "Yes", "No", "Yes"),
        ("Weather hazard path evaluation (ETA)", "No", "No", "No", "Yes"),
        ("Vehicle-specific risk weighting (Bike vs Car)", "No", "No", "No", "Yes"),
        ("Multi-objective storm avoidance detour", "No", "No", "No", "Yes"),
        ("Grounded conversational AI assistant", "No", "No", "Depends", "Yes")
    ]
    for i, row in enumerate(data_s5):
        for j, val in enumerate(row):
            cell = t5.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor(18, 26, 44) if i % 2 == 0 else CARD_BG
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(11)
            p.font.name = "Arial"
            if j == 0:
                p.font.bold = True
                p.font.color.rgb = TEXT_MAIN
            else:
                p.alignment = PP_ALIGN.CENTER
                p.font.bold = True
                if val == "Yes":
                    p.font.color.rgb = ACCENT_GREEN
                elif val == "No":
                    p.font.color.rgb = ACCENT_RED
                else:
                    p.font.color.rgb = ACCENT_AMBER

    add_notice_bar(s5, Inches(0.8), Inches(6.5), Inches(11.73), Inches(0.5), "Notice:", "Comprehensive synthesis across navigation, GIS meteorology, and verifiable AI.")
    add_notes(s5, "Table 1.1 in Chapter 1 highlights the critical shortcomings across existing platforms: turn-by-turn navigation is weather-blind; weather radars are route-blind; and generic LLMs hallucinate weather without real telemetry grounding. VietForecast achieves 'Yes' across all 6 key dimensions.")

    # =========================================================================
    # SLIDE 6: Problem Statement & 3 RQs
    # =========================================================================
    s6 = add_slide_base(6)
    add_header(s6, "03 • OBJECTIVES & RESEARCH QUESTIONS", "Mathematical Problem Statement & 3 Research Questions")

    # Left: Diagram OD
    od_path = "artifacts/presentation/images/diagram_od.png"
    if os.path.exists(od_path):
        s6.shapes.add_picture(od_path, Inches(0.8), Inches(1.8), width=Inches(5.6))

    # Right: 3 RQs
    tx6 = s6.shapes.add_textbox(Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.8))
    tf6 = tx6.text_frame
    tf6.word_wrap = True

    p = tf6.paragraphs[0]
    p.text = "3 Core Research Questions (RQs)"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    rqs = [
        ("RQ1: Spatial Freshness & Normalization", "How to ingest, validate, and index heterogeneous meteorological streams across all 63 provinces into PostGIS with sub-second retrieval?"),
        ("RQ2: Multi-Criteria Risk Quantification", "How to synthesize 6 physical variables into an objective hazard index that accurately differentiates between motorcycles and passenger cars?"),
        ("RQ3: Grounded Conversational AI Assistant", "How to constrain neural language models via structured function calling to eliminate hallucinations and provide verifiable travel advice?")
    ]
    for rq_title, rq_desc in rqs:
        p = tf6.add_paragraph()
        p.space_before = Pt(14)
        r = p.add_run()
        r.text = rq_title + "\n"
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = ACCENT_CYAN
        r2 = p.add_run()
        r2.text = rq_desc
        r2.font.size = Pt(11.5)
        r2.font.color.rgb = TEXT_MUTED

    add_notes(s6, "The mathematical problem statement computes candidate paths P = {P_fastest, P_shortest, P_safer} between Origin O and Destination D. P_safer detours around the danger zone to minimize cumulative risk while bounding duration extension. This motivates 3 research questions.")

    # =========================================================================
    # SLIDE 7: Use Case Diagram
    # =========================================================================
    s7 = add_slide_base(7)
    add_header(s7, "04 • REQUIREMENTS & USE CASE HIERARCHY", "System Actors & UML 2.5 Use Case Hierarchy")
    uc_path = "artifacts/presentation/images/usecase.png"
    if os.path.exists(uc_path):
        s7.shapes.add_picture(uc_path, Inches(2.2), Inches(1.7), height=Inches(5.0))
    add_notes(s7, "Chapter 1 formalizes 3 system actors (Guest User, Authenticated Commuter, Administrator) across 8 core use cases. Guest users explore live maps and route safety without login; commuters manage favorite paths and vehicle profiles; administrators monitor worker telemetry and broadcast storm alerts.")

    # =========================================================================
    # SLIDE 8: ERD Database
    # =========================================================================
    s8 = add_slide_base(8)
    add_header(s8, "05 • DATA ARCHITECTURE & SCHEMA DESIGN", "PostgreSQL 16 + PostGIS 3.4 Spatial Data Model (ERD)")
    erd_path = "artifacts/presentation/images/erd_database.png"
    if os.path.exists(erd_path):
        s8.shapes.add_picture(erd_path, Inches(1.5), Inches(1.7), width=Inches(10.33))
    add_notes(s8, "The relational schema in PostGIS 3.4 spans 4 authoritative domains: administrative units (MultiPolygon 4326), weather time-series (Point 4326 with SHA-256 checksums), maker-checker risk rulesets, and spatial route requests with immutable security audit trails.")

    # =========================================================================
    # SLIDE 9: C4 Container Architecture
    # =========================================================================
    s9 = add_slide_base(9)
    add_header(s9, "06 • SYSTEM ARCHITECTURAL DESIGN", "3-Tier Containerized Microservices Architecture (C4 Level 2)")
    c4_path = "artifacts/presentation/images/c4_container.png"
    if os.path.exists(c4_path):
        s9.shapes.add_picture(c4_path, Inches(1.8), Inches(1.7), height=Inches(5.0))
    add_notes(s9, "The C4 container model partitions the platform into 3 tiers: Edge Nginx proxy serving React 18 3D WebGL maps; Application Fastify 5 BFF and background Integration Worker; and Data Tier where PostgreSQL and Redis are marked internal: true with zero public port exposure.")

    # =========================================================================
    # SLIDE 10: Session Security (ADR-004)
    # =========================================================================
    s10 = add_slide_base(10)
    add_header(s10, "07 • SYSTEM SECURITY & IDENTITY (ADR-004)", "Server-Side Session Security Boundary (ADR-004)")

    # 3 Boxes
    b10_w = Inches(3.64)
    b10_h = Inches(4.3)
    b10_y = Inches(1.8)

    # Box 1
    c1 = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), b10_y, b10_w, b10_h)
    c1.fill.solid()
    c1.fill.fore_color.rgb = CARD_BG
    c1.line.color.rgb = BORDER_COLOR
    tf = c1.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "1. Browser Client\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items = [
        "__Host-vnwa_session",
        "32-byte opaque random cookie",
        "• HttpOnly: JS cannot access",
        "• Secure: HTTPS transport only",
        "• SameSite=Strict: Blocks CSRF",
        "\nNotice: Zero JWT stored in browser storage"
    ]
    for it in items:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(11)
        p.font.color.rgb = ACCENT_CYAN if "__Host" in it else TEXT_MUTED

    # Box 2
    c2 = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.84), b10_y, b10_w, b10_h)
    c2.fill.solid()
    c2.fill.fore_color.rgb = CARD_BG
    c2.line.color.rgb = BORDER_COLOR
    tf = c2.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "2. Fastify 5 BFF Shield\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items_c2 = [
        "Cryptographic Boundary",
        "• SHA-256 Hashing:",
        "  session_id_hash = SHA256(handle)",
        "• AES-256-GCM Envelope:",
        "  Directus JWTs encrypted at rest",
        "• Sliding Rotation:",
        "  Silent refresh with 60s grace",
        "• Family Revocation (Ψ):",
        "  Replay revokes all sessions"
    ]
    for it in items_c2:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_MAIN if "•" in it else TEXT_MUTED

    # Box 3
    c3 = s10.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.88), b10_y, b10_w, b10_h)
    c3.fill.solid()
    c3.fill.fore_color.rgb = CARD_BG
    c3.line.color.rgb = BORDER_COLOR
    tf = c3.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "3. Isolated Services\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items_c3 = [
        "Internal Docker Network Only",
        "• Directus 12.1.1 (Identity SoR):",
        "  Argon2id password verification",
        "  13 RBAC role policies",
        "  Zero public web exposure",
        "• PostgreSQL 16 (app_security):",
        "  Encrypted token vault",
        "  Immutable audit events",
        "\nNotice: Network internal: true"
    ]
    for it in items_c3:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_MAIN if "•" in it else TEXT_MUTED

    add_notice_bar(s10, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Security Invariant:", "Compromising client storage yields only an opaque handle, leaving credentials unbreachable.")
    add_notes(s10, "Under ADR-004, the browser never receives Directus JWTs. Instead, it gets an opaque 32-byte cookie (HttpOnly, SameSite=Strict). Real tokens are encrypted on the server with AES-256-GCM. Replay of an expired rotated token immediately triggers family revocation.")

    # =========================================================================
    # SLIDE 11: Worker Resilience (ADR-001)
    # =========================================================================
    s11 = add_slide_base(11)
    add_header(s11, "08 • RESILIENT INGESTION ENGINE (ADR-001)", "Integration Worker: Fault-Tolerant Ingestion Pipeline")

    # 3 Boxes for Worker
    c1 = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), b10_y, b10_w, b10_h)
    c1.fill.solid()
    c1.fill.fore_color.rgb = CARD_BG
    c1.line.color.rgb = BORDER_COLOR
    tf = c1.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "1. External Weather Feed\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items_w1 = [
        "WeatherAPI (WMO)",
        "• 63 Vietnam Provinces",
        "• Current & 3-day forecast",
        "• Periodic 5-minute polling",
        "• API keys strictly in .env.local",
        "\nNotice: Circuit breaker isolates upstream outages"
    ]
    for it in items_w1:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    c2 = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.84), b10_y, b10_w, b10_h)
    c2.fill.solid()
    c2.fill.fore_color.rgb = CARD_BG
    c2.line.color.rgb = BORDER_COLOR
    tf = c2.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "2. Integration Worker (ADR-001)\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items_w2 = [
        "Autonomous Runtime Engine",
        "• 3-State Circuit Breaker:",
        "  CLOSED -> OPEN (3 fails) -> HALF-OPEN",
        "• WMO Normalization & Checksum:",
        "  SHA-256 deduplication cuts I/O >70%",
        "• Distributed Database Leasing:",
        "  120s lease + 30s heartbeat (zero deadlock)"
    ]
    for it in items_w2:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_MAIN if "•" in it else TEXT_MUTED

    c3 = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.88), b10_y, b10_w, b10_h)
    c3.fill.solid()
    c3.fill.fore_color.rgb = CARD_BG
    c3.line.color.rgb = BORDER_COLOR
    tf = c3.text_frame
    tf.margin_left = tf.margin_right = Inches(0.2)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "3. Storage & Cache Tier\n"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    items_w3 = [
        "PostgreSQL 16 (PostGIS):",
        "• weather_observations",
        "• weather_forecasts",
        "• 2D GiST spatial index (<15ms)",
        "Redis 7 (In-Memory):",
        "• TTL: 1,800 seconds",
        "• 92.4% Cache hit ratio",
        "\nNotice: Network internal: true"
    ]
    for it in items_w3:
        p = tf.add_paragraph()
        p.text = it
        p.font.size = Pt(10.5)
        p.font.color.rgb = TEXT_MUTED

    add_notice_bar(s11, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Architecture Principle:", "Isolates ingestion latency from user API requests, prevents database write saturation, and guarantees 24/7 recovery.")
    add_notes(s11, "Under ADR-001, meteorological ingestion runs in an isolated worker process. Distributed database leasing prevents multi-replica race conditions. A 3-state circuit breaker protects system quotas during third-party failures, while SHA-256 checksums cut write I/O by over 70%.")

    # =========================================================================
    # SLIDE 12: PostGIS GiST 2-Tier Filter
    # =========================================================================
    s12 = add_slide_base(12)
    add_header(s12, "09 • GEOSPATIAL DATA PIPELINE (GIST)", "How PostGIS GiST Works: 2-Tier Spatial Filtering Pipeline")

    # Left: 2-Tier Funnel Box
    card_g1 = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_g1.fill.solid()
    card_g1.fill.fore_color.rgb = CARD_BG
    card_g1.line.color.rgb = BORDER_COLOR
    tf_g1 = card_g1.text_frame
    tf_g1.margin_left = tf_g1.margin_right = Inches(0.3)
    tf_g1.margin_top = Inches(0.2)
    p = tf_g1.paragraphs[0]
    p.text = "The 2-Tier Filtering Pipeline"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    p = tf_g1.add_paragraph()
    p.space_before = Pt(10)
    p.text = "Input: 100,000 Spatial Points (Scalability Stress Test)"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN

    p = tf_g1.add_paragraph()
    p.space_before = Pt(10)
    p.text = "▼  Step 1: Bounding Box (BBOX) Pruning [< 1 ms]"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p = tf_g1.add_paragraph()
    p.text = "• Checks MBR intersection on GiST tree in O(log N).\n• Discards distant regions (Central & South) in a single check.\n• Prunes > 98.5% of points immediately (98,500 points eliminated!)."
    p.font.size = Pt(10.5)
    p.font.color.rgb = TEXT_MUTED

    p = tf_g1.add_paragraph()
    p.space_before = Pt(12)
    p.text = "▼  Step 2: Exact Geodetic Filter (ST_DWithin) [11.4 ms]"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p = tf_g1.add_paragraph()
    p.text = "• Calculates curved WGS84 distance only on surviving 1,500 candidates.\n• Outputs matched stations within the 15 km route corridor."
    p.font.size = Pt(10.5)
    p.font.color.rgb = TEXT_MUTED

    # Right: Benchmark Table
    card_g2 = s12.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_g2.fill.solid()
    card_g2.fill.fore_color.rgb = CARD_BG
    card_g2.line.color.rgb = BORDER_COLOR
    tf_g2 = card_g2.text_frame
    tf_g2.margin_left = tf_g2.margin_right = Inches(0.3)
    tf_g2.margin_top = Inches(0.2)
    p = tf_g2.paragraphs[0]
    p.text = "Why GiST is 36.9× Faster (Scalability Benchmark)"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    p = tf_g2.add_paragraph()
    p.space_before = Pt(8)
    p.text = "Sequential Scan: Computes trigonometry for every point in DB (420 ms).\nGiST 2-Tier: Skips distant regions in 0 ms; math on local points only (11.4 ms)."
    p.font.size = Pt(10.5)
    p.font.color.rgb = TEXT_MUTED

    # Small table
    table_g = s12.shapes.add_table(5, 4, Inches(7.0), Inches(3.2), Inches(5.3), Inches(2.2)).table
    table_g.columns[0].width = Inches(1.5)
    table_g.columns[1].width = Inches(1.3)
    table_g.columns[2].width = Inches(1.3)
    table_g.columns[3].width = Inches(1.2)

    g_headers = ["Spatial Scale", "Seq Scan", "Two-Tier GiST", "Speedup"]
    for j, h in enumerate(g_headers):
        cell = table_g.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG_LIGHT
        cell.text = h
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(9.5)
        p.font.color.rgb = TEXT_MAIN
        p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    g_data = [
        ("1,000 Points", "4.82 ms", "0.85 ms", "5.7×"),
        ("10,000 Points", "43.10 ms", "2.15 ms", "20.0×"),
        ("50,000 Points", "212.60 ms", "6.80 ms", "31.3×"),
        ("100,000 Points", "420.50 ms", "11.40 ms", "36.9×")
    ]
    for i, row in enumerate(g_data):
        for j, val in enumerate(row):
            cell = table_g.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(9.5)
            if j == 2:
                p.font.bold = True
                p.font.color.rgb = ACCENT_GREEN
            elif j == 3:
                p.font.bold = True
                p.font.color.rgb = ACCENT_GREEN if i == 3 else ACCENT_CYAN
            else:
                p.font.color.rgb = ACCENT_RED if (j == 1 and i == 3) else TEXT_MUTED
            if j > 0:
                p.alignment = PP_ALIGN.CENTER

    add_notice_bar(s12, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Notice:", "Sub-15ms real-time SLA: Proves database resilience as historical telemetry scales to 100k+ points.")
    add_notes(s12, "Without GiST, querying stations along a route computes trigonometry against every station in Vietnam, costing 420 ms. With GiST, Tier 1 bounding box eliminates over 98.5% of stations in under 1 ms, leaving Tier 2 to compute exact distances for local candidates in 11.4 ms (36.9x speedup).")

    # =========================================================================
    # SLIDE 13: 6D Risk Matrix
    # =========================================================================
    s13 = add_slide_base(13)
    add_header(s13, "10 • METEOROLOGICAL RISK ENGINE", "6-Dimensional Hazard Matrix & Vehicle Calibration")

    # Left: Matrix Table
    card_r1 = s13.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_r1.fill.solid()
    card_r1.fill.fore_color.rgb = CARD_BG
    card_r1.line.color.rgb = BORDER_COLOR
    tf_r1 = card_r1.text_frame
    tf_r1.margin_left = tf_r1.margin_right = Inches(0.3)
    tf_r1.margin_top = Inches(0.2)
    p = tf_r1.paragraphs[0]
    p.text = "Hazard Activation Thresholds (WMO-No. 8)"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    table_r = s13.shapes.add_table(7, 3, Inches(1.0), Inches(2.4), Inches(5.2), Inches(3.2)).table
    table_r.columns[0].width = Inches(1.6)
    table_r.columns[1].width = Inches(1.8)
    table_r.columns[2].width = Inches(1.8)

    r_headers = ["Hazard Dimension", "Caution Threshold", "High Hazard"]
    for j, h in enumerate(r_headers):
        cell = table_r.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG_LIGHT
        cell.text = h
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(9.5)
        p.font.color.rgb = TEXT_MAIN

    r_data = [
        ("Precipitation", "Bike: 10-25 mm/h\nCar: 15-35 mm/h", "Bike: >= 25 mm/h\nCar: >= 35 mm/h"),
        ("Wind Gust", "Bike: 25-40 km/h\nCar: 45-60 km/h", "Bike: >= 40 km/h\nCar: >= 60 km/h"),
        ("Visibility", "Bike: 1000-2000 m\nCar: 500-1000 m", "Bike: < 1000 m\nCar: < 500 m"),
        ("Temperature", "36-38°C or 10-13°C", "> 38°C or < 10°C"),
        ("Convective Storm", "Distant lightning", "Severe squall, hail"),
        ("Official Alert", "Warning Level 1-2", "Warning Level 3+")
    ]
    for i, row in enumerate(r_data):
        for j, val in enumerate(row):
            cell = table_r.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(9)
            p.font.color.rgb = TEXT_MAIN if j == 0 else TEXT_MUTED

    # Right: Principles
    card_r2 = s13.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_r2.fill.solid()
    card_r2.fill.fore_color.rgb = CARD_BG
    card_r2.line.color.rgb = BORDER_COLOR
    tf_r2 = card_r2.text_frame
    tf_r2.margin_left = tf_r2.margin_right = Inches(0.3)
    tf_r2.margin_top = Inches(0.2)
    p = tf_r2.paragraphs[0]
    p.text = "Core Risk Engine Principles"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    pr_items = [
        ("1. Max-Severity Aggregation (RISK-005)", "Checkpoint score equals the worst single dimension: S(p) = max(Rain, Wind, Vis, Temp, Storm, Alert). A squall elevates hazard to High regardless of temperature."),
        ("2. Two-Wheeler Calibration (ROUTE-001)", "Accounts for aerodynamic destabilization on coastal bridges and tire grip loss over wet asphalt. Motorcycle thresholds are tightened by >30% compared to cars."),
        ("3. Fail-Safe Invariant (RISK-006)", "Telemetry older than 180 minutes or disconnected stations resolve strictly to Unknown (Gray). The engine never makes speculative safety assumptions.")
    ]
    for pr_t, pr_d in pr_items:
        p = tf_r2.add_paragraph()
        p.space_before = Pt(12)
        r = p.add_run()
        r.text = pr_t + "\n"
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = pr_d
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s13, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Notice:", "Guarantees deterministic, reproducible hazard outputs across all 63 provinces.")
    add_notes(s13, "The risk engine evaluates 6 physical dimensions aligned with WMO-No. 8 standards. It enforces Max-Severity aggregation so that a single extreme hazard triggers proper caution. Motorcycle thresholds are tightened by over 30%, while stale data defaults safely to Unknown.")

    # =========================================================================
    # SLIDE 14: Weather-Safer Routing Algorithm
    # =========================================================================
    s14 = add_slide_base(14)
    add_header(s14, "11 • MULTI-OBJECTIVE ROUTE COMPUTATION", "Weather-Safer Routing Algorithm: Dynamic ETA & Pareto Scoring")

    # Left: Sampling & ETA
    card_a1 = s14.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_a1.fill.solid()
    card_a1.fill.fore_color.rgb = CARD_BG
    card_a1.line.color.rgb = BORDER_COLOR
    tf_a1 = card_a1.text_frame
    tf_a1.margin_left = tf_a1.margin_right = Inches(0.3)
    tf_a1.margin_top = Inches(0.2)
    p = tf_a1.paragraphs[0]
    p.text = "1. Checkpoint Sampling & ETA Matching"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    steps_a1 = [
        ("Step A: Discretize Candidate Paths", "Places checkpoints every 5 km (or max 15 minutes of driving) along OSRM candidate polylines."),
        ("Step B: Extrapolate Arrival Time (ETA)", "Accumulates driving duration along the corridor: ETA = Departure_Time + Distance / Average_Speed."),
        ("Step C: Query Localized Forecast Window", "Matches each checkpoint with the weather forecast for the exact hour you arrive at that pass.")
    ]
    for st_t, st_d in steps_a1:
        p = tf_a1.add_paragraph()
        p.space_before = Pt(12)
        r = p.add_run()
        r.text = st_t + "\n"
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = st_d
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MUTED

    # Right: Pareto Function
    card_a2 = s14.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_a2.fill.solid()
    card_a2.fill.fore_color.rgb = CARD_BG
    card_a2.line.color.rgb = BORDER_COLOR
    tf_a2 = card_a2.text_frame
    tf_a2.margin_left = tf_a2.margin_right = Inches(0.3)
    tf_a2.margin_top = Inches(0.2)
    p = tf_a2.paragraphs[0]
    p.text = "2. Balanced Pareto Cost Function"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    # Formula box
    box_f = s14.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.1), Inches(2.5), Inches(5.1), Inches(0.8))
    box_f.fill.solid()
    box_f.fill.fore_color.rgb = CARD_BG_LIGHT
    box_f.line.color.rgb = BORDER_COLOR
    tf_f = box_f.text_frame
    p = tf_f.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Route Score = 0.5 × Hazard + 0.3 × Duration + 0.2 × Distance"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p.font.name = "Consolas"

    p = tf_a2.add_paragraph()
    p.space_before = Pt(65)
    p.text = "• 50% Hazard Penalty (w = 0.5): Heavy penalty for squall winds, heavy rain, or landslides."
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED

    p = tf_a2.add_paragraph()
    p.space_before = Pt(8)
    p.text = "• 30% Duration Penalty (w = 0.3): Ensures safety detours do not excessively prolong travel."
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED

    p = tf_a2.add_paragraph()
    p.space_before = Pt(8)
    p.text = "• 20% Distance Penalty (w = 0.2): Prevents unnecessarily circuitous alternative detours."
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED

    add_notice_bar(s14, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Notice:", "Weather-Safer Selected: The candidate path with the lowest aggregate score is chosen.")
    add_notes(s14, "The routing algorithm samples path geometry at 5 km / 15 min checkpoints, calculating arrival ETA to match localized forecast windows. A Pareto objective function balances 50% Atmospheric Risk, 30% Travel Duration, and 20% Distance.")

    # =========================================================================
    # SLIDE 15: Route Hazard Visualization (2 Top, 1 Bottom)
    # =========================================================================
    s15 = add_slide_base(15)
    add_header(s15, "12 • ROUTE HAZARD LEVEL VISUALIZATION", "Route Alternatives in Action: 3 Meteorological Hazard Levels")

    # 2 Images Top
    im_fast = "artifacts/presentation/images/ui_route_fastest.png"
    im_short = "artifacts/presentation/images/ui_route_shortest.png"
    im_safer = "artifacts/presentation/images/ui_route_safer.png"

    if os.path.exists(im_fast):
        s15.shapes.add_picture(im_fast, Inches(1.8), Inches(1.8), width=Inches(4.4))
    tx_f = s15.shapes.add_textbox(Inches(1.8), Inches(4.5), Inches(4.4), Inches(0.4))
    p = tx_f.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Fastest (CT05)  •  R = 0.68 (High Risk)"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = ACCENT_RED

    if os.path.exists(im_short):
        s15.shapes.add_picture(im_short, Inches(7.13), Inches(1.8), width=Inches(4.4))
    tx_s = s15.shapes.add_textbox(Inches(7.13), Inches(4.5), Inches(4.4), Inches(0.4))
    p = tx_s.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Shortest (QL70)  •  R = 0.42 (Caution)"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = ACCENT_AMBER

    # 1 Image Bottom Centered
    if os.path.exists(im_safer):
        s15.shapes.add_picture(im_safer, Inches(4.2), Inches(4.9), width=Inches(4.9))
    tx_sf = s15.shapes.add_textbox(Inches(4.2), Inches(6.8), Inches(4.9), Inches(0.4))
    p = tx_sf.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "Weather-Safer (Proposed Solution)  •  R = 0.14 (Safe)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ACCENT_GREEN

    add_notes(s15, "Here are the 3 real-world route options rendered on our WebGL Map on the Hanoi — Lao Cai corridor: Fastest on CT05 (R = 0.68) cuts through storm cells; Shortest on QL70 (R = 0.42) has mountain pass fog; Weather-Safer (R = 0.14) detours around storm cells and eliminates 100% of extreme hazards.")

    # =========================================================================
    # SLIDE 16: AI Assistant (Part 1 - Tools & Pipeline)
    # =========================================================================
    s16 = add_slide_base(16)
    add_header(s16, "13 • GROUNDED CONVERSATIONAL AI", "Grounded Conversational AI: Function Calling & Data Pipeline")

    # Left: 5 Tools list
    tx_t1 = s16.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.5))
    tf_t1 = tx_t1.text_frame
    tf_t1.word_wrap = True
    p = tf_t1.paragraphs[0]
    p.text = "5 Allowlisted Function Calling Tools"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    tools = [
        "1.  search_location",
        "2.  get_current_weather",
        "3.  get_forecast",
        "4.  assess_travel_risk",
        "5.  evaluate_route"
    ]
    for tool in tools:
        p = tf_t1.add_paragraph()
        p.space_before = Pt(12)
        p.text = tool
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = TEXT_MAIN
        p.font.name = "Consolas"

    p = tf_t1.add_paragraph()
    p.space_before = Pt(20)
    p.text = "Core Rule: Gemini cannot generate weather data; it is bound strictly to these 5 JSON-schema tools."
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED

    # Right: How AI & Data Work Together
    tx_t2 = s16.shapes.add_textbox(Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.5))
    tf_t2 = tx_t2.text_frame
    tf_t2.word_wrap = True
    p = tf_t2.paragraphs[0]
    p.text = "How AI & Data Work Together"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    ai_data_points = [
        ("AI Role: ", "Gemini 1.5 Flash acts only as an Intent Parser. It interprets user questions and calls the appropriate tool, rather than inventing numbers."),
        ("Real Data Retrieval: ", "Fastify executes the tool against live PostGIS station telemetry (<= 180 min fresh). Zero fake data provided."),
        ("Grounded Response: ", "AI synthesizes natural travel advice based 100% on this real data, citing Station IDs and timestamps. Cuts hallucinations by 94.8%."),
        ("Offline Fallback: ", "If cloud network drops, an internal rule engine answers in 2.2 ms with 100% availability.")
    ]
    for pt_t, pt_d in ai_data_points:
        p = tf_t2.add_paragraph()
        p.space_before = Pt(12)
        r = p.add_run()
        r.text = "• " + pt_t
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = pt_d
        r2.font.size = Pt(11.5)
        r2.font.color.rgb = TEXT_MUTED

    add_notes(s16, "For the conversational assistant, Google Gemini 1.5 Flash is strictly constrained as a tool orchestrator equipped with 5 JSON-schema tools. Every response requires empirical citations including Station IDs and telemetry timestamps. An internal deterministic fallback engine responds in 2.2 ms even during cloud dropouts.")

    # =========================================================================
    # SLIDE 17: AI Assistant (Part 2 - Live Chat Screenshot)
    # =========================================================================
    s17 = add_slide_base(17)
    add_header(s17, "13 • GROUNDED CONVERSATIONAL AI", "Live Interface Proof: Multi-Stop Case Study Demonstration")

    chat_img = "artifacts/presentation/images/ui_ai_chat.png"
    if os.path.exists(chat_img):
        s17.shapes.add_picture(chat_img, Inches(1.8), Inches(1.6), height=Inches(5.0))

    add_notice_bar(s17, Inches(1.8), Inches(6.7), Inches(9.73), Inches(0.5), "Verified Telemetry Provenance:", "Directly links citations to Láng (Hanoi), Yên Bái, and Sa Pa stations.")
    add_notes(s17, "In this live case study, the user asks for travel advice departing Hanoi at 14:00 by car to Sa Pa with a 1.5-hour dinner stop in Phu Tho and night pass driving. The assistant automatically chains route evaluation, forecast lookups, and risk assessment, advising fog lights on Bao Ha pass after 21:30 and citing verified stations.")

    # =========================================================================
    # SLIDE 18: Empirical Evaluation 1 - 3 Arterial Corridors
    # =========================================================================
    s18 = add_slide_base(18)
    add_header(s18, "14 • EMPIRICAL EVALUATION (CORRIDOR BENCHMARK)", "Hazard Mitigation Efficacy across 3 National Arterial Corridors")

    # Table
    t_shape = s18.shapes.add_table(4, 4, Inches(0.8), Inches(1.8), Inches(11.73), Inches(2.9))
    t18 = t_shape.table
    t18.columns[0].width = Inches(2.6)
    t18.columns[1].width = Inches(2.8)
    t18.columns[2].width = Inches(3.0)
    t18.columns[3].width = Inches(3.33)

    h18 = ["Test Corridor", "Fastest Path (Baseline)", "Weather-Safer (Proposed)", "Safety Impact & Trade-off"]
    for j, h in enumerate(h18):
        cell = t18.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG_LIGHT
        cell.text = h
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(10)
        p.font.color.rgb = ACCENT_CYAN if j == 2 else TEXT_MAIN

    d18 = [
        ("Hanoi — Lao Cai\n287 km • Convective storm", "3h 54m • R = 0.68\n4/6 storm points triggered", "4h 20m • R = 0.14\n0 hazard points (Clean bypass)", "100% of storm points eliminated\nTrade-off: +26 min (+11.1%), +11 km"),
        ("Da Nang — Hue\n100 km • Force 7 gale", "2h 15m (Pass) • R = 0.74\nGale crosswinds over pass", "1h 45m (Tunnel) • R = 0.18\n0 hazard points (Safe transit)", "75.7% risk cut & 30 min faster!\nDouble win: safer and quicker (-22.2%)"),
        ("Hanoi — HCMC\n1,720 km • Arterial", "31h 30m • R = 0.62\n14/28 hazard points", "33h 58m • R = 0.22\nOnly 2 minor hazard points", "85.7% hazard points eliminated\nTrade-off: +7.8% duration, +3.6% dist")
    ]
    for i, row in enumerate(d18):
        for j, val in enumerate(row):
            cell = t18.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(10)
            if j == 2:
                p.font.color.rgb = ACCENT_GREEN
                p.font.bold = True
            elif j == 1:
                p.font.color.rgb = ACCENT_RED
            else:
                p.font.color.rgb = TEXT_MAIN

    # 3 Big Metrics below table
    m_y = Inches(4.9)
    m_w = Inches(3.64)
    m_h = Inches(1.3)

    m1 = s18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), m_y, m_w, m_h)
    m1.fill.solid()
    m1.fill.fore_color.rgb = CARD_BG
    m1.line.color.rgb = BORDER_COLOR
    p = m1.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = "87.2%\n"
    r.font.size = Pt(26)
    r.font.bold = True
    r.font.color.rgb = ACCENT_GREEN
    r = p.add_run()
    r.text = "Average Hazard Reduction\n"
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = TEXT_MAIN
    r = p.add_run()
    r.text = "Eliminates majority of high-risk storm cells"
    r.font.size = Pt(9)
    r.font.color.rgb = TEXT_MUTED

    m2 = s18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.84), m_y, m_w, m_h)
    m2.fill.solid()
    m2.fill.fore_color.rgb = CARD_BG
    m2.line.color.rgb = BORDER_COLOR
    p = m2.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = "+8.9%\n"
    r.font.size = Pt(26)
    r.font.bold = True
    r.font.color.rgb = ACCENT_CYAN
    r = p.add_run()
    r.text = "Travel Duration Penalty (ΔT)\n"
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = TEXT_MAIN
    r = p.add_run()
    r.text = "Minimal real-world time trade-off"
    r.font.size = Pt(9)
    r.font.color.rgb = TEXT_MUTED

    m3 = s18.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.88), m_y, m_w, m_h)
    m3.fill.solid()
    m3.fill.fore_color.rgb = CARD_BG
    m3.line.color.rgb = BORDER_COLOR
    p = m3.text_frame.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = "+4.7%\n"
    r.font.size = Pt(26)
    r.font.bold = True
    r.font.color.rgb = ACCENT_AMBER
    r = p.add_run()
    r.text = "Distance Extension (ΔD)\n"
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = TEXT_MAIN
    r = p.add_run()
    r.text = "Highly Pareto-optimal detour efficiency"
    r.font.size = Pt(9)
    r.font.color.rgb = TEXT_MUTED

    add_notice_bar(s18, Inches(0.8), Inches(6.4), Inches(11.73), Inches(0.45), "Pareto Optimality Validated:", "Proves Weather-Safer algorithm drastically mitigates hazards with negligible travel time penalty.")
    add_notes(s18, "On Hanoi — Lao Cai, Weather-Safer drops risk from 0.68 to 0.14, eliminating 100% of storm points with only an 11.1% time trade-off. Across all tested corridors, the algorithm reduces high-risk checkpoints by 87.2% with an average time penalty of only 8.9% and distance increase of 4.7%.")

    # =========================================================================
    # SLIDE 19: Empirical Evaluation 2 - System Performance
    # =========================================================================
    s19 = add_slide_base(19)
    add_header(s19, "15 • EMPIRICAL EVALUATION (SYSTEM PERFORMANCE)", "System Performance & Fault Tolerance Benchmarks")

    # 4 Metric boxes
    m19_w = Inches(2.7)
    m19_h = Inches(1.3)
    m19_y = Inches(1.8)

    p19_data = [
        ("2,485", "Peak Throughput (req/s)", "k6 test @ 1,000 VUs • 0.0% 5xx", ACCENT_GREEN),
        ("4.2 ms", "Median Latency (p50)", "Fastify 5 + fast-json-stringify", ACCENT_CYAN),
        ("12.8 ms", "95th Percentile (p95)", "Strictly satisfies sub-15ms SLA", ACCENT_GREEN),
        ("92.4%", "Redis Cache Hit Ratio", "Cuts DB read I/O by > 12×", ACCENT_GREEN)
    ]
    for k, (val, lbl, sub, col) in enumerate(p19_data):
        box = s19.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8 + k * 2.98), m19_y, m19_w, m19_h)
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = BORDER_COLOR
        p = box.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = val + "\n"
        r.font.size = Pt(24)
        r.font.bold = True
        r.font.color.rgb = col
        r = p.add_run()
        r.text = lbl + "\n"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = TEXT_MAIN
        r = p.add_run()
        r.text = sub
        r.font.size = Pt(8.5)
        r.font.color.rgb = TEXT_MUTED

    # 2 Drills below
    d19_w = Inches(5.7)
    d19_h = Inches(2.8)
    d19_y = Inches(3.3)

    c_dr1 = s19.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), d19_y, d19_w, d19_h)
    c_dr1.fill.solid()
    c_dr1.fill.fore_color.rgb = CARD_BG
    c_dr1.line.color.rgb = BORDER_COLOR
    tf = c_dr1.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "1. Worker Leader Failover (SIGKILL Injection)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    dr1_points = [
        "Primary worker killed abruptly during active polling; 30s heartbeat interrupted.",
        "Upon 120-second lease expiration, secondary replica acquired lease via atomic SET NX PX.",
        "Result: Zero split-brain; seamless recovery without manual operator intervention."
    ]
    for pt in dr1_points:
        p = tf.add_paragraph()
        p.space_before = Pt(8)
        p.text = "• " + pt
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    c_dr2 = s19.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), d19_y, d19_w, d19_h)
    c_dr2.fill.solid()
    c_dr2.fill.fore_color.rgb = CARD_BG
    c_dr2.line.color.rgb = BORDER_COLOR
    tf = c_dr2.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.2)
    p = tf.paragraphs[0]
    p.text = "2. Circuit Breaker Outage Drill (Upstream 500 / Timeout)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    dr2_points = [
        "Injected 500 errors and > 5,000 ms timeouts from external WeatherAPI.",
        "3 consecutive faults tripped circuit breaker to OPEN in 30 seconds.",
        "Result: Client calls resolved in < 1 ms via fallback cache; auto-probed and recovered after 60s cooldown."
    ]
    for pt in dr2_points:
        p = tf.add_paragraph()
        p.space_before = Pt(8)
        p.text = "• " + pt
        p.font.size = Pt(11)
        p.font.color.rgb = TEXT_MUTED

    add_notice_bar(s19, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Testbed Methodology:", "Benchmarked using k6 v0.51 and Autocannon over a sustained 5-minute ramp on an 8-core 32GB RAM testbed (PostgreSQL 16.3 + Redis 7.2).")
    add_notes(s19, "Under concurrent load testing with 1,000 Virtual Users, Fastify achieves 2,485 req/s with a 0.0% error rate and p95 latency of 12.8 ms. The Redis cache hit ratio reaches 92.4%. Primary worker kill simulations confirm automated failover within 120 seconds with zero split-brain.")

    # =========================================================================
    # SLIDE 20: Empirical Evaluation 3 - AI Grounding
    # =========================================================================
    s20 = add_slide_base(20)
    add_header(s20, "16 • EMPIRICAL EVALUATION (AI GROUNDING)", "Grounded AI Accuracy, Citation Integrity & Hallucination Pruning")

    # 3 Metrics Top
    m20_w = Inches(3.64)
    m20_h = Inches(1.2)
    m20_y = Inches(1.8)

    m20_data = [
        ("96.2%", "Tool Dispatch Accuracy", "481 of 500 queries correct", ACCENT_GREEN),
        ("97.2%", "Station Citation Rate", "486 of 500 cited real telemetry", ACCENT_GREEN),
        ("94.8%", "Hallucination Reduction", "Dropped from 34.6% to 1.8% (9/500)", ACCENT_GREEN)
    ]
    for k, (val, lbl, sub, col) in enumerate(m20_data):
        box = s20.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8 + k * 4.04), m20_y, m20_w, m20_h)
        box.fill.solid()
        box.fill.fore_color.rgb = CARD_BG
        box.line.color.rgb = BORDER_COLOR
        p = box.text_frame.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = val + "\n"
        r.font.size = Pt(22)
        r.font.bold = True
        r.font.color.rgb = col
        r = p.add_run()
        r.text = lbl + "\n"
        r.font.size = Pt(9.5)
        r.font.bold = True
        r.font.color.rgb = TEXT_MAIN
        r = p.add_run()
        r.text = sub
        r.font.size = Pt(8.5)
        r.font.color.rgb = TEXT_MUTED

    # Table 5.3 below
    t20_shape = s20.shapes.add_table(7, 6, Inches(0.8), Inches(3.1), Inches(11.73), Inches(2.8))
    t20 = t20_shape.table
    t20.columns[0].width = Inches(4.13)
    t20.columns[1].width = Inches(1.4)
    t20.columns[2].width = Inches(1.7)
    t20.columns[3].width = Inches(1.5)
    t20.columns[4].width = Inches(1.6)
    t20.columns[5].width = Inches(1.4)

    h20 = ["Complexity Tier", "Prompts", "Tool Accuracy", "Citation Rate", "Hallucination", "Latency"]
    for j, h in enumerate(h20):
        cell = t20.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CARD_BG_LIGHT
        cell.text = h
        p = cell.text_frame.paragraphs[0]
        p.font.bold = True
        p.font.size = Pt(9)
        p.font.color.rgb = TEXT_MAIN
        p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

    d20 = [
        ("Tier 1: Multi-point microclimate lookup", "100", "99.0% (99/100)", "99.0%", "0.0% (0/100)", "1,150 ms"),
        ("Tier 2: 24h departure window optimization", "100", "97.0% (97/100)", "98.0%", "1.0% (1/100)", "1,280 ms"),
        ("Tier 3: Multi-stop routing & night pass ETA", "120", "94.2% (113/120)", "95.8%", "3.3% (4/120)", "1,540 ms"),
        ("Tier 4: Cross-vehicle risk arbitration", "100", "96.0% (96/100)", "97.0%", "2.0% (2/100)", "1,420 ms"),
        ("Tier 5: En-route emergency triage", "80", "95.0% (76/80)", "96.3%", "2.5% (2/80)", "1,310 ms"),
        ("Overall System Benchmark", "500", "96.2% (481/500)", "97.2%", "1.8% (9/500)", "1,348 ms")
    ]
    for i, row in enumerate(d20):
        for j, val in enumerate(row):
            cell = t20.cell(i + 1, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = CARD_BG_LIGHT if i == 5 else CARD_BG
            cell.text = val
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(8.5)
            if i == 5:
                p.font.bold = True
                p.font.color.rgb = ACCENT_GREEN if j in [2, 3, 4] else TEXT_MAIN
            elif j == 4:
                p.font.bold = True
                p.font.color.rgb = ACCENT_AMBER if i == 2 else ACCENT_GREEN
            else:
                p.font.color.rgb = TEXT_MAIN if j == 0 else TEXT_MUTED
            if j > 0:
                p.alignment = PP_ALIGN.CENTER

    add_notice_bar(s20, Inches(0.8), Inches(6.2), Inches(11.73), Inches(0.6), "Dissection of 9 Residual Errors (1.8%):", "4 conversational tone embellishments, 3 time extrapolations, 2 informal stop recommendations. Zero distortion to numeric hazard scores (R) or routing geometry.")
    add_notes(s20, "Testing across 500 tiered prompts shows 96.2% tool dispatch accuracy and 97.2% verified station citations. Factual hallucination dropped from 34.6% in vanilla LLMs to 1.8% (a 94.8% reduction). All residual deviations were conversational tone embellishments.")

    # =========================================================================
    # SLIDE 21: Usability Evaluation (SUS)
    # =========================================================================
    s21 = add_slide_base(21)
    add_header(s21, "17 • USER EXPERIENCE & USABILITY (SUS)", "System Usability Scale (SUS): Empirical 30-User Evaluation")

    # Left: Score & Demographics
    card_u1 = s21.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_u1.fill.solid()
    card_u1.fill.fore_color.rgb = CARD_BG
    card_u1.line.color.rgb = BORDER_COLOR
    tf_u1 = card_u1.text_frame
    tf_u1.margin_left = tf_u1.margin_right = Inches(0.3)
    tf_u1.margin_top = Inches(0.2)
    p = tf_u1.paragraphs[0]
    p.text = "SUS Metric & Demographic Breakdown"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    p = tf_u1.add_paragraph()
    p.space_before = Pt(10)
    p.text = "Composite Usability Score: 84.6 ± 4.2"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = ACCENT_GREEN

    p = tf_u1.add_paragraph()
    p.text = "Grade A • Excellent (Industry benchmark: 68.0)"
    p.font.size = Pt(10)
    p.font.color.rgb = TEXT_MUTED

    p = tf_u1.add_paragraph()
    p.space_before = Pt(14)
    p.text = "30 Participants Across 4 Target Groups:\n• Group A (8 users): Long-haul truck & coach drivers\n• Group B (8 users): Long-distance motorcyclists & tourers\n• Group C (8 users): Daily family travelers & commuters\n• Group D (6 users): IT software engineers & GIS specialists"
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_MUTED
    p.line_spacing = 1.3

    p = tf_u1.add_paragraph()
    p.space_before = Pt(14)
    p.text = "Standard Formula: SUS = 2.5 × [ Σ(Q_odd - 1) + Σ(5 - Q_even) ]"
    p.font.size = Pt(9.5)
    p.font.color.rgb = TEXT_DIM
    p.font.name = "Consolas"

    # Right: Survey Items
    card_u2 = s21.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_u2.fill.solid()
    card_u2.fill.fore_color.rgb = CARD_BG
    card_u2.line.color.rgb = BORDER_COLOR
    tf_u2 = card_u2.text_frame
    tf_u2.margin_left = tf_u2.margin_right = Inches(0.3)
    tf_u2.margin_top = Inches(0.2)
    p = tf_u2.paragraphs[0]
    p.text = "Highest Rated Survey Items (1–5 Likert Scale)"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    sus_items = [
        ("Item 7: Rapid Learnability", "Learned to use system very quickly without training", "4.60 ± 0.50"),
        ("Item 1: Frequent Usage Intent", "Willing to use system frequently on long-distance trips", "4.53 ± 0.51"),
        ("Item 5: Functional Integration", "Map, routing, and AI features are well integrated", "4.47 ± 0.51"),
        ("Item 9: Safety Decision Confidence", "Felt confident making road decisions from system advice", "4.40 ± 0.56")
    ]
    for it_t, it_d, it_sc in sus_items:
        p = tf_u2.add_paragraph()
        p.space_before = Pt(10)
        r = p.add_run()
        r.text = it_t + "  (" + it_sc + ")\n"
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = ACCENT_GREEN if "4.6" in it_sc or "4.5" in it_sc else ACCENT_CYAN
        r2 = p.add_run()
        r2.text = it_d
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s21, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Validation:", "Grade A (84.6/100): Confirms strong acceptance among real-world commuters and transport drivers.")
    add_notes(s21, "Usability testing with 30 target participants following John Brooke's SUS standard yielded an average score of 84.6 (Grade A, Excellent). Rapid learnability (4.60/5) and frequent usage intent (4.53/5) scored exceptionally high.")

    # =========================================================================
    # SLIDE 22: Limitations & Future Roadmap
    # =========================================================================
    s22 = add_slide_base(22)
    add_header(s22, "18 • LIMITATIONS & FUTURE ROADMAP", "Technical Limitations & 3-Phase Research Roadmap")

    # Left: Limitations
    card_l1 = s22.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_l1.fill.solid()
    card_l1.fill.fore_color.rgb = CARD_BG
    card_l1.line.color.rgb = BORDER_COLOR
    tf_l1 = card_l1.text_frame
    tf_l1.margin_left = tf_l1.margin_right = Inches(0.3)
    tf_l1.margin_top = Inches(0.2)
    p = tf_l1.paragraphs[0]
    p.text = "Acknowledged Technical Limitations"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    limits = [
        ("Station Density in Highlands: ", "Northwest mountain passes have station gaps of 50–100 km; partially mitigated by IDW spatial interpolation."),
        ("Live Road Infrastructure Feeds: ", "Landslide road cuts and bridge closures are not yet synchronized dynamically via official Highway Administration APIs."),
        ("Cloud LLM Dependency: ", "Google Gemini API introduces 1.2–2.8s network latency over international connections."),
        ("Offline Navigation Gap: ", "Dynamic path recalculation currently requires internet access when traveling through deep cellular dead zones.")
    ]
    for lt, ld in limits:
        p = tf_l1.add_paragraph()
        p.space_before = Pt(10)
        r = p.add_run()
        r.text = "• " + lt
        r.font.bold = True
        r.font.size = Pt(11.5)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = ld
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MUTED

    # Right: 3-Phase Roadmap
    card_l2 = s22.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_l2.fill.solid()
    card_l2.fill.fore_color.rgb = CARD_BG
    card_l2.line.color.rgb = BORDER_COLOR
    tf_l2 = card_l2.text_frame
    tf_l2.margin_left = tf_l2.margin_right = Inches(0.3)
    tf_l2.margin_top = Inches(0.2)
    p = tf_l2.paragraphs[0]
    p.text = "3-Phase Strategic Research Roadmap"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN

    phases = [
        ("Phase 1: Short-Term (3–6 Months)", "Native Mobile App (React Native) + Vietnamese turn-by-turn voice navigation + dynamic geofencing push alerts before entering storm cells.", ACCENT_CYAN),
        ("Phase 2: Medium-Term (6–12 Months)", "On-device 4-bit SLMs (Gemma-2B / Phi-3) for offline AI guidance + YOLOv8-Seg computer vision analyzing public traffic cameras for flood depths.", ACCENT_AMBER),
        ("Phase 3: Long-Term (1–2 Years)", "Multimodal routing (North-South railway + aviation transitions) + direct C/S-band radar API integration with National Weather Service (NCHMF).", ACCENT_GREEN)
    ]
    for ph_t, ph_d, ph_col in phases:
        p = tf_l2.add_paragraph()
        p.space_before = Pt(12)
        r = p.add_run()
        r.text = ph_t + "\n"
        r.font.bold = True
        r.font.size = Pt(12)
        r.font.color.rgb = ph_col
        r2 = p.add_run()
        r2.text = ph_d
        r2.font.size = Pt(11)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s22, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Engineering Honesty:", "Essential operational constraints documented in Section 6.2 motivate the future development trajectory.")
    add_notes(s22, "We candidly acknowledge current limitations: sparse station coverage in remote mountainous zones, lack of real-time road closure feeds from the Highway Administration, and offline routing constraints. Our research roadmap outlines: Native mobile apps with voice navigation (Short-term); on-device SLMs and camera vision flood depth analysis (Medium-term); and multimodal railway/aviation integration (Long-term).")

    # =========================================================================
    # SLIDE 23: Pros & Cons Summary
    # =========================================================================
    s23 = add_slide_base(23)
    add_header(s23, "19 • THESIS CONCLUSION & TRADE-OFF SUMMARY", "Thesis Summary: Core Strengths vs. Engineering Trade-offs")

    # Left: Pros
    card_p = s23.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.8), Inches(5.6), Inches(4.3))
    card_p.fill.solid()
    card_p.fill.fore_color.rgb = CARD_BG
    card_p.line.color.rgb = BORDER_COLOR
    tf_p = card_p.text_frame
    tf_p.margin_left = tf_p.margin_right = Inches(0.3)
    tf_p.margin_top = Inches(0.2)
    p = tf_p.paragraphs[0]
    p.text = "PROS (Proven Strengths)"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = ACCENT_GREEN

    pros_items = [
        ("87.2% Hazard Mitigation: ", "Bridges continuous meteorology into OSRM routing; safely detours around convective storm cells."),
        ("Two-Wheeler Calibration: ", "Wind/rain thresholds tightened >30% specifically protecting 72M+ vulnerable commuters."),
        ("Sub-15ms Real-Time GIS: ", "Two-tier GiST spatial index accelerates corridor retrieval by 36.9× (11.4 ms)."),
        ("Grounded Verifiable AI: ", "5 allowlisted tools with automated station provenance, reducing hallucinations by 94.8%."),
        ("Production Code Quality: ", "100% strict TypeScript Monorepo, ADR-004 crypto, and 210/210 passing automated tests.")
    ]
    for pt, pd in pros_items:
        p = tf_p.add_paragraph()
        p.space_before = Pt(8)
        r = p.add_run()
        r.text = "✓ " + pt
        r.font.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = pd
        r2.font.size = Pt(10.5)
        r2.font.color.rgb = TEXT_MUTED

    # Right: Cons
    card_c = s23.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(1.8), Inches(5.7), Inches(4.3))
    card_c.fill.solid()
    card_c.fill.fore_color.rgb = CARD_BG
    card_c.line.color.rgb = BORDER_COLOR
    tf_c = card_c.text_frame
    tf_c.margin_left = tf_c.margin_right = Inches(0.3)
    tf_c.margin_top = Inches(0.2)
    p = tf_c.paragraphs[0]
    p.text = "CONS (Trade-offs & Boundaries)"
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = ACCENT_AMBER

    cons_items = [
        ("Highland Station Sparsity: ", "Northwest mountain valleys have station spacing of 50–100 km, requiring spatial IDW interpolation."),
        ("Zero Live Road Closure Sync: ", "Instantaneous landslide cuts and flooded bridge blocks are not yet fed from Highway Administration APIs."),
        ("Cloud AI Latency: ", "Conversational assistant relies on external Google Gemini APIs, introducing 1.2–2.8s international latency."),
        ("Requires Active Connectivity: ", "Dynamic rerouting and live weather mapping require internet access; no complete offline graph engine."),
        ("No Global Radar Video Streaming: ", "Unlike Windy, focuses on mathematical risk indices rather than high-bandwidth animated flows.")
    ]
    for ct, cd in cons_items:
        p = tf_c.add_paragraph()
        p.space_before = Pt(8)
        r = p.add_run()
        r.text = "✕ " + ct
        r.font.bold = True
        r.font.size = Pt(11)
        r.font.color.rgb = TEXT_MAIN
        r2 = p.add_run()
        r2.text = cd
        r2.font.size = Pt(10.5)
        r2.font.color.rgb = TEXT_MUTED

    add_notice_bar(s23, Inches(0.8), Inches(6.3), Inches(11.73), Inches(0.5), "Executive Summary:", "Scientifically verified, production-grade meteorological routing platform ready for deployment and technology transfer.")
    add_notes(s23, "In conclusion, I would like to summarize the thesis through an objective engineering balance of its core strengths and operational boundaries: On the PROS side, VietForecast proves an 87.2% hazard reduction on real highway corridors, calibrates safety specifically for two-wheelers, achieves sub-15ms spatial queries via GiST (36.9x speedup), prunes AI hallucinations by 94.8%, and satisfies 100% of 210 automated test suites. On the CONS side, we candidly acknowledge our boundaries: station sparsity in the Northwest highlands, lack of real-time Highway Administration landslide feeds, cloud round-trip latency on the LLM, and the need for active connectivity during dynamic rerouting. This clear self-awareness directly justifies our future roadmap and confirms the system's readiness for real-world deployment.")

    # =========================================================================
    # SLIDE 24: Acknowledgments & Q&A
    # =========================================================================
    s24 = add_slide_base(24)
    if os.path.exists(logo_path):
        s24.shapes.add_picture(logo_path, Inches(5.4), Inches(0.8), height=Inches(1.2))

    tx24 = s24.shapes.add_textbox(Inches(1.0), Inches(2.3), Inches(11.33), Inches(4.5))
    tf24 = tx24.text_frame
    tf24.word_wrap = True

    p = tf24.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "UNIVERSITY OF SCIENCE AND TECHNOLOGY OF HANOI (USTH)"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Arial"

    p = tf24.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.text = "THANK YOU FOR YOUR ATTENTION!"
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = TEXT_MAIN
    p.font.name = "Arial"
    p.space_before = Pt(20)

    p = tf24.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.text = "VietForecast — Intelligent Weather-Aware Travel Assistant for Vietnam"
    p.font.size = Pt(14)
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Consolas"
    p.space_before = Pt(10)

    # Gratitude card
    card_g = s24.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.2), Inches(4.8), Inches(8.93), Inches(1.5))
    card_g.fill.solid()
    card_g.fill.fore_color.rgb = CARD_BG
    card_g.line.color.rgb = BORDER_COLOR
    card_g.line.width = Pt(1)
    tf_g = card_g.text_frame
    tf_g.margin_left = Inches(0.4)
    tf_g.margin_right = Inches(0.4)
    tf_g.margin_top = Inches(0.2)
    p = tf_g.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    p.text = "I would like to express my deepest gratitude to my supervisors:\nMSc. Vũ Hà My and Dr. Nghiêm Thị Phương\nfor their invaluable guidance, encouragement, and academic direction."
    p.font.size = Pt(12)
    p.font.color.rgb = TEXT_MUTED
    p.line_spacing = 1.3

    p = tf24.add_paragraph()
    p.alignment = PP_ALIGN.CENTER
    p.space_before = Pt(120)
    p.text = "READY FOR LIVE DEMONSTRATION & QUESTIONS (Q&A)"
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = ACCENT_CYAN
    p.font.name = "Consolas"

    add_notes(s24, "Thank you very much, distinguished members of the Committee, for your kind attention! I would like to initiate the live demonstration of the platform and welcome your questions and feedback.")

    output_path = "artifacts/presentation/VietForecast_Thesis_Defense.pptx"
    prs.save(output_path)
    print(f"Successfully generated PowerPoint presentation at: {output_path}")

if __name__ == "__main__":
    build_deck()
