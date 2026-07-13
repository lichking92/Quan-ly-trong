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
  X, 
  Check, 
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NhapXuat, NhapXuatCT, SanPham, LoaiPhieu, User as UserType } from '../types';
import { formatDop } from '../data/mockData';

/**
 * FILE: TransactionHistory.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Quản lý lịch sử giao dịch (B_NHAPXUAT và B_NHAPXUATCT) với hiệu năng tối ưu.
 *        Hỗ trợ Tùy chọn độ rộng cột, ghi nhớ cấu hình, Column Chooser, Cố định cột cốt lõi.
 *        Bố cục thích ứng thông minh: 100% khi rỗng, Chia màn hình (Split View) trên Desktop, Drawer (Bottom Sheet) trên Mobile.
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

  // Sắp xếp
  const [sortBy, setSortBy] = useState<'HOA_DON' | 'NGAY'>('NGAY');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column Customization States
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`${currentUser.username}_HISTORY_VISIBLE_COLUMNS`);
    return saved ? JSON.parse(saved) : {
      invoiceNo: true,
      type: true,
      datetime: true,
      branch: true,
      creator: true,
      totalQty: true,
      note: true
    };
  });

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(`${currentUser.username}_HISTORY_TABLE_COLUMN_WIDTHS`);
    return saved ? JSON.parse(saved) : {
      invoiceNo: 140,
      type: 110,
      datetime: 170,
      branch: 160,
      creator: 160,
      totalQty: 90,
      note: 200
    };
  });

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
    const list = nhapXuats.filter(h => {
      const matchType = historyTypeFilter === 'Tất cả' || h.LOAI === historyTypeFilter;
      const matchSearch = h.HOA_DON.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.TEN_NGUOI_TAO.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.CHI_NHANH.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (h.GHI_CHU && h.GHI_CHU.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchType && matchSearch;
    });

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'HOA_DON') {
        comparison = a.HOA_DON.localeCompare(b.HOA_DON);
      } else {
        comparison = (a.TG_TAO || a.NGAY).localeCompare(b.TG_TAO || b.NGAY);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [nhapXuats, historyTypeFilter, searchQuery, sortBy, sortOrder]);

  // Chi tiết sản phẩm của hóa đơn đang chọn (Lazy loading)
  const activeDetails = useMemo(() => {
    if (!selectedInvoice) return [];
    return nhapXuatCTs.filter(d => d.HOA_DON === selectedInvoice);
  }, [selectedInvoice, nhapXuatCTs]);

  const activeHeader = useMemo(() => {
    if (!selectedInvoice) return null;
    return nhapXuats.find(h => h.HOA_DON === selectedInvoice) || null;
  }, [selectedInvoice, nhapXuats]);

  // --- 3. ĐỊNH DẠNG NGÀY GIỜ TOÀN DIỆN (DD/MM/YYYY HH:mm) ---
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'Chưa rõ';
    const parts = dateTimeStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';

    const dParts = datePart.split('-');
    if (dParts.length !== 3) return dateTimeStr;

    const yyyy = dParts[0];
    const mm = dParts[1];
    const dd = dParts[2];

    const tParts = timePart.split(':');
    const hh = tParts[0] || '00';
    const min = tParts[1] || '00';

    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  };

  // --- 4. TÙY CHỈNH CỘT (DRAG & DOUBLE CLICK) ---
  const handleMouseDown = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = columnWidths[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(60, startWidth + deltaX);
      setColumnWidths(prev => {
        const next = { ...prev, [colKey]: newWidth };
        localStorage.setItem(`${currentUser.username}_HISTORY_TABLE_COLUMN_WIDTHS`, JSON.stringify(next));
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClick = (colKey: string, defaultWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [colKey]: defaultWidth };
      localStorage.setItem(`${currentUser.username}_HISTORY_TABLE_COLUMN_WIDTHS`, JSON.stringify(next));
      return next;
    });
  };

  const toggleColumnVisibility = (colKey: string) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [colKey]: !prev[colKey] };
      localStorage.setItem(`${currentUser.username}_HISTORY_VISIBLE_COLUMNS`, JSON.stringify(next));
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setHistoryTypeFilter('Tất cả');
    setSelectedInvoice(null);
  };

  // --- 5. CHỈNH SỬA DÒNG CHI TIẾT ---
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

  const handleSaveEditRow = (row: NhapXuatCT) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (editQty <= 0) {
      setErrorMsg('Số lượng sửa đổi bắt buộc phải lớn hơn 0.');
      return;
    }

    if (!activeHeader) return;

    if (activeHeader.LOAI === 'XUẤT') {
      const targetProduct = sanPhams.find(p => p.SKU === row.SKU);
      if (targetProduct) {
        const totalAvailableStock = targetProduct.TON_CUOI + row.SO_LUONG;
        if (editQty > totalAvailableStock) {
          setErrorMsg(`Lỗi nghiệp vụ (Rule 1): Không cho phép xuất âm kho. SKU [${row.SKU}] chỉ có thể xuất tối đa là ${totalAvailableStock} ${row.DVT}.`);
          return;
        }
      }
    }

    const updatedDetails = nhapXuatCTs.map(d => {
      if (d.ID === row.ID) {
        return { ...d, SO_LUONG: editQty, GHI_CHU: editGhiChu };
      }
      return d;
    });

    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    onUpdateTransaction(updatedHeader, updatedDetails, [row.SKU]);

    setEditingRowId(null);
    setSuccessMsg('Đã chỉnh sửa dòng sản phẩm và tự động tái tính toán tồn kho thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 6. BỔ SUNG DÒNG SẢN PHẨM ---
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

    if (activeHeader.LOAI === 'XUẤT') {
      if (newRowQty > targetProduct.TON_CUOI) {
        setErrorMsg(`Lỗi (Rule 1): Không cho xuất âm kho. SKU [${newRowSKU}] chỉ còn tồn ${targetProduct.TON_CUOI} ${targetProduct.DVT}.`);
        return;
      }
    }

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
    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    onUpdateTransaction(updatedHeader, updatedDetails, [newRowSKU]);

    setNewRowSKU('');
    setNewRowQty(10);
    setNewRowGhiChu('');
    setShowAddRowForm(false);
    setSuccessMsg('Đã bổ sung dòng sản phẩm vào phiếu thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 7. XÓA DÒNG CHI TIẾT ---
  const handleDeleteRow = (row: NhapXuatCT) => {
    if (!activeHeader) return;
    if (activeDetails.length <= 1) {
      setErrorMsg('Phiếu nhập xuất bắt buộc phải chứa ít nhất 1 mặt hàng. Bạn không thể xóa dòng cuối cùng. Hãy chọn "Hủy Phiếu" nếu muốn hủy bỏ toàn bộ.');
      return;
    }

    if (!window.confirm(`Xác nhận xóa dòng sản phẩm [${row.SKU}] khỏi phiếu này? Số tồn kho sẽ tự động tính toán lại.`)) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    const updatedDetails = nhapXuatCTs.filter(d => d.ID !== row.ID);
    const newTotalQty = updatedDetails
      .filter(d => d.HOA_DON === selectedInvoice)
      .reduce((sum, d) => sum + d.SO_LUONG, 0);

    const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

    onUpdateTransaction(updatedHeader, updatedDetails, [row.SKU]);

    setSuccessMsg('Xóa dòng và tái cấu trúc tồn kho thành công!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // --- 8. HỦY HOÀN TOÀN CẢ PHIẾU (ROLLBACK) ---
  const handleDeleteEntireInvoice = () => {
    if (!activeHeader) return;
    if (!window.confirm(`⚠️ CẢNH BÁO QUAN TRỌNG:\nHành động này sẽ XÓA HOÀN TOÀN phiếu ${activeHeader.HOA_DON} và tiến hành HOÀN TỒN KHO (ROLLBACK) của tất cả sản phẩm liên quan.\n\nBạn có chắc chắn muốn tiếp tục thực hiện?`)) {
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    const affectedSKUs = activeDetails.map(d => d.SKU);
    onDeleteTransaction(activeHeader.HOA_DON, affectedSKUs);

    setSelectedInvoice(null);
    setSuccessMsg(`Đã hủy bỏ hoàn toàn phiếu ${activeHeader.HOA_DON} và hoàn tất Rollback kho!`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // --- 9. RENDER GIAO DIỆN CHI TIẾT PHIẾU ---
  const renderDetailsContent = () => {
    if (!activeHeader) return null;
    return (
      <div className="flex flex-col h-full max-h-[700px]">
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
              Tạo bởi {activeHeader.TEN_NGUOI_TAO} lúc {formatDateTime(activeHeader.TG_TAO || activeHeader.NGAY)}
            </p>
            <p className="text-[11px] text-slate-500 font-semibold">
              Chi nhánh thực hiện: <strong>{activeHeader.CHI_NHANH}</strong>
            </p>
          </div>

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
        <div className="flex-1 overflow-y-auto p-4">
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
            <tbody className="divide-y divide-slate-100 bg-white">
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
    );
  };

  // Tính tổng độ rộng hiện thời để gán style table min-width
  const tableMinWidth = useMemo(() => {
    return Object.entries(columnWidths).reduce((sum, [k, w]) => {
      const width = w as number;
      return sum + (visibleColumns[k] !== false ? width : 0);
    }, 0);
  }, [columnWidths, visibleColumns]);

  return (
    <div className="space-y-6">
      
      {/* 1. KHU VỰC BỘ LỌC VÀ TÌM KIẾM PHIẾU */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Tìm kiếm nhanh */}
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text"
            placeholder="Tìm theo số phiếu, người tạo, chi nhánh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-hidden text-slate-700 font-semibold"
          />
        </div>

        {/* Lọc loại phiếu & Chooser */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {(['Tất cả', 'NHẬP', 'XUẤT', 'KIỂM KHO'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setHistoryTypeFilter(type); setSelectedInvoice(null); }}
                className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  historyTypeFilter === type ? 'bg-red-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {type === 'Tất cả' ? 'Mọi loại phiếu' : type}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Reset Filters */}
            <button
              onClick={handleResetFilters}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-500 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              title="Xóa bộ lọc"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Column Chooser Button */}
            <div className="relative">
              <button
                onClick={() => setShowColumnChooser(!showColumnChooser)}
                className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                  showColumnChooser 
                    ? 'bg-blue-50 text-blue-600 border-blue-200' 
                    : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-150'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Cột hiển thị
              </button>

              <AnimatePresence>
                {showColumnChooser && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowColumnChooser(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute right-0 mt-2 w-56 bg-white border border-slate-150 rounded-xl shadow-lg z-40 p-3 space-y-2 text-xs"
                    >
                      <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-1.5 mb-1.5 uppercase tracking-wider text-[9px]">Ẩn / hiện cột dữ liệu</h4>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {[
                          { key: 'invoiceNo', label: 'Số phiếu' },
                          { key: 'type', label: 'Loại' },
                          { key: 'datetime', label: 'Ngày giờ tạo' },
                          { key: 'branch', label: 'Chi nhánh' },
                          { key: 'creator', label: 'Người tạo phiếu' },
                          { key: 'totalQty', label: 'Tổng số lượng' },
                          { key: 'note', label: 'Ghi chú' }
                        ].map(col => (
                          <label key={col.key} className="flex items-center gap-2 cursor-pointer font-semibold text-slate-600 hover:text-slate-800">
                            <input 
                              type="checkbox" 
                              checked={visibleColumns[col.key] !== false}
                              onChange={() => toggleColumnVisibility(col.key)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span>{col.label}</span>
                          </label>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs animate-fade-in">
          <Check className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs animate-fade-in">
          <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* MASTER-DETAIL SỐNG ĐỘNG */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* PANEL TRÁI: DANH SÁCH MASTER (TAKES 100% OR 67%) */}
        <div className={`bento-card !p-0 overflow-hidden flex flex-col bg-white border border-slate-100 rounded-2xl shadow-xs transition-all duration-350 ${
          selectedInvoice ? 'lg:col-span-8' : 'lg:col-span-12'
        }`}>
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Lịch sử phiếu giao dịch ({filteredInvoices.length} phiếu)
            </span>
          </div>

          {/* Sắp xếp nhanh */}
          <div className="bg-slate-50/40 p-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus:outline-hidden"
              >
                <option value="NGAY">Ngày lập</option>
                <option value="HOA_DON">Số phiếu</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-750 bg-white border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                title={sortOrder === 'asc' ? 'Tăng dần' : 'Giảm dần'}
              >
                {sortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>

            {selectedInvoice && (
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-[10px] font-extrabold text-blue-600 hover:text-blue-800 bg-blue-50 py-0.5 px-2.5 rounded-md transition-all cursor-pointer"
              >
                Thu nhỏ chi tiết ✕
              </button>
            )}
          </div>

          {/* TABLE RENDER (RESIZABLE & FIXED STICKY COLUMNS) */}
          <div className="overflow-y-auto max-h-[600px] bg-slate-50/25">
            {filteredInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table 
                  className="w-full text-left text-xs border-collapse table-layout-fixed" 
                  style={{ minWidth: tableMinWidth }}
                >
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold select-none">
                      {visibleColumns.invoiceNo !== false && (
                        <th 
                          style={{ width: columnWidths.invoiceNo, minWidth: columnWidths.invoiceNo, maxWidth: columnWidths.invoiceNo }}
                          className="py-2.5 px-3 relative sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-200"
                        >
                          Số phiếu
                          <div 
                            onMouseDown={(e) => handleMouseDown('invoiceNo', e)}
                            onDoubleClick={() => handleDoubleClick('invoiceNo', 140)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-30"
                            title="Kéo rộng / Click đúp khôi phục"
                          />
                        </th>
                      )}
                      {visibleColumns.type !== false && (
                        <th 
                          style={{ width: columnWidths.type, minWidth: columnWidths.type, maxWidth: columnWidths.type }}
                          className="py-2.5 px-3 relative"
                        >
                          Loại
                          <div 
                            onMouseDown={(e) => handleMouseDown('type', e)}
                            onDoubleClick={() => handleDoubleClick('type', 110)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                      {visibleColumns.datetime !== false && (
                        <th 
                          style={{ width: columnWidths.datetime, minWidth: columnWidths.datetime, maxWidth: columnWidths.datetime }}
                          className="py-2.5 px-3 relative"
                        >
                          Ngày giờ tạo
                          <div 
                            onMouseDown={(e) => handleMouseDown('datetime', e)}
                            onDoubleClick={() => handleDoubleClick('datetime', 170)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                      {visibleColumns.branch !== false && (
                        <th 
                          style={{ width: columnWidths.branch, minWidth: columnWidths.branch, maxWidth: columnWidths.branch }}
                          className="py-2.5 px-3 relative"
                        >
                          Chi nhánh
                          <div 
                            onMouseDown={(e) => handleMouseDown('branch', e)}
                            onDoubleClick={() => handleDoubleClick('branch', 160)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                      {visibleColumns.creator !== false && (
                        <th 
                          style={{ width: columnWidths.creator, minWidth: columnWidths.creator, maxWidth: columnWidths.creator }}
                          className="py-2.5 px-3 relative"
                        >
                          Người tạo phiếu
                          <div 
                            onMouseDown={(e) => handleMouseDown('creator', e)}
                            onDoubleClick={() => handleDoubleClick('creator', 160)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                      {visibleColumns.totalQty !== false && (
                        <th 
                          style={{ width: columnWidths.totalQty, minWidth: columnWidths.totalQty, maxWidth: columnWidths.totalQty }}
                          className="py-2.5 px-3 text-right relative"
                        >
                          Tổng SL
                          <div 
                            onMouseDown={(e) => handleMouseDown('totalQty', e)}
                            onDoubleClick={() => handleDoubleClick('totalQty', 90)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                      {visibleColumns.note !== false && (
                        <th 
                          style={{ width: columnWidths.note, minWidth: columnWidths.note, maxWidth: columnWidths.note }}
                          className="py-2.5 px-3 relative"
                        >
                          Ghi chú tổng quan
                          <div 
                            onMouseDown={(e) => handleMouseDown('note', e)}
                            onDoubleClick={() => handleDoubleClick('note', 200)}
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
                          />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredInvoices.map((h) => {
                      const isSelected = h.HOA_DON === selectedInvoice;
                      let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                      if (h.LOAI === 'XUẤT') badgeColor = 'bg-rose-50 text-rose-700 border-rose-100';
                      if (h.LOAI === 'KIỂM KHO') badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';

                      return (
                        <tr
                          key={h.HOA_DON}
                          onClick={() => {
                            setSelectedInvoice(h.HOA_DON);
                            handleCancelEditRow();
                            setShowAddRowForm(false);
                          }}
                          className={`cursor-pointer hover:bg-slate-50/75 transition-colors ${
                            isSelected ? 'bg-blue-50/40 font-bold' : ''
                          }`}
                        >
                          {visibleColumns.invoiceNo !== false && (
                            <td className="py-3 px-3 font-mono font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-200">
                              {h.HOA_DON}
                            </td>
                          )}
                          {visibleColumns.type !== false && (
                            <td className="py-3 px-3">
                              <span className={`text-[9px] font-bold py-0.5 px-2 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                                {h.LOAI}
                              </span>
                            </td>
                          )}
                          {visibleColumns.datetime !== false && (
                            <td className="py-3 px-3 font-mono text-slate-500">
                              {formatDateTime(h.TG_TAO || h.NGAY)}
                            </td>
                          )}
                          {visibleColumns.branch !== false && (
                            <td className="py-3 px-3 text-slate-700 font-semibold truncate" title={h.CHI_NHANH}>
                              {h.CHI_NHANH}
                            </td>
                          )}
                          {visibleColumns.creator !== false && (
                            <td className="py-3 px-3 text-slate-600 font-medium truncate" title={h.TEN_NGUOI_TAO}>
                              {h.TEN_NGUOI_TAO}
                            </td>
                          )}
                          {visibleColumns.totalQty !== false && (
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-750">
                              {h.TONG_SL}
                            </td>
                          )}
                          {visibleColumns.note !== false && (
                            <td className="py-3 px-3 text-slate-400 italic truncate" title={h.GHI_CHU}>
                              {h.GHI_CHU || '—'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-24 text-center text-xs text-slate-400 font-mono italic">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                Không tìm thấy dữ liệu hóa đơn nào khớp bộ lọc.
              </div>
            )}
          </div>
        </div>

        {/* PANEL PHẢI: CHI TIẾT CỦA PHIẾU ĐANG CHỌN (CHỈ HIỂN THỊ TRÊN DESKTOP) */}
        {selectedInvoice && activeHeader && (
          <div className="hidden lg:block lg:col-span-4 animate-fade-in">
            <div className="bento-card !p-0 overflow-hidden bg-white border border-slate-100 rounded-2xl shadow-xs">
              {renderDetailsContent()}
            </div>
          </div>
        )}
      </div>

      {/* OVERLAY BOTTOM DRAWER / SHEET CHO THIẾT BỊ DI ĐỘNG */}
      <AnimatePresence>
        {selectedInvoice && activeHeader && (
          <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs">
            {/* Click backdrop to close */}
            <div className="absolute inset-0" onClick={() => setSelectedInvoice(null)} />
            
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl relative z-10"
            >
              {/* Drag bar indicator */}
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />
              
              <button
                onClick={() => setSelectedInvoice(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="pb-8">
                {renderDetailsContent()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
