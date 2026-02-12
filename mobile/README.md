# POS Mobile (Expo)

This mobile app is connected to the existing POS backend in `backend/src/index.ts`.
It uses the same auth and data API as your web/desktop app so mobile and PC stay in sync.

## Features included

- Login (`/auth/login` with auto first admin setup fallback)
- Cashier billing flow (`/products`, `/customers`, `/sales`)
- Sales history (`/sales`)
- Product browsing/search (`/products`)
- Admin summary and users (`/reports/summary`, `/users`)

## Setup

1. Install dependencies:

```powershell
cd mobile
npm install
```

2. Set your backend URL:

```powershell
$env:EXPO_PUBLIC_API_URL="http://YOUR_SERVER_IP:4000"
```

Examples:
- Android emulator: `http://10.0.2.2:4000`
- iOS simulator on Mac: `http://localhost:4000`
- Real phone on same Wi-Fi: `http://192.168.x.x:4000`

3. Start Expo:

```powershell
npm run start
```

## Important

- Do not keep `http://localhost:4000` for real devices.
- Backend CORS must allow your mobile app requests.
- Use HTTPS and a public domain when hosting on Railway.
