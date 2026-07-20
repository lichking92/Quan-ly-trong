/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Check, 
  AlertCircle, 
  Calendar, 
  User, 
  HelpCircle,
  Clock,
  RotateCcw,
  MapPin,
  FileText,
  Plus,
  Trash2,
  SlidersHorizontal,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, KiemKho, User as UserType, ThuongHieu } from '../types';
import { generateSKUString, formatDop, getVietnamDateString, getVietnamDateTimeString, generateSphOptions, cleanSKU, formatSKUForDisplay } from '../data/mockData';

/**
 * FILE: InventoryAudit.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Hệ thống kiểm kê định kỳ kho tròng kính chuyên sâu.
 *        Tối ưu hóa UI/UX trên mobile (hiển thị 1 cột, không tràn ngang, bóng shadow nổi bật).
 *        Hỗ trợ lập phiếu kiểm kê nhiều mặt hàng cùng lúc, tự sinh mã PKK, tự động tính chênh lệch,
 *        tự tạo giao dịch điều chỉnh liên kết (PNK/PXK) tương ứng và cập nhật tồn thực tế tức thì.
 *        Hỗ trợ tra cứu lịch sử kiểm kê đa tiêu chí: Mã phiếu, SKU, Người kiểm kê, Ngày, Kho.
 */

interface InventoryAuditProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  kiemKhos: KiemKho[];
  onSaveAudit: (newAudits: KiemKho[]) => void;
  onDeleteAudit?: (maPhieu: string) => Promise<boolean>;
  thuongHieus: string[];
  brandList?: ThuongHieu[];
  chiNhanhs: string[];
  hasPermission?: (permissionCode: string) => boolean;
}

interface AuditCartItem {
  id: string;
  sku: string;
  tenSp: string;
  tonHeThong: number;
  tonThucTe: number;
  lech: number;
  loaiBu: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH';
  axis: string; // Trục (AXIS) tự do nếu có
}

export default function InventoryAudit({ 
  currentUser, 
  sanPhams, 
  kiemKhos, 
  onSaveAudit,
  onDeleteAudit,
  thuongHieus,
  brandList,
  chiNhanhs,
  hasPermission
}: InventoryAuditProps) {

  const hasPerm = (p: string) => {
    if (hasPermission) return hasPermission(p);
    return currentUser?.writeAccess !== false;
  };

  // --- XÓA PHIẾU KIỂM KÊ (Confirmation) ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const triggerDeleteConfirm = (maPhieu: string) => {
    setDeleteTargetId(maPhieu);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId || !onDeleteAudit) return;
    setIsDeleting(true);
    try {
      const success = await onDeleteAudit(deleteTargetId);
      if (success) {
        setSuccessMsg(`Đã xóa thành công phiếu kiểm kê ${deleteTargetId}!`);
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setErrorMsg(`Lỗi khi xóa phiếu kiểm kê ${deleteTargetId}.`);
        setTimeout(() => setErrorMsg(''), 5000);
      }
    } catch (err) {
      console.error('Lỗi khi xóa phiếu kiểm kê:', err);
      setErrorMsg('Lỗi không xác định khi xóa phiếu kiểm kê.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  };

  // --- 1. THÔNG TIN CHỨNG TỪ ---
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [ngayLap, setNgayLap] = useState<string>(getVietnamDateString());
  const [ghiChuPhieu, setGhiChuPhieu] = useState<string>('');

  // --- 2. CẤU HÌNH SẢN PHẨM KIỂM KÊ ---
  const [selectBrand, setSelectBrand] = useState<string>('Blick');
  const [selectChietXuat, setSelectChietXuat] = useState<string>('1.56');
  const [selectTinhNang, setSelectTinhNang] = useState<string>('ĐM');
  const [selectDoSphType, setSelectDoSphType] = useState<'CẬN' | 'VIỄN'>('CẬN');
  const [selectDoSph, setSelectDoSph] = useState<number>(-2.00);
  const [selectDoCyl, setSelectDoCyl] = useState<number>(0.00);
  const [selectAxis, setSelectAxis] = useState<string>(''); // Trục (AXIS) nếu có
  const [tonThucTe, setTonThucTe] = useState<number>(0);

  // Trạng thái tìm kiếm SKU nhanh để tự động điền thuộc tính
  const [searchSKUQuery, setSearchSKUQuery] = useState<string>('');
  const [showSKUDropdown, setShowSKUDropdown] = useState<boolean>(false);

  // Trạng thái thông báo thành công / lỗi
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isAdded, setIsAdded] = useState<boolean>(false);

  // Giỏ hàng chờ kiểm kê (Phiếu kiểm kho đang lập)
  const [auditCart, setAuditCart] = useState<AuditCartItem[]>([]);

  // --- 3. TRA CỨU LỊCH SỬ KIỂM KÊ ---
  const [filterMaPhieu, setFilterMaPhieu] = useState<string>('');
  const [filterSKU, setFilterSKU] = useState<string>('');
  const [filterNguoiKiem, setFilterNguoiKiem] = useState<string>('');
  const [filterNgay, setFilterNgay] = useState<string>('');
  const [filterKho, setFilterKho] = useState<string>('');
  const [showFilterSettings, setShowFilterSettings] = useState<boolean>(false);

  // Mặc định gán chi nhánh đầu tiên cho người dùng
  useEffect(() => {
    if (currentUser?.branch) {
      setSelectedBranch(currentUser.branch);
    } else if (chiNhanhs.length > 0) {
      setSelectedBranch(chiNhanhs[0]);
    }
  }, [currentUser, chiNhanhs]);

  // --- 4. ĐỒNG BỘ CHIẾT XUẤT VÀ TÍNH NĂNG THEO THƯƠNG HIỆU (Giống TransactionForm) ---
  const availableFeatures = useMemo(() => {
    if (!brandList) return ['ĐM', 'ASX'];
    const featuresSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim() === selectBrand.trim())
      .forEach(b => {
        const valStr = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(f => featuresSet.add(f));
        }
      });
    const result = Array.from(featuresSet);
    return result.length > 0 ? result : ['ĐM', 'ASX'];
  }, [brandList, selectBrand]);

  const availableChietXuats = useMemo(() => {
    if (!brandList) return ['1.56', '1.60', '1.61', '1.67', '1.74'];
    const cxSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim() === selectBrand.trim())
      .forEach(b => {
        const valStr = b.CHIET_XUAT_MAC_DINH || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(cx => cxSet.add(cx));
        }
      });
    const result = Array.from(cxSet);
    return result.length > 0 ? result : ['1.56', '1.60', '1.61', '1.67', '1.74'];
  }, [brandList, selectBrand]);

  useEffect(() => {
    if (availableFeatures.length > 0 && !availableFeatures.includes(selectTinhNang)) {
      setSelectTinhNang(availableFeatures[0]);
    }
  }, [availableFeatures, selectTinhNang]);

  useEffect(() => {
    if (availableChietXuats.length > 0 && !availableChietXuats.includes(selectChietXuat)) {
      setSelectChietXuat(availableChietXuats[0]);
    }
  }, [availableChietXuats, selectChietXuat]);

  const handleBrandChange = (brand: string) => {
    setSelectBrand(brand);
    
    let nextFeature = '';
    let nextChietXuat = '';

    if (brandList) {
      const matchedBrands = brandList.filter(b => b.THUONG_HIEU.trim() === brand.trim());
      
      const featuresSet = new Set<string>();
      const cxSet = new Set<string>();

      matchedBrands.forEach(b => {
        const fStr = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
        if (fStr) {
          fStr.split(',').map(s => s.trim()).filter(Boolean).forEach(f => featuresSet.add(f));
        }
        const cxStr = b.CHIET_XUAT_MAC_DINH || '';
        if (cxStr) {
          cxStr.split(',').map(s => s.trim()).filter(Boolean).forEach(cx => cxSet.add(cx));
        }
      });

      const fList = Array.from(featuresSet);
      const cxList = Array.from(cxSet);

      if (fList.length > 0) {
        nextFeature = fList[0];
      }
      if (cxList.length > 0) {
        nextChietXuat = cxList[0];
      }
    }

    if (nextFeature) {
      setSelectTinhNang(nextFeature);
    } else {
      const isDM = ['Blick', 'Element', 'Nikki'].includes(brand);
      setSelectTinhNang(isDM ? 'ĐM' : 'ASX');
    }

    if (nextChietXuat) {
      setSelectChietXuat(nextChietXuat);
    } else {
      if (['Blick', 'Zeiss Clear', 'Essilor Pre', 'Essilor Rock'].includes(brand)) {
        setSelectChietXuat('1.56');
      } else if (brand === 'Zeiss Blue') {
        setSelectChietXuat('1.60');
      } else {
        setSelectChietXuat('1.61');
      }
    }
  };

  // Tính toán SPH options dựa trên phạm vi đã cấu hình của thương hiệu / chiết suất đang chọn
  const sphOptions = useMemo(() => {
    return generateSphOptions(selectBrand, selectChietXuat, brandList || [], selectDoSphType);
  }, [selectBrand, selectChietXuat, brandList, selectDoSphType]);

  useEffect(() => {
    if (sphOptions.length > 0) {
      if (!sphOptions.includes(selectDoSph)) {
        if (selectDoSphType === 'CẬN' && sphOptions.includes(-2.00)) {
          setSelectDoSph(-2.00);
        } else if (selectDoSphType === 'VIỄN' && sphOptions.includes(1.50)) {
          setSelectDoSph(1.50);
        } else {
          setSelectDoSph(sphOptions[0]);
        }
      }
    }
  }, [sphOptions, selectDoSph, selectDoSphType]);

  // Tính toán CYL options
  const cylOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 0; i >= -2.00; i -= 0.25) {
      opts.push(Number(i.toFixed(2)));
    }
    return opts;
  }, []);

  // --- 5. TỰ ĐỘNG TÍNH SKU & LỌC TRỰC TIẾP ---
  const calculatedSKU = useMemo(() => {
    return generateSKUString(selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl);
  }, [selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl]);

  const matchedProduct = useMemo(() => {
    return sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(calculatedSKU)) || null;
  }, [calculatedSKU, sanPhams]);

  // Cập nhật tồn thực tế mặc định bằng tồn hệ thống khi sản phẩm thay đổi
  useEffect(() => {
    if (matchedProduct) {
      setTonThucTe(matchedProduct.TON_CUOI);
    } else {
      setTonThucTe(0);
    }
  }, [matchedProduct]);

  // --- LỌC SKU ĐỂ SEARCH NHANH ---
  const filteredSKUOptions = useMemo(() => {
    if (!searchSKUQuery) return [];
    const query = cleanSKU(searchSKUQuery).toLowerCase();
    return sanPhams.filter(p => cleanSKU(p.SKU).toLowerCase().includes(query) || p.TEN_SAN_PHAM.toLowerCase().includes(searchSKUQuery.toLowerCase()));
  }, [sanPhams, searchSKUQuery]);

  // --- CHỌN NHANH SẢN PHẨM TỪ SEARCH SKU dropdown ---
  const handleSelectQuickSKU = (product: SanPham) => {
    setSelectBrand(product.THUONG_HIEU);
    setSelectChietXuat(product.CHIET_XUAT);
    setSelectTinhNang(product.TINH_NANG);
    setSelectDoSph(product.CAN);
    setSelectDoCyl(product.LOAN);
    setSelectDoSphType(product.CAN <= 0 ? 'CẬN' : 'VIỄN');
    setSearchSKUQuery('');
    setShowSKUDropdown(false);
  };

  // --- TÍNH TOÁN LỆCH & LOẠI BÙ ---
  const calculation = useMemo(() => {
    if (!matchedProduct) return { lech: 0, loaiBu: 'KHÔNG LỆCH' as const };
    const tonHeThong = matchedProduct.TON_CUOI;
    const lech = tonThucTe - tonHeThong;
    
    let loaiBu: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH' = 'KHÔNG LỆCH';
    if (lech > 0) loaiBu = 'NHẬP BÙ';
    else if (lech < 0) loaiBu = 'XUẤT BÙ';

    return { lech, loaiBu };
  }, [matchedProduct, tonThucTe]);

  // --- THÊM SẢN PHẨM VÀO PHIẾU CHỜ ---
  const handleAddToAuditCart = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!matchedProduct) {
      setErrorMsg('Sản phẩm cấu hình chưa tồn tại trong danh mục. Hãy tạo sản phẩm trước.');
      return;
    }

    // Kiểm tra trùng trong giỏ
    if (auditCart.some(item => item.sku === matchedProduct.SKU)) {
      setErrorMsg(`Sản phẩm với SKU [${matchedProduct.SKU}] đã tồn tại trong phiếu kiểm này.`);
      return;
    }

    const item: AuditCartItem = {
      id: `AUDIT_CART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sku: matchedProduct.SKU,
      tenSp: matchedProduct.TEN_SAN_PHAM,
      tonHeThong: matchedProduct.TON_CUOI,
      tonThucTe: tonThucTe,
      lech: calculation.lech,
      loaiBu: calculation.loaiBu,
      axis: selectAxis.trim() ? `Trục: ${selectAxis}` : ''
    };

    setAuditCart(prev => [...prev, item]);
    setSelectAxis('');
    
    // Hiển thị ✓ Đã thêm nhỏ kế bên nút, tự biến mất sau 1.5 giây
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 1500);
  };

  const handleRemoveFromCart = (id: string) => {
    setAuditCart(prev => prev.filter(item => item.id !== id));
  };

  // --- HOÀN TẤT & LƯU TOÀN PHIẾU KIỂM KHO ---
  const handleCompleteAudit = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedBranch) {
      setErrorMsg('Lỗi: Vui lòng lựa chọn Chi nhánh / Kho kiểm kê.');
      return;
    }

    if (auditCart.length === 0) {
      setErrorMsg('Lỗi: Phiếu kiểm kho rỗng. Vui lòng cấu hình sản phẩm và thêm vào phiếu chờ trước.');
      return;
    }

    // Tạo danh sách các bản ghi kiểm kê từ giỏ hàng để lưu cùng một lúc
    const auditRecords: KiemKho[] = auditCart.map((item) => ({
      MA_PHIEU: 'TEMP_PKK', // Sẽ được App.tsx xử lý tăng dần tự động (Ví dụ PKK000001)
      SKU: item.sku,
      TON_HE_THONG: item.tonHeThong,
      TON_THUC_TE: item.tonThucTe,
      LECH: item.lech,
      LOAI_BU: item.loaiBu,
      NGUOI_KIEM: currentUser.fullName,
      THOI_DIEM: getVietnamDateTimeString(),
      KHO: selectedBranch,
      MA_NV: currentUser.id,
      TEN_DANG_NHAP: currentUser.username
    }));

    onSaveAudit(auditRecords);

    setSuccessMsg(`Lập phiếu kiểm kê kho thành công! Hệ thống tự động cập nhật số tồn thực tế và tạo các giao dịch điều chỉnh (PNK/PXK) liên kết.`);
    setAuditCart([]);
    setGhiChuPhieu('');

    setTimeout(() => {
      setSuccessMsg('');
    }, 5000);
  };

  // --- 6. LỌC DANH SÁCH LỊCH SỬ KIỂM KHO THEO YÊU CẦU ---
  const filteredKiemKhos = useMemo(() => {
    return kiemKhos.filter(k => {
      const matchMaPhieu = !filterMaPhieu || k.MA_PHIEU.toLowerCase().includes(filterMaPhieu.toLowerCase());
      const matchSKU = !filterSKU || k.SKU.toLowerCase().includes(filterSKU.toLowerCase());
      const matchNguoiKiem = !filterNguoiKiem || k.NGUOI_KIEM.toLowerCase().includes(filterNguoiKiem.toLowerCase());
      const matchNgay = !filterNgay || k.THOI_DIEM.includes(filterNgay);
      const matchKho = !filterKho || (k.KHO && k.KHO.toLowerCase() === filterKho.toLowerCase());
      return matchMaPhieu && matchSKU && matchNguoiKiem && matchNgay && matchKho;
    });
  }, [kiemKhos, filterMaPhieu, filterSKU, filterNguoiKiem, filterNgay, filterKho]);

  const handleResetFilters = () => {
    setFilterMaPhieu('');
    setFilterSKU('');
    setFilterNguoiKiem('');
    setFilterNgay('');
    setFilterKho('');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. KHU VỰC TIÊU ĐỀ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-150 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-md shadow-red-500/15">
            <ClipboardCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="font-sans font-extrabold text-slate-800 text-base">Kiểm Kê Kho Định Kỳ</h2>
            <p className="text-xs text-slate-500 font-medium">So khớp tồn thực đếm vật lý với hệ thống & tự động bù trừ</p>
          </div>
        </div>
      </div>

      {/* THÔNG BÁO */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-start gap-2.5 shadow-sm animate-fade-in">
          <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="font-bold leading-relaxed">{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-center gap-2.5 shadow-sm animate-fade-in">
          <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* CHIA MÀN HÌNH CHÍNH LÀM 2 BÊN GIỐNG PHIẾU NHẬP XUẤT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* PHẦN TRÁI: THIẾT LẬP PHIẾU & CẤU HÌNH SẢN PHẨM (XL: 5/12 cột) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* BẢNG 1: THÔNG TIN CHỨNG TỪ (CÓ SHADOW NỔI BẬT, MOBILE 1 CỘT) */}
          <div className="bento-card bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <FileText className="w-4.5 h-4.5 text-red-500" />
              <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Thông tin chứng từ</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Chi nhánh / Kho */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" /> Chi Nhánh / Kho Kiểm Kê
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  disabled={!hasPerm('stocktake.read')}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">-- Chọn Chi Nhánh / Kho --</option>
                  {chiNhanhs.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Nhóm Ngày lập & Người kiểm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" /> Ngày Lập Phiếu
                  </label>
                  <input
                    type="date"
                    value={ngayLap}
                    onChange={(e) => setNgayLap(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Người Kiểm Kê
                  </label>
                  <input
                    type="text"
                    value={currentUser.fullName}
                    disabled
                    className="w-full text-xs font-bold text-slate-500 bg-slate-100 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Ghi chú */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400">Ghi chú phiếu kiểm</label>
                <input
                  type="text"
                  placeholder="Ghi chú tổng quát (ví dụ: Kiểm kê định kỳ tháng 7/2026)..."
                  value={ghiChuPhieu}
                  onChange={(e) => setGhiChuPhieu(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
                />
              </div>
            </div>
          </div>

          {/* BẢNG 2: CẤU HÌNH SẢN PHẨM (CÓ SHADOW NỔI BẬT, MOBILE 1 CỘT) */}
          <div className="bento-card bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4.5 h-4.5 text-red-500" />
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Cấu hình sản phẩm</h3>
              </div>
              
              {/* Nút bật/tắt quét nhanh */}
              <div className="text-[10px] text-red-600 font-extrabold font-mono bg-red-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                ĐỐI CHIẾU THỜI GIAN THỰC
              </div>
            </div>

            {/* Ô TÌM SKU NHANH ĐỂ CHỌN THUỘC TÍNH TỰ ĐỘNG */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-extrabold text-slate-400 block">
                Tìm nhanh theo SKU hoặc Tên Tròng Kính
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Gõ từ khóa để tìm SKU nhanh..."
                  value={searchSKUQuery}
                  onFocus={() => setShowSKUDropdown(true)}
                  onChange={(e) => {
                    setSearchSKUQuery(e.target.value);
                    setShowSKUDropdown(true);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-150 rounded-lg focus:outline-hidden text-slate-700 font-bold placeholder-slate-400"
                />
                
                {showSKUDropdown && filteredSKUOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 border border-slate-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-50 shadow-lg bg-white z-20 text-xs">
                    {filteredSKUOptions.map(p => (
                      <button
                        key={p.SKU}
                        type="button"
                        onClick={() => handleSelectQuickSKU(p)}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-colors block"
                      >
                        <p className="font-bold text-slate-850 font-mono text-xs">{p.SKU}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.TEN_SAN_PHAM}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showSKUDropdown && searchSKUQuery && filteredSKUOptions.length === 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 p-3 text-center text-slate-400 italic bg-white border border-slate-100 rounded-xl shadow-lg z-20 text-xs">
                    Không tìm thấy SKU nào trùng khớp
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Thương hiệu */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Thương hiệu</label>
                <select
                  value={selectBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden"
                >
                  {thuongHieus.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              {/* Tính năng */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Tính năng</label>
                <select
                  value={selectTinhNang}
                  onChange={(e) => setSelectTinhNang(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden"
                >
                  {availableFeatures.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {/* Chiết suất */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Chiết suất</label>
                <select
                  value={selectChietXuat}
                  onChange={(e) => setSelectChietXuat(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden font-mono"
                >
                  {availableChietXuats.map(cx => (
                    <option key={cx} value={cx}>{cx}</option>
                  ))}
                </select>
              </div>

              {/* Phân loại Độ cận / Viễn */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Phân loại SPH</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectDoSphType('CẬN')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${selectDoSphType === 'CẬN' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-150'}`}
                  >
                    CẬN
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectDoSphType('VIỄN')}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer ${selectDoSphType === 'VIỄN' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-150'}`}
                  >
                    VIỄN
                  </button>
                </div>
              </div>

              {/* Độ cầu SPH */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Độ cầu (SPH)</label>
                <select
                  value={selectDoSph}
                  onChange={(e) => setSelectDoSph(Number(e.target.value))}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg font-mono focus:outline-hidden"
                >
                  {sphOptions.map((v) => (
                    <option key={v} value={v}>{formatDop(v)}</option>
                  ))}
                </select>
              </div>

              {/* Độ loạn CYL */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Độ loạn (CYL)</label>
                <select
                  value={selectDoCyl}
                  onChange={(e) => setSelectDoCyl(Number(e.target.value))}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg font-mono focus:outline-hidden"
                >
                  {cylOptions.map((v) => (
                    <option key={v} value={v}>{formatDop(v)}</option>
                  ))}
                </select>
              </div>

              {/* Trục AXIS nếu có */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Trục (AXIS) nếu có</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 180"
                  value={selectAxis}
                  onChange={(e) => setSelectAxis(e.target.value)}
                  className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 p-2.5 rounded-lg focus:outline-hidden"
                />
              </div>

              {/* SKU dự kiến */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block">SKU Dự Kiến</label>
                <div className="w-full text-xs font-mono font-bold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 truncate">
                  {calculatedSKU}
                </div>
              </div>
            </div>

            {/* BẢNG SO KHỚP TỒN HỆ THỐNG & NHẬP THỰC TẾ */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">Tồn hệ thống</span>
                  {matchedProduct ? (
                    <div className="text-xl font-extrabold text-slate-800 font-mono tracking-tight">
                      {matchedProduct.TON_CUOI} <span className="text-xs text-slate-400 font-bold">{matchedProduct.DVT}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-500 font-bold flex items-center gap-1 leading-6">
                      <AlertCircle className="w-4.5 h-4.5" /> Chưa có SKU này
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-extrabold text-slate-400 block">Tồn thực tế</label>
                  <input
                    type="number"
                    min={0}
                    disabled={!matchedProduct}
                    value={tonThucTe}
                    onChange={(e) => setTonThucTe(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full py-1.5 px-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-250 rounded-md font-mono focus:outline-hidden focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* Hiển thị tính chênh lệch tự động */}
              {matchedProduct && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] uppercase font-extrabold text-slate-500">Kết quả chênh lệch:</span>
                  <div className="flex items-center gap-1.5">
                    {calculation.lech === 0 ? (
                      <span className="text-xs font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Không chênh lệch (0)</span>
                    ) : (
                      <>
                        <span className={`text-sm font-extrabold font-mono ${calculation.lech > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {calculation.lech > 0 ? `+${calculation.lech}` : calculation.lech}
                        </span>
                        <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded-md ${
                          calculation.lech > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                        }`}>
                          {calculation.loaiBu}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Nút THÊM VÀO PHIẾU CHỜ & TRẠNG THÁI INLINE BIẾN MẤT SAU 1.5S */}
            <div className="flex items-center justify-end gap-3.5 pt-2">
              <AnimatePresence>
                {isAdded && (
                  <motion.span 
                    initial={{ opacity: 0, x: 5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-emerald-600 text-xs font-extrabold flex items-center gap-1"
                  >
                    <Check className="w-4.5 h-4.5" /> ✓ Đã thêm
                  </motion.span>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={handleAddToAuditCart}
                disabled={!matchedProduct || !hasPerm('stocktake.read')}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-extrabold text-xs py-2.5 px-5 rounded-xl cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Thêm vào phiếu chờ
              </button>
            </div>
          </div>

        </div>

        {/* PHẦN PHẢI: GIỎ PHIẾU KIỂM KHO ĐANG LẬP & LỊCH SỬ TRA CỨU (XL: 7/12 cột) */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* PHIẾU KIỂM KHO ĐANG LẬP */}
          <div className="bento-card bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4.5 h-4.5 text-red-500" />
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Chi tiết phiếu kiểm đang lập</h3>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold py-0.5 px-2 rounded-full font-mono">
                {auditCart.length} dòng sản phẩm
              </span>
            </div>

            {/* DANH SÁCH SẢN PHẨM KIỂM KHO CHỜ XÁC NHẬN */}
            {auditCart.length > 0 ? (
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {auditCart.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-slate-850 text-xs font-mono">{item.sku}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{item.tenSp} {item.axis && <span className="font-bold text-red-500">({item.axis})</span>}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="p-1 bg-white hover:bg-rose-50 border border-slate-150 hover:border-rose-200 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1.5 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block font-sans">Tồn HT:</span>
                        <span className="font-extrabold text-slate-700">{item.tonHeThong}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-sans">Đếm thực tế:</span>
                        <span className="font-extrabold text-slate-700">{item.tonThucTe}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block font-sans">Chênh lệch:</span>
                        <span className={`font-extrabold ${item.lech > 0 ? 'text-emerald-600' : item.lech < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                          {item.lech > 0 ? `+${item.lech}` : item.lech} ({item.loaiBu})
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-14 text-center text-xs text-slate-400 font-mono italic leading-relaxed border border-dashed border-slate-200 rounded-xl">
                Phiếu kiểm kho hiện chưa có mặt hàng nào. Vui lòng cấu hình sản phẩm và nhấn "Thêm vào phiếu chờ".
              </div>
            )}

            {auditCart.length > 0 && (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCompleteAudit}
                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  Xác Nhận & Hoàn Tất Phiếu Kiểm Kho
                </button>
              </div>
            )}
          </div>

          {/* LỊCH SỬ KIỂM KHO GẦN ĐÂY & TRA CỨU ĐA TIÊU CHÍ */}
          <div className="bento-card bg-white p-5 rounded-2xl shadow-md border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-red-500" />
                <h3 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">Lịch sử kiểm kê toàn hệ thống</h3>
              </div>
              
              {/* Nút bật/tắt bộ lọc tìm kiếm */}
              <button
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className={`text-[10px] font-extrabold py-1 px-3 rounded-full flex items-center gap-1 cursor-pointer transition-all ${showFilterSettings ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-50 text-slate-500 border border-slate-150'}`}
              >
                <Filter className="w-3 h-3" />
                Bộ lọc tìm kiếm
              </button>
            </div>

            {/* BỘ LỌC TÌM KIẾM CHI TIẾT THEO YÊU CẦU */}
            {showFilterSettings && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-150 space-y-4 animate-fade-in text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Mã phiếu kiểm */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Mã PKK</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: PKK000001"
                      value={filterMaPhieu}
                      onChange={(e) => setFilterMaPhieu(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg font-mono text-[11px] focus:outline-hidden"
                    />
                  </div>

                  {/* SKU */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block">SKU tròng kính</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: BLICK 1.56..."
                      value={filterSKU}
                      onChange={(e) => setFilterSKU(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg font-mono text-[11px] focus:outline-hidden"
                    />
                  </div>

                  {/* Người kiểm */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Người kiểm kê</label>
                    <input
                      type="text"
                      placeholder="Tên nhân viên..."
                      value={filterNguoiKiem}
                      onChange={(e) => setFilterNguoiKiem(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[11px] focus:outline-hidden"
                    />
                  </div>

                  {/* Ngày kiểm */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Ngày kiểm kê</label>
                    <input
                      type="date"
                      value={filterNgay}
                      onChange={(e) => setFilterNgay(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[11px] font-mono focus:outline-hidden"
                    />
                  </div>

                  {/* Kho/Chi nhánh */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase block">Kho / Chi Nhánh</label>
                    <select
                      value={filterKho}
                      onChange={(e) => setFilterKho(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-2 rounded-lg text-[11px] font-bold text-slate-700 focus:outline-hidden"
                    >
                      <option value="">Tất cả kho</option>
                      {chiNhanhs.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Nút reset */}
                  <div className="flex items-end">
                    <button
                      onClick={handleResetFilters}
                      className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset bộ lọc
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* KẾT QUẢ TRA CỨU LỊCH SỬ */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {filteredKiemKhos.length > 0 ? (
                filteredKiemKhos.slice().reverse().map((audit, index) => {
                  const isPositive = audit.LECH > 0;
                  const isNegative = audit.LECH < 0;

                  return (
                    <div key={`${audit.MA_PHIEU}-${audit.SKU}-${audit.THOI_DIEM}-${index}`} className="pt-2 pb-3.5 border-b border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-red-600 font-mono bg-red-50 py-0.5 px-2 rounded-md text-[10px] border border-red-100">
                            {audit.MA_PHIEU}
                          </span>
                          {hasPerm('stocktake.write') && (
                            <button
                              onClick={() => triggerDeleteConfirm(audit.MA_PHIEU)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition-colors flex items-center gap-0.5 cursor-pointer font-bold font-sans text-[10px]"
                              title="Xóa phiếu kiểm kê"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Xóa phiếu
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {audit.THOI_DIEM}
                        </span>
                      </div>

                      <p className="font-extrabold text-slate-800 font-mono tracking-tight pt-0.5 truncate" title={audit.SKU}>
                        {audit.SKU}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] text-slate-500">
                        <div>
                          <span>Tồn HT: </span>
                          <strong className="text-slate-700">{audit.TON_HE_THONG}</strong>
                        </div>
                        <div>
                          <span>Thực tế: </span>
                          <strong className="text-slate-700">{audit.TON_THUC_TE}</strong>
                        </div>
                        <div className="text-right">
                          <span>Lệch: </span>
                          <strong className={`font-bold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isPositive ? `+${audit.LECH}` : audit.LECH}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 text-[9px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          Người kiểm: <strong className="text-slate-600 font-bold">{audit.NGUOI_KIEM}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          Kho: <strong className="text-slate-600 font-bold">{audit.KHO || 'Chưa rõ'}</strong>
                        </span>
                        <span className={`font-extrabold uppercase py-0.5 px-1.5 rounded-sm ${
                          audit.LOAI_BU === 'NHẬP BÙ' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : audit.LOAI_BU === 'XUẤT BÙ' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {audit.LOAI_BU}
                        </span>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-center text-xs text-slate-400 font-mono italic leading-relaxed">
                  Chưa ghi nhận phiên kiểm kê kho nào trùng khớp với bộ lọc tra cứu.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL XÁC NHẬN XÓA PHIẾU KIỂM KÊ */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-slate-800">Xác nhận xóa phiếu kiểm kê</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Bạn có chắc chắn muốn xóa vĩnh viễn phiếu kiểm kê <strong className="text-rose-600 font-mono">{deleteTargetId}</strong> không?
                  </p>
                  <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-0.5 pt-1">
                    <li>Chỉ xóa dữ liệu lịch sử kiểm kê.</li>
                    <li>KHÔNG cập nhật hay thay đổi tồn kho hiện tại.</li>
                    <li>KHÔNG tạo hay thu hồi các phiếu bù trừ điều chỉnh.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTargetId(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                >
                  {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
