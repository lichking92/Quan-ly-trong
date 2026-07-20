import { supabase, SUPABASE_STORAGE_BUCKET } from './supabaseClient';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThuongHieu, ChiNhanh, NhanVien, EmailLog, Role, safeParseArray } from './types';

const rawUrl = ((import.meta as any).env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
const rawKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || "").trim().replace(/^['"]|['"]$/g, "");

export let isOfflineMode = !rawUrl || !rawKey;
export let hasCreatedColumns = false;

// Bộ nhớ đệm trong (In-memory Cache) ngắn hạn để thay thế hoàn toàn cho localStorage theo yêu cầu bảo mật chống ghost data
export const inMemoryCache: Record<string, any[]> = {};

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

export const SHARED_USER_ID = "";

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
 * Trả về User ID có hiệu lực của Chủ cửa hàng/Admin từ Supabase Auth session hiện tại
 */
export async function resolveEffectiveUserId(): Promise<string> {
  // Dự phòng cuối: Đọc từ localStorage
  const savedUser = localStorage.getItem('CURRENT_USER');
  if (savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      if (parsed && parsed.user_id) {
        return parsed.user_id;
      }
      if (parsed && parsed.id) {
        return parsed.id;
      }
    } catch {}
  }

  const saved = localStorage.getItem('DB_OWNER_USER_ID');
  if (saved) {
    return saved;
  }

  return "";
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

  const SCHEMA_VERSION = 'v4_nhanvien_register_fix';
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
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true;
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
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "WRITE_ACCESS" boolean DEFAULT false;
      EXCEPTION WHEN others THEN NULL;
      END;

      BEGIN
        ALTER TABLE b_nhanvien ADD COLUMN IF NOT EXISTS "PERMISSIONS" text[];
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

      -- Đảm bảo tắt RLS và cấp quyền đầy đủ cho b_gomdon, b_gomdonct và các bảng cốt lõi để tránh lỗi phân quyền hoặc RLS
      BEGIN
        ALTER TABLE IF EXISTS public.b_gomdon DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_gomdonct DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_nhanvien DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_sanpham DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_nhapxuat DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_nhapxuatct DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_kiemkho DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_thuonghieu DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_chinhanh DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_emaillog DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS public.b_role DISABLE ROW LEVEL SECURITY;

        GRANT ALL ON TABLE public.b_gomdon TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_gomdonct TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_nhanvien TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_sanpham TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_nhapxuat TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_nhapxuatct TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_kiemkho TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_thuonghieu TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_chinhanh TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_emaillog TO anon, authenticated, service_role;
        GRANT ALL ON TABLE public.b_role TO anon, authenticated, service_role;
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
        v_active boolean;
        v_chuc_vu text;
        v_bo_phan text;
        v_write_access boolean;
        v_current_date text;
        v_roles text[];
        v_permissions text[];
        v_target_user_id uuid;
      BEGIN
        -- 1. Check if email exists (check globally across the whole system)
        SELECT EXISTS (
          SELECT 1 FROM public.b_nhanvien 
          WHERE lower(trim("EMAIL")) = lower(trim(p_email))
        ) INTO v_email_exists;

        IF v_email_exists THEN
          RETURN jsonb_build_object('success', false, 'message', 'Email này đã được sử dụng. Vui lòng chọn Email khác.');
        END IF;

        -- 2. Check if username exists (check globally across the whole system)
        SELECT EXISTS (
          SELECT 1 FROM public.b_nhanvien 
          WHERE lower(trim("TEN_DANG_NHAP")) = lower(trim(p_ten_dang_nhap))
        ) INTO v_username_exists;

        IF v_username_exists THEN
          RETURN jsonb_build_object('success', false, 'message', 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn Tên đăng nhập khác.');
        END IF;

        -- 3. Check count of existing ADMIN roles globally (either lowercase or uppercase)
        SELECT COUNT(*) FROM public.b_nhanvien 
        WHERE (lower(trim("ROLE")) = 'admin' OR upper(trim("ROLE")) = 'ADMIN')
        INTO v_admin_count;

        IF v_admin_count = 0 THEN
          -- First account: set as ADMIN and active=true, TRANG_THAI = ACTIVE
          v_role := 'ADMIN';
          v_trang_thai := 'ACTIVE';
          v_active := true;
          v_chuc_vu := 'Chủ sở hữu (Admin)';
          v_bo_phan := 'Ban Giám Đốc';
          v_write_access := true;
          v_roles := ARRAY['ADMIN', 'admin'];
          v_permissions := ARRAY['DASHBOARD', 'PRODUCT', 'TRANSACTION', 'HISTORY', 'AUDIT', 'CATEGORY'];
          v_target_user_id := p_user_id;
        ELSE
          -- Subsequent accounts: set as PENDING and active=false, TRANG_THAI = PENDING
          v_role := 'PENDING';
          v_trang_thai := 'PENDING';
          v_active := false;
          v_chuc_vu := 'Nhân viên chờ duyệt';
          v_bo_phan := 'Bộ Phận Bán Hàng';
          v_write_access := false;
          v_roles := ARRAY['NHAN_VIEN', 'PENDING', 'pending'];
          v_permissions := ARRAY['TRANSACTION'];

          -- Find existing admin's user_id to partition them into the same tenant
          SELECT "user_id" FROM public.b_nhanvien 
          WHERE (lower(trim("ROLE")) = 'admin' OR upper(trim("ROLE")) = 'ADMIN')
          AND "user_id" IS NOT NULL
          LIMIT 1
          INTO v_target_user_id;

          IF v_target_user_id IS NULL THEN
            v_target_user_id := p_user_id;
          END IF;
        END IF;

        v_current_date := to_char(current_timestamp, 'YYYY-MM-DD');

        -- 4. Insert record
        INSERT INTO public.b_nhanvien (
          "MA_NV", "HO_TEN", "CHUC_VU", "BO_PHAN", "CHI_NHANH", 
          "EMAIL", "ROLE", "WRITE_ACCESS", "TEN_DANG_NHAP", 
          "MAT_KHAU", "TRANG_THAI", "active", "YEU_CAU_RESET", "NGAY_DANG_KY", "user_id",
          "ROLES", "PERMISSIONS"
        ) VALUES (
          p_ma_nv, p_ho_ten, v_chuc_vu, v_bo_phan, 'Kho Trung Tâm',
          p_email, v_role, v_write_access, p_ten_dang_nhap,
          p_mat_khau, v_trang_thai, v_active, false, v_current_date, v_target_user_id,
          v_roles, v_permissions
        );

        RETURN jsonb_build_object(
          'success', true, 
          'message', 'Đăng ký thành công!', 
          'role', v_role, 
          'trang_thai', v_trang_thai,
          'active', v_active,
          'target_user_id', v_target_user_id
        );
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Helper function to clean SKU (clean_sku_func)
      CREATE OR REPLACE FUNCTION public.clean_sku_func(p_sku text)
      RETURNS text AS $func$
      DECLARE
        v_res text;
      BEGIN
        IF p_sku IS NULL THEN
          RETURN '';
        END IF;
        
        -- trim, replace ',' with '.' and multiple spaces with a single space, uppercase
        v_res := upper(regexp_replace(replace(trim(p_sku), ',', '.'), '\\s+', ' ', 'g'));
        
        -- replace + before digit with just the digit
        -- handle + at start of string or after space
        -- e.g. "+3.00" -> "3.00", " +2.00" -> " 2.00"
        v_res := regexp_replace(v_res, '(^|\\s)\\+(\\d)', '\\1\\2', 'g');
        
        -- replace 1.5 with 1.50 and 1.6 with 1.60
        v_res := regexp_replace(v_res, '\\y1\\.5\\y', '1.50', 'g');
        v_res := regexp_replace(v_res, '\\y1\\.6\\y', '1.60', 'g');
        
        RETURN v_res;
      END;
      $func$ LANGUAGE plpgsql IMMUTABLE;

      -- Sequences for Ticket numbers
      CREATE SEQUENCE IF NOT EXISTS public.b_pn_seq;
      CREATE SEQUENCE IF NOT EXISTS public.b_px_seq;
      CREATE SEQUENCE IF NOT EXISTS public.b_pnk_seq;
      CREATE SEQUENCE IF NOT EXISTS public.b_pxk_seq;
      CREATE SEQUENCE IF NOT EXISTS public.b_pkk_seq;

      -- Helper to generate next invoice ID using PostgreSQL sequence safely aligned with existing data
      CREATE OR REPLACE FUNCTION public.get_next_invoice_id(p_prefix text, p_user_id uuid)
      RETURNS text AS $func$
      DECLARE
        v_seq_name text;
        v_val integer;
        v_max_id integer := 0;
      BEGIN
        IF p_prefix = 'PN' THEN
          v_seq_name := 'public.b_pn_seq';
        ELSIF p_prefix = 'PX' THEN
          v_seq_name := 'public.b_px_seq';
        ELSIF p_prefix = 'PNK' THEN
          v_seq_name := 'public.b_pnk_seq';
        ELSIF p_prefix = 'PXK' THEN
          v_seq_name := 'public.b_pxk_seq';
        ELSIF p_prefix = 'PKK' THEN
          v_seq_name := 'public.b_pkk_seq';
        ELSE
          RAISE EXCEPTION 'Prefix khong hop le %', p_prefix;
        END IF;

        -- Ensure sequence exists
        BEGIN
          EXECUTE 'CREATE SEQUENCE IF NOT EXISTS ' || v_seq_name;
        EXCEPTION WHEN others THEN NULL;
        END;

        -- Get next value
        EXECUTE 'SELECT nextval(''' || v_seq_name || ''')' INTO v_val;
        
        -- If it just started at 1, align it with the maximum existing ID in tables
        IF v_val = 1 THEN
          IF p_prefix = 'PKK' THEN
            SELECT max(nullif(regexp_replace("MA_PHIEU", '^PKK', ''), ''))::integer 
            FROM public.b_kiemkho 
            WHERE "MA_PHIEU" LIKE 'PKK%'
            INTO v_max_id;
          ELSE
            SELECT max(nullif(regexp_replace("HOA_DON", '^' || p_prefix, ''), ''))::integer 
            FROM public.b_nhapxuat 
            WHERE "HOA_DON" LIKE p_prefix || '%'
            INTO v_max_id;
          END IF;

          IF v_max_id IS NOT NULL AND v_max_id > 0 THEN
            EXECUTE 'SELECT setval(''' || v_seq_name || ''', ' || v_max_id || ')';
            EXECUTE 'SELECT nextval(''' || v_seq_name || ''')' INTO v_val;
          END IF;
        END IF;

        RETURN p_prefix || lpad(v_val::text, 6, '0');
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Transaction RPC for single or updated transactions (NHAP, XUAT, adjust, cancel)
      CREATE OR REPLACE FUNCTION public.create_transaction_v2(
        p_header jsonb,
        p_details jsonb,
        p_user_id uuid
      ) RETURNS jsonb AS $func$
      DECLARE
        v_hoa_don text;
        v_loai text;
        v_prefix text;
        v_skus text[];
        v_sku text;
        v_nhap integer;
        v_xuat integer;
        v_item jsonb;
        v_current_ton integer;
        v_temp_ton_cuoi integer;
        v_exists boolean;
      BEGIN
        v_loai := p_header->>'LOAI';
        v_hoa_don := p_header->>'HOA_DON';
        
        -- Auto-generate number if empty, temp, or placeholder
        IF v_hoa_don IS NULL OR v_hoa_don = '' OR v_hoa_don NOT SIMILAR TO '(PN|PX|PNK|PXK)\\d+' THEN
          IF v_loai = 'NHẬP' THEN
            IF v_hoa_don LIKE 'PNK%' THEN
              v_prefix := 'PNK';
            ELSE
              v_prefix := 'PN';
            END IF;
          ELSE
            IF v_hoa_don LIKE 'PXK%' THEN
              v_prefix := 'PXK';
            ELSE
              v_prefix := 'PX';
            END IF;
          END IF;
          v_hoa_don := public.get_next_invoice_id(v_prefix, p_user_id);
        END IF;

        -- Extract distinct SKUs involved
        SELECT array_agg(DISTINCT public.clean_sku_func(value->>'SKU'))
        FROM jsonb_array_elements(p_details)
        INTO v_skus;

        -- 1. SELECT ... FOR UPDATE to lock product inventory rows atomically for this tenant/user
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          PERFORM "SKU"
          FROM public.b_sanpham
          WHERE public.clean_sku_func("SKU") = ANY(v_skus)
            AND "user_id" = p_user_id
          FOR UPDATE;
        END IF;

        -- 2. Insert or update header
        INSERT INTO public.b_nhapxuat (
          "HOA_DON", "CHI_NHANH", "NGAY", "LOAI", "TONG_SL", 
          "NGUOI_TAO", "TEN_NGUOI_TAO", "TG_TAO", "GHI_CHU", 
          "MA_NV", "TEN_DANG_NHAP", "TRANG_THAI", "user_id"
        ) VALUES (
          v_hoa_don,
          p_header->>'CHI_NHANH',
          p_header->>'NGAY',
          v_loai,
          (p_header->>'TONG_SL')::integer,
          p_header->>'NGUOI_TAO',
          p_header->>'TEN_NGUOI_TAO',
          p_header->>'TG_TAO',
          p_header->>'GHI_CHU',
          p_header->>'MA_NV',
          p_header->>'TEN_DANG_NHAP',
          COALESCE(p_header->>'TRANG_THAI', 'Hoàn tất'),
          p_user_id
        )
        ON CONFLICT ("HOA_DON") DO UPDATE SET
          "CHI_NHANH" = EXCLUDED."CHI_NHANH",
          "NGAY" = EXCLUDED."NGAY",
          "LOAI" = EXCLUDED."LOAI",
          "TONG_SL" = EXCLUDED."TONG_SL",
          "NGUOI_TAO" = EXCLUDED."NGUOI_TAO",
          "TEN_NGUOI_TAO" = EXCLUDED."TEN_NGUOI_TAO",
          "TG_TAO" = EXCLUDED."TG_TAO",
          "GHI_CHU" = EXCLUDED."GHI_CHU",
          "MA_NV" = EXCLUDED."MA_NV",
          "TEN_DANG_NHAP" = EXCLUDED."TEN_DANG_NHAP",
          "TRANG_THAI" = EXCLUDED."TRANG_THAI";

        -- Delete old details of this invoice to prevent duplication
        DELETE FROM public.b_nhapxuatct WHERE "HOA_DON" = v_hoa_don AND "user_id" = p_user_id;

        -- 3. Insert new details
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_details) LOOP
          INSERT INTO public.b_nhapxuatct (
            "id", "HOA_DON", "SKU", "TEN_SP", "THUONG_HIEU", 
            "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "SO_LUONG", 
            "DVT", "GHI_CHU", "LOAI", "NGAY", "user_id"
          ) VALUES (
            COALESCE(v_item->>'id', v_item->>'ID', 'CT_' || gen_random_uuid()::text),
            v_hoa_don,
            v_item->>'SKU',
            v_item->>'TEN_SP',
            v_item->>'THUONG_HIEU',
            v_item->>'CHIET_XUAT',
            v_item->>'TINH_NANG',
            (v_item->>'SPH')::numeric,
            (v_item->>'CYL')::numeric,
            (v_item->>'SO_LUONG')::integer,
            v_item->>'DVT',
            v_item->>'GHI_CHU',
            v_item->>'LOAI',
            v_item->>'NGAY',
            p_user_id
          );
        END LOOP;

        -- 4. Recalculate stock and enforce no negative stock constraint (Rule 1)
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          FOR v_sku IN SELECT unnest(v_skus) LOOP
            -- Sum nhap
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'NHẬP'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_nhap;

            -- Sum xuat
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'XUẤT'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_xuat;

            -- Calculate ton cuoi
            SELECT COALESCE("TON_DAU", 0) FROM public.b_sanpham
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku) AND "user_id" = p_user_id
            INTO v_current_ton;

            v_temp_ton_cuoi := v_current_ton + v_nhap - v_xuat;

            -- Enforce negative stock rule
            IF v_temp_ton_cuoi < 0 THEN
              RAISE EXCEPTION 'Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [%] chỉ còn tồn % (yêu cầu xuất/hoàn trả làm âm thành %)', v_sku, v_current_ton, v_temp_ton_cuoi;
            END IF;

            -- Update product
            UPDATE public.b_sanpham
            SET "NHAP" = v_nhap,
                "XUAT" = v_xuat,
                "TON_CUOI" = v_temp_ton_cuoi
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku)
              AND "user_id" = p_user_id;
          END LOOP;
        END IF;

        RETURN jsonb_build_object('success', true, 'hoa_don', v_hoa_don);
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Transaction RPC for permanent deletion of invoice
      CREATE OR REPLACE FUNCTION public.delete_transaction_v2(
        p_hoa_don text,
        p_user_id uuid
      ) RETURNS jsonb AS $func$
      DECLARE
        v_skus text[];
        v_sku text;
        v_nhap integer;
        v_xuat integer;
        v_current_ton integer;
        v_temp_ton_cuoi integer;
      BEGIN
        -- Get all SKUs in this invoice before deleting details
        SELECT array_agg(DISTINCT public.clean_sku_func("SKU"))
        FROM public.b_nhapxuatct
        WHERE "HOA_DON" = p_hoa_don AND "user_id" = p_user_id
        INTO v_skus;

        -- 1. Lock b_sanpham rows for update
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          PERFORM "SKU"
          FROM public.b_sanpham
          WHERE public.clean_sku_func("SKU") = ANY(v_skus)
            AND "user_id" = p_user_id
          FOR UPDATE;
        END IF;

        -- 2. Delete details
        DELETE FROM public.b_nhapxuatct WHERE "HOA_DON" = p_hoa_don AND "user_id" = p_user_id;

        -- 3. Delete header
        DELETE FROM public.b_nhapxuat WHERE "HOA_DON" = p_hoa_don AND "user_id" = p_user_id;

        -- 4. Recalculate stock for the affected products
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          FOR v_sku IN SELECT unnest(v_skus) LOOP
            -- Sum nhap
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'NHẬP'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_nhap;

            -- Sum xuat
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'XUẤT'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_xuat;

            -- Calculate ton cuoi
            SELECT COALESCE("TON_DAU", 0) FROM public.b_sanpham
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku) AND "user_id" = p_user_id
            INTO v_current_ton;

            v_temp_ton_cuoi := v_current_ton + v_nhap - v_xuat;

            -- Enforce negative stock rule on delete/rollback
            IF v_temp_ton_cuoi < 0 THEN
              RAISE EXCEPTION 'Lỗi (Rule 1): Không cho phép tồn kho âm sau khi xóa. SKU [%] chỉ còn tồn % (xóa làm âm thành %)', v_sku, v_current_ton, v_temp_ton_cuoi;
            END IF;

            -- Update the product
            UPDATE public.b_sanpham
            SET "NHAP" = v_nhap,
                "XUAT" = v_xuat,
                "TON_CUOI" = v_temp_ton_cuoi
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku)
              AND "user_id" = p_user_id;
          END LOOP;
        END IF;

        RETURN jsonb_build_object('success', true);
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Transaction RPC for stocktake audits and corresponding adjustments
      CREATE OR REPLACE FUNCTION public.save_audit_v2(
        p_audits jsonb,
        p_headers jsonb,
        p_details jsonb,
        p_user_id uuid
      ) RETURNS jsonb AS $func$
      DECLARE
        v_audit jsonb;
        v_header jsonb;
        v_item jsonb;
        v_ma_phieu text;
        v_hoa_don text;
        v_skus text[] := ARRAY[]::text[];
        v_sku text;
        v_nhap integer;
        v_xuat integer;
        v_prefix text;
        v_adj_hoa_don_map jsonb := '{}'::jsonb;
        v_old_hoa_don text;
        v_new_hoa_don text;
        v_exists boolean;
        v_current_ton integer;
        v_temp_ton_cuoi integer;
      BEGIN
        -- Extract all distinct SKUs
        SELECT array_agg(DISTINCT public.clean_sku_func(value->>'SKU'))
        FROM (
          SELECT value FROM jsonb_array_elements(p_audits)
          UNION ALL
          SELECT value FROM jsonb_array_elements(p_details)
        ) t
        INTO v_skus;

        -- 1. Row-level locking of b_sanpham to prevent race conditions
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          PERFORM "SKU"
          FROM public.b_sanpham
          WHERE public.clean_sku_func("SKU") = ANY(v_skus)
            AND "user_id" = p_user_id
          FOR UPDATE;
        END IF;

        -- 2. Insert b_kiemkho records. Generate MA_PHIEU if empty/placeholder
        FOR v_audit IN SELECT * FROM jsonb_array_elements(p_audits) LOOP
          v_ma_phieu := v_audit->>'MA_PHIEU';
          IF v_ma_phieu IS NULL OR v_ma_phieu = '' OR v_ma_phieu NOT SIMILAR TO 'PKK\\d+' THEN
            v_ma_phieu := public.get_next_invoice_id('PKK', p_user_id);
          END IF;

          SELECT EXISTS (
            SELECT 1 FROM public.b_kiemkho 
            WHERE "MA_PHIEU" = v_ma_phieu AND "SKU" = (v_audit->>'SKU') AND "user_id" = p_user_id
          ) INTO v_exists;

          IF v_exists THEN
            UPDATE public.b_kiemkho SET
              "TON_HE_THONG" = (v_audit->>'TON_HE_THONG')::numeric,
              "TON_THUC_TE" = (v_audit->>'TON_THUC_TE')::numeric,
              "LECH" = (v_audit->>'LECH')::numeric,
              "LOAI_BU" = v_audit->>'LOAI_BU',
              "NGUOI_KIEM" = v_audit->>'NGUOI_KIEM',
              "THOI_DIEM" = v_audit->>'THOI_DIEM',
              "MA_NV" = v_audit->>'MA_NV',
              "TEN_DANG_NHAP" = v_audit->>'TEN_DANG_NHAP'
            WHERE "MA_PHIEU" = v_ma_phieu AND "SKU" = (v_audit->>'SKU') AND "user_id" = p_user_id;
          ELSE
            INSERT INTO public.b_kiemkho (
              "MA_PHIEU", "SKU", "TON_HE_THONG", "TON_THUC_TE", "LECH", 
              "LOAI_BU", "NGUOI_KIEM", "THOI_DIEM", "MA_NV", "TEN_DANG_NHAP", "user_id"
            ) VALUES (
              v_ma_phieu,
              v_audit->>'SKU',
              (v_audit->>'TON_HE_THONG')::numeric,
              (v_audit->>'TON_THUC_TE')::numeric,
              (v_audit->>'LECH')::numeric,
              v_audit->>'LOAI_BU',
              v_audit->>'NGUOI_KIEM',
              v_audit->>'THOI_DIEM',
              v_audit->>'MA_NV',
              v_audit->>'TEN_DANG_NHAP',
              p_user_id
            );
          END IF;
        END LOOP;

        -- 3. Insert adjustment headers (b_nhapxuat) and replace temporary IDs with nextval sequence IDs
        FOR v_header IN SELECT * FROM jsonb_array_elements(p_headers) LOOP
          v_old_hoa_don := v_header->>'HOA_DON';
          IF v_old_hoa_don LIKE 'PNK%' THEN
            v_prefix := 'PNK';
          ELSE
            v_prefix := 'PXK';
          END IF;
          
          v_new_hoa_don := public.get_next_invoice_id(v_prefix, p_user_id);
          v_adj_hoa_don_map := jsonb_set(v_adj_hoa_don_map, ARRAY[v_old_hoa_don], to_jsonb(v_new_hoa_don));

          INSERT INTO public.b_nhapxuat (
            "HOA_DON", "CHI_NHANH", "NGAY", "LOAI", "TONG_SL", 
            "NGUOI_TAO", "TEN_NGUOI_TAO", "TG_TAO", "GHI_CHU", 
            "MA_NV", "TEN_DANG_NHAP", "TRANG_THAI", "user_id"
          ) VALUES (
            v_new_hoa_don,
            v_header->>'CHI_NHANH',
            v_header->>'NGAY',
            v_header->>'LOAI',
            (v_header->>'TONG_SL')::integer,
            v_header->>'NGUOI_TAO',
            v_header->>'TEN_NGUOI_TAO',
            v_header->>'TG_TAO',
            v_header->>'GHI_CHU',
            v_header->>'MA_NV',
            v_header->>'TEN_DANG_NHAP',
            COALESCE(v_header->>'TRANG_THAI', 'Hoàn tất'),
            p_user_id
          );
        END LOOP;

        -- 4. Insert adjustment details (b_nhapxuatct) mapping old to new sequence IDs
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_details) LOOP
          v_old_hoa_don := v_item->>'HOA_DON';
          v_new_hoa_don := v_adj_hoa_don_map->>v_old_hoa_don;
          IF v_new_hoa_don IS NULL THEN
            v_new_hoa_don := v_old_hoa_don;
          END IF;

          INSERT INTO public.b_nhapxuatct (
            "id", "HOA_DON", "SKU", "TEN_SP", "THUONG_HIEU", 
            "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "SO_LUONG", 
            "DVT", "GHI_CHU", "LOAI", "NGAY", "user_id"
          ) VALUES (
            COALESCE(v_item->>'id', v_item->>'ID', 'CT_' || gen_random_uuid()::text),
            v_new_hoa_don,
            v_item->>'SKU',
            v_item->>'TEN_SP',
            v_item->>'THUONG_HIEU',
            v_item->>'CHIET_XUAT',
            v_item->>'TINH_NANG',
            (v_item->>'SPH')::numeric,
            (v_item->>'CYL')::numeric,
            (v_item->>'SO_LUONG')::integer,
            v_item->>'DVT',
            v_item->>'GHI_CHU',
            v_item->>'LOAI',
            v_item->>'NGAY',
            p_user_id
          );
        END LOOP;

        -- 5. Recalculate stock atomically for all locked products
        IF v_skus IS NOT NULL AND array_length(v_skus, 1) > 0 THEN
          FOR v_sku IN SELECT unnest(v_skus) LOOP
            -- Sum nhap
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'NHẬP'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_nhap;

            -- Sum xuat
            SELECT COALESCE(SUM("SO_LUONG"), 0)
            FROM public.b_nhapxuatct d
            JOIN public.b_nhapxuat h ON d."HOA_DON" = h."HOA_DON"
            WHERE public.clean_sku_func(d."SKU") = public.clean_sku_func(v_sku)
              AND d."LOAI" = 'XUẤT'
              AND h."TRANG_THAI" != 'Đã hủy'
              AND d."user_id" = p_user_id
            INTO v_xuat;

            -- Current TON_DAU
            SELECT COALESCE("TON_DAU", 0) FROM public.b_sanpham
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku) AND "user_id" = p_user_id
            INTO v_current_ton;

            v_temp_ton_cuoi := v_current_ton + v_nhap - v_xuat;

            -- Rule 1 Enforce non-negative stock
            IF v_temp_ton_cuoi < 0 THEN
              RAISE EXCEPTION 'Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [%] chỉ còn tồn % (yêu cầu điều chỉnh làm âm thành %)', v_sku, v_current_ton, v_temp_ton_cuoi;
            END IF;

            -- Update product stock
            UPDATE public.b_sanpham
            SET "NHAP" = v_nhap,
                "XUAT" = v_xuat,
                "TON_CUOI" = v_temp_ton_cuoi
            WHERE public.clean_sku_func("SKU") = public.clean_sku_func(v_sku)
              AND "user_id" = p_user_id;
          END LOOP;
        END IF;

        RETURN jsonb_build_object('success', true);
      END;
      $func$ LANGUAGE plpgsql SECURITY DEFINER;

      -- Transaction RPC for creating Gom Don and details
      CREATE OR REPLACE FUNCTION public.create_gom_don_v2(
        p_header jsonb,
        p_details jsonb,
        p_user_id uuid
      ) RETURNS jsonb AS $func$
      DECLARE
        v_id text;
        v_item jsonb;
      BEGIN
        v_id := p_header->>'id';
        
        -- Insert/update header b_gomdon
        INSERT INTO public.b_gomdon (
          "id", "branch", "original_text", "trang_thai", "so_phieu_xuat", "user_id"
        ) VALUES (
          v_id,
          p_header->>'branch',
          p_header->>'original_text',
          COALESCE(p_header->>'trang_thai', 'Chờ xử lý'),
          p_header->>'so_phieu_xuat',
          p_user_id
        )
        ON CONFLICT ("id") DO UPDATE SET
          "branch" = EXCLUDED."branch",
          "original_text" = EXCLUDED."original_text",
          "trang_thai" = EXCLUDED."trang_thai",
          "so_phieu_xuat" = EXCLUDED."so_phieu_xuat";

        -- Delete existing details of this gom_don to replace them
        DELETE FROM public.b_gomdonct WHERE "gom_don_id" = v_id;

        -- Insert details b_gomdonct
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_details) LOOP
          INSERT INTO public.b_gomdonct (
            "id", "gom_don_id", "raw_line", "brand", "chiet_xuat", 
            "tinh_nang", "sph", "cyl", "quantity", "unit", 
            "sku", "error", "user_id"
          ) VALUES (
            COALESCE(v_item->>'id', 'GDCT_' || gen_random_uuid()::text),
            v_id,
            v_item->>'raw_line',
            v_item->>'brand',
            v_item->>'chiet_xuat',
            v_item->>'tinh_nang',
            (v_item->>'sph')::numeric,
            (v_item->>'cyl')::numeric,
            COALESCE((v_item->>'quantity')::integer, 1),
            COALESCE(v_item->>'unit', 'miếng'),
            v_item->>'sku',
            v_item->>'error',
            p_user_id
          );
        END LOOP;

        RETURN jsonb_build_object('success', true);
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
    localStorage.setItem('DB_SCHEMA_VERSION', SCHEMA_VERSION);
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
  if (!userId) {
    userId = await resolveEffectiveUserId();
  }
  try {
    // 1. Cố gắng tự động tạo cột trên Supabase (nếu chưa có)
    await tryCreateColumnsOnSupabase();
    await ensureStorageBucketExists();

    // 2. Tự động kiểm tra và thêm tài khoản đăng nhập hiện tại nếu chưa có trong b_nhanvien
    let email = "";
    const savedUser = localStorage.getItem('CURRENT_USER');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed) {
          if (parsed.username && parsed.username.includes('@')) {
            email = parsed.username;
          } else if (parsed.id) {
            const { data: staff } = await supabase
              .from('b_nhanvien')
              .select('EMAIL')
              .eq('MA_NV', parsed.id)
              .limit(1);
            if (staff && staff.length > 0) {
              email = staff[0].EMAIL;
            }
          }
        }
      } catch (err) {
        console.warn('Lỗi lấy thông tin email:', err);
      }
    }
    if (email) {
      const { data: existingStaff } = await supabase
        .from('b_nhanvien')
        .select('MA_NV')
        .ilike('EMAIL', email)
        .limit(1);

      if (!existingStaff || existingStaff.length === 0) {
        // Kiểm tra xem hệ thống đã có Admin chưa
        let hasAdmin = false;
        try {
          const { data: adminCheck } = await supabase
            .from('b_nhanvien')
            .select('ROLE')
            .or('ROLE.ilike.ADMIN,ROLE.ilike.admin');
          if (adminCheck && adminCheck.length > 0) {
            hasAdmin = true;
          }
        } catch (e) {
          console.warn('Lỗi kiểm tra admin khi auto-initialize:', e);
        }

        if (!hasAdmin) {
          console.log(`Chưa có Admin. Tự động khởi tạo tài khoản đầu tiên ${email} làm ADMIN`);
          await supabase.from('b_nhanvien').insert({
            "MA_NV": "NV_" + Math.random().toString(36).substr(2, 4).toUpperCase(),
            "HO_TEN": email.split('@')[0].toUpperCase(),
            "CHUC_VU": "Chủ sở hữu (Admin)",
            "BO_PHAN": "Ban Giám Đốc",
            "CHI_NHANH": "Kho Trung Tâm",
            "EMAIL": email,
            "ROLE": 'ADMIN',
            "active": true,
            "PERMISSIONS": ["DASHBOARD", "PRODUCT", "TRANSACTION", "HISTORY", "AUDIT", "CATEGORY"],
            "WRITE_ACCESS": true,
            "TRANG_THAI": 'ACTIVE',
            "ROLES": ['ADMIN', 'admin'],
            user_id: userId
          });
        } else {
          console.log(`Đã có Admin. Tự động khởi tạo tài khoản ${email} ở trạng thái PENDING`);
          await supabase.from('b_nhanvien').insert({
            "MA_NV": "NV_" + Math.random().toString(36).substr(2, 4).toUpperCase(),
            "HO_TEN": email.split('@')[0].toUpperCase(),
            "CHUC_VU": "Nhân viên chờ duyệt",
            "BO_PHAN": "Bộ Phận Bán Hàng",
            "CHI_NHANH": "Kho Trung Tâm",
            "EMAIL": email,
            "ROLE": 'PENDING',
            "active": false,
            "PERMISSIONS": ['TRANSACTION'],
            "WRITE_ACCESS": false,
            "TRANG_THAI": 'PENDING',
            "ROLES": ['NHAN_VIEN', 'PENDING', 'pending'],
            user_id: userId
          });
        }
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
      const localRolesStr = inMemoryCache['B_ROLE'] ? JSON.stringify(inMemoryCache['B_ROLE']) : null;
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
            "PERMISSIONS": [
              "dashboard.view", "dashboard.read", "dashboard.export",
              "ordercheck.view", "ordercheck.read", "ordercheck.analyze", "ordercheck.save", "ordercheck.export",
              "picking_xuat.view", "picking_xuat.read", "picking_xuat.create", "picking_xuat.edit", "picking_xuat.delete", "picking_xuat.export",
              "picking_nhap.view", "picking_nhap.read", "picking_nhap.create", "picking_nhap.edit", "picking_nhap.delete",
              "history.view", "history.read", "history.read_all", "history.create", "history.edit", "history.delete", "history.export",
              "picking.view", "picking.read", "picking.create", "picking.delete", "picking.export",
              "matrix.view", "matrix.read",
              "stocktake.view", "stocktake.read",
              "product.view", "product.read", "product.create", "product.edit", "product.delete",
              "employee.view", "employee.read", "employee.create", "employee.edit", "employee.delete",
              "role.view", "role.read", "role.create", "role.edit", "role.delete",
              "settings.view", "settings.read",
              "inventory.view"
            ]
          },
          {
            "ROLE_CODE": "KHO",
            "TEN_ROLE": "Quản lý Kho (Manager)",
            "PERMISSIONS": [
              "dashboard.view", "dashboard.read", "dashboard.export",
              "ordercheck.view", "ordercheck.read", "ordercheck.analyze", "ordercheck.save",
              "picking_xuat.view", "picking_xuat.read", "picking_xuat.create", "picking_xuat.export",
              "picking_nhap.view", "picking_nhap.read", "picking_nhap.create",
              "history.view", "history.read", "history.read_all", "history.create", "history.edit", "history.export",
              "picking.view", "picking.read", "picking.create", "picking.export",
              "matrix.view", "matrix.read",
              "stocktake.view", "stocktake.read",
              "product.view", "product.read", "product.create", "product.edit",
              "inventory.view"
            ]
          },
          {
            "ROLE_CODE": "NHAN_VIEN",
            "TEN_ROLE": "Nhân viên Bán hàng (Staff)",
            "PERMISSIONS": [
              "picking_xuat.view", "picking_xuat.read", "picking_xuat.create",
              "picking_nhap.view", "picking_nhap.read", "picking_nhap.create",
              "history.view", "history.read",
              "picking.view", "picking.read", "picking.create",
              "product.view", "product.read",
              "inventory.view"
            ]
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
 * RAM Cache toàn hệ thống và Singleton Promises lưu trữ in-flight requests
 */
export const cache: {
  nhanvien: any[] | null;
  role: any[] | null;
  thuonghieu: any[] | null;
  chinhanh: any[] | null;
  sanpham: any[] | null;
  kiemkho: any[] | null;
  emaillog: any[] | null;
  nhapxuat: any[] | null;
  nhapxuatct: any[] | null;
} = {
  nhanvien: null,
  role: null,
  thuonghieu: null,
  chinhanh: null,
  sanpham: null,
  kiemkho: null,
  emaillog: null,
  nhapxuat: null,
  nhapxuatct: null,
};

export const activePromises: Record<string, Promise<any[]> | null> = {};

function updateInMemoryAndCentralCache(key: keyof typeof cache, data: any[]) {
  cache[key] = data;
  const inMemoryKey = `B_${key.toUpperCase()}`;
  inMemoryCache[inMemoryKey] = data;
}

export function invalidateCache(key: keyof typeof cache) {
  cache[key] = null;
  const inMemoryKey = `B_${key.toUpperCase()}`;
  delete inMemoryCache[inMemoryKey];
  activePromises[key] = null;
}

export async function fetchNhanVien(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_NHANVIEN'] || [];
  if (!force && cache.nhanvien) return cache.nhanvien;
  if (activePromises.nhanvien) return activePromises.nhanvien;

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_nhanvien')
        .select('MA_NV, HO_TEN, CHUC_VU, BO_PHAN, CHI_NHANH, EMAIL, ROLE, PERMISSIONS, WRITE_ACCESS, TEN_DANG_NHAP, MAT_KHAU, TRANG_THAI, YEU_CAU_RESET, ROLES, user_id, active, NGAY_DANG_KY');
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('nhanvien', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchNhanVien:", err);
      return inMemoryCache['B_NHANVIEN'] || [];
    } finally {
      activePromises.nhanvien = null;
    }
  })();

  activePromises.nhanvien = promise;
  return promise;
}

export async function fetchRole(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_ROLE'] || [];
  if (!force && cache.role) return cache.role;
  if (activePromises.role) return activePromises.role;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_role')
        .select('ROLE_CODE, TEN_ROLE, PERMISSIONS, user_id')
        .eq('user_id', userId);
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('role', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchRole:", err);
      return inMemoryCache['B_ROLE'] || [];
    } finally {
      activePromises.role = null;
    }
  })();

  activePromises.role = promise;
  return promise;
}

export async function fetchThuongHieu(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_THUONGHIEU'] || [];
  if (!force && cache.thuonghieu) return cache.thuonghieu;
  if (activePromises.thuonghieu) return activePromises.thuonghieu;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_thuonghieu')
        .select('THUONG_HIEU, CHIET_XUAT_MAC_DINH, TINH_NANG_MAC_DINH, SPH_TU, SPH_DEN, SPH_VIEN_TU, SPH_VIEN_DEN, BUOC_NHAY, user_id')
        .eq('user_id', userId);
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('thuonghieu', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchThuongHieu:", err);
      return inMemoryCache['B_THUONGHIEU'] || [];
    } finally {
      activePromises.thuonghieu = null;
    }
  })();

  activePromises.thuonghieu = promise;
  return promise;
}

export async function fetchChiNhanh(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_CHINHANH'] || [];
  if (!force && cache.chinhanh) return cache.chinhanh;
  if (activePromises.chinhanh) return activePromises.chinhanh;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_chinhanh')
        .select('CHI_NHANH, DIA_CHI, SDT, user_id')
        .eq('user_id', userId);
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('chinhanh', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchChiNhanh:", err);
      return inMemoryCache['B_CHINHANH'] || [];
    } finally {
      activePromises.chinhanh = null;
    }
  })();

  activePromises.chinhanh = promise;
  return promise;
}

export async function fetchSanPham(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_SANPHAM'] || [];
  if (!force && cache.sanpham) return cache.sanpham;
  if (activePromises.sanpham) return activePromises.sanpham;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b_sanpham')
          .select('SKU, TEN_SAN_PHAM, THUONG_HIEU, CHIET_XUAT, TINH_NANG, CAN, LOAN, DVT, TON_DAU, NHAP, XUAT, TON_CUOI, TON_TOI_THIEU, user_id')
          .eq('user_id', userId)
          .range(from, from + pageSize - 1);

        if (error) throw error;

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

      updateInMemoryAndCentralCache('sanpham', allData);
      return allData;
    } catch (err) {
      console.error("Lỗi fetchSanPham:", err);
      return inMemoryCache['B_SANPHAM'] || [];
    } finally {
      activePromises.sanpham = null;
    }
  })();

  activePromises.sanpham = promise;
  return promise;
}

export async function fetchKiemKho(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_KIEMKHO'] || [];
  if (!force && cache.kiemkho) return cache.kiemkho;
  if (activePromises.kiemkho) return activePromises.kiemkho;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_kiemkho')
        .select('MA_PHIEU, SKU, TON_HE_THONG, TON_THUC_TE, LECH, LOAI_BU, NGUOI_KIEM, THOI_DIEM, user_id')
        .eq('user_id', userId);
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('kiemkho', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchKiemKho:", err);
      return inMemoryCache['B_KIEMKHO'] || [];
    } finally {
      activePromises.kiemkho = null;
    }
  })();

  activePromises.kiemkho = promise;
  return promise;
}

export async function fetchEmailLogs(userId: string, force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_EMAILLOG'] || [];
  if (!force && cache.emaillog) return cache.emaillog;
  if (activePromises.emaillog) return activePromises.emaillog;

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from('b_emaillog')
        .select('id, EMAIL, TIEU_DE, NOI_DUNG, NGAY_GUI, TRANG_THAI, LOAI_EMAIL, user_id')
        .eq('user_id', userId)
        .order('NGAY_GUI', { ascending: false })
        .limit(100);
      if (error) throw error;
      const mapped = data || [];
      updateInMemoryAndCentralCache('emaillog', mapped);
      return mapped;
    } catch (err) {
      console.error("Lỗi fetchEmailLogs:", err);
      return inMemoryCache['B_EMAILLOG'] || [];
    } finally {
      activePromises.emaillog = null;
    }
  })();

  activePromises.emaillog = promise;
  return promise;
}

export async function fetchNhapXuat(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_NHAPXUAT'] || [];
  if (!force && cache.nhapxuat) return cache.nhapxuat;
  if (activePromises.nhapxuat) return activePromises.nhapxuat;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b_nhapxuat')
          .select('HOA_DON, CHI_NHANH, NGAY, LOAI, TONG_SL, NGUOI_TAO, TEN_NGUOI_TAO, TG_TAO, GHI_CHU, MA_NV, TEN_DANG_NHAP, TRANG_THAI, user_id')
          .eq('user_id', userId)
          .range(from, from + pageSize - 1);

        if (error) throw error;

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

      updateInMemoryAndCentralCache('nhapxuat', allData);
      return allData;
    } catch (err) {
      console.error("Lỗi fetchNhapXuat:", err);
      return inMemoryCache['B_NHAPXUAT'] || [];
    } finally {
      activePromises.nhapxuat = null;
    }
  })();

  activePromises.nhapxuat = promise;
  return promise;
}

export async function fetchNhapXuatCT(force = false): Promise<any[]> {
  if (isOfflineMode) return inMemoryCache['B_NHAPXUATCT'] || [];
  if (!force && cache.nhapxuatct) return cache.nhapxuatct;
  if (activePromises.nhapxuatct) return activePromises.nhapxuatct;

  const userId = await resolveEffectiveUserId();
  const promise = (async () => {
    try {
      let allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('b_nhapxuatct')
          .select('id, HOA_DON, SKU, TEN_SP, THUONG_HIEU, CHIET_XUAT, TINH_NANG, SPH, CYL, SO_LUONG, DVT, GHI_CHU, LOAI, NGAY, user_id')
          .eq('user_id', userId)
          .range(from, from + pageSize - 1);

        if (error) throw error;

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

      updateInMemoryAndCentralCache('nhapxuatct', allData);
      return allData;
    } catch (err) {
      console.error("Lỗi fetchNhapXuatCT:", err);
      return inMemoryCache['B_NHAPXUATCT'] || [];
    } finally {
      activePromises.nhapxuatct = null;
    }
  })();

  activePromises.nhapxuatct = promise;
  return promise;
}

/**
 * Tải toàn bộ dòng của một bảng theo phân trang (để vượt qua giới hạn 1000 dòng mặc định của Supabase/PostgREST)
 */
export async function fetchAllRows(tableName: string, userId: string): Promise<any[]> {
  userId = await resolveEffectiveUserId();
  const cacheKey = tableName.toUpperCase();

  if (isOfflineMode) {
    return inMemoryCache[cacheKey] || [];
  }

  // Chuyển hướng sang các fetcher chuyên biệt nếu khớp bảng để tận dụng RAM cache
  if (tableName === 'b_sanpham') return fetchSanPham();
  if (tableName === 'b_nhapxuat') return fetchNhapXuat();
  if (tableName === 'b_nhapxuatct') return fetchNhapXuatCT();
  if (tableName === 'b_kiemkho') return fetchKiemKho();
  if (tableName === 'b_thuonghieu') return fetchThuongHieu();
  if (tableName === 'b_chinhanh') return fetchChiNhanh();
  if (tableName === 'b_nhanvien') return fetchNhanVien();
  if (tableName === 'b_role') return fetchRole();

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
          return inMemoryCache[cacheKey] || [];
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
        return inMemoryCache[cacheKey] || [];
      }
      break;
    }
  }

  if (allData && allData.length > 0) {
    inMemoryCache[cacheKey] = allData;
  }
  return allData;
}

/**
 * Tải toàn bộ dữ liệu của người dùng hiện tại
 */
export async function fetchAllUserData(userId: string): Promise<UserDataPayload> {
  userId = await resolveEffectiveUserId();

  if (isOfflineMode) {
    const getCached = (key: string): any[] => {
      return inMemoryCache[key.toUpperCase()] || [];
    };
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

  // Load startup tables via singleton Promises + Cache
  const [nhanViensRaw, rolesRaw, thuongHieusRaw, chiNhanhsRaw] = await Promise.all([
    fetchNhanVien(),
    fetchRole(),
    fetchThuongHieu(),
    fetchChiNhanh()
  ]);

  // For other tables, if already in cache, use them; otherwise empty (lazy load on tab enter)
  const sanPhamsRaw = cache.sanpham || [];
  const nhapXuatsRaw = cache.nhapxuat || [];
  const nhapXuatCTsRaw = cache.nhapxuatct || [];
  const kiemKhosRaw = cache.kiemkho || [];

  const sanPhams: SanPham[] = sanPhamsRaw.map(item => ({
    SKU: item.SKU,
    TEN_SAN_PHAM: item.TEN_SAN_PHAM,
    THUONG_HIEU: item.THUONG_HIEU,
    CHIET_XUAT: item.CHIET_XUAT,
    TINH_NANG: item.TINH_NANG,
    CAN: Number(item.CAN ?? 0),
    LOAN: Number(item.LOAN ?? 0),
    DVT: item.DVT,
    TON_DAU: Number(item.TON_DAU ?? 0),
    NHAP: Number(item.NHAP ?? 0),
    XUAT: Number(item.XUAT ?? 0),
    TON_CUOI: Number(item.TON_CUOI ?? 0),
    TON_TOI_THIEU: Number(item.TON_TOI_THIEU ?? 0)
  }));

  const nhapXuats: NhapXuat[] = nhapXuatsRaw.map(item => ({
    HOA_DON: item.HOA_DON,
    CHI_NHANH: item.CHI_NHANH,
    NGAY: item.NGAY,
    LOAI: item.LOAI,
    TONG_SL: Number(item.TONG_SL ?? 0),
    NGUOI_TAO: item.NGUOI_TAO,
    TEN_NGUOI_TAO: item.TEN_NGUOI_TAO,
    TG_TAO: item.TG_TAO,
    GHI_CHU: item.GHI_CHU || '',
    MA_NV: item.MA_NV || undefined,
    TEN_DANG_NHAP: item.TEN_DANG_NHAP || undefined,
    TRANG_THAI: item.TRANG_THAI || 'Hoàn tất'
  }));

  const nhapXuatCTs: NhapXuatCT[] = nhapXuatCTsRaw.map(item => ({
    ID: item.id !== undefined ? item.id : item.ID,
    HOA_DON: item.HOA_DON,
    SKU: item.SKU,
    TEN_SP: item.TEN_SP,
    THUONG_HIEU: item.THUONG_HIEU,
    CHIET_XUAT: item.CHIET_XUAT,
    TINH_NANG: item.TINH_NANG,
    SPH: Number(item.SPH ?? 0),
    CYL: Number(item.CYL ?? 0),
    SO_LUONG: Number(item.SO_LUONG ?? 0),
    DVT: item.DVT,
    GHI_CHU: item.GHI_CHU || '',
    LOAI: item.LOAI,
    NGAY: item.NGAY
  }));

  const kiemKhos: KiemKho[] = kiemKhosRaw.map(item => ({
    MA_PHIEU: item.MA_PHIEU,
    SKU: item.SKU,
    TON_HE_THONG: Number(item.TON_HE_THONG ?? 0),
    TON_THUC_TE: Number(item.TON_THUC_TE ?? 0),
    LECH: Number(item.LECH ?? 0),
    LOAI_BU: item.LOAI_BU,
    NGUOI_KIEM: item.NGUOI_KIEM,
    THOI_DIEM: item.THOI_DIEM
  }));

  const thuongHieus: ThuongHieu[] = thuongHieusRaw.map(item => ({
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

  const chiNhanhs: ChiNhanh[] = chiNhanhsRaw.map(item => ({
    CHI_NHANH: item.CHI_NHANH,
    DIA_CHI: item.DIA_CHI,
    SDT: item.SDT
  }));

  const nhanViens: NhanVien[] = nhanViensRaw.map(item => ({
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
    ROLES: safeParseArray(item.ROLES),
    user_id: item.user_id,
    active: item.active !== false
  }));

  const roles: Role[] = rolesRaw.map((item: any) => ({
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
    else invalidateCache('sanpham');
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
    } else {
      invalidateCache('nhapxuat');
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
    invalidateCache('nhapxuatct');
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
    if (!res.error) {
      invalidateCache('kiemkho');
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
    if (!res.error) {
      invalidateCache('thuonghieu');
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
    if (!res.error) {
      invalidateCache('chinhanh');
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
  
  // Kiểm tra xem dòng nhân viên này đã tồn tại trong DB chưa bằng MA_NV
  let existing: any = null;
  try {
    const { data, error: checkError } = await supabase
      .from('b_nhanvien')
      .select('MA_NV, user_id')
      .eq('MA_NV', n.MA_NV)
      .maybeSingle();
    if (checkError) {
      console.warn("Lỗi kiểm tra b_nhanvien tồn tại:", checkError.message);
    } else {
      existing = data;
    }
  } catch (err) {
    console.warn("Lỗi ngoài dự kiến khi kiểm tra b_nhanvien:", err);
  }

  // Giữ nguyên user_id của nhân viên nếu đã có sẵn trong DB, tránh bị ghi đè bởi user_id của Admin đang thao tác
  let targetUserId = n.user_id || existing?.user_id || userId;
  if (!targetUserId) {
    targetUserId = await resolveEffectiveUserId();
  }
  n.user_id = targetUserId; // Save back to local object

  try {
    const payload = {
      "MA_NV": n.MA_NV,
      "HO_TEN": n.HO_TEN,
      "CHUC_VU": n.CHUC_VU,
      "BO_PHAN": n.BO_PHAN,
      "CHI_NHANH": n.CHI_NHANH,
      "EMAIL": n.EMAIL || '',
      "ROLE": n.ROLE,
      "PERMISSIONS": n.PERMISSIONS || [],
      "WRITE_ACCESS": n.WRITE_ACCESS,
      "TEN_DANG_NHAP": n.TEN_DANG_NHAP || '',
      "MAT_KHAU": n.MAT_KHAU || '',
      "YEU_CAU_RESET": n.YEU_CAU_RESET || false,
      "TRANG_THAI": n.TRANG_THAI || 'Hoạt động',
      "ROLES": n.ROLES || [],
      "active": n.active !== false,
      "NGAY_DANG_KY": (n.NGAY_DANG_KY && String(n.NGAY_DANG_KY).trim() !== '') ? String(n.NGAY_DANG_KY).trim() : null,
      user_id: targetUserId
    };

    let res;
    if (existing) {
      // Đã có -> Cập nhật bằng MA_NV
      res = await supabase
        .from('b_nhanvien')
        .update(payload)
        .eq('MA_NV', n.MA_NV)
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

    if (!res.error) {
      invalidateCache('nhanvien');
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

    if (!res.error) {
      invalidateCache('role');
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
    invalidateCache('role');
    return res2;
  }
  invalidateCache('role');
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
  if (!res1.error && !res2.error) {
    invalidateCache('nhapxuat');
    invalidateCache('nhapxuatct');
  }
  return { error: res1.error || res2.error };
}

/**
 * Xóa Thương hiệu
 */
export async function deleteThuongHieu(thuongHieu: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_thuonghieu').delete().eq('THUONG_HIEU', thuongHieu).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteThuongHieu:", res.error);
  else invalidateCache('thuonghieu');
  return res;
}

/**
 * Xóa Chi nhánh
 */
export async function deleteChiNhanh(chiNhanh: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_chinhanh').delete().eq('CHI_NHANH', chiNhanh).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteChiNhanh:", res.error);
  else invalidateCache('chinhanh');
  return res;
}

/**
 * Xóa Nhân viên
 */
export async function deleteNhanVien(email: string, userId: string) {
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_nhanvien').delete().eq('EMAIL', email).eq('user_id', userId);
  if (res.error) logDbError("Lỗi deleteNhanVien:", res.error);
  else invalidateCache('nhanvien');
  return res;
}

/**
 * Xóa Phiếu kiểm kê kho và toàn bộ các dòng liên quan theo MA_PHIEU
 */
export async function deleteKiemKho(maPhieu: string, userId: string) {
  if (isOfflineMode) {
    let local = inMemoryCache['B_KIEMKHO'] || [];
    local = local.filter((k: any) => k.MA_PHIEU !== maPhieu);
    inMemoryCache['B_KIEMKHO'] = local;
    invalidateCache('kiemkho');
    return { data: null, error: null };
  }
  userId = await resolveEffectiveUserId();
  const res = await supabase.from('b_kiemkho').delete().eq('MA_PHIEU', maPhieu).eq('user_id', userId);
  if (res.error) {
    logDbError("Lỗi deleteKiemKho:", res.error);
  } else {
    // Cập nhật lại inMemoryCache
    let local = inMemoryCache['B_KIEMKHO'] || [];
    local = local.filter((k: any) => k.MA_PHIEU !== maPhieu);
    inMemoryCache['B_KIEMKHO'] = local;
    invalidateCache('kiemkho');
  }
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

  // 1. Lưu vào inMemoryCache trước để đảm bảo dữ liệu không bị mất
  try {
    const logs: EmailLog[] = inMemoryCache['B_EMAILLOG'] || [];
    
    // Tránh trùng lặp
    if (!logs.some(l => l.id === localLog.id || (l.EMAIL === localLog.EMAIL && l.TIEU_DE === localLog.TIEU_DE && l.NGAY_GUI === localLog.NGAY_GUI))) {
      logs.unshift(localLog);
      inMemoryCache['B_EMAILLOG'] = logs.slice(0, 300); // Lưu tối đa 300 dòng nhật ký
    }
  } catch (err) {
    console.warn("Lỗi lưu email log vào inMemoryCache:", err);
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
        console.log(`[EMAIL LOG] Bảng b_emaillog gặp lỗi trên Supabase khi gửi email (Chi tiết: ${res.error.message}, Code: ${res.error.code}). Sử dụng inMemoryCache làm fallback.`);
      } else {
        console.warn("Lỗi syncEmailLog lên Supabase (sử dụng lưu trữ cục bộ fallback):", res.error.message);
      }
    } else {
      invalidateCache('emaillog');
    }
    return res;
  } catch (err: any) {
    console.warn("Exception khi syncEmailLog lên Supabase:", err?.message || err);
    return { data: null, error: err };
  }
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

/**
 * Chuẩn hóa SKU cục bộ cho hàm fallback
 */
function localCleanSKU(sku: string | undefined | null): string {
  if (!sku) return '';
  let cleaned = sku.trim().replace(/,/g, '.').replace(/\s+/g, ' ').toUpperCase();
  cleaned = cleaned.replace(/(?:^|\s)\+(\d)/g, (match) => match.replace('+', ''));
  cleaned = cleaned.replace(/\b1\.5\b/g, '1.50').replace(/\b1\.6\b/g, '1.60');
  return cleaned;
}

/**
 * Kiểm tra xem lỗi trả về có phải do thiếu hàm RPC trong database hay không
 */
function isRpcNotFoundError(error: any): boolean {
  if (!error) return false;
  const errMsg = (error.message || '').toLowerCase();
  return (
    error.code === 'PGRST125' ||
    error.code === 'PGRST202' ||
    errMsg.includes('could not find') ||
    errMsg.includes('function') ||
    errMsg.includes('invalid path')
  );
}

/**
 * Fallback lấy mã hóa đơn tiếp theo trực tiếp từ DB bằng client-side query
 */
async function fallbackGetNextInvoiceId(prefix: string, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('b_nhapxuat')
      .select('HOA_DON')
      .eq('user_id', userId)
      .ilike('HOA_DON', `${prefix}%`);
    if (error || !data) {
      return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    }
    let maxNum = 0;
    data.forEach(item => {
      const h = item.HOA_DON;
      if (h.startsWith(prefix)) {
        const numPart = parseInt(h.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
  } catch (err) {
    return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
}

/**
 * Fallback lấy mã kiểm kho tiếp theo trực tiếp từ DB bằng client-side query
 */
async function fallbackGetNextKiemKhoId(prefix: string, userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('b_kiemkho')
      .select('MA_PHIEU')
      .eq('user_id', userId)
      .ilike('MA_PHIEU', `${prefix}%`);
    if (error || !data) {
      return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    }
    let maxNum = 0;
    data.forEach(item => {
      const m = item.MA_PHIEU;
      if (m.startsWith(prefix)) {
        const numPart = parseInt(m.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });
    return `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
  } catch (err) {
    return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
}

/**
 * Fallback tạo giao dịch bằng client-side REST queries
 */
async function fallbackCreateTransaction(header: any, details: any[], userId: string) {
  let v_hoa_don = header.HOA_DON;
  const v_loai = header.LOAI;
  
  const isTempCode = !v_hoa_don || v_hoa_don === '' || !/^(PN|PX|PNK|PXK)\d+$/.test(v_hoa_don);
  if (isTempCode) {
    let prefix = 'PX';
    if (v_loai === 'NHẬP') {
      prefix = v_hoa_don && v_hoa_don.startsWith('PNK') ? 'PNK' : 'PN';
    } else {
      prefix = v_hoa_don && v_hoa_don.startsWith('PXK') ? 'PXK' : 'PX';
    }
    v_hoa_don = await fallbackGetNextInvoiceId(prefix, userId);
  }

  // 1. Insert/update header b_nhapxuat
  const headerRow = {
    HOA_DON: v_hoa_don,
    CHI_NHANH: header.CHI_NHANH,
    NGAY: header.NGAY,
    LOAI: v_loai,
    TONG_SL: Number(header.TONG_SL),
    NGUOI_TAO: header.NGUOI_TAO,
    TEN_NGUOI_TAO: header.TEN_NGUOI_TAO,
    TG_TAO: header.TG_TAO,
    GHI_CHU: header.GHI_CHU,
    MA_NV: header.MA_NV,
    TEN_DANG_NHAP: header.TEN_DANG_NHAP,
    TRANG_THAI: header.TRANG_THAI || 'Hoàn tất',
    user_id: userId
  };

  const { error: hErr } = await supabase
    .from('b_nhapxuat')
    .upsert(headerRow, { onConflict: 'HOA_DON' });
  if (hErr) throw hErr;

  // 2. Delete existing details in b_nhapxuatct
  const { error: dDelErr } = await supabase
    .from('b_nhapxuatct')
    .delete()
    .eq('HOA_DON', v_hoa_don)
    .eq('user_id', userId);
  if (dDelErr) throw dDelErr;

  // 3. Insert new details to b_nhapxuatct
  const detailRows = details.map((d: any, idx: number) => ({
    id: d.id || d.ID || `CT_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
    HOA_DON: v_hoa_don,
    SKU: d.SKU,
    TEN_SP: d.TEN_SP,
    THUONG_HIEU: d.THUONG_HIEU,
    CHIET_XUAT: d.CHIET_XUAT,
    TINH_NANG: d.TINH_NANG,
    SPH: d.SPH !== undefined && d.SPH !== null ? Number(d.SPH) : null,
    CYL: d.CYL !== undefined && d.CYL !== null ? Number(d.CYL) : null,
    SO_LUONG: Number(d.SO_LUONG),
    DVT: d.DVT,
    GHI_CHU: d.GHI_CHU,
    LOAI: d.LOAI || v_loai,
    NGAY: d.NGAY || header.NGAY,
    user_id: userId
  }));

  if (detailRows.length > 0) {
    const { error: dInsErr } = await supabase
      .from('b_nhapxuatct')
      .insert(detailRows);
    if (dInsErr) throw dInsErr;
  }

  // 4. Recalculate stock and enforce no negative stock constraint for involved SKUs
  const skusToRecalc = Array.from(new Set(details.map(d => localCleanSKU(d.SKU))));
  if (skusToRecalc.length > 0) {
    for (const sku of skusToRecalc) {
      const { data: rawDetails, error: detailsErr } = await supabase
        .from('b_nhapxuatct')
        .select(`
          SO_LUONG,
          LOAI,
          SKU,
          b_nhapxuat (
            TRANG_THAI
          )
        `)
        .eq('user_id', userId);
      
      if (detailsErr) throw detailsErr;

      const filtered = (rawDetails || []).filter((d: any) => {
        const isSkuMatch = localCleanSKU(d.SKU) === sku;
        const isHeaderNotCancelled = d.b_nhapxuat && d.b_nhapxuat.TRANG_THAI !== 'Đã hủy';
        return isSkuMatch && isHeaderNotCancelled;
      });

      const totalNhap = filtered
        .filter((d: any) => d.LOAI === 'NHẬP')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const totalXuat = filtered
        .filter((d: any) => d.LOAI === 'XUẤT')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const { data: pData, error: pErr } = await supabase
        .from('b_sanpham')
        .select('SKU, TON_DAU')
        .eq('user_id', userId);
      
      if (pErr) throw pErr;

      const productRow = (pData || []).find((p: any) => localCleanSKU(p.SKU) === sku);
      const tonDau = productRow ? (Number(productRow.TON_DAU) || 0) : 0;
      const tonCuoi = tonDau + totalNhap - totalXuat;

      if (tonCuoi < 0) {
        throw new Error(`Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [${sku}] chỉ còn tồn ${tonDau} (yêu cầu xuất làm âm thành ${tonCuoi})`);
      }

      if (productRow) {
        const { error: upErr } = await supabase
          .from('b_sanpham')
          .update({
            NHAP: totalNhap,
            XUAT: totalXuat,
            TON_CUOI: tonCuoi
          })
          .eq('user_id', userId)
          .eq('SKU', productRow.SKU);
        if (upErr) throw upErr;
      }
    }
  }

  return { success: true, hoa_don: v_hoa_don };
}

/**
 * Fallback xóa giao dịch bằng client-side REST queries
 */
async function fallbackDeleteTransaction(hoaDon: string, userId: string) {
  // Get all SKUs in this invoice before deleting details
  const { data: detailsToDelete, error: dErr } = await supabase
    .from('b_nhapxuatct')
    .select('SKU')
    .eq('HOA_DON', hoaDon)
    .eq('user_id', userId);
  if (dErr) throw dErr;

  // Delete details
  const { error: delDetailsErr } = await supabase
    .from('b_nhapxuatct')
    .delete()
    .eq('HOA_DON', hoaDon)
    .eq('user_id', userId);
  if (delDetailsErr) throw delDetailsErr;

  // Delete header
  const { error: delHeaderErr } = await supabase
    .from('b_nhapxuat')
    .delete()
    .eq('HOA_DON', hoaDon)
    .eq('user_id', userId);
  if (delHeaderErr) throw delHeaderErr;

  // Recalculate stock for the affected products
  const skusToRecalc = Array.from(new Set((detailsToDelete || []).map((d: any) => localCleanSKU(d.SKU))));
  if (skusToRecalc.length > 0) {
    for (const sku of skusToRecalc) {
      const { data: rawDetails, error: detailsErr } = await supabase
        .from('b_nhapxuatct')
        .select(`
          SO_LUONG,
          LOAI,
          SKU,
          b_nhapxuat (
            TRANG_THAI
          )
        `)
        .eq('user_id', userId);
      
      if (detailsErr) throw detailsErr;

      const filtered = (rawDetails || []).filter((d: any) => {
        const isSkuMatch = localCleanSKU(d.SKU) === sku;
        const isHeaderNotCancelled = d.b_nhapxuat && d.b_nhapxuat.TRANG_THAI !== 'Đã hủy';
        return isSkuMatch && isHeaderNotCancelled;
      });

      const totalNhap = filtered
        .filter((d: any) => d.LOAI === 'NHẬP')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const totalXuat = filtered
        .filter((d: any) => d.LOAI === 'XUẤT')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const { data: pData, error: pErr } = await supabase
        .from('b_sanpham')
        .select('SKU, TON_DAU')
        .eq('user_id', userId);
      
      if (pErr) throw pErr;

      const productRow = (pData || []).find((p: any) => localCleanSKU(p.SKU) === sku);
      const tonDau = productRow ? (Number(productRow.TON_DAU) || 0) : 0;
      const tonCuoi = tonDau + totalNhap - totalXuat;

      if (tonCuoi < 0) {
        throw new Error(`Lỗi (Rule 1): Không cho phép tồn kho âm sau khi xóa. SKU [${sku}] chỉ còn tồn ${tonDau} (xóa làm âm thành ${tonCuoi})`);
      }

      if (productRow) {
        const { error: upErr } = await supabase
          .from('b_sanpham')
          .update({
            NHAP: totalNhap,
            XUAT: totalXuat,
            TON_CUOI: tonCuoi
          })
          .eq('user_id', userId)
          .eq('SKU', productRow.SKU);
        if (upErr) throw upErr;
      }
    }
  }

  return { success: true };
}

/**
 * Fallback lưu phiếu kiểm kho bằng client-side REST queries
 */
async function fallbackSaveAudit(audits: any[], headers: any[], details: any[], userId: string) {
  // 1. Generate MA_PHIEU for PKK
  let currentPKKNum: number | null = null;
  const mappedAudits = [];
  for (const audit of audits) {
    let v_ma_phieu = audit.MA_PHIEU;
    if (!v_ma_phieu || v_ma_phieu === '' || !/^PKK\d+$/.test(v_ma_phieu)) {
      if (currentPKKNum === null) {
        const nextId = await fallbackGetNextKiemKhoId('PKK', userId);
        currentPKKNum = parseInt(nextId.substring(3), 10);
      } else {
        currentPKKNum += 1;
      }
      v_ma_phieu = `PKK${String(currentPKKNum).padStart(6, '0')}`;
    }
    mappedAudits.push({ ...audit, MA_PHIEU: v_ma_phieu });
  }

  // 2. Upsert audits
  for (const audit of mappedAudits) {
    const { data: existing, error: checkErr } = await supabase
      .from('b_kiemkho')
      .select('MA_PHIEU')
      .eq('MA_PHIEU', audit.MA_PHIEU)
      .eq('SKU', audit.SKU)
      .eq('user_id', userId)
      .limit(1);
    
    if (checkErr) throw checkErr;
    
    const auditRow = {
      MA_PHIEU: audit.MA_PHIEU,
      SKU: audit.SKU,
      TON_HE_THONG: Number(audit.TON_HE_THONG),
      TON_THUC_TE: Number(audit.TON_THUC_TE),
      LECH: Number(audit.LECH),
      LOAI_BU: audit.LOAI_BU,
      NGUOI_KIEM: audit.NGUOI_KIEM,
      THOI_DIEM: audit.THOI_DIEM,
      MA_NV: audit.MA_NV,
      TEN_DANG_NHAP: audit.TEN_DANG_NHAP,
      user_id: userId
    };

    if (existing && existing.length > 0) {
      const { error: upErr } = await supabase
        .from('b_kiemkho')
        .update(auditRow)
        .eq('MA_PHIEU', audit.MA_PHIEU)
        .eq('SKU', audit.SKU)
        .eq('user_id', userId);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase
        .from('b_kiemkho')
        .insert(auditRow);
      if (insErr) throw insErr;
    }
  }

  // 3. Upsert headers
  const adjHoaDonMap: Record<string, string> = {};
  let currentPNKNum: number | null = null;
  let currentPXKNum: number | null = null;

  for (const header of headers) {
    const oldHoaDon = header.HOA_DON;
    const prefix = oldHoaDon.startsWith('PNK') ? 'PNK' : 'PXK';
    
    let newHoaDon = '';
    if (prefix === 'PNK') {
      if (currentPNKNum === null) {
        const nextId = await fallbackGetNextInvoiceId('PNK', userId);
        currentPNKNum = parseInt(nextId.substring(3), 10);
      } else {
        currentPNKNum += 1;
      }
      newHoaDon = `PNK${String(currentPNKNum).padStart(6, '0')}`;
    } else {
      if (currentPXKNum === null) {
        const nextId = await fallbackGetNextInvoiceId('PXK', userId);
        currentPXKNum = parseInt(nextId.substring(3), 10);
      } else {
        currentPXKNum += 1;
      }
      newHoaDon = `PXK${String(currentPXKNum).padStart(6, '0')}`;
    }

    adjHoaDonMap[oldHoaDon] = newHoaDon;

    const headerRow = {
      HOA_DON: newHoaDon,
      CHI_NHANH: header.CHI_NHANH,
      NGAY: header.NGAY,
      LOAI: header.LOAI,
      TONG_SL: Number(header.TONG_SL),
      NGUOI_TAO: header.NGUOI_TAO,
      TEN_NGUOI_TAO: header.TEN_NGUOI_TAO,
      TG_TAO: header.TG_TAO,
      GHI_CHU: header.GHI_CHU,
      MA_NV: header.MA_NV,
      TEN_DANG_NHAP: header.TEN_DANG_NHAP,
      TRANG_THAI: header.TRANG_THAI || 'Hoàn tất',
      user_id: userId
    };

    const { error: insHeaderErr } = await supabase
      .from('b_nhapxuat')
      .insert(headerRow);
    if (insHeaderErr) throw insHeaderErr;
  }

  // 4. Insert details
  const detailRows = details.map((d: any, idx: number) => {
    const oldHoaDon = d.HOA_DON;
    const newHoaDon = adjHoaDonMap[oldHoaDon] || oldHoaDon;

    return {
      id: d.id || d.ID || `CT_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
      HOA_DON: newHoaDon,
      SKU: d.SKU,
      TEN_SP: d.TEN_SP,
      THUONG_HIEU: d.THUONG_HIEU,
      CHIET_XUAT: d.CHIET_XUAT,
      TINH_NANG: d.TINH_NANG,
      SPH: d.SPH !== undefined && d.SPH !== null ? Number(d.SPH) : null,
      CYL: d.CYL !== undefined && d.CYL !== null ? Number(d.CYL) : null,
      SO_LUONG: Number(d.SO_LUONG),
      DVT: d.DVT,
      GHI_CHU: d.GHI_CHU,
      LOAI: d.LOAI,
      NGAY: d.NGAY,
      user_id: userId
    };
  });

  if (detailRows.length > 0) {
    const { error: insDetailsErr } = await supabase
      .from('b_nhapxuatct')
      .insert(detailRows);
    if (insDetailsErr) throw insDetailsErr;
  }

  // 5. Recalculate stock for affected SKUs
  const skusToRecalc = Array.from(new Set([
    ...audits.map(a => localCleanSKU(a.SKU)),
    ...details.map(d => localCleanSKU(d.SKU))
  ]));

  if (skusToRecalc.length > 0) {
    for (const sku of skusToRecalc) {
      const { data: rawDetails, error: detailsErr } = await supabase
        .from('b_nhapxuatct')
        .select(`
          SO_LUONG,
          LOAI,
          SKU,
          b_nhapxuat (
            TRANG_THAI
          )
        `)
        .eq('user_id', userId);
      
      if (detailsErr) throw detailsErr;

      const filtered = (rawDetails || []).filter((d: any) => {
        const isSkuMatch = localCleanSKU(d.SKU) === sku;
        const isHeaderNotCancelled = d.b_nhapxuat && d.b_nhapxuat.TRANG_THAI !== 'Đã hủy';
        return isSkuMatch && isHeaderNotCancelled;
      });

      const totalNhap = filtered
        .filter((d: any) => d.LOAI === 'NHẬP')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const totalXuat = filtered
        .filter((d: any) => d.LOAI === 'XUẤT')
        .reduce((sum: number, d: any) => sum + (Number(d.SO_LUONG) || 0), 0);

      const { data: pData, error: pErr } = await supabase
        .from('b_sanpham')
        .select('SKU, TON_DAU')
        .eq('user_id', userId);
      
      if (pErr) throw pErr;

      const productRow = (pData || []).find((p: any) => localCleanSKU(p.SKU) === sku);
      const tonDau = productRow ? (Number(productRow.TON_DAU) || 0) : 0;
      const tonCuoi = tonDau + totalNhap - totalXuat;

      if (tonCuoi < 0) {
        throw new Error(`Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [${sku}] chỉ còn tồn ${tonDau} (yêu cầu điều chỉnh làm âm thành ${tonCuoi})`);
      }

      if (productRow) {
        const { error: upErr } = await supabase
          .from('b_sanpham')
          .update({
            NHAP: totalNhap,
            XUAT: totalXuat,
            TON_CUOI: tonCuoi
          })
          .eq('user_id', userId)
          .eq('SKU', productRow.SKU);
        if (upErr) throw upErr;
      }
    }
  }

  return { success: true };
}

/**
 * Fallback tạo gom đơn bằng client-side REST queries
 */
async function fallbackCreateGomDon(header: any, details: any[], userId: string) {
  const v_id = header.id;

  // Insert or update b_gomdon
  const gomDonRow = {
    id: v_id,
    branch: header.branch,
    original_text: header.original_text,
    trang_thai: header.trang_thai || 'Chờ xử lý',
    so_phieu_xuat: header.so_phieu_xuat,
    user_id: userId
  };

  const { error: gdErr } = await supabase
    .from('b_gomdon')
    .upsert(gomDonRow, { onConflict: 'id' });
  if (gdErr) throw gdErr;

  // Delete existing details of this gom_don
  const { error: dDelErr } = await supabase
    .from('b_gomdonct')
    .delete()
    .eq('gom_don_id', v_id)
    .eq('user_id', userId);
  if (dDelErr) throw dDelErr;

  // Insert details b_gomdonct
  const detailRows = details.map((item: any, idx: number) => ({
    id: item.id || `GDCT_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
    gom_don_id: v_id,
    raw_line: item.raw_line,
    brand: item.brand,
    chiet_xuat: item.chiet_xuat,
    tinh_nang: item.tinh_nang,
    sph: item.sph !== undefined && item.sph !== null ? Number(item.sph) : null,
    cyl: item.cyl !== undefined && item.cyl !== null ? Number(item.cyl) : null,
    quantity: item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : 1,
    unit: item.unit || 'miếng',
    sku: item.sku,
    error: item.error,
    user_id: userId
  }));

  if (detailRows.length > 0) {
    const { error: gdctErr } = await supabase
      .from('b_gomdonct')
      .insert(detailRows);
    if (gdctErr) throw gdctErr;
  }

  return { success: true };
}

/**
 * Giao dịch tạo phiếu và chi tiết đi kèm qua RPC PostgreSQL (An toàn tuyệt đối khỏi race condition)
 */
export async function rpcCreateTransaction(header: any, details: any[]) {
  if (isOfflineMode) {
    return { data: { success: true, hoa_don: header.HOA_DON }, error: null };
  }
  const userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase.rpc('create_transaction_v2', {
      p_header: header,
      p_details: details,
      p_user_id: userId
    });
    if (error) {
      if (isRpcNotFoundError(error)) {
        console.warn('RPC create_transaction_v2 missing, falling back to client-side transaction...');
        const res = await fallbackCreateTransaction(header, details, userId);
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      }
      console.error('Lỗi khi chạy create_transaction_v2 RPC:', error);
      return { data: null, error };
    }
    invalidateCache('nhapxuat');
    invalidateCache('nhapxuatct');
    invalidateCache('sanpham');
    return { data, error: null };
  } catch (err: any) {
    if (isRpcNotFoundError(err)) {
      console.warn('RPC create_transaction_v2 exception, falling back to client-side transaction...');
      try {
        const res = await fallbackCreateTransaction(header, details, userId);
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      } catch (fallbackErr: any) {
        return { data: null, error: fallbackErr };
      }
    }
    console.error('Exception khi chạy create_transaction_v2 RPC:', err);
    return { data: null, error: err };
  }
}

/**
 * Giao dịch xóa phiếu và chi tiết đi kèm qua RPC PostgreSQL (Rollback tồn và an toàn tuyệt đối)
 */
export async function rpcDeleteTransaction(hoaDon: string) {
  if (isOfflineMode) {
    return { data: { success: true }, error: null };
  }
  const userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase.rpc('delete_transaction_v2', {
      p_hoa_don: hoaDon,
      p_user_id: userId
    });
    if (error) {
      if (isRpcNotFoundError(error)) {
        console.warn('RPC delete_transaction_v2 missing, falling back to client-side deletion...');
        const res = await fallbackDeleteTransaction(hoaDon, userId);
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      }
      console.error('Lỗi khi chạy delete_transaction_v2 RPC:', error);
      return { data: null, error };
    }
    invalidateCache('nhapxuat');
    invalidateCache('nhapxuatct');
    invalidateCache('sanpham');
    return { data, error: null };
  } catch (err: any) {
    if (isRpcNotFoundError(err)) {
      console.warn('RPC delete_transaction_v2 exception, falling back to client-side deletion...');
      try {
        const res = await fallbackDeleteTransaction(hoaDon, userId);
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      } catch (fallbackErr: any) {
        return { data: null, error: fallbackErr };
      }
    }
    console.error('Exception khi chạy delete_transaction_v2 RPC:', err);
    return { data: null, error: err };
  }
}

/**
 * Giao dịch lưu phiếu kiểm kê kho và xử lý bù trừ tồn kho đồng thời qua RPC PostgreSQL (BEGIN...COMMIT)
 */
export async function rpcSaveAudit(audits: any[], headers: any[], details: any[]) {
  if (isOfflineMode) {
    return { data: { success: true }, error: null };
  }
  const userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase.rpc('save_audit_v2', {
      p_audits: audits,
      p_headers: headers,
      p_details: details,
      p_user_id: userId
    });
    if (error) {
      if (isRpcNotFoundError(error)) {
        console.warn('RPC save_audit_v2 missing, falling back to client-side audit...');
        const res = await fallbackSaveAudit(audits, headers, details, userId);
        invalidateCache('kiemkho');
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      }
      console.error('Lỗi khi chạy save_audit_v2 RPC:', error);
      return { data: null, error };
    }
    invalidateCache('kiemkho');
    invalidateCache('nhapxuat');
    invalidateCache('nhapxuatct');
    invalidateCache('sanpham');
    return { data, error: null };
  } catch (err: any) {
    if (isRpcNotFoundError(err)) {
      console.warn('RPC save_audit_v2 exception, falling back to client-side audit...');
      try {
        const res = await fallbackSaveAudit(audits, headers, details, userId);
        invalidateCache('kiemkho');
        invalidateCache('nhapxuat');
        invalidateCache('nhapxuatct');
        invalidateCache('sanpham');
        return { data: res, error: null };
      } catch (fallbackErr: any) {
        return { data: null, error: fallbackErr };
      }
    }
    console.error('Exception khi chạy save_audit_v2 RPC:', err);
    return { data: null, error: err };
  }
}

/**
 * Giao dịch lưu gom đơn tạm và chi tiết đi kèm qua RPC PostgreSQL
 */
export async function rpcCreateGomDon(header: any, details: any[]) {
  if (isOfflineMode) {
    return { data: { success: true }, error: null };
  }
  const userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase.rpc('create_gom_don_v2', {
      p_header: header,
      p_details: details,
      p_user_id: userId
    });
    if (error) {
      if (isRpcNotFoundError(error)) {
        console.warn('RPC create_gom_don_v2 missing, falling back to client-side gom don...');
        const res = await fallbackCreateGomDon(header, details, userId);
        return { data: res, error: null };
      }
      console.error('Lỗi khi chạy create_gom_don_v2 RPC:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err: any) {
    if (isRpcNotFoundError(err)) {
      console.warn('RPC create_gom_don_v2 exception, falling back to client-side gom don...');
      try {
        const res = await fallbackCreateGomDon(header, details, userId);
        return { data: res, error: null };
      } catch (fallbackErr: any) {
        return { data: null, error: fallbackErr };
      }
    }
    console.error('Exception khi chạy create_gom_don_v2 RPC:', err);
    return { data: null, error: err };
  }
}

/**
 * Sinh mã phiếu tiếp theo từ PostgreSQL Sequence qua RPC
 */
export async function rpcGetNextInvoiceId(prefix: string): Promise<string> {
  if (isOfflineMode) {
    return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
  const userId = await resolveEffectiveUserId();
  try {
    const { data, error } = await supabase.rpc('get_next_invoice_id', {
      p_prefix: prefix,
      p_user_id: userId
    });
    if (error) {
      if (isRpcNotFoundError(error)) {
        return await fallbackGetNextInvoiceId(prefix, userId);
      }
      console.error('Lỗi khi lấy get_next_invoice_id RPC:', error);
      return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    }
    return data;
  } catch (err) {
    if (isRpcNotFoundError(err)) {
      return await fallbackGetNextInvoiceId(prefix, userId);
    }
    console.error('Exception khi lấy get_next_invoice_id:', err);
    return prefix + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  }
}


