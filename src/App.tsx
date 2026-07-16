/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback, Component, ReactNode } from 'react';

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
    argStr.includes('Lỗi trong quá trình khởi tạo Auth');

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
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, UserRole, User, ThươngHieu, ChiNhanh, NhanVien, EmailLog, Role, safeParseArray } from './types';
import { 
  getVietnamDateString,
  getVietnamDateTimeString,
  cleanSKU
} from './data/mockData';

// Import Supabase
import { supabase } from './supabaseClient';
import {
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
  setOfflineMode
} from './supabaseSync';

// Import Components con
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProductManagement from './components/ProductManagement';
import TransactionForm from './components/TransactionForm';
import InventoryAudit from './components/InventoryAudit';
import TransactionHistory from './components/TransactionHistory';
import CategoryManagement from './components/CategoryManagement';
import ThemeSettings from './components/ThemeSettings';
import DiopterMatrix from './components/DiopterMatrix';
import OrderParser from './components/OrderParser';






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
      'dashboard.view',
      'product.view', 'product.create', 'product.edit', 'product.delete',
      'import.view', 'import.create', 'import.edit', 'import.delete',
      'export.view', 'export.create', 'export.edit', 'export.delete',
      'inventory.view', 'inventory.edit',
      'report.view',
      'user.view', 'user.create', 'user.edit', 'user.delete',
      'role.view', 'role.create', 'role.edit', 'role.delete'
    ]
  },
  {
    ROLE_CODE: 'MANAGER',
    TEN_ROLE: 'Quản lý nghiệp vụ (Manager)',
    PERMISSIONS: [
      'dashboard.view',
      'product.view', 'product.create', 'product.edit',
      'import.view', 'import.create', 'import.edit',
      'export.view', 'export.create', 'export.edit',
      'inventory.view', 'inventory.edit',
      'report.view'
    ]
  },
  {
    ROLE_CODE: 'STAFF',
    TEN_ROLE: 'Nhân viên bán hàng (Staff)',
    PERMISSIONS: [
      'product.view',
      'export.view', 'export.create',
      'import.view',
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

export default function App() {
  const ignoreRealtimeRef = useRef<boolean>(false);

  // --- 1. KHỞI TẠO STATE CƠ SỞ DỮ LIỆU ĐỒNG BỘ LOCALSTORAGE ---
  const [sanPhams, setSanPhams] = useState<SanPham[]>(() => {
    const saved = localStorage.getItem('B_SANPHAM');
    return saved ? deduplicateProducts(JSON.parse(saved)) : [];
  });

  const [nhapXuats, setNhapXuats] = useState<NhapXuat[]>(() => {
    const saved = localStorage.getItem('B_NHAPXUAT');
    return saved ? JSON.parse(saved) : [];
  });

  const [nhapXuatCTs, setNhapXuatCTs] = useState<NhapXuatCT[]>(() => {
    const saved = localStorage.getItem('B_NHAPXUATCT');
    return saved ? JSON.parse(saved) : [];
  });

  const [kiemKhos, setKiemKhos] = useState<KiemKho[]>(() => {
    const saved = localStorage.getItem('B_KIEMKHO');
    return saved ? JSON.parse(saved) : [];
  });

  const [thuongHieus, setThuongHieus] = useState<ThươngHieu[]>(() => {
    const saved = localStorage.getItem('B_THUONGHIEU');
    return saved ? JSON.parse(saved) : [];
  });

  const [chiNhanhs, setChiNhanhs] = useState<ChiNhanh[]>(() => {
    const saved = localStorage.getItem('B_CHINHANH');
    return saved ? JSON.parse(saved) : [];
  });

  const [nhanViens, setNhanViens] = useState<NhanVien[]>(() => {
    const saved = localStorage.getItem('B_NHANVIEN');
    return saved ? JSON.parse(saved) : [];
  });

  const [emailLogs, setEmailLogs] = useState<EmailLog[]>(() => {
    const saved = localStorage.getItem('B_EMAILLOG');
    return saved ? JSON.parse(saved) : [];
  });

  const [loadingDb, setLoadingDb] = useState<boolean>(false);

  // --- 2. QUẢN LÝ NGƯỜI DÙNG HIỆN TẠI & PHÂN QUYỀN CHẶT CHẼ ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('CURRENT_USER');
    return saved ? JSON.parse(saved) : null;
  });

  // --- 2B. QUẢN LÝ VAI TRÒ & QUYỀN HẠN (RBAC) ---
  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem('B_ROLE');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_ROLES;
      }
    }
    return DEFAULT_ROLES;
  });

  useEffect(() => {
    localStorage.setItem('B_ROLE', JSON.stringify(roles));
  }, [roles]);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!currentUser) return false;

    // Admin mặc định có toàn quyền
    const isOwner = currentUser.username.toLowerCase() === 'nguyenkienduc.digital@gmail.com' || currentUser.username.toLowerCase() === 'nguyennhanhoa.artist@gmail.com';
    if (isOwner) return true;

    const userRoles = safeParseArray(currentUser.ROLES).length > 0 ? safeParseArray(currentUser.ROLES) : (currentUser.role ? [currentUser.role] : []);
    if (userRoles.includes('ADMIN')) return true;

    // Thu thập toàn bộ permission từ các role của user
    const userPermissions = new Set<string>();
    userRoles.forEach(roleCode => {
      const matchedRole = roles.find(r => r.ROLE_CODE === roleCode);
      if (matchedRole && matchedRole.PERMISSIONS) {
        matchedRole.PERMISSIONS.forEach(p => userPermissions.add(p));
      } else {
        // Tương thích ngược: Đối sánh với vai trò mặc định nếu mã vai trò không khớp trực tiếp
        let fallbackRoleCode = roleCode;
        if (roleCode === 'KHO') fallbackRoleCode = 'MANAGER';
        if (roleCode === 'NHAN_VIEN') fallbackRoleCode = 'STAFF';

        const matchedFallback = roles.find(r => r.ROLE_CODE === fallbackRoleCode) || DEFAULT_ROLES.find(r => r.ROLE_CODE === fallbackRoleCode);
        if (matchedFallback && matchedFallback.PERMISSIONS) {
          matchedFallback.PERMISSIONS.forEach(p => userPermissions.add(p));
        }
      }
    });

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
    console.log("Đã đăng xuất người dùng trên giao diện. Giữ kết nối nền Supabase hoạt động.");
  };

  // --- TRẠNG THÁI KẾT NỐI ONLINE / OFFLINE CHẶT CHẼ ---
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      return !window.navigator.onLine;
    }
    return false;
  });

  const pingSupabase = async (): Promise<boolean> => {
    if (typeof window !== 'undefined' && window.navigator && !window.navigator.onLine) {
      return false;
    }
    try {
      const rawUrl = (import.meta as any).env.VITE_SUPABASE_URL || "https://fuyyregblrjugejetunj.supabase.co";
      const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5 seconds timeout

      const response = await fetch(`${cleanUrl}/auth/v1/health`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (err) {
      console.warn("Ping Supabase thất bại:", err);
      return false;
    }
  };

  const ensureOnline = async (): Promise<boolean> => {
    const online = await pingSupabase();
    if (!online) {
      setIsOffline(true);
      setOfflineMode(true);
      setSuccessToast({
        message: "❌ Không có kết nối mạng. Vui lòng kiểm tra Internet và thử lại.",
        type: "error",
        id: `offline-warn-${Date.now()}`
      });
      return false;
    }
    setIsOffline(false);
    setOfflineMode(false);
    return true;
  };

  // Định kỳ kiểm tra kết nối Supabase thực tế mỗi 10 giây
  useEffect(() => {
    const checkConnection = async () => {
      const online = await pingSupabase();
      setIsOffline(!online);
      setOfflineMode(!online);
    };

    // Chạy kiểm tra ngay khi mount
    checkConnection();

    const interval = setInterval(checkConnection, 10000); // 10 giây một lần

    const handleOnline = () => {
      checkConnection();
    };
    const handleOffline = () => {
      setIsOffline(true);
      setOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      await syncAllDataFromSupabase(currentUser.id, currentUser.username);
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

  // Background polling interval - Tự động đồng bộ liên tục mỗi 15 giây (seamless, không che mờ màn hình)
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    const interval = setInterval(async () => {
      if (ignoreRealtimeRef.current) {
        console.log("Đang lưu phiếu hoặc có thao tác ghi dữ liệu, tạm dừng polling...");
        return;
      }
      try {
        console.log("Background Polling: Đang âm thầm kiểm tra cập nhật mới...");
        const payload = await ensureUserOnboarded(currentUser.id);
        const uniqueProducts = deduplicateProducts(payload.sanPhams);
        
        setSanPhams(uniqueProducts);
        setNhapXuats(payload.nhapXuats);
        setNhapXuatCTs(payload.nhapXuatCTs);
        setKiemKhos(payload.kiemKhos);
        setThuongHieus(payload.thuongHieus);
        setChiNhanhs(payload.chiNhanhs);
        setNhanViens(payload.nhanViens);
        if (payload.roles && payload.roles.length > 0) {
          setRoles(payload.roles);
          localStorage.setItem('B_ROLE', JSON.stringify(payload.roles));
        }

        localStorage.setItem('B_SANPHAM', JSON.stringify(uniqueProducts));
        localStorage.setItem('B_NHAPXUAT', JSON.stringify(payload.nhapXuats));
        localStorage.setItem('B_NHAPXUATCT', JSON.stringify(payload.nhapXuatCTs));
        localStorage.setItem('B_KIEMKHO', JSON.stringify(payload.kiemKhos));
        localStorage.setItem('B_THUONGHIEU', JSON.stringify(payload.thuongHieus));
        localStorage.setItem('B_CHINHANH', JSON.stringify(payload.chiNhanhs));
        localStorage.setItem('B_NHANVIEN', JSON.stringify(payload.nhanViens));

        // Background sync email logs
        try {
          const logs = await fetchEmailLogs(currentUser.id);
          setEmailLogs(logs);
          localStorage.setItem('B_EMAILLOG', JSON.stringify(logs));
        } catch (mailErr) {
          console.warn("Background Polling: Lỗi đồng bộ log email:", mailErr);
        }
      } catch (err) {
        console.warn("Lỗi đồng bộ ngầm:", err);
      }
    }, 15000); // 15 giây

    return () => clearInterval(interval);
  }, [currentUser]);

  // Hàm tải dữ liệu chuyên biệt từ Supabase Cloud và gán đồng bộ vào State và LocalStorage
  const syncAllDataFromSupabase = async (userId: string, email: string) => {
    setLoadingDb(true);
    try {
      console.log('Bắt đầu đồng bộ dữ liệu mới nhất từ Supabase Cloud cho tài khoản:', email);
      const payload = await ensureUserOnboarded(userId);
      const uniqueProducts = deduplicateProducts(payload.sanPhams);
      setSanPhams(uniqueProducts);
      setNhapXuats(payload.nhapXuats);
      setNhapXuatCTs(payload.nhapXuatCTs);
      setKiemKhos(payload.kiemKhos);
      setThuongHieus(payload.thuongHieus);
      setChiNhanhs(payload.chiNhanhs);
      setNhanViens(payload.nhanViens);
      if (payload.roles && payload.roles.length > 0) {
        setRoles(payload.roles);
        localStorage.setItem('B_ROLE', JSON.stringify(payload.roles));
      }

      // Lưu trữ đồng bộ tức thì vào LocalStorage để đảm bảo tính sẵn sàng
      localStorage.setItem('B_SANPHAM', JSON.stringify(uniqueProducts));
      localStorage.setItem('B_NHAPXUAT', JSON.stringify(payload.nhapXuats));
      localStorage.setItem('B_NHAPXUATCT', JSON.stringify(payload.nhapXuatCTs));
      localStorage.setItem('B_KIEMKHO', JSON.stringify(payload.kiemKhos));
      localStorage.setItem('B_THUONGHIEU', JSON.stringify(payload.thuongHieus));
      localStorage.setItem('B_CHINHANH', JSON.stringify(payload.chiNhanhs));
      localStorage.setItem('B_NHANVIEN', JSON.stringify(payload.nhanViens));

      // Tải và đồng bộ Nhật ký email gửi đi
      try {
        const logs = await fetchEmailLogs(userId);
        setEmailLogs(logs);
        localStorage.setItem('B_EMAILLOG', JSON.stringify(logs));
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
              const u: User = {
                username: latestStaff.TEN_DANG_NHAP || latestStaff.EMAIL || latestStaff.HO_TEN,
                fullName: latestStaff.HO_TEN,
                role: latestStaff.ROLE || latestStaff.VAI_TRO || 'NHAN_VIEN',
                branch: latestStaff.CHI_NHANH || 'Kho Trung Tâm',
                writeAccess: latestStaff.WRITE_ACCESS !== false,
                WRITE_ACCESS: latestStaff.WRITE_ACCESS !== false,
                id: latestStaff.MA_NV,
                ROLES: latestStaff.ROLES || []
              };
              setCurrentUser(u);
              localStorage.setItem('CURRENT_USER', JSON.stringify(u));
              return;
            } else if (savedUser.username === 'nguyenkienduc.digital@gmail.com' || savedUser.username === 'admin') {
              const u: User = {
                username: 'nguyenkienduc.digital@gmail.com',
                fullName: 'Nguyễn Kiến Đức',
                role: 'ADMIN',
                branch: 'Kho Trung Tâm',
                writeAccess: true,
                WRITE_ACCESS: true,
                id: 'NV0001',
                ROLES: ['ADMIN']
              };
              setCurrentUser(u);
              localStorage.setItem('CURRENT_USER', JSON.stringify(u));
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
      setLoadingDb(false);
    }
  };

  // Quản lý Auth và Realtime đồng bộ hóa dữ liệu từ Supabase
  useEffect(() => {
    let realtimeChannel: any = null;
    let currentUserId: string | null = null;

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
      
      realtimeChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          async (payload: any) => {
            console.log('Realtime Event nhận được từ Supabase:', payload);
            
            // Lấy user_id từ dữ liệu thay đổi
            const newRow = payload.new;
            const oldRow = payload.old;
            const rowUserId = (newRow && newRow.user_id) || (oldRow && oldRow.user_id);

            // Nếu thay đổi thuộc về b_role, chỉ tải lại vai trò, không tải lại toàn bộ database để tránh làm chậm hệ thống
            if (payload.table === 'b_role') {
              if (ignoreRealtimeRef.current) {
                console.log('Đang bỏ qua sự kiện Realtime cho bảng b_role do cờ ignoreRealtime...');
                return;
              }
              const ownerId = localStorage.getItem('DB_OWNER_USER_ID') || userId;
              if (rowUserId === userId || rowUserId === ownerId || rowUserId === '00000000-0000-0000-0000-000000000000') {
                console.log('Phát hiện thay đổi cấu hình vai trò trên Supabase Cloud. Tiến hành cập nhật danh sách vai trò tại chỗ...');
                await reloadRoles();
              }
              return;
            }

            // Nếu dữ liệu thay đổi thuộc về user hiện tại hoặc Owner, tự động reload lại toàn bộ
            const ownerId = localStorage.getItem('DB_OWNER_USER_ID') || userId;
            if (rowUserId === userId || rowUserId === ownerId || rowUserId === '00000000-0000-0000-0000-000000000000') {
              if (ignoreRealtimeRef.current) {
                console.log('Đang bỏ qua sự kiện Realtime để tránh ghi đè dữ liệu cục bộ đang đồng bộ...');
                return;
              }
              console.log('Phát hiện thay đổi dữ liệu của bạn trên Supabase Cloud. Tiến hành đồng bộ thời gian thực tự động...');
              try {
                const payloadDb = await ensureUserOnboarded(userId);
                const uniqueProducts = deduplicateProducts(payloadDb.sanPhams);
                setSanPhams(uniqueProducts);
                setNhapXuats(payloadDb.nhapXuats);
                setNhapXuatCTs(payloadDb.nhapXuatCTs);
                setKiemKhos(payloadDb.kiemKhos);
                setThuongHieus(payloadDb.thuongHieus);
                setChiNhanhs(payloadDb.chiNhanhs);
                setNhanViens(payloadDb.nhanViens);

                // Cập nhật LocalStorage tức thì
                localStorage.setItem('B_SANPHAM', JSON.stringify(uniqueProducts));
                localStorage.setItem('B_NHAPXUAT', JSON.stringify(payloadDb.nhapXuats));
                localStorage.setItem('B_NHAPXUATCT', JSON.stringify(payloadDb.nhapXuatCTs));
                localStorage.setItem('B_KIEMKHO', JSON.stringify(payloadDb.kiemKhos));
                localStorage.setItem('B_THUONGHIEU', JSON.stringify(payloadDb.thuongHieus));
                localStorage.setItem('B_CHINHANH', JSON.stringify(payloadDb.chiNhanhs));
                localStorage.setItem('B_NHANVIEN', JSON.stringify(payloadDb.nhanViens));
              } catch (e) {
                console.error('Lỗi khi đồng bộ realtime từ Supabase:', e);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log(`Trạng thái kênh Supabase Realtime [${userId}]:`, status);
        });
    };

    // 1. Kiểm tra session ngay khi trang web khởi chạy và tự động đăng nhập ngầm Admin để liên kết dữ liệu trực tuyến
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userId = session.user.id;
          const email = session.user.email || '';
          currentUserId = userId;
          console.log('Phát hiện session hợp lệ khi khởi chạy. Thực hiện tải dữ liệu mới nhất từ Supabase Cloud...');
          syncAllDataFromSupabase(userId, email);
          setupRealtime(userId);
        } else {
          console.log('Không phát hiện session hoạt động. Tiến hành tự động đăng nhập ngầm tài khoản quản trị để kết nối dữ liệu...');
          const { data, error } = await supabase.auth.signInWithPassword({
            email: 'nguyenkienduc.digital@gmail.com',
            password: '123456'
          });

          if (!error && data?.session?.user) {
            const userId = data.session.user.id;
            const email = data.session.user.email || '';
            currentUserId = userId;
            console.log('Đăng nhập ngầm Admin thành công. Đang tải dữ liệu trực tuyến...');
            syncAllDataFromSupabase(userId, email);
            setupRealtime(userId);
          } else {
            console.warn('Đăng nhập ngầm Admin thất bại hoặc chưa có trên máy chủ, sử dụng fallback offline:', error?.message);
            const savedUser = localStorage.getItem('CURRENT_USER');
            if (savedUser) {
              try {
                const parsed = JSON.parse(savedUser);
                if (parsed && parsed.id) {
                  syncAllDataFromSupabase(parsed.id, parsed.username);
                  setupRealtime(parsed.id);
                }
              } catch (e) {
                console.warn("Lỗi đọc user cũ:", e);
              }
            }
          }
        }
      } catch (e) {
        console.error("Lỗi trong quá trình khởi tạo Auth:", e);
      }
    };

    initializeAuth();

    // 2. Lắng nghe sự thay đổi trạng thái Auth của Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Sự kiện Auth thay đổi:', event);
      if (session?.user) {
        const userId = session.user.id;
        const email = session.user.email || '';
        
        if (currentUserId !== userId) {
          currentUserId = userId;
          syncAllDataFromSupabase(userId, email);
          setupRealtime(userId);
        }
      } else {
        currentUserId = null;
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        // Khi người dùng đăng xuất, dọn dẹp sạch LocalStorage và khôi phục dữ liệu mẫu cục bộ
        const current = localStorage.getItem('CURRENT_USER');
        if (current) {
          const parsed = JSON.parse(current);
          if (parsed.username.includes('@')) {
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_SEARCH`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_TYPE`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_SORT_BY`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_SORT_ORDER`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_GROUPED`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_BRANCH`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_WAREHOUSE`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_FROM_DATE`);
            localStorage.removeItem(`${parsed.username}_HISTORY_FILTER_TO_DATE`);

            setCurrentUser(null);
            localStorage.removeItem('CURRENT_USER');
            
            setSanPhams([]);
            setNhapXuats([]);
            setNhapXuatCTs([]);
            setKiemKhos([]);
            setThuongHieus([]);
            setChiNhanhs([]);
            setNhanViens([]);

            localStorage.removeItem('B_SANPHAM');
            localStorage.removeItem('B_NHAPXUAT');
            localStorage.removeItem('B_NHAPXUATCT');
            localStorage.removeItem('B_KIEMKHO');
            localStorage.removeItem('B_THUONGHIEU');
            localStorage.removeItem('B_CHINHANH');
            localStorage.removeItem('B_NHANVIEN');
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, []);


  // --- 3. ĐIỀU HƯỚNG TAB CHỨC NĂNG ---
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<{ 
    message: string; 
    type?: 'success' | 'warning' | 'error';
    id?: string;
  } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [prefilledSku, setPrefilledSku] = useState<string | null>(null);
  const [prefilledCartItems, setPrefilledCartItems] = useState<{ sku: string; soLuong: number; }[] | null>(null);

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

  // Tự động tắt Toast theo loại (Thành công/Cảnh báo: 1 giây, Lỗi: 3.5 giây)
  useEffect(() => {
    if (successToast) {
      const duration = successToast.type === 'error' ? 3500 : 1000;
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

  // Lưu trữ dữ liệu vào localStorage tự động mỗi khi có bất kỳ thay đổi nào để đảm bảo tính thời gian thực
  useEffect(() => {
    localStorage.setItem('B_SANPHAM', JSON.stringify(sanPhams));
  }, [sanPhams]);

  useEffect(() => {
    localStorage.setItem('B_NHAPXUAT', JSON.stringify(nhapXuats));
  }, [nhapXuats]);

  useEffect(() => {
    localStorage.setItem('B_NHAPXUATCT', JSON.stringify(nhapXuatCTs));
  }, [nhapXuatCTs]);

  useEffect(() => {
    localStorage.setItem('B_KIEMKHO', JSON.stringify(kiemKhos));
  }, [kiemKhos]);

  useEffect(() => {
    localStorage.setItem('B_THUONGHIEU', JSON.stringify(thuongHieus));
  }, [thuongHieus]);

  useEffect(() => {
    localStorage.setItem('B_CHINHANH', JSON.stringify(chiNhanhs));
  }, [chiNhanhs]);

  useEffect(() => {
    localStorage.setItem('B_NHANVIEN', JSON.stringify(nhanViens));
  }, [nhanViens]);

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
    if (currentUser?.id) return currentUser.id;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch {
      return null;
    }
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
    setSanPhams(prev => prev.map(p => {
      if (cleanSKU(p.SKU) === normSku) {
        return { ...p, ...updatedFields };
      }
      return p;
    }));

    // Đồng bộ Supabase
    if (currentUser) {
      try {
        const uId = await getUserId();
        if (uId) {
          const productInState = sanPhams.find(p => cleanSKU(p.SKU) === normSku);
          if (productInState) {
            const finalProduct = { ...productInState, ...updatedFields };
            const res = await syncSanPham(finalProduct, uId);
            if (res.error) {
              setSyncError({
                table: 'b_sanpham',
                action: 'Cập nhật sản phẩm',
                message: res.error.message || JSON.stringify(res.error)
              });
            }
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật sản phẩm:', err);
        setSyncError({
          table: 'b_sanpham',
          action: 'Cập nhật sản phẩm',
          message: err.message || JSON.stringify(err)
        });
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
          p.CHIET_XUAT.trim() === chietXuat.trim() &&
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
            p.CHIET_XUAT.trim() === chietXuat.trim() &&
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
            p.CHIET_XUAT.trim() === chietXuat.trim() &&
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
                p.CHIET_XUAT.trim() === chietXuat.trim() &&
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
          const [res1, res2, res3] = await Promise.all([
            syncNhapXuat(finalizedHeader, uId),
            syncNhapXuatCTs(finalizedDetails, uId),
            syncSanPhams(updatedProductsList.filter(p => affectedSKUs.includes(cleanSKU(p.SKU))), uId)
          ]);
          const error = res1.error || res2.error || res3.error;
          if (error) {
            setSyncError({
              table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
              action: 'Lưu hóa đơn',
              message: error.message || JSON.stringify(error)
            });
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
   * Nghiệp vụ Kiểm kho định kỳ
   * Tự động sinh Số phiếu PKKxxxxxx và bù trừ chênh lệch trực tiếp vào tồn kho sản phẩm (Rule 8)
   * Đồng thời tự động tạo giao dịch điều chỉnh liên kết (PNKxxxxxx hoặc PXKxxxxxx)
   */
  const handleSaveAudit = async (newAuditOrAudits: KiemKho | KiemKho[]) => {
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
  const handleAddThuongHieu = async (brand: ThươngHieu) => {
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

  const handleUpdateThuongHieu = async (oldName: string, oldFeature: string, brand: ThươngHieu) => {
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
                  `Chúng tôi vui mừng thông báo rằng yêu cầu đăng ký tài khoản của bạn trên hệ thống Quản lý Xuất Nhập Tồn Tròng Kính Glass Stock Pro đã được Admin phê duyệt kích hoạt thành công!\n\n` +
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
                  `Trân trọng,\nBan Quản Trị Glass Stock Pro`;
                loaiEmail = "Phê duyệt";
              } else if (isPending && isRejected) {
                // Từ chối tài khoản
                title = "Yêu cầu đăng ký tài khoản bị từ chối";
                mailContent = `Chào ${staff.HO_TEN},\n\n` +
                  `Chúng tôi rất tiếc phải thông báo rằng yêu cầu đăng ký tài khoản của bạn trên hệ thống Glass Stock Pro đã bị từ chối bởi Quản trị viên hệ thống.\n\n` +
                  `Thông tin tài khoản đăng ký:\n` +
                  `- Họ và tên: ${staff.HO_TEN}\n` +
                  `- Tên đăng nhập: ${staff.TEN_DANG_NHAP}\n` +
                  `- Email liên hệ: ${staff.EMAIL}\n` +
                  `- Trạng thái: Bị từ chối (Rejected)\n\n` +
                  `Nếu có bất kỳ thắc mắc nào hoặc muốn biết thêm lý do, vui lòng liên hệ trực tiếp với Quản lý hoặc Admin để được hỗ trợ giải đáp.\n\n` +
                  `Trân trọng,\nBan Quản Trị Glass Stock Pro`;
                loaiEmail = "Từ chối";
              } else if (isBlocked) {
                // Khóa tài khoản
                title = "Tài khoản của bạn đã bị khóa";
                mailContent = `Chào ${staff.HO_TEN},\n\n` +
                  `Chúng tôi thông báo rằng tài khoản của bạn trên hệ thống Glass Stock Pro đã bị KHÓA (Blocked) bởi Ban Quản Trị.\n\n` +
                  `Thông tin chi tiết:\n` +
                  `- Họ và tên: ${staff.HO_TEN}\n` +
                  `- Tên đăng nhập: ${staff.TEN_DANG_NHAP || staff.EMAIL}\n` +
                  `- Trạng thái: Đã bị khóa (Blocked)\n\n` +
                  `Bạn sẽ không thể đăng nhập vào hệ thống kể từ thời điểm này. Nếu đây là một sự nhầm lẫn hoặc cần khôi phục tài khoản, vui lòng liên hệ trực tiếp với Admin hệ thống.\n\n` +
                  `Trân trọng,\nBan Quản Trị Glass Stock Pro`;
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
      setCurrentUser({
        username: found.EMAIL,
        fullName: found.HO_TEN,
        role: found.ROLE,
        branch: found.CHI_NHANH
      });
      
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
      <Login 
        nhanViens={nhanViens}
        onLoginSuccess={(user) => {
          // Khi đăng nhập, tìm kiếm NhanVien tương ứng để lấy writeAccess chính xác
          const email = user.username;
          const isOwner = email.toLowerCase() === 'nguyenkienduc.digital@gmail.com' || email.toLowerCase() === 'nguyennhanhoa.artist@gmail.com';
          const staffMember = nhanViens.find(n => n.EMAIL.toLowerCase() === email.toLowerCase());
          
          const cleanUser = {
            ...user,
            role: isOwner ? ('ADMIN' as const) : (staffMember?.ROLE || user.role),
            fullName: isOwner ? 'Nguyễn Nhân Hòa (Owner)' : (staffMember?.HO_TEN || user.fullName),
            branch: isOwner ? 'Kho Trung Tâm' : (staffMember?.CHI_NHANH || user.branch),
            writeAccess: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : user.writeAccess),
            WRITE_ACCESS: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : user.writeAccess)
          };
          setCurrentUser(cleanUser);
          localStorage.setItem('CURRENT_USER', JSON.stringify(cleanUser));

          // ĐỒNG BỘ DỮ LIỆU LẬP TỨC KHI ĐĂNG NHẬP THÀNH CÔNG!
          syncAllDataFromSupabase(cleanUser.id || '00000000-0000-0000-0000-000000000000', cleanUser.username);
          
          // Tự động chuyển hướng tab phù hợp
          if (cleanUser.role === 'NHAN_VIEN') {
            setActiveTab('TRANSACTION_XUAT');
          } else {
            setActiveTab('DASHBOARD');
          }
        }} 
      />
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
            Glass Stock Pro
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
                Glass Stock Pro
                <span className="text-[8px] bg-blue-500/20 text-blue-300 font-mono py-0.5 px-1.5 rounded-full uppercase">v4.0</span>
              </h1>
              <p className={`text-[9px] font-mono ${sidebarStyle.subText}`}>Quản Lý Xuất Nhập Tồn Tròng Kính</p>
            </div>
          </div>

          {/* Khi thu gọn, hiển thị Logo icon căn giữa */}
          {sidebarCollapsed && (
            <div className="p-2 rounded-xl shadow-md text-white" style={{ backgroundColor: accentHex }} title="Glass Stock Pro v4.0">
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
          {(hasPermission('export.create') || hasPermission('export.view')) && (
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
          {hasPermission('export.create') && (
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
          {hasPermission('import.create') && (
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
          {hasPermission('product.view') && (
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
          {hasPermission('product.view') && (
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
          {hasPermission('inventory.view') && (
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
          {(hasPermission('import.view') || hasPermission('export.view')) && (
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
          {(hasPermission('user.view') || hasPermission('role.view') || hasPermission('product.edit') || hasPermission('product.create')) && (
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
        </nav>

        {/* PHÂN VÙNG ĐỔI VAI NHANH - CHỈ HIỂN THỊ CHO TÀI KHOẢN ADMIN KHI CHƯA COLLAPSED */}
        {currentUser.role === 'ADMIN' && !sidebarCollapsed && (
          <div className={`p-4 mx-3 my-2 rounded-xl border shrink-0 space-y-3.5 ${sidebarStyle.switchBox}`}>
            <div>
              <div className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 ${sidebarStyle.switchText}`}>Mô phỏng đổi vai nhanh:</div>
              <select
                value={currentUser.username}
                onChange={(e) => handleSwitchUser(e.target.value)}
                className={`w-full text-[10px] font-bold rounded-lg px-2 py-1.5 focus:outline-hidden cursor-pointer ${sidebarStyle.switchSelect}`}
              >
                {nhanViens.map(n => (
                  <option key={n.EMAIL} value={n.EMAIL}>{n.HO_TEN} ({n.ROLE === 'ADMIN' ? 'Admin' : n.ROLE === 'KHO' ? 'Thủ kho' : 'Bán hàng'})</option>
                ))}
              </select>
            </div>

            <div className={`h-[1px] ${sidebarStyle.divider}`} />

            {/* QUYỀN HẠN INDICATOR */}
            <div className="flex items-center justify-between text-[10px]">
              <span className={`font-semibold ${sidebarStyle.switchText}`}>Quyền ghi dữ liệu:</span>
              <span className={`font-bold py-0.5 px-2 rounded-full font-mono text-[9px] ${currentUser.writeAccess !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {currentUser.writeAccess !== false ? 'FULL ACCESS' : 'READ ONLY'}
              </span>
            </div>

            {/* SUPABASE STATUS INDICATOR */}
            {currentUser && (
              <div className={`flex items-center justify-between text-[10px] pt-1.5 border-t ${sidebarStyle.divider}`}>
                <span className={`font-semibold ${sidebarStyle.switchText}`}>Supabase Cloud:</span>
                {loadingDb ? (
                  <span className="text-blue-400 animate-pulse font-bold text-[9px] flex items-center gap-1 font-mono">
                    <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-ping" />
                    SYNCING...
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold text-[9px] flex items-center gap-1 font-mono">
                    <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full" />
                    CONNECTED
                  </span>
                )}
              </div>
            )}
          </div>
        )}

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
                {activeTab === 'ORDER_PARSER' && (hasPermission('export.create') || hasPermission('export.view')) && (
                  <OrderParser
                    sanPhams={sanPhams}
                    brandList={thuongHieus}
                    onCreateXuatPhieu={(items) => {
                      setPrefilledCartItems(items);
                      setActiveTab('TRANSACTION_XUAT');
                    }}
                  />
                )}

                {activeTab === 'TRANSACTION_NHAP' && hasPermission('import.create') && (
                  <TransactionForm
                    currentUser={currentUser}
                    sanPhams={sanPhams}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    loaiPhieuMacDinh="NHẬP"
                    prefilledSku={prefilledSku || undefined}
                    onClearPrefilledSku={() => setPrefilledSku(null)}
                    prefilledCartItems={prefilledCartItems || undefined}
                    onClearPrefilledCartItems={() => setPrefilledCartItems(null)}
                    onSaveTransaction={handleSaveTransaction}
                    onNavigateToHistory={() => setActiveTab('HISTORY')}
                    onTriggerToast={(msg) => setSuccessToast({ show: true, message: msg, type: 'success' })}
                  />
                )}

                {activeTab === 'TRANSACTION_XUAT' && hasPermission('export.create') && (
                  <TransactionForm
                    currentUser={currentUser}
                    sanPhams={sanPhams}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    loaiPhieuMacDinh="XUẤT"
                    prefilledSku={prefilledSku || undefined}
                    onClearPrefilledSku={() => setPrefilledSku(null)}
                    prefilledCartItems={prefilledCartItems || undefined}
                    onClearPrefilledCartItems={() => setPrefilledCartItems(null)}
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
                    onQuickRestock={(sku) => {
                      setPrefilledSku(sku);
                      setActiveTab('TRANSACTION_NHAP'); // Lập phiếu nhập kho trực tiếp
                    }}
                  />
                )}

                {activeTab === 'PRODUCT' && hasPermission('product.view') && (
                  <ProductManagement 
                    currentUser={currentUser}
                    sanPhams={sanPhams}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    thuongHieus={listBranchNames}
                    brandList={thuongHieus}
                  />
                )}

                {activeTab === 'MATRIX' && hasPermission('product.view') && (
                  <DiopterMatrix 
                    currentUser={currentUser}
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

                {activeTab === 'AUDIT' && hasPermission('inventory.view') && (
                  <InventoryAudit 
                    currentUser={currentUser}
                    sanPhams={sanPhams}
                    kiemKhos={kiemKhos}
                    onSaveAudit={handleSaveAudit}
                    thuongHieus={listBrandNames}
                    brandList={thuongHieus}
                    chiNhanhs={listBranchNames}
                  />
                )}

                {activeTab === 'HISTORY' && (hasPermission('import.view') || hasPermission('export.view')) && (
                  <TransactionHistory 
                    currentUser={currentUser}
                    sanPhams={sanPhams}
                    nhapXuats={
                      // Nhân viên chỉ được xem lịch sử phiếu của chính bản thân tạo ra
                      currentUser.role === 'NHAN_VIEN'
                        ? nhapXuats.filter(h => h.NGUOI_TAO === currentUser.username)
                        : nhapXuats
                    }
                    nhapXuatCTs={nhapXuatCTs}
                    kiemKhos={kiemKhos}
                    onUpdateTransaction={handleUpdateTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    onHardDeleteTransaction={handleHardDeleteTransaction}
                    onSaveTransaction={handleSaveTransaction}
                    chiNhanhs={listBranchNames}
                    thuongHieus={listBrandNames}
                  />
                )}

                {activeTab === 'CATEGORY' && (hasPermission('user.view') || hasPermission('role.view') || hasPermission('product.edit') || hasPermission('product.create')) && (
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
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* FOOTER CHUYÊN NGHIỆP */}
        <footer className="footer-theme border-t py-3 text-center text-[10px] shrink-0 font-medium shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
          <p className="flex items-center justify-center gap-1.5 text-desc-color">
            <span>© 2026 Glass Stock Pro. Thiết kế & vận hành bởi Nguyễn Kiến Đức.</span>
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
        <AnimatePresence mode="wait">
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

