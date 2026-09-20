# -*- coding: utf-8 -*-
import sys
import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)

with open('scratch/chat_payload.json', 'r', encoding='utf-8') as f:
    payload = json.load(f)

MOCK_CHAT_RESPONSE = payload['response']
QUESTION_TEXT = payload['question']

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 1600, 'height': 1020},
            device_scale_factor=1.25
        )
        page = context.new_page()

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

        print('Navigating to http://localhost:3000/map...')
        page.goto('http://localhost:3000/map', wait_until='networkidle')

        page.evaluate('''() => {
            localStorage.setItem('vietnam-weather-theme', 'dark');
            localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
            localStorage.setItem('vietnam-weather-language', 'vi');
            localStorage.setItem('vietnam-weather-language-store', JSON.stringify({ state: { language: 'vi' }, version: 0 }));
            localStorage.setItem('vietnam-weather-map-style', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('vietnam-weather-auth', JSON.stringify({
                state: {
                    user: {
                        id: 'usr_research_01',
                        email: 'researcher@vietnamweather.vn',
                        name: 'Hoang Dang',
                        role: 'user',
                        plan: 'pro',
                        isVerified: true,
                        savedLocations: [],
                        savedRoutes: []
                    },
                    isAuthenticated: true,
                    isVerified: true,
                    isLoading: false,
                    error: null
                },
                version: 0
            }));
            localStorage.setItem('access_token', 'mock_token_researcher');
        }''')

        page.reload(wait_until='networkidle')
        time.sleep(2)

        # Switch map style to dark if button is present
        dark_btn = page.locator("button:has-text('Tối')")
        if dark_btn.count() > 0:
            dark_btn.first.click()
            time.sleep(1)

        print('Opening chat widget...')
        trigger = page.locator("button[class*='floatingTrigger']").first
        trigger.click()
        time.sleep(1)

        print('Typing complex question...')
        input_field = page.locator("input[class*='inputField']").first
        input_field.fill(QUESTION_TEXT)
        time.sleep(0.5)

        print('Sending message...')
        send_btn = page.locator("button[class*='sendButton']").first
        send_btn.click()
        time.sleep(2.5)

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

        screenshot_path = OUT_DIR / 'ui_ai_chat.png'
        page.screenshot(path=str(screenshot_path))
        print(f'Screenshot saved to {screenshot_path}')

        browser.close()

if __name__ == '__main__':
    run()
