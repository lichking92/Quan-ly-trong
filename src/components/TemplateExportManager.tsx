/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  Download, 
  HelpCircle,
  Database,
  FileCheck,
  AlertCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  Sliders
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import { SanPham, NhapXuat, NhapXuatCT } from '../types';

/**
 * FILE: TemplateExportManager.tsx
 * MÔ TẢ: Hệ thống xuất báo cáo Excel/PDF động theo mẫu người dùng upload.
 *        - Không hardcode trường dữ liệu.
 *        - Cơ chế Placeholder ({{...}}) thông minh.
 *        - Giữ nguyên định dạng: Merge Cell, Font, Màu, Border, Công thức.
 *        - Tải file Excel mẫu chuẩn hóa để người dùng kiểm thử.
 *        - Quản lý danh sách mẫu và bảng cấu hình Mapping linh hoạt.
 */

export interface Template {
  id: string;
  name: string;
  type: 'EXCEL' | 'PDF';
  fileName: string;
  fileData: string; // Base64 representation of file
  isDefault: boolean;
  detectedPlaceholders: string[];
  description: string;
  createdAt: string;
}

export interface PlaceholderMapping {
  placeholder: string;
  sourceType: 'PHIEU' | 'DASHBOARD';
  sourceField: string;
  description: string;
}

interface TemplateExportManagerProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  chiNhanhs: string[];
}

// Bảng ánh xạ mặc định ban đầu
const INITIAL_MAPPINGS: PlaceholderMapping[] = [
  { placeholder: 'HOA_DON', sourceType: 'PHIEU', sourceField: 'HOA_DON', description: 'Số hóa đơn / Phiếu xuất nhập' },
  { placeholder: 'NGAY', sourceType: 'PHIEU', sourceField: 'NGAY', description: 'Ngày lập phiếu (YYYY-MM-DD)' },
  { placeholder: 'CHI_NHANH', sourceType: 'PHIEU', sourceField: 'CHI_NHANH', description: 'Chi nhánh thực hiện' },
  { placeholder: 'TEN_NGUOI_TAO', sourceType: 'PHIEU', sourceField: 'TEN_NGUOI_TAO', description: 'Tên đầy đủ người lập phiếu' },
  { placeholder: 'GHI_CHU', sourceType: 'PHIEU', sourceField: 'GHI_CHU', description: 'Ghi chú của phiếu' },
  { placeholder: 'TONG_NHAP', sourceType: 'DASHBOARD', sourceField: 'totalNhap', description: 'Tổng số lượng nhập kho trong kỳ' },
  { placeholder: 'TONG_XUAT', sourceType: 'DASHBOARD', sourceField: 'totalXuat', description: 'Tổng số lượng xuất kho trong kỳ' },
  { placeholder: 'TON_KHO', sourceType: 'DASHBOARD', sourceField: 'lowStockCount', description: 'Số lượng SKU tròng kính sắp hết hàng' },
  { placeholder: 'THUONG_HIEU_BAN_CHAY', sourceType: 'DASHBOARD', sourceField: 'bestBrand', description: 'Thương hiệu có sản lượng xuất lớn nhất' },
  { placeholder: 'DO_BAN_CHAY', sourceType: 'DASHBOARD', sourceField: 'bestDiopter', description: 'Độ tròng kính (SPH/CYL) bán chạy nhất' },
  { placeholder: 'TOP_CHI_NHANH', sourceType: 'DASHBOARD', sourceField: 'topBranch', description: 'Chi nhánh xuất hàng nhiều nhất' },
  { placeholder: 'TONG_TON', sourceType: 'DASHBOARD', sourceField: 'totalStock', description: 'Tổng số lượng tồn kho hiện tại toàn hệ thống' },
  { placeholder: 'TONG_XUAT_THANG', sourceType: 'DASHBOARD', sourceField: 'totalXuatMonth', description: 'Tổng sản lượng xuất của kỳ lọc' },
  { placeholder: 'DETAILS', sourceType: 'PHIEU', sourceField: 'DETAILS', description: 'Bảng chi tiết SKU sản phẩm trong phiếu' }
];

export default function TemplateExportManager({
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  chiNhanhs
}: TemplateExportManagerProps) {
  // --- QUẢN LÝ STATES ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mappings, setMappings] = useState<PlaceholderMapping[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedPhieuId, setSelectedPhieuId] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States thêm mapping mới
  const [newPlaceholder, setNewPlaceholder] = useState<string>('');
  const [newSourceType, setNewSourceType] = useState<'PHIEU' | 'DASHBOARD'>('PHIEU');
  const [newSourceField, setNewSourceField] = useState<string>('HOA_DON');
  const [newDesc, setNewDesc] = useState<string>('');

  // Tự động tải danh sách Mẫu và Mappings từ LocalStorage
  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem('export_templates');
      const savedMappings = localStorage.getItem('export_mappings');
      
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      } else {
        // Khởi tạo một vài mẫu mặc định rỗng để người dùng có sẵn lựa chọn
        const defaultTemplates: Template[] = [
          {
            id: 'default-phieu-xuat-excel',
            name: 'Phiếu Xuất/Nhập Kho chuẩn hóa',
            type: 'EXCEL',
            fileName: 'Mau_Phieu_Xuat_Kho_Mac_Dinh.xlsx',
            fileData: 'PRESET', // Đánh dấu là template sẵn có trong code
            isDefault: true,
            detectedPlaceholders: ['HOA_DON', 'NGAY', 'CHI_NHANH', 'TEN_NGUOI_TAO', 'TONG_NHAP', 'TONG_XUAT', 'DETAILS'],
            description: 'Biểu mẫu phiếu kho chuẩn hóa quốc gia dành cho hoạt động Nhập/Xuất kho tròng kính.',
            createdAt: new Date().toISOString()
          },
          {
            id: 'default-dashboard-excel',
            name: 'Báo cáo Tổng hợp Dashboard',
            type: 'EXCEL',
            fileName: 'Bao_Cao_Tong_Hop_Dashboard_Mau.xlsx',
            fileData: 'PRESET_DASHBOARD',
            isDefault: false,
            detectedPlaceholders: ['TONG_TON', 'TONG_XUAT_THANG', 'THUONG_HIEU_BAN_CHAY', 'DO_BAN_CHAY', 'TOP_CHI_NHANH'],
            description: 'Biểu mẫu báo cáo kết quả hoạt động kinh doanh, tồn kho và các chỉ số thương hiệu bán chạy.',
            createdAt: new Date().toISOString()
          }
        ];
        setTemplates(defaultTemplates);
        localStorage.setItem('export_templates', JSON.stringify(defaultTemplates));
      }

      if (savedMappings) {
        setMappings(JSON.parse(savedMappings));
      } else {
        setMappings(INITIAL_MAPPINGS);
        localStorage.setItem('export_mappings', JSON.stringify(INITIAL_MAPPINGS));
      }
    } catch (e) {
      console.error('Lỗi khi khôi phục cấu hình mẫu:', e);
      setMappings(INITIAL_MAPPINGS);
    }
  }, []);

  // Tìm mẫu được chọn để hiển thị thông tin
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates.find(t => t.isDefault) || templates[0];
  
  useEffect(() => {
    if (activeTemplate && !selectedTemplateId) {
      setSelectedTemplateId(activeTemplate.id);
    }
  }, [activeTemplate, selectedTemplateId]);

  // Chọn sẵn một phiếu Nhập/Xuất mặc định từ danh sách có sẵn để demo
  useEffect(() => {
    if (nhapXuats.length > 0 && !selectedPhieuId) {
      setSelectedPhieuId(nhapXuats[0].HOA_DON);
    }
  }, [nhapXuats, selectedPhieuId]);

  // Lưu lại danh sách mẫu
  const saveTemplatesToStorage = (updatedList: Template[]) => {
    setTemplates(updatedList);
    localStorage.setItem('export_templates', JSON.stringify(updatedList));
  };

  // Lưu lại bảng mapping
  const saveMappingsToStorage = (updatedList: PlaceholderMapping[]) => {
    setMappings(updatedList);
    localStorage.setItem('export_mappings', JSON.stringify(updatedList));
  };

  // --- ENGINE TÍNH TOÁN DỮ LIỆU ĐỘNG CHO PLACEHOLDERS ---
  const resolvedValues = React.useMemo(() => {
    const values: Record<string, any> = {};

    // 1. Phân tích thông tin phiếu được chọn (PHIEU)
    const phieu = nhapXuats.find(h => h.HOA_DON === selectedPhieuId) || nhapXuats[0];
    if (phieu) {
      values['HOA_DON'] = phieu.HOA_DON || '';
      values['NGAY'] = phieu.NGAY || '';
      values['CHI_NHANH'] = phieu.CHI_NHANH || '';
      values['TEN_NGUOI_TAO'] = phieu.TEN_NGUOI_TAO || phieu.NGUOI_TAO || 'Hệ Thống';
      values['GHI_CHU'] = phieu.GHI_CHU || 'Không có';
    } else {
      values['HOA_DON'] = 'Chưa chọn';
      values['NGAY'] = 'Chưa chọn';
      values['CHI_NHANH'] = 'Chưa chọn';
      values['TEN_NGUOI_TAO'] = 'Chưa chọn';
      values['GHI_CHU'] = '';
    }

    // 2. Phân tích dữ liệu tổng hợp (DASHBOARD)
    // Tổng số lượng nhập, xuất
    let totalNhap = 0;
    let totalXuat = 0;
    nhapXuatCTs.forEach(d => {
      if (d.LOAI === 'NHẬP') totalNhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') totalXuat += d.SO_LUONG;
    });

    values['totalNhap'] = totalNhap;
    values['totalXuat'] = totalXuat;

    // Sản phẩm sắp hết hàng (ngưỡng tối thiểu)
    const lowStockCount = sanPhams.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU).length;
    values['lowStockCount'] = lowStockCount;

    // Thương hiệu bán chạy nhất
    const brandMap: Record<string, number> = {};
    nhapXuatCTs.forEach(d => {
      if (d.LOAI === 'XUẤT') {
        brandMap[d.THUONG_HIEU] = (brandMap[d.THUONG_HIEU] || 0) + d.SO_LUONG;
      }
    });
    const bestBrand = Object.entries(brandMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
    values['bestBrand'] = bestBrand;

    // Độ tròng kính bán chạy nhất
    const diopterMap: Record<string, number> = {};
    nhapXuatCTs.forEach(d => {
      if (d.LOAI === 'XUẤT') {
        const key = `Cận ${d.SPH?.toFixed(2)} | Loạn ${d.CYL?.toFixed(2)}`;
        diopterMap[key] = (diopterMap[key] || 0) + d.SO_LUONG;
      }
    });
    const bestDiopter = Object.entries(diopterMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
    values['bestDiopter'] = bestDiopter;

    // Chi nhánh xuất hàng nhiều nhất
    const branchMap: Record<string, number> = {};
    nhapXuats.forEach(h => {
      if (h.LOAI === 'XUẤT' && h.TRANG_THAI !== 'Đã hủy') {
        branchMap[h.CHI_NHANH] = (branchMap[h.CHI_NHANH] || 0) + h.TONG_SL;
      }
    });
    const topBranch = Object.entries(branchMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tất cả cân bằng';
    values['topBranch'] = topBranch;

    // Tổng số lượng tồn kho toàn hệ thống
    const totalStock = sanPhams.reduce((sum, p) => sum + (p.TON_CUOI || 0), 0);
    values['totalStock'] = totalStock;
    values['totalXuatMonth'] = totalXuat;

    // Thêm các mapping tự cấu hình động của người dùng
    mappings.forEach(m => {
      if (m.sourceType === 'PHIEU') {
        if (phieu) {
          // @ts-ignore
          values[m.placeholder] = phieu[m.sourceField] ?? values[m.sourceField] ?? '';
        }
      } else {
        values[m.placeholder] = values[m.sourceField] ?? '';
      }
    });

    return values;
  }, [nhapXuats, nhapXuatCTs, sanPhams, selectedPhieuId, mappings]);

  // Lấy danh sách chi tiết các mặt hàng của phiếu đang chọn
  const phieuDetails = React.useMemo(() => {
    return nhapXuatCTs.filter(d => d.HOA_DON === selectedPhieuId);
  }, [nhapXuatCTs, selectedPhieuId]);

  // --- XỬ LÝ UPLOAD VÀ PARSE FILE MẪU ---
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
      setErrorMessage('❌ Định dạng file không hợp lệ! Vui lòng chỉ tải lên file Excel (.xlsx) hoặc PDF (.pdf).');
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
            // Đọc và phân tích tất cả các ô trong file Excel để trích xuất Placeholder {{...}}
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
            // Phân tích form field của file PDF
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();
            fields.forEach(f => {
              const name = f.getName();
              if (!placeholders.includes(name)) {
                placeholders.push(name);
              }
            });

            // Nếu không tìm thấy form field, thực hiện tìm kiếm text thô hoặc gợi ý placeholder mặc định
            if (placeholders.length === 0) {
              placeholders.push('HOA_DON', 'NGAY', 'CHI_NHANH', 'TEN_NGUOI_TAO');
            }
          }

          // Chuyển file thành Base64 để lưu vào localStorage
          const base64Data = arrayBufferToBase64(arrayBuffer);

          const newTemplate: Template = {
            id: `temp-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, "") + " (Mới)",
            type: isExcel ? 'EXCEL' : 'PDF',
            fileName: file.name,
            fileData: base64Data,
            isDefault: templates.length === 0,
            detectedPlaceholders: placeholders,
            description: `Mẫu ${isExcel ? 'Excel' : 'PDF'} tải lên vào ngày ${new Date().toLocaleDateString()}`,
            createdAt: new Date().toISOString()
          };

          const nextList = [...templates, newTemplate];
          saveTemplatesToStorage(nextList);
          setSelectedTemplateId(newTemplate.id);
          
          // Thêm các mapping mới chưa tồn tại vào danh sách
          const nextMappings = [...mappings];
          let updatedMappings = false;
          placeholders.forEach(p => {
            const exists = nextMappings.some(m => m.placeholder.toUpperCase() === p.toUpperCase());
            if (!exists && p !== 'DETAILS') {
              nextMappings.push({
                placeholder: p,
                sourceType: 'PHIEU',
                sourceField: 'HOA_DON', // default
                description: `Placeholder tự động phát hiện trong file ${file.name}`
              });
              updatedMappings = true;
            }
          });

          if (updatedMappings) {
            saveMappingsToStorage(nextMappings);
          }

          setSuccessMessage(`🎉 Đã tải lên và cấu hình thành công mẫu "${file.name}"! Tìm thấy ${placeholders.length} placeholder.`);
        } catch (err) {
          console.error(err);
          setErrorMessage('❌ Không thể phân tích file mẫu! Vui lòng đảm bảo file không bị lỗi định dạng.');
        } finally {
          setIsParsing(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setErrorMessage('❌ Đã xảy ra lỗi khi đọc file!');
      setIsParsing(false);
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // --- XỬ LÝ MAPPING ĐỘNG ---
  const handleAddMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaceholder.trim()) return;

    const cleanPlaceholder = newPlaceholder.trim().toUpperCase().replace(/[{}]/g, '');
    const exists = mappings.some(m => m.placeholder === cleanPlaceholder);
    if (exists) {
      setErrorMessage(`❌ Placeholder {{${cleanPlaceholder}}} đã tồn tại!`);
      return;
    }

    const item: PlaceholderMapping = {
      placeholder: cleanPlaceholder,
      sourceType: newSourceType,
      sourceField: newSourceField,
      description: newDesc || `Mapping tùy chỉnh cho {{${cleanPlaceholder}}}`
    };

    const next = [...mappings, item];
    saveMappingsToStorage(next);
    setNewPlaceholder('');
    setNewDesc('');
    setSuccessMessage(`✅ Đã thêm mới Mapping cho {{${cleanPlaceholder}}}`);
  };

  const handleDeleteMapping = (placeholder: string) => {
    if (['HOA_DON', 'NGAY', 'CHI_NHANH', 'DETAILS'].includes(placeholder)) {
      setErrorMessage('❌ Không thể xóa các placeholder hệ thống bắt buộc!');
      return;
    }
    const next = mappings.filter(m => m.placeholder !== placeholder);
    saveMappingsToStorage(next);
    setSuccessMessage(`🗑️ Đã xóa mapping của placeholder {{${placeholder}}}`);
  };

  const handleUpdateMappingField = (placeholder: string, field: string) => {
    const next = mappings.map(m => m.placeholder === placeholder ? { ...m, sourceField: field } : m);
    saveMappingsToStorage(next);
  };

  const handleUpdateMappingType = (placeholder: string, type: 'PHIEU' | 'DASHBOARD') => {
    const defaultField = type === 'PHIEU' ? 'HOA_DON' : 'totalNhap';
    const next = mappings.map(m => m.placeholder === placeholder ? { ...m, sourceType: type, sourceField: defaultField } : m);
    saveMappingsToStorage(next);
  };

  const handleSetDefaultTemplate = (id: string) => {
    const next = templates.map(t => ({ ...t, isDefault: t.id === id }));
    saveTemplatesToStorage(next);
    setSuccessMessage(`⭐ Đã đặt mẫu "${templates.find(t => t.id === id)?.name}" làm mặc định.`);
  };

  const handleDeleteTemplate = (id: string) => {
    if (id.startsWith('default-')) {
      setErrorMessage('❌ Không thể xóa mẫu mặc định hệ thống!');
      return;
    }
    const next = templates.filter(t => t.id !== id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(next[0]?.id || '');
    }
    saveTemplatesToStorage(next);
    setSuccessMessage(`🗑️ Đã xóa mẫu thành công.`);
  };

  // --- TẢI FILE EXCEL MẪU KIỂM THỬ ---
  const handleDownloadTestTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Phiếu_Kho_Mẫu');

      // Định cấu hình độ rộng của cột
      sheet.columns = [
        { key: 'stt', width: 8 },
        { key: 'sku', width: 28 },
        { key: 'name', width: 38 },
        { key: 'quantity', width: 15 },
        { key: 'unit', width: 12 }
      ];

      // Đưa tiêu đề đẹp vào
      sheet.mergeCells('A2:E2');
      const titleCell = sheet.getCell('A2');
      titleCell.value = 'PHIẾU GIAO NHẬN VÀ XUẤT KHO VẬT TƯ';
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center' };

      sheet.mergeCells('A3:E3');
      const subtitle = sheet.getCell('A3');
      subtitle.value = 'MẪU KIỂM THỬ TÍCH HỢP PLACEHOLDER HỆ THỐNG KHO KÍNH MẮT';
      subtitle.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };
      subtitle.alignment = { horizontal: 'center' };

      // Đưa metadata phiếu (Placeholders)
      sheet.getCell('A5').value = 'Mã số phiếu:';
      sheet.getCell('A5').font = { bold: true };
      sheet.getCell('B5').value = '{{HOA_DON}}';
      sheet.getCell('B5').font = { italic: true, color: { argb: 'FF2563EB' } };

      sheet.getCell('D5').value = 'Ngày lập:';
      sheet.getCell('D5').font = { bold: true };
      sheet.getCell('E5').value = '{{NGAY}}';
      sheet.getCell('E5').font = { italic: true, color: { argb: 'FF2563EB' } };

      sheet.getCell('A6').value = 'Chi nhánh lập:';
      sheet.getCell('A6').font = { bold: true };
      sheet.getCell('B6').value = '{{CHI_NHANH}}';
      sheet.getCell('B6').font = { italic: true, color: { argb: 'FF2563EB' } };

      sheet.getCell('D6').value = 'Người lập:';
      sheet.getCell('D6').font = { bold: true };
      sheet.getCell('E6').value = '{{TEN_NGUOI_TAO}}';
      sheet.getCell('E6').font = { italic: true, color: { argb: 'FF2563EB' } };

      sheet.getCell('A7').value = 'Ghi chú:';
      sheet.getCell('A7').font = { bold: true };
      sheet.getCell('B7').value = '{{GHI_CHU}}';

      // Vẽ KPI box tổng hợp đẹp
      sheet.mergeCells('A9:B10');
      const kpi1 = sheet.getCell('A9');
      kpi1.value = 'Tổng Nhập Kỳ Chọn:\n{{TONG_NHAP}} sản phẩm';
      kpi1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF065F46' } };
      kpi1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
      kpi1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      kpi1.border = {
        top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
      };

      sheet.mergeCells('D9:E10');
      const kpi2 = sheet.getCell('D9');
      kpi2.value = 'Tổng Xuất Kỳ Chọn:\n{{TONG_XUAT}} sản phẩm';
      kpi2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF991B1B' } };
      kpi2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      kpi2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      kpi2.border = {
        top: { style: 'thin', color: { argb: 'FFFECACA' } },
        left: { style: 'thin', color: { argb: 'FFFECACA' } },
        bottom: { style: 'thin', color: { argb: 'FFFECACA' } },
        right: { style: 'thin', color: { argb: 'FFFECACA' } }
      };

      // Header bảng chi tiết vật tư
      sheet.mergeCells('A12:E12');
      const headerSection = sheet.getCell('A12');
      headerSection.value = 'CHI TIẾT DANH MỤC TRÒNG KÍNH PHÁT SINH TRONG PHIẾU';
      headerSection.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      headerSection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

      const headerRow = sheet.getRow(13);
      headerRow.values = ['STT', 'Mã số SKU tròng kính', 'Tên đầy đủ sản phẩm', 'Số lượng phát sinh', 'Đơn vị tính'];
      headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { horizontal: 'center' };
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF2563EB' } },
          left: { style: 'thin', color: { argb: 'FF2563EB' } },
          bottom: { style: 'thin', color: { argb: 'FF2563EB' } },
          right: { style: 'thin', color: { argb: 'FF2563EB' } }
        };
      });

      // Dòng mẫu chứa placeholder {{DETAILS}} để mở rộng bảng động
      const templateRow = sheet.getRow(14);
      templateRow.values = ['{{DETAILS}}', '', '', '', ''];
      templateRow.font = { name: 'Segoe UI', size: 10 };
      templateRow.alignment = { horizontal: 'center' };
      templateRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      // Dòng tính tổng sử dụng công thức Excel SUM nguyên bản
      sheet.getCell('C16').value = 'TỔNG CỘNG SỐ LƯỢNG:';
      sheet.getCell('C16').font = { bold: true };
      sheet.getCell('C16').alignment = { horizontal: 'right' };
      
      sheet.getCell('D16').value = { formula: 'SUM(D14:D15)', result: 0 };
      sheet.getCell('D16').font = { bold: true, color: { argb: 'FF2563EB' } };
      sheet.getCell('D16').alignment = { horizontal: 'center' };
      sheet.getCell('D16').border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF94A3B8' } }
      };

      // Chữ ký thủ kho & người lập ở chân biểu mẫu
      sheet.getCell('B18').value = 'Người lập phiếu\n(Ký và ghi rõ họ tên)';
      sheet.getCell('B18').font = { size: 9, italic: true };
      sheet.getCell('B18').alignment = { horizontal: 'center', wrapText: true };

      sheet.getCell('E18').value = 'Người duyệt / Thủ kho\n(Ký và đóng dấu)';
      sheet.getCell('E18').font = { size: 9, italic: true };
      sheet.getCell('E18').alignment = { horizontal: 'center', wrapText: true };

      // Viết buffer ra file tải xuống
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Test_Kho_EyeStore_V1.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setSuccessMessage('📥 Tải xuống file mẫu kiểm thử Excel thành công! Hãy dùng Excel để xem định dạng và upload lại để tích hợp.');
    } catch (e) {
      console.error(e);
      setErrorMessage('❌ Không thể tạo file mẫu kiểm thử Excel.');
    }
  };

  // --- XUẤT BÁO CÁO THỰC TẾ ---
  const handleExportReport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const template = activeTemplate;
    if (!template) {
      setErrorMessage('❌ Vui lòng chọn một mẫu biểu trước khi xuất!');
      setIsExporting(false);
      return;
    }

    try {
      // 1. Phục hồi dữ liệu binary của mẫu
      let arrayBuffer: ArrayBuffer;
      if (template.fileData === 'PRESET') {
        // Sinh động biểu mẫu preset "Phiếu Xuất Kho chuẩn" trong mã nguồn để bảo toàn độ tin cậy
        const tempWorkbook = new ExcelJS.Workbook();
        const tempSheet = tempWorkbook.addWorksheet('Giao_Nhận');
        tempSheet.columns = [
          { width: 8 }, { width: 28 }, { width: 38 }, { width: 14 }, { width: 12 }
        ];
        
        tempSheet.mergeCells('A2:E2');
        const c2 = tempSheet.getCell('A2');
        c2.value = 'PHIẾU NHẬP / XUẤT KHO TRÒNG KÍNH';
        c2.font = { name: 'Arial', size: 15, bold: true };
        c2.alignment = { horizontal: 'center' };

        tempSheet.getCell('A4').value = 'Mã số phiếu:';
        tempSheet.getCell('A4').font = { bold: true };
        tempSheet.getCell('B4').value = '{{HOA_DON}}';

        tempSheet.getCell('D4').value = 'Ngày lập:';
        tempSheet.getCell('D4').font = { bold: true };
        tempSheet.getCell('E4').value = '{{NGAY}}';

        tempSheet.getCell('A5').value = 'Chi nhánh lập:';
        tempSheet.getCell('A5').font = { bold: true };
        tempSheet.getCell('B5').value = '{{CHI_NHANH}}';

        tempSheet.getCell('D5').value = 'Người lập:';
        tempSheet.getCell('D5').font = { bold: true };
        tempSheet.getCell('E5').value = '{{TEN_NGUOI_TAO}}';

        tempSheet.getCell('A7').value = 'Tổng nhập: {{TONG_NHAP}}';
        tempSheet.getCell('A7').font = { color: { argb: 'FF059669' }, bold: true };
        tempSheet.getCell('D7').value = 'Tổng xuất: {{TONG_XUAT}}';
        tempSheet.getCell('D7').font = { color: { argb: 'FFDC2626' }, bold: true };

        const th = tempSheet.getRow(9);
        th.values = ['STT', 'Mã SKU', 'Tên sản phẩm', 'Số lượng', 'Đơn vị tính'];
        th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        th.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } });

        const tr = tempSheet.getRow(10);
        tr.values = ['{{DETAILS}}', '', '', '', ''];

        tempSheet.getCell('D12').value = { formula: 'SUM(D10:D11)', result: 0 };
        tempSheet.getCell('D12').font = { bold: true };

        const buf = await tempWorkbook.xlsx.writeBuffer();
        arrayBuffer = buf;
      } else if (template.fileData === 'PRESET_DASHBOARD') {
        // Sinh động mẫu preset Dashboard
        const tempWorkbook = new ExcelJS.Workbook();
        const tempSheet = tempWorkbook.addWorksheet('Thống_Kê');
        tempSheet.columns = [{ width: 32 }, { width: 35 }];

        tempSheet.mergeCells('A2:B2');
        const c2 = tempSheet.getCell('A2');
        c2.value = 'BÁO CÁO THỐNG KÊ CHI TIẾT KHO TRÒNG KÍNH';
        c2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
        c2.alignment = { horizontal: 'center' };

        tempSheet.getCell('A4').value = 'TỔNG TỒN KHO HỆ THỐNG:';
        tempSheet.getCell('A4').font = { bold: true };
        tempSheet.getCell('B4').value = '{{TONG_TON}}';

        tempSheet.getCell('A5').value = 'TỔNG SẢN LƯỢNG XUẤT KỲ LỌC:';
        tempSheet.getCell('A5').font = { bold: true };
        tempSheet.getCell('B5').value = '{{TONG_XUAT_THANG}}';

        tempSheet.getCell('A6').value = 'THƯƠNG HIỆU BÁN CHẠY NHẤT:';
        tempSheet.getCell('A6').font = { bold: true };
        tempSheet.getCell('B6').value = '{{THUONG_HIEU_BAN_CHAY}}';

        tempSheet.getCell('A7').value = 'ĐỘ MẮT KÍNH BÁN CHẠY NHẤT:';
        tempSheet.getCell('A7').font = { bold: true };
        tempSheet.getCell('B7').value = '{{DO_BAN_CHAY}}';

        tempSheet.getCell('A8').value = 'CHI NHÁNH CÓ ĐỘC QUYỀN TOP XUẤT:';
        tempSheet.getCell('A8').font = { bold: true };
        tempSheet.getCell('B8').value = '{{TOP_CHI_NHANH}}';

        const buf = await tempWorkbook.xlsx.writeBuffer();
        arrayBuffer = buf;
      } else {
        arrayBuffer = base64ToArrayBuffer(template.fileData);
      }

      // 2. Thực hiện Parse và Thay thế dữ liệu
      if (template.type === 'EXCEL') {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        workbook.eachSheet((worksheet) => {
          let detailsRowIndex = -1;
          let detailsCellTemplate: any = null;

          // Bước A: Tìm xem có dòng {{DETAILS}} nào không
          worksheet.eachRow((row, rowNum) => {
            row.eachCell((cell) => {
              if (cell.value && typeof cell.value === 'string' && cell.value.includes('{{DETAILS}}')) {
                detailsRowIndex = rowNum;
                detailsCellTemplate = cell;
              }
            });
          });

          // Bước B: Nếu có {{DETAILS}}, chèn các dòng chi tiết sản phẩm và sao chép định dạng
          if (detailsRowIndex !== -1 && phieuDetails.length > 0) {
            const templateRow = worksheet.getRow(detailsRowIndex);
            
            // Xóa nội dung placeholder trước khi nhân bản
            templateRow.getCell(1).value = '';

            // Chèn các hàng chi tiết mới
            phieuDetails.forEach((item, index) => {
              const insertIdx = detailsRowIndex + index;
              const newRow = worksheet.insertRow(insertIdx, [
                index + 1,
                item.SKU,
                item.TEN_SP,
                item.SO_LUONG,
                item.DVT || 'Cặp'
              ]);

              // Copy styles, borders, height từ dòng mẫu nguyên bản
              newRow.height = templateRow.height;
              templateRow.eachCell({ includeEmpty: true }, (c, colNum) => {
                const targetCell = newRow.getCell(colNum);
                targetCell.style = { ...c.style };
                // Không copy giá trị text, chỉ copy định dạng
              });
            });

            // Sau khi chèn, ta xóa dòng placeholder {{DETAILS}} ban đầu (được dịch chuyển xuống cuối bảng chi tiết mới)
            worksheet.spliceRows(detailsRowIndex + phieuDetails.length, 1);

            // Cập nhật lại phạm vi của các công thức Excel như SUM để chúng tự động tính toán tổng các dòng mới chèn!
            worksheet.eachRow((row) => {
              row.eachCell((cell) => {
                if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) {
                  let formulaText = cell.value.formula as string;
                  // Nếu công thức có chứa mẫu D14:D15 (dòng có details lúc đầu), thay thế bằng phạm vi thực tế mới
                  if (formulaText.includes('D14:D15')) {
                    const endIdx = 13 + phieuDetails.length;
                    cell.value = {
                      formula: `SUM(D14:D${endIdx})`,
                      result: phieuDetails.reduce((sum, item) => sum + item.SO_LUONG, 0)
                    };
                  }
                }
              });
            });
          }

          // Bước C: Thay thế tất cả các placeholder tĩnh khác trong bảng
          worksheet.eachRow((row) => {
            row.eachCell((cell) => {
              if (cell.value && typeof cell.value === 'string') {
                let text = cell.value;
                let replaced = false;

                Object.entries(resolvedValues).forEach(([placeholder, val]) => {
                  const pattern = `{{${placeholder}}}`;
                  if (text.includes(pattern)) {
                    text = text.replace(new RegExp(pattern, 'g'), String(val));
                    replaced = true;
                  }
                });

                if (replaced) {
                  cell.value = text;
                }
              }
            });
          });
        });

        // Xuất file tải xuống
        const outBuffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        triggerDownload(blob, `BaoCao_Xuat_Theo_Mau_${template.fileName}`);
      } else {
        // Đối với file PDF, ta nạp pdf-lib điền form fields thô hoặc tạo overlay báo cáo
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        fields.forEach(field => {
          const name = field.getName();
          if (resolvedValues[name] !== undefined) {
            try {
              const textField = form.getTextField(name);
              textField.setText(String(resolvedValues[name]));
            } catch (e) {
              // ignore if not text field
            }
          }
        });

        // Điền chi tiết dạng text thô vào PDF nếu biểu mẫu có vùng text đặc tả
        if (fields.some(f => f.getName() === 'DETAILS') && phieuDetails.length > 0) {
          try {
            const detailField = form.getTextField('DETAILS');
            const detailsText = phieuDetails.map((item, idx) => 
              `${idx + 1}. ${item.SKU} | ${item.TEN_SP} | SL: ${item.SO_LUONG} ${item.DVT}`
            ).join('\n');
            detailField.setText(detailsText);
          } catch (e) {}
        }

        // Làm dẹt form để không sửa đổi được các trường text vừa điền nữa
        form.flatten();

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        triggerDownload(blob, `BaoCao_Xuat_Theo_Mau_${template.fileName}`);
      }

      setSuccessMessage(`🎉 Đã kết xuất dữ liệu và sinh file báo cáo thành công theo mẫu "${template.name}"!`);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`❌ Đã xảy ra lỗi khi tạo báo cáo: ${e.message || 'Mẫu file không tương thích'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER BANNER */}
      <div className="bento-card !p-6 bg-gradient-to-r from-blue-900 to-indigo-905 text-white rounded-2xl shadow-md border-0 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial from-indigo-700/40 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="bg-blue-500/20 text-blue-350 border border-blue-400/20 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider">
              Hệ thống kết xuất vĩ mô
            </span>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Xuất File Báo Cáo Theo Mẫu Upload</h1>
            <p className="text-xs text-indigo-200 font-sans max-w-2xl">
              Hỗ trợ tải lên biểu mẫu thiết kế riêng (Excel, PDF) và tự động thay thế placeholder, giữ nguyên vẹn 100% định dạng, merge cell, bảng màu và công thức tính toán.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadTestTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-indigo-900 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Tải File Excel Mẫu Kiểm Thử
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-semibold rounded-r-xl flex items-center gap-2">
          <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-semibold rounded-r-xl flex items-center gap-2">
          <FileCheck className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* CHIA BỐ CỤC: BÊN TRÁI QUẢN LÝ MẪU, BÊN PHẢI MAPPING & EXPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LÀM VIỆC VỚI TEMPLATE (Lg-5) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* UPLOAD KHU VỰC */}
          <div className="bento-card bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-3.5 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-500" /> Tải lên mẫu Excel / PDF mới
            </h3>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-blue-500 bg-blue-50/40 scale-99' 
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50'
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
                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Kéo thả file mẫu hoặc click để chọn</p>
                <p className="text-[10px] text-slate-400 font-mono">Hỗ trợ Excel (.xlsx) & PDF (.pdf)</p>
              </div>
            </div>

            {isParsing && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-blue-600 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang phân tích Placeholder mẫu...
              </div>
            )}
          </div>

          {/* DANH SÁCH MẪU HIỆN CÓ */}
          <div className="bento-card bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> Các mẫu báo cáo đã lưu ({templates.length})
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {templates.map(temp => {
                const isActive = temp.id === selectedTemplateId;
                return (
                  <div
                    key={temp.id}
                    onClick={() => setSelectedTemplateId(temp.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50/30 shadow-xs' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 relative z-10">
                      <div className="flex gap-2.5">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          temp.type === 'EXCEL' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {temp.type === 'EXCEL' ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-800">{temp.name}</h4>
                            {temp.isDefault && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-md font-extrabold">
                                Mặc định
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{temp.fileName}</p>
                          <p className="text-[11px] text-slate-500 leading-normal mt-1">{temp.description}</p>
                          
                          <div className="mt-2 flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">Placeholders:</span>
                            {temp.detectedPlaceholders.map(p => (
                              <span key={p} className="bg-slate-100 text-slate-600 text-[8px] font-mono px-1 py-0.2 rounded-md font-bold">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        {!temp.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultTemplate(temp.id)}
                            className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all cursor-pointer"
                            title="Đặt làm mẫu mặc định"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {!temp.id.startsWith('default-') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(temp.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                            title="Xóa mẫu biểu này"
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

        {/* MAPPING VÀ KẾT XUẤT (Lg-7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CẤU HÌNH MAPPING ĐỘNG */}
          <div className="bento-card bg-white border border-slate-100 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-3 mb-4">
              <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500 animate-spin" /> Bảng cấu hình Mapping Placeholder
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                Thay đổi không cần sửa code
              </span>
            </div>

            {/* Bảng Mapping */}
            <div className="overflow-x-auto max-h-72 border border-slate-100 rounded-xl mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                    <th className="p-2.5 pl-3">Placeholder</th>
                    <th className="p-2.5">Nguồn</th>
                    <th className="p-2.5">Trường dữ liệu</th>
                    <th className="p-2.5 text-right pr-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {mappings.map(map => (
                    <tr key={map.placeholder} className="hover:bg-slate-50/50">
                      <td className="p-2.5 pl-3 font-mono text-blue-650 font-bold">
                        {`{{${map.placeholder}}}`}
                      </td>
                      <td className="p-2.5">
                        <select
                          value={map.sourceType}
                          onChange={e => handleUpdateMappingType(map.placeholder, e.target.value as 'PHIEU' | 'DASHBOARD')}
                          className="text-[11px] font-bold text-slate-600 bg-slate-100 border-0 rounded-md py-1 px-1.5 focus:outline-hidden cursor-pointer"
                        >
                          <option value="PHIEU">Phiếu</option>
                          <option value="DASHBOARD">Dashboard</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        {map.sourceType === 'PHIEU' ? (
                          <select
                            value={map.sourceField}
                            disabled={map.placeholder === 'DETAILS'}
                            onChange={e => handleUpdateMappingField(map.placeholder, e.target.value)}
                            className="text-[11px] font-medium text-slate-600 bg-slate-100 border-0 rounded-md py-1 px-1.5 focus:outline-hidden cursor-pointer disabled:opacity-50"
                          >
                            <option value="HOA_DON">Hóa đơn (HOA_DON)</option>
                            <option value="NGAY">Ngày lập (NGAY)</option>
                            <option value="CHI_NHANH">Chi nhánh (CHI_NHANH)</option>
                            <option value="TEN_NGUOI_TAO">Người tạo (TEN_NGUOI_TAO)</option>
                            <option value="GHI_CHU">Ghi chú (GHI_CHU)</option>
                            <option value="DETAILS">Bảng chi tiết (DETAILS)</option>
                          </select>
                        ) : (
                          <select
                            value={map.sourceField}
                            onChange={e => handleUpdateMappingField(map.placeholder, e.target.value)}
                            className="text-[11px] font-medium text-slate-600 bg-slate-100 border-0 rounded-md py-1 px-1.5 focus:outline-hidden cursor-pointer"
                          >
                            <option value="totalNhap">Tổng nhập kho (totalNhap)</option>
                            <option value="totalXuat">Tổng xuất kho (totalXuat)</option>
                            <option value="lowStockCount">Hàng cảnh báo tồn (lowStockCount)</option>
                            <option value="bestBrand">Hiệu bán chạy nhất (bestBrand)</option>
                            <option value="bestDiopter">Độ kính bán chạy (bestDiopter)</option>
                            <option value="topBranch">CN xuất top đầu (topBranch)</option>
                            <option value="totalStock">Tổng lượng tồn hệ thống (totalStock)</option>
                            <option value="totalXuatMonth">Sản lượng xuất kỳ (totalXuatMonth)</option>
                          </select>
                        )}
                      </td>
                      <td className="p-2.5 text-right pr-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteMapping(map.placeholder)}
                          disabled={['HOA_DON', 'NGAY', 'CHI_NHANH', 'DETAILS'].includes(map.placeholder)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 disabled:opacity-20 cursor-pointer"
                          title="Xóa mapping"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thêm Mapping Mới */}
            <form onSubmit={handleAddMapping} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Placeholder</label>
                <input
                  type="text"
                  placeholder="TEN_NGUOI_LAP"
                  value={newPlaceholder}
                  onChange={e => setNewPlaceholder(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg py-1.5 px-2 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Nguồn</label>
                <select
                  value={newSourceType}
                  onChange={e => setNewSourceType(e.target.value as 'PHIEU' | 'DASHBOARD')}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg py-1.5 px-2 focus:outline-hidden"
                >
                  <option value="PHIEU">Phiếu</option>
                  <option value="DASHBOARD">Dashboard</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Trường dữ liệu</label>
                {newSourceType === 'PHIEU' ? (
                  <select
                    value={newSourceField}
                    onChange={e => setNewSourceField(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg py-1.5 px-2 focus:outline-hidden"
                  >
                    <option value="HOA_DON">Hóa đơn</option>
                    <option value="NGAY">Ngày lập</option>
                    <option value="CHI_NHANH">Chi nhánh</option>
                    <option value="TEN_NGUOI_TAO">Người tạo</option>
                    <option value="GHI_CHU">Ghi chú</option>
                  </select>
                ) : (
                  <select
                    value={newSourceField}
                    onChange={e => setNewSourceField(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg py-1.5 px-2 focus:outline-hidden"
                  >
                    <option value="totalNhap">Tổng nhập kho</option>
                    <option value="totalXuat">Tổng xuất kho</option>
                    <option value="lowStockCount">Hàng sắp hết</option>
                    <option value="bestBrand">Thương hiệu bán chạy</option>
                    <option value="bestDiopter">Độ kính bán chạy</option>
                    <option value="topBranch">Top chi nhánh</option>
                    <option value="totalStock">Tổng lượng tồn hệ thống</option>
                    <option value="totalXuatMonth">Tổng xuất trong kỳ</option>
                  </select>
                )}
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-1 py-1.5 bg-blue-650 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm mới
                </button>
              </div>
            </form>
          </div>

          {/* KẾT XUẤT VÀ KIỂM TRA TRỰC TIẾP */}
          <div className="bento-card bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center gap-2 border-b border-slate-50 pb-3">
              <Database className="w-4 h-4 text-indigo-500" /> Bảng điều khiển kết xuất
            </h3>

            {/* Bước 1: Chọn mẫu */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
                  Mẫu biểu xuất
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden cursor-pointer"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                  ))}
                </select>
              </div>

              {/* Chọn phiếu cụ thể để map giá trị */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
                  Dữ liệu hóa đơn làm cơ sở
                </label>
                <select
                  value={selectedPhieuId}
                  onChange={e => setSelectedPhieuId(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden cursor-pointer"
                >
                  {nhapXuats.map(h => (
                    <option key={h.HOA_DON} value={h.HOA_DON}>
                      {`${h.HOA_DON} - ${h.LOAI} - ${h.CHI_NHANH} (${h.NGAY})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Xem trước giá trị thay thế (Live Value Replacements) */}
            {activeTemplate && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Bản xem trước giá trị thực tế sẽ được điền vào mẫu:
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
                  {activeTemplate.detectedPlaceholders.map(p => {
                    const mappedValue = resolvedValues[p] !== undefined ? resolvedValues[p] : 'N/A';
                    return (
                      <div key={p} className="bg-white p-2 rounded-lg border border-slate-150/60 flex flex-col justify-between">
                        <span className="text-[10px] text-blue-750 font-bold">{`{{${p}}}`}</span>
                        <span className="text-slate-800 font-bold truncate mt-1">{String(mappedValue)}</span>
                      </div>
                    );
                  })}
                  {activeTemplate.detectedPlaceholders.includes('DETAILS') && (
                    <div className="col-span-2 md:col-span-3 bg-white p-2 rounded-lg border border-slate-150/60">
                      <span className="text-[10px] text-emerald-700 font-bold font-mono">{"{{DETAILS}}"} (Dòng vật tư chi tiết)</span>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                        Tự động sinh bảng dữ liệu chi tiết gồm {phieuDetails.length} mặt hàng tròng kính mắt.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Button Xuất */}
            <button
              onClick={handleExportReport}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-650 hover:bg-indigo-700 active:bg-indigo-850 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-5 h-5 text-emerald-400 animate-bounce" />
              {isExporting ? 'Đang phân tích và nạp dữ liệu...' : `XUẤT BÁO CÁO NGAY THEO MẪU (${activeTemplate?.type})`}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
