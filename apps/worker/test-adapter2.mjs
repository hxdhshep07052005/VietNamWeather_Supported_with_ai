// Detailed adapter test
import { WeatherApiAdapter } from './dist/weather/weatherapi.js';
import { normalizeWeatherApiResponse } from './dist/weather/normalize.js';

const adapter = new WeatherApiAdapter({
  apiKey: '3d35ccc68e3d41018a183238251610',
  timeoutMilliseconds: 5000
});

async function test() {
  const target = { latitude: 21.028, longitude: 105.854 };
  const forecastDays = 1;
  const fetchedAt = new Date();

  try {
    // Step 1: Build URL
    const requestUrl = new URL('https://api.weatherapi.com/v1/forecast.json');
    requestUrl.searchParams.set("key", '3d35ccc68e3d41018a183238251610');
    requestUrl.searchParams.set("q", `${target.latitude},${target.longitude}`);
    requestUrl.searchParams.set("days", String(forecastDays));
    requestUrl.searchParams.set("aqi", "no");
    requestUrl.searchParams.set("alerts", "no");
    console.log('URL:', requestUrl.toString());

    // Step 2: Fetch directly
    const response = await fetch(requestUrl.toString());
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response has forecast:', 'forecast' in data);

    // Step 3: Try adapter
    console.log('\nTrying adapter...');
    const adapterResult = await adapter.getWeather({
      target,
      forecastDays
    });
    console.log('✅ Adapter success!');
    console.log('Temp:', adapterResult.current?.temperatureCelsius);

  } catch (error) {
    console.error('❌ Failed:', error.code || error.constructor.name, error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

test();
