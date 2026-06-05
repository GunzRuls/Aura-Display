import { useEffect, useState, useMemo, useRef } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";
const WEATHER_REFRESH_MS = 10 * 60 * 1000;

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date) {
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

const TIME_PERIODS = [
  {
    name: "night",
    start: 0, end: 5,
    vars: {
      "--bg-from":        "#00000f",
      "--bg-to":          "#05051e",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#ccccee",
      "--text-muted":     "#8888aa",
      "--accent":         "#667acc",
      "--star-opacity":   "1",
      "--nebula-a":       "#3344bb",
      "--nebula-b":       "#6622aa",
    },
  },
  {
    name: "sunrise",
    start: 5, end: 8,
    vars: {
      "--bg-from":        "#0e0510",
      "--bg-to":          "#2a0a18",
      "--text-primary":   "#ffd8c0",
      "--text-secondary": "#ffccaa",
      "--text-muted":     "#aa8866",
      "--accent":         "#e8703a",
      "--star-opacity":   "0.6",
      "--nebula-a":       "#cc3300",
      "--nebula-b":       "#aa1155",
    },
  },
  {
    name: "morning",
    start: 8, end: 12,
    vars: {
      "--bg-from":        "#010e10",
      "--bg-to":          "#031e22",
      "--text-primary":   "#c0f0ee",
      "--text-secondary": "#aaeee8",
      "--text-muted":     "#66aaaa",
      "--accent":         "#30c0b0",
      "--star-opacity":   "0.5",
      "--nebula-a":       "#118888",
      "--nebula-b":       "#115599",
    },
  },
  {
    name: "afternoon",
    start: 12, end: 17,
    vars: {
      "--bg-from":        "#010818",
      "--bg-to":          "#021030",
      "--text-primary":   "#c0dcff",
      "--text-secondary": "#aaccff",
      "--text-muted":     "#6688bb",
      "--accent":         "#40aaff",
      "--star-opacity":   "0.4",
      "--nebula-a":       "#1155cc",
      "--nebula-b":       "#0077aa",
    },
  },
  {
    name: "sunset",
    start: 17, end: 20,
    vars: {
      "--bg-from":        "#0e0515",
      "--bg-to":          "#200830",
      "--text-primary":   "#f0d0ff",
      "--text-secondary": "#ddaaff",
      "--text-muted":     "#9966bb",
      "--accent":         "#cc55ff",
      "--star-opacity":   "0.7",
      "--nebula-a":       "#9911cc",
      "--nebula-b":       "#cc1166",
    },
  },
  {
    name: "evening",
    start: 20, end: 24,
    vars: {
      "--bg-from":        "#04030f",
      "--bg-to":          "#0d0a28",
      "--text-primary":   "#d8d0ff",
      "--text-secondary": "#bbaaee",
      "--text-muted":     "#7766aa",
      "--accent":         "#8877ee",
      "--star-opacity":   "0.9",
      "--nebula-a":       "#5533cc",
      "--nebula-b":       "#3322aa",
    },
  },
];

function applyTheme(date) {
  const hour = date.getHours();
  const period = TIME_PERIODS.find((p) => hour >= p.start && hour < p.end) || TIME_PERIODS[0];
  const style = document.body.style;
  Object.entries(period.vars).forEach(([key, val]) => style.setProperty(key, val));
}

// Generates random star data once — position, size, twinkle delay
function generateStars(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() < 0.85 ? 1 : Math.random() < 0.7 ? 2 : 3,
    delay: Math.random() * 6,
    duration: 3 + Math.random() * 4,
  }));
}

function Stars() {
  const stars = useMemo(() => generateStars(160), []);

  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((s) => (
        <div
          key={s.id}
          className="star"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// Fixed nebula cloud positions — each cloud has a position, size, which color variable,
// and its own slow drift animation delay so they don't all pulse together
const NEBULA_CLOUDS = [
  { x: -10, y:  -5, w: 520, h: 380, colorClass: "color-a", delay: 0,  dur: 18 },
  { x:  55, y:  60, w: 480, h: 340, colorClass: "color-b", delay: 6,  dur: 22 },
  { x:  20, y:  40, w: 360, h: 280, colorClass: "color-a", delay: 3,  dur: 26 },
  { x:  70, y: -10, w: 400, h: 300, colorClass: "color-b", delay: 10, dur: 20 },
  { x:  -5, y:  70, w: 300, h: 240, colorClass: "color-a", delay: 14, dur: 24 },
];

function Nebula() {
  return (
    <div className="nebula-layer" aria-hidden="true">
      {NEBULA_CLOUDS.map((cloud, i) => (
        <div
          key={i}
          className={`nebula-cloud ${cloud.colorClass}`}
          style={{
            left:              `${cloud.x}%`,
            top:               `${cloud.y}%`,
            width:             cloud.w,
            height:            cloud.h,
            animationDelay:    `${cloud.delay}s`,
            animationDuration: `${cloud.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState("loading");
  const [weather, setWeather] = useState(null);
  const [time, setTime] = useState(new Date());
  const [zipcode, setZipcode] = useState("");
  const [setupError, setSetupError] = useState("");
  const [brightness, setBrightness] = useState(() => {
    // Load saved brightness from localStorage, default to 100%
    return Number(localStorage.getItem("brightness") ?? 100);
  });
  const [showBrightness, setShowBrightness] = useState(false);
  const sliderTimeout = useRef(null);

  useEffect(() => {
    fetch(`${API}/config`)
      .then((res) => res.json())
      .then((data) => setScreen(data.location ? "display" : "setup"))
      .catch(() => setScreen("setup"));
  }, []);

  useEffect(() => {
    if (screen !== "display") return;
    fetchWeather();
    const interval = setInterval(fetchWeather, WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    applyTheme(new Date());
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now);
      applyTheme(now);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBrightnessChange = (val) => {
    const num = Number(val);
    setBrightness(num);
    localStorage.setItem("brightness", num);
    // Auto-close slider after 4 seconds of no interaction
    clearTimeout(sliderTimeout.current);
    sliderTimeout.current = setTimeout(() => setShowBrightness(false), 4000);
  };

  const fetchWeather = () => {
    fetch(`${API}/weather`)
      .then((res) => res.json())
      .then((data) => setWeather(data))
      .catch((err) => console.log("Fetch error:", err));
  };

  const handleSetupSubmit = () => {
    setSetupError("");
    fetch(`${API}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: zipcode }),
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(() => setScreen("display"))
      .catch(() => setSetupError("Could not save location. Check the zipcode and try again."));
  };

  const handleNumpadPress = (value) => {
    if (value === "⌫") {
      setZipcode((prev) => prev.slice(0, -1));
    } else if (zipcode.length < 5) {
      setZipcode((prev) => prev + value);
    }
  };

  const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"];

  // ── Setup screen ──────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className="container">
        <Nebula />
        <Stars />
        <div className="setup-box">
          <h1 className="setup-title">Welcome to Aura</h1>
          <p className="setup-subtitle">Enter your zipcode to get started</p>
          <div className="setup-display">
            {zipcode || <span className="setup-placeholder">_ _ _ _ _</span>}
          </div>
          <div className="numpad">
            {NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                className={`numpad-key ${key === "✓" ? "numpad-confirm" : ""} ${key === "⌫" ? "numpad-back" : ""}`}
                onPointerDown={() => {
                  if (key === "✓") { if (zipcode.length === 5) handleSetupSubmit(); }
                  else handleNumpadPress(key);
                }}
              >
                {key}
              </button>
            ))}
          </div>
          {setupError && <p className="setup-error">{setupError}</p>}
        </div>
      </div>
    );
  }

  // ── Display screen ────────────────────────────────────────────
  return (
    <div className="container" style={{ filter: `brightness(${brightness / 100})` }}>
      <Stars />
      <div className="clock-section">
        <div className="clock">{formatTime(time)}</div>
        <div className="date">{formatDate(time)}</div>
      </div>

      <div className="divider" />

      <div className="weather-section">
        {weather ? (
          <>
            <div className="temp">{weather.temperature}°F</div>
            <div className="condition">{weather.condition}</div>
            <div className="weather-details">
              <div className="detail-item">
                <span className="detail-label">Feels Like</span>
                <span className="detail-value">{weather.feels_like}°</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Humidity</span>
                <span className="detail-value">{weather.humidity}%</span>
              </div>
            </div>
            <div className="location">{weather.city}, {weather.region}</div>
          </>
        ) : (
          <div className="loading">Loading weather…</div>
        )}
      </div>

      {/* Brightness corner button */}
      <button
        className="brightness-btn"
        onPointerDown={(e) => {
          e.stopPropagation();
          setShowBrightness((prev) => {
            if (!prev) {
              clearTimeout(sliderTimeout.current);
              sliderTimeout.current = setTimeout(() => setShowBrightness(false), 4000);
            }
            return !prev;
          });
        }}
        aria-label="Adjust brightness"
      >
        ☀
      </button>

      {/* Brightness slider panel */}
      {showBrightness && (
        <div className="brightness-panel" onPointerDown={(e) => e.stopPropagation()}>
          <span className="brightness-label">Brightness</span>
          <input
            className="brightness-slider"
            type="range"
            min="10"
            max="100"
            value={brightness}
            onChange={(e) => handleBrightnessChange(e.target.value)}
          />
          <span className="brightness-value">{brightness}%</span>
        </div>
      )}
    </div>
  );
}

export default App;
