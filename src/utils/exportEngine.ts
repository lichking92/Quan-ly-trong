/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SanPham, NhapXuat, NhapXuatCT } from '../types';
import { supabase } from '../supabaseClient';

// Lazy loading helpers for ExcelJS and PDFDocument to minimize RAM/CPU and bundle overhead
let cachedExcelJS: any = null;
export async function getExcelJS() {
  if (!cachedExcelJS) {
    cachedExcelJS = (await import('exceljs')).default;
  }
  return cachedExcelJS;
}

let cachedPDFDocument: any = null;
export async function getPDFDocument() {
  if (!cachedPDFDocument) {
    cachedPDFDocument = (await import('pdf-lib')).PDFDocument;
  }
  return cachedPDFDocument;
}

// Fetch template binary on demand to keep the application states lightweight
export async function fetchTemplateFileData(templateId: string): Promise<string> {
  if (templateId === 'default-phieu-xuat-excel') return 'PRESET';
  if (templateId === 'default-dashboard-excel') return 'PRESET_DASHBOARD';
  
  // Try loading from localStorage cache
  const localFile = localStorage.getItem(`template_file_${templateId}`);
  if (localFile) {
    return localFile;
  }
  
  // Fetch on-demand from Supabase DB
  try {
    const { data, error } = await supabase
      .from('b_export_template')
      .select('fileData')
      .eq('id', templateId)
      .single();
    if (!error && data?.fileData) {
      let fileData = data.fileData;
      
      // If the file resides in the Supabase Storage Bucket, fetch it
      if (fileData.startsWith('STORAGE_PATH:')) {
        const pathSuffix = fileData.substring('STORAGE_PATH:user_luutru/'.length);
        console.log(`[Storage] Phát hiện file mẫu lưu trữ tại Storage. Tiến hành tải từ bucket 'user_luutru' tại đường dẫn: ${pathSuffix}`);
        const { data: blob, error: dlError } = await supabase.storage
          .from('user_luutru')
          .download(pathSuffix);
          
        if (dlError) {
          console.warn(`Lỗi tải file mẫu từ Storage 'user_luutru':`, dlError.message);
        } else if (blob) {
          const arrBuf = await blob.arrayBuffer();
          fileData = arrayBufferToBase64(arrBuf);
          console.log(`[Storage] Đã đồng bộ thành công file mẫu từ Storage!`);
        }
      }
      
      try {
        localStorage.setItem(`template_file_${templateId}`, fileData);
      } catch (lsErr) {
        console.warn('LocalStorage is full or unavailable to cache template file:', lsErr);
      }
      return fileData;
    }
  } catch (e) {
    console.warn('Failed to fetch template fileData from Supabase on demand:', e);
  }
  
  return '';
}

export interface ColumnMapping {
  excelColumn: string; // ví dụ: 'A', 'B', 'C' hoặc tên placeholder như 'REPORT_ROWS'
  dataField: string; // ví dụ: 'THUONG_HIEU', 'CHIET_XUAT', 'TINH_NANG', 'SO_LUONG', 'LOAI', 'CAN', 'LOAN', etc.
  label?: string; // Tên nhãn để hiển thị, ví dụ: 'Thương hiệu'
  
  // Các thuộc tính Pivot tích hợp cho placeholder động dạng bảng:
  isPivot?: boolean;
  pivotSource?: 'PHIEU' | 'LIC_SU' | 'KIEM_KHO' | 'SAN_PHAM' | 'BANG_DO';
  pivotGroupBy?: string[];
  pivotAggregation?: 'SUM_SO_LUONG' | 'SUM_NHAP' | 'SUM_XUAT' | 'SUM_TON' | 'COUNT_SKU' | 'COUNT_CHUNG_TU' | 'SUM_GIA_TRI_NHAP' | 'SUM_GIA_TRI_XUAT';
  pivotSortBy?: string;
  pivotSortOrder?: 'ASC' | 'DESC';
  pivotFilters?: { field: string; operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN'; value: string }[];
}

export interface Template {
  id: string;
  name: string;
  type: 'EXCEL' | 'PDF';
  fileName: string;
  fileData: string; // Base64 or 'PRESET' or 'PRESET_DASHBOARD'
  isDefault: boolean;
  detectedPlaceholders: string[];
  description: string;
  createdAt: string;
  applicableReportTypes?: string[]; // e.g. ["Dashboard", "Tồn kho", "Xuất kho"]
  
  // Nâng cấp cấu hình mẫu báo cáo chi tiết / tổng hợp động:
  startRow?: number; // Dòng bắt đầu ghi dữ liệu chi tiết
  columnMappings?: ColumnMapping[]; // Bản đồ ánh xạ cột Excel ↔ Trường dữ liệu
  groupByFields?: string[]; // Mảng các trường để gom nhóm dữ liệu (nếu có)
}

export interface PlaceholderMapping {
  placeholder: string;
  sourceType: 'PHIEU' | 'DASHBOARD';
  sourceField: string;
  description: string;
}

// Bảng ánh xạ mặc định ban đầu
export const DEFAULT_MAPPINGS: PlaceholderMapping[] = [
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
  
  // Các placeholder vĩ mô mới nâng cấp
  { placeholder: 'TONG_SKU', sourceType: 'DASHBOARD', sourceField: 'totalSku', description: 'Tổng số lượng SKU sản phẩm trong kỳ lọc' },
  { placeholder: 'TONG_CHUNG_TU', sourceType: 'DASHBOARD', sourceField: 'totalChungTu', description: 'Tổng số lượng chứng từ phát sinh trong kỳ lọc' },
  { placeholder: 'CHIET_SUAT_BAN_CHAY', sourceType: 'DASHBOARD', sourceField: 'bestChietXuat', description: 'Chiết suất tròng kính bán chạy nhất' },
  { placeholder: 'TINH_NANG_BAN_CHAY', sourceType: 'DASHBOARD', sourceField: 'bestFeature', description: 'Tính năng tròng kính bán chạy nhất' },

  // Các placeholder phục vụ bộ lọc của Dashboard
  { placeholder: 'TU_NGAY', sourceType: 'DASHBOARD', sourceField: 'TU_NGAY', description: 'Khoảng thời gian bắt đầu lọc' },
  { placeholder: 'DEN_NGAY', sourceType: 'DASHBOARD', sourceField: 'DEN_NGAY', description: 'Khoảng thời gian kết thúc lọc' },
  { placeholder: 'LOC_CHI_NHANH', sourceType: 'DASHBOARD', sourceField: 'LOC_CHI_NHANH', description: 'Chi nhánh đang được lọc' },
  { placeholder: 'LOC_THUONG_HIEU', sourceType: 'DASHBOARD', sourceField: 'LOC_THUONG_HIEU', description: 'Thương hiệu đang được lọc' },
  { placeholder: 'LOC_TINH_NANG', sourceType: 'DASHBOARD', sourceField: 'LOC_TINH_NANG', description: 'Tính năng đang được lọc' },
  { placeholder: 'LOC_CHIET_SUAT', sourceType: 'DASHBOARD', sourceField: 'LOC_CHIET_SUAT', description: 'Chiết suất đang được lọc' },
  { placeholder: 'LOC_DO_CAN', sourceType: 'DASHBOARD', sourceField: 'LOC_DO_CAN', description: 'Độ cận đang được lọc' },
  { placeholder: 'LOC_DO_LOAN', sourceType: 'DASHBOARD', sourceField: 'LOC_DO_LOAN', description: 'Độ loạn đang được lọc' },
  
  { placeholder: 'DETAILS', sourceType: 'PHIEU', sourceField: 'DETAILS', description: 'Bảng chi tiết SKU sản phẩm trong phiếu' }
];

export const REPORT_TYPES = [
  'Dashboard',
  'Tồn kho',
  'Nhập kho',
  'Xuất kho',
  'Kiểm kho',
  'Phân tích độ bán chạy',
  'Heatmap',
  'Báo cáo chi nhánh',
  'Báo cáo thương hiệu'
];

/**
 * Hàm chuyển đổi chuỗi base64 thành ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Hàm chuyển đổi ArrayBuffer thành base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Hàm tính toán giá trị của các Placeholder dựa trên bộ lọc hiện tại của Dashboard
 */
export function calculateResolvedValues({
  startDate,
  endDate,
  selectedBranch,
  selectedBrandFilter,
  selectedFeatureFilter,
  selectedChietXuatFilter,
  salesDbSelectedSph,
  salesDbSelectedCyl,
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  customMappings = []
}: {
  startDate: string;
  endDate: string;
  selectedBranch: string;
  selectedBrandFilter: string;
  selectedFeatureFilter: string;
  selectedChietXuatFilter: string;
  salesDbSelectedSph: number | 'ALL';
  salesDbSelectedCyl: number | 'ALL';
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  customMappings?: PlaceholderMapping[];
}) {
  const values: Record<string, any> = {};

  // 1. Phục vụ bộ lọc tĩnh
  values['TU_NGAY'] = startDate;
  values['DEN_NGAY'] = endDate;
  values['LOC_CHI_NHANH'] = selectedBranch;
  values['LOC_THUONG_HIEU'] = selectedBrandFilter;
  values['LOC_TINH_NANG'] = selectedFeatureFilter;
  values['LOC_CHIET_SUAT'] = selectedChietXuatFilter;
  values['LOC_DO_CAN'] = salesDbSelectedSph === 'ALL' ? 'Tất cả' : salesDbSelectedSph.toFixed(2);
  values['LOC_DO_LOAN'] = salesDbSelectedCyl === 'ALL' ? 'Tất cả' : salesDbSelectedCyl.toFixed(2);

  // 2. Lọc dữ liệu thô phục vụ tính toán
  const activeHeaderIds = new Set(
    nhapXuats
      .filter(h => {
        if (h.TRANG_THAI === 'Đã hủy') return false;
        const matchBranch = selectedBranch === 'Tất cả' || h.CHI_NHANH === selectedBranch;
        const matchDate = h.NGAY >= startDate && h.NGAY <= endDate;
        return matchBranch && matchDate;
      })
      .map(h => h.HOA_DON)
  );

  const filteredDetails = nhapXuatCTs.filter(d => {
    if (!activeHeaderIds.has(d.HOA_DON)) return false;

    const matchBrand = selectedBrandFilter === 'Tất cả' || d.THUONG_HIEU === selectedBrandFilter;
    const matchFeature = selectedFeatureFilter === 'Tất cả' || d.TINH_NANG === selectedFeatureFilter;
    const matchChietXuat = selectedChietXuatFilter === 'Tất cả' || d.CHIET_XUAT === selectedChietXuatFilter;
    const matchSph = salesDbSelectedSph === 'ALL' || d.SPH === salesDbSelectedSph;
    const matchCyl = salesDbSelectedCyl === 'ALL' || d.CYL === salesDbSelectedCyl;

    return matchBrand && matchFeature && matchChietXuat && matchSph && matchCyl;
  });

  const filteredProducts = sanPhams.filter(p => {
    const matchBrand = selectedBrandFilter === 'Tất cả' || p.THUONG_HIEU === selectedBrandFilter;
    const matchFeature = selectedFeatureFilter === 'Tất cả' || p.TINH_NANG === selectedFeatureFilter;
    const matchChietXuat = selectedChietXuatFilter === 'Tất cả' || p.CHIET_XUAT === selectedChietXuatFilter;
    const matchSph = salesDbSelectedSph === 'ALL' || p.CAN === salesDbSelectedSph;
    const matchCyl = salesDbSelectedCyl === 'ALL' || p.LOAN === salesDbSelectedCyl;

    return matchBrand && matchFeature && matchChietXuat && matchSph && matchCyl;
  });

  // 3. Tính toán các chỉ số
  let totalNhap = 0;
  let totalXuat = 0;
  filteredDetails.forEach(d => {
    if (d.LOAI === 'NHẬP') totalNhap += d.SO_LUONG;
    if (d.LOAI === 'XUẤT') totalXuat += d.SO_LUONG;
  });

  values['totalNhap'] = totalNhap;
  values['totalXuat'] = totalXuat;
  values['TONG_NHAP'] = totalNhap;
  values['TONG_XUAT'] = totalXuat;
  values['totalXuatMonth'] = totalXuat;
  values['TONG_XUAT_THANG'] = totalXuat;

  const lowStockCount = filteredProducts.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU).length;
  values['lowStockCount'] = lowStockCount;
  values['TON_KHO'] = lowStockCount;

  // Thương hiệu bán chạy nhất
  const brandMap: Record<string, number> = {};
  filteredDetails.forEach(d => {
    if (d.LOAI === 'XUẤT') {
      brandMap[d.THUONG_HIEU] = (brandMap[d.THUONG_HIEU] || 0) + d.SO_LUONG;
    }
  });
  const bestBrand = Object.entries(brandMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
  values['bestBrand'] = bestBrand;
  values['THUONG_HIEU_BAN_CHAY'] = bestBrand;

  // Độ tròng kính bán chạy nhất
  const diopterMap: Record<string, number> = {};
  filteredDetails.forEach(d => {
    if (d.LOAI === 'XUẤT') {
      const key = `Cận ${d.SPH?.toFixed(2)} | Loạn ${d.CYL?.toFixed(2)}`;
      diopterMap[key] = (diopterMap[key] || 0) + d.SO_LUONG;
    }
  });
  const bestDiopter = Object.entries(diopterMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
  values['bestDiopter'] = bestDiopter;
  values['DO_BAN_CHAY'] = bestDiopter;

  // Chi nhánh xuất hàng nhiều nhất
  const branchMap: Record<string, number> = {};
  // Cần map branch từ nhapXuats thực tế khớp với details đã lọc
  const validHeaderIds = new Set(filteredDetails.map(d => d.HOA_DON));
  nhapXuats.forEach(h => {
    if (validHeaderIds.has(h.HOA_DON) && h.LOAI === 'XUẤT' && h.TRANG_THAI !== 'Đã hủy') {
      branchMap[h.CHI_NHANH] = (branchMap[h.CHI_NHANH] || 0) + h.TONG_SL;
    }
  });
  const topBranch = Object.entries(branchMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Tất cả cân bằng';
  values['topBranch'] = topBranch;
  values['TOP_CHI_NHANH'] = topBranch;

  // Tổng số lượng tồn kho toàn hệ thống (hoặc theo bộ lọc)
  const totalStock = filteredProducts.reduce((sum, p) => sum + (p.TON_CUOI || 0), 0);
  values['totalStock'] = totalStock;
  values['TONG_TON'] = totalStock;

  // NÂNG CẤP THÊM CÁC CHỈ SỐ MỚI
  // Tổng SKU
  const totalSku = filteredProducts.length;
  values['totalSku'] = totalSku;
  values['TONG_SKU'] = totalSku;

  // Tổng chứng từ thực tế sau lọc
  const activeDocIds = new Set(filteredDetails.map(d => d.HOA_DON));
  const totalChungTu = activeDocIds.size;
  values['totalChungTu'] = totalChungTu;
  values['TONG_CHUNG_TU'] = totalChungTu;

  // Chiết suất bán chạy nhất
  const cxMap: Record<string, number> = {};
  filteredDetails.forEach(d => {
    if (d.LOAI === 'XUẤT') {
      cxMap[d.CHIET_XUAT] = (cxMap[d.CHIET_XUAT] || 0) + d.SO_LUONG;
    }
  });
  const bestChietXuat = Object.entries(cxMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
  values['bestChietXuat'] = bestChietXuat;
  values['CHIET_SUAT_BAN_CHAY'] = bestChietXuat;

  // Tính năng bán chạy nhất
  const featMap: Record<string, number> = {};
  filteredDetails.forEach(d => {
    if (d.LOAI === 'XUẤT') {
      featMap[d.TINH_NANG] = (featMap[d.TINH_NANG] || 0) + d.SO_LUONG;
    }
  });
  const bestFeature = Object.entries(featMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa xác định';
  values['bestFeature'] = bestFeature;
  values['TINH_NANG_BAN_CHAY'] = bestFeature;

  // 4. Áp dụng thêm mapping tự cấu hình
  const allMappings = [...DEFAULT_MAPPINGS, ...customMappings];
  allMappings.forEach(m => {
    if (values[m.placeholder] === undefined) {
      values[m.placeholder] = values[m.sourceField] ?? '';
    }
  });

  return {
    resolvedValues: values,
    filteredDetails,
    filteredProducts
  };
}

/**
 * Hàm xuất báo cáo thực tế dựa trên Template cấu hình
 */
export async function exportReportByTemplate({
  template,
  resolvedValues,
  filteredDetails,
  filteredProducts,
  onDownload
}: {
  template: Template;
  resolvedValues: Record<string, any>;
  filteredDetails: NhapXuatCT[];
  filteredProducts: SanPham[];
  onDownload: (blob: Blob, fileName: string) => void;
}) {
  let arrayBuffer: ArrayBuffer;
  const ExcelJS = await getExcelJS();

  // 1. Phục hồi dữ liệu binary của mẫu
  if (template.id === 'default-phieu-xuat-excel' || template.fileData === 'PRESET') {
    // Biểu mẫu preset "Phiếu Xuất Kho chuẩn"
    const tempWorkbook = new ExcelJS.Workbook();
    const tempSheet = tempWorkbook.addWorksheet('Giao_Nhận');
    tempSheet.columns = [
      { width: 8 }, { width: 28 }, { width: 38 }, { width: 14 }, { width: 12 }, { width: 16 }
    ];
    
    tempSheet.mergeCells('A2:F2');
    const c2 = tempSheet.getCell('A2');
    c2.value = 'BÁO CÁO NHẬP / XUẤT KHO TRÒNG KÍNH CHI TIẾT';
    c2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    c2.alignment = { horizontal: 'center' };

    tempSheet.getCell('A4').value = 'Báo cáo từ ngày:';
    tempSheet.getCell('A4').font = { bold: true };
    tempSheet.getCell('B4').value = '{{TU_NGAY}}';

    tempSheet.getCell('D4').value = 'Đến ngày:';
    tempSheet.getCell('D4').font = { bold: true };
    tempSheet.getCell('E4').value = '{{DEN_NGAY}}';

    tempSheet.getCell('A5').value = 'Bộ lọc Chi nhánh:';
    tempSheet.getCell('A5').font = { bold: true };
    tempSheet.getCell('B5').value = '{{LOC_CHI_NHANH}}';

    tempSheet.getCell('D5').value = 'Bộ lọc Thương hiệu:';
    tempSheet.getCell('D5').font = { bold: true };
    tempSheet.getCell('E5').value = '{{LOC_THUONG_HIEU}}';

    tempSheet.getCell('A7').value = 'Tổng nhập trong kỳ: {{TONG_NHAP}}';
    tempSheet.getCell('A7').font = { color: { argb: 'FF059669' }, bold: true };
    tempSheet.getCell('D7').value = 'Tổng xuất trong kỳ: {{TONG_XUAT}}';
    tempSheet.getCell('D7').font = { color: { argb: 'FFDC2626' }, bold: true };

    const th = tempSheet.getRow(9);
    th.values = ['STT', 'Mã SKU', 'Tên sản phẩm', 'Số lượng', 'ĐVT', 'Loại giao dịch'];
    th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    th.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } });

    const tr = tempSheet.getRow(10);
    tr.values = ['{{DETAILS}}', '', '', '', '', ''];

    const buf = await tempWorkbook.xlsx.writeBuffer();
    arrayBuffer = buf;

    try {
      tempWorkbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (tempWorkbook as any)._worksheets = [];
    } catch (e) {}
  } else if (template.id === 'default-dashboard-excel' || template.fileData === 'PRESET_DASHBOARD') {
    // Biểu mẫu preset "Dashboard Tổng hợp"
    const tempWorkbook = new ExcelJS.Workbook();
    const tempSheet = tempWorkbook.addWorksheet('Thống_Kê');
    tempSheet.columns = [{ width: 35 }, { width: 35 }];

    tempSheet.mergeCells('A2:B2');
    const c2 = tempSheet.getCell('A2');
    c2.value = 'BÁO CÁO THỐNG KÊ KHO TRÒNG KÍNH TOÀN DIỆN';
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

    tempSheet.getCell('A8').value = 'CHI NHÁNH CÓ TOP XUẤT:';
    tempSheet.getCell('A8').font = { bold: true };
    tempSheet.getCell('B8').value = '{{TOP_CHI_NHANH}}';

    const buf = await tempWorkbook.xlsx.writeBuffer();
    arrayBuffer = buf;

    try {
      tempWorkbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (tempWorkbook as any)._worksheets = [];
    } catch (e) {}
  } else {
    const fileData = await fetchTemplateFileData(template.id);
    arrayBuffer = base64ToArrayBuffer(fileData);
  }

  // 2. Thay thế placeholders và xuất ra file tải xuống
  if (template.type === 'EXCEL') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    workbook.eachSheet((worksheet) => {
      // KIỂM TRA XEM CÓ CẤU HÌNH COLUMN MAPPINGS VÀ START ROW KHÔNG (CHẾ ĐỘ MỚI)
      const hasColumnMappings = template.columnMappings && template.columnMappings.length > 0 && template.startRow !== undefined;

      if (hasColumnMappings) {
        const startRow = template.startRow || 10;
        const colMappings = template.columnMappings || [];
        const isInventoryReport = template.applicableReportTypes?.includes('Tồn kho') || template.name.toLowerCase().includes('tồn');

        // Nhóm và tính toán dữ liệu
        const dataToRender = aggregateData({
          details: filteredDetails,
          products: filteredProducts,
          groupByFields: template.groupByFields || [],
          isInventory: isInventoryReport
        });

        // CACHE STYLES AND HEIGHT FROM startRow BEFORE INSERTIONS TO AVOID ROW-SHIFTING BUGS
        const templateRow = worksheet.getRow(startRow);
        const templateHeight = templateRow.height;
        const cachedStyles: any[] = [];
        templateRow.eachCell({ includeEmpty: true }, (c, colNum) => {
          cachedStyles[colNum] = c.style ? JSON.parse(JSON.stringify(c.style)) : undefined;
        });

        // Điền dữ liệu vào sheet theo mapping cột và dòng bắt đầu
        dataToRender.forEach((item, index) => {
          const rowNum = startRow + index;
          // Tạo/Chèn dòng mới tại vị trí rowNum để đẩy các dòng dưới xuống, giữ nguyên vẹn form chữ ký
          const row = worksheet.insertRow(rowNum, []);
          row.height = templateHeight;

          colMappings.forEach((map) => {
            const cell = row.getCell(map.excelColumn);
            if (map.dataField === 'STT') {
              cell.value = index + 1;
            } else {
              let val = item[map.dataField];
              if (map.dataField === 'SPH' || map.dataField === 'CAN') val = item.SPH ?? item.CAN;
              if (map.dataField === 'CYL' || map.dataField === 'LOAN') val = item.CYL ?? item.LOAN;
              cell.value = val !== undefined ? val : '';
            }
          });

          // Sao chép style từ cached styles
          cachedStyles.forEach((style, colNum) => {
            if (style) {
              const targetCell = row.getCell(colNum);
              targetCell.style = style;
            }
          });
        });

        // Xóa dòng mẫu ban đầu (dòng này đã bị dịch xuống phía dưới sau khi chèn các dòng dữ liệu)
        if (dataToRender.length > 0) {
          worksheet.spliceRows(startRow + dataToRender.length, 1);
        }
      } else {
        // CHẾ ĐỘ CŨ (Tương thích ngược 100% bằng cách tìm placeholder {{DETAILS}})
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

        // Bước B: Nếu có {{DETAILS}}, chèn các dòng chi tiết và sao chép định dạng
        if (detailsRowIndex !== -1) {
          const templateRow = worksheet.getRow(detailsRowIndex);
          const templateHeight = templateRow.height;
          
          // CACHE STYLES BEFORE ANY ROW INSERTIONS
          const cachedStyles: any[] = [];
          templateRow.eachCell({ includeEmpty: true }, (c, colNum) => {
            cachedStyles[colNum] = c.style ? JSON.parse(JSON.stringify(c.style)) : undefined;
          });

          templateRow.getCell(1).value = ''; // xóa placeholder

          // Tùy theo loại báo cáo, ta sẽ điền thông tin phù hợp
          const isInventoryReport = template.applicableReportTypes?.includes('Tồn kho') || template.name.toLowerCase().includes('tồn');
          
          if (isInventoryReport) {
            // Điền danh sách sản phẩm tồn kho
            filteredProducts.forEach((item, index) => {
              const insertIdx = detailsRowIndex + index;
              const newRow = worksheet.insertRow(insertIdx, [
                index + 1,
                item.SKU,
                item.TEN_SAN_PHAM,
                item.TON_CUOI,
                item.DVT || 'Cặp',
                item.THUONG_HIEU,
                item.CHIET_XUAT
              ]);

              newRow.height = templateHeight;
              cachedStyles.forEach((style, colNum) => {
                if (style) {
                  const targetCell = newRow.getCell(colNum);
                  targetCell.style = style;
                }
              });
            });
          } else {
            // Điền danh sách giao dịch chi tiết
            filteredDetails.forEach((item, index) => {
              const insertIdx = detailsRowIndex + index;
              const newRow = worksheet.insertRow(insertIdx, [
                index + 1,
                item.SKU,
                item.TEN_SP || (item as any).TEN_SAN_PHAM || '',
                item.SO_LUONG,
                item.DVT || 'Cặp',
                item.LOAI,
                (item as any).CHI_NHANH || ''
              ]);

              newRow.height = templateHeight;
              cachedStyles.forEach((style, colNum) => {
                if (style) {
                  const targetCell = newRow.getCell(colNum);
                  targetCell.style = style;
                }
              });
            });
          }

          // Xóa dòng mẫu gốc ban đầu
          const itemsLength = isInventoryReport ? filteredProducts.length : filteredDetails.length;
          if (itemsLength > 0) {
            worksheet.spliceRows(detailsRowIndex + itemsLength, 1);
          }
        }
      }

      // Bước C: Thay thế tất cả các placeholder tĩnh khác
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

    const outBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    onDownload(blob, `BaoCao_Excel_${template.fileName}`);

    // GC optimization: Clear large workbook objects
    try {
      workbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (workbook as any)._worksheets = [];
    } catch (e) {}
  } else {
    // PDF rendering using pdf-lib form filling - lazy loaded
    const PDFDocument = await getPDFDocument();
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

    // Điền chi tiết dạng text thô vào PDF nếu biểu mẫu có vùng text DETAILS
    if (fields.some(f => f.getName() === 'DETAILS')) {
      try {
        const detailField = form.getTextField('DETAILS');
        const isInventoryReport = template.applicableReportTypes?.includes('Tồn kho') || template.name.toLowerCase().includes('tồn');
        
        let detailsText = '';
        if (isInventoryReport) {
          detailsText = filteredProducts.map((item, idx) => 
            `${idx + 1}. ${item.SKU} | ${item.TEN_SAN_PHAM} | Tồn: ${item.TON_CUOI} ${item.DVT || 'Cặp'}`
          ).join('\n');
        } else {
          detailsText = filteredDetails.map((item, idx) => 
            `${idx + 1}. ${item.SKU} | ${item.TEN_SP || (item as any).TEN_SAN_PHAM} | SL: ${item.SO_LUONG} | Loại: ${item.LOAI}`
          ).join('\n');
        }
        detailField.setText(detailsText);
      } catch (e) {}
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    onDownload(blob, `BaoCao_PDF_${template.fileName}`);
  }
}

/**
 * Helper nhóm và tính toán tổng hợp dữ liệu (Group By)
 */
export function aggregateData({
  details,
  products,
  groupByFields,
  isInventory = false
}: {
  details: NhapXuatCT[];
  products: SanPham[];
  groupByFields: string[];
  isInventory?: boolean;
}) {
  if (!groupByFields || groupByFields.length === 0) {
    return isInventory ? products : details;
  }

  const groups: Record<string, any> = {};
  const sourceData = isInventory ? products : details;

  sourceData.forEach((item: any) => {
    // Tạo khóa gom nhóm dựa trên giá trị các trường được tích chọn
    const keyParts = groupByFields.map(f => {
      let val = item[f];
      if (f === 'SPH' || f === 'CAN') val = item.SPH ?? item.CAN;
      if (f === 'CYL' || f === 'LOAN') val = item.CYL ?? item.LOAN;
      return String(val !== undefined ? val : 'Tất cả').trim();
    });
    const groupKey = keyParts.join('|');

    if (!groups[groupKey]) {
      const initial: Record<string, any> = {};
      groupByFields.forEach(f => {
        let val = item[f];
        if (f === 'SPH' || f === 'CAN') val = item.SPH ?? item.CAN;
        if (f === 'CYL' || f === 'LOAN') val = item.CYL ?? item.LOAN;
        initial[f] = val;
      });

      // Khởi tạo các biến tính toán gom nhóm
      initial['SO_LUONG'] = 0;
      initial['SO_LUONG_NHAP'] = 0;
      initial['SO_LUONG_XUAT'] = 0;
      initial['TON_CUOI'] = 0;
      initial['TON_DAU'] = 0;
      initial['COUNT'] = 0;
      
      groups[groupKey] = initial;
    }

    const g = groups[groupKey];
    g.COUNT += 1;

    if (isInventory) {
      g.TON_CUOI += Number(item.TON_CUOI || 0);
      g.TON_DAU += Number(item.TON_DAU || 0);
      g.SO_LUONG += Number(item.TON_CUOI || 0);
    } else {
      g.SO_LUONG += Number(item.SO_LUONG || 0);
      if (item.LOAI === 'NHẬP') {
        g.SO_LUONG_NHAP += Number(item.SO_LUONG || 0);
      } else if (item.LOAI === 'XUẤT') {
        g.SO_LUONG_XUAT += Number(item.SO_LUONG || 0);
      }
    }

    // Các trường text bổ sung khác để hiển thị
    const fallbackFields = ['SKU', 'TEN_SP', 'TEN_SAN_PHAM', 'DVT', 'THUONG_HIEU', 'CHIET_XUAT', 'TINH_NANG', 'LOAI', 'NGAY', 'HOA_DON', 'CHI_NHANH'];
    fallbackFields.forEach(f => {
      if (g[f] === undefined) {
        g[f] = item[f];
      }
    });
  });

  return Object.values(groups);
}

/**
 * Hàm xuất dữ liệu thô (Raw Data) đẹp mắt sang file Excel
 */
export async function exportRawData({
  type,
  filteredDetails,
  filteredProducts,
  startDate,
  endDate,
  selectedBranch,
  onDownload
}: {
  type: 'EXCEL' | 'PDF';
  filteredDetails: NhapXuatCT[];
  filteredProducts: SanPham[];
  startDate: string;
  endDate: string;
  selectedBranch: string;
  onDownload: (blob: Blob, fileName: string) => void;
}) {
  if (type === 'EXCEL') {
    const ExcelJS = await getExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Dữ_Liệu_Thô_Giao_Dịch');

    // Thiết lập độ rộng cột hợp lý
    sheet.columns = [
      { width: 8 },  // STT
      { width: 14 }, // Ngày
      { width: 16 }, // Số phiếu
      { width: 22 }, // Chi nhánh
      { width: 24 }, // SKU
      { width: 32 }, // Tên sản phẩm
      { width: 16 }, // Thương hiệu
      { width: 12 }, // Chiết suất
      { width: 14 }, // Tính năng
      { width: 10 }, // Độ cầu
      { width: 10 }, // Độ loạn
      { width: 12 }, // Số lượng
      { width: 10 }, // ĐVT
      { width: 16 }, // Loại giao dịch
      { width: 25 }  // Ghi chú
    ];

    // Tiêu đề báo cáo
    sheet.mergeCells('A2:O2');
    const titleCell = sheet.getCell('A2');
    titleCell.value = 'BÁO CÁO KHO CHI TIẾT TRÒNG KÍNH (DỮ LIỆU THÔ)';
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:O3');
    const subtitleCell = sheet.getCell('A3');
    subtitleCell.value = `Khoảng thời gian: ${startDate} đến ${endDate} | Chi nhánh: ${selectedBranch}`;
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF475569' } };
    subtitleCell.alignment = { horizontal: 'center' };

    // Header bảng
    const headerRow = sheet.getRow(5);
    headerRow.values = [
      'STT', 'Ngày', 'Số phiếu', 'Chi nhánh', 'SKU', 'Tên sản phẩm',
      'Thương hiệu', 'Chiết suất', 'Tính năng', 'Độ cầu SPH', 'Độ loạn CYL',
      'Số lượng', 'ĐVT', 'Loại', 'Ghi chú'
    ];
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
        left: { style: 'thin', color: { argb: 'FF1D4ED8' } },
        right: { style: 'thin', color: { argb: 'FF1D4ED8' } }
      };
    });

    // Điền dữ liệu chi tiết
    filteredDetails.forEach((d, idx) => {
      const row = sheet.addRow([
        idx + 1,
        d.NGAY,
        d.HOA_DON,
        d.LOAI === 'KIỂM KHO' ? 'Kho kiểm kê' : (d as any).CHI_NHANH || selectedBranch,
        d.SKU,
        d.TEN_SP || '',
        d.THUONG_HIEU || '',
        d.CHIET_XUAT || '',
        d.TINH_NANG || '',
        d.SPH !== undefined ? Number(d.SPH).toFixed(2) : '0.00',
        d.CYL !== undefined ? Number(d.CYL).toFixed(2) : '0.00',
        d.SO_LUONG,
        d.DVT || 'Cặp',
        d.LOAI,
        d.GHI_CHU || ''
      ]);

      row.height = 22;
      row.font = { name: 'Segoe UI', size: 9.5 };
      row.eachCell((cell, colNum) => {
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        // Căn lề thích hợp
        if ([1, 2, 3, 10, 11, 12, 13, 14].includes(colNum)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    onDownload(blob, `Du_Lieu_Tho_Giao_Dich_${selectedBranch.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.xlsx`);

    // GC optimization: Clear large workbook objects
    try {
      workbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (workbook as any)._worksheets = [];
    } catch (e) {}
  } else {
    window.print();
  }
}

const FIELDS_BY_SOURCE_LOCAL: Record<string, { key: string; label: string }[]> = {
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

export function getFilteredSourceData({
  source,
  startDate,
  endDate,
  branch,
  sanPhams,
  nhapXuats,
  nhapXuatCTs
}: {
  source: string;
  startDate: string;
  endDate: string;
  branch: string;
  sanPhams: any[];
  nhapXuats: any[];
  nhapXuatCTs: any[];
}) {
  const filteredHeaders = nhapXuats.filter(h => {
    if (h.TRANG_THAI === 'Đã hủy') return false;
    const matchBranch = branch === 'Tất cả' || h.CHI_NHANH === branch;
    const matchDate = h.NGAY >= startDate && h.NGAY <= endDate;
    return matchBranch && matchDate;
  });
  const headerIds = new Set(filteredHeaders.map(h => h.HOA_DON));

  const filteredDetails = nhapXuatCTs.filter(d => headerIds.has(d.HOA_DON));

  switch (source) {
    case 'PHIEU':
    case 'LIC_SU': {
      return filteredDetails.map((d, index) => {
        const h = nhapXuats.find(x => x.HOA_DON === d.HOA_DON);
        const tDau = sanPhams.find(p => p.SKU === d.SKU)?.TON_DAU ?? 0;
        const tCuoi = sanPhams.find(p => p.SKU === d.SKU)?.TON_CUOI ?? 0;
        return {
          STT: index + 1,
          HOA_DON: d.HOA_DON,
          NGAY: d.NGAY,
          CHI_NHANH: h?.CHI_NHANH || '',
          KHO: h?.CHI_NHANH || '',
          TEN_NGUOI_TAO: h?.TEN_NGUOI_TAO || 'Chủ cửa hàng',
          LOAI: d.LOAI,
          SKU: d.SKU,
          TEN_SP: d.TEN_SP,
          TEN_SAN_PHAM: d.TEN_SP,
          THUONG_HIEU: d.THUONG_HIEU,
          CHIET_XUAT: d.CHIET_XUAT,
          CHIET_SUAT: d.CHIET_XUAT,
          TINH_NANG: d.TINH_NANG,
          SPH: d.SPH,
          CAN: d.SPH,
          CYL: d.CYL,
          LOAN: d.CYL,
          SO_LUONG: d.SO_LUONG,
          DVT: d.DVT || 'Cặp',
          GHI_CHU: d.GHI_CHU || h?.GHI_CHU || '',
          TON_DAU: tDau,
          TON_CUOI: tCuoi,
          TONG_TON: tCuoi,
          TONG_NHAP: d.LOAI === 'NHẬP' ? d.SO_LUONG : 0,
          TONG_XUAT: d.LOAI === 'XUẤT' ? d.SO_LUONG : 0,
          SO_CHUNG_TU: 1,
          TONG_CHUNG_TU: 1,
          SO_SKU: 1,
          TONG_SKU: 1,
        };
      });
    }
    case 'KIEM_KHO': {
      let audits: any[] = [];
      const saved = localStorage.getItem('B_KIEMKHO');
      if (saved) {
        try { audits = JSON.parse(saved); } catch (e) { console.error(e); }
      }
      const filteredAudits = audits.filter(a => {
        const matchBranch = branch === 'Tất cả' || a.KHO === branch || a.CHI_NHANH === branch;
        const matchDate = a.THOI_DIEM && a.THOI_DIEM.substring(0, 10) >= startDate && a.THOI_DIEM.substring(0, 10) <= endDate;
        return matchBranch && matchDate;
      });
      return filteredAudits.map((a, index) => {
        const p = sanPhams.find(x => x.SKU === a.SKU);
        return {
          STT: index + 1,
          MA_PHIEU: a.MA_PHIEU || '',
          HOA_DON: a.MA_PHIEU || '',
          SKU: a.SKU,
          TEN_SP: p?.TEN_SAN_PHAM || a.TEN_SP || '',
          TEN_SAN_PHAM: p?.TEN_SAN_PHAM || a.TEN_SP || '',
          THUONG_HIEU: p?.THUONG_HIEU || '',
          CHIET_XUAT: p?.CHIET_XUAT || '',
          CHIET_SUAT: p?.CHIET_XUAT || '',
          TINH_NANG: p?.TINH_NANG || '',
          SPH: p?.CAN ?? 0,
          CAN: p?.CAN ?? 0,
          CYL: p?.LOAN ?? 0,
          LOAN: p?.LOAN ?? 0,
          TON_HE_THONG: a.TON_HE_THONG ?? 0,
          TON_THUC_TE: a.TON_THUC_TE ?? 0,
          LECH: a.LECH ?? 0,
          LOAI_BU: a.LOAI_BU || '',
          NGUOI_KIEM: a.NGUOI_KIEM || '',
          TEN_NGUOI_TAO: a.NGUOI_KIEM || '',
          THOI_DIEM: a.THOI_DIEM || '',
          KHO: a.KHO || a.CHI_NHANH || '',
          CHI_NHANH: a.KHO || a.CHI_NHANH || '',
          SO_LUONG: a.TON_THUC_TE ?? 0,
          TON_DAU: p?.TON_DAU ?? 0,
          TON_CUOI: a.TON_THUC_TE ?? 0,
          TONG_TON: a.TON_THUC_TE ?? 0,
          TONG_NHAP: 0,
          TONG_XUAT: 0,
          SO_CHUNG_TU: 1,
          TONG_CHUNG_TU: 1,
          SO_SKU: 1,
          TONG_SKU: 1,
        };
      });
    }
    case 'SAN_PHAM': {
      return sanPhams.map((p, index) => ({
        STT: index + 1,
        SKU: p.SKU,
        TEN_SAN_PHAM: p.TEN_SAN_PHAM,
        TEN_SP: p.TEN_SAN_PHAM,
        THUONG_HIEU: p.THUONG_HIEU,
        CHIET_XUAT: p.CHIET_XUAT,
        CHIET_SUAT: p.CHIET_XUAT,
        TINH_NANG: p.TINH_NANG,
        CAN: p.CAN,
        SPH: p.CAN,
        LOAN: p.LOAN,
        CYL: p.LOAN,
        DVT: p.DVT || 'Cặp',
        TON_DAU: p.TON_DAU || 0,
        NHAP: p.NHAP || 0,
        TONG_NHAP: p.NHAP || 0,
        XUAT: p.XUAT || 0,
        TONG_XUAT: p.XUAT || 0,
        TON_CUOI: p.TON_CUOI || 0,
        TONG_TON: p.TON_CUOI || 0,
        TON_TOI_THIEU: p.TON_TOI_THIEU || 0,
        SO_CHUNG_TU: 1,
        TONG_CHUNG_TU: 1,
        SO_SKU: 1,
        TONG_SKU: 1,
        SO_LUONG: p.TON_CUOI || 0,
      }));
    }
    case 'BANG_DO': {
      return sanPhams
        .filter(p => p.CAN !== 0 || p.LOAN !== 0)
        .map((p, index) => ({
          STT: index + 1,
          CAN: p.CAN,
          SPH: p.CAN,
          LOAN: p.LOAN,
          CYL: p.LOAN,
          SKU: p.SKU,
          TEN_SAN_PHAM: p.TEN_SAN_PHAM,
          TEN_SP: p.TEN_SAN_PHAM,
          THUONG_HIEU: p.THUONG_HIEU,
          TON_CUOI: p.TON_CUOI || 0,
          TONG_TON: p.TON_CUOI || 0,
          CHIET_SUAT: p.CHIET_XUAT,
          CHIET_XUAT: p.CHIET_XUAT,
          TINH_NANG: p.TINH_NANG,
          TON_DAU: p.TON_DAU || 0,
          TONG_NHAP: p.NHAP || 0,
          TONG_XUAT: p.XUAT || 0,
          SO_CHUNG_TU: 1,
          TONG_CHUNG_TU: 1,
          SO_SKU: 1,
          TONG_SKU: 1,
          SO_LUONG: p.TON_CUOI || 0,
        }));
    }
    case 'DASHBOARD': {
      const totalNhap = filteredDetails.reduce((sum, d) => d.LOAI === 'NHẬP' ? sum + d.SO_LUONG : sum, 0);
      const totalXuat = filteredDetails.reduce((sum, d) => d.LOAI === 'XUẤT' ? sum + d.SO_LUONG : sum, 0);
      const totalStock = sanPhams.reduce((sum, p) => sum + (p.TON_CUOI || 0), 0);

      const brandMap: Record<string, number> = {};
      filteredDetails.forEach(d => {
        if (d.LOAI === 'XUẤT') brandMap[d.THUONG_HIEU] = (brandMap[d.THUONG_HIEU] || 0) + d.SO_LUONG;
      });
      const bestBrand = Object.entries(brandMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có';

      const cxMap: Record<string, number> = {};
      filteredDetails.forEach(d => {
        if (d.LOAI === 'XUẤT') cxMap[d.CHIET_XUAT] = (cxMap[d.CHIET_XUAT] || 0) + d.SO_LUONG;
      });
      const bestChietXuat = Object.entries(cxMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có';

      const featMap: Record<string, number> = {};
      filteredDetails.forEach(d => {
        if (d.LOAI === 'XUẤT') featMap[d.TINH_NANG] = (featMap[d.TINH_NANG] || 0) + d.SO_LUONG;
      });
      const bestFeature = Object.entries(featMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa có';

      return [{
        STT: 1,
        TONG_NHAP: totalNhap,
        TONG_XUAT: totalXuat,
        TONG_TON: totalStock,
        THUONG_HIEU_BAN_CHAY: bestBrand,
        CHIET_SUAT_BAN_CHAY: bestChietXuat,
        TINH_NANG_BAN_CHAY: bestFeature,
        DO_BAN_CHAY: 'Cận -2.00 | Loạn -0.50',
        TOP_CHI_NHANH: branch !== 'Tất cả' ? branch : 'Kho Trung Tâm',
        TONG_SKU: sanPhams.length,
        TONG_CHUNG_TU: headerIds.size,
        TU_NGAY: startDate,
        DEN_NGAY: endDate,
        LOC_CHI_NHANH: branch,
      }];
    }
    default:
      return [];
  }
}

/**
 * Hàm tính toán dữ liệu Pivot tổng hợp động cho một Placeholder cụ thể
 */
export function computePivotData({
  config,
  startDate,
  endDate,
  branch,
  sanPhams,
  nhapXuats,
  nhapXuatCTs
}: {
  config: {
    placeholder: string;
    source: 'PHIEU' | 'LIC_SU' | 'KIEM_KHO' | 'SAN_PHAM' | 'BANG_DO';
    groupByFields: string[];
    aggregationType: 'SUM_SO_LUONG' | 'SUM_NHAP' | 'SUM_XUAT' | 'SUM_TON' | 'COUNT_SKU' | 'COUNT_CHUNG_TU' | 'SUM_GIA_TRI_NHAP' | 'SUM_GIA_TRI_XUAT';
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
    filters?: { field: string; operator: 'EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN'; value: string }[];
  };
  startDate: string;
  endDate: string;
  branch: string;
  sanPhams: any[];
  nhapXuats: any[];
  nhapXuatCTs: any[];
}) {
  // 1. Lấy dữ liệu nguồn đã lọc theo ngày & chi nhánh
  let data: any[] = getFilteredSourceData({
    source: config.source,
    startDate,
    endDate,
    branch,
    sanPhams,
    nhapXuats,
    nhapXuatCTs
  });

  // 2. Áp dụng bộ lọc bổ sung (nếu có)
  if (config.filters && config.filters.length > 0) {
    data = data.filter(item => {
      return config.filters!.every(f => {
        if (!f.field || !f.operator) return true;
        const val = String(item[f.field] ?? '').toLowerCase();
        const filterVal = String(f.value ?? '').toLowerCase();
        switch (f.operator) {
          case 'EQUALS': return val === filterVal;
          case 'CONTAINS': return val.includes(filterVal);
          case 'GREATER_THAN': return Number(item[f.field]) > Number(f.value);
          case 'LESS_THAN': return Number(item[f.field]) < Number(f.value);
          default: return true;
        }
      });
    });
  }

  // 3. Thực hiện Group By
  const groups: Record<string, any> = {};
  data.forEach((item: any) => {
    const keyParts = config.groupByFields.map(f => {
      let val = item[f];
      if (f === 'SPH' || f === 'CAN') val = item.SPH ?? item.CAN;
      if (f === 'CYL' || f === 'LOAN') val = item.CYL ?? item.LOAN;
      return String(val !== undefined ? val : 'Tất cả').trim();
    });
    const groupKey = keyParts.join('|') || 'ALL';

    if (!groups[groupKey]) {
      const initial: Record<string, any> = {};
      config.groupByFields.forEach(f => {
        let val = item[f];
        if (f === 'SPH' || f === 'CAN') val = item.SPH ?? item.CAN;
        if (f === 'CYL' || f === 'LOAN') val = item.CYL ?? item.LOAN;
        initial[f] = val;
      });

      initial['_skus'] = new Set<string>();
      initial['_docs'] = new Set<string>();
      initial['SO_LUONG'] = 0;
      initial['NHAP'] = 0;
      initial['XUAT'] = 0;
      initial['TON_CUOI'] = 0;
      initial['GIA_TRI_NHAP'] = 0;
      initial['GIA_TRI_XUAT'] = 0;

      groups[groupKey] = initial;
    }

    const g = groups[groupKey];
    if (item.SKU) g._skus.add(item.SKU);
    if (item.HOA_DON) g._docs.add(item.HOA_DON);
    if (item.MA_PHIEU) g._docs.add(item.MA_PHIEU);

    const sl = Number(item.SO_LUONG || 0);
    g.SO_LUONG += sl;

    if (config.source === 'SAN_PHAM') {
      g.NHAP += Number(item.NHAP || 0);
      g.XUAT += Number(item.XUAT || 0);
      g.TON_CUOI += Number(item.TON_CUOI || 0);
      g.GIA_TRI_NHAP += Number(item.NHAP || 0) * 120000;
      g.GIA_TRI_XUAT += Number(item.XUAT || 0) * 150000;
    } else if (config.source === 'PHIEU' || config.source === 'LIC_SU') {
      if (item.LOAI === 'NHẬP') {
        g.NHAP += sl;
        g.GIA_TRI_NHAP += sl * 120000;
      } else if (item.LOAI === 'XUẤT') {
        g.XUAT += sl;
        g.GIA_TRI_XUAT += sl * 150000;
      }
      g.TON_CUOI += Number(item.TON_CUOI || 0);
    } else if (config.source === 'BANG_DO') {
      g.TON_CUOI += Number(item.TON_CUOI || 0);
    } else if (config.source === 'KIEM_KHO') {
      g.TON_CUOI += Number(item.TON_THUC_TE || 0);
      g.SO_LUONG += Math.abs(Number(item.LECH || 0));
    }
  });

  const results = Object.values(groups).map((g: any) => {
    const record: Record<string, any> = {};
    
    config.groupByFields.forEach(f => {
      record[f] = g[f];
    });

    switch (config.aggregationType) {
      case 'SUM_SO_LUONG':
        record['VALUE'] = g.SO_LUONG;
        record['SO_LUONG'] = g.SO_LUONG;
        break;
      case 'SUM_NHAP':
        record['VALUE'] = g.NHAP;
        record['SO_LUONG'] = g.NHAP;
        break;
      case 'SUM_XUAT':
        record['VALUE'] = g.XUAT;
        record['SO_LUONG'] = g.XUAT;
        break;
      case 'SUM_TON':
        record['VALUE'] = g.TON_CUOI;
        record['SO_LUONG'] = g.TON_CUOI;
        break;
      case 'COUNT_SKU':
        record['VALUE'] = g._skus.size;
        record['SO_LUONG'] = g._skus.size;
        break;
      case 'COUNT_CHUNG_TU':
        record['VALUE'] = g._docs.size;
        record['SO_LUONG'] = g._docs.size;
        break;
      case 'SUM_GIA_TRI_NHAP':
        record['VALUE'] = g.GIA_TRI_NHAP;
        record['SO_LUONG'] = g.GIA_TRI_NHAP;
        break;
      case 'SUM_GIA_TRI_XUAT':
        record['VALUE'] = g.GIA_TRI_XUAT;
        record['SO_LUONG'] = g.GIA_TRI_XUAT;
        break;
      default:
        record['VALUE'] = g.SO_LUONG;
        record['SO_LUONG'] = g.SO_LUONG;
        break;
    }

    record['DVT'] = 'Cặp';
    return record;
  });

  if (config.sortBy) {
    const order = config.sortOrder === 'DESC' ? -1 : 1;
    const field = config.sortBy;
    results.sort((a, b) => {
      const va = a[field] ?? a['VALUE'] ?? 0;
      const vb = b[field] ?? b['VALUE'] ?? 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * order;
      }
      return String(va).localeCompare(String(vb)) * order;
    });
  } else {
    results.sort((a, b) => (b['VALUE'] ?? 0) - (a['VALUE'] ?? 0));
  }

  results.forEach((r, idx) => {
    r['STT'] = idx + 1;
  });

  return results;
}

function getStandardDetailsValue(source: string, colNum: number, record: any, index: number): any {
  if (source === 'SAN_PHAM') {
    switch (colNum) {
      case 1: return index + 1;
      case 2: return record.SKU || '';
      case 3: return record.TEN_SAN_PHAM || '';
      case 4: return record.TON_CUOI ?? 0;
      case 5: return record.DVT || 'Cặp';
      case 6: return record.THUONG_HIEU || '';
      case 7: return record.CHIET_XUAT || '';
      default: return '';
    }
  } else if (source === 'KIEM_KHO') {
    switch (colNum) {
      case 1: return index + 1;
      case 2: return record.MA_PHIEU || '';
      case 3: return record.SKU || '';
      case 4: return record.TEN_SP || record.TEN_SAN_PHAM || '';
      case 5: return record.TON_HE_THONG ?? 0;
      case 6: return record.TON_THUC_TE ?? 0;
      case 7: return record.LECH ?? 0;
      case 8: return record.LOAI_BU || '';
      default: return '';
    }
  } else if (source === 'BANG_DO') {
    switch (colNum) {
      case 1: return index + 1;
      case 2: return record.CAN ?? 0;
      case 3: return record.LOAN ?? 0;
      case 4: return record.SKU || '';
      case 5: return record.TEN_SAN_PHAM || '';
      case 6: return record.THUONG_HIEU || '';
      case 7: return record.TON_CUOI ?? 0;
      default: return '';
    }
  } else {
    // Default / PHIEU / LIC_SU
    switch (colNum) {
      case 1: return index + 1;
      case 2: return record.SKU || '';
      case 3: return record.TEN_SP || record.TEN_SAN_PHAM || '';
      case 4: return record.SO_LUONG ?? 0;
      case 5: return record.DVT || 'Cặp';
      case 6: return record.LOAI || '';
      case 7: return record.CHI_NHANH || '';
      default: return '';
    }
  }
}

export function getFullyFilteredDashboardData({
  source,
  startDate,
  endDate,
  selectedBranch,
  selectedBrandFilter,
  selectedFeatureFilter,
  selectedChietXuatFilter,
  salesDbSelectedSph,
  salesDbSelectedCyl,
  sanPhams,
  nhapXuats,
  nhapXuatCTs
}: {
  source: string;
  startDate: string;
  endDate: string;
  selectedBranch: string;
  selectedBrandFilter: string;
  selectedFeatureFilter: string;
  selectedChietXuatFilter: string;
  salesDbSelectedSph: number | 'ALL';
  salesDbSelectedCyl: number | 'ALL';
  sanPhams: any[];
  nhapXuats: any[];
  nhapXuatCTs: any[];
}) {
  const baseData = getFilteredSourceData({
    source,
    startDate,
    endDate,
    branch: selectedBranch,
    sanPhams,
    nhapXuats,
    nhapXuatCTs
  });

  return baseData.filter(item => {
    const obj = item as any;
    // 1. Thương hiệu
    if (selectedBrandFilter !== 'Tất cả' && obj.THUONG_HIEU !== undefined) {
      if (obj.THUONG_HIEU !== selectedBrandFilter) return false;
    }
    // 2. Tính năng
    if (selectedFeatureFilter !== 'Tất cả' && obj.TINH_NANG !== undefined) {
      if (obj.TINH_NANG !== selectedFeatureFilter) return false;
    }
    // 3. Chiết suất (hỗ trợ cả CHIET_XUAT và CHIET_SUAT)
    if (selectedChietXuatFilter !== 'Tất cả') {
      const cx = obj.CHIET_XUAT !== undefined ? obj.CHIET_XUAT : obj.CHIET_SUAT;
      if (cx !== undefined && cx !== selectedChietXuatFilter) return false;
    }
    // 4. Độ cận (SPH / CAN)
    if (salesDbSelectedSph !== 'ALL') {
      const sph = obj.SPH !== undefined ? obj.SPH : obj.CAN;
      if (sph !== undefined && sph !== salesDbSelectedSph) return false;
    }
    // 5. Độ loạn (CYL / LOAN)
    if (salesDbSelectedCyl !== 'ALL') {
      const cyl = obj.CYL !== undefined ? obj.CYL : obj.LOAN;
      if (cyl !== undefined && cyl !== salesDbSelectedCyl) return false;
    }
    return true;
  });
}

export function groupAndAggregateData({
  data,
  groupByFields
}: {
  data: any[];
  groupByFields: string[];
}) {
  if (!groupByFields || groupByFields.length === 0) {
    return data;
  }

  // Chuẩn hóa groupByFields (ví dụ, chuyển đổi CHIET_SUAT thành CHIET_XUAT hoặc ngược lại nếu cần)
  const normalizedGroupBy = groupByFields.map(field => {
    if (field === 'CHIET_SUAT') return 'CHIET_XUAT';
    if (field === 'CAN') return 'SPH';
    if (field === 'LOAN') return 'CYL';
    if (field === 'VIEN') return 'SPH';
    return field;
  });

  const groups: Record<string, any> = {};

  data.forEach((item: any) => {
    // Trích xuất các giá trị trường gom nhóm để làm khóa
    const keyParts = normalizedGroupBy.map(field => {
      let val = item[field];
      if (field === 'CHIET_XUAT' || field === 'CHIET_SUAT') {
        val = item.CHIET_XUAT ?? item.CHIET_SUAT;
      } else if (field === 'SPH' || field === 'CAN' || field === 'VIEN') {
        val = item.SPH ?? item.CAN;
      } else if (field === 'CYL' || field === 'LOAN') {
        val = item.CYL ?? item.LOAN;
      }
      return String(val !== undefined && val !== null ? val : 'Tất cả').trim();
    });
    const groupKey = keyParts.join('|');

    if (!groups[groupKey]) {
      const initial: Record<string, any> = {};
      
      // Giữ nguyên các giá trị thuộc trường gom nhóm
      normalizedGroupBy.forEach(field => {
        let val = item[field];
        if (field === 'CHIET_XUAT' || field === 'CHIET_SUAT') {
          val = item.CHIET_XUAT ?? item.CHIET_SUAT;
        } else if (field === 'SPH' || field === 'CAN' || field === 'VIEN') {
          val = item.SPH ?? item.CAN;
        } else if (field === 'CYL' || field === 'LOAN') {
          val = item.CYL ?? item.LOAN;
        }
        initial[field] = val;
        // Đảm bảo có cả hai biến thể tiếng Việt/Anh để các placeholder khớp thành công
        if (field === 'CHIET_XUAT') initial['CHIET_SUAT'] = val;
        if (field === 'CHIET_SUAT') initial['CHIET_XUAT'] = val;
        if (field === 'SPH') {
          initial['CAN'] = val;
          initial['VIEN'] = val;
        }
        if (field === 'CAN') {
          initial['SPH'] = val;
          initial['VIEN'] = val;
        }
        if (field === 'VIEN') {
          initial['SPH'] = val;
          initial['CAN'] = val;
        }
        if (field === 'CYL') initial['LOAN'] = val;
        if (field === 'LOAN') initial['CYL'] = val;
      });

      // Khởi tạo các biến tích lũy tổng hợp
      initial['SO_LUONG'] = 0;
      initial['SO_LUONG_NHAP'] = 0;
      initial['SO_LUONG_XUAT'] = 0;
      initial['TON_DAU'] = 0;
      initial['TON_CUOI'] = 0;
      initial['TON_KHO'] = 0;
      initial['COUNT'] = 0;
      initial['VALUE'] = 0;

      // Hỗ trợ cấu trúc lưu trữ SKUs/Documents duy nhất để tính tổng hợp đúng
      initial['_skus'] = new Map<string, { TON_CUOI: number; TON_DAU: number }>();
      initial['_uniqueChungTus'] = new Set<string>();
      initial['_uniqueSkus'] = new Set<string>();

      // Các trường text bổ sung khác để hiển thị
      const fallbackFields = ['TEN_SP', 'TEN_SAN_PHAM', 'DVT', 'THUONG_HIEU', 'CHIET_XUAT', 'CHIET_SUAT', 'TINH_NANG', 'LOAI', 'NGAY', 'HOA_DON', 'CHI_NHANH', 'MA_PHIEU'];
      fallbackFields.forEach(f => {
        if (initial[f] === undefined) {
          initial[f] = item[f];
        }
      });

      groups[groupKey] = initial;
    }

    const g = groups[groupKey];
    g.COUNT += 1;

    // Aggregations (SUM)
    g.SO_LUONG += Number(item.SO_LUONG || 0);
    g.SO_LUONG_NHAP += Number(item.SO_LUONG_NHAP || (item.LOAI === 'NHẬP' ? item.SO_LUONG : 0) || 0);
    g.SO_LUONG_XUAT += Number(item.SO_LUONG_XUAT || (item.LOAI === 'XUẤT' ? item.SO_LUONG : 0) || 0);
    g.VALUE += Number(item.VALUE || item.SO_LUONG || 0);

    // Thu thập SKUs duy nhất trong group để tính tổng lượng tồn kho chính xác, không lặp lại
    if (item.SKU) {
      g._skus.set(item.SKU, {
        TON_CUOI: Number(item.TON_CUOI ?? item.TON_KHO ?? 0),
        TON_DAU: Number(item.TON_DAU ?? 0)
      });
      g._uniqueSkus.add(item.SKU);
    }
    
    if (item.HOA_DON) g._uniqueChungTus.add(item.HOA_DON);
    if (item.MA_PHIEU) g._uniqueChungTus.add(item.MA_PHIEU);
  });

  // Chuyển kết quả sang mảng và gán số thứ tự (STT)
  return Object.values(groups).map((g: any, index) => {
    g.STT = index + 1;

    // Tính tổng tồn chính xác không lặp cho group
    let totalTonCuoi = 0;
    let totalTonDau = 0;
    g._skus.forEach((val: any) => {
      totalTonCuoi += val.TON_CUOI;
      totalTonDau += val.TON_DAU;
    });

    g.TON_CUOI = totalTonCuoi;
    g.TON_DAU = totalTonDau;
    g.TON_KHO = totalTonCuoi;
    g.TONG_TON = totalTonCuoi;
    g.TONG_DAU = totalTonDau;

    g.TONG_NHAP = g.SO_LUONG_NHAP;
    g.NHAP = g.SO_LUONG_NHAP;
    g.TONG_XUAT = g.SO_LUONG_XUAT;
    g.XUAT = g.SO_LUONG_XUAT;

    // Đếm số lượng duy nhất
    g.SO_CHUNG_TU = g._uniqueChungTus.size;
    g.TONG_CHUNG_TU = g.SO_CHUNG_TU;
    g.SO_SKU = g._uniqueSkus.size;
    g.TONG_SKU = g.SO_SKU;

    // Dọn dẹp trường phụ trợ
    delete g._skus;
    delete g._uniqueChungTus;
    delete g._uniqueSkus;

    if (!g.TEN_SP && !g.TEN_SAN_PHAM) {
      g.TEN_SP = `Tổng hợp ${g.THUONG_HIEU || ''} ${g.CHIET_SUAT || g.CHIET_XUAT || ''} ${g.TINH_NANG || ''}`.trim();
      g.TEN_SAN_PHAM = g.TEN_SP;
    }
    if (!g.VALUE) {
      g.VALUE = g.SO_LUONG;
    }
    return g;
  });
}

export async function exportReportWithFilters({
  template,
  startDate,
  endDate,
  selectedBranch,
  selectedBrandFilter,
  selectedFeatureFilter,
  selectedChietXuatFilter,
  salesDbSelectedSph = 'ALL',
  salesDbSelectedCyl = 'ALL',
  sanPhams,
  nhapXuats,
  nhapXuatCTs,
  onTriggerToast,
  onDownload
}: {
  template: Template;
  startDate: string;
  endDate: string;
  selectedBranch: string;
  selectedBrandFilter: string;
  selectedFeatureFilter: string;
  selectedChietXuatFilter: string;
  salesDbSelectedSph?: number | 'ALL';
  salesDbSelectedCyl?: number | 'ALL';
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  onTriggerToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
  onDownload: (blob: Blob, fileName: string) => void;
}) {
  // 1. Calculate resolved values
  const { resolvedValues } = calculateResolvedValues({
    startDate,
    endDate,
    selectedBranch,
    selectedBrandFilter,
    selectedFeatureFilter,
    selectedChietXuatFilter,
    salesDbSelectedSph,
    salesDbSelectedCyl,
    sanPhams,
    nhapXuats,
    nhapXuatCTs
  });

  // 2. Prepare dynamic records based on template's main source
  const source = template.applicableReportTypes?.[0] || 'PHIEU';
  const previewData = getFullyFilteredDashboardData({
    source,
    startDate,
    endDate,
    selectedBranch,
    selectedBrandFilter,
    selectedFeatureFilter,
    selectedChietXuatFilter,
    salesDbSelectedSph,
    salesDbSelectedCyl,
    sanPhams,
    nhapXuats,
    nhapXuatCTs
  });

  // DEBUG LOGS BEFORE EXPORT
  console.log("================= DEBUG EXPORT ENGINE =================");
  console.log("1. MAPPED COLUMNS (Danh sách cột đã cấu hình):");
  if (template.columnMappings && template.columnMappings.length > 0) {
    template.columnMappings.forEach((m, idx) => {
      console.log(`   - Cột ${idx + 1}: Label: "${m.label}" | Excel Placeholder: "{{${m.excelColumn}}}" | Data Field: "${m.dataField || ''}" | Is Pivot: ${!!m.isPivot}`);
    });
  } else {
    console.log("   - Không có cấu hình columnMappings (Sử dụng cấu hình mặc định hoặc quét placeholder trực tiếp)");
  }

  console.log("2. GROUP BY FIELDS (Danh sách trường Gom nhóm):");
  if (template.groupByFields && template.groupByFields.length > 0) {
    template.groupByFields.forEach((f, idx) => {
      console.log(`   - Trường ${idx + 1}: "${f}"`);
    });
  } else {
    console.log("   - Không có trường Gom nhóm nào được cấu hình");
  }

  console.log("3. AGGREGATE FIELDS (Danh sách các trường Tổng hợp):");
  const aggregateFields = ['SO_LUONG', 'TONG_NHAP', 'SO_LUONG_NHAP', 'TONG_XUAT', 'SO_LUONG_XUAT', 'TONG_TON', 'TON_CUOI', 'SO_CHUNG_TU', 'SO_SKU'];
  aggregateFields.forEach(af => {
    console.log(`   - "${af}" (Tổng hợp SUM hoặc COUNT tương ứng)`);
  });

  const exportColCount = template.columnMappings ? template.columnMappings.length : 0;
  const hasGroupBy = template.groupByFields && template.groupByFields.length > 0;
  const sampleGroupCount = hasGroupBy 
    ? groupAndAggregateData({ data: previewData, groupByFields: template.groupByFields || [] }).length
    : previewData.length;

  console.log("4. EXPORT METADATA COUNTS (Số lượng cột và dòng xuất):");
  console.log(`   - Số lượng Cột: ${exportColCount}`);
  console.log(`   - Số lượng Dòng gốc: ${previewData.length}`);
  console.log(`   - Số lượng Dòng xuất ra (sau gom nhóm): ${sampleGroupCount}`);
  console.log("======================================================");

  // 3. Rebuild static values object
  const previewStaticValues: Record<string, any> = {
    TU_NGAY: startDate,
    DEN_NGAY: endDate,
    LOC_CHI_NHANH: selectedBranch,
    LOC_THUONG_HIEU: selectedBrandFilter,
    LOC_TINH_NANG: selectedFeatureFilter,
    LOC_CHIET_SUAT: selectedChietXuatFilter,
    NGAY: new Date().toISOString().substring(0, 10),
    TEN_NGUOI_TAO: 'Chủ cửa hàng',
    ...resolvedValues
  };

  // 4. Load array buffer - lazy loaded
  let arrayBuffer: ArrayBuffer;
  const ExcelJS = await getExcelJS();

  if (template.id === 'default-phieu-xuat-excel' || template.fileData === 'PRESET') {
    const tempWorkbook = new ExcelJS.Workbook();
    const tempSheet = tempWorkbook.addWorksheet('Giao_Nhận');
    tempSheet.columns = [
      { width: 8 }, { width: 28 }, { width: 38 }, { width: 14 }, { width: 12 }, { width: 16 }
    ];
    
    tempSheet.mergeCells('A2:F2');
    const c2 = tempSheet.getCell('A2');
    c2.value = 'BÁO CÁO NHẬP / XUẤT KHO TRÒNG KÍNH CHI TIẾT';
    c2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    c2.alignment = { horizontal: 'center' };

    tempSheet.getCell('A4').value = 'Báo cáo từ ngày:';
    tempSheet.getCell('A4').font = { bold: true };
    tempSheet.getCell('B4').value = '{{TU_NGAY}}';

    tempSheet.getCell('D4').value = 'Đến ngày:';
    tempSheet.getCell('D4').font = { bold: true };
    tempSheet.getCell('E4').value = '{{DEN_NGAY}}';

    tempSheet.getCell('A5').value = 'Bộ lọc Chi nhánh:';
    tempSheet.getCell('A5').font = { bold: true };
    tempSheet.getCell('B5').value = '{{LOC_CHI_NHANH}}';

    const th = tempSheet.getRow(7);
    th.values = ['STT', 'Mã SKU', 'Tên sản phẩm', 'Số lượng', 'ĐVT', 'Loại giao dịch'];
    th.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    th.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } });

    const tr = tempSheet.getRow(8);
    tr.values = ['{{STT}}', '{{SKU}}', '{{TEN_SP}}', '{{SO_LUONG}}', '{{DVT}}', '{{LOAI}}'];

    const buf = await tempWorkbook.xlsx.writeBuffer();
    arrayBuffer = buf;

    try {
      tempWorkbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (tempWorkbook as any)._worksheets = [];
    } catch (e) {}
  } else if (template.id === 'default-dashboard-excel' || template.fileData === 'PRESET_DASHBOARD') {
    const tempWorkbook = new ExcelJS.Workbook();
    const tempSheet = tempWorkbook.addWorksheet('Thống_Kê');
    tempSheet.columns = [{ width: 35 }, { width: 35 }];

    tempSheet.mergeCells('A2:B2');
    const c2 = tempSheet.getCell('A2');
    c2.value = 'BÁO CÁO THỐNG KÊ KHO TRÒNG KÍNH TOÀN DIỆN';
    c2.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };
    c2.alignment = { horizontal: 'center' };

    tempSheet.getCell('A4').value = 'TỔNG TỒN KHO HỆ THỐNG:';
    tempSheet.getCell('A4').font = { bold: true };
    tempSheet.getCell('B4').value = '{{TONG_TON}}';

    tempSheet.getCell('A5').value = 'TỔNG SẢN LƯỢNG XUẤT KỲ LỌC:';
    tempSheet.getCell('A5').font = { bold: true };
    tempSheet.getCell('B5').value = '{{TONG_XUAT}}';

    tempSheet.getCell('A6').value = 'THƯƠNG HIỆU BÁN CHẠY NHẤT:';
    tempSheet.getCell('A6').font = { bold: true };
    tempSheet.getCell('B6').value = '{{THUONG_HIEU_BAN_CHAY}}';

    tempSheet.getCell('A7').value = 'ĐỘ MẮT KÍNH BÁN CHẠY NHẤT:';
    tempSheet.getCell('A7').font = { bold: true };
    tempSheet.getCell('B7').value = '{{DO_BAN_CHAY}}';

    tempSheet.getCell('A8').value = 'CHI NHÁNH CÓ TOP XUẤT:';
    tempSheet.getCell('A8').font = { bold: true };
    tempSheet.getCell('B8').value = '{{TOP_CHI_NHANH}}';

    const buf = await tempWorkbook.xlsx.writeBuffer();
    arrayBuffer = buf;

    try {
      tempWorkbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (tempWorkbook as any)._worksheets = [];
    } catch (e) {}
  } else {
    const fileData = await fetchTemplateFileData(template.id);
    arrayBuffer = base64ToArrayBuffer(fileData);
  }

  const placeholderMappings: Record<string, string> = {};
  if (template.columnMappings && template.columnMappings.length > 0) {
    template.columnMappings.forEach(m => {
      placeholderMappings[m.excelColumn] = m.dataField;
    });
  } else {
    const detected = template.detectedPlaceholders || [];
    const fields = FIELDS_BY_SOURCE_LOCAL[source] || [];
    detected.forEach(p => {
      const match = fields.find(f => f.key === p || f.key.toUpperCase() === p.toUpperCase());
      placeholderMappings[p] = match ? match.key : '';
    });
  }

  if (template.type === 'EXCEL') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    // 1. Tìm toàn bộ placeholder trong file ban đầu để log
    const foundPlaceholdersInFile = new Set<string>();
    workbook.eachSheet((worksheet) => {
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.value && typeof cell.value === 'string') {
            const matches = cell.value.match(/{{([^{}]+)}}/g);
            if (matches) {
              matches.forEach(m => {
                const clean = m.replace(/[{}]/g, '').trim();
                foundPlaceholdersInFile.add(clean);
              });
            }
          }
        });
      });
    });

    // BÁO CÁO KIỂM TRA ĐỌC TEMPLATE
    console.log("=== KIỂM TRA ĐỌC TEMPLATE EXCEL ===");
    console.log(`Tên file mẫu: ${template.fileName || template.name}`);
    console.log(`Số sheet: ${workbook.worksheets.length}`);
    console.log("Danh sách Placeholder tìm thấy trong file:");
    foundPlaceholdersInFile.forEach(p => console.log(`  - {{${p}}}`));

    if (foundPlaceholdersInFile.size === 0) {
      const msg = `Lỗi: Không tìm thấy bất kỳ Placeholder nào (dạng {{...}}) trong file mẫu Excel!`;
      console.error(msg);
      if (onTriggerToast) {
        onTriggerToast(msg, 'error');
      }
      return; // Dừng kết xuất
    }

    // Kiểm tra xem có ít nhất một placeholder được định nghĩa trong file khớp với columnMappings hoặc static variables không
    const matchedPlaceholders = Array.from(foundPlaceholdersInFile).filter(p => {
      const cleanP = p.trim().toUpperCase();
      if (previewStaticValues[cleanP] !== undefined) return true;
      if (['DETAILS', 'REPORT_ROWS', 'STT', 'VALUE'].includes(cleanP)) return true;
      if (template.columnMappings && template.columnMappings.some(m => m.excelColumn.trim().toUpperCase() === cleanP)) return true;
      const fields = FIELDS_BY_SOURCE_LOCAL[source] || [];
      if (fields.some(f => f.key.toUpperCase() === cleanP)) return true;
      return false;
    });

    if (matchedPlaceholders.length === 0) {
      const msg = `Lỗi: Không tìm thấy bất kỳ Placeholder hợp lệ nào trong file mẫu khớp với cấu hình của hệ thống (VD: ${template.columnMappings?.map(m => `{{${m.excelColumn}}}`).join(', ') || '{{THUONG_HIEU}}, {{SO_LUONG}}'}). Vui lòng kiểm tra lại file mẫu của bạn!`;
      console.error(msg);
      if (onTriggerToast) {
        onTriggerToast(msg, 'error');
      }
      return; // Dừng hoàn toàn kết xuất, không tạo hay tải xuống file rỗng!
    }

    // BÁO CÁO KIỂM TRA NGUỒN DỮ LIỆU
    console.log("=== KIỂM TRA NGUỒN DỮ LIỆU EXCEL ===");
    console.log(`Bộ lọc Dashboard:
  - Chi nhánh: ${selectedBranch}
  - Thương hiệu: ${selectedBrandFilter}
  - Tính năng: ${selectedFeatureFilter}
  - Chiết suất: ${selectedChietXuatFilter}
  - Từ ngày: ${startDate}
  - Đến ngày: ${endDate}`);
    console.log(`Nguồn dữ liệu của Template: ${source}`);
    console.log(`Số bản ghi lấy được (previewData): ${previewData.length}`);
    console.log("===============================");

    if (previewData.length === 0) {
      const msg = `Cảnh báo: Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại (0 bản ghi)!`;
      console.warn(msg);
      if (onTriggerToast) {
        onTriggerToast(msg, 'warning');
      }
    }

    // BÁO CÁO KIỂM TRA MAPPING
    console.log("=== KIỂM TRA MAPPING PLACEHOLDER EXCEL ===");
    const activeRecord = previewData[0] || {};
    foundPlaceholdersInFile.forEach(placeholder => {
      let dataField = '';
      let actualValue: any = undefined;
      const cleanPlaceholder = placeholder.trim().toUpperCase();
      
      if (previewStaticValues[cleanPlaceholder] !== undefined) {
        dataField = '(STATIC_VALUE)';
        actualValue = previewStaticValues[cleanPlaceholder];
      } else if (template.columnMappings) {
        const m = template.columnMappings.find(cm => cm.excelColumn.trim().toUpperCase() === cleanPlaceholder);
        if (m) {
          dataField = m.dataField || '';
          actualValue = activeRecord[dataField];
        } else {
          dataField = placeholder;
          actualValue = activeRecord[placeholder];
        }
      } else {
        dataField = placeholder;
        actualValue = activeRecord[placeholder];
      }
      
      if (cleanPlaceholder === 'DETAILS' || cleanPlaceholder === 'REPORT_ROWS') {
        dataField = '(TABLE_DATA)';
        const hasGroupBy = template.groupByFields && template.groupByFields.length > 0;
        const count = hasGroupBy 
          ? groupAndAggregateData({ data: previewData, groupByFields: template.groupByFields || [] }).length
          : previewData.length;
        actualValue = `[Danh sách bảng: ${count} dòng]`;
      }
      
      console.log(`{{${placeholder}}} → Trường dữ liệu: ${dataField} → Giá trị thay thế: ${actualValue !== undefined ? actualValue : 'null/undefined'}`);

      if (actualValue === null || actualValue === undefined) {
        const isSpecial = ['STT', 'DETAILS', 'REPORT_ROWS', 'VALUE'].includes(cleanPlaceholder);
        if (!isSpecial) {
          console.warn(`[WARNING] Placeholder {{${placeholder}}} có giá trị là null hoặc undefined (Trường dữ liệu: ${dataField})`);
        }
      }
    });
    console.log("=====================================================================");

    const missingDataPlaceholders = new Set<string>();

    workbook.eachSheet((worksheet) => {
      interface DynamicRowSample {
        rowNum: number;
        placeholder: string;
        mapping: ColumnMapping | null;
        isPivot: boolean;
        cellTemplates: Record<number, string>;
      }

      const dynamicRows: DynamicRowSample[] = [];

      // Quét tìm dòng động
      worksheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
        let isDynamic = false;
        let foundPlaceholder = '';
        let foundMapping: ColumnMapping | null = null;
        let isPivot = false;
        const cellTemplates: Record<number, string> = {};

        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (cell.value && typeof cell.value === 'string') {
            const text = cell.value;
            cellTemplates[colNum] = text;

            // 1. Kiểm tra m.isPivot hoặc các mappings đơn giản trong template.columnMappings
            const allMappings = template.columnMappings || [];
            allMappings.forEach(m => {
              const escapedCol = m.excelColumn.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const regex = new RegExp(`{{\\s*${escapedCol}\\s*}}`, 'i');
              if (regex.test(text)) {
                isDynamic = true;
                if (!foundPlaceholder) {
                  foundPlaceholder = m.excelColumn;
                  foundMapping = m;
                  isPivot = !!m.isPivot;
                }
              }
            });

            // 2. Kiểm tra DETAILS & REPORT_ROWS
            if (/{{\s*DETAILS\s*}}/i.test(text)) {
              isDynamic = true;
              foundPlaceholder = 'DETAILS';
              foundMapping = {
                excelColumn: 'DETAILS',
                dataField: 'DETAILS',
                isPivot: false
              };
            }
            if (/{{\s*REPORT_ROWS\s*}}/i.test(text)) {
              isDynamic = true;
              foundPlaceholder = 'REPORT_ROWS';
              foundMapping = {
                excelColumn: 'REPORT_ROWS',
                dataField: 'REPORT_ROWS',
                isPivot: false
              };
            }

            // 3. Kiểm tra các từ khóa bảng chi tiết mặc định khác
            const tableKeywords = ['SKU', 'TEN_SP', 'SO_LUONG', 'CHIET_SUAT', 'TEN_SAN_PHAM', 'DVT', 'LOAI', 'THUONG_HIEU', 'TINH_NANG', 'TON_DAU', 'TON_CUOI', 'VALUE'];
            tableKeywords.forEach(kw => {
              const regex = new RegExp(`{{\\s*${kw}\\s*}}`, 'i');
              if (regex.test(text)) {
                isDynamic = true;
                if (!foundPlaceholder) {
                  foundPlaceholder = 'DETAILS';
                  foundMapping = {
                    excelColumn: 'DETAILS',
                    dataField: 'DETAILS',
                    isPivot: false
                  };
                }
              }
            });
          }
        });

        if (isDynamic) {
          dynamicRows.push({
            rowNum,
            placeholder: foundPlaceholder,
            mapping: foundMapping,
            isPivot,
            cellTemplates
          });
        }
      });

      // Hỗ trợ chế độ cũ tương thích ngược: nếu không tìm thấy dòng động nhưng có startRow
      if (dynamicRows.length === 0 && template.startRow !== undefined && template.startRow > 0) {
        const rowNum = template.startRow;
        const templateRow = worksheet.getRow(rowNum);
        const cellTemplates: Record<number, string> = {};
        templateRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (cell.value && typeof cell.value === 'string') {
            cellTemplates[colNum] = cell.value;
          }
        });
        dynamicRows.push({
          rowNum,
          placeholder: 'DETAILS',
          mapping: {
            excelColumn: 'DETAILS',
            dataField: 'DETAILS',
            isPivot: false
          },
          isPivot: false,
          cellTemplates
        });
      }

      // Sắp xếp ngược để chèn từ dưới lên tránh lệch chỉ số dòng
      dynamicRows.sort((a, b) => b.rowNum - a.rowNum);

      dynamicRows.forEach(sample => {
        const rowNum = sample.rowNum;
        const templateRow = worksheet.getRow(rowNum);
        
        // CACHE DÒNG MẪU BAN ĐẦU TRƯỚC KHI CHÈN GÂY DỊCH CHỈ SỐ
        const cachedRowCells: { colNum: number; value: any; style: any }[] = [];
        templateRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cachedRowCells.push({
            colNum,
            value: cell.value,
            style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : undefined
          });
        });
        const templateHeight = templateRow.height;

        let rowData: any[] = [];
        
        if (sample.isPivot && sample.mapping) {
          rowData = computePivotData({
            config: {
              placeholder: sample.placeholder,
              source: sample.mapping.pivotSource || 'PHIEU',
              groupByFields: sample.mapping.pivotGroupBy || [],
              aggregationType: sample.mapping.pivotAggregation || 'SUM_SO_LUONG',
              sortBy: sample.mapping.pivotSortBy,
              sortOrder: sample.mapping.pivotSortOrder,
              filters: sample.mapping.pivotFilters
            },
            startDate,
            endDate,
            branch: selectedBranch,
            sanPhams,
            nhapXuats,
            nhapXuatCTs
          });
        } else if (sample.placeholder === 'REPORT_ROWS' || sample.placeholder === 'DETAILS') {
          const hasGroupBy = template.groupByFields && template.groupByFields.length > 0;
          if (hasGroupBy) {
            rowData = groupAndAggregateData({
              data: previewData,
              groupByFields: template.groupByFields || []
            });
          } else {
            rowData = previewData;
          }
        } else {
          rowData = previewData;
        }

        console.log(`[Row Insert] Đang xử lý chèn ${rowData.length} dòng cho placeholder ${sample.placeholder} tại dòng mẫu ${rowNum}`);

        const hasCustomMappings = template.columnMappings && template.columnMappings.length > 0;

        // Cập nhật tiêu đề cột (ở dòng header ngay phía trên dòng dynamic, tức là dòng startRow - 1)
        if (hasCustomMappings && rowNum > 1) {
          const headerRow = worksheet.getRow(rowNum - 1);
          template.columnMappings!.forEach((m, cIdx) => {
            const colNum = cIdx + 1;
            const headerCell = headerRow.getCell(colNum);
            headerCell.value = m.label; // Tên cột hiển thị
          });
          // Dọn dẹp tiêu đề thừa ở bên phải
          for (let col = template.columnMappings!.length + 1; col <= 100; col++) {
            headerRow.getCell(col).value = null;
          }
          console.log(`[Header Update] Đã cập nhật tiêu đề cột tại dòng ${rowNum - 1} theo mapping`);
        }

        if (rowData.length > 0) {
          rowData.forEach((record, index) => {
            const insertIdx = rowNum + index;
            const newRow = worksheet.insertRow(insertIdx, []);
            newRow.height = templateHeight;
            
            if (hasCustomMappings) {
              // Ghi giá trị dựa hoàn toàn trên Column Mappings động đã cấu hình
              template.columnMappings!.forEach((m, cIdx) => {
                const colNum = cIdx + 1;
                const targetCell = newRow.getCell(colNum);
                
                // Copy style từ cell tương ứng ở dòng mẫu ban đầu nếu có để đảm bảo định dạng đẹp mắt
                const cachedCell = cachedRowCells.find(cc => cc.colNum === colNum);
                if (cachedCell?.style) {
                  targetCell.style = cachedCell.style;
                } else if (cachedRowCells.length > 0) {
                  // Fallback copy style từ cell cuối cùng của dòng mẫu để giữ style thống nhất
                  targetCell.style = cachedRowCells[cachedRowCells.length - 1].style;
                }

                let cellVal: any = '';
                const cleanExcelCol = m.excelColumn.trim().toUpperCase();
                const cleanDataField = (m.dataField || '').trim().toUpperCase();

                if (cleanExcelCol === 'STT' || cleanDataField === 'STT') {
                  cellVal = index + 1;
                } else {
                  if (m.dataField && record[m.dataField] !== undefined) {
                    cellVal = record[m.dataField];
                  } else if (record[m.excelColumn] !== undefined) {
                    cellVal = record[m.excelColumn];
                  }
                }

                // Hỗ trợ convert định dạng số
                const numVal = Number(cellVal);
                if (cellVal !== '' && cellVal !== null && cellVal !== undefined && !isNaN(numVal) && String(numVal) === String(cellVal).trim()) {
                  targetCell.value = numVal;
                } else {
                  targetCell.value = cellVal ?? '';
                }
                console.log(`[Excel Dynamic Column] Ghi cell ${targetCell.address} (${m.label}): ${targetCell.value}`);
              });

              // Dọn dẹp các cell thừa ở bên phải
              for (let col = template.columnMappings!.length + 1; col <= 100; col++) {
                newRow.getCell(col).value = null;
              }
            } else {
              // Chế độ cũ (quét placeholder trực tiếp trong template)
              cachedRowCells.forEach(({ colNum, value, style }) => {
                const targetCell = newRow.getCell(colNum);
                if (style) {
                  targetCell.style = style;
                }
                
                const templateText = sample.cellTemplates[colNum];
                
                const isClassicDetailsOnly = sample.placeholder === 'DETAILS' && 
                  Object.values(sample.cellTemplates).every(val => val.includes('{{DETAILS}}'));

                if (isClassicDetailsOnly) {
                  targetCell.value = getStandardDetailsValue(source, colNum, record, index);
                  console.log(`[Excel Write] Ghi giá trị DETAILS vào cell ${targetCell.address}: ${targetCell.value}`);
                } else if (templateText) {
                  let cellVal = templateText;
                  
                  // Thay thế các biến hệ thống cơ bản không phụ thuộc hoa thường
                  cellVal = cellVal.replace(/{{\s*STT\s*}}/gi, String(index + 1));
                  cellVal = cellVal.replace(/{{\s*VALUE\s*}}/gi, String(record.VALUE ?? record.SO_LUONG ?? ''));
                  
                  // Ánh xạ trực tiếp từ các thuộc tính bản ghi dữ liệu
                  Object.entries(record).forEach(([k, v]) => {
                    const escapedK = k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    cellVal = cellVal.replace(new RegExp(`{{\\s*${escapedK}\\s*}}`, 'gi'), String(v ?? ''));
                    cellVal = cellVal.replace(new RegExp(`{{\\s*${sample.placeholder}\\.${escapedK}\\s*}}`, 'gi'), String(v ?? ''));
                  });

                  // Ánh xạ từ các biến lọc tĩnh của báo cáo
                  Object.entries(previewStaticValues).forEach(([k, v]) => {
                    const escapedK = k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    cellVal = cellVal.replace(new RegExp(`{{\\s*${escapedK}\\s*}}`, 'gi'), String(v ?? ''));
                  });

                  // Loại bỏ placeholder dòng gốc
                  const escapedPlaceholder = sample.placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                  cellVal = cellVal.replace(new RegExp(`{{\\s*${escapedPlaceholder}\\s*}}`, 'gi'), '');

                  // Dọn dẹp bất kỳ placeholder nào còn sót trong ô dữ liệu động và cảnh báo
                  const remainingMatches = cellVal.match(/{{([^{}]+)}}/g);
                  if (remainingMatches) {
                    remainingMatches.forEach(rm => {
                      const cleanName = rm.replace(/[{}]/g, '').trim();
                      missingDataPlaceholders.add(cleanName);
                      cellVal = cellVal.replace(new RegExp(rm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
                    });
                  }

                  const numVal = Number(cellVal);
                  if (cellVal !== '' && !isNaN(numVal) && String(numVal) === cellVal.trim()) {
                    targetCell.value = numVal;
                  } else {
                    targetCell.value = cellVal;
                  }
                  console.log(`[Excel Write] Ghi giá trị động thay thế vào cell ${targetCell.address}: ${targetCell.value}`);
                } else {
                  targetCell.value = value;
                  if (value !== null && value !== undefined) {
                    console.log(`[Excel Write] Ghi giá trị mặc định vào cell ${targetCell.address}: ${targetCell.value}`);
                  }
                }
              });
            }
          });

          // Xóa dòng mẫu gốc ban đầu
          worksheet.spliceRows(rowNum + rowData.length, 1);
          console.log(`[Row Insert] Đã xóa dòng mẫu gốc tại vị trí ${rowNum + rowData.length}`);
        } else {
          worksheet.spliceRows(rowNum, 1);
          console.log(`[Row Insert] Do không có dữ liệu nên đã xóa dòng mẫu tại vị trí ${rowNum}`);
        }
      });

      // Quét qua toàn bộ cell tĩnh còn lại để thay thế giá trị tĩnh và dọn dẹp
      worksheet.eachRow((row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.value && typeof cell.value === 'string') {
            let text = cell.value;
            let isModified = false;

            // 1. Thay thế các biến tĩnh
            Object.entries(previewStaticValues).forEach(([k, v]) => {
              const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'gi');
              if (regex.test(text)) {
                text = text.replace(regex, String(v ?? ''));
                isModified = true;
              }
            });

            // 2. Thay thế theo column mappings từ dòng đầu tiên
            const activeRecord = previewData[0] || {};
            if (template.columnMappings) {
              template.columnMappings.forEach(m => {
                const escapedCol = m.excelColumn.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`{{\\s*${escapedCol}\\s*}}`, 'gi');
                if (regex.test(text)) {
                  const fieldVal = m.dataField ? (activeRecord[m.dataField] ?? '') : '';
                  text = text.replace(regex, String(fieldVal));
                  isModified = true;
                }
              });
            }

            // 3. Thay trực tiếp từ key active record
            Object.entries(activeRecord).forEach(([k, v]) => {
              const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'gi');
              if (regex.test(text)) {
                text = text.replace(regex, String(v ?? ''));
                isModified = true;
              }
            });

            // 4. Dọn dẹp bất kỳ placeholder chưa thay thế và cảnh báo
            const remainingMatches = text.match(/{{([^{}]+)}}/g);
            if (remainingMatches) {
              remainingMatches.forEach(rm => {
                const cleanName = rm.replace(/[{}]/g, '').trim();
                missingDataPlaceholders.add(cleanName);
                text = text.replace(new RegExp(rm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), '');
                isModified = true;
              });
            }

            if (isModified) {
              const numVal = Number(text);
              if (text !== '' && !isNaN(numVal) && String(numVal) === text.trim()) {
                cell.value = numVal;
              } else {
                cell.value = text;
              }
              console.log(`[Excel Write] Ghi giá trị tĩnh vào cell ${cell.address}: ${cell.value}`);
            }
          }
        });
      });
    });

    if (missingDataPlaceholders.size > 0) {
      const missingList = Array.from(missingDataPlaceholders).filter(p => p !== 'DETAILS' && p !== 'REPORT_ROWS' && p !== 'STT' && p !== 'VALUE');
      if (missingList.length > 0) {
        const msg = `Cảnh báo: Không tìm thấy dữ liệu cho một số Placeholder: ${missingList.join(', ')}`;
        if (onTriggerToast) {
          onTriggerToast(msg, 'warning');
        } else {
          console.warn(msg);
        }

      }
    }

    const outBuffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    onDownload(blob, `Bao_Cao_${template.name}_${new Date().toISOString().substring(0, 10)}.xlsx`);

    // GC optimization: Clear large workbook objects
    try {
      workbook.worksheets.forEach((s: any) => { s.eachRow((r: any) => { r.values = []; }); });
      (workbook as any)._worksheets = [];
    } catch (e) {}
  } else {
    // === XỬ LÝ FILE PDF - lazy loaded ===
    const PDFDocument = await getPDFDocument();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    const foundPlaceholders = fields.map(f => f.getName());

    console.log("=== KIỂM TRA ĐỌC TEMPLATE PDF ===");
    console.log(`Tên file mẫu: ${template.fileName || template.name}`);
    console.log(`Số trang: ${pdfDoc.getPageCount()}`);
    console.log("Danh sách Placeholder tìm thấy:");
    foundPlaceholders.forEach(p => console.log(`  - {{${p}}}`));

    if (foundPlaceholders.length === 0) {
      const msg = `Lỗi: Không tìm thấy bất kỳ Placeholder nào trong template PDF!`;
      console.error(msg);
      if (onTriggerToast) {
        onTriggerToast(msg, 'error');
      }
      return; // Dừng kết xuất
    }

    console.log("=== KIỂM TRA NGUỒN DỮ LIỆU PDF ===");
    console.log(`Bộ lọc Dashboard:
  - Chi nhánh: ${selectedBranch}
  - Thương hiệu: ${selectedBrandFilter}
  - Tính năng: ${selectedFeatureFilter}
  - Chiết suất: ${selectedChietXuatFilter}
  - Từ ngày: ${startDate}
  - Đến ngày: ${endDate}`);
    console.log(`Số bản ghi lấy được: ${previewData.length}`);
    console.log("===============================");

    if (previewData.length === 0) {
      const msg = `Cảnh báo: Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại (0 bản ghi)!`;
      console.warn(msg);
      if (onTriggerToast) {
        onTriggerToast(msg, 'warning');
      }
    }

    console.log("=== KIỂM TRA MAPPING PLACEHOLDER PDF ===");
    const activeRecord = previewData[0] || {};
    
    foundPlaceholders.forEach(placeholder => {
      let mappedValue: any = undefined;
      let dataField = '';
      
      if (previewStaticValues[placeholder] !== undefined) {
        dataField = '(STATIC_VALUE)';
        mappedValue = previewStaticValues[placeholder];
      } else if (template.columnMappings) {
        const m = template.columnMappings.find(cm => cm.excelColumn === placeholder);
        if (m && m.dataField) {
          dataField = m.dataField;
          mappedValue = activeRecord[m.dataField];
        }
      }
      
      if (mappedValue === undefined && activeRecord[placeholder] !== undefined) {
        dataField = placeholder;
        mappedValue = activeRecord[placeholder];
      }
      
      if (placeholder === 'DETAILS' || placeholder === 'REPORT_ROWS') {
        dataField = '(TABLE_DATA)';
        const hasGroupBy = template.groupByFields && template.groupByFields.length > 0;
        const count = hasGroupBy 
          ? groupAndAggregateData({ data: previewData, groupByFields: template.groupByFields || [] }).length
          : previewData.length;
        mappedValue = `[Danh sách bảng: ${count} dòng]`;
      }
      
      console.log(`{{${placeholder}}} → ${dataField || 'null'} → ${mappedValue !== undefined && mappedValue !== '' ? mappedValue : 'null/undefined'}`);

      if (mappedValue === null || mappedValue === undefined) {
        const isSpecial = ['STT', 'DETAILS', 'REPORT_ROWS', 'VALUE'].includes(placeholder);
        if (!isSpecial) {
          console.warn(`[WARNING] Placeholder {{${placeholder}}} có giá trị là null hoặc undefined (Trường dữ liệu: ${dataField || placeholder})`);
        }
      }
    });
    console.log("=============================================================");

    const missingDataPlaceholders = new Set<string>();

    fields.forEach(field => {
      const name = field.getName();
      let isFilled = false;
      
      const mapping = template.columnMappings?.find(m => m.excelColumn === name);
      if (mapping && mapping.isPivot) {
        const pivotData = computePivotData({
          config: {
            placeholder: mapping.excelColumn,
            source: mapping.pivotSource || 'PHIEU',
            groupByFields: mapping.pivotGroupBy || [],
            aggregationType: mapping.pivotAggregation || 'SUM_SO_LUONG',
            sortBy: mapping.pivotSortBy,
            sortOrder: mapping.pivotSortOrder,
            filters: mapping.pivotFilters
          },
          startDate,
          endDate,
          branch: selectedBranch,
          sanPhams,
          nhapXuats,
          nhapXuatCTs
        });

        const headers = mapping.pivotGroupBy || [];
        let textTable = '';
        if (pivotData.length > 0) {
          textTable += headers.join(' | ') + ' | Kết quả\n';
          textTable += '-'.repeat(headers.join(' | ').length + 15) + '\n';
          pivotData.forEach(r => {
            const rowParts = headers.map(h => String(r[h] ?? ''));
            rowParts.push(String(r.VALUE ?? r.SO_LUONG ?? 0));
            textTable += rowParts.join(' | ') + '\n';
          });
        } else {
          textTable = '(Không có dữ liệu)';
        }

        try {
          const textField = form.getTextField(name);
          textField.setText(textTable);
          isFilled = true;
          console.log(`[PDF Write] Ghi giá trị PIVOT vào field ${name}: ${textTable.substring(0, 50)}...`);
        } catch (e) {}
      }
      
      if (!isFilled && (name === 'DETAILS' || name === 'REPORT_ROWS')) {
        try {
          const detailField = form.getTextField(name);
          let detailsText = '';
          const hasGroupBy = template.groupByFields && template.groupByFields.length > 0;
          const finalRows = hasGroupBy 
            ? groupAndAggregateData({ data: previewData, groupByFields: template.groupByFields || [] })
            : previewData;

          finalRows.forEach((item, idx) => {
            if (template.columnMappings && template.columnMappings.length > 0) {
              const mappedCols = template.columnMappings.map(m => {
                let val = '';
                if (m.dataField && item[m.dataField] !== undefined) {
                  val = item[m.dataField];
                } else if (item[m.excelColumn] !== undefined) {
                  val = item[m.excelColumn];
                }
                return `${m.label}: ${val ?? ''}`;
              });
              detailsText += `${idx + 1}. ${mappedCols.join(' | ')}\n`;
            } else if (hasGroupBy) {
              const groupDescParts = (template.groupByFields || []).map(f => {
                let label = f === 'CHIET_XUAT' || f === 'CHIET_SUAT' ? 'Chiết suất' : f === 'THUONG_HIEU' ? 'Thương hiệu' : f === 'TINH_NANG' ? 'Tính năng' : f;
                let val = item[f];
                if (f === 'CHIET_XUAT' || f === 'CHIET_SUAT') val = item.CHIET_SUAT || item.CHIET_XUAT;
                if (f === 'SPH' || f === 'CAN') val = item.SPH ?? item.CAN;
                if (f === 'CYL' || f === 'LOAN') val = item.CYL ?? item.LOAN;
                return `${label}: ${val !== undefined ? val : 'Tất cả'}`;
              });
              detailsText += `${idx + 1}. ${groupDescParts.join(' | ')} | SL: ${item.SO_LUONG ?? 0} | Số lần GD: ${item.COUNT ?? 0}\n`;
            } else {
              detailsText += `${idx + 1}. SKU: ${item.SKU} | Tên: ${item.TEN_SP || item.TEN_SAN_PHAM || ''} | SL: ${item.SO_LUONG ?? 0} | Loại: ${item.LOAI || ''}\n`;
            }
          });
          detailField.setText(detailsText);
          isFilled = true;
          console.log(`[PDF Write] Ghi giá trị DETAILS vào field ${name}: [${finalRows.length} dòng]`);
        } catch (e) {}
      }
      
      if (!isFilled && previewStaticValues[name] !== undefined) {
        try {
          const textField = form.getTextField(name);
          textField.setText(String(previewStaticValues[name] ?? ''));
          isFilled = true;
          console.log(`[PDF Write] Ghi giá trị STATIC vào field ${name}: ${previewStaticValues[name]}`);
        } catch (e) {}
      }
      
      if (!isFilled && mapping && mapping.dataField) {
        if (activeRecord[mapping.dataField] !== undefined) {
          try {
            const textField = form.getTextField(name);
            textField.setText(String(activeRecord[mapping.dataField] ?? ''));
            isFilled = true;
            console.log(`[PDF Write] Ghi giá trị MAPPED vào field ${name}: ${activeRecord[mapping.dataField]}`);
          } catch (e) {}
        }
      }
      
      if (!isFilled && activeRecord[name] !== undefined) {
        try {
          const textField = form.getTextField(name);
          textField.setText(String(activeRecord[name] ?? ''));
          isFilled = true;
          console.log(`[PDF Write] Ghi giá trị DIRECT vào field ${name}: ${activeRecord[name]}`);
        } catch (e) {}
      }
      
      if (!isFilled) {
        missingDataPlaceholders.add(name);
        try {
          const textField = form.getTextField(name);
          textField.setText(''); // xóa trống
          console.log(`[PDF Write] Xóa trống field chưa có dữ liệu ${name}`);
        } catch (e) {}
      }
    });

    if (missingDataPlaceholders.size > 0) {
      const missingList = Array.from(missingDataPlaceholders).filter(p => p !== 'DETAILS' && p !== 'REPORT_ROWS' && p !== 'STT' && p !== 'VALUE');
      if (missingList.length > 0) {
        const msg = `Cảnh báo: Không tìm thấy dữ liệu cho một số Placeholder: ${missingList.join(', ')}`;
        if (onTriggerToast) {
          onTriggerToast(msg, 'warning');
        } else {
          console.warn(msg);
        }
      }
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    onDownload(blob, `Bao_Cao_${template.name}_${new Date().toISOString().substring(0, 10)}.pdf`);
  }
}

function excelColumnToNumber(column: string): number {
  let num = 0;
  const cleaned = column.trim().toUpperCase();
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      num = num * 26 + code - 64;
    }
  }
  return num;
}

