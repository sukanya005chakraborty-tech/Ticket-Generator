'use strict';

const nodemailer = require('nodemailer');
const config     = require('../config/env');
const logger     = require('../config/logger');

// ── Transporter ───────────────────────────────────────────────────────────────

let transporter   = null;
let etherealReady = false;

async function getTransporter() {
  if (transporter) return transporter;

  if (config.email.user && config.email.pass) {
    transporter = nodemailer.createTransport({
      host:   config.email.host,
      port:   config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
    return transporter;
  }

  // Dev fallback: auto-create Ethereal test account
  if (!etherealReady) {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host:   'smtp.ethereal.email',
        port:   587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      etherealReady = true;
      logger.info('[emailService] Ethereal test account ready', { user: testAccount.user });
    } catch (err) {
      logger.warn('[emailService] Could not create Ethereal account — emails logged only', { error: err.message });
      return null;
    }
  }

  return transporter;
}

// ── Core send ─────────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html, text }) {
  const t = await getTransporter();

  if (!t) {
    logger.info('[emailService] (no transport) Would send email', { to, subject });
    return;
  }

  try {
    const info = await t.sendMail({
      from: config.email.from || '"TicketAI" <noreply@ticketai.dev>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    logger.info('[emailService] Email sent', {
      to,
      subject,
      messageId: info.messageId,
      preview: nodemailer.getTestMessageUrl(info) || null,
    });
    // Print preview URL to console so devs can open it immediately
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      logger.info(`[emailService] Preview URL: ${previewUrl}`);
      console.log('\n📧  Email preview:', previewUrl, '\n');
    }
  } catch (err) {
    logger.error('[emailService] Failed to send email', { to, subject, error: err.message });
    throw err;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

async function sendProjectInvite({ to, inviterName, projectName, inviteUrl, expiresHours }) {
  const subject = `${inviterName} invited you to join "${projectName}"`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#4f46e5;">You're invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> on AI Ticket Generator.</p>
      <p style="margin:24px 0;">
        <a href="${inviteUrl}"
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Accept Invitation
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        This invite expires in ${expiresHours} hours.<br/>
        If you didn't expect this, you can ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="color:#9ca3af;font-size:12px;">AI Ticket Generator</p>
    </div>
  `;

  await sendMail({ to, subject, html });
}

async function sendPasswordResetEmail({ to, resetUrl, expiresMinutes = 15 }) {
  const subject = 'Reset your BugForge password';
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#4f46e5;">Reset your password</h2>
      <p>We received a request to reset your BugForge password. Click the button below to choose a new one.</p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}"
           style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;">
        This link expires in ${expiresMinutes} minutes.<br/>
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
      <p style="color:#9ca3af;font-size:12px;">BugForge — AI Ticket Generator</p>
    </div>
  `;
  await sendMail({ to, subject, html });
}

module.exports = { sendMail, sendProjectInvite, sendPasswordResetEmail };
