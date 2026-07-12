/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  ClipboardCheck, 
  History, 
  FolderTree, 
  Terminal, 
  Shield, 
  AlertTriangle, 
  X, 
  UserCheck,
  Eye,
  Info,
  LogOut,
  Menu,
  Home as HomeIcon,
  ChevronLeft,
  ChevronRight,
  User as UserProfileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Home from './components/Home';

// Import Types và Mock Data
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, UserRole, User, ThươngHieu, ChiNhanh, NhanVien } from './types';
import { 
  MOCK_SAN_PHAM, 
  MOCK_NHAP_XUAT, 
  MOCK_NHAP_XUAT_CT, 
  MOCK_KIEM_KHO, 
  MOCK_THUONG_HIEU, 
  MOCK_CHI_NHANH, 
  MOCK_NHAN_VIEN 
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
  deleteNhapXuatAndDetails,
  deleteThuongHieu,
  deleteChiNhanh,
  deleteNhanVien
} from './supabaseSync';

// Import Components con
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProductManagement from './components/ProductManagement';
import TransactionForm from './components/TransactionForm';
import InventoryAudit from './components/InventoryAudit';
import TransactionHistory from './components/TransactionHistory';
import CategoryManagement from './components/CategoryManagement';
import AppsScriptExporter from './components/AppsScriptExporter';
import UserProfile from './components/UserProfile';

/**
 * FILE: App.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Nhịp đập trung tâm của ứng dụng Quản lý Xuất Nhập Tồn Tròng Kính.
 *        Quản lý tập trung toàn bộ cơ sở dữ liệu State cục bộ (giả lập Google Sheets),
 *        triển khai các thuật toán xử lý nghiệp vụ, tự động cân bằng kho, rollback tồn kho
 *        và hệ thống phân quyền ba tầng nghiêm ngặt (Admin, Kho, Nhân viên).
 */

export default function App() {
  // --- 1. KHỞI TẠO STATE CƠ SỞ DỮ LIỆU ĐỒNG BỘ LOCALSTORAGE ---
  const [sanPhams, setSanPhams] = useState<SanPham[]>(() => {
    const saved = localStorage.getItem('B_SANPHAM');
    return saved ? JSON.parse(saved) : MOCK_SAN_PHAM;
  });

  const [nhapXuats, setNhapXuats] = useState<NhapXuat[]>(() => {
    const saved = localStorage.getItem('B_NHAPXUAT');
    return saved ? JSON.parse(saved) : MOCK_NHAP_XUAT;
  });

  const [nhapXuatCTs, setNhapXuatCTs] = useState<NhapXuatCT[]>(() => {
    const saved = localStorage.getItem('B_NHAPXUATCT');
    return saved ? JSON.parse(saved) : MOCK_NHAP_XUAT_CT;
  });

  const [kiemKhos, setKiemKhos] = useState<KiemKho[]>(() => {
    const saved = localStorage.getItem('B_KIEMKHO');
    return saved ? JSON.parse(saved) : MOCK_KIEM_KHO;
  });

  const [thuongHieus, setThuongHieus] = useState<ThươngHieu[]>(() => {
    const saved = localStorage.getItem('B_THUONGHIEU');
    return saved ? JSON.parse(saved) : MOCK_THUONG_HIEU;
  });

  const [chiNhanhs, setChiNhanhs] = useState<ChiNhanh[]>(() => {
    const saved = localStorage.getItem('B_CHINHANH');
    return saved ? JSON.parse(saved) : MOCK_CHI_NHANH;
  });

  const [nhanViens, setNhanViens] = useState<NhanVien[]>(() => {
    const saved = localStorage.getItem('B_NHANVIEN');
    return saved ? JSON.parse(saved) : MOCK_NHAN_VIEN;
  });

  const [loadingDb, setLoadingDb] = useState<boolean>(false);

  // --- 2. QUẢN LÝ NGƯỜI DÙNG HIỆN TẠI & PHÂN QUYỀN CHẶT CHẼ ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('CURRENT_USER');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = async () => {
    setCurrentUser(null);
    localStorage.removeItem('CURRENT_USER');
    await supabase.auth.signOut();
  };

  // Hàm tải dữ liệu chuyên biệt từ Supabase Cloud và gán đồng bộ vào State và LocalStorage
  const syncAllDataFromSupabase = async (userId: string, email: string) => {
    setLoadingDb(true);
    try {
      console.log('Bắt đầu đồng bộ dữ liệu mới nhất từ Supabase Cloud cho tài khoản:', email);
      const payload = await ensureUserOnboarded(userId);
      setSanPhams(payload.sanPhams);
      setNhapXuats(payload.nhapXuats);
      setNhapXuatCTs(payload.nhapXuatCTs);
      setKiemKhos(payload.kiemKhos);
      setThuongHieus(payload.thuongHieus);
      setChiNhanhs(payload.chiNhanhs);
      setNhanViens(payload.nhanViens);

      // Lưu trữ đồng bộ tức thì vào LocalStorage để đảm bảo tính sẵn sàng
      localStorage.setItem('B_SANPHAM', JSON.stringify(payload.sanPhams));
      localStorage.setItem('B_NHAPXUAT', JSON.stringify(payload.nhapXuats));
      localStorage.setItem('B_NHAPXUATCT', JSON.stringify(payload.nhapXuatCTs));
      localStorage.setItem('B_KIEMKHO', JSON.stringify(payload.kiemKhos));
      localStorage.setItem('B_THUONGHIEU', JSON.stringify(payload.thuongHieus));
      localStorage.setItem('B_CHINHANH', JSON.stringify(payload.chiNhanhs));
      localStorage.setItem('B_NHANVIEN', JSON.stringify(payload.nhanViens));

      // Cập nhật quyền ghi dữ liệu của currentUser dựa trên danh sách nhân viên vừa nạp
      const staffMember = payload.nhanViens.find(n => n.EMAIL.toLowerCase() === email.toLowerCase());
      const isOwner = email.toLowerCase() === 'nguyenkienduc.digital@gmail.com';
      
      const u: User = {
        username: email,
        fullName: isOwner ? 'Nguyễn Kiến Đức' : (staffMember?.HO_TEN || email.split('@')[0]),
        role: isOwner ? 'ADMIN' : (staffMember?.ROLE || 'NHAN_VIEN'),
        branch: isOwner ? 'Kho Trung Tâm' : (staffMember?.CHI_NHANH || 'Kho Trung Tâm'),
        writeAccess: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false),
        WRITE_ACCESS: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : false)
      };
      setCurrentUser(u);
      localStorage.setItem('CURRENT_USER', JSON.stringify(u));
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

            // Nếu dữ liệu thay đổi thuộc về user hiện tại, tự động reload lại toàn bộ
            if (rowUserId === userId) {
              console.log('Phát hiện thay đổi dữ liệu của bạn trên Supabase Cloud. Tiến hành đồng bộ thời gian thực tự động...');
              try {
                const payloadDb = await ensureUserOnboarded(userId);
                setSanPhams(payloadDb.sanPhams);
                setNhapXuats(payloadDb.nhapXuats);
                setNhapXuatCTs(payloadDb.nhapXuatCTs);
                setKiemKhos(payloadDb.kiemKhos);
                setThuongHieus(payloadDb.thuongHieus);
                setChiNhanhs(payloadDb.chiNhanhs);
                setNhanViens(payloadDb.nhanViens);

                // Cập nhật LocalStorage tức thì
                localStorage.setItem('B_SANPHAM', JSON.stringify(payloadDb.sanPhams));
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

    // 1. Kiểm tra session ngay khi trang web khởi chạy (Khắc phục triệt để lỗi F5 không cập nhật dữ liệu)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userId = session.user.id;
        const email = session.user.email || '';
        currentUserId = userId;
        console.log('Phát hiện session hợp lệ khi khởi chạy. Thực hiện tải dữ liệu mới nhất từ Supabase Cloud...');
        syncAllDataFromSupabase(userId, email);
        setupRealtime(userId);
      }
    });

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
            setCurrentUser(null);
            localStorage.removeItem('CURRENT_USER');
            
            setSanPhams(MOCK_SAN_PHAM);
            setNhapXuats(MOCK_NHAP_XUAT);
            setNhapXuatCTs(MOCK_NHAP_XUAT_CT);
            setKiemKhos(MOCK_KIEM_KHO);
            setThuongHieus(MOCK_THUONG_HIEU);
            setChiNhanhs(MOCK_CHI_NHANH);
            setNhanViens(MOCK_NHAN_VIEN);

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


  // --- 3. ĐIỀU HƯỚNG TAB CHỨC NĂNG VÀ LỊCH SỬ TAB ---
  const [activeTab, setActiveTab] = useState<string>('HOME');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [tabHistory, setTabHistory] = useState<string[]>(['HOME']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const changeTab = (tabName: string) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false);
    
    // Thêm tab mới vào lịch sử, cắt bớt phần phía sau nếu chúng ta vừa Back
    setTabHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      if (next[next.length - 1] !== tabName) {
        next.push(tabName);
        setHistoryIndex(next.length - 1);
      }
      return next;
    });
  };

  const handleBackTab = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setActiveTab(tabHistory[newIndex]);
    }
  };

  const handleForwardTab = () => {
    if (historyIndex < tabHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setActiveTab(tabHistory[newIndex]);
    }
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

  // --- 5. HÀM THAO TÁC NGHIỆP VỤ (VỚI COMMENT SÂU SẮC NHƯ LÃO TƯỚNG 30 NĂM TUỔI NGHỀ) ---

  /**
   * Nghiệp vụ Thêm sản phẩm tròng kính mới vào danh mục
   */
  const handleAddProduct = async (newProduct: SanPham) => {
    setSanPhams(prev => [...prev, newProduct]);

    // Đồng bộ Supabase
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await syncSanPham(newProduct, user.id);
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
  };

  /**
   * Nghiệp vụ Chỉnh sửa Tồn tối thiểu trực tiếp của Sản phẩm
   */
  const handleUpdateMinStock = async (sku: string, newMinStock: number) => {
    let updatedProduct: SanPham | null = null;
    setSanPhams(prev => {
      const next = prev.map(p => {
        if (p.SKU === sku) {
          updatedProduct = { ...p, TON_TOI_THIEU: newMinStock };
          return updatedProduct;
        }
        return p;
      });
      return next;
    });

    // Đồng bộ lên Supabase Cloud
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && updatedProduct) {
          const res = await syncSanPham(updatedProduct, user.id);
          if (res.error) {
            setSyncError({
              table: 'b_sanpham',
              action: 'Cập nhật Tồn tối thiểu',
              message: res.error.message || JSON.stringify(res.error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync cập nhật Tồn tối thiểu:', err);
        setSyncError({
          table: 'b_sanpham',
          action: 'Cập nhật Tồn tối thiểu',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  /**
   * Nghiệp vụ Lưu phiếu Nhập / Phiếu Xuất kho
   * Tự động sinh Số hóa đơn (PNxxxxxx, PXxxxxxx) tăng dần chính xác
   */
  const handleSaveTransaction = async (header: NhapXuat, details: NhapXuatCT[]) => {
    const prefix = header.LOAI === 'NHẬP' ? 'PN' : 'PX';
    
    // Tìm số hóa đơn lớn nhất có cùng tiền tố
    let maxNum = 0;
    nhapXuats.forEach(h => {
      if (h.HOA_DON.startsWith(prefix)) {
        const numPart = parseInt(h.HOA_DON.substring(2), 10);
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
    setNhapXuats(prev => [...prev, finalizedHeader]);
    setNhapXuatCTs(prev => [...prev, ...finalizedDetails]);

    // Cập nhật số lượng nhập, xuất, và tồn cuối trực tiếp vào bảng sản phẩm ngay lập tức
    let updatedProducts: SanPham[] = [];
    setSanPhams(prevProducts => {
      const next = prevProducts.map(p => {
        // Tìm xem sản phẩm này có phát sinh trong chi tiết phiếu vừa lưu hay không
        const itemsInDetails = finalizedDetails.filter(d => d.SKU === p.SKU);
        if (itemsInDetails.length > 0) {
          const deltaQty = itemsInDetails.reduce((sum, d) => sum + d.SO_LUONG, 0);
          
          let newNhap = p.NHAP;
          let newXuat = p.XUAT;

          if (finalizedHeader.LOAI === 'NHẬP') {
            newNhap += deltaQty;
          } else {
            newXuat += deltaQty;
          }

          const newTonCuoi = p.TON_DAU + newNhap - newXuat; // Rule 7

          return {
            ...p,
            NHAP: newNhap,
            XUAT: newXuat,
            TON_CUOI: newTonCuoi
          };
        }
        return p;
      });
      updatedProducts = next;
      return next;
    });

    // Đồng bộ Supabase
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [res1, res2, res3] = await Promise.all([
            syncNhapXuat(finalizedHeader, user.id),
            syncNhapXuatCTs(finalizedDetails, user.id),
            syncSanPhams(updatedProducts.filter(p => finalizedDetails.some(fd => fd.SKU === p.SKU)), user.id)
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
      }
    }
  };

  /**
   * Nghiệp vụ Kiểm kho định kỳ
   * Tự động sinh Số phiếu PKKxxxxxx và bù trừ chênh lệch trực tiếp vào tồn kho sản phẩm (Rule 8)
   */
  const handleSaveAudit = async (newAudit: KiemKho) => {
    let maxNum = 0;
    kiemKhos.forEach(k => {
      if (k.MA_PHIEU.startsWith('PKK')) {
        const numPart = parseInt(k.MA_PHIEU.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    });

    const newAuditId = `PKK${String(maxNum + 1).padStart(6, '0')}`;
    const finalizedAudit: KiemKho = {
      ...newAudit,
      MA_PHIEU: newAuditId
    };

    setKiemKhos(prev => [...prev, finalizedAudit]);

    // Đồng bộ lượng chênh lệch kiểm kê bù trừ trực tiếp vào sản phẩm tương ứng (B_SANPHAM)
    let updatedProducts: SanPham[] = [];
    setSanPhams(prevProducts => {
      const next = prevProducts.map(p => {
        if (p.SKU === finalizedAudit.SKU) {
          let newNhap = p.NHAP;
          let newXuat = p.XUAT;
          const lech = finalizedAudit.LECH;

          if (lech > 0) {
            newNhap += lech; // Nhập bù
          } else if (lech < 0) {
            newXuat += Math.abs(lech); // Xuất bù
          }

          const newTonCuoi = p.TON_DAU + newNhap - newXuat;

          return {
            ...p,
            NHAP: newNhap,
            XUAT: newXuat,
            TON_CUOI: newTonCuoi
          };
        }
        return p;
      });
      updatedProducts = next;
      return next;
    });

    // Đồng bộ Supabase
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [res1, res2] = await Promise.all([
            syncKiemKho(finalizedAudit, user.id),
            syncSanPhams(updatedProducts.filter(p => p.SKU === finalizedAudit.SKU), user.id)
          ]);
          const error = res1.error || res2.error;
          if (error) {
            setSyncError({
              table: 'b_kiemkho / b_sanpham',
              action: 'Lưu phiếu kiểm kho',
              message: error.message || JSON.stringify(error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync kiểm kho:', err);
        setSyncError({
          table: 'b_kiemkho / b_sanpham',
          action: 'Lưu phiếu kiểm kho',
          message: err.message || JSON.stringify(err)
        });
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
    // 1. Cập nhật header trong danh sách
    setNhapXuats(prev => prev.map(h => h.HOA_DON === updatedHeader.HOA_DON ? updatedHeader : h));
    
    // 2. Ghi đè lại toàn bộ chi tiết mới (chỉ chứa sự thay đổi của dòng trong phiếu)
    setNhapXuatCTs(updatedDetails);

    // 3. Tái tính toán cục bộ cho các SKU bị ảnh hưởng
    let updatedProducts: SanPham[] = [];
    setSanPhams(prevProducts => {
      const next = prevProducts.map(p => {
        if (skusToRecalc.includes(p.SKU)) {
          // Tính tổng số lượng Nhập của SKU này từ toàn bộ dữ liệu chi tiết trong DB
          const totalNhap = updatedDetails
            .filter(d => d.SKU === p.SKU && d.LOAI === 'NHẬP')
            .reduce((sum, d) => sum + d.SO_LUONG, 0);

          // Tính tổng lượng Nhập bù từ lịch sử Kiểm kho
          const totalAuditNhapBu = kiemKhos
            .filter(k => k.SKU === p.SKU && k.LOAI_BU === 'NHẬP BÙ')
            .reduce((sum, k) => sum + k.LECH, 0);

          // Tính tổng số lượng Xuất của SKU này
          const totalXuat = updatedDetails
            .filter(d => d.SKU === p.SKU && d.LOAI === 'XUẤT')
            .reduce((sum, d) => sum + d.SO_LUONG, 0);

          // Tính tổng lượng Xuất bù từ lịch sử Kiểm kho
          const totalAuditXuatBu = kiemKhos
            .filter(k => k.SKU === p.SKU && k.LOAI_BU === 'XUẤT BÙ')
            .reduce((sum, k) => sum + Math.abs(k.LECH), 0);

          const finalNhap = totalNhap + totalAuditNhapBu;
          const finalXuat = totalXuat + totalAuditXuatBu;
          const finalTonCuoi = p.TON_DAU + finalNhap - finalXuat; // Rule 7

          return {
            ...p,
            NHAP: finalNhap,
            XUAT: finalXuat,
            TON_CUOI: finalTonCuoi
          };
        }
        return p;
      });
      updatedProducts = next;
      return next;
    });

    // Đồng bộ Supabase
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [res1, resDel] = await Promise.all([
            syncNhapXuat(updatedHeader, user.id),
            supabase.from('b_nhapxuatct').delete().eq('HOA_DON', updatedHeader.HOA_DON),
          ]);
          const [res2, res3] = await Promise.all([
            syncNhapXuatCTs(updatedDetails.filter(d => d.HOA_DON === updatedHeader.HOA_DON), user.id),
            syncSanPhams(updatedProducts.filter(p => skusToRecalc.includes(p.SKU)), user.id)
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
      }
    }
  };

  /**
   * HỦY PHIẾU VÀ HOÀN TÁC ROLLBACK TỒN KHO TRỌN VẸN (Rule 4)
   * Phục hồi lại số lượng tròng kính của tất cả SKU liên quan về nguyên trạng.
   */
  const handleDeleteTransaction = async (hoaDonId: string, skusToRecalc: string[]) => {
    // 1. Loại bỏ Header khỏi danh sách
    setNhapXuats(prev => prev.filter(h => h.HOA_DON !== hoaDonId));

    // 2. Loại bỏ toàn bộ dòng chi tiết liên quan
    const remainingDetails = nhapXuatCTs.filter(d => d.HOA_DON !== hoaDonId);
    setNhapXuatCTs(remainingDetails);

    // 3. Tái tính toán khôi phục kho cho các SKU bị ảnh hưởng (Rollback hoàn toàn)
    let updatedProducts: SanPham[] = [];
    setSanPhams(prevProducts => {
      const next = prevProducts.map(p => {
        if (skusToRecalc.includes(p.SKU)) {
          // Tính tổng lượng Nhập sau khi đã loại bỏ phiếu bị xóa
          const totalNhap = remainingDetails
            .filter(d => d.SKU === p.SKU && d.LOAI === 'NHẬP')
            .reduce((sum, d) => sum + d.SO_LUONG, 0);

          const totalAuditNhapBu = kiemKhos
            .filter(k => k.SKU === p.SKU && k.LOAI_BU === 'NHẬP BÙ')
            .reduce((sum, k) => sum + k.LECH, 0);

          // Tính tổng lượng Xuất sau khi loại bỏ phiếu
          const totalXuat = remainingDetails
            .filter(d => d.SKU === p.SKU && d.LOAI === 'XUẤT')
            .reduce((sum, d) => sum + d.SO_LUONG, 0);

          const totalAuditXuatBu = kiemKhos
            .filter(k => k.SKU === p.SKU && k.LOAI_BU === 'XUẤT BÙ')
            .reduce((sum, k) => sum + Math.abs(k.LECH), 0);

          const finalNhap = totalNhap + totalAuditNhapBu;
          const finalXuat = totalXuat + totalAuditXuatBu;
          const finalTonCuoi = p.TON_DAU + finalNhap - finalXuat;

          return {
            ...p,
            NHAP: finalNhap,
            XUAT: finalXuat,
            TON_CUOI: finalTonCuoi
          };
        }
        return p;
      });
      updatedProducts = next;
      return next;
    });

    // Đồng bộ Supabase
    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const [resDel, resSync] = await Promise.all([
            deleteNhapXuatAndDetails(hoaDonId),
            syncSanPhams(updatedProducts.filter(p => skusToRecalc.includes(p.SKU)), user.id)
          ]);
          const error = resDel.error || resSync.error;
          if (error) {
            setSyncError({
              table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
              action: 'Xóa hóa đơn',
              message: error.message || JSON.stringify(error)
            });
          }
        }
      } catch (err: any) {
        console.error('Lỗi sync xóa hóa đơn:', err);
        setSyncError({
          table: 'b_nhapxuat / b_nhapxuatct / b_sanpham',
          action: 'Xóa hóa đơn',
          message: err.message || JSON.stringify(err)
        });
      }
    }
  };

  // --- 6. PHƯƠNG THỨC THÊM MỚI DANH MỤC THƯƠNG HIỆU, CHI NHÁNH, NHÂN VIÊN ---
  const handleAddThuongHieu = async (brand: ThươngHieu) => {
    setThuongHieus(prev => [...prev, brand]);

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await syncThuongHieu(brand, user.id);
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
    setChiNhanhs(prev => [...prev, branch]);

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await syncChiNhanh(branch, user.id);
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
    setNhanViens(prev => [...prev, staff]);

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await syncNhanVien(staff, user.id);
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

  const handleUpdateThuongHieu = async (oldName: string, brand: ThươngHieu) => {
    setThuongHieus(prev => prev.map(t => t.THUONG_HIEU === oldName ? brand : t));
    
    // update sanPhams as well if brand name changes
    if (oldName !== brand.THUONG_HIEU) {
      setSanPhams(prev => prev.map(p => p.THUONG_HIEU === oldName ? { ...p, THUONG_HIEU: brand.THUONG_HIEU } : p));
    }

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (oldName !== brand.THUONG_HIEU) {
            await deleteThuongHieu(oldName, user.id);
          }
          const res = await syncThuongHieu(brand, user.id);
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

  const handleDeleteThuongHieu = async (brandName: string) => {
    setThuongHieus(prev => prev.filter(t => t.THUONG_HIEU !== brandName));

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await deleteThuongHieu(brandName, user.id);
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
    setChiNhanhs(prev => prev.map(c => c.CHI_NHANH === oldName ? branch : c));

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (oldName !== branch.CHI_NHANH) {
            await deleteChiNhanh(oldName, user.id);
          }
          const res = await syncChiNhanh(branch, user.id);
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
    setChiNhanhs(prev => prev.filter(c => c.CHI_NHANH !== branchName));

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await deleteChiNhanh(branchName, user.id);
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

  const handleUpdateNhanVien = async (oldEmail: string, staff: NhanVien) => {
    setNhanViens(prev => prev.map(n => n.EMAIL === oldEmail ? staff : n));

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (oldEmail !== staff.EMAIL) {
            await deleteNhanVien(oldEmail, user.id);
          }
          const res = await syncNhanVien(staff, user.id);
          if (res.error) {
            setSyncError({
              table: 'b_nhanvien',
              action: 'Cập nhật nhân viên',
              message: res.error.message || JSON.stringify(res.error)
            });
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
    setNhanViens(prev => prev.filter(n => n.EMAIL !== email));

    if (currentUser && currentUser.username.includes('@')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const res = await deleteNhanVien(email, user.id);
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
  const listBrandNames = useMemo(() => thuongHieus.map(t => t.THUONG_HIEU), [thuongHieus]);
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
      
      // Tự động chuyển tab về trang Trang Chủ mới cho mọi vai trò
      setActiveTab('HOME');
    }
  };

  if (!currentUser) {
    return (
      <Login 
        onLoginSuccess={(user) => {
          // Khi đăng nhập, tìm kiếm NhanVien tương ứng để lấy writeAccess chính xác
          const email = user.username;
          const isOwner = email.toLowerCase() === 'nguyenkienduc.digital@gmail.com';
          const staffMember = nhanViens.find(n => n.EMAIL.toLowerCase() === email.toLowerCase());
          
          const cleanUser = {
            ...user,
            role: isOwner ? ('ADMIN' as const) : (staffMember?.ROLE || user.role),
            fullName: isOwner ? 'Nguyễn Kiến Đức' : (staffMember?.HO_TEN || user.fullName),
            branch: isOwner ? 'Kho Trung Tâm' : (staffMember?.CHI_NHANH || user.branch),
            writeAccess: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : user.writeAccess),
            WRITE_ACCESS: isOwner ? true : (staffMember ? staffMember.WRITE_ACCESS : user.writeAccess)
          };
          setCurrentUser(cleanUser);
          localStorage.setItem('CURRENT_USER', JSON.stringify(cleanUser));
          
          // Tự động chuyển hướng về Trang Chủ mới sau khi đăng nhập thành công
          setActiveTab('HOME');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 antialiased flex flex-col md:flex-row">
      
      {/* HEADER DI ĐỘNG (HAMBURGER MENU) - Chỉ hiển thị trên thiết bị di động */}
      <header className="md:hidden bg-[#0f172a] text-white p-4 flex justify-between items-center border-b border-slate-800 z-50 sticky top-0 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1 text-slate-300 hover:text-white focus:outline-hidden cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-1.5">
            <div className="p-1.5 bg-red-600 rounded-lg text-white">
              <Boxes className="w-4 h-4" />
            </div>
            <h1 className="font-sans font-bold text-xs uppercase tracking-wider text-slate-100">
              Glass Stock Pro
            </h1>
          </div>
        </div>

        {/* NÚT BACK / FORWARD LỊCH SỬ TAB TRÊN DI ĐỘNG */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-0.5 rounded-lg border border-slate-800">
          <button 
            onClick={handleBackTab}
            disabled={historyIndex === 0}
            className={`p-1 rounded-md cursor-pointer transition-all ${historyIndex === 0 ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-300 hover:text-white hover:bg-slate-850'}`}
            title="Quay lại tab trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            onClick={handleForwardTab}
            disabled={historyIndex === tabHistory.length - 1}
            className={`p-1 rounded-md cursor-pointer transition-all ${historyIndex === tabHistory.length - 1 ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-300 hover:text-white hover:bg-slate-850'}`}
            title="Tiến tới tab sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* OVERLAY TỐI PHỦ KHI MENU MOBILE MỞ */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR DỌC BÊN TRÁI - Nav Tab ở bên trái theo yêu cầu của user, tự động ẩn trên mobile */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-72 md:w-68 lg:w-72 bg-[#0f172a] text-white shrink-0 flex flex-col border-r border-slate-800 transform md:transform-none transition-transform duration-200 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        
        {/* LOGO & BRAND */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3b82f6] rounded-xl shadow-md text-white">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-sm uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
                Glass Stock Pro
                <span className="text-[8px] bg-blue-500/20 text-blue-300 font-mono py-0.5 px-1.5 rounded-full uppercase">v4.0</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono">Quản Lý Xuất Nhập Tồn Tròng Kính</p>
            </div>
          </div>
          {/* Nút đóng Sidebar nhanh trên Mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* THÔNG TIN USER ĐANG ĐĂNG NHẬP */}
        <div className="p-4 mx-3 my-4 bg-slate-800/40 rounded-2xl border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {currentUser.fullName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-100 truncate">{currentUser.fullName}</p>
              <p className="text-[9px] font-mono font-bold text-blue-400 uppercase tracking-wider truncate">
                {currentUser.role === 'ADMIN' ? 'Chủ Cửa Hàng' : currentUser.role === 'KHO' ? 'Thủ Kho' : 'Nhân Viên'} | {currentUser.branch}
              </p>
            </div>
          </div>
        </div>

        {/* CÁC TABS ĐIỀU HƯỚNG DỌC (Nav Tab bên trái) */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          
          {/* TAB 0: TRANG CHỦ */}
          <button
            onClick={() => changeTab('HOME')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'HOME' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <HomeIcon className="w-4 h-4 shrink-0 text-slate-300" /> 
            <span>Trang Chủ</span>
          </button>

          {/* TAB 1: LẬP PHIẾU XUẤT */}
          <button
            onClick={() => changeTab('TRANSACTION_XUAT')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'TRANSACTION_XUAT' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <TrendingDown className="w-4 h-4 shrink-0 text-rose-500" /> 
            <span>Lập Phiếu Xuất</span>
          </button>

          {/* TAB 2: LẬP PHIẾU NHẬP */}
          <button
            onClick={() => changeTab('TRANSACTION_NHAP')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'TRANSACTION_NHAP' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0 text-emerald-500" /> 
            <span>Lập Phiếu Nhập</span>
          </button>

          {/* TAB 3: DASHBOARD */}
          {currentUser.role !== 'NHAN_VIEN' && (
            <button
              onClick={() => changeTab('DASHBOARD')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'DASHBOARD' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0 text-blue-500" /> 
              <span>Dashboard</span>
            </button>
          )}

          {/* TAB 4: QUẢN LÝ SẢN PHẨM */}
          <button
            onClick={() => changeTab('PRODUCT')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'PRODUCT' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Boxes className="w-4 h-4 shrink-0 text-amber-500" /> 
            <span>Sản phẩm</span>
          </button>

          {/* TAB 5: KIỂM KHO */}
          {currentUser.role !== 'NHAN_VIEN' && (
            <button
              onClick={() => changeTab('AUDIT')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'AUDIT' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ClipboardCheck className="w-4 h-4 shrink-0 text-violet-500" /> 
              <span>Kiểm Kê Kho</span>
            </button>
          )}

          {/* TAB 6: LỊCH SỬ XUẤT NHẬP */}
          <button
            onClick={() => changeTab('HISTORY')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'HISTORY' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <History className="w-4 h-4 shrink-0 text-indigo-500" /> 
            <span>Lịch sử xuất nhập</span>
          </button>

          {/* TAB THÔNG TIN CÁ NHÂN & BẢO MẬT */}
          <button
            onClick={() => changeTab('PROFILE')}
            className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
              activeTab === 'PROFILE' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <UserProfileIcon className="w-4 h-4 shrink-0 text-amber-500" /> 
            <span>Tài Khoản Của Tôi</span>
          </button>

          {/* TAB 7: QUẢN LÝ NGƯỜI DÙNG */}
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => changeTab('USER_MGMT')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'USER_MGMT' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0 text-pink-500" /> 
              <span>Quản Lý Người Dùng</span>
            </button>
          )}

          {/* TAB 8: CÀI ĐẶT DANH MỤC */}
          {currentUser.role === 'ADMIN' && (
            <button
              onClick={() => changeTab('CATEGORY')}
              className={`w-full py-2.5 px-3.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 cursor-pointer ${
                activeTab === 'CATEGORY' ? 'bg-red-600 text-white shadow-md shadow-red-600/15' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <FolderTree className="w-4 h-4 shrink-0 text-teal-500" /> 
              <span>Cài Đặt Danh Mục</span>
            </button>
          )}
        </nav>

        {/* PHÂN VÙNG ĐỔI VAI NHANH - DI CHUYỂN XUỐNG DƯỚI THEO YÊU CẦU */}
        <div className="p-4 mx-3 my-2 bg-slate-900/40 rounded-xl border border-slate-800/60 shrink-0 space-y-3.5">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Mô phỏng đổi vai nhanh:</div>
            <select
              value={currentUser.username}
              onChange={(e) => handleSwitchUser(e.target.value)}
              className="w-full text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300 rounded-lg px-2 py-1.5 focus:outline-hidden cursor-pointer"
            >
              {nhanViens.map(n => (
                <option key={n.EMAIL} value={n.EMAIL}>{n.HO_TEN} ({n.ROLE === 'ADMIN' ? 'Admin' : n.ROLE === 'KHO' ? 'Thủ kho' : 'Bán hàng'})</option>
              ))}
            </select>
          </div>

          <div className="h-[1px] bg-slate-800/80" />

          {/* QUYỀN HẠN INDICATOR */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400 font-semibold">Quyền ghi dữ liệu:</span>
            <span className={`font-bold py-0.5 px-2 rounded-full font-mono text-[9px] ${currentUser.writeAccess !== false ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
              {currentUser.writeAccess !== false ? 'FULL ACCESS' : 'READ ONLY'}
            </span>
          </div>

          {/* SUPABASE STATUS INDICATOR */}
          {currentUser.username.includes('@') && (
            <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-800/80">
              <span className="text-slate-400 font-semibold">Supabase Cloud:</span>
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

        {/* NÚT ĐĂNG XUẤT Ở CUỐI SIDEBAR */}
        <div className="p-4 border-t border-slate-800 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3.5 bg-red-600/10 hover:bg-red-650 border border-red-500/20 hover:border-red-600 text-red-400 hover:text-white text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất hệ thống</span>
          </button>
        </div>

      </aside>

      {/* KHU VỰC CHÍNH BÊN PHẢI (MAIN CONTENT AREA) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* HEADER DESKTOP (NAVIGATION HELPERS) - Chỉ hiển thị trên Desktop */}
        <header className="hidden md:flex bg-white border-b border-slate-100 py-3.5 px-6 items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
              <button 
                onClick={handleBackTab}
                disabled={historyIndex === 0}
                className={`p-1 rounded-md cursor-pointer transition-all ${historyIndex === 0 ? 'text-slate-300 cursor-not-allowed opacity-40' : 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-2xs'}`}
                title="Quay lại tab trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleForwardTab}
                disabled={historyIndex === tabHistory.length - 1}
                className={`p-1 rounded-md cursor-pointer transition-all ${historyIndex === tabHistory.length - 1 ? 'text-slate-300 cursor-not-allowed opacity-40' : 'text-slate-600 hover:text-slate-900 hover:bg-white hover:shadow-2xs'}`}
                title="Tiến tới tab sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
              Phân hệ: <span className="text-slate-800 font-sans normal-case">
                {activeTab === 'HOME' ? 'Trang Chủ' : 
                 activeTab === 'TRANSACTION_XUAT' ? 'Lập Phiếu Xuất Kho' : 
                 activeTab === 'TRANSACTION_NHAP' ? 'Lập Phiếu Nhập Kho' : 
                 activeTab === 'DASHBOARD' ? 'Dashboard Thống Kê' : 
                 activeTab === 'PRODUCT' ? 'Quản Lý Sản Phẩm' : 
                 activeTab === 'AUDIT' ? 'Kiểm Kê Kho' : 
                 activeTab === 'HISTORY' ? 'Lịch Sử Xuất Nhập' : 
                 activeTab === 'PROFILE' ? 'Tài Khoản & Bảo Mật' : 
                 activeTab === 'USER_MGMT' ? 'Quản Lý Người Dùng & Phân Quyền' : 
                 activeTab === 'CATEGORY' ? 'Cài Đặt Danh Mục' : activeTab}
              </span>
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-blue-50/80 text-blue-600 font-bold px-2.5 py-1 rounded-full uppercase border border-blue-100/50">
              {currentUser.role === 'ADMIN' ? 'Quản trị viên' : currentUser.role === 'KHO' ? 'Thủ kho' : 'Nhân viên'}
            </span>
            <span className="text-xs text-slate-300 font-medium">|</span>
            <span className="text-xs text-slate-500 font-semibold">{currentUser.branch}</span>
          </div>
        </header>

        {/* THANH THÔNG BÁO CẢNH BÁO TỒN KHO THẤP */}
        <AnimatePresence>
          {lowStockAlerts.length > 0 && showNotificationBanner && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-50 border-b border-red-100 px-4 py-2 text-xs flex items-center justify-between gap-3 text-red-700 shrink-0 animate-fade-in"
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
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
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
              {activeTab === 'HOME' && (
                <Home 
                  currentUser={currentUser}
                  setActiveTab={changeTab}
                  lowStockCount={lowStockAlerts.length}
                />
              )}

              {activeTab === 'DASHBOARD' && currentUser.role !== 'NHAN_VIEN' && (
                <Dashboard 
                  sanPhams={sanPhams}
                  nhapXuats={nhapXuats}
                  nhapXuatCTs={nhapXuatCTs}
                  chiNhanhs={listBranchNames}
                />
              )}

              {activeTab === 'PRODUCT' && (
                <ProductManagement 
                  currentUser={currentUser}
                  sanPhams={sanPhams}
                  onAddProduct={handleAddProduct}
                  thuongHieus={listBrandNames}
                  onUpdateMinStock={handleUpdateMinStock}
                />
              )}

              {activeTab === 'TRANSACTION_XUAT' && (
                <TransactionForm 
                  currentUser={currentUser}
                  sanPhams={sanPhams}
                  chiNhanhs={listBranchNames}
                  thuongHieus={listBrandNames}
                  loaiPhieuMacDinh="XUẤT"
                  onSaveTransaction={handleSaveTransaction}
                  onNavigateToHistory={() => changeTab('HISTORY')}
                />
              )}

              {activeTab === 'TRANSACTION_NHAP' && (
                <TransactionForm 
                  currentUser={currentUser}
                  sanPhams={sanPhams}
                  chiNhanhs={listBranchNames}
                  thuongHieus={listBrandNames}
                  loaiPhieuMacDinh="NHẬP"
                  onSaveTransaction={handleSaveTransaction}
                  onNavigateToHistory={() => changeTab('HISTORY')}
                />
              )}

              {activeTab === 'AUDIT' && currentUser.role !== 'NHAN_VIEN' && (
                <InventoryAudit 
                  currentUser={currentUser}
                  sanPhams={sanPhams}
                  kiemKhos={kiemKhos}
                  onSaveAudit={handleSaveAudit}
                />
              )}

              {activeTab === 'HISTORY' && (
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
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {activeTab === 'PROFILE' && (
                <UserProfile 
                  currentUser={currentUser}
                  nhanViens={nhanViens}
                  onUpdateNhanVien={handleUpdateNhanVien}
                  onUpdateCurrentUser={setCurrentUser}
                />
              )}

              {activeTab === 'USER_MGMT' && currentUser.role === 'ADMIN' && (
                <CategoryManagement 
                  currentUser={currentUser}
                  thuongHieus={thuongHieus}
                  chiNhanhs={chiNhanhs}
                  nhanViens={nhanViens}
                  onAddThuongHieu={handleAddThuongHieu}
                  onAddChiNhanh={handleAddChiNhanh}
                  onAddNhanVien={handleAddNhanVien}
                  onUpdateThuongHieu={handleUpdateThuongHieu}
                  onDeleteThuongHieu={handleDeleteThuongHieu}
                  onUpdateChiNhanh={handleUpdateChiNhanh}
                  onDeleteChiNhanh={handleDeleteChiNhanh}
                  onUpdateNhanVien={handleUpdateNhanVien}
                  onDeleteNhanVien={handleDeleteNhanVien}
                  onlyStaff={true}
                />
              )}

              {activeTab === 'CATEGORY' && currentUser.role === 'ADMIN' && (
                <CategoryManagement 
                  currentUser={currentUser}
                  thuongHieus={thuongHieus}
                  chiNhanhs={chiNhanhs}
                  nhanViens={nhanViens}
                  onAddThuongHieu={handleAddThuongHieu}
                  onAddChiNhanh={handleAddChiNhanh}
                  onAddNhanVien={handleAddNhanVien}
                  onUpdateThuongHieu={handleUpdateThuongHieu}
                  onDeleteThuongHieu={handleDeleteThuongHieu}
                  onUpdateChiNhanh={handleUpdateChiNhanh}
                  onDeleteChiNhanh={handleDeleteChiNhanh}
                  onUpdateNhanVien={handleUpdateNhanVien}
                  onDeleteNhanVien={handleDeleteNhanVien}
                  onlyStaff={false}
                />
              )}

              {activeTab === 'APPS_SCRIPT' && (
                <AppsScriptExporter />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* FOOTER CHUYÊN NGHIỆP */}
        <footer className="bg-white border-t border-[#e2e8f0] py-3 text-center text-[10px] text-[#64748b] shrink-0 font-medium shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
          <p className="flex items-center justify-center gap-1.5">
            <span>© 2026 Glass Stock Pro. Thiết kế & vận hành bởi Nguyễn Kiến Đức.</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono text-blue-500">Cập nhật thời gian thực bằng Google Apps Script & Sheets</span>
          </p>
        </footer>

      </div>

    </div>
  );
}

