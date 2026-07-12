/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { motion } from 'motion/react';
import { SanPham, KiemKho, User as UserType } from '../types';
import { getVietnamDateTimeString } from '../data/mockData';

/**
 * FILE: InventoryAudit.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Xử lý nghiệp vụ kiểm kê định kỳ kho hàng tròng kính (B_KIEMKHO).
 *        Hỗ trợ so khớp tồn kho thực đếm được với dữ liệu trên hệ thống thời gian thực.
 *        Tự động tính lệch, phân loại điều chỉnh (NHẬP BÙ / XUẤT BÙ) và kích hoạt
 *        đồng bộ lại dữ liệu tồn kho cuối của sản phẩm ngay lập tức để đồng bộ.
 */

interface InventoryAuditProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  kiemKhos: KiemKho[];
  onSaveAudit: (newAudit: KiemKho) => void;
}

export default function InventoryAudit({ currentUser, sanPhams, kiemKhos, onSaveAudit }: InventoryAuditProps) {
  // --- 1. QUẢN LÝ TRẠNG THÁI FORM KIỂM KHO ---
  const [selectedSKU, setSelectedSKU] = useState<string>('');
  const [tonThucTe, setTonThucTe] = useState<number>(0);
  const [searchSKUQuery, setSearchSKUQuery] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // --- 2. TRUY VẤN SẢN PHẨM KHỚP SKU ---
  const matchedProduct = useMemo(() => {
    if (!selectedSKU) return null;
    return sanPhams.find(p => p.SKU === selectedSKU) || null;
  }, [selectedSKU, sanPhams]);

  // Cài đặt mặc định tồn thực tế bằng tồn hệ thống ngay khi chọn SKU mới để tránh user phải gõ lại nhiều
  React.useEffect(() => {
    if (matchedProduct) {
      setTonThucTe(matchedProduct.TON_CUOI);
    }
  }, [matchedProduct]);

  // --- 3. LỌC DANH SÁCH SKU ĐỂ USER CHỌN NHANH ---
  const filteredSKUOptions = useMemo(() => {
    return sanPhams.filter(p => {
      const query = searchSKUQuery.toLowerCase();
      return p.SKU.toLowerCase().includes(query) || p.TEN_SAN_PHAM.toLowerCase().includes(query);
    });
  }, [sanPhams, searchSKUQuery]);

  // --- 4. TỰ ĐỘNG TÍNH LỆCH VÀ PHÂN LOẠI ĐIỀU CHỈNH ---
  const calculation = useMemo(() => {
    if (!matchedProduct) return { lech: 0, loaiBu: 'KHÔNG LỆCH' as const };
    const tonHeThong = matchedProduct.TON_CUOI;
    const lech = tonThucTe - tonHeThong;
    
    let loaiBu: 'NHẬP BÙ' | 'XUẤT BÙ' | 'KHÔNG LỆCH' = 'KHÔNG LỆCH';
    if (lech > 0) loaiBu = 'NHẬP BÙ';
    else if (lech < 0) loaiBu = 'XUẤT BÙ';

    return { lech, loaiBu };
  }, [matchedProduct, tonThucTe]);

  // --- 5. LƯU PHIẾU KIỂM KHO VÀ ĐIỀU CHỈNH KHO ---
  const handleSubmitAudit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedSKU) {
      setErrorMsg('Vui lòng tìm và chọn SKU tròng kính cần kiểm kê thực tế.');
      return;
    }

    if (!matchedProduct) {
      setErrorMsg('Sản phẩm không hợp lệ hoặc đã bị xóa khỏi cơ sở dữ liệu.');
      return;
    }

    if (tonThucTe < 0) {
      setErrorMsg('Số lượng tồn thực tế ngoài kho đếm được không thể nhỏ hơn 0.');
      return;
    }

    // Tạo bản ghi lịch sử kiểm kho (B_KIEMKHO)
    const newAuditRecord: KiemKho = {
      MA_PHIEU: `PKK_TEMP_${Date.now()}`, // Sẽ được App.tsx thay bằng PKK000001 tăng dần chính xác
      SKU: selectedSKU,
      TON_HE_THONG: matchedProduct.TON_CUOI,
      TON_THUC_TE: tonThucTe,
      LECH: calculation.lech,
      LOAI_BU: calculation.loaiBu,
      NGUOI_KIEM: currentUser.fullName,
      THOI_DIEM: getVietnamDateTimeString()
    };

    onSaveAudit(newAuditRecord);

    setSuccessMsg(`Đã xác nhận kiểm kho thành công cho SKU: ${selectedSKU}. Hệ thống tự động tạo giao dịch điều chỉnh kho bù trừ.`);
    
    // Reset Form
    setSelectedSKU('');
    setTonThucTe(0);
    setSearchSKUQuery('');

    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  return (
    <div className="space-y-6">
      
      {/* KHU VỰC TIÊU ĐỀ */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
          <ClipboardCheck className="w-5.5 h-5.5" />
        </div>
        <div>
          <h2 className="font-sans font-bold text-slate-800 text-base">Tạo Phiếu Kiểm Kê Kho</h2>
          <p className="text-xs text-slate-400 font-mono">Đồng bộ chênh lệch vật lý thực tế ngoài kho vào hệ thống (LockService tự động bảo vệ)</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* CHIA LÀM 2 PHẦN: PHIẾU KIỂM KHO MỚI & LỊCH SỬ KIỂM KHO GẦN ĐÂY */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* FORM THIẾT LẬP PHIẾU KIỂM (3/5 Cột) */}
        <div className="bento-card !p-5 space-y-4 lg:col-span-3">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2">
            Thiết lập chi tiết kiểm kê
          </h3>

          <form onSubmit={handleSubmitAudit} className="space-y-4">
            
            {/* 1. Chọn SKU cần kiểm kê */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 block">
                Tìm kiếm và chọn SKU Tròng Kính
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Nhập thương hiệu, độ cận viễn để tìm SKU..."
                  value={searchSKUQuery}
                  onChange={(e) => setSearchSKUQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-lg focus:outline-hidden text-slate-700 font-semibold"
                />
              </div>

              {/* Danh sách dropdown tùy chọn lọc nhanh */}
              {searchSKUQuery && (
                <div className="border border-slate-100 rounded-lg max-h-36 overflow-y-auto divide-y divide-slate-50 shadow-sm bg-white text-xs z-10 relative">
                  {filteredSKUOptions.length > 0 ? (
                    filteredSKUOptions.map(p => (
                      <button
                        key={p.SKU}
                        type="button"
                        onClick={() => {
                          setSelectedSKU(p.SKU);
                          setSearchSKUQuery('');
                        }}
                        className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors block"
                      >
                        <p className="font-bold text-slate-700 font-mono">{p.SKU}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.TEN_SAN_PHAM}</p>
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

            {/* 2. Hiển thị thông số SPH, CYL và Tồn hệ thống */}
            {matchedProduct ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tròng kính đã chọn:</span>
                  <p className="text-xs font-bold text-slate-800">{matchedProduct.TEN_SAN_PHAM}</p>
                  <p className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded inline-block">
                    {matchedProduct.SKU}
                  </p>
                </div>

                <div className="space-y-1 sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Tồn Cuối Hệ Thống:</span>
                  <p className="text-2xl font-extrabold text-slate-800 font-mono tracking-tight">
                    {matchedProduct.TON_CUOI} <span className="text-xs font-semibold text-slate-400">{matchedProduct.DVT}</span>
                  </p>
                  <p className="text-[10px] text-slate-400">Cập nhật lúc: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                Hãy tìm kiếm và chọn 1 SKU cụ thể ở trên để hiển thị dữ liệu tồn hệ thống.
              </div>
            )}

            {/* 3. Nhập số tồn thực tế */}
            {matchedProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">
                    Số Lượng Đếm Thực Tế (Ngoài Kho)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={tonThucTe}
                    onChange={(e) => setTonThucTe(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Tính toán chênh lệch */}
                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Chênh lệch / Bù trừ:</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {calculation.lech === 0 ? (
                      <span className="text-xs font-bold text-emerald-600">Khớp tuyệt đối (0)</span>
                    ) : (
                      <>
                        <span className={`text-sm font-bold font-mono ${calculation.lech > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {calculation.lech > 0 ? `+${calculation.lech}` : calculation.lech}
                        </span>
                        <span className={`text-[10px] font-bold py-0.5 px-2 rounded-full ${
                          calculation.lech > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {calculation.loaiBu}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Thông tin metadata kiểm kho */}
            {matchedProduct && (
              <div className="bg-amber-50/30 border border-amber-100 rounded-xl p-4 text-[11px] text-slate-500 space-y-2">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  Cơ chế điều chỉnh tự động (Rule 8):
                </p>
                <p className="leading-relaxed">
                  Khi xác nhận lưu phiếu, hệ thống sẽ tự động cập nhật cân bằng tồn cuối. Nếu là <span className="font-bold text-emerald-600">Nhập bù</span>, sẽ cộng dồn vào tổng nhập. Nếu là <span className="font-bold text-rose-600">Xuất bù</span>, sẽ cộng dồn vào tổng xuất của SKU.
                </p>
              </div>
            )}

            {/* Nút lưu phiếu kiểm */}
            {matchedProduct && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
                >
                  Xác Nhận Cân Bằng Kho
                </button>
              </div>
            )}

          </form>
        </div>

        {/* LỊCH SỬ KIỂM KHO GẦN ĐÂY (2/5 Cột) */}
        <div className="bento-card !p-5 lg:col-span-2 flex flex-col max-h-[420px]">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-3">
            Lịch sử kiểm kê gần đây
          </h3>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pr-1 space-y-3">
            {kiemKhos.length > 0 ? (
              kiemKhos.map((audit) => {
                const isPositive = audit.LECH > 0;
                const isNegative = audit.LECH < 0;

                return (
                  <div key={audit.MA_PHIEU + audit.SKU} className="pt-2 pb-3 space-y-1 text-xs">
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
                        audit.LOAI_BU === 'NHẬP BÙ' ? 'text-emerald-600' : audit.LOAI_BU === 'XUẤT BÙ' ? 'text-rose-600' : 'text-slate-500'
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
  );
}
