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

# Let's test a concise, wide, professional sequence diagram with large fonts and high information density
puml = """@startuml
skinparam dpi 100
skinparam defaultFontName "Segoe UI, Arial, sans-serif"

skinparam defaultFontSize 22
skinparam sequenceGroupFontSize 22
skinparam sequenceReferenceFontSize 20
skinparam dividerFontSize 22
skinparam arrowFontSize 20
skinparam noteFontSize 19
skinparam participantFontSize 22
skinparam actorFontSize 22

skinparam maxMessageSize 340
skinparam wrapWidth 340
skinparam roundCorner 8
skinparam shadowing false
skinparam BoxPadding 20
skinparam ParticipantPadding 40

skinparam sequenceLifeLineBorderColor #2C3E50
skinparam sequenceGroupBorderColor #2980B9
skinparam sequenceGroupHeaderFontStyle bold

autonumber

actor "Traveler / Browser\\n[Client Application]" as B
participant "Fastify 5 BFF API\\n[Session Boundary (ADR-004)]" as API
database "PostgreSQL Database\\n[app_security schema]" as DB
participant "Directus 12.1.1\\n[Identity Authority]" as DIR
actor "Directus Studio / Admin\\n[Security Operations]" as ADM

== 1. Authentication & Opaque Session Family Issuance ==

B -> API: POST /api/v1/auth/login {email, password}
API -> DIR: Authenticate credentials (Argon2id password verification)
DIR --> API: Directus Token Bundle (JWT Access Token + Refresh Token)

API -> API: Assert traveler role (RBAC) & acquire pg_advisory_xact_lock(user_id)
API -> API: Generate session_family_id (UUIDv4) & opaque handle (32-byte CSPRNG)
API -> API: AES-256-GCM encrypt JWTs (random 12-byte IV, 16-byte Auth Tag)
API -> DB: INSERT into app_security.sessions\\n(session_id_hash, session_family_id, encrypted_tokens, iv, tag, expires_at)
API -> DB: INSERT into app_security.audit_events (auth.login, success, user_id, family_id)

API --> B: 200 OK + Set-Cookie: __Host-vnwa_session=<handle>\\n(HttpOnly; Secure; SameSite=Strict; Path=/)
note over B, API
  <b>ADR-004 Isolation:</b> Browser never touches Directus JWTs (XSS immunity).
  Database only stores SHA-256(handle) and AES-256-GCM ciphertexts.
end note

== 2. Authorized API Request & Silent Sliding Rotation ==

B -> API: GET /api/v1/weather/current (with __Host-vnwa_session cookie)
API -> DB: SELECT active session by SHA-256(handle) WHERE revoked_at IS NULL
DB --> API: Return session record (ciphertexts, IV, tag, access_token_expires_at)

opt Access Token Nearing Expiration (Silent Refresh & Rotation)
    API -> API: Decrypt Directus Refresh Token via AES-256-GCM
    API -> DIR: POST /auth/refresh (silent upstream token renewal)
    DIR --> API: Return fresh Directus Access Token + Refresh Token
    API -> API: Generate nextHandle & re-encrypt tokens with fresh IV
    API -> DB: UPDATE sessions SET session_id_hash = hash(nextHandle),\\nrotated_from_hash = currentHash, rotation_counter = counter + 1
    API --> B: Updated Set-Cookie: __Host-vnwa_session=<nextHandle>
end

API -> API: Decrypt Directus Access Token & verify GCM Auth Tag
API -> DIR: Forward authorized request with Bearer <Directus JWT>
DIR --> API: Return authorized data payload
API --> B: 200 OK (Sanitized DTO response)

== 3. Synchronized Session Family Revocation ==

alt Event-Driven Revocation (Admin Suspension, Password Change, MFA Update)
    ADM -> DIR: Admin updates user status='suspended' OR user modifies password/MFA
    DIR -> DB: UPDATE public.directus_users SET status='suspended' / password=...
    DB -> DB: Trigger revoke_sessions_on_identity_change() executes atomically:\\nUPDATE app_security.sessions SET revoked_at=now(), revoke_reason=...\\nWHERE user_id=affected_user_id AND revoked_at IS NULL
else Anomaly Detection (Token Reuse / Hijack Attempt)
    B -> API: Replay of old rotated handle OR revalidation mismatch
    API -> DB: revokeFamily(session_family_id): Instantly invalidate all family sessions
    API -> DB: INSERT into app_security.audit_events (auth.session_revalidation, denied)
end

B -> API: Subsequent request with revoked cookie
API -> DB: Query session: revoked_at IS NOT NULL
API --> B: 401 Unauthorized (Set-Cookie: __Host-vnwa_session=; Max-Age=0)

@enduml"""

encoded = plantuml_encode(puml)
url = f"http://www.plantuml.com/plantuml/png/{encoded}"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
target_path = 'C:/Users/dangh/.gemini/antigravity/brain/5e77d8eb-76ce-4872-9290-ab447839f43e/scratch/test_seq_auth_v2.png'
with urllib.request.urlopen(req) as resp, open(target_path, 'wb') as f:
    f.write(resp.read())

im = Image.open(target_path)
print("Rendered image size:", im.size)
