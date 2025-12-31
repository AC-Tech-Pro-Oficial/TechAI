# Auth Patterns (Full Detail)

Comprehensive authentication patterns for passkeys, biometrics, and phone auth.

---

## Pattern H: Passkey/Biometric Implementation

**When to apply**: Adding passkey or biometric authentication

### Prerequisites
1. Add `local_auth` to pubspec.yaml
2. Add Firestore rules for `passkeys` collection (see firebase-patterns.md Pattern G)
3. Configure platform-specific settings

### Platform Configuration

#### Android (android/app/src/main/AndroidManifest.xml)
```xml
<manifest>
  <uses-permission android:name="android.permission.USE_BIOMETRIC"/>
  <uses-permission android:name="android.permission.USE_FINGERPRINT"/>
</manifest>
```

#### iOS (ios/Runner/Info.plist)
```xml
<key>NSFaceIDUsageDescription</key>
<string>Usamos Face ID para autenticação segura</string>
```

### BiometricAuthService Implementation
```dart
import 'package:local_auth/local_auth.dart';

class BiometricAuthService {
  static final LocalAuthentication _localAuth = LocalAuthentication();

  /// Check if biometrics are available on this device
  static Future<bool> isBiometricAvailable() async {
    try {
      final isAvailable = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return isAvailable && isDeviceSupported; // Check BOTH conditions
    } catch (e) {
      LoggerService.error('Biometric check failed: $e');
      return false;
    }
  }

  /// Get available biometric types
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _localAuth.getAvailableBiometrics();
    } catch (e) {
      LoggerService.error('Failed to get biometrics: $e');
      return [];
    }
  }

  /// Authenticate with biometrics
  static Future<Map<String, dynamic>> authenticate({
    String reason = 'Autentique-se para continuar',
  }) async {
    // Check availability first
    if (!await isBiometricAvailable()) {
      return {
        'success': false,
        'error': 'Biometria não disponível neste dispositivo',
        'code': 'NOT_AVAILABLE',
      };
    }

    try {
      final didAuthenticate = await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // Allow PIN/pattern fallback
          useErrorDialogs: true,
        ),
      );

      return {
        'success': didAuthenticate,
        'error': didAuthenticate ? null : 'Autenticação cancelada',
        'code': didAuthenticate ? 'SUCCESS' : 'CANCELLED',
      };
    } on PlatformException catch (e) {
      String errorMessage;
      switch (e.code) {
        case 'NotAvailable':
          errorMessage = 'Biometria não configurada';
          break;
        case 'NotEnrolled':
          errorMessage = 'Nenhuma biometria cadastrada';
          break;
        case 'LockedOut':
          errorMessage = 'Muitas tentativas. Tente novamente mais tarde';
          break;
        case 'PermanentlyLockedOut':
          errorMessage = 'Biometria bloqueada. Use sua senha do dispositivo';
          break;
        default:
          errorMessage = 'Erro de autenticação: ${e.message}';
      }
      
      return {
        'success': false,
        'error': errorMessage,
        'code': e.code,
      };
    }
  }
}
```

### Usage Example
```dart
Future<void> _handleLogin() async {
  final result = await BiometricAuthService.authenticate(
    reason: 'Confirme sua identidade para acessar',
  );
  
  if (result['success']) {
    Navigator.pushReplacementNamed(context, '/home');
  } else {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(result['error'])),
    );
  }
}
```

---

## Pattern I: Async Callback Handling (CRITICAL)

**When to apply**: Firebase methods that use callbacks (e.g., `verifyPhoneNumber`)

### The Problem
Firebase Phone Auth uses a callback-based API. If you return from the function before the callback fires, you get **silent failures** - the function returns success but nothing actually happened.

### WRONG (Returns before callback fires)
```dart
Future<bool> sendSMS(String phone) async {
  await _auth.verifyPhoneNumber(
    phoneNumber: phone,
    verificationCompleted: (credential) {
      // This runs AFTER the function returns
    },
    verificationFailed: (error) {
      // This also runs AFTER the function returns
    },
    codeSent: (id, token) {
      // This too runs AFTER
    },
    codeAutoRetrievalTimeout: (id) {},
  );
  return true; // BUG: Returns IMMEDIATELY, not after callback
}
```

### CORRECT (Uses Completer to wait for callback)
```dart
import 'dart:async';

class PhoneAuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  String? _verificationId;
  int? _resendToken;

  /// Send SMS verification code
  /// Returns true if SMS was sent, false otherwise
  Future<Map<String, dynamic>> sendVerificationCode(String phone) async {
    final completer = Completer<Map<String, dynamic>>();
    
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      timeout: const Duration(seconds: 60),
      forceResendingToken: _resendToken,
      
      verificationCompleted: (PhoneAuthCredential credential) async {
        // Auto-verification on Android (rare)
        LoggerService.info('Auto-verified phone');
        if (!completer.isCompleted) {
          completer.complete({
            'success': true,
            'autoVerified': true,
            'credential': credential,
          });
        }
      },
      
      verificationFailed: (FirebaseAuthException error) {
        LoggerService.error('Phone verification failed: ${error.message}');
        if (!completer.isCompleted) {
          completer.complete({
            'success': false,
            'error': _getErrorMessage(error.code),
            'code': error.code,
          });
        }
      },
      
      codeSent: (String verificationId, int? resendToken) {
        LoggerService.info('SMS sent to $phone');
        _verificationId = verificationId;
        _resendToken = resendToken;
        if (!completer.isCompleted) {
          completer.complete({
            'success': true,
            'autoVerified': false,
            'verificationId': verificationId,
          });
        }
      },
      
      codeAutoRetrievalTimeout: (String verificationId) {
        LoggerService.warning('Auto-retrieval timeout');
        _verificationId = verificationId;
      },
    );
    
    return completer.future; // WAITS for one of the callbacks to fire
  }

  /// Verify the SMS code entered by user
  Future<Map<String, dynamic>> verifySMSCode(String code) async {
    if (_verificationId == null) {
      return {'success': false, 'error': 'Envie o código primeiro'};
    }
    
    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId!,
        smsCode: code,
      );
      await _auth.signInWithCredential(credential);
      return {'success': true};
    } on FirebaseAuthException catch (e) {
      return {
        'success': false,
        'error': _getErrorMessage(e.code),
        'code': e.code,
      };
    }
  }

  String _getErrorMessage(String code) {
    switch (code) {
      case 'invalid-phone-number':
        return 'Número de telefone inválido';
      case 'too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos';
      case 'invalid-verification-code':
        return 'Código incorreto';
      case 'session-expired':
        return 'Código expirado. Solicite um novo';
      default:
        return 'Erro de verificação';
    }
  }
}
```

### Key Points
1. **Always use `Completer<T>`** for callback-based APIs
2. **Check `!completer.isCompleted`** before completing (prevents double-complete errors)
3. **Log the actual error** in callbacks for debugging
4. **Store verification state** (_verificationId, _resendToken) for later use
5. **Handle all four callbacks** - each represents a different outcome
