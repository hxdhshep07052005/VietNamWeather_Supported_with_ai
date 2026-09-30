-- Match the geography cast used by the 15 km weather lookup.
-- Run outside a transaction; concurrent builds keep ingestion available.
CREATE INDEX CONCURRENTLY IF NOT EXISTS weather_forecasts_geography_gix
  ON public.weather_forecasts USING gist ((coordinates::geography));
CREATE INDEX CONCURRENTLY IF NOT EXISTS weather_observations_geography_gix
  ON public.weather_observations USING gist ((coordinates::geography));
ANALYZE public.weather_forecasts;
ANALYZE public.weather_observations;
