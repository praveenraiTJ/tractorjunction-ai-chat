// Minimal Hindu panchang (tithi, nakshatra, vaar, Rahu kaal) computed offline with astronomy-engine.
// Accuracy: tithi/nakshatra at sunrise to within a few minutes of drikpanchang; good enough for day-level muhurat.
const Astronomy = require('astronomy-engine');

const IST_OFFSET_MIN = 330;

const TITHIS = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami',
  'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];

const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya',
  'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];

const VAARS = ['Ravivar', 'Somvar', 'Mangalvar', 'Budhvar', 'Guruvar', 'Shukravar', 'Shanivar'];

// Rahu kaal is the Nth eighth of daytime, by weekday (Sun..Sat)
const RAHU_KAAL_SLOT = [8, 2, 7, 5, 6, 4, 3];

// Lahiri ayanamsa: ~23.857° at J2000, precessing ~50.29"/year
function lahiriAyanamsa(date) {
  const years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000);
  return 23.857 + years * (50.29 / 3600);
}

function tithiAt(date) {
  const phase = Astronomy.MoonPhase(date); // moon − sun ecliptic longitude, 0..360
  const index = Math.floor(phase / 12); // 0..29
  const paksha = index < 15 ? 'Shukla' : 'Krishna';
  const n = index % 15; // 0..14
  let name = TITHIS[n] || null;
  if (index === 14) name = 'Purnima';
  if (index === 29) name = 'Amavasya';
  return { number: index + 1, paksha, name, dayOfPaksha: n + 1 };
}

function nakshatraAt(date) {
  const tropical = Astronomy.EclipticGeoMoon(date).lon;
  const sidereal = (tropical - lahiriAyanamsa(date) + 360) % 360;
  const index = Math.floor(sidereal / (360 / 27));
  return { number: index + 1, name: NAKSHATRAS[index] };
}

const fmtIST = (date) => new Date(date.getTime() + IST_OFFSET_MIN * 60000).toISOString().slice(11, 16);

// dateStr "YYYY-MM-DD" (IST calendar day)
function panchangFor(dateStr, lat = 23.25, lon = 77.41) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const istMidnight = new Date(`${dateStr}T00:00:00+05:30`);
  const sunrise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, istMidnight, 1).date;
  const sunset = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, sunrise, 1).date;

  const weekday = new Date(`${dateStr}T12:00:00+05:30`).getUTCDay();
  const slot = (sunset - sunrise) / 8;
  const rahuStart = new Date(sunrise.getTime() + (RAHU_KAAL_SLOT[weekday] - 1) * slot);
  const rahuEnd = new Date(rahuStart.getTime() + slot);

  return {
    date: dateStr,
    vaar: VAARS[weekday],
    weekday,
    sunrise: fmtIST(sunrise),
    sunset: fmtIST(sunset),
    tithi: tithiAt(sunrise),
    nakshatra: nakshatraAt(sunrise),
    rahu_kaal: `${fmtIST(rahuStart)}-${fmtIST(rahuEnd)}`
  };
}

// Traditional rules for buying a vehicle/machinery
const GOOD_NAKSHATRAS = new Set(['Ashwini', 'Rohini', 'Mrigashira', 'Punarvasu', 'Pushya', 'Hasta', 'Chitra',
  'Swati', 'Anuradha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Revati']);
const GOOD_VAARS = new Set([1, 3, 4, 5]); // Som, Budh, Guru, Shukra
const AVOID_VAARS = new Set([2, 6]); // Mangal, Shani
const RIKTA_TITHI_DAYS = new Set([4, 9, 14]);
const GOOD_TITHI_DAYS = new Set([2, 3, 5, 7, 10, 11, 13]);

function scoreForVehiclePurchase(p) {
  let score = 0;
  const reasons = [];
  const cautions = [];

  if (GOOD_NAKSHATRAS.has(p.nakshatra.name)) {
    score += 3;
    reasons.push(`${p.nakshatra.name} nakshatra shubh hai`);
    if (p.nakshatra.name === 'Pushya') { score += 2; reasons.push('Pushya nakshatra kharidari ke liye sabse uttam'); }
  }
  if (GOOD_VAARS.has(p.weekday)) { score += 2; reasons.push(`${p.vaar} shubh din`); }
  if (AVOID_VAARS.has(p.weekday)) { score -= 2; cautions.push(`${p.vaar} ko vahan kharid se bachte hain`); }
  if (p.tithi.name === 'Amavasya') { score -= 5; cautions.push('Amavasya'); }
  else if (RIKTA_TITHI_DAYS.has(p.tithi.dayOfPaksha)) { score -= 3; cautions.push(`Rikta tithi (${p.tithi.name})`); }
  else if (GOOD_TITHI_DAYS.has(p.tithi.dayOfPaksha)) { score += 1; reasons.push(`${p.tithi.paksha} ${p.tithi.name} tithi`); }
  if (p.tithi.paksha === 'Shukla') { score += 1; reasons.push('Shukla paksha'); }

  return { score, reasons, cautions };
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayIST() {
  return new Date(Date.now() + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}

function findVehicleMuhurat({ fromDate, days = 30, lat, lon, top = 5 }) {
  const start = fromDate || todayIST();
  const all = [];
  for (let i = 0; i < Math.min(days, 90); i++) {
    const p = panchangFor(addDays(start, i), lat, lon);
    all.push({ ...p, ...scoreForVehiclePurchase(p) });
  }
  const best = all.filter(d => d.score >= 5).sort((a, b) => b.score - a.score || a.date.localeCompare(b.date)).slice(0, top)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { from: start, to: addDays(start, Math.min(days, 90) - 1), best, checked_days: all.length };
}

module.exports = { panchangFor, findVehicleMuhurat, scoreForVehiclePurchase, todayIST, addDays };
