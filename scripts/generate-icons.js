import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const outDir = path.resolve('assets/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate an SVG master icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="50%" stop-color="#0ea5e9"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Outer background circle/squircle -->
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#bg)" stroke="#27272a" stroke-width="3"/>

  <!-- Monitor Frame -->
  <rect x="18" y="22" width="92" height="64" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="3"/>

  <!-- Screen Glass Area -->
  <rect x="23" y="27" width="82" height="54" rx="5" fill="#09090b"/>

  <!-- Windows Screen Grid/Panels (representing Desktop) -->
  <rect x="27" y="31" width="36" height="22" rx="3" fill="url(#screenGrad)" opacity="0.95"/>
  <rect x="67" y="31" width="34" height="22" rx="3" fill="url(#screenGrad)" opacity="0.75"/>
  <rect x="27" y="57" width="36" height="20" rx="3" fill="url(#screenGrad)" opacity="0.65"/>
  <rect x="67" y="57" width="34" height="20" rx="3" fill="url(#screenGrad)" opacity="0.85"/>

  <!-- Center Live Broadcast Signal Dot -->
  <circle cx="64" cy="98" r="3" fill="#38bdf8"/>

  <!-- Monitor Stand -->
  <path d="M54 86 L50 102 L78 102 L74 86 Z" fill="#27272a" stroke="#3f3f46" stroke-width="2"/>
  <rect x="42" y="102" width="44" height="6" rx="3" fill="#3f3f46"/>
</svg>`;

fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent, 'utf8');

// Function to generate raw RGBA buffer and create a standard uncompressed/zlib compressed PNG
function createPng(width, height, pixelFn) {
  // Raw scanlines: each scanline starts with filter type byte (0 = None), then width * 4 bytes RGBA
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = pixelFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // Bit depth
  ihdrData.writeUInt8(6, 9); // Color type (6 = RGBA)
  ihdrData.writeUInt8(0, 10); // Compression method
  ihdrData.writeUInt8(0, 11); // Filter method
  ihdrData.writeUInt8(0, 12); // Interlace method
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);

  const crcTarget = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcVal = crc32(crcTarget);
  buf.writeUInt32BE(crcVal, 8 + len);
  return buf;
}

// CRC32 implementation for PNG
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

// Pixel drawing function for smooth modern icon
function renderIconPixel(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Outer Squircle: (x - 0.5)^4 + (y - 0.5)^4 <= r^4
  const cx = 0.5;
  const cy = 0.5;
  const dx = Math.abs(nx - cx);
  const dy = Math.abs(ny - cy);
  const squircleDist = Math.pow(dx * 2, 4) + Math.pow(dy * 2, 4);

  if (squircleDist > 1.1) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  // Base dark background
  let r = 24, g = 24, b = 27, a = 255; // #18181b

  // Border of squircle
  if (squircleDist > 0.85) {
    r = 55; g = 55; b = 60;
  }

  // Monitor screen rectangle area (relative coords)
  // x: 0.18 to 0.82, y: 0.20 to 0.68
  if (nx >= 0.18 && nx <= 0.82 && ny >= 0.20 && ny <= 0.68) {
    // Monitor bezel
    r = 39; g = 39; b = 42;

    // Inside screen (glass)
    if (nx >= 0.24 && nx <= 0.76 && ny >= 0.26 && ny <= 0.62) {
      // Screen quadrant lines (Windows style 4 tiles)
      const isVerticalGap = Math.abs(nx - 0.50) < 0.025;
      const isHorizontalGap = Math.abs(ny - 0.44) < 0.03;

      if (isVerticalGap || isHorizontalGap) {
        r = 10; g = 10; b = 12; // Gap
      } else {
        // Glowing cyan/blue desktop screen tiles
        const isLeft = nx < 0.50;
        const isTop = ny < 0.44;
        if (isLeft && isTop) {
          r = 2; g = 132; b = 199; // #0284c7
        } else if (!isLeft && isTop) {
          r = 14; g = 165; b = 233; // #0ea5e9
        } else if (isLeft && !isTop) {
          r = 56; g = 189; b = 248; // #38bdf8
        } else {
          r = 3; g = 105; b = 161; // #0369a1
        }
      }
    }
  }

  // Monitor Stand
  // Neck: x: 0.45 to 0.55, y: 0.68 to 0.78
  if (nx >= 0.45 && nx <= 0.55 && ny >= 0.68 && ny <= 0.78) {
    r = 63; g = 63; b = 70;
  }
  // Base: x: 0.35 to 0.65, y: 0.78 to 0.84
  if (nx >= 0.35 && nx <= 0.65 && ny >= 0.78 && ny <= 0.84) {
    r = 82; g = 82; b = 91;
  }

  return [r, g, b, a];
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const pngBuf = createPng(size, size, renderIconPixel);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), pngBuf);
  console.log(`Generated icon${size}.png (${pngBuf.length} bytes)`);
}
