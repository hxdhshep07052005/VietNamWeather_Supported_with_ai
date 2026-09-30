-- Apply after 013 with psql -v api_role=<API_DB_USER>.
-- Extend column-level read access for the measurements used by report queries.
BEGIN;
GRANT SELECT (uv_index, cloud_cover_percent, fetched_at)
  ON public.weather_observations TO :"api_role";
GRANT SELECT (humidity_percent, feels_like_celsius, pressure_hpa,
  visibility_meters, uv_index, cloud_cover_percent,
  precipitation_probability_percent, fetched_at)
  ON public.weather_forecasts TO :"api_role";
COMMIT;
