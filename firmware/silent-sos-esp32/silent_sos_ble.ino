/**
 * AEGIS Silent SOS — ESP32-C3 · BLE panic notify
 *
 * Board: Seeed XIAO ESP32-C3 (Arduino core)
 * Pair with AEGIS PWA Web Bluetooth bridge (/demo/silent-sos)
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define DEVICE_NAME_PREFIX "AEGIS-SOS-"
#define SERVICE_UUID        "0000fff0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID "0000fff1-0000-1000-8000-00805f9b34fb"

#define BUTTON_PIN 9

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* s) override {
    deviceConnected = true;
    (void)s;
  }
  void onDisconnect(BLEServer* s) override {
    deviceConnected = false;
    (void)s;
    delay(200);
    pServer->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  String name = DEVICE_NAME_PREFIX + String((uint32_t)ESP.getEfuseMac(), HEX);

  BLEDevice::init(name.c_str());
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService* service = pServer->createService(SERVICE_UUID);
  pCharacteristic = service->createCharacteristic(
      CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristic->addDescriptor(new BLE2902());

  uint8_t v = 0x00;
  pCharacteristic->setValue(&v, 1);
  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->start();

  Serial.println("AEGIS Silent SOS ready — advertise: " + name);
}

unsigned long lastDebounce = 0;
bool lastStable = HIGH;
const unsigned long DEBOUNCE_MS = 60;

void loop() {
  bool raw = digitalRead(BUTTON_PIN);
  unsigned long now = millis();

  if (raw != lastStable) {
    lastDebounce = now;
  }
  if ((now - lastDebounce) > DEBOUNCE_MS) {
    if (raw != lastStable) {
      lastStable = raw;
      if (lastStable == LOW && deviceConnected) {
        uint8_t panic = 0x01;
        pCharacteristic->setValue(&panic, 1);
        pCharacteristic->notify();
        Serial.println("PANIC notify");
      }
    }
  }
  delay(5);
}
