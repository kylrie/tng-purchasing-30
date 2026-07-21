# TNG QR Print Bridge — Fun Roof (b1) — Windows Setup for Fred

This is the small program that makes **Kitchen and Bar tickets print automatically**
the moment a Fun Roof QR order is **paid** — no phone, no button, no print dialog.

```
Diner pays  ->  TNG creates the ticket jobs  ->  this bridge  ->  XP-Q801 prints
```

You run it on a **Windows laptop / mini-PC** that stays on the **same Wi-Fi/LAN as
the printer**. For this MVP **one printer (the XP-Q801) prints both Kitchen and Bar
tickets**. The manual print buttons in QR Operations keep working as a fallback —
this does not replace them.

- **Business unit:** `b1` (The Fun Roof)
- **Database:** `tng-systems`
- **Printer:** Xprinter **XP-Q801**, IP **192.168.100.104**, port **9100**

> The whole point of this bridge is *unattended* printing. So the laptop must stay
> **on, awake, and connected to the same network as the printer** at all times.

---

## What's in this package

Inside the `tfr-windows-package` folder:

| File | What it is |
|------|-----------|
| `README_TFR_WINDOWS.md` | This guide. |
| `config.example.json` | The template you copy to `config.json` and fill in. |
| `preflight-check.ps1` | Read-only check that the laptop is ready (installs/tests nothing). |
| `start-tfr-bridge.ps1` | Starts the bridge in a visible window with live logs. |

**Not included (on purpose — you get these separately):**

- ❌ The Firebase **service-account key** (`service-account.json`) — a secret. Ask the TNG admin.
- ❌ A real, filled-in `config.json`.
- ❌ `node_modules` / build output — created automatically the first time you start it.

---

## Fred's steps (do these in order)

### Step 1 — Same network as the printer
Connect the laptop to the **same Wi-Fi/LAN** the XP-Q801 is on. The laptop must be
able to reach `192.168.100.104`.

### Step 2 — Stop the laptop from sleeping
**Windows Settings → System → Power & battery → Screen and sleep →**
**“When plugged in, put my device to sleep after” = _Never_.**
(Also set the screen to never turn off if you like — sleeping is the one that
breaks printing.) Keep the laptop **plugged in**.

### Step 3 — Install Node.js
Download and install **Node.js LTS** from <https://nodejs.org> (just click through
the installer with the defaults). This is what runs the bridge.

### Step 4 — Copy the bridge folder to the laptop
Copy the **whole `qr-print-bridge` folder** onto the laptop, for example to:

```
C:\TNG-Print-Bridge
```

So you end up with `C:\TNG-Print-Bridge\package.json`, and this package at
`C:\TNG-Print-Bridge\tfr-windows-package\`.

### Step 5 — Put the secret key in place
Get **`service-account.json`** from the TNG admin and save it into the bridge
folder root:

```
C:\TNG-Print-Bridge\service-account.json
```

> 🔒 This file is a password. **Never** email it, post it, or commit it to git.

### Step 6 — Create your config
Copy the template to a real `config.json` in the bridge folder root and check the
values. In PowerShell:

```powershell
cd C:\TNG-Print-Bridge
copy tfr-windows-package\config.example.json config.json
notepad config.json
```

It should read exactly like this (this is already correct for Fun Roof — just
confirm the top part and **save**):

```json
{
    "businessUnitId": "b1",
    "databaseId": "tng-systems",
    "serviceAccountPath": "./service-account.json",
    "printers": {
        "KITCHEN": { "host": "192.168.100.104", "port": 9100 },
        "BAR": { "host": "192.168.100.104", "port": 9100 }
    },
    "maxAttempts": 3,
    "retryDelayMs": 3000,
    "socketTimeoutMs": 8000,
    "heartbeatMs": 15000,
    "pollIntervalMs": 20000
}
```

- `businessUnitId` **must be `b1`** (The Fun Roof).
- `serviceAccountPath` `./service-account.json` means “the key file sits next to
  this config” (i.e. in `C:\TNG-Print-Bridge`). You can also put a full path like
  `C:\\TNG-Print-Bridge\\service-account.json` (note the double backslashes).
- Both stations point at the **same** XP-Q801 — correct for the one-printer MVP.
- The five lines below `printers` (`maxAttempts`, `retryDelayMs`, `socketTimeoutMs`,
  `heartbeatMs`, `pollIntervalMs`) are safe default settings — **leave them exactly
  as they are; do not delete them.**

### Step 7 — Run the preflight check
Still in `C:\TNG-Print-Bridge`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tfr-windows-package\preflight-check.ps1
```

Everything should say **[ OK ]**. In particular the printer line should be
**reachable** (this is the same as `Test-NetConnection 192.168.100.104 -Port 9100`
returning `TcpTestSucceeded : True`). Fix any **[FAIL]** using the Troubleshooting
section below, then run it again. *(The preflight prints nothing and changes
nothing — it’s safe to run repeatedly.)*

### Step 8 — Start the bridge
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tfr-windows-package\start-tfr-bridge.ps1
```

The first time, it installs dependencies and builds (a few minutes) — that’s
normal. Then it prints **“bridge online — watching for PAID-order print jobs.”**
**Leave this window open.**

### Step 9 — Verify ONLINE in QR Ops
Open **QR Operations** for Fun Roof and check the Printer panel shows the
**Bridge ONLINE** for `b1`. (It flips to ONLINE within ~15 seconds of the bridge
starting.)

### Step 10 — Expect one old ticket
There is one older **paid but never-printed** order waiting: **QR-00024** (a Bar
item, “Bottled Water”). When the bridge comes online it will **claim and print
that one ticket once**. That’s expected — it’s proof the pipeline works. It will
**not** re-print on restart.

### Step 11 — One controlled live test (owner present)
With the **owner’s approval**, place **one** small real paid test order (ideally
one food + one drink item) and confirm:

- the **Kitchen** ticket prints **food only**,
- the **Bar** ticket prints **drinks only**,
- **no** duplicate tickets,
- QR Ops shows the jobs as **PRINTED**.

That’s go-live. 🎉

---

## Install dependencies (what the start script does for you)

You normally **don’t** run these by hand — `start-tfr-bridge.ps1` does them the
first time. But if you ever need to, from `C:\TNG-Print-Bridge`:

```powershell
npm install      # downloads the libraries (first time / after an update)
npm run build    # compiles the bridge
npm run health   # optional deeper check: config + printer + Firebase heartbeat
npm start        # runs the bridge (same as the start script)
```

`npm run health` is a good extra check **after** the build — it confirms the
printer is reachable and that the bridge can talk to Firebase.

---

## Keeping it running (day to day)

- **Keep the black window open** while trading. Closing it = no auto-printing.
- If the laptop restarts, just run **Step 8** again.
- Want it to auto-start on boot and survive reboots? The bridge also supports a
  Windows service (`npm run install-service`, run as Administrator) — see the main
  `README.md` in the bridge folder. **For first go-live, use the visible window**
  so you can see the logs; switch to the service later once it’s proven.

---

## Troubleshooting

### Preflight says the printer is NOT reachable (`TcpTestSucceeded : False`)
The laptop can’t see the printer on the network. Work through:
- Confirm the laptop is on the **same Wi-Fi/LAN** as the printer (not a guest
  network, not a different SSID).
- Confirm the **printer’s IP is really `192.168.100.104`** (print a self-test /
  check the router). If it changed, update both `host` values in `config.json`.
- **Restart the printer and the router**, wait a minute, test again.
- Ask IT to **reserve/static-assign** the printer’s IP so it never changes.
- Check **firewall / VLAN / the payment-hub network restrictions** aren’t blocking
  the laptop → printer on port 9100.
- Quick manual test:
  `Test-NetConnection 192.168.100.104 -Port 9100`  → want `TcpTestSucceeded : True`.

### The bridge doesn’t show ONLINE in QR Ops
- Check `service-account.json` is present and is the **right** key (preflight step 4).
- Check the key has permission for the **`tng-systems`** database.
- Check `config.json` has **`databaseId": "tng-systems"`** and **`businessUnitId": "b1"`**.
- Check the laptop has **internet** (preflight step 6).
- Look at the black window — it prints the exact error on startup.

### Jobs stay PENDING (nothing prints)
- The bridge probably isn’t running or isn’t claiming jobs — check the black
  window is still open and shows “bridge online”.
- Re-run `npm run health` — it shows the last heartbeat and printer reachability.
- If health is fine but jobs don’t move, check the printer network test again
  (a job can’t print if the printer is unreachable — it’ll retry then mark FAILED).

### The printer prints garbage / weird characters
- Usually the wrong printer protocol/encoding. This bridge sends **raw ESC/POS on
  port 9100** (RAW/JetDirect) — the XP-Q801 supports this. Make sure you’re
  pointing at the **XP-Q801** on `:9100` and not some other device/port, and that
  the printer is in its normal ESC/POS mode (not a driver/label mode).

### Duplicate prints
- **Stop the bridge immediately** (Ctrl+C in the window / close it).
- Make sure **only one** bridge is running (only one laptop, one window).
- Tell the TNG admin — check the job claim/status logs before restarting.
- **Do not** just keep restarting and retrying blindly.

---

## Safety reminders

- 🔒 **Never commit or share** `service-account.json` or your real `config.json`.
  Both are already git-ignored in this package, but treat them like passwords.
- This bridge only **reads paid-order jobs and prints them**. It does not take
  payments, change orders, or touch the menu.
- One laptop, one bridge window. Two at once risks duplicate tickets.

---

*Questions or anything red you can’t clear? Send a photo of the black window (the
logs) to the TNG admin — the error is almost always printed right there.*
