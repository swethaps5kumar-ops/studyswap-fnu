// mailer.js - sends the OTP verification email via Brevo's HTTP API.
// Render's free tier blocks outgoing SMTP connections, so we use an HTTPS API instead.
async function sendOtpEmail(toEmail, firstName, otp) {
  const appName = process.env.APP_NAME || 'StudySwap FNU';
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;

  // If Brevo isn't configured, log the OTP so local development still works.
  if (!apiKey || !fromEmail) {
    console.log(`[DEV MODE - no email configured] OTP for ${toEmail}: ${otp}`);
    return;
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: appName, email: fromEmail },
      to: [{ email: toEmail, name: firstName }],
      subject: `Your ${appName} verification code`,
      textContent: `Hi ${firstName},\n\nYour verification code is: ${otp}\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
      htmlContent: `<p>Hi ${firstName},</p><p>Your verification code is:</p><h2 style="letter-spacing:4px;">${otp}</h2><p>This code expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo error (${res.status}): ${errText}`);
  }
}

module.exports = { sendOtpEmail };
