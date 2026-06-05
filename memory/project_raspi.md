---
name: project-raspi-target
description: The smart desk display will ultimately run on a Raspberry Pi as the final hardware product
metadata:
  type: project
---

The final product will be deployed on a Raspberry Pi connected to a small display (nightstand/desk display).

**Why:** This is the target hardware for the physical product build.

**How to apply:** Keep Raspberry Pi compatibility in mind — favor lightweight dependencies, consider autostart/kiosk mode setup (e.g. Chromium in kiosk mode for the frontend), and avoid anything that assumes a full desktop OS or high-end hardware.
