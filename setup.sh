#!/bin/bash
set -e

# ── Smart Desk Display — Pi Setup Script ──────────────────────────
# Run this once on your Raspberry Pi from the project root:
#   chmod +x setup.sh
#   ./setup.sh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend/Aura"
SERVICE_NAME="smart-desk-display"
PI_USER="${SUDO_USER:-pi}"

echo ""
echo "=== Smart Desk Display Setup ==="
echo "Project: $PROJECT_DIR"
echo "User:    $PI_USER"
echo ""

# ── 1. System packages ────────────────────────────────────────────
echo "[1/6] Installing system packages..."
apt-get update -q
apt-get install -y python3 python3-pip python3-venv nodejs npm chromium-browser unclutter

# ── 2. Python virtual environment + dependencies ──────────────────
echo "[2/6] Setting up Python environment..."
cd "$BACKEND_DIR"
python3 -m venv venv
venv/bin/pip install --upgrade pip -q
venv/bin/pip install fastapi uvicorn[standard] requests python-dotenv -q

# ── 3. Build the React frontend ───────────────────────────────────
echo "[3/6] Building frontend..."
cd "$FRONTEND_DIR"
npm install
npm run build
echo "Frontend built to: $FRONTEND_DIR/dist"

# ── 4. Install systemd service ────────────────────────────────────
echo "[4/6] Installing systemd service..."

# Rewrite the service file with the correct project path and user
cat > /etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=Smart Desk Display Backend
After=network.target

[Service]
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
User=$PI_USER

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $SERVICE_NAME
systemctl restart $SERVICE_NAME
echo "Backend service enabled and started."

# ── 5. Auto-update timers ────────────────────────────────────────
echo "[5/7] Installing auto-update timers..."

chmod +x "$PROJECT_DIR/update.sh"

# Release timer — Wednesday 4AM
cat > /etc/systemd/system/aura-update.service <<EOF
[Unit]
Description=Aura Display Release Update

[Service]
Type=oneshot
ExecStart=$PROJECT_DIR/update.sh release
StandardOutput=append:/var/log/aura-update.log
StandardError=append:/var/log/aura-update.log
EOF

cat > /etc/systemd/system/aura-update.timer <<EOF
[Unit]
Description=Check for Aura Display release updates every Wednesday at 4AM

[Timer]
OnCalendar=Wed *-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Hotfix timer — every 30 minutes
cat > /etc/systemd/system/aura-hotfix.service <<EOF
[Unit]
Description=Aura Display Hotfix Update

[Service]
Type=oneshot
ExecStart=$PROJECT_DIR/update.sh hotfix
StandardOutput=append:/var/log/aura-update.log
StandardError=append:/var/log/aura-update.log
EOF

cat > /etc/systemd/system/aura-hotfix.timer <<EOF
[Unit]
Description=Check for Aura Display hotfixes every 30 minutes

[Timer]
OnBootSec=3min
OnUnitActiveSec=30min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable aura-update.timer aura-hotfix.timer
systemctl start aura-update.timer aura-hotfix.timer
echo "Timers enabled — releases: Wednesday 4AM | hotfixes: every 30 min."

# ── 6. Kiosk mode autostart ───────────────────────────────────────
echo "[6/7] Configuring Chromium kiosk autostart..."

AUTOSTART_DIR="/home/$PI_USER/.config/lxsession/LXDE-pi"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/autostart" <<EOF
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash

# Hide the mouse cursor after 1 second of inactivity
@unclutter -idle 1 -root

# Wait for backend to be ready, then launch Chromium in kiosk mode
@bash -c 'until curl -sf http://localhost:8000/config > /dev/null; do sleep 1; done; chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --check-for-update-interval=31536000 http://localhost:8000'
EOF

chown -R "$PI_USER:$PI_USER" "/home/$PI_USER/.config"
echo "Kiosk autostart configured."

# ── 7. Disable screen blanking ────────────────────────────────────
echo "[7/7] Disabling screen blanking..."

LIGHTDM_CONF="/etc/lightdm/lightdm.conf"
if [ -f "$LIGHTDM_CONF" ]; then
    # Add xserver arguments to prevent screen from sleeping
    if ! grep -q "xserver-command" "$LIGHTDM_CONF"; then
        sed -i '/\[Seat:\*\]/a xserver-command=X -s 0 -dpms' "$LIGHTDM_CONF"
    fi
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Make sure your API key is in: $BACKEND_DIR/.env"
echo "     Contents should be: WEATHER_API_KEY=your_key_here"
echo "  2. Reboot the Pi:  sudo reboot"
echo "  3. The display will launch automatically on boot."
echo ""
echo "Useful commands:"
echo "  Check backend status:   sudo systemctl status $SERVICE_NAME"
echo "  View backend logs:      sudo journalctl -u $SERVICE_NAME -f"
echo "  Restart backend:        sudo systemctl restart $SERVICE_NAME"
echo "  Check release timer:    sudo systemctl status aura-update.timer"
echo "  Check hotfix timer:     sudo systemctl status aura-hotfix.timer"
echo "  Run release manually:   sudo $PROJECT_DIR/update.sh release"
echo "  Run hotfix manually:    sudo $PROJECT_DIR/update.sh hotfix"
echo "  View update logs:       cat /var/log/aura-update.log"
echo ""
