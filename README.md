# Agora WebRTC Troubleshooting Demo

A browser-based tool to exercise and debug [Agora Web SDK](https://docs.agora.io/en/sdks?platform=web) behavior: browser checks, microphone and speaker tests, resolution sweeps, and a short network-quality session with charts. The UI is vanilla HTML, CSS, and JavaScript (no framework).

## Branches

| Branch | Purpose |
|--------|---------|
| **`master`** (this branch) | Small **Node/Express** app: serves the UI from `public/`, exposes **`/api/config`** and optional **`/api/rtc-tokens`**. Credentials come from **environment variables** (see below). |
| **`no_appid`** | **Static** layout: `index.html`, `app.js`, and `styles.css` at the **repository root**. Developers enter **App ID, channel, tokens, and UIDs** in the UI—no backend or `.env`. |

## Features

- **Browser compatibility** check for the Agora Web SDK
- **Microphone** test with live level metering; **speaker** test with audible tone and confirm/deny controls
- **Resolution** sweep (e.g. 120p–1080p) with skip-safe flow
- **Network** test with bitrate and packet-loss charts (stats interpreted consistently with the SDK)
- **Per-step skip** controls and improved teardown when skipping
- **Cloud proxy** options in the UI (modes **3** and **5**)
- **Optional** server-generated RTC tokens when `AGORA_APP_CERTIFICATE` is set
- **Download logs** and a summarized **test report**

## Prerequisites

- **Node.js** 18+ recommended (for `master`)
- A modern desktop browser (Chrome, Firefox, Safari, or Edge)
- An [Agora](https://console.agora.io/) **App ID**; for token mode, an **App Certificate**
- **HTTPS** (or **localhost**) for camera/microphone access in the browser

## Quick start (`master`)

```bash
git clone https://github.com/AgoraIO-Solutions/webrtc-troubleshooting.git
cd webrtc-troubleshooting
npm install
cp .env.example .env
# Edit .env: set AGORA_APP_ID (required for a useful demo); optionally AGORA_APP_CERTIFICATE
npm start
```

Open **http://localhost:3000** (or the port set in `PORT`). The UI loads **App ID** from the server when configured; with a certificate set, the app can obtain **RTC tokens** and UIDs from **`POST /api/rtc-tokens`** automatically.

## Environment variables

Defined in `.env` (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `AGORA_APP_ID` | App ID returned by `GET /api/config` and used for token building |
| `AGORA_APP_CERTIFICATE` | If set with App ID, enables **`POST /api/rtc-tokens`** |
| `TOKEN_API_SECRET` | Optional. If set, clients must send `X-API-Key: <value>` (or `Authorization: Bearer <value>`) on token requests |
| `PORT` | HTTP port (default `3000`) |

Never commit `.env` or your certificate; they are listed in `.gitignore`.

## HTTP API (for operators)

- **`GET /api/config`** — JSON: `appId`, `tokenServiceEnabled`, and a short `message`.
- **`POST /api/rtc-tokens`** — JSON body: `channelName` (required); optional `sendUid`, `recvUid`, `tokenExpireSeconds`, `privilegeExpireSeconds`. Returns tokens and UIDs when the server is configured with App ID and certificate.

## Using the demo

1. Start the server (`npm start`) and open the app URL.
2. Optionally adjust **Cloud proxy** in the config area.
3. Click **Start Test** and walk through the five steps, or use **Skip** on any step.
4. Review the report and use **Download Logs** if you need a trace for support.

## Project layout (`master`)

```
webrtc-troubleshooting/
├── public/
│   ├── index.html      # Main UI
│   ├── app.js          # Client application
│   ├── styles.css
│   └── demo.html       # Extra demo page
├── server.js           # Express + static files + API routes
├── package.json
├── .env.example
└── README.md
```

## Stack

- **Frontend:** HTML5, CSS3, ES modules / modern JavaScript
- **Charts:** Google Charts (loaded from Google’s CDN)
- **SDK:** Agora Web SDK (loaded from Agora’s CDN in `index.html`)
- **Server:** Express 5, `dotenv`, `agora-token`

## Browser support

Recent versions of Chrome, Firefox, Safari, and Edge (WebRTC and `getUserMedia` required).

## Troubleshooting

- **No camera/microphone:** Use **HTTPS** or **http://localhost** and grant permissions when prompted.
- **Join/token errors:** Confirm App ID (and tokens if your project requires them). On `master`, ensure `.env` matches your Agora project and that token expiry is reasonable.
- **Charts empty:** Check the browser console and network tab; the chart library loads from Google’s CDN.

## Contributing

1. Fork the repository  
2. Create a feature branch  
3. Make and test your changes  
4. Open a pull request  

## License

ISC — see `package.json`. (A `LICENSE` file may be added separately by the maintainers.)

## Acknowledgments

- [Agora](https://www.agora.io/) for the Web SDK  
- Google Charts for visualization  
- Community feedback on WebRTC troubleshooting workflows  

## Support

For SDK or console issues, use [Agora support](https://www.agora.io/en/customer-support/) and attach downloaded logs from this tool when relevant.

---

**Note:** Use this demo in environments that match how you ship (network, proxy, token policy). It is for diagnostics, not a production app template.
