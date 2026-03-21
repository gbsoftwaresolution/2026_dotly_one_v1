function formatExpiryGuidance(expiresAt: Date): string {
  const diffMs = expiresAt.getTime() - Date.now();
  const diffHours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));

  return diffHours >= 24
    ? "This verification link stays active for 24 hours."
    : `This verification link stays active for about ${diffHours} hour${diffHours === 1 ? "" : "s"}.`;
}

export function buildEmailVerificationTemplate(options: {
  verificationUrl: string;
  expiresAt: Date;
}): {
  subject: string;
  text: string;
  html: string;
} {
  const expiryGuidance = formatExpiryGuidance(options.expiresAt);
  const subject = "Confirm your email for Dotly";
  const text = [
    "Confirm your email for Dotly",
    "",
    "Confirm your email to finish setting up your Dotly account.",
    "",
    `Confirm email: ${options.verificationUrl}`,
    "",
    expiryGuidance,
    "If the button does not open, copy and paste the full link into your browser.",
    "You can still sign in before confirming, but verified-only sharing and trust-based access stay limited until you do.",
    "If you need help or did not expect this email, you can safely ignore it and reach out to the Dotly team before taking action.",
    "If you did not create a Dotly account, you can ignore this email.",
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm your email for Dotly</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1d1d1f;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f5f5f7; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 18px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); overflow: hidden;">
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 48px 40px 16px;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; color: #1d1d1f;">
                    Welcome to Dotly.
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td align="center" style="padding: 0 40px 32px;">
                  <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.47; color: #1d1d1f; font-weight: 400;">
                    Please verify your email address to complete your account setup and unlock all features.
                  </p>
                  
                  <!-- CTA Button -->
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td align="center" style="border-radius: 980px; background-color: #0071e3;">
                        <a href="${options.verificationUrl}" style="display: inline-block; padding: 14px 28px; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 980px;">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #d2d2d7; width: 100%;"></div>
                </td>
              </tr>

              <!-- Footer info -->
              <tr>
                <td style="padding: 32px 40px 48px;">
                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: #86868b;">
                    If the button above does not work, copy and paste the following link into your browser:<br>
                    <a href="${options.verificationUrl}" style="color: #0071e3; text-decoration: none; word-break: break-all;">${options.verificationUrl}</a>
                  </p>
                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: #86868b;">
                    ${expiryGuidance}
                  </p>
                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: #86868b;">
                    You can still sign in before confirming, but verified-only sharing and trust-based access will remain limited until you do.
                  </p>
                  <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #86868b;">
                    If you did not request this email, you can safely ignore it. Your account will not be fully activated until verified.
                  </p>
                </td>
              </tr>
            </table>
            
            <!-- Outside Footer (App branding) -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">
              <tr>
                <td align="center" style="padding: 24px 20px; font-size: 12px; line-height: 1.4; color: #86868b;">
                  Dotly Inc. &bull; Secure Email Verification<br>
                  &copy; ${new Date().getFullYear()} Dotly
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}