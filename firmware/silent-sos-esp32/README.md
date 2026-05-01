# Silent SOS — ESP32-C3 + BLE (competition edge story)

Low-cost **physical panic path** alongside USSD / WhatsApp / web. Elevate AI Africa judging emphasises *AI and robotics* — this firmware is the **robotics / edge** artefact: a wearable microcontroller, not a second chatbot.

## BOM (~USD 5–8)

| Part | Notes |
|------|--------|
| Seeed XIAO ESP32-C3 (or equivalent) | BLE 5.0, USB-C |
| Tactile switch | Normally open, wired to GPIO |
| Jumper wires | |
| Lanyard enclosure | Optional 3D print |

## Wiring

- **Button:** one leg to **GPIO9** (D9 on XIAO), other to **GND**.  
- Firmware uses `INPUT_PULLUP` — press = LOW.

## Behaviour

1. On boot, device advertises as `AEGIS-SOS-xxxx`.
2. BLE GATT:
   - Service UUID `0000fff0-0000-1000-8000-00805f9b34fb`
   - Notify characteristic `0000fff1-0000-1000-8000-00805f9b34fb`
3. On button press (debounced), device writes `0x01` to the characteristic (notify subscribers).

## PWA bridge

- Frontend route: `/demo/silent-sos` (`SilentSosDemo.tsx`).
- Use **Chrome or Edge** on Android with **Web Bluetooth**; pair once, subscribe to notifications, then `POST` to your API ` /api/cases/escalate` with a valid bearer token (wire in your app after survivor login).

## Security

- Do **not** ship a shared secret in flash for production without key rotation and OTA strategy.
- Demo mode: pairing + phone-mediated HTTPS only.

## Flash

Open `silent_sos_ble.ino` in Arduino IDE 2.x with **ESP32 board package** (esp32 by Espressif), board **XIAO_ESP32C3**, upload.

## Video pitch (30s)

Show: button press → phone notification toast → escalation row in dashboard / ops console.
