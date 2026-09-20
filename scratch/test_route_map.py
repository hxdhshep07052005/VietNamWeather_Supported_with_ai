import time
import json
from playwright.sync_api import sync_playwright

AUTH_DATA_PRO = {
    "state": {
        "user": {
            "id": "usr_pro_research",
            "email": "researcher@vietnamweather.vn",
            "name": "Hoang Dang",
            "plan": "pro",
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

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1500, "height": 950}, device_scale_factor=1.25)
    page = context.new_page()

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
    time.sleep(4)

    alt_cards = page.locator("div[class*='altCard']")
    if alt_cards.count() > 0:
        alt_cards.first.click()
        time.sleep(3)

    page.screenshot(path="scratch/test_safer_google.png")
    print("Saved scratch/test_safer_google.png")
    browser.close()
