import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)

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

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1600, "height": 1020}, device_scale_factor=1.25)
        page = context.new_page()

        # Seed auth on root first
        page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        page.evaluate(f"""() => {{
            localStorage.setItem('vietnam-weather-theme', 'dark');
            localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({{ state: {{ theme: 'dark' }}, version: 0 }}));
            localStorage.setItem('vietnam-weather-language', 'en');
            localStorage.setItem('vietnam-weather-language-store', JSON.stringify({{ state: {{ language: 'en' }}, version: 0 }}));
            localStorage.setItem('vietnam-weather-map-style', 'google');
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('vietnam-weather-auth', JSON.stringify({json.dumps(AUTH_DATA_PRO)}));
            localStorage.setItem('access_token', 'mock_token_researcher');
        }}""")

        print("Navigating to http://localhost:3000/map ...")
        page.goto("http://localhost:3000/map", wait_until="networkidle")
        time.sleep(5)  # Allow Google Maps tiles across all of Vietnam to load fully

        # Ensure Google Maps button is active
        google_btn = page.locator("button:has-text('Google Maps')").first
        if google_btn.count() > 0:
            btn_class = google_btn.get_attribute("class") or ""
            if "styleBtnActive" not in btn_class:
                print("Clicking Google Maps button...")
                google_btn.click(force=True)
                time.sleep(4)

        # 1. Figure 5.7: ui_map.png
        print("1. Capturing ui_map.png (Macro Nationwide Overview on Google Maps) ...")
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "ui_map.png"))
        print("   -> Saved ui_map.png")

        # 2. Figure 5.8: ui_map_timeline_slider.png
        print("2. Scrubbing Map Timeline Slider to +24h ...")
        m24_map = page.locator("button:has-text('+24h')").first
        if m24_map.count() > 0:
            m24_map.click(force=True)
            time.sleep(4)  # Allow simulation values and tiles to settle
            page.screenshot(path=str(OUT_DIR / "ui_map_timeline_slider.png"))
            print("   -> Saved ui_map_timeline_slider.png")
        else:
            print("   [!] Could not locate +24h button on map")

        # 3. Figure 5.9: ui_map_detail.png
        print("3. Selecting Da Nang drill-down for ui_map_detail.png ...")
        # Reset timeline to Current
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
                print("Clicked Da Nang card, waiting 5 seconds for smooth flyTo and high-zoom Google Maps tiles...")
                time.sleep(5)  # Wait for flyTo animation + network raster tiles for Da Nang
                page.screenshot(path=str(OUT_DIR / "ui_map_detail.png"))
                print("   -> Saved ui_map_detail.png")

        context.close()
        browser.close()
        print("\nAll 3 map figures recaptured successfully!")

if __name__ == "__main__":
    run()
