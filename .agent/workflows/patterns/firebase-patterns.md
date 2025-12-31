# Firebase & AI Patterns (Full Detail)

Comprehensive Firebase and AI service patterns with detailed explanations.

---

## Pattern A: SDK Migration (google_generative_ai → firebase_ai)

**When to apply**: pubspec.yaml contains `google_generative_ai` package

### Background
Google recommends migrating from the standalone `google_generative_ai` package to `firebase_ai` for:
- Integrated Firebase authentication
- Free tier through Firebase (no GCP billing needed)
- Consistent API across Firebase services
- Better error handling and logging

### OLD (Standalone SDK - DEPRECATED)
```dart
import 'package:google_generative_ai/google_generative_ai.dart';

class LegacyAIService {
  late GenerativeModel _model;
  
  Future<void> initialize() async {
    final apiKey = const String.fromEnvironment('GEMINI_API_KEY');
    _model = GenerativeModel(
      model: 'gemini-2.5-flash',
      apiKey: apiKey,
    );
  }
  
  Future<String> generateText(String prompt) async {
    final response = await _model.generateContent([Content.text(prompt)]);
    return response.text ?? '';
  }
}
```

### NEW (Firebase AI - FREE TIER)
```dart
import 'package:firebase_ai/firebase_ai.dart';

class ModernAIService {
  late GenerativeModel _model;
  
  Future<void> initialize() async {
    // No API key needed - uses Firebase project credentials
    _model = FirebaseAI.googleAI().generativeModel(
      model: 'gemini-2.5-flash',
    );
  }
  
  Future<String> generateText(String prompt) async {
    final response = await _model.generateContent([Content.text(prompt)]);
    return response.text ?? '';
  }
}
```

### Migration Steps
1. Add `firebase_ai` to pubspec.yaml
2. Remove `google_generative_ai` (optional, can keep as fallback)
3. Update imports
4. Remove API key usage (Firebase uses project auth)
5. Test thoroughly

---

## Pattern E: Billing-Safe AI Configuration

**When to apply**: Want to avoid unexpected charges

### Free Tier (googleAI)
```dart
// Uses Google AI Studio quota - FREE
_model = FirebaseAI.googleAI().generativeModel(
  model: 'gemini-2.5-flash',
);
```

### Paid Tier (vertexAI)
```dart
// Uses Vertex AI - REQUIRES GCP BILLING
_model = FirebaseAI.vertexAI().generativeModel(
  model: 'gemini-2.5-flash',
);
```

### How to Check Current Usage
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click on your profile → Usage
3. Monitor daily/monthly quotas

### Setting Usage Limits
In `firebase.json`:
```json
{
  "ai": {
    "maxRequestsPerMinute": 60,
    "maxTokensPerMonth": 1000000
  }
}
```

---

## Pattern F: Multi-Layer AI Fallback (Bypass Blocked Project)

**When to apply**: Firebase project is blocked for AI (400/403 errors)

> [!IMPORTANT]
> Use this ONLY when `FirebaseAI.googleAI()` fails due to project restrictions.
> Some Firebase regions/projects don't have AI enabled.

### Complete Fallback Implementation
```dart
import 'package:firebase_ai/firebase_ai.dart';
import 'package:google_generative_ai/google_generative_ai.dart' as genai;

class RobustAIService {
  static const String _apiKey = String.fromEnvironment('GEMINI_API_KEY');
  
  GenerativeModel? _firebaseModel;
  genai.GenerativeModel? _directModel;
  bool _useDirectAPI = false;

  Future<void> initialize() async {
    // Try Firebase AI first (free tier)
    try {
      _firebaseModel = FirebaseAI.googleAI().generativeModel(
        model: 'gemini-2.5-flash',
      );
      // Test with a simple request
      await _firebaseModel!.generateContent([Content.text('test')]);
      LoggerService.info('Using Firebase AI');
    } catch (e) {
      LoggerService.warning('Firebase AI failed: $e, falling back to direct API');
      _useDirectAPI = true;
      
      // Fall back to direct API
      if (_apiKey.isEmpty) {
        LoggerService.error('GEMINI_API_KEY not set. AI features disabled.');
        return;
      }
      _directModel = genai.GenerativeModel(
        model: 'gemini-2.5-flash',
        apiKey: _apiKey,
      );
    }
  }

  Future<String?> generateText(String prompt) async {
    try {
      if (_useDirectAPI && _directModel != null) {
        final response = await _directModel!.generateContent([
          genai.Content.text(prompt),
        ]);
        return response.text;
      } else if (_firebaseModel != null) {
        final response = await _firebaseModel!.generateContent([
          Content.text(prompt),
        ]);
        return response.text;
      }
      return null;
    } catch (e) {
      LoggerService.error('AI generation failed: $e');
      return null;
    }
  }
}
```

### Required pubspec.yaml
```yaml
dependencies:
  firebase_ai: ^0.3.0
  google_generative_ai: ^0.4.0  # Fallback
```

---

## Pattern G: Firestore Rules for New Collections

**When to apply**: Adding new collection but getting permission-denied

### Template Rule (User-Owned Documents)
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role == 'admin';
    }
    
    // New Collection Template
    match /newCollection/{docId} {
      // Read: only if authenticated and owns document
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      
      // Create: any authenticated user, must set their own userId
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      
      // Update: only owner, cannot change userId
      allow update: if isAuthenticated() && 
        resource.data.userId == request.auth.uid &&
        request.resource.data.userId == resource.data.userId;
      
      // Delete: only owner
      allow delete: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
    }
    
    // Admin-only collection
    match /adminData/{docId} {
      allow read, write: if isAdmin();
    }
  }
}
```

> [!WARNING]
> NEVER auto-deploy Firestore rules. Always:
> 1. Show rules diff to user
> 2. Wait for explicit approval
> 3. Then deploy with `firebase deploy --only firestore:rules`

### Testing Rules Locally
```powershell
# Install emulator
firebase emulators:start --only firestore

# Run rules tests
cd functions && npm run test:rules
```

---

## Pattern G2: Firestore Index Management

**When to apply**: Query fails with "requires an index" error

### Automatic Index Creation
When you see this error:
```
The query requires an index. You can create it here: https://...
```

Simply click the link - Firebase creates the index automatically.

### Manual Index Definition
In `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### Deploy Indexes
```powershell
firebase deploy --only firestore:indexes
```

---

## Pattern G3: Robust App Check Configuration

**When to apply**: App Check causing issues on developer devices or unlocked bootloaders.

### Problem
Play Integrity fails on devices with:
- Unlocked bootloaders
- Custom ROMs  
- Emulators
- Root access

This blocks Phone Auth SMS verification even when the app is legitimate.

### Solution: Graceful Fallback
```dart
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

Future<void> initializeAppCheck() async {
  try {
    // ignore: deprecated_member_use
    await FirebaseAppCheck.instance.activate(
      // Using deprecated params as new API has different constructor pattern
      // ignore: deprecated_member_use
      androidProvider: kReleaseMode
          ? AndroidProvider.playIntegrity
          : AndroidProvider.debug,
      // ignore: deprecated_member_use
      appleProvider: kReleaseMode
          ? AppleProvider.appAttest
          : AppleProvider.debug,
    );
    LoggerService.info('✅ AppCheck activated');
  } catch (e) {
    // App Check failed but app continues - Phone Auth will use reCAPTCHA fallback
    LoggerService.warning('⚠️ AppCheck failed: $e - Phone Auth will use reCAPTCHA');
  }
}
```

### Firebase Console Configuration
1. **App Check > APIs tab**: Set "Authentication" to **Unenforced** (allows reCAPTCHA fallback)
2. **App Check > Apps**: Register app with Play Integrity (Android) and App Attest (iOS)
3. **Project Settings > General**: Add BOTH SHA-1 AND SHA-256 fingerprints

### Test Phone Numbers (Developer Bypass)
For development on non-compliant devices:
1. Go to **Authentication > Sign-in method > Phone**
2. Add test number (e.g., `+5511999999999`) with code `123456`
3. This bypasses Play Integrity AND rate limits

### Rate Limit Awareness
| Error | Meaning | Solution |
|-------|---------|----------|
| `too-many-requests` | Device/number blocked | Wait 1-24 hours OR use Test Number |
| `app-not-authorized` | Play Integrity failed | Relock bootloader OR use Test Number |
| `invalid-verification-code` | Wrong code entered | Retry with correct code |

