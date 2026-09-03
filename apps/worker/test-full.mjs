// Full integration test
import { WeatherApiAdapter } from './dist/weather/weatherapi.js';
import { normalizeWeatherApiResponse } from './dist/weather/normalize.js';

const adapter = new WeatherApiAdapter({
  apiKey: '3d35ccc68e3d41018a183238251610',
  timeoutMilliseconds: 5000
});

async function test() {
  try {
    console.log('Fetching weather...');
    const result = await adapter.getWeather({
      target: { latitude: 21.028, longitude: 105.854 },
      forecastDays: 1
    });
    console.log('✅ Success!');
    console.log('Source:', result.source);
    console.log('Current temp:', result.current?.temperatureCelsius);
    console.log('Hourly count:', result.hourly?.length);
    console.log('Daily count:', result.daily?.length);
  } catch (error) {
    console.error('❌ Error:', error.code, error.message);
    if (error.providerCode) {
      console.error('Provider code:', error.providerCode);
    }
  }
}

test();
