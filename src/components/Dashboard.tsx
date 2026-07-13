/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  Download, 
  FileSpreadsheet, 
  FileText,
  Filter,
  RefreshCw,
  Clock,
  PieChart as PieIcon,
  Tag,
  ListPlus
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { SanPham, NhapXuat, NhapXuatCT } from '../types';

/**
 * FILE: Dashboard.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Module phân tích dữ liệu kho tròng kính thời gian thực.
 *        Cung cấp các biểu đồ động trực quan hóa hoạt động nhập xuất,
 *        phát hiện hàng tồn kho chạm ngưỡng cảnh báo, bộ lọc đa chiều và chọn nhanh thời gian tiện ích.
 */

interface DashboardProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  chiNhanhs: string[];
  onQuickRestock?: (sku: string) => void;
}

export default function Dashboard({ sanPhams, nhapXuats, nhapXuatCTs, chiNhanhs, onQuickRestock }: DashboardProps) {
  // --- 1. QUẢN LÝ TRẠNG THÁI BỘ LỌC ---
  const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('Tất cả');
  const [selectedFeatureFilter, setSelectedFeatureFilter] = useState<string>('Tất cả');
  const [selectedSkuFilter, setSelectedSkuFilter] = useState<string>('Tất cả');
  const [chartType, setChartType] = useState<'line' | 'stacked'>('line');
  
  // Dữ liệu mẫu năm 2026, nên mặc định đặt khoảng thời gian từ 2026-07-01 đến 2026-07-31
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('30d');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Bảng màu sắc cao cấp, độ tương phản cao, hiện đại cho Biểu đồ Pie/Bar
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

  // Xác định ngày cuối cùng trong bộ dữ liệu để làm mốc thời gian động (tránh trắng bảng)
  const maxDataDateStr = useMemo(() => {
    if (nhapXuats.length === 0) return '2026-07-12';
    const dates = nhapXuats.map(h => h.NGAY).filter(Boolean);
    if (dates.length === 0) return '2026-07-12';
    dates.sort();
    return dates[dates.length - 1];
  }, [nhapXuats]);

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // --- 2. BỘ LỌC NHANH THỜI GIAN (QUICK FILTERS) ---
  const handleQuickFilter = (type: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | '7d' | '30d' | '90d' | '6m' | '1y') => {
    setActiveQuickFilter(type);
    const today = new Date();
    
    if (type === 'today') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (type === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (type === 'this_week') {
      const currentDay = today.getDay();
      const distance = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distance);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(sunday));
    } else if (type === 'last_week') {
      const currentDay = today.getDay();
      const distance = (currentDay === 0 ? -6 : 1 - currentDay) - 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distance);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(sunday));
    } else if (type === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    } else if (type === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    } else {
      const refDate = new Date(maxDataDateStr);
      setEndDate(formatDate(refDate));
      const startDateObj = new Date(refDate);
      if (type === '7d') {
        startDateObj.setDate(startDateObj.getDate() - 7);
      } else if (type === '30d') {
        startDateObj.setDate(startDateObj.getDate() - 30);
      } else if (type === '90d') {
        startDateObj.setDate(startDateObj.getDate() - 90);
      } else if (type === '6m') {
        startDateObj.setMonth(startDateObj.getMonth() - 6);
      } else if (type === '1y') {
        startDateObj.setFullYear(startDateObj.getFullYear() - 1);
      }
      setStartDate(formatDate(startDateObj));
    }
  };

  const handleResetFilters = () => {
    setSelectedBranch('Tất cả');
    setSelectedBrandFilter('Tất cả');
    setSelectedFeatureFilter('Tất cả');
    setSelectedSkuFilter('Tất cả');
    setStartDate('2026-07-01');
    setEndDate('2026-07-31');
    setActiveQuickFilter('30d');
  };

  // --- 3. LỌC DỮ LIỆU THEO ĐIỀU KIỆN ---
  // Lọc phiếu theo Chi nhánh và Khoảng thời gian
  const filteredHeadersBase = useMemo(() => {
    return nhapXuats.filter(h => {
      const matchBranch = selectedBranch === 'Tất cả' || h.CHI_NHANH === selectedBranch;
      const matchDate = h.NGAY >= startDate && h.NGAY <= endDate;
      return matchBranch && matchDate;
    });
  }, [nhapXuats, selectedBranch, startDate, endDate]);

  // Lọc chi tiết phiếu khớp với Header cơ sở VÀ khớp bộ lọc Brand, Tính năng, SKU
  const filteredDetails = useMemo(() => {
    const headerIds = new Set(filteredHeadersBase.map(h => h.HOA_DON));
    return nhapXuatCTs.filter(d => {
      if (!headerIds.has(d.HOA_DON)) return false;
      
      const matchBrand = selectedBrandFilter === 'Tất cả' || d.THUONG_HIEU === selectedBrandFilter;
      const matchFeature = selectedFeatureFilter === 'Tất cả' || d.TINH_NANG === selectedFeatureFilter;
      const matchSku = selectedSkuFilter === 'Tất cả' || d.SKU === selectedSkuFilter;
      
      return matchBrand && matchFeature && matchSku;
    });
  }, [nhapXuatCTs, filteredHeadersBase, selectedBrandFilter, selectedFeatureFilter, selectedSkuFilter]);

  // Lọc lại Headers tương ứng với các dòng chi tiết thực tế
  const filteredHeaders = useMemo(() => {
    const activeHeaderIds = new Set(filteredDetails.map(d => d.HOA_DON));
    return filteredHeadersBase.filter(h => activeHeaderIds.has(h.HOA_DON));
  }, [filteredHeadersBase, filteredDetails]);

  // --- 4. TẤT CẢ DANH SÁCH DROPDOWN CHO BỘ LỌC ĐA CHIỀU ---
  const brandOptions = useMemo(() => {
    const set = new Set(sanPhams.map(p => p.THUONG_HIEU));
    return Array.from(set).sort();
  }, [sanPhams]);

  const skuOptions = useMemo(() => {
    const filtered = sanPhams.filter(p => {
      const matchBrand = selectedBrandFilter === 'Tất cả' || p.THUONG_HIEU === selectedBrandFilter;
      const matchFeature = selectedFeatureFilter === 'Tất cả' || p.TINH_NANG === selectedFeatureFilter;
      return matchBrand && matchFeature;
    });
    return filtered.map(p => p.SKU).sort();
  }, [sanPhams, selectedBrandFilter, selectedFeatureFilter]);

  // --- 4. TÍNH TOÁN CÁC KPI CHỦ CHỐT (TẬP TRUNG HIỆU NĂNG) ---
  const kpis = useMemo(() => {
    const totalProducts = sanPhams.length;

    let numPhieuNhap = 0;
    let numPhieuXuat = 0;

    filteredHeaders.forEach(h => {
      if (h.LOAI === 'NHẬP') numPhieuNhap++;
      if (h.LOAI === 'XUẤT') numPhieuXuat++;
    });

    let totalNhap = 0;
    let totalXuat = 0;

    filteredDetails.forEach(d => {
      if (d.LOAI === 'NHẬP') totalNhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') totalXuat += d.SO_LUONG;
    });

    const lowStockCount = sanPhams.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU).length;

    return {
      totalProducts,
      numPhieuNhap,
      numPhieuXuat,
      totalNhap,
      totalXuat,
      lowStockCount
    };
  }, [sanPhams, filteredHeaders, filteredDetails]);

  // --- 5. BIỂU ĐỒ 1: TOP 5 SKU XUẤT NHIỀU NHẤT ---
  const topXuatData = useMemo(() => {
    const mapXuat: Record<string, { sku: string; qty: number; name: string }> = {};

    filteredDetails.forEach(d => {
      if (d.LOAI === 'XUẤT') {
        if (!mapXuat[d.SKU]) {
          mapXuat[d.SKU] = { sku: d.SKU, qty: 0, name: d.TEN_SP };
        }
        mapXuat[d.SKU].qty += d.SO_LUONG;
      }
    });

    return Object.values(mapXuat)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(item => ({
        name: item.sku.split(' ').slice(0, 3).join(' '), 
        fullSKU: item.sku,
        'Số lượng xuất': item.qty
      }));
  }, [filteredDetails]);

  // --- 6. BIỂU ĐỒ 2: TỶ TRỌNG NHẬP XUẤT (PIE CHART) ---
  const ratioData = useMemo(() => {
    return [
      { name: 'Tổng Nhập', value: kpis.totalNhap },
      { name: 'Tổng Xuất', value: kpis.totalXuat }
    ].filter(item => item.value > 0);
  }, [kpis]);

  // --- 7. BIỂU ĐỒ 3: CHI NHÁNH LẤY HÀNG NHIỀU NHẤT (BAR CHART) ---
  const branchData = useMemo(() => {
    const mapBranch: Record<string, { branch: string; qty: number }> = {};

    filteredHeaders.forEach(h => {
      if (h.LOAI === 'XUẤT') {
        if (!mapBranch[h.CHI_NHANH]) {
          mapBranch[h.CHI_NHANH] = { branch: h.CHI_NHANH, qty: 0 };
        }
        mapBranch[h.CHI_NHANH].qty += h.TONG_SL;
      }
    });

    return Object.values(mapBranch)
      .sort((a, b) => b.qty - a.qty)
      .map(item => ({
        name: item.branch,
        'Số lượng xuất': item.qty
      }));
  }, [filteredHeaders]);

  // --- 8. BIỂU ĐỒ 4: NGÀY GIAO DỊCH NHIỀU NHẤT (LINE CHART) ---
  const transactionByDateData = useMemo(() => {
    const mapDate: Record<string, { date: string; nhap: number; xuất: number }> = {};

    filteredDetails.forEach(d => {
      const dateStr = d.NGAY;
      if (!mapDate[dateStr]) {
        mapDate[dateStr] = { date: dateStr, nhap: 0, xuất: 0 };
      }
      if (d.LOAI === 'NHẬP') mapDate[dateStr].nhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') mapDate[dateStr].xuất += d.SO_LUONG;
    });

    return Object.values(mapDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        name: item.date.split('-').slice(1).join('/'),
        'Nhập': item.nhap,
        'Xuất': item.xuất
      }));
  }, [filteredDetails]);

  // --- 9. BIỂU ĐỒ 5: TỶ LỆ HÀNG TỒN THEO THƯƠNG HIỆU (PIE CHART MỚI) ---
  const brandStockData = useMemo(() => {
    const mapBrand: Record<string, number> = {};
    sanPhams.forEach(p => {
      mapBrand[p.THUONG_HIEU] = (mapBrand[p.THUONG_HIEU] || 0) + p.TON_CUOI;
    });
    return Object.entries(mapBrand)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sanPhams]);

  // --- 10. DANH SÁCH CẢNH BÁO SẮP HẾT HÀNG ---
  const criticalProducts = useMemo(() => {
    return sanPhams
      .filter(p => p.TON_CUOI <= p.TON_TOI_THIEU)
      .sort((a, b) => (a.TON_CUOI / a.TON_TOI_THIEU) - (b.TON_CUOI / b.TON_TOI_THIEU));
  }, [sanPhams]);

  // --- 11. XỬ LÝ XUẤT FILE BÁO CÁO (EXCEL/PDF) ---
  const handleExportData = (type: 'EXCEL' | 'PDF') => {
    setIsExporting(true);
    setTimeout(() => {
      if (type === 'EXCEL') {
        let csvContent = '\uFEFF'; 
        csvContent += 'BÁO CÁO XUẤT NHẬP TỒN TRÒNG KÍNH CHI TIẾT\n';
        csvContent += `Chi nhánh: ${selectedBranch}, Khoảng thời gian: ${startDate} đến ${endDate}\n\n`;
        csvContent += 'MÃ SKU,TÊN SẢN PHẨM,THƯƠNG HIỆU,CHIẾT SUẤT,CẬN,LOẠN,TỒN ĐẦU,NHẬP,XUẤT,TỒN CUỐI,TỒN TỐI THIỂU,TRẠNG THÁI\n';
        
        sanPhams.forEach(p => {
          const status = p.TON_CUOI <= p.TON_TOI_THIEU ? 'SẮP HẾT HÀNG!' : 'AN TOÀN';
          csvContent += `"${p.SKU}","${p.TEN_SAN_PHAM}","${p.THUONG_HIEU}","${p.CHIET_XUAT}",${p.CAN},${p.LOAN},${p.TON_DAU},${p.NHAP},${p.XUAT},${p.TON_CUOI},${p.TON_TOI_THIEU},"${status}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Bao_Cao_Ton_Kho_${selectedBranch.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.print();
      }
      setIsExporting(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. THANH BỘ LỌC ĐA NHIỆM CHUYÊN NGHIỆP */}
      <div id="dashboard-filter-section" className="bento-card !p-5 bg-white border border-slate-100 rounded-2xl shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-slate-800 text-base">Dashboard Phân Tích Kho</h2>
              <p className="text-xs text-slate-400 font-mono">Hệ thống phân tích đa chiều tự động cập nhật mượt mà</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset bộ lọc
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Đồ thị:</span>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    chartType === 'line' ? 'bg-blue-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đường xu hướng
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('stacked')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    chartType === 'stacked' ? 'bg-blue-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cột chồng
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Bộ lọc nhanh thời gian (Date Range presets) */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Lọc nhanh khoảng thời gian
            </label>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-lg">
              {([
                { key: 'today', label: 'Hôm nay' },
                { key: 'yesterday', label: 'Hôm qua' },
                { key: 'this_week', label: 'Tuần này' },
                { key: 'last_week', label: 'Tuần trước' },
                { key: 'this_month', label: 'Tháng này' },
                { key: 'last_month', label: 'Tháng trước' }
              ] as const).map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleQuickFilter(f.key)}
                  className={`px-2 py-1 text-[9px] font-extrabold rounded-md transition-all cursor-pointer ${
                    activeQuickFilter === f.key ? 'bg-red-650 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chi nhánh */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Chi nhánh
            </label>
            <select 
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả chi nhánh</option>
              {chiNhanhs.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Thương hiệu */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Thương hiệu
            </label>
            <select 
              value={selectedBrandFilter}
              onChange={(e) => { setSelectedBrandFilter(e.target.value); setSelectedSkuFilter('Tất cả'); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả thương hiệu</option>
              {brandOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Tính năng */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Tính năng
            </label>
            <select 
              value={selectedFeatureFilter}
              onChange={(e) => { setSelectedFeatureFilter(e.target.value); setSelectedSkuFilter('Tất cả'); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả tính năng</option>
              <option value="ĐM">Đổi màu (ĐM)</option>
              <option value="ASX">Chống ánh sáng xanh (ASX)</option>
            </select>
          </div>

          {/* SKU cụ thể */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Boxes className="w-3 h-3" /> Mã SKU tròng kính
            </label>
            <select 
              value={selectedSkuFilter}
              onChange={(e) => setSelectedSkuFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả SKU</option>
              {skuOptions.map(sku => (
                <option key={sku} value={sku}>{sku}</option>
              ))}
            </select>
          </div>

          {/* Ngày bắt đầu */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Ngày bắt đầu
            </label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-bold text-slate-755 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden font-mono"
            />
          </div>

          {/* Ngày kết thúc */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Ngày kết thúc
            </label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-bold text-slate-755 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. CHỈ SỐ KPI CHỦ CHỐT - PHÙ HỢP HOÀN TOÀN VỚI YÊU CẦU NGHIỆP VỤ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Tổng phiếu nhập</p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuNhap}</p>
          </div>
        </div>

        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Tổng phiếu xuất</p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuXuat}</p>
          </div>
        </div>

        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Số lượng đã nhập</p>
            <p className="stat-value text-slate-855 font-mono font-bold text-lg">{kpis.totalNhap} <span className="text-[10px] text-slate-400">miếng</span></p>
          </div>
        </div>

        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Số lượng đã xuất</p>
            <p className="stat-value text-slate-855 font-mono font-bold text-lg">{kpis.totalXuat} <span className="text-[10px] text-slate-400">miếng</span></p>
          </div>
        </div>
      </div>

      {/* 3. ĐỒ THỊ BIỂU DIỄN PHÂN TÍCH CHUYÊN SÂU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biểu đồ 1: Biến Động Nhập Xuất Theo Ngày (Line hoặc Stacked Bar) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-850 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex justify-between items-center">
            <span>Biến Động Nhập Xuất Theo Ngày</span>
            <span className="text-[10px] text-slate-400 normal-case font-mono">Dữ liệu theo kỳ lọc</span>
          </h3>
          <div className="h-64 w-full">
            {transactionByDateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={transactionByDateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="Nhập" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Xuất" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                ) : (
                  <BarChart data={transactionByDateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Nhập" stackId="a" fill="#10b981" />
                    <Bar dataKey="Xuất" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                Không có dữ liệu giao dịch trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ 5: Tỷ Lệ Hàng Tồn Kho Theo Thương Hiệu (Pie Chart Mới) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Tỷ Lệ Hàng Tồn Kho Theo Thương Hiệu
          </h3>
          <div className="h-64 flex flex-col sm:flex-row items-center justify-around gap-4">
            {brandStockData.length > 0 ? (
              <>
                <div className="h-44 w-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={brandStockData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {brandStockData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} miếng`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 overflow-y-auto max-h-48 pr-1 flex-1">
                  {brandStockData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-slate-600 truncate max-w-[100px]">{item.name}</span>
                      </div>
                      <span className="font-mono text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 font-mono">
                Không có dữ liệu tồn kho thương hiệu
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ 2: Top 5 SKU Xuất Nhiều Nhất (Bar Chart) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Top 5 SKU Xuất Kho Nhiều Nhất
          </h3>
          <div className="h-64 w-full">
            {topXuatData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topXuatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                  <Bar dataKey="Số lượng xuất" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {topXuatData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                Chưa có dữ liệu xuất kho phát sinh trong kỳ lọc
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ 3: Chi Nhánh Lấy Hàng Nhiều Nhất (Bar Chart) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Sản Lượng Xuất Theo Chi Nhánh
          </h3>
          <div className="h-64 w-full">
            {branchData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                  <Bar dataKey="Số lượng xuất" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={25} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                Chưa ghi nhận xuất kho tại các chi nhánh ngoại vi
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 4. CHIA HAI PHÂN VÙNG: SẮP HẾT HÀNG & CHỨC NĂNG XUẤT BÁO CÁO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DANH SÁCH SẮP HẾT HÀNG (2/3 Cột) */}
        <div className="bento-card !p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 w-full flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                Sản Phẩm Đang Cận Ngưỡng Tối Thiểu ({criticalProducts.length})
              </span>
              <span className="text-[10px] font-mono px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-bold">
                Khẩn cấp
              </span>
            </h3>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 pr-1">
            {criticalProducts.length > 0 ? (
              criticalProducts.map(p => {
                const ratio = p.TON_CUOI / p.TON_TOI_THIEU;
                let barColor = 'bg-red-500';
                if (ratio > 0.5) barColor = 'bg-amber-500';

                return (
                  <div key={p.SKU} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/40 px-2 rounded-xl transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{p.SKU}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${barColor}`} 
                          style={{ width: `${Math.min(ratio * 100, 100)}%` }} 
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-600">{p.TON_CUOI} {p.DVT}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Tối thiểu: {p.TON_TOI_THIEU}</p>
                      </div>
                      {onQuickRestock && (
                        <button
                          onClick={() => onQuickRestock(p.SKU)}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-3xs"
                          title="Lập phiếu nhập nhanh cho sản phẩm này"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Nhập</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-mono">
                Tuyệt vời! Toàn bộ sản phẩm đều ở trạng thái an toàn trên ngưỡng tồn kho tối thiểu.
              </div>
            )}
          </div>
        </div>

        {/* XUẤT BÁO CÁO DOANH THU & KHO (1/3 Cột) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Kết Xuất Dữ Liệu
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Lựa chọn định dạng kết xuất dữ liệu báo cáo xuất nhập tồn tương thích trực tiếp với các phần mềm quản lý hoặc in ấn văn phòng.
          </p>
          
          <div className="space-y-3.5">
            <button
              onClick={() => handleExportData('EXCEL')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4.5 h-4.5" />
              {isExporting ? 'Đang trích xuất...' : 'Xuất Báo Cáo Excel (CSV)'}
            </button>

            <button
              onClick={() => handleExportData('PDF')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4.5 h-4.5" />
              In Bản Báo Cáo PDF
            </button>
            
            <div className="border-t border-dashed border-slate-100 pt-4 text-center">
              <span className="text-[10px] font-mono text-slate-400 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Chu kỳ làm mới: Tức thì (Realtime)
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
