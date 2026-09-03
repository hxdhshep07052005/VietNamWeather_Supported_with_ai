// Debug which part of the response fails
import { WeatherApiAdapter } from './dist/weather/weatherapi.js';

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredRecord(record, key) {
  const value = record[key];
  if (!isRecord(value)) {
    throw new Error(`Missing or invalid record: ${key}`);
  }
  return value;
}

function requiredArray(record, key) {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`Missing or invalid array: ${key}`);
  }
  return value;
}

function requiredNumber(record, key, min, max) {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing or invalid number: ${key}`);
  }
  if (value < min || value > max) {
    throw new Error(`Number out of range: ${key} = ${value}`);
  }
  return value;
}

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
    console.log('✅ Full parse success!');
  } catch (error) {
    console.error('❌ Full parse failed');

    // Try step by step
    console.log('\nFetching raw response...');
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=3d35ccc68e3d41018a183238251610&q=21.028,105.854&days=1`
    );
    const data = await response.json();

    console.log('Checking response structure...');
    try {
      const location = requiredRecord(data, 'location');
      console.log('✓ location');
      requiredNumber(location, 'lat', -90, 90);
      console.log('✓ location.lat');
      requiredNumber(location, 'lon', -180, 180);
      console.log('✓ location.lon');

      const current = requiredRecord(data, 'current');
      console.log('✓ current');
      requiredNumber(current, 'last_updated_epoch', 946684800, 4102444800);
      console.log('✓ current.last_updated_epoch');
      requiredNumber(current, 'temp_c', -150, 100);
      console.log('✓ current.temp_c');

      const forecast = requiredRecord(data, 'forecast');
      console.log('✓ forecast');
      const days = requiredArray(forecast, 'forecastday');
      console.log('✓ forecast.forecastday (count:', days.length, ')');

      if (days.length > 0) {
        const day = days[0];
        const dayRecord = requiredRecord(day, 'day');
        console.log('✓ forecast.forecastday[0].day');
        requiredNumber(dayRecord, 'maxtemp_c', -150, 100);
        console.log('✓ day.maxtemp_c');

        const hours = requiredArray(day, 'hour');
        console.log('✓ forecast.forecastday[0].hour (count:', hours.length, ')');

        if (hours.length > 0) {
          const hour = hours[0];
          requiredNumber(hour, 'time_epoch', 946684800, 4102444800);
          console.log('✓ hour[0].time_epoch');
          requiredNumber(hour, 'temp_c', -150, 100);
          console.log('✓ hour[0].temp_c');
        }
      }

      console.log('\n✅ All checks passed!');
    } catch (e) {
      console.error('❌ Parse failed at:', e.message);
    }
  }
}

test();
