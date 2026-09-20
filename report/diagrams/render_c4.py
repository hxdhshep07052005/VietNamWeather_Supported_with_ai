import os
import urllib.request
import zlib

c4_code = """@startuml
!include <C4/C4_Context>

LAYOUT_WITH_LEGEND()

title System Context Diagram for VietForecast Platform

Person(commuter, "Commuter / Traveler", "Motorcycle riders and car drivers seeking weather-safe travel guidance.")
Person(admin, "System Administrator", "Platform administrators monitoring ingestion pipelines and managing users via Directus Studio.")

System(vietforecast, "VietForecast Platform", "Core software platform integrating real-time WMO weather data, computing multi-path hazard scores, and serving grounded conversational AI.")

System_Ext(weatherapi, "WeatherAPI & WMO Network", "Provides real-time observations and numerical weather prediction feeds across Vietnam's 63 provinces.")
System_Ext(osrm, "OSRM Engine & OSM", "Provides open road network routing topology, multi-coordinate waypoints, and distance calculations.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Large language model performing natural language inference grounded by structured tool calling.")

Rel(commuter, vietforecast, "Views weather overlays, plans safe routes, and queries AI assistant", "HTTPS / JSON")
Rel(admin, vietforecast, "Supervises worker pipelines, audits station records, and broadcasts advisories", "HTTPS / Directus Admin")

Rel(vietforecast, weatherapi, "Fetches hourly forecasts and station telemetry", "HTTPS / REST")
Rel(vietforecast, osrm, "Requests alternative driving routes and waypoint geometries", "HTTP / REST")
Rel(vietforecast, gemini, "Executes grounded chat sessions with function-call dispatch", "gRPC / HTTPS")

@enduml
"""

with open('report/diagrams/c4_context.puml', 'w', encoding='utf-8') as f:
    f.write(c4_code)

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

encoded = plantuml_encode(c4_code)
url = 'http://www.plantuml.com/plantuml/png/' + encoded
print('Fetching from:', url)
urllib.request.urlretrieve(url, 'report/diagrams/c4_context_rendered.png')
print('Successfully saved report/diagrams/c4_context_rendered.png. Size:', os.path.getsize('report/diagrams/c4_context_rendered.png'))
