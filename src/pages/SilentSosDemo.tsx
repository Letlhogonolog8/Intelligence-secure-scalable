import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Competition demo: physical "robotics / edge" companion to the cloud platform.
 * Pair with firmware/silent-sos-esp32 on a Seeed XIAO ESP32-C3 or similar.
 */
export default function SilentSosDemo() {
  const bleSupported =
    typeof navigator !== "undefined" && "bluetooth" in navigator && !!navigator.bluetooth

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
        <header className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">AEGIS-AI · Edge / robotics integration</p>
          <h1 className="text-3xl font-semibold tracking-tight">Silent SOS (BLE + PWA)</h1>
          <p className="text-muted-foreground">
            A low-cost wearable sends a Bluetooth Low Energy signal when the survivor presses a concealed
            button. The paired phone (this PWA, Chrome/Edge on Android) calls{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm">POST /api/cases/escalate</code> with a
            JWT — no new cloud model is required for the competition story.
          </p>
        </header>

        <Alert>
          <AlertTitle>Safety &amp; consent</AlertTitle>
          <AlertDescription>
            Use only in supervised demos. Confirm Web Bluetooth in a secure environment; never imply covert
            surveillance. Document informed consent for any pilot.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Hardware</CardTitle>
            <CardDescription>See repository folder firmware/silent-sos-esp32 for Wiring and sketch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-1">
              <li>ESP32-C3 module (e.g. Seeed XIAO ESP32-C3)</li>
              <li>Momentary button GPIO9 → GND, internal pull-up enabled</li>
              <li>BLE GATT service UUID 0000fff0-0000-1000-8000-00805f9b34fb</li>
              <li>Notify characteristic 0000fff1-0000-1000-8000-00805f9b34fb (value 0x01 = panic)</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Browser bridge</CardTitle>
            <CardDescription>Web Bluetooth is experimental and Chromium-based on Android/desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!bleSupported ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                This browser does not expose Web Bluetooth. Open this page in Chrome or Edge on a compatible
                device for a live demo.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Production integration: connect, subscribe to notifications, debounce, then POST escalation
                with the survivor&apos;s session token. This page is an architecture placeholder for judges
                — implementation can be completed against your staging API.
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={!bleSupported}
              onClick={() => {
                void import("@/lib/silentSosBle").then(({ requestSilentSosDevice }) => {
                  void requestSilentSosDevice().catch(() => {
                    /* user cancelled picker */
                  })
                })
              }}
            >
              {bleSupported ? "Choose BLE device (demo)" : "Web Bluetooth unavailable"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
