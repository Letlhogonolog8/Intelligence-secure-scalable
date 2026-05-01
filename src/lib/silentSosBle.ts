/** Web Bluetooth helper for Silent SOS demo — Chromium only */

const SERVICE_UUID = 0xfff0
const CHARACTERISTIC_UUID = 0xfff1

export async function requestSilentSosDevice(): Promise<BluetoothRemoteGATTCharacteristic | null> {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth not available")
  }

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  })

  const server = await device.gatt?.connect()
  if (!server) return null

  const service = await server.getPrimaryService(SERVICE_UUID)
  return service.getCharacteristic(CHARACTERISTIC_UUID)
}
