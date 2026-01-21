#!/usr/bin/env node

/**
 * YouTube Cookie Refresh Script
 *
 * Automatically logs into Google/YouTube using headless Chrome,
 * exports fresh cookies for yt-dlp to use.
 *
 * Features:
 * - Multi-account support with failover rotation
 * - Stealth mode to avoid bot detection
 * - Comprehensive logging
 * - Cookie validation before saving
 * - Screenshot capture on errors for debugging
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

// Configuration paths
const CONFIG_PATH = path.join(ROOT_DIR, 'config', 'accounts.json');
const COOKIES_OUTPUT_PATH = path.join(ROOT_DIR, 'cookies.json');
const LOG_PATH = path.join(ROOT_DIR, 'logs', 'cookie-refresh.log');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'screenshots');

// Essential YouTube cookies that must be present for authentication
const ESSENTIAL_COOKIES = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', 'LOGIN_INFO'];

/**
 * Sleep/delay utility for human-like behavior
 * @param {number} min - Minimum milliseconds
 * @param {number} max - Maximum milliseconds (optional)
 */
function sleep(min, max = null) {
  const ms = max ? Math.floor(Math.random() * (max - min + 1)) + min : min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get formatted timestamp for logging
 */
function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Log message to console and file
 * @param {string} message
 * @param {string} level - 'INFO', 'WARN', 'ERROR', 'SUCCESS'
 */
function log(message, level = 'INFO') {
  const prefix = {
    'INFO': '',
    'WARN': '\u26a0\ufe0f ',
    'ERROR': '\u274c ',
    'SUCCESS': '\u2705 '
  };

  const formattedMessage = `[${getTimestamp()}] ${prefix[level] || ''}${message}`;
  console.log(formattedMessage);

  // Append to log file
  try {
    fs.appendFileSync(LOG_PATH, formattedMessage + '\n');
  } catch (err) {
    // Ignore log file errors
  }
}

/**
 * Load accounts configuration
 * @returns {Object|null}
 */
function loadAccountsConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      log(`Configuration file not found at: ${CONFIG_PATH}`, 'ERROR');
      log('Please create config/accounts.json from accounts.json.example', 'ERROR');
      return null;
    }

    const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(content);

    if (!config.accounts || config.accounts.length === 0) {
      log('No accounts found in configuration', 'ERROR');
      return null;
    }

    // Filter enabled accounts only
    config.accounts = config.accounts.filter(acc => acc.enabled !== false);

    if (config.accounts.length === 0) {
      log('All accounts are disabled', 'ERROR');
      return null;
    }

    log(`Loaded ${config.accounts.length} enabled account(s)`, 'INFO');
    return config;
  } catch (error) {
    log(`Failed to load accounts config: ${error.message}`, 'ERROR');
    return null;
  }
}

/**
 * Take a screenshot for debugging
 * @param {Object} page - Puppeteer page instance
 * @param {string} name - Screenshot name
 */
async function takeScreenshot(page, name) {
  try {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const filename = `${name}_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Screenshot saved: ${filename}`, 'INFO');
  } catch (error) {
    log(`Failed to take screenshot: ${error.message}`, 'WARN');
  }
}

/**
 * Validate that essential cookies are present
 * @param {Array} cookies
 * @returns {boolean}
 */
function validateCookies(cookies) {
  const cookieNames = cookies.map(c => c.name);
  const missingCookies = ESSENTIAL_COOKIES.filter(name => !cookieNames.includes(name));

  if (missingCookies.length > 0) {
    log(`Missing essential cookies: ${missingCookies.join(', ')}`, 'WARN');
    return false;
  }

  // Check if cookies have values
  const emptyCookies = cookies.filter(c => ESSENTIAL_COOKIES.includes(c.name) && !c.value);
  if (emptyCookies.length > 0) {
    log(`Empty essential cookies found: ${emptyCookies.map(c => c.name).join(', ')}`, 'WARN');
    return false;
  }

  return true;
}

/**
 * Convert Puppeteer cookies to yt-dlp compatible JSON format
 * @param {Array} puppeteerCookies
 * @returns {Array}
 */
function convertCookies(puppeteerCookies) {
  return puppeteerCookies.map(cookie => ({
    domain: cookie.domain,
    expirationDate: cookie.expires > 0 ? cookie.expires : Math.floor(Date.now() / 1000) + 86400 * 365,
    hostOnly: !cookie.domain.startsWith('.'),
    httpOnly: cookie.httpOnly || false,
    name: cookie.name,
    path: cookie.path || '/',
    sameSite: cookie.sameSite || 'unspecified',
    secure: cookie.secure || false,
    session: cookie.session || false,
    storeId: '0',
    value: cookie.value
  }));
}

/**
 * Save cookies to file
 * @param {Array} cookies
 */
function saveCookies(cookies) {
  try {
    // Create backup of existing cookies
    if (fs.existsSync(COOKIES_OUTPUT_PATH)) {
      const backupPath = COOKIES_OUTPUT_PATH.replace('.json', `.backup_${Date.now()}.json`);
      fs.copyFileSync(COOKIES_OUTPUT_PATH, backupPath);
      log(`Backup created: ${path.basename(backupPath)}`, 'INFO');

      // Keep only last 5 backups
      const backups = fs.readdirSync(ROOT_DIR)
        .filter(f => f.startsWith('cookies.backup_'))
        .sort()
        .reverse();

      if (backups.length > 5) {
        backups.slice(5).forEach(backup => {
          fs.unlinkSync(path.join(ROOT_DIR, backup));
        });
      }
    }

    // Save new cookies
    fs.writeFileSync(COOKIES_OUTPUT_PATH, JSON.stringify(cookies, null, 2));
    log(`Cookies saved to: ${COOKIES_OUTPUT_PATH}`, 'SUCCESS');
    log(`Total cookies exported: ${cookies.length}`, 'INFO');
  } catch (error) {
    log(`Failed to save cookies: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Attempt login with a single account
 * @param {Object} browser - Puppeteer browser instance
 * @param {Object} account - Account credentials
 * @param {number} attempt - Current attempt number
 * @returns {Array|null} - Cookies array or null on failure
 */
async function attemptLogin(browser, account, attempt = 1) {
  const page = await browser.newPage();

  try {
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    });

    log(`Navigating to YouTube...`, 'INFO');
    await page.goto('https://www.youtube.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await sleep(2000, 4000);

    // ============================================================
    // HANDLE EU COOKIE CONSENT POPUP (GDPR)
    // This popup appears in EU regions (France, Germany, UK, etc.)
    // but NOT in other regions (Pakistan, India, etc.)
    // ============================================================
    log(`Checking for cookie consent popup (EU regions)...`, 'INFO');
    try {
      // Try multiple selectors for the "Accept all" button
      const cookieConsentSelectors = [
        'button[aria-label="Accept all"]',
        'button[aria-label="Accept the use of cookies and other data for the purposes described"]',
        'button:has-text("Accept all")',
        'tp-yt-paper-button[aria-label="Accept all"]',
        'button.VfPpkd-LgbsSe[aria-label="Accept all"]',
        '[aria-label="Accept all"]',
        'button:contains("Accept all")',
        'form button[aria-label*="Accept"]'
      ];

      let cookieAccepted = false;

      // Wait a bit for popup to fully render
      await sleep(1000, 2000);

      for (const selector of cookieConsentSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isIntersectingViewport();
            if (isVisible) {
              await button.click();
              cookieAccepted = true;
              log(`Cookie consent accepted using selector: ${selector}`, 'SUCCESS');
              await sleep(1000, 2000);
              break;
            }
          }
        } catch (e) {
          // Selector didn't work, try next
          continue;
        }
      }

      // If selectors didn't work, try XPath for text-based matching
      if (!cookieAccepted) {
        try {
          const acceptButtons = await page.$x("//button[contains(., 'Accept all')]");
          if (acceptButtons.length > 0) {
            await acceptButtons[0].click();
            cookieAccepted = true;
            log(`Cookie consent accepted using XPath`, 'SUCCESS');
            await sleep(1000, 2000);
          }
        } catch (e) {
          // XPath didn't work either
        }
      }

      // Final fallback: try to find and click by evaluating in page context
      if (!cookieAccepted) {
        try {
          const clicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              if (btn.textContent.includes('Accept all') ||
                  btn.getAttribute('aria-label')?.includes('Accept all')) {
                btn.click();
                return true;
              }
            }
            return false;
          });
          if (clicked) {
            cookieAccepted = true;
            log(`Cookie consent accepted using page.evaluate()`, 'SUCCESS');
            await sleep(1000, 2000);
          }
        } catch (e) {
          // evaluate didn't work
        }
      }

      if (!cookieAccepted) {
        log(`No cookie consent popup found (non-EU region or already accepted)`, 'INFO');
      }
    } catch (e) {
      log(`Cookie consent check completed (popup may not exist in this region)`, 'INFO');
    }
    // ============================================================
    // END COOKIE CONSENT HANDLING
    // ============================================================

    // Click sign in button
    log(`Looking for sign-in button...`, 'INFO');

    // Try multiple selectors for sign-in button
    const signInSelectors = [
      'a[href*="accounts.google.com"]',
      'tp-yt-paper-button[aria-label="Sign in"]',
      'yt-button-renderer a[href*="ServiceLogin"]',
      '#buttons ytd-button-renderer a',
      'a[aria-label="Sign in"]'
    ];

    let signInClicked = false;
    for (const selector of signInSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          signInClicked = true;
          log(`Clicked sign-in button using selector: ${selector}`, 'INFO');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!signInClicked) {
      // Try direct navigation to login
      log(`Sign-in button not found, navigating directly to login...`, 'WARN');
      await page.goto('https://accounts.google.com/ServiceLogin?service=youtube', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    }

    await sleep(2000, 4000);

    // Wait for email input
    log(`Waiting for email input field...`, 'INFO');
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });

    // Enter email with human-like typing
    log(`Entering email: ${account.email}`, 'INFO');
    await page.type('input[type="email"]', account.email, { delay: 50 + Math.random() * 100 });

    await sleep(500, 1000);

    // Click Next button
    const nextButtonSelectors = [
      '#identifierNext',
      'button[type="submit"]',
      'div[id="identifierNext"] button',
      '#identifierNext button'
    ];

    for (const selector of nextButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          log(`Clicked next button`, 'INFO');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    await sleep(3000, 5000);

    // Wait for password input (try first before checking for errors)
    log(`Waiting for password input field...`, 'INFO');
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 30000, visible: true });
    } catch (e) {
      log(`Password field not found, checking for errors...`, 'WARN');
      await takeScreenshot(page, `no_password_field_${account.email.split('@')[0]}`);

      // Now check what went wrong
      const pageContent = await page.content();

      // Check for CAPTCHA or unusual activity
      if (pageContent.includes('captcha-container') ||
          pageContent.includes('g-recaptcha') ||
          pageContent.includes('unusual activity')) {
        log(`CAPTCHA detected for ${account.email}`, 'WARN');
        return null;
      }

      // Check for "Couldn't find your Google Account" error
      if (pageContent.includes("Couldn't find") || pageContent.includes("couldn't find") || pageContent.includes('account doesn')) {
        log(`Account not found: ${account.email}`, 'ERROR');
        return null;
      }

      // Check for account verification required
      if (pageContent.includes('verify your identity') || pageContent.includes('Verify it')) {
        log(`Account verification required for ${account.email}`, 'WARN');
        return null;
      }

      return null;
    }

    await sleep(1000, 2000);

    // Enter password with human-like typing
    log(`Entering password...`, 'INFO');
    await page.type('input[type="password"]', account.password, { delay: 50 + Math.random() * 100 });

    await sleep(500, 1000);

    // Click password Next/Sign in button
    const passwordNextSelectors = [
      '#passwordNext',
      'button[type="submit"]',
      'div[id="passwordNext"] button',
      '#passwordNext button'
    ];

    for (const selector of passwordNextSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          log(`Clicked sign-in button`, 'INFO');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    await sleep(5000, 8000);

    // Check for 2FA or additional verification
    const pageContentAfterLogin = await page.content();
    if (pageContentAfterLogin.includes('2-Step Verification') ||
        pageContentAfterLogin.includes('Verify it') ||
        pageContentAfterLogin.includes('confirm your identity')) {
      log(`2FA or additional verification required for ${account.email}`, 'WARN');
      await takeScreenshot(page, `2fa_${account.email.split('@')[0]}`);
      return null;
    }

    // Check for wrong password
    if (pageContentAfterLogin.includes('Wrong password') || pageContentAfterLogin.includes('incorrect')) {
      log(`Wrong password for ${account.email}`, 'ERROR');
      return null;
    }

    // Navigate to YouTube to ensure cookies are set
    log(`Navigating to YouTube after login...`, 'INFO');
    await page.goto('https://www.youtube.com', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await sleep(3000, 5000);

    // Verify we're logged in by checking for avatar or account menu
    const loggedIn = await page.evaluate(() => {
      // Check for avatar button or sign-out option
      const avatarButton = document.querySelector('#avatar-btn, img[alt*="Avatar"], button[aria-label*="Account"]');
      const signedInMenu = document.querySelector('ytd-topbar-menu-button-renderer');
      return !!(avatarButton || signedInMenu);
    });

    if (!loggedIn) {
      log(`Login verification failed - not detected as logged in`, 'WARN');
      await takeScreenshot(page, `login_failed_${account.email.split('@')[0]}`);

      // Still try to get cookies, might have partial success
    }

    // Get all cookies from YouTube domains
    const cookies = await page.cookies(
      'https://www.youtube.com',
      'https://youtube.com',
      'https://www.google.com',
      'https://google.com',
      'https://accounts.google.com'
    );

    log(`Retrieved ${cookies.length} cookies`, 'INFO');

    // Filter to only YouTube and Google related cookies
    const filteredCookies = cookies.filter(c =>
      c.domain.includes('youtube.com') ||
      c.domain.includes('google.com') ||
      c.domain.includes('.google.')
    );

    log(`Filtered to ${filteredCookies.length} relevant cookies`, 'INFO');

    // Validate cookies
    if (!validateCookies(filteredCookies)) {
      log(`Cookie validation failed for ${account.email}`, 'WARN');
      await takeScreenshot(page, `invalid_cookies_${account.email.split('@')[0]}`);
      return null;
    }

    log(`Login successful for ${account.email}`, 'SUCCESS');
    return convertCookies(filteredCookies);

  } catch (error) {
    log(`Login attempt ${attempt} failed for ${account.email}: ${error.message}`, 'ERROR');
    await takeScreenshot(page, `error_${account.email.split('@')[0]}_attempt${attempt}`);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Main cookie refresh function
 */
async function refreshCookies() {
  log('='.repeat(60), 'INFO');
  log('Starting YouTube cookie refresh...', 'INFO');
  log('='.repeat(60), 'INFO');

  // Load configuration
  const config = loadAccountsConfig();
  if (!config) {
    process.exit(1);
  }

  const { accounts, rotation } = config;
  const maxRetriesPerAccount = rotation?.maxRetries || 3;

  // Launch browser
  log('Launching headless browser...', 'INFO');
  const browser = await puppeteer.launch({
    headless: 'new',
    // executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    defaultViewport: {
      width: 1920,
      height: 1080
    }
  });

  let successfulCookies = null;
  let successAccount = null;

  try {
    // Try each account in sequence
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      log(`\nTrying account ${i + 1}/${accounts.length}: ${account.email}`, 'INFO');

      // Retry logic for each account
      for (let attempt = 1; attempt <= maxRetriesPerAccount; attempt++) {
        log(`Attempt ${attempt}/${maxRetriesPerAccount}...`, 'INFO');

        const cookies = await attemptLogin(browser, account, attempt);

        if (cookies && cookies.length > 0) {
          successfulCookies = cookies;
          successAccount = account.email;
          break;
        }

        if (attempt < maxRetriesPerAccount) {
          const delay = 5000 + Math.random() * 5000;
          log(`Waiting ${Math.round(delay / 1000)}s before retry...`, 'INFO');
          await sleep(delay);
        }
      }

      if (successfulCookies) {
        break;
      }

      if (i < accounts.length - 1 && rotation?.failover !== false) {
        log(`Account ${account.email} failed, rotating to next account...`, 'WARN');
      }
    }

    if (successfulCookies) {
      saveCookies(successfulCookies);
      log('\n' + '='.repeat(60), 'INFO');
      log(`Cookie refresh completed successfully!`, 'SUCCESS');
      log(`Account used: ${successAccount}`, 'INFO');
      log(`Cookies exported: ${successfulCookies.length}`, 'INFO');
      log('='.repeat(60), 'INFO');
    } else {
      log('\n' + '='.repeat(60), 'INFO');
      log('Cookie refresh FAILED - all accounts exhausted', 'ERROR');
      log('Please check:', 'ERROR');
      log('  1. Account credentials are correct', 'ERROR');
      log('  2. Accounts don\'t have 2FA enabled (or use app passwords)', 'ERROR');
      log('  3. Accounts are not locked or require verification', 'ERROR');
      log('  4. Check screenshots/ folder for debug images', 'ERROR');
      log('='.repeat(60), 'INFO');
      process.exit(1);
    }

  } finally {
    await browser.close();
    log('Browser closed', 'INFO');
  }
}

// Run the script
refreshCookies().catch(error => {
  log(`Fatal error: ${error.message}`, 'ERROR');
  process.exit(1);
});
