// Test adapter URL construction
const WEATHERAPI_ALLOWED_ORIGIN = "https://api.weatherapi.com";
const WEATHERAPI_FORECAST_PATH = "/v1/forecast.json";
const WEATHERAPI_FORECAST_ENDPOINT = `${WEATHERAPI_ALLOWED_ORIGIN}${WEATHERAPI_FORECAST_PATH}`;

console.log('Forecast endpoint:', WEATHERAPI_FORECAST_ENDPOINT);

// Build request URL like adapter does
const apiKey = '3d35ccc68e3d41018a183238251610';
const latitude = 21.028;
const longitude = 105.854;
const forecastDays = 1;

const requestUrl = new URL(WEATHERAPI_FORECAST_ENDPOINT);
requestUrl.searchParams.set("key", apiKey);
requestUrl.searchParams.set("q", `${latitude},${longitude}`);
requestUrl.searchParams.set("days", String(forecastDays));
requestUrl.searchParams.set("aqi", "no");
requestUrl.searchParams.set("alerts", "no");

console.log('Request URL:', requestUrl.toString());

// Fetch and check response
fetch(requestUrl.toString())
  .then(r => r.json())
  .then(data => {
    console.log('Has forecast:', 'forecast' in data);
    console.log('Has current:', 'current' in data);
    if ('forecast' in data) {
      console.log('Forecast days:', data.forecast.forecastday?.length);
    }
  })
  .catch(e => console.error('Fetch error:', e));
