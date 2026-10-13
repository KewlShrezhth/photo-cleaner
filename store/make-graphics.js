// Renders the logo (white photo frame + mountain + sparkle) into the splash, every app icon and the Play Store banner.
// Run from the repo root after `npm install` in server/ (it borrows the server's sharp): node store/make-graphics.js
// Native icons only change after a rebuild (npx expo prebuild, then a new build).
const path = require('node:path');
const sharp = require(path.join(__dirname, '../server/node_modules/sharp'));
const assets = path.join(__dirname, '../app/assets/');

const mark = (c, scale = 1, x = 512, y = 512) => `<g transform="translate(${x} ${y}) scale(${scale}) translate(-512 -512)">
  <rect x="232" y="292" width="560" height="440" rx="72" fill="none" stroke="${c}" stroke-width="44"/>
  <path d="M290 672 L440 500 L540 610 L610 540 L734 672 Z" fill="${c}"/>
  <path d="M640 330 Q652 402 724 414 Q652 426 640 498 Q628 426 556 414 Q628 402 640 330 Z" fill="${c}"/></g>`;
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7B61C4"/><stop offset="1" stop-color="#55408F"/></linearGradient></defs>`;
const bg = (w, h) => `${grad}<rect width="${w}" height="${h}" fill="url(#g)"/>`;
const svg = (body, w = 1024, h = 1024) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const png = (body, file, size = 1024) => sharp(svg(body)).resize(size).png().toFile(assets + file);

const banner = `${bg(1024, 500)}${mark('#FFFFFF', 0.42, 230, 250)}
  <text x="400" y="235" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="68" font-weight="600" fill="#FFFFFF">Photo Cleaner</text>
  <text x="402" y="300" font-family="Segoe UI, Roboto, Arial, sans-serif" font-size="32" fill="#E9DDFF">Keep the best shot of every moment</text>`;

Promise.all([
  png(mark('#FFFFFF'), 'splash-icon.png'),
  png(bg(1024, 1024) + mark('#FFFFFF', 1.1), 'icon.png'), // iOS: opaque square, the system rounds the corners
  png(mark('#FFFFFF', 0.85), 'android-icon-foreground.png'), // fits Android's 66% safe circle
  png(bg(1024, 1024), 'android-icon-background.png'),
  png(mark('#FFFFFF', 0.85), 'android-icon-monochrome.png'), // themed icons tint this
  png(bg(1024, 1024) + mark('#FFFFFF', 1.1), 'favicon.png', 48),
  sharp(svg(bg(1024, 1024) + mark('#FFFFFF', 1.1))).resize(512).png().toFile(path.join(__dirname, 'icon-512.png')), // Play listing icon
  sharp(svg(banner, 1024, 500)).png().toFile(path.join(__dirname, 'feature-graphic.png')),
]).then(() => console.log('graphics written'));
