import sys
import threading
import time
import http.server
import socketserver
import os

sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path
from playwright.sync_api import sync_playwright

DIST_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\apps\web\dist")
OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def do_GET(self):
        # If path does not exist, rewrite to index.html (SPA routing)
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            if not os.path.exists(os.path.join(path, "index.html")):
                self.path = "/index.html"
        return super().do_GET()

def start_server(port=4173):
    server = socketserver.TCPServer(("127.0.0.1", port), SPAHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server

def capture():
    server = start_server(4173)
    print("Server started on http://127.0.0.1:4173")
    time.sleep(1)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 16:9 widescreen desktop viewport
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto("http://127.0.0.1:4173/", wait_until="networkidle")
        page.evaluate("""() => {
            localStorage.setItem('vietnam-weather-theme', 'dark');
            localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
            localStorage.setItem('vietnam-weather-language', 'vi');
            localStorage.setItem('vietnam-weather-language-store', JSON.stringify({ state: { language: 'vi' }, version: 0 }));
            document.documentElement.setAttribute('data-theme', 'dark');
        }""")
        page.reload(wait_until="networkidle")
        time.sleep(1)

        # 1. Landing Page
        print("Capturing Landing Page...")
        page.screenshot(path=str(OUT_DIR / "ui_landing.png"))
        print("Saved ui_landing.png")

        # 2. Login Page
        print("Capturing Login Page...")
        page.goto("http://127.0.0.1:4173/login", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=str(OUT_DIR / "ui_login.png"))
        print("Saved ui_login.png")

        # 3. Register Page
        print("Capturing Register Page...")
        page.goto("http://127.0.0.1:4173/register", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=str(OUT_DIR / "ui_register.png"))
        print("Saved ui_register.png")

        # Authenticated Page for Protected Features
        auth_page = browser.new_page(viewport={"width": 1440, "height": 900})
        auth_page.goto("http://127.0.0.1:4173/login", wait_until="networkidle")
        auth_page.evaluate("""() => {
            localStorage.setItem('vietnam-weather-theme', 'dark');
            localStorage.setItem('vietnam-weather-theme-store', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
            localStorage.setItem('vietnam-weather-language', 'vi');
            localStorage.setItem('vietnam-weather-language-store', JSON.stringify({ state: { language: 'vi' }, version: 0 }));
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
        }""")

        # Mock route calculate API
        mock_route_data = {
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
                            "vi": "Lộ trình tối ưu tránh hoàn toàn vùng mây đối lưu dông sét qua Đoan Hùng, tầm nhìn thông thoáng.",
                            "en": "Optimal corridor avoiding convective thunderstorm cells over Doan Hung with clear visibility."
                        },
                        "sample_points": [
                            {
                                "name": "Hà Nội (Xuất phát)",
                                "distance_from_origin_meters": 0,
                                "eta_minutes": 0,
                                "risk_level": "low",
                                "factors": ["Giao thông thuận lợi"],
                                "observation": {"temperature": 28, "condition": "Mây nhẹ", "rain_probability": 10, "wind_speed": 12}
                            },
                            {
                                "name": "Trạm Vĩnh Yên (Km 55)",
                                "distance_from_origin_meters": 55000,
                                "eta_minutes": 45,
                                "risk_level": "low",
                                "factors": ["Khô ráo, tầm nhìn tốt"],
                                "observation": {"temperature": 27, "condition": "Trời nắng nhẹ", "rain_probability": 15, "wind_speed": 14}
                            },
                            {
                                "name": "Trạm Phú Thọ (Km 102)",
                                "distance_from_origin_meters": 102000,
                                "eta_minutes": 88,
                                "risk_level": "low",
                                "factors": ["Tầm nhìn > 10 km"],
                                "observation": {"temperature": 26, "condition": "Mây rải rác", "rain_probability": 20, "wind_speed": 15}
                            },
                            {
                                "name": "Trạm Yên Bái (Km 168)",
                                "distance_from_origin_meters": 168000,
                                "eta_minutes": 145,
                                "risk_level": "caution",
                                "factors": ["Mưa phùn nhẹ, mặt đường ẩm"],
                                "observation": {"temperature": 24, "condition": "Mưa nhỏ rải rác", "rain_probability": 38, "wind_speed": 18}
                            },
                            {
                                "name": "Trạm Bảo Thắng (Km 245)",
                                "distance_from_origin_meters": 245000,
                                "eta_minutes": 210,
                                "risk_level": "low",
                                "factors": ["Mát mẻ, đèo dốc ổn định"],
                                "observation": {"temperature": 23, "condition": "Mây thay đổi", "rain_probability": 25, "wind_speed": 16}
                            },
                            {
                                "name": "Lào Cai - Sa Pa (Đích)",
                                "distance_from_origin_meters": 298000,
                                "eta_minutes": 260,
                                "risk_level": "low",
                                "factors": ["Thời tiết an toàn"],
                                "observation": {"temperature": 21, "condition": "Trời mát", "rain_probability": 15, "wind_speed": 10}
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
                            "vi": "Cao tốc Nội Bài - Lào Cai gặp mưa dông cực lớn và gió giật mạnh tại đoạn Km 110 - 150.",
                            "en": "Expressway encounters heavy convective storm and crosswinds along Km 110-150."
                        },
                        "sample_points": [
                            {
                                "name": "Hà Nội",
                                "distance_from_origin_meters": 0,
                                "eta_minutes": 0,
                                "risk_level": "low",
                                "observation": {"temperature": 28, "condition": "Mây nhẹ", "rain_probability": 10, "wind_speed": 12}
                            },
                            {
                                "name": "Trạm Km 115 (Cao tốc)",
                                "distance_from_origin_meters": 115000,
                                "eta_minutes": 78,
                                "risk_level": "high",
                                "factors": ["Mưa dông lớn > 35mm/h", "Gió giật cấp 6-7"],
                                "observation": {"temperature": 22, "condition": "Dông lốc nguy hiểm", "rain_probability": 92, "wind_speed": 46}
                            },
                            {
                                "name": "Lào Cai",
                                "distance_from_origin_meters": 287000,
                                "eta_minutes": 234,
                                "risk_level": "caution",
                                "observation": {"temperature": 22, "condition": "Mưa rào", "rain_probability": 65, "wind_speed": 22}
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
                            "vi": "Quốc lộ 70 mặt đường trơn trượt và có sương mù dày khu vực đèo Bảo Yên.",
                            "en": "National Route 70 has slippery road surface and dense mountain fog."
                        },
                        "sample_points": [
                            {
                                "name": "Hà Nội",
                                "distance_from_origin_meters": 0,
                                "eta_minutes": 0,
                                "risk_level": "low",
                                "observation": {"temperature": 28, "condition": "Mây nhẹ", "rain_probability": 10, "wind_speed": 12}
                            },
                            {
                                "name": "Lào Cai",
                                "distance_from_origin_meters": 275000,
                                "eta_minutes": 330,
                                "risk_level": "caution",
                                "factors": ["Sương mù đèo dốc"],
                                "observation": {"temperature": 21, "condition": "Sương mù", "rain_probability": 45, "wind_speed": 15}
                            }
                        ]
                    }
                ]
            }
        }

        import json
        auth_page.route("**/api/v1/route/calculate", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(mock_route_data)
        ))

        # Mock Chat API
        mock_chat_data = {
            "data": {
                "message": {
                    "id": "msg-ai-101",
                    "role": "assistant",
                    "content": "Dựa trên dữ liệu quan trắc khí tượng thời gian thực từ các trạm quan trắc tự động dọc hành lang Hà Nội — Sa Pa, lộ trình Weather-Safer qua Cao tốc Nội Bài — Lào Cai hiện có điều kiện di chuyển an toàn nhất. Đoạn qua Yên Bái ghi nhận mưa nhỏ nhẹ nhưng tầm nhìn vẫn trên 10 km, hoàn toàn tránh được vùng mây đối lưu dông sét ở Đoan Hùng.",
                    "timestamp": "2026-09-12T23:22:00Z",
                    "citations": [
                        {
                            "stationId": "VN-HN-01",
                            "stationName": "Trạm khí tượng Láng (Hà Nội)",
                            "observedAt": "23:15 12/09/2026",
                            "metric": "28°C, Mây nhẹ, Gió 12 km/h"
                        },
                        {
                            "stationId": "VN-YB-01",
                            "stationName": "Trạm khí tượng TP Yên Bái",
                            "observedAt": "23:10 12/09/2026",
                            "metric": "24°C, Mưa nhỏ nhẹ, Gió 18 km/h"
                        },
                        {
                            "stationId": "VN-LC-01",
                            "stationName": "Trạm quan trắc Sa Pa",
                            "observedAt": "23:12 12/09/2026",
                            "metric": "21°C, Tầm nhìn tốt, Đường an toàn"
                        }
                    ],
                    "disclaimer": "Dữ liệu được bảo chứng bởi trạm quan trắc thực địa tự động, cập nhật chu kỳ 5 phút."
                },
                "remainingQuota": 29
            }
        }

        auth_page.route("**/api/v1/chat/message", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(mock_chat_data)
        ))

        # 4. Interactive Map Page
        print("Capturing Map Page...")
        auth_page.goto("http://127.0.0.1:4173/map", wait_until="networkidle")
        time.sleep(3)
        auth_page.screenshot(path=str(OUT_DIR / "ui_map.png"))
        print("Saved ui_map.png")

        # 5. AI Chat Assistant (Opened on Map Page)
        print("Capturing AI Chat Assistant...")
        trigger = auth_page.locator("button[class*='floatingTrigger']")
        trigger.first.click()
        time.sleep(1)
        # Select suggestion chip inside chat window
        chat_chip = auth_page.locator("div[class*='chatWindow'] button[class*='chip']").first
        if chat_chip.count() > 0:
            chat_chip.click()
            time.sleep(2.5)
        auth_page.screenshot(path=str(OUT_DIR / "ui_ai_chat.png"))
        print("Saved ui_ai_chat.png")

        # 6. Route Planner Page (Hanoi - Lao Cai / Sa Pa corridor)
        print("Capturing Route Planner Page...")
        auth_page.goto("http://127.0.0.1:4173/route", wait_until="networkidle")
        time.sleep(3)
        auth_page.screenshot(path=str(OUT_DIR / "ui_route_planner.png"))
        print("Saved ui_route_planner.png")

        browser.close()

    server.shutdown()
    print("Screenshots captured successfully!")

if __name__ == "__main__":
    capture()
