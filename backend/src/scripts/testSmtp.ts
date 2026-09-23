import { verifySmtpConnection, sendVerificationOTP } from '../services/emailService';
import { config } from '../config';

async function main() {
  console.log('--- Testing SMTP Configuration ---');
  console.log(`SMTP Host: ${config.email.host || '(not set)'}`);
  console.log(`SMTP Port: ${config.email.port || '(not set)'}`);
  console.log(`Sender: ${config.email.from || '(not set)'}`);
  console.log(`User Configured: ${config.email.user ? 'Yes (masked)' : 'No'}`);

  const testRecipient = process.argv[2];

  const result = await verifySmtpConnection();
  if (!result.ok) {
    console.error(`❌ SMTP Connection Failed: ${result.error}`);
    process.exit(1);
  }

  console.log('✅ SMTP Connection & Authentication Successful!');

  if (testRecipient) {
    console.log(`Attempting to send a real test email to ${testRecipient}...`);
    try {
      await sendVerificationOTP(testRecipient, 'Test User', '123456');
      console.log(`✅ Test email successfully sent to ${testRecipient}!`);
    } catch (err: any) {
      console.error(`❌ Failed to send test email: ${err?.message || err}`);
      process.exit(1);
    }
  } else {
    console.log('ℹ️ To send a real test email, run: npx tsx src/scripts/testSmtp.ts your-email@example.com');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err?.message || err);
  process.exit(1);
});
