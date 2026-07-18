import { supabase, SUPABASE_STORAGE_BUCKET } from './supabaseClient';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThuongHieu, ChiNhanh, NhanVien, EmailLog, Role, safeParseArray } from './types';

export let isOfflineMode = false;
export let hasCreatedColumns = false;
export const memoryCache: Record<string, any[]> = {};

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
  thuongHieus: ThuongHieu[];
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

  const SCHEMA_VERSION = 'v3_roles_active_v1';
  if (typeof window !== 'undefined') {
    if (localStorage.getItem('SUPABASE_RPC_NOT_AVAILABLE') === 'true') {
      console.log("Bỏ qua cấu hình tự động do không được hỗ trợ trên Supabase này.");
      return;
    }
    if (localStorage.getItem('DB_SCHEMA_VERSION') === SCHEMA_VERSION) {
      console.log("Cơ sở dữ liệu đã đồng bộ cấu hình phiên bản mới nhất (" + SCHEMA_VERSION + ").");
      return;
    }
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

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "role" text;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "active" boolean;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Di chuyển dữ liệu cũ
      BEGIN
        UPDATE b_nhanvien 
        SET "role" = CASE 
          WHEN upper(trim("ROLE")) = 'ADMIN' THEN 'admin'
          WHEN upper(trim("ROLE")) = 'KHO' THEN 'manager'
          ELSE 'user'
        END
        WHERE "role" IS NULL;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        UPDATE b_nhanvien 
        SET "active" = CASE 
          WHEN upper(trim("TRANG_THAI")) IN ('HOẠT ĐỘNG', 'ACTIVE', 'KÍCH HOẠT', 'HOAT DONG') THEN true
          ELSE false
        END
        WHERE "active" IS NULL;
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

      -- Tạo bảng b_export_template
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_export_template (
          id text,
          name text,
          type text,
          "fileName" text,
          "fileData" text,
          "isDefault" boolean DEFAULT false,
          "detectedPlaceholders" text[],
          description text,
          "createdAt" text,
          "applicableReportTypes" text[],
          user_id uuid,
          PRIMARY KEY (id, user_id)
        );
        ALTER TABLE public.b_export_template DISABLE ROW LEVEL SECURITY;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Đảm bảo các cột mới nâng cấp tồn tại trên b_export_template
      BEGIN
        ALTER TABLE public.b_export_template ADD COLUMN IF NOT EXISTS "user_id" uuid;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE public.b_export_template ADD COLUMN IF NOT EXISTS "startRow" integer;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE public.b_export_template ADD COLUMN IF NOT EXISTS "columnMappings" jsonb;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE public.b_export_template ADD COLUMN IF NOT EXISTS "groupByFields" text[];
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo bảng b_export_mapping
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_export_mapping (
          placeholder text,
          "sourceType" text,
          "sourceField" text,
          description text,
          user_id uuid,
          PRIMARY KEY (placeholder, user_id)
        );
        ALTER TABLE public.b_export_mapping DISABLE ROW LEVEL SECURITY;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Đảm bảo b_export_mapping có cột user_id
      BEGIN
        ALTER TABLE public.b_export_mapping ADD COLUMN IF NOT EXISTS "user_id" uuid;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo bảng b_gomdon nếu chưa có để lưu thẻ gom đơn hàng tạm
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_gomdon (
          id text PRIMARY KEY,
          branch text NOT NULL,
          original_text text,
          trang_thai text DEFAULT 'Chờ xử lý',
          so_phieu_xuat text,
          created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
          user_id uuid
        );
        ALTER TABLE public.b_gomdon DISABLE ROW LEVEL SECURITY;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo bảng b_gomdonct nếu chưa có để lưu chi tiết thẻ gom đơn
      BEGIN
        CREATE TABLE IF NOT EXISTS public.b_gomdonct (
          id text PRIMARY KEY,
          gom_don_id text REFERENCES public.b_gomdon(id) ON DELETE CASCADE,
          raw_line text,
          brand text,
          chiet_xuat text,
          tinh_nang text,
          sph numeric,
          cyl numeric,
          quantity integer DEFAULT 1,
          unit text DEFAULT 'miếng',
          sku text,
          error text,
          user_id uuid
        );
        ALTER TABLE public.b_gomdonct DISABLE ROW LEVEL SECURITY;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Đảm bảo tắt RLS và cấp quyền đầy đủ cho b_gomdon và b_gomdonct để tránh lỗi xóa đơn hàng tạm
      BEGIN
        ALTER TABLE IF EXISTS public.b_gomdon DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_gomdonct DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON TABLE public.b_gomdon TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_gomdonct TO anon, authenticated, service_role;
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
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_export_template;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_export_mapping;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_gomdon;
        EXCEPTION WHEN others THEN NULL;
        END;
        BEGIN
          ALTER PUBLICATION supabase_realtime ADD TABLE b_gomdonct;
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;
      END $$;

      CREATE OR REPLACE FUNCTION public.register_nhanvien(
        p_ma_nv text,
        p_ho_ten text,
        p_email text,
        p_ten_dang_nhap text,
        p_mat_khau text,
        p_user_id uuid
      ) RETURNS jsonb AS $func$
      DECLARE
        v_admin_count integer;
        v_email_exists boolean;
        v_username_exists boolean;
        v_role text;
        v_trang_thai text;
        v_chuc_vu text;
        v_bo_phan text;
        v_write_access boolean;
        v_current_date text;
        v_roles text[];
        v_permissions text[];
      BEGIN
        -- 1. Check if email exists
        SELECT EXISTS (
          SELECT 1 FROM public.b_nhanvien 
          WHERE lower(trim("EMAIL")) = lower(trim(p_email)) 
            AND user_id = p_user_id
        ) INTO v_email_exists;

        IF v_email_exists THEN
          RETURN jsonb_build_object('success', false, 'message', 'Email này đã được sử dụng. Vui lòng chọn Email khác.');
        END IF;

        -- 2. Check if username exists
        SELECT EXISTS (
          SELECT 1 FROM public.b_nhanvien 
          WHERE lower(trim("TEN_DANG_NHAP")) = lower(trim(p_ten_dang_nhap)) 
            AND user_id = p_user_id
        ) INTO v_username_exists;

        IF v_username_exists THEN
          RETURN jsonb_build_object('success', false, 'message', 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn Tên đăng nhập khác.');
        END IF;

        -- 3. Check count of existing ADMIN roles
        SELECT COUNT(*) FROM public.b_nhanvien 
        WHERE (upper(trim("ROLE")) = 'ADMIN') 
          AND user_id = p_user_id
        INTO v_admin_count;

        IF v_admin_count = 0 THEN
          -- First account: set as Admin and active
          v_role := 'ADMIN';
          v_trang_thai := 'Hoạt động';
          v_chuc_vu := 'Chủ sở hữu (Admin)';
          v_bo_phan := 'Ban Giám Đốc';
          v_write_access := true;
          v_roles := ARRAY['ADMIN'];
          v_permissions := ARRAY['DASHBOARD', 'PRODUCT', 'TRANSACTION', 'HISTORY', 'AUDIT', 'CATEGORY'];
        ELSE
          -- Subsequent accounts: set as standard employee and pending
          v_role := 'NHAN_VIEN';
          v_trang_thai := 'PENDING';
          v_chuc_vu := 'Nhân viên chờ duyệt';
          v_bo_phan := 'Bộ Phận Bán Hàng';
          v_write_access := false;
          v_roles := ARRAY['NHAN_VIEN'];
          v_permissions := ARRAY['TRANSACTION'];
        END IF;

        v_current_date := to_char(current_timestamp, 'YYYY-MM-DD');

        -- 4. Insert record
        INSERT INTO public.b_nhanvien (
          "MA_NV", "HO_TEN", "CHUC_VU", "BO_PHAN", "CHI_NHANH", 
          "EMAIL", "ROLE", "role", "active", "WRITE_ACCESS", "TEN_DANG_NHAP", 
          "MAT_KHAU", "TRANG_THAI", "YEU_CAU_RESET", "NGAY_DANG_KY", "user_id",
          "ROLES", "PERMISSIONS"
        ) VALUES (
          p_ma_nv, p_ho_ten, v_chuc_vu, v_bo_phan, 'Kho Trung Tâm',
          p_email, v_role, CASE WHEN v_role = 'ADMIN' THEN 'admin' ELSE 'pending' END, (v_role = 'ADMIN'), v_write_access, p_ten_dang_nhap,
          p_mat_khau, v_trang_thai, false, v_current_date, p_user_id,
          v_roles, v_permissions
        );

        RETURN jsonb_build_object(
          'success', true, 
          'message', 'Đăng ký thành công!', 
          'role', v_role, 
          'trang_thai', v_trang_thai
        );
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;
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

  if (typeof window !== 'undefined') {
    localStorage.setItem('DB_SCHEMA_VERSION', 'v3_roles_active_v1');
  }
}

/**
 * Đảm bảo Bucket lưu trữ đã tồn tại và được phân quyền công khai trên Supabase Storage
 */
export async function ensureStorageBucketExists() {
  if (isOfflineMode) return;
  
  if (typeof window !== 'undefined' && (window as any).__hasCreatedStorageBucket) return;
  if (typeof window !== 'undefined') {
    (window as any).__hasCreatedStorageBucket = true;
  }

  // 1. Kiểm tra sự tồn tại và khả năng hoạt động của bucket bằng phương thức Client (list files) thay vì GetBucket quản trị.
  // Điều này giúp tránh hoàn toàn lỗi "400 Bad Request: Only service_role key can be used..." trong Console.
  try {
    const { data: listData, error: listError } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).list('', { limit: 1 });
    if (!listError) {
      console.log(`[Storage] Xác nhận bucket '${SUPABASE_STORAGE_BUCKET}' đã tồn tại và sẵn sàng sử dụng.`);
      return;
    }
  } catch (e) {}

  // 2. Chỉ cố gắng tạo và phân quyền bằng SQL thông qua RPC (exec_sql / run_sql) nếu kiểm tra trên thất bại.
  // Tuyệt đối KHÔNG gọi supabase.storage.createBucket hay getBucket vì client anon key không được phép và sẽ gây lỗi đỏ 400.
  const sql = `
    DO $$
    BEGIN
      -- Tạo bucket '${SUPABASE_STORAGE_BUCKET}' nếu chưa có trong table storage.buckets
      BEGIN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          '${SUPABASE_STORAGE_BUCKET}', 
          '${SUPABASE_STORAGE_BUCKET}', 
          true, 
          10485760, 
          '{"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/pdf"}'
        )
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION WHEN others THEN NULL;
      END;

      -- Tạo các policy cho phép public truy cập và đăng tải
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public select (${SUPABASE_STORAGE_BUCKET})'
        ) THEN
          CREATE POLICY "Allow public select (${SUPABASE_STORAGE_BUCKET})" ON storage.objects FOR SELECT USING (bucket_id = '${SUPABASE_STORAGE_BUCKET}');
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public insert (${SUPABASE_STORAGE_BUCKET})'
        ) THEN
          CREATE POLICY "Allow public insert (${SUPABASE_STORAGE_BUCKET})" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${SUPABASE_STORAGE_BUCKET}');
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public update (${SUPABASE_STORAGE_BUCKET})'
        ) THEN
          CREATE POLICY "Allow public update (${SUPABASE_STORAGE_BUCKET})" ON storage.objects FOR UPDATE USING (bucket_id = '${SUPABASE_STORAGE_BUCKET}');
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public delete (${SUPABASE_STORAGE_BUCKET})'
        ) THEN
          CREATE POLICY "Allow public delete (${SUPABASE_STORAGE_BUCKET})" ON storage.objects FOR DELETE USING (bucket_id = '${SUPABASE_STORAGE_BUCKET}');
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END $$;
  `;

  try {
    const { error: err1 } = await supabase.rpc('exec_sql', { sql });
    if (!err1) {
      console.log(`[Storage] Đã cấu hình khởi tạo và phân quyền cho bucket '${SUPABASE_STORAGE_BUCKET}' thành công via exec_sql.`);
      return;
    }
  } catch (e) {}

  try {
    const { error: err2 } = await supabase.rpc('run_sql', { sql_string: sql });
    if (!err2) {
      console.log(`[Storage] Đã cấu hình khởi tạo và phân quyền cho bucket '${SUPABASE_STORAGE_BUCKET}' thành công via run_sql.`);
      return;
    }
  } catch (e) {}
}

export async function ensureUserOnboarded(userId: string): Promise<UserDataPayload> {
  if (isOfflineMode) {
    return await fetchAllUserData(userId);
  }
  userId = await resolveEffectiveUserId();
  try {
    // 1. Cố gắng tự động tạo cột trên Supabase (nếu chưa có)
    await tryCreateColumnsOnSupabase();
    await ensureStorageBucketExists();

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
        // Kiểm tra xem đã có tài khoản ADMIN nào trong b_nhanvien thuộc user_id này chưa
        const { data: adminCheck } = await supabase
          .from('b_nhanvien')
          .select('MA_NV')
          .eq('ROLE', 'ADMIN')
          .eq('user_id', userId)
          .limit(1);

        const hasAdmin = adminCheck && adminCheck.length > 0;
        const assignedRole = hasAdmin ? 'NHAN_VIEN' : 'ADMIN';
        const assignedStatus = hasAdmin ? 'PENDING' : 'Hoạt động';

        console.log(`Tự động onboard tài khoản ${email}: gán vai trò ${assignedRole}, trạng thái ${assignedStatus}`);
        
        await supabase.from('b_nhanvien').insert({
          "MA_NV": "NV_" + (assignedRole === 'ADMIN' ? "ADMIN_" : "") + Math.random().toString(36).substr(2, 4).toUpperCase(),
          "HO_TEN": email.split('@')[0].toUpperCase(),
          "CHUC_VU": assignedRole === 'ADMIN' ? "Chủ sở hữu (Admin)" : "Nhân viên chờ duyệt",
          "BO_PHAN": assignedRole === 'ADMIN' ? "Ban Giám Đốc" : "Bộ Phận Bán Hàng",
          "CHI_NHANH": "Kho Trung Tâm",
          "EMAIL": email,
          "ROLE": assignedRole,
          "PERMISSIONS": assignedRole === 'ADMIN' 
            ? ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY"] 
            : ["TRANSACTION"],
          "WRITE_ACCESS": assignedRole === 'ADMIN',
          "TRANG_THAI": assignedStatus,
          "ROLES": [assignedRole],
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
      let rolesToSeed = memoryCache['B_ROLE'] || [];
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
    return memoryCache[cacheKey] || [];
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
        .in('user_id', [userId, '00000000-0000-0000-0000-000000000000'])
        .range(from, from + pageSize - 1);

      if (error) {
        logDbError(`Lỗi fetchAllRows từ ${tableName}:`, error);
        if (isNetworkError(error)) {
          console.warn(`[Database] Đang sử dụng dữ liệu Cache từ Memory Cache cho bảng ${tableName} do lỗi mạng.`);
          return memoryCache[cacheKey] || [];
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
        console.warn(`[Database] Đang sử dụng dữ liệu Cache từ Memory Cache cho bảng ${tableName} do ngoại lệ lỗi mạng.`);
        return memoryCache[cacheKey] || [];
      }
      break;
    }
  }

  memoryCache[cacheKey] = allData;
  return allData;
}

/**
 * Tải toàn bộ dữ liệu của người dùng hiện tại
 */
export async function fetchAllUserData(userId: string): Promise<UserDataPayload> {
  userId = await resolveEffectiveUserId();

  const getCached = (key: string): any[] => {
    return memoryCache[key] || [];
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
      supabase.from('b_kiemkho').select('*').in('user_id', [userId, '00000000-0000-0000-0000-000000000000']),
      supabase.from('b_thuonghieu').select('*').in('user_id', [userId, '00000000-0000-0000-0000-000000000000']),
      supabase.from('b_chinhanh').select('*').in('user_id', [userId, '00000000-0000-0000-0000-000000000000']),
      supabase.from('b_nhanvien').select('*').in('user_id', [userId, '00000000-0000-0000-0000-000000000000']),
      supabase.from('b_role').select('*').in('user_id', [userId, '00000000-0000-0000-0000-000000000000']).then(
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
      console.warn("[Database] Phát hiện lỗi kết nối mạng khi tải dữ liệu. Đang tự động sử dụng dữ liệu Cache Ngoại tuyến...");
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

  const thuongHieus: ThuongHieu[] = (resThuongHieus.data || []).map(item => ({
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

  // Deduplicate roles by ROLE_CODE, prioritizing user-specific ones
  const roleMap: Record<string, any> = {};
  (resRoles?.data || []).forEach((item: any) => {
    const code = (item.ROLE_CODE || '').trim().toUpperCase();
    const isGlobal = item.user_id === '00000000-0000-0000-0000-000000000000';
    if (!roleMap[code] || !isGlobal) {
      roleMap[code] = item;
    }
  });
  const roles: Role[] = Object.values(roleMap).map((item: any) => ({
    ROLE_CODE: item.ROLE_CODE,
    TEN_ROLE: item.TEN_ROLE,
    PERMISSIONS: safeParseArray(item.PERMISSIONS)
  }));

  // Cache in-memory
  memoryCache['B_SANPHAM'] = sanPhams;
  memoryCache['B_NHAPXUAT'] = nhapXuats;
  memoryCache['B_NHAPXUATCT'] = nhapXuatCTs;
  memoryCache['B_KIEMKHO'] = kiemKhos;
  memoryCache['B_THUONGHIEU'] = thuongHieus;
  memoryCache['B_CHINHANH'] = chiNhanhs;
  memoryCache['B_NHANVIEN'] = nhanViens;
  memoryCache['B_ROLE'] = roles;

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

    let res = await supabase
      .from('b_sanpham')
      .upsert(payload, { onConflict: 'SKU' })
      .select();

    if (res.error && (
      res.error.message?.includes('unique or exclusion constraint') ||
      res.error.message?.includes('ON CONFLICT') ||
      res.error.code === '42P10'
    )) {
      console.warn("syncSanPham upsert failed due to onConflict, falling back to safe select-then-update/insert...", res.error.message);
      const { data: existing } = await supabase
        .from('b_sanpham')
        .select('SKU')
        .eq('SKU', p.SKU)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        res = await supabase
          .from('b_sanpham')
          .update(payload)
          .eq('SKU', p.SKU)
          .eq('user_id', userId)
          .select();
      } else {
        res = await supabase
          .from('b_sanpham')
          .insert(payload)
          .select();
      }
    }

    if (res.error) logDbError("Lỗi syncSanPham:", res.error);
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
      return syncSanPham(p, userId);
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      logDbError("Lỗi syncSanPhams:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).filter(Boolean).flat(), error: null };
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

    let res = await supabase
      .from('b_nhapxuat')
      .upsert(payload, { onConflict: 'HOA_DON' })
      .select();

    if (res.error && (
      res.error.message?.includes('unique or exclusion constraint') ||
      res.error.message?.includes('ON CONFLICT') ||
      res.error.code === '42P10'
    )) {
      console.warn("syncNhapXuat upsert failed due to onConflict, falling back to safe select-then-update/insert...", res.error.message);
      const { data: existing } = await supabase
        .from('b_nhapxuat')
        .select('HOA_DON')
        .eq('HOA_DON', nx.HOA_DON)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        res = await supabase
          .from('b_nhapxuat')
          .update(payload)
          .eq('HOA_DON', nx.HOA_DON)
          .eq('user_id', userId)
          .select();
      } else {
        res = await supabase
          .from('b_nhapxuat')
          .insert(payload)
          .select();
      }
    }

    if (res.error) {
      logDbError("Lỗi syncNhapXuat:", res.error);
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

      let res = await supabase
        .from('b_nhapxuatct')
        .upsert(payload, { onConflict: 'id' })
        .select();

      if (res.error && (
        res.error.message?.includes('unique or exclusion constraint') ||
        res.error.message?.includes('ON CONFLICT') ||
        res.error.code === '42P10'
      )) {
        console.warn("syncNhapXuatCTs upsert failed due to onConflict, falling back to safe select-then-update/insert...", res.error.message);
        const { data: existing } = await supabase
          .from('b_nhapxuatct')
          .select('id')
          .eq('id', d.ID)
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          res = await supabase
            .from('b_nhapxuatct')
            .update(payload)
            .eq('id', d.ID)
            .eq('user_id', userId)
            .select();
        } else {
          res = await supabase
            .from('b_nhapxuatct')
            .insert(payload)
            .select();
        }
      }
      return res;
    });

    const results = await Promise.all(promises);
    const failed = results.find(r => r.error);
    if (failed) {
      logDbError("Lỗi syncNhapXuatCTs:", failed.error);
      return { error: failed.error };
    }
    return { data: results.map(r => r.data).filter(Boolean).flat(), error: null };
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
export async function syncThuongHieu(t: ThuongHieu, userId: string) {
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
      "role": n.role || (() => {
        const R = (n.ROLE || '').trim().toUpperCase();
        if (R === 'ADMIN') return 'admin';
        if (R === 'KHO') return 'manager';
        return 'user';
      })(),
      "active": typeof n.active === 'boolean' ? n.active : (() => {
        const status = (n.TRANG_THAI || '').trim().toUpperCase();
        return status === 'HOẠT ĐỘNG' || status === 'ACTIVE' || status === 'KÍCH HOẠT' || status === 'HOAT DONG';
      })(),
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

  // 1. Lưu vào memoryCache trước để đảm bảo dữ liệu không bị mất
  try {
    const logs: EmailLog[] = memoryCache['B_EMAILLOG'] || [];
    
    // Tránh trùng lặp
    if (!logs.some(l => l.id === localLog.id || (l.EMAIL === localLog.EMAIL && l.TIEU_DE === localLog.TIEU_DE && l.NGAY_GUI === localLog.NGAY_GUI))) {
      const nextLogs = [localLog, ...logs];
      memoryCache['B_EMAILLOG'] = nextLogs.slice(0, 300); // Lưu tối đa 300 dòng nhật ký
    }
  } catch (err) {
    console.warn("Lỗi lưu email log vào memoryCache:", err);
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
        console.log(`[EMAIL LOG] Bảng b_emaillog gặp lỗi trên Supabase khi gửi email (Chi tiết: ${res.error.message}, Code: ${res.error.code}). Sử dụng MemoryCache làm fallback.`);
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
  let localLogs: EmailLog[] = memoryCache['B_EMAILLOG'] || [];
  
  try {
    const { data, error } = await supabase
      .from('b_emaillog')
      .select('*')
      .eq('user_id', userId)
      .order('NGAY_GUI', { ascending: false })
      .limit(100);
      
    if (error) {
      // Giảm độ nghiêm trọng của log nếu chỉ là lỗi thiếu bảng hoặc lỗi cache schema
      const isMissingTable = error.code === '42P01' || 
                             error.message?.includes('b_emaillog') || 
                             error.message?.includes('schema cache');
      if (isMissingTable) {
        console.log(`[EMAIL LOG] Bảng b_emaillog gặp lỗi hoặc chưa sẵn sàng trên Supabase (Chi tiết: ${error.message}, Code: ${error.code}). Hệ thống tự động kích hoạt chế độ lưu trữ cục bộ MemoryCache.`);
      } else {
        console.warn("Lỗi fetchEmailLogs từ Supabase:", error.message);
      }
      return localLogs;
    }
    
    // Nếu có dữ liệu từ Supabase, cập nhật ngược lại cache cục bộ để đảm bảo đồng nhất
    if (data) {
      memoryCache['B_EMAILLOG'] = data;
      return data;
    }
  } catch (err: any) {
    console.warn("Exception khi fetchEmailLogs từ Supabase:", err?.message || err);
  }

  return localLogs;
}

/**
 * Đồng bộ Mẫu xuất file lên Supabase
 */
export async function syncExportTemplate(t: any, userId?: string) {
  if (isOfflineMode) return { data: [t], error: null };
  userId = await resolveEffectiveUserId();
  try {
    let fileDataValue = t.fileData || (typeof window !== 'undefined' ? (localStorage.getItem('template_file_' + t.id) || '') : '');
    
    // Nếu có dữ liệu file dạng Base64 và không phải các chuỗi đặc biệt
    if (fileDataValue && fileDataValue !== 'PRESET' && fileDataValue !== 'PRESET_DASHBOARD' && !fileDataValue.startsWith('STORAGE_PATH:')) {
      const path = `${userId}/${t.id}`;
      try {
        const binaryString = window.atob(fileDataValue);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: t.type === 'EXCEL' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf' });
        
        // Upload file lên Supabase Storage bucket
        let { data: uploadData, error: uploadError } = await supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .upload(path, blob, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError && (uploadError.message?.includes('Bucket not found') || (uploadError as any).error === 'Bucket not found')) {
          console.log(`[Storage] Bucket '${SUPABASE_STORAGE_BUCKET}' chưa tồn tại. Đang tiến hành tự động khởi tạo bằng SQL...`);
          try {
            await ensureStorageBucketExists();
            
            console.log(`[Storage] Đã chạy lệnh khởi tạo bucket bằng SQL. Đang thử upload lại...`);
            const retryResult = await supabase.storage
              .from(SUPABASE_STORAGE_BUCKET)
              .upload(path, blob, {
                cacheControl: '3600',
                upsert: true
              });
            uploadData = retryResult.data;
            uploadError = retryResult.error;
          } catch (createEx) {
            console.warn(`[Storage] Exception khi khởi tạo bucket '${SUPABASE_STORAGE_BUCKET}':`, createEx);
          }
        }
          
        if (uploadError) {
          console.warn(`Lỗi upload file mẫu lên Supabase Storage '${SUPABASE_STORAGE_BUCKET}':`, uploadError.message);
          console.log("[Storage] Tự động chuyển sang chế độ dự phòng: lưu trữ dữ liệu Base64 trực tiếp vào cơ sở dữ liệu.");
          // Fallback: Giữ nguyên fileDataValue là chuỗi Base64 để lưu vào database column
        } else {
          console.log(`[Storage] Đã đồng bộ file lên bucket '${SUPABASE_STORAGE_BUCKET}' tại đường dẫn: ${path}`);
          fileDataValue = `STORAGE_PATH:${SUPABASE_STORAGE_BUCKET}/${path}`;
        }
      } catch (err) {
        console.warn(`Exception khi upload file lên Supabase Storage '${SUPABASE_STORAGE_BUCKET}':`, err);
      }
    }

    const payload = {
      id: t.id,
      name: t.name,
      type: t.type,
      fileName: t.fileName,
      fileData: fileDataValue,
      isDefault: !!t.isDefault,
      detectedPlaceholders: t.detectedPlaceholders || [],
      description: t.description || '',
      createdAt: t.createdAt || new Date().toISOString(),
      applicableReportTypes: t.applicableReportTypes || [],
      user_id: userId,
      startRow: t.startRow !== undefined ? Number(t.startRow) : null,
      columnMappings: t.columnMappings || null,
      groupByFields: t.groupByFields || null
    };

    const res = await supabase
      .from('b_export_template')
      .upsert(payload, { onConflict: 'id,user_id' })
      .select();

    return res;
  } catch (err) {
    logDbError('Lỗi syncExportTemplate:', err);
    return { data: null, error: err };
  }
}

/**
 * Xóa Mẫu xuất file khỏi Supabase
 */
export async function deleteExportTemplate(id: string, userId?: string) {
  if (isOfflineMode) return { error: null };
  userId = await resolveEffectiveUserId();
  try {
    const res = await supabase
      .from('b_export_template')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    return res;
  } catch (err) {
    logDbError('Lỗi deleteExportTemplate:', err);
    return { error: err };
  }
}

/**
 * Tải danh sách Mẫu xuất file từ Supabase
 */
export async function fetchExportTemplates(userId?: string): Promise<any[]> {
  userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase
      .from('b_export_template')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.warn('Lỗi fetchExportTemplates từ Supabase, trả về rỗng:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Exception khi fetchExportTemplates:', err);
    return [];
  }
}

/**
 * Đồng bộ Mapping Placeholder lên Supabase
 */
export async function syncExportMapping(m: any, userId?: string) {
  if (isOfflineMode) return { data: [m], error: null };
  userId = await resolveEffectiveUserId();
  try {
    const payload = {
      placeholder: m.placeholder,
      sourceType: m.sourceType,
      sourceField: m.sourceField,
      description: m.description || '',
      user_id: userId
    };

    const res = await supabase
      .from('b_export_mapping')
      .upsert(payload, { onConflict: 'placeholder,user_id' })
      .select();

    return res;
  } catch (err) {
    logDbError('Lỗi syncExportMapping:', err);
    return { data: null, error: err };
  }
}

/**
 * Xóa Mapping Placeholder khỏi Supabase
 */
export async function deleteExportMapping(placeholder: string, userId?: string) {
  if (isOfflineMode) return { error: null };
  userId = await resolveEffectiveUserId();
  try {
    const res = await supabase
      .from('b_export_mapping')
      .delete()
      .eq('placeholder', placeholder)
      .eq('user_id', userId);
    return res;
  } catch (err) {
    logDbError('Lỗi deleteExportMapping:', err);
    return { error: err };
  }
}

/**
 * Tải danh sách Mapping Placeholder từ Supabase
 */
export async function fetchExportMappings(userId?: string): Promise<any[]> {
  userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase
      .from('b_export_mapping')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.warn('Lỗi fetchExportMappings từ Supabase, trả về rỗng:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Exception khi fetchExportMappings:', err);
    return [];
  }
}
