---
description: Auth-specific verification (passkeys, OAuth, biometrics, sessions)
matches: "^/test-auth"
---
// turbo-all

# TechTest Auth Verification Workflow

1.  **Authentication State Analysis**:
    *   Agent: `TechTest`
    *   Action: Verify authentication state management.
    *   Check: User session persistence across app restarts.

2.  **Passkey/WebAuthn Verification**:
    *   Agent: `TechTest`
    *   Action: Audit passkey implementation.
    *   Check:
        *   Credential storage security
        *   Platform authenticator availability checks
        *   Fallback mechanisms

3.  **OAuth Provider Verification**:
    *   Agent: `TechTest`
    *   Action: Audit OAuth flows.
    *   Check:
        *   Token refresh handling
        *   Scope validation
        *   Error state recovery

4.  **Biometric Authentication**:
    *   Agent: `TechTest`
    *   Action: Verify biometric flow.
    *   Check:
        *   Fallback to PIN/password
        *   Biometric availability detection
        *   Secure storage of biometric-linked credentials

5.  **Session Management**:
    *   Agent: `TechTest`
    *   Action: Audit session lifecycle.
    *   Check:
        *   Session timeout handling
        *   Concurrent session policies
        *   Token revocation

6.  **Report**:
    *   Output: Pass/Fail report with specific remediation steps.
