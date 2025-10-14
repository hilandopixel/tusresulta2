#!/usr/bin/env node
/**
 * extract_album_links_with_bg.js
 *
 * Usage:
 *   node extract_album_links_with_bg.js "https://photos.app.goo.gl/YourAlbumURL" ./output.json
 *
 * Extracts:
 *   - href (normalized to https://photos.google.com/share/…)
 *   - aria-label (date)
 *   - background-image url from .RY3tic elements (image-url)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

if (process.argv.length < 4) {
  console.error('Usage: node extract_album_links_with_bg.js "<ALBUM_URL>" "<OUTPUT_JSON>"');
  process.exit(1);
}

const ALBUM_URL = process.argv[2];
const OUTPUT_PATH = path.resolve(process.argv[3]);

function normalizeHref(href) {
  if (!href) return null;
  if (href.startsWith('./share/'))
    return 'https://photos.google.com/share/' + href.replace('./share/', '');
  if (href.startsWith('/share/'))
    return 'https://photos.google.com' + href;
  if (href.startsWith('http'))
    return href;
  return 'https://photos.google.com/share/' + href.replace(/^\/?share\//, '');
}

function parseDate(dateStr) {
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? 0 : parsed;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  if (typeof page.waitForTimeout !== 'function') {
    page.waitForTimeout = async (ms) => new Promise(r => setTimeout(r, ms));
  }

  console.log('Opening album:', ALBUM_URL);
  await page.goto(ALBUM_URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.waitForTimeout(3000);

  // Find the scroll container (same logic as before)
  const scrollSelector = await page.evaluate(() => {
    const el = document.querySelector('.p137Zd');
    if (!el) return null;
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        return node.className;
      }
      node = node.parentElement;
    }
    return null;
  });

  if (!scrollSelector) console.warn('⚠️ Could not find scrollable container. Using window scroll fallback.');
  else console.log('📦 Scroll container detected:', scrollSelector);

  const seen = new Map();
  let unchangedScrolls = 0;
  let lastCount = 0;
  let scrollDirection = 'down';

  async function extractCurrentItems() {
    const batch = await page.evaluate(() => {
      const fixBg = (style) => {
        if (!style) return null;
        const m = style.match(/url\(["']?(.*?)["']?\)/);
        return m ? m[1] : null;
      };

      return Array.from(document.querySelectorAll('.p137Zd')).map(el => {
        const bgEl = el.querySelector('.RY3tic');
        const bgUrl = bgEl ? fixBg(bgEl.style.backgroundImage) : null;
        return {
          href: el.getAttribute('href'),
          date: el.getAttribute('aria-label'),
          imageUrl: bgUrl
        };
      });
    });

    let newCount = 0;
    for (const item of batch) {
      const href = normalizeHref(item.href);
      if (href && item.date && !seen.has(href)) {
        seen.set(href, { href, date: item.date, 'image-url': item.imageUrl });
        newCount++;
      }
    }
    return newCount;
  }

  console.log('Starting scroll + extract...');
  for (let round = 1; round <= 1000; round++) {
    const newItems = await extractCurrentItems();
    const total = seen.size;
    console.log(`[${round}] dir=${scrollDirection} | +${newItems} | total=${total}`);

    if (total === lastCount) unchangedScrolls++;
    else unchangedScrolls = 0;
    lastCount = total;

    if (unchangedScrolls >= 8) {
      console.log('No new items for several scrolls — stopping.');
      break;
    }

    if (scrollSelector) {
      await page.evaluate(
        (sel, direction) => {
          const el = document.querySelector(`.${sel.split(' ')[0]}`);
          if (!el) return;
          const delta = window.innerHeight * 0.8 * (direction === 'down' ? 1 : -1);
          el.scrollBy({ top: delta, behavior: 'smooth' });
        },
        scrollSelector,
        scrollDirection
      );
    } else {
      await page.evaluate(
        (direction) => window.scrollBy(0, window.innerHeight * 0.8 * (direction === 'down' ? 1 : -1)),
        scrollDirection
      );
    }

    if (round % 20 === 0) {
      scrollDirection = scrollDirection === 'down' ? 'up' : 'down';
    }

    await page.waitForTimeout(1500 + Math.random() * 800);
  }

  await extractCurrentItems();

  const result = Array.from(seen.values());
  result.sort((a, b) => parseDate(a.date) - parseDate(b.date));

  console.log(`✅ Collected ${result.length} unique items.`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Saved to ${OUTPUT_PATH}`);

  await browser.close();
})();
