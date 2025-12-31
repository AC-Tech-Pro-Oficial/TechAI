# Build Configuration Patterns

Patterns for fixing Gradle, JVM, and build system warnings.

---

## Pattern R: Gradle JVM Optimization

**When to apply**: JVM native access warnings or memory issues during build

### Problem Signs
- `Restricted methods will be blocked in a future release`
- `OutOfMemoryError: Metaspace`
- Build takes excessively long

### Fix: gradle.properties

```properties
# Memory settings (adjust based on available RAM)
org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m -Dfile.encoding=UTF-8

# JDK 21+ native access (suppresses deprecation warnings)
# Add these flags to the jvmargs line:
# --add-opens=java.base/java.lang=ALL-UNNAMED
# --add-opens=java.base/java.util=ALL-UNNAMED

# Performance optimizations
org.gradle.daemon=true
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configuration-cache=true

# Kotlin daemon memory (for large projects)
kotlin.daemon.jvm.options=-Xmx4096m
```

### Complete Example
```properties
org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m -Dkotlin.daemon.jvm.options=-Xmx4096m -Dfile.encoding=UTF-8 --add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED
android.useAndroidX=true
org.gradle.daemon=true
org.gradle.caching=true
org.gradle.parallel=true
org.gradle.configuration-cache=true
```

---

## Pattern S: Pre-Build Cleanup Script

**When to apply**: 
- `Could not close incremental caches` errors
- Multiple Flutter processes running
- Build hangs or fails intermittently

### Problem Signs
- Terminal shows multiple running Flutter/Gradle processes
- Errors about locked files or caches
- Builds fail with `daemon disappeared unexpectedly`

### Fix: clean_build.ps1

```powershell
#!/usr/bin/env pwsh
# Clean Build Script - Stops daemons, cleans cache, rebuilds

param(
    [switch]$Release,
    [string]$DefinesFile = "dart_defines.dev.json"
)

Write-Host "🧹 Stopping Gradle daemons..." -ForegroundColor Cyan
if (Test-Path android/gradlew) { 
    ./android/gradlew --stop 2>$null 
}

Write-Host "🔪 Killing orphan processes..." -ForegroundColor Cyan
Get-Process dart -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process java -ErrorAction SilentlyContinue | 
    Where-Object { $_.MainWindowTitle -match "gradle" } | 
    Stop-Process -Force 2>$null

Write-Host "🗑️ Cleaning Flutter cache..." -ForegroundColor Cyan
flutter clean

Write-Host "📦 Reinstalling dependencies..." -ForegroundColor Cyan
flutter pub get

$buildMode = if ($Release) { "--release" } else { "--debug" }
Write-Host "🚀 Starting $buildMode build..." -ForegroundColor Green
flutter run $buildMode --dart-define-from-file=$DefinesFile
```

### Usage
```powershell
# Debug build
./clean_build.ps1

# Release build
./clean_build.ps1 -Release

# With custom defines file
./clean_build.ps1 -Release -DefinesFile "dart_defines.prod.json"
```

---

## Pattern T: Kotlin Version Alignment

**When to apply**: `Unchecked cast` warnings from Kotlin

### Problem Signs
- Many `Unchecked cast of 'kotlin.Any?' to...` warnings
- Kotlin version mismatch between project and dependencies

### Check Current Version
```powershell
# In build.gradle.kts
rg "kotlin-gradle-plugin" android/build.gradle.kts
```

### Fix: Update to Latest Kotlin

In `android/build.gradle.kts`:
```kotlin
dependencies {
    classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0")  // Use latest stable
}
```

> [!NOTE]
> Kotlin unchecked cast warnings from third-party plugins (google-services, firebase) 
> are generally safe to ignore as they don't affect your app's runtime behavior.

---

## Pattern U: R8/ProGuard Keep Rules

**When to apply**: `R8: Missing class` warnings during release builds

### Problem Signs
- Release build shows `R8: Missing class: X` warnings
- App crashes with `ClassNotFoundException` in release mode only
- Reflection-based features don't work in release

### Fix: proguard-rules.pro

```proguard
# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep Gson/JSON serialization
-keepattributes Signature
-keepattributes *Annotation*
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep model classes (adjust package name)
-keep class com.actech.techair.models.** { *; }

# Keep reflection targets
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
```

### Enable in build.gradle
```kotlin
buildTypes {
    release {
        minifyEnabled = true
        shrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

---

## Quick Reference

| Warning | Pattern | Auto-Fix |
|---------|---------|----------|
| JVM native access | R | ✅ Yes |
| Daemon cache errors | S | ✅ Yes |
| Kotlin unchecked cast | T | ⚠️ Usually ignore |
| R8 missing class | U | ⚠️ Add keep rules |
