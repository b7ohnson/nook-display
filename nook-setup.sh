#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  NooK Display — Raspberry Pi 4 Kiosk Setup
#  Turns a fresh Raspberry Pi OS install into a dedicated
#  NooK family wall display. Run once, then reboot.
#
#  Usage:
#    chmod +x nook-setup.sh && ./nook-setup.sh
#
#  Requirements:
#    - Raspberry Pi 4 (2GB+ RAM recommended)
#    - Raspberry Pi OS with Desktop (Bookworm or Bullseye)
#    - Internet connection
# ─────────────────────────────────────────────────────────────

set -e

NOOK_URL="https://nook-display.web.app"
NOOK_USER="${SUDO_USER:-pi}"
NOOK_HOME="/home/${NOOK_USER}"
KIOSK_SCRIPT="${NOOK_HOME}/nook-kiosk.sh"
LOG_FILE="${NOOK_HOME}/nook-setup.log"

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${AMBER}!${NC} $1" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}▸ $1${NC}" | tee -a "$LOG_FILE"; }

# ── Banner ────────────────────────────────────────────────────
clear
cat << 'EOF'

  ███╗   ██╗ ██████╗  ██████╗ ██╗  ██╗
  ████╗  ██║██╔═══██╗██╔═══██╗██║ ██╔╝
  ██╔██╗ ██║██║   ██║██║   ██║█████╔╝
  ██║╚██╗██║██║   ██║██║   ██║██╔═██╗
  ██║ ╚████║╚██████╔╝╚██████╔╝██║  ██╗
  ╚═╝  ╚═══╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝

  Family Wall Display — Pi Kiosk Setup

EOF

echo -e "${BOLD}This script will configure your Raspberry Pi as a dedicated"
echo -e "NooK wall display. It will:${NC}"
echo "  • Install Chromium and required packages"
echo "  • Configure auto-login on boot"
echo "  • Launch NooK fullscreen automatically"
echo "  • Disable screen blanking and the cursor"
echo ""
echo -e "${AMBER}This modifies system settings. Run on a fresh Pi OS install.${NC}"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""
[[ $REPLY =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

# ── Checks ────────────────────────────────────────────────────
step "Checking environment"

[[ $EUID -eq 0 ]] || err "Run with sudo: sudo ./nook-setup.sh"
[[ -d "$NOOK_HOME" ]] || err "Home directory $NOOK_HOME not found. Set NOOK_USER if not using 'pi'."

# Check we're on a Pi
if ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
  warn "Could not confirm this is a Raspberry Pi — continuing anyway"
fi

# Check for desktop environment
if ! command -v startx &>/dev/null && [[ -z "$DISPLAY" ]]; then
  warn "No desktop environment detected. Install 'Raspberry Pi OS with Desktop' for best results."
fi

log "Running as user: $NOOK_USER (home: $NOOK_HOME)"

# ── Packages ──────────────────────────────────────────────────
step "Updating package list"
apt-get update -qq | tee -a "$LOG_FILE" | tail -1
log "Package list updated"

step "Installing required packages"
apt-get install -y \
  chromium-browser \
  unclutter \
  x11-xserver-utils \
  xdotool \
  sed \
  2>&1 | tee -a "$LOG_FILE" | grep -E "(Setting up|already)" || true
log "Packages installed"

# ── Auto-login ────────────────────────────────────────────────
step "Configuring auto-login to desktop"

# Detect display manager
if command -v raspi-config &>/dev/null; then
  raspi-config nonint do_boot_behaviour B4
  log "Auto-login to desktop enabled (raspi-config)"
elif [ -f /etc/lightdm/lightdm.conf ]; then
  sed -i "s/^#autologin-user=.*/autologin-user=${NOOK_USER}/" /etc/lightdm/lightdm.conf
  sed -i "s/^autologin-user=.*/autologin-user=${NOOK_USER}/" /etc/lightdm/lightdm.conf
  log "Auto-login configured via lightdm"
else
  warn "Could not auto-configure login. Set up auto-login manually via raspi-config."
fi

# ── HDMI & display config ─────────────────────────────────────
step "Configuring display"

BOOT_CONFIG=""
if [ -f /boot/firmware/config.txt ]; then
  BOOT_CONFIG="/boot/firmware/config.txt"   # Bookworm
elif [ -f /boot/config.txt ]; then
  BOOT_CONFIG="/boot/config.txt"             # Bullseye and earlier
fi

if [ -n "$BOOT_CONFIG" ]; then
  # Force HDMI output even with no monitor at boot
  grep -q "hdmi_force_hotplug" "$BOOT_CONFIG" || echo "hdmi_force_hotplug=1" >> "$BOOT_CONFIG"
  # Max HDMI signal boost for long cables
  grep -q "config_hdmi_boost" "$BOOT_CONFIG" || echo "config_hdmi_boost=4" >> "$BOOT_CONFIG"
  # Use CEA mode (TV) instead of DMT (monitor) — comment out to use default resolution
  # echo "hdmi_group=1" >> "$BOOT_CONFIG"
  # echo "hdmi_mode=16" >> "$BOOT_CONFIG"   # 16 = 1080p 60Hz
  log "HDMI settings applied to $BOOT_CONFIG"
else
  warn "Could not find boot config. HDMI force settings skipped."
fi

# ── HDMI audio ────────────────────────────────────────────────
step "Configuring HDMI audio (for Spotify playback)"

if [ -n "$BOOT_CONFIG" ]; then
  # Route audio through HDMI
  grep -q "hdmi_drive" "$BOOT_CONFIG" || echo "hdmi_drive=2" >> "$BOOT_CONFIG"
  log "HDMI audio enabled"
fi

# Set ALSA default to HDMI
ALSA_CONF="${NOOK_HOME}/.asoundrc"
if [ ! -f "$ALSA_CONF" ]; then
  cat > "$ALSA_CONF" << 'ALSA'
pcm.!default {
  type hw
  card 0
  device 1
}
ctl.!default {
  type hw
  card 0
}
ALSA
  chown "${NOOK_USER}:${NOOK_USER}" "$ALSA_CONF"
  log "ALSA configured for HDMI audio"
fi

# ── Kiosk launch script ───────────────────────────────────────
step "Creating kiosk launcher"

cat > "$KIOSK_SCRIPT" << KIOSK
#!/bin/bash
# NooK Kiosk Launcher — auto-generated by nook-setup.sh

NOOK_URL="${NOOK_URL}"
CHROMIUM_PROFILE="/tmp/nook-chromium-profile"

# ── Wait for network ─────────────────────────────────────────
echo "[NooK] Waiting for network..."
for i in \$(seq 1 30); do
  if ping -c1 -W2 8.8.8.8 &>/dev/null; then
    echo "[NooK] Network ready"
    break
  fi
  sleep 2
done

# ── Display settings ──────────────────────────────────────────
# Disable screen blanking and power saving
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor after 0.5s idle
unclutter -idle 0.5 -root &

# ── Launch Chromium ───────────────────────────────────────────
# Use a clean temporary profile on each boot to avoid
# "restore session?" dialogs and stale cache
rm -rf "\$CHROMIUM_PROFILE"

while true; do
  chromium-browser \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --no-first-run \\
    --disable-session-crashed-bubble \\
    --disable-restore-session-state \\
    --disable-component-update \\
    --check-for-update-interval=31536000 \\
    --autoplay-policy=no-user-gesture-required \\
    --disable-features=TranslateUI,Translate \\
    --disable-pinch \\
    --overscroll-history-navigation=0 \\
    --disable-smooth-scrolling \\
    --user-data-dir="\$CHROMIUM_PROFILE" \\
    --window-position=0,0 \\
    "\$NOOK_URL" \\
    2>/dev/null

  # If Chromium exits for any reason, restart after 5s
  echo "[NooK] Chromium exited — restarting in 5s..."
  sleep 5
done
KIOSK

chmod +x "$KIOSK_SCRIPT"
chown "${NOOK_USER}:${NOOK_USER}" "$KIOSK_SCRIPT"
log "Kiosk script created at $KIOSK_SCRIPT"

# ── Autostart ─────────────────────────────────────────────────
step "Configuring autostart"

# Create autostart dirs
LXDE_AUTOSTART="${NOOK_HOME}/.config/lxsession/LXDE-pi"
XDG_AUTOSTART="${NOOK_HOME}/.config/autostart"
mkdir -p "$LXDE_AUTOSTART" "$XDG_AUTOSTART"

# LXDE/Pixel autostart (primary method)
LXDE_FILE="${LXDE_AUTOSTART}/autostart"
if [ ! -f "$LXDE_FILE" ]; then
  cat > "$LXDE_FILE" << LXDE
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash
LXDE
fi

# Add NooK entry if not already there
if ! grep -q "nook-kiosk" "$LXDE_FILE"; then
  echo "@${KIOSK_SCRIPT}" >> "$LXDE_FILE"
  log "Added to LXDE autostart"
fi

# XDG autostart (fallback / Wayland)
XDG_FILE="${XDG_AUTOSTART}/nook-kiosk.desktop"
cat > "$XDG_FILE" << DESKTOP
[Desktop Entry]
Type=Application
Name=NooK Kiosk
Exec=${KIOSK_SCRIPT}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
Comment=NooK Family Wall Display
DESKTOP

chown -R "${NOOK_USER}:${NOOK_USER}" "${NOOK_HOME}/.config"
log "Autostart configured (LXDE + XDG)"

# ── Screensaver / blanking ────────────────────────────────────
step "Disabling screen blanking at system level"

# Disable display power management in X11
if [ -d /etc/X11/xorg.conf.d ]; then
  cat > /etc/X11/xorg.conf.d/10-nook-display.conf << XORG
Section "ServerFlags"
  Option "BlankTime"   "0"
  Option "StandbyTime" "0"
  Option "SuspendTime" "0"
  Option "OffTime"     "0"
EndSection
XORG
  log "X11 display power management disabled"
fi

# ── Disable swap (improves Pi reliability for kiosk use) ──────
step "Optimizing system for kiosk use"

systemctl disable dphys-swapfile 2>/dev/null && log "Swap disabled" || warn "Could not disable swap (may not be installed)"

# Reduce GPU memory split if 1GB+ RAM
if [ -n "$BOOT_CONFIG" ]; then
  grep -q "^gpu_mem" "$BOOT_CONFIG" || echo "gpu_mem=128" >> "$BOOT_CONFIG"
  log "GPU memory set to 128MB"
fi

# ── Splash screen ─────────────────────────────────────────────
step "Configuring quiet boot"

# Remove boot messages for a clean startup
if [ -f /boot/firmware/cmdline.txt ]; then
  CMDLINE="/boot/firmware/cmdline.txt"
elif [ -f /boot/cmdline.txt ]; then
  CMDLINE="/boot/cmdline.txt"
fi

if [ -n "$CMDLINE" ]; then
  # Add quiet and splash if not present
  if ! grep -q "quiet" "$CMDLINE"; then
    sed -i 's/$/ quiet splash loglevel=0/' "$CMDLINE"
    log "Quiet boot enabled"
  fi
fi

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  NooK setup complete!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Display URL : ${BOLD}${NOOK_URL}${NC}"
echo -e "  Kiosk script: ${BOLD}${KIOSK_SCRIPT}${NC}"
echo -e "  Setup log   : ${BOLD}${LOG_FILE}${NC}"
echo ""
echo -e "  ${AMBER}Connect your TV via HDMI before rebooting.${NC}"
echo -e "  ${AMBER}Make sure WiFi/Ethernet is configured.${NC}"
echo ""
echo -e "  To rotate the display 90°, add to $BOOT_CONFIG:"
echo -e "  ${BOLD}display_rotate=1${NC}  (90°)  ${BOLD}display_rotate=2${NC}  (180°)"
echo ""
echo -e "  To test without rebooting:"
echo -e "  ${BOLD}su - ${NOOK_USER} -c '${KIOSK_SCRIPT}'${NC}"
echo ""
read -p "Reboot now? [Y/n] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  log "Rebooting..."
  reboot
fi
