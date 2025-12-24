# TodoEvents iOS App

This is the native iOS port of the TodoEvents web application - a map-based event discovery platform.

## Project Setup

### Option 1: Create Xcode Project (Recommended)

1. Open Xcode
2. Create a new project:
   - **File > New > Project**
   - Choose **iOS > App**
   - Product Name: `TodoEvents`
   - Team: Your team
   - Organization Identifier: `com.yourcompany`
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Uncheck "Include Tests" for now

3. Delete the default files Xcode creates (ContentView.swift, etc.)

4. Drag all files from `TodoEvents/` folder into your Xcode project:
   - `App/`
   - `Config/`
   - `Models/`
   - `Services/`
   - `ViewModels/`
   - `Views/`
   - `Resources/`

5. Configure Info.plist:
   - Add the keys from `Config/Info.plist` to your project's Info.plist
   - Or replace the Info.plist entirely

6. Update Bundle Identifier to your own (e.g., `com.yourcompany.todoevents`)

### Option 2: Use the files directly

If you prefer, you can also create the Xcode project via command line:

```bash
cd /Users/user/Documents/todoevents/ios
xcodegen generate  # If you have XcodeGen installed
```

## Configuration

### API
The app is pre-configured to use:
- **API URL**: `https://todoevents-backend.onrender.com`

### Google Maps (Optional)
The app uses native MapKit by default. If you want to use Google Maps:

1. Get a Google Maps iOS API key from [Google Cloud Console](https://console.cloud.google.com)
2. Add to Info.plist: `GOOGLE_MAPS_API_KEY`
3. Install Google Maps SDK via CocoaPods or SPM

### Location Permissions
The app requests location permission on first launch to:
- Center the map on user's location
- Show distance to events
- Fetch nearby events

## Features

- ✅ Map view with event markers (color-coded by category)
- ✅ Event list with filtering by category
- ✅ Event details with directions and sharing
- ✅ User authentication (login/register)
- ✅ Event creation with address search
- ✅ 11 event categories matching web app

## Architecture

```
TodoEvents/
├── App/           # App entry point
├── Config/        # Configuration constants
├── Models/        # Data models (User, Event, Category)
├── Services/      # API client, Auth, Keychain
├── ViewModels/    # Observable view models
├── Views/         # SwiftUI views
│   ├── Auth/      # Login/Register
│   ├── Events/    # Event list, detail, create
│   ├── Map/       # Map view with markers
│   └── Shared/    # Reusable components
└── Resources/     # Assets
```

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+

## Running the App

1. Open in Xcode
2. Select your target device/simulator
3. Press **⌘R** to run

The app will automatically connect to the live backend at `https://todoevents-backend.onrender.com`.
