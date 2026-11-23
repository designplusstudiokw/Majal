import "server-only";

export interface SmsProvider {
  /** True for the stand-in that sends nothing. */
  readonly isDev: boolean;
  /** Dev provider uses a fixed code so testers need no phone. */
  readonly fixedCode?: string;
  send(phoneE164: string, message: string): Promise<void>;
}

const devProvider: SmsProvider = {
  isDev: true,
  fixedCode: "123456",
  async send(phone, message) {
    console.log(`[sms:dev] to ${phone}: ${message}`);
  },
};

/**
 * Pick the SMS provider. Add real ones (Twilio, Vonage, Unifonic…) here and
 * select with SMS_PROVIDER. The dev provider is refused in production unless
 * MAJAL_ALLOW_DEV_OTP=1, because anyone could then sign with the fixed code.
 */
export function getSmsProvider(): SmsProvider {
  const name = process.env.SMS_PROVIDER;
  if (!name || name === "dev") {
    if (process.env.NODE_ENV === "production" && process.env.MAJAL_ALLOW_DEV_OTP !== "1") {
      throw new Error("No SMS provider configured. Set SMS_PROVIDER, or MAJAL_ALLOW_DEV_OTP=1 for a demo.");
    }
    return devProvider;
  }
  throw new Error(`SMS provider "${name}" is not implemented yet.`);
}
