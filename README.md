# Vietnam Weather AI

Vietnam Weather AI is a weather-aware travel assistant designed to help people make safer and better-informed travel decisions in Vietnam. The platform combines real-time weather data, forecasts, risk analysis, and route evaluation in one web application.

## Main Features

- Real-time weather information and 72-hour forecasts
- Interactive map for exploring weather conditions across Vietnam
- Weather risk analysis based on wind, rain, temperature, visibility, and storm data
- Route planning for cars and motorcycles
- Fastest, shortest, and weather-safer route recommendations
- ETA-based route risk and weather coverage analysis
- AI chatbot for weather and travel questions, grounded in platform data
- Vietnamese and English user interface
- User accounts, saved locations, saved routes, and usage quotas

## Technology Stack

- **Frontend:** React, TypeScript, Vite, Zustand, React Query
- **Backend:** Node.js, Fastify
- **Data:** PostgreSQL, PostGIS, Redis
- **Administration:** Directus
- **Infrastructure:** Docker Compose
- **External services:** WeatherAPI, Geoapify, OpenStreetMap, Gemini-compatible AI services

## Architecture

The project is organized as a pnpm monorepo with separate frontend, API, weather worker, and shared contract packages. Weather providers are processed by the background worker, stored in PostgreSQL/PostGIS, and exposed to the web application through a typed application API. The AI assistant uses the same weather, risk, and route services to provide grounded recommendations.

## Project Goal

The goal of Vietnam Weather AI is to turn weather data into practical travel guidance, helping users choose suitable destinations, departure times, and routes based on current and forecast conditions.
