import { supabase } from './supabaseClient';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThươngHieu, ChiNhanh, NhanVien, EmailLog, Role, safeParseArray } from './types';

export let isOfflineMode = false;
export let hasCreatedColumns = false;

export function setOfflineMode(value: boolean) {
  isOfflineMode = value;
  console.log(`[Database] Đã thay đổi trạng thái Offline Mode thành: ${value}`);
}

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const errMsg = String(err.message || err || '').toLowerCase();
  return errMsg.includes('failed to fetch') || 
         errMsg.includes('typeerror') || 
         errMsg.includes('network') ||
         errMsg.includes('fetch') ||
         errMsg.includes('load failed') ||
         errMsg.includes('connection');
}

export const SHARED_USER_ID = "00000000-0000-0000-0000-000000000000";

export function logDbError(msg: string, err: any) {
  const errMsg = err ? (err.message || String(err)) : '';
  const isNetwork = errMsg.includes('Failed to fetch') || 
                    errMsg.includes('TypeError') || 
                    errMsg.includes('network') ||
                    errMsg.includes('fetch') ||
                    (typeof window !== 'undefined' && window.navigator && !window.navigator.onLine);
  if (isNetwork) {
    console.warn(`[Network/DB Warning (Demoted)]: ${msg}`, err);
  } else {
    console.error(msg, err);
  }
}

/**
 * Trả về User ID có hiệu lực của Chủ cửa hàng/Admin (bảo đảm tính nhất quán của Cơ sở dữ liệu và bảo vệ fkey)
 */
export async function resolveEffectiveUserId(): Promise<string> {
  // 1. Kiểm tra session hiện tại của Supabase Auth (dành cho Chủ cửa hàng đăng nhập trực tuyến)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      localStorage.setItem('DB_OWNER_USER_ID', session.user.id);
      return session.user.id;
    }
  } catch (err) {
    console.warn("Lỗi getSession trong resolveEffectiveUserId:", err);
  }

  // 2. Dự phòng: Đọc từ localStorage đã lưu từ lần trước
  const saved = localStorage.getItem('DB_OWNER_USER_ID');
  if (saved && saved !== SHARED_USER_ID) {
    return saved;
  }

  // 3. Nếu chưa có, cố truy vấn nhanh bảng b_nhanvien để tìm user_id của Admin
  try {
    const { data: adminList } = await supabase
      .from('b_nhanvien')
      .select('user_id')
      .or('ROLE.eq.ADMIN,CHUC_VU.ilike.%chủ%')
      .not('user_id', 'is', null)
      .limit(1);

    if (adminList && adminList.length > 0 && adminList[0].user_id) {
      const uid = adminList[0].user_id;
      if (uid && uid !== SHARED_USER_ID) {
        localStorage.setItem('DB_OWNER_USER_ID', uid);
        return uid;
      }
    }
  } catch (err) {
    console.warn("Không thể truy vấn b_nhanvien để tìm owner id:", err);
  }

  return SHARED_USER_ID;
}

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
  roles?: Role[];
}

/**
 * Kiểm tra xem tài khoản đã có dữ liệu chưa, nếu chưa thì tự động Onboard nạp dữ liệu mẫu
 */
export async function tryCreateColumnsOnSupabase() {
  if (isOfflineMode) return;
  if (hasCreatedColumns) return;
  hasCreatedColumns = true;

  if (typeof window !== 'undefined' && localStorage.getItem('SUPABASE_RPC_NOT_AVAILABLE') === 'true') {
    console.log("Bỏ qua cấu hình tự động qua exec_sql/run_sql do không được hỗ trợ trên Supabase này (lấy từ cache).");
    return;
  }

  // Thử kiểm tra xem các bảng/cột chính đã có sẵn chưa
  try {
    const { error: checkError } = await supabase.from('b_nhanvien').select('NGAY_DANG_KY').limit(1);
    if (!checkError) {
      console.log("Cơ sở dữ liệu Supabase đã sẵn sàng và đầy đủ cột. Bỏ qua cấu hình tự động.");
      return;
    }
  } catch (err) {
    // Bỏ qua lỗi và tiếp tục thử chạy RPC nếu thực sự thiếu cột
  }

  const sql = `
    DO $$ 
    BEGIN
      -- Tự động tìm và xóa các khóa ngoại trên cột user_id để tránh lỗi ràng buộc fkey khi chia sẻ SHARED_USER_ID
      BEGIN
        DECLARE
          r RECORD;
        BEGIN
          FOR r IN 
            SELECT tc.table_name, tc.constraint_name 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND kcu.column_name = 'user_id'
              AND tc.table_name IN ('b_thuonghieu', 'b_sanpham', 'b_nhapxuat', 'b_nhapxuatct', 'b_kiemkho', 'b_chinhanh', 'b_nhanvien')
          LOOP
            EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ';';
          END LOOP;
        END;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Xóa cụ thể các ràng buộc khóa ngoại phổ biến nếu có
      BEGIN
        ALTER TABLE b_thuonghieu DROP CONSTRAINT IF EXISTS b_thuonghieu_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_sanpham DROP CONSTRAINT IF EXISTS b_sanpham_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_nhapxuat DROP CONSTRAINT IF EXISTS b_nhapxuat_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_nhapxuatct DROP CONSTRAINT IF EXISTS b_nhapxuatct_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_kiemkho DROP CONSTRAINT IF EXISTS b_kiemkho_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_chinhanh DROP CONSTRAINT IF EXISTS b_chinhanh_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;
      BEGIN
        ALTER TABLE b_nhanvien DROP CONSTRAINT IF EXISTS b_nhanvien_user_id_fkey;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Thêm các cột cho b_nhanvien nếu chưa có
      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "TEN_DANG_NHAP" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "MAT_KHAU" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "YEU_CAU_RESET" boolean DEFAULT false;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "TRANG_THAI" text DEFAULT 'Hoạt động';
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "NGAY_DANG_KY" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "ROLES" text[];
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo bảng b_role nếu chưa có để lưu cấu hình vai trò và quyền hạn
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_role (
          "ROLE_CODE" text,
          "TEN_ROLE" text,
          "PERMISSIONS" text[],
          user_id uuid,
          PRIMARY KEY ("ROLE_CODE", "user_id")
        );
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Đảm bảo b_role cũ có user_id không null để chuyển đổi khóa chính composite và tắt RLS để ghi dữ liệu hoạt động bình thường
      BEGIN
        UPDATE public.b_role SET user_id = '00000000-0000-0000-0000-000000000000'::uuid WHERE user_id IS NULL;
        ALTER TABLE public.b_role ALTER COLUMN user_id SET NOT NULL;
        IF EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints tc 
          WHERE tc.constraint_name = 'b_role_pkey' 
            AND tc.table_name = 'b_role'
        ) THEN
          ALTER TABLE public.b_role DROP CONSTRAINT IF EXISTS b_role_pkey;
          ALTER TABLE public.b_role ADD CONSTRAINT b_role_composite_pkey PRIMARY KEY ("ROLE_CODE", "user_id");
        END IF;
        ALTER TABLE public.b_role DISABLE ROW LEVEL SECURITY;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Thêm các cột cho b_thuonghieu
      BEGIN
        ALTER TABLE b_thuonghieu ADD COLUMN IF NOT EXISTS "SPH_TU" numeric;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_thuonghieu ADD COLUMN IF NOT EXISTS "SPH_DEN" numeric;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_thuonghieu ADD COLUMN IF NOT EXISTS "SPH_VIEN_TU" numeric;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_thuonghieu ADD COLUMN IF NOT EXISTS "SPH_VIEN_DEN" numeric;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_thuonghieu ADD COLUMN IF NOT EXISTS "BUOC_NHAY" numeric DEFAULT 0.25;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo bảng b_emaillog nếu chưa có để lưu nhật ký email gửi đi
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_emaillog (
          id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          "EMAIL" text,
          "TIEU_DE" text,
          "NOI_DUNG" text,
          "NGAY_GUI" text,
          "TRANG_THAI" text DEFAULT 'Thành công',
          "LOAI_EMAIL" text,
          user_id uuid
        );
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Thêm các cột cho b_nhapxuat
      BEGIN
        ALTER TABLE b_nhapxuat ADD COLUMN IF NOT EXISTS "MA_NV" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhapxuat ADD COLUMN IF NOT EXISTS "TEN_DANG_NHAP" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhapxuat ADD COLUMN IF NOT EXISTS "TRANG_THAI" text DEFAULT 'Hoàn tất';
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Thêm các cột cho b_kiemkho
      BEGIN
        ALTER TABLE b_kiemkho ADD COLUMN IF NOT EXISTS "MA_NV" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_kiemkho ADD COLUMN IF NOT EXISTS "TEN_DANG_NHAP" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Thử thêm bảng vào publication supabase_realtime để kích hoạt đồng bộ thời gian thực
      IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_sanpham;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_nhapxuat;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_nhapxuatct;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_kiemkho;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_thuonghieu;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_chinhanh;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_nhanvien;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_role;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_emaillog;
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;
    END $$;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      if (error.code === 'PGRST202') {
        // Hàm không tồn tại trong schema cache, hoàn toàn bình thường
        console.log("Hàm 'exec_sql' không có sẵn trên Supabase (bỏ qua cấu hình tự động qua exec_sql).");
        if (typeof window !== 'undefined') {
          localStorage.setItem('SUPABASE_RPC_NOT_AVAILABLE', 'true');
        }
      } else {
        console.log("Thông tin cấu hình qua exec_sql:", error.message);
      }
    } else {
      console.log("Đã cấu hình cột và mở Realtime thành công qua exec_sql");
    }
  } catch (err) {
    // Bỏ qua lỗi ngoại lệ
  }

  try {
    const { error } = await supabase.rpc('run_sql', { sql_string: sql });
    if (error) {
      if (error.code === 'PGRST202') {
        // Hàm không tồn tại trong schema cache, hoàn toàn bình thường
        console.log("Hàm 'run_sql' không có sẵn trên Supabase (bỏ qua cấu hình tự động qua run_sql).");
        if (typeof window !== 'undefined') {
          localStorage.setItem('SUPABASE_RPC_NOT_AVAILABLE', 'true');
        }
      } else {
        console.log("Thông tin cấu hình qua run_sql:", error.message);
      }
    } else {
      console.log("Đã cấu hình cột và mở Realtime thành công qua run_sql");
    }
  } catch (err) {
    // Bỏ qua lỗi ngoại lệ
  }
}

export async function ensureUserOnboarded(userId: string): Promise<UserDataPayload> {
  if (isOfflineMode) {
    return await fetchAllUserData(userId);
  }
  userId = await resolveEffectiveUserId();
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

    // --- ĐỒNG BỘ HOẶC KHỞI TẠO VAI TRÒ NẾU BẢNG TRỐNG TRÊN SUPABASE ---
    const { data: dbRoles, error: rolesErr } = await supabase
      .from('b_role')
      .select('ROLE_CODE')
      .eq('user_id', userId)
      .limit(1);

    if (!rolesErr && (!dbRoles || dbRoles.length === 0)) {
      console.log('Bảng b_role trống trên Supabase, tiến hành seed các vai trò...');
      const localRolesStr = localStorage.getItem('B_ROLE');
      let rolesToSeed = [];
      if (localRolesStr) {
        try {
          rolesToSeed = JSON.parse(localRolesStr);
        } catch {
          // bỏ qua
        }
      }
      if (!rolesToSeed || rolesToSeed.length === 0) {
        rolesToSeed = [
          {
            "ROLE_CODE": "ADMIN",
            "TEN_ROLE": "Quản trị viên (Admin)",
            "PERMISSIONS": ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY", "role.create", "role.edit", "role.delete"]
          },
          {
            "ROLE_CODE": "MANAGER",
            "TEN_ROLE": "Quản lý Kho",
            "PERMISSIONS": ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY"]
          },
          {
            "ROLE_CODE": "STAFF",
            "TEN_ROLE": "Nhân viên Bán hàng",
            "PERMISSIONS": ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY"]
          }
        ];
      }
      for (const r of rolesToSeed) {
        await supabase.from('b_role').insert({
          "ROLE_CODE": r.ROLE_CODE,
          "TEN_ROLE": r.TEN_ROLE,
          "PERMISSIONS": r.PERMISSIONS || [],
          user_id: userId
        });
      }
      console.log('Seed vai trò hoàn tất.');
    }

  } catch (err) {
    logDbError('Lỗi ngoài dự kiến khi thực hiện Onboarding:', err);
  }

  // Tải toàn bộ dữ liệu mới nhất
  return await fetchAllUserData(userId);
}

/**
 * Tải toàn bộ dòng của một bảng theo phân trang (để vượt qua giới hạn 1000 dòng mặc định của Supabase/PostgREST)
 */
export async function fetchAllRows(tableName: string, userId: string): Promise<any[]> {
  userId = await resolveEffectiveUserId();
  const cacheKey = tableName.toUpperCase(); // e.g. B_SANPHAM, B_NHAPXUAT

  if (isOfflineMode) {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return [];
  }

  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .range(from, from + pageSize - 1);

      if (error) {
        logDbError(`Lỗi fetchAllRows từ ${tableName}:`, error);
        if (isNetworkError(error)) {
          isOfflineMode = true;
          console.warn(`[Database] Đã tự động kích hoạt chế độ Ngoại tuyến (Offline Mode) cho bảng ${tableName} do lỗi mạng.`);
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              return JSON.parse(cached);
            } catch {}
          }
        }
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
    } catch (err) {
      logDbError(`Lỗi ngoại lệ fetchAllRows từ ${tableName}:`, err);
      if (isNetworkError(err)) {
        isOfflineMode = true;
        console.warn(`[Database] Đã tự động kích hoạt chế độ Ngoại tuyến (Offline Mode) cho bảng ${tableName} do ngoại lệ lỗi mạng.`);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch {}
        }
      }
      break;
    }
  }
  return allData;
}

/**
 * Tải toàn bộ dữ liệu của người dùng hiện tại
 */
export async function fetchAllUserData(userId: string): Promise<UserDataPayload> {
  userId = await resolveEffectiveUserId();

  const getCached = (key: string): any[] => {
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  };

  if (isOfflineMode) {
    console.log("[Database] Đang tải dữ liệu hoàn toàn từ bộ nhớ cục bộ (Offline Mode)...");
    return {
      sanPhams: getCached('B_SANPHAM'),
      nhapXuats: getCached('B_NHAPXUAT'),
      nhapXuatCTs: getCached('B_NHAPXUATCT'),
      kiemKhos: getCached('B_KIEMKHO'),
      thuongHieus: getCached('B_THUONGHIEU'),
      chiNhanhs: getCached('B_CHINHANH'),
      nhanViens: getCached('B_NHANVIEN'),
      roles: getCached('B_ROLE')
    };
  }

  let dataSanPhams: any[] = [];
  let dataNhapXuats: any[] = [];
  let dataNhapXuatCTs: any[] = [];
  let resKiemKhos: any = { data: null, error: null };
  let resThuongHieus: any = { data: null, error: null };
  let resChiNhanhs: any = { data: null, error: null };
  let resNhanViens: any = { data: null, error: null };
  let resRoles: any = { data: null, error: null };

  try {
    const results = await Promise.all([
      fetchAllRows('b_sanpham', userId),
      fetchAllRows('b_nhapxuat', userId),
      fetchAllRows('b_nhapxuatct', userId),
      supabase.from('b_kiemkho').select('*').eq('user_id', userId),
      supabase.from('b_thuonghieu').select('*').eq('user_id', userId),
      supabase.from('b_chinhanh').select('*').eq('user_id', userId),
      supabase.from('b_nhanvien').select('*').eq('user_id', userId),
      supabase.from('b_role').select('*').eq('user_id', userId).then(
        r => r,
        err => ({ data: null, error: err })
      )
    ]);

    // Kiểm tra xem có lỗi kết nối mạng nào từ các direct queries không
    const directQueries = [
      { name: 'b_kiemkho', res: results[3] },
      { name: 'b_thuonghieu', res: results[4] },
      { name: 'b_chinhanh', res: results[5] },
      { name: 'b_nhanvien', res: results[6] }
    ];

    for (const q of directQueries) {
      if (q.res.error && isNetworkError(q.res.error)) {
        throw q.res.error;
      }
    }

    dataSanPhams = results[0];
    dataNhapXuats = results[1];
    dataNhapXuatCTs = results[2];
    resKiemKhos = results[3];
    resThuongHieus = results[4];
    resChiNhanhs = results[5];
    resNhanViens = results[6];
    resRoles = results[7];
  } catch (err) {
    logDbError('Lỗi tải fetchAllUserData từ Supabase:', err);
    if (isNetworkError(err)) {
      isOfflineMode = true;
      console.warn("[Database] Phát hiện lỗi kết nối mạng khi tải dữ liệu. Đã kích hoạt chế độ Ngoại tuyến (Offline Mode)...");
      return {
        sanPhams: getCached('B_SANPHAM'),
        nhapXuats: getCached('B_NHAPXUAT'),
        nhapXuatCTs: getCached('B_NHAPXUATCT'),
        kiemKhos: getCached('B_KIEMKHO'),
        thuongHieus: getCached('B_THUONGHIEU'),
        chiNhanhs: getCached('B_CHINHANH'),
        nhanViens: getCached('B_NHANVIEN'),
        roles: getCached('B_ROLE')
      };
    }
  }

  const handleLoadError = (table: string, err: any) => {
    logDbError(`Lỗi tải ${table}:`, err);
  };

  if (resKiemKhos.error) handleLoadError('b_kiemkho', resKiemKhos.error);
  if (resThuongHieus.error) handleLoadError('b_thuonghieu', resThuongHieus.error);
  if (resChiNhanhs.error) handleLoadError('b_chinhanh', resChiNhanhs.error);
  if (resNhanViens.error) handleLoadError('b_nhanvien', resNhanViens.error);

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
    GHI_CHU: item.GHI_CHU || '',
    MA_NV: item.MA_NV || undefined,
    TEN_DANG_NHAP: item.TEN_DANG_NHAP || undefined,
    TRANG_THAI: item.TRANG_THAI || 'Hoàn tất'
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
    TINH_NANG: item.TINH_NANG_MAC_DINH || '',
    SPH_TU: item.SPH_TU !== null && item.SPH_TU !== undefined ? Number(item.SPH_TU) : undefined,
    SPH_DEN: item.SPH_DEN !== null && item.SPH_DEN !== undefined ? Number(item.SPH_DEN) : undefined,
    SPH_VIEN_TU: item.SPH_VIEN_TU !== null && item.SPH_VIEN_TU !== undefined ? Number(item.SPH_VIEN_TU) : undefined,
    SPH_VIEN_DEN: item.SPH_VIEN_DEN !== null && item.SPH_VIEN_DEN !== undefined ? Number(item.SPH_VIEN_DEN) : undefined,
    BUOC_NHAY: item.BUOC_NHAY !== null && item.BUOC_NHAY !== undefined ? Number(item.BUOC_NHAY) : undefined
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
    PERMISSIONS: safeParseArray(item.PERMISSIONS),
    WRITE_ACCESS: item.WRITE_ACCESS ?? false,
    TEN_DANG_NHAP: item.TEN_DANG_NHAP || '',
    MAT_KHAU: item.MAT_KHAU || '',
    TRANG_THAI: item.TRANG_THAI || 'Hoạt động',
    YEU_CAU_RESET: item.YEU_CAU_RESET || false,
    NGAY_DANG_KY: item.NGAY_DANG_KY || '',
    ROLES: safeParseArray(item.ROLES)
  }));

  const roles: Role[] = (resRoles?.data || []).map((item: any) => ({
    ROLE_CODE: item.ROLE_CODE,
    TEN_ROLE: item.TEN_ROLE,
    PERMISSIONS: safeParseArray(item.PERMISSIONS)
  }));

  return {
    sanPhams,
    nhapXuats,
    nhapXuatCTs,
    kiemKhos,
    thuongHieus,
    chiNhanhs,
    nhanViens,
    roles
  };
}

/**
 * Đồng bộ hoặc Thêm/Sửa một Sản phẩm
 */
export async function syncSanPham(p: SanPham, userId: string) {
  if (isOfflineMode) {
    return { data: [p], error: null };
  }
  userId = await resolveEffectiveUserId();
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

    const res = await supabase
      .from('b_sanpham')
      .upsert(payload, { onConflict: 'SKU,user_id' })
      .select();

    if (res.error) logDbError("Lỗi syncSanPham (upsert):", res.error);
    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncSanPham:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ danh sách Sản phẩm (hỗ trợ lưu nhiều sản phẩm cùng lúc)
 */
export async function syncSanPhams(pList: SanPham[], userId: string) {
  if (isOfflineMode) {
    return { data: pList, error: null };
  }
  userId = await resolveEffectiveUserId();
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

      return supabase
        .from('b_sanpham')
        .upsert(payload, { onConflict: 'SKU,user_id' })
        .select();
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      logDbError("Lỗi syncSanPhams:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).flat(), error: null };
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncSanPhams:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ hoặc Thêm/Sửa Phiếu xuất nhập
 */
export async function syncNhapXuat(nx: NhapXuat, userId: string) {
  if (isOfflineMode) {
    return { data: [nx], error: null };
  }
  userId = await resolveEffectiveUserId();
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
      "MA_NV": nx.MA_NV || null,
      "TEN_DANG_NHAP": nx.TEN_DANG_NHAP || null,
      "TRANG_THAI": nx.TRANG_THAI || 'Hoàn tất',
      user_id: userId
    };

    const res = await supabase
      .from('b_nhapxuat')
      .upsert(payload, { onConflict: 'HOA_DON,user_id' })
      .select();

    if (res.error) {
      // Nếu có lỗi do constraint chỉ có HOA_DON hoặc HOA_DON_user_id
      logDbError("Lỗi syncNhapXuat (upsert):", res.error);
    }
    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncNhapXuat:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ danh sách chi tiết hóa đơn
 */
export async function syncNhapXuatCTs(details: NhapXuatCT[], userId: string) {
  if (isOfflineMode) {
    return { data: details, error: null };
  }
  userId = await resolveEffectiveUserId();
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

      return supabase
        .from('b_nhapxuatct')
        .upsert(payload, { onConflict: 'id,user_id' })
        .select();
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      logDbError("Lỗi syncNhapXuatCTs:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).flat(), error: null };
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncNhapXuatCTs:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ phiếu kiểm kho
 */
export async function syncKiemKho(k: KiemKho, userId: string) {
  if (isOfflineMode) {
    return { data: [k], error: null };
  }
  userId = await resolveEffectiveUserId();
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
      "MA_NV": k.MA_NV || null,
      "TEN_DANG_NHAP": k.TEN_DANG_NHAP || null,
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
      if (res.error) logDbError("Lỗi syncKiemKho (update):", res.error);
    } else {
      res = await supabase
        .from('b_kiemkho')
        .insert(payload)
        .select();
      if (res.error) logDbError("Lỗi syncKiemKho (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncKiemKho:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Thương hiệu
 */
export async function syncThuongHieu(t: ThươngHieu, userId: string) {
  if (isOfflineMode) {
    return { data: [t], error: null };
  }
  userId = await resolveEffectiveUserId();
  try {
    const payload = {
      "THUONG_HIEU": t.THUONG_HIEU,
      "CHIET_XUAT_MAC_DINH": t.CHIET_XUAT_MAC_DINH,
      "TINH_NANG_MAC_DINH": t.TINH_NANG_MAC_DINH,
      "SPH_TU": t.SPH_TU !== undefined ? t.SPH_TU : null,
      "SPH_DEN": t.SPH_DEN !== undefined ? t.SPH_DEN : null,
      "SPH_VIEN_TU": t.SPH_VIEN_TU !== undefined ? t.SPH_VIEN_TU : null,
      "SPH_VIEN_DEN": t.SPH_VIEN_DEN !== undefined ? t.SPH_VIEN_DEN : null,
      "BUOC_NHAY": t.BUOC_NHAY !== undefined ? t.BUOC_NHAY : null,
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

      if (res.error && (res.error.code === '42703' || String(res.error.message).includes('column'))) {
        console.warn("Retrying syncThuongHieu (update) without SPH_VIEN columns...");
        const backupPayload = { ...payload };
        delete (backupPayload as any)["SPH_VIEN_TU"];
        delete (backupPayload as any)["SPH_VIEN_DEN"];
        res = await supabase
          .from('b_thuonghieu')
          .update(backupPayload)
          .eq('THUONG_HIEU', t.THUONG_HIEU)
          .eq('user_id', userId)
          .select();

        if (res.error && (res.error.code === '42703' || String(res.error.message).includes('column'))) {
          console.warn("Retrying syncThuongHieu (update) without SPH_TU/SPH_DEN/BUOC_NHAY columns...");
          const minimalPayload = {
            "THUONG_HIEU": t.THUONG_HIEU,
            "CHIET_XUAT_MAC_DINH": t.CHIET_XUAT_MAC_DINH,
            "TINH_NANG_MAC_DINH": t.TINH_NANG_MAC_DINH,
            user_id: userId
          };
          res = await supabase
            .from('b_thuonghieu')
            .update(minimalPayload)
            .eq('THUONG_HIEU', t.THUONG_HIEU)
            .eq('user_id', userId)
            .select();
        }
      }

      if (res.error) logDbError("Lỗi syncThuongHieu (update):", res.error);
    } else {
      res = await supabase
        .from('b_thuonghieu')
        .insert(payload)
        .select();

      if (res.error && (res.error.code === '42703' || String(res.error.message).includes('column'))) {
        console.warn("Retrying syncThuongHieu (insert) without SPH_VIEN columns...");
        const backupPayload = { ...payload };
        delete (backupPayload as any)["SPH_VIEN_TU"];
        delete (backupPayload as any)["SPH_VIEN_DEN"];
        res = await supabase
          .from('b_thuonghieu')
          .insert(backupPayload)
          .select();

        if (res.error && (res.error.code === '42703' || String(res.error.message).includes('column'))) {
          console.warn("Retrying syncThuongHieu (insert) without SPH_TU/SPH_DEN/BUOC_NHAY columns...");
          const minimalPayload = {
            "THUONG_HIEU": t.THUONG_HIEU,
            "CHIET_XUAT_MAC_DINH": t.CHIET_XUAT_MAC_DINH,
            "TINH_NANG_MAC_DINH": t.TINH_NANG_MAC_DINH,
            user_id: userId
          };
          res = await supabase
            .from('b_thuonghieu')
            .insert(minimalPayload)
            .select();
        }
      }

      if (res.error) logDbError("Lỗi syncThuongHieu (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncThuongHieu:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Chi nhánh
 */
export async function syncChiNhanh(c: ChiNhanh, userId: string) {
  if (isOfflineMode) {
    return { data: [c], error: null };
  }
  userId = await resolveEffectiveUserId();
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
      if (res.error) logDbError("Lỗi syncChiNhanh (update):", res.error);
    } else {
      res = await supabase
        .from('b_chinhanh')
        .insert(payload)
        .select();
      if (res.error) logDbError("Lỗi syncChiNhanh (insert):", res.error);
    }
    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncChiNhanh:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ Nhân viên
 */
export async function syncNhanVien(n: NhanVien, userId: string) {
  if (isOfflineMode) {
    return { data: [n], error: null };
  }
  userId = await resolveEffectiveUserId();
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
      "YEU_CAU_RESET": n.YEU_CAU_RESET || false,
      "TRANG_THAI": n.TRANG_THAI || 'Hoạt động',
      "ROLES": n.ROLES || [],
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
      if (res.error) logDbError("Lỗi syncNhanVien (update):", res.error);
    } else {
      // Chưa có -> Thêm mới
      res = await supabase
        .from('b_nhanvien')
        .insert(payload)
        .select();
      if (res.error) logDbError("Lỗi syncNhanVien (insert):", res.error);
    }

    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncNhanVien:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ hoặc Thêm/Sửa một Vai trò (Role)
 */
export async function syncRole(r: Role, userId: string) {
  if (isOfflineMode) {
    return { data: [r], error: null };
  }
  userId = await resolveEffectiveUserId();
  try {
    const payload = {
      "ROLE_CODE": r.ROLE_CODE,
      "TEN_ROLE": r.TEN_ROLE,
      "PERMISSIONS": r.PERMISSIONS || [],
      user_id: userId
    };

    // Kiểm tra xem vai trò này đã tồn tại trong DB chưa
    const { data: existing, error: checkError } = await supabase
      .from('b_role')
      .select('ROLE_CODE')
      .eq('ROLE_CODE', r.ROLE_CODE)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.warn("Lỗi kiểm tra b_role tồn tại:", checkError.message);
    }

    let res;
    if (existing) {
      // Đã có -> Cập nhật
      res = await supabase
        .from('b_role')
        .update(payload)
        .eq('ROLE_CODE', r.ROLE_CODE)
        .eq('user_id', userId)
        .select();
      if (res.error) logDbError("Lỗi syncRole (update):", res.error);
    } else {
      // Chưa có -> Thêm mới
      res = await supabase
        .from('b_role')
        .insert(payload)
        .select();
      if (res.error) logDbError("Lỗi syncRole (insert):", res.error);
    }

    return res;
  } catch (err: any) {
    logDbError("Lỗi ngoài dự kiến trong syncRole:", err);
    return { error: err };
  }
}

/**
 * Đồng bộ danh sách vai trò
 */
export async function syncRoles(rList: Role[], userId: string) {
  const results = [];
  for (const r of rList) {
    const res = await syncRole(r, userId);
    results.push(res);
  }
  return results;
}

/**
 * Xóa một vai trò
 */
export async function deleteRole(roleCode: string, userId: string) {
  if (isOfflineMode) {
    return { error: null };
  }
  userId = await resolveEffectiveUserId();
  
  // Xóa với user_id hiện tại
  let res = await supabase.from('b_role').delete().eq('ROLE_CODE', roleCode).eq('user_id', userId);
  
  // Đồng thời xóa với user_id mặc định dự phòng '00000000-0000-0000-0000-000000000000' nếu có
  await supabase.from('b_role').delete().eq('ROLE_CODE', roleCode).eq('user_id', '00000000-0000-0000-0000-000000000000');

  if (res.error) {
    console.warn("Thử xóa b_role bằng user_id thất bại, thử xóa trực tiếp bằng ROLE_CODE", res.error);
    const res2 = await supabase.from('b_role').delete().eq('ROLE_CODE', roleCode);
    if (res2.error) {
      logDbError("Lỗi deleteRole:", res2.error);
      return res2;
    }
    return res2;
  }
  return res;
}

/**
 * Xóa Phiếu xuất nhập và tất cả chi tiết liên quan
 */
export async function deleteNhapXuatAndDetails(hoaDon: string) {
  const [res1, res2] = await Promise.all([
    supabase.from('b_nhapxuatct').delete().eq('HOA_DON', hoaDon),
    supabase.from('b_nhapxuat').delete().eq('HOA_DON', hoaDon)
  ]);
  if (res1.error) logDbError("Lỗi deleteNhapXuatCT:", res1.error);
  if (res2.error) logDbError("Lỗi deleteNhapXuat:", res2.error);
  return { error: res1.error || res2.error };
}

/**
 * Xóa Thương hiệu
 */
export async function deleteThuongHieu(thuongHieu: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_thuonghieu').delete().eq('THUONG_HIEU', thuongHieu).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteThuongHieu:", res.error);
  return res;
}

/**
 * Xóa Chi nhánh
 */
export async function deleteChiNhanh(chiNhanh: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_chinhanh').delete().eq('CHI_NHANH', chiNhanh).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteChiNhanh:", res.error);
  return res;
}

/**
 * Xóa Nhân viên
 */
export async function deleteNhanVien(email: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_nhanvien').delete().eq('EMAIL', email).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteNhanVien:", res.error);
  return res;
}

/**
 * Ghi nhận nhật ký email gửi đi
 */
export async function syncEmailLog(log: EmailLog, userId: string) {
  userId = await resolveEffectiveUserId();
  const emailDate = log.NGAY_GUI || new Date().toLocaleString('vi-VN');
  
  const localLog: EmailLog = {
    id: log.id || Math.random().toString(36).substring(2, 15),
    EMAIL: log.EMAIL,
    TIEU_DE: log.TIEU_DE,
    NOI_DUNG: log.NOI_DUNG,
    NGAY_GUI: emailDate,
    TRANG_THAI: log.TRANG_THAI || 'Thành công',
    LOAI_EMAIL: log.LOAI_EMAIL,
    user_id: userId
  };

  // 1. Lưu vào localStorage trước để đảm bảo dữ liệu không bị mất
  try {
    const saved = localStorage.getItem('B_EMAILLOG');
    const logs: EmailLog[] = saved ? JSON.parse(saved) : [];
    
    // Tránh trùng lặp
    if (!logs.some(l => l.id === localLog.id || (l.EMAIL === localLog.EMAIL && l.TIEU_DE === localLog.TIEU_DE && l.NGAY_GUI === localLog.NGAY_GUI))) {
      logs.unshift(localLog);
      localStorage.setItem('B_EMAILLOG', JSON.stringify(logs.slice(0, 300))); // Lưu tối đa 300 dòng nhật ký
    }
  } catch (err) {
    console.warn("Lỗi lưu email log vào localStorage:", err);
  }
  
  console.log(`[EMAIL SENDING] Gửi email đến: ${log.EMAIL} | Tiêu đề: ${log.TIEU_DE}`);
  
  const payload = {
    EMAIL: log.EMAIL,
    TIEU_DE: log.TIEU_DE,
    NOI_DUNG: log.NOI_DUNG,
    NGAY_GUI: emailDate,
    TRANG_THAI: log.TRANG_THAI || 'Thành công',
    LOAI_EMAIL: log.LOAI_EMAIL,
    user_id: userId
  };

  // 2. Cố gắng ghi nhận lên Supabase b_emaillog
  try {
    const res = await supabase.from('b_emaillog').insert(payload).select();
    if (res.error) {
      const isMissingTable = res.error.code === '42P01' || 
                             res.error.message?.includes('b_emaillog') || 
                             res.error.message?.includes('schema cache');
      if (isMissingTable) {
        console.log(`[EMAIL LOG] Bảng b_emaillog gặp lỗi trên Supabase khi gửi email (Chi tiết: ${res.error.message}, Code: ${res.error.code}). Sử dụng LocalStorage làm fallback.`);
      } else {
        console.warn("Lỗi syncEmailLog lên Supabase (sử dụng lưu trữ cục bộ fallback):", res.error.message);
      }
    }
    return res;
  } catch (err: any) {
    console.warn("Exception khi syncEmailLog lên Supabase:", err?.message || err);
    return { data: null, error: err };
  }
}

/**
 * Lấy danh sách nhật ký email
 */
export async function fetchEmailLogs(userId: string): Promise<EmailLog[]> {
  userId = await resolveEffectiveUserId();

  // Đọc danh sách cục bộ dự phòng trước
  let localLogs: EmailLog[] = [];
  try {
    const saved = localStorage.getItem('B_EMAILLOG');
    if (saved) {
      localLogs = JSON.parse(saved);
    }
  } catch (err) {
    console.warn("Lỗi đọc email logs từ localStorage:", err);
  }
  
  try {
    const { data, error } = await supabase
      .from('b_emaillog')
      .select('*')
      .eq('user_id', userId)
      .order('NGAY_GUI', { ascending: false });
      
    if (error) {
      // Giảm độ nghiêm trọng của log nếu chỉ là lỗi thiếu bảng hoặc lỗi cache schema
      const isMissingTable = error.code === '42P01' || 
                             error.message?.includes('b_emaillog') || 
                             error.message?.includes('schema cache');
      if (isMissingTable) {
        console.log(`[EMAIL LOG] Bảng b_emaillog gặp lỗi hoặc chưa sẵn sàng trên Supabase (Chi tiết: ${error.message}, Code: ${error.code}). Hệ thống tự động kích hoạt chế độ lưu trữ cục bộ LocalStorage.`);
      } else {
        console.warn("Lỗi fetchEmailLogs từ Supabase:", error.message);
      }
      return localLogs;
    }
    
    // Nếu có dữ liệu từ Supabase, cập nhật ngược lại cache cục bộ để đảm bảo đồng nhất
    if (data) {
      try {
        localStorage.setItem('B_EMAILLOG', JSON.stringify(data));
      } catch (err) {
        console.warn("Lỗi lưu cache email logs:", err);
      }
      return data;
    }
  } catch (err: any) {
    console.warn("Exception khi fetchEmailLogs từ Supabase:", err?.message || err);
  }

  return localLogs;
}
