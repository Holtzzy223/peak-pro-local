# Peak Local

A personal web app for the Puffco Peak Pro that edits the four on-device heat profiles and keeps an unlimited library of presets on your phone. There is no account and no cloud; presets live in the browser's IndexedDB storage.

Bluetooth communication uses [puffcoble-ts](https://www.npmjs.com/package/puffcoble-ts), a community, reverse-engineered implementation of Puffco's protocol. This project is not affiliated with Puffco, and firmware updates may break compatibility.

## Using it on iPhone

Safari on iPhone does not support Web Bluetooth, so the app has to run inside **Path Browser** (the same Bluetooth-capable browser Puffco uses for puffco.app).

1. Host the app over HTTPS (see below).
2. Open Path Browser, go to your app's URL, and bookmark it.
3. Force-close the official Puffco app and any puffco.app tabs. The Peak only accepts one Bluetooth connection at a time.
4. Put the Peak in pairing mode by holding the button until the light bar turns blue.
5. Tap **Connect to Peak** and pick your device.

Presets are stored per browser and per URL. If you change hosting addresses, export your library first and import it at the new address.

## Running locally

```powershell
npm install
npm run dev
```

The dev server runs over HTTPS with a self-signed certificate at `https://localhost:5173` and on your local network address. Desktop Chrome or Edge can connect directly. A phone on the same Wi-Fi can open the network URL, but you must accept the certificate warning first.

## Hosting

The app is published with GitHub Pages. Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes it to `https://<your-username>.github.io/peak-pro-local/`.

One-time setup: on GitHub, open the repository's **Settings > Pages** and set **Source** to **GitHub Actions**. Free GitHub accounts can only use Pages on public repositories.

## Troubleshooting

- **The device doesn't appear in the chooser.** Close the Puffco app completely, toggle Bluetooth off and on, then put the Peak back into pairing mode.
- **Connection drops after the Peak sleeps.** Tap Connect again. The app reattaches to a previously paired device when the browser supports it.
- **"Bluetooth isn't available here."** You're in Safari or on a page without HTTPS. Use Path Browser on iPhone, or Chrome or Edge on desktop.
- **Pairing still fails.** Remove the Peak from iPhone Bluetooth settings, restart both devices, and try again.

## Backups

On the Library tab, use **Export all** to download a JSON file and **Import** to restore it. Importing merges by preset ID, so importing the same file twice will not create duplicates.
