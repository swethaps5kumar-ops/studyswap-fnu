// otp.js - small helpers for generating and checking one-time codes.
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
}

function otpExpiryTimestamp(minutes = 10) {
  return Date.now() + minutes * 60 * 1000;
}

function isOtpExpired(expiresAt) {
  return !expiresAt || Date.now() > expiresAt;
}

module.exports = { generateOtp, otpExpiryTimestamp, isOtpExpired };
