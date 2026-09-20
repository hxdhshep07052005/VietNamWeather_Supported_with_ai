import os
import urllib.request
import zlib

def plantuml_encode(text):
    def encode6bit(b):
        if b < 10:
            return chr(48 + b)
        b -= 10
        if b < 26:
            return chr(65 + b)
        b -= 26
        if b < 26:
            return chr(97 + b)
        b -= 26
        if b == 0:
            return '-'
        if b == 1:
            return '_'
        return '?'

    def append3bytes(b1, b2, b3):
        c1 = b1 >> 2
        c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
        c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
        c4 = b3 & 0x3F
        return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F)

    data = text.encode('utf-8')
    compressed = zlib.compress(data)[2:-4]
    res = ''
    for i in range(0, len(compressed), 3):
        b1 = compressed[i]
        b2 = compressed[i+1] if i+1 < len(compressed) else 0
        b3 = compressed[i+2] if i+2 < len(compressed) else 0
        res += append3bytes(b1, b2, b3)
    return res

# Option 1: Horizontal Layout (Left to Right)
# Left: Users / Actors
# Center: VietForecast Core Platform
# Right: External Systems
option1_lr = """@startuml
!include <C4/C4_Context>

LAYOUT_LEFT_RIGHT()
LAYOUT_WITH_LEGEND()

skinparam defaultFontName "Helvetica"
skinparam wrapWidth 220
skinparam maxMessageSize 180

Person(traveler, "Traveler / Commuter", "Motorcycle riders and car drivers seeking weather-safe routes and AI advice.")
Person(admin, "System Administrator", "Platform managers supervising worker pipelines and user access.")

System(vietforecast, "VietForecast Platform", "Core Software System\\n\\nIntegrates 63-province weather observations, calculates hazard-weighted routes, and coordinates grounded AI travel consultations.")

System_Ext(weather, "Weather Data Provider", "WeatherAPI and WMO meteorological observation feeds for 63 provinces.")
System_Ext(osrm, "Routing Engine", "OSRM highway graph topology and alternative trajectory calculations.")
System_Ext(gemini, "Google Gemini AI", "LLM providing natural language dialogue grounded by structured tool calling.")

Rel(traveler, vietforecast, "Views weather map, requests safe routes, queries AI", "HTTPS / Web")
Rel(admin, vietforecast, "Supervises pipelines, publishes alerts, manages users", "HTTPS / Directus")

Rel(vietforecast, weather, "Fetches hourly forecasts & station feeds", "HTTPS / REST")
Rel(vietforecast, osrm, "Queries driving routes & waypoint geometries", "HTTP / REST")
Rel(vietforecast, gemini, "Dispatches grounded prompts & tool schemas", "HTTPS / JSON")

@enduml
"""

# Option 2: Vertical Clean Hierarchy (Top to Bottom) with clear grouping and refined spacing
option2_tb = """@startuml
!include <C4/C4_Context>

LAYOUT_WITH_LEGEND()

skinparam defaultFontName "Helvetica"
skinparam wrapWidth 240
skinparam maxMessageSize 180

Person(traveler, "Traveler / Commuter", "Motorcycle and car drivers navigating across Vietnam.")
Person(admin, "System Administrator", "Technical operators managing ingestion pipelines and platform data.")

System(vietforecast, "VietForecast Platform", "Central Software System\\n\\nAggregates nationwide weather data, evaluates multi-path route risks, and delivers grounded AI guidance.")

System_Ext(weather, "WeatherAPI (WMO Feeds)", "Supplies hourly weather observations and forecasts across 63 provinces.")
System_Ext(osrm, "OSRM Engine (OpenStreetMap)", "Generates route geometries, distance matrices, and estimated travel times.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Executes grounded reasoning and dialog via function calling.")

Rel(traveler, vietforecast, "Views real-time maps, plans safe routes, interacts with AI", "HTTPS / Web")
Rel(admin, vietforecast, "Supervises worker pipelines, audits station data, broadcasts alerts", "HTTPS / Admin Studio")

Rel(vietforecast, weather, "Polls real-time telemetry", "HTTPS / REST")
Rel(vietforecast, osrm, "Extracts route alternatives", "HTTP / REST")
Rel(vietforecast, gemini, "Tool-grounded conversational reasoning", "HTTPS / JSON")

@enduml
"""

# Option 3: Modern Enterprise C4 with Enterprise Boundary & Clear Interfaces
option3_enterprise = """@startuml
!include <C4/C4_Context>

LAYOUT_WITH_LEGEND()

skinparam defaultFontName "Helvetica"
skinparam wrapWidth 220
skinparam maxMessageSize 160

Enterprise_Boundary(users_bound, "Platform Users") {
    Person(traveler, "Traveler / Commuter", "Everyday commuters and long-distance drivers seeking weather-safe navigation.")
    Person(admin, "System Administrator", "Operators monitoring ingestion health, RBAC policies, and severe advisories.")
}

System(vietforecast, "VietForecast Platform", "Core Software System\\n\\nUnified platform for weather map visualization, multi-criteria route hazard scoring, and grounded AI assistant.")

Enterprise_Boundary(ext_bound, "External Cloud Services") {
    System_Ext(weather, "WeatherAPI / WMO", "Real-time surface meteorology and forecasts across 63 Vietnamese provinces.")
    System_Ext(osrm, "OSRM / OpenStreetMap", "Road network graph engine for alternative route geometries and ETAs.")
    System_Ext(gemini, "Google Gemini 1.5 Flash", "Multimodal generative AI delivering tool-grounded conversational advisory.")
}

Rel(traveler, vietforecast, "Views weather map, computes safe routes, consults AI", "HTTPS / JSON")
Rel(admin, vietforecast, "Manages system config, monitors pipelines, issues warnings", "HTTPS / Directus")

Rel_D(vietforecast, weather, "Ingests hourly observation feeds", "HTTPS / REST")
Rel_D(vietforecast, osrm, "Queries road network paths", "HTTP / REST")
Rel_D(vietforecast, gemini, "Executes tool calling & grounded inference", "HTTPS / API")

@enduml
"""

options = [
    ('option1_lr.png', option1_lr),
    ('option2_tb.png', option2_tb),
    ('option3_enterprise.png', option3_enterprise)
]

for filename, code in options:
    encoded = plantuml_encode(code)
    url = 'http://www.plantuml.com/plantuml/png/' + encoded
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    out_path = os.path.join('report', 'diagrams', filename)
    with urllib.request.urlopen(req) as resp, open(out_path, 'wb') as f:
        f.write(resp.read())
    print(f'Generated {out_path} (size: {os.path.getsize(out_path)} bytes)')
