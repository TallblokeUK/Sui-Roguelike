import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.POSTGRES_URL || "",
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      if (!resend) {
        console.warn("RESEND_API_KEY not set — password reset email not sent");
        console.log("Reset URL:", url);
        return;
      }
      void resend.emails.send({
        from: process.env.EMAIL_FROM || "Crypts of Sui <noreply@cryptsofsui.com>",
        to: user.email,
        subject: "Reset your password — Crypts of Sui",
        html: `
          <div style="font-family: serif; background: #0a0908; color: #d6d3d1; padding: 2rem; text-align: center;">
            <h1 style="color: #d4a447; letter-spacing: 0.1em;">Crypts of Sui</h1>
            <p>A password reset was requested for your account.</p>
            <p><a href="${url}" style="color: #e87b35; text-decoration: underline;">Click here to reset your password</a></p>
            <p style="color: #78716c; font-size: 0.85rem; margin-top: 2rem;">If you didn't request this, ignore this email.</p>
          </div>
        `,
      });
    },
  },
  plugins: [nextCookies()],
});
