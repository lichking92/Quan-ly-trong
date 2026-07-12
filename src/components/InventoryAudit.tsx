/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Check, 
  AlertCircle, 
  Calendar, 
  User, 
  Clock, 
  ChevronRight, 
  ChevronLeft, 
  Trash2, 
  Plus, 
  FileText, 
  Building,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, KiemKho, User as UserType } from '../types';

/**
 * FILE: InventoryAudit.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Xử lý nghiệp vụ kiểm kê định kỳ kho hàng tròng kính theo mô hình Wizard 3 bước chuyên nghiệp.
 *        - Bước 1: Khai báo thông tin đợt kiểm kho (Ngày, người kiểm, ghi chú, chi nhánh).
 *        - Bước 2: Thiết lập chi tiết danh sách kiểm kho (Chọn nhiều SKU đồng loạt, nhập số lượng thực tế, tự động so sánh tính toán chênh lệch thừa/thiếu, cảnh báo đỏ nổi bật).
 *        - Bước 3: Xác nhận tổng hợp và Lưu phiếu kiểm kho.
 */

interface InventoryAuditProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  kiemKhos: KiemKho[];
  onSaveAudit: (newAudit: KiemKho) => void;
}

interface AuditRow {
  sku: string;
  tenSanPham: string;
  tonHeThong: number;
  tonThucTe: number;
  lech: number;
  loaiBu: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH';
}

export default function InventoryAudit({ currentUser, sanPhams, kiemKhos, onSaveAudit }: InventoryAuditProps) {
  // --- 1. QUẢN LÝ TRẠNG THÁI WIZARD ---
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Trạng thái Bước 1: Thông tin đợt kiểm kho
  const [auditMeta, setAuditMeta] = useState({
    nguoiKiem: currentUser.fullName || '',
    ngayKiem: new Date().toISOString().substring(0, 10),
    chiNhanh: currentUser.branch || 'Kho Trung Tâm',
    ghiChu: ''
  });

  // Trạng thái Bước 2: Danh sách chi tiết kiểm kho
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [searchSKUQuery, setSearchSKUQuery] = useState<string>('');

  // --- 2. LỌC DANH SÁCH SKU ĐỂ THÊM VÀO PHIẾU ---
  const filteredSKUOptions = useMemo(() => {
    if (!searchSKUQuery.trim()) return [];
    return sanPhams.filter(p => {
      const query = searchSKUQuery.toLowerCase();
      return p.SKU.toLowerCase().includes(query) || p.TEN_SAN_PHAM.toLowerCase().includes(query);
    });
  }, [sanPhams, searchSKUQuery]);

  // Thêm SKU vào danh sách kiểm kê
  const handleAddSKUToAudit = (product: SanPham) => {
    // Kiểm tra xem đã có trong danh sách chưa
    if (auditRows.some(row => row.sku === product.SKU)) {
      setErrorMsg(`SKU [${product.SKU}] đã có trong danh sách kiểm kê.`);
      setTimeout(() => setErrorMsg(''), 3000);
      setSearchSKUQuery('');
      return;
    }

    const newRow: AuditRow = {
      sku: product.SKU,
      tenSanPham: product.TEN_SAN_PHAM,
      tonHeThong: product.TON_CUOI,
      tonThucTe: product.TON_CUOI, // Mặc định bằng tồn hệ thống để tránh gõ nhiều
      lech: 0,
      loaiBu: 'KHÔNG LỆCH'
    };

    setAuditRows(prev => [...prev, newRow]);
    setSearchSKUQuery('');
    setErrorMsg('');
  };

  // Cập nhật số lượng đếm thực tế của 1 dòng
  const handleUpdateTonThucTe = (sku: string, qty: number) => {
    setAuditRows(prev => prev.map(row => {
      if (row.sku === sku) {
        const lech = qty - row.tonHeThong;
        let loaiBu: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH' = 'KHÔNG LỆCH';
        if (lech > 0) loaiBu = 'NHẬP BÙ';
        else if (lech < 0) loaiBu = 'XUẤT BÙ';

        return {
          ...row,
          tonThucTe: qty,
          lech,
          loaiBu
        };
      }
      return row;
    }));
  };

  // Xóa dòng khỏi danh sách kiểm kê
  const handleRemoveRow = (sku: string) => {
    setAuditRows(prev => prev.filter(row => row.sku !== sku));
  };

  // Áp dụng nhanh số lượng đếm khớp cho tất cả dòng
  const handleResetAllRows = () => {
    setAuditRows(prev => prev.map(row => ({
      ...row,
      tonThucTe: row.tonHeThong,
      lech: 0,
      loaiBu: 'KHÔNG LỆCH'
    })));
  };

  // --- 3. ĐIỀU HƯỚNG BƯỚC WIZARD ---
  const handleNextToStep2 = () => {
    if (!auditMeta.nguoiKiem.trim()) {
      setErrorMsg('Vui lòng nhập Họ tên Người kiểm kho.');
      return;
    }
    setErrorMsg('');
    setCurrentStep(2);
  };

  const handleNextToStep3 = () => {
    if (auditRows.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 sản phẩm (SKU) để thực hiện kiểm kê.');
      return;
    }
    setErrorMsg('');
    setCurrentStep(3);
  };

  // --- 4. LƯU PHIẾU KIỂM KHO VÀ ĐIỀU CHỈNH TỒN KHO ---
  const handleFinalSubmitAudit = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (auditRows.length === 0) {
      setErrorMsg('Danh sách kiểm kê trống.');
      return;
    }

    // Thực hiện lưu từng dòng kiểm kê thông qua hàm onSaveAudit của App.tsx
    // Hệ thống sẽ tự động sinh mã PKKxxxxxx và bù trừ chênh lệch cực kỳ mượt mà!
    auditRows.forEach((row, index) => {
      const newAuditRecord: KiemKho = {
        MA_PHIEU: `PKK_TEMP_${Date.now()}_${index}`, // Sẽ được App.tsx tự động đổi thành PKK000001 tịnh tiến chính xác
        SKU: row.sku,
        TON_HE_THONG: row.tonHeThong,
        TON_THUC_TE: row.tonThucTe,
        LECH: row.lech,
        LOAI_BU: row.loaiBu,
        NGUOI_KIEM: auditMeta.nguoiKiem,
        THOI_DIEM: `${auditMeta.ngayKiem} ${new Date().toLocaleTimeString('vi-VN')}`
      };
      onSaveAudit(newAuditRecord);
    });

    setSuccessMsg(`Xác nhận hoàn tất! Đã lưu thành công đợt kiểm kê với ${auditRows.length} dòng sản phẩm. Tồn kho đã tự động được bù trừ chuẩn hóa.`);
    
    // Reset toàn bộ Wizard về trạng thái ban đầu
    setAuditRows([]);
    setAuditMeta({
      nguoiKiem: currentUser.fullName || '',
      ngayKiem: new Date().toISOString().substring(0, 10),
      chiNhanh: currentUser.branch || 'Kho Trung Tâm',
      ghiChu: ''
    });
    setCurrentStep(1);

    setTimeout(() => {
      setSuccessMsg('');
    }, 5000);
  };

  // --- 5. THỐNG KÊ CHI TIẾT ĐỢT KIỂM KHO ---
  const auditStats = useMemo(() => {
    const total = auditRows.length;
    const lechThua = auditRows.filter(r => r.lech > 0).length;
    const lechThieu = auditRows.filter(r => r.lech < 0).length;
    const khop = auditRows.filter(r => r.lech === 0).length;
    return { total, lechThua, lechThieu, khop };
  }, [auditRows]);

  return (
    <div className="space-y-6">
      
      {/* KHU VỰC TIÊU ĐỀ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <ClipboardCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-base">Kiểm Kê Kho Định Kỳ</h2>
            <p className="text-xs text-slate-400 font-mono">Đối chiếu dữ liệu vật lý với hệ thống & tự động bù trừ cân bằng tồn kho</p>
          </div>
        </div>

        {/* TIẾN TRÌNH WIZARD */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 1 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>1. Khởi tạo</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 2 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>2. Kiểm đếm</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 3 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>3. Hoàn tất</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* CHIA MÀN HÌNH CHÍNH */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* KHU VỰC CHÍNH WIZARD (3/5 cột) */}
        <div className="lg:col-span-3 space-y-4">
          
          <AnimatePresence mode="wait">
            
            {/* BƯỚC 1: KHỞI TẠO THÔNG TIN */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" /> Bước 1: Khai báo thông tin đợt kiểm kho
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Người thực hiện kiểm kê
                    </label>
                    <input
                      type="text"
                      value={auditMeta.nguoiKiem}
                      onChange={(e) => setAuditMeta({ ...auditMeta, nguoiKiem: e.target.value })}
                      placeholder="Nhập họ tên đầy đủ..."
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" /> Ngày thực hiện kiểm kê
                    </label>
                    <input
                      type="date"
                      value={auditMeta.ngayKiem}
                      onChange={(e) => setAuditMeta({ ...auditMeta, ngayKiem: e.target.value })}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" /> Chi nhánh kiểm kho
                    </label>
                    <select
                      value={auditMeta.chiNhanh}
                      onChange={(e) => setAuditMeta({ ...auditMeta, chiNhanh: e.target.value })}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden cursor-pointer focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value={currentUser.branch}>{currentUser.branch}</option>
                      {currentUser.branch !== 'Kho Trung Tâm' && <option value="Kho Trung Tâm">Kho Trung Tâm</option>}
                    </select>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Ghi chú đợt kiểm kê
                    </label>
                    <textarea
                      value={auditMeta.ghiChu}
                      onChange={(e) => setAuditMeta({ ...auditMeta, ghiChu: e.target.value })}
                      placeholder="Ví dụ: Kiểm kho cuối tháng 7 định kỳ, phát hiện lệch nhẹ do vỡ..."
                      rows={3}
                      className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button
                    onClick={handleNextToStep2}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <span>Tiếp tục kiểm đếm</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* BƯỚC 2: KIỂM ĐẾM CHI TIẾT */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-blue-500" /> Bước 2: Thiết lập chi tiết danh sách kiểm kho
                  </h3>
                  {auditRows.length > 0 && (
                    <button
                      onClick={handleResetAllRows}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                      title="Đặt tất cả số tồn thực tế bằng số tồn hệ thống"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Đặt về khớp (Hệ thống)
                    </button>
                  )}
                </div>

                {/* Ô tìm kiếm & Chọn SKU */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">
                    Gõ tìm SKU hoặc Tên Tròng Kính để thêm vào danh sách kiểm kê
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Nhập thương hiệu, SKU, độ cận viễn để tìm tròng kính..."
                      value={searchSKUQuery}
                      onChange={(e) => setSearchSKUQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:outline-hidden text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Dropdown gợi ý tìm kiếm */}
                  {searchSKUQuery && (
                    <div className="absolute top-full left-0 right-0 border border-slate-100 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-50 shadow-md bg-white text-xs z-30">
                      {filteredSKUOptions.length > 0 ? (
                        filteredSKUOptions.slice(0, 15).map(p => (
                          <button
                            key={p.SKU}
                            type="button"
                            onClick={() => handleAddSKUToAudit(p)}
                            className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors block"
                          >
                            <p className="font-bold text-slate-700 font-mono flex items-center justify-between">
                              <span>{p.SKU}</span>
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Tồn: {p.TON_CUOI}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{p.TEN_SAN_PHAM}</p>
                          </button>
                        ))
                      ) : (
                        <div className="p-3 text-center text-slate-400 italic">
                          Không tìm thấy SKU nào trùng khớp
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* BẢNG CHI TIẾT CÁC SKU ĐÃ CHỌN ĐỂ KIỂM */}
                <div className="space-y-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Danh sách sản phẩm kiểm kê ({auditRows.length} dòng)
                  </span>

                  {auditRows.length > 0 ? (
                    <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                      {auditRows.map((row) => {
                        const isLeth = row.lech !== 0;
                        return (
                          <div 
                            key={row.sku} 
                            className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                              isLeth 
                                ? 'bg-red-50/70 border-red-200 shadow-3xs' 
                                : 'bg-slate-50/60 border-slate-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  {row.sku}
                                </span>
                                <h4 className="text-xs font-bold text-slate-700 mt-1">{row.tenSanPham}</h4>
                              </div>
                              <button
                                onClick={() => handleRemoveRow(row.sku)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                                title="Xóa khỏi danh sách kiểm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5 pt-1.5 border-t border-dashed border-slate-100 text-xs">
                              {/* Cột 1: Tồn hệ thống */}
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Tồn hệ thống</span>
                                <span className="font-mono font-bold text-slate-700 mt-0.5">{row.tonHeThong} cái</span>
                              </div>

                              {/* Cột 2: Nhập tồn thực tế */}
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Tồn thực tế</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.tonThucTe}
                                  onChange={(e) => handleUpdateTonThucTe(row.sku, Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full h-7 mt-0.5 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-red-500"
                                />
                              </div>

                              {/* Cột 3: Tính toán chênh lệch */}
                              <div className="flex flex-col items-end justify-center">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Chênh lệch</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {row.lech === 0 ? (
                                    <span className="font-bold text-emerald-600 text-[11px]">Khớp</span>
                                  ) : (
                                    <>
                                      <span className={`font-mono font-extrabold text-[11px] ${row.lech > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {row.lech > 0 ? `+${row.lech}` : row.lech}
                                      </span>
                                      <span className={`text-[8px] font-extrabold py-0.5 px-1 rounded-sm uppercase tracking-wide shrink-0 ${
                                        row.lech > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                      }`}>
                                        {row.loaiBu === 'NHẬP BÙ' ? 'BÙ +' : 'BÙ -'}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 space-y-2">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto animate-bounce" />
                      <p className="font-semibold text-slate-500">Chưa có sản phẩm nào được chọn để kiểm kê.</p>
                      <p className="text-[10px] text-slate-400">Hãy gõ tìm và thêm SKU tròng kính ở ô tìm kiếm bên trên.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={handleNextToStep3}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <span>Tiếp tục xác nhận</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* BƯỚC 3: XÁC NHẬN TỔNG HỢP & LƯU */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" /> Bước 3: Xác nhận tổng hợp và Lưu phiếu kiểm kho
                  </h3>
                </div>

                {/* TÓM TẮT METADATA */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                  <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-500" /> Thông tin đợt kiểm kê
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                    <p><span className="text-slate-400">Người thực hiện:</span> <strong className="text-slate-700">{auditMeta.nguoiKiem}</strong></p>
                    <p><span className="text-slate-400">Ngày kiểm kê:</span> <strong className="text-slate-700">{auditMeta.ngayKiem}</strong></p>
                    <p><span className="text-slate-400">Chi nhánh:</span> <strong className="text-slate-700">{auditMeta.chiNhanh}</strong></p>
                    <p className="sm:col-span-2"><span className="text-slate-400">Ghi chú:</span> <span className="text-slate-600 italic font-medium">{auditMeta.ghiChu || '(Không có ghi chú)'}</span></p>
                  </div>
                </div>

                {/* BẢNG TỔNG HỢP DÒNG SẢN PHẨM */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Danh sách sản phẩm được lưu ({auditRows.length} dòng)
                  </span>
                  
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Hệ thống</th>
                          <th className="p-2.5">Thực tế</th>
                          <th className="p-2.5 text-right">Lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                        {auditRows.map((row) => (
                          <tr key={row.sku} className={row.lech !== 0 ? 'bg-red-50/30' : ''}>
                            <td className="p-2.5 font-mono text-[11px] text-blue-600">{row.sku}</td>
                            <td className="p-2.5 font-mono">{row.tonHeThong}</td>
                            <td className="p-2.5 font-mono">{row.tonThucTe}</td>
                            <td className={`p-2.5 font-mono text-right ${
                              row.lech > 0 ? 'text-emerald-600' : row.lech < 0 ? 'text-red-600' : 'text-slate-400'
                            }`}>
                              {row.lech > 0 ? `+${row.lech}` : row.lech}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* CẢNH BÁO / CHỈ DẪN BÙ TRỪ TỰ ĐỘNG */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-[11px] text-slate-500 space-y-1.5">
                  <p className="font-bold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    Cơ chế điều chỉnh tự động (LockService & Rule 8):
                  </p>
                  <p className="leading-relaxed">
                    Khi nhấn lưu phiếu, hệ thống sẽ tự động cân bằng số lượng tồn cuối cho các SKU. Lượng chênh lệch sẽ được tích lũy vào cột <strong className="text-slate-700">Tổng nhập (nếu là Nhập bù)</strong> hoặc <strong className="text-slate-700">Tổng xuất (nếu là Xuất bù)</strong> tương ứng.
                  </p>
                </div>

                {/* ĐIỀU HƯỚNG BƯỚC 3 */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={handleFinalSubmitAudit}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-md shadow-red-600/15 animate-pulse"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lưu Phiếu Kiểm Kho</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* TÓM TẮT THÔNG TIN / LỊCH SỬ KIỂM KHO GẦN ĐÂY (2/5 cột) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* CARD TÓM TẮT ĐƠN KIỂM HIỆN TẠI */}
          {auditRows.length > 0 && (
            <div className="bento-card !p-4 bg-slate-900 text-white space-y-3">
              <h4 className="font-sans font-bold text-[10px] uppercase text-slate-400 tracking-wider">
                Thống kê đợt kiểm hiện tại
              </h4>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Tổng sản phẩm</span>
                  <span className="text-lg font-extrabold font-mono text-slate-100">{auditStats.total}</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Dòng khớp</span>
                  <span className="text-lg font-extrabold font-mono text-emerald-400">{auditStats.khop}</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Lệch thừa (+)</span>
                  <span className="text-lg font-extrabold font-mono text-blue-400">{auditStats.lechThua}</span>
                </div>
                <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Lệch thiếu (-)</span>
                  <span className="text-lg font-extrabold font-mono text-red-400">{auditStats.lechThieu}</span>
                </div>
              </div>
            </div>
          )}

          {/* LỊCH SỬ KIỂM KHO GẦN ĐÂY */}
          <div className="bento-card !p-5 flex flex-col max-h-[450px]">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" /> Lịch sử kiểm kê gần đây
            </h3>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pr-1 space-y-3.5">
              {kiemKhos.length > 0 ? (
                // Sắp xếp các phiếu kiểm kho mới nhất lên đầu
                [...kiemKhos].reverse().map((audit) => {
                  const isPositive = audit.LECH > 0;
                  const isNegative = audit.LECH < 0;

                  return (
                    <div key={audit.MA_PHIEU + audit.SKU} className="pt-2.5 pb-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 font-mono bg-slate-100 py-0.5 px-1.5 rounded text-[10px]">
                          {audit.MA_PHIEU}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {audit.THOI_DIEM.split(' ')[0]}
                        </span>
                      </div>

                      <p className="font-bold text-slate-800 font-mono tracking-tight truncate" title={audit.SKU}>
                        {audit.SKU}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
                        <div>
                          <span className="text-slate-400">Hệ thống: </span>
                          <span className="font-bold text-slate-700">{audit.TON_HE_THONG}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Thực tế: </span>
                          <span className="font-bold text-slate-700">{audit.TON_THUC_TE}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400">Lệch: </span>
                          <span className={`font-bold ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isPositive ? `+${audit.LECH}` : audit.LECH}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[9px] text-slate-400 font-medium">
                        <span>Người kiểm: <strong className="text-slate-600">{audit.NGUOI_KIEM}</strong></span>
                        <span className={`font-bold uppercase ${
                          audit.LOAI_BU === 'NHẬP BÙ' ? 'text-emerald-600 font-extrabold' : audit.LOAI_BU === 'XUẤT BÙ' ? 'text-rose-600 font-extrabold' : 'text-slate-500'
                        }`}>
                          {audit.LOAI_BU}
                        </span>
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-center text-xs text-slate-400 font-mono italic leading-relaxed">
                  Chưa ghi nhận phiên kiểm kê kho nào được thực hiện trong kỳ này.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
