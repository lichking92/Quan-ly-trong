/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDop } from '../data/mockData';

export interface MatrixPdfExportParams {
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

export async function exportMatrixToPDF(params: MatrixPdfExportParams): Promise<void> {
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

  // 1. Tạo container DOM tạm thời đặt off-screen nhưng đảm bảo visible trong layout tree
  const container = document.createElement('div');
  container.id = 'matrix-pdf-export-temp';
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.width = '1200px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  container.style.padding = '16px 20px';
  container.style.boxSizing = 'border-box';
  container.style.opacity = '1';
  container.style.visibility = 'visible';

  const exportTimeStr = new Date().toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Đếm tổng số SKU và tổng tồn kho trong ma trận
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

  // 2. Dựng HTML gọn gàng, hỗ trợ hiển thị Tiếng Việt sắc nét
  let htmlContent = `
    <div style="border-bottom: 2px solid #334155; padding-bottom: 8px; margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div style="font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">
            HỆ THỐNG QUẢN LÝ KHO TRÒNG KÍNH
          </div>
          <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 3px 0 0 0;">
            BÁO CÁO BẢNG ĐỘ MA TRẬN KÍNH MẮT
          </h1>
        </div>
        <div style="text-align: right; font-size: 10.5px; color: #334155; line-height: 1.4;">
          <div><strong>Ngày giờ xuất:</strong> ${exportTimeStr}</div>
          <div><strong>Người xuất:</strong> ${userName || 'Hệ thống'}</div>
        </div>
      </div>

      <!-- Bảng thông tin bộ lọc đang áp dụng -->
      <div style="margin-top: 8px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 12px;">
        <div style="font-size: 10px; font-weight: bold; color: #1e293b; margin-bottom: 4px; text-transform: uppercase;">
          BỘ LỌC ĐANG ÁP DỤNG
        </div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-size: 10.5px;">
          <div><span style="color: #64748b;">Thương hiệu:</span> <strong style="color: #0f172a;">${selectedBrand}</strong></div>
          <div><span style="color: #64748b;">Chiết suất:</span> <strong style="color: #0f172a;">${currentChietXuat}</strong></div>
          <div><span style="color: #64748b;">Tính năng:</span> <strong style="color: #0f172a;">${currentFeature}</strong></div>
          <div><span style="color: #64748b;">Loại độ:</span> <strong style="color: #dc2626;">${diopterType}</strong></div>
          <div><span style="color: #64748b;">Kho / Chi nhánh:</span> <strong style="color: #2563eb;">${selectedBranch === 'Tất cả' ? 'Tất cả chi nhánh' : selectedBranch}</strong></div>
        </div>
      </div>
    </div>

    <!-- Bảng dữ liệu Ma Trận -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; text-align: center;">
      <thead>
        <tr style="background-color: #e2e8f0;">
          <th style="border: 1px solid #94a3b8; padding: 5px 2px; font-weight: bold; width: 70px; color: #0f172a; background-color: #cbd5e1; font-size: 9px;">
            LOẠN ↓ / CẬN →
          </th>
  `;

  // Thêm header các cột LOẠN
  loanList.forEach(loan => {
    htmlContent += `
      <th style="border: 1px solid #94a3b8; padding: 5px 2px; font-weight: bold; color: #0f172a; background-color: #e2e8f0;">
        ${formatDop(loan)}
      </th>
    `;
  });

  htmlContent += `
        </tr>
      </thead>
      <tbody>
  `;

  // Thêm các dòng độ CẬN
  canList.forEach(can => {
    htmlContent += `
      <tr>
        <td style="border: 1px solid #94a3b8; padding: 3px 2px; font-weight: bold; color: #0f172a; background-color: #f1f5f9;">
          ${formatDop(can)}
        </td>
    `;

    loanList.forEach(loan => {
      const info = getCellStockInfo(can, loan);
      if (!info.exists) {
        htmlContent += `
          <td style="border: 1px solid #cbd5e1; padding: 3px 2px; color: #cbd5e1; background-color: #f8fafc;">
            -
          </td>
        `;
      } else if (info.tonCuoi === 0) {
        htmlContent += `
          <td style="border: 1px solid #94a3b8; padding: 3px 2px; font-weight: bold; color: #ffffff; background-color: #dc2626;">
            0
          </td>
        `;
      } else if (info.tonCuoi < info.tonToiThieu) {
        htmlContent += `
          <td style="border: 1px solid #94a3b8; padding: 3px 2px; font-weight: bold; color: #7c2d12; background-color: #fed7aa;">
            ${info.tonCuoi}
          </td>
        `;
      } else {
        htmlContent += `
          <td style="border: 1px solid #94a3b8; padding: 3px 2px; font-weight: bold; color: #0f172a; background-color: #ffffff;">
            ${info.tonCuoi}
          </td>
        `;
      }
    });

    htmlContent += `</tr>`;
  });

  htmlContent += `
      </tbody>
    </table>

    <!-- Chú giải & Thống kê Footer -->
    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #334155;">
      <div style="display: flex; gap: 14px; align-items: center;">
        <span style="font-weight: bold;">Chú giải:</span>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; background-color: #dc2626; border-radius: 2px;"></span>
          <span>Hết hàng (0)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; background-color: #fed7aa; border-radius: 2px;"></span>
          <span>Thấp (&lt; Tối thiểu)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; background-color: #ffffff; border: 1px solid #94a3b8; border-radius: 2px;"></span>
          <span>Còn hàng</span>
        </div>
      </div>

      <div style="font-size: 10.5px; font-weight: bold; color: #0f172a;">
        <span>SKU: <strong>${totalSKUCount}</strong></span>
        <span style="margin: 0 6px;">|</span>
        <span>Tổng tồn: <strong>${totalStockQty.toLocaleString('vi-VN')}</strong></span>
        <span style="margin: 0 6px;">|</span>
        <span>SKU hết hàng: <strong style="color: #dc2626;">${outOfStockSKUCount}</strong></span>
      </div>
    </div>
  `;

  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    // 3. Render bằng html2canvas với onclone để đảm bảo nội dung ở vị trí (0,0) hiển thị 100% không bị trắng xóa
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        const el = clonedDoc.getElementById('matrix-pdf-export-temp');
        if (el) {
          el.style.left = '0px';
          el.style.top = '0px';
          el.style.position = 'static';
          el.style.opacity = '1';
          el.style.visibility = 'visible';
        }
      }
    });

    // 4. Tạo file PDF 1 TRANG DUY NHẤT (Landscape A4: 297mm x 210mm)
    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfPageWidth = 297; // mm
    const pdfPageHeight = 210; // mm
    const margin = 8; // mm (lề 8mm mỗi bên)

    const availableWidth = pdfPageWidth - margin * 2; // 281 mm
    const availableHeight = pdfPageHeight - margin * 2; // 194 mm

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Tỷ lệ co giãn để NẰM TRỌN TRONG 1 TRANG A4 LANDSCAPE
    const scaleX = availableWidth / canvasWidth;
    const scaleY = availableHeight / canvasHeight;
    const scale = Math.min(scaleX, scaleY);

    const printWidth = canvasWidth * scale;
    const printHeight = canvasHeight * scale;

    // Căn giữa nội dung trong trang A4
    const xPos = (pdfPageWidth - printWidth) / 2;
    const yPos = (pdfPageHeight - printHeight) / 2;

    pdf.addImage(imgData, 'PNG', xPos, yPos, printWidth, printHeight, undefined, 'FAST');

    // 5. Đặt tên file ngắn gọn theo bộ lọc
    const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9_\.-]/g, '_');
    const brandClean = sanitize(selectedBrand.trim());
    const cxClean = sanitize(currentChietXuat.trim());
    const featClean = sanitize(currentFeature.trim());

    const fileName = `BangDoMaTran_${brandClean}_${cxClean}_${featClean}.pdf`;

    pdf.save(fileName);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
