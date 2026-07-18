/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Chuẩn hóa giá trị chiết suất (refractive index) về dạng đồng nhất (ví dụ: "1.60", "1.50")
 * để so sánh chính xác giữa các chuỗi khác nhau như:
 * - "Zeiss Blue 1.60" -> "1.60"
 * - "156" -> "1.56"
 * - "160" -> "1.60"
 * - "161" -> "1.61"
 * - "167" -> "1.67"
 * - "174" -> "1.74"
 * - "1.6" -> "1.60"
 * - "1.5" -> "1.50"
 * - "1.67" -> "1.67"
 * - "1.74" -> "1.74"
 */
export function normalizeChietXuat(cx: any): string {
  if (!cx) return '';
  
  let val = '';
  if (typeof cx === 'object') {
    val = cx.CHIET_XUAT || cx.CHIET_SUAT || cx.chiet_suat || cx.refractiveIndex || '';
  } else {
    val = String(cx);
  }
  
  const clean = val.trim();
  
  // Hỗ trợ mã viết tắt shorthand
  if (clean === '156') return '1.56';
  if (clean === '160') return '1.60';
  if (clean === '161') return '1.61';
  if (clean === '167') return '1.67';
  if (clean === '174') return '1.74';
  
  // Tìm số thập phân dạng 1.x hoặc 1.xx
  const match = clean.match(/1\.\d+/);
  if (match) {
    const num = parseFloat(match[0]);
    if (!isNaN(num)) {
      return num.toFixed(2);
    }
  }
  return clean;
}

/**
 * So sánh hai giá trị chiết suất sau khi chuẩn hóa
 */
export function compareChietXuat(cx1: any, cx2: any): boolean {
  const norm1 = normalizeChietXuat(cx1);
  const norm2 = normalizeChietXuat(cx2);
  return norm1 === norm2;
}
