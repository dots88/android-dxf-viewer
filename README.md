# Android DXF Viewer (Free, Offline)

Free Android app to view DXF files offline. DWG supported via external conversion (e.g., export to DXF). No proprietary SDKs.

- Kotlin + Jetpack Compose + WebView (AndroidView)
- Local HTML/JS viewer (no network)
- Features (MVP):
  - Open DXF via Storage Access Framework
  - Render LINE entities
  - Pan/zoom
  - Layer toggles

## Build
- Open in Android Studio (Giraffe+).
- Ensure Android Gradle Plugin 8.x.
- Build and run on Android 8.0+ (API 26+).

## DWG Support
Use external conversion (e.g., AutoCAD export to DXF, LibreDWG on server under GPL if desired). This app focuses on DXF to remain on permissive licenses.

## Licenses
- App code: Apache-2.0
