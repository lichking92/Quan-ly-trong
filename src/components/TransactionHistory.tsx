/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  MapPin, 
  Calendar, 
  User, 
  Clock, 
  Info, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Check, 
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NhapXuat, NhapXuatCT, SanPham, LoaiPhieu, User as UserType } from '../types';
import { formatDop } from '../data/mockData';

/**
 * FILE: TransactionHistory.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Quản lý lịch sử giao dịch (B_NHAPXUAT và B_NHAPXUATCT).
 *        Cho phép xem chi tiết phiếu, Thêm dòng, Sửa số lượng dòng, Xóa dòng, Xóa phiếu.
 *        Đặc biệt thiết lập logic Rollback tồn kho thông minh (Rule 4) và Tái tính toán
 *        từng SKU bị ảnh hưởng cục bộ (Rule 3) để tối ưu hiệu năng tối đa.
 */

interface TransactionHistoryProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  onUpdateTransaction: (
    updatedHeader: NhapXuat, 
    updatedDetails: NhapXuatCT[], 
    skusToRecalc: string[]
  ) => void;
  onDeleteTransaction: (hoaDonId: string, skusToRecalc: string[]) => void;
}

export default function TransactionHistory({
  currentUser,
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  onUpdateTransaction,
  onDeleteTransaction
}: TransactionHistoryProps) {
  
  // --- 1. QUẢN LÝ TRẠNG THÁI GIAO DIỆN ---
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'Tất cả' | 'NHẬP' | 'XUẤT' | 'KIỂM KHO'>('Tất cả');

  // Trạng thái cho Form Sửa/Thêm dòng trong phiếu chi tiết
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editGhiChu, setEditGhiChu] = useState<string>('');
  
  const [showAddRowForm, setShowAddRowForm] = useState<boolean>(false);
  const [newRowSKU, setNewRowSKU] = useState<string>('');
  const [newRowQty, setNewRowQty] = useState<number>(10);
  const [newRowGhiChu, setNewRowGhiChu] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // --- 2. LỌC DANH SÁCH HÓA ĐƠN HIỂN THỊ ---
  const filteredInvoices = useMemo(() => {
    return nhapXuats.filter(h => {
      const matchType = historyTypeFilter === 'Tất cả' || h.LOAI === historyTypeFilter;
      const matchSearch = h.HOA_DON.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.TEN_NGUOI_TAO.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (h.GHI_CHU && h.GHI_CHU.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    }).sort((a, b) => b.HOA_DON.localeCompare(a.HOA_DON)); // Phiếu mới nhất lên đầu
  }, [nhapXuats, historyTypeFilter, searchQuery]);

  // Chi tiết sản phẩm của hóa đơn đang chọn
  const activeDetails = useMemo(() => {
    if (!selectedInvoice) return [];
    return nhapXuatCTs.filter(d => d.HOA_DON === selectedInvoice);
  }, [selectedInvoice, nhapXuatCTs]);

  const activeHeader = useMemo(() => {
    if (!selectedInvoice) return null;
    return nhapXuats.find(h => h.HOA_DON === selectedInvoice) || null;
  }, [selectedInvoice, nhapXuats]);

  // --- 3. TIẾN HÀNH THAO TÁC EDIT DÒNG CHI TIẾT ---
  const handleStartEditRow = (row: NhapXuatCT) => {
    setEditingRowId(row.ID);
    setEditQty(row.SO_LUONG);
    setEditGhiChu(row.GHI_CHU || '');
    setErrorMsg('');
  };

  const handleCancelEditRow = () => {
    setEditingRowId(null);
    setErrorMsg('');
  };

  // Sửa số lượng dòng chi tiết (Đồng bộ tồn kho)
  const handleSaveEditRow = (row: NhapXuatCT) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (editQty <= 0) {
      setErrorMsg('Số lượng sửa đổi bắt buộc phải lớn hơn 0.');
      return;
    }

    if (!activeHeader) return;

    // RULE 1: Nếu là phiếu XUẤT, phải kiểm tra xem lượng tăng lên có làm âm kho hay không
    if (activeHeader.LOAI === 'XUẤT') {
      const targetProduct = sanPhams.find(p => p.SKU === row.SKU);
      if (targetProduct) {
        // Tồn thực tế hiện tại trước thay đổi + lượng đã xuất cũ = Tổng quỹ kho có thể xuất tối đa
        const totalAvailableStock = targetProduct.TON_CUOI + row.SO_LUONG;
        if (editQty > totalAvailableStock) {
          setErrorMsg(`Lỗi nghiệp vụ (Rule 1): Không cho phép xuất âm kho. SKU [${row.SKU}] chỉ có thể xuất tối đa là ${totalAvailableStock} ${row.DVT}.`);
          return;
        }
      }
    }

    // Tiến hành cập nhật
    const updatedDetails = nhapXuatCTs.map(d => {
      if (d.ID === row.ID) {
        return { ...d, SO_LUONG: editQty, GHI_CHU: editGhiChu };
      }
      return d;
    });

    // Tính lại tổng số lượng của Header phiếu
    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    // Truyền danh sách SKU bị ảnh hưởng lên App chính để tối ưu hiệu năng chỉ recalc SKU đó
    onUpdateTransaction(updatedHeader, updatedDetails, [row.SKU]);

    setEditingRowId(null);
    setSuccessMsg('Đã chỉnh sửa dòng sản phẩm và tự động tái tính toán tồn kho thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 4. THÊM MỚI DÒNG SẢN PHẨM VÀO PHIẾU ĐANG CHỌN ---
  const handleAddRowToInvoice = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!newRowSKU) {
      setErrorMsg('Vui lòng chọn SKU tròng kính cần bổ sung vào phiếu.');
      return;
    }

    if (newRowQty <= 0) {
      setErrorMsg('Số lượng bổ sung phải lớn hơn 0.');
      return;
    }

    if (!activeHeader) return;

    // Kiểm tra SKU đã tồn tại trong phiếu chưa
    const isAlreadyInInvoice = activeDetails.some(d => d.SKU === newRowSKU);
    if (isAlreadyInInvoice) {
      setErrorMsg('Sản phẩm SKU này đã tồn tại trong phiếu. Hãy dùng chức năng "Sửa số lượng" thay vì thêm mới dòng.');
      return;
    }

    const targetProduct = sanPhams.find(p => p.SKU === newRowSKU);
    if (!targetProduct) {
      setErrorMsg('Sản phẩm không hợp lệ trong hệ thống.');
      return;
    }

    // RULE 1: Nếu phiếu XUẤT, kiểm tra tồn kho sản phẩm bổ sung
    if (activeHeader.LOAI === 'XUẤT') {
      if (newRowQty > targetProduct.TON_CUOI) {
        setErrorMsg(`Lỗi (Rule 1): Không cho xuất âm kho. SKU [${newRowSKU}] chỉ còn tồn ${targetProduct.TON_CUOI} ${targetProduct.DVT}.`);
        return;
      }
    }

    // Tạo dòng chi tiết mới
    const newDetailRow: NhapXuatCT = {
      ID: `CT_ADD_${Date.now()}`,
      HOA_DON: activeHeader.HOA_DON,
      SKU: targetProduct.SKU,
      TEN_SP: targetProduct.TEN_SAN_PHAM,
      THUONG_HIEU: targetProduct.THUONG_HIEU,
      CHIET_XUAT: targetProduct.CHIET_XUAT,
      TINH_NANG: targetProduct.TINH_NANG,
      SPH: targetProduct.CAN,
      CYL: targetProduct.LOAN,
      SO_LUONG: newRowQty,
      DVT: targetProduct.DVT,
      GHI_CHU: newRowGhiChu || 'Bổ sung dòng sau lập phiếu',
      LOAI: activeHeader.LOAI,
      NGAY: activeHeader.NGAY
    };

    const updatedDetails = [...nhapXuatCTs, newDetailRow];

    // Tính lại tổng lượng Header
    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    onUpdateTransaction(updatedHeader, updatedDetails, [newRowSKU]);

    setShowAddRowForm(false);
    setNewRowSKU('');
    setNewRowGhiChu('');
    setSuccessMsg('Đã bổ sung dòng sản phẩm mới vào phiếu.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 5. XÓA DÒNG CHI TIẾT KHỎI PHIẾU ---
  const handleDeleteRow = (row: NhapXuatCT) => {
    if (activeDetails.length <= 1) {
      setErrorMsg('Lỗi: Phiếu phải có ít nhất 1 dòng sản phẩm. Nếu muốn xóa dòng này, hãy dùng chức năng "Hủy toàn bộ phiếu".');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    // Loại bỏ dòng này ra khỏi chi tiết
    const updatedDetails = nhapXuatCTs.filter(d => d.ID !== row.ID);

    // Tính lại tổng lượng Header
    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    if (!activeHeader) return;
    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    onUpdateTransaction(updatedHeader, updatedDetails, [row.SKU]);

    setSuccessMsg('Đã xóa dòng sản phẩm và khôi phục tồn kho thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 6. XÓA TOÀN BỘ PHIẾU VÀ ROLLBACK TỒN KHO TRỌN VẸN (RULE 4) ---
  const handleDeleteEntireInvoice = () => {
    if (!activeHeader) return;

    setErrorMsg('');
    setSuccessMsg('');

    // Thu thập toàn bộ SKU có trong phiếu để kích hoạt bộ tái tính toán tồn kho
    const affectedSKUs = activeDetails.map(d => d.SKU);

    // Gọi hàm xóa phía tầng App chính
    onDeleteTransaction(activeHeader.HOA_DON, affectedSKUs);

    setSelectedInvoice(null);
    setSuccessMsg(`Đã hủy bỏ hoàn toàn phiếu ${activeHeader.HOA_DON} và hoàn tất Rollback kho!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Tự động chọn phiếu đầu tiên trong danh sách khi tải trang hoặc khi bộ lọc thay đổi
  React.useEffect(() => {
    if (filteredInvoices.length > 0) {
      const exists = filteredInvoices.some(h => h.HOA_DON === selectedInvoice);
      if (!exists) {
        setSelectedInvoice(filteredInvoices[0].HOA_DON);
      }
    } else {
      setSelectedInvoice(null);
    }
  }, [filteredInvoices, selectedInvoice]);

  return (
    <div className="space-y-6">
      
      {/* 1. KHU VỰC BỘ LỌC VÀ TÌM KIẾM PHIẾU */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Tìm kiếm nhanh */}
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text"
            placeholder="Tìm theo số phiếu, người tạo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-hidden text-slate-700 font-semibold"
          />
        </div>

        {/* Lọc loại phiếu */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['Tất cả', 'NHẬP', 'XUẤT', 'KIỂM KHO'] as const).map(type => (
            <button
              key={type}
              onClick={() => { setHistoryTypeFilter(type); setSelectedInvoice(null); }}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                historyTypeFilter === type ? 'bg-red-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {type === 'Tất cả' ? 'Mọi loại phiếu' : type}
            </button>
          ))}
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
          <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* THIẾT KẾ MASTER-DETAIL TRÁNH LAG VÀ LỖI BẤM KHÔNG LÊN TRÊN IFRAME */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* PANEL TRÁI: DANH SÁCH PHIẾU DẠNG LIST */}
        <div className="bento-card !p-0 overflow-hidden lg:col-span-5 flex flex-col max-h-[700px] bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="bg-slate-50 px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Danh Sách Phiếu ({filteredInvoices.length})</span>
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 py-0.5 px-2 rounded-full">
              Mới nhất
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-100/70 flex-1 max-h-[600px]">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((h) => {
                const isSelected = h.HOA_DON === selectedInvoice;
                let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                if (h.LOAI === 'XUẤT') badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                if (h.LOAI === 'KIỂM KHO') badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';

                return (
                  <div
                    key={h.HOA_DON}
                    onClick={() => {
                      setSelectedInvoice(h.HOA_DON);
                      handleCancelEditRow();
                      setShowAddRowForm(false);
                    }}
                    className={`p-4 flex flex-col gap-2 cursor-pointer transition-all border-l-4 ${
                      isSelected 
                        ? 'bg-blue-50/35 border-l-red-600' 
                        : 'border-l-transparent hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-slate-800 text-xs">{h.HOA_DON}</span>
                      <span className={`text-[9px] font-bold py-0.5 px-2 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                        {h.LOAI}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium">
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <span className="truncate max-w-[150px]">{h.CHI_NHANH}</span>
                      </p>
                      <p className="flex items-center gap-1 font-mono text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        {h.NGAY}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-50 mt-1">
                      <span>Người lập: <strong className="text-slate-600 font-sans">{h.TEN_NGUOI_TAO}</strong></span>
                      <span className="font-mono font-bold text-slate-700">Tổng SL: {h.TONG_SL} miếng</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-24 text-center text-xs text-slate-400 font-mono italic">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                Không tìm thấy dữ liệu hóa đơn nào khớp bộ lọc.
              </div>
            )}
          </div>
        </div>

        {/* PANEL PHẢI: CHI TIẾT CỦA PHIẾU ĐANG CHỌN */}
        <div className="lg:col-span-7">
          {activeHeader ? (
            <div className="bento-card !p-0 overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-xs flex flex-col max-h-[700px]">
              
              {/* Header chi tiết */}
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-700 bg-slate-200 py-0.5 px-2.5 rounded">
                      {activeHeader.HOA_DON}
                    </span>
                    <span className="text-xs font-bold text-slate-400">({activeHeader.LOAI})</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                    Tạo bởi {activeHeader.TEN_NGUOI_TAO} lúc {activeHeader.TG_TAO}
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Chi nhánh thực hiện: <strong>{activeHeader.CHI_NHANH}</strong>
                  </p>
                </div>

                {/* Các nút thao tác chi tiết */}
                <div className="flex items-center gap-2">
                  {currentUser.writeAccess !== false && (
                    <>
                      <button
                        onClick={() => setShowAddRowForm(!showAddRowForm)}
                        className="flex items-center gap-1 text-[11px] font-bold py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 text-blue-500" /> Thêm Dòng
                      </button>

                      <button
                        onClick={handleDeleteEntireInvoice}
                        className="flex items-center gap-1 text-[11px] font-bold py-1.5 px-3 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hủy Phiếu
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Ghi chú tổng quát */}
              <div className="px-5 py-3 bg-amber-50/40 border-b border-amber-100 text-xs text-amber-800 leading-relaxed italic shrink-0">
                <strong>Ghi chú chung:</strong> {activeHeader.GHI_CHU || 'Không ghi nhận ghi chú chung.'}
              </div>

              {/* Form bổ sung dòng hàng */}
              <AnimatePresence>
                {showAddRowForm && currentUser.writeAccess !== false && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-blue-50/30 border-b border-slate-100 p-4 space-y-3 overflow-hidden text-xs shrink-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Bổ sung dòng sản phẩm mới</span>
                      <button onClick={() => setShowAddRowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Chọn SKU tròng kính</label>
                        <select
                          value={newRowSKU}
                          onChange={(e) => setNewRowSKU(e.target.value)}
                          className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded p-1.5 focus:outline-hidden"
                        >
                          <option value="">-- Chọn tròng kính --</option>
                          {sanPhams.map(p => (
                            <option key={p.SKU} value={p.SKU}>{p.SKU} (Còn tồn: {p.TON_CUOI})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400">Số lượng bổ sung</label>
                        <input
                          type="number"
                          min={1}
                          value={newRowQty}
                          onChange={(e) => setNewRowQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">Ghi chú dòng hàng</label>
                      <input
                        type="text"
                        placeholder="Nhập ghi chú chi tiết dòng hàng mới..."
                        value={newRowGhiChu}
                        onChange={(e) => setNewRowGhiChu(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded p-1.5"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setShowAddRowForm(false)}
                        className="px-3 py-1 bg-white border border-slate-200 text-slate-500 rounded font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={handleAddRowToInvoice}
                        className="px-4 py-1 bg-red-600 text-white rounded font-bold hover:bg-red-700 shadow-xs cursor-pointer"
                      >
                        Bổ Sung & Tái Tính Kho
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bảng chi tiết sản phẩm */}
              <div className="flex-1 overflow-y-auto p-4 max-h-[450px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3 font-mono w-12 text-center">STT</th>
                      <th className="py-2.5 px-3">Thông tin Tròng kính (SKU)</th>
                      <th className="py-2.5 px-3 text-center w-28">Số Lượng</th>
                      <th className="py-2.5 px-3">Ghi Chú</th>
                      {currentUser.writeAccess !== false && (
                        <th className="py-2.5 px-3 text-center w-24">Tác vụ</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDetails.map((row, index) => {
                      const isEditing = editingRowId === row.ID;
                      return (
                        <tr key={row.ID} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-3 font-mono text-slate-400 text-center">{index + 1}</td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 py-0.5 px-2 rounded text-[11px]">
                                {row.SKU}
                              </span>
                              <p className="text-[10px] text-slate-400 font-medium">{row.TEN_SP}</p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center font-bold font-mono">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                value={editQty}
                                onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-16 p-1 text-center border border-slate-300 rounded font-bold bg-white"
                              />
                            ) : (
                              <span className="text-blue-600">{row.SO_LUONG} miếng</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-500 font-medium">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editGhiChu}
                                onChange={(e) => setEditGhiChu(e.target.value)}
                                className="w-full p-1 border border-slate-300 rounded text-xs bg-white"
                              />
                            ) : (
                              <span className="italic" title={row.GHI_CHU}>
                                {row.GHI_CHU || 'Mặc định'}
                              </span>
                            )}
                          </td>
                          {currentUser.writeAccess !== false && (
                            <td className="py-3 px-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleSaveEditRow(row)}
                                    className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
                                    title="Lưu thay đổi"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEditRow}
                                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                    title="Hủy"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleStartEditRow(row)}
                                    className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer"
                                    title="Sửa dòng này"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow(row)}
                                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                    title="Xóa dòng này"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            <div className="bento-card bg-white border border-slate-100 p-8 text-center text-slate-400 font-mono italic rounded-2xl shadow-xs">
              Vui lòng chọn một phiếu từ danh sách bên trái để hiển thị thông tin chi tiết.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
