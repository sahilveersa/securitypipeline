import { chromium } from 'playwright';
import * as fs from 'fs';
import * as speakeasy from 'speakeasy';

// CLI args
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  options[args[i].replace(/^--/, '')] = args[i + 1];
}

// Extract CLI params
const url = options.url;
const email = options.email;
const password = options.password;
const mfaSecret = options.mfaSecret;   // Base32 secret key
const outputFile = options.output || 'session.json';

if (!url || !email || !password || !mfaSecret) {
  console.error("Usage: node playwright-login.js --url <login_url> --email <email> --password <password> --mfaSecret <base32_secret> [--output <session.json>]");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true }); 
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Microsoft login steps
    console.log("Filling email...");
    await page.fill('input[type="email"]', email);
    await page.click('input[type="submit"]');

    await page.waitForTimeout(2000); // adjust if needed

    console.log("Filling password...");
    await page.fill('input[type="password"]', password);
    await page.click('input[type="submit"]');

    // Handle MFA - generate OTP
    const token = speakeasy.totp({
      secret: mfaSecret,
      encoding: 'base32'
    });

    console.log("Entering MFA code...");
    await page.fill('input[type="tel"]', token);
    await page.click('input[type="submit"]');

    // Optional: handle "Stay signed in?" prompt
    // try {
    //   await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 5000 });
    //   await page.click('input[id="idBtn_Back"]');
    // } catch (e) {
    //   console.log("No 'Stay signed in' prompt found.");
    // }

    // Wait for landing page after login
    await page.waitForLoadState('networkidle');

    console.log("Login successful!");
    await page.waitForTimeout(20000);
    // Save storage state
    await context.storageState({ path: outputFile });
    console.log(`Session saved to ${outputFile}`);
  } catch (err) {
    console.error("Login failed:", err);
  } finally {
    await browser.close();
  }
})();
