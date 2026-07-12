/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FILE: types.ts
 * TÁC GIẢ: Chuyên gia Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Định nghĩa các kiểu dữ liệu, cấu trúc dữ liệu cốt lõi phục vụ
 *        cho hệ thống Quản lý Xuất Nhập Tồn tròng kính mắt. Các kiểu này
 *        ánh xạ chính xác 1:1 với các cột dữ liệu trên Google Sheets.
 */

// Định nghĩa phân quyền người dùng trong hệ thống
export type UserRole = 'ADMIN' | 'KHO' | 'NHAN_VIEN';

export interface User {
  username: string;
  fullName: string;
  role: UserRole;
  branch: string;
  permissions?: string[]; // Danh sách các Tab được phép truy cập
  writeAccess?: boolean;  // Có quyền Thêm, Sửa, Xóa hay chỉ xem
  WRITE_ACCESS?: boolean; // Tương thích ngược cho các component dùng chữ hoa
  id?: string;            // Supabase auth user_id
}

// B_SANPHAM: Lưu trữ thông tin sản phẩm và số lượng tồn kho của từng SKU
export interface SanPham {
  SKU: string;             // Mã định danh duy nhất của tròng kính (Ví dụ: "BLICK 1.56 ĐM -2.00 -0.50")
  TEN_SAN_PHAM: string;    // Tên đầy đủ của sản phẩm
  THUONG_HIEU: string;     // Thương hiệu (Blick, Element, Nikki, Zeiss, Essilor, HEN...)
  CHIET_XUAT: string;      // Chiết suất (1.56, 1.60, 1.61, 1.67, 1.74...)
  TINH_NANG: string;       // Tính năng (ĐM - Đổi màu, ASX - Ánh sáng xanh...)
  CAN: number;             // Độ cận (SPH - âm)
  LOAN: number;            // Độ loạn (CYL - âm)
  DVT: string;             // Đơn vị tính (Cặp, Cái...)
  TON_DAU: number;         // Số lượng tồn kho đầu kỳ
  NHAP: number;            // Tổng số lượng nhập trong kỳ
  XUAT: number;            // Tổng số lượng xuất trong kỳ
  TON_CUOI: number;        // Tồn cuối kỳ = TON_DAU + NHAP - XUAT
  TON_TOI_THIEU: number;   // Ngưỡng tồn kho tối thiểu để cảnh báo hết hàng
}

// Định nghĩa loại phiếu trong hệ thống
export type LoaiPhieu = 'NHẬP' | 'XUẤT' | 'KIỂM KHO';

// B_NHAPXUAT: Lưu trữ thông tin Header của phiếu Nhập/Xuất/Kiểm kho
export interface NhapXuat {
  HOA_DON: string;         // Số phiếu tự tăng (Ví dụ: PN000001, PX000001, PKK000001)
  CHI_NHANH: string;       // Chi nhánh thực hiện giao dịch (Kho Trung Tâm, CN Quận 1...)
  NGAY: string;            // Ngày lập phiếu (Định dạng YYYY-MM-DD)
  LOAI: LoaiPhieu;         // Loại phiếu: NHẬP, XUẤT, KIỂM KHO
  TONG_SL: number;         // Tổng số lượng các sản phẩm trong phiếu
  NGUOI_TAO: string;       // Username người lập phiếu
  TEN_NGUOI_TAO: string;   // Tên đầy đủ người lập phiếu
  TG_TAO: string;          // Thời gian tạo chi tiết (Định dạng YYYY-MM-DD HH:mm:ss)
  GHI_CHU: string;         // Ghi chú tổng quát của phiếu
}

// B_NHAPXUATCT: Chi tiết từng dòng sản phẩm trong phiếu Nhập / Xuất / Kiểm kho
export interface NhapXuatCT {
  ID: string;              // Khóa chính duy nhất của dòng chi tiết (Ví dụ: CT_00001)
  HOA_DON: string;         // Mã số hóa đơn / Phiếu liên kết (B_NHAPXUAT.HOA_DON)
  SKU: string;             // SKU của sản phẩm (B_SANPHAM.SKU)
  TEN_SP: string;          // Tên sản phẩm tại thời điểm giao dịch
  THUONG_HIEU: string;     // Thương hiệu
  CHIET_XUAT: string;      // Chiết suất
  TINH_NANG: string;       // Tính năng
  SPH: number;             // Độ cầu (Cận/Viễn)
  CYL: number;             // Độ loạn
  SO_LUONG: number;        // Số lượng giao dịch của dòng này
  DVT: string;             // Đơn vị tính
  GHI_CHU: string;         // Ghi chú chi tiết cho dòng sản phẩm này
  LOAI: LoaiPhieu;         // Loại giao dịch để dễ truy vấn báo cáo
  NGAY: string;            // Ngày giao dịch (YYYY-MM-DD)
}

// B_KIEMKHO: Lưu trữ lịch sử chi tiết các phiên kiểm kê kho và xử lý chênh lệch
export interface KiemKho {
  MA_PHIEU: string;        // Mã phiếu kiểm kho (Ví dụ: PKK000001)
  SKU: string;             // SKU sản phẩm được kiểm kê
  TON_HE_THONG: number;    // Tồn kho cuối kỳ ghi nhận trên hệ thống (TON_CUOI)
  TON_THUC_TE: number;     // Tồn kho thực tế đếm được tại kho
  LECH: number;            // Chênh lệch = TON_THUC_TE - TON_HE_THONG
  LOAI_BU: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH'; // Loại bù trừ tự động dựa vào Lệch
  NGUOI_KIEM: string;      // Tên hoặc username người thực hiện kiểm kho
  THOI_DIEM: string;       // Thời gian thực hiện kiểm kho (YYYY-MM-DD HH:mm:ss)
}

// B_THUONGHIEU: Danh mục thương hiệu tròng kính được quản lý trong hệ thống
export interface ThươngHieu {
  THUONG_HIEU: string;     // Tên thương hiệu (Blick, Element, Nikki, Zeiss, Essilor, HEN...)
  CHIET_XUAT_MAC_DINH?: string; // Cấu hình chiết suất mặc định cho thương hiệu này
  TINH_NANG_MAC_DINH?: string;  // Cấu hình tính năng mặc định cho thương hiệu này
}

// B_CHINHANH: Danh mục chi nhánh / kho hàng trực thuộc hệ thống cửa hàng
export interface ChiNhanh {
  CHI_NHANH: string;       // Tên chi nhánh (Kho Trung Tâm, Chi nhánh Quận 1, Chi nhánh Quận 3...)
  DIA_CHI?: string;        // Địa chỉ chi nhánh
  SDT?: string;            // Số điện thoại liên lạc
}

// B_NHANVIEN: Danh mục quản lý nhân sự và thông tin liên quan
export interface NhanVien {
  MA_NV: string;           // Mã nhân viên duy nhất
  HO_TEN: string;          // Họ và tên nhân viên
  CHUC_VU: string;         // Chức vụ (Quản lý, Nhân viên kho, Kế toán, Chủ cửa hàng)
  BO_PHAN: string;         // Bộ phận làm việc
  CHI_NHANH: string;       // Chi nhánh công tác
  EMAIL: string;           // Email liên hệ (dùng để xác thực phân quyền)
  ROLE: UserRole;          // Quyền hạn thao tác trên hệ thống (ADMIN, KHO, NHAN_VIEN)
  PASSWORD?: string;       // Mật khẩu đăng nhập hệ thống
  PERMISSIONS?: string[];  // Danh sách các tab/chức năng được phép dùng
  WRITE_ACCESS?: boolean;  // Có quyền thêm/sửa/xóa hay chỉ xem
  TEN_DANG_NHAP?: string;  // Tên đăng nhập hệ thống
  MAT_KHAU?: string;       // Mật khẩu mã hóa hoặc văn bản thô
}
