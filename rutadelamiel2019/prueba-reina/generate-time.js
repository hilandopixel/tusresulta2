#!/usr/bin/env node
/**
 * Usage:
 * node generate-time.js <referenceUnixTime> <offsetHH:mm:ss>
 *
 * Example:
 * node generate-time.js 1573948800000 00:30:00
 *
 * → 1. Removes items where date > 1573948800000.
 * → 2. For the remaining items (date <= reference), calculates resulttime relative
 * to the reference time and adds the 30-minute offset.
 */

const fs = require('fs');

const inputFile = 'fotos.json';
const outputFile = inputFile;
const referenceUnixTime = parseInt(process.argv[2]);
const offsetStr = process.argv[3];

if (isNaN(referenceUnixTime)) {
    console.error('Invalid referenceUnixTime. Must be a valid Unix timestamp (in milliseconds).');
    process.exit(1);
}

if (!offsetStr) {
    console.error('Missing offset. Must be in HH:mm:ss format (e.g., 00:30:00).');
    process.exit(1);
}

/** Convert HH:mm:ss → milliseconds */
function parseHHMMSS(str) {
    const parts = str.split(':').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
        console.error('Invalid offset format. Use HH:mm:ss');
        process.exit(1);
    }
    const [h, m, s] = parts;
    return ((h * 3600) + (m * 60) + s) * 1000;
}

/** Convert milliseconds → HH:mm:ss string */
function msToHMS(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0')
    ].join(':');
}

const offsetMs = parseHHMMSS(offsetStr);
const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// 1. Filter: Remove items where item.date > referenceUnixTime
const filteredData = data.filter(item => {
    // Keep the item if its date is less than or equal to the reference time
    return item.date >= referenceUnixTime;
});

// 2. Map: Calculate and add 'resulttime' to all remaining (filtered) items
const updated = filteredData.map(item => {
    // The calculation is relative to the reference time, plus the offset
    const diff = (item.date - referenceUnixTime) + offsetMs;
    // Handle negative differences (time before referenceUnixTime - offsetMs)
    const formatted = diff < 0 ? '-' + msToHMS(-diff) : msToHMS(diff);
    // Return the new object with the resulttime field
    return { ...item, resulttime: formatted };
});

fs.writeFileSync(outputFile, JSON.stringify(updated, null, 2), 'utf8');

const itemsRemovedCount = data.length - filteredData.length;

console.log(`✅ Processed ${data.length} items.`);
console.log(`✂️ Removed ${itemsRemovedCount} items where date > ${referenceUnixTime}.`);
console.log(`📝 Added "resulttime" (HH:mm:ss) with offset ${offsetStr} to the remaining ${updated.length} items.`);
console.log(`📄 Output saved to: ${outputFile}`);