// Météo : Open-Meteo (gratuit, sans clé). Le nom de la ville ou les coordonnées sont envoyés à ce service.
// Une saisie manuelle reste possible si le réseau ne répond pas.

const WMO = {
  0: ["Ciel dégagé", "☀️"], 1: ["Plutôt dégagé", "🌤️"], 2: ["Nuageux", "⛅"], 3: ["Couvert", "☁️"],
  45: ["Brouillard", "🌫️"], 48: ["Brouillard givrant", "🌫️"],
  51: ["Bruine légère", "🌦️"], 53: ["Bruine", "🌦️"], 55: ["Bruine dense", "🌧️"], 56: ["Bruine verglaçante", "🌧️"], 57: ["Bruine verglaçante", "🌧️"],
  61: ["Pluie faible", "🌦️"], 63: ["Pluie", "🌧️"], 65: ["Pluie forte", "🌧️"], 66: ["Pluie verglaçante", "🌧️"], 67: ["Pluie verglaçante", "🌧️"],
  71: ["Neige faible", "🌨️"], 73: ["Neige", "🌨️"], 75: ["Neige forte", "❄️"], 77: ["Grains de neige", "🌨️"],
  80: ["Averses", "🌦️"], 81: ["Averses", "🌧️"], 82: ["Averses violentes", "⛈️"], 85: ["Averses de neige", "🌨️"], 86: ["Averses de neige", "🌨️"],
  95: ["Orage", "⛈️"], 96: ["Orage et grêle", "⛈️"], 99: ["Orage et grêle", "⛈️"],
};

export function describeWeather(w) {
  const [label, emoji] = WMO[w.code] || ["Variable", "🌡️"];
  return { label, emoji };
}

const num = (v, d = null) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : d);

// Transforme la réponse Open-Meteo en une liste de jours { date, tempMax, tempMin, feelMax, feelMin, rainProb, rainMm, wind, uv, code }.
export function normalizeForecast(json) {
  const d = json?.daily;
  if (!d || !Array.isArray(d.time)) throw new Error("Réponse météo inattendue");
  return d.time.map((date, i) => ({
    date,
    tempMax: num(d.temperature_2m_max?.[i], 18),
    tempMin: num(d.temperature_2m_min?.[i], 11),
    feelMax: num(d.apparent_temperature_max?.[i], num(d.temperature_2m_max?.[i], 18)),
    feelMin: num(d.apparent_temperature_min?.[i], num(d.temperature_2m_min?.[i], 11)),
    rainProb: num(d.precipitation_probability_max?.[i], 0),
    rainMm: num(d.precipitation_sum?.[i], 0),
    wind: num(d.wind_speed_10m_max?.[i], 10),
    uv: num(d.uv_index_max?.[i], 3),
    code: num(d.weather_code?.[i], 3),
  }));
}

export async function geocode(name, fetchFn = fetch) {
  const q = String(name || "").trim();
  if (q.length < 2) return [];
  const res = await fetchFn(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=fr&format=json`);
  if (!res.ok) throw new Error("Recherche de ville indisponible");
  const j = await res.json();
  return (j.results || []).map((r) => ({ name: r.name, region: r.admin1 || "", country: r.country || "", lat: r.latitude, lon: r.longitude }));
}

export async function fetchForecast(lat, lon, days = 7, fetchFn = fetch) {
  const daily = "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${Number(lat).toFixed(3)}&longitude=${Number(lon).toFixed(3)}&daily=${daily}&timezone=auto&forecast_days=${days}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error("Météo indisponible");
  return normalizeForecast(await res.json());
}
