import time
import json
from playwright.sync_api import sync_playwright

with open('scratch/chat_payload_en.json') as f:
    pass

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1500, "height": 950})

    with open("scratch/capture_all_figures_en.py", "r", encoding="utf-8") as f:
        code = f.read()

    # Extract MOCK_ROUTE_DATA from capture script
    import re
    m = re.search(r"MOCK_ROUTE_DATA = (\{.*?\n\})", code, re.DOTALL)
    
    # We can import MOCK_ROUTE_DATA from capture_all_figures_en
    import sys
    sys.path.insert(0, "scratch")
    from capture_all_figures_en import MOCK_ROUTE_DATA, AUTH_DATA_PRO

    page.route("**/api/v1/route/calculate", lambda r: r.fulfill(
        status=200, content_type="application/json", body=json.dumps(MOCK_ROUTE_DATA)
    ))

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

    page.goto("http://localhost:3000/route", wait_until="networkidle")
    time.sleep(3)

    # Click first alt card (Weather-Safer)
    alt_cards = page.locator("div[class*='altCard']")
    print(f"Cards found: {alt_cards.count()}")
    if alt_cards.count() > 0:
        alt_cards.first.click()
        time.sleep(2)

    # Check layers on the maplibregl map instance
    info = page.evaluate("""() => {
        const canvases = document.querySelectorAll('canvas.maplibregl-canvas');
        return {
            canvasCount: canvases.length,
            canvasWidth: canvases[0] ? canvases[0].width : 0,
            canvasHeight: canvases[0] ? canvases[0].height : 0,
        };
    }""")
    print("Map Canvas Info:", info)

    page.screenshot(path="scratch/test_safer_google.png")
    print("Saved scratch/test_safer_google.png")
    browser.close()
