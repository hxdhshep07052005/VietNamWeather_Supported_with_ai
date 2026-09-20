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

# Version A: Horizontal Left-to-Right
# Crystal clear reading order: Users (Input) -> VietForecast (Processing) -> External Services (Data/Inference)
code_lr = """@startuml
!include <C4/C4_Context>

LAYOUT_LEFT_RIGHT()
LAYOUT_WITH_LEGEND()

skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 230
skinparam maxMessageSize 160
skinparam roundCorner 8
skinparam shadowing false

Person(traveler, "Traveler / Commuter", "Motorcycle riders and car drivers navigating across Vietnam seeking safe routes and weather alerts.")
Person(admin, "System Administrator", "Platform administrators monitoring data ingestion pipelines and configuring access rules via Directus.")

System(vietforecast, "VietForecast Platform", "Core Software System\\n\\nAggregates 63-province weather telemetry, evaluates multi-path corridor risks, and coordinates grounded AI travel consultations.")

System_Ext(weather, "WeatherAPI / WMO Feeds", "Provides real-time surface observations and numeric weather forecasts across Vietnam's 63 provinces.")
System_Ext(osrm, "OSRM Engine (OpenStreetMap)", "High-performance routing engine providing highway graph topology, waypoint geometries, and travel durations.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Multimodal large language model executing grounded reasoning via deterministic function calling.")

Rel(traveler, vietforecast, "Views live weather map, plans safe routes, consults AI", "HTTPS / Web")
Rel(admin, vietforecast, "Supervises worker pipelines, audits station data, broadcasts alerts", "HTTPS / Directus")

Rel(vietforecast, weather, "Fetches hourly observations & station forecasts", "HTTPS / REST")
Rel(vietforecast, osrm, "Queries alternative driving paths & geometries", "HTTP / REST")
Rel(vietforecast, gemini, "Executes tool calling & grounded conversational reasoning", "HTTPS / API")

@enduml
"""

# Version B: Symmetrical Vertical Top-to-Bottom
# Balanced pyramid: Users on top, Platform in middle, External dependencies on bottom
code_tb = """@startuml
!include <C4/C4_Context>

LAYOUT_WITH_LEGEND()

skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 220
skinparam maxMessageSize 150
skinparam roundCorner 8
skinparam shadowing false

Person(traveler, "Traveler / Commuter", "Motorcycle riders and car drivers seeking weather-safe travel guidance.")
Person(admin, "System Administrator", "Platform administrators monitoring pipelines and managing data via Directus.")

System(vietforecast, "VietForecast Platform", "Central Software System\\n\\nIntegrates real-time WMO weather data, computes multi-path hazard scores, and serves grounded conversational AI.")

System_Ext(weather, "WeatherAPI / WMO Feeds", "Real-time observations and forecasts across 63 Vietnamese provinces.")
System_Ext(osrm, "OSRM / OpenStreetMap", "Road network graph engine for alternative route geometries and ETAs.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Multimodal generative AI delivering tool-grounded conversational advisory.")

Rel_D(traveler, vietforecast, "Views weather map, computes safe routes, consults AI", "HTTPS / Web")
Rel_D(admin, vietforecast, "Supervises pipelines, audits station data, broadcasts alerts", "HTTPS / Directus")

Rel_D(vietforecast, weather, "Polls real-time telemetry & forecasts", "HTTPS / REST")
Rel_D(vietforecast, osrm, "Extracts route geometries & distance matrices", "HTTP / REST")
Rel_D(vietforecast, gemini, "Executes tool calling & grounded inference", "gRPC / HTTPS")

@enduml
"""

with open('report/diagrams/c4_context_lr.puml', 'w', encoding='utf-8') as f:
    f.write(code_lr)

with open('report/diagrams/c4_context_tb.puml', 'w', encoding='utf-8') as f:
    f.write(code_tb)

# Render PNG and SVG for both
for name, code in [('c4_lr', code_lr), ('c4_tb', code_tb)]:
    enc = plantuml_encode(code)
    for fmt in ['png', 'svg']:
        url = f'http://www.plantuml.com/plantuml/{fmt}/' + enc
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        target = f'report/figures/{name}.{fmt}'
        with urllib.request.urlopen(req) as resp, open(target, 'wb') as f:
            f.write(resp.read())
        print(f'Saved {target}')
