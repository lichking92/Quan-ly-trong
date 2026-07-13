/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Filter, 
  MapPin, 
  Eye, 
  Grid, 
  X, 
  Info, 
  HelpCircle, 
  LayoutGrid, 
  CheckCircle, 
  SlidersHorizontal, 
  RefreshCw, 
  AlertTriangle,
  Boxes,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, NhapXuat, NhapXuatCT, KiemKho, ThươngHieu } from '../types';
import { formatDop, generateSKUString, generateSphOptions } from '../data/mockData';

interface DiopterMatrixProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  kiemKhos: KiemKho[];
  chiNhanhs: string[];
  thuongHieus: string[];
  brandList?: ThươngHieu[];
  currentUser: any;
}

export default function DiopterMatrix({
  sanPhams = [],
  nhapXuats = [],
  nhapXuatCTs = [],
  kiemKhos = [],
  chiNhanhs = [],
  thuongHieus = [],
  brandList = [],
  currentUser
}: DiopterMatrixProps) {
  // --- 1. QUẢN LÝ BỘ LỌC CHUYÊN BIỆT ---
  const [selectedBrand, setSelectedBrand] = useState<string>(() => {
    return thuongHieus.length > 0 ? thuongHieus[0] : 'Blick';
  });
  
  // Lấy các tính năng khả dụng của thương hiệu được chọn
  const availableFeatures = useMemo(() => {
    if (!brandList || brandList.length === 0) return ['ĐM', 'ASX'];
    const featuresSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim() === selectedBrand.trim())
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
      .filter(b => b.THUONG_HIEU.trim() === selectedBrand.trim())
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

  // Kho hàng / chi nhánh
  const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả');

  // Loại độ (CẬN / VIỄN)
  const [diopterType, setDiopterType] = useState<'CẬN' | 'VIỄN'>('CẬN');

  // Chế độ hiển thị: 'QUANTITY' (Hiển thị số lượng) | 'STATUS' (Hiển thị màu trạng thái)
  const [displayMode, setDisplayMode] = useState<'QUANTITY' | 'STATUS'>('QUANTITY');

  // Trạng thái hiển thị modal chi tiết ô
  const [selectedCellDetail, setSelectedCellDetail] = useState<{
    sph: number;
    cyl: number;
    sku: string;
    exists: boolean;
    tonCuoi: number;
    tonToiThieu: number;
    status: 'Hết hàng' | 'Nguy cấp' | 'Thấp' | 'Đạt yêu cầu' | 'An toàn';
    product?: SanPham;
  } | null>(null);

  // --- 2. XÁC ĐỊNH TRỤC SPH (Y) VÀ CYL (X) ---
  const sphList = useMemo(() => {
    return generateSphOptions(selectedBrand, selectedChietXuat, brandList || [], diopterType);
  }, [selectedBrand, selectedChietXuat, brandList, diopterType]);

  const cylList = useMemo(() => {
    const list: number[] = [];
    // 0.00 -> -2.00 bước nhảy 0.25
    for (let c = 0.00; c >= -2.00; c -= 0.25) {
      list.push(Number(c.toFixed(2)));
    }
    return list;
  }, []);

  // --- 3. ĐỒNG BỘ DỮ LIỆU SẢN PHẨM & TÍNH TỒN KHO THEO BỘ LỌC ---
  // Để tối ưu hiệu năng, chúng ta build một Map tra cứu nhanh dựa trên SPH và CYL
  const filteredProductsMap = useMemo(() => {
    const map = new Map<string, SanPham>();
    
    sanPhams.forEach(p => {
      const matchBrand = p.THUONG_HIEU.trim().toLowerCase() === selectedBrand.trim().toLowerCase();
      const matchFeature = p.TINH_NANG.trim().toLowerCase() === selectedFeature.trim().toLowerCase();
      const matchChietXuat = p.CHIET_XUAT.trim() === selectedChietXuat.trim();
      
      if (matchBrand && matchFeature && matchChietXuat) {
        const key = `${p.CAN.toFixed(2)}_${p.LOAN.toFixed(2)}`;
        map.set(key, p);
      }
    });

    return map;
  }, [sanPhams, selectedBrand, selectedFeature, selectedChietXuat]);

  // Hàm tính toán tồn kho cho một SPH và CYL cụ thể
  const getCellStockInfo = (sph: number, cyl: number) => {
    const key = `${sph.toFixed(2)}_${cyl.toFixed(2)}`;
    const product = filteredProductsMap.get(key);

    if (!product) {
      return {
        sku: generateSKUString(selectedBrand, selectedChietXuat, selectedFeature, sph, cyl),
        exists: false,
        tonCuoi: 0,
        tonToiThieu: 0,
        status: 'Hết hàng' as const
      };
    }

    let tonCuoi = product.TON_CUOI;
    const tonToiThieu = product.TON_TOI_THIEU;

    // Nếu chọn chi nhánh cụ thể, tính toán lại tồn kho theo chi nhánh
    if (selectedBranch && selectedBranch !== 'Tất cả') {
      const branchHeaders = nhapXuats.filter(h => h.CHI_NHANH === selectedBranch);
      const branchHeaderIds = new Set(branchHeaders.map(h => h.HOA_DON));

      const branchDetails = nhapXuatCTs.filter(d => d.SKU === product.SKU && branchHeaderIds.has(d.HOA_DON));

      const totalNhap = branchDetails
        .filter(d => d.LOAI === 'NHẬP')
        .reduce((sum, d) => sum + d.SO_LUONG, 0);

      const totalXuat = branchDetails
        .filter(d => d.LOAI === 'XUẤT')
        .reduce((sum, d) => sum + d.SO_LUONG, 0);

      const totalAuditNhapBu = kiemKhos
        .filter(k => k.SKU === product.SKU && k.KHO === selectedBranch && k.LOAI_BU === 'NHẬP BÙ')
        .filter(k => !nhapXuatCTs.some(d => d.SKU === product.SKU && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
        .reduce((sum, k) => sum + k.LECH, 0);

      const totalAuditXuatBu = kiemKhos
        .filter(k => k.SKU === product.SKU && k.KHO === selectedBranch && k.LOAI_BU === 'XUẤT BÙ')
        .filter(k => !nhapXuatCTs.some(d => d.SKU === product.SKU && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
        .reduce((sum, k) => sum + Math.abs(k.LECH), 0);

      const finalNhap = totalNhap + totalAuditNhapBu;
      const finalXuat = totalXuat + totalAuditXuatBu;

      const isDefaultBranch = selectedBranch === 'Kho Trung Tâm';
      const branchTonDau = isDefaultBranch ? product.TON_DAU : 0;

      tonCuoi = Math.max(0, branchTonDau + finalNhap - finalXuat);
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

  // Trả về style màu cho ô tương ứng
  const getCellClasses = (status: 'Hết hàng' | 'Nguy cấp' | 'Thấp' | 'Đạt yêu cầu' | 'An toàn', exists: boolean) => {
    if (!exists) {
      return 'bg-slate-100 text-slate-350 border-slate-200 cursor-not-allowed opacity-40';
    }
    switch (status) {
      case 'Hết hàng':
        return 'bg-red-50 text-red-650 border-red-200 hover:bg-red-100';
      case 'Nguy cấp':
        return 'bg-rose-100/80 text-rose-800 border-rose-300 hover:bg-rose-200 font-bold';
      case 'Thấp':
        return 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100/80';
      case 'Đạt yêu cầu':
        return 'bg-yellow-50/70 text-yellow-700 border-yellow-250 hover:bg-yellow-100/80';
      case 'An toàn':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100/80';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
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
      case 'Hết hàng': return 'bg-red-500/10 text-red-600 border border-red-200';
      case 'Nguy cấp': return 'bg-rose-600/10 text-rose-700 border border-rose-300 font-bold';
      case 'Thấp': return 'bg-orange-500/10 text-orange-600 border border-orange-200';
      case 'Đạt yêu cầu': return 'bg-yellow-500/10 text-yellow-650 border border-yellow-200';
      case 'An toàn': return 'bg-emerald-500/10 text-emerald-600 border border-emerald-200';
      default: return 'bg-slate-500/10 text-slate-600 border border-slate-200';
    }
  };

  const getStatusColorDot = (status: string) => {
    switch (status) {
      case 'Hết hàng': return 'bg-red-500';
      case 'Nguy cấp': return 'bg-rose-700';
      case 'Thấp': return 'bg-orange-500';
      case 'Đạt yêu cầu': return 'bg-yellow-400';
      case 'An toàn': return 'bg-emerald-500';
      default: return 'bg-slate-300';
    }
  };

  // Khôi phục bộ lọc về mặc định
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

  return (
    <div className="space-y-6">
      
      {/* 1. THANH TIÊU ĐỀ & MÔ TẢ PHÂN KHU */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl shadow-xs">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-slate-850 text-lg">Bảng Độ (Ma Trận SPH/CYL)</h1>
            <p className="text-xs text-slate-400 font-mono">Tra cứu trực quan tồn kho kính mắt theo tọa độ khúc xạ chuyên sâu</p>
          </div>
        </div>

        <button
          onClick={handleResetFilters}
          className="self-start md:self-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset bộ lọc
        </button>
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
              value={selectedFeature}
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
              value={selectedChietXuat}
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

          {/* Loại độ (Cận / Viễn) */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              Loại độ cầu (SPH)
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

        {/* Cấu hình hiển thị nhanh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Chế độ hiển thị ô:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDisplayMode('QUANTITY')}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'QUANTITY' ? 'bg-slate-850 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                <Grid className="w-3 h-3" />
                Số lượng tồn
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('STATUS')}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'STATUS' ? 'bg-slate-850 text-white shadow-xs' : 'text-slate-500 hover:text-slate-850'
                }`}
              >
                <Eye className="w-3 h-3" />
                Màu trạng thái
              </button>
            </div>
          </div>

          {/* Chú giải ý nghĩa màu */}
          <div className="flex flex-wrap items-center gap-2.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /> Hết hàng</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-700 shrink-0" /> Nguy cấp</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" /> Thấp</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" /> Đạt</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> An toàn</span>
          </div>
        </div>
      </div>

      {/* 3. MA TRẬN BẢNG ĐỘ */}
      <div className="bento-card bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-xs relative">
        
        {/* Tiêu đề hiển thị tổ hợp lọc đang áp dụng */}
        <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex justify-between items-center text-slate-500 text-[10px] uppercase font-bold tracking-wider font-mono">
          <span>{selectedBrand} {selectedChietXuat} {selectedFeature} ({diopterType})</span>
          <span>Kho: {selectedBranch}</span>
        </div>

        {/* Wrapper cho phép cuộn ngang dọc đồng thời và hỗ trợ cố định trục */}
        <div className="overflow-auto max-h-[550px] scrollbar-thin">
          <table className="w-full border-collapse text-left relative table-fixed min-w-[700px]">
            
            {/* Header dòng trên cùng: Trục loạn (CYL) */}
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50/90 border-b border-slate-150 backdrop-blur-xs">
                {/* Ô góc giao nhau Top-Left */}
                <th className="sticky left-0 top-0 z-30 bg-slate-100 border-r border-slate-200 p-2.5 text-center font-bold font-sans text-[11px] text-slate-800 w-24 shadow-[2px_0_5px_rgba(0,0,0,0.03)] shrink-0">
                  <div className="flex flex-col items-center justify-center leading-none">
                    <span className="text-[8px] text-slate-400 font-bold self-end uppercase">CYL →</span>
                    <div className="h-[1px] w-full bg-slate-200 my-1" />
                    <span className="text-[8px] text-slate-400 font-bold self-start uppercase">← SPH</span>
                  </div>
                </th>
                
                {/* Các cột độ loạn */}
                {cylList.map(cyl => (
                  <th key={cyl} className="p-2.5 border-r border-slate-200 text-center font-mono font-bold text-[10px] text-slate-600 w-16">
                    {formatDop(cyl)}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Thân bảng: Các dòng độ cầu (SPH) */}
            <tbody>
              {sphList.map(sph => (
                <tr key={sph} className="border-b border-slate-150 hover:bg-slate-50/30 transition-colors">
                  
                  {/* Cột đầu tiên: Trục độ cầu SPH (Sticky Trái) */}
                  <td className="sticky left-0 z-10 bg-slate-50/95 border-r border-slate-200 p-2.5 text-center font-mono font-bold text-[10px] text-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.02)] backdrop-blur-xs">
                    {formatDop(sph)}
                  </td>

                  {/* Các ô giá trị tương ứng */}
                  {cylList.map(cyl => {
                    const info = getCellStockInfo(sph, cyl);
                    return (
                      <td
                        key={`${sph}_${cyl}`}
                        onClick={() => {
                          if (info.exists) {
                            setSelectedCellDetail({
                              sph,
                              cyl,
                              sku: info.sku,
                              exists: info.exists,
                              tonCuoi: info.tonCuoi,
                              tonToiThieu: info.tonToiThieu,
                              status: info.status,
                              product: info.product
                            });
                          }
                        }}
                        className={`p-1.5 border-r border-slate-150 text-center font-mono text-[11px] transition-all relative ${
                          getCellClasses(info.status, info.exists)
                        } ${info.exists ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed'}`}
                        title={info.exists ? `${info.sku}\nTồn: ${info.tonCuoi}` : 'Chưa định nghĩa SKU'}
                      >
                        <div className="h-9 w-full flex items-center justify-center">
                          {info.exists ? (
                            displayMode === 'QUANTITY' ? (
                              <span className="font-bold">{info.tonCuoi}</span>
                            ) : (
                              // Chế độ màu trạng thái: Render hình tròn đặc trưng có màu rõ ràng
                              <span className={`h-4.5 w-4.5 rounded-full flex shrink-0 animate-fade-in shadow-xs ${getStatusColorDot(info.status)}`} />
                            )
                          ) : (
                            <span className="text-slate-300">-</span>
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

                {/* Các thuộc tính quang học cốt lõi */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Độ Cầu (SPH)</div>
                    <div className="text-sm font-mono font-bold text-slate-800 mt-1">
                      {formatDop(selectedCellDetail.sph)}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-center">
                    <div className="text-[9px] uppercase font-bold text-slate-400">Độ Loạn (CYL)</div>
                    <div className="text-sm font-mono font-bold text-slate-800 mt-1">
                      {formatDop(selectedCellDetail.cyl)}
                    </div>
                  </div>
                </div>

                {/* Phân nhóm thuộc tính danh mục */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50/40 border p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Thương hiệu</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{selectedBrand}</div>
                  </div>
                  <div className="bg-slate-50/40 border p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Tính năng</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{selectedFeature}</div>
                  </div>
                  <div className="bg-slate-50/40 border p-2 rounded-lg">
                    <div className="text-[8px] uppercase font-bold text-slate-400">Chiết suất</div>
                    <div className="font-bold text-slate-700 truncate mt-0.5">{selectedChietXuat}</div>
                  </div>
                </div>

                {/* Tồn kho chi tiết */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-3">
                  
                  {/* Trạng thái tồn */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                    <span className="text-xs font-bold text-slate-500">Trạng thái kho:</span>
                    <span className={`text-[10px] font-extrabold py-0.5 px-2 rounded-full ${getStatusBadgeClass(selectedCellDetail.status)}`}>
                      {getStatusLabel(selectedCellDetail.status)}
                    </span>
                  </div>

                  {/* Số lượng */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400">Tồn kho hiện tại</div>
                      <div className="text-base font-mono font-extrabold text-slate-850 mt-1">
                        {selectedCellDetail.tonCuoi} <span className="text-[10px] text-slate-400 font-medium">miếng</span>
                      </div>
                      <div className="text-[8px] text-slate-400 font-medium font-sans mt-0.5">Kho: {selectedBranch}</div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-400 font-sans">Tồn tối thiểu đặt ra</div>
                      <div className="text-base font-mono font-extrabold text-slate-600 mt-1">
                        {selectedCellDetail.tonToiThieu} <span className="text-[10px] text-slate-400 font-medium">miếng</span>
                      </div>
                      <div className="text-[8px] text-slate-400 font-medium font-sans mt-0.5">Ngưỡng cảnh báo</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer Modal */}
              <div className="p-3 bg-slate-50 border-t border-slate-150 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCellDetail(null)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-900 active:bg-slate-950 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  Đóng chi tiết
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
