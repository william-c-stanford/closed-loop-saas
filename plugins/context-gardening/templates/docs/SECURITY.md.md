# Security

<!-- garden-managed: auto -->
<!-- last-reviewed: {{DATE}} -->

> Security posture, authentication patterns, and threat model.

## Authentication & Authorization

<!-- How does this system authenticate users? What auth library/pattern is used? -->
<!-- E.g., "JWT tokens issued by /auth/login, validated via middleware on every request." -->

## Data Protection

<!-- How is sensitive data handled? Encryption at rest? In transit? -->

## Input Validation

<!-- How is untrusted input validated and sanitized? -->

## Threat Model

<!-- What are the main threats we're designed to resist? -->
<!-- What is explicitly out of scope? -->

## Security Checklist for PRs

- [ ] No secrets committed to source
- [ ] User input validated and sanitized
- [ ] Auth required on all protected endpoints
- [ ] Dependencies checked for known CVEs

## Incident Response

<!-- Link to runbook or describe steps for security incidents. -->
