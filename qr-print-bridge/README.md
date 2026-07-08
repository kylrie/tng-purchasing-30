# TNG QR Print Bridge

A tiny background service that runs on the **POS Windows computer** and prints
Kitchen/Bar tickets **automatically** the moment a QR order is **paid** — no
browser, no button, no print dialog.

```
Diner pays  →  TNG backend creates print jobs  →  this bridge  →  XP-Q801 prints
```

It watches the TNG database for print jobs for your business, and for each one
sends the ticket straight to the thermal printer over the network (raw ESC/POS,
port 9100 — the same thing the manual "IP / Network" test print used, but with no
browser needed). Kitchen tickets get **food only**; Bar tickets get **drinks
only**. A job is printed **exactly once**, even if the payment webhook is
delivered twice.

The browser-based **Bluetooth / System / IP-Network** print buttons in QR
Operations still work as a **manual fallback** — this bridge does not replace
them.

---

## What you need (once)

1. **Node.js 18 or newer** on the POS computer — <https://nodejs.org> (LTS).
2. This `qr-print-bridge` folder copied onto the POS computer, e.g.
   `C:\TNG\qr-print-bridge`.
3. A **Firebase service-account key** (a `.json` file) — ask the TNG admin. It
   authorises the bridge to read/print jobs. Save it into the folder as
   `service-account.json`. **Keep it secret; never email or commit it.**
4. The printer on the network with a known **IP** and **port** (the XP-Q801 is
   `192.168.100.104`, port `9100`).

> **Verify the port first.** From the POS computer, open PowerShell and run:
> `Test-NetConnection 192.168.100.104 -Port 9100`
> It should say `TcpTestSucceeded : True`. If not, the printer isn't reachable on
> :9100 — fix the network/printer before continuing (the manual IP/Network test
> print in QR Operations is another way to confirm).

---

## Install (once)

Open **PowerShell** in the `qr-print-bridge` folder and run:

```powershell
npm install
npm run build
```

Then create your config:

```powershell
copy config.example.json config.json
notepad config.json
```

### Configure (`config.json`)

```json
{
  "businessUnitId": "b3",
  "databaseId": "tng-systems",
  "serviceAccountPath": "./service-account.json",
  "printers": {
    "KITCHEN": { "host": "192.168.100.104", "port": 9100 },
    "BAR":     { "host": "192.168.100.104", "port": 9100 }
  },
  "maxAttempts": 3,
  "retryDelayMs": 3000,
  "socketTimeoutMs": 8000,
  "heartbeatMs": 15000,
  "pollIntervalMs": 20000
}
```

- **businessUnitId** — your location's TNG business id (BEACHBOSSES = `b3`).
- **printers.KITCHEN / printers.BAR** — the printer **IP** and **port**. For this
  MVP both point at the **same** XP-Q801 (`192.168.100.104:9100`); one printer
  serves both stations. Point them at different printers later when you add a
  second one — no code change.
- The other numbers are safe defaults; leave them unless asked.

---

## Verify it's healthy

```powershell
npm run health
```

You should see each printer marked **REACHABLE**, `Firestore OK`, and `HEALTHY`.
Fix anything that's `UNREACHABLE`/`ERROR` before going live.

---

## Run it

### Option A — Run as a Windows Service (recommended: auto-starts on boot, restarts on crash)

In an **Administrator** PowerShell (right-click → *Run as administrator*):

```powershell
npm run install-service
```

That's it — the service **"TNG QR Print Bridge"** is now installed, running, and
set to start automatically every time Windows starts. You can close the window.

- **Stop:**   `net stop "TNG QR Print Bridge"`   (or Services app → Stop)
- **Start:**  `net start "TNG QR Print Bridge"`
- **Restart:** `net stop "TNG QR Print Bridge"; net start "TNG QR Print Bridge"`
- **See it:** press `Win+R`, type `services.msc`, find *TNG QR Print Bridge*.
- **Logs:** written next to the service wrapper in the `daemon\` folder, and to
  the Windows Event Log.

> If `install-service` can't find `node-windows`, run `npm install` again, or use
> the **Task Scheduler fallback** below.

### Option B — Run in a window (for testing)

```powershell
npm start
```

Leave the window open; it prints a line for every ticket. Press `Ctrl+C` to stop.
(This does **not** survive logoff/reboot — use the service for production.)

### Task Scheduler fallback (if you prefer not to use the service)

1. Open **Task Scheduler** → *Create Task*.
2. General: *Run whether user is logged on or not*, *Run with highest privileges*.
3. Triggers: *At startup*.
4. Actions: *Start a program* → Program: `node`, Arguments: `dist\index.js`,
   Start in: the `qr-print-bridge` folder path.
5. Settings: *Restart the task if it fails*.

---

## Update the bridge later

Replace the folder contents (keep your `config.json` and `service-account.json`),
then:

```powershell
npm install
npm run build
net stop "TNG QR Print Bridge"; net start "TNG QR Print Bridge"
```

## Uninstall

In an **Administrator** PowerShell:

```powershell
npm run uninstall-service
```

Then delete the folder if you no longer need it.

---

## How it stays correct (for reference)

- **Exactly once.** Each print job has a fixed id `orderId:STATION:INITIAL`. Jobs
  are created inside the same database transaction that releases the paid order,
  so a duplicate payment webhook creates **no** extra job. The bridge also
  *claims* each job (PENDING → PRINTING) atomically before printing, so even two
  bridges (or a restart mid-print) never print the same ticket twice.
- **Failure is visible.** If the printer is unreachable, the bridge retries a few
  times, then marks the job **FAILED** — QR Operations shows it, and staff can use
  the manual print buttons. Nothing is silently lost.
- **Deliberate extra copies** are **REPRINT**s (a separate action), never a
  re-run of the automatic job.
