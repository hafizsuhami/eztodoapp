const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - rose-500 color (#f43f5e)
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2); // 20% border radius
  ctx.fill();
  
  // Checkmark icon - white
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.08;
  
  // Draw checkmark
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = size / 100;
  
  ctx.beginPath();
  // Checkmark path (scaled)
  ctx.moveTo(25 * scale, 50 * scale);
  ctx.lineTo(42 * scale, 67 * scale);
  ctx.lineTo(75 * scale, 34 * scale);
  ctx.stroke();
  
  // Circle around checkmark
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  
  // Save to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created: ${outputPath} (${size}x${size})`);
}

// Generate icons
const publicDir = path.join(__dirname, 'public');

generateIcon(192, path.join(publicDir, 'icon-192.png'));
generateIcon(512, path.join(publicDir, 'icon-512.png'));

console.log('Done! Icons generated in public/');
