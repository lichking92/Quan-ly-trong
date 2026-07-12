/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThươngHieu, ChiNhanh, NhanVien } from '../types';

/**
 * FILE: mockData.ts
 * TÁC GIẢ: Chuyên gia Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Khởi tạo dữ liệu mẫu ban đầu để hệ thống hoạt động ngay lập tức,
 *        phục vụ chạy thử nghiệm và làm cơ sở dữ liệu mẫu cho Google Sheets.
 *        Toàn bộ dữ liệu tuân thủ tuyệt đối các quy tắc nghiệp vụ của cửa hàng.
 */

// 1. Khởi tạo danh mục Thương hiệu mặc định
export const MOCK_THUONG_HIEU: ThươngHieu[] = [
  { THUONG_HIEU: 'Blick', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ĐM' },
  { THUONG_HIEU: 'Element', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ĐM' },
  { THUONG_HIEU: 'Nikki', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ĐM' },
  { THUONG_HIEU: 'Zeiss Clear', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ASX' },
  { THUONG_HIEU: 'Zeiss Blue', CHIET_XUAT_MAC_DINH: '1.60', TINH_NANG_MAC_DINH: 'ASX' },
  { THUONG_HIEU: 'Essilor Pre', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ASX' },
  { THUONG_HIEU: 'Essilor Rock', CHIET_XUAT_MAC_DINH: '1.56', TINH_NANG_MAC_DINH: 'ASX' },
  { THUONG_HIEU: 'Essilor', CHIET_XUAT_MAC_DINH: '1.61', TINH_NANG_MAC_DINH: 'ASX' },
  { THUONG_HIEU: 'HEN', CHIET_XUAT_MAC_DINH: '1.67', TINH_NANG_MAC_DINH: 'ASX' }
];

// 2. Khởi tạo danh mục Chi nhánh mặc định
export const MOCK_CHI_NHANH: ChiNhanh[] = [
  { CHI_NHANH: 'Kho Trung Tâm', DIA_CHI: '123 Nguyễn Trãi, Quận 1, TP. HCM', SDT: '028.3999.8888' },
  { CHI_NHANH: 'Chi nhánh Quận 1', DIA_CHI: '456 Hai Bà Trưng, Quận 1, TP. HCM', SDT: '028.3999.7777' },
  { CHI_NHANH: 'Chi nhánh Quận 3', DIA_CHI: '789 Điện Biên Phủ, Quận 3, TP. HCM', SDT: '028.3999.6666' },
  { CHI_NHANH: 'Chi nhánh Thủ Đức', DIA_CHI: '12 Võ Văn Ngân, Thủ Đức, TP. HCM', SDT: '028.3999.5555' }
];

// 3. Khởi tạo danh mục Nhân viên mặc định (có phân quyền)
export const MOCK_NHAN_VIEN: NhanVien[] = [
  {
    MA_NV: 'NV0001',
    HO_TEN: 'Nguyễn Kiến Đức',
    CHUC_VU: 'Chủ cửa hàng (Admin)',
    BO_PHAN: 'Ban Giám Đốc',
    CHI_NHANH: 'Kho Trung Tâm',
    EMAIL: 'nguyenkienduc.digital@gmail.com', // Trùng khớp với email user đăng nhập để auto-phân quyền ADMIN
    ROLE: 'ADMIN',
    PASSWORD: '12345',
    PERMISSIONS: ['DASHBOARD', 'PRODUCT', 'TRANSACTION', 'AUDIT', 'HISTORY', 'CATEGORY', 'APPS_SCRIPT'],
    WRITE_ACCESS: true
  },
  {
    MA_NV: 'NV0002',
    HO_TEN: 'Trần Văn Kho',
    CHUC_VU: 'Nhân viên kho chuyên nghiệp',
    BO_PHAN: 'Bộ Phận Kho',
    CHI_NHANH: 'Kho Trung Tâm',
    EMAIL: 'kho@gmail.com',
    ROLE: 'KHO',
    PASSWORD: '12345',
    PERMISSIONS: ['PRODUCT', 'TRANSACTION', 'AUDIT', 'HISTORY'],
    WRITE_ACCESS: true
  },
  {
    MA_NV: 'NV0003',
    HO_TEN: 'Lê Thị Bán Hàng',
    CHUC_VU: 'Nhân viên tư vấn sản phẩm',
    BO_PHAN: 'Bộ Phận Bán Hàng',
    CHI_NHANH: 'Chi nhánh Quận 1',
    EMAIL: 'nhanvien@gmail.com',
    ROLE: 'NHAN_VIEN',
    PASSWORD: '12345',
    PERMISSIONS: ['PRODUCT', 'TRANSACTION', 'HISTORY'],
    WRITE_ACCESS: false
  }
];

// Hàm phụ để định dạng số thập phân độ cận/viễn/loạn thành dạng chuỗi hiển thị chuyên nghiệp (vd: -2.00, +1.25)
export const formatDop = (val: number): string => {
  if (val === 0) return '-0.00';
  return val.toFixed(2);
};

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
  const brandPart = thuongHieu.toUpperCase();
  const sphPart = formatDop(sph);
  const cylPart = formatDop(cyl);
  return `${brandPart} ${chietXuat} ${tinhNang} ${sphPart} ${cylPart}`;
};

// 4. Khởi tạo danh sách sản phẩm tròng kính ban đầu (B_SANPHAM)
export const MOCK_SAN_PHAM: SanPham[] = [
  // Thương hiệu Blick (Tính năng ĐM, Chiết suất 1.56, Cận/Viễn, Loạn)
  {
    SKU: 'BLICK 1.56 ĐM -2.00 -0.50',
    TEN_SAN_PHAM: 'Tròng kính Đổi màu Blick 1.56 Cận -2.00 Loạn -0.50',
    THUONG_HIEU: 'Blick',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    CAN: -2.00,
    LOAN: -0.50,
    DVT: 'Cặp',
    TON_DAU: 30,
    NHAP: 15,
    XUAT: 10,
    TON_CUOI: 35,
    TON_TOI_THIEU: 10
  },
  {
    SKU: 'BLICK 1.56 ĐM -3.25 -1.25',
    TEN_SAN_PHAM: 'Tròng kính Đổi màu Blick 1.56 Cận -3.25 Loạn -1.25',
    THUONG_HIEU: 'Blick',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    CAN: -3.25,
    LOAN: -1.25,
    DVT: 'Cặp',
    TON_DAU: 25,
    NHAP: 5,
    XUAT: 26, // Sắp hết hàng (Tồn cuối = 4 < Tối thiểu 8)
    TON_CUOI: 4,
    TON_TOI_THIEU: 8
  },
  {
    SKU: 'BLICK 1.56 ĐM +1.50 -0.00',
    TEN_SAN_PHAM: 'Tròng kính Đổi màu Blick 1.56 Viễn +1.50',
    THUONG_HIEU: 'Blick',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    CAN: 1.50,
    LOAN: 0.00,
    DVT: 'Cặp',
    TON_DAU: 15,
    NHAP: 10,
    XUAT: 5,
    TON_CUOI: 20,
    TON_TOI_THIEU: 5
  },

  // Thương hiệu Element (Tính năng ĐM, Chiết suất 1.56)
  {
    SKU: 'ELEMENT 1.56 ĐM -1.50 -0.75',
    TEN_SAN_PHAM: 'Tròng kính Đổi màu Element 1.56 Cận -1.50 Loạn -0.75',
    THUONG_HIEU: 'Element',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    CAN: -1.50,
    LOAN: -0.75,
    DVT: 'Cặp',
    TON_DAU: 40,
    NHAP: 20,
    XUAT: 15,
    TON_CUOI: 45,
    TON_TOI_THIEU: 15
  },

  // Thương hiệu Nikki (Tính năng ĐM, Chiết suất 1.56)
  {
    SKU: 'NIKKI 1.56 ĐM -4.00 -1.00',
    TEN_SAN_PHAM: 'Tròng kính Đổi màu Nikki 1.56 Cận -4.00 Loạn -1.00',
    THUONG_HIEU: 'Nikki',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    CAN: -4.00,
    LOAN: -1.00,
    DVT: 'Cặp',
    TON_DAU: 18,
    NHAP: 0,
    XUAT: 16, // Sắp hết hàng (Tồn cuối = 2 < Tối thiểu 5)
    TON_CUOI: 2,
    TON_TOI_THIEU: 5
  },

  // Thương hiệu Zeiss Clear (Chiết suất cố định 1.56, Tính năng ASX)
  {
    SKU: 'ZEISS CLEAR 1.56 ASX -2.50 -0.50',
    TEN_SAN_PHAM: 'Tròng kính Lọc ánh sáng xanh Zeiss Clear 1.56 Cận -2.50 Loạn -0.50',
    THUONG_HIEU: 'Zeiss Clear',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    CAN: -2.50,
    LOAN: -0.50,
    DVT: 'Cặp',
    TON_DAU: 50,
    NHAP: 30,
    XUAT: 20,
    TON_CUOI: 60,
    TON_TOI_THIEU: 15
  },

  // Thương hiệu Zeiss Blue (Chiết suất cố định 1.60, Tính năng ASX)
  {
    SKU: 'ZEISS BLUE 1.60 ASX -3.00 -1.00',
    TEN_SAN_PHAM: 'Tròng kính Lọc ánh sáng xanh Zeiss Blue 1.60 Cận -3.00 Loạn -1.00',
    THUONG_HIEU: 'Zeiss Blue',
    CHIET_XUAT: '1.60',
    TINH_NANG: 'ASX',
    CAN: -3.00,
    LOAN: -1.00,
    DVT: 'Cặp',
    TON_DAU: 35,
    NHAP: 15,
    XUAT: 12,
    TON_CUOI: 38,
    TON_TOI_THIEU: 10
  },

  // Thương hiệu Essilor Pre (Chiết suất cố định 1.56, Tính năng ASX)
  {
    SKU: 'ESSILOR PRE 1.56 ASX -1.75 -0.00',
    TEN_SAN_PHAM: 'Tròng kính Lọc ánh sáng xanh Essilor Pre 1.56 Cận -1.75',
    THUONG_HIEU: 'Essilor Pre',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    CAN: -1.75,
    LOAN: 0.00,
    DVT: 'Cặp',
    TON_DAU: 20,
    NHAP: 10,
    XUAT: 5,
    TON_CUOI: 25,
    TON_TOI_THIEU: 5
  },

  // Thương hiệu Essilor Rock (Chiết suất cố định 1.56, Tính năng ASX)
  {
    SKU: 'ESSILOR ROCK 1.56 ASX -3.50 -0.50',
    TEN_SAN_PHAM: 'Tròng kính Chống trầy Essilor Rock 1.56 Cận -3.50 Loạn -0.50',
    THUONG_HIEU: 'Essilor Rock',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    CAN: -3.50,
    LOAN: -0.50,
    DVT: 'Cặp',
    TON_DAU: 22,
    NHAP: 12,
    XUAT: 8,
    TON_CUOI: 26,
    TON_TOI_THIEU: 6
  },

  // Thương hiệu Essilor (Chiết suất dropdown tùy chọn, mặc định 1.61)
  {
    SKU: 'ESSILOR 1.61 ASX -5.00 -1.50',
    TEN_SAN_PHAM: 'Tròng kính Mỏng Essilor 1.61 ASX Cận -5.00 Loạn -1.50',
    THUONG_HIEU: 'Essilor',
    CHIET_XUAT: '1.61',
    TINH_NANG: 'ASX',
    CAN: -5.00,
    LOAN: -1.50,
    DVT: 'Cặp',
    TON_DAU: 15,
    NHAP: 10,
    XUAT: 22, // Sắp hết hàng (Tồn cuối = 3 < Tối thiểu 5)
    TON_CUOI: 3,
    TON_TOI_THIEU: 5
  },

  // Thương hiệu HEN (Chiết suất mặc định 1.67)
  {
    SKU: 'HEN 1.67 ASX -6.00 -2.00',
    TEN_SAN_PHAM: 'Tròng kính Siêu mỏng HEN 1.67 ASX Cận -6.00 Loạn -2.00',
    THUONG_HIEU: 'HEN',
    CHIET_XUAT: '1.67',
    TINH_NANG: 'ASX',
    CAN: -6.00,
    LOAN: -2.00,
    DVT: 'Cặp',
    TON_DAU: 10,
    NHAP: 8,
    XUAT: 4,
    TON_CUOI: 14,
    TON_TOI_THIEU: 4
  }
];

// 5. Khởi tạo danh sách Header phiếu Nhập Xuất mẫu (B_NHAPXUAT)
export const MOCK_NHAP_XUAT: NhapXuat[] = [
  {
    HOA_DON: 'PN000001',
    CHI_NHANH: 'Kho Trung Tâm',
    NGAY: '2026-07-01',
    LOAI: 'NHẬP',
    TONG_SL: 40,
    NGUOI_TAO: 'kho@gmail.com',
    TEN_NGUOI_TAO: 'Trần Văn Kho',
    TG_TAO: '2026-07-01 09:15:00',
    GHI_CHU: 'Nhập hàng đầu tháng từ nhà cung cấp phân phối tròng kính Blick và Essilor'
  },
  {
    HOA_DON: 'PX000001',
    CHI_NHANH: 'Chi nhánh Quận 1',
    NGAY: '2026-07-03',
    LOAI: 'XUẤT',
    TONG_SL: 15,
    NGUOI_TAO: 'nhanvien@gmail.com',
    TEN_NGUOI_TAO: 'Lê Thị Bán Hàng',
    TG_TAO: '2026-07-03 14:30:00',
    GHI_CHU: 'Xuất điều chuyển kho nội bộ cho Chi nhánh Quận 1 trưng bày bán lẻ'
  },
  {
    HOA_DON: 'PN000002',
    CHI_NHANH: 'Kho Trung Tâm',
    NGAY: '2026-07-05',
    LOAI: 'NHẬP',
    TONG_SL: 20,
    NGUOI_TAO: 'nguyenkienduc.digital@gmail.com',
    TEN_NGUOI_TAO: 'Nguyễn Kiến Đức',
    TG_TAO: '2026-07-05 10:00:00',
    GHI_CHU: 'Nhập bổ sung khẩn cấp các SKU tròng kính lọc ánh sáng xanh Zeiss Clear'
  },
  {
    HOA_DON: 'PX000002',
    CHI_NHANH: 'Chi nhánh Quận 1',
    NGAY: '2026-07-08',
    LOAI: 'XUẤT',
    TONG_SL: 12,
    NGUOI_TAO: 'nhanvien@gmail.com',
    TEN_NGUOI_TAO: 'Lê Thị Bán Hàng',
    TG_TAO: '2026-07-08 16:45:00',
    GHI_CHU: 'Xuất bán lẻ cho khách hàng cắt kính cận thị tại quầy'
  }
];

// 6. Khởi tạo danh sách chi tiết các phiếu Nhập Xuất mẫu (B_NHAPXUATCT)
export const MOCK_NHAP_XUAT_CT: NhapXuatCT[] = [
  // Chi tiết của PN000001 (Nhập 40 chiếc)
  {
    ID: 'CT000001',
    HOA_DON: 'PN000001',
    SKU: 'BLICK 1.56 ĐM -2.00 -0.50',
    TEN_SP: 'Tròng kính Đổi màu Blick 1.56 Cận -2.00 Loạn -0.50',
    THUONG_HIEU: 'Blick',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    SPH: -2.00,
    CYL: -0.50,
    SO_LUONG: 15,
    DVT: 'Cặp',
    GHI_CHU: 'Nhập hàng Blick đổi màu thông dụng',
    LOAI: 'NHẬP',
    NGAY: '2026-07-01'
  },
  {
    ID: 'CT000002',
    HOA_DON: 'PN000001',
    SKU: 'ESSILOR PRE 1.56 ASX -1.75 -0.00',
    TEN_SP: 'Tròng kính Lọc ánh sáng xanh Essilor Pre 1.56 Cận -1.75',
    THUONG_HIEU: 'Essilor Pre',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    SPH: -1.75,
    CYL: 0.00,
    SO_LUONG: 10,
    DVT: 'Cặp',
    GHI_CHU: 'Hàng cao cấp từ Essilor',
    LOAI: 'NHẬP',
    NGAY: '2026-07-01'
  },
  {
    ID: 'CT000003',
    HOA_DON: 'PN000001',
    SKU: 'ELEMENT 1.56 ĐM -1.50 -0.75',
    TEN_SP: 'Tròng kính Đổi màu Element 1.56 Cận -1.50 Loạn -0.75',
    THUONG_HIEU: 'Element',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    SPH: -1.50,
    CYL: -0.75,
    SO_LUONG: 15,
    DVT: 'Cặp',
    GHI_CHU: 'Dòng trung cấp bán chạy',
    LOAI: 'NHẬP',
    NGAY: '2026-07-01'
  },

  // Chi tiết của PX000001 (Xuất 15 chiếc)
  {
    ID: 'CT000004',
    HOA_DON: 'PX000001',
    SKU: 'BLICK 1.56 ĐM -2.00 -0.50',
    TEN_SP: 'Tròng kính Đổi màu Blick 1.56 Cận -2.00 Loạn -0.50',
    THUONG_HIEU: 'Blick',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ĐM',
    SPH: -2.00,
    CYL: -0.50,
    SO_LUONG: 10,
    DVT: 'Cặp',
    GHI_CHU: 'Xuất kho cho Chi nhánh Quận 1',
    LOAI: 'XUẤT',
    NGAY: '2026-07-03'
  },
  {
    ID: 'CT000005',
    HOA_DON: 'PX000001',
    SKU: 'ESSILOR PRE 1.56 ASX -1.75 -0.00',
    TEN_SP: 'Tròng kính Lọc ánh sáng xanh Essilor Pre 1.56 Cận -1.75',
    THUONG_HIEU: 'Essilor Pre',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    SPH: -1.75,
    CYL: 0.00,
    SO_LUONG: 5,
    DVT: 'Cặp',
    GHI_CHU: 'Xuất trưng bày tủ kính',
    LOAI: 'XUẤT',
    NGAY: '2026-07-03'
  },

  // Chi tiết của PN000002 (Nhập 20 chiếc)
  {
    ID: 'CT000006',
    HOA_DON: 'PN000002',
    SKU: 'ZEISS CLEAR 1.56 ASX -2.50 -0.50',
    TEN_SP: 'Tròng kính Lọc ánh sáng xanh Zeiss Clear 1.56 Cận -2.50 Loạn -0.50',
    THUONG_HIEU: 'Zeiss Clear',
    CHIET_XUAT: '1.56',
    TINH_NANG: 'ASX',
    SPH: -2.50,
    CYL: -0.50,
    SO_LUONG: 20,
    DVT: 'Cặp',
    GHI_CHU: 'Nhập bù hàng Zeiss clear bán chạy cực hot',
    LOAI: 'NHẬP',
    NGAY: '2026-07-05'
  },

  // Chi tiết của PX000002 (Xuất 12 chiếc)
  {
    ID: 'CT000007',
    HOA_DON: 'PX000002',
    SKU: 'ZEISS BLUE 1.60 ASX -3.00 -1.00',
    TEN_SP: 'Tròng kính Lọc ánh sáng xanh Zeiss Blue 1.60 Cận -3.00 Loạn -1.00',
    THUONG_HIEU: 'Zeiss Blue',
    CHIET_XUAT: '1.60',
    TINH_NANG: 'ASX',
    SPH: -3.00,
    CYL: -1.00,
    SO_LUONG: 12,
    DVT: 'Cặp',
    GHI_CHU: 'Xuất lẻ cắt kính theo toa thuốc của bác sĩ mắt',
    LOAI: 'XUẤT',
    NGAY: '2026-07-08'
  }
];

// 7. Khởi tạo danh sách lịch sử Kiểm kho (B_KIEMKHO)
export const MOCK_KIEM_KHO: KiemKho[] = [
  {
    MA_PHIEU: 'PKK000001',
    SKU: 'BLICK 1.56 ĐM -2.00 -0.50',
    TON_HE_THONG: 35,
    TON_THUC_TE: 35,
    LECH: 0,
    LOAI_BU: 'KHÔNG LỆCH',
    NGUOI_KIEM: 'Trần Văn Kho',
    THOI_DIEM: '2026-07-06 11:30:00'
  },
  {
    MA_PHIEU: 'PKK000002',
    SKU: 'ELEMENT 1.56 ĐM -1.50 -0.75',
    TON_HE_THONG: 45,
    TON_THUC_TE: 47,
    LECH: 2,
    LOAI_BU: 'NHẬP BÙ',
    NGUOI_KIEM: 'Nguyễn Kiến Đức',
    THOI_DIEM: '2026-07-07 10:15:00'
  }
];

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

