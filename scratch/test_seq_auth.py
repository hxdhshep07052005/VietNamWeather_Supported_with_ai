import os
import urllib.request
import zlib
from PIL import Image

def plantuml_encode(text):
    def encode6bit(b):
        if b < 10: return chr(48 + b)
        b -= 10
        if b < 26: return chr(65 + b)
        b -= 26
        if b < 26: return chr(97 + b)
        b -= 26
        if b == 0: return '-'
        if b == 1: return '_'
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

puml = """@startuml
skinparam dpi 100
skinparam defaultFontName "Segoe UI, Arial, sans-serif"

skinparam defaultFontSize 20
skinparam sequenceGroupFontSize 20
skinparam sequenceReferenceFontSize 19
skinparam dividerFontSize 20
skinparam arrowFontSize 18
skinparam noteFontSize 18
skinparam participantFontSize 20
skinparam actorFontSize 20

skinparam maxMessageSize 200
skinparam roundCorner 8
skinparam shadowing false
skinparam BoxPadding 15
skinparam ParticipantPadding 25

autonumber

actor "Traveler / Browser\\n(Client Application)" as B
participant "Fastify 5 BFF API\\n(Session Boundary)" as API
database "PostgreSQL Database\\n(app_security schema)" as DB
participant "Directus 12.1.1\\n(Identity Authority)" as DIR
actor "Directus Studio / Admin\\n(Security Operations)" as ADM

== Phase 1: Authentication & Opaque Session Family Issuance ==

B -> API: POST /api/v1/auth/login {email, password}
API -> DIR: Authenticate credentials via Argon2id
DIR --> API: Directus JWT Access Token + Refresh Token

API -> API: Assert traveler role (RBAC) & acquire pg_advisory_xact_lock
API -> API: Generate session_family_id (UUIDv4) & opaque handle (32-byte CSPRNG)
API -> API: AES-256-GCM encrypt tokens (random 12-byte IV, 16-byte Auth Tag)
API -> DB: INSERT into app_security.sessions\\n(session_id_hash, family_id, ciphertexts, iv, tag, expires_at)
API -> DB: INSERT audit_events (auth.login, success, actor_id, family_id)

API --> B: 200 OK + Set-Cookie: __Host-vnwa_session=<handle>\\n(HttpOnly; Secure; SameSite=Strict; Path=/)
note over B
  <b>Browser Isolation:</b> Client only holds opaque cookie.
  Directus JWTs never enter browser runtime (XSS immune).
end note

== Phase 2: Authorized API Request & Silent Sliding Rotation ==

B -> API: GET /api/v1/weather/current (with __Host-vnwa_session cookie)
API -> DB: SELECT active session by SHA-256(handle)\\nWHERE revoked_at IS NULL AND expires_at > now()
DB --> API: Returns encrypted tokens, IV, tag, access_token_expires_at

alt Access Token Nearing Expiration (Silent Refresh & Rotation)
    API -> API: Decrypt Directus Refresh Token via AES-256-GCM
    API -> DIR: POST /auth/refresh with decrypted Refresh Token
    DIR --> API: Issues new Directus Access Token + Refresh Token
    API -> API: Generate nextHandle (CSPRNG) & re-encrypt tokens with fresh IV
    API -> DB: UPDATE sessions SET session_id_hash = hash(nextHandle),\\nrotated_from_hash = currentHash, rotation_counter = counter + 1
    API --> B: Updated Set-Cookie: __Host-vnwa_session=<nextHandle>
end

API -> API: Decrypt Directus Access Token & verify GCM Auth Tag
API -> DIR: Forward authorized request with Bearer <Directus JWT>
DIR --> API: Return authorized data payload
API --> B: 200 OK (Clean sanitized DTO)

== Phase 3: Synchronized Session Family Revocation ==

alt Scenario A: Event-Driven Revocation (Password Change / Account Suspended)
    ADM -> DIR: Admin suspends account OR user updates password / MFA
    DIR -> DB: UPDATE public.directus_users SET status='suspended' / password=...
    DB -> DB: Trigger revoke_sessions_on_identity_change() fires automatically:\\nUPDATE app_security.sessions SET revoked_at=now(), revoke_reason=...\\nWHERE user_id=affected_user_id AND revoked_at IS NULL
else Scenario B: Token Reuse / Hijacking Anomaly Detected
    B -> API: Replay of old rotated handle OR identity revalidation fails
    API -> DB: revokeFamily(session_family_id): Annihilate entire session family tree
    API -> DB: INSERT audit_events (auth.session_revalidation, denied)
end

B -> API: Subsequent client request with revoked session handle
API -> DB: SELECT active session by SHA-256(handle) -> revoked_at IS NOT NULL
API --> B: 401 Unauthorized (Set-Cookie: __Host-vnwa_session=; Max-Age=0)
note over B
  Session instantly terminated across all devices.
  Old tokens and stale cookies completely evicted.
end note

@enduml"""

encoded = plantuml_encode(puml)
url = f"http://www.plantuml.com/plantuml/png/{encoded}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
target_path = 'C:/Users/dangh/.gemini/antigravity/brain/5e77d8eb-76ce-4872-9290-ab447839f43e/scratch/test_seq_auth.png'
with urllib.request.urlopen(req) as resp, open(target_path, 'wb') as f:
    f.write(resp.read())

im = Image.open(target_path)
print("Rendered image size:", im.size)
