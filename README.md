# Vietnam Weather AI

Vietnam Weather AI is a weather-aware travel assistant for Vietnam. It combines live weather data, forecasts, risk analysis, and route evaluation to help travelers make better decisions before and during a trip.

## Features

- Current weather and 72-hour forecasts with provider attribution and freshness states
- Interactive Vietnam map with province-level weather and risk information
- Weather-aware route planning for cars and motorcycles
- Fastest, shortest, and weather-safer route alternatives
- ETA-based route risk scoring, weather coverage, and route refresh status
- AI travel assistant grounded in weather, forecast, risk, and route data
- Vietnamese and English interface
- User authentication, quotas, saved locations, saved routes, and subscription support
- Durable weather ingestion with retries, caching, circuit breaking, and background workers

## Architecture

The project is a pnpm monorepo with separate application and shared packages:

```text
apps/web         React + Vite frontend
apps/api         Fastify application API
apps/worker      Weather ingestion and background jobs
apps/directus    Directus extensions, schema, and seeds
packages/config  Shared environment configuration
packages/contracts Shared TypeScript API contracts and OpenAPI definitions
infra/           Docker Compose, PostgreSQL/PostGIS, Redis, and Nginx setup
```

The main data flow is:

```text
Weather providers -> Worker -> PostgreSQL/PostGIS -> API -> Web application
                                               \\-> AI grounding tools
```

## Technology Stack

- TypeScript, React, Vite, Zustand, React Query
- Fastify and Node.js
- PostgreSQL with PostGIS
- Redis for caching, rate limits, and coordination
- Directus for administration and content management
- Docker Compose
- WeatherAPI, Geoapify, OpenStreetMap/Overpass, and Gemini-compatible AI services

## Getting Started

### Requirements

- Node.js 24.x
- pnpm 11.x
- Docker Desktop with Compose

### Install dependencies

```bash
pnpm install
```

### Configure the environment

Copy the appropriate example environment file and provide local credentials:

```powershell
Copy-Item .env.example .env.local
```

Do not commit `.env.local` or provider credentials.

### Start the local stack

```bash
docker compose --env-file .env.local up -d --build
```

The web application, API, worker, Directus, PostgreSQL, Redis, and Mailpit services are configured by `compose.yaml`.

## Development Commands

```bash
pnpm --filter @vietnam-weather/web dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

The web application runs on port `3000` by default. The API and worker ports are configured through the environment file.

## Validation

The repository includes unit, integration, contract, security, and frontend tests:

```bash
pnpm test
```

Phase-specific validators are available under `tools/validation/`, including checks for the API, weather worker, data model, route planner, and frontend.

## Project Status

The core weather, risk, forecast, route-planning, monetization, AI, and frontend capabilities are implemented. Production deployment still requires environment-specific provider credentials, infrastructure configuration, and operational verification.

## License

This project is intended for educational and portfolio use. Review the provider terms and project policies before using it in production.
