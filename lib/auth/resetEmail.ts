import nodemailer from 'nodemailer';

type PasswordResetEmailArgs = {
  to: string;
  resetUrl: string;
};

function getTransporter() {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailAppPassword) {
    return null;
  }

  // eslint-disable-next-line sonarjs/no-clear-text-protocols -- Gmail transport uses secured provider defaults
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmailArgs) {
  const transporter = getTransporter();
  if (!transporter) {
    console.info('[auth/reset-password] Gmail is not configured. Reset link:', resetUrl);
    return;
  }

  const from = process.env.EMAIL_FROM ?? process.env.GMAIL_USER ?? 'no-reply@devtree.local';

  await transporter.sendMail({
    from,
    to,
    subject: 'DevTree password reset',
    text: `Use this link to reset your DevTree password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    html: `<p>Use this link to reset your DevTree password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
  });
}
