/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback, Component, ReactNode, lazy, Suspense } from 'react';

// Intercept and demote non-fatal network/Supabase errors from console.error to console.warn
const originalAppError = console.error;
console.error = function (...args) {
  const argStr = args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return arg.message + '\n' + arg.stack;
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }).join(' ');

  const isNetworkOrDbFetchError = 
    argStr.includes('Failed to fetch') || 
    argStr.includes('TypeError') ||
    argStr.includes('Lỗi kiểm tra Onboarding') ||
    argStr.includes('Lỗi fetchAllRows') ||
    argStr.includes('Lỗi tải b_') ||
    argStr.includes('Lỗi sync') ||
    argStr.includes('Lỗi khi tải dữ liệu từ Supabase Cloud') ||
    argStr.includes('Lỗi trong quá trình khởi tạo Auth') ||
    argStr.includes('user_luutru') ||
    argStr.includes('Bucket not found') ||
    argStr.includes('Lỗi upload file mẫu');

  if (isNetworkOrDbFetchError) {
    console.warn('[App Network/DB Warning (Demoted from Error)]:', ...args);
    return;
  }

  originalAppError.apply(console, args);
};
import { 
  TrendingUp, 
  TrendingDown, 
  FileUp,
  FileDown,
  Boxes, 
  ClipboardCheck, 
  History, 
  FolderTree, 
  Terminal, 
  Shield, 
  AlertTriangle, 
  AlertCircle,
  X, 
  UserCheck,
  Eye,
  Info,
  LogOut,
  Menu,
  Home,
  CheckCircle,
  Palette,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LayoutGrid,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Import Types và Mock Data
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, UserRole, User, ThuongHieu, ChiNhanh, NhanVien, EmailLog, Role, safeParseArray, normalizeDbRole, PERMISSION_PARENT_MAP } from './types';
import { 
  getVietnamDateString,
  getVietnamDateTimeString,
  cleanSKU
} from './data/mockData';
import { compareChietXuat } from './utils/chietXuatHelper';

// Import Supabase
import { supabase } from './supabaseClient';
import {
  SHARED_USER_ID,
  ensureUserOnboarded,
  syncSanPham,
  syncSanPhams,
  syncNhapXuat,
  syncNhapXuatCTs,
  syncKiemKho,
  syncThuongHieu,
  syncChiNhanh,
  syncNhanVien,
  syncRole,
  deleteRole,
  deleteNhapXuatAndDetails,
  deleteThuongHieu,
  deleteChiNhanh,
  deleteNhanVien,
  syncEmailLog,
  fetchEmailLogs,
  setOfflineMode,
  resolveEffectiveUserId,
  inMemoryCache
} from './supabaseSync';

// Import Components con (lazy loaded for optimal bundle size)
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ProductManagement = lazy(() => import('./components/ProductManagement'));
const TransactionForm = lazy(() => import('./components/TransactionForm'));
const InventoryAudit = lazy(() => import('./components/InventoryAudit'));
const TransactionHistory = lazy(() => import('./components/TransactionHistory'));
const CategoryManagement = lazy(() => import('./components/CategoryManagement'));
const ThemeSettings = lazy(() => import('./components/ThemeSettings'));
const DiopterMatrix = lazy(() => import('./components/DiopterMatrix'));
const OrderParser = lazy(() => import('./components/OrderParser'));
import { monitor } from './utils/debugMonitor';






/**
 * FILE: App.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Nhịp đập trung tâm của ứng dụng Quản lý Xuất Nhập Tồn Tròng Kính.
 *        Quản lý tập trung toàn bộ cơ sở dữ liệu State cục bộ (giả lập Google Sheets),
 *        triển khai các thuật toán xử lý nghiệp vụ, tự động cân bằng kho, rollback tồn kho
 *        và hệ thống phân quyền ba tầng nghiêm ngặt (Admin, Kho, Nhân viên).
 */

const DEFAULT_ROLES: Role[] = [
  {
    ROLE_CODE: 'ADMIN',
    TEN_ROLE: 'Quản trị viên (Admin)',
    PERMISSIONS: [
      'dashboard.view', 'dashboard.read', 'dashboard.export',
      'ordercheck.view', 'ordercheck.read', 'ordercheck.analyze', 'ordercheck.save', 'ordercheck.export',
      'picking_xuat.view', 'picking_xuat.read', 'picking_xuat.create', 'picking_xuat.edit', 'picking_xuat.delete', 'picking_xuat.export',
      'picking_nhap.view', 'picking_nhap.read', 'picking_nhap.create', 'picking_nhap.edit', 'picking_nhap.delete',
      'history.view', 'history.read', 'history.read_all', 'history.create', 'history.edit', 'history.delete', 'history.export',
      'picking.view', 'picking.read', 'picking.create', 'picking.delete', 'picking.export',
      'matrix.view', 'matrix.read',
      'stocktake.view', 'stocktake.read',
      'product.view', 'product.read', 'product.create', 'product.edit', 'product.delete',
      'employee.view', 'employee.read', 'employee.create', 'employee.edit', 'employee.delete',
      'role.view', 'role.read', 'role.create', 'role.edit', 'role.delete',
      'settings.view', 'settings.read',
      'inventory.view'
    ]
  },
  {
    ROLE_CODE: 'MANAGER',
    TEN_ROLE: 'Quản lý nghiệp vụ (Manager)',
    PERMISSIONS: [
      'dashboard.view', 'dashboard.read', 'dashboard.export',
      'ordercheck.view', 'ordercheck.read', 'ordercheck.analyze', 'ordercheck.save',
      'picking_xuat.view', 'picking_xuat.read', 'picking_xuat.create', 'picking_xuat.export',
      'picking_nhap.view', 'picking_nhap.read', 'picking_nhap.create',
      'history.view', 'history.read', 'history.read_all', 'history.create', 'history.edit', 'history.export',
      'picking.view', 'picking.read', 'picking.create', 'picking.export',
      'matrix.view', 'matrix.read',
      'stocktake.view', 'stocktake.read',
      'product.view', 'product.read', 'product.create', 'product.edit',
      'inventory.view'
    ]
  },
  {
    ROLE_CODE: 'STAFF',
    TEN_ROLE: 'Nhân viên bán hàng (Staff)',
    PERMISSIONS: [
      'picking_xuat.view', 'picking_xuat.read', 'picking_xuat.create',
      'picking_nhap.view', 'picking_nhap.read', 'picking_nhap.create',
      'history.view', 'history.read',
      'picking.view', 'picking.read', 'picking.create',
      'product.view', 'product.read',
      'inventory.view'
    ]
  }
];

const deduplicateProducts = (products: SanPham[]): SanPham[] => {
  const seen = new Set<string>();
  return products.filter(p => {
    const sku = cleanSKU(p.SKU);
    if (seen.has(sku)) return false;
    seen.add(sku);
    return true;
  });
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  key?: React.Key;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const self = this as any;
    if (self.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 border border-rose-150 rounded-2xl text-rose-800 space-y-4 shadow-xs animate-fade-in max-w-2xl mx-auto my-8">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 border border-rose-250">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="space-y-1.5 flex-1 text-left">
              <h3 className="font-extrabold text-sm text-rose-900">{self.props.fallbackTitle || "Đã xảy ra lỗi không mong muốn"}</h3>
              <p className="text-[11px] text-rose-700 font-semibold leading-relaxed">
                Hệ thống gặp lỗi trong quá trình kết xuất (render) cấu trúc giao diện này. Bạn có thể thử chuyển qua tab khác hoặc tải lại trang (F5).
              </p>
              {self.state.error && (
                <pre className="p-3 bg-rose-100 border border-rose-200 rounded-xl text-[10px] font-mono text-rose-900 whitespace-pre-wrap break-all max-h-40 overflow-y-auto mt-2">
                  {self.state.error.toString()}
                </pre>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              onClick={() => self.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              Thử tải lại Tab này
            </button>
          </div>
        </div>
      );
    }

    return self.props.children;
  }
}

// Cooldown / throttle variables for pingSupabase to reduce quota usage and prevent spamming
const PING_COOLDOWN = 45000; // 45 seconds cooldown
let lastPingTime = 0;
let lastPingResult = true;
let activePingPromise: Promise<boolean> | null = null;

export default function App() {
  monitor.trackRender('App');
  const ignoreRealtimeRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const lastSyncTimeRef = useRef<number>(0);
  const realtimeDebounceTimerRef = useRef<any>(null);

  // --- 1. KHỞI TẠO STATE CƠ SỞ DỮ LIỆU ĐỒNG BỘ LOCALSTATE (KHÔNG LƯU LOCALSTORAGE THEO YÊU CẦU BẢO MẬT) ---
  const sessionStartTimeRef = useRef<number>(Date.now());
  const sessionCreatedInvoiceIdsRef = useRef<Set<string>>(new Set());

  const [sanPhams, setSanPhams] = useState<SanPham[]>([]);
  const [nhapXuats, setNhapXuats] = useState<NhapXuat[]>([]);
  const [nhapXuatCTs, setNhapXuatCTs] = useState<NhapXuatCT[]>([]);
  const [kiemKhos, setKiemKhos] = useState<KiemKho[]>([]);
  const [thuongHieus, setThuongHieus] = useState<ThuongHieu[]>([]);
  const [chiNhanhs, setChiNhanhs] = useState<ChiNhanh[]>([]);
  const [nhanViens, setNhanViens] = useState<NhanVien[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  const [loadingDb, setLoadingDb] = useState<boolean>(false);

  // --- 2. QUẢN LÝ NGƯỜI DÙNG HIỆN TẠI & PHÂN QUYỀN CHẶT CHẼ ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('CURRENT_USER');
    return saved ? JSON.parse(saved) : null;
  });

  // --- 2B. QUẢN LÝ VAI TRÒ & QUYỀN HẠN (RBAC) ---
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!currentUser) return false;

    // Chuẩn hóa toàn bộ vai trò của user thành chữ in hoa
    const rawRoles = safeParseArray(currentUser.ROLES).length > 0 
      ? safeParseArray(currentUser.ROLES) 
      : (currentUser.role ? [currentUser.role] : []);
    const userRoles = rawRoles.map(r => String(r).trim().toUpperCase());

    // Nguồn quyền duy nhất: Thu thập toàn bộ permission từ các role của user trong db/state (hoặc DEFAULT_ROLES làm fallback)
    const userPermissions = new Set<string>();
    userRoles.forEach(roleCode => {
      const matchedRole = roles.find(r => r.ROLE_CODE.trim().toUpperCase() === roleCode)
        || DEFAULT_ROLES.find(r => r.ROLE_CODE.trim().toUpperCase() === roleCode);
      if (matchedRole && matchedRole.PERMISSIONS) {
        matchedRole.PERMISSIONS.forEach(p => userPermissions.add(p));
      } else {
        // Tương thích ngược: Đối sánh với vai trò mặc định nếu mã vai trò không khớp trực tiếp
        let fallbackRoleCode = roleCode;
        if (roleCode === 'KHO') fallbackRoleCode = 'MANAGER';
        if (roleCode === 'NHAN_VIEN') fallbackRoleCode = 'STAFF';

        const matchedFallback = roles.find(r => r.ROLE_CODE.trim().toUpperCase() === fallbackRoleCode) 
          || DEFAULT_ROLES.find(r => r.ROLE_CODE.trim().toUpperCase() === fallbackRoleCode);
        if (matchedFallback && matchedFallback.PERMISSIONS) {
          matchedFallback.PERMISSIONS.forEach(p => userPermissions.add(p));
        }
      }
    });

    // Hỗ trợ tương thích ngược cho sản phẩm (inventory.view / product.view)
    if (permissionCode === 'inventory.view' || permissionCode === 'product.view') {
      const hasL1 = userPermissions.has('product.view') || userPermissions.has('inventory.view');
      return hasL1;
    }

    // Kiểm tra cấu trúc phân quyền: Nếu là quyền cấp 2, bắt buộc phải có cả quyền cấp 1 tương ứng
    const parentCode = PERMISSION_PARENT_MAP[permissionCode];
    if (parentCode) {
      return userPermissions.has(parentCode) && userPermissions.has(permissionCode);
    }

    // Kiểm tra quyền cấp 1 trực tiếp
    return userPermissions.has(permissionCode);
  }, [currentUser, roles]);

  const handleLogout = async () => {
    if (currentUser) {
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_SEARCH`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_TYPE`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_SORT_BY`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_SORT_ORDER`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_GROUPED`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_BRANCH`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_WAREHOUSE`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_FROM_DATE`);
      localStorage.removeItem(`${currentUser.username}_HISTORY_FILTER_TO_DATE`);
    }
    setCurrentUser(null);
    localStorage.removeItem('CURRENT_USER');
    localStorage.removeItem('DB_OWNER_USER_ID');
    console.log("Đã đăng xuất người dùng trên giao diện. Giữ kết nối nền Supabase hoạt động.");
  };

  // --- TRẠNG THÁI KẾT NỐI ONLINE / OFFLINE CHẶT CHẼ ---
  const [isOffline, setIsOfflineState] = useState<boolean>(() => {
    const rawUrl = ((import.meta as any).env.VITE_SUPABASE_URL || "").trim();
    const rawKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!rawUrl || !rawKey) {
      return true;
    }
    if (typeof window !== 'undefined' && window.navigator) {
      return !window.navigator.onLine;
    }
    return false;
  });
  const isOfflineRef = useRef<boolean>(isOffline);
  const wasOfflineRef = useRef<boolean>(isOffline);
  const consecutiveFailuresRef = useRef<number>(0);

  const setIsOffline = (val: boolean) => {
    const prevVal = isOfflineRef.current;
    setIsOfflineState(val);
    isOfflineRef.current = val;
    setOfflineMode(val);

    if (prevVal !== val) {
      if (val) {
        setSuccessToast({
          message: "🔴 Mất kết nối máy chủ",
          type: "error",
          id: `status-offline-${Date.now()}`
        });
      } else {
        setSuccessToast({
          message: "🟢 Đã kết nối lại máy chủ",
          type: "success",
          id: `status-online-${Date.now()}`
        });
      }
    }
  };

  const pingSupabase = async (): Promise<boolean> => {
    const now = Date.now();
    if (now - lastPingTime < PING_COOLDOWN) {
      return lastPingResult;
    }
    if (activePingPromise) {
      return activePingPromise;
    }

    activePingPromise = (async () => {
      try {
        const rawUrl = (((import.meta as any).env.VITE_SUPABASE_URL || "") as string).trim().replace(/^['"]|['"]$/g, "");
        const cleanUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") : "";
        const anonKey = (((import.meta as any).env.VITE_SUPABASE_ANON_KEY || "") as string).trim().replace(/^['"]|['"]$/g, "");

        // Verification of URL and Key correctness
        if (!cleanUrl || !cleanUrl.startsWith('http') || !anonKey) {
          lastPingResult = false;
          lastPingTime = Date.now();
          return false;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

        try {
          // Sử dụng /auth/v1/health làm phép thử chính (yêu cầu gửi kèm apikey)
          const response = await fetch(`${cleanUrl}/auth/v1/health`, {
            method: "GET",
            signal: controller.signal,
            headers: {
              "apikey": anonKey,
              "Cache-Control": "no-cache"
            }
          });
          clearTimeout(timeoutId);
          
          if (response.ok || response.status === 200) {
            lastPingResult = true;
            lastPingTime = Date.now();
            return true;
          }
          throw new Error(`Ping failed with status ${response.status}`);
        } catch (authErr) {
          clearTimeout(timeoutId);
          
          const isDebug = typeof window !== 'undefined' && ((window as any).__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');
          if (isDebug) {
            console.warn("[Ping] Thử auth health không thành công, chuyển sang thử query bảng b_sanpham:", authErr);
          }
          
          const backupController = new AbortController();
          const backupTimeoutId = setTimeout(() => backupController.abort(), 3000);
          
          try {
            // Thử một câu truy vấn bảng thực tế (nhẹ nhất có thể) để xác nhận kết nối
            const backupResponse = await fetch(`${cleanUrl}/rest/v1/b_sanpham?select=id&limit=1`, {
              method: "GET",
              signal: backupController.signal,
              headers: {
                "apikey": anonKey,
                "Authorization": `Bearer ${anonKey}`,
                "Cache-Control": "no-cache"
              }
            });
            clearTimeout(backupTimeoutId);
            
            if (backupResponse.ok || backupResponse.status === 200) {
              lastPingResult = true;
              lastPingTime = Date.now();
              return true;
            }
            throw new Error(`Backup ping failed with status ${backupResponse.status}`);
          } catch (tableErr) {
            clearTimeout(backupTimeoutId);
            if (isDebug) {
              console.warn("[Ping] Cả 2 phương án kiểm tra kết nối đều thất bại:", tableErr);
            }
            lastPingResult = false;
            lastPingTime = Date.now();
            return false;
          }
        }
      } catch (err) {
        const isDebug = typeof window !== 'undefined' && ((window as any).__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');
        if (isDebug) {
          console.warn("Lỗi tổng quát trong pingSupabase:", err);
        }
        lastPingResult = false;
        lastPingTime = Date.now();
        return false;
      } finally {
        activePingPromise = null;
      }
    })();

    return activePingPromise;
  };

  const forceLogout = () => {
    console.warn("[Auth Guard] Bắt đầu xóa toàn bộ cache, session và thông tin đăng nhập...");
    localStorage.clear();
    sessionStorage.clear();
    setCurrentUser(null);
    setSuccessToast({
      message: "❌ Tài khoản của bạn không còn tồn tại hoặc đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
      type: "error",
      id: `force-logout-${Date.now()}`
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__forceLogout = forceLogout;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__forceLogout;
      }
    };
  }, []);

  const verifySession = async (): Promise<boolean> => {
    if (!currentUser) return true;

    if (isOfflineRef.current) {
      console.log("[Auth Guard] Máy đang ngoại tuyến, tạm bỏ qua xác thực phiên...");
      return true;
    }

    try {
      // Truy vấn tài khoản theo MA_NV (currentUser.id) từ b_nhanvien (hoặc TEN_DANG_NHAP)
      let { data: dbNhanViens, error } = await supabase
        .from('b_nhanvien')
        .select('*')
        .eq('MA_NV', currentUser.id);

      if (error) {
        console.warn("[Auth Guard] Lỗi truy vấn xác thực tài khoản:", error.message);
        return true;
      }

      let staffMember = dbNhanViens && dbNhanViens[0];

      if (!staffMember) {
        // Dự phòng tìm theo Tên đăng nhập nếu không khớp MA_NV
        const { data: fallbackStaffs } = await supabase
          .from('b_nhanvien')
          .select('*')
          .eq('TEN_DANG_NHAP', currentUser.username);
        
        if (fallbackStaffs && fallbackStaffs.length > 0) {
          staffMember = fallbackStaffs[0];
        }
      }
      
      if (!staffMember) {
        console.error(`[Auth Guard] Tài khoản không tồn tại trong b_nhanvien! Đăng xuất cưỡng chế.`);
        forceLogout();
        return false;
      }

      const role = (staffMember.ROLE || '').trim().toUpperCase();
      const rawStatus = (staffMember.TRANG_THAI || '').trim().toUpperCase();
      const isActive = staffMember.active === true;
      
      const isApprovedAdmin = role === 'ADMIN' && isActive && 
        (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

      const isPending = !isApprovedAdmin && (
        !isActive || 
        rawStatus === 'PENDING' || 
        rawStatus === 'CHỜ DUYỆT' || 
        rawStatus === 'CHO DUYET' || 
        role === 'PENDING'
      );

      if (isPending) {
        console.error(`[Auth Guard] Tài khoản ${currentUser.username} không hoạt động hoặc chưa duyệt! Đăng xuất cưỡng chế.`);
        forceLogout();
        return false;
      }

      const updatedUser: User = {
        username: staffMember.TEN_DANG_NHAP || staffMember.EMAIL || staffMember.HO_TEN,
        fullName: staffMember.HO_TEN,
        role: normalizeDbRole(staffMember.ROLE || staffMember.VAI_TRO || 'NHAN_VIEN'),
        branch: staffMember.CHI_NHANH || 'Kho Trung Tâm',
        writeAccess: staffMember.WRITE_ACCESS !== false,
        WRITE_ACCESS: staffMember.WRITE_ACCESS !== false,
        id: staffMember.MA_NV,
        user_id: staffMember.user_id,
        ROLES: staffMember.ROLES || []
      };

      if (
        currentUser.role !== updatedUser.role ||
        currentUser.branch !== updatedUser.branch ||
        currentUser.writeAccess !== updatedUser.writeAccess ||
        currentUser.user_id !== updatedUser.user_id
      ) {
        console.log("[Auth Guard] Cập nhật thông tin và quyền hạn của người dùng từ Supabase...");
        setCurrentUser(updatedUser);
        localStorage.setItem('CURRENT_USER', JSON.stringify(updatedUser));
      }

      return true;
    } catch (err) {
      console.warn("[Auth Guard] Có lỗi bất thường khi xác thực phiên:", err);
      return true;
    }
  };

  const ensureOnline = async (): Promise<boolean> => {
    // Nếu hệ thống đang trực tuyến, cho phép thao tác ngay lập tức không cần pre-ping chậm trễ
    if (!isOfflineRef.current) {
      return true;
    }

    // Nếu đang đánh dấu ngoại tuyến, kiểm tra nhanh xem đã có kết nối lại chưa để tránh khóa nhầm
    console.log("[Connection] Hệ thống đang ngoại tuyến. Đang ping thời gian thực để thử khôi phục kết nối...");
    const online = await pingSupabase();
    if (online) {
      console.log("[Connection] Khôi phục kết nối thành công qua kiểm tra trực tiếp! Resetting failures count. => SYSTEM GOING ONLINE");
      consecutiveFailuresRef.current = 0;
      setIsOffline(false);
      return true;
    }

    const isNetOffline = typeof window !== 'undefined' && window.navigator && !window.navigator.onLine;
    setSuccessToast({
      message: isNetOffline 
        ? "❌ Không có kết nối mạng. Vui lòng kiểm tra Internet và thử lại."
        : "❌ Không thể kết nối máy chủ. Chức năng này chỉ khả dụng khi trực tuyến.",
      type: "error",
      id: `offline-warn-${Date.now()}`
    });
    return false;
  };

  // Định kỳ kiểm tra kết nối Supabase thực tế mỗi 45 giây
  useEffect(() => {
    const isDebug = typeof window !== 'undefined' && ((window as any).__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');

    const checkConnection = async () => {
      const isNetOffline = typeof window !== 'undefined' && window.navigator && !window.navigator.onLine;
      if (isNetOffline) {
        if (consecutiveFailuresRef.current < 5) {
          consecutiveFailuresRef.current = 5;
          if (isDebug) {
            console.warn("[Health Check] Mất kết nối mạng thiết bị (navigator.onLine === false).");
            console.warn("Health Check #5 failed => OFFLINE");
          }
          setIsOffline(true);
        }
        return;
      }

      const online = await pingSupabase();
      if (online) {
        if (consecutiveFailuresRef.current > 0 || isOfflineRef.current) {
          if (isDebug) {
            console.log("[Health Check] Kết nối thành công! Đã xóa bộ đếm thất bại. => SYSTEM GOING ONLINE");
          }
        }
        consecutiveFailuresRef.current = 0;
        setIsOffline(false);
      } else {
        consecutiveFailuresRef.current += 1;
        if (isDebug) {
          console.warn(`Health Check #${consecutiveFailuresRef.current} failed`);
        }
        if (consecutiveFailuresRef.current >= 5) {
          if (!isOfflineRef.current) {
            if (isDebug) {
              console.error("=> OFFLINE (Lý do: Không thể truy cập Supabase Health Check sau 5 lần kiểm tra liên tiếp)");
            }
            setIsOffline(true);
          }
        }
      }
    };

    // Chạy kiểm tra ngay khi mount
    checkConnection();

    const interval = setInterval(checkConnection, 300000); // 5 phút

    const handleOnline = async () => {
      if (isDebug) {
        console.log("[Network Event] Thiết bị báo Online trở lại. Đang thực hiện kiểm tra kết nối Supabase...");
      }
      const online = await pingSupabase();
      if (online) {
        if (isDebug) {
          console.log("[Network Event] Kết nối Supabase thành công! Chuyển sang Trực tuyến.");
        }
        consecutiveFailuresRef.current = 0;
        setIsOffline(false);
      } else {
        consecutiveFailuresRef.current = 1;
        if (isDebug) {
          console.warn("Health Check #1 failed (Sau Network Event Online)");
        }
      }
    };

    const handleOffline = () => {
      if (isDebug) {
        console.warn("[Network Event] Thiết bị báo Ngoại tuyến (Mất mạng hoàn toàn). Chuyển sang chế độ Ngoại tuyến ngay.");
      }
      consecutiveFailuresRef.current = 5;
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Định kỳ mỗi 10 phút xác thực lại User với Supabase
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    // Chạy kiểm tra ngay khi có user (hoặc đổi user)
    verifySession();

    const checkActiveUserInterval = setInterval(async () => {
      console.log("[Auth Guard] Đang kiểm tra phiên đăng nhập của người dùng định kỳ...");
      await verifySession();
    }, 600000); // 10 phút

    return () => clearInterval(checkActiveUserInterval);
  }, [currentUser]);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handleManualSync = async () => {
    if (!currentUser || !currentUser.id) {
      setSuccessToast({ 
        message: "Vui lòng đăng nhập để đồng bộ!", 
        type: "warning", 
        id: `login-warn-${Date.now()}` 
      });
      return;
    }
    setIsSyncing(true);
    setOfflineMode(false);
    try {
      const activeOwnerId = currentUser.user_id || currentUser.id || '00000000-0000-0000-0000-000000000000';
      await syncAllDataFromSupabase(activeOwnerId, currentUser.username);
      setSuccessToast({ 
        message: "Đồng bộ dữ liệu trực tuyến thành công!", 
        type: "success", 
        id: `sync-success-${Date.now()}` 
      });
    } catch (err: any) {
      console.error("Lỗi đồng bộ thủ công:", err);
      setSuccessToast({
        message: `Đồng bộ thất bại: ${err?.message || "Lỗi không xác định"}`,
        type: "error",
        id: `sync-error-${Date.now()}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Background polling interval - Đã vô hiệu hóa việc định kỳ tải lại toàn bộ database để tiết kiệm egress/quota và tránh spam.
  // Mọi cập nhật sẽ được thực hiện tự động thông qua kênh Realtime gia tăng (Incremental) siêu nhẹ.
  useEffect(() => {
    const isDebug = typeof window !== 'undefined' && ((window as any).__DEBUG_MODE__ || localStorage.getItem('DEBUG_MODE') === 'true');
    if (isDebug) {
      console.log("[Sync] Định kỳ tải lại đã được tắt. Hệ thống chuyển sang cơ chế Realtime Incremental siêu nhẹ.");
    }
  }, [currentUser]);

  // Hàm tải dữ liệu chuyên biệt từ Supabase Cloud và gán đồng bộ vào State và LocalStorage
  const syncAllDataFromSupabase = async (userId: string, email: string, silent = false) => {
    if (isSyncingRef.current) {
      console.log('Đang có một tiến trình đồng bộ khác đang chạy. Bỏ qua yêu cầu đồng bộ trùng lặp.');
      return;
    }
    isSyncingRef.current = true;
    monitor.trackApiCall('syncAllDataFromSupabase');
    if (!silent) setLoadingDb(true);
    try {
      console.log('Bắt đầu đồng bộ dữ liệu mới nhất từ Supabase Cloud cho tài khoản:', email, silent ? '(âm thầm)' : '(hiện thị loading)');
      monitor.trackSupabaseQuery('all_tables', 'select_onboard');
      const payload = await ensureUserOnboarded(userId);
      const uniqueProducts = deduplicateProducts(payload.sanPhams);
      setSanPhams(uniqueProducts);

      // Tránh việc ghi đè làm mất các phiếu mới tạo cục bộ do độ trễ đồng bộ (replication lag) của database
      const dbNhapXuats = payload.nhapXuats || [];
      const dbNhapXuatCTs = payload.nhapXuatCTs || [];

      // Lấy danh sách phiếu hiện tại từ State
      const mergedNhapXuats = [...dbNhapXuats];
      const mergedNhapXuatCTs = [...dbNhapXuatCTs];

      // Định nghĩa ngưỡng thời gian cũ (quá 2 tiếng hoặc tạo trước khi phiên hiện tại bắt đầu)
      const isTooOld = (tgTaoStr?: string) => {
        if (!tgTaoStr) return true;
        try {
          const creationTime = new Date(tgTaoStr).getTime();
          const sessionTime = sessionStartTimeRef.current;
          return (sessionTime - creationTime) > 7200000 || creationTime < sessionTime;
        } catch {
          return true;
        }
      };

      nhapXuats.forEach(localNx => {
        if (localNx.HOA_DON && !localNx.HOA_DON.includes('_temp_')) {
          const exists = dbNhapXuats.some(dbNx => dbNx.HOA_DON === localNx.HOA_DON);
          if (!exists) {
            const isCreatedInCurrentSession = sessionCreatedInvoiceIdsRef.current.has(localNx.HOA_DON);
            const tooOld = isTooOld(localNx.TG_TAO);

            if (!isCreatedInCurrentSession && tooOld) {
              console.log(`[Sync] Bản ghi cũ phát hiện không tồn tại trên Supabase và có timestamp quá cũ, tự động loại bỏ khỏi hàng đợi đồng bộ: ${localNx.HOA_DON}`);
              return; // Loại bỏ, không giữ lại
            }

            console.log(`[Sync] Phát hiện phiếu mới tạo cục bộ chưa cập nhật kịp lên database, giữ lại: ${localNx.HOA_DON}`);
            mergedNhapXuats.push(localNx);

            // Gộp các chi tiết tương ứng
            const localDetails = nhapXuatCTs.filter(d => d.HOA_DON === localNx.HOA_DON);
            localDetails.forEach(localD => {
              const detailExists = dbNhapXuatCTs.some(dbD => dbD.HOA_DON === localD.HOA_DON && dbD.SKU === localD.SKU);
              if (!detailExists) {
                mergedNhapXuatCTs.push(localD);
              }
            });
          }
        }
      });

      setNhapXuats(mergedNhapXuats);
      setNhapXuatCTs(mergedNhapXuatCTs);
      setKiemKhos(payload.kiemKhos);
      setThuongHieus(payload.thuongHieus);
      setChiNhanhs(payload.chiNhanhs);
      setNhanViens(payload.nhanViens);
      if (payload.roles && payload.roles.length > 0) {
        setRoles(payload.roles);
      }

      // Tải và đồng bộ Nhật ký email gửi đi
      try {
        const logs = await fetchEmailLogs(userId);
        setEmailLogs(logs);
      } catch (mailErr) {
        console.warn("Lỗi tải lịch sử email log từ Supabase:", mailErr);
      }

      // CẬP NHẬT HOẶC BẢO TOÀN CURRENT_USER NỘI BỘ (Không để email Auth của Supabase ghi đè bừa bãi)
      const savedUserStr = localStorage.getItem('CURRENT_USER');
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser && savedUser.id) {
            // Thử tìm nhân viên này trong danh sách nhân viên vừa cập nhật để đồng bộ quyền và thông tin mới nhất
            const latestStaff = payload.nhanViens.find(n => 
              (n.MA_NV || '').trim().toLowerCase() === (savedUser.id || '').trim().toLowerCase() ||
              (n.TEN_DANG_NHAP || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase() ||
              (n.EMAIL || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase()
            );

            if (latestStaff) {
              if (latestStaff.user_id) {
                localStorage.setItem('DB_OWNER_USER_ID', latestStaff.user_id);
              }

              const u: User = {
                username: latestStaff.TEN_DANG_NHAP || latestStaff.EMAIL || latestStaff.HO_TEN,
                fullName: latestStaff.HO_TEN,
                role: normalizeDbRole(latestStaff.ROLE || latestStaff.VAI_TRO || 'NHAN_VIEN'),
                branch: latestStaff.CHI_NHANH || 'Kho Trung Tâm',
                writeAccess: latestStaff.WRITE_ACCESS !== false,
                WRITE_ACCESS: latestStaff.WRITE_ACCESS !== false,
                id: latestStaff.MA_NV,
                user_id: latestStaff.user_id,
                ROLES: latestStaff.ROLES || []
              };

              const role = (latestStaff.ROLE || '').trim().toUpperCase();
              const rawStatus = (latestStaff.TRANG_THAI || '').trim().toUpperCase();
              const isActive = latestStaff.active === true;
              
              const isApprovedAdmin = role === 'ADMIN' && isActive && 
                (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

              const isPending = !isApprovedAdmin && (
                !isActive || 
                rawStatus === 'PENDING' || 
                rawStatus === 'CHỜ DUYỆT' || 
                rawStatus === 'CHO DUYET' || 
                role === 'PENDING'
              );

              if (isPending) {
                console.error(`[Auth Guard] Tài khoản ${savedUser.username} ở trạng thái không hoạt động hoặc chờ duyệt! Tiến hành đăng xuất cưỡng chế.`);
                forceLogout();
                return;
              }

              setCurrentUser(u);
              localStorage.setItem('CURRENT_USER', JSON.stringify(u));
              return;
            } else {
              // Bỏ qua nếu là tài khoản cục bộ / local
              if (savedUser.user_id && savedUser.user_id.startsWith('LOCAL_')) {
                console.log("[Auth Guard] Bỏ qua forceLogout cho tài khoản nội bộ cục bộ.");
                return;
              }
              if (!(import.meta as any).env.VITE_SUPABASE_URL || !(import.meta as any).env.VITE_SUPABASE_ANON_KEY) {
                console.log("[Auth Guard] Bỏ qua forceLogout do chưa cấu hình Supabase.");
                return;
              }
              // Kiểm tra xem có trong danh sách cục bộ không để tránh ngắt quãng oan
              let localList: NhanVien[] = [];
              const localNhanViensStr = localStorage.getItem('B_NHANVIEN');
              if (localNhanViensStr) {
                try {
                  localList = JSON.parse(localNhanViensStr);
                } catch (e) {}
              }
              if (!localList || localList.length === 0) {
                localList = nhanViens || [];
              }
              if (!localList || localList.length === 0) {
                localList = (inMemoryCache['B_NHANVIEN'] as NhanVien[]) || [];
              }

              const foundLocal = localList.find(n => 
                (n.MA_NV || '').trim().toLowerCase() === (savedUser.id || '').trim().toLowerCase() ||
                (n.TEN_DANG_NHAP || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase() ||
                (n.EMAIL || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase()
              );
              if (foundLocal) {
                console.log("[Auth Guard] Tìm thấy tài khoản trong danh sách cục bộ, bỏ qua forceLogout.");
                return;
              }
              console.error(`[Auth Guard] Không tìm thấy tài khoản ${savedUser.username} (ID: ${savedUser.id}) trong b_nhanvien từ Supabase! Tiến hành đăng xuất cưỡng chế.`);
              forceLogout();
              return;
            }
          }
        } catch (e) {
          console.warn("Lỗi đồng bộ cấu hình user nội bộ:", e);
        }
      } else {
        // Nếu không có user nội bộ nào trong localStorage, tuyệt đối giữ nguyên trạng thái chưa đăng nhập trên giao diện
        console.log('Không tìm thấy CURRENT_USER lưu cục bộ. Giữ nguyên trạng thái chưa đăng nhập trên giao diện.');
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu từ Supabase Cloud:', err);
    } finally {
      isSyncingRef.current = false;
      lastSyncTimeRef.current = Date.now();
      if (!silent) setLoadingDb(false);
    }
  };

  // Tự động đồng bộ và nạp lại toàn bộ dữ liệu khi chuyển đổi từ ngoại tuyến sang trực tuyến (Không cần F5/Reload)
  useEffect(() => {
    if (!isOffline && wasOfflineRef.current) {
      console.log("Phát hiện có kết nối trở lại! Tự động đồng bộ mới nhất từ Supabase Cloud...");
      if (currentUser && currentUser.id) {
        const activeOwnerId = currentUser.user_id || currentUser.id || '00000000-0000-0000-0000-000000000000';
        syncAllDataFromSupabase(activeOwnerId, currentUser.username);
      }
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, currentUser]);

  // Quản lý Auth và Realtime đồng bộ hóa dữ liệu từ Supabase
  useEffect(() => {
    let realtimeChannel: any = null;
    let currentUserId: string | null = null;

    // Hàm cập nhật gia tăng các state cục bộ từ sự kiện realtime mà không tải lại toàn bộ database từ xa
    const handleIncrementalRealtimeUpdate = (payload: any) => {
      const { table, eventType, new: newRow, old: oldRow } = payload;
      if (!table) return;

      // Log chi tiết sự kiện nhận được cho xác nhận hệ thống
      console.log(`[REALTIME EVENT LOG - ${eventType}] Bảng: ${table}`, { newRow, oldRow });

      switch (table) {
        case 'b_sanpham': {
          if (eventType === 'DELETE') {
            const skuToDelete = oldRow?.SKU;
            if (skuToDelete) {
              console.log(`[REALTIME DELETE] Xóa sản phẩm SKU: ${skuToDelete}`);
              setSanPhams(prev => {
                const next = prev.filter(p => p.SKU !== skuToDelete);
                inMemoryCache['B_SANPHAM'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm sản phẩm SKU: ${newRow.SKU}`);
            const mappedItem: SanPham = {
              SKU: newRow.SKU,
              TEN_SAN_PHAM: newRow.TEN_SAN_PHAM,
              THUONG_HIEU: newRow.THUONG_HIEU,
              CHIET_XUAT: newRow.CHIET_XUAT,
              TINH_NANG: newRow.TINH_NANG,
              CAN: Number(newRow.CAN ?? 0),
              LOAN: Number(newRow.LOAN ?? 0),
              DVT: newRow.DVT,
              TON_DAU: Number(newRow.TON_DAU ?? 0),
              NHAP: Number(newRow.NHAP ?? 0),
              XUAT: Number(newRow.XUAT ?? 0),
              TON_CUOI: Number(newRow.TON_CUOI ?? 0),
              TON_TOI_THIEU: Number(newRow.TON_TOI_THIEU ?? 0)
            };
            setSanPhams(prev => {
              const index = prev.findIndex(p => p.SKU === mappedItem.SKU);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              next = deduplicateProducts(next);
              inMemoryCache['B_SANPHAM'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_nhapxuat': {
          if (eventType === 'DELETE') {
            const hoaDonToDelete = oldRow?.HOA_DON;
            if (hoaDonToDelete) {
              console.log(`[REALTIME DELETE] Xóa phiếu nhập xuất: ${hoaDonToDelete}`);
              setNhapXuats(prev => {
                const next = prev.filter(nx => nx.HOA_DON !== hoaDonToDelete);
                inMemoryCache['B_NHAPXUAT'] = next;
                return next;
              });
              // Tự động xóa sạch các chi tiết thuộc HOA_DON bị xóa
              setNhapXuatCTs(prev => {
                const next = prev.filter(d => d.HOA_DON !== hoaDonToDelete);
                inMemoryCache['B_NHAPXUATCT'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm phiếu nhập xuất: ${newRow.HOA_DON}`);
            const mappedItem: NhapXuat = {
              HOA_DON: newRow.HOA_DON,
              CHI_NHANH: newRow.CHI_NHANH,
              NGAY: newRow.NGAY,
              LOAI: newRow.LOAI,
              TONG_SL: Number(newRow.TONG_SL ?? 0),
              NGUOI_TAO: newRow.NGUOI_TAO,
              TEN_NGUOI_TAO: newRow.TEN_NGUOI_TAO,
              TG_TAO: newRow.TG_TAO,
              GHI_CHU: newRow.GHI_CHU || '',
              MA_NV: newRow.MA_NV || undefined,
              TEN_DANG_NHAP: newRow.TEN_DANG_NHAP || undefined,
              TRANG_THAI: newRow.TRANG_THAI || 'Hoàn tất'
            };
            setNhapXuats(prev => {
              const index = prev.findIndex(nx => nx.HOA_DON === mappedItem.HOA_DON);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_NHAPXUAT'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_nhapxuatct': {
          if (eventType === 'DELETE') {
            const idToDelete = oldRow?.id !== undefined ? oldRow.id : oldRow?.ID;
            if (idToDelete !== undefined) {
              console.log(`[REALTIME DELETE] Xóa chi tiết phiếu nhập xuất ID: ${idToDelete}`);
              setNhapXuatCTs(prev => {
                const next = prev.filter(d => d.ID !== idToDelete);
                inMemoryCache['B_NHAPXUATCT'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            const mappedId = newRow.id !== undefined ? newRow.id : newRow.ID;
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm chi tiết phiếu nhập xuất ID: ${mappedId}`);
            const mappedItem: NhapXuatCT = {
              ID: mappedId,
              HOA_DON: newRow.HOA_DON,
              SKU: newRow.SKU,
              TEN_SP: newRow.TEN_SP,
              THUONG_HIEU: newRow.THUONG_HIEU,
              CHIET_XUAT: newRow.CHIET_XUAT,
              TINH_NANG: newRow.TINH_NANG,
              SPH: Number(newRow.SPH ?? 0),
              CYL: Number(newRow.CYL ?? 0),
              SO_LUONG: Number(newRow.SO_LUONG ?? 0),
              DVT: newRow.DVT,
              GHI_CHU: newRow.GHI_CHU || '',
              LOAI: newRow.LOAI,
              NGAY: newRow.NGAY
            };
            setNhapXuatCTs(prev => {
              const index = prev.findIndex(d => d.ID === mappedItem.ID);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_NHAPXUATCT'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_kiemkho': {
          if (eventType === 'DELETE') {
            const keyMap = (oldRow?.MA_PHIEU || '') + '_' + (oldRow?.SKU || '');
            console.log(`[REALTIME DELETE] Xóa phiếu kiểm kho: ${keyMap}`);
            setKiemKhos(prev => {
              const next = prev.filter(kk => ((kk.MA_PHIEU || '') + '_' + (kk.SKU || '')) !== keyMap);
              inMemoryCache['B_KIEMKHO'] = next;
              return next;
            });
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm phiếu kiểm kho: ${newRow.MA_PHIEU}`);
            const mappedItem: KiemKho = {
              MA_PHIEU: newRow.MA_PHIEU,
              SKU: newRow.SKU,
              TON_HE_THONG: Number(newRow.TON_HE_THONG ?? 0),
              TON_THUC_TE: Number(newRow.TON_THUC_TE ?? 0),
              LECH: Number(newRow.LECH ?? 0),
              LOAI_BU: newRow.LOAI_BU,
              NGUOI_KIEM: newRow.NGUOI_KIEM,
              THOI_DIEM: newRow.THOI_DIEM
            };
            setKiemKhos(prev => {
              const keyMap = (mappedItem.MA_PHIEU || '') + '_' + (mappedItem.SKU || '');
              const index = prev.findIndex(kk => ((kk.MA_PHIEU || '') + '_' + (kk.SKU || '')) === keyMap);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_KIEMKHO'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_thuonghieu': {
          if (eventType === 'DELETE') {
            const brandToDelete = oldRow?.THUONG_HIEU;
            if (brandToDelete) {
              console.log(`[REALTIME DELETE] Xóa thương hiệu: ${brandToDelete}`);
              setThuongHieus(prev => {
                const next = prev.filter(th => th.THUONG_HIEU !== brandToDelete);
                inMemoryCache['B_THUONGHIEU'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm thương hiệu: ${newRow.THUONG_HIEU}`);
            const mappedItem: ThuongHieu = {
              THUONG_HIEU: newRow.THUONG_HIEU,
              CHIET_XUAT_MAC_DINH: newRow.CHIET_XUAT_MAC_DINH,
              TINH_NANG_MAC_DINH: newRow.TINH_NANG_MAC_DINH,
              TINH_NANG: newRow.TINH_NANG_MAC_DINH || '',
              SPH_TU: newRow.SPH_TU !== null && newRow.SPH_TU !== undefined ? Number(newRow.SPH_TU) : undefined,
              SPH_DEN: newRow.SPH_DEN !== null && newRow.SPH_DEN !== undefined ? Number(newRow.SPH_DEN) : undefined,
              SPH_VIEN_TU: newRow.SPH_VIEN_TU !== null && newRow.SPH_VIEN_TU !== undefined ? Number(newRow.SPH_VIEN_TU) : undefined,
              SPH_VIEN_DEN: newRow.SPH_VIEN_DEN !== null && newRow.SPH_VIEN_DEN !== undefined ? Number(newRow.SPH_VIEN_DEN) : undefined,
              BUOC_NHAY: newRow.BUOC_NHAY !== null && newRow.BUOC_NHAY !== undefined ? Number(newRow.BUOC_NHAY) : undefined
            };
            setThuongHieus(prev => {
              const index = prev.findIndex(th => th.THUONG_HIEU === mappedItem.THUONG_HIEU);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_THUONGHIEU'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_chinhanh': {
          if (eventType === 'DELETE') {
            const branchToDelete = oldRow?.CHI_NHANH;
            if (branchToDelete) {
              console.log(`[REALTIME DELETE] Xóa chi nhánh: ${branchToDelete}`);
              setChiNhanhs(prev => {
                const next = prev.filter(cn => cn.CHI_NHANH !== branchToDelete);
                inMemoryCache['B_CHINHANH'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm chi nhánh: ${newRow.CHI_NHANH}`);
            const mappedItem: ChiNhanh = {
              CHI_NHANH: newRow.CHI_NHANH,
              DIA_CHI: newRow.DIA_CHI,
              SDT: newRow.SDT
            };
            setChiNhanhs(prev => {
              const index = prev.findIndex(cn => cn.CHI_NHANH === mappedItem.CHI_NHANH);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_CHINHANH'] = next;
              return next;
            });
          }
          break;
        }

        case 'b_nhanvien': {
          if (eventType === 'DELETE') {
            const staffToDelete = oldRow?.MA_NV;
            if (staffToDelete) {
              console.log(`[REALTIME DELETE] Xóa nhân viên: ${staffToDelete}`);
              setNhanViens(prev => {
                const next = prev.filter(nv => nv.MA_NV !== staffToDelete);
                inMemoryCache['B_NHANVIEN'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm nhân viên: ${newRow.MA_NV}`);
            const mappedItem: NhanVien = {
              MA_NV: newRow.MA_NV,
              HO_TEN: newRow.HO_TEN,
              CHUC_VU: newRow.CHUC_VU,
              BO_PHAN: newRow.BO_PHAN,
              CHI_NHANH: newRow.CHI_NHANH,
              EMAIL: newRow.EMAIL,
              ROLE: newRow.ROLE,
              PERMISSIONS: safeParseArray(newRow.PERMISSIONS),
              WRITE_ACCESS: newRow.WRITE_ACCESS ?? false,
              TEN_DANG_NHAP: newRow.TEN_DANG_NHAP || '',
              MAT_KHAU: newRow.MAT_KHAU || '',
              TRANG_THAI: newRow.TRANG_THAI || 'Hoạt động',
              YEU_CAU_RESET: newRow.YEU_CAU_RESET || false,
              NGAY_DANG_KY: newRow.NGAY_DANG_KY || '',
              ROLES: safeParseArray(newRow.ROLES),
              user_id: newRow.user_id,
              active: newRow.active !== false
            };
            setNhanViens(prev => {
              const index = prev.findIndex(nv => nv.MA_NV === mappedItem.MA_NV);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_NHANVIEN'] = next;
              return next;
            });

            // Cập nhật thông tin CURRENT_USER nếu khớp tài khoản đang đăng nhập
            const savedUserStr = localStorage.getItem('CURRENT_USER');
            if (savedUserStr) {
              try {
                const savedUser = JSON.parse(savedUserStr);
                if (savedUser && savedUser.id) {
                  const matchesCurrentUser = 
                    (mappedItem.MA_NV || '').trim().toLowerCase() === (savedUser.id || '').trim().toLowerCase() ||
                    (mappedItem.TEN_DANG_NHAP || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase() ||
                    (mappedItem.EMAIL || '').trim().toLowerCase() === (savedUser.username || '').trim().toLowerCase();
                  
                  if (matchesCurrentUser) {
                    if (mappedItem.user_id) {
                      localStorage.setItem('DB_OWNER_USER_ID', mappedItem.user_id);
                    }
                    const u: User = {
                      username: mappedItem.TEN_DANG_NHAP || mappedItem.EMAIL || mappedItem.HO_TEN,
                      fullName: mappedItem.HO_TEN,
                      role: normalizeDbRole(mappedItem.ROLE || 'NHAN_VIEN'),
                      branch: mappedItem.CHI_NHANH || 'Kho Trung Tâm',
                      writeAccess: mappedItem.WRITE_ACCESS !== false,
                      WRITE_ACCESS: mappedItem.WRITE_ACCESS !== false,
                      id: mappedItem.MA_NV,
                      user_id: mappedItem.user_id,
                      ROLES: mappedItem.ROLES || []
                    };
                    const rawStatus = (mappedItem.TRANG_THAI || '').trim().toUpperCase();
                    const isBlocked = rawStatus === 'BLOCKED' || rawStatus === 'KHÓA' || rawStatus === 'KHOA';
                    if (isBlocked) {
                      handleLogout();
                    } else {
                      setCurrentUser(u);
                      localStorage.setItem('CURRENT_USER', JSON.stringify(u));
                    }
                  }
                }
              } catch (e) {}
            }
          }
          break;
        }

        case 'b_emaillog': {
          if (eventType === 'DELETE') {
            const idToDelete = oldRow?.id;
            if (idToDelete) {
              console.log(`[REALTIME DELETE] Xóa email log: ${idToDelete}`);
              setEmailLogs(prev => {
                const next = prev.filter(el => el.id !== idToDelete);
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm email log: ${newRow.id}`);
            const mappedItem: EmailLog = {
              id: newRow.id,
              EMAIL: newRow.EMAIL,
              TIEU_DE: newRow.TIEU_DE,
              NOI_DUNG: newRow.NOI_DUNG,
              NGAY_GUI: newRow.NGAY_GUI,
              TRANG_THAI: newRow.TRANG_THAI || 'Thành công',
              LOAI_EMAIL: newRow.LOAI_EMAIL
            };
            setEmailLogs(prev => {
              const index = prev.findIndex(el => el.id === mappedItem.id);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              return next;
            });
          }
          break;
        }

        case 'b_role': {
          if (eventType === 'DELETE') {
            const roleToDelete = oldRow?.ROLE_CODE;
            if (roleToDelete) {
              console.log(`[REALTIME DELETE] Xóa role: ${roleToDelete}`);
              setRoles(prev => {
                const next = prev.filter(r => r.ROLE_CODE !== roleToDelete);
                inMemoryCache['B_ROLE'] = next;
                return next;
              });
            }
          } else if (newRow) {
            // INSERT or UPDATE
            console.log(`[REALTIME ${eventType}] Cập nhật/Thêm role: ${newRow.ROLE_CODE}`);
            const mappedItem: Role = {
              ROLE_CODE: newRow.ROLE_CODE,
              TEN_ROLE: newRow.TEN_ROLE,
              PERMISSIONS: safeParseArray(newRow.PERMISSIONS)
            };
            setRoles(prev => {
              const index = prev.findIndex(r => r.ROLE_CODE === mappedItem.ROLE_CODE);
              let next;
              if (index !== -1) {
                next = [...prev];
                next[index] = mappedItem;
              } else {
                next = [mappedItem, ...prev];
              }
              inMemoryCache['B_ROLE'] = next;
              return next;
            });
          }
          break;
        }
      }
    };

    // Hàm thiết lập kênh Realtime lắng nghe mọi thay đổi trên Supabase
    const setupRealtime = (userId: string) => {
      if (realtimeChannel) {
        console.log('Đang hủy và gỡ bỏ kênh Realtime cũ...');
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }

      console.log('Đang thiết lập kênh Supabase Realtime cho User ID:', userId);
      // Sử dụng tên kênh độc nhất kèm theo chuỗi ngẫu nhiên để tránh lỗi xung đột kênh cũ
      const channelName = `realtime-sync-${userId}-${Math.random().toString(36).substring(2, 8)}`;
      monitor.trackSubscription(channelName);
      
      realtimeChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          async (payload: any) => {
            monitor.trackSupabaseQuery(payload.table || 'unknown_table', 'realtime_event');
            
            const eventType = payload.eventType;
            const isDelete = eventType === 'DELETE';
            
            // Lấy user_id từ dữ liệu thay đổi
            const newRow = payload.new;
            const oldRow = payload.old;
            const rowUserId = (newRow && newRow.user_id) || (oldRow && oldRow.user_id);

            // Log chi tiết sự kiện nhận được
            console.log(`[REALTIME LOG] Nhận sự kiện ${eventType} trên bảng ${payload.table}:`, payload);

            // Nếu là sự kiện DELETE (không có user_id trong oldRow) hoặc dữ liệu thuộc về user hiện tại/Owner
            const ownerId = localStorage.getItem('DB_OWNER_USER_ID') || userId;
            if (isDelete || rowUserId === userId || rowUserId === ownerId || rowUserId === '00000000-0000-0000-0000-000000000000') {
              if (ignoreRealtimeRef.current) {
                console.log(`[REALTIME LOG] Đang bỏ qua sự kiện ${eventType} do cờ ignoreRealtime của tab hiện tại...`);
                return;
              }
              
              console.log(`[REALTIME LOG] Chấp nhận và xử lý sự kiện ${eventType} trên bảng ${payload.table}`);
              // Cập nhật gia tăng (Incremental update) tại chỗ, không reload lại toàn bộ dữ liệu từ xa
              handleIncrementalRealtimeUpdate(payload);
            } else {
              console.log(`[REALTIME LOG] Bỏ qua sự kiện ${eventType} trên bảng ${payload.table} vì không trùng user_id (rowUserId: ${rowUserId}, userId: ${userId}, ownerId: ${ownerId})`);
            }
          }
        )
        .subscribe((status) => {
          console.log(`Trạng thái kênh Supabase Realtime [${userId}]:`, status);
        });
    };

    // 1. Kiểm tra session ngay khi trang web khởi chạy và tự động tải dữ liệu
    const initializeAuth = async () => {
      try {
        const savedUserStr = localStorage.getItem('CURRENT_USER');
        if (savedUserStr) {
          const savedUser = JSON.parse(savedUserStr);
          const userId = savedUser.user_id || savedUser.id;
          const email = savedUser.username || '';

          if (userId) {
            // Kiểm tra tính hợp lệ của nhân sự trong b_nhanvien bằng MA_NV
            let { data: dbNhanViens, error } = await supabase
              .from('b_nhanvien')
              .select('*')
              .eq('MA_NV', savedUser.id);

            let staffMember = dbNhanViens && dbNhanViens[0];

            if (!staffMember) {
              console.warn('[Auth Guard] Không tìm thấy bản ghi nhân viên tương ứng. Đăng xuất.');
              setCurrentUser(null);
              localStorage.removeItem('CURRENT_USER');
              return;
            }

            const role = (staffMember.ROLE || '').trim().toUpperCase();
            const rawStatus = (staffMember.TRANG_THAI || '').trim().toUpperCase();
            const isActive = staffMember.active === true;
            
            const isApprovedAdmin = role === 'ADMIN' && isActive && 
              (rawStatus === 'ACTIVE' || rawStatus === 'HOẠT ĐỘNG' || rawStatus === 'KÍCH HOẠT' || rawStatus === 'HOAT DONG');

            const isPending = !isApprovedAdmin && (
              !isActive || 
              rawStatus === 'PENDING' || 
              rawStatus === 'CHỜ DUYỆT' || 
              rawStatus === 'CHO DUYET' || 
              role === 'PENDING'
            );

            if (isPending) {
              console.warn('[Auth Guard] Tài khoản chờ duyệt hoặc không hoạt động. Đăng xuất.');
              setCurrentUser(null);
              localStorage.removeItem('CURRENT_USER');
              return;
            }

            currentUserId = userId;
            console.log('Phát hiện session hợp lệ khi khởi chạy. Thực hiện tải dữ liệu mới nhất từ Supabase Cloud...');
            syncAllDataFromSupabase(userId, email);
            setupRealtime(userId);
          }
        } else {
          console.log('Không phát hiện session hoạt động. Khôi phục trạng thái về màn hình đăng nhập...');
          setCurrentUser(null);
          localStorage.removeItem('CURRENT_USER');
        }
      } catch (e) {
        console.error("Lỗi trong quá trình khởi tạo Auth:", e);
      }
    };

    initializeAuth();

    // 2. Không cần lắng nghe onAuthStateChange vì Auth đã chuyển hoàn toàn sang b_nhanvien trực tiếp.

    return () => {
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);


  // --- 3. ĐIỀU HƯỚNG TAB CHỨC NĂNG ---
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [historyFiltersOverride, setHistoryFiltersOverride] = useState<{
    historyTypeFilter: 'Tất cả' | 'NHẬP' | 'XUẤT' | 'KIỂM KHO' | 'NHẬP_KIEM_KHO' | 'XUAT_KIEM_KHO';
    branchFilter: string;
    fromDate: string;
    toDate: string;
  } | null>(null);

  // Tự động chuyển đổi activeTab khi phân quyền thay đổi để tránh màn hình trắng
  useEffect(() => {
    if (!currentUser) return;
    
    // Kiểm tra xem tab hiện tại có được phép truy cập không
    let isAllowed = false;
    if (activeTab === 'DASHBOARD') isAllowed = hasPermission('dashboard.view');
    else if (activeTab === 'ORDER_PARSER') isAllowed = hasPermission('ordercheck.view');
    else if (activeTab === 'TRANSACTION_XUAT') isAllowed = hasPermission('picking_xuat.view');
    else if (activeTab === 'TRANSACTION_NHAP') isAllowed = hasPermission('picking_nhap.view');
    else if (activeTab === 'PRODUCT') isAllowed = hasPermission('product.view') || hasPermission('inventory.view');
    else if (activeTab === 'MATRIX') isAllowed = hasPermission('matrix.view');
    else if (activeTab === 'AUDIT') isAllowed = hasPermission('stocktake.view');
    else if (activeTab === 'HISTORY') isAllowed = hasPermission('history.view');
    else if (activeTab === 'CATEGORY') isAllowed = hasPermission('employee.view') || hasPermission('role.view') || hasPermission('product.view') || hasPermission('inventory.view');
    else if (activeTab === 'SETTINGS') isAllowed = hasPermission('settings.view');

    if (!isAllowed) {
      // Tìm tab đầu tiên được phép truy cập
      const allowedTabs = [
        { id: 'DASHBOARD', isAllowed: hasPermission('dashboard.view') },
        { id: 'ORDER_PARSER', isAllowed: hasPermission('ordercheck.view') },
        { id: 'TRANSACTION_XUAT', isAllowed: hasPermission('picking_xuat.view') },
        { id: 'TRANSACTION_NHAP', isAllowed: hasPermission('picking_nhap.view') },
        { id: 'PRODUCT', isAllowed: hasPermission('product.view') || hasPermission('inventory.view') },
        { id: 'MATRIX', isAllowed: hasPermission('matrix.view') },
        { id: 'AUDIT', isAllowed: hasPermission('stocktake.view') },
        { id: 'HISTORY', isAllowed: hasPermission('history.view') },
        { id: 'CATEGORY', isAllowed: hasPermission('employee.view') || hasPermission('role.view') || hasPermission('product.view') || hasPermission('inventory.view') },
        { id: 'SETTINGS', isAllowed: hasPermission('settings.view') }
      ];
      
      const firstAllowed = allowedTabs.find(t => t.isAllowed);
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
    }
  }, [currentUser, hasPermission, activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__activeTab = activeTab;
    }
  }, [activeTab]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<{ 
    message: string; 
    type?: 'success' | 'warning' | 'error';
    id?: string;
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [prefilledSku, setPrefilledSku] = useState<string | null>(null);
  const [prefilledCartItems, setPrefilledCartItems] = useState<{ sku: string; soLuong: number; }[] | null>(null);
  const [prefilledGomDonId, setPrefilledGomDonId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      const saved = localStorage.getItem(`sidebar_collapsed_pref_${currentUser.username}`);
      setSidebarCollapsed(saved === 'true');
    }
  }, [currentUser]);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      if (currentUser) {
        localStorage.setItem(`sidebar_collapsed_pref_${currentUser.username}`, String(next));
      }
      return next;
    });
  };

  // --- THIẾT LẬP GIAO DIỆN LIGHT/DARK & ACCENT COLOR THEO TỪNG USER ---
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColor] = useState<'blue' | 'green' | 'orange' | 'red' | 'purple'>('red');

  useEffect(() => {
    if (currentUser) {
      const savedTheme = localStorage.getItem(`theme_pref_${currentUser.username}`);
      const savedAccent = localStorage.getItem(`accent_pref_${currentUser.username}`);
      setThemeMode((savedTheme as 'light' | 'dark') || 'light');
      setAccentColor((savedAccent as 'blue' | 'green' | 'orange' | 'red' | 'purple') || 'red');
    } else {
      setThemeMode('light');
      setAccentColor('red');
    }
  }, [currentUser]);

  const handleUpdateTheme = (theme: 'light' | 'dark', accent: 'blue' | 'green' | 'orange' | 'red' | 'purple') => {
    setThemeMode(theme);
    setAccentColor(accent);
    if (currentUser) {
      localStorage.setItem(`theme_pref_${currentUser.username}`, theme);
      localStorage.setItem(`accent_pref_${currentUser.username}`, accent);
    }
  };

  const accentHex = useMemo(() => {
    switch (accentColor) {
      case 'blue': return '#2563eb';
      case 'green': return '#10b981';
      case 'orange': return '#f97316';
      case 'red': return '#dc2626';
      case 'purple': return '#8b5cf6';
      default: return '#dc2626';
    }
  }, [accentColor]);

  const activeButtonClass = useMemo(() => {
    switch (accentColor) {
      case 'blue': return 'bg-blue-600 text-white shadow-md shadow-blue-500/15';
      case 'green': return 'bg-emerald-600 text-white shadow-md shadow-emerald-500/15';
      case 'orange': return 'bg-orange-600 text-white shadow-md shadow-orange-500/15';
      case 'red': return 'bg-red-600 text-white shadow-md shadow-red-500/15';
      case 'purple': return 'bg-violet-600 text-white shadow-md shadow-violet-500/15';
      default: return 'bg-red-600 text-white shadow-md shadow-red-500/15';
    }
  }, [accentColor]);

  const sidebarStyle = useMemo(() => {
    if (themeMode === 'light') {
      return {
        bg: 'bg-white border-slate-200 text-slate-800',
        logoText: 'text-slate-900',
        subText: 'text-slate-500',
        userBox: 'bg-slate-50 border-slate-200',
        userText: 'text-slate-900',
        userSub: 'text-slate-500',
        border: 'border-slate-200',
        navDefault: 'text-slate-600 hover:text-slate-950 hover:bg-slate-50',
        switchBox: 'bg-slate-50 border-slate-200/80',
        switchText: 'text-slate-500',
        switchSelect: 'bg-white border-slate-200 text-slate-700',
        divider: 'bg-slate-200/80',
        logoutBorder: 'border-slate-200'
      };
    } else {
      return {
        bg: 'bg-[#111827] border-slate-800 text-slate-100',
        logoText: 'text-slate-100',
        subText: 'text-slate-400',
        userBox: 'bg-slate-800/40 border-slate-800',
        userText: 'text-slate-100',
        userSub: 'text-blue-400',
        border: 'border-slate-800',
        navDefault: 'text-slate-400 hover:text-white hover:bg-slate-800/40',
        switchBox: 'bg-slate-900/40 border-slate-800/60',
        switchText: 'text-slate-400',
        switchSelect: 'bg-slate-950 border-slate-800 text-slate-300',
        divider: 'bg-slate-800/80',
        logoutBorder: 'border-slate-800'
      };
    }
  }, [themeMode]);

  // Tự động tắt Toast theo loại (Thành công: 1 giây, Cảnh báo/Lỗi: 2 giây)
  useEffect(() => {
    if (successToast) {
      const duration = successToast.type === 'success' ? 1000 : 2000;
      const timer = setTimeout(() => {
        setSuccessToast(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  const selectTabOnMobile = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  // --- 4. CẢNH BÁO SẢN PHẨM SẮP HẾT HÀNG (DƯỚI TỒN TỐI THIỂU) ---
  const lowStockAlerts = useMemo(() => {
    return sanPhams.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU);
  }, [sanPhams]);

  const [showNotificationBanner, setShowNotificationBanner] = useState<boolean>(true);

  interface SyncError {
    table: string;
    action: string;
    message: string;
  }
  const [syncError, setSyncError] = useState<SyncError | null>(null);

  // Trợ lý lấy User ID bảo mật chống clock-skew (F5 & JWT issued at future)
  const getUserId = async (): Promise<string | null> => {
    if (currentUser?.user_id) return currentUser.user_id;
    if (currentUser?.id) return currentUser.id;
    
    const savedUserStr = localStorage.getItem('CURRENT_USER');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.user_id || savedUser.id || null;
      } catch {}
    }
    return null;
  };

  const reloadRoles = async () => {
    try {
      const uId = await getUserId();
      if (!uId) return;
      const { data, error } = await supabase
        .from('b_role')
        .select('*')
        .eq('user_id', uId);
      if (error) throw error;
      if (data) {
        const parsedRoles = data.map((item: any) => ({
          ROLE_CODE: item.ROLE_CODE,
          TEN_ROLE: item.TEN_ROLE,
          PERMISSIONS: safeParseArray(item.PERMISSIONS)
        }));
        setRoles(parsedRoles);
        localStorage.setItem('B_ROLE', JSON.stringify(parsedRoles));
        console.log("Đã tải lại danh sách vai trò từ Supabase thành công:", parsedRoles);
      }
    } catch (err) {
      console.error("Lỗi tải lại danh sách vai trò từ Supabase:", err);
    }
  };

  // --- 5. HÀM THAO TÁC NGHIỆP VỤ (VỚI COMMENT SÂU SẮC NHƯ LÃO TƯỚNG 30 NĂM TUỔI NGHỀ) ---

  /**
   * Nghiệp vụ Thêm sản phẩm tròng kính mới vào danh mục
   */
  const handleAddProduct = async (newProduct: SanPham) => {
    if (!(await ensureOnline())) return;
    setSanPhams(prev => [...prev, newProduct]);

    // Đồng bộ Supabase
    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await syncSanPham(newProduct, uId);
          if (res.error) {
            setSyncError({
              table: 'b_sanpham',
              action: 'Thêm sản phẩm',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync sản phẩm:', err);
        setSyncError({
          table: 'b_sanpham',
          action: 'Thêm sản phẩm',
          message: err.message || JSON.stringify(err)
        });
      }
    }
    setSuccessToast({ 
      message: `Đã thêm thành công sản phẩm tròng kính: ${newProduct.SKU}`, 
      type: "success", 
      id: `add-prod-${newProduct.SKU}-${Date.now()}` 
    });
  };

  /**
   * Nghiệp vụ Cập nhật thông tin sản phẩm tròng kính
   */
  const handleUpdateProduct = async (sku: string, updatedFields: Partial<SanPham>) => {
    if (!(await ensureOnline())) return;
    const normSku = cleanSKU(sku);
    
    // Tìm sản phẩm hiện có
    const productInState = sanPhams.find(p => cleanSKU(p.SKU) === normSku);
    if (!productInState) {
      console.warn(`[handleUpdateProduct] Không tìm thấy sản phẩm với SKU: ${sku}`);
      return;
    }
    
    const finalProduct = { ...productInState, ...updatedFields };

    // Cập nhật State cục bộ
    setSanPhams(prev => prev.map(p => {
      if (cleanSKU(p.SKU) === normSku) {
        return finalProduct;
      }
      return p;
    }));

    // Đồng bộ Supabase
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await syncSanPham(finalProduct, uId);
          if (res.error) {
            setSyncError({
              table: 'b_sanpham',
              action: 'Cập nhật sản phẩm',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật sản phẩm:', err);
        setSyncError({
          table: 'b_sanpham',
          action: 'Cập nhật sản phẩm',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 1500);
      }
    }
    setSuccessToast({ 
      message: `Đã cập nhật thành công sản phẩm: ${sku}`, 
      type: "success", 
      id: `update-prod-${sku}-${Date.now()}` 
    });
  };

  /**
   * Cập nhật thông tin ô tròng kính trực tiếp từ Ma trận độ:
   * 1. Lưu trực tiếp Tồn tối thiểu vào Sản phẩm
   * 2. Nếu Tồn thực tế khác Tồn hệ thống:
   *    - Tự động sinh phiếu kiểm kho bù trừ (PKKxxxxx)
   *    - Thiếu hàng -> Tạo PXKxxxxx điều chỉnh xuất
   *    - Thừa hàng -> Tạo PNKxxxxx điều chỉnh nhập
   *    - Tái tính toán tồn kho sản phẩm ngay lập tức
   * 3. Đồng bộ dữ liệu với Sản phẩm, Kiểm kê kho, và Nhập/Xuất
   */
  const handleUpdateMatrixCell = async (
    sku: string,
    newTonToiThieu: number,
    newTonThucTe: number,
    currentSystemTon: number,
    branchName: string,
    brand?: string,
    feature?: string,
    chietXuat?: string,
    sph?: number,
    cyl?: number
  ) => {
    if (!(await ensureOnline())) return;
    // 1. Xác định lệch
    const lech = newTonThucTe - currentSystemTon;
    const timeNow = getVietnamDateTimeString();
    const dateNow = getVietnamDateString();

    // 2. Tạo bản cập nhật sản phẩm trước
    const normSku = cleanSKU(sku);
    let updatedProducts = sanPhams.map(p => {
      let isMatch = false;
      if (brand !== undefined && feature !== undefined && chietXuat !== undefined && sph !== undefined && cyl !== undefined) {
        isMatch = 
          p.THUONG_HIEU.trim().toLowerCase() === brand.trim().toLowerCase() &&
          p.TINH_NANG.trim().toLowerCase() === feature.trim().toLowerCase() &&
          compareChietXuat(p.CHIET_XUAT, chietXuat) &&
          Math.abs(p.CAN - sph) < 0.001 &&
          Math.abs(p.LOAN - cyl) < 0.001 &&
          cleanSKU(p.SKU) === normSku;
      } else {
        isMatch = cleanSKU(p.SKU) === normSku;
      }

      if (isMatch) {
        return {
          ...p,
          TON_TOI_THIEU: newTonToiThieu
        };
      }
      return p;
    });

    let newKiemKhos = [...kiemKhos];
    let newHeaders = [...nhapXuats];
    let newDetails = [...nhapXuatCTs];
    
    let createdAudit: KiemKho | null = null;
    let createdAdjHeader: NhapXuat | null = null;
    let createdAdjDetail: NhapXuatCT | null = null;

    if (lech !== 0) {
      // Sinh mã PKK tự động
      let maxPKKNum = 0;
      kiemKhos.forEach(k => {
        if (k.MA_PHIEU.startsWith('PKK')) {
          const numPart = parseInt(k.MA_PHIEU.substring(3), 10);
          if (!isNaN(numPart) && numPart > maxPKKNum) {
            maxPKKNum = numPart;
          }
        }
      });
      const newAuditId = `PKK${String(maxPKKNum + 1).padStart(6, '0')}`;

      createdAudit = {
        MA_PHIEU: newAuditId,
        SKU: sku,
        TON_HE_THONG: currentSystemTon,
        TON_THUC_TE: newTonThucTe,
        LECH: lech,
        LOAI_BU: lech > 0 ? 'NHẬP BÙ' : 'XUẤT BÙ',
        NGUOI_KIEM: currentUser?.username || 'admin',
        THOI_DIEM: timeNow,
        KHO: branchName || currentUser?.branch || 'Kho Trung Tâm',
        MA_NV: currentUser?.id,
        TEN_DANG_NHAP: currentUser?.username
      };

      // Tự động sinh phiếu điều chỉnh kho liên kết (PNK hoặc PXK)
      const isPositive = lech > 0;
      let maxPNKNum = 0;
      let maxPXKNum = 0;
      nhapXuats.forEach(h => {
        if (h.HOA_DON.startsWith('PNK')) {
          const numPart = parseInt(h.HOA_DON.substring(3), 10);
          if (!isNaN(numPart) && numPart > maxPNKNum) {
            maxPNKNum = numPart;
          }
        } else if (h.HOA_DON.startsWith('PXK')) {
          const numPart = parseInt(h.HOA_DON.substring(3), 10);
          if (!isNaN(numPart) && numPart > maxPXKNum) {
            maxPXKNum = numPart;
          }
        }
      });

      let newAdjInvoiceId = '';
      if (isPositive) {
        newAdjInvoiceId = `PNK${String(maxPNKNum + 1).padStart(6, '0')}`;
      } else {
        newAdjInvoiceId = `PXK${String(maxPXKNum + 1).padStart(6, '0')}`;
      }

      const matchedP = updatedProducts.find(p => {
        if (brand !== undefined && feature !== undefined && chietXuat !== undefined && sph !== undefined && cyl !== undefined) {
          return (
            p.THUONG_HIEU.trim().toLowerCase() === brand.trim().toLowerCase() &&
            p.TINH_NANG.trim().toLowerCase() === feature.trim().toLowerCase() &&
            compareChietXuat(p.CHIET_XUAT, chietXuat) &&
            Math.abs(p.CAN - sph) < 0.001 &&
            Math.abs(p.LOAN - cyl) < 0.001 &&
            cleanSKU(p.SKU) === normSku
          );
        }
        return cleanSKU(p.SKU) === normSku;
      });

      if (matchedP) {
        createdAdjHeader = {
          HOA_DON: newAdjInvoiceId,
          CHI_NHANH: branchName || currentUser?.branch || 'Kho Trung Tâm',
          NGAY: dateNow,
          LOAI: isPositive ? 'NHẬP' : 'XUẤT',
          TONG_SL: Math.abs(lech),
          NGUOI_TAO: currentUser?.username || 'admin',
          TEN_NGUOI_TAO: currentUser?.fullName || 'Người dùng',
          TG_TAO: timeNow,
          GHI_CHU: `Phiếu điều chỉnh kiểm kê nhanh từ ma trận độ ${newAuditId}. SKU: ${sku}, Tồn HT: ${currentSystemTon}, Tồn TT: ${newTonThucTe}, Lệch: ${lech > 0 ? '+' : ''}${lech}`,
          MA_NV: currentUser?.id,
          TEN_DANG_NHAP: currentUser?.username
        };

        createdAdjDetail = {
          ID: `CT_ADJ_MATRIX_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          HOA_DON: newAdjInvoiceId,
          SKU: sku,
          TEN_SP: matchedP.TEN_SAN_PHAM,
          THUONG_HIEU: matchedP.THUONG_HIEU,
          CHIET_XUAT: matchedP.CHIET_XUAT,
          TINH_NANG: matchedP.TINH_NANG,
          SPH: matchedP.CAN,
          CYL: matchedP.LOAN,
          SO_LUONG: Math.abs(lech),
          DVT: matchedP.DVT,
          GHI_CHU: `Điều chỉnh kiểm kê nhanh từ ma trận độ ${newAuditId}`,
          LOAI: isPositive ? 'NHẬP' : 'XUẤT',
          NGAY: dateNow
        };

        newKiemKhos = [...newKiemKhos, createdAudit];
        newHeaders = [...newHeaders, createdAdjHeader];
        newDetails = [...newDetails, createdAdjDetail];
      }

      // 3. Tái tính toán và cập nhật lại tồn kho sản phẩm (chỉ chạy khi thực sự có chênh lệch tồn thực tế)
      updatedProducts = updatedProducts.map(p => {
        let isMatch = false;
        if (brand !== undefined && feature !== undefined && chietXuat !== undefined && sph !== undefined && cyl !== undefined) {
          isMatch = 
            p.THUONG_HIEU.trim().toLowerCase() === brand.trim().toLowerCase() &&
            p.TINH_NANG.trim().toLowerCase() === feature.trim().toLowerCase() &&
            compareChietXuat(p.CHIET_XUAT, chietXuat) &&
            Math.abs(p.CAN - sph) < 0.001 &&
            Math.abs(p.LOAN - cyl) < 0.001 &&
            cleanSKU(p.SKU) === normSku;
        } else {
          isMatch = cleanSKU(p.SKU) === normSku;
        }

        if (isMatch) {
          const updatedP = recalculateProductState(sku, updatedProducts, newDetails, newKiemKhos, newHeaders);
          return updatedP ? updatedP : p;
        }
        return p;
      });
    }

    // Cập nhật State
    setSanPhams(updatedProducts);
    setKiemKhos(newKiemKhos);
    if (createdAdjHeader) {
      setNhapXuats(newHeaders);
      setNhapXuatCTs(newDetails);
    }

    setSuccessToast({ 
      message: `Đã cập nhật ô độ ${sku} thành công!`, 
      type: "success", 
      id: `matrix-update-${sku}-${Date.now()}` 
    });

    // Đồng bộ Supabase
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          const promises: Promise<any>[] = [];
          
          // Sync sản phẩm bị ảnh hưởng
          const targetProd = updatedProducts.find(p => {
            if (brand !== undefined && feature !== undefined && chietXuat !== undefined && sph !== undefined && cyl !== undefined) {
              return (
                p.THUONG_HIEU.trim().toLowerCase() === brand.trim().toLowerCase() &&
                p.TINH_NANG.trim().toLowerCase() === feature.trim().toLowerCase() &&
                compareChietXuat(p.CHIET_XUAT, chietXuat) &&
                Math.abs(p.CAN - sph) < 0.001 &&
                Math.abs(p.LOAN - cyl) < 0.001 &&
                cleanSKU(p.SKU) === normSku
              );
            }
            return cleanSKU(p.SKU) === normSku;
          });

          if (targetProd) {
            promises.push(syncSanPham(targetProd, uId));
          }

          // Sync phiếu PKK nếu có
          if (createdAudit) {
            promises.push(syncKiemKho(createdAudit, uId));
          }

          // Sync phiếu điều chỉnh nếu có
          if (createdAdjHeader && createdAdjDetail) {
            promises.push(syncNhapXuat(createdAdjHeader, uId));
            promises.push(syncNhapXuatCTs([createdAdjDetail], uId));
          }

          const results = await Promise.all(promises);
          const error = results.find(r => r && r.error)?.error;
          if (error) {
            setSyncError({
              table: 'b_sanpham / b_kiemkho / b_nhapxuat',
              action: 'Cập nhật từ ma trận độ',
              message: error.message || JSON.stringify(error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync từ ma trận độ:', err);
        setSyncError({
          table: 'b_sanpham / b_kiemkho / b_nhapxuat',
          action: 'Cập nhật từ ma trận độ',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 3000);
      }
    }
  };

  /**
   * Tái tính toán số lượng Nhập, Xuất, và Tồn cuối cho một SKU từ toàn bộ các nguồn dữ liệu hiện tại
   */
  const recalculateProductState = (
    sku: string,
    currentProducts: SanPham[],
    currentDetails: NhapXuatCT[],
    currentKiemKhos: KiemKho[],
    currentHeaders?: NhapXuat[]
  ): SanPham | null => {
    const normSku = cleanSKU(sku);
    const product = currentProducts.find(p => cleanSKU(p.SKU) === normSku);
    if (!product) {
      console.error(`[KIỂM TRA TỒN KHO THẤT BẠI] Lỗi: Không thể tìm thấy SKU [${sku}] trong danh mục sản phẩm để tái tính toán.`);
      return null;
    }

    const headersList = currentHeaders || nhapXuats;
    const activeInvoices = new Set(
      headersList
        .filter(h => h.TRANG_THAI !== 'Đã hủy')
        .map(h => h.HOA_DON)
    );

    // 1. Tính tổng Nhập từ nhapXuatCTs (gồm PN, PNK...) (chỉ tính phiếu chưa hủy)
    const totalNhap = currentDetails
      .filter(d => cleanSKU(d.SKU) === normSku && d.LOAI === 'NHẬP' && activeInvoices.has(d.HOA_DON))
      .reduce((sum, d) => sum + (Number(d.SO_LUONG) || 0), 0);

    // 2. Tính tổng Xuất từ nhapXuatCTs (gồm PX, PXK...) (chỉ tính phiếu chưa hủy)
    const totalXuat = currentDetails
      .filter(d => cleanSKU(d.SKU) === normSku && d.LOAI === 'XUẤT' && activeInvoices.has(d.HOA_DON))
      .reduce((sum, d) => sum + (Number(d.SO_LUONG) || 0), 0);

    // 3. Tính tổng lượng Nhập bù từ lịch sử Kiểm kho (chỉ những phiếu kiểm kho CHƯA có phiếu điều chỉnh PNK trong chi tiết)
    const totalAuditNhapBu = currentKiemKhos
      .filter(k => cleanSKU(k.SKU) === normSku && k.LOAI_BU === 'NHẬP BÙ')
      .filter(k => !currentDetails.some(d => cleanSKU(d.SKU) === normSku && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
      .reduce((sum, k) => sum + (Number(k.LECH) || 0), 0);

    // 4. Tính tổng lượng Xuất bù từ lịch sử Kiểm kho (chỉ những phiếu kiểm kho CHƯA có phiếu điều chỉnh PXK trong chi tiết)
    const totalAuditXuatBu = currentKiemKhos
      .filter(k => cleanSKU(k.SKU) === normSku && k.LOAI_BU === 'XUẤT BÙ')
      .filter(k => !currentDetails.some(d => cleanSKU(d.SKU) === normSku && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
      .reduce((sum, k) => sum + Math.abs(Number(k.LECH) || 0), 0);

    const tonDau = Number(product.TON_DAU) || 0;
    const finalNhap = totalNhap + totalAuditNhapBu;
    const finalXuat = totalXuat + totalAuditXuatBu;
    const finalTonCuoi = tonDau + finalNhap - finalXuat;

    // Hiển thị trace log kiểm tra chi tiết theo yêu cầu của hệ thống
    console.group(`[NHẬT KÝ KIỂM TRA TỒN KHO] SKU: ${product.SKU}`);
    console.log(`- Tồn đầu (TON_DAU): ${tonDau}`);
    console.log(`- Tồn trước recalculate (TON_CUOI cũ): ${product.TON_CUOI}`);
    console.log(`- Tổng Nhập thực tế từ hóa đơn (totalNhap): ${totalNhap}`);
    console.log(`- Nhập bù kiểm kho tự động (totalAuditNhapBu): ${totalAuditNhapBu}`);
    console.log(`- TỔNG NHẬP SAU CÙNG (finalNhap): ${finalNhap}`);
    console.log(`- Tổng Xuất thực tế từ hóa đơn (totalXuat): ${totalXuat}`);
    console.log(`- Xuất bù kiểm kho tự động (totalAuditXuatBu): ${totalAuditXuatBu}`);
    console.log(`- TỔNG XUẤT SAU CÙNG (finalXuat): ${finalXuat}`);
    console.log(`=> TỒN CUỐI SAU CÙNG (finalTonCuoi): ${finalTonCuoi}`);
    console.groupEnd();

    return {
      ...product,
      NHAP: finalNhap,
      XUAT: finalXuat,
      TON_CUOI: finalTonCuoi
    };
  };

  /**
   * Nghiệp vụ Lưu phiếu Nhập / Phiếu Xuất kho
   * Tự động sinh Số hóa đơn (PNxxxxxx, PXxxxxxx) tăng dần chính xác
   */
  const handleSaveTransaction = async (header: NhapXuat, details: NhapXuatCT[]) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    let prefix = header.LOAI === 'NHẬP' ? 'PN' : 'PX';
    if (header.HOA_DON) {
      if (header.HOA_DON.startsWith('PNK')) prefix = 'PNK';
      else if (header.HOA_DON.startsWith('PXK')) prefix = 'PXK';
      else if (header.HOA_DON.startsWith('PN')) prefix = 'PN';
      else if (header.HOA_DON.startsWith('PX')) prefix = 'PX';
    }
    
    // Tìm số hóa đơn lớn nhất có cùng tiền tố
    let maxNum = 0;
    nhapXuats.forEach(h => {
      if (h.HOA_DON.startsWith(prefix)) {
        const numPart = parseInt(h.HOA_DON.substring(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const newInvoiceId = `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
    
    // Ghi nhận hóa đơn mới tạo trong phiên hiện tại để bảo toàn trong hàng đợi đồng bộ
    sessionCreatedInvoiceIdsRef.current.add(newInvoiceId);
    
    // Gán số phiếu chuẩn cho Header và tất cả Chi tiết
    const finalizedHeader: NhapXuat = {
      ...header,
      HOA_DON: newInvoiceId
    };

    const finalizedDetails: NhapXuatCT[] = details.map(d => ({
      ...d,
      HOA_DON: newInvoiceId
    }));

    // Cập nhật State danh sách hóa đơn
    const updatedHeaders = [...nhapXuats, finalizedHeader];
    const updatedDetails = [...nhapXuatCTs, ...finalizedDetails];

    setNhapXuats(updatedHeaders);
    setNhapXuatCTs(updatedDetails);

    // Kích hoạt Toast thông báo thành công chính giữa màn hình
    const toastMsg = finalizedHeader.LOAI === 'NHẬP' ? 'Lưu phiếu nhập thành công' : 'Lưu phiếu xuất thành công';
    setSuccessToast({ 
      message: toastMsg, 
      type: "success", 
      id: `save-tx-${Date.now()}` 
    });

    // Cập nhật số lượng nhập, xuất, và tồn cuối trực tiếp vào bảng sản phẩm ngay lập tức
    const affectedSKUs = Array.from(new Set(finalizedDetails.map(d => cleanSKU(d.SKU))));
    const updatedProductsList = sanPhams.map(p => {
      const pSkuNorm = cleanSKU(p.SKU);
      if (affectedSKUs.includes(pSkuNorm)) {
        const updatedP = recalculateProductState(p.SKU, sanPhams, updatedDetails, kiemKhos, updatedHeaders);
        return updatedP ? updatedP : p;
      }
      return p;
    });

    setSanPhams(updatedProductsList);

    // Đồng bộ Supabase
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          const syncPromises: Promise<any>[] = [
            syncNhapXuat(finalizedHeader, uId),
            syncNhapXuatCTs(finalizedDetails, uId),
            syncSanPhams(updatedProductsList.filter(p => affectedSKUs.includes(cleanSKU(p.SKU))), uId)
          ];

          // Nếu có ID đơn hàng gom (b_gomdon) được liên kết để prefill
          if (prefilledGomDonId) {
            console.log(`Đồng bộ cập nhật trạng thái Đã xuất cho b_gomdon ID: ${prefilledGomDonId}`);
            syncPromises.push(
              (async () => {
                const { error } = await supabase.from('b_gomdon')
                  .update({ trang_thai: 'Đã xuất', so_phieu_xuat: newInvoiceId })
                  .eq('id', prefilledGomDonId);
                return { error };
              })()
            );
          }

          const results = await Promise.all(syncPromises);
          setPrefilledGomDonId(null);

          const error = results.find(r => r && r.error);
          if (error) {
            setSyncError({
              table: 'b_nhapxuat / b_nhapxuatct / b_sanpham / b_gomdon',
              action: 'Lưu hóa đơn',
              message: error.message || JSON.stringify(error)
            });
          } else {
            // Sau khi lưu thành công, thực hiện đồng bộ lại toàn bộ dữ liệu từ Supabase Cloud
            // để đảm bảo 100% dữ liệu cục bộ trùng khớp tuyệt đối với database, không lo lệch state
            await syncAllDataFromSupabase(uId, currentUser.username || '', true);
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync hóa đơn:', err);
        setSyncError({
          table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
          action: 'Lưu hóa đơn',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 3000);
      }
    }
  };

  /**
   * Nghiệp vụ Lưu nhiều phiếu Nhập / Xuất kho một lúc (dùng cho Gom Đơn Lấy Hàng)
   * Tự động sinh Số hóa đơn (PNxxxxxx, PXxxxxxx) tăng dần liên tục chính xác không trùng lặp
   */
  const handleSaveMultipleTransactions = async (
    transactions: { header: NhapXuat; details: NhapXuatCT[] }[]
  ): Promise<string[]> => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return [];
    if (!(await ensureOnline())) return [];

    let currentNhapXuats = [...nhapXuats];
    let currentNhapXuatCTs = [...nhapXuatCTs];
    let currentProducts = [...sanPhams];

    const savedTransactions: { header: NhapXuat; details: NhapXuatCT[] }[] = [];
    const generatedInvoiceIds: string[] = [];

    for (const tx of transactions) {
      const { header, details } = tx;
      let prefix = header.LOAI === 'NHẬP' ? 'PN' : 'PX';
      if (header.HOA_DON) {
        if (header.HOA_DON.startsWith('PNK')) prefix = 'PNK';
        else if (header.HOA_DON.startsWith('PXK')) prefix = 'PXK';
        else if (header.HOA_DON.startsWith('PN')) prefix = 'PN';
        else if (header.HOA_DON.startsWith('PX')) prefix = 'PX';
      }

      // Tìm số hóa đơn lớn nhất hiện tại
      let maxNum = 0;
      currentNhapXuats.forEach(h => {
        if (h.HOA_DON.startsWith(prefix)) {
          const numPart = parseInt(h.HOA_DON.substring(prefix.length), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
      });

      const newInvoiceId = `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
      generatedInvoiceIds.push(newInvoiceId);

      const finalizedHeader: NhapXuat = {
        ...header,
        HOA_DON: newInvoiceId
      };

      const finalizedDetails: NhapXuatCT[] = details.map(d => ({
        ...d,
        HOA_DON: newInvoiceId
      }));

      currentNhapXuats.push(finalizedHeader);
      currentNhapXuatCTs.push(...finalizedDetails);
      savedTransactions.push({ header: finalizedHeader, details: finalizedDetails });
    }

    // Cập nhật State danh sách hóa đơn
    setNhapXuats(currentNhapXuats);
    setNhapXuatCTs(currentNhapXuatCTs);

    // Cập nhật số lượng và tồn kho các SKU bị ảnh hưởng
    const allAffectedSKUs = Array.from(new Set(savedTransactions.flatMap(tx => tx.details.map(d => cleanSKU(d.SKU)))));
    const updatedProductsList = currentProducts.map(p => {
      const pSkuNorm = cleanSKU(p.SKU);
      if (allAffectedSKUs.includes(pSkuNorm)) {
        const updatedP = recalculateProductState(p.SKU, currentProducts, currentNhapXuatCTs, kiemKhos, currentNhapXuats);
        return updatedP ? updatedP : p;
      }
      return p;
    });

    setSanPhams(updatedProductsList);

    // Kích hoạt Toast thông báo thành công
    setSuccessToast({
      message: `Đã tự động tạo thành công ${transactions.length} phiếu xuất kho trực tiếp!`,
      type: "success",
      id: `save-bulk-tx-${Date.now()}`
    });

    // Đồng bộ Supabase
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          // Sync từng header, details và danh sách sản phẩm cập nhật
          await Promise.all([
            ...savedTransactions.map(tx => syncNhapXuat(tx.header, uId)),
            ...savedTransactions.map(tx => syncNhapXuatCTs(tx.details, uId)),
            syncSanPhams(updatedProductsList.filter(p => allAffectedSKUs.includes(cleanSKU(p.SKU))), uId)
          ]);
          
          // Sau khi lưu thành công hàng loạt, thực hiện đồng bộ lại toàn bộ dữ liệu từ Supabase Cloud
          // để đảm bảo 100% dữ liệu cục bộ trùng khớp tuyệt đối với database, không lo lệch state
          await syncAllDataFromSupabase(uId, currentUser.username || '', true);
        }
      } catch (err: any) {
        console.error('Lỗi sync bulk hóa đơn:', err);
        setSyncError({
          table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
          action: 'Lưu nhiều hóa đơn',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 3000);
      }
    }

    return generatedInvoiceIds;
  };

  /**
   * Nghiệp vụ Kiểm kho định kỳ
   * Tự động sinh Số phiếu PKKxxxxxx và bù trừ chênh lệch trực tiếp vào tồn kho sản phẩm (Rule 8)
   * Đồng thời tự động tạo giao dịch điều chỉnh liên kết (PNKxxxxxx hoặc PXKxxxxxx)
   */
  const handleSaveAudit = async (newAuditOrAudits: KiemKho | KiemKho[]) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    const newAudits = Array.isArray(newAuditOrAudits) ? newAuditOrAudits : [newAuditOrAudits];
    
    // 1. Sinh mã phiếu PKK tăng tự động chính xác cho từng phiếu kiểm kho
    let maxPKKNum = 0;
    kiemKhos.forEach(k => {
      if (k.MA_PHIEU.startsWith('PKK')) {
        const numPart = parseInt(k.MA_PHIEU.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxPKKNum) {
          maxPKKNum = numPart;
        }
      }
    });

    let currentPKKNum = maxPKKNum;
    const finalizedAudits: KiemKho[] = [];

    // Chúng ta cũng cần sinh các phiếu bù trừ (nhập kiểm kho / xuất kiểm kho)
    // Tên phiếu bù trừ: PNK0000001, PNK0000002... hoặc PXK0000001, PXK0000002...
    let maxPNKNum = 0;
    let maxPXKNum = 0;
    nhapXuats.forEach(h => {
      if (h.HOA_DON.startsWith('PNK')) {
        const numPart = parseInt(h.HOA_DON.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxPNKNum) {
          maxPNKNum = numPart;
        }
      } else if (h.HOA_DON.startsWith('PXK')) {
        const numPart = parseInt(h.HOA_DON.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxPXKNum) {
          maxPXKNum = numPart;
        }
      }
    });

    let currentPNKNum = maxPNKNum;
    let currentPXKNum = maxPXKNum;

    const newHeadersToSave: NhapXuat[] = [];
    const newDetailsToSave: NhapXuatCT[] = [];

    newAudits.forEach((audit, index) => {
      currentPKKNum += 1;
      const newAuditId = `PKK${String(currentPKKNum).padStart(6, '0')}`;
      
      const finalizedAudit: KiemKho = {
        ...audit,
        MA_PHIEU: newAuditId,
        MA_NV: currentUser?.id,
        TEN_DANG_NHAP: currentUser?.username
      };
      finalizedAudits.push(finalizedAudit);

      // Nếu có chênh lệch, tự động sinh phiếu điều chỉnh kho liên kết (PNK hoặc PXK)
      if (finalizedAudit.LECH !== 0) {
        const isPositive = finalizedAudit.LECH > 0;
        let newAdjInvoiceId = '';
        if (isPositive) {
          currentPNKNum += 1;
          newAdjInvoiceId = `PNK${String(currentPNKNum).padStart(6, '0')}`;
        } else {
          currentPXKNum += 1;
          newAdjInvoiceId = `PXK${String(currentPXKNum).padStart(6, '0')}`;
        }

        const matchedP = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(finalizedAudit.SKU));
        if (matchedP) {
          const adjHeader: NhapXuat = {
            HOA_DON: newAdjInvoiceId,
            CHI_NHANH: finalizedAudit.KHO || currentUser?.branch || 'Kho Trung Tâm',
            NGAY: finalizedAudit.THOI_DIEM.split(' ')[0], // YYYY-MM-DD
            LOAI: isPositive ? 'NHẬP' : 'XUẤT',
            TONG_SL: Math.abs(finalizedAudit.LECH),
            NGUOI_TAO: currentUser?.username || 'admin',
            TEN_NGUOI_TAO: currentUser?.fullName || 'Người dùng',
            TG_TAO: finalizedAudit.THOI_DIEM,
            GHI_CHU: `Phiếu điều chỉnh kiểm kê liên kết ${newAuditId}. SKU: ${finalizedAudit.SKU}, Tồn HT: ${finalizedAudit.TON_HE_THONG}, Tồn TT: ${finalizedAudit.TON_THUC_TE}, Lệch: ${finalizedAudit.LECH > 0 ? '+' : ''}${finalizedAudit.LECH}`,
            MA_NV: currentUser?.id,
            TEN_DANG_NHAP: currentUser?.username
          };

          const adjDetail: NhapXuatCT = {
            ID: `CT_ADJ_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
            HOA_DON: newAdjInvoiceId,
            SKU: finalizedAudit.SKU,
            TEN_SP: matchedP.TEN_SAN_PHAM,
            THUONG_HIEU: matchedP.THUONG_HIEU,
            CHIET_XUAT: matchedP.CHIET_XUAT,
            TINH_NANG: matchedP.TINH_NANG,
            SPH: matchedP.CAN,
            CYL: matchedP.LOAN,
            SO_LUONG: Math.abs(finalizedAudit.LECH),
            DVT: matchedP.DVT,
            GHI_CHU: `Điều chỉnh kiểm kê liên kết ${newAuditId}`,
            LOAI: isPositive ? 'NHẬP' : 'XUẤT',
            NGAY: finalizedAudit.THOI_DIEM.split(' ')[0]
          };

          newHeadersToSave.push(adjHeader);
          newDetailsToSave.push(adjDetail);
        }
      }
    });

    const updatedKiemKhos = [...kiemKhos, ...finalizedAudits];
    const updatedHeaders = [...nhapXuats, ...newHeadersToSave];
    const updatedDetails = [...nhapXuatCTs, ...newDetailsToSave];

    // Cập nhật State cho PKK và điều chỉnh
    setKiemKhos(updatedKiemKhos);
    if (newHeadersToSave.length > 0) {
      setNhapXuats(updatedHeaders);
      setNhapXuatCTs(updatedDetails);
    }

    // Tính toán và cập nhật lại tồn kho sản phẩm hoàn toàn chính xác
    const affectedSKUs = Array.from(new Set(finalizedAudits.map(a => cleanSKU(a.SKU))));
    const updatedProductsList = sanPhams.map(p => {
      const pSkuNorm = cleanSKU(p.SKU);
      if (affectedSKUs.includes(pSkuNorm)) {
        const updatedP = recalculateProductState(p.SKU, sanPhams, updatedDetails, updatedKiemKhos, updatedHeaders);
        return updatedP ? updatedP : p;
      }
      return p;
    });

    setSanPhams(updatedProductsList);

    // Đồng bộ Supabase và LocalStorage
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          const promises: Promise<any>[] = [];
          
          // Sync từng phiếu PKK
          finalizedAudits.forEach(audit => {
            promises.push(syncKiemKho(audit, uId));
          });

          // Sync sản phẩm bị ảnh hưởng
          promises.push(syncSanPhams(updatedProductsList.filter(p => affectedSKUs.includes(cleanSKU(p.SKU))), uId));

          // Sync phiếu điều chỉnh nếu có
          if (newHeadersToSave.length > 0) {
            newHeadersToSave.forEach(h => {
              promises.push(syncNhapXuat(h, uId));
            });
            promises.push(syncNhapXuatCTs(newDetailsToSave, uId));
          }

          const results = await Promise.all(promises);
          const error = results.find(r => r && r.error)?.error;
          if (error) {
            setSyncError({
              table: 'b_kiemkho / b_sanpham / b_nhapxuat / b_nhapxuatct',
              action: 'Lưu phiếu kiểm và điều chỉnh',
              message: error.message || JSON.stringify(error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync kiểm kho và điều chỉnh:', err);
        setSyncError({
          table: 'b_kiemkho / b_sanpham / b_nhapxuat / b_nhapxuatct',
          action: 'Lưu phiếu kiểm và điều chỉnh',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 3000);
      }
    }
  };

  /**
   * TÁI TÍNH TOÁN TỒN KHO THÔNG MINH CHO CÁC SKU BỊ ẢNH HƯỞNG (Rule 3)
   * Chú ý: Chỉ SKU nào sửa đổi mới cập nhật lại, tuyệt đối không tính toán toàn bộ bảng để tăng tốc độ.
   */
  const handleUpdateTransaction = async (
    updatedHeader: NhapXuat, 
    updatedDetails: NhapXuatCT[], 
    skusToRecalc: string[]
  ) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    // 1. Cập nhật header trong danh sách
    const nextHeaders = nhapXuats.map(h => h.HOA_DON === updatedHeader.HOA_DON ? updatedHeader : h);
    setNhapXuats(nextHeaders);
    
    // 2. Ghi đè lại toàn bộ chi tiết mới (chỉ chứa sự thay đổi của dòng trong phiếu)
    setNhapXuatCTs(updatedDetails);

    // 3. Tái tính toán cục bộ cho các SKU bị ảnh hưởng
    const normSkusToRecalc = skusToRecalc.map(s => cleanSKU(s));
    const updatedProductsList = sanPhams.map(p => {
      const pSkuNorm = cleanSKU(p.SKU);
      if (normSkusToRecalc.includes(pSkuNorm)) {
        const updatedP = recalculateProductState(p.SKU, sanPhams, updatedDetails, kiemKhos, nextHeaders);
        return updatedP ? updatedP : p;
      }
      return p;
    });

    setSanPhams(updatedProductsList);

    // Đồng bộ Supabase
    if (currentUser) {
      ignoreRealtimeRef.current = true;
      try {
        const uId = await getUserId();
        if (uId) {
          const [res1, resDel] = await Promise.all([
            syncNhapXuat(updatedHeader, uId),
            supabase.from('b_nhapxuatct').delete().eq('HOA_DON', updatedHeader.HOA_DON),
          ]);
          const [res2, res3] = await Promise.all([
            syncNhapXuatCTs(updatedDetails.filter(d => d.HOA_DON === updatedHeader.HOA_DON), uId),
            syncSanPhams(updatedProductsList.filter(p => normSkusToRecalc.includes(cleanSKU(p.SKU))), uId)
          ]);
          const error = res1.error || resDel.error || res2.error || res3.error;
          if (error) {
            setSyncError({
              table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
              action: 'Cập nhật hóa đơn',
              message: error.message || JSON.stringify(error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật hóa đơn:', err);
        setSyncError({
          table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
          action: 'Cập nhật hóa đơn',
          message: err.message || JSON.stringify(err)
        });
      } finally {
        setTimeout(() => {
          ignoreRealtimeRef.current = false;
        }, 3000);
      }
    }
  };

  /**
   * HỦY PHIẾU VÀ HOÀN TÁC ROLLBACK TỒN KHO TRỌN VẸN (Rule 4)
   * Phục hồi lại số lượng tròng kính của tất cả SKU liên quan về nguyên trạng.
   */
  const handleDeleteTransaction = async (hoaDonId: string, skusToRecalc: string[]): Promise<boolean> => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return false;
    if (!(await ensureOnline())) return false;
    try {
      // 1. Cập nhật TRANG_THAI = 'Đã hủy' cho Header trong danh sách nhapXuats
      const updatedHeaders = nhapXuats.map(h => h.HOA_DON === hoaDonId ? { ...h, TRANG_THAI: 'Đã hủy' } : h);
      setNhapXuats(updatedHeaders);

      // 2. Giữ nguyên chi tiết nhapXuatCTs để hiển thị được trong lịch sử giao dịch

      // 3. Tái tính toán khôi phục kho cho các SKU bị ảnh hưởng (Rollback hoàn toàn)
      const normSkusToRecalc = skusToRecalc.map(s => cleanSKU(s));
      const updatedProductsList = sanPhams.map(p => {
        const pSkuNorm = cleanSKU(p.SKU);
        if (normSkusToRecalc.includes(pSkuNorm)) {
          // Pass the updated headers list so that the calculator knows this transaction has been cancelled!
          const updatedP = recalculateProductState(p.SKU, sanPhams, nhapXuatCTs, kiemKhos, updatedHeaders);
          return updatedP ? updatedP : p;
        }
        return p;
      });

      setSanPhams(updatedProductsList);

      // Đồng bộ Supabase
      if (currentUser) {
        ignoreRealtimeRef.current = true;
        try {
          const uId = await getUserId();
          if (uId) {
            const cancelledHeader = updatedHeaders.find(h => h.HOA_DON === hoaDonId);
            const [resSyncHeader, resSyncProducts] = await Promise.all([
              cancelledHeader ? syncNhapXuat(cancelledHeader, uId) : Promise.resolve({ error: null }),
              syncSanPhams(updatedProductsList.filter(p => normSkusToRecalc.includes(cleanSKU(p.SKU))), uId)
            ]);
            const error = resSyncHeader.error || resSyncProducts.error;
            if (error) {
              setSyncError({
                table: 'b_nhapxuat / b_sanpham',
                action: 'Hủy hóa đơn',
                message: error.message || JSON.stringify(error)
              });
              return false;
            }
          }
        } catch (err: any) {
          console.error('Lỗi sync hủy hóa đơn:', err);
          setSyncError({
            table: 'b_nhapxuat / b_sanpham',
            action: 'Hủy hóa đơn',
            message: err.message || JSON.stringify(err)
          });
          return false;
        } finally {
          setTimeout(() => {
            ignoreRealtimeRef.current = false;
          }, 3000);
        }
      }
      return true;
    } catch (err) {
      console.error('Lỗi khi hủy hóa đơn:', err);
      return false;
    }
  };

  /**
   * XÓA PHIẾU VĨNH VIỄN VÀ HOÀN TÁC TỒN KHO NẾU PHIẾU CHƯA BỊ HỦY
   * Chỉ ADMIN được phép thực hiện.
   */
  const handleHardDeleteTransaction = async (
    hoaDonId: string,
    skusToRecalc: string[],
    shouldRollbackStock: boolean
  ): Promise<boolean> => {
    if (!(await ensureOnline())) return false;
    try {
      // 1. Cập nhật nhapXuats (xóa khỏi danh sách)
      const nextHeaders = nhapXuats.filter(h => h.HOA_DON !== hoaDonId);
      setNhapXuats(nextHeaders);

      // 2. Cập nhật nhapXuatCTs (xóa khỏi danh sách)
      const nextDetails = nhapXuatCTs.filter(d => d.HOA_DON !== hoaDonId);
      setNhapXuatCTs(nextDetails);

      // 3. Tái tính toán khôi phục kho cho các SKU bị ảnh hưởng nếu cần rollback
      let updatedProductsList = sanPhams;
      const normSkusToRecalc = skusToRecalc.map(s => cleanSKU(s));
      if (shouldRollbackStock) {
        updatedProductsList = sanPhams.map(p => {
          const pSkuNorm = cleanSKU(p.SKU);
          if (normSkusToRecalc.includes(pSkuNorm)) {
            const updatedP = recalculateProductState(p.SKU, sanPhams, nextDetails, kiemKhos, nextHeaders);
            return updatedP ? updatedP : p;
          }
          return p;
        });
        setSanPhams(updatedProductsList);
      }

      // Đồng bộ Supabase
      if (currentUser) {
        ignoreRealtimeRef.current = true;
        try {
          const uId = await getUserId();
          if (uId) {
            // Xóa phiếu và chi tiết trên Supabase
            const { error: deleteError } = await deleteNhapXuatAndDetails(hoaDonId);
            
            // Sync sản phẩm nếu có thay đổi tồn kho
            let syncProductsError = null;
            if (shouldRollbackStock) {
              const changedProducts = updatedProductsList.filter(p => normSkusToRecalc.includes(cleanSKU(p.SKU)));
              const resSyncProducts = await syncSanPhams(changedProducts, uId);
              syncProductsError = resSyncProducts.error;
            }

            const error = deleteError || syncProductsError;
            if (error) {
              setSyncError({
                table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
                action: 'Xóa vĩnh viễn hóa đơn',
                message: error.message || JSON.stringify(error)
              });
              return false;
            }
          }
        } catch (err: any) {
          console.error('Lỗi sync xóa vĩnh viễn hóa đơn:', err);
          setSyncError({
            table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
            action: 'Xóa vĩnh viễn hóa đơn',
            message: err.message || JSON.stringify(err)
          });
          return false;
        } finally {
          setTimeout(() => {
            ignoreRealtimeRef.current = false;
          }, 3000);
        }
      }
      return true;
    } catch (err) {
      console.error('Lỗi khi xóa vĩnh viễn hóa đơn:', err);
      return false;
    }
  };

  // --- 6. PHƯƠNG THỨC THÊM MỚI DANH MỤC THƯƠNG HIỆU, CHI NHÁNH, NHÂN VIÊN ---
  const handleAddThuongHieu = async (brand: ThuongHieu) => {
    if (!(await ensureOnline())) return;
    setThuongHieus(prev => [...prev, brand]);

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await syncThuongHieu(brand, uId);
          if (res.error) {
            setSyncError({
              table: 'b_thuonghieu',
              action: 'Thêm thương hiệu',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync thương hiệu:', err);
        setSyncError({
          table: 'b_thuonghieu',
          action: 'Thêm thương hiệu',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleAddChiNhanh = async (branch: ChiNhanh) => {
    if (!(await ensureOnline())) return;
    setChiNhanhs(prev => [...prev, branch]);

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await syncChiNhanh(branch, uId);
          if (res.error) {
            setSyncError({
              table: 'b_chinhanh',
              action: 'Thêm chi nhánh',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync chi nhánh:', err);
        setSyncError({
          table: 'b_chinhanh',
          action: 'Thêm chi nhánh',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleAddNhanVien = async (staff: NhanVien) => {
    if (!(await ensureOnline())) return;
    setNhanViens(prev => [...prev, staff]);

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await syncNhanVien(staff, uId);
          if (res.error) {
            setSyncError({
              table: 'b_nhanvien',
              action: 'Thêm nhân viên',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync nhân viên:', err);
        setSyncError({
          table: 'b_nhanvien',
          action: 'Thêm nhân viên',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleUpdateThuongHieu = async (oldName: string, oldFeature: string, brand: ThuongHieu) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    const brandFeature = brand.TINH_NANG || brand.TINH_NANG_MAC_DINH || '';
    setThuongHieus(prev => {
      const filtered = prev.filter(t => t.THUONG_HIEU !== oldName);
      return [...filtered, brand];
    });
    
    // Cập nhật sản phẩm nếu thương hiệu hoặc tính năng thay đổi
    if (oldName !== brand.THUONG_HIEU || oldFeature !== brandFeature) {
      setSanPhams(prev => prev.map(p => (p.THUONG_HIEU === oldName && p.TINH_NANG === oldFeature) ? { ...p, THUONG_HIEU: brand.THUONG_HIEU, TINH_NANG: brandFeature } : p));
    }

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          if (oldName !== brand.THUONG_HIEU) {
            await deleteThuongHieu(oldName, uId);
          }
          const res = await syncThuongHieu(brand, uId);
          if (res.error) {
            setSyncError({
              table: 'b_thuonghieu',
              action: 'Cập nhật thương hiệu',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật thương hiệu:', err);
        setSyncError({
          table: 'b_thuonghieu',
          action: 'Cập nhật thương hiệu',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleDeleteThuongHieu = async (brandName: string, feature: string) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    setThuongHieus(prev => prev.filter(t => !(t.THUONG_HIEU === brandName && (t.TINH_NANG || t.TINH_NANG_MAC_DINH || '') === feature)));

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await deleteThuongHieu(brandName, uId);
          if (res.error) {
            setSyncError({
              table: 'b_thuonghieu',
              action: 'Xóa thương hiệu',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync xóa thương hiệu:', err);
        setSyncError({
          table: 'b_thuonghieu',
          action: 'Xóa thương hiệu',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleUpdateChiNhanh = async (oldName: string, branch: ChiNhanh) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    setChiNhanhs(prev => prev.map(c => c.CHI_NHANH === oldName ? branch : c));

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          if (oldName !== branch.CHI_NHANH) {
            await deleteChiNhanh(oldName, uId);
          }
          const res = await syncChiNhanh(branch, uId);
          if (res.error) {
            setSyncError({
              table: 'b_chinhanh',
              action: 'Cập nhật chi nhánh',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật chi nhánh:', err);
        setSyncError({
          table: 'b_chinhanh',
          action: 'Cập nhật chi nhánh',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleDeleteChiNhanh = async (branchName: string) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    setChiNhanhs(prev => prev.filter(c => c.CHI_NHANH !== branchName));

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await deleteChiNhanh(branchName, uId);
          if (res.error) {
            setSyncError({
              table: 'b_chinhanh',
              action: 'Xóa chi nhánh',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync xóa chi nhánh:', err);
        setSyncError({
          table: 'b_chinhanh',
          action: 'Xóa chi nhánh',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleUpdatePassword = async (newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!(await ensureOnline())) return { success: false, message: 'Không thể kết nối máy chủ. Chức năng này chỉ khả dụng khi trực tuyến.' };
    if (!currentUser) return { success: false, message: 'Chưa đăng nhập' };
    const member = nhanViens.find(n => 
      n.MA_NV === currentUser.id || 
      n.EMAIL.toLowerCase() === currentUser.username.toLowerCase() || 
      (n.TEN_DANG_NHAP && n.TEN_DANG_NHAP.toLowerCase() === currentUser.username.toLowerCase())
    );
    if (!member) {
      return { success: false, message: 'Không tìm thấy thông tin tài khoản nhân sự của bạn trên hệ thống.' };
    }
    const updatedMember: NhanVien = {
      ...member,
      MAT_KHAU: newPassword,
      YEU_CAU_RESET: false
    };
    await handleUpdateNhanVien(member.EMAIL, updatedMember);
    return { success: true, message: 'Cập nhật mật khẩu cá nhân thành công!' };
  };

  const handleUpdateNhanVien = async (oldEmail: string, staff: NhanVien) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    const oldStaff = nhanViens.find(n => n.EMAIL === oldEmail);
    const oldStatus = oldStaff ? (oldStaff.TRANG_THAI || 'ACTIVE').trim().toUpperCase() : 'ACTIVE';
    const newStatus = (staff.TRANG_THAI || 'ACTIVE').trim().toUpperCase();

    setNhanViens(prev => prev.map(n => n.EMAIL === oldEmail ? staff : n));

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          if (oldEmail !== staff.EMAIL) {
            await deleteNhanVien(oldEmail, uId);
          }
          const res = await syncNhanVien(staff, uId);
          if (res.error) {
            setSyncError({
              table: 'b_nhanvien',
              action: 'Cập nhật nhân viên',
              message: res.error.message || JSON.stringify(res.error)
            });
          } else {
            // TỰ ĐỘNG PHÁT HIỆN THAY ĐỔI TRẠNG THÁI ĐỂ GỬI EMAIL THÔNG BÁO THỰC TẾ
            if (oldStatus !== newStatus) {
              const emailDate = new Date().toLocaleString('vi-VN');
              let title = '';
              let mailContent = '';
              let loaiEmail = '';

              const isPending = oldStatus === 'CHỜ DUYỆT' || oldStatus === 'PENDING' || oldStatus === 'CHO DUYET';
              const isActive = newStatus === 'HOẠT ĐỘNG' || newStatus === 'ACTIVE' || newStatus === 'KÍCH HOẠT' || newStatus === 'HOAT DONG';
              const isRejected = newStatus === 'TỪ CHỐI' || newStatus === 'REJECTED' || newStatus === 'TU CHOI';
              const isBlocked = newStatus === 'KHÓA' || newStatus === 'BLOCKED' || newStatus === 'KHOA';

              if (isPending && isActive) {
                // Phê duyệt tài khoản
                title = "Tài khoản của bạn đã được kích hoạt";
                mailContent = `Chào ${staff.HO_TEN},\n\n` +
                  `Chúng tôi vui mừng thông báo rằng yêu cầu đăng ký tài khoản của bạn trên hệ thống Quản lý Xuất Nhập Tồn Tròng Kính Quản Lý Kho đã được Admin phê duyệt kích hoạt thành công!\n\n` +
                  `Thông tin tài khoản hoạt động:\n` +
                  `- Họ và tên: ${staff.HO_TEN}\n` +
                  `- Tên đăng nhập: ${staff.TEN_DANG_NHAP || staff.EMAIL}\n` +
                  `- Email liên hệ: ${staff.EMAIL}\n` +
                  `- Vai trò hệ thống: ${staff.ROLE === 'ADMIN' ? 'Admin (Chủ cửa hàng)' : staff.ROLE === 'KHO' ? 'Thủ Kho' : 'Nhân Viên Bán Hàng'}\n` +
                  `- Chi nhánh: ${staff.CHI_NHANH}\n` +
                  `- Trạng thái tài khoản: Hoạt động (Active)\n\n` +
                  `Bây giờ bạn có thể đăng nhập vào ứng dụng và sử dụng các tính năng được cấp quyền ngay lập tức.\n\n` +
                  `Đường dẫn đăng nhập hệ thống: ${window.location.origin}\n\n` +
                  `Chúc bạn có một trải nghiệm làm việc hiệu quả!\n\n` +
                  `Trân trọng,\nBan Quản Trị Quản Lý Kho`;
                loaiEmail = "Phê duyệt";
              } else if (isPending && isRejected) {
                // Từ chối tài khoản
                title = "Yêu cầu đăng ký tài khoản bị từ chối";
                mailContent = `Chào ${staff.HO_TEN},\n\n` +
                  `Chúng tôi rất tiếc phải thông báo rằng yêu cầu đăng ký tài khoản của bạn trên hệ thống Quản Lý Kho đã bị từ chối bởi Quản trị viên hệ thống.\n\n` +
                  `Thông tin tài khoản đăng ký:\n` +
                  `- Họ và tên: ${staff.HO_TEN}\n` +
                  `- Tên đăng nhập: ${staff.TEN_DANG_NHAP}\n` +
                  `- Email liên hệ: ${staff.EMAIL}\n` +
                  `- Trạng thái: Bị từ chối (Rejected)\n\n` +
                  `Nếu có bất kỳ thắc mắc nào hoặc muốn biết thêm lý do, vui lòng liên hệ trực tiếp với Quản lý hoặc Admin để được hỗ trợ giải đáp.\n\n` +
                  `Trân trọng,\nBan Quản Trị Quản Lý Kho`;
                loaiEmail = "Từ chối";
              } else if (isBlocked) {
                // Khóa tài khoản
                title = "Tài khoản của bạn đã bị khóa";
                mailContent = `Chào ${staff.HO_TEN},\n\n` +
                  `Chúng tôi thông báo rằng tài khoản của bạn trên hệ thống Quản Lý Kho đã bị KHÓA (Blocked) bởi Ban Quản Trị.\n\n` +
                  `Thông tin chi tiết:\n` +
                  `- Họ và tên: ${staff.HO_TEN}\n` +
                  `- Tên đăng nhập: ${staff.TEN_DANG_NHAP || staff.EMAIL}\n` +
                  `- Trạng thái: Đã bị khóa (Blocked)\n\n` +
                  `Bạn sẽ không thể đăng nhập vào hệ thống kể từ thời điểm này. Nếu đây là một sự nhầm lẫn hoặc cần khôi phục tài khoản, vui lòng liên hệ trực tiếp với Admin hệ thống.\n\n` +
                  `Trân trọng,\nBan Quản Trị Quản Lý Kho`;
                loaiEmail = "Khóa tài khoản";
              }

              if (title && mailContent && loaiEmail) {
                try {
                  await syncEmailLog({
                    EMAIL: staff.EMAIL,
                    TIEU_DE: title,
                    NOI_DUNG: mailContent,
                    NGAY_GUI: emailDate,
                    TRANG_THAI: "Thành công",
                    LOAI_EMAIL: loaiEmail
                  }, uId);

                  // Load lại danh sách logs email sau khi gửi thành công
                  const latestLogs = await fetchEmailLogs(uId);
                  setEmailLogs(latestLogs);
                  localStorage.setItem('B_EMAILLOG', JSON.stringify(latestLogs));
                } catch (logErr) {
                  console.warn("Lỗi ghi nhận log email khi phê duyệt:", logErr);
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật nhân viên:', err);
        setSyncError({
          table: 'b_nhanvien',
          action: 'Cập nhật nhân viên',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  const handleDeleteNhanVien = async (email: string) => {
    const isSessionValid = await verifySession();
    if (!isSessionValid) return;
    if (!(await ensureOnline())) return;
    setNhanViens(prev => prev.filter(n => n.EMAIL !== email));

    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const res = await deleteNhanVien(email, uId);
          if (res.error) {
            setSyncError({
              table: 'b_nhanvien',
              action: 'Xóa nhân viên',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync xóa nhân viên:', err);
        setSyncError({
          table: 'b_nhanvien',
          action: 'Xóa nhân viên',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  // Trích xuất mảng string đơn thuần cho dropdown
  const listBrandNames = useMemo(() => Array.from(new Set(thuongHieus.map(t => t.THUONG_HIEU))), [thuongHieus]);
  const listBranchNames = useMemo(() => chiNhanhs.map(c => c.CHI_NHANH), [chiNhanhs]);

  // --- 7. ĐỒNG BỘ CHUYỂN ĐỔI NGƯỜI DÙNG ĐỂ KIỂM THỬ PHÂN QUYỀN TRỰC QUAN ---
  const handleSwitchUser = (email: string) => {
    const found = nhanViens.find(n => n.EMAIL === email);
    if (found) {
      const newUser: User = {
        username: found.TEN_DANG_NHAP || found.EMAIL || found.HO_TEN,
        fullName: found.HO_TEN,
        role: normalizeDbRole(found.ROLE || 'NHAN_VIEN'),
        branch: found.CHI_NHANH || 'Kho Trung Tâm',
        writeAccess: found.WRITE_ACCESS !== false,
        WRITE_ACCESS: found.WRITE_ACCESS !== false,
        id: found.MA_NV,
        user_id: found.user_id,
        ROLES: found.ROLES || []
      };
      setCurrentUser(newUser);
      localStorage.setItem('CURRENT_USER', JSON.stringify(newUser));
      if (found.user_id) {
        localStorage.setItem('DB_OWNER_USER_ID', found.user_id);
      }
      
      // Tự động chuyển tab về trang sản phẩm/lịch sử nếu tab hiện tại bị khóa do phân quyền của vai trò mới
      if (found.ROLE === 'NHAN_VIEN') {
        setActiveTab('TRANSACTION_XUAT');
      } else {
        setActiveTab('DASHBOARD');
      }
    }
  };

  if (!currentUser) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-100">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            <p className="text-sm font-medium font-sans">Đang tải trang đăng nhập...</p>
          </div>
        </div>
      }>
        <Login 
          nhanViens={nhanViens}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            localStorage.setItem('CURRENT_USER', JSON.stringify(user));
            if (user.user_id) {
              localStorage.setItem('DB_OWNER_USER_ID', user.user_id);
            }

            // ĐỒNG BỘ DỮ LIỆU LẬP TỨC KHI ĐĂNG NHẬP THÀNH CÔNG!
            syncAllDataFromSupabase(user.user_id || user.id || '00000000-0000-0000-0000-000000000000', user.username);
            
            // Tự động chuyển hướng tab phù hợp
            if (user.role === 'NHAN_VIEN') {
              setActiveTab('TRANSACTION_XUAT');
            } else {
              setActiveTab('DASHBOARD');
            }
          }} 
        />
      </Suspense>
    );
  }

  return (
    <div 
      className={`min-h-screen text-slate-900 antialiased flex flex-col md:flex-row relative overflow-x-hidden main-content-bg ${themeMode === 'dark' ? 'dark-theme' : ''}`}
      style={{ 
        '--accent-color': accentHex,
        backgroundColor: 'var(--bg-main)'
      } as React.CSSProperties}
    >
      
      {/* MOBILE HEADER BAR - Chỉ hiển thị trên mobile (ví dụ iPhone 14) */}
      <div className={`md:hidden h-14 px-4 flex items-center justify-between border-b shrink-0 sticky top-0 z-30 ${
        themeMode === 'light' ? 'bg-white text-slate-800 border-slate-200' : 'bg-[#0f172a] text-white border-slate-800'
      }`}>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className={`p-1.5 rounded-lg focus:outline-hidden transition-colors ${
              themeMode === 'light' ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className={`font-sans font-bold text-xs uppercase tracking-wider ${
            themeMode === 'light' ? 'text-slate-900' : 'text-slate-100'
          }`}>
            Quản Lý Kho
          </span>
          <span className={`h-2 w-2 rounded-full shrink-0 ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} title={isOffline ? 'Ngoại tuyến' : 'Trực tuyến'} />
        </div>
        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                themeMode === 'light' ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Đồng bộ dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          )}
          <span className="text-[10px] font-mono py-1 px-2.5 rounded-full uppercase font-bold tracking-wider" style={{
            backgroundColor: `${accentHex}15`,
            color: accentHex,
            border: `1px solid ${accentHex}30`
          }}>
            {activeTab === 'TRANSACTION_XUAT' ? 'Xuất Kho' : activeTab === 'TRANSACTION_NHAP' ? 'Nhập Kho' : activeTab === 'DASHBOARD' ? 'Báo Cáo' : activeTab === 'PRODUCT' ? 'Sản Phẩm' : activeTab === 'AUDIT' ? 'Kiểm Kho' : activeTab === 'HISTORY' ? 'Lịch Sử' : 'Danh Mục'}
          </span>
        </div>
      </div>

      {/* BACKDROP OVERLAY - Nhấp để đóng menu trên mobile */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR DỌC BÊN TRÁI - Sliding Drawer cực mượt trên mobile & Tĩnh trên desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 shrink-0 flex flex-col border-r transition-all duration-200 ease-in-out md:translate-x-0 md:static md:flex ${sidebarStyle.bg} ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'}`}>
        
        {/* LOGO & BRAND */}
        <div className={`p-4 border-b flex items-center justify-between gap-2 ${sidebarStyle.border} ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className={`items-center gap-3 ${sidebarCollapsed ? 'hidden' : 'flex'}`}>
            <div className="p-2 rounded-xl shadow-md text-white" style={{ backgroundColor: accentHex }}>
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`font-sans font-bold text-sm uppercase tracking-wider flex items-center gap-1.5 ${sidebarStyle.logoText}`}>
                Quản Lý Kho
                <span className="text-[8px] bg-blue-500/20 text-blue-300 font-mono py-0.5 px-1.5 rounded-full uppercase">v4.0</span>
              </h1>
              <p className={`text-[9px] font-mono ${sidebarStyle.subText}`}>Quản Lý Xuất Nhập Tồn Tròng Kính</p>
            </div>
          </div>

          {/* Khi thu gọn, hiển thị Logo icon căn giữa */}
          {sidebarCollapsed && (
            <div className="p-2 rounded-xl shadow-md text-white" style={{ backgroundColor: accentHex }} title="Quản Lý Kho v4.0">
              <Boxes className="w-5 h-5" />
            </div>
          )}

          {/* Close button chỉ hiện trên mobile */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className={`md:hidden p-1.5 rounded-lg focus:outline-hidden ${sidebarStyle.closeBtn}`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Nút Toggle Sidebar chỉ hiển thị trên desktop */}
          <button
            onClick={toggleSidebar}
            className={`hidden md:flex p-1.5 rounded-lg focus:outline-hidden cursor-pointer transition-colors ${sidebarStyle.closeBtn}`}
            title={sidebarCollapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* THÔNG TIN USER ĐANG ĐĂNG NHẬP KÈM STATUS BADGE */}
        <div className={`p-3 mx-3 my-4 rounded-2xl border flex flex-col gap-2 ${sidebarStyle.userBox} ${sidebarCollapsed ? 'items-center px-1' : ''}`}>
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div 
                className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs uppercase shrink-0"
                title={`${currentUser.fullName} (${currentUser.role})`}
              >
                {currentUser.fullName.charAt(0)}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate ${sidebarStyle.userText}`}>{currentUser.fullName}</p>
                  <p className={`text-[9px] font-mono font-bold uppercase tracking-wider truncate ${sidebarStyle.userSub}`}>
                    {currentUser.role === 'ADMIN' ? 'Chủ Cửa Hàng' : currentUser.role === 'KHO' ? 'Thủ Kho' : 'Nhân Viên'} | {currentUser.branch}
                  </p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && currentUser && (
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                  themeMode === 'light' 
                    ? 'hover:bg-slate-200/80 border-slate-200/80 text-slate-500' 
                    : 'hover:bg-slate-800 border-slate-800 text-slate-400'
                }`}
                title="Đồng bộ dữ liệu"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-500' : ''}`} />
              </button>
            )}
          </div>
          
          {/* TRẠNG THÁI TRỰC TUYẾN / NGOẠI TUYẾN */}
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-1.5 px-1 mt-1 border-t border-slate-200/40 pt-1.5 dark:border-slate-800/40">
              <span className={`h-2 w-2 rounded-full shrink-0 ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              <span className={`text-[10px] font-medium tracking-wide ${themeMode === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                {isOffline ? 'Đang ngoại tuyến' : 'Đang trực tuyến'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center mt-1 pt-1 border-t border-slate-200/40 dark:border-slate-800/40 w-full" title={isOffline ? 'Đang ngoại tuyến' : 'Đang trực tuyến'}>
              <span className={`h-2 w-2 rounded-full shrink-0 ${isOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
            </div>
          )}
        </div>

        {/* CÁC TABS ĐIỀU HƯỚNG DỌC (Nav Tab bên trái) */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          
          {/* TAB 0: KIỂM TRA ĐƠN TIN NHẮN */}
          {hasPermission('ordercheck.view') && (
            <button
              onClick={() => selectTabOnMobile('ORDER_PARSER')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'ORDER_PARSER' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Kiểm Tra Đơn" : undefined}
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-indigo-500" /> 
              {!sidebarCollapsed && <span>Kiểm Tra Đơn</span>}
            </button>
          )}

          {/* TAB 1: LẬP PHIẾU XUẤT */}
          {hasPermission('picking_xuat.view') && (
            <button
              onClick={() => selectTabOnMobile('TRANSACTION_XUAT')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'TRANSACTION_XUAT' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Lập Phiếu Xuất" : undefined}
            >
              <FileUp className="w-4 h-4 shrink-0 text-rose-500" /> 
              {!sidebarCollapsed && <span>Lập Phiếu Xuất</span>}
            </button>
          )}

          {/* TAB 2: LẬP PHIẾU NHẬP */}
          {hasPermission('picking_nhap.view') && (
            <button
              onClick={() => selectTabOnMobile('TRANSACTION_NHAP')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'TRANSACTION_NHAP' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Lập Phiếu Nhập" : undefined}
            >
              <FileDown className="w-4 h-4 shrink-0 text-emerald-500" /> 
              {!sidebarCollapsed && <span>Lập Phiếu Nhập</span>}
            </button>
          )}

          {/* TAB 3: DASHBOARD */}
          {hasPermission('dashboard.view') && (
            <button
              onClick={() => selectTabOnMobile('DASHBOARD')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'DASHBOARD' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Dashboard" : undefined}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-blue-500" /> 
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* TAB 4: QUẢN LÝ SẢN PHẨM */}
          {(hasPermission('product.view') || hasPermission('inventory.view')) && (
            <button
              onClick={() => selectTabOnMobile('PRODUCT')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'PRODUCT' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Sản phẩm" : undefined}
            >
              <Boxes className="w-4 h-4 shrink-0 text-amber-500" /> 
              {!sidebarCollapsed && <span>Sản phẩm</span>}
            </button>
          )}

          {/* TAB 4B: BẢNG ĐỘ */}
          {hasPermission('matrix.view') && (
            <button
              onClick={() => selectTabOnMobile('MATRIX')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'MATRIX' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Bảng Độ" : undefined}
            >
              <LayoutGrid className="w-4 h-4 shrink-0 text-rose-500" /> 
              {!sidebarCollapsed && <span>Bảng Độ (Ma Trận)</span>}
            </button>
          )}

          {/* TAB 5: KIỂM KHO */}
          {hasPermission('stocktake.view') && (
            <button
              onClick={() => selectTabOnMobile('AUDIT')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'AUDIT' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Kiểm Kê Kho" : undefined}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0 text-violet-500" /> 
              {!sidebarCollapsed && <span>Kiểm Kê Kho</span>}
            </button>
          )}

          {/* TAB 6: LỊCH SỬ XUẤT NHẬP */}
          {hasPermission('history.view') && (
            <button
              onClick={() => selectTabOnMobile('HISTORY')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'HISTORY' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Lịch sử xuất nhập" : undefined}
            >
              <History className="w-4 h-4 shrink-0 text-indigo-500" /> 
              {!sidebarCollapsed && <span>Lịch sử xuất nhập</span>}
            </button>
          )}

          {/* TAB 7: CÀI ĐẶT DANH MỤC */}
          {(hasPermission('employee.view') || hasPermission('role.view') || hasPermission('product.view') || hasPermission('inventory.view')) && (
            <button
              onClick={() => selectTabOnMobile('CATEGORY')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'CATEGORY' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Cài Đặt Danh Mục" : undefined}
            >
              <FolderTree className="w-4 h-4 shrink-0 text-teal-500" /> 
              {!sidebarCollapsed && <span>Cài Đặt Danh Mục</span>}
            </button>
          )}

          {/* TAB 8: CÀI ĐẶT GIAO DIỆN */}
          {hasPermission('settings.view') && (
            <button
              onClick={() => selectTabOnMobile('SETTINGS')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${sidebarCollapsed ? 'justify-center px-0' : ''} ${
                activeTab === 'SETTINGS' ? activeButtonClass : sidebarStyle.navDefault
              }`}
              title={sidebarCollapsed ? "Cài Đặt Giao Diện" : undefined}
            >
              <Palette className="w-4 h-4 shrink-0 text-fuchsia-400" /> 
              {!sidebarCollapsed && <span>Cài Đặt Giao Diện</span>}
            </button>
          )}
        </nav>



        {/* NÚT ĐĂNG XUẤT Ở CUỐI SIDEBAR */}
        <div className={`p-4 border-t shrink-0 ${sidebarStyle.logoutBorder}`}>
          <button
            onClick={handleLogout}
            className={`w-full py-2.5 px-3.5 bg-red-600/10 hover:bg-red-650 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2 ${sidebarCollapsed ? 'px-0 justify-center' : ''}`}
            title={sidebarCollapsed ? "Đăng xuất hệ thống" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Đăng xuất hệ thống</span>}
          </button>
        </div>

      </aside>

      {/* KHU VỰC CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* THANH THÔNG BÁO CẢNH BÁO TỒN KHO THẤP */}
        <AnimatePresence>
          {lowStockAlerts.length > 0 && showNotificationBanner && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs flex items-center justify-between gap-3 text-red-700 shrink-0"
            >
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-red-500 animate-bounce shrink-0" />
                <span>
                  CẢNH BÁO: Hiện có <strong className="font-bold font-mono">{lowStockAlerts.length} dòng tròng kính</strong> có tồn cuối chạm hoặc dưới ngưỡng tối thiểu! Hãy bổ dung phiếu nhập hàng.
                </span>
              </div>
              <button 
                onClick={() => setShowNotificationBanner(false)}
                className="text-red-400 hover:text-red-700 font-bold p-1 cursor-pointer shrink-0"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PHẦN THÂN HIỂN THỊ CÁC COMPONENT CHỨC NĂNG */}
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto">
          {syncError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-xl shadow-sm flex items-start justify-between animate-fade-in">
              <div className="flex">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-800">Lỗi đồng bộ dữ liệu với Supabase Cloud</h3>
                  <p className="text-xs text-red-700 mt-1">
                    Hành động <strong className="font-semibold text-red-950">"{syncError.action}"</strong> trên bảng <code className="bg-red-100 px-1 py-0.5 rounded text-red-900 font-mono text-[11px]">{syncError.table}</code> thất bại.
                  </p>
                  <div className="text-xs text-red-600 mt-2 bg-red-100/50 border border-red-150 p-2.5 rounded-lg font-mono break-all max-h-24 overflow-y-auto">
                    Chi tiết kỹ thuật: {syncError.message}
                  </div>
                  <div className="text-xs text-red-700 mt-3 border-t border-red-200/60 pt-2.5">
                    <strong className="font-semibold text-red-950">Hướng dẫn khắc phục sự cố:</strong>
                    <ul className="list-disc pl-4 mt-1.5 space-y-1.5 text-red-850">
                      <li>Đảm bảo tài khoản <strong>{currentUser.username}</strong> của bạn đã được đăng nhập chính xác trên Supabase.</li>
                      <li>
                        Đảm bảo bảng <code className="bg-red-100 px-1 py-0.5 rounded text-red-900 font-mono text-[10px]">{syncError.table.split(' ')[0]}</code> trong Supabase của bạn đã được cấu hình <strong className="font-semibold text-red-950">chính sách RLS (Row Level Security)</strong> cho phép hành động tương ứng đối với người dùng được xác thực (Authenticated).
                      </li>
                      <li>
                        Bạn có thể vô hiệu hóa RLS (hoặc thêm chính sách tự do) trên Supabase Dashboard bằng cách chạy lệnh SQL sau trong mục <strong className="font-semibold text-red-950">SQL Editor</strong>:
                        <pre className="bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[10px] mt-1.5 select-all overflow-x-auto whitespace-pre font-bold">
{`ALTER TABLE "${syncError.table.split(' ')[0]}" DISABLE ROW LEVEL SECURITY;`}
                        </pre>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSyncError(null)} 
                className="text-red-400 hover:text-red-700 font-bold ml-4 p-1 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                title="Đóng cảnh báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              <ErrorBoundary key={activeTab} fallbackTitle={`Lỗi kết xuất chức năng ${activeTab}`}>
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center min-h-[300px] h-full gap-3 text-slate-500 font-sans py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: 'var(--accent-color)' }}></div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Đang tải phân hệ...</p>
                  </div>
                }>
                  {activeTab === 'ORDER_PARSER' && hasPermission('ordercheck.view') && (
                  <OrderParser
                    sanPhams={sanPhams}
                    brandList={thuongHieus}
                    chiNhanhs={listBranchNames}
                    onTriggerToast={(message, type) => {
                      setSuccessToast({ show: true, message, type: type || 'success', id: Date.now() });
                    }}
                    onCreateXuatPhieu={(items, gomDonId) => {
                      setPrefilledCartItems(items);
                      setPrefilledGomDonId(gomDonId || null);
                      setActiveTab('TRANSACTION_XUAT');
                    }}
                    currentUser={currentUser}
                    onSaveMultipleTransactions={handleSaveMultipleTransactions}
                    onNavigateToHistory={() => setActiveTab('HISTORY')}
                  />
                )}

                {activeTab === 'TRANSACTION_NHAP' && hasPermission('picking_nhap.view') && (
                  <TransactionForm
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    loaiPhieuMacDinh="NHẬP"
                    prefilledSku={prefilledSku || undefined}
                    onClearPrefilledSku={() => setPrefilledSku(null)}
                    prefilledCartItems={prefilledCartItems || undefined}
                    onClearPrefilledCartItems={() => {
                      setPrefilledCartItems(null);
                      setPrefilledGomDonId(null);
                    }}
                    onSaveTransaction={handleSaveTransaction}
                    onNavigateToHistory={() => setActiveTab('HISTORY')}
                    onTriggerToast={(msg) => setSuccessToast({ show: true, message: msg, type: 'success' })}
                  />
                )}

                {activeTab === 'TRANSACTION_XUAT' && hasPermission('picking_xuat.view') && (
                  <TransactionForm
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    loaiPhieuMacDinh="XUẤT"
                    prefilledSku={prefilledSku || undefined}
                    onClearPrefilledSku={() => setPrefilledSku(null)}
                    prefilledCartItems={prefilledCartItems || undefined}
                    onClearPrefilledCartItems={() => {
                      setPrefilledCartItems(null);
                      setPrefilledGomDonId(null);
                    }}
                    onSaveTransaction={handleSaveTransaction}
                    onNavigateToHistory={() => setActiveTab('HISTORY')}
                    onTriggerToast={(msg) => setSuccessToast({ show: true, message: msg, type: 'success' })}
                  />
                )}

                {activeTab === 'DASHBOARD' && hasPermission('dashboard.view') && (
                  <Dashboard 
                    sanPhams={sanPhams}
                    nhapXuats={nhapXuats}
                    nhapXuatCTs={nhapXuatCTs}
                    chiNhanhs={listBranchNames}
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    onQuickRestock={(sku) => {
                      setPrefilledSku(sku);
                      setActiveTab('TRANSACTION_NHAP'); // Lập phiếu nhập kho trực tiếp
                    }}
                    onTriggerToast={(message, type) => {
                      setSuccessToast({ show: true, message, type: type || 'success', id: Date.now() });
                    }}
                    onDrillDown={(filters) => {
                      setHistoryFiltersOverride(filters);
                      setActiveTab('HISTORY');
                    }}
                  />
                )}

                {activeTab === 'PRODUCT' && (hasPermission('product.view') || hasPermission('inventory.view')) && (
                  <ProductManagement 
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    thuongHieus={listBranchNames}
                    brandList={thuongHieus}
                  />
                )}

                {activeTab === 'MATRIX' && hasPermission('matrix.view') && (
                  <DiopterMatrix 
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    nhapXuats={nhapXuats}
                    nhapXuatCTs={nhapXuatCTs}
                    kiemKhos={kiemKhos}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    onUpdateMatrixCell={handleUpdateMatrixCell}
                  />
                )}

                {activeTab === 'AUDIT' && hasPermission('stocktake.view') && (
                  <InventoryAudit 
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    kiemKhos={kiemKhos}
                    onSaveAudit={handleSaveAudit}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    chiNhanhs={listBranchNames}
                  />
                )}

                {activeTab === 'HISTORY' && hasPermission('history.view') && (
                  <TransactionHistory 
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    sanPhams={sanPhams}
                    nhapXuats={
                      // Nhân viên có quyền history.read_all sẽ xem toàn bộ, nếu không thì chỉ xem phiếu do chính mình tạo
                      hasPermission('history.read_all')
                        ? nhapXuats
                        : nhapXuats.filter(h => h.NGUOI_TAO === currentUser.username)
                    }
                    nhapXuatCTs={nhapXuatCTs}
                    kiemKhos={kiemKhos}
                    onUpdateTransaction={handleUpdateTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onHardDeleteTransaction={handleHardDeleteTransaction}
                    onSaveTransaction={handleSaveTransaction}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    drillDownFilters={historyFiltersOverride}
                    onClearDrillDownFilters={() => setHistoryFiltersOverride(null)}
                  />
                )}

                {activeTab === 'CATEGORY' && (hasPermission('employee.view') || hasPermission('role.view') || hasPermission('product.view') || hasPermission('inventory.view')) && (
                  <CategoryManagement 
                    currentUser={currentUser}
                    hasPermission={hasPermission}
                    thuongHieus={thuongHieus}
                    chiNhanhs={chiNhanhs}
                    nhanViens={nhanViens}
                    emailLogs={emailLogs}
                    onAddThuongHieu={handleAddThuongHieu}
                    onAddChiNhanh={handleAddChiNhanh}
                    onAddNhanVien={handleAddNhanVien}
                    onUpdateThuongHieu={handleUpdateThuongHieu}
                    onDeleteThuongHieu={handleDeleteThuongHieu}
                    onUpdateChiNhanh={handleUpdateChiNhanh}
                    onDeleteChiNhanh={handleDeleteChiNhanh}
                    onUpdateNhanVien={handleUpdateNhanVien}
                    onDeleteNhanVien={handleDeleteNhanVien}
                    roles={roles}
                    onAddRole={async (r) => {
                      if (!(await ensureOnline())) return;
                      ignoreRealtimeRef.current = true;
                      try {
                        const res = await syncRole(r, currentUser.id);
                        if (res.error) {
                          setSyncError({
                            table: 'b_role',
                            action: 'Thêm vai trò mới',
                            message: res.error.message || JSON.stringify(res.error)
                          });
                          throw new Error(res.error.message || "Lỗi lưu lên Supabase");
                        }
                        await reloadRoles();
                      } finally {
                        setTimeout(() => {
                          ignoreRealtimeRef.current = false;
                        }, 1000);
                      }
                    }}
                    onUpdateRole={async (r) => {
                      if (!(await ensureOnline())) return;
                      ignoreRealtimeRef.current = true;
                      try {
                        const res = await syncRole(r, currentUser.id);
                        if (res.error) {
                          setSyncError({
                            table: 'b_role',
                            action: 'Cập nhật vai trò',
                            message: res.error.message || JSON.stringify(res.error)
                          });
                          throw new Error(res.error.message || "Lỗi cập nhật trên Supabase");
                        }
                        await reloadRoles();
                      } finally {
                        setTimeout(() => {
                          ignoreRealtimeRef.current = false;
                        }, 1000);
                      }
                    }}
                    onDeleteRole={async (roleCode) => {
                      if (!(await ensureOnline())) return;
                      ignoreRealtimeRef.current = true;
                      try {
                        const res = await deleteRole(roleCode, currentUser.id);
                        if (res.error) {
                          setSyncError({
                            table: 'b_role',
                            action: 'Xóa vai trò',
                            message: res.error.message || JSON.stringify(res.error)
                          });
                          throw new Error(res.error.message || "Lỗi xóa trên Supabase");
                        }
                        await reloadRoles();
                      } finally {
                        setTimeout(() => {
                          ignoreRealtimeRef.current = false;
                        }, 1000);
                      }
                    }}
                    onTriggerToast={(message, type) => {
                      setSuccessToast({ show: true, message, type: type || 'success' });
                    }}
                  />
                )}

                {activeTab === 'SETTINGS' && (
                  <ThemeSettings 
                    currentUser={currentUser}
                    themeMode={themeMode}
                    accentColor={accentColor}
                    onUpdateTheme={handleUpdateTheme}
                    onUpdatePassword={handleUpdatePassword}
                  />
                )}
                </Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* FOOTER CHUYÊN NGHIỆP */}
        <footer className="footer-theme border-t py-3 text-center text-[10px] shrink-0 font-medium shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
          <p className="flex items-center justify-center gap-1.5 text-desc-color">
            <span>© 2026 Quản Lý Kho. Thiết kế & vận hành bởi Nguyễn Kiến Đức.</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-blue-500" style={{ color: 'var(--accent-color)' }}>Cập nhật thời gian thực bằng Google Apps Script & Sheets</span>
          </p>
        </footer>

        {/* MOBILE BOTTOM NAVIGATION - Cố định ở cuối màn hình */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f172a] border-t border-slate-800 md:hidden flex items-center justify-around h-16 px-1 shadow-[0_-4px_12px_rgba(0,0,0,0.15)] pb-safe">
          {[
            {
              tab: 'TRANSACTION_XUAT',
              label: 'Xuất Kho',
              icon: FileUp
            },
            {
              tab: 'ORDER_PARSER',
              label: 'Kiểm tra đơn',
              icon: MessageSquare
            },
            {
              tab: 'HISTORY',
              label: 'Lịch sử',
              icon: History
            }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.label}
                onClick={() => selectTabOnMobile(item.tab as any)}
                className="flex-1 h-full flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <div className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-red-600 text-white shadow-md scale-110' : 'text-slate-400'
                }`}>
                  <Icon className="w-5 h-5 shrink-0" />
                </div>
                <span className={`text-[9px] font-bold ${
                  isActive ? 'text-red-500' : 'text-slate-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* HỆ THỐNG THÔNG BÁO TOAST KHÔNG GÂY GIÁN ĐOẠN */}
        <AnimatePresence>
          {successToast && (
            <div className="fixed top-5 right-5 z-[9999] p-4 max-w-sm w-full pointer-events-none">
              <motion.div
                key={successToast.id || successToast.message}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSuccessToast(null)}
                className={`relative w-full bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 pointer-events-auto border cursor-pointer select-none transition-all duration-200 hover:bg-slate-900 ${
                  successToast.type === 'error'
                    ? 'border-rose-500/30 shadow-rose-500/5'
                    : successToast.type === 'warning'
                    ? 'border-amber-500/30 shadow-amber-500/5'
                    : 'border-emerald-500/30 shadow-emerald-500/5'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {successToast.type === 'error' ? (
                    <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  ) : successToast.type === 'warning' ? (
                    <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 pr-6 text-left">
                  <h4 className="font-bold text-sm text-slate-100">
                    {successToast.type === 'error'
                      ? 'Thao tác thất bại'
                      : successToast.type === 'warning'
                      ? 'Cảnh báo'
                      : 'Thành công'}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
                    {successToast.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSuccessToast(null);
                  }}
                  className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}

