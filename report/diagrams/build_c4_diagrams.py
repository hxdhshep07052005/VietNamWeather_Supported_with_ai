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

# Layout A: Horizontal Flow (Left to Right) - Ultra-clear & intuitive
code_a = """@startuml
!include <C4/C4_Context>

skinparam dpi 300
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 230
skinparam maxMessageSize 150
skinparam roundCorner 8
skinparam shadowing false

LAYOUT_LEFT_RIGHT()
LAYOUT_WITH_LEGEND()

Person(traveler, "Traveler / Commuter", "Motorcycle and car drivers navigating across Vietnam seeking safe routes and weather alerts.")
Person(admin, "System Administrator", "Platform managers supervising worker pipelines and user security via Directus Studio.")

System(vietforecast, "VietForecast Platform", "Core Software System\\n\\nAggregates 63-province meteorology, evaluates multi-path corridor hazards, and serves grounded AI travel assistance.")

System_Ext(weather, "WeatherAPI / WMO Feeds", "Real-time surface observations and numerical weather prediction feeds across 63 provinces.")
System_Ext(osrm, "OSRM Routing Engine", "OpenStreetMap road network graph engine providing alternative paths and travel times.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Multimodal foundation LLM delivering grounded natural language advice via function calling.")

Rel(traveler, vietforecast, "Views live weather map, plans safe routes, consults AI", "HTTPS / Web")
Rel(admin, vietforecast, "Supervises pipelines, audits station data, broadcasts alerts", "HTTPS / Directus")

Rel(vietforecast, weather, "Fetches hourly observations & station forecasts", "HTTPS / REST")
Rel(vietforecast, osrm, "Queries alternative driving paths & geometries", "HTTP / REST")
Rel(vietforecast, gemini, "Dispatches tool calling & receives grounded answers", "gRPC / HTTPS")

@enduml
"""

# Layout B: Symmetrical Vertical Flow (Top to Bottom) - Classic Architectural Hierarchy
code_b = """@startuml
!include <C4/C4_Context>

skinparam dpi 300
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 210
skinparam maxMessageSize 140
skinparam roundCorner 8
skinparam shadowing false

LAYOUT_WITH_LEGEND()

Person(traveler, "Traveler / Commuter", "Motorcycle and car drivers seeking weather-safe navigation across Vietnam.")
Person(admin, "System Administrator", "Platform administrators monitoring data ingestion and managing users via Directus.")

System(vietforecast, "VietForecast Platform", "Central Software System\\n\\nIntegrates 63-province WMO meteorological data, calculates multi-path hazard scores, and coordinates grounded AI advisory.")

System_Ext(weather, "WeatherAPI / WMO Feeds", "Supplies real-time observations and forecasts for 63 provinces.")
System_Ext(osrm, "OSRM / OpenStreetMap", "Highway routing graph providing alternative paths and waypoints.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Foundation model providing grounded reasoning via tool calling.")

Rel_D(traveler, vietforecast, "Views maps, calculates safe routes, queries AI", "HTTPS / Web")
Rel_D(admin, vietforecast, "Supervises workers, audits data, issues alerts", "HTTPS / Directus")

Rel_D(vietforecast, weather, "Ingests hourly station telemetry", "HTTPS / REST")
Rel_D(vietforecast, osrm, "Requests route geometries & ETAs", "HTTP / REST")
Rel_D(vietforecast, gemini, "Executes function calls & dialogue", "gRPC / HTTPS")

@enduml
"""

diagrams = [
    ('c4_context_option_a', code_a),
    ('c4_context_option_b', code_b)
]

for base_name, code in diagrams:
    # Save puml
    puml_path = os.path.join('report', 'diagrams', f'{base_name}.puml')
    with open(puml_path, 'w', encoding='utf-8') as f:
        f.write(code)
    print(f'Saved {puml_path}')

    # Download PNG & SVG
    enc = plantuml_encode(code)
    for fmt in ['png', 'svg']:
        url = f'http://www.plantuml.com/plantuml/{fmt}/' + enc
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        target_path = os.path.join('report', 'figures', f'{base_name}.{fmt}')
        with urllib.request.urlopen(req) as resp, open(target_path, 'wb') as f:
            f.write(resp.read())
        print(f'Saved {target_path} (size: {os.path.getsize(target_path)} bytes)')
