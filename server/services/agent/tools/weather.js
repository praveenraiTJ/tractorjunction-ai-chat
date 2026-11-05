const dbConnection = require('../../../config/database');
const { getCache, setCache } = require('../../cacheService');

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// Resolve a place name (English or Hindi) to coordinates: TJ districts table first, Open-Meteo geocoding second
async function resolveLocation(name) {
  const rows = await dbConnection.query(`
    SELECT d.name_en, d.name_hi, d.latitude_new AS lat, d.longitude_new AS lon, s.name_en AS state
    FROM districts d LEFT JOIN states s ON s.id = d.state_id
    WHERE (d.name_en = ? OR d.name_hi = ? OR d.dist_slug = ?) AND d.latitude_new IS NOT NULL
    LIMIT 1`, [name, name, name.toLowerCase().replace(/\s+/g, '-')]);
  if (rows[0]?.lat) {
    return { name: rows[0].name_en, state: rows[0].state, lat: +rows[0].lat, lon: +rows[0].lon };
  }

  const res = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=5&language=en&countryCode=IN`);
  const data = await res.json();
  const place = data.results?.[0];
  return place ? { name: place.name, state: place.admin1, lat: place.latitude, lon: place.longitude } : null;
}

// Name shared browser coordinates after the nearest TJ district
async function nearestDistrict(lat, lon) {
  const rows = await dbConnection.query(`
    SELECT d.name_en, s.name_en AS state
    FROM districts d LEFT JOIN states s ON s.id = d.state_id
    WHERE d.latitude_new IS NOT NULL AND d.latitude_new != ''
    ORDER BY POW(CAST(d.latitude_new AS DECIMAL(10,6)) - ?, 2) + POW(CAST(d.longitude_new AS DECIMAL(10,6)) - ?, 2)
    LIMIT 1`, [lat, lon]);
  return rows[0] || null;
}

// Deterministic farm advisories; the LLM explains these instead of inventing its own
function advisories(days) {
  const out = [];
  const next2 = days.slice(0, 2);
  const rain2 = next2.reduce((s, d) => s + d.rain_mm, 0);
  if (rain2 >= 10) out.push({ level: 'warning', code: 'heavy_rain_48h', text: `Agle 48 ghante me ~${Math.round(rain2)} mm barish: spray, khad aur sinchai rok dein, kati fasal dhak kar rakhein.` });
  else if (next2.some(d => d.rain_prob >= 60)) out.push({ level: 'info', code: 'rain_likely', text: 'Barish ki sambhavna: spray se pehle mausam dekh lein.' });
  if (next2.some(d => d.wind_kmh >= 20)) out.push({ level: 'warning', code: 'high_wind', text: 'Tez hawa (20+ km/h): dawai ka spray na karein, dawai udd jayegi.' });
  if (days.some(d => d.temp_max >= 40)) out.push({ level: 'warning', code: 'heat', text: 'Tez garmi (40°C+): subah/shaam sinchai karein, pashuon ko chhaya aur paani dein.' });
  if (days.some(d => d.temp_min <= 4)) out.push({ level: 'warning', code: 'frost', text: 'Pala (frost) ka khatra: raat me halki sinchai karein ya dhuan karein.' });
  if (!out.length && rain2 < 1) out.push({ level: 'ok', code: 'dry', text: 'Agle 2 din mausam saaf: spray, katai aur khet ki taiyari ke liye theek samay.' });
  return out;
}

async function getWeatherForecast(args) {
  const days = Math.min(Math.max(args.days || 7, 1), 14);
  let loc;
  if (args.latitude && args.longitude) {
    const near = args.location ? null : await nearestDistrict(args.latitude, args.longitude);
    loc = { name: args.location || near?.name_en || null, state: near?.state, lat: args.latitude, lon: args.longitude };
  } else if (args.location) {
    loc = await resolveLocation(args.location.trim());
  }
  if (!loc) return { result: { error: 'location_not_found', message: 'Location nahi mili. User se zila/shehar ka naam poochein.' } };

  const cacheKey = `weather_${loc.lat.toFixed(2)}_${loc.lon.toFixed(2)}_${days}`;
  let forecast = getCache(cacheKey);
  if (!forecast) {
    const q = new URLSearchParams({
      latitude: loc.lat, longitude: loc.lon, timezone: 'Asia/Kolkata', forecast_days: days,
      current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max'
    });
    const res = await fetch(`${FORECAST_URL}?${q}`);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    forecast = {
      current: {
        temp: d.current.temperature_2m,
        humidity: d.current.relative_humidity_2m,
        wind_kmh: d.current.wind_speed_10m,
        code: d.current.weather_code
      },
      days: d.daily.time.map((date, i) => ({
        date,
        code: d.daily.weather_code[i],
        temp_max: d.daily.temperature_2m_max[i],
        temp_min: d.daily.temperature_2m_min[i],
        rain_mm: d.daily.precipitation_sum[i] ?? 0,
        rain_prob: d.daily.precipitation_probability_max[i] ?? 0,
        wind_kmh: d.daily.wind_speed_10m_max[i]
      }))
    };
    setCache(cacheKey, forecast, 3600);
  }

  const data = { location: loc, ...forecast, advisories: advisories(forecast.days) };
  return { result: data, block: { type: 'weather', data } };
}

module.exports = { getWeatherForecast, resolveLocation, advisories };
