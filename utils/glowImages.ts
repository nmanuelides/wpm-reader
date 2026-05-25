// --- Dynamic Radial Gradient Image Generator (Pure JS PNG with Alpha) ---
export const generateRadialGlowPng = (exponent = 2.0, coreSize = 0.0) => {
  const width = 32;
  const height = 32;
  const centerX = 15.5;
  const centerY = 15.5;
  const maxRadius = 16.0;

  const rowSize = 1 + width * 4;
  const rawSize = height * rowSize;
  const raw = new Uint8Array(rawSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let alpha = 0;
      if (distance < maxRadius) {
        const ratio = distance / maxRadius;
        if (ratio < coreSize) {
          alpha = 255;
        } else {
          const adjustedRatio = (ratio - coreSize) / (1 - coreSize);
          alpha = Math.round(255 * Math.pow(1 - adjustedRatio, exponent));
        }
      }

      raw[pixelOffset] = 255;
      raw[pixelOffset + 1] = 255;
      raw[pixelOffset + 2] = 255;
      raw[pixelOffset + 3] = alpha;
    }
  }

  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < rawSize; i++) {
    s1 = (s1 + raw[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = (s2 << 16) | s1;

  const idatDataSize = 2 + 5 + rawSize + 4;
  const idatData = new Uint8Array(idatDataSize);

  idatData[0] = 0x78;
  idatData[1] = 0x01;
  idatData[2] = 0x01;
  idatData[3] = rawSize & 0xff;
  idatData[4] = (rawSize >> 8) & 0xff;
  const nlen = ~rawSize & 0xffff;
  idatData[5] = nlen & 0xff;
  idatData[6] = (nlen >> 8) & 0xff;
  idatData.set(raw, 7);

  const adlerOffset = 7 + rawSize;
  idatData[adlerOffset] = (adler >>> 24) & 0xff;
  idatData[adlerOffset + 1] = (adler >>> 16) & 0xff;
  idatData[adlerOffset + 2] = (adler >>> 8) & 0xff;
  idatData[adlerOffset + 3] = adler & 0xff;

  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  const calculateCrc = (typeBytes: Uint8Array, bodyBytes: Uint8Array) => {
    let crc = 0xffffffff;
    for (let i = 0; i < typeBytes.length; i++) {
      crc = crcTable[(crc ^ typeBytes[i]) & 0xff] ^ (crc >>> 8);
    }
    for (let i = 0; i < bodyBytes.length; i++) {
      crc = crcTable[(crc ^ bodyBytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };

  const writeCrc = (arr: Uint8Array, offset: number, crc: number) => {
    arr[offset] = (crc >>> 24) & 0xff;
    arr[offset + 1] = (crc >>> 16) & 0xff;
    arr[offset + 2] = (crc >>> 8) & 0xff;
    arr[offset + 3] = crc & 0xff;
  };

  const writeUInt32 = (arr: Uint8Array, offset: number, val: number) => {
    arr[offset] = (val >>> 24) & 0xff;
    arr[offset + 1] = (val >>> 16) & 0xff;
    arr[offset + 2] = (val >>> 8) & 0xff;
    arr[offset + 3] = val & 0xff;
  };

  const totalPngSize = 8 + 25 + (12 + idatDataSize) + 12;
  const png = new Uint8Array(totalPngSize);

  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let p = 8;
  writeUInt32(png, p, 13);
  png.set([73, 72, 68, 82], p + 4);
  const ihdrBody = [0, 0, 0, width, 0, 0, 0, height, 8, 6, 0, 0, 0];
  png.set(ihdrBody, p + 8);
  const ihdrCrc = calculateCrc(
    new Uint8Array([73, 72, 68, 82]),
    new Uint8Array(ihdrBody),
  );
  writeCrc(png, p + 21, ihdrCrc);

  p += 25;
  writeUInt32(png, p, idatDataSize);
  png.set([73, 68, 65, 84], p + 4);
  png.set(idatData, p + 8);
  const idatCrc = calculateCrc(new Uint8Array([73, 68, 65, 84]), idatData);
  writeCrc(png, p + 8 + idatDataSize, idatCrc);

  p += 12 + idatDataSize;
  writeUInt32(png, p, 0);
  png.set([73, 69, 78, 68], p + 4);
  const iendCrc = calculateCrc(
    new Uint8Array([73, 69, 78, 68]),
    new Uint8Array(0),
  );
  writeCrc(png, p + 8, iendCrc);

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  let i = 0;
  while (i < totalPngSize) {
    const b1 = png[i++];
    const b2 = i < totalPngSize ? png[i++] : NaN;
    const b3 = i < totalPngSize ? png[i++] : NaN;

    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4);
    const enc3 = isNaN(b2) ? 64 : ((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6);
    const enc4 = isNaN(b3) ? 64 : b3 & 63;

    base64 +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      (enc3 === 64 ? "=" : chars.charAt(enc3)) +
      (enc4 === 64 ? "=" : chars.charAt(enc4));
  }

  return "data:image/png;base64," + base64;
};

export const RADIAL_GLOW_PNG = generateRadialGlowPng(2.0, 0.0);
export const PLAY_GLOW_PNG = generateRadialGlowPng(8, 0.2); // Optimized for 64x64 play button
export const BUTTON_GLOW_PNG = generateRadialGlowPng(5.2, 0.075); // Optimized for 42x42 buttons
export const MINI_BUTTON_GLOW_PNG = generateRadialGlowPng(6.0, 0.1); // Optimized for 36x36 font buttons
