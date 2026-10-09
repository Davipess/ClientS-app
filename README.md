# ClientS Pro

Android utility that detects missed phone calls and sends automatic SMS responses in the background.

## Status

Prototype, not in production.

## What It Does

- Listens for missed phone calls and dispatches a customizable SMS template to the caller.
- Runs autonomously in the background even when the app is closed or the device enters Android Doze Mode.
- Enforces an anti-spam cooldown window so callers do not receive repeat messages within a short interval.
- Supports VIP number bypass and blacklists to filter incoming numbers.
- Checks monthly subscription licenses against a remote Supabase database.

## How I Built It

I directed AI-assisted development of this project. My initial React Native implementation failed whenever the phone screen turned off, because Android Doze Mode suspended the JavaScript runtime. To solve this, I designed and debugged a native Android Kotlin module using a BroadcastReceiver and CallKeeperService. I chose Android SharedPreferences as the single source of truth for cooldown timers and dispatch logs so the native service could read and write state without waking the JavaScript engine. I used AI tools to generate the boilerplate Kotlin and React Native bridge code, while I tested and debugged the lifecycle behavior on real hardware.

## Tech Stack

- Android SDK (Kotlin)
- React Native
- Expo
- TypeScript
- Android Telephony APIs and SharedPreferences
- Supabase (PostgreSQL for license checks)

## How to Run

1. Clone repository and install dependencies:
```bash
git clone https://github.com/Davipess/ClientS-app.git
cd ClientS-app
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Add your Supabase project URL and anon key
```

3. Build and launch on a connected Android device:
```bash
npx expo run:android
```

## Tests

No automated test suite exists. Validation was conducted manually on a physical Android device using Android Debug Bridge (ADB):

```bash
adb logcat -s CallKeeper:D SMSHandler:I
```

Testing verified two main scenarios:
1. Triggering an incoming call while the app was swiped away from recent tasks to verify native broadcast interception and SMS dispatch.
2. Placing a second call within the cooldown window to confirm suppression of duplicate SMS messages.

## Known Limitations and Next Steps

- Android only: iOS does not grant third-party applications access to incoming call events or automatic SMS transmission.
- Google Play Store restrictions: SEND_SMS and READ_CALL_LOG are high-risk permissions that require strict policy exceptions, making wide store distribution difficult.
- Device vendor battery killers: aggressive OEM battery managers can still terminate background services unless the user manually grants background battery exceptions.
- Next steps include adding local unit tests for cooldown calculations and exploring WhatsApp Web automation as an alternative channel.

## License

MIT License.
