# Data Flow and Trust Boundaries

## 1. Trust boundaries

```mermaid
flowchart TB
    subgraph BROWSER["Untrusted Browser Boundary"]
        UI["Next.js/PWA UI"]
    end

    subgraph PUBLIC["Public Network Boundary"]
        PROXY["TLS Reverse Proxy"]
        WEBHOOK["Webhook/IPN Endpoint"]
    end

    subgraph APP["Application Trust Boundary"]
        API["Application API"]
        DIRECTUS["Directus"]
        WORKER["Worker"]
        REDIS["Redis"]
    end

    subgraph DATA["Restricted Data Boundary"]
        DB["PostgreSQL + PostGIS"]
        BACKUP["Encrypted Backup"]
    end

    subgraph THIRD["Third-Party Boundary"]
        WEATHER["Weather"]
        GEOAPIFY["Geoapify Tiles/Geocode/Route"]
        PAYMENT["Stripe/VNPay"]
    end

    UI --> PROXY --> API
    UI -->|"Tile/style only; browser key"| GEOAPIFY
    PAYMENT --> WEBHOOK --> API
    API --> DIRECTUS
    DIRECTUS --> DB
    API --> REDIS --> WORKER
    WORKER --> DB
    DB --> BACKUP
    WORKER --> WEATHER
    WORKER --> GEOAPIFY
    WORKER --> PAYMENT
```

Browser, public network and all third-party responses are untrusted. Authentication, authorization and validation are repeated at the Application API/tool boundary even when Directus policies also apply. Direct Geoapify browser traffic is limited to tile/style resources; geocoding and routing remain behind the Application API.

## 2. Login/session flow

```mermaid
sequenceDiagram
    participant U as "User Browser"
    participant A as "Application API"
    participant D as "Directus Auth"
    participant S as "Server Session Store"

    U->>A: "POST /api/v1/auth/login"
    A->>A: "Validate origin, schema and rate limit"
    A->>D: "Authenticate"
    D-->>A: "Identity + access/refresh metadata"
    A->>S: "Create encrypted server session"
    A-->>U: "Opaque Secure HttpOnly cookie"
    U->>A: "Authenticated request"
    A->>S: "Resolve session"
    A->>D: "Policy/user-state check as required"
    A-->>U: "Public DTO"
```

Sensitive values: credentials in transit, Directus tokens and server session material. Controls: TLS, rate limits, no credential logging, encrypted server-side token storage, cookie flags, CSRF/origin validation and session-family revoke.

## 3. Location weather flow

```mermaid
sequenceDiagram
    participant U as "User"
    participant A as "Application API"
    participant C as "Redis Cache"
    participant W as "Worker/Weather Adapter"
    participant P as "Weather Provider"
    participant D as "Database"

    U->>A: "Search/select coordinate"
    A->>A: "Auth + quota + coordinate validation"
    A->>C: "Read normalized cache"
    alt "Fresh cache"
        C-->>A: "Normalized weather"
    else "Miss/stale"
        A->>W: "Durable refresh request/reference"
        W->>P: "Provider request"
        P-->>W: "Untrusted provider payload"
        W->>W: "Schema/unit/time validation"
        W->>D: "Normalized result + provenance"
        W->>C: "Cache result"
        W-->>A: "Result/reference"
    end
    A-->>U: "DTO with source/freshness"
```

Precise GPS is transient unless the user explicitly saves a place/route. Generic logs avoid raw coordinates.

## 4. Route evaluation flow

```mermaid
sequenceDiagram
    participant U as "User"
    participant A as "Application API"
    participant Q as "Queue"
    participant W as "Route Worker"
    participant R as "Routing Provider"
    participant P as "Weather Provider"
    participant D as "PostgreSQL/PostGIS"

    U->>A: "Create route evaluation"
    A->>A: "Auth + entitlement + quota + idempotency"
    A->>A: "Validate departure/ETA against published horizon"
    A->>D: "Create pending request/outbox"
    A->>Q: "Enqueue request ID"
    A-->>U: "202/pending or bounded synchronous response"
    Q->>W: "Consume"
    W->>R: "Request alternatives"
    R-->>W: "Route geometry/metadata"
    W->>W: "Validate + sample + calculate ETA"
    W->>P: "Weather at segment ETA"
    P-->>W: "Forecast data"
    W->>W: "Apply versioned risk rules"
    W->>D: "Store alternatives, evidence and result"
    U->>A: "Poll/subscribe for result"
    A-->>U: "Provider-neutral route DTO"
```

Quota is consumed exactly once according to the approved policy even when the client retries. Route geometry is never invented when the provider returns no route.

Theo `DATA-004`, ETA tối đa 72 giờ mới được chạy route/risk scoring. Ngày 4–7 chỉ trả outlook; vượt horizon hoặc thiếu forecast coverage trả trạng thái rõ ràng và không tạo score giả.

## 5. Payment flow

1. User asks backend for available payment methods.
2. Backend validates market, currency, plan interval, provider status and merchant capability.
3. Backend creates checkout/order with an idempotency key.
4. User completes provider-hosted/tokenized flow.
5. Return URL only displays pending/result information.
6. Signed webhook/IPN creates a durable event.
7. Worker applies subscription transition and entitlement projection.
8. Reconciliation resolves delayed, missing or out-of-order events.

No browser-provided `success=true`, plan ID, price or provider status is trusted.

## 6. Admin publish flow

```mermaid
sequenceDiagram
    participant O as "Admin/Operations"
    participant V as "VPN/IP Boundary"
    participant S as "Directus Studio"
    participant D as "Directus/PostgreSQL"
    participant A as "Audit/Cache Invalidation"

    O->>V: "Authenticate network access"
    V->>S: "Open Admin Studio"
    S->>D: "Role/policy checked draft change"
    D->>D: "Review/publish/version transition"
    D->>A: "Audit actor + invalidate config cache"
```

Risk rules, pricing and legal/advisory content require versioned publish evidence. Admin UI availability does not bypass API authorization.

## 7. Optional AI flow boundary

AI is not on the core critical path. If enabled later, the model receives a bounded prompt plus sanitized data returned by allowlisted backend tools. Each tool independently checks user, role, ownership, entitlement and field allowlist. Model output never directly executes database or payment mutations.
