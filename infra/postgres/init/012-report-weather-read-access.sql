-- Apply after the Directus weather schema exists, not during empty DB init.
-- psql: -v api_role=<API_DB_USER>. No write or raw payload access.
BEGIN;
GRANT SELECT ON public.spatial_ref_sys TO :"api_role";
GRANT SELECT (
  humidity_percent, wind_speed_mps, feels_like_celsius, pressure_hpa, precipitation_mm,
  temperature_celsius, wind_gust_mps, visibility_meters,
  condition_code, provider_id, observed_at, expires_at, status, coordinates
) ON public.weather_observations TO :"api_role";
GRANT SELECT (
  temperature_celsius, wind_gust_mps, precipitation_mm,
  condition_code, provider_id, provider_issued_at, expires_at, status,
  valid_from, valid_to, horizon_kind, coordinates
  , wind_speed_mps
) ON public.weather_forecasts TO :"api_role";
COMMIT;
