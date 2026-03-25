# BoosterAi.me — FAQ

---

## Page Headline
Questions skeptical users ask.

## Sub-headline
If you are privacy-conscious, you should be asking these questions. Here are our answers.

## Primary CTA
Start Free Trial

---

## Can you really not see my photos?

No. We cannot see them.

Your photos are encrypted on your device before upload. We receive scrambled data. We do not have the decryption keys. We cannot unscramble the data.

This is not a policy we could change. It is how the system is built. Even if we wanted to see your photos, we could not.

---

## How do I know you are telling the truth?

You should not trust us blindly.

The encryption happens in your browser using the Web Crypto API. You can inspect the JavaScript code that runs in your browser. Security researchers can audit it.

If we were secretly uploading unencrypted files or sending your encryption keys to our servers, someone would notice. The code is visible.

We encourage technical users to verify our claims. Do not trust. Verify.

---

## What if the government demands my photos?

We can only provide what we have. We have encrypted files and metadata.

If law enforcement presents a valid legal request, we will comply with the law. We will provide your email address, subscription information, and any plaintext metadata you added.

We cannot provide your photos because they are encrypted. We cannot provide your encryption keys because we do not have them.

If authorities have your password, they can decrypt your files. But they would need to get your password from you, not from us.

---

## What if you get hacked?

Hackers would get encrypted files.

Without your password, encrypted files are useless. A data breach would expose scrambled data, not readable photos.

This does not mean you should be careless. You should still use a strong password. You should still enable two-factor authentication if we offer it. But the damage from a breach is limited.

---

## Can your employees see my photos?

No. Even if they tried.

Employees have access to production systems for maintenance and support. But they cannot decrypt your files. They do not have your encryption keys.

Employees could see metadata you provide. Filenames, dates, album names. If you include sensitive information in metadata, employees could see it.

But your actual photos and videos remain encrypted and invisible.

---

## What happens if BoosterAi.me shuts down?

You can export your data before we shut down.

If we go out of business, we will give users advance notice. You can export everything and move to another service.

Your exported data includes encrypted files. You will need your password to decrypt them. The encryption is not proprietary. Other tools can decrypt standard XChaCha20-Poly1305 encryption.

This is why data export is important. Use it regularly.

---

## Do you track me across the web?

No.

We do not use analytics that phone home to third parties. No Google Analytics. No Facebook Pixel. No ad trackers.

We log activity within BoosterAi.me to maintain the service. But we do not track where you came from or where you go after you leave.

---

## Do you sell my data?

No. We cannot sell what we do not have.

We cannot see your photos. We cannot sell them. We have no profile data to sell to advertisers. We do not run ads.

We make money from subscriptions. That is our only revenue source.

---

## Can I trust zero-knowledge encryption?

Zero-knowledge encryption is mathematically sound. The question is whether it is implemented correctly.

The weak point is usually implementation. A company might claim zero-knowledge encryption but secretly store keys on their servers.

You can verify our implementation by inspecting the code in your browser. If you are not technical, ask someone who is.

We welcome security audits. If you find a flaw, report it to us.

---

## What if I forget my password?

Your data is permanently inaccessible.

This is not a bug. This is how zero-knowledge encryption works. We cannot reset your password because we do not have your encryption keys.

Write down your password. Store it in a password manager. Back it up. This is your responsibility.

Some users find this annoying. But this is the cost of true privacy. You cannot have both password recovery and zero-knowledge encryption.

---

## Can you add password recovery?

No. Not without compromising encryption.

To recover a password, we would need to store your encryption keys. If we store your encryption keys, we can decrypt your files. If we can decrypt your files, it is no longer zero-knowledge.

You cannot have it both ways. Either we can help you recover your password (and thus access your files), or we cannot see your files. Pick one.

We chose privacy over convenience.

---

## Is my metadata encrypted?

No. Metadata is stored in plaintext.

This includes filenames, dates, album names, locations, and notes you add. We need metadata in plaintext to let you search your vault.

If you do not want us to see specific metadata, do not include it. You can upload files with generic names. You can skip adding locations and notes.

Your actual photos and videos are always encrypted. But metadata is your choice.

---

## Do you use AI on my photos?

No. We cannot.

We cannot see your photos. We cannot run AI models on data we cannot see.

We do not do facial recognition. We do not do object detection. We do not do automatic tagging. We do not train AI models on your data.

This is a feature, not a bug.

---

## How do I know my files are actually encrypted?

Inspect the network traffic.

Use browser developer tools to watch what your browser sends to our servers. You will see encrypted blobs, not readable images.

Technical users can verify this themselves. Non-technical users can ask someone to check for them.

If we were lying about encryption, it would be obvious to anyone inspecting network traffic.

---

## What if you change your mind about privacy?

You can export your data and leave.

We could theoretically change our architecture in the future. But we cannot retroactively decrypt your existing files. They are already encrypted with keys we do not have.

If we announce a change you disagree with, export your data and delete your account. We make this easy on purpose.

---

## Do you comply with GDPR / CCPA?

Yes.

You can export your data anytime. You can delete your account anytime. You can request a copy of your personal information. You can correct inaccurate data.

We provide these rights regardless of where you live. Privacy should not depend on your location.

---

## Can I use BoosterAi.me for illegal content?

No.

Our terms of service prohibit illegal content. If we become aware of illegal content, we will report it and delete your account.

Because your files are encrypted, we will not know what they contain unless someone tells us. But if authorities provide us with decryption keys as evidence, we will comply with the law.

Do not use BoosterAi.me for illegal purposes.

---

## Why should I trust you over [other service]?

You should not trust anyone blindly.

Other services may make privacy claims. Ask them to prove it. Ask them to explain their encryption. Ask if they store encryption keys. Ask if they can reset your password.

If they can reset your password, they have access to your files. If they run AI on your photos, they can see them. If they promise "privacy" without explaining how, be skeptical.

We are transparent about our architecture because we want you to verify our claims, not trust them.

---

## What is your business model?

Subscriptions. That is it.

We charge users for storage. We do not run ads. We do not sell data. We do not have investors pressuring us to monetize user data.

Simple business model. Simple incentives. No conflicts of interest.

---

## Final CTA
Start Free Trial
