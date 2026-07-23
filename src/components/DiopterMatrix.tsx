/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  MapPin, 
  LayoutGrid, 
  CheckCircle, 
  RefreshCw, 
  AlertTriangle,
  Compass,
  X,
  Info,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThuongHieu } from '../types';
import { formatDop, generateSKUString, generateSphOptions, cleanSKU } from '../data/mockData';
import { normalizeChietXuat } from '../utils/chietXuatHelper';
import { exportMatrixToPDF } from '../utils/matrixPdfExporter';
import { exportMatrixToExcel } from '../utils/matrixExcelExporter';

interface DiopterMatrixProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  kiemKhos: KiemKho[];
  chiNhanhs: string[];
  thuongHieus: string[];
  brandList?: ThuongHieu[];
  currentUser: any;
  hasPermission?: (permissionCode: string) => boolean;
  onUpdateMatrixCell?: (
    sku: string,
    newTonToiThieu: number,
    newTonThucTe: number,
    currentSystemTon: number,
    branchName: string,
    brand?: string,
    feature?: string,
    chietXuat?: string,
    can?: number,
    loan?: number
  ) => Promise<void>;
}

export default function DiopterMatrix({
  sanPhams = [],
  nhapXuats = [],
  nhapXuatCTs = [],
  kiemKhos = [],
  chiNhanhs = [],
  thuongHieus = [],
  brandList = [],
  currentUser,
  hasPermission,
  onUpdateMatrixCell
}: DiopterMatrixProps) {
  const hasPerm = (p: string) => {
    if (hasPermission) return hasPermission(p);
    return currentUser?.writeAccess !== false;
  };

  // --- 1. QUẢN LÝ BỘ LỌC CHUYÊN BIỆT ---
  const [selectedBrand, setSelectedBrand] = useState<string>(() => {
    return thuongHieus.length > 0 ? thuongHieus[0] : 'Blick';
  });
  
  // Lấy các tính năng khả dụng của thương hiệu được chọn (quy chuẩn so khớp không phân biệt hoa thường)
  const availableFeatures = useMemo(() => {
    if (!brandList || brandList.length === 0) return ['ĐM', 'ASX'];
    const featuresSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim().toLowerCase() === selectedBrand.trim().toLowerCase())
      .forEach(b => {
        const valStr = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(f => featuresSet.add(f));
        }
      });
    const result = Array.from(featuresSet);
    return result.length > 0 ? result : ['ĐM', 'ASX'];
  }, [brandList, selectedBrand]);

  const [selectedFeature, setSelectedFeature] = useState<string>('ĐM');

  // Đảm bảo tính năng được chọn luôn hợp lệ khi đổi thương hiệu
  React.useEffect(() => {
    if (availableFeatures.length > 0 && !availableFeatures.includes(selectedFeature)) {
      setSelectedFeature(availableFeatures[0]);
    }
  }, [availableFeatures, selectedFeature]);

  // Lấy các chiết suất khả dụng của thương hiệu được chọn
  const availableChietXuats = useMemo(() => {
    if (!brandList || brandList.length === 0) return ['1.56', '1.60', '1.61', '1.67', '1.74'];
    const cxSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim().toLowerCase() === selectedBrand.trim().toLowerCase())
      .forEach(b => {
        const valStr = b.CHIET_XUAT_MAC_DINH || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(cx => cxSet.add(cx));
        }
      });
    const result = Array.from(cxSet);
    return result.length > 0 ? result : ['1.56', '1.60', '1.61', '1.67', '1.74'];
  }, [brandList, selectedBrand]);

  const [selectedChietXuat, setSelectedChietXuat] = useState<string>('1.56');

  // Đảm bảo chiết suất được chọn luôn hợp lệ khi đổi thương hiệu
  React.useEffect(() => {
    if (availableChietXuats.length > 0 && !availableChietXuats.includes(selectedChietXuat)) {
      setSelectedChietXuat(availableChietXuats[0]);
    }
  }, [availableChietXuats, selectedChietXuat]);

  // Đồng bộ tức thời để loại bỏ triệt để độ trễ (lag) hoặc trùng chéo dữ liệu giữa các thương hiệu
  const currentFeature = useMemo(() => {
    if (availableFeatures.includes(selectedFeature)) {
      return selectedFeature;
    }
    return availableFeatures[0] || 'ĐM';
  }, [availableFeatures, selectedFeature]);

  const currentChietXuat = useMemo(() => {
    if (availableChietXuats.includes(selectedChietXuat)) {
      return selectedChietXuat;
    }
    return availableChietXuats[0] || '1.56';
  }, [availableChietXuats, selectedChietXuat]);

  // Kho hàng / chi nhánh
  const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả');

  // Loại độ (CẬN / VIỄN)
  const [diopterType, setDiopterType] = useState<'CẬN' | 'VIỄN'>('CẬN');

  // Chế độ hiển thị: 'QUANTITY' (Hiển thị số lượng) | 'STATUS' (Hiển thị màu trạng thái)
  const [displayMode, setDisplayMode] = useState<'QUANTITY' | 'STATUS'>('QUANTITY');

  // Trạng thái hiển thị modal chi tiết ô
  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    can: number;
    loan: number;
    sku: string;
    exists: boolean;
    tonCuoi: number;
    tonToiThieu: number;
    status: 'Hết hàng' | 'Nguy cấp' | 'Thấp' | 'Đạt yêu cầu' | 'An toàn';
    product?: SanPham;
  } | null>(null);

  // Trạng thái chỉnh sửa trực tiếp trong modal chi tiết ô
  const [editTonToiThieu, setEditTonToiThieu] = useState<string>('');
  const [editTonThucTe, setEditTonThucTe] = useState<string>('');
  const [modalErrorMsg, setModalErrorMsg] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  React.useEffect(() => {
    if (selectedCellDetail) {
      setEditTonToiThieu(String(selectedCellDetail.tonToiThieu));
      setEditTonThucTe(String(selectedCellDetail.tonCuoi));
      setModalErrorMsg('');
    } else {
      setEditTonToiThieu('');
      setEditTonThucTe('');
      setModalErrorMsg('');
    }
  }, [selectedCellDetail]);

  const handleSaveCellUpdate = async () => {
    if (!selectedCellDetail || !onUpdateMatrixCell) return;
    
    const minStock = parseInt(editTonToiThieu, 10);
    const actualStock = parseInt(editTonThucTe, 10);

    if (isNaN(minStock) || minStock < 0) {
      setModalErrorMsg('Vui lòng nhập Tồn tối thiểu hợp lệ (số nguyên >= 0).');
      return;
    }

    if (isNaN(actualStock) || actualStock < 0) {
      setModalErrorMsg('Vui lòng nhập Tồn thực tế hợp lệ (số nguyên >= 0).');
      return;
    }

    try {
      setIsSaving(true);
      setModalErrorMsg('');
      await onUpdateMatrixCell(
        selectedCellDetail.sku,
        minStock,
        actualStock,
        selectedCellDetail.tonCuoi,
        selectedBranch === 'Tất cả' ? 'Kho Trung Tâm' : selectedBranch,
        selectedCellDetail.product?.THUONG_HIEU || selectedBrand,
        selectedCellDetail.product?.TINH_NANG || currentFeature,
        selectedCellDetail.product?.CHIET_XUAT || currentChietXuat,
        selectedCellDetail.can,
        selectedCellDetail.loan
      );
      setSelectedCellDetail(null);
    } catch (error: any) {
      console.error('Lỗi khi cập nhật ô độ:', error);
      setModalErrorMsg(error?.message || 'Có lỗi xảy ra khi cập nhật.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- 2. XÁC ĐỊNH DANH SÁCH ĐỘ CẬN (Y) VÀ ĐỘ LOẠN (X) ---
  const canList = useMemo(() => {
    const defaultOptions = generateSphOptions(selectedBrand, currentChietXuat, brandList || [], diopterType);
    const set = new Set<number>(defaultOptions);

    const normalizedSelected = normalizeChietXuat(currentChietXuat);
    sanPhams.forEach(p => {
      const matchBrand = p.THUONG_HIEU.trim().toLowerCase() === selectedBrand.trim().toLowerCase();
      const matchFeature = p.TINH_NANG.trim().toLowerCase() === currentFeature.trim().toLowerCase();
      const normalizedProductIdx = normalizeChietXuat(p.CHIET_XUAT);
      const matchChietXuat = normalizedProductIdx === normalizedSelected;

      if (matchBrand && matchFeature && matchChietXuat) {
        if (diopterType === 'CẬN' && p.CAN <= 0) {
          set.add(p.CAN);
        } else if (diopterType === 'VIỄN' && p.CAN > 0) {
          set.add(p.CAN);
        }
      }
    });

    const list = Array.from(set).map(v => Number(v.toFixed(2)));
    if (diopterType === 'CẬN') {
      return list.sort((a, b) => b - a); // 0.00, -0.25, -0.50...
    } else {
      return list.sort((a, b) => a - b); // 0.25, 0.50, 0.75...
    }
  }, [sanPhams, selectedBrand, currentChietXuat, currentFeature, brandList, diopterType]);

  const loanList = useMemo(() => {
    const set = new Set<number>();
    for (let c = 0.00; c >= -2.00; c -= 0.25) {
      set.add(Number(c.toFixed(2)));
    }

    const normalizedSelected = normalizeChietXuat(currentChietXuat);
    sanPhams.forEach(p => {
      const matchBrand = p.THUONG_HIEU.trim().toLowerCase() === selectedBrand.trim().toLowerCase();
      const matchFeature = p.TINH_NANG.trim().toLowerCase() === currentFeature.trim().toLowerCase();
      const normalizedProductIdx = normalizeChietXuat(p.CHIET_XUAT);
      const matchChietXuat = normalizedProductIdx === normalizedSelected;

      if (matchBrand && matchFeature && matchChietXuat) {
        set.add(p.LOAN);
      }
    });

    return Array.from(set).map(v => Number(v.toFixed(2))).sort((a, b) => b - a);
  }, [sanPhams, selectedBrand, currentChietXuat, currentFeature]);

  // --- 3. ĐỒNG BỘ DỮ LIỆU SẢN PHẨM & TÍNH TỒN KHO THEO BỘ LỌC BẰNG SKU ĐÚNG ---
  // Ta xây dựng bản đồ tra cứu O(1) cực nhanh từ bảng sản phẩm b_sanpham bằng SKU đã chuẩn hóa
  const lookupMaps = useMemo(() => {
    const skuMap = new Map<string, SanPham>();
    
    sanPhams.forEach(p => {
      const cleanedSkuKey = cleanSKU(p.SKU);
      if (cleanedSkuKey) {
        skuMap.set(cleanedSkuKey, p);
      }
    });
    
    return { skuMap };
  }, [sanPhams]);

  // Hàm tính toán tồn kho cho một CAN và LOAN cụ thể bằng SKU lookup trực tiếp
  const getCellStockInfo = (can: number, loan: number) => {
    // Bước 1: Ghép SKU từ bộ lọc hiện tại và tọa độ ô:
    const expectedSku = generateSKUString(selectedBrand, currentChietXuat, currentFeature, can, loan);
    const cleanExpected = cleanSKU(expectedSku);

    // Bước 2: Dùng SKU vừa tạo để lookup chính xác vào bảng sản phẩm:
    const product = lookupMaps.skuMap.get(cleanExpected);

    if (!product) {
      return {
        sku: expectedSku,
        exists: false,
        tonCuoi: 0,
        tonToiThieu: 0,
        status: 'Hết hàng' as const,
        product: undefined
      };
    }

    let tonCuoi = product.TON_CUOI;
    const tonToiThieu = product.TON_TOI_THIEU;

    // Nếu chọn chi nhánh cụ thể, tính toán lại tồn kho theo chi nhánh
    if (selectedBranch && selectedBranch !== 'Tất cả') {
      const branchHeaders = nhapXuats.filter(h => h.CHI_NHANH === selectedBranch && h.TRANG_THAI !== 'Đã hủy');
      const branchHeaderIds = new Set(branchHeaders.map(h => h.HOA_DON));

      const branchDetails = nhapXuatCTs.filter(d => d.SKU === product.SKU && branchHeaderIds.has(d.HOA_DON));

      const totalNhap = branchDetails
        .filter(d => d.LOAI === 'NHẬP')
        .reduce((sum, d) => sum + d.SO_LUONG, 0);

      const totalXuat = branchDetails
        .filter(d => d.LOAI === 'XUẤT')
        .reduce((sum, d) => sum + d.SO_LUONG, 0);

      const isDefaultBranch = selectedBranch === 'Kho Trung Tâm';
      const branchTonDau = isDefaultBranch ? product.TON_DAU : 0;

      tonCuoi = Math.max(0, branchTonDau + totalNhap - totalXuat);
    }

    // Xác định trạng thái màu dựa trên tồn tối thiểu
    let status: 'Hết hàng' | 'Nguy cấp' | 'Thấp' | 'Đạt yêu cầu' | 'An toàn' = 'An toàn';
    if (tonCuoi === 0) {
      status = 'Hết hàng';
    } else if (tonCuoi < tonToiThieu * 0.5) {
      status = 'Nguy cấp';
    } else if (tonCuoi < tonToiThieu) {
      status = 'Thấp';
    } else if (tonCuoi < tonToiThieu * 1.5) {
      status = 'Đạt yêu cầu';
    } else {
      status = 'An toàn';
    }

    return {
      sku: product.SKU,
      exists: true,
      tonCuoi,
      tonToiThieu,
      status,
      product
    };
  };

  // Trực quan hóa tồn kho bằng thang màu Gradient liên tục theo tỷ lệ Tồn cuối / Tồn tối thiểu
  const getInventoryDynamicStyle = (tonCuoi: number, tonToiThieu: number, exists: boolean) => {
    if (!exists) {
      return {
        style: {} as React.CSSProperties,
        status: 'An toàn' as const
      };
    }

    if (tonCuoi === 0) {
      return {
        style: {
          backgroundColor: '#b91c1c', // Đỏ đậm (Red 700)
          color: '#ffffff',
          fontWeight: '800',
          borderWidth: '1px',
          borderColor: '#991b1b',
        } as React.CSSProperties,
        status: 'Hết hàng' as const
      };
    }

    const minStock = tonToiThieu > 0 ? tonToiThieu : 10;
    const ratio = tonToiThieu === 0 ? 1.5 : (tonCuoi / minStock);

    let r = 0, g = 0, b = 0;
    let status: 'Hết hàng' | 'Nguy cấp' | 'Thấp' | 'Đạt yêu cầu' | 'An toàn' = 'An toàn';

    if (ratio < 0.5) {
      status = 'Nguy cấp';
      const t = ratio / 0.5;
      r = Math.round(239 + (251 - 239) * t);
      g = Math.round(68 + (146 - 68) * t);
      b = Math.round(68 + (60 - 68) * t);
    } else if (ratio < 1.0) {
      status = 'Thấp';
      const t = (ratio - 0.5) / 0.5;
      r = Math.round(251 + (253 - 251) * t);
      g = Math.round(146 + (224 - 146) * t);
      b = Math.round(60 + (71 - 60) * t);
    } else if (ratio < 1.5) {
      status = 'Đạt yêu cầu';
      const t = (ratio - 1.0) / 0.5;
      r = Math.round(253 + (34 - 253) * t);
      g = Math.round(224 + (197 - 224) * t);
      b = Math.round(71 + (94 - 71) * t);
    } else {
      status = 'An toàn';
      const t = Math.min(1, (ratio - 1.5) / 1.5);
      r = Math.round(34 + (21 - 34) * t);
      g = Math.round(197 + (115 - 197) * t);
      b = Math.round(94 + (55 - 94) * t);
    }

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 145 ? '#0f172a' : '#ffffff';

    return {
      style: {
        backgroundColor: `rgb(${r}, ${g}, ${b})`,
        color: textColor,
        borderWidth: '1px',
        borderColor: `rgba(${Math.max(0, r - 30)}, ${Math.max(0, g - 30)}, ${Math.max(0, b - 30)}, 0.55)`,
        textShadow: textColor === '#ffffff' ? '0px 1px 2px rgba(0,0,0,0.3)' : 'none',
      } as React.CSSProperties,
      status
    };
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Hết hàng': return 'Hết hàng (Tồn = 0)';
      case 'Nguy cấp': return 'Nguy cấp (Tồn < 50% Tối thiểu)';
      case 'Thấp': return 'Thấp (Tồn < Tối thiểu)';
      case 'Đạt yêu cầu': return 'Đạt yêu cầu (Tồn < 150% Tối thiểu)';
      case 'An toàn': return 'An toàn (Tồn ≥ 150% Tối thiểu)';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Hết hàng': return 'bg-red-600 text-white font-extrabold border border-red-700 px-2 py-0.5 rounded-full';
      case 'Nguy cấp': return 'bg-red-200 text-red-900 font-bold border border-red-300 px-2 py-0.5 rounded-full';
      case 'Thấp': return 'bg-orange-400 text-orange-950 font-bold border border-orange-500 px-2 py-0.5 rounded-full';
      case 'Đạt yêu cầu': return 'bg-yellow-300 text-yellow-950 font-bold border border-yellow-400 px-2 py-0.5 rounded-full';
      case 'An toàn': return 'bg-emerald-500 text-white font-bold border border-emerald-600 px-2 py-0.5 rounded-full';
      default: return 'bg-slate-500/10 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full';
    }
  };

  const handleResetFilters = () => {
    if (thuongHieus.length > 0) {
      setSelectedBrand(thuongHieus[0]);
    }
    setSelectedFeature('ĐM');
    setSelectedChietXuat('1.56');
    setSelectedBranch('Tất cả');
    setDiopterType('CẬN');
    setDisplayMode('QUANTITY');
  };

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  const handleExportPDF = async () => {
    try {
      setIsExportingPdf(true);
      await exportMatrixToPDF({
        selectedBrand,
        currentChietXuat,
        currentFeature,
        selectedBranch,
        diopterType,
        canList,
        loanList,
        getCellStockInfo,
        userName: currentUser?.TEN_NGUOI_DUNG || currentUser?.fullName || currentUser?.username || 'Hệ thống'
      });
    } catch (error) {
      console.error('Lỗi khi xuất PDF bảng độ:', error);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportMatrixToExcel({
        selectedBrand,
        currentChietXuat,
        currentFeature,
        selectedBranch,
        diopterType,
        canList,
        loanList,
        getCellStockInfo,
        userName: currentUser?.TEN_NGUOI_DUNG || currentUser?.fullName || currentUser?.username || 'Hệ thống'
      });
    } catch (error) {
      console.error('Lỗi khi xuất Excel bảng độ:', error);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. THANH TIÊU ĐỀ & MÔ TẢ PHÂN KHU */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl shadow-xs">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-850 text-lg">Bảng Độ (Ma Trận CẬN/LOẠN)</h1>
            <p className="text-xs text-slate-400 font-mono">Tra cứu trực quan tồn kho kính mắt theo tọa độ khúc xạ chuyên sâu</p>
          </div>
        </div>

        <div className="self-start md:self-auto flex items-center gap-2">
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset bộ lọc
          </button>

          {(hasPerm('matrix.export_excel') || hasPerm('matrix.export') || hasPerm('matrix.export_pdf')) && (
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Xuất file Excel Bảng Độ Ma Trận theo đúng bộ lọc đang xem"
            >
              {isExportingExcel ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang xuất Excel...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Xuất Excel
                </>
              )}
            </button>
          )}

          {hasPerm('matrix.export_pdf') && (
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Xuất file PDF Bảng Độ Ma Trận theo đúng bộ lọc đang xem"
            >
              {isExportingPdf ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Đang xuất PDF...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  Xuất PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. KHU VỰC BỘ LỌC ĐA TIÊU CHÍ */}
      <div className="bento-card bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100 mb-4">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bộ lọc thiết lập dữ liệu</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Thương hiệu */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              Thương hiệu
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-2 px-2.5 focus:outline-hidden cursor-pointer"
            >
              {thuongHieus.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          {/* Tính năng */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              Tính năng
            </label>
            <select
              value={currentFeature}
              onChange={(e) => setSelectedFeature(e.target.value)}
              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-2 px-2.5 focus:outline-hidden cursor-pointer"
            >
              {availableFeatures.map(feat => (
                <option key={feat} value={feat}>{feat === 'ĐM' ? 'Đổi màu (ĐM)' : feat === 'ASX' ? 'Ánh sáng xanh (ASX)' : feat}</option>
              ))}
            </select>
          </div>

          {/* Chiết suất */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              Chiết suất
            </label>
            <select
              value={currentChietXuat}
              onChange={(e) => setSelectedChietXuat(e.target.value)}
              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-2 px-2.5 focus:outline-hidden cursor-pointer"
            >
              {availableChietXuats.map(cx => (
                <option key={cx} value={cx}>{cx}</option>
              ))}
            </select>
          </div>

          {/* Kho / Chi nhánh */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-500" /> Chi nhánh / Kho
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-2 px-2.5 focus:outline-hidden cursor-pointer"
            >
              <option value="Tất cả">Tất cả chi nhánh (Tổng)</option>
              {chiNhanhs.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Loại độ CẬN / VIỄN */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              Loại độ CẬN / VIỄN
            </label>
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDiopterType('CẬN')}
                className={`py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  diopterType === 'CẬN' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                CẬN
              </button>
              <button
                type="button"
                onClick={() => setDiopterType('VIỄN')}
                className={`py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  diopterType === 'VIỄN' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                VIỄN
              </button>
            </div>
          </div>
        </div>

        {/* Chế độ hiển thị lượng/màu */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-5">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Chế độ xem ma trận:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-650 cursor-pointer">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === 'QUANTITY'}
                  onChange={() => setDisplayMode('QUANTITY')}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                Hiện số lượng tồn
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-650 cursor-pointer">
                <input
                  type="radio"
                  name="displayMode"
                  checked={displayMode === 'STATUS'}
                  onChange={() => setDisplayMode('STATUS')}
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                Hiện trạng thái cảnh báo màu
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-150">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono mr-1">Chú giải màu:</span>
            {[
              { label: 'Hết', bg: 'bg-red-600' },
              { label: 'Nguy cấp', bg: 'bg-red-300' },
              { label: 'Thấp', bg: 'bg-orange-400' },
              { label: 'Đạt', bg: 'bg-yellow-300' },
              { label: 'An toàn', bg: 'bg-emerald-500' }
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                <span className={`w-2.5 h-2.5 rounded-full ${item.bg}`} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MA TRẬN BẢNG ĐỘ */}
      <div className="bento-card bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs relative">
        
        {/* Tiêu đề hiển thị tổ hợp lọc đang áp dụng */}
        <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex justify-between items-center text-slate-500 text-[10px] uppercase font-bold tracking-wider font-mono">
          <span>{selectedBrand} {currentChietXuat} {currentFeature} ({diopterType})</span>
          <span>Kho: {selectedBranch}</span>
        </div>

        {/* Wrapper cho phép cuộn ngang dọc đồng thời và hỗ trợ cố định trục */}
        <div className="overflow-auto max-h-[550px] scrollbar-thin">
          <table key={`${selectedBrand}_${currentChietXuat}_${currentFeature}_${diopterType}`} className="w-full border-collapse text-left relative table-fixed min-w-[700px]">
            
            {/* Header dòng trên cùng: Trục loạn (LOẠN) */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50/90 border-b border-slate-150 backdrop-blur-xs">
                {/* Ô góc giao nhau Top-Left */}
                <th className="sticky left-0 top-0 z-30 bg-slate-100 border-r border-slate-200 p-2.5 text-center font-bold font-sans text-[11px] text-slate-800 w-24 shadow-[2px_0_5px_rgba(0,0,0,0.03)] shrink-0">
                  <div className="flex flex-col items-center justify-center leading-none">
                    <span className="text-[8px] text-slate-400 font-bold self-end uppercase">LOẠN →</span>
                    <div className="h-[1px] w-full bg-slate-200 my-1" />
                    <span className="text-[8px] text-slate-400 font-bold self-start uppercase">← CẬN</span>
                  </div>
                </th>
                
                {/* Các cột độ loạn */}
                {loanList.map(loan => (
                  <th key={loan} className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-[10px] text-slate-600 w-16">
                    {formatDop(loan)}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Thân bảng: Các dòng độ cận/viễn (CẬN) */}
            <tbody>
              {canList.map(can => (
                <tr key={can} className="border-b border-slate-150 hover:bg-slate-50/30 transition-colors">
                  
                  {/* Cột đầu tiên: Trục độ cận SPH (Sticky Trái) */}
                  <td className="sticky left-0 z-10 bg-slate-50/95 border-r border-slate-200 p-2.5 text-center font-mono font-bold text-[10px] text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.02)] backdrop-blur-xs">
                    {formatDop(can)}
                  </td>

                  {/* Các ô giá trị tương ứng */}
                  {loanList.map(loan => {
                    const info = getCellStockInfo(can, loan);
                    const dyn = getInventoryDynamicStyle(info.tonCuoi, info.tonToiThieu, info.exists);
                    return (
                      <td
                        key={`${can}_${loan}`}
                        onClick={() => {
                          if (info.exists) {
                            setSelectedCellDetail({
                              can,
                              loan,
                              sku: info.sku,
                              exists: info.exists,
                              tonCuoi: info.tonCuoi,
                              tonToiThieu: info.tonToiThieu,
                              status: dyn.status,
                              product: info.product
                            });
                          }
                        }}
                        style={info.exists ? dyn.style : {}}
                        className={`p-1 border-r border-slate-150 text-center font-mono text-[11.5px] transition-all relative ${
                          info.exists 
                            ? 'cursor-pointer active:scale-95 hover:brightness-105 shadow-2xs' 
                            : 'bg-slate-100 dark:bg-slate-800/40 text-slate-350 dark:text-slate-650 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-40'
                        }`}
                        title={info.exists ? `${info.sku}\nTồn: ${info.tonCuoi} / Tối thiểu: ${info.tonToiThieu} (${getStatusLabel(dyn.status)})` : 'Chưa định nghĩa SKU'}
                      >
                        <div className="h-8.5 w-full flex items-center justify-center">
                          {info.exists ? (
                            displayMode === 'QUANTITY' ? (
                              <span className="font-extrabold tracking-tight">{info.tonCuoi}</span>
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-white/75 shadow-xs animate-pulse" />
                            )
                          ) : (
                            <span className="text-slate-350 dark:text-slate-600">-</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer ghi chú của bảng độ */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 text-slate-400 text-[10px]">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Mẹo: Cuộn theo cả chiều ngang và dọc. Bấm vào một ô có số lượng để xem chi tiết thông số và trạng thái tồn kho của SKU tương ứng.</span>
        </div>
      </div>

      {/* 4. MODAL CHI TIẾT Ô TRÒNG KÍNH (CELL DETAIL POPUP) */}
      <AnimatePresence>
        {selectedCellDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-150 overflow-hidden"
            >
              
              {/* Header Modal */}
              <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-slate-800 text-sm">Chi Tiết Tọa Độ Độ Kính</h3>
                    <p className="text-[9px] text-slate-400 font-mono">Thông số quang học kỹ thuật của tròng kính</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCellDetail(null)}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Đóng chi tiết"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-5 space-y-4">
                
                {/* SKU & Tên hiển thị */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-1">
                  <div className="text-[9px] uppercase font-bold tracking-wider text-slate-400 font-mono">Mã SKU Hệ Thống</div>
                  <div className="text-xs font-mono font-bold text-slate-950 break-all">{selectedCellDetail.sku}</div>
                  {selectedCellDetail.product && (
                    <div className="text-xs text-slate-500 font-medium pt-1 border-t border-slate-200/60 mt-1">
                      {selectedCellDetail.product.TEN_SAN_PHAM}
                    </div>
                  )}
                </div>

                {/* Phân nhóm thuộc tính danh mục */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50/40 border border-slate-100 p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Thương hiệu</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{selectedBrand}</div>
                  </div>
                  <div className="bg-slate-50/40 border border-slate-100 p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Tính năng</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{currentFeature}</div>
                  </div>
                  <div className="bg-slate-50/40 border border-slate-100 p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Chiết suất</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{currentChietXuat}</div>
                  </div>
                </div>

                {/* Độ CẬN & Độ LOẠN */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-50/40 border border-slate-100 p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Độ CẬN / VIỄN</div>
                    <div className="font-mono font-bold text-slate-700 mt-0.5">{formatDop(selectedCellDetail.can)}</div>
                  </div>
                  <div className="bg-slate-50/40 border border-slate-100 p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Độ LOẠN</div>
                    <div className="font-mono font-bold text-slate-700 mt-0.5">{formatDop(selectedCellDetail.loan)}</div>
                  </div>
                </div>

                {/* Tồn kho chi tiết & Chỉnh sửa trực tiếp */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-4">
                  {/* Trạng thái tồn */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-500">Trạng thái hiện tại:</span>
                    <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded-full ${getStatusBadgeClass(selectedCellDetail.status)}`}>
                      {getStatusLabel(selectedCellDetail.status)}
                    </span>
                  </div>

                  {/* Hiển thị tồn kho hiện tại hệ thống */}
                  <div className="p-3 bg-white rounded-lg border border-slate-150 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tồn hệ thống</span>
                      <span className="text-sm font-mono font-extrabold text-slate-800">
                        {selectedCellDetail.tonCuoi} <span className="text-[10px] text-slate-400 font-medium">miếng</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Kho lưu trữ</span>
                      <span className="text-xs font-semibold text-slate-600 font-mono">
                        {selectedBranch === 'Tất cả' ? 'Tổng kho' : selectedBranch}
                      </span>
                    </div>
                  </div>

                  {/* Ô nhập chỉnh sửa nếu có quyền */}
                  {selectedCellDetail.exists && hasPerm('product.edit') ? (
                    <div className="space-y-3.5 pt-1">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Tồn tối thiểu (sửa)</label>
                          <input
                            type="number"
                            min="0"
                            value={editTonToiThieu}
                            onChange={(e) => {
                              setEditTonToiThieu(e.target.value);
                              setModalErrorMsg('');
                            }}
                            className="w-full text-xs font-semibold text-slate-850 bg-white border border-slate-200 rounded-lg p-2 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/10"
                            placeholder="Ví dụ: 10"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-slate-500 block">Tồn thực tế (nhập)</label>
                          <input
                            type="number"
                            min="0"
                            value={editTonThucTe}
                            onChange={(e) => {
                              setEditTonThucTe(e.target.value);
                              setModalErrorMsg('');
                            }}
                            className="w-full text-xs font-semibold text-slate-850 bg-white border border-slate-200 rounded-lg p-2 font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/10"
                            placeholder="Ví dụ: 25"
                          />
                        </div>
                      </div>

                      {/* Thông báo tự động bù trừ nếu có chênh lệch */}
                      {editTonThucTe.trim() !== '' && !isNaN(parseInt(editTonThucTe, 10)) && parseInt(editTonThucTe, 10) !== selectedCellDetail.tonCuoi && (
                        <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100/70 flex items-start gap-1.5 text-[10px] text-amber-700 leading-normal">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <span>
                            Phát hiện chênh lệch đếm thực tế! Hệ thống sẽ <strong>tự động tạo phiếu kiểm kho</strong> {parseInt(editTonThucTe, 10) > selectedCellDetail.tonCuoi ? 'NHẬP BÙ' : 'XUẤT BÙ'} (<strong>{parseInt(editTonThucTe, 10) > selectedCellDetail.tonCuoi ? 'PNK' : 'PXK'}xxxxx</strong>) lệch {parseInt(editTonThucTe, 10) - selectedCellDetail.tonCuoi > 0 ? '+' : ''}{parseInt(editTonThucTe, 10) - selectedCellDetail.tonCuoi} cái để bù trừ kho.
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-100 text-[10px] text-slate-400 italic">
                      {!selectedCellDetail.exists ? 'Không thể cập nhật sản phẩm chưa được khai báo.' : 'Tài khoản không có quyền ghi để chỉnh sửa tồn kho.'}
                    </div>
                  )}
                </div>

                {/* Local Modal Error Message */}
                {modalErrorMsg && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-lg border border-red-100 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                    <span>{modalErrorMsg}</span>
                  </div>
                )}

              </div>

              {/* Footer Modal */}
              <div className="p-3 bg-slate-50 border-t border-slate-150 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCellDetail(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  disabled={isSaving}
                >
                  Đóng
                </button>
                {selectedCellDetail.exists && hasPerm('product.edit') && (
                  <button
                    type="button"
                    onClick={handleSaveCellUpdate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
