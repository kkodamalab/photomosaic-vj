/** Read JPEG EXIF DateTimeOriginal without sending files to a server. Unknown is null. */
export async function captureDate(file: Blob): Promise<string | null> {
  try {
    const view = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (view.getUint16(0) !== 0xffd8) return null;
    let p = 2;
    while (p + 4 < view.byteLength) {
      const marker = view.getUint16(p),
        length = view.getUint16(p + 2);
      if (length < 2) break;
      if (marker === 0xffe1 && view.getUint32(p + 4) === 0x45786966) {
        const base = p + 10,
          little = view.getUint16(base) === 0x4949;
        const u16 = (o: number) => view.getUint16(o, little),
          u32 = (o: number) => view.getUint32(o, little);
        const scan = (offset: number, depth = 0): string | null => {
          if (depth > 2) return null;
          const count = u16(offset);
          for (let i = 0; i < Math.min(count, 512); i++) {
            const entry = offset + 2 + i * 12,
              tag = u16(entry);
            if (tag === 0x8769) {
              const nested = scan(base + u32(entry + 8), depth + 1);
              if (nested) return nested;
            }
            if (tag === 0x9003 || tag === 0x0132) {
              const size = u32(entry + 4),
                start = size <= 4 ? entry + 8 : base + u32(entry + 8);
              if (size >= 19 && size < 100) {
                const text = new TextDecoder().decode(
                  new Uint8Array(view.buffer, start, 19),
                );
                if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(text))
                  return text.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
              }
            }
          }
          return null;
        };
        return scan(base + u32(base + 4));
      }
      p += 2 + length;
    }
    return null;
  } catch {
    return null;
  }
}
