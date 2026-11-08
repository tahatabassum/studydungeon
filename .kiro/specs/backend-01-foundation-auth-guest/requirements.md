# Spec 01: Foundation, Authentication & Guest Sessions

## Requirements
1. Registered user authentication with unique username and Argon2 password hashing.
2. Guest user sessions (`is_guest=true`, auto-expiring in 24 hours, no password required).
3. Secure HttpOnly, SameSite cookie session management.
4. Ownership dependencies ensuring zero cross-tenant data leakage.
5. `POST /demo/session` public rate-limited endpoint.

