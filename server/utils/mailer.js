// mailer.js - sends the OTP verification email via nodemailer/SMTP.
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(toEmail, firstName, otp) {
  const appName = process.env.APP_NAME || 'StudySwap FNU';

  // If email isn't configured, log the OTP to the console so development still works.
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`[DEV MODE - no email configured] OTP for ${toEmail}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: `"${appName}" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Your ${appName} verification code`,
    text: `Hi ${firstName},\n\nYour verification code is: ${otp}\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>Hi ${firstName},</p><p>Your verification code is:</p><h2 style="letter-spacing:4px;">${otp}</h2><p>This code expires in 10 minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}

module.exports = { sendOtpEmail };
