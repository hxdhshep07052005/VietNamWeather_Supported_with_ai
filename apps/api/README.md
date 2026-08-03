# Application API

This service is the browser-facing `/api/v1` boundary. It owns opaque application sessions, CSRF/origin enforcement, security headers, rate limits and sanitized API errors.

Directus remains the identity and policy authority. Directus access and refresh tokens are encrypted server-side and are never returned to the browser or written to logs.
