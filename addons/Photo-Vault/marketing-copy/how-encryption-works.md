# BoosterAi.me — How Encryption Works

---

## Page Headline
We cannot see your photos. Here is why.

## Sub-headline
BoosterAi.me uses client-side encryption. Your files are encrypted in your browser before they reach our servers. This is not marketing language. This is how the system is built.

## Primary CTA
Start Free Trial

---

## How It Works

Your browser does the encryption. Not our servers. Not a third party. Your device.

When you upload a photo, your browser generates an encryption key from your password. It uses this key to scramble the file. Only the scrambled version leaves your device. We receive data we cannot read.

When you view a photo, your browser downloads the scrambled file. It uses your password to unscramble it. The readable version stays on your device. It never goes to our servers.

---

## What Happens When You Upload

You select a photo. Your browser encrypts it using XChaCha20-Poly1305. This is an authenticated encryption algorithm. It scrambles the data and ensures no one has tampered with it.

The encryption key comes from your password. Your password never leaves your device. We do not see it. We do not store it.

Your browser uploads the encrypted file to our servers. We store scrambled bytes. We cannot decrypt them. We do not have the key.

---

## What Happens When You View

Your browser downloads the encrypted file from our servers. It uses your password to derive the same encryption key. It decrypts the file locally.

The decrypted photo appears in your browser. The readable version exists only in your device's memory. It is not sent to our servers. It is not written to disk without your action.

When you close the browser or navigate away, the decrypted data is cleared from memory.

---

## What We Store

We store encrypted files. We store metadata you provide: filenames, dates, album names, locations, notes.

Metadata is stored in plaintext so you can search your vault. If you do not want us to see a filename or note, do not include it.

We do not store your password. We do not store your encryption key. We do not store readable versions of your photos.

---

## What This Means For You

We cannot view your photos. This is a technical fact, not a policy.

We cannot hand over readable photos to anyone. Governments, hackers, or employees with database access would only find encrypted files. Without your password, the files are useless.

We cannot reset your password. If you forget it, your files are permanently inaccessible. There is no backdoor. There is no recovery process. This is the cost of true privacy.

---

## Trust & Transparency

Zero-knowledge encryption means we have zero knowledge of your unencrypted data.

You do not have to trust us to keep your photos private. The encryption happens before we see anything. This is a technical constraint, not a promise we might break.

You should still use a strong password. The encryption is only as strong as your password. Use a password manager. Do not reuse passwords from other sites.

---

## Disclaimer

If you lose your password, we cannot help you. Your files will be permanently encrypted and inaccessible.

There is no password reset link. There is no customer support bypass. There is no recovery key. If you forget your password, your data is gone.

Back up your password. Write it down. Store it in a password manager. Treat it like the only key to a safe, because that is what it is.

We recommend exporting your vault regularly as a backup. You can download all your encrypted files at any time.

---

## Technical Details

For users who want to verify our claims:

BoosterAi.me uses XChaCha20-Poly1305 for authenticated encryption. Your password is processed with PBKDF2 (100,000 iterations) to derive an encryption key. Each file is encrypted with a unique salt and nonce.

Encryption happens in your browser using the Web Crypto API. The source code for encryption and decryption is available in the JavaScript bundle served to your browser. You can inspect it.

All communication between your browser and our servers uses HTTPS (TLS 1.2+). Encrypted files are stored in S3-compatible object storage. Access to files requires signed URLs with short expiration times.

---

## Final CTA
Start Free Trial
