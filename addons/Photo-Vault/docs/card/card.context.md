🔷 Booster Personal Card
Context & Canonical Definition (Authoritative)
1️⃣ System Context

BoosterAi.me is a Personal Operating System.

It is built around:

🔐 Vault (secure storage)

📁 Life Docs (structured document storage)

🧠 Continuity (future)

🪪 Personal Card (surface layer)

Booster Personal Card is:

The public-facing surface of the Personal OS.

It is not an independent product.
It is not a link-in-bio tool.
It is not a CRM.
It is not a social profile.

It is the controlled gateway to a user’s identity and secure assets.

2️⃣ Canonical Product Definition

Booster Personal Card is:

A Vault-connected, policy-driven identity surface that allows users to share contact information and selected documents with controlled access, expiry, and revocation.

Canonical Properties:

Identity-linked

Mode-based

Tokenized

Approval-aware

Expiry-capable

Vault-integrated

Privacy-first

Non-social

Non-directory

3️⃣ Canonical Architecture Principles

These are non-negotiable.

3.1 Identity is Internal, Not Username-Based

Every user has an immutable internal ID.

Vanity username is a display layer.

System must never rely on username as primary key.

Identity is permanent.
Username is cosmetic.

3.2 Modes Are Isolated Surfaces

Each Mode:

Has its own link.

Has its own visibility settings.

Has its own Vault attachments.

Has its own indexing toggle.

Has its own approval policy.

Modes do not share access states.

Isolation is mandatory.

3.3 Contact is Access-Controlled, Not Public by Default

Contact exposure must always respect:

Mode configuration

Approval state

Expiry state

Revocation state

At no time may hidden fields leak.

vCard must be generated dynamically per access state.

3.4 Vault is the Only File Source

All shared files:

Must originate from Vault.

Must use Vault permission system.

Must support expiry & revocation.

Must not expose direct storage URLs.

There must never be a second file storage system for Card.

Vault remains the storage authority.

3.5 No Public Social Signals

The following are permanently excluded:

Public view counters

Public testimonials

Ratings

Likes

Comments

Social feeds

Follower counts

Booster Personal Card is infrastructure, not social media.

3.6 Indexing Is User-Controlled

Default: No indexing.

User may enable indexing per Mode.

Even if indexed, private fields remain protected.

Search visibility ≠ contact exposure.

3.7 Analytics Are Private

User may see:

Anonymous views

Requests received

Approval rate

Vault clicks (Premium)

User may not see:

Silent viewer identities

IP logs (in UI)

Behavioral tracking data

Booster does not operate as a surveillance tool.

3.8 Expiry & Revocation Are First-Class

Access grants must support:

Duration

Auto-expiry

Manual revocation

Instant enforcement

Expired access must immediately disable:

Contact visibility

vCard download

Vault share links (if scoped)

No delay allowed.

3.9 Abuse Resistance Is Required

System must include:

Email verification mandatory

Rate limits

Progressive trust

CAPTCHA

Request throttling

Mode token entropy

Identity layer must not become spam vector.

4️⃣ Canonical User Model

User lifecycle:

Create account (email verified)

Create default Mode

Configure visibility

Share link

Receive request

Approve with duration

Access granted

Access expires or revoked

Simple mental model.
No complexity leakage to user.

5️⃣ Canonical Non-Goals (Strict)

Personal Card must NOT:

Implement messaging (v1)

Implement WebRTC calls

Implement CRM

Implement ERP

Implement public discovery

Implement affiliate engine

Implement paid gating (v1)

Replace Vault

Duplicate storage logic

Any feature request must be evaluated against this.

If it drifts from Personal OS surface layer, it is rejected.

6️⃣ Canonical Positioning

Booster Personal Card is:

The control surface of your digital identity.

It is:

Minimal.
Intentional.
Policy-aware.
Vault-connected.

It quietly replaces:

“Here’s my number.”

With:

“Here’s my Booster.”

7️⃣ Long-Term Evolution (Non-Binding, Directional)

Future expansion may include:

In-app communication

Call scheduling

Paid access

Business namespace

Team identities

But these are external layers.

They must never compromise:

Isolation
Privacy
Vault authority
Mode separation

8️⃣ Strategic Alignment

This product:

Drives Vault adoption.

Generates subscription revenue.

Builds identity layer gradually.

Avoids heavy infrastructure cost.

Avoids social platform drift.

Preserves calm, premium tone.

This is now the canonical reference for Booster Personal Card.

Everything built must conform to this.