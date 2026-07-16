/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  Download, 
  FileCheck, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Copy, 
  Edit2, 
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Sliders
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { SanPham, NhapXuat, NhapXuatCT } from '../types';
import { 
  Template, 
  ColumnMapping,
  arrayBufferToBase64,
} from '../utils/exportEngine';
import { 
  syncExportTemplate, 
  deleteExportTemplate, 
  fetchExportTemplates, 
} from '../supabaseSync';

interface DataField {
  key: string;
  label: string;
  description?: string;
}

const FIELDS_BY_SOURCE: Record<string, DataField[]> = {
  PHIEU: [
    { key: 'STT', label: 'Số thứ tự (STT)' },
    { key: 'HOA_DON', label: 'Mã phiếu (HOA_DON)' },
    { key: 'NGAY', label: 'Ngày chứng từ (NGAY)' },
    { key: 'CHI_NHANH', label: 'Chi nhánh (CHI_NHANH)' },
    { key: 'KHO', label: 'Kho hàng (KHO)' },
    { key: 'TEN_NGUOI_TAO', label: 'Người lập (TEN_NGUOI_TAO)' },
    { key: 'LOAI', label: 'Loại phiếu (LOAI)' },
    { key: 'SKU', label: 'Mã SKU (SKU)' },
    { key: 'TEN_SP', label: 'Tên sản phẩm (TEN_SP)' },
    { key: 'THUONG_HIEU', label: 'Thương hiệu (THUONG_HIEU)' },
    { key: 'TINH_NANG', label: 'Tính năng (TINH_NANG)' },
    { key: 'CHIET_XUAT', label: 'Chiết suất (CHIET_XUAT)' },
    { key: 'SPH', label: 'Độ cận SPH (SPH)' },
    { key: 'CYL', label: 'Độ loạn CYL (CYL)' },
    { key: 'SO_LUONG', label: 'Số lượng (SO_LUONG)' },
    { key: 'DVT', label: 'Đơn vị tính (DVT)' },
    { key: 'GHI_CHU', label: 'Ghi chú (GHI_CHU)' },
  ],
  LIC_SU: [
    { key: 'STT', label: 'Số thứ tự (STT)' },
    { key: 'HOA_DON', label: 'Số hóa đơn (HOA_DON)' },
    { key: 'NGAY', label: 'Ngày giao dịch (NGAY)' },
    { key: 'CHI_NHANH', label: 'Chi nhánh (CHI_NHANH)' },
    { key: 'LOAI', label: 'Loại giao dịch (LOAI)' },
    { key: 'TEN_NGUOI_TAO', label: 'Người thực hiện (TEN_NGUOI_TAO)' },
    { key: 'SKU', label: 'Mã SKU (SKU)' },
    { key: 'TEN_SP', label: 'Tên sản phẩm (TEN_SP)' },
    { key: 'THUONG_HIEU', label: 'Thương hiệu (THUONG_HIEU)' },
    { key: 'CHIET_XUAT', label: 'Chiết suất (CHIET_XUAT)' },
    { key: 'TINH_NANG', label: 'Tính năng (TINH_NANG)' },
    { key: 'SPH', label: 'Độ cầu SPH (SPH)' },
    { key: 'CYL', label: 'Độ loạn CYL (CYL)' },
    { key: 'SO_LUONG', label: 'Số lượng (SO_LUONG)' },
    { key: 'DVT', label: 'Đơn vị tính (DVT)' },
    { key: 'GHI_CHU', label: 'Ghi chú (GHI_CHU)' },
    { key: 'TON_DAU', label: 'Tồn đầu kỳ (TON_DAU)' },
    { key: 'TON_CUOI', label: 'Tồn cuối kỳ (TON_CUOI)' },
  ],
  DASHBOARD: [
    { key: 'TONG_NHAP', label: 'Tổng nhập kho (TONG_NHAP)' },
    { key: 'TONG_XUAT', label: 'Tổng xuất kho (TONG_XUAT)' },
    { key: 'TONG_TON', label: 'Tổng tồn hệ thống (TONG_TON)' },
    { key: 'THUONG_HIEU_BAN_CHAY', label: 'Thương hiệu bán chạy (THUONG_HIEU_BAN_CHAY)' },
    { key: 'CHIET_SUAT_BAN_CHAY', label: 'Chiết suất bán chạy (CHIET_SUAT_BAN_CHAY)' },
    { key: 'TINH_NANG_BAN_CHAY', label: 'Tính năng bán chạy (TINH_NANG_BAN_CHAY)' },
    { key: 'DO_BAN_CHAY', label: 'Độ bán chạy (DO_BAN_CHAY)' },
    { key: 'TOP_CHI_NHANH', label: 'Chi nhánh bán chạy nhất (TOP_CHI_NHANH)' },
    { key: 'TONG_SKU', label: 'Tổng số lượng SKU (TONG_SKU)' },
    { key: 'TONG_CHUNG_TU', label: 'Tổng số chứng từ (TONG_CHUNG_TU)' },
    { key: 'TU_NGAY', label: 'Bộ lọc Từ ngày (TU_NGAY)' },
    { key: 'DEN_NGAY', label: 'Bộ lọc Đến ngày (DEN_NGAY)' },
    { key: 'LOC_CHI_NHANH', label: 'Bộ lọc Chi nhánh (LOC_CHI_NHANH)' },
  ],
  KIEM_KHO: [
    { key: 'STT', label: 'Số thứ tự (STT)' },
    { key: 'MA_PHIEU', label: 'Mã phiếu kiểm (MA_PHIEU)' },
    { key: 'SKU', label: 'Mã SKU (SKU)' },
    { key: 'TEN_SP', label: 'Tên tròng kính (TEN_SP)' },
    { key: 'TON_HE_THONG', label: 'Tồn hệ thống (TON_HE_THONG)' },
    { key: 'TON_THUC_TE', label: 'Tồn thực tế (TON_THUC_TE)' },
    { key: 'LECH', label: 'Chênh lệch lệch (LECH)' },
    { key: 'LOAI_BU', label: 'Loại bù trừ (LOAI_BU)' },
    { key: 'NGUOI_KIEM', label: 'Người kiểm kê (NGUOI_KIEM)' },
    { key: 'THOI_DIEM', label: 'Thời điểm (THOI_DIEM)' },
    { key: 'KHO', label: 'Kho thực hiện (KHO)' },
  ],
  SAN_PHAM: [
    { key: 'STT', label: 'Số thứ tự (STT)' },
    { key: 'SKU', label: 'Mã SKU (SKU)' },
    { key: 'TEN_SAN_PHAM', label: 'Tên đầy đủ (TEN_SAN_PHAM)' },
    { key: 'THUONG_HIEU', label: 'Thương hiệu (THUONG_HIEU)' },
    { key: 'CHIET_XUAT', label: 'Chiết suất (CHIET_XUAT)' },
    { key: 'TINH_NANG', label: 'Tính năng (TINH_NANG)' },
    { key: 'CAN', label: 'Độ cận SPH (CAN)' },
    { key: 'LOAN', label: 'Độ loạn CYL (LOAN)' },
    { key: 'DVT', label: 'Đơn vị tính (DVT)' },
    { key: 'TON_DAU', label: 'Tồn đầu kỳ (TON_DAU)' },
    { key: 'NHAP', label: 'Số lượng nhập (NHAP)' },
    { key: 'XUAT', label: 'Số lượng xuất (XUAT)' },
    { key: 'TON_CUOI', label: 'Tồn cuối kỳ (TON_CUOI)' },
    { key: 'TON_TOI_THIEU', label: 'Mức tối thiểu (TON_TOI_THIEU)' },
  ],
  BANG_DO: [
    { key: 'STT', label: 'Số thứ tự (STT)' },
    { key: 'CAN', label: 'Độ cận SPH (CAN)' },
    { key: 'LOAN', label: 'Độ loạn CYL (LOAN)' },
    { key: 'SKU', label: 'Mã SKU (SKU)' },
    { key: 'TEN_SAN_PHAM', label: 'Tên tròng kính (TEN_SAN_PHAM)' },
    { key: 'THUONG_HIEU', label: 'Thương hiệu (THUONG_HIEU)' },
    { key: 'TON_CUOI', label: 'Tồn kho thực tế (TON_CUOI)' },
  ]
};

interface TemplateExportManagerProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  chiNhanhs: string[];
}

export default function TemplateExportManager({
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  chiNhanhs
}: TemplateExportManagerProps) {
  // --- STATE QUẢN LÝ ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cấu hình mẫu hiện tại
  const [selectedSource, setSelectedSource] = useState<string>('PHIEU');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [expandedPivotPlaceholder, setExpandedPivotPlaceholder] = useState<string | null>(null);
  const [newManualPlaceholder, setNewManualPlaceholder] = useState<string>('');

  // Tên & mô tả chỉnh sửa trực tiếp cho mẫu đang chọn
  const [editingName, setEditingName] = useState<string>('');
  const [editingDesc, setEditingDesc] = useState<string>('');
  const [editingStartRow, setEditingStartRow] = useState<number>(10);

  // Tải danh sách mẫu từ cơ sở dữ liệu
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const dbTemplates = await fetchExportTemplates();
        let finalTemplates: Template[] = [];
        
        if (dbTemplates && dbTemplates.length > 0) {
          finalTemplates = dbTemplates.map(t => ({
            ...t,
            applicableReportTypes: t.applicableReportTypes || [],
            columnMappings: t.columnMappings || [],
            groupByFields: t.groupByFields || []
          }));
          setTemplates(finalTemplates);
          localStorage.setItem('export_templates', JSON.stringify(finalTemplates));
        } else {
          const savedTemplates = localStorage.getItem('export_templates');
          if (savedTemplates) {
            finalTemplates = JSON.parse(savedTemplates);
          } else {
            // Danh sách mẫu mặc định ban đầu
            finalTemplates = [
              {
                id: 'default-phieu-xuat-excel',
                name: 'Mẫu xuất kho tròng kính',
                type: 'EXCEL',
                fileName: 'Mau_Phieu_Xuat_Kho_Mac_Dinh.xlsx',
                fileData: 'PRESET',
                isDefault: true,
                detectedPlaceholders: ['HOA_DON', 'NGAY', 'CHI_NHANH', 'TEN_NGUOI_TAO', 'TONG_NHAP', 'TONG_XUAT', 'SKU', 'TEN_SP', 'SO_LUONG', 'DVT', 'LOAI'],
                description: 'Biểu mẫu phục vụ xuất dữ liệu phiếu kho chi tiết, thống kê số lượng.',
                createdAt: new Date().toISOString(),
                applicableReportTypes: ['PHIEU'],
                columnMappings: [
                  { excelColumn: 'A', dataField: 'STT', label: 'Số thứ tự', isPivot: false },
                  { excelColumn: 'B', dataField: 'HOA_DON', label: 'Số phiếu', isPivot: false },
                  { excelColumn: 'C', dataField: 'NGAY', label: 'Ngày chứng từ', isPivot: false },
                  { excelColumn: 'D', dataField: 'SKU', label: 'Mã SKU', isPivot: false },
                  { excelColumn: 'E', dataField: 'TEN_SP', label: 'Tên sản phẩm', isPivot: false },
                  { excelColumn: 'F', dataField: 'SO_LUONG', label: 'Số lượng', isPivot: false }
                ],
                groupByFields: ['STT', 'HOA_DON', 'NGAY', 'SKU', 'TEN_SP', 'SO_LUONG'],
                startRow: 10
              },
              {
                id: 'default-dashboard-excel',
                name: 'Báo cáo Dashboard Tổng hợp',
                type: 'EXCEL',
                fileName: 'Bao_Cao_Tong_Hop_Dashboard_Mau.xlsx',
                fileData: 'PRESET_DASHBOARD',
                isDefault: false,
                detectedPlaceholders: ['TONG_TON', 'TONG_XUAT', 'THUONG_HIEU_BAN_CHAY', 'DO_BAN_CHAY', 'TOP_CHI_NHANH', 'TU_NGAY', 'DEN_NGAY', 'LOC_CHI_NHANH'],
                description: 'Biểu mẫu tổng hợp các chỉ số hoạt động kinh doanh toàn diện.',
                createdAt: new Date().toISOString(),
                applicableReportTypes: ['DASHBOARD'],
                columnMappings: [
                  { excelColumn: 'TONG_TON', dataField: 'TONG_TON', label: 'Tổng tồn kho', isPivot: false },
                  { excelColumn: 'TONG_XUAT', dataField: 'TONG_XUAT', label: 'Tổng xuất', isPivot: false },
                  { excelColumn: 'THUONG_HIEU_BAN_CHAY', dataField: 'THUONG_HIEU_BAN_CHAY', label: 'Thương hiệu bán chạy', isPivot: false }
                ],
                groupByFields: ['TONG_TON', 'TONG_XUAT', 'THUONG_HIEU_BAN_CHAY'],
                startRow: 4
              }
            ];
          }
          setTemplates(finalTemplates);
          localStorage.setItem('export_templates', JSON.stringify(finalTemplates));
          for (const t of finalTemplates) {
            await syncExportTemplate(t);
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải cấu hình mẫu từ DB:', err);
      }
    };
    loadFromDb();
  }, []);

  // Lấy template hoạt động hiện tại
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.isDefault) || templates[0];
  }, [templates, selectedTemplateId]);

  useEffect(() => {
    if (activeTemplate && !selectedTemplateId) {
      setSelectedTemplateId(activeTemplate.id);
    }
  }, [activeTemplate, selectedTemplateId]);

  // Nạp dữ liệu cấu hình khi template thay đổi
  useEffect(() => {
    if (activeTemplate) {
      setEditingName(activeTemplate.name);
      setEditingDesc(activeTemplate.description || '');
      setEditingStartRow(activeTemplate.startRow || 10);

      const source = activeTemplate.applicableReportTypes?.[0] || 'PHIEU';
      setSelectedSource(source);

      const savedFields = activeTemplate.groupByFields || [];
      if (savedFields.length > 0) {
        setSelectedFields(savedFields);
      } else {
        const available = FIELDS_BY_SOURCE[source] || [];
        setSelectedFields(available.map(f => f.key));
      }

      const detected = activeTemplate.detectedPlaceholders || [];
      const availableFields = FIELDS_BY_SOURCE[source] || [];
      
      const initialMappings: ColumnMapping[] = detected.map(placeholder => {
        const saved = activeTemplate.columnMappings?.find(m => m.excelColumn === placeholder);
        if (saved) {
          return {
            ...saved,
            isPivot: saved.isPivot ?? false,
            pivotSource: saved.pivotSource || 'PHIEU',
            pivotGroupBy: saved.pivotGroupBy || [],
            pivotAggregation: saved.pivotAggregation || 'SUM_SO_LUONG',
            pivotFilters: saved.pivotFilters || []
          };
        }
        const directMatch = availableFields.find(f => f.key === placeholder || f.key.toUpperCase() === placeholder.toUpperCase());
        return {
          excelColumn: placeholder,
          dataField: directMatch ? directMatch.key : '',
          label: directMatch ? directMatch.label : placeholder,
          isPivot: false,
          pivotSource: 'PHIEU',
          pivotGroupBy: [],
          pivotAggregation: 'SUM_SO_LUONG',
          pivotFilters: []
        };
      });
      setColumnMappings(initialMappings);
    }
  }, [activeTemplate]);

  // Thay đổi nguồn dữ liệu chính
  const handleSourceChange = (source: string) => {
    setSelectedSource(source);
    const available = FIELDS_BY_SOURCE[source] || [];
    setSelectedFields(available.map(f => f.key));

    setColumnMappings(prev => prev.map(m => {
      if (m.isPivot) return m;
      const match = available.find(f => f.key === m.excelColumn || f.key.toUpperCase() === m.excelColumn.toUpperCase());
      return {
        ...m,
        dataField: match ? match.key : ''
      };
    }));
  };

  // Thêm/bớt trường dữ liệu
  const handleToggleField = (fieldKey: string) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldKey)) {
        return prev.filter(k => k !== fieldKey);
      } else {
        return [...prev, fieldKey];
      }
    });
  };

  // Cập nhật ánh xạ field cho placeholder đơn lẻ
  const handleMapPlaceholder = (placeholder: string, fieldKey: string) => {
    setColumnMappings(prev => prev.map(m => {
      if (m.excelColumn === placeholder) {
        return {
          ...m,
          dataField: fieldKey,
          isPivot: false
        };
      }
      return m;
    }));
  };

  // Cập nhật các trường Pivot của Placeholder cụ thể
  const handleUpdatePivotConfig = (placeholder: string, updates: Partial<ColumnMapping>) => {
    setColumnMappings(prev => prev.map(m => {
      if (m.excelColumn === placeholder) {
        return {
          ...m,
          ...updates
        };
      }
      return m;
    }));
  };

  // Thêm placeholder thủ công
  const handleAddManualPlaceholder = () => {
    const clean = newManualPlaceholder.trim().toUpperCase().replace(/[{}]/g, '');
    if (!clean) return;
    if (columnMappings.some(m => m.excelColumn === clean)) {
      setErrorMessage(`❌ Placeholder {{${clean}}} đã tồn tại!`);
      return;
    }
    const newMapping: ColumnMapping = {
      excelColumn: clean,
      dataField: '',
      label: clean,
      isPivot: false,
      pivotSource: 'PHIEU',
      pivotGroupBy: [],
      pivotAggregation: 'SUM_SO_LUONG',
      pivotFilters: []
    };
    setColumnMappings(prev => [...prev, newMapping]);
    setNewManualPlaceholder('');
    setSuccessMessage(`➕ Đã thêm placeholder thủ công {{${clean}}}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Xóa placeholder khỏi cấu hình
  const handleRemovePlaceholder = (placeholder: string) => {
    setColumnMappings(prev => prev.filter(m => m.excelColumn !== placeholder));
    setSuccessMessage(`🗑️ Đã xóa placeholder {{${placeholder}}}`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Đặt làm mặc định
  const handleSetDefaultTemplate = async (id: string) => {
    const next = templates.map(t => ({ ...t, isDefault: t.id === id }));
    setTemplates(next);
    localStorage.setItem('export_templates', JSON.stringify(next));
    setSuccessMessage(`⭐ Đã đặt mẫu "${templates.find(t => t.id === id)?.name}" làm mặc định thành công.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    for (const t of next) {
      await syncExportTemplate(t);
    }
  };

  // Sao chép mẫu biểu
  const handleCopyTemplate = async (template: Template) => {
    const newId = `temp-copy-${Date.now()}`;
    const newCopy: Template = {
      ...template,
      id: newId,
      name: `${template.name} (Bản sao)`,
      isDefault: false,
      createdAt: new Date().toISOString()
    };
    const next = [...templates, newCopy];
    setTemplates(next);
    setSelectedTemplateId(newId);
    localStorage.setItem('export_templates', JSON.stringify(next));
    setSuccessMessage(`📋 Đã sao chép mẫu biểu "${template.name}" thành công.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    await syncExportTemplate(newCopy);
  };

  // Xóa mẫu biểu
  const handleDeleteTemplate = async (id: string) => {
    if (id.startsWith('default-')) {
      setErrorMessage('❌ Không thể xóa mẫu mặc định của hệ thống!');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const next = templates.filter(t => t.id !== id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(next[0]?.id || '');
    }
    setTemplates(next);
    localStorage.setItem('export_templates', JSON.stringify(next));
    setSuccessMessage(`🗑️ Đã xóa mẫu biểu thành công.`);
    setTimeout(() => setSuccessMessage(null), 3000);
    await deleteExportTemplate(id);
  };

  // Lưu cấu hình mẫu
  const handleSaveConfig = async () => {
    if (!activeTemplate) return;

    const updated: Template = {
      ...activeTemplate,
      name: editingName,
      description: editingDesc,
      startRow: editingStartRow,
      applicableReportTypes: [selectedSource],
      groupByFields: selectedFields,
      columnMappings: columnMappings,
      detectedPlaceholders: columnMappings.map(m => m.excelColumn)
    };

    const nextTemplates = templates.map(t => t.id === updated.id ? updated : t);
    setTemplates(nextTemplates);
    localStorage.setItem('export_templates', JSON.stringify(nextTemplates));
    setSuccessMessage(`💾 Đã cập nhật thành công cấu hình & ánh xạ mẫu "${updated.name}"!`);
    setTimeout(() => setSuccessMessage(null), 4000);

    try {
      await syncExportTemplate(updated);
    } catch (err) {
      console.error(err);
      setErrorMessage('Lỗi đồng bộ cấu hình mẫu lên server.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Xử lý upload file mẫu mới
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = async (file: File) => {
    setIsParsing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isExcel = file.name.endsWith('.xlsx');
    const isPdf = file.name.endsWith('.pdf');

    if (!isExcel && !isPdf) {
      setErrorMessage('❌ Định dạng không hợp lệ! Vui lòng chỉ tải lên file Excel (.xlsx) hoặc PDF (.pdf).');
      setIsParsing(false);
      return;
    }

    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const placeholders: string[] = [];

          if (isExcel) {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);
            
            workbook.eachSheet((worksheet) => {
              worksheet.eachRow((row) => {
                row.eachCell((cell) => {
                  if (cell.value && typeof cell.value === 'string') {
                    const matches = cell.value.match(/{{([^{}]+)}}/g);
                    if (matches) {
                      matches.forEach(m => {
                        const clean = m.replace(/[{}]/g, '').trim();
                        if (!placeholders.includes(clean)) {
                          placeholders.push(clean);
                        }
                      });
                    }
                  }
                });
              });
            });
          } else {
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            fields.forEach(f => {
              const name = f.getName();
              if (!placeholders.includes(name)) {
                placeholders.push(name);
              }
            });
          }

          if (placeholders.length === 0) {
            placeholders.push('HOA_DON', 'NGAY', 'CHI_NHANH', 'SKU', 'TEN_SP', 'SO_LUONG', 'DVT');
          }

          const base64Data = arrayBufferToBase64(arrayBuffer);

          const newTemplate: Template = {
            id: `temp-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            type: isExcel ? 'EXCEL' : 'PDF',
            fileName: file.name,
            fileData: base64Data,
            isDefault: templates.length === 0,
            detectedPlaceholders: placeholders,
            description: `Mẫu nhập ngày ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString(),
            applicableReportTypes: [selectedSource],
            groupByFields: selectedFields,
            startRow: 10,
            columnMappings: placeholders.map(p => ({
              excelColumn: p,
              dataField: '',
              label: p
            }))
          };

          const nextList = [...templates, newTemplate];
          setTemplates(nextList);
          localStorage.setItem('export_templates', JSON.stringify(nextList));
          setSelectedTemplateId(newTemplate.id);
          
          await syncExportTemplate(newTemplate);
          setSuccessMessage(`🎉 Đã tải lên file mẫu "${file.name}" thành công! Hệ thống tự động phân tích và ghi nhận ${placeholders.length} placeholder.`);
        } catch (err) {
          console.error(err);
          setErrorMessage('❌ Lỗi phân tích file mẫu. Đảm bảo file Excel hoặc PDF đúng định dạng.');
        } finally {
          setIsParsing(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setErrorMessage('❌ Lỗi đọc tập tin.');
      setIsParsing(false);
    }
  };

  // Tạo & tải file mẫu Excel thử nghiệm cho người dùng tham khảo cấu trúc
  const handleDownloadTestTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Báo_Cáo_Tròng_Kính');

      sheet.columns = [
        { width: 8 }, { width: 28 }, { width: 38 }, { width: 14 }, { width: 12 }, { width: 16 }
      ];

      sheet.mergeCells('A2:F2');
      const c2 = sheet.getCell('A2');
      c2.value = 'BÁO CÁO KẾT XUẤT MẪU (KHO TRÒNG KÍNH)';
      c2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3B8A' } };
      c2.alignment = { horizontal: 'center' };

      sheet.getCell('A4').value = 'Báo cáo từ ngày:';
      sheet.getCell('A4').font = { bold: true };
      sheet.getCell('B4').value = '{{TU_NGAY}}';

      sheet.getCell('D4').value = 'Đến ngày:';
      sheet.getCell('D4').font = { bold: true };
      sheet.getCell('E4').value = '{{DEN_NGAY}}';

      sheet.getCell('A5').value = 'Chi nhánh lọc:';
      sheet.getCell('A5').font = { bold: true };
      sheet.getCell('B5').value = '{{LOC_CHI_NHANH}}';

      const th = sheet.getRow(7);
      th.values = ['STT', 'Mã SKU', 'Tên sản phẩm', 'Số lượng', 'ĐVT', 'Thương hiệu'];
      th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      th.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } });

      const tr = sheet.getRow(8);
      tr.values = ['{{STT}}', '{{SKU}}', '{{TEN_SP}}', '{{SO_LUONG}}', '{{DVT}}', '{{THUONG_HIEU}}'];

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Excel_Kiem_Thu_Placeholders.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSuccessMessage('📥 Tải xuống mẫu Excel thử nghiệm thành công!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMessage('❌ Lỗi tạo file mẫu thử nghiệm.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* BANNER THÔNG TIN */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl shadow-lg relative overflow-hidden border border-slate-750">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 px-3 py-1 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider">
              Thiết lập & Cài đặt mẫu biểu kết xuất
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Cấu Hình Xuất Excel & PDF</h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Trang quản lý cấu hình các tệp tin mẫu (Excel/PDF). Hãy tải lên biểu mẫu của bạn, hệ thống sẽ tự động quét các 
              placeholder dạng <code className="text-indigo-300 font-bold font-mono">{"{{PLACEHOLDER}}"}</code> và cho phép bạn ánh xạ chúng vào các trường dữ liệu hệ thống.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTestTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-98 cursor-pointer border-0 whitespace-nowrap self-start md:self-auto"
          >
            <Download className="w-4 h-4 text-slate-700" />
            Tải File Excel Mẫu Thử
          </button>
        </div>
      </div>

      {/* THÔNG BÁO TRẠNG THÁI */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs font-semibold rounded-r-xl flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-semibold rounded-r-xl flex items-center gap-2 animate-in fade-in duration-200">
          <FileCheck className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* GIAO DIỆN PHÂN CHIA CHỨC NĂNG CHÍNH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CỘT TRÁI (Lg-5): DANH SÁCH BIỂU MẪU & TẢI LÊN */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* DRAG & DROP UPLOAD */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-2xs">
            <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-500" /> Tải lên tập tin mẫu mới
            </h3>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50/10' 
                  : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 bg-slate-50 text-slate-600 rounded-full border border-slate-100">
                  <Upload className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Kéo thả file vào đây hoặc click để duyệt file</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Hỗ trợ Excel (.xlsx) & PDF (.pdf)</p>
                </div>
              </div>
            </div>

            {isParsing && (
              <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-indigo-600 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích cấu trúc placeholders...
              </div>
            )}
          </div>

          {/* DANH SÁCH MẪU ĐÃ LƯU */}
          <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-50 pb-2.5">
              <h3 className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" /> Các mẫu báo cáo đã lưu ({templates.length})
              </h3>
            </div>

            <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
              {templates.map(temp => {
                const isActive = temp.id === selectedTemplateId;
                return (
                  <div
                    key={temp.id}
                    onClick={() => setSelectedTemplateId(temp.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isActive 
                        ? 'border-indigo-500 bg-indigo-50/10 shadow-3xs' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 relative z-10">
                      <div className="flex gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          temp.type === 'EXCEL' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {temp.type === 'EXCEL' ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-800 truncate">{temp.name}</h4>
                            {temp.isDefault && (
                              <span className="bg-amber-100 text-amber-850 text-[8px] px-1.5 py-0.5 rounded-md font-bold font-mono">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{temp.fileName}</p>
                          <p className="text-[11px] text-slate-500 leading-normal mt-1 block line-clamp-2">{temp.description}</p>
                          
                          <div className="mt-2.5 flex items-center gap-1 flex-wrap">
                            <span className="text-[8px] uppercase font-bold text-slate-400">Placeholders:</span>
                            {temp.detectedPlaceholders.slice(0, 6).map(p => (
                              <span key={p} className="bg-slate-100 text-slate-600 text-[8px] font-mono px-1 rounded font-bold">
                                {p}
                              </span>
                            ))}
                            {temp.detectedPlaceholders.length > 6 && (
                              <span className="text-[8px] text-slate-400 font-bold">+{temp.detectedPlaceholders.length - 6}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleCopyTemplate(temp)}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
                          title="Sao chép nhân bản mẫu biểu này"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {!temp.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultTemplate(temp.id)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
                            title="Đặt làm mẫu biểu mặc định"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!temp.id.startsWith('default-') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(temp.id)}
                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-red-600 rounded-md transition-colors border-0 bg-transparent cursor-pointer"
                            title="Xóa mẫu biểu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI (Lg-7): CẤU HÌNH CHI TIẾT MẪU BÁO CÁO */}
        <div className="lg:col-span-7 space-y-6">
          
          {activeTemplate ? (
            <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-2xs space-y-6">
              
              {/* HEADER CẤU HÌNH */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Settings className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Cấu hình mẫu: {activeTemplate.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Thiết lập nguồn dữ liệu nghiệp vụ và sơ đồ ánh xạ</p>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold font-mono">
                  {activeTemplate.type}
                </span>
              </div>

              {/* PHẦN 1: THÔNG TIN CƠ BẢN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Tên hiển thị mẫu biểu</label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-semibold text-slate-850 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    placeholder="Nhập tên mẫu xuất..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Hàng ghi dữ liệu bắt đầu (Excel)</label>
                  <input
                    type="number"
                    min="1"
                    value={editingStartRow}
                    onChange={(e) => setEditingStartRow(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono font-bold text-slate-850 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Mô tả tóm tắt</label>
                  <textarea
                    rows={2}
                    value={editingDesc}
                    onChange={(e) => setEditingDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-850 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    placeholder="Mô tả mục đích sử dụng mẫu báo cáo này..."
                  />
                </div>
              </div>

              {/* PHẦN 2: CHỌN NGUỒN DỮ LIỆU */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Chọn nguồn dữ liệu xuất mặc định</label>
                <select
                  value={selectedSource}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-semibold text-slate-700 text-xs focus:outline-hidden cursor-pointer"
                >
                  <option value="PHIEU">Phiếu Nhập/Xuất kho</option>
                  <option value="LIC_SU">Lịch sử Nhập/Xuất tổng hợp</option>
                  <option value="DASHBOARD">Dashboard (Chỉ số tổng hợp phân tích)</option>
                  <option value="KIEM_KHO">Phiếu Kiểm kho (Thực tế lệch tồn)</option>
                  <option value="SAN_PHAM">Danh sách Sản phẩm tồn kho</option>
                  <option value="BANG_DO">Bảng Độ (Chi tiết cận / loạn / tồn)</option>
                </select>
                <p className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                  <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  Mỗi nguồn dữ liệu sẽ cung cấp một danh sách các trường dữ liệu tương ứng để chèn vào file mẫu.
                </p>
              </div>

              {/* PHẦN 3: MULTI-SELECT TRƯỜNG DỮ LIỆU */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Các trường dữ liệu được kích hoạt sử dụng</label>
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl max-h-36 overflow-y-auto grid grid-cols-2 gap-2">
                  {(FIELDS_BY_SOURCE[selectedSource] || []).map(f => {
                    const isChecked = selectedFields.includes(f.key);
                    return (
                      <label key={f.key} className="flex items-center gap-2 text-xs text-slate-650 hover:text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleField(f.key)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span className="font-semibold truncate">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* PHẦN 4: THIẾT LẬP MAPPING CHI TIẾT */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider">Bản đồ Ánh xạ Placeholders ({columnMappings.length})</label>
                    <p className="text-[10px] text-slate-400 mt-0.5">Đặt gán giá trị đơn hoặc chuyển đổi sang Bảng tổng hợp Pivot</p>
                  </div>
                  
                  {/* Thêm placeholder thủ công */}
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      placeholder="Gõ placeholder..."
                      value={newManualPlaceholder}
                      onChange={e => setNewManualPlaceholder(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] w-36 focus:outline-hidden font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualPlaceholder}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 bg-transparent border-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm nhanh
                    </button>
                  </div>
                </div>

                <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-150">
                      <tr>
                        <th className="p-3 pl-4">Placeholder</th>
                        <th className="p-3">Chế độ kết xuất & Cài đặt</th>
                        <th className="p-3 text-center w-12">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {columnMappings.map((m) => {
                        const isExpanded = expandedPivotPlaceholder === m.excelColumn;
                        return (
                          <React.Fragment key={m.excelColumn}>
                            <tr className={`hover:bg-slate-50/20 transition-colors ${m.isPivot ? 'bg-indigo-50/5' : ''}`}>
                              <td className="p-3 pl-4 font-mono font-bold text-indigo-600 align-top pt-4">
                                {`{{${m.excelColumn}}}`}
                              </td>
                              <td className="p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  {/* Toggle mode: Single Value vs Pivot Table */}
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePivotConfig(m.excelColumn, { isPivot: false })}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                                        !m.isPivot
                                          ? 'bg-slate-900 text-white border-slate-900 shadow-3xs'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Giá trị đơn
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdatePivotConfig(m.excelColumn, { isPivot: true })}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                                        m.isPivot
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-3xs'
                                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      Bảng tổng hợp (Pivot)
                                    </button>
                                  </div>

                                  {/* Quick Summary or Select box */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {m.isPivot && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedPivotPlaceholder(isExpanded ? null : m.excelColumn)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md border-0 transition-colors cursor-pointer"
                                      >
                                        <Sliders className="w-3.5 h-3.5" />
                                        Cấu hình Pivot
                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {!m.isPivot ? (
                                  <select
                                    value={m.dataField}
                                    onChange={(e) => handleMapPlaceholder(m.excelColumn, e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                                  >
                                    <option value="">-- Không ánh xạ (Bỏ qua) --</option>
                                    {(FIELDS_BY_SOURCE[selectedSource] || []).map(f => (
                                      <option key={f.key} value={f.key}>{f.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="text-[10px] bg-slate-50 text-slate-500 rounded-lg p-2 font-mono leading-relaxed border border-slate-100 space-y-0.5">
                                    <div><span className="font-bold text-slate-700">Nguồn dữ liệu:</span> {m.pivotSource === 'PHIEU' ? 'Phiếu Nhập/Xuất' : m.pivotSource === 'LIC_SU' ? 'Lịch sử tổng hợp' : m.pivotSource === 'SAN_PHAM' ? 'Sản phẩm' : m.pivotSource === 'KIEM_KHO' ? 'Kiểm kho' : 'Bảng Độ'}</div>
                                    <div><span className="font-bold text-slate-700">Gom nhóm (Group):</span> {m.pivotGroupBy && m.pivotGroupBy.length > 0 ? m.pivotGroupBy.join(', ') : <span className="text-amber-500 italic">Chưa chọn trường</span>}</div>
                                    <div><span className="font-bold text-slate-700">Tính tổng hợp (Agg):</span> {m.pivotAggregation === 'SUM_SO_LUONG' ? 'Tổng Số Lượng' : m.pivotAggregation === 'SUM_NHAP' ? 'Tổng Nhập' : m.pivotAggregation === 'SUM_XUAT' ? 'Tổng Xuất' : m.pivotAggregation === 'SUM_TON' ? 'Tổng Tồn' : m.pivotAggregation === 'COUNT_SKU' ? 'Số lượng SKU' : m.pivotAggregation === 'COUNT_CHUNG_TU' ? 'Số lượng chứng từ' : m.pivotAggregation === 'SUM_GIA_TRI_NHAP' ? 'Tổng giá trị nhập' : 'Tổng giá trị xuất'}</div>
                                    {m.pivotFilters && m.pivotFilters.length > 0 && (
                                      <div><span className="font-bold text-slate-700">Bộ lọc con:</span> {m.pivotFilters.map(f => `[${f.field} ${f.operator} ${f.value}]`).join(' & ')}</div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-center align-top pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePlaceholder(m.excelColumn)}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50 bg-transparent border-0 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>

                            {/* COLLAPSIBLE DETAILED PIVOT CONFIGURATION PANEL */}
                            {m.isPivot && isExpanded && (
                              <tr>
                                <td colSpan={3} className="bg-indigo-50/15 p-4 border-t border-b border-indigo-100/30">
                                  <div className="space-y-4 max-w-2xl mx-auto text-slate-700 animate-in slide-in-from-top duration-200">
                                    <div className="flex items-center gap-2 border-b border-indigo-100/40 pb-2">
                                      <Sliders className="w-4 h-4 text-indigo-600" />
                                      <h4 className="font-bold text-xs text-indigo-900 uppercase tracking-wider">Cấu hình Bảng tổng hợp Pivot: {m.excelColumn}</h4>
                                    </div>

                                    {/* 1. Select Pivot Source */}
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">1. Nguồn dữ liệu Pivot</label>
                                      <select
                                        value={m.pivotSource || 'PHIEU'}
                                        onChange={(e) => handleUpdatePivotConfig(m.excelColumn, { 
                                          pivotSource: e.target.value as any,
                                          pivotGroupBy: [], // Reset group by when source changes
                                          pivotSortBy: '' 
                                        })}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden cursor-pointer"
                                      >
                                        <option value="PHIEU">Phiếu Nhập/Xuất kho</option>
                                        <option value="LIC_SU">Lịch sử Nhập/Xuất tổng hợp</option>
                                        <option value="KIEM_KHO">Phiếu Kiểm kho (Thực tế lệch tồn)</option>
                                        <option value="SAN_PHAM">Danh sách Sản phẩm tồn kho</option>
                                        <option value="BANG_DO">Bảng Độ (Chi tiết cận / loạn / tồn)</option>
                                      </select>
                                    </div>

                                    {/* 2. Group By Fields (Multi-select) */}
                                    <div className="space-y-1.5">
                                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">2. Gom nhóm theo các trường (Group By)</label>
                                      <div className="p-3 bg-white border border-slate-150 rounded-xl max-h-32 overflow-y-auto grid grid-cols-2 gap-2 shadow-3xs">
                                        {(FIELDS_BY_SOURCE[m.pivotSource || 'PHIEU'] || []).filter(f => f.key !== 'STT' && f.key !== 'VALUE').map(f => {
                                          const groupFields = m.pivotGroupBy || [];
                                          const isChecked = groupFields.includes(f.key);
                                          return (
                                            <label key={f.key} className="flex items-center gap-2 text-xs text-slate-650 hover:text-slate-800 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                  const nextGroup = isChecked 
                                                    ? groupFields.filter(k => k !== f.key)
                                                    : [...groupFields, f.key];
                                                  handleUpdatePivotConfig(m.excelColumn, { pivotGroupBy: nextGroup });
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                              />
                                              <span className="font-semibold truncate">{f.label}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* 3. Aggregation Type */}
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">3. Phép toán Tổng hợp (Aggregation)</label>
                                        <select
                                          value={m.pivotAggregation || 'SUM_SO_LUONG'}
                                          onChange={(e) => handleUpdatePivotConfig(m.excelColumn, { pivotAggregation: e.target.value as any })}
                                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden cursor-pointer"
                                        >
                                          <option value="SUM_SO_LUONG">SUM (Của trường Số lượng)</option>
                                          <option value="SUM_NHAP">SUM_NHAP (Tổng lượng Nhập kho)</option>
                                          <option value="SUM_XUAT">SUM_XUAT (Tổng lượng Xuất kho)</option>
                                          <option value="SUM_TON">SUM_TON (Tổng lượng Tồn kho)</option>
                                          <option value="COUNT_SKU">COUNT (Số lượng mã SKU khác nhau)</option>
                                          <option value="COUNT_CHUNG_TU">COUNT (Số lượng mã chứng từ/phiếu)</option>
                                          <option value="SUM_GIA_TRI_NHAP">SUM_GIA_TRI_NHAP (Tổng giá trị nhập ước tính)</option>
                                          <option value="SUM_GIA_TRI_XUAT">SUM_GIA_TRI_XUAT (Tổng giá trị xuất ước tính)</option>
                                        </select>
                                      </div>

                                      {/* 4. Sorting */}
                                      <div className="space-y-1">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">4. Sắp xếp kết quả</label>
                                        <div className="flex gap-2">
                                          <select
                                            value={m.pivotSortBy || 'VALUE'}
                                            onChange={(e) => handleUpdatePivotConfig(m.excelColumn, { pivotSortBy: e.target.value })}
                                            className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-hidden cursor-pointer"
                                          >
                                            <option value="VALUE">Trường Kết quả (VALUE)</option>
                                            {(m.pivotGroupBy || []).map(g => (
                                              <option key={g} value={g}>{g}</option>
                                            ))}
                                          </select>
                                          <select
                                            value={m.pivotSortOrder || 'DESC'}
                                            onChange={(e) => handleUpdatePivotConfig(m.excelColumn, { pivotSortOrder: e.target.value as any })}
                                            className="w-1/2 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-hidden cursor-pointer"
                                          >
                                            <option value="DESC">Giảm dần (Z-A)</option>
                                            <option value="ASC">Tăng dần (A-Z)</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>

                                    {/* 5. Subset Filters (Pivot filters) */}
                                    <div className="space-y-2 border-t border-indigo-100/20 pt-3">
                                      <div className="flex items-center justify-between">
                                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                                          <Filter className="w-3.5 h-3.5 text-indigo-500" />
                                          5. Các bộ lọc con bổ sung (Filters)
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const filters = m.pivotFilters || [];
                                            const available = FIELDS_BY_SOURCE[m.pivotSource || 'PHIEU'] || [];
                                            const field = available[0]?.key || 'SKU';
                                            const updatedFilters = [...filters, { field, operator: 'EQUALS' as const, value: '' }];
                                            handleUpdatePivotConfig(m.excelColumn, { pivotFilters: updatedFilters });
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 border-0 bg-transparent cursor-pointer"
                                        >
                                          <Plus className="w-3 h-3" /> Thêm bộ lọc
                                        </button>
                                      </div>

                                      {(!m.pivotFilters || m.pivotFilters.length === 0) ? (
                                        <div className="text-[10px] text-slate-400 italic">Chưa có bộ lọc con nào được thêm (Lọc theo bộ lọc vĩ mô từ Dashboard)</div>
                                      ) : (
                                        <div className="space-y-2">
                                          {m.pivotFilters.map((f, fIdx) => (
                                            <div key={fIdx} className="flex items-center gap-2 bg-white p-2 border border-slate-150 rounded-lg shadow-3xs">
                                              <select
                                                value={f.field}
                                                onChange={(e) => {
                                                  const next = [...(m.pivotFilters || [])];
                                                  next[fIdx].field = e.target.value;
                                                  handleUpdatePivotConfig(m.excelColumn, { pivotFilters: next });
                                                }}
                                                className="w-1/3 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] focus:outline-hidden cursor-pointer"
                                              >
                                                {(FIELDS_BY_SOURCE[m.pivotSource || 'PHIEU'] || []).map(fieldOpt => (
                                                  <option key={fieldOpt.key} value={fieldOpt.key}>{fieldOpt.label}</option>
                                                ))}
                                              </select>

                                              <select
                                                value={f.operator}
                                                onChange={(e) => {
                                                  const next = [...(m.pivotFilters || [])];
                                                  next[fIdx].operator = e.target.value as any;
                                                  handleUpdatePivotConfig(m.excelColumn, { pivotFilters: next });
                                                }}
                                                className="w-1/4 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] focus:outline-hidden cursor-pointer"
                                              >
                                                <option value="EQUALS">Bằng (=)</option>
                                                <option value="CONTAINS">Chứa đựng (Like)</option>
                                                <option value="GREATER_THAN">Lớn hơn (&gt;)</option>
                                                <option value="LESS_THAN">Nhỏ hơn (&lt;)</option>
                                              </select>

                                              <input
                                                type="text"
                                                value={f.value}
                                                onChange={(e) => {
                                                  const next = [...(m.pivotFilters || [])];
                                                  next[fIdx].value = e.target.value;
                                                  handleUpdatePivotConfig(m.excelColumn, { pivotFilters: next });
                                                }}
                                                placeholder="Giá trị lọc..."
                                                className="w-1/3 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-hidden"
                                              />

                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const next = (m.pivotFilters || []).filter((_, idx) => idx !== fIdx);
                                                  handleUpdatePivotConfig(m.excelColumn, { pivotFilters: next });
                                                }}
                                                className="text-slate-400 hover:text-red-500 p-1 bg-transparent border-0 cursor-pointer"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NÚT LƯU TOÀN BỘ CẤU HÌNH */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  Sẵn sàng áp dụng cho kết xuất tại tab Dashboard
                </span>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs active:scale-98 transition-all cursor-pointer border-0 shadow-xs"
                >
                  <Save className="w-4 h-4" /> Lưu cấu hình mẫu biểu
                </button>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white border border-slate-150 rounded-2xl shadow-2xs space-y-3">
              <Settings className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 italic">Vui lòng chọn hoặc tải lên một mẫu báo cáo để bắt đầu cấu hình.</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
