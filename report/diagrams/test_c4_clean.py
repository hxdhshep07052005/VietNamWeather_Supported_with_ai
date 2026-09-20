import zlib
import base64
import urllib.request
import os

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

def render(name, code):
    enc = plantuml_encode(code)
    url = f'http://www.plantuml.com/plantuml/png/' + enc
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    out_path = f'scratch/{name}.png'
    with urllib.request.urlopen(req) as resp, open(out_path, 'wb') as f:
        f.write(resp.read())
    print(f'Rendered {out_path}')

# Option A: Symmetrical Top Actors (Traveler & Admin both centered side by side at the top)
puml_a = """@startuml
!include <C4/C4_Container>

skinparam dpi 180
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam wrapWidth 180
skinparam maxMessageSize 120
skinparam roundCorner 8
skinparam shadowing false

LAYOUT_TOP_DOWN()
LAYOUT_WITH_LEGEND()

' Top Actors centered side by side
Person(traveler, "Traveler / Commuter", "Motorcycle and car drivers navigating across Vietnam.")
Person(admin, "System Administrator", "Platform managers operating via internal network/VPN.")

' Left External: Maps & LLM Reasoning
System_Ext(geoapify, "Geoapify API", "External service providing geocoding, map tiles, and routing.")
System_Ext(gemini, "Google Gemini 1.5 Flash", "Foundation LLM delivering grounded conversational reasoning via function calling.")

' Right External: Weather Provider
System_Ext(weather_api, "WeatherAPI Service", "External provider supplying current conditions and 3-day forecast feeds.")

System_Boundary(c1, "VietForecast Platform Infrastructure") {
    
    Container(edge, "Reverse Proxy / Ingress", "Nginx", "Terminates TLS, routes public traffic, enforces rate limits and security headers.")
    
    Boundary(app_net, "Application Network (Bridge)") {
        Container(web, "Web Application", "React 18, Vite, MapLibre GL", "Provides responsive interactive GIS mapping, route visualization, and localized user interfaces.")
        Container(api, "API Gateway / BFF", "Fastify 5, TypeScript", "Enforces ADR-004 session boundary, route validation, rate limiting, and AI tool orchestration.")
        Container(directus, "Headless CMS & Identity", "Directus 12.1.1, Node.js", "System of record for business rules, roles, users, locales, and administrative workflows.")
        Container(worker, "Integration Worker", "Node.js, TypeScript", "Executes background ingestion, database lease locks, circuit breakers, and provider retries.")
    }
    
    Boundary(data_net, "Data Network (internal: true)") {
        ContainerDb(db, "Spatial Database", "PostgreSQL 16, PostGIS 3.4", "Stores administrative units, canonical locations, observations, forecasts, and spatial GiST indexes.")
        ContainerDb(redis, "In-Memory Cache & Queue", "Redis 7 (AOF enabled)", "Caches weather responses (TTL 1800s), coordinates rate limit buckets, and buffers job coordination.")
    }
}

' Relative positioning
traveler -[hidden]right- admin
edge -[hidden]down- web
web -[hidden]down- api
api -[hidden]right- directus
directus -[hidden]right- worker

geoapify -[hidden]down- gemini
worker -[hidden]right- weather_api

db -[hidden]right- redis

' 1. Public traffic
Rel_D(traveler, edge, "Accesses via HTTPS", "Port 443 / 80")
Rel_D(edge, web, "Delivers Web UI SPA", "HTTP / 8080")
Rel_D(web, api, "Invokes BFF API (/api/v1)", "HTTPS / REST")

' 2. External Map & AI
Rel_L(web, geoapify, "Loads map vector tiles", "HTTPS")
Rel_L(api, geoapify, "Requests route geometries", "HTTPS / REST")
Rel_L(api, gemini, "Executes grounded tool orchestration", "HTTPS / JSON-RPC")

' 3. Backend service delegation
Rel_R(api, directus, "Delegates auth & business queries", "HTTP / REST")

' 4. Admin & Weather Ingestion
Rel_D(admin, directus, "Admin Studio (VPN/SSH)", "Port 8055 / SSH")
Rel_R(worker, weather_api, "Polls weather feeds with backoff", "HTTPS / REST")

' 5. Data Network Persistence
Rel_D(api, db, "Validates sessions & corridor data", "TCP / 5432")
Rel_D(api, redis, "Rate limits & weather cache", "TCP / 6379")

Rel_D(directus, db, "Persists system state & schema", "TCP / 5432")
Rel_D(directus, redis, "Cache auto-purge", "TCP / 6379")

Rel_D(worker, db, "Acquires lease & upserts observations", "TCP / 5432")

@enduml
"""

render('test_opt_a', puml_a)
