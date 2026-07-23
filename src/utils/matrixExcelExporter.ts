/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { formatDop } from '../data/mockData';

export interface MatrixExcelExportParams {
  selectedBrand: string;
  currentChietXuat: string;
  currentFeature: string;
  selectedBranch: string;
  diopterType: 'CẬN' | 'VIỄN';
  canList: number[];
  loanList: number[];
  getCellStockInfo: (can: number, loan: number) => {
    sku: string;
    exists: boolean;
    tonCuoi: number;
    tonToiThieu: number;
    status: string;
  };
  userName?: string;
}

export async function exportMatrixToExcel(params: MatrixExcelExportParams): Promise<void> {
  const {
    selectedBrand,
    currentChietXuat,
    currentFeature,
    selectedBranch,
    diopterType,
    canList,
    loanList,
    getCellStockInfo,
    userName
  } = params;

  // Import động exceljs
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = userName || 'Hệ thống';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Bảng độ Ma trận', {
    views: [{ showGridLines: true }]
  });

  const exportTimeStr = new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Tính toán thống kê tổng quan
  let totalSKUCount = 0;
  let totalStockQty = 0;
  let outOfStockSKUCount = 0;

  canList.forEach(can => {
    loanList.forEach(loan => {
      const info = getCellStockInfo(can, loan);
      if (info.exists) {
        totalSKUCount++;
        totalStockQty += info.tonCuoi;
        if (info.tonCuoi === 0) {
          outOfStockSKUCount++;
        }
      }
    });
  });

  // --- 1. DÒNG TIÊU ĐỀ HỆ THỐNG & BÁO CÁO ---
  const row1 = worksheet.addRow(['HỆ THỐNG QUẢN LÝ KHO TRÒNG KÍNH']);
  row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF64748B' } };

  const row2 = worksheet.addRow(['BÁO CÁO BẢNG ĐỘ MA TRẬN KÍNH MẮT']);
  row2.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF0F172A' } };

  const row3 = worksheet.addRow([`Ngày giờ xuất: ${exportTimeStr} | Người xuất: ${userName || 'Hệ thống'}`]);
  row3.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };

  worksheet.addRow([]); // Dòng trống

  // --- 2. THÔNG TIN BỘ LỌC ĐANG ÁP DỤNG ---
  const filterHeaderRow = worksheet.addRow(['BỘ LỌC ĐANG ÁP DỤNG']);
  filterHeaderRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };

  const fRow1 = worksheet.addRow(['Thương hiệu:', selectedBrand, 'Chiết suất:', currentChietXuat]);
  fRow1.font = { name: 'Arial', size: 10 };
  fRow1.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
  fRow1.getCell(3).font = { bold: true, color: { argb: 'FF475569' } };

  const fRow2 = worksheet.addRow(['Tính năng:', currentFeature, 'Loại độ:', diopterType, 'Chi nhánh:', selectedBranch === 'Tất cả' ? 'Tất cả chi nhánh' : selectedBranch]);
  fRow2.font = { name: 'Arial', size: 10 };
  fRow2.getCell(1).font = { bold: true, color: { argb: 'FF475569' } };
  fRow2.getCell(3).font = { bold: true, color: { argb: 'FF475569' } };
  fRow2.getCell(5).font = { bold: true, color: { argb: 'FF475569' } };

  worksheet.addRow([]); // Dòng trống

  // --- 3. BẢNG DỮ LIỆU MA TRẬN ---
  // Header row của ma trận
  const headerValues = ['LOẠN ↓ / CẬN →', ...loanList.map(loan => formatDop(loan))];
  const matrixHeaderRow = worksheet.addRow(headerValues);
  
  matrixHeaderRow.height = 24;
  matrixHeaderRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: colNumber === 1 ? 'FFCBD5E1' : 'FFE2E8F0' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF64748B' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  });

  // Data rows
  canList.forEach(can => {
    const rowData: (string | number)[] = [formatDop(can)];
    
    loanList.forEach(loan => {
      const info = getCellStockInfo(can, loan);
      if (!info.exists) {
        rowData.push('-');
      } else {
        rowData.push(info.tonCuoi);
      }
    });

    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 20;

    dataRow.eachCell((cell, colNumber) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Cột đầu tiên (Cận)
      if (colNumber === 1) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          right: { style: 'medium', color: { argb: 'FF64748B' } }
        };
        return;
      }

      // Ô ma trận dữ liệu
      const loanIdx = colNumber - 2;
      const loan = loanList[loanIdx];
      const info = getCellStockInfo(can, loan);

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };

      if (!info.exists) {
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FFCBD5E1' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      } else if (info.tonCuoi === 0) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDC2626' }
        };
      } else if (info.tonCuoi < info.tonToiThieu) {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF7C2D12' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFED7AA' }
        };
      } else {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' }
        };
      }
    });
  });

  worksheet.addRow([]); // Dòng trống

  // --- 4. TỔNG KẾT & CHÚ GIẢI FOOTER ---
  const sumRow = worksheet.addRow([
    'TỔNG KẾT:',
    `Tổng SKU: ${totalSKUCount}`,
    `Tổng tồn kho: ${totalStockQty.toLocaleString('vi-VN')} miếng`,
    `SKU hết hàng: ${outOfStockSKUCount}`
  ]);
  sumRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  // Set width cho các cột
  worksheet.getColumn(1).width = 18;
  for (let i = 2; i <= loanList.length + 1; i++) {
    worksheet.getColumn(i).width = 10;
  }

  // --- 5. TẠO VÀ TẢI VỀ FILE EXCEL (.XLSX) ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_\.-]/g, '_');
  const brandClean = sanitize(selectedBrand.trim());
  const cxClean = sanitize(currentChietXuat.trim());
  const featClean = sanitize(currentFeature.trim());

  const fileName = `BangDoMaTran_${brandClean}_${cxClean}_${featClean}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}
