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

erd_puml = """@startuml
skinparam dpi 180
skinparam defaultFontName "Segoe UI, Arial, sans-serif"
skinparam roundCorner 6
skinparam shadowing false

entity "directus_users" as usr {
    * id : uuid <<PK>>
    --
    * email : varchar(128)
    * status : varchar(50)
    * role : uuid <<FK>>
    first_name : varchar(50)
    last_name : varchar(50)
}

entity "app_security.sessions" as sec_sess {
    * id : uuid <<PK>>
    --
    * user_id : uuid <<FK>>
    * encrypted_access_token : text
    * encrypted_refresh_token : text
    * encryption_iv : varchar(32)
    * auth_tag : varchar(32)
    * expires_at : timestamptz
    * created_at : timestamptz
    revoked_at : timestamptz
}

entity "administrative_units" as admin_unit {
    * id : uuid <<PK>>
    --
    parent_id : uuid <<FK>>
    * canonical_name : varchar(255)
    * unit_type : varchar(32)
    * country_code : char(2)
    boundary : geometry(MultiPolygon, 4326)
}

entity "locations" as loc {
    * id : uuid <<PK>>
    --
    administrative_unit_id : uuid <<FK>>
    * name : varchar(255)
    * lat : numeric(10,7)
    * lon : numeric(10,7)
    * geom : geometry(Point, 4326)
    is_weather_station : boolean
}

entity "weather_observations" as obs {
    * id : uuid <<PK>>
    --
    * location_id : uuid <<FK>>
    * temperature : numeric(5,2)
    * precipitation_rate : numeric(6,2)
    * wind_speed : numeric(5,2)
    * wind_gust : numeric(5,2)
    * visibility_m : integer
    * wmo_code : integer
    * integrity_hash : varchar(64)
    * observed_at : timestamptz
}

entity "weather_forecasts" as fc {
    * id : uuid <<PK>>
    --
    * location_id : uuid <<FK>>
    * valid_from : timestamptz
    * valid_to : timestamptz
    * precipitation_prob : numeric(5,2)
    * expected_rain_mm : numeric(6,2)
    * max_wind_gust : numeric(5,2)
    * risk_category : varchar(20)
}

entity "risk_rules" as rules {
    * id : uuid <<PK>>
    --
    * rule_set_id : uuid <<FK>>
    * vehicle_type : varchar(30)
    * dimension : varchar(30)
    * caution_min : numeric
    * high_min : numeric
    * extreme_min : numeric
}

entity "route_requests" as req {
    * id : uuid <<PK>>
    --
    * user_id : uuid <<FK>>
    * vehicle_type : varchar(30)
    * origin_geom : geometry(Point, 4326)
    * dest_geom : geometry(Point, 4326)
    * departure_time : timestamptz
    * created_at : timestamptz
}

entity "route_options" as opt {
    * id : uuid <<PK>>
    --
    * request_id : uuid <<FK>>
    * route_profile : varchar(50)
    * total_distance_m : numeric
    * total_duration_s : numeric
    * max_severity : varchar(20)
    * composite_score : numeric(8,4)
    * route_geom : geometry(LineString, 4326)
}

usr ||--o{ sec_sess : "issues"
usr ||--o{ req : "requests"
admin_unit ||--o{ admin_unit : "parent_of"
admin_unit ||--o{ loc : "classifies"
loc ||--o{ obs : "records"
loc ||--o{ fc : "predicts"
req ||--o{ opt : "evaluates"
rules ||--o{ opt : "scores"

@enduml
"""

enc = plantuml_encode(erd_puml)
url = f'http://www.plantuml.com/plantuml/png/' + enc
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as resp, open('scratch/test_erd_clean.png', 'wb') as f:
    f.write(resp.read())
print('Rendered scratch/test_erd_clean.png')
