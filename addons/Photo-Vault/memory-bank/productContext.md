# Product Context

## Why This Project Exists
In an era of increasing data breaches and privacy concerns, users need a secure place to store personal memories without compromising privacy. Existing cloud photo services often have access to users' unencrypted data, use it for advertising, or are vulnerable to government requests. Booster Vault addresses this by providing a zero-knowledge photo vault where users retain full control of their encryption keys.

## Problems It Solves
1. **Privacy Concerns**: Users want to store photos/videos without the service provider being able to view them
2. **Data Security**: Protection against data breaches at the server level
3. **Ownership**: Users maintain full control over their data with client-side encryption
4. **Organization**: Need for album management, timeline viewing, and search without AI analysis
5. **Accessibility**: Ability to access memories across devices while maintaining security
6. **Exportability**: Users can download their entire collection in a standard format
7. **Life organization**: Users want a secure place for “life records” (IDs, insurance, legal/family docs) with reminders and structured views

## How It Should Work
### User Experience Flow
1. **Onboarding**: User registers with email/password, verifies email
2. **Vault setup / unlock**:
   - Client generates a random vault master key locally (not derived from password)
   - Client derives a password KEK (PBKDF2) to encrypt (wrap) the vault master key
   - Client uploads the encrypted VaultKeyBundle to the server (server stores only ciphertext)
3. **Upload**: User selects media; client encrypts it before upload; server receives only encrypted blobs
4. **Organization**: User creates albums, adds media, reorders items
5. **Browsing**: Timeline view shows media chronologically; library view shows all media
6. **Search**: Full-text search across titles, notes, locations, and album names
7. **Export**: User can request ZIP exports of selected albums or date ranges
8. **Sharing (optional)**: User can create a read-only shared album link; viewers unlock with a passphrase client-side
9. **Subscription**: Paid plans via billing (crypto invoices + Stripe fallback)
10. **Life Docs (optional)**: Users can create structured Life Docs entries, browse/search/timeline them, manage versions, and set reminders
11. **Continuity (optional)**: Users can create “packs” and release policies; heirs can access released content via the heir flow

### Privacy Guarantees
- Server never sees unencrypted media
- Server never stores decryption keys; it only stores encrypted key material (e.g., VaultKeyBundle ciphertext)
- All metadata (titles, notes, locations) is stored in plaintext for search functionality
- EXIF data (GPS, timestamps) can be optionally stripped or encrypted (client decision)

### Business Model
- Free trial: limits are configurable and enforced server-side (see billing/plan enforcement code)
- Paid plans: Various tiers (6-month, 1-year, 5-year) with unlimited storage
- Payments: crypto invoices (primary) + Stripe fallback

## Target Audience
- Privacy-conscious individuals
- Families wanting to preserve memories securely
- Journalists/activists needing secure media storage
- Anyone dissatisfied with mainstream cloud photo services

## Differentiation from Competitors
- **Zero-knowledge architecture**: Unlike Google Photos, iCloud, Amazon Photos
- **Non-AI focus**: No facial recognition or content analysis (privacy by design)
- **Client-side encryption**: End-to-end encryption without server access
- **Transparent pricing**: Simple subscription model without hidden costs

## Additional Product Area: Life Docs
Life Docs extends the vault beyond media browsing to structured, long-lived records.

- **Use cases**: government IDs, insurance, medical summaries, legal docs, family records.
- **Core capabilities**: structured metadata, search, timeline-style views, version history, reminders.
- **Related**: Continuity “heir/recipient” flows for releasing selected content under a policy.

## Success Metrics
- User adoption and retention
- Media upload volume
- Subscription conversion rate
- Low churn rate
- Positive user feedback on privacy features