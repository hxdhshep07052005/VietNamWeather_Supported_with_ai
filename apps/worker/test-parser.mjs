// Test parser with real API response
const response = {
  "location": {
    "name": "Hanoi",
    "lat": 21.033,
    "lon": 105.85
  },
  "current": {
    "last_updated_epoch": 1788379200,
    "temp_c": 26.3,
    "feelslike_c": 28.2,
    "precip_mm": 0.0,
    "wind_kph": 5.0,
    "gust_kph": 5.4,
    "wind_degree": 331,
    "pressure_mb": 1004.0,
    "humidity": 69,
    "cloud": 5,
    "vis_km": 3.9,
    "uv": 0.0,
    "condition": {
      "code": 1036,
      "text": "Smoky haze"
    }
  },
  "forecast": {
    "forecastday": [
      {
        "date": "2026-09-03",
        "date_epoch": 1788393600,
        "day": {
          "maxtemp_c": 34.4,
          "mintemp_c": 25.0,
          "avgtemp_c": 29.6,
          "totalprecip_mm": 0.0,
          "maxwind_kph": 12.2,
          "avghumidity": 60,
          "daily_chance_of_rain": 3,
          "condition": {
            "code": 1036
          }
        },
        "hour": [
          {
            "time_epoch": 1788368400,
            "temp_c": 27.4,
            "feelslike_c": 29.2,
            "humidity": 66,
            "wind_kph": 5.0,
            "gust_kph": 3.4,
            "wind_degree": 233,
            "precip_mm": 0.0,
            "pressure_mb": 1006.0,
            "vis_km": 10.0,
            "uv": 0,
            "cloud": 3,
            "condition": {
              "code": 1000
            },
            "chance_of_rain": 5,
            "chance_of_snow": 0
          }
        ]
      }
    ]
  }
};

// Simulate the condition code lookup
const WEATHERAPI_CONDITION_CODES = {
  1000: "clear",
  1003: "partly_cloudy",
  1006: "cloudy",
  1009: "cloudy",
  1030: "fog",
  1036: "fog",      // Smoky haze
  1039: "fog",      // Smog
  1042: "fog",      // Severe smog
  1063: "rain",
  1183: "rain",
  1192: "heavy_rain",
  1237: "hail",
  1273: "thunderstorm"
};

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

function conditionCode(record) {
  const condition = requiredRecord(record, "condition");
  const code = requiredNumber(condition, "code", 1000, 9999);
  return WEATHERAPI_CONDITION_CODES[code] ?? "unknown";
}

try {
  // Parse location
  const location = requiredRecord(response, "location");
  console.log("✓ location:", location.name);

  // Parse current
  const current = requiredRecord(response, "current");
  const currentCondition = conditionCode(current);
  console.log("✓ current temp:", current.temp_c, "condition:", currentCondition);

  // Parse forecast
  const forecast = requiredRecord(response, "forecast");
  const forecastday = requiredArray(forecast, "forecastday");
  console.log("✓ forecast days:", forecastday.length);

  // Parse each day
  for (const day of forecastday) {
    const dayRecord = requiredRecord(day, "day");
    const dayCondition = conditionCode(dayRecord);
    console.log("  ✓ day:", day.date, "max:", dayRecord.maxtemp_c, "condition:", dayCondition);

    const hours = requiredArray(day, "hour");
    console.log("    ✓ hours:", hours.length);

    for (const hour of hours) {
      const hourCondition = conditionCode(hour);
      // console.log("      hour:", hour.time_epoch, "temp:", hour.temp_c, "condition:", hourCondition);
    }
  }

  console.log("\n✅ All parsing succeeded!");
} catch (error) {
  console.error("\n❌ Parse error:", error.message);
  console.error(error.stack);
}
