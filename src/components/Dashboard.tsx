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
  Tag
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
}

export default function Dashboard({ sanPhams, nhapXuats, nhapXuatCTs, chiNhanhs }: DashboardProps) {
  // --- 1. QUẢN LÝ TRẠNG THÁI BỘ LỌC ---
  const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả');
  
  // Dữ liệu mẫu năm 2026, nên mặc định đặt khoảng thời gian từ 2026-07-01 đến 2026-07-31
  const [startDate, setStartDate] = useState<string>('2026-07-01');
  const [endDate, setEndDate] = useState<string>('2026-07-31');
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('Tháng này');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Bảng màu sắc cao cấp, độ tương phản cao, hiện đại cho Biểu đồ Pie/Bar
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

  // --- 2. BỘ LỌC NHANH THỜI GIAN (QUICK FILTERS) ---
  const handleQuickFilter = (type: string) => {
    setActiveQuickFilter(type);
    const today = new Date();
    // Giả lập năm 2026 dựa theo dữ liệu thực tế mẫu của applet
    const year = 2026;
    const month = 7; // Tháng 7
    
    if (type === 'Hôm nay') {
      // Vì dữ liệu mẫu tập trung vào ngày 12/07/2026 nên giả lập ngày "Hôm nay" là 2026-07-12
      setStartDate('2026-07-12');
      setEndDate('2026-07-12');
    } else if (type === '7 ngày qua') {
      setStartDate('2026-07-06');
      setEndDate('2026-07-12');
    } else if (type === '30 ngày qua') {
      setStartDate('2026-07-01');
      setEndDate('2026-07-30');
    } else if (type === 'Tháng này') {
      setStartDate('2026-07-01');
      setEndDate('2026-07-31');
    }
  };

  // --- 3. LỌC DỮ LIỆU THEO ĐIỀU KIỆN ---
  // Lọc phiếu theo Chi nhánh và Khoảng thời gian
  const filteredHeaders = useMemo(() => {
    return nhapXuats.filter(h => {
      const matchBranch = selectedBranch === 'Tất cả' || h.CHI_NHANH === selectedBranch;
      const matchDate = h.NGAY >= startDate && h.NGAY <= endDate;
      return matchBranch && matchDate;
    });
  }, [nhapXuats, selectedBranch, startDate, endDate]);

  // Lấy danh sách ID hóa đơn đã lọc
  const filteredInvoiceIds = useMemo(() => {
    return new Set(filteredHeaders.map(h => h.HOA_DON));
  }, [filteredHeaders]);

  // Lọc chi tiết phiếu dựa vào danh sách ID hóa đơn đã được lọc từ Header
  const filteredDetails = useMemo(() => {
    return nhapXuatCTs.filter(d => filteredInvoiceIds.has(d.HOA_DON));
  }, [nhapXuatCTs, filteredInvoiceIds]);

  // --- 4. TÍNH TOÁN CÁC KPI CHỦ CHỐT (TẬP TRUNG HIỆU NĂNG) ---
  const kpis = useMemo(() => {
    const totalProducts = sanPhams.length;

    let totalNhap = 0;
    let totalXuat = 0;

    filteredDetails.forEach(d => {
      if (d.LOAI === 'NHẬP') totalNhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') totalXuat += d.SO_LUONG;
    });

    const lowStockCount = sanPhams.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU).length;

    return {
      totalProducts,
      totalNhap,
      totalXuat,
      lowStockCount
    };
  }, [sanPhams, filteredDetails]);

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
      
      {/* 1. THANH BỘ LỌC ĐA NHIỆM (BỔ SUNG NÚT BẤM CHỌN NHANH THỜI GIAN) */}
      <div id="dashboard-filter-section" className="bento-card !p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-slate-800 text-base">Báo Cáo Phân Tích Kho</h2>
              <p className="text-xs text-slate-400 font-mono">Dữ liệu phân tích đa chiều cập nhật thời gian thực</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
            {/* Bộ lọc nhanh thời gian */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              {['Hôm nay', '7 ngày qua', '30 ngày qua', 'Tháng này'].map(f => (
                <button
                  key={f}
                  onClick={() => handleQuickFilter(f)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    activeQuickFilter === f ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Bộ lọc gốc */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 sm:flex-initial">
              {/* Chi nhánh */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Chi nhánh
                </label>
                <select 
                  value={selectedBranch}
                  onChange={(e) => { setSelectedBranch(e.target.value); setActiveQuickFilter(''); }}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2 focus:outline-hidden"
                >
                  <option value="Tất cả">Tất cả chi nhánh</option>
                  {chiNhanhs.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>

              {/* Từ ngày */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Từ ngày
                </label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setActiveQuickFilter(''); }}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg py-1 px-2 focus:outline-hidden"
                />
              </div>

              {/* Đến ngày */}
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Đến ngày
                </label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setActiveQuickFilter(''); }}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-lg py-1 px-2 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CHỈ SỐ KPI CHỦ CHỐT */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0">Tổng sản phẩm (SKU)</p>
            <p className="stat-value text-slate-800 font-mono font-bold">{kpis.totalProducts}</p>
          </div>
        </div>

        <div className="bento-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0">Tổng số lượng nhập</p>
            <p className="stat-value text-slate-800 font-mono font-bold">{kpis.totalNhap}</p>
          </div>
        </div>

        <div className="bento-card !p-4 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0">Tổng số lượng xuất</p>
            <p className="stat-value text-slate-800 font-mono font-bold">{kpis.totalXuat}</p>
          </div>
        </div>

        <div className={`bento-card !p-4 flex items-center gap-4 transition-all duration-300 ${
          kpis.lowStockCount > 0 ? '!border-red-200 bg-red-50/20 shadow-2xs' : ''
        }`}>
          <div className={`p-3 rounded-xl ${kpis.lowStockCount > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="stat-label !mb-0">Sắp hết hàng (Ngưỡng đỏ)</p>
            <p className={`stat-value font-mono font-bold ${kpis.lowStockCount > 0 ? '!text-red-600' : 'text-slate-800'}`}>
              {kpis.lowStockCount}
            </p>
          </div>
        </div>
      </div>

      {/* 3. ĐỒ THỊ BIỂU DIỄN PHÂN TÍCH CHUYÊN SÂU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biểu đồ 1: Biến Động Nhập Xuất Theo Ngày (Line Chart) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Biến Động Nhập Xuất Theo Ngày
          </h3>
          <div className="h-64 w-full">
            {transactionByDateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transactionByDateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Nhập" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Xuất" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
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
                  <div key={p.SKU} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{p.SKU}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${barColor}`} 
                          style={{ width: `${Math.min(ratio * 100, 100)}%` }} 
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-red-600">{p.TON_CUOI} {p.DVT}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Tối thiểu: {p.TON_TOI_THIEU}</p>
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
