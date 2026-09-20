import time
import json
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path(r"c:\Users\dangh\Downloads\VietNameWeatherWithAi\VietNamWeather_Supported_with_ai\report\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)

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
                        "name": "Station Km 140 (Expressway)",
                        "distance_from_origin_meters": 140000,
                        "eta_minutes": 95,
                        "risk_level": "high",
                        "factors": ["High hydroplaning risk"],
                        "observation": {"temperature": 21, "condition": "Severe Storm", "rain_probability": 95, "wind_speed": 50}
                    },
                    {
                        "name": "Station Km 210 (Expressway)",
                        "distance_from_origin_meters": 210000,
                        "eta_minutes": 150,
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
            "savedLocations": [],
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
        route_context = browser.new_context(viewport={"width": 1600, "height": 980}, device_scale_factor=1.25)
        page = route_context.new_page()

        page.route("**/api/v1/route/calculate", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(MOCK_ROUTE_DATA)
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
            time.sleep(3)
            page.screenshot(path=str(OUT_DIR / "ui_route_safer.png"))
            shutil.copy(str(OUT_DIR / "ui_route_safer.png"), str(OUT_DIR / "ui_route_planner.png"))
            print("   -> Saved ui_route_safer.png and copied to ui_route_planner.png")

        # 5.2 Fastest Route
        print("14. Capturing ui_route_fastest.png (Fastest Expressway) ...")
        if card_count > 1:
            alt_cards.nth(1).click()
            time.sleep(3)
            page.screenshot(path=str(OUT_DIR / "ui_route_fastest.png"))
            print("   -> Saved ui_route_fastest.png")

        # 5.3 Shortest Route
        print("15. Capturing ui_route_shortest.png (Shortest Mountain Route) ...")
        if card_count > 2:
            alt_cards.nth(2).click()
            time.sleep(3)
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

        route_context.close()
        browser.close()

if __name__ == "__main__":
    run()
