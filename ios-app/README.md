# iOS Wrapper

This directory contains a minimal iOS wrapper written in Swift. The app uses `WKWebView` to load the Todo Events website. When the user navigates to the subscription flow (`/subscribe`), the link opens in Safari so payments are handled outside the app. A refresh control and loading spinner are included for a smoother experience. It respects the device's light or dark mode to blend in with iOS.

## Running Locally

1. Open Xcode and create a new **App** project.
2. Replace the default `AppDelegate`, `SceneDelegate`, and `ViewController` files with the ones in `TodoEventsApp/`.
3. Add the contents of `Info.plist` to your project's Info.plist.
4. Build and run the app on a simulator or device running iOS 14 or later.

The wrapper simply embeds the website and defers payment pages to Safari, avoiding in‑app purchase fees.
