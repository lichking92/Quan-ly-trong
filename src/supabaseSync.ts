import { supabase } from './supabaseClient';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThươngHieu, ChiNhanh, NhanVien } from './types';
import {
  MOCK_SAN_PHAM,
  MOCK_NHAP_XUAT,
  MOCK_NHAP_XUAT_CT,
  MOCK_KIEM_KHO,
  MOCK_THUONG_HIEU,
  MOCK_CHI_NHANH,
  MOCK_NHAN_VIEN
} from './data/mockData';

/**
 * FILE: supabaseSync.ts
 * MÔ TẢ: Hệ thống đồng bộ dữ liệu thời gian thực và tự động Onboarding qua Supabase.
 *        Cung cấp các hàm tải dữ liệu theo từng User ID, tự động nạp dữ liệu mẫu
 *        nếu là tài khoản mới đăng ký, và các tác vụ CRUD nguyên tử (Atomic).
 */

export interface UserDataPayload {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  kiemKhos: KiemKho[];
  thuongHieus: ThươngHieu[];
  chiNhanhs: ChiNhanh[];
  nhanViens: NhanVien[];
}

/**
 * Kiểm tra xem tài khoản đã có dữ liệu chưa, nếu chưa thì tự động Onboard nạp dữ liệu mẫu
 */
export async function tryCreateColumnsOnSupabase() {
  try {
    // Thử tự động thêm cột TEN_DANG_NHAP và MAT_KHAU qua rpc 'exec_sql' nếu có
    const sql = `
      ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "TEN_DANG_NHAP" text;
      ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "MAT_KHAU" text;
    `;
    await supabase.rpc('exec_sql', { sql });
    console.log("Đã kích hoạt cố gắng tạo cột TEN_DANG_NHAP, MAT_KHAU qua exec_sql");
  } catch (err) {
    // Không ném lỗi ra ngoài vì có thể user chưa thiết lập RPC, chúng ta vẫn log cảnh báo bình thường
    console.warn("Cố gắng thêm cột tự động qua exec_sql không khả thi (người dùng chưa cấu hình RPC):", err);
  }
  try {
    const sql = `
      ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "TEN_DANG_NHAP" text;
      ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "MAT_KHAU" text;
    `;
    await supabase.rpc('run_sql', { sql_string: sql });
    console.log("Đã kích hoạt cố gắng tạo cột TEN_DANG_NHAP, MAT_KHAU qua run_sql");
  } catch (err) {
    console.warn("Cố gắng thêm cột tự động qua run_sql không khả thi:", err);
  }
}

export async function ensureUserOnboarded(userId: string): Promise<UserDataPayload> {
  try {
    // 1. Cố gắng tự động tạo cột trên Supabase (nếu chưa có)
    await tryCreateColumnsOnSupabase();

    // 2. Tự động kiểm tra và thêm tài khoản đăng nhập hiện tại làm Admin chính nếu chưa có trong b_nhanvien
    let user = null;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      user = session.user;
    } else {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        user = authUser;
      } catch (err) {
        console.warn('Không thể lấy thông tin user từ auth.getUser:', err);
      }
    }
    if (user && user.email) {
      const email = user.email;
      const { data: existingStaff } = await supabase
        .from('b_nhanvien')
        .select('MA_NV')
        .ilike('EMAIL', email)
        .limit(1);

      if (!existingStaff || existingStaff.length === 0) {
        console.log('Tự động thêm tài khoản đăng nhập hiện tại làm Admin chính:', email);
        await supabase.from('b_nhanvien').insert({
          "MA_NV": "NV_ADMIN_" + Math.random().toString(36).substr(2, 4).toUpperCase(),
          "HO_TEN": email.split('@')[0].toUpperCase(),
          "CHUC_VU": "Chủ sở hữu (Admin)",
          "BO_PHAN": "Ban Giám Đốc",
          "CHI_NHANH": "Kho Trung Tâm",
          "EMAIL": email,
          "ROLE": "ADMIN",
          "PERMISSIONS": ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY"],
          "WRITE_ACCESS": true,
          user_id: userId
        });
      }
    }

    // 2. Kiểm tra xem đã có sản phẩm nào chưa của user này
    const { data: existingProducts, error: checkError } = await supabase
      .from('b_sanpham')
      .select('SKU')
      .eq('user_id', userId)
      .limit(1);

    if (checkError) {
      console.error('Lỗi kiểm tra Onboarding:', checkError.message);
    }

    // Nếu chưa có sản phẩm nào, tiến hành ghi dữ liệu mẫu đầu kỳ
    if (!existingProducts || existingProducts.length === 0) {
      console.log('Tài khoản mới! Tự động nạp dữ liệu mẫu Onboarding cho User ID:', userId);

      // Thêm Thương hiệu mẫu
      if (MOCK_THUONG_HIEU.length > 0) {
        await supabase.from('b_thuonghieu').insert(
          MOCK_THUONG_HIEU.map(t => ({
            "THUONG_HIEU": t.THUONG_HIEU,
            "CHIET_XUAT_MAC_DINH": t.CHIET_XUAT_MAC_DINH,
            "TINH_NANG_MAC_DINH": t.TINH_NANG_MAC_DINH,
            user_id: userId
          }))
        );
      }

      // Thêm Chi nhánh mẫu
      if (MOCK_CHI_NHANH.length > 0) {
        await supabase.from('b_chinhanh').insert(
          MOCK_CHI_NHANH.map(c => ({ ...c, user_id: userId }))
        );
      }

      // Thêm Nhân viên mẫu
      if (MOCK_NHAN_VIEN.length > 0) {
        await supabase.from('b_nhanvien').insert(
          MOCK_NHAN_VIEN.map(n => ({
            "MA_NV": n.MA_NV,
            "HO_TEN": n.HO_TEN,
            "CHUC_VU": n.CHUC_VU,
            "BO_PHAN": n.BO_PHAN,
            "CHI_NHANH": n.CHI_NHANH,
            "EMAIL": n.EMAIL,
            "ROLE": n.ROLE,
            "PERMISSIONS": n.PERMISSIONS,
            "WRITE_ACCESS": n.WRITE_ACCESS,
            user_id: userId
          }))
        );
      }

      // Thêm Sản phẩm mẫu
      if (MOCK_SAN_PHAM.length > 0) {
        await supabase.from('b_sanpham').insert(
          MOCK_SAN_PHAM.map(s => ({ ...s, user_id: userId }))
        );
      }

      // Thêm Phiếu xuất nhập mẫu
      if (MOCK_NHAP_XUAT.length > 0) {
        await supabase.from('b_nhapxuat').insert(
          MOCK_NHAP_XUAT.map(nx => ({ ...nx, user_id: userId }))
        );
      }

      // Thêm Chi tiết phiếu mẫu
      if (MOCK_NHAP_XUAT_CT.length > 0) {
        await supabase.from('b_nhapxuatct').insert(
          MOCK_NHAP_XUAT_CT.map(ct => ({ ...ct, user_id: userId }))
        );
      }

      // Thêm Kiểm kho mẫu
      if (MOCK_KIEM_KHO.length > 0) {
        await supabase.from('b_kiemkho').insert(
          MOCK_KIEM_KHO.map(k => ({ ...k, user_id: userId }))
        );
      }
    }
  } catch (err) {
    console.error('Lỗi ngoài dự kiến khi thực hiện Onboarding:', err);
  }

  // Tải toàn bộ dữ liệu mới nhất
  return await fetchAllUserData(userId);
}

/**
 * Tải toàn bộ dòng của một bảng theo phân trang (để vượt qua giới hạn 1000 dòng mặc định của Supabase/PostgREST)
 */
export async function fetchAllRows(tableName: string, userId: string): Promise<any[]> {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error(`Lỗi fetchAllRows từ ${tableName}:`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

/**
 * Tải toàn bộ dữ liệu của người dùng hiện tại
 */
export async function fetchAllUserData(userId: string): Promise<UserDataPayload> {
  const [
    dataSanPhams,
    dataNhapXuats,
    dataNhapXuatCTs,
    resKiemKhos,
    resThuongHieus,
    resChiNhanhs,
    resNhanViens
  ] = await Promise.all([
    fetchAllRows('b_sanpham', userId),
    fetchAllRows('b_nhapxuat', userId),
    fetchAllRows('b_nhapxuatct', userId),
    supabase.from('b_kiemkho').select('*').eq('user_id', userId),
    supabase.from('b_thuonghieu').select('*').eq('user_id', userId),
    supabase.from('b_chinhanh').select('*').eq('user_id', userId),
    supabase.from('b_nhanvien').select('*').eq('user_id', userId)
  ]);

  if (resKiemKhos.error) console.error('Lỗi tải b_kiemkho:', resKiemKhos.error.message);
  if (resThuongHieus.error) console.error('Lỗi tải b_thuonghieu:', resThuongHieus.error.message);
  if (resChiNhanhs.error) console.error('Lỗi tải b_chinhanh:', resChiNhanhs.error.message);
  if (resNhanViens.error) console.error('Lỗi tải b_nhanvien:', resNhanViens.error.message);

  // Ánh xạ dữ liệu trả về từ Postgres thành Interface TypeScript chính xác
  const sanPhams: SanPham[] = (dataSanPhams || []).map(item => ({
    SKU: item.SKU,
    TEN_SAN_PHAM: item.TEN_SAN_PHAM,
    THUONG_HIEU: item.THUONG_HIEU,
    CHIET_XUAT: item.CHIET_XUAT,
    TINH_NANG: item.TINH_NANG,
    CAN: Number(item.CAN),
    LOAN: Number(item.LOAN),
    DVT: item.DVT,
    TON_DAU: Number(item.TON_DAU),
    NHAP: Number(item.NHAP),
    XUAT: Number(item.XUAT),
    TON_CUOI: Number(item.TON_CUOI),
    TON_TOI_THIEU: Number(item.TON_TOI_THIEU)
  }));

  const nhapXuats: NhapXuat[] = (dataNhapXuats || []).map(item => ({
    HOA_DON: item.HOA_DON,
    CHI_NHANH: item.CHI_NHANH,
    NGAY: item.NGAY,
    LOAI: item.LOAI,
    TONG_SL: Number(item.TONG_SL),
    NGUOI_TAO: item.NGUOI_TAO,
    TEN_NGUOI_TAO: item.TEN_NGUOI_TAO,
    TG_TAO: item.TG_TAO,
    GHI_CHU: item.GHI_CHU || ''
  }));

  const nhapXuatCTs: NhapXuatCT[] = (dataNhapXuatCTs || []).map(item => ({
    ID: item.id !== undefined ? item.id : item.ID,
    HOA_DON: item.HOA_DON,
    SKU: item.SKU,
    TEN_SP: item.TEN_SP,
    THUONG_HIEU: item.THUONG_HIEU,
    CHIET_XUAT: item.CHIET_XUAT,
    TINH_NANG: item.TINH_NANG,
    SPH: Number(item.SPH),
    CYL: Number(item.CYL),
    SO_LUONG: Number(item.SO_LUONG),
    DVT: item.DVT,
    GHI_CHU: item.GHI_CHU || '',
    LOAI: item.LOAI,
    NGAY: item.NGAY
  }));

  const kiemKhos: KiemKho[] = (resKiemKhos.data || []).map(item => ({
    MA_PHIEU: item.MA_PHIEU,
    SKU: item.SKU,
    TON_HE_THONG: Number(item.TON_HE_THONG),
    TON_THUC_TE: Number(item.TON_THUC_TE),
    LECH: Number(item.LECH),
    LOAI_BU: item.LOAI_BU,
    NGUOI_KIEM: item.NGUOI_KIEM,
    THOI_DIEM: item.THOI_DIEM
  }));

  const thuongHieus: ThươngHieu[] = (resThuongHieus.data || []).map(item => ({
    THUONG_HIEU: item.THUONG_HIEU,
    CHIET_XUAT_MAC_DINH: item.CHIET_XUAT_MAC_DINH,
    TINH_NANG_MAC_DINH: item.TINH_NANG_MAC_DINH,
    TINH_NANG: item.TINH_NANG_MAC_DINH || ''
  }));

  const chiNhanhs: ChiNhanh[] = (resChiNhanhs.data || []).map(item => ({
    CHI_NHANH: item.CHI_NHANH,
    DIA_CHI: item.DIA_CHI,
    SDT: item.SDT
  }));

  const nhanViens: NhanVien[] = (resNhanViens.data || []).map(item => ({
    MA_NV: item.MA_NV,
    HO_TEN: item.HO_TEN,
    CHUC_VU: item.CHUC_VU,
    BO_PHAN: item.BO_PHAN,
    CHI_NHANH: item.CHI_NHANH,
    EMAIL: item.EMAIL,
    ROLE: item.ROLE,
    PERMISSIONS: item.PERMISSIONS || [],
    WRITE_ACCESS: item.WRITE_ACCESS ?? false,
    TEN_DANG_NHAP: item.TEN_DANG_NHAP || '',
    MAT_KHAU: item.MAT_KHAU || ''
  }));

  return {
    sanPhams,
    nhapXuats,
    nhapXuatCTs,
    kiemKhos,
    thuongHieus,
    chiNhanhs,
    nhanViens
  };
}

/**
 * Đồng bộ hoặc Thêm/Sửa một Sản phẩm
 */
export async function syncSanPham(p: SanPham, userId: string) {
  try {
    const payload = {
      "SKU": p.SKU,
      "TEN_SAN_PHAM": p.TEN_SAN_PHAM,
      "THUONG_HIEU": p.THUONG_HIEU,
      "CHIET_XUAT": p.CHIET_XUAT,
      "TINH_NANG": p.TINH_NANG,
      "CAN": p.CAN,
      "LOAN": p.LOAN,
      "DVT": p.DVT,
      "TON_DAU": p.TON_DAU,
      "NHAP": p.NHAP,
      "XUAT": p.XUAT,
      "TON_CUOI": p.TON_CUOI,
      "TON_TOI_THIEU": p.TON_TOI_THIEU,
      user_id: userId
    };

    const { data: existing, error: checkError } = await supabase
      .from('b_sanpham')
      .select('SKU')
      .eq('SKU', p.SKU)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_sanpham:", checkError.message);
    }

    let res;
    if (existing) {
      res = await supabase
        .from('b_sanpham')
        .update(payload)
        .eq('SKU', p.SKU)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncSanPham (update):", res.error);
    } else {
      res = await supabase
        .from('b_sanpham')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncSanPham (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncSanPham:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ danh sách Sản phẩm (hỗ trợ lưu nhiều sản phẩm cùng lúc)
 */
export async function syncSanPhams(pList: SanPham[], userId: string) {
  try {
    const promises = pList.map(async (p) => {
      const payload = {
        "SKU": p.SKU,
        "TEN_SAN_PHAM": p.TEN_SAN_PHAM,
        "THUONG_HIEU": p.THUONG_HIEU,
        "CHIET_XUAT": p.CHIET_XUAT,
        "TINH_NANG": p.TINH_NANG,
        "CAN": p.CAN,
        "LOAN": p.LOAN,
        "DVT": p.DVT,
        "TON_DAU": p.TON_DAU,
        "NHAP": p.NHAP,
        "XUAT": p.XUAT,
        "TON_CUOI": p.TON_CUOI,
        "TON_TOI_THIEU": p.TON_TOI_THIEU,
        user_id: userId
      };

      const { data: existing } = await supabase
        .from('b_sanpham')
        .select('SKU')
        .eq('SKU', p.SKU)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        return supabase
          .from('b_sanpham')
          .update(payload)
          .eq('SKU', p.SKU)
          .eq('user_id', userId)
          .select();
      } else {
        return supabase
          .from('b_sanpham')
          .insert(payload)
          .select();
      }
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      console.error("Lỗi syncSanPhams:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).flat(), error: null };
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncSanPhams:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ hoặc Thêm/Sửa Phiếu xuất nhập
 */
export async function syncNhapXuat(nx: NhapXuat, userId: string) {
  try {
    const payload = {
      "HOA_DON": nx.HOA_DON,
      "CHI_NHANH": nx.CHI_NHANH,
      "NGAY": nx.NGAY,
      "LOAI": nx.LOAI,
      "TONG_SL": nx.TONG_SL,
      "NGUOI_TAO": nx.NGUOI_TAO,
      "TEN_NGUOI_TAO": nx.TEN_NGUOI_TAO,
      "TG_TAO": nx.TG_TAO,
      "GHI_CHU": nx.GHI_CHU,
      user_id: userId
    };

    const { data: existing, error: checkError } = await supabase
      .from('b_nhapxuat')
      .select('HOA_DON')
      .eq('HOA_DON', nx.HOA_DON)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_nhapxuat:", checkError.message);
    }

    let res;
    if (existing) {
      res = await supabase
        .from('b_nhapxuat')
        .update(payload)
        .eq('HOA_DON', nx.HOA_DON)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncNhapXuat (update):", res.error);
    } else {
      res = await supabase
        .from('b_nhapxuat')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncNhapXuat (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncNhapXuat:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ danh sách chi tiết hóa đơn
 */
export async function syncNhapXuatCTs(details: NhapXuatCT[], userId: string) {
  try {
    const promises = details.map(async (d) => {
      const payload = {
        "id": d.ID,
        "HOA_DON": d.HOA_DON,
        "SKU": d.SKU,
        "TEN_SP": d.TEN_SP,
        "THUONG_HIEU": d.THUONG_HIEU,
        "CHIET_XUAT": d.CHIET_XUAT,
        "TINH_NANG": d.TINH_NANG,
        "SPH": d.SPH,
        "CYL": d.CYL,
        "SO_LUONG": d.SO_LUONG,
        "DVT": d.DVT,
        "GHI_CHU": d.GHI_CHU,
        "LOAI": d.LOAI,
        "NGAY": d.NGAY,
        user_id: userId
      };

      const { data: existing } = await supabase
        .from('b_nhapxuatct')
        .select('id')
        .eq('id', d.ID)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        return supabase
          .from('b_nhapxuatct')
          .update(payload)
          .eq('id', d.ID)
          .eq('user_id', userId)
          .select();
      } else {
        return supabase
          .from('b_nhapxuatct')
          .insert(payload)
          .select();
      }
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      console.error("Lỗi syncNhapXuatCTs:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).flat(), error: null };
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncNhapXuatCTs:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ phiếu kiểm kho
 */
export async function syncKiemKho(k: KiemKho, userId: string) {
  try {
    const payload = {
      "MA_PHIEU": k.MA_PHIEU,
      "SKU": k.SKU,
      "TON_HE_THONG": k.TON_HE_THONG,
      "TON_THUC_TE": k.TON_THUC_TE,
      "LECH": k.LECH,
      "LOAI_BU": k.LOAI_BU,
      "NGUOI_KIEM": k.NGUOI_KIEM,
      "THOI_DIEM": k.THOI_DIEM,
      user_id: userId
    };

    const { data: existing, error: checkError } = await supabase
      .from('b_kiemkho')
      .select('MA_PHIEU, SKU')
      .eq('MA_PHIEU', k.MA_PHIEU)
      .eq('SKU', k.SKU)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_kiemkho:", checkError.message);
    }

    let res;
    if (existing) {
      res = await supabase
        .from('b_kiemkho')
        .update(payload)
        .eq('MA_PHIEU', k.MA_PHIEU)
        .eq('SKU', k.SKU)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncKiemKho (update):", res.error);
    } else {
      res = await supabase
        .from('b_kiemkho')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncKiemKho (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncKiemKho:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Thương hiệu
 */
export async function syncThuongHieu(t: ThươngHieu, userId: string) {
  try {
    const payload = {
      "THUONG_HIEU": t.THUONG_HIEU,
      "CHIET_XUAT_MAC_DINH": t.CHIET_XUAT_MAC_DINH,
      "TINH_NANG_MAC_DINH": t.TINH_NANG_MAC_DINH,
      user_id: userId
    };

    const { data: existing, error: checkError } = await supabase
      .from('b_thuonghieu')
      .select('THUONG_HIEU')
      .eq('THUONG_HIEU', t.THUONG_HIEU)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_thuonghieu:", checkError.message);
    }

    let res;
    if (existing) {
      res = await supabase
        .from('b_thuonghieu')
        .update(payload)
        .eq('THUONG_HIEU', t.THUONG_HIEU)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncThuongHieu (update):", res.error);
    } else {
      res = await supabase
        .from('b_thuonghieu')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncThuongHieu (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncThuongHieu:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Chi nhánh
 */
export async function syncChiNhanh(c: ChiNhanh, userId: string) {
  try {
    const payload = {
      "CHI_NHANH": c.CHI_NHANH,
      "DIA_CHI": c.DIA_CHI,
      "SDT": c.SDT,
      user_id: userId
    };

    const { data: existing, error: checkError } = await supabase
      .from('b_chinhanh')
      .select('CHI_NHANH')
      .eq('CHI_NHANH', c.CHI_NHANH)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_chinhanh:", checkError.message);
    }

    let res;
    if (existing) {
      res = await supabase
        .from('b_chinhanh')
        .update(payload)
        .eq('CHI_NHANH', c.CHI_NHANH)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncChiNhanh (update):", res.error);
    } else {
      res = await supabase
        .from('b_chinhanh')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncChiNhanh (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncChiNhanh:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Nhân viên
 */
export async function syncNhanVien(n: NhanVien, userId: string) {
  try {
    const payload = {
      "MA_NV": n.MA_NV,
      "HO_TEN": n.HO_TEN,
      "CHUC_VU": n.CHUC_VU,
      "BO_PHAN": n.BO_PHAN,
      "CHI_NHANH": n.CHI_NHANH,
      "EMAIL": n.EMAIL || '',
      "ROLE": n.ROLE,
      "PERMISSIONS": n.PERMISSIONS,
      "WRITE_ACCESS": n.WRITE_ACCESS,
      "TEN_DANG_NHAP": n.TEN_DANG_NHAP || '',
      "MAT_KHAU": n.MAT_KHAU || '',
      user_id: userId
    };

    // Kiểm tra xem dòng nhân viên này đã tồn tại trong DB chưa
    const { data: existing, error: checkError } = await supabase
      .from('b_nhanvien')
      .select('MA_NV')
      .eq('MA_NV', n.MA_NV)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_nhanvien tồn tại:", checkError.message);
    }

    let res;
    if (existing) {
      // Đã có -> Cập nhật
      res = await supabase
        .from('b_nhanvien')
        .update(payload)
        .eq('MA_NV', n.MA_NV)
        .eq('user_id', userId)
        .select();
      if (res.error) console.error("Lỗi syncNhanVien (update):", res.error);
    } else {
      // Chưa có -> Thêm mới
      res = await supabase
        .from('b_nhanvien')
        .insert(payload)
        .select();
      if (res.error) console.error("Lỗi syncNhanVien (insert):", res.error);
    }

    return res;
  } catch (err: any) {
    console.error("Lỗi ngoài dự kiến trong syncNhanVien:", err);
    return { error: err };
  }
}

/**
 * Xóa Phiếu xuất nhập và tất cả chi tiết liên quan
 */
export async function deleteNhapXuatAndDetails(hoaDon: string) {
  const [res1, res2] = await Promise.all([
    supabase.from('b_nhapxuatct').delete().eq('HOA_DON', hoaDon),
    supabase.from('b_nhapxuat').delete().eq('HOA_DON', hoaDon)
  ]);
  if (res1.error) console.error("Lỗi deleteNhapXuatCT:", res1.error);
  if (res2.error) console.error("Lỗi deleteNhapXuat:", res2.error);
  return { error: res1.error || res2.error };
}

/**
 * Xóa Thương hiệu
 */
export async function deleteThuongHieu(thuongHieu: string, userId: string) {
  const res = await supabase.from('b_thuonghieu').delete().eq('THUONG_HIEU', thuongHieu).eq('user_id', userId);
  if (res.error) console.error("Lỗi deleteThuongHieu:", res.error);
  return res;
}

/**
 * Xóa Chi nhánh
 */
export async function deleteChiNhanh(chiNhanh: string, userId: string) {
  const res = await supabase.from('b_chinhanh').delete().eq('CHI_NHANH', chiNhanh).eq('user_id', userId);
  if (res.error) console.error("Lỗi deleteChiNhanh:", res.error);
  return res;
}

/**
 * Xóa Nhân viên
 */
export async function deleteNhanVien(email: string, userId: string) {
  const res = await supabase.from('b_nhanvien').delete().eq('EMAIL', email).eq('user_id', userId);
  if (res.error) console.error("Lỗi deleteNhanVien:", res.error);
  return res;
}
