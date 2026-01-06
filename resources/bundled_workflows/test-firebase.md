---
description: Firebase-specific verification (Firestore rules, billing, AI, SHA-1, Functions)
matches: "^/test-firebase"
---
// turbo-all

# TechTest Firebase Verification Workflow

1.  **Firestore Security Rules**:
    *   Agent: `TechTest`
    *   Action: Audit `firestore.rules` file.
    *   Check:
        *   No public read/write on sensitive collections
        *   User-scoped access patterns (`request.auth.uid == resource.data.userId`)
        *   Rate limiting rules if applicable

2.  **Cloud Functions Security**:
    *   Agent: `TechTest`
    *   Action: Audit all callable functions.
    *   Check:
        *   `enforceAppCheck: true` on all functions
        *   Authentication validation
        *   Input sanitization
        *   No hardcoded secrets

3.  **Firebase AI Integration**:
    *   Agent: `TechTest`
    *   Action: Verify AI service configuration.
    *   Check:
        *   API keys not in client code
        *   Rate limiting implemented
        *   Fallback mechanisms working

4.  **SHA-1/SHA-256 Configuration**:
    *   Agent: `TechTest`
    *   Action: Verify app signing.
    *   Commands:
        // turbo
        *   `cd android && ./gradlew signingReport` (if Android)
    *   Check: SHA fingerprints match Firebase Console

5.  **App Check Configuration**:
    *   Agent: `TechTest`
    *   Action: Verify App Check setup.
    *   Check:
        *   Play Integrity (Android) / DeviceCheck (iOS) configured
        *   Debug token for development
        *   Enforcement enabled in production

6.  **Billing & Quotas**:
    *   Agent: `TechTest`
    *   Action: Review Firebase billing alerts.
    *   Check:
        *   Budget alerts configured
        *   Blaze plan requirements met
        *   No runaway costs from misconfigured queries

7.  **Report**:
    *   Output: Pass/Fail report with specific remediation steps.
