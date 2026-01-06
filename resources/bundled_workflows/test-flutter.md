---
description: Flutter-specific verification checks (assets, splash, providers, IDE warnings)
matches: "^/test-flutter"
---
// turbo-all

# TechTest Flutter Verification Workflow

1.  **Static Analysis**:
    *   Agent: `TechTest`
    *   Action: Run Flutter analyzer.
    *   Commands:
        // turbo
        *   `flutter analyze --no-fatal-infos`
        // turbo
        *   `dart fix --dry-run`

2.  **Asset Verification**:
    *   Agent: `TechTest`
    *   Action: Verify all assets in `pubspec.yaml` exist.
    *   Check:
        *   All referenced assets exist on disk
        *   Image resolutions for different densities
        *   No unused assets bloating the bundle

3.  **Splash Screen & Icons**:
    *   Agent: `TechTest`
    *   Action: Verify splash and icon configuration.
    *   Commands:
        // turbo
        *   `flutter pub run flutter_native_splash:create --dry-run` (if applicable)
    *   Check:
        *   `flutter_native_splash.yaml` configured
        *   `flutter_launcher_icons.yaml` configured
        *   Assets exist at specified paths

4.  **Provider Architecture**:
    *   Agent: `TechTest`
    *   Action: Audit state management.
    *   Check:
        *   No direct Provider.of without listen:false in build methods
        *   Proper ChangeNotifier disposal
        *   No memory leaks from undisposed controllers

5.  **IDE Lint Warnings**:
    *   Agent: `TechTest`
    *   Action: Check for common issues.
    *   Check:
        *   No unused imports
        *   No deprecated API usage
        *   No `dynamic` types where avoidable
        *   Proper null safety

6.  **Dependency Audit**:
    *   Agent: `TechTest`
    *   Action: Check dependencies.
    *   Commands:
        // turbo
        *   `flutter pub outdated`
    *   Check:
        *   No severely outdated packages
        *   No known vulnerabilities

7.  **Report**:
    *   Output: Pass/Fail report with specific remediation steps.
