# Mobile Dev Network Quick Guide

When you move between offices/Wi-Fi networks, Expo connectivity can fail depending on router isolation and ngrok status.

## Recommended start commands

From `apps/mobile-public`:

```bash
npm run health:check
npm run start:auto
```

This script tries:
0. Runs `health:check` first and auto-runs `npm install` if dependencies are missing.
1. `expo start --host tunnel -c`
2. Falls back to `expo start --host lan -c` if tunnel fails.

`health:check` validates:
1. Required Expo env vars exist.
2. No duplicated lockfile (`package-lock 2.json`).
3. Babel config does not use deprecated `expo-router/babel`.
4. `node_modules` has no duplicated folders from broken installs.
5. `npm ls --depth=0` has no `extraneous` packages.

## Manual options

```bash
npm run start:tunnel:clear
npm run start:lan:clear
```

## If LAN still fails

1. Connect Mac and iPhone to the same network.
2. Avoid guest Wi-Fi with client isolation.
3. Disable VPN / iCloud Private Relay on the device.
4. Use iPhone hotspot and connect the Mac to it.

## If tunnel fails

Tunnel depends on ngrok availability and internet stability.
If you see `remote gone away`, use LAN/hotspot for that session.
