function formatExpiryGuidance(expiresAt: Date): string {
  const diffMs = expiresAt.getTime() - Date.now();
  const diffMinutes = Math.max(1, Math.round(diffMs / (60 * 1000)));

  if (diffMinutes >= 60) {
    const diffHours = Math.max(1, Math.round(diffMinutes / 60));
    return `This reset link stays active for about ${diffHours} hour${diffHours === 1 ? "" : "s"}.`;
  }

  return `This reset link stays active for about ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}.`;
}

export function buildPasswordResetTemplate(options: {
  resetUrl: string;
  expiresAt: Date;
}): {
  subject: string;
  text: string;
  html: string;
} {
  const expiryGuidance = formatExpiryGuidance(options.expiresAt);
  const subject = "Reset your Dotly password";
  const text = [
    "Reset your Dotly password",
    "",
    "We received a request to reset the password for your Dotly account.",
    "",
    `Reset password: ${options.resetUrl}`,
    "",
    expiryGuidance,
    "If the button does not open, copy and paste the full link into your browser.",
    "If you did not request a reset, you can safely ignore this email.",
  ].join("\n");

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset your Dotly password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f5f5f7; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);">
              <tr>
                <td align="center" style="padding: 48px 40px 16px;">
                  <h1 style="margin: 0; font-size: 30px; font-weight: 600; line-height: 1.1; letter-spacing: -0.02em; color: #1d1d1f;">
                    Secure your Dotly account.
                  </h1>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 0 40px 32px;">
                  <p style="margin: 0 0 24px; font-size: 17px; line-height: 1.5; color: #1d1d1f;">
                    Use the link below to choose a new password and protect your account.
                  </p>
                  <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td align="center" style="border-radius: 980px; background-color: #0071e3;">
                        <a href="${options.resetUrl}" style="display: inline-block; padding: 14px 28px; font-size: 17px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 980px;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 40px;">
                  <div style="height: 1px; background-color: #d2d2d7; width: 100%;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 40px 48px;">
                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: #86868b;">
                    If the button above does not work, copy and paste this link into your browser:<br>
                    <a href="${options.resetUrl}" style="color: #0071e3; text-decoration: none; word-break: break-all;">${options.resetUrl}</a>
                  </p>
                  <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.4; color: #86868b;">
                    ${expiryGuidance}
                  </p>
                  <p style="margin: 0; font-size: 13px; line-height: 1.4; color: #86868b;">
                    If you did not request this password reset, you can ignore this email and keep your current password.
                  </p>
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
