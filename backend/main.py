from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import requests
import json

load_dotenv()

app = FastAPI()

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("WEATHER_API_KEY")


def get_weather(city: str):
    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={city}"
    response = requests.get(url)
    data = response.json()

    if "current" not in data:
        return {
            "error": True,
            "message": data
        }

    return {
        "city": data["location"]["name"],
        "region": data["location"]["region"],
        "temperature": data["current"]["temp_f"],
        "condition": data["current"]["condition"]["text"],
        "humidity": data["current"]["humidity"],
        "feels_like": data["current"]["feelslike_f"]
    }


CONFIG_PATH = "config.json"

def read_config():
    try:
        with open(CONFIG_PATH, "r") as f:
            content = f.read().strip()
            return json.loads(content) if content else {}
    except (json.JSONDecodeError, FileNotFoundError):
        return {}

def write_config(data: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


class LocationUpdate(BaseModel):
    location: str


@app.get("/")
def root():
    return {"status": "Smart Desk Display running"}


@app.get("/config")
def get_config():
    config = read_config()
    # Return whether a location has been set so the frontend knows to show setup
    return {"location": config.get("location", "")}


@app.post("/config")
def set_config(body: LocationUpdate):
    if not body.location.strip():
        raise HTTPException(status_code=400, detail="Location cannot be empty")
    write_config({"location": body.location.strip()})
    return {"status": "ok", "location": body.location.strip()}


@app.get("/weather")
def weather():
    config = read_config()
    location = config.get("location", "").strip()
    if not location:
        raise HTTPException(status_code=400, detail="No location configured")
    return get_weather(location)

# Serve the built React frontend — must come AFTER all API routes
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "../frontend/Aura/dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")

# to run: uvicorn main:app --host 0.0.0.0 --port 8000