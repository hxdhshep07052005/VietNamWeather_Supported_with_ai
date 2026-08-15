# Phase 9 Evidence — Frontend Web Application

**Status:** IN_PROGRESS
**Kickoff approval:** `FRONT-001..008`
**Decision baseline:** `FRONT-001`, `FRONT-002`, `FRONT-003`, `FRONT-004`, `FRONT-005`, `FRONT-006`, `FRONT-007`, `FRONT-008`

## Artifacts

| Evidence | Status | Artifact |
|---|---|---|
| Phase 9 Decisions | ✅ DONE | `PHASE_9_DECISIONS.md` |
| Decision Register | ✅ DONE | `DECISIONS.md` (FRONT-001..008) |
| Status Update | ✅ DONE | `STATUS.md` |
| README Update | ✅ DONE | `README.md` |
| Frontend Project | PENDING | `apps/web/` |
| Design System | PENDING | `apps/web/src/styles/` |
| API Client | PENDING | `apps/web/src/api/` |
| Landing Page | PENDING | `apps/web/src/pages/Landing.tsx` |
| Auth Pages | PENDING | `apps/web/src/features/auth/` |
| Map Integration | PENDING | `apps/web/src/features/map/` |
| Forecast Charts | PENDING | `apps/web/src/features/weather/` |
| Route Planner UI | PENDING | `apps/web/src/features/route/` |
| Tests | PENDING | `apps/web/test/` |
| Validation Script | PENDING | `tools/validation/validate-stage9.ps1` |

## Decision Gate Compliance

| Decision | Value | Evidence |
|---|---|---|
| `FRONT-001.1` | React + Vite | Per Vietnam market |
| `FRONT-001.2` | TypeScript strict | MVP scope |
| `FRONT-001.3` | Zustand state | MVP scope |
| `FRONT-002.1` | Minimal design | Clean, professional |
| `FRONT-002.2` | Primary #0066CC | Vietnamese blue |
| `FRONT-002.3` | WCAG 2.1 AA | Accessibility |
| `FRONT-003.1` | Value + Pricing | Landing priority |
| `FRONT-003.2` | No map preview | Requires auth |
| `FRONT-004.1` | Hourly default | Per DATA-004 |
| `FRONT-004.2` | Day 4-7 = outlook | Per ARCH-013 |
| `FRONT-005.1` | No PWA MVP | Defer Phase 12 |
| `FRONT-006.1` | Stripe Hosted | PCI compliant |
| `FRONT-007.1` | Minimal + Consent | Privacy-first |
| `FRONT-008.1` | Modern browsers | Chrome 120+, etc |

## Implementation Plan

### Phase 9.1 — Project Setup
- [ ] Initialize React + Vite project
- [ ] Configure TypeScript (strict mode)
- [ ] Setup CSS Modules + CSS Variables
- [ ] Configure ESLint + Prettier
- [ ] Setup path aliases

### Phase 9.2 — Design System
- [ ] Create CSS variables (colors, spacing, typography)
- [ ] Create base UI components (Button, Input, Card)
- [ ] Create layout components (Header, Footer, Container)
- [ ] Create responsive utilities

### Phase 9.3 — API Client
- [ ] Create typed API client
- [ ] Add auth token handling
- [ ] Add error handling
- [ ] Add request cancellation

### Phase 9.4 — Landing Page
- [ ] Hero section with value proposition
- [ ] Feature highlights
- [ ] Pricing comparison
- [ ] CTA buttons

### Phase 9.5 — Auth Pages
- [ ] Login page
- [ ] Register page
- [ ] Forgot password page
- [ ] Route guards

### Phase 9.6 — Map Integration
- [ ] MapLibre setup
- [ ] Location markers
- [ ] Risk visualization
- [ ] Cluster view

### Phase 9.7 — Forecast Charts
- [ ] Hourly chart
- [ ] Daily chart
- [ ] Timeline slider
- [ ] Attribution display

### Phase 9.8 — Route Planner UI
- [ ] Route input form
- [ ] Alternative cards
- [ ] Risk display
- [ ] GPS tracking

## Page Routes

```
Public (anonymous):
├── /                     → Landing page
├── /login               → Login form
├── /register            → Registration form
├── /forgot-password     → Password reset
└── /legal/*             → Legal pages

Protected (authenticated):
├── /map                 → Main weather map
├── /location/:id        → Location detail
├── /route               → Route planner
├── /settings            → User settings
└── /upgrade             → Subscription management
```

## Component Architecture

```
src/
├── components/
│   ├── ui/              # Button, Input, Card, Badge, etc.
│   ├── layout/          # Header, Footer, Container, Sidebar
│   └── feedback/        # Loading, Error, Empty states
├── features/
│   ├── auth/            # LoginForm, RegisterForm, etc.
│   ├── weather/         # ForecastChart, Timeline, etc.
│   ├── map/            # MapContainer, Marker, Cluster
│   ├── risk/           # RiskBadge, RiskLegend
│   └── route/           # RouteForm, RouteCard, GPSTracker
├── hooks/               # useAuth, useWeather, useRoute, etc.
├── api/                 # Typed API client
├── i18n/                # Vietnamese/English translations
├── styles/              # Design tokens, global CSS
└── pages/               # Route page components
```

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

## Test Coverage Targets

| Test Category | Min Cases | Status |
|---|---|---|
| Component tests | 20 | PENDING |
| Page tests | 10 | PENDING |
| Hook tests | 15 | PENDING |
| E2E tests | 5 | PENDING |
| Accessibility tests | 10 | PENDING |

## Browser/Device Support

| Browser | Version | Status |
|---|---|---|
| Chrome | 120+ | Required |
| Firefox | 121+ | Required |
| Safari | 17+ | Required |
| Edge | 120+ | Required |
| iOS Safari | 17+ | Required |
| Chrome Android | 120+ | Required |
