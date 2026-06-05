# Aura Display

A smart desk display showing the current time and weather, designed to run on a Raspberry Pi with a touchscreen.

---

## Running on a Raspberry Pi — Step by Step

### What you need
- Raspberry Pi (3B+ or newer recommended)
- MicroSD card with Raspberry Pi OS (Desktop version) installed
- Touchscreen display connected
- Internet connection on the Pi
- Your weatherapi.com API key

---

### Step 1 — Clone the repository

Open a terminal on the Pi and run:

```bash
git clone https://github.com/GunzRuls/Aura-Display.git
cd Aura-Display
```

---

### Step 2 — Create your .env file

The `.env` file holds your API key. It is not included in the repository for security reasons.

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Replace `your_api_key_here` with your actual weatherapi.com API key so the file looks like:

```
WEATHER_API_KEY=your_actual_key
```

Press `Ctrl+X`, then `Y`, then `Enter` to save and exit.

---

### Step 3 — Run the setup script

The setup script installs all dependencies, builds the frontend, sets up the backend as a system service, and configures Chromium to launch in kiosk mode on boot.

```bash
chmod +x setup.sh
sudo ./setup.sh
```

This will take a few minutes. You will see progress printed for each step.

---

### Step 4 — Reboot

```bash
sudo reboot
```

After rebooting, the display will launch automatically. On first boot you will see the setup screen asking for your zipcode. Enter it using the on-screen numpad and tap ✓. The display will then show the time and weather from that point forward.

---

### Useful commands after setup

| What you want to do | Command |
|---|---|
| Check if the backend is running | `sudo systemctl status smart-desk-display` |
| View live backend logs | `sudo journalctl -u smart-desk-display -f` |
| Restart the backend | `sudo systemctl restart smart-desk-display` |
| Stop the backend | `sudo systemctl stop smart-desk-display` |
| Change your zipcode | Delete the contents of `backend/config.json` and reboot |

---

### Troubleshooting

**Weather shows "Loading weather…" and never updates**
- Check that your `.env` file exists and contains the correct API key
- Run `sudo systemctl status smart-desk-display` to see if the backend is running
- Visit `http://localhost:8000/weather` in a browser on the Pi to test the backend directly

**Chromium does not launch on boot**
- Make sure you are using the Desktop version of Raspberry Pi OS, not Lite
- Check that the autostart file exists: `cat ~/.config/lxsession/LXDE-pi/autostart`

**Screen goes blank after a few minutes**
- The setup script disables screen blanking, but if it still happens run:
  ```bash
  sudo raspi-config
  ```
  Then go to Display Options then Screen Blanking and disable it

---

## Development (running locally)

### Backend
```bash
cd backend
python3 -m venv venv
venv/bin/pip install fastapi uvicorn requests python-dotenv
cp .env.example .env
venv/bin/uvicorn main:app --reload
```

### Frontend
```bash
cd frontend/Aura
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` and connects to the backend at `http://localhost:8000`.
