import nodemailer from "nodemailer";

export const sendRequestResetPasswordEmail = async (
  email: string,
  resetToken: string
): Promise<void> => {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.APP_EMAIL,
      pass: process.env.APP_PASSWORD,
    },
  });

  const resetLink = `${process.env.WEBAPP_URL}/auth/request-password/verify?token=${resetToken}`;

  const mailOptions = {
    from: process.env.APP_EMAIL,
    to: email,
    subject: "Password Reset Request",
    text: `You requested a password reset. Click the link below to reset your password:\n${resetLink}\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 24px; background: #fafbfc;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #007bff; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
        <p style="margin-top: 24px; color: #888; font-size: 13px;">If you did not request this, please ignore this email.</p>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
        <p style="color: #888; font-size: 13px;">If the button above does not work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #007bff; font-size: 13px;">${resetLink}</p>
      </div>
    `,
  };
  return transporter.sendMail(mailOptions);
};
