DO $$
BEGIN
	IF to_regclass('public."EmailVerificationToken"') IS NOT NULL THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_consumedAt_supersededAt_expiresAt_idx" ON "EmailVerificationToken"("userId", "consumedAt", "supersededAt", "expiresAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "EmailVerificationToken_consumedAt_idx" ON "EmailVerificationToken"("consumedAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "EmailVerificationToken_supersededAt_idx" ON "EmailVerificationToken"("supersededAt")';
	END IF;

	IF to_regclass('public."PasswordResetToken"') IS NOT NULL THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_consumedAt_supersededAt_expiresAt_idx" ON "PasswordResetToken"("userId", "consumedAt", "supersededAt", "expiresAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "PasswordResetToken_consumedAt_idx" ON "PasswordResetToken"("consumedAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "PasswordResetToken_supersededAt_idx" ON "PasswordResetToken"("supersededAt")';
	END IF;

	IF to_regclass('public."MobileOtpChallenge"') IS NOT NULL THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS "MobileOtpChallenge_userId_purpose_consumedAt_supersededAt_expiresAt_idx" ON "MobileOtpChallenge"("userId", "purpose", "consumedAt", "supersededAt", "expiresAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "MobileOtpChallenge_consumedAt_idx" ON "MobileOtpChallenge"("consumedAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "MobileOtpChallenge_supersededAt_idx" ON "MobileOtpChallenge"("supersededAt")';
	END IF;

	IF to_regclass('public."AuthSession"') IS NOT NULL THEN
		EXECUTE 'CREATE INDEX IF NOT EXISTS "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt")';
		EXECUTE 'CREATE INDEX IF NOT EXISTS "AuthSession_userId_revokedAt_expiresAt_lastActiveAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt", "lastActiveAt")';
	END IF;
END $$;