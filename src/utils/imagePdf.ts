// A single-page, image-based PDF. No user text is interpolated into PDF syntax.
export function createImagePdf(jpegUrl: string, pixelWidth: number, pixelHeight: number, width: number, height: number) {
  if (
    !jpegUrl.startsWith('data:image/jpeg;base64,') ||
    ![pixelWidth, pixelHeight, width, height].every((value) => Number.isFinite(value) && value > 0)
  )
    throw new Error('PDF 이미지가 올바르지 않습니다.');
  const jpeg = Uint8Array.from(atob(jpegUrl.split(',')[1]), (char) => char.charCodeAt(0));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets = [0];
  let length = 0;
  const append = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, value: string) => {
    offsets[id] = length;
    append(`${id} 0 obj\n${value}\nendobj\n`);
  };
  const w = Number((width * 0.75).toFixed(2)),
    h = Number((height * 0.75).toFixed(2));
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  append(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  append(jpeg);
  append('\nendstream\nendobj\n');
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  const xref = length;
  append(
    `xref\n0 6\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
      .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
  const result = new Uint8Array(length);
  let cursor = 0;
  for (const bytes of chunks) {
    result.set(bytes, cursor);
    cursor += bytes.length;
  }
  return new Blob([result], { type: 'application/pdf' });
}
