#!/usr/bin/env node

/**
 * Generate placeholder PNG icons for the casino app
 * Creates simple BC.Game-style green icons with casino theme
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// BC.Game brand colors
const PRIMARY_GREEN = '#00C851';
const DARK_BG = '#0F1117';
const TEXT_WHITE = '#FFFFFF';

async function createIcon(size, outputPath) {
  // Create a simple icon with BC.Game branding
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${PRIMARY_GREEN}" rx="${size * 0.2}"/>
      <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${size * 0.4}"
            font-weight="bold" fill="${TEXT_WHITE}" text-anchor="middle" dominant-baseline="middle">
        BC
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`✓ Created ${outputPath} (${size}x${size})`);
}

// Create icon directories
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate icons
async function generateIcons() {
  console.log('Generating BC.Game placeholder icons...\n');

  await Promise.all([
    createIcon(192, path.join(publicDir, 'icon-192.png')),
    createIcon(512, path.join(publicDir, 'icon-512.png')),
  ]);

  console.log('\n✓ Icons generated successfully!');
  console.log('Note: These are placeholder icons. Replace with actual branded icons for production.');
}

generateIcons().catch(console.error);
