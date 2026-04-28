import { handler as sendHandler } from './user-phone-otp-send.js';

export const handler = async (event) => {
  const body = (() => {
    try {
      return JSON.parse(event.body || '{}');
    } catch {
      return {};
    }
  })();

  return sendHandler({
    ...event,
    body: JSON.stringify({
      ...body,
      resend: true,
    }),
  });
};
