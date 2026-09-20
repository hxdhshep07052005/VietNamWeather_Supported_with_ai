import sys
import os
import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")

with open('scratch/chat_payload_en.json', 'r', encoding='utf-8') as f:
    chat_payload = json.load(f)

MOCK_CHAT_RESPONSE = chat_payload['response']
CHAT_QUESTION_TEXT = chat_payload['question']

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

def set_en_dark(page, auth=None):
    auth_script = f"localStorage.setItem('vietnam-weather-auth', JSON.stringify({json.dumps(auth)})); localStorage.setItem('access_token', 'mock_token_researcher');" if auth else "localStorage.removeItem('vietnam-weather-auth'); localStorage.removeItem('access_token');"
    page.evaluate(f"""() => {{
        localStorage.setItem('vietnam-weather-theme', 'dark');
        localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({{ state: {{ theme: 'dark' }}, version: 0 }}));
        localStorage.setItem('vietnam-weather-language', 'en');
        localStorage.setItem('vietnam-weather-language-store', JSON.stringify({{ state: {{ language: 'en' }}, version: 0 }}));
        localStorage.setItem('vietnam-weather-map-style', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        {auth_script}
    }}""")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    map_context = browser.new_context(viewport={"width": 1600, "height": 1020}, device_scale_factor=1.25)
    page = map_context.new_page()

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
    time.sleep(3.5)

    dark_btn = page.locator("button:has-text('Dark')").first
    if dark_btn.count() > 0:
        dark_btn.click(force=True)
        time.sleep(1)

    search_input = page.locator("input[placeholder*='Search province'], input[placeholder*='Search']")
    if search_input.count() > 0:
        search_input.first.fill("Đà Nẵng")
        time.sleep(0.8)
        p_card = page.locator("div[class*='provinceCard']").first
        if p_card.count() > 0:
            p_card.click(force=True)
            time.sleep(2)

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

        page.evaluate('''() => {
            const bubbles = document.querySelectorAll('div[class*="messageBubble"]');
            if (bubbles.length >= 3) {
                bubbles[0].style.display = 'none';
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
        print("Successfully refreshed ui_ai_chat.png")
    
    browser.close()
