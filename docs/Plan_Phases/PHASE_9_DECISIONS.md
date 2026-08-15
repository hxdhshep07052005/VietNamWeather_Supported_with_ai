# Phase 9 Decision Gate — Frontend Web Application

**Date:** 2026-08-14
**Status:** APPROVED
**Approved by:** Technical Owner
**Decision IDs:** `FRONT-001` through `FRONT-008`

## Decision Gate Summary

Phase 9 implements the frontend web application with React + Vite. This document records all product decisions required before implementation.

---

## FRONT-001 — Frontend Framework

**Ruling:** **React + Vite** for the frontend application.

**Rationale:**
- React has mature ecosystem and excellent TypeScript support
- Vite provides fast development experience
- Existing team familiarity assumed
- Good compatibility with MapLibre GL JS
- Easy integration with existing contracts package

**Tech Stack:**
| Layer | Technology |
|-------|------------|
| Framework | React 18+ |
| Build Tool | Vite 5+ |
| Language | TypeScript (strict mode) |
| Routing | React Router 6 |
| State | Zustand (lightweight, simple) |
| Styling | CSS Modules + CSS Variables |

**Not selected:**
- Next.js: SSR complexity not needed for MVP
- Svelte/SvelteKit: Smaller ecosystem
- Tailwind: MVP scope (CSS Modules sufficient)

---

## FRONT-002 — Visual Direction & Brand

**Ruling:** **Minimal with Vietnamese color accents**

**Visual Direction:**
- Clean, professional appearance
- Focus on data visualization and readability
- Mobile-first responsive design
- Vietnamese cultural sensitivity in imagery

**Color Palette:**
| Role | Color | Usage |
|------|-------|-------|
| Primary | `#0066CC` (Vietnamese blue) | CTAs, links, headers |
| Secondary | `#FFCD00` (Vietnamese yellow) | Accents, highlights |
| Success | `#22C55E` | Low risk, positive states |
| Warning | `#EAB308` | Caution, medium risk |
| Danger | `#F97316` | High risk, errors |
| Background | `#FFFFFF` / `#F8FAFC` | Light mode |
| Text | `#1E293B` / `#64748B` | Primary/secondary text |

**Typography:**
| Element | Font | Size |
|---------|------|------|
| Headings | Inter | 24-32px |
| Body | Inter | 14-16px |
| Mono | JetBrains Mono | Code/data |

**Accessibility Targets:**
- WCAG 2.1 AA compliance
- Color contrast ratio 4.5:1 minimum
- Focus indicators visible
- Reduced motion support

---

## FRONT-003 — Landing Page Priority

**Ruling:** **Value proposition + Pricing** as primary focus

**Landing Page Structure:**
1. Hero section with value proposition
2. Feature highlights (Weather, Risk, Routes)
3. Pricing comparison (Free vs Pro)
4. Call-to-action (Sign up/Login)
5. Footer with legal links

**No interactive map preview:**
- Map requires authentication (per Phase 9 spec)
- Anonymous users see static screenshots/mockups
- Demo prompt to create account

**Map Stack:**
- MapLibre GL JS for mapping
- Geoapify tiles with attribution
- Browser key for tiles only (per `ARCH-012`)

---

## FRONT-004 — Timeline Default

**Ruling:** **Hourly default, Daily toggle** (per forecast contract)

**Implementation:**
- Default view: Hourly forecast (up to 72 hours)
- Toggle to: Daily forecast (3 days)
- Timeline slider for forecast hours
- Play/pause animation for forecast

**Per `DATA-004` and `ARCH-013`:**
| Period | Data | Display |
|--------|------|---------|
| Hour 1-72 | Hourly forecast | Primary display |
| Day 1-3 | Daily forecast | Toggle view |
| Day 4-7 | Outlook only | Warning label |

**UI Requirements:**
- Always show current viewing timestamp
- "Forecast at [time]" not "Current weather"
- Day 4-7 marked as "outlook" not "forecast"

---

## FRONT-005 — PWA/Offline Support

**Ruling:** **No PWA/offline for MVP** (defer to Phase 12)

**MVP Scope:**
- Standard SPA (no service worker)
- No offline shell
- No push notifications
- No background sync

**Rationale:**
- MVP focuses on core functionality
- Weather data is time-sensitive (offline less valuable)
- Reduces complexity and testing surface
- Can add in Phase 12 if user demand exists

**Future (Phase 12):**
- App shell architecture
- Offline forecast caching (stale OK)
- Push for severe weather alerts

---

## FRONT-006 — Checkout Flow

**Ruling:** **Stripe Hosted Checkout** (redirect to Stripe)

**Flow:**
```
User clicks "Upgrade" 
  → Backend creates Stripe Checkout Session
  → Redirect to Stripe hosted page
  → Stripe handles payment
  → Webhook updates subscription
  → Redirect back to app with success/cancel
```

**Benefits:**
- PCI compliant out of box
- No card data touches our servers
- Simple implementation
- Supports cards, wallets, local payment methods

**Not selected (for now):**
- In-app checkout: Higher PCI scope
- VNPay: Add complexity, can integrate later

**Phase 10 will define:**
- Price points (Free tier, Pro tier)
- Payment currency (VND vs USD)
- Local payment methods

---

## FRONT-007 — Analytics

**Ruling:** **Minimal + Consent** (privacy-first)

**Allowed Analytics:**
| Type | Purpose | Data |
|------|---------|------|
| Page views | Usage stats | Page path only |
| Error tracking | Debugging | Error messages, stack traces |
| Performance | Core Web Vitals | Timing metrics |

**Prohibited:**
- Precise location tracking
- User profiling
- Cross-site tracking
- Selling data to third parties

**Consent UX:**
- Cookie banner on first visit
- "Accept all" / "Manage preferences" options
- Preferences persisted in local storage
- No analytics until consent given

**Tools:**
- Vercel Analytics (built into deployment)
- Sentry for error tracking (optional)
- No Google Analytics (privacy concern)

---

## FRONT-008 — Browser Support

**Ruling:** **Modern browsers only** (last 2 versions)

**Supported Browsers:**
| Browser | Minimum Version |
|---------|---------------|
| Chrome | 120+ |
| Firefox | 121+ |
| Safari | 17+ |
| Edge | 120+ |

**Mobile:**
| Device | Minimum OS |
|--------|----------|
| iOS Safari | 17+ |
| Chrome Android | 120+ |

**Not supported:**
- Internet Explorer (deprecated)
- Older mobile browsers
- Incompatible WebGL (for MapLibre)

**Fallback:**
- Graceful degradation for older browsers
- Clear "unsupported browser" message
- Static content remains accessible

---

## Implementation Constraints

### Must include in every page:
- Vietnamese/English language toggle
- Responsive design (mobile-first)
- Error boundary for React errors
- Loading skeletons for async data
- Attribution and source display per contract

### Must NOT include:
- Hardcoded location/risk/attribution data
- Direct backend imports (services, SDKs)
- Client-side risk/entitlement calculation
- Mock data in production build
- Debug console.log statements

### Security requirements:
- CSP headers configured
- No inline scripts (except minimal CSP allowlist)
- API keys never in frontend bundle
- HTTPS enforced in production

---

## Page Structure

```
Public (anonymous):
├── / (Landing page)
├── /login
├── /register
├── /forgot-password
├── /legal/terms
└── /legal/privacy

Protected (authenticated):
├── /map (Main weather map)
├── /location/:id (Location detail)
├── /route (Route planner)
├── /settings (User settings)
└── /upgrade (Subscription management)

Admin (via Directus Studio):
└── /admin (Directus Studio)
```

---

## Component Architecture

```
src/
├── components/
│   ├── ui/           # Button, Input, Card, etc.
│   ├── layout/       # Header, Footer, Sidebar
│   └── map/          # MapContainer, Marker, Cluster
├── features/
│   ├── auth/         # Login, Register forms
│   ├── weather/      # Forecast, Charts, Timeline
│   ├── risk/         # RiskBadge, RiskLegend
│   └── route/        # RoutePlanner, RouteCard
├── hooks/            # Custom React hooks
├── api/              # Typed API client
├── i18n/             # Vietnamese/English translations
└── styles/           # Design tokens, global styles
```

---

## API Integration Pattern

```typescript
// Typed API client - no backend imports
import { weatherApi } from '@/api/client';
import type { ForecastRequest, ForecastSeries } from '@vietnam-weather/contracts';

// Usage
const forecast = await weatherApi.getForecast({ location_id: 'hanoi' });

// No risk calculation client-side
// No entitlement checks client-side
// Backend returns structured data
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-08-14 | Technical Owner | Initial decisions based on Phase 9 Decision Gate |
