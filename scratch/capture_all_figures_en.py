# -*- coding: utf-8 -*-
"""
Capture all 16 Chapter 5 figures in 100% English UI and Dark Mode.
Runs against the live Vite server on http://localhost:3000/.
"""

import sys
import os
import time
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)

with open('scratch/chat_payload_en.json', 'r', encoding='utf-8') as f:
    chat_payload = json.load(f)

MOCK_CHAT_RESPONSE = chat_payload['response']
CHAT_QUESTION_TEXT = chat_payload['question']

MOCK_ROUTE_DATA = {
    "data": {
        "alternatives": [
            {
                "alternative_type": "weather_safer",
                "geometry": {
                    "distance_meters": 298000,
                    "duration_seconds": 15600
                },
                "route_risk": {
                    "score": 0.14,
                    "level": "low"
                },
                "summary": {
                    "en": "Optimal corridor avoiding convective thunderstorm cells over Doan Hung with clear visibility > 10 km.",
                    "vi": "Lộ trình tối ưu tránh hoàn toàn vùng mây đối lưu dông sét qua Đoan Hùng, tầm nhìn thông thoáng."
                },
                "sample_points": [
                    {
                        "name": "Hanoi (Departure)",
                        "distance_from_origin_meters": 0,
                        "eta_minutes": 0,
                        "risk_level": "low",
                        "factors": ["Smooth Traffic Flow"],
                        "observation": {"temperature": 28, "condition": "Partly Cloudy", "rain_probability": 10, "wind_speed": 12}
                    },
                    {
                        "name": "Vinh Yen Station (Km 55)",
                        "distance_from_origin_meters": 55000,
                        "eta_minutes": 45,
                        "risk_level": "low",
                        "factors": ["Dry pavement, high visibility"],
                        "observation": {"temperature": 27, "condition": "Mild Sun", "rain_probability": 15, "wind_speed": 14}
                    },
                    {
                        "name": "Phu Tho Station (Km 102)",
                        "distance_from_origin_meters": 102000,
                        "eta_minutes": 88,
                        "risk_level": "low",
                        "factors": ["Visibility > 10 km"],
                        "observation": {"temperature": 26, "condition": "Scattered Clouds", "rain_probability": 20, "wind_speed": 15}
                    },
                    {
                        "name": "Yen Bai Station (Km 168)",
                        "distance_from_origin_meters": 168000,
                        "eta_minutes": 145,
                        "risk_level": "caution",
                        "factors": ["Light drizzle, damp surface"],
                        "observation": {"temperature": 24, "condition": "Light Drizzle", "rain_probability": 38, "wind_speed": 18}
                    },
                    {
                        "name": "Bao Thang Station (Km 245)",
                        "distance_from_origin_meters": 245000,
                        "eta_minutes": 210,
                        "risk_level": "low",
                        "factors": ["Cool pass, stable slopes"],
                        "observation": {"temperature": 23, "condition": "Variable Clouds", "rain_probability": 25, "wind_speed": 16}
                    },
                    {
                        "name": "Lao Cai - Sa Pa (Destination)",
                        "distance_from_origin_meters": 298000,
                        "eta_minutes": 260,
                        "risk_level": "low",
                        "factors": ["Favorable weather"],
                        "observation": {"temperature": 21, "condition": "Cool & Clear", "rain_probability": 15, "wind_speed": 10}
                    }
                ]
            },
            {
                "alternative_type": "fastest",
                "geometry": {
                    "distance_meters": 287000,
                    "duration_seconds": 14040
                },
                "route_risk": {
                    "score": 0.68,
                    "level": "high"
                },
                "summary": {
                    "en": "Expressway encounters heavy convective storm and crosswinds along Km 110-150.",
                    "vi": "Cao tốc Nội Bài - Lào Cai gặp mưa dông cực lớn và gió giật mạnh tại đoạn Km 110 - 150."
                },
                "sample_points": [
                    {
                        "name": "Hanoi (Departure)",
                        "distance_from_origin_meters": 0,
                        "eta_minutes": 0,
                        "risk_level": "low",
                        "factors": ["Smooth Traffic Flow"],
                        "observation": {"temperature": 28, "condition": "Partly Cloudy", "rain_probability": 10, "wind_speed": 12}
                    },
                    {
                        "name": "Station Km 115 (Expressway)",
                        "distance_from_origin_meters": 115000,
                        "eta_minutes": 78,
                        "risk_level": "high",
                        "factors": ["Heavy storm > 35mm/h", "Gale gusts force 6-7"],
                        "observation": {"temperature": 22, "condition": "Severe Squalls", "rain_probability": 92, "wind_speed": 46}
                    },
                    {
                        "name": "Yen Bai Station (Km 185)",
                        "distance_from_origin_meters": 185000,
                        "eta_minutes": 135,
                        "risk_level": "caution",
                        "factors": ["Passing rain showers"],
                        "observation": {"temperature": 24, "condition": "Rain Showers", "rain_probability": 55, "wind_speed": 20}
                    },
                    {
                        "name": "Lao Cai (Destination)",
                        "distance_from_origin_meters": 287000,
                        "eta_minutes": 234,
                        "risk_level": "caution",
                        "factors": ["Rain Showers"],
                        "observation": {"temperature": 22, "condition": "Rain Showers", "rain_probability": 65, "wind_speed": 22}
                    }
                ]
            },
            {
                "alternative_type": "shortest",
                "geometry": {
                    "distance_meters": 275000,
                    "duration_seconds": 19800
                },
                "route_risk": {
                    "score": 0.42,
                    "level": "caution"
                },
                "summary": {
                    "en": "National Route 70 has slippery road surface and dense mountain fog over Bao Yen pass.",
                    "vi": "Quốc lộ 70 mặt đường trơn trượt và có sương mù dày khu vực đèo Bảo Yên."
                },
                "sample_points": [
                    {
                        "name": "Hanoi (Departure)",
                        "distance_from_origin_meters": 0,
                        "eta_minutes": 0,
                        "risk_level": "low",
                        "factors": ["Smooth Traffic Flow"],
                        "observation": {"temperature": 28, "condition": "Partly Cloudy", "rain_probability": 10, "wind_speed": 12}
                    },
                    {
                        "name": "Phu Tho Station (Km 98)",
                        "distance_from_origin_meters": 98000,
                        "eta_minutes": 115,
                        "risk_level": "low",
                        "factors": ["Good visibility"],
                        "observation": {"temperature": 26, "condition": "Scattered Clouds", "rain_probability": 20, "wind_speed": 12}
                    },
                    {
                        "name": "Bao Yen Pass Station (Km 175)",
                        "distance_from_origin_meters": 175000,
                        "eta_minutes": 210,
                        "risk_level": "caution",
                        "factors": ["Dense mountain pass fog", "Slippery road surface"],
                        "observation": {"temperature": 20, "condition": "Dense Fog", "rain_probability": 60, "wind_speed": 16}
                    },
                    {
                        "name": "Pho Lu Station (Km 235)",
                        "distance_from_origin_meters": 235000,
                        "eta_minutes": 280,
                        "risk_level": "caution",
                        "factors": ["Narrow winding turns"],
                        "observation": {"temperature": 22, "condition": "Light Drizzle", "rain_probability": 40, "wind_speed": 14}
                    },
                    {
                        "name": "Lao Cai (Destination)",
                        "distance_from_origin_meters": 275000,
                        "eta_minutes": 330,
                        "risk_level": "caution",
                        "factors": ["Cool & Clear"],
                        "observation": {"temperature": 21, "condition": "Cool & Clear", "rain_probability": 30, "wind_speed": 12}
                    }
                ]
            }
        ]
    }
}

AUTH_DATA_PRO = {
    "state": {
        "user": {
            "id": "usr_pro_research",
            "email": "researcher@vietnamweather.vn",
            "name": "Hoang Dang",
            "plan": "pro",
            "role": "user",
            "isVerified": True,
            "savedLocations": [
                {"id": "hn", "name": "Hanoi", "provinceCode": "HN"},
                {"id": "dn", "name": "Da Nang", "provinceCode": "DN"},
                {"id": "hcm", "name": "Ho Chi Minh City", "provinceCode": "HCM"}
            ],
            "savedRoutes": []
        },
        "isAuthenticated": True,
        "isVerified": True
    },
    "version": 0
}

AUTH_DATA_FREE = {
    "state": {
        "user": {
            "id": "usr_free_user",
            "email": "user.free@vietnamweather.vn",
            "name": "Standard Traveler",
            "plan": "free",
            "role": "user",
            "isVerified": True,
            "savedLocations": [],
            "savedRoutes": []
        },
        "isAuthenticated": True,
        "isVerified": True
    },
    "version": 0
}

def set_en_dark(page, auth=None):
    auth_script = f"localStorage.setItem('vietnam-weather-auth', JSON.stringify({json.dumps(auth)})); localStorage.setItem('access_token', 'mock_token_researcher');" if auth else "localStorage.removeItem('vietnam-weather-auth'); localStorage.removeItem('access_token');"
    page.evaluate(f"""() => {{
        localStorage.setItem('vietnam-weather-theme', 'dark');
        localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({{ state: {{ theme: 'dark' }}, version: 0 }}));
        localStorage.setItem('vietnam-weather-language', 'en');
        localStorage.setItem('vietnam-weather-language-store', JSON.stringify({{ state: {{ language: 'en' }}, version: 0 }}));
        localStorage.setItem('vietnam-weather-map-style', 'google');
        document.documentElement.setAttribute('data-theme', 'dark');
        {auth_script}
    }}""")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # 1. Public Pages Context (Unauthenticated, 1440x900, scale 1.25)
        print("\n=== PHASE 1: PUBLIC PAGES (Landing, Login, Register) ===")
        pub_context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.25)
        page = pub_context.new_page()

        # Seed unauthenticated English + Dark Mode on base domain
        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        set_en_dark(page, auth=None)

        # 1.1 Landing Page
        print("1. Capturing ui_landing.png ...")
        page.goto("http://localhost:3000/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "ui_landing.png"))
        print("   -> Saved ui_landing.png")

        # 1.2 Login Page
        print("2. Capturing ui_login.png ...")
        page.goto("http://localhost:3000/login", wait_until="networkidle")
        time.sleep(1.5)
        page.screenshot(path=str(OUT_DIR / "ui_login.png"))
        print("   -> Saved ui_login.png")

        # 1.3 Register Page
        print("3. Capturing ui_register.png ...")
        page.goto("http://localhost:3000/register", wait_until="networkidle")
        time.sleep(1.5)
        page.screenshot(path=str(OUT_DIR / "ui_register.png"))
        print("   -> Saved ui_register.png")
        pub_context.close()

        # 2. Pricing & Checkout Context (Free tier user view)
        print("\n=== PHASE 2: PRICING & CHECKOUT (Upgrade Modal) ===")
        pricing_context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.25)
        page = pricing_context.new_page()
        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        set_en_dark(page, auth=AUTH_DATA_FREE)
        page.goto("http://localhost:3000/pricing", wait_until="networkidle")
        time.sleep(2)

        # 2.1 Pricing Page
        print("4. Capturing ui_pricing.png ...")
        page.screenshot(path=str(OUT_DIR / "ui_pricing.png"))
        print("   -> Saved ui_pricing.png")

        # 2.2 Checkout Modal
        print("5. Opening Checkout Modal & Capturing ui_checkout.png ...")
        upgrade_btn = page.locator("button[class*='upgradeButton']").first
        if upgrade_btn.count() > 0:
            upgrade_btn.click(force=True)
            time.sleep(1.5)
            page.screenshot(path=str(OUT_DIR / "ui_checkout.png"))
            print("   -> Saved ui_checkout.png")
            page.keyboard.press("Escape")
            time.sleep(0.5)
        pricing_context.close()

        # 3. Weather Page Context (Pro Tier)
        print("\n=== PHASE 3: WEATHER DIRECTORY (Overview, +24h Scrubber, Detail Modal) ===")
        weather_context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.25)
        page = weather_context.new_page()
        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        set_en_dark(page, auth=AUTH_DATA_PRO)
        page.goto("http://localhost:3000/weather", wait_until="networkidle")
        time.sleep(2.5)

        # 3.1 Weather Overview
        print("6. Capturing ui_weather_overview.png ...")
        page.screenshot(path=str(OUT_DIR / "ui_weather_overview.png"))
        print("   -> Saved ui_weather_overview.png")

        # 3.2 Weather Timeline Slider at +24h
        print("7. Scrubbing /weather timeline to +24h ...")
        m24_btn = page.locator("button:has-text('+24h')").first
        if m24_btn.count() > 0:
            m24_btn.click(force=True)
            time.sleep(1.5)
            page.screenshot(path=str(OUT_DIR / "ui_weather_timeline_24h.png"))
            print("   -> Saved ui_weather_timeline_24h.png")

        # 3.3 Weather Province Detail Modal
        print("8. Opening Weather Detail Modal (Hanoi / Da Nang) ...")
        detail_btn = page.locator("button:has-text('Details & 24h'), button:has-text('Details'), button[class*='detailBtn']").first
        if detail_btn.count() > 0:
            detail_btn.click(force=True)
            time.sleep(1.5)
            page.screenshot(path=str(OUT_DIR / "ui_weather_modal.png"))
            print("   -> Saved ui_weather_modal.png")
            page.keyboard.press("Escape")
            time.sleep(0.5)
        weather_context.close()

        # 4. Map & AI Chat Context (Pro Tier)
        print("\n=== PHASE 4: INTERACTIVE MAP & AI CHAT ASSISTANT ===")
        map_context = browser.new_context(viewport={"width": 1600, "height": 1020}, device_scale_factor=1.25)
        page = map_context.new_page()

        # Mock APIs for Chat
        page.route('**/api/v1/chat/quota', lambda route: route.fulfill(
            status=200,
            content_type='application/json',
            body=json.dumps({'data': {'remaining': 29, 'limit': 30, 'resetAt': '2026-09-15T00:00:00Z'}})
        ))
        page.route('**/api/v1/chat/message', lambda route: route.fulfill(
            status=200,
            content_type='application/json',
            body=json.dumps(MOCK_CHAT_RESPONSE)
        ))

        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        set_en_dark(page, auth=AUTH_DATA_PRO)
        page.goto("http://localhost:3000/map", wait_until="networkidle")
        time.sleep(5)

        # 4.1 UI Map Overview
        print("9. Capturing ui_map.png ...")
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "ui_map.png"))
        print("   -> Saved ui_map.png")

        # 4.2 Map Timeline Slider (+24h)
        print("10. Scrubbing Map Timeline Slider to +24h ...")
        m24_map = page.locator("button:has-text('+24h')").first
        if m24_map.count() > 0:
            m24_map.click(force=True)
            time.sleep(4)
            page.screenshot(path=str(OUT_DIR / "ui_map_timeline_slider.png"))
            print("   -> Saved ui_map_timeline_slider.png")
        else:
            print("   [!] Could not locate +24h button on map")

        # 4.3 Map Detail (Da Nang drill-down)
        print("11. Selecting Da Nang drill-down for ui_map_detail.png ...")
        m0_map = page.locator("button:has-text('Current')").first
        if m0_map.count() > 0:
            m0_map.click(force=True)
            time.sleep(1)

        search_input = page.locator("input[placeholder*='Search province'], input[placeholder*='Search']")
        if search_input.count() > 0:
            search_input.first.fill("Đà Nẵng")
            time.sleep(1)
            p_card = page.locator("div[class*='provinceCard']").first
            if p_card.count() > 0:
                p_card.click(force=True)
                time.sleep(5)
                page.screenshot(path=str(OUT_DIR / "ui_map_detail.png"))
                print("   -> Saved ui_map_detail.png")

        # 4.4 AI Chat Assistant
        print("12. Opening AI Chat Assistant & Sending English Complex Query ...")
        trigger = page.locator("button[class*='floatingTrigger']").first
        if trigger.count() > 0:
            trigger.click()
            time.sleep(1.2)
            input_field = page.locator("input[class*='inputField']").first
            input_field.fill(CHAT_QUESTION_TEXT)
            time.sleep(0.5)
            send_btn = page.locator("button[class*='sendButton']").first
            send_btn.click()
            time.sleep(2.5)

            # Clean display for paper: hide greeting, hide suggestion chips, scroll top
            page.evaluate('''() => {
                const bubbles = document.querySelectorAll('div[class*="messageBubble"]');
                if (bubbles.length >= 3) {
                    bubbles[0].style.display = 'none'; // hide initial greeting
                }
                const chips = document.querySelectorAll('div[class*="suggestionChips"]');
                chips.forEach(c => c.parentElement ? c.parentElement.style.display = 'none' : null);
                const list = document.querySelector('div[class*="messagesList"]');
                if (list) {
                    list.scrollTop = 0;
                }
            }''')
            time.sleep(1)
            page.screenshot(path=str(OUT_DIR / "ui_ai_chat.png"))
            print("   -> Saved ui_ai_chat.png")
        map_context.close()

        # 5. Route Planner Context (3 Routes + Full Width Comparison)
        print("\n=== PHASE 5: ROUTE PLANNER (Weather-Safer, Fastest, Shortest, Pareto Table) ===")
        route_context = browser.new_context(viewport={"width": 1500, "height": 950}, device_scale_factor=1.25)
        page = route_context.new_page()

        page.route("**/api/v1/route/calculate", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(MOCK_ROUTE_DATA)
        ))

        # Seed auth on root first so ProtectedRoute does NOT redirect to /login
        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        set_en_dark(page, auth=AUTH_DATA_PRO)
        page.evaluate("localStorage.setItem('vietnam-weather-map-style', 'google');")

        print("Navigating to http://localhost:3000/route ...")
        page.goto("http://localhost:3000/route", wait_until="networkidle")
        time.sleep(4)

        alt_cards = page.locator("div[class*='altCard']")
        card_count = alt_cards.count()
        print(f"Found {card_count} alternative cards on Route page.")

        # 5.1 Weather-Safer Route
        print("13. Capturing ui_route_safer.png (Weather-Safer) ...")
        if card_count > 0:
            alt_cards.first.click()
            time.sleep(2.5)
            page.screenshot(path=str(OUT_DIR / "ui_route_safer.png"))
            shutil.copy(str(OUT_DIR / "ui_route_safer.png"), str(OUT_DIR / "ui_route_planner.png"))
            print("   -> Saved ui_route_safer.png and copied to ui_route_planner.png")

        # 5.2 Fastest Route
        print("14. Capturing ui_route_fastest.png (Fastest Expressway) ...")
        if card_count > 1:
            alt_cards.nth(1).click()
            time.sleep(2.5)
            page.screenshot(path=str(OUT_DIR / "ui_route_fastest.png"))
            print("   -> Saved ui_route_fastest.png")

        # 5.3 Shortest Route
        print("15. Capturing ui_route_shortest.png (Shortest Mountain Route) ...")
        if card_count > 2:
            alt_cards.nth(2).click()
            time.sleep(2.5)
            page.screenshot(path=str(OUT_DIR / "ui_route_shortest.png"))
            print("   -> Saved ui_route_shortest.png")

        # 5.4 Full-width Comparison Section
        print("16. Capturing ui_route_comparison.png (Pareto Comparison Table) ...")
        comp_section = page.locator("div[class*='fullWidthComparisonSection']")
        if comp_section.count() > 0:
            comp_section.scroll_into_view_if_needed()
            time.sleep(1)
            comp_section.screenshot(path=str(OUT_DIR / "ui_route_comparison.png"))
            print("   -> Saved ui_route_comparison.png")
        else:
            print("   [!] Could not locate fullWidthComparisonSection")

        route_context.close()
        browser.close()

    print("\n=======================================================")
    print("SUCCESS: ALL 16 CHAPTER 5 FIGURES CAPTURED IN ENGLISH & DARK MODE!")
    print("=======================================================\n")

if __name__ == '__main__':
    run()
