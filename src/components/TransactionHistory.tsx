/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  SlidersHorizontal,
  History,
  ArrowLeft,
  Save,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NhapXuat, NhapXuatCT, SanPham, LoaiPhieu, User as UserType, KiemKho } from '../types';
import { formatDop, formatSKUForDisplay, cleanSKU } from '../data/mockData';

export interface AuditLog {
  id: string;
  HOA_DON: string;
  LOAI_HIEU_CHINH: 'THÊM' | 'SỬA' | 'XÓA';
  NGUOI_THAO_TAC: string;
  THOI_GIAN: string;
  DU_LIEU_TRUOC?: string;
  DU_LIEU_SAU?: string;
  GHI_CHU?: string;
}

interface TransactionHistoryProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  kiemKhos?: KiemKho[];
  onUpdateTransaction: (
    updatedHeader: NhapXuat, 
    updatedDetails: NhapXuatCT[], 
    skusToRecalc: string[]
  ) => void;
  onDeleteTransaction: (hoaDonId: string, skusToRecalc: string[]) => Promise<boolean>;
  onSaveTransaction?: (header: NhapXuat, details: NhapXuatCT[]) => Promise<void>;
  chiNhanhs?: string[];
  thuongHieus?: string[];
}

export default function TransactionHistory({
  currentUser,
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  kiemKhos = [],
  onUpdateTransaction,
  onDeleteTransaction,
  onSaveTransaction,
  chiNhanhs = [],
  thuongHieus = []
}: TransactionHistoryProps) {
  
  // --- 1. QUẢN LÝ TRẠNG THÁI GIAO DIỆN ---
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  // States for dynamic Voucher Form (Create & Edit)
  const [isEditingInvoice, setIsEditingInvoice] = useState<boolean>(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState<boolean>(false);
  const [createInvoiceType, setCreateInvoiceType] = useState<'NHẬP' | 'XUẤT' | 'NHẬP_KIEM_KHO' | 'XUAT_KIEM_KHO'>('NHẬP');
  
  const [formInvoiceId, setFormInvoiceId] = useState<string>('');
  const [formBranch, setFormBranch] = useState<string>('');
  const [formDate, setFormDate] = useState<string>('');
  const [formGhiChu, setFormGhiChu] = useState<string>('');
  const [formItems, setFormItems] = useState<NhapXuatCT[]>([]);
  
  const [editorSearchSku, setEditorSearchSku] = useState<string>('');
  const [editorAddQty, setEditorAddQty] = useState<number>(1);
  const [editorAddGhiChu, setEditorAddGhiChu] = useState<string>('');

  // States for Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('B_AUDIT_LOG_LIST');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAuditLogModal, setShowAuditLogModal] = useState<boolean>(false);

  // Function to save Audit Logs locally and in-memory
  const addAuditLog = (loai: 'THÊM' | 'SỬA' | 'XÓA', hoaDonId: string, before?: any, after?: any, notes?: string) => {
    const newLog: AuditLog = {
      id: `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      HOA_DON: hoaDonId,
      LOAI_HIEU_CHINH: loai,
      NGUOI_THAO_TAC: currentUser.username || 'System',
      THOI_GIAN: new Date().toLocaleString('vi-VN'),
      DU_LIEU_TRUOC: before ? JSON.stringify(before, null, 2) : undefined,
      DU_LIEU_SAU: after ? JSON.stringify(after, null, 2) : undefined,
      GHI_CHU: notes || ''
    };
    const nextLogs = [newLog, ...auditLogs];
    setAuditLogs(nextLogs);
    localStorage.setItem('B_AUDIT_LOG_LIST', JSON.stringify(nextLogs));
  };

  // Stock Level Simulation to PREVENT NEGATIVE INVENTORY (Rule 1)
  const checkSimulatedStock = (headerId: string, tempDetails: NhapXuatCT[]): { success: boolean; errorSku?: string; negativeValue?: number } => {
    const oldDetailsOfThisHeader = nhapXuatCTs.filter(d => d.HOA_DON === headerId);
    const affectedSKUs = Array.from(new Set([
      ...oldDetailsOfThisHeader.map(d => d.SKU),
      ...tempDetails.map(d => d.SKU)
    ]));

    const activeInvoices = new Set(
      nhapXuats
        .filter(h => h.HOA_DON !== headerId && h.TRANG_THAI !== 'Đã hủy')
        .map(h => h.HOA_DON)
    );
    const otherDetails = nhapXuatCTs.filter(d => activeInvoices.has(d.HOA_DON));
    const simulatedDetails = [...otherDetails, ...tempDetails];

    for (const sku of affectedSKUs) {
      const product = sanPhams.find(p => p.SKU === sku);
      if (!product) continue;

      const normSku = cleanSKU(sku);
      
      const totalNhap = simulatedDetails
        .filter(d => cleanSKU(d.SKU) === normSku && d.LOAI === 'NHẬP')
        .reduce((sum, d) => sum + (Number(d.SO_LUONG) || 0), 0);

      const totalXuat = simulatedDetails
        .filter(d => cleanSKU(d.SKU) === normSku && d.LOAI === 'XUẤT')
        .reduce((sum, d) => sum + (Number(d.SO_LUONG) || 0), 0);

      const totalAuditNhapBu = (kiemKhos || [])
        .filter(k => cleanSKU(k.SKU) === normSku && k.LOAI_BU === 'NHẬP BÙ')
        .filter(k => !simulatedDetails.some(d => cleanSKU(d.SKU) === normSku && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
        .reduce((sum, k) => sum + (Number(k.LECH) || 0), 0);

      const totalAuditXuatBu = (kiemKhos || [])
        .filter(k => cleanSKU(k.SKU) === normSku && k.LOAI_BU === 'XUẤT BÙ')
        .filter(k => !simulatedDetails.some(d => cleanSKU(d.SKU) === normSku && (d.GHI_CHU || '').includes(k.MA_PHIEU)))
        .reduce((sum, k) => sum + Math.abs(Number(k.LECH) || 0), 0);

      const tonDau = Number(product.TON_DAU) || 0;
      const simulatedTonCuoi = tonDau + (totalNhap + totalAuditNhapBu) - (totalXuat + totalAuditXuatBu);

      if (simulatedTonCuoi < 0) {
        return { success: false, errorSku: sku, negativeValue: simulatedTonCuoi };
      }
    }

    return { success: true };
  };

  // Launch edit mode for the selected/active invoice
  const handleStartEditInvoice = () => {
    if (!activeHeader) return;
    setErrorMsg('');
    setSuccessMsg('');
    setFormInvoiceId(activeHeader.HOA_DON);
    setFormBranch(activeHeader.CHI_NHANH);
    setFormDate(activeHeader.NGAY);
    setFormGhiChu(activeHeader.GHI_CHU || '');
    setFormItems([...activeDetails]);
    setIsEditingInvoice(true);
  };

  // Launch create mode for a chosen type
  const handleStartCreateInvoice = (type: 'NHẬP' | 'XUẤT' | 'NHẬP_KIEM_KHO' | 'XUAT_KIEM_KHO') => {
    setErrorMsg('');
    setSuccessMsg('');
    setCreateInvoiceType(type);
    setFormInvoiceId('');
    
    // Choose a fallback branch
    const defaultBranch = chiNhanhs?.[0] || uniqueBranches?.[0] || 'Kho Trung Tâm';
    setFormBranch(defaultBranch);
    setFormDate(new Date().toISOString().split('T')[0]);
    
    let defaultGhiChu = '';
    if (type === 'NHẬP_KIEM_KHO') defaultGhiChu = 'Nhập chênh lệch kiểm kho thừa';
    else if (type === 'XUAT_KIEM_KHO') defaultGhiChu = 'Xuất chênh lệch kiểm kho thiếu';
    
    setFormGhiChu(defaultGhiChu);
    setFormItems([]);
    setIsCreatingInvoice(true);
  };

  // Save changes to edited invoice
  const handleSaveInvoiceChanges = () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!activeHeader) return;
    if (formItems.length === 0) {
      setErrorMsg('Phiếu không được bỏ trống danh sách tròng kính. Phải có ít nhất 1 mặt hàng.');
      return;
    }

    // Validate quantities
    if (formItems.some(i => i.SO_LUONG <= 0)) {
      setErrorMsg('Số lượng của tất cả mặt hàng phải lớn hơn 0.');
      return;
    }

    // Check simulated stock
    const checkResult = checkSimulatedStock(formInvoiceId, formItems);
    if (!checkResult.success) {
      setErrorMsg(`Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [${checkResult.errorSku}] sẽ có tồn kho sau khi sửa đổi là ${checkResult.negativeValue} cái.`);
      return;
    }

    // Custom confirm dialog instead of window.confirm
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận sửa đổi phiếu',
      message: 'Bạn có chắc chắn muốn lưu lại toàn bộ các sửa đổi cho phiếu này? Hệ thống sẽ cập nhật và tự động tính lại tồn kho.',
      confirmText: 'Lưu thay đổi',
      cancelText: 'Hủy bỏ',
      isDanger: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const newTotalQty = formItems.reduce((sum, d) => sum + d.SO_LUONG, 0);
          const updatedHeader: NhapXuat = {
            ...activeHeader,
            CHI_NHANH: formBranch,
            NGAY: formDate,
            GHI_CHU: formGhiChu,
            TONG_SL: newTotalQty
          };

          const updatedFormItems = formItems.map(d => ({
            ...d,
            CHI_NHANH: formBranch,
            NGAY: formDate,
            LOAI: activeHeader.LOAI
          }));

          const otherDetails = nhapXuatCTs.filter(d => d.HOA_DON !== formInvoiceId);
          const updatedDetailsList = [...otherDetails, ...updatedFormItems];

          const affectedSKUs = Array.from(new Set([
            ...activeDetails.map(d => d.SKU),
            ...formItems.map(d => d.SKU)
          ]));

          // Perform Update
          onUpdateTransaction(updatedHeader, updatedDetailsList, affectedSKUs);

          // Save Audit Log
          addAuditLog(
            'SỬA', 
            formInvoiceId, 
            { header: activeHeader, details: activeDetails }, 
            { header: updatedHeader, details: updatedFormItems }, 
            `Chỉnh sửa thông tin phiếu của ${currentUser.username}`
          );

          setIsEditingInvoice(false);
          triggerHistoryToast('Sửa phiếu thành công', 'success');
        } catch (err) {
          triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
        }
      }
    });
  };

  // Submit new voucher creation
  const handleCreateInvoiceSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (formItems.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất 1 mặt hàng vào phiếu.');
      return;
    }

    if (formItems.some(i => i.SO_LUONG <= 0)) {
      setErrorMsg('Số lượng của tất cả mặt hàng phải lớn hơn 0.');
      return;
    }

    // Determine type & prefix
    const isNhap = (createInvoiceType === 'NHẬP' || createInvoiceType === 'NHẬP_KIEM_KHO');
    const prefix = createInvoiceType === 'NHẬP' ? 'PN' : createInvoiceType === 'XUẤT' ? 'PX' : createInvoiceType === 'NHẬP_KIEM_KHO' ? 'PNK' : 'PXK';
    const loai: LoaiPhieu = isNhap ? 'NHẬP' : 'XUẤT';

    // Check simulated stock
    const checkResult = checkSimulatedStock('', formItems);
    if (!checkResult.success) {
      setErrorMsg(`Lỗi (Rule 1): Không cho phép tồn kho âm. SKU [${checkResult.errorSku}] sẽ có tồn kho sau khi tạo phiếu là ${checkResult.negativeValue} cái.`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận tạo phiếu mới',
      message: `Bạn có chắc chắn muốn lưu phiếu mới (${createInvoiceType.replace('_', ' ')})?`,
      confirmText: 'Tạo phiếu',
      cancelText: 'Hủy bỏ',
      isDanger: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          // Predict next Invoice No for Logging
          let maxNum = 0;
          nhapXuats.forEach(h => {
            if (h.HOA_DON.startsWith(prefix)) {
              const numPart = parseInt(h.HOA_DON.substring(prefix.length), 10);
              if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
              }
            }
          });
          const predictedInvoiceId = `${prefix}${String(maxNum + 1).padStart(6, '0')}`;

          // Construct mock new header with temp invoice ID
          const tempId = `${prefix}_temp_${Date.now()}`;
          const newHeader: NhapXuat = {
            HOA_DON: tempId,
            CHI_NHANH: formBranch,
            NGAY: formDate,
            LOAI: loai,
            TONG_SL: formItems.reduce((sum, d) => sum + d.SO_LUONG, 0),
            NGUOI_TAO: currentUser.username,
            TEN_NGUOI_TAO: currentUser.fullName || currentUser.username,
            TG_TAO: new Date().toISOString().replace('T', ' ').substring(0, 19),
            GHI_CHU: formGhiChu
          };

          const newDetails: NhapXuatCT[] = formItems.map((item, idx) => ({
            ...item,
            ID: `CT_NEW_${Date.now()}_${idx}`,
            HOA_DON: tempId,
            LOAI: loai,
            NGAY: formDate
          }));

          if (onSaveTransaction) {
            await onSaveTransaction(newHeader, newDetails);

            // Save Audit Log
            addAuditLog(
              'THÊM',
              predictedInvoiceId,
              undefined,
              { header: { ...newHeader, HOA_DON: predictedInvoiceId }, details: newDetails.map(d => ({ ...d, HOA_DON: predictedInvoiceId })) },
              `Tạo mới phiếu ${prefix} thành công`
            );

            setIsCreatingInvoice(false);
            triggerHistoryToast(`Tạo phiếu mới thành công: ${predictedInvoiceId}`, 'success');
          } else {
            setErrorMsg('Hệ thống chưa hỗ trợ hàm lưu phiếu mới.');
            triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
          }
        } catch (err) {
          triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
        }
      }
    });
  };

  // Add a selected product item into form details
  const handleEditorAddItem = () => {
    setErrorMsg('');
    if (!editorSearchSku) {
      setErrorMsg('Vui lòng chọn SKU tròng kính.');
      return;
    }

    const targetProduct = sanPhams.find(p => p.SKU === editorSearchSku);
    if (!targetProduct) {
      setErrorMsg('Sản phẩm không hợp lệ.');
      return;
    }

    if (editorAddQty <= 0) {
      setErrorMsg('Số lượng bổ sung phải lớn hơn 0.');
      return;
    }

    if (formItems.some(item => item.SKU === editorSearchSku)) {
      setErrorMsg('Sản phẩm SKU này đã tồn tại trong phiếu. Hãy điều chỉnh số lượng ở bảng bên dưới.');
      return;
    }

    const isNhap = (isCreatingInvoice && (createInvoiceType === 'NHẬP' || createInvoiceType === 'NHẬP_KIEM_KHO')) || (isEditingInvoice && activeHeader?.LOAI === 'NHẬP');
    const loai: LoaiPhieu = isNhap ? 'NHẬP' : 'XUẤT';

    const newItem: NhapXuatCT = {
      ID: `CT_TEMP_${Date.now()}`,
      HOA_DON: formInvoiceId || 'TEMP',
      SKU: targetProduct.SKU,
      TEN_SP: targetProduct.TEN_SAN_PHAM,
      THUONG_HIEU: targetProduct.THUONG_HIEU,
      CHIET_XUAT: targetProduct.CHIET_XUAT,
      TINH_NANG: targetProduct.TINH_NANG,
      SPH: targetProduct.CAN,
      CYL: targetProduct.LOAN,
      SO_LUONG: editorAddQty,
      DVT: targetProduct.DVT || 'Cái',
      GHI_CHU: editorAddGhiChu || 'Ghi chú bổ sung',
      LOAI: loai,
      NGAY: formDate
    };

    setFormItems([...formItems, newItem]);
    setEditorSearchSku('');
    setEditorAddQty(1);
    setEditorAddGhiChu('');
  };

  // Remove a row from the form details
  const removeItemFromForm = (sku: string) => {
    setFormItems(prev => prev.filter(i => i.SKU !== sku));
  };

  // Update a quantity in the form details
  const updateItemQtyInForm = (sku: string, val: number) => {
    setFormItems(prev => prev.map(i => i.SKU === sku ? { ...i, SO_LUONG: val } : i));
  };

  // Update a note in the form details
  const updateItemNoteInForm = (sku: string, val: string) => {
    setFormItems(prev => prev.map(i => i.SKU === sku ? { ...i, GHI_CHU: val } : i));
  };
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_SEARCH`) || '';
  });
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'Tất cả' | 'NHẬP' | 'XUẤT' | 'KIỂM KHO'>(() => {
    return (localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_TYPE`) as any) || 'Tất cả';
  });

  // Sắp xếp
  const [sortBy, setSortBy] = useState<'HOA_DON' | 'NGAY'>(() => {
    return (localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_SORT_BY`) as any) || 'NGAY';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    return (localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_SORT_ORDER`) as any) || 'desc';
  });

  // Gộp nhóm theo ngày & Sắp xếp cột
  const [isGroupedByDate, setIsGroupedByDate] = useState<boolean>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_GROUPED`) === 'true';
  });
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Bộ lọc nâng cao: Chi nhánh, Kho, Ngày bắt đầu/kết thúc
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_BRANCH`) || 'Tất cả';
  });
  const [warehouseFilter, setWarehouseFilter] = useState<string>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_WAREHOUSE`) || 'Tất cả';
  });
  const [fromDate, setFromDate] = useState<string>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_FROM_DATE`) || '';
  });
  const [toDate, setToDate] = useState<string>(() => {
    return localStorage.getItem(`${currentUser.username}_HISTORY_FILTER_TO_DATE`) || '';
  });

  // Tự động trích xuất danh sách chi nhánh/kho từ dữ liệu giao dịch
  const uniqueBranches = useMemo(() => {
    const branches = nhapXuats.map(h => h.CHI_NHANH).filter(Boolean);
    return Array.from(new Set(branches));
  }, [nhapXuats]);

  // Đồng bộ hóa trạng thái bộ lọc vào localStorage
  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_SEARCH`, searchQuery);
  }, [searchQuery, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_TYPE`, historyTypeFilter);
  }, [historyTypeFilter, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_SORT_BY`, sortBy);
  }, [sortBy, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_SORT_ORDER`, sortOrder);
  }, [sortOrder, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_GROUPED`, String(isGroupedByDate));
  }, [isGroupedByDate, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_BRANCH`, branchFilter);
  }, [branchFilter, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_WAREHOUSE`, warehouseFilter);
  }, [warehouseFilter, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_FROM_DATE`, fromDate);
  }, [fromDate, currentUser]);

  useEffect(() => {
    localStorage.setItem(`${currentUser.username}_HISTORY_FILTER_TO_DATE`, toDate);
  }, [toDate, currentUser]);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem(`${currentUser.username}_HISTORY_COLUMN_ORDER`);
    return saved ? JSON.parse(saved) : ['invoiceNo', 'type', 'status', 'datetime', 'branch', 'creator', 'totalQty', 'note'];
  });

  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const nextOrder = [...columnOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < nextOrder.length) {
      const temp = nextOrder[index];
      nextOrder[index] = nextOrder[targetIndex];
      nextOrder[targetIndex] = temp;
      setColumnOrder(nextOrder);
      localStorage.setItem(`${currentUser.username}_HISTORY_COLUMN_ORDER`, JSON.stringify(nextOrder));
    }
  };

  // Column Customization States
  const [showColumnChooser, setShowColumnChooser] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(`${currentUser.username}_HISTORY_VISIBLE_COLUMNS`);
    return saved ? JSON.parse(saved) : {
      invoiceNo: true,
      type: true,
      status: true,
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
      status: 110,
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

  // --- CUSTOM DIALOGS & TOAST FOR TRANSACTION HISTORY ---
  interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  interface HistoryToastState {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
    id: number;
  }
  const [historyToast, setHistoryToast] = useState<HistoryToastState | null>(null);

  const triggerHistoryToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setHistoryToast({ show: true, message, type, id: Date.now() });
  };

  useEffect(() => {
    if (historyToast) {
      const timer = setTimeout(() => {
        setHistoryToast(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [historyToast]);

  // --- 2. LỌC DANH SÁCH HÓA ĐƠN HIỂN THỊ ---
  const filteredInvoices = useMemo(() => {
    const list = nhapXuats.filter(h => {
      const matchType = historyTypeFilter === 'Tất cả' || h.LOAI === historyTypeFilter;
      const matchSearch = h.HOA_DON.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.TEN_NGUOI_TAO.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          h.CHI_NHANH.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (h.GHI_CHU && h.GHI_CHU.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchBranch = branchFilter === 'Tất cả' || h.CHI_NHANH === branchFilter;
      const matchWarehouse = warehouseFilter === 'Tất cả' || h.CHI_NHANH === warehouseFilter;
      const matchFromDate = !fromDate || h.NGAY >= fromDate;
      const matchToDate = !toDate || h.NGAY <= toDate;

      return matchType && matchSearch && matchBranch && matchWarehouse && matchFromDate && matchToDate;
    });

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'HOA_DON') {
        comparison = a.HOA_DON.localeCompare(b.HOA_DON);
      } else {
        // Sắp xếp nghiêm ngặt theo Ngày chứng từ (NGAY) trước
        const dateA = a.NGAY || '';
        const dateB = b.NGAY || '';
        comparison = dateA.localeCompare(dateB);
        
        // Nếu cùng ngày chứng từ, sắp xếp phụ theo thời gian tạo hoặc số phiếu
        if (comparison === 0) {
          const secondaryA = a.TG_TAO || a.HOA_DON;
          const secondaryB = b.TG_TAO || b.HOA_DON;
          comparison = secondaryA.localeCompare(secondaryB);
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [nhapXuats, historyTypeFilter, searchQuery, sortBy, sortOrder, branchFilter, warehouseFilter, fromDate, toDate]);

  const groupedInvoicesByDate = useMemo(() => {
    const groups: { dateStr: string; invoices: NhapXuat[] }[] = [];
    filteredInvoices.forEach(h => {
      const dateStr = h.NGAY || (h.TG_TAO ? h.TG_TAO.split(' ')[0] : 'Chưa rõ');
      let group = groups.find(g => g.dateStr === dateStr);
      if (!group) {
        group = { dateStr, invoices: [] };
        groups.push(group);
      }
      group.invoices.push(h);
    });
    return groups;
  }, [filteredInvoices]);

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
    setBranchFilter('Tất cả');
    setWarehouseFilter('Tất cả');
    setFromDate('');
    setToDate('');
    setSortBy('NGAY');
    setSortOrder('desc');
    setIsGroupedByDate(false);
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

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa sản phẩm',
      message: 'Bạn có chắc muốn xóa SKU này khỏi phiếu?',
      confirmText: 'Xóa dòng',
      cancelText: 'Quay lại',
      isDanger: true,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setErrorMsg('');
        setSuccessMsg('');

        try {
          const updatedDetails = nhapXuatCTs.filter(d => d.ID !== row.ID);
          const newTotalQty = updatedDetails
            .filter(d => d.HOA_DON === selectedInvoice)
            .reduce((sum, d) => sum + d.SO_LUONG, 0);

          const updatedHeader = { ...activeHeader, TONG_SL: newTotalQty };

          onUpdateTransaction(updatedHeader, updatedDetails, [row.SKU]);
          triggerHistoryToast('Xóa sản phẩm thành công', 'success');
        } catch (err) {
          triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
        }
      }
    });
  };

  // --- 8. HỦY HOÀN TOÀN CẢ PHIẾU (ROLLBACK) ---
  const handleDeleteEntireInvoice = async () => {
    if (!activeHeader) return;

    if (activeHeader.TRANG_THAI === 'Đã hủy') {
      setErrorMsg('Phiếu này đã được hủy trước đó, không thể hủy lại.');
      return;
    }

    // Verify deleting won't cause negative inventory (Rule 1)
    const checkResult = checkSimulatedStock(activeHeader.HOA_DON, []);
    if (!checkResult.success) {
      setErrorMsg(`Lỗi (Rule 1): Không cho phép hủy/xóa phiếu vì việc hoàn tác sẽ làm tồn kho của SKU [${checkResult.errorSku}] bị âm (${checkResult.negativeValue} cái).`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận hủy phiếu',
      message: `Bạn có chắc muốn hủy phiếu ${activeHeader.HOA_DON}?`,
      confirmText: 'Hủy phiếu',
      cancelText: 'Quay lại',
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setErrorMsg('');
        setSuccessMsg('');

        const affectedSKUs = activeDetails.map(d => d.SKU);

        // Save Audit Log
        addAuditLog(
          'XÓA',
          activeHeader.HOA_DON,
          { header: activeHeader, details: activeDetails },
          undefined,
          `Hủy hoàn toàn phiếu bởi ${currentUser.username}`
        );

        try {
          const success = await onDeleteTransaction(activeHeader.HOA_DON, affectedSKUs);

          if (success) {
            setSelectedInvoice(null);
            triggerHistoryToast('Hủy phiếu thành công', 'success');
          } else {
            triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
          }
        } catch (err) {
          triggerHistoryToast('Thao tác thất bại, vui lòng thử lại', 'error');
        }
      }
    });
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
                  onClick={handleStartEditInvoice}
                  className="flex items-center gap-1 text-[11px] font-bold py-1.5 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5 text-indigo-500" /> Sửa Phiếu
                </button>

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
                    {sanPhams.map((p, idx) => (
                      <option key={`${p.SKU}-${idx}`} value={p.SKU}>{formatSKUForDisplay(p.SKU)} (Còn tồn: {p.TON_CUOI})</option>
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
                          {formatSKUForDisplay(row.SKU)}
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

  const colDefinitions: Record<string, {
    label: string;
    defaultWidth: number;
    renderHeader: (width: number, onMouseDown: (e: React.MouseEvent) => void, onDoubleClick: () => void) => React.ReactNode;
    renderCell: (h: NhapXuat, isSelected: boolean, badgeColor: string) => React.ReactNode;
  }> = {
    invoiceNo: {
      label: 'Số phiếu',
      defaultWidth: 140,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="invoiceNo"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-200 font-bold uppercase tracking-wider text-[10px]"
        >
          Số phiếu
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-30"
            title="Kéo rộng / Click đúp khôi phục"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="invoiceNo" className="py-3 px-3 font-mono font-bold text-slate-800 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.04)] border-r border-slate-200">
          {h.HOA_DON}
        </td>
      )
    },
    type: {
      label: 'Loại',
      defaultWidth: 110,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="type"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Loại
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h, isSelected, badgeColor) => (
        <td key="type" className="py-3 px-3">
          <span className={`text-[9px] font-bold py-0.5 px-2 rounded-full border uppercase tracking-wider ${badgeColor}`}>
            {h.LOAI}
          </span>
        </td>
      )
    },
    status: {
      label: 'Trạng thái',
      defaultWidth: 110,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="status"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Trạng thái
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => {
        const isCancelled = h.TRANG_THAI === 'Đã hủy';
        const colorClass = isCancelled
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        return (
          <td key="status" className="py-3 px-3">
            <span className={`text-[9px] font-bold py-0.5 px-2 rounded-full border uppercase tracking-wider ${colorClass}`}>
              {isCancelled ? 'Đã hủy' : 'Hoàn tất'}
            </span>
          </td>
        );
      }
    },
    datetime: {
      label: 'Ngày giờ tạo',
      defaultWidth: 170,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="datetime"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Ngày giờ tạo
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="datetime" className="py-3 px-3 font-mono text-slate-500">
          {formatDateTime(h.TG_TAO || h.NGAY)}
        </td>
      )
    },
    branch: {
      label: 'Chi nhánh',
      defaultWidth: 160,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="branch"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Chi nhánh
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="branch" className="py-3 px-3 text-slate-700 font-semibold truncate" title={h.CHI_NHANH}>
          {h.CHI_NHANH}
        </td>
      )
    },
    creator: {
      label: 'Người tạo phiếu',
      defaultWidth: 160,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="creator"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Người tạo phiếu
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="creator" className="py-3 px-3 text-slate-600 font-medium truncate" title={h.TEN_NGUOI_TAO}>
          {h.TEN_NGUOI_TAO}
        </td>
      )
    },
    totalQty: {
      label: 'Tổng SL',
      defaultWidth: 90,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="totalQty"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 text-right relative font-bold uppercase tracking-wider text-[10px]"
        >
          Tổng SL
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="totalQty" className="py-3 px-3 text-right font-mono font-bold text-slate-700">
          {h.TONG_SL}
        </td>
      )
    },
    note: {
      label: 'Ghi chú',
      defaultWidth: 200,
      renderHeader: (width, onMouseDown, onDoubleClick) => (
        <th 
          key="note"
          style={{ width, minWidth: width, maxWidth: width }}
          className="py-2.5 px-3 relative font-bold uppercase tracking-wider text-[10px]"
        >
          Ghi chú tổng quan
          <div 
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-red-500/40 active:bg-red-600 z-25"
          />
        </th>
      ),
      renderCell: (h) => (
        <td key="note" className="py-3 px-3 text-slate-500 truncate" title={h.GHI_CHU}>
          {h.GHI_CHU}
        </td>
      )
    }
  };

  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const renderAuditLogModal = () => {
    return (
      <AnimatePresence>
        {showAuditLogModal && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs z-50 transition-opacity"
              onClick={() => { setShowAuditLogModal(false); setSelectedAuditLog(null); }}
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-10 bottom-10 md:inset-x-12 md:top-14 md:bottom-14 lg:inset-x-24 bg-white rounded-3xl shadow-2xl z-55 flex flex-col overflow-hidden border border-slate-150"
            >
              {/* Header */}
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <History className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">Nhật Ký Chỉnh Sửa & Giao Dịch (Audit Log)</h3>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Lịch sử tác động tồn kho chi tiết</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAuditLogModal(false); setSelectedAuditLog(null); }}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Split Layout */}
              <div className="grow grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                {/* Left side: Log List */}
                <div className="md:col-span-5 border-r border-slate-100 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium italic">
                      Chưa ghi nhận hoạt động chỉnh sửa nào trong phiên này.
                    </div>
                  ) : (
                    auditLogs.map(log => {
                      const isSua = log.LOAI_HIEU_CHINH === 'SỬA';
                      const isThem = log.LOAI_HIEU_CHINH === 'THÊM';
                      const colorClass = isThem 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : isSua 
                          ? 'bg-blue-50 text-blue-700 border-blue-100' 
                          : 'bg-rose-50 text-rose-700 border-rose-100';
                      
                      return (
                        <div
                          key={log.id}
                          onClick={() => setSelectedAuditLog(log)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                            selectedAuditLog?.id === log.id 
                              ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                              : 'bg-white hover:bg-slate-50 border-slate-150 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-mono font-bold text-slate-500">{log.HOA_DON}</span>
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${colorClass}`}>
                              {log.LOAI_HIEU_CHINH}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-700 truncate">{log.GHI_CHU}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-semibold">
                            <span>Người tạo: {log.NGUOI_THAO_TAC}</span>
                            <span>{log.THOI_GIAN}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right side: Log Details */}
                <div className="md:col-span-7 overflow-y-auto p-6 space-y-4">
                  {selectedAuditLog ? (
                    <div className="space-y-4 text-left">
                      <div className="border-b border-slate-100 pb-3">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">Mã Nhật Ký</div>
                        <div className="font-mono font-bold text-sm text-slate-700">{selectedAuditLog.id}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-semibold">Thao tác: </span>
                          <strong className="text-slate-700">{selectedAuditLog.LOAI_HIEU_CHINH}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Thời gian: </span>
                          <strong className="text-slate-700">{selectedAuditLog.THOI_GIAN}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Người thực hiện: </span>
                          <strong className="text-slate-700">{selectedAuditLog.NGUOI_THAO_TAC}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold">Số phiếu: </span>
                          <strong className="text-slate-700">{selectedAuditLog.HOA_DON}</strong>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chi tiết sự thay đổi</div>
                        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl leading-relaxed italic">
                          {selectedAuditLog.GHI_CHU}
                        </div>
                      </div>

                      {/* Diff Comparison */}
                      <div className="space-y-4 pt-2">
                        {selectedAuditLog.DU_LIEU_TRUOC && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">Dữ liệu trước hiệu chỉnh</span>
                            <pre className="text-[10px] font-mono p-3 bg-slate-900 text-slate-100 rounded-xl max-h-56 overflow-y-auto whitespace-pre-wrap">
                              {selectedAuditLog.DU_LIEU_TRUOC}
                            </pre>
                          </div>
                        )}
                        {selectedAuditLog.DU_LIEU_SAU && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider">Dữ liệu sau hiệu chỉnh</span>
                            <pre className="text-[10px] font-mono p-3 bg-slate-900 text-slate-100 rounded-xl max-h-56 overflow-y-auto whitespace-pre-wrap">
                              {selectedAuditLog.DU_LIEU_SAU}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <History className="w-12 h-12 text-slate-200" />
                      <p className="text-xs font-medium italic">Chọn một dòng nhật ký ở bên trái để xem so sánh dữ liệu trước và sau.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const renderVoucherForm = () => {
    const isEdit = isEditingInvoice;
    const title = isEdit ? `Chỉnh Sửa Phiếu: ${formInvoiceId}` : `Lập Phiếu Mới: ${createInvoiceType.replace('_', ' ')}`;
    
    return (
      <div className="space-y-6 max-w-5xl mx-auto bg-white p-6 rounded-3xl border border-slate-100 shadow-sm animate-fade-in text-left">
        {/* Form Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setIsEditingInvoice(false); setIsCreatingInvoice(false); }}
              className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">{title}</h2>
              <p className="text-[11px] text-slate-500 font-semibold">
                {isEdit ? 'Chỉnh sửa chi tiết phiếu và tự động cập nhật lại tồn kho' : 'Tạo mới phiếu nhập/xuất và đồng bộ hóa tức thì'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setIsEditingInvoice(false); setIsCreatingInvoice(false); }}
              className="px-4 py-2 text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-600 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              onClick={isEdit ? handleSaveInvoiceChanges : handleCreateInvoiceSubmit}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-extrabold bg-red-650 hover:bg-red-700 text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Lưu Phiếu
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 animate-fade-in">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Header Metadata Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chi nhánh thực hiện</label>
            <select
              value={formBranch}
              onChange={(e) => setFormBranch(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            >
              {(chiNhanhs.length > 0 ? chiNhanhs : uniqueBranches).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày chứng từ</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú chung</label>
            <input
              type="text"
              placeholder="Nhập ghi chú tổng quát..."
              value={formGhiChu}
              onChange={(e) => setFormGhiChu(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Item Adder Tool */}
        <div className="p-4 bg-indigo-50/20 border border-indigo-100/50 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
            <Plus className="w-4 h-4 text-indigo-500" /> Bổ Sung Tròng Kính Vào Danh Sách
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5 space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Chọn Tròng Kính (SKU)</label>
              <select
                value={editorSearchSku}
                onChange={(e) => setEditorSearchSku(e.target.value)}
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
              >
                <option value="">-- Chọn tròng kính từ danh mục --</option>
                {sanPhams.map(p => (
                  <option key={p.SKU} value={p.SKU}>
                    [{p.SKU}] {p.TEN_SAN_PHAM} (Kho: {p.TON_CUOI})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Số lượng</label>
              <input
                type="number"
                min="1"
                value={editorAddQty}
                onChange={(e) => setEditorAddQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú dòng</label>
              <input
                type="text"
                placeholder="Ví dụ: Giao gấp..."
                value={editorAddGhiChu}
                onChange={(e) => setEditorAddGhiChu(e.target.value)}
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleEditorAddItem}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                Bổ Sung +
              </button>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-slate-100">
                <th className="py-2.5 px-4">Thông tin Tròng Kính (SKU)</th>
                <th className="py-2.5 px-4 w-32">Độ Cầu/Loạn</th>
                <th className="py-2.5 px-4 w-32 text-center">Số lượng</th>
                <th className="py-2.5 px-4">Ghi chú mặt hàng</th>
                <th className="py-2.5 px-4 w-16 text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium italic">
                    Danh sách trống. Hãy chọn và bổ sung tròng kính phía trên.
                  </td>
                </tr>
              ) : (
                formItems.map((item, index) => (
                  <tr key={item.ID || `${item.SKU}-${index}`} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-700">{item.TEN_SP}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                        SKU: {item.SKU} | {item.THUONG_HIEU} | {item.CHIET_XUAT}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 font-semibold">
                      SPH: {formatDop(item.SPH)}<br/>
                      CYL: {formatDop(item.CYL)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateItemQtyInForm(item.SKU, Math.max(1, item.SO_LUONG - 1))}
                          className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 font-bold hover:bg-slate-50 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.SO_LUONG}
                          onChange={(e) => updateItemQtyInForm(item.SKU, Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-16 text-center font-mono font-bold text-xs border border-slate-200 rounded py-1"
                        />
                        <button
                          type="button"
                          onClick={() => updateItemQtyInForm(item.SKU, item.SO_LUONG + 1)}
                          className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 font-bold hover:bg-slate-50 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={item.GHI_CHU || ''}
                        onChange={(e) => updateItemNoteInForm(item.SKU, e.target.value)}
                        placeholder="Nhập ghi chú chi tiết..."
                        className="w-full border-b border-slate-100 hover:border-slate-300 focus:border-indigo-500 py-1 focus:outline-hidden text-xs text-slate-600 font-semibold"
                      />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemFromForm(item.SKU)}
                        className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isEditingInvoice || isCreatingInvoice) {
    return (
      <div className="space-y-6">
        {renderVoucherForm()}
        {renderAuditLogModal()}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* HEADER TAB LỊCH SỬ VỚI CÁC CHỨC NĂNG THÊM PHIẾU CHUYÊN NGHIỆP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150 shadow-2xs">
        <div className="text-left col-span-2">
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-red-650" />
            Lịch sử & Quản lý Phiếu Nhập Xuất Kho
          </h2>
          <p className="text-[11px] text-slate-500 font-semibold leading-normal">
            Tra cứu, lập mới, chỉnh sửa, hủy phiếu và tự động cập nhật tồn kho an toàn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser.writeAccess !== false && (
            <div className="relative group">
              <button className="flex items-center gap-1.5 bg-red-650 hover:bg-red-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer">
                <Plus className="w-4 h-4" />
                Lập Phiếu Mới
              </button>
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-150 rounded-xl shadow-lg hidden group-hover:block hover:block z-45 py-1.5">
                <button
                  onClick={() => handleStartCreateInvoice('NHẬP')}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Phiếu Nhập Hàng (PN)
                </button>
                <button
                  onClick={() => handleStartCreateInvoice('XUẤT')}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Phiếu Xuất Hàng (PX)
                </button>
                <button
                  onClick={() => handleStartCreateInvoice('NHẬP_KIEM_KHO')}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Phiếu Nhập Kiểm Kho (PNK)
                </button>
                <button
                  onClick={() => handleStartCreateInvoice('XUAT_KIEM_KHO')}
                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Phiếu Xuất Kiểm Kho (PXK)
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowAuditLogModal(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 font-extrabold text-xs py-2 px-4 rounded-xl shadow-2xs transition-all cursor-pointer"
          >
            <History className="w-4 h-4 text-slate-400" />
            Nhật Ký Chỉnh Sửa ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* 1. KHU VỰC BỘ LỌC VÀ TÌM KIẾM PHIẾU */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs space-y-4">
        
        {/* Row 1: Tìm kiếm nhanh & Loại phiếu */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Tìm kiếm nhanh */}
          <div className="relative w-full lg:w-80">
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

          {/* Lọc loại phiếu */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto">
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
        </div>

        {/* Row 2: Bộ lọc chi tiết (Chi nhánh, Kho, Từ ngày, Đến ngày) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100/60">
          {/* Chi nhánh */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chi nhánh</label>
            <select
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setSelectedInvoice(null); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus:outline-hidden focus:border-red-200 transition-colors"
            >
              <option value="Tất cả">Tất cả chi nhánh</option>
              {uniqueBranches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Kho */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kho</label>
            <select
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setSelectedInvoice(null); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus:outline-hidden focus:border-red-200 transition-colors"
            >
              <option value="Tất cả">Tất cả kho</option>
              {uniqueBranches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Từ ngày */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setSelectedInvoice(null); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus:outline-hidden focus:border-red-200 transition-colors font-mono"
            />
          </div>

          {/* Đến ngày */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setSelectedInvoice(null); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 focus:outline-hidden focus:border-red-200 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Row 3: Các tác vụ bổ sung (Gộp nhóm, Sắp xếp cột, Reset) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Reset Filters */}
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 py-2 px-3 text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-150 text-slate-600 hover:text-slate-800 rounded-xl transition-all cursor-pointer"
              title="Xóa bộ lọc"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>

            {/* Group by Date Button */}
            <button
              onClick={() => setIsGroupedByDate(!isGroupedByDate)}
              className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                isGroupedByDate 
                  ? 'bg-red-50 text-red-650 border-red-200' 
                  : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-150'
              }`}
              title="Gộp các phiếu theo ngày tạo"
            >
              <Calendar className="w-3.5 h-3.5" />
              {isGroupedByDate ? 'Bỏ gộp nhóm' : 'Gộp nhóm theo ngày'}
            </button>
          </div>

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
              Sắp xếp & Ẩn hiện cột
            </button>

            <AnimatePresence>
              {showColumnChooser && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowColumnChooser(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-2 w-64 bg-white border border-slate-150 rounded-xl shadow-lg z-40 p-3 space-y-2 text-xs"
                  >
                    <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-1.5 mb-1.5 uppercase tracking-wider text-[9px] flex justify-between items-center">
                      <span>Cấu hình cột hiển thị</span>
                      <span className="text-[8px] text-slate-400 normal-case font-medium">Bấm ↑ ↓ để xếp lại</span>
                    </h4>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {columnOrder.map((colKey, index) => {
                        const colDef = colDefinitions[colKey];
                        if (!colDef) return null;
                        return (
                          <div key={colKey} className="flex items-center justify-between p-1 hover:bg-slate-50 rounded-lg gap-2">
                            <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-600 hover:text-slate-800 grow truncate">
                              <input 
                                type="checkbox" 
                                checked={visibleColumns[colKey] !== false}
                                onChange={() => toggleColumnVisibility(colKey)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                              />
                              <span className="truncate">{colDef.label}</span>
                            </label>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                disabled={index === 0}
                                onClick={() => handleMoveColumn(index, 'up')}
                                className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded transition-all cursor-pointer"
                                title="Di chuyển lên trước"
                              >
                                ▲
                              </button>
                              <button
                                disabled={index === columnOrder.length - 1}
                                onClick={() => handleMoveColumn(index, 'down')}
                                className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded transition-all cursor-pointer"
                                title="Di chuyển ra sau"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
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

          {/* TABLE RENDER (RESIZABLE & FIXED STICKY COLUMNS & GROUPING BY DATE) */}
          <div className="overflow-y-auto max-h-[600px] bg-slate-50/25">
            {filteredInvoices.length > 0 ? (
              isGroupedByDate ? (
                <div className="space-y-4 p-4">
                  {groupedInvoicesByDate.map(({ dateStr, invoices }) => {
                    const isExpanded = expandedDates[dateStr] !== false;
                    const totalInvoices = invoices.length;
                    const totalQty = invoices.reduce((sum, h) => sum + h.TONG_SL, 0);

                    // Format date to local standard DD/MM/YYYY
                    const parts = dateStr.split('-');
                    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;

                    return (
                      <div key={dateStr} className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          onClick={() => setExpandedDates(prev => ({ ...prev, [dateStr]: !isExpanded }))}
                          className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 px-4 py-3 border-b border-slate-150 transition-all text-xs font-bold text-slate-700 cursor-pointer text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-blue-600 font-extrabold text-xs font-mono">📅 Ngày {formattedDate}</span>
                            <span className="bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full text-[10px]">
                              {totalInvoices} phiếu
                            </span>
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-full text-[10px]">
                              Tổng {totalQty} SP
                            </span>
                          </div>
                          <span className="text-slate-400 font-extrabold text-xs">
                            {isExpanded ? '▲ Thu gọn' : '▼ Mở rộng'}
                          </span>
                        </button>

                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table 
                              className="w-full text-left text-xs border-collapse table-layout-fixed" 
                              style={{ minWidth: tableMinWidth }}
                            >
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold select-none">
                                  {columnOrder.map(colKey => {
                                    if (visibleColumns[colKey] === false) return null;
                                    const colDef = colDefinitions[colKey];
                                    if (!colDef) return null;
                                    return colDef.renderHeader(
                                      columnWidths[colKey] || colDef.defaultWidth,
                                      (e) => handleMouseDown(colKey, e),
                                      () => handleDoubleClick(colKey, colDef.defaultWidth)
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {invoices.map((h) => {
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
                                      {columnOrder.map(colKey => {
                                        if (visibleColumns[colKey] === false) return null;
                                        const colDef = colDefinitions[colKey];
                                        if (!colDef) return null;
                                        return colDef.renderCell(h, isSelected, badgeColor);
                                      })}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table 
                    className="w-full text-left text-xs border-collapse table-layout-fixed" 
                    style={{ minWidth: tableMinWidth }}
                  >
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] uppercase font-bold select-none">
                        {columnOrder.map(colKey => {
                          if (visibleColumns[colKey] === false) return null;
                          const colDef = colDefinitions[colKey];
                          if (!colDef) return null;
                          return colDef.renderHeader(
                            columnWidths[colKey] || colDef.defaultWidth,
                            (e) => handleMouseDown(colKey, e),
                            () => handleDoubleClick(colKey, colDef.defaultWidth)
                          );
                        })}
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
                            {columnOrder.map(colKey => {
                              if (visibleColumns[colKey] === false) return null;
                              const colDef = colDefinitions[colKey];
                              if (!colDef) return null;
                              return colDef.renderCell(h, isSelected, badgeColor);
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="py-24 text-center text-xs text-slate-400 font-mono italic">
                <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                {nhapXuats.length === 0 ? "Chưa có dữ liệu" : "Không tìm thấy dữ liệu hóa đơn nào khớp bộ lọc."}
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

      {renderAuditLogModal()}

      {/* SYSTEM-WIDE ALIGNED CUSTOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-6 space-y-4 text-left">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl flex-shrink-0 ${confirmModal.isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                      {confirmModal.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      {confirmModal.message}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      if (confirmModal.onCancel) confirmModal.onCancel();
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {confirmModal.cancelText || 'Hủy bỏ'}
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                      confirmModal.isDanger
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-xs'
                        : 'bg-blue-600 hover:bg-blue-700 shadow-xs'
                    }`}
                  >
                    {confirmModal.confirmText || 'Xác nhận'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SYSTEM-WIDE ALIGNED CUSTOM TOAST FOR TRANSACTION HISTORY */}
      <AnimatePresence>
        {historyToast && historyToast.show && (
          <div className="fixed top-5 right-5 z-[9999] p-4 max-w-sm w-full pointer-events-none">
            <motion.div
              key={historyToast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => setHistoryToast(null)}
              className={`relative w-full bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 pointer-events-auto border cursor-pointer select-none transition-all duration-200 hover:bg-slate-900 ${
                historyToast.type === 'error'
                  ? 'border-rose-500/30 shadow-rose-500/5'
                  : 'border-emerald-500/30 shadow-emerald-500/5'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {historyToast.type === 'error' ? (
                  <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                    <Check className="w-5 h-5" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 pr-6 text-left">
                <h4 className="font-bold text-sm text-slate-100">
                  {historyToast.type === 'error' ? 'Thao tác thất bại' : 'Thành công'}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
                  {historyToast.message}
                </p>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setHistoryToast(null);
                }}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
