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

c4_code = """@startuml
!include <C4/C4_Context>

skinparam dpi 300
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 220
skinparam maxMessageSize 160
skinparam roundCorner 8
skinparam shadowing false

LAYOUT_WITH_LEGEND()

Enterprise_Boundary(users_bound, "Platform Users") {
    Person(traveler, "Traveler / Commuter", "Everyday commuters and long-distance drivers seeking weather-safe navigation across Vietnam.")
    Person(admin, "System Administrator", "Operators monitoring ingestion health, RBAC policies, and severe advisories via Directus.")
}

System(vietforecast, "VietForecast Platform", "Core Software System\\n\\nUnified platform for real-time weather map visualization, multi-criteria route hazard scoring, and grounded AI assistant.")

Enterprise_Boundary(ext_bound, "External Cloud Services") {
    System_Ext(weather, "WeatherAPI / WMO", "Real-time surface meteorology and forecasts across 63 Vietnamese provinces.")
    System_Ext(osrm, "OSRM / OpenStreetMap", "Road network graph engine for alternative route geometries and ETAs.")
    System_Ext(gemini, "Google Gemini 1.5 Flash", "Multimodal generative AI delivering tool-grounded conversational advisory.")
}

traveler -[hidden]R- admin
traveler -[hidden]D- weather
admin -[hidden]D- gemini

Rel(traveler, vietforecast, "Views weather map, computes safe routes, consults AI", "HTTPS / Web")
Rel(admin, vietforecast, "Manages system config, monitors pipelines, issues warnings", "HTTPS / Directus")

Rel_D(vietforecast, weather, "Ingests hourly observation feeds", "HTTPS / REST")
Rel_D(vietforecast, osrm, "Queries road network paths & geometries", "HTTP / REST")
Rel_D(vietforecast, gemini, "Executes tool calling & grounded inference", "gRPC / HTTPS")

@enduml
"""

# Save PUML
with open('report/diagrams/c4_context.puml', 'w', encoding='utf-8') as f:
    f.write(c4_code)
print('Saved report/diagrams/c4_context.puml')

# Download PNG and SVG
enc = plantuml_encode(c4_code)
for fmt, path in [('png', 'report/figures/c4_context.png'), ('svg', 'report/figures/c4_context.svg')]:
    url = f'http://www.plantuml.com/plantuml/{fmt}/' + enc
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as resp, open(path, 'wb') as f:
        f.write(resp.read())
    print(f'Saved {path} (size: {os.path.getsize(path)} bytes)')


