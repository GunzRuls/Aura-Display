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
    name: "night",        // Pure deep space — very dark, stars fully bright
    start: 0, end: 5,
    vars: {
      "--bg-from":        "#00000f",
      "--bg-to":          "#04041a",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#aaaacc",
      "--text-muted":     "#666688",
      "--accent":         "#5566cc",
      "--star-opacity":   "1",
      "--nebula-a":       "#2233aa",
      "--nebula-b":       "#551188",
    },
  },
  {
    name: "sunrise",      // Warm fiery orange/red — clearly dawn
    start: 5, end: 8,
    vars: {
      "--bg-from":        "#1a0800",
      "--bg-to":          "#3d1500",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#ffcc99",
      "--text-muted":     "#bb8855",
      "--accent":         "#ff7722",
      "--star-opacity":   "0.5",
      "--nebula-a":       "#cc4400",
      "--nebula-b":       "#991133",
    },
  },
  {
    name: "morning",      // Bright teal-blue — clearly daytime, energetic
    start: 8, end: 12,
    vars: {
      "--bg-from":        "#002233",
      "--bg-to":          "#003355",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#99ddff",
      "--text-muted":     "#5599bb",
      "--accent":         "#00ccff",
      "--star-opacity":   "0.25",
      "--nebula-a":       "#0099cc",
      "--nebula-b":       "#006699",
    },
  },
  {
    name: "afternoon",    // Rich royal blue — brightest, most vibrant period
    start: 12, end: 17,
    vars: {
      "--bg-from":        "#001844",
      "--bg-to":          "#002a6e",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#aaccff",
      "--text-muted":     "#6688cc",
      "--accent":         "#4488ff",
      "--star-opacity":   "0.15",
      "--nebula-a":       "#2255dd",
      "--nebula-b":       "#0033bb",
    },
  },
  {
    name: "sunset",       // Deep magenta/purple — dramatic dusk
    start: 17, end: 20,
    vars: {
      "--bg-from":        "#1a0020",
      "--bg-to":          "#330011",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#ffaadd",
      "--text-muted":     "#aa6688",
      "--accent":         "#ff44aa",
      "--star-opacity":   "0.6",
      "--nebula-a":       "#cc0088",
      "--nebula-b":       "#880044",
    },
  },
  {
    name: "evening",      // Deep indigo — transitioning back to night
    start: 20, end: 24,
    vars: {
      "--bg-from":        "#050010",
      "--bg-to":          "#0a0530",
      "--text-primary":   "#ffffff",
      "--text-secondary": "#bbaaee",
      "--text-muted":     "#7766aa",
      "--accent":         "#8855ff",
      "--star-opacity":   "0.85",
      "--nebula-a":       "#5522cc",
      "--nebula-b":       "#330099",
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

// ── Weather theme system ──────────────────────────────────────────

function getWeatherCategory(condition, hour) {
  // Between 8pm and 5am always use night regardless of conditions
  if (hour >= 20 || hour < 5) return "night";
  const c = condition.toLowerCase();
  if (c.includes("thunder") || c.includes("storm"))                      return "stormy";
  if (c.includes("snow") || c.includes("blizzard") || c.includes("sleet")) return "snowy";
  if (c.includes("fog") || c.includes("mist"))                           return "foggy";
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "rainy";
  if (c.includes("partly cloudy") || c.includes("partly"))               return "partlycloudy";
  if (c.includes("cloudy") || c.includes("overcast"))                    return "cloudy";
  return "sunny";
}

const WEATHER_THEMES = {
  sunny: {
    "--bg-from": "#0a1828", "--bg-to": "#1e3a5f",
    "--text-primary": "#ffffff", "--text-secondary": "#ffe0aa", "--text-muted": "#cc9955",
    "--accent": "#ffcc44", "--star-opacity": "0",
    "--nebula-a": "#cc8800", "--nebula-b": "#aa5500",
    effect: "sunny",
  },
  partlycloudy: {
    "--bg-from": "#0f1e35", "--bg-to": "#1a3050",
    "--text-primary": "#ffffff", "--text-secondary": "#aaccee", "--text-muted": "#6688aa",
    "--accent": "#88bbff", "--star-opacity": "0",
    "--nebula-a": "#446688", "--nebula-b": "#556677",
    effect: "partlycloudy",
  },
  cloudy: {
    "--bg-from": "#0a0f18", "--bg-to": "#141e2a",
    "--text-primary": "#ffffff", "--text-secondary": "#99aabb", "--text-muted": "#556677",
    "--accent": "#8899aa", "--star-opacity": "0",
    "--nebula-a": "#334455", "--nebula-b": "#445566",
    effect: "cloudy",
  },
  rainy: {
    "--bg-from": "#050d15", "--bg-to": "#0a1822",
    "--text-primary": "#ffffff", "--text-secondary": "#88aacc", "--text-muted": "#446688",
    "--accent": "#4488bb", "--star-opacity": "0",
    "--nebula-a": "#1a3344", "--nebula-b": "#112233",
    effect: "rainy",
  },
  stormy: {
    "--bg-from": "#050010", "--bg-to": "#0f0520",
    "--text-primary": "#ffffff", "--text-secondary": "#aa99cc", "--text-muted": "#665588",
    "--accent": "#9966ff", "--star-opacity": "0",
    "--nebula-a": "#331166", "--nebula-b": "#220055",
    effect: "stormy",
  },
  snowy: {
    "--bg-from": "#0a1020", "--bg-to": "#101828",
    "--text-primary": "#ffffff", "--text-secondary": "#cce0ff", "--text-muted": "#7799bb",
    "--accent": "#aaccff", "--star-opacity": "0.2",
    "--nebula-a": "#334466", "--nebula-b": "#223355",
    effect: "snowy",
  },
  foggy: {
    "--bg-from": "#0d1216", "--bg-to": "#161e24",
    "--text-primary": "#dddddd", "--text-secondary": "#aabbcc", "--text-muted": "#778899",
    "--accent": "#889aaa", "--star-opacity": "0",
    "--nebula-a": "#445566", "--nebula-b": "#556677",
    effect: "foggy",
  },
  night: {
    "--bg-from": "#00000f", "--bg-to": "#04041a",
    "--text-primary": "#ffffff", "--text-secondary": "#aaaacc", "--text-muted": "#666688",
    "--accent": "#5566cc", "--star-opacity": "1",
    "--nebula-a": "#2233aa", "--nebula-b": "#551188",
    effect: "night",
  },
};

function applyWeatherTheme(category) {
  const theme = WEATHER_THEMES[category] || WEATHER_THEMES.sunny;
  const style = document.body.style;
  Object.entries(theme).forEach(([key, val]) => {
    if (key !== "effect") style.setProperty(key, val);
  });
}

// ── Weather effect components ─────────────────────────────────────

function SunGlow() {
  return <div className="sun-glow" aria-hidden="true" />;
}

function Rain({ intensity = 1 }) {
  const drops = useMemo(() => Array.from({ length: Math.floor(80 * intensity) }, (_, i) => ({
    id: i,
    x:        Math.random() * 110 - 5,
    delay:    Math.random() * 2,
    duration: 0.5 + Math.random() * 0.4,
    opacity:  0.25 + Math.random() * 0.35,
    height:   15 + Math.random() * 20,
  })), [intensity]);

  return (
    <div className="rain-layer" aria-hidden="true">
      {drops.map((d) => (
        <div key={d.id} className="rain-drop" style={{
          left:              `${d.x}%`,
          height:            d.height,
          opacity:           d.opacity,
          animationDelay:    `${d.delay}s`,
          animationDuration: `${d.duration}s`,
        }} />
      ))}
    </div>
  );
}

function Snow() {
  const flakes = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id:       i,
    x:        Math.random() * 100,
    size:     2 + Math.random() * 4,
    delay:    Math.random() * 6,
    duration: 6 + Math.random() * 8,
    drift:    (Math.random() - 0.5) * 80,
    opacity:  0.4 + Math.random() * 0.5,
  })), []);

  return (
    <div className="snow-layer" aria-hidden="true">
      {flakes.map((f) => (
        <div key={f.id} className="snowflake" style={{
          left:              `${f.x}%`,
          width:             f.size,
          height:            f.size,
          opacity:           f.opacity,
          animationDelay:    `${f.delay}s`,
          animationDuration: `${f.duration}s`,
          "--drift":         `${f.drift}px`,
        }} />
      ))}
    </div>
  );
}

function Lightning() {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    let timeout;
    const schedule = () => {
      timeout = setTimeout(() => {
        setFlash(true);
        setTimeout(() => { setFlash(false); schedule(); }, 150);
      }, 6000 + Math.random() * 14000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);
  return flash ? <div className="lightning-flash" aria-hidden="true" /> : null;
}

// Render the right weather effect based on category
function WeatherEffect({ category }) {
  if (category === "sunny")       return <SunGlow />;
  if (category === "rainy")       return <Rain intensity={1} />;
  if (category === "stormy")      return <><Rain intensity={1.5} /><Lightning /></>;
  if (category === "snowy")       return <Snow />;
  return null; // cloudy, partlycloudy, foggy, night — nebula handles it
}

function toC(f) {
  return ((f - 32) * 5 / 9).toFixed(1);
}

function App() {
  const [screen, setScreen]           = useState("loading");
  const [transitioning, setTransitioning] = useState(false);
  const [weather, setWeather]         = useState(null);
  const [time, setTime]               = useState(new Date());
  const [zipcode, setZipcode]         = useState("");
  const [setupError, setSetupError]   = useState("");
  const [weatherError, setWeatherError] = useState(false);
  const [useCelsius, setUseCelsius]   = useState(() => localStorage.getItem("useCelsius") === "true");
  const [themeMode, setThemeMode]     = useState(() => localStorage.getItem("themeMode") || "space");
  const retryRef      = useRef(null);
  const sliderTimeout = useRef(null);
  const themeModeRef  = useRef(themeMode);
  const weatherRef    = useRef(null);

  // Keep refs in sync with state so the clock interval always reads fresh values
  useEffect(() => { themeModeRef.current = themeMode; }, [themeMode]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  const [brightness, setBrightness] = useState(() => {
    const saved = Number(localStorage.getItem("brightness") ?? 100);
    document.body.style.filter = `brightness(${saved / 100})`;
    return saved;
  });
  const [showBrightness, setShowBrightness] = useState(false);

  // Fade out → switch screen → fade in
  const goToScreen = (next) => {
    setTransitioning(true);
    setTimeout(() => {
      setScreen(next);
      setTransitioning(false);
    }, 400);
  };

  // Poll backend every 300ms until it responds, then navigate
  useEffect(() => {
    const startTime = Date.now();
    const MIN_SPLASH_MS = 1500; // show splash for at least 1.5s so it doesn't flash

    const poll = setInterval(() => {
      fetch(`${API}/config`)
        .then((res) => res.json())
        .then((data) => {
          clearInterval(poll);
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
          setTimeout(() => goToScreen(data.location ? "display" : "setup"), remaining);
        })
        .catch(() => {}); // keep polling silently
    }, 300);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (screen !== "display") return;
    fetchWeather();
    const interval = setInterval(fetchWeather, WEATHER_REFRESH_MS);
    return () => clearInterval(interval);
  }, [screen]);

  const applyCurrentTheme = (now) => {
    if (themeModeRef.current === "weather" && weatherRef.current) {
      const category = getWeatherCategory(weatherRef.current.condition, now.getHours());
      applyWeatherTheme(category);
    } else {
      applyTheme(now);
    }
  };

  useEffect(() => {
    applyCurrentTheme(new Date());
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now);
      applyCurrentTheme(now);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-apply theme immediately when mode or weather changes
  useEffect(() => {
    applyCurrentTheme(new Date());
  }, [themeMode, weather]);

  const handleBrightnessChange = (val) => {
    const num = Number(val);
    setBrightness(num);
    localStorage.setItem("brightness", num);
    document.body.style.filter = `brightness(${num / 100})`;
    // Auto-close slider after 4 seconds of no interaction
    clearTimeout(sliderTimeout.current);
    sliderTimeout.current = setTimeout(() => setShowBrightness(false), 4000);
  };

  const toggleThemeMode = () => {
    setThemeMode((prev) => {
      const next = prev === "space" ? "weather" : "space";
      localStorage.setItem("themeMode", next);
      return next;
    });
  };

  const toggleUnit = () => {
    setUseCelsius((prev) => {
      localStorage.setItem("useCelsius", !prev);
      return !prev;
    });
  };

  const fetchWeather = () => {
    fetch(`${API}/weather`)
      .then((res) => {
        if (!res.ok) throw new Error("Bad response");
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error("API error");
        setWeather(data);
        setWeatherError(false);
        // Clear any existing retry interval on success
        clearInterval(retryRef.current);
        retryRef.current = null;
      })
      .catch(() => {
        setWeatherError(true);
        // Start a retry every 30 seconds if not already retrying
        if (!retryRef.current) {
          retryRef.current = setInterval(fetchWeather, 30 * 1000);
        }
      });
  };

  const handleSetupSubmit = () => {
    setSetupError("");
    fetch(`${API}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: zipcode }),
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(() => goToScreen("display"))
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

  // ── Splash / loading screen ───────────────────────────────────
  if (screen === "loading") {
    return (
      <div className={`container${transitioning ? " fade-out" : ""}`}>
        <Nebula />
        <Stars />
        <div className="splash-box">
          <h1 className="splash-title">Aura</h1>
          <p className="splash-sub">Setting up your display…</p>
          <div className="splash-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  // ── Setup screen ──────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className={`container${transitioning ? " fade-out" : ""}`}>
        <Nebula />
        <Stars />
        <div className="setup-box">
          <h1 className="setup-title">Welcome to Aura</h1>
          <p className="setup-subtitle">Enter your zipcode to get started</p>
          <div className="setup-display">
            {zipcode || <span className="setup-placeholder">· · · · ·</span>}
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
  const tempDisplay  = useCelsius ? `${toC(weather?.temperature)}°C` : `${weather?.temperature}°F`;
  const feelsDisplay = useCelsius ? `${toC(weather?.feels_like)}°`   : `${weather?.feels_like}°`;
  const weatherCategory = weather ? getWeatherCategory(weather.condition, new Date().getHours()) : "sunny";

  return (
    <div className={`container${transitioning ? " fade-out" : ""}`}>
      <Nebula />
      <Stars />
      {themeMode === "weather" && <WeatherEffect category={weatherCategory} />}
      <div className="clock-section">
        <div className="clock">{formatTime(time)}</div>
        <div className="date">{formatDate(time)}</div>
      </div>

      <div className="divider" />

      <div className="weather-section">
        {weatherError ? (
          <div className="weather-error">
            <div className="weather-error-icon">⚠</div>
            <div className="weather-error-title">No Connection</div>
            <div className="weather-error-sub">Retrying every 30 seconds…</div>
          </div>
        ) : weather ? (
          <>
            <div className="temp">{tempDisplay}</div>
            <div className="condition">{weather.condition}</div>
            <div className="weather-details">
              <div className="detail-item">
                <span className="detail-label">Feels Like</span>
                <span className="detail-value">{feelsDisplay}</span>
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

      {/* Theme mode toggle */}
      <button className="theme-btn" onPointerDown={toggleThemeMode} title={themeMode === "space" ? "Switch to weather theme" : "Switch to space theme"}>
        {themeMode === "space" ? "⛅" : "✦"}
      </button>

      {/* °F / °C toggle */}
      <button className="unit-btn" onPointerDown={toggleUnit}>
        {useCelsius ? "°F" : "°C"}
      </button>

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
