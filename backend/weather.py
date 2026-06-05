from dotenv import load_dotenv
import os
import requests

load_dotenv()

API_KEY = os.getenv("WEATHER_API_KEY")


def get_weather(city):

    url = f"http://api.weatherapi.com/v1/current.json?key={API_KEY}&q={city}"

    response = requests.get(url)
    data = response.json()

    weather = {
        "city": data["location"]["name"],
        "region": data["location"]["region"],
        "temperature": data["current"]["temp_f"],
        "condition": data["current"]["condition"]["text"],
        "humidity": data["current"]["humidity"],
        "feels_like": data["current"]["feelslike_f"]
    }

    return weather


weather = get_weather("Orlando")

print(weather)