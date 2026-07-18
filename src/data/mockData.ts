/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThuongHieu, ChiNhanh, NhanVien } from '../types';
import { normalizeChietXuat } from '../utils/chietXuatHelper';

/**
 * FILE: mockData.ts
 * TÁC GIẢ: Chuyên gia Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Thư viện các hàm tiện ích dùng chung phục vụ chuẩn hóa dữ liệu, SKU và tính toán độ.
 *        Toàn bộ dữ liệu mẫu (mock data, seed data) đã được gỡ bỏ hoàn toàn.
 */

// Hàm phụ để định dạng số thập phân độ cận/viễn/loạn thành dạng chuỗi hiển thị chuyên nghiệp (vd: -2.00, +1.25)
export const formatDop = (val: number): string => {
  if (val === 0 || Math.abs(val) < 0.0001) return '-0.00';
  const fixed = val.toFixed(2);
  if (fixed === '0.00' || fixed === '-0.00') return '-0.00';
  if (val > 0) return `+${fixed}`;
  return fixed;
};

/**
 * Hàm sinh danh sách các tùy chọn SPH dựa trên phạm vi khai báo của thương hiệu / chiết suất
 */
export function generateSphOptions(
  brandName: string,
  chietXuat: string,
  brandList: ThuongHieu[] = [],
  diopterType: 'CẬN' | 'VIỄN' = 'CẬN'
): number[] {
  // 1. Tìm bản ghi thương hiệu khớp chính xác nhất
  const normalizedCX = normalizeChietXuat(chietXuat);
  let matchedBrand = brandList.find(b => 
    b.THUONG_HIEU.trim().toLowerCase() === brandName.trim().toLowerCase() &&
    b.CHIET_XUAT_MAC_DINH && b.CHIET_XUAT_MAC_DINH.split(',').map(s => normalizeChietXuat(s)).includes(normalizedCX)
  );
  
  if (!matchedBrand) {
    matchedBrand = brandList.find(b => b.THUONG_HIEU.trim().toLowerCase() === brandName.trim().toLowerCase());
  }

  const step = 0.25; // Bước nhảy luôn là 0.25

  if (diopterType === 'CẬN') {
    let min = 0.00;
    let max = -8.00;
    if (matchedBrand && matchedBrand.SPH_TU !== undefined && matchedBrand.SPH_DEN !== undefined && matchedBrand.SPH_TU !== null && matchedBrand.SPH_DEN !== null) {
      min = matchedBrand.SPH_TU;
      max = matchedBrand.SPH_DEN;
    } else if (chietXuat === '1.56') {
      min = 0.00;
      max = -5.00;
    } else if (brandName.toUpperCase() === 'BLE') {
      min = 0.00;
      max = -4.00;
    }

    const options: number[] = [];
    if (min <= max) {
      for (let s = min; s <= max + 0.0001; s += step) {
        options.push(Number(s.toFixed(2)));
      }
    } else {
      for (let s = min; s >= max - 0.0001; s -= step) {
        options.push(Number(s.toFixed(2)));
      }
    }
    const filtered = options.filter(v => v <= 0);
    return filtered.length > 0 ? filtered : [0.00];
  } else {
    // VIỄN
    let min = 0.75;
    let max = 4.00;
    if (matchedBrand && matchedBrand.SPH_VIEN_TU !== undefined && matchedBrand.SPH_VIEN_DEN !== undefined && matchedBrand.SPH_VIEN_TU !== null && matchedBrand.SPH_VIEN_DEN !== null) {
      min = matchedBrand.SPH_VIEN_TU;
      max = matchedBrand.SPH_VIEN_DEN;
    }

    const options: number[] = [];
    if (min <= max) {
      for (let s = min; s <= max + 0.0001; s += step) {
        options.push(Number(s.toFixed(2)));
      }
    } else {
      for (let s = min; s >= max - 0.0001; s -= step) {
        options.push(Number(s.toFixed(2)));
      }
    }
    const filtered = options.filter(v => v > 0);
    return filtered.length > 0 ? filtered : [0.75];
  }
}

/**
 * Hàm sinh mã SKU tự động chuẩn hóa dựa trên các tham số cấu thành tròng kính
 * Quy tắc: [Thương hiệu viết hoa] [Chiết suất] [Tính năng] [SPH] [CYL]
 */
export const generateSKUString = (
  thuongHieu: string,
  chietXuat: string,
  tinhNang: string,
  sph: number,
  cyl: number
): string => {
  const brandPart = (thuongHieu || '').toUpperCase().trim();
  const chietPart = normalizeChietXuat(chietXuat);
  const tinhPart = (tinhNang || '').trim();
  let sphPart = formatDop(sph);
  if (sphPart.startsWith('+')) {
    sphPart = sphPart.substring(1);
  }
  let cylPart = formatDop(cyl);
  if (cylPart.startsWith('+')) {
    cylPart = cylPart.substring(1);
  }
  return `${brandPart} ${chietPart} ${tinhPart} ${sphPart} ${cylPart}`.replace(/\s+/g, ' ').trim();
};

/**
 * Định dạng SKU hiển thị trên giao diện người dùng (thêm dấu '+' cho các độ viễn dương)
 */
export const formatSKUForDisplay = (sku: string | undefined | null): string => {
  if (!sku) return '';
  const parts = sku.trim().split(/\s+/);
  if (parts.length >= 5) {
    const sphIdx = parts.length - 2;
    const cylIdx = parts.length - 1;
    
    const sphPart = parts[sphIdx];
    const sphVal = parseFloat(sphPart);
    if (!isNaN(sphVal) && sphVal > 0 && !sphPart.startsWith('+')) {
      parts[sphIdx] = '+' + sphPart;
    }
    
    const cylPart = parts[cylIdx];
    const cylVal = parseFloat(cylPart);
    if (!isNaN(cylVal) && cylVal > 0 && !cylPart.startsWith('+')) {
      parts[cylIdx] = '+' + cylPart;
    }
  }
  return parts.join(' ');
};

/**
 * Chuẩn hóa SKU để đối chiếu và tìm kiếm (loại bỏ dấu '+', thay dấu phẩy bằng dấu chấm, v.v.)
 */
export const cleanSKU = (sku: string | undefined | null): string => {
  if (!sku) return '';
  let cleaned = sku.trim()
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ')
    .toUpperCase();
  
  cleaned = cleaned.replace(/(?:^|\s)\+(\d)/g, (match) => {
    return match.replace('+', '');
  });

  // Chuẩn hóa 1.5 -> 1.50 và 1.6 -> 1.60 trên SKU
  cleaned = cleaned.replace(/\b1\.5\b/g, '1.50').replace(/\b1\.6\b/g, '1.60');

  return cleaned;
};

// Hàm lấy ngày hiện tại định dạng YYYY-MM-DD theo giờ Việt Nam (Asia/Ho_Chi_Minh)
export const getVietnamDateString = (): string => {
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const formatterDate = new Intl.DateTimeFormat('en-CA', optionsDate); // en-CA trả về YYYY-MM-DD
  return formatterDate.format(new Date());
};

// Hàm lấy ngày giờ hiện tại định dạng YYYY-MM-DD HH:mm:ss theo giờ Việt Nam (Asia/Ho_Chi_Minh)
export const getVietnamDateTimeString = (): string => {
  const optionsDate: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const optionsTime: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  const formatterDate = new Intl.DateTimeFormat('en-CA', optionsDate);
  const formatterTime = new Intl.DateTimeFormat('vi-VN', optionsTime);
  return `${formatterDate.format(new Date())} ${formatterTime.format(new Date())}`;
};
