# Quality Patterns (Full Detail)

Comprehensive code quality patterns for cleanup, refactoring, and testing.

---

## Pattern J: Zombie File Cleanup

**When to apply**: `test` reports orphan/zombie files

> [!CAUTION]
> File deletion is IRREVERSIBLE. Follow these steps exactly.

### Pre-Deletion Checklist
1. ✅ File is not a barrel/index file
2. ✅ File is not conditionally imported (platform-specific)
3. ✅ File is not used via reflection/dynamic imports
4. ✅ File is not referenced in pubspec.yaml assets
5. ✅ Backup created

### Step-by-Step Process

#### 1. Verify File is Truly Unused
```powershell
$file = "lib/old_feature.dart"
$basename = Split-Path $file -Leaf

# Check for imports
rg "import.*$basename" lib/ --files-with-matches

# Check for part references
rg "part.*$basename" lib/ --files-with-matches

# Check for dynamic imports
rg "'$basename'|\"$basename\"" lib/ --files-with-matches
```

#### 2. Create Backup
```powershell
$backupDir = ".zombie_backups/$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item $file "$backupDir/$(Split-Path $file -Leaf).bak" -Force
Write-Host "Backup created: $backupDir"
```

#### 3. Delete File
```powershell
Remove-Item $file
```

#### 4. Run Tests to Verify
```powershell
flutter test
if ($LASTEXITCODE -ne 0) {
  Write-Host "Tests failed! Restoring from backup..."
  Copy-Item "$backupDir/*.bak" $file -Force
  Write-Host "File restored. Investigate why tests failed."
}
```

#### 5. Clean Up Related Files
```powershell
# If main file was lib/features/old_feature.dart
# Check for related test file
$testFile = "test/features/old_feature_test.dart"
if (Test-Path $testFile) {
  Copy-Item $testFile "$backupDir/" -Force
  Remove-Item $testFile
}
```

### Automated Safe Delete
```powershell
$file = "lib/old.dart"; $bak = ".zombie_backups/$(Get-Date -F 'yyyy-MM-dd')"
New-Item -ItemType Directory -Path $bak -Force | Out-Null
Copy-Item $file "$bak/" -Force; Remove-Item $file
flutter test --reporter compact
if ($LASTEXITCODE -ne 0) { Copy-Item "$bak/*" (Split-Path $file) -Force; Write-Warning "Restored" }
```

---

## Pattern K: Efficiency Anti-Patterns

**When to apply**: `test` reports performance issues

### K1: Sync I/O in Async Context

**Problem**: Synchronous file operations block the event loop.

**Detection**:
```powershell
rg "readAsStringSync|writeAsStringSync|readAsBytesSync|writeAsBytesSync" lib/
```

**WRONG:**
```dart
String loadConfig() {
  return File('config.json').readAsStringSync(); // BLOCKS entire app
}
```

**CORRECT:**
```dart
Future<String> loadConfig() async {
  return await File('config.json').readAsString(); // Non-blocking
}
```

### K2: Nested Loops (O(n²) or worse)

**Problem**: Performance degrades exponentially with data size.

**Detection**:
```powershell
rg "for.*\{[\s\S]*?for.*\{" lib/ --multiline
```

**WRONG:**
```dart
List<OrderWithUser> matchOrdersToUsers(List<Order> orders, List<User> users) {
  final result = <OrderWithUser>[];
  for (var order in orders) {           // O(n)
    for (var user in users) {           // O(m)
      if (order.userId == user.id) {    // Total: O(n*m)
        result.add(OrderWithUser(order, user));
        break;
      }
    }
  }
  return result;
}
```

**CORRECT:**
```dart
List<OrderWithUser> matchOrdersToUsers(List<Order> orders, List<User> users) {
  // Pre-index users by ID: O(m)
  final usersById = {for (var u in users) u.id: u};
  
  // Single pass through orders: O(n)
  return orders
    .where((o) => usersById.containsKey(o.userId))
    .map((o) => OrderWithUser(o, usersById[o.userId]!))
    .toList();
  // Total: O(n + m)
}
```

### K3: Undisposed Listeners

**Problem**: Memory leaks from listeners not being cleaned up.

**Detection**:
```powershell
# Find addListener calls
rg "addListener|addEventListener|listen\(" lib/ -c

# Then check for dispose
rg "removeListener|removeEventListener|cancel\(\)" lib/ -c
```

**WRONG:**
```dart
class _MyWidgetState extends State<MyWidget> {
  @override
  void initState() {
    super.initState();
    _controller.addListener(_onControllerChange);
    _subscription = _stream.listen(_onData);
    // Never cleaned up!
  }
}
```

**CORRECT:**
```dart
class _MyWidgetState extends State<MyWidget> {
  late final StreamSubscription _subscription;
  
  @override
  void initState() {
    super.initState();
    _controller.addListener(_onControllerChange);
    _subscription = _stream.listen(_onData);
  }
  
  @override
  void dispose() {
    _controller.removeListener(_onControllerChange);
    _subscription.cancel();
    _controller.dispose(); // If widget owns the controller
    super.dispose();
  }
}
```

### K4: Building Widgets in Loops

**Problem**: Unnecessary widget rebuilds, no diffing optimization.

**WRONG:**
```dart
Column(
  children: items.map((item) => ExpensiveWidget(data: item)).toList(),
)
```

**CORRECT:**
```dart
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ExpensiveWidget(
    key: ValueKey(items[index].id), // KEY enables efficient diffing
    data: items[index],
  ),
)
```

---

## Pattern L: TODO/FIXME Cleanup

**When to apply**: `test` reports TODO/FIXME markers

### Priority Matrix
| Marker | Meaning | Action |
|--------|---------|--------|
| `FIXME` | Known bug | Create issue, fix ASAP |
| `TODO` | Planned work | Create issue, schedule |
| `HACK` | Workaround | Create issue, plan proper fix |
| `XXX` | Dangerous code | Review immediately |
| `DEPRECATED` | Old code | Plan removal |

### Process

#### 1. List All TODOs
```powershell
rg "TODO|FIXME|HACK|XXX" lib/ --glob "*.dart" -n > todos.txt
```

#### 2. Create GitHub Issues
For each high-priority item, create an issue:
```
Title: [FIXME] Description from comment
Body: 
- File: lib/path/to/file.dart:123
- Context: Explain the problem
- Proposed solution: How to fix
```

#### 3. Replace Comment with Issue Link
```dart
// BEFORE:
// TODO: Add pagination support for large lists

// AFTER:
// See: https://github.com/ACTechPRO/TechAir/issues/123
```

#### 4. For Resolved TODOs
Simply delete the comment - the fix is in git history.

---

## Pattern M: Magic Number Extraction

**When to apply**: `test` reports hardcoded values

### What Are Magic Numbers?
Literal values in code with unclear meaning:
- `if (retryCount > 3)` - Why 3?
- `Duration(seconds: 30)` - Why 30?
- `'https://api.example.com'` - Should be configurable

### Create Constants File
**File**: `lib/core/constants/app_constants.dart`
```dart
/// App-wide constants
/// 
/// Use these instead of hardcoded values throughout the app.
class AppConstants {
  AppConstants._(); // Prevent instantiation
  
  // Network
  static const int maxRetryAttempts = 3;
  static const Duration httpTimeout = Duration(seconds: 30);
  static const Duration retryDelay = Duration(milliseconds: 500);
  
  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  
  // Validation
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;
  static const int phoneNumberLength = 11; // Brazilian format
  
  // UI
  static const double defaultBorderRadius = 8.0;
  static const Duration animationDuration = Duration(milliseconds: 300);
}
```

### For URLs/Endpoints
Use environment variables (dart_defines):
```dart
class ApiConstants {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.example.com',
  );
}
```

---

## Pattern N: Reduce Code Duplication

**When to apply**: `test` reports duplicate code patterns

### N1: Extract Common Utilities
```dart
// BEFORE (in multiple files):
String formatPrice(double value) {
  return 'R\$ ${value.toStringAsFixed(2)}';
}

// AFTER (lib/shared/utils/formatters.dart):
extension PriceFormatter on double {
  String toPrice() => 'R\$ ${toStringAsFixed(2)}';
}

// Usage:
final display = product.price.toPrice(); // "R$ 49.90"
```

### N2: Use Mixins for Widget Logic
```dart
// Create lib/shared/mixins/ui_feedback_mixin.dart
mixin UIFeedbackMixin<T extends StatefulWidget> on State<T> {
  void showLoading() { /* show overlay */ }
  void hideLoading() { /* remove overlay */ }
  void showError(String msg) { ScaffoldMessenger.of(context).showSnackBar(...); }
}

// Usage: class _MyState extends State<MyScreen> with UIFeedbackMixin
```

---

## Pattern O: Improve Test Coverage

**When to apply**: `test` reports <60% coverage

### Priority Order
1. **Services** - Business logic, highest value
2. **Models** - Data validation, serialization
3. **Utils** - Helper functions
4. **Widgets** - UI components (lower priority)

### Test Template
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';

// Mocks
class MockHttpClient extends Mock implements HttpClient {}

void main() {
  late OrderService service;
  late MockHttpClient mockClient;

  setUp(() {
    mockClient = MockHttpClient();
    service = OrderService(client: mockClient);
  });

  group('OrderService', () {
    group('createOrder', () {
      test('should return order when API call succeeds', () async {
        // Arrange
        when(mockClient.post(any, body: anyNamed('body')))
          .thenAnswer((_) async => Response('{"id": "123"}', 200));
        
        // Act
        final result = await service.createOrder(orderData);
        
        // Assert
        expect(result.isSuccess, isTrue);
        expect(result.data?.id, equals('123'));
      });

      test('should return error when API call fails', () async {
        // Arrange
        when(mockClient.post(any, body: anyNamed('body')))
          .thenThrow(NetworkException('No connection'));
        
        // Act
        final result = await service.createOrder(orderData);
        
        // Assert
        expect(result.isFailure, isTrue);
        expect(result.error, contains('connection'));
      });

      test('should validate order data before sending', () async {
        // Arrange
        final invalidOrder = OrderData(amount: -100);
        
        // Act & Assert
        expect(
          () => service.createOrder(invalidOrder),
          throwsA(isA<ValidationException>()),
        );
      });
    });
  });
}
```

### Coverage Commands
```powershell
# Generate coverage
flutter test --coverage

# View coverage report
genhtml coverage/lcov.info -o coverage/html
start coverage/html/index.html
```

---

## Pattern P: Service Return Key Standardization

**When to apply**: Service returns document data that screens consume

### Problem
Services returning `{'id': doc.id, ...}` but screens expecting `{'orcamentoId': ...}` causes runtime errors that pass static analysis.

### Detection
```powershell
# Find services returning only 'id' without typed key
rg "return \{'id': doc\.id" lib/core/services --glob "*.dart" -A 3
```

### Fix Template
```dart
// BEFORE (Inconsistent - screen contract may differ):
static Future<Map<String, dynamic>?> buscarOrcamentoCompleto(String orcamentoId) async {
  final doc = await orcamentos.doc(orcamentoId).get();
  return {'id': doc.id, ...(data ?? {})};  // ❌ Only 'id'
}

// AFTER (Explicit - honors screen contracts):
static Future<Map<String, dynamic>?> buscarOrcamentoCompleto(String orcamentoId) async {
  final doc = await orcamentos.doc(orcamentoId).get();
  return {
    'id': doc.id,
    'orcamentoId': doc.id,  // ✅ Add typed key for screens
    ...(data ?? {}),
  };
}
```

### Key Naming Convention
| Entity | Document ID Key | Typed Key |
|--------|-----------------|-----------|
| Orçamento | `id` | `orcamentoId` |
| Cliente | `id` | `clienteId` |
| Ordem Serviço | `id` | `ordemId` |
| Equipamento | `id` | `equipamentoId` |

### When Creating New Services
Always include **BOTH** `id` and the typed key in returned maps to ensure compatibility with any consumer.

---

## Pattern Q: Deprecated API Migration (AUTO-FIX)

**When to apply**: Static analysis shows `deprecated_member_use` warnings

> [!IMPORTANT]
> This pattern is triggered automatically by `/test` Section 4.5.
> DO NOT just suppress warnings with `// ignore:` comments.

### Detection
```powershell
flutter analyze 2>&1 | Select-String "deprecated_member_use"
```

### Fix Process

#### 1. Identify the Deprecated Symbol
Extract package and symbol name from the warning:
```
info - 'androidProvider' is deprecated... Use providerAndroid instead.
```

#### 2. Check Breaking Changes Registry
📁 [patterns/breaking-changes-registry.md](file:///C:/Users/MBCJ/.gemini/antigravity/global_workflows/patterns/breaking-changes-registry.md)

Look up the package for migration instructions.

#### 3. Inspect Package Source (If Registry Doesn't Help)
```powershell
$pkg = "firebase_app_check"
$version = (flutter pub deps | Select-String $pkg).Line -match '\d+\.\d+\.\d+'
$pkgPath = "$env:LOCALAPPDATA\Pub\Cache\hosted\pub.dev\$pkg-$($matches[0])\lib"
Get-ChildItem $pkgPath
Get-Content "$pkgPath\*.dart" | Select-String "export"
```

This reveals actual exported class names.

#### 4. Use Static Analysis to Discover Correct Types
Write a test file that uses the new API with wrong types:
```dart
// lib/test_inspect.dart
import 'package:firebase_app_check/firebase_app_check.dart';
void main() {
  FirebaseAppCheck.instance.activate(
    providerAndroid: AndroidProvider.playIntegrity, // Will error with correct type
  );
}
```

Run `flutter analyze lib/test_inspect.dart` - error message reveals expected type.

#### 5. Apply Correct Fix
Update code with the correct types/classes discovered above.

### Example: firebase_app_check 0.4.0+

**OLD (Deprecated):**
```dart
await FirebaseAppCheck.instance.activate(
  androidProvider: AndroidProvider.playIntegrity,
  appleProvider: AppleProvider.appAttest,
);
```

**NEW (Fixed):**
```dart
await FirebaseAppCheck.instance.activate(
  providerAndroid: const AndroidPlayIntegrityProvider(),
  providerApple: const AppleAppAttestProvider(),
);
```

### Example: shared_preferences 11.0+

**OLD (Deprecated):**
```dart
final prefs = await SharedPreferences.getInstance(
  options: SharedPreferencesOptions(
    encryptedSharedPreferences: true,
  ),
);
```

**NEW (Fixed):**
```dart
// Encryption is automatic in v11+
final prefs = await SharedPreferences.getInstance();
```

### Python: typing Module (3.9+)

**OLD:**
```python
from typing import List, Dict, Optional

def process(items: List[str]) -> Dict[str, int]:
    ...
```

**NEW:**
```python
# Use built-in generics
def process(items: list[str]) -> dict[str, int]:
    ...
```

### Key Principles
1. **Never suppress** - Always fix the underlying issue
2. **Check registry first** - Known migrations are documented
3. **Inspect source** - Package exports reveal correct types
4. **Use analyzer** - Type errors guide you to correct API
5. **Add to registry** - Document new migrations for future use


