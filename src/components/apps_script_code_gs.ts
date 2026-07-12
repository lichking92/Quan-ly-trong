/**
 * =========================================================================
 * FILE: apps_script_code_gs.ts
 * TÁC GIẢ: Lập trình viên Hệ thống Lão làng (30+ năm kinh nghiệm)
 * MÔ TẢ: Mã nguồn Code.gs hỗ trợ đầy đủ kết nối thực tế với Google Sheets,
 *        xử lý nghiệp vụ cân bằng kho, rollback hoàn tác, và quản lý danh mục.
 * =========================================================================
 */

export const codeGSContent = `/**
 * =========================================================================
 * FILE: Code.gs
 * TÁC GIẢ: Lập trình viên Hệ thống Lão làng (30+ năm kinh nghiệm)
 * MÔ TẢ: Máy chủ Backend chạy trên Google Apps Script (GAS).
 *        Xử lý nghiệp vụ xuất, nhập, tồn, rollback hoàn tác, kiểm kê,
 *        và thêm mới danh mục (Sản phẩm, Thương hiệu, Chi nhánh, Nhân viên) trực tiếp trên Google Sheets.
 *        Sử dụng LockService chặt chẽ tránh xung đột đồng thời.
 * =========================================================================
 */

// ID file Google Sheets của bạn. Hãy đổi ID này thành ID Spreadsheet của bạn nếu chạy độc lập
const SPREADSHEET_ID = "1xE7xTugOUUMsxcQ2-8t27UdnmTAXXThC0v9hnTUIU5E"; 

function doGet(e) {
  const template = HtmlService.createTemplateFromFile("Index");
  return template.evaluate()
    .setTitle("Hệ thống Quản lý Xuất Nhập Tồn Tròng Kính - Glass Stock Pro")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDb() {
  let db = null;
  if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
    try {
      db = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      throw new Error("Không thể kết nối tới Google Sheets với ID '" + SPREADSHEET_ID + "'. Hãy đảm bảo ID chính xác và tài liệu đã được cấp quyền truy cập đầy đủ. Chi tiết: " + e.toString());
    }
  } else {
    try {
      db = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {}
  }
  
  if (!db) {
    throw new Error("Chưa cấu hình trang tính Google Sheets! Vui lòng điền Spreadsheet ID của bạn vào biến SPREADSHEET_ID ở dòng 22 trong Code.gs để kết nối.");
  }

  // Tự động khởi tạo các trang tính con và dữ liệu mẫu nếu bị thiếu
  initializeSheetsIfMissing(db);

  return db;
}

function initializeSheetsIfMissing(db) {
  const sheetsToCreate = [
    {
      name: "B_SANPHAM",
      headers: ["SKU", "TEN_SP", "THUONG_HIEU", "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "TON_DAU", "NHAP", "XUAT", "TON_CUOI", "TON_TOI_THIEU", "DVT"],
      rows: [
        ["BLICK 1.56 ĐM -2.00 -0.50", "Tròng kính Đổi màu Blick 1.56 Cận -2.00 Loạn -0.50", "Blick", "1.56", "ĐM", -2, -0.5, 30, 15, 10, 35, 10, "Cặp"],
        ["BLICK 1.56 ĐM -3.25 -1.25", "Tròng kính Đổi màu Blick 1.56 Cận -3.25 Loạn -1.25", "Blick", "1.56", "ĐM", -3.25, -1.25, 25, 5, 26, 4, 8, "Cặp"],
        ["ZEISS CLEAR 1.56 ASX -2.50 -0.50", "Tròng kính Lọc ánh sáng xanh Zeiss Clear 1.56 Cận -2.50 Loạn -0.50", "Zeiss Clear", "1.56", "ASX", -2.5, -0.5, 50, 30, 20, 60, 15, "Cặp"]
      ]
    },
    {
      name: "B_NHAPXUAT",
      headers: ["HOA_DON", "CHI_NHANH", "NGAY", "LOAI", "TONG_SL", "NGUOI_TAO", "TEN_NGUOI_TAO", "TG_TAO", "GHI_CHU"],
      rows: [
        ["PN000001", "Kho Trung Tâm", "10/07/2026", "NHẬP", 45, "nguyenkienduc.digital@gmail.com", "Nguyễn Kiến Đức", "10:00:00", "Nhập hàng đầu kỳ chuẩn hóa"],
        ["PX000001", "Chi nhánh Quận 1", "10/07/2026", "XUẤT", 56, "nguyenkienduc.digital@gmail.com", "Nguyễn Kiến Đức", "14:30:00", "Xuất bán lẻ cho khách hàng"]
      ]
    },
    {
      name: "B_NHAPXUATCT",
      headers: ["ID", "HOA_DON", "SKU", "TEN_SP", "THUONG_HIEU", "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "SO_LUONG", "DVT", "GHI_CHU", "LOAI", "NGAY"],
      rows: [
        ["DT_1", "PN000001", "BLICK 1.56 ĐM -2.00 -0.50", "Tròng kính Đổi màu Blick 1.56 Cận -2.00 Loạn -0.50", "Blick", "1.56", "ĐM", -2, -0.5, 15, "Cặp", "", "NHẬP", "10/07/2026"],
        ["DT_2", "PX000001", "BLICK 1.56 ĐM -3.25 -1.25", "Tròng kính Đổi màu Blick 1.56 Cận -3.25 Loạn -1.25", "Blick", "1.56", "ĐM", -3.25, -1.25, 26, "Cặp", "Bán lẻ", "XUẤT", "10/07/2026"]
      ]
    },
    {
      name: "B_KIEMKHO",
      headers: ["MA_PHIEU", "SKU", "TEN_SP", "THUONG_HIEU", "TON_HE_THONG", "TON_THUC_TE", "LECH", "LOAI_BU", "NGAY", "NGUOI_KIEM", "GHI_CHU"],
      rows: []
    },
    {
      name: "B_THUONGHIEU",
      headers: ["THUONG_HIEU", "QUOC_GIA"],
      rows: [
        ["Blick", "Đức"],
        ["Zeiss Clear", "Đức"],
        ["Essilor Pre", "Pháp"]
      ]
    },
    {
      name: "B_CHINHANH",
      headers: ["CHI_NHANH", "DIA_CHI"],
      rows: [
        ["Kho Trung Tâm", "123 Nguyễn Trãi, Quận 1, TP. HCM"],
        ["Chi nhánh Quận 1", "456 Hai Bà Trưng, Quận 1, TP. HCM"]
      ]
    },
    {
      name: "B_NHANVIEN",
      headers: ["EMAIL", "HO_TEN", "ROLE", "CHI_NHANH", "WRITE_ACCESS"],
      rows: [
        ["nguyenkienduc.digital@gmail.com", "Nguyễn Kiến Đức", "ADMIN", "Kho Trung Tâm", "true"],
        ["kho@gmail.com", "Trần Văn Kho", "KHO", "Kho Trung Tâm", "true"],
        ["nhanvien@gmail.com", "Lê Thị Bán Hàng", "NHAN_VIEN", "Chi nhánh Quận 1", "false"]
      ]
    }
  ];

  sheetsToCreate.forEach(function(s) {
    let sheet = db.getSheetByName(s.name);
    if (!sheet) {
      sheet = db.insertSheet(s.name);
      sheet.appendRow(s.headers);
      if (s.rows && s.rows.length > 0) {
        s.rows.forEach(function(row) {
          sheet.appendRow(row);
        });
      }
    }
  });
}

function readDataFromSheet(sheetName) {
  const db = getDb();
  const sheet = db.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Không tìm thấy trang tính (Sheet) '" + sheetName + "' trong file Google Sheets của bạn. Hãy đảm bảo bạn đã tạo trang tính con có tên '" + sheetName + "' trong Google Sheet.");
  }
  
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const rows = [];
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function appendRowsToSheet(sheetName, headers, listObjects) {
  const db = getDb();
  const sheet = db.getSheetByName(sheetName);
  if (!sheet) return;
  
  listObjects.forEach(function(item) {
    const rowValues = headers.map(function(h) {
      return item[h] !== undefined ? item[h] : "";
    });
    sheet.appendRow(rowValues);
  });
}

/**
 * LẤY EMAIL NGƯỜI DÙNG ĐANG CHẠY WEB APP
 */
function getUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email) {
      email = Session.getEffectiveUser().getEmail();
    }
    return email || "nhanvien@glassstockpro.com";
  } catch (e) {
    return "nhanvien@glassstockpro.com";
  }
}

/**
 * ĐỒNG BỘ TOÀN BỘ DỮ LIỆU BAN ĐẦU
 */
function getInitialData() {
  try {
    return {
      success: true,
      sanPhams: readDataFromSheet("B_SANPHAM"),
      nhapXuats: readDataFromSheet("B_NHAPXUAT"),
      nhapXuatCTs: readDataFromSheet("B_NHAPXUATCT"),
      kiemKhos: readDataFromSheet("B_KIEMKHO"),
      thuongHieus: readDataFromSheet("B_THUONGHIEU"),
      chiNhanhs: readDataFromSheet("B_CHINHANH"),
      nhanViens: readDataFromSheet("B_NHANVIEN"),
      userEmail: getUserEmail()
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * NGHIỆP VỤ 1: LẬP PHIẾU XUẤT NHẬP KÈM TỰ ĐỘNG CÂN BẰNG TỒN KHO
 */
function createTransaction(headerData, listDetails) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận xử lý giao dịch khác. Thử lại sau!");

    const db = getDb();
    const loaiPhieu = headerData.LOAI; 
    const prefix = loaiPhieu === "NHẬP" ? "PN" : "PX";
    
    // Sinh mã hóa đơn tăng dần
    const existingHeaders = readDataFromSheet("B_NHAPXUAT");
    let maxNumber = 0;
    existingHeaders.forEach(function(h) {
      if (h.HOA_DON.indexOf(prefix) === 0) {
        const numPart = parseInt(h.HOA_DON.substring(2), 10);
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });
    const newInvoiceId = prefix + String(maxNumber + 1).padStart(6, "0");
    
    headerData.HOA_DON = newInvoiceId;
    listDetails.forEach(function(d) {
      d.HOA_DON = newInvoiceId;
    });

    // Lưu vào sheet B_NHAPXUAT
    const headerColumns = ["HOA_DON", "CHI_NHANH", "NGAY", "LOAI", "TONG_SL", "NGUOI_TAO", "TEN_NGUOI_TAO", "TG_TAO", "GHI_CHU"];
    appendRowsToSheet("B_NHAPXUAT", headerColumns, [headerData]);

    // Lưu vào sheet B_NHAPXUATCT
    const detailColumns = ["ID", "HOA_DON", "SKU", "TEN_SP", "THUONG_HIEU", "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "SO_LUONG", "DVT", "GHI_CHU", "LOAI", "NGAY"];
    appendRowsToSheet("B_NHAPXUATCT", detailColumns, listDetails);

    // Cập nhật số tồn cuối trực tiếp cho các SKU liên quan
    const productSheet = db.getSheetByName("B_SANPHAM");
    const productRange = productSheet.getDataRange();
    const productValues = productRange.getValues();
    const productHeaders = productValues[0];
    
    const skuColIdx = productHeaders.indexOf("SKU");
    const nhapColIdx = productHeaders.indexOf("NHAP");
    const xuatColIdx = productHeaders.indexOf("XUAT");
    const tonCuoiColIdx = productHeaders.indexOf("TON_CUOI");
    const tonDauColIdx = productHeaders.indexOf("TON_DAU");

    const affectedSkusMap = {};
    listDetails.forEach(function(d) {
      if (!affectedSkusMap[d.SKU]) affectedSkusMap[d.SKU] = 0;
      affectedSkusMap[d.SKU] += Number(d.SO_LUONG);
    });

    for (let r = 1; r < productValues.length; r++) {
      const sku = productValues[r][skuColIdx];
      if (affectedSkusMap[sku] !== undefined) {
        const deltaQty = affectedSkusMap[sku];
        let currentNhap = Number(productValues[r][nhapColIdx]) || 0;
        let currentXuat = Number(productValues[r][xuatColIdx]) || 0;
        let tonDau = Number(productValues[r][tonDauColIdx]) || 0;

        if (loaiPhieu === "NHẬP") {
          currentNhap += deltaQty;
        } else {
          currentXuat += deltaQty;
        }

        const newTonCuoi = tonDau + currentNhap - currentXuat;

        productSheet.getRange(r + 1, nhapColIdx + 1).setValue(currentNhap);
        productSheet.getRange(r + 1, xuatColIdx + 1).setValue(currentXuat);
        productSheet.getRange(r + 1, tonCuoiColIdx + 1).setValue(newTonCuoi);
      }
    }

    return { success: true, invoiceId: newInvoiceId };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 2: HỦY PHIẾU VÀ HOÀN TÁC ROLLBACK TỒN KHO TRỌN VẸN
 */
function deleteTransactionAndRollback(hoaDonId, skusToRecalc) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận xử lý khôi phục tồn kho.");

    const db = getDb();
    
    // Đọc chi tiết hóa đơn cần hủy
    const detailsSheet = db.getSheetByName("B_NHAPXUATCT");
    const dValues = detailsSheet.getDataRange().getValues();
    const dHeaders = dValues[0];
    const hdColIdx = dHeaders.indexOf("HOA_DON");
    const skuColIdxCT = dHeaders.indexOf("SKU");
    const slColIdxCT = dHeaders.indexOf("SO_LUONG");
    const loaiColIdxCT = dHeaders.indexOf("LOAI");

    const rollbackMap = {}; 
    const rowsToDelete = [];
    
    for (let r = dValues.length - 1; r >= 1; r--) {
      if (dValues[r][hdColIdx] === hoaDonId) {
        const sku = dValues[r][skuColIdxCT];
        const qty = Number(dValues[r][slColIdxCT]) || 0;
        const loai = dValues[r][loaiColIdxCT];

        if (!rollbackMap[sku]) rollbackMap[sku] = { nhap: 0, xuat: 0 };
        
        if (loai === "NHẬP") {
          rollbackMap[sku].nhap += qty;
        } else {
          rollbackMap[sku].xuat += qty;
        }
        rowsToDelete.push(r + 1);
      }
    }

    // Xóa dòng chi tiết
    rowsToDelete.forEach(function(rowNum) {
      detailsSheet.deleteRow(rowNum);
    });

    // Xóa Header
    const headerSheet = db.getSheetByName("B_NHAPXUAT");
    const hValues = headerSheet.getDataRange().getValues();
    const hHeaders = hValues[0];
    const hdColIdxH = hHeaders.indexOf("HOA_DON");

    for (let r = hValues.length - 1; r >= 1; r--) {
      if (hValues[r][hdColIdxH] === hoaDonId) {
        headerSheet.deleteRow(r + 1);
        break;
      }
    }

    // Cập nhật ngược lại tồn kho sản phẩm (B_SANPHAM)
    const productSheet = db.getSheetByName("B_SANPHAM");
    const pValues = productSheet.getDataRange().getValues();
    const pHeaders = pValues[0];

    const skuColIdxP = pHeaders.indexOf("SKU");
    const nhapColIdxP = pHeaders.indexOf("NHAP");
    const xuatColIdxP = pHeaders.indexOf("XUAT");
    const tonCuoiColIdxP = pHeaders.indexOf("TON_CUOI");
    const tonDauColIdxP = pHeaders.indexOf("TON_DAU");

    for (let r = 1; r < pValues.length; r++) {
      const sku = pValues[r][skuColIdxP];
      if (rollbackMap[sku] !== undefined) {
        const currentNhap = Number(pValues[r][nhapColIdxP]) || 0;
        const currentXuat = Number(pValues[r][xuatColIdxP]) || 0;
        const tonDau = Number(pValues[r][tonDauColIdxP]) || 0;

        const rollbackNhap = rollbackMap[sku].nhap;
        const rollbackXuat = rollbackMap[sku].xuat;

        const newNhap = currentNhap - rollbackNhap;
        const newXuat = currentXuat - rollbackXuat;
        const newTonCuoi = tonDau + newNhap - newXuat;

        productSheet.getRange(r + 1, nhapColIdxP + 1).setValue(newNhap);
        productSheet.getRange(r + 1, xuatColIdxP + 1).setValue(newXuat);
        productSheet.getRange(r + 1, tonCuoiColIdxP + 1).setValue(newTonCuoi);
      }
    }

    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 3: GHI NHẬN KIỂM KHO VÀ ĐIỀU CHỈNH CHÊNH LỆCH TỒN
 */
function recordInventoryAudit(auditData) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận kiểm kê.");

    const db = getDb();
    
    // Sinh số phiếu kiểm kho PKKxxxxxx
    const existingAudits = readDataFromSheet("B_KIEMKHO");
    let maxNumber = 0;
    existingAudits.forEach(function(a) {
      if (a.MA_PHIEU.indexOf("PKK") === 0) {
        const numPart = parseInt(a.MA_PHIEU.substring(3), 10);
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });
    const newAuditId = "PKK" + String(maxNumber + 1).padStart(6, "0");
    auditData.MA_PHIEU = newAuditId;

    // Lưu vào sheet B_KIEMKHO
    const auditColumns = ["MA_PHIEU", "SKU", "TON_HE_THONG", "TON_THUC_TE", "LECH", "LOAI_BU", "NGUOI_KIEM", "THOI_DIEM"];
    appendRowsToSheet("B_KIEMKHO", auditColumns, [auditData]);

    // Bù trừ số tồn
    const productSheet = db.getSheetByName("B_SANPHAM");
    const values = productSheet.getDataRange().getValues();
    const headers = values[0];

    const skuColIdx = headers.indexOf("SKU");
    const nhapColIdx = headers.indexOf("NHAP");
    const xuatColIdx = headers.indexOf("XUAT");
    const tonCuoiColIdx = headers.indexOf("TON_CUOI");
    const tonDauColIdx = headers.indexOf("TON_DAU");

    for (let r = 1; r < values.length; r++) {
      if (values[r][skuColIdx] === auditData.SKU) {
        let currentNhap = Number(values[r][nhapColIdx]) || 0;
        let currentXuat = Number(values[r][xuatColIdx]) || 0;
        const tonDau = Number(values[r][tonDauColIdx]) || 0;

        const lech = Number(auditData.LECH); 

        if (lech > 0) {
          currentNhap += lech;
        } else if (lech < 0) {
          currentXuat += Math.abs(lech);
        }

        const newTonCuoi = tonDau + currentNhap - currentXuat;

        productSheet.getRange(r + 1, nhapColIdx + 1).setValue(currentNhap);
        productSheet.getRange(r + 1, xuatColIdx + 1).setValue(currentXuat);
        productSheet.getRange(r + 1, tonCuoiColIdx + 1).setValue(newTonCuoi);
        break;
      }
    }

    return { success: true, auditId: newAuditId };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 4: THÊM SẢN PHẨM MỚI VÀO SPREADSHEET
 */
function addNewProduct(productData) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận.");
    
    const existing = readDataFromSheet("B_SANPHAM");
    const duplicate = existing.some(function(p) {
      return p.SKU.toString().toLowerCase() === productData.SKU.toString().toLowerCase();
    });
    if (duplicate) {
      throw new Error("Mã SKU '" + productData.SKU + "' đã tồn tại trong hệ thống!");
    }
    
    const headers = ["SKU", "TEN_SP", "THUONG_HIEU", "CHIET_XUAT", "TINH_NANG", "SPH", "CYL", "TON_DAU", "NHAP", "XUAT", "TON_CUOI", "TON_TOI_THIEU", "DVT"];
    appendRowsToSheet("B_SANPHAM", headers, [productData]);
    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 5: THÊM THƯƠNG HIỆU MỚI
 */
function addNewBrand(brandData) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận.");
    
    const headers = ["THUONG_HIEU", "QUOC_GIA"];
    appendRowsToSheet("B_THUONGHIEU", headers, [brandData]);
    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 6: THÊM CHI NHÁNH MỚI
 */
function addNewBranch(branchData) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận.");
    
    const headers = ["CHI_NHANH", "DIA_CHI"];
    appendRowsToSheet("B_CHINHANH", headers, [branchData]);
    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NGHIỆP VỤ 7: THÊM NHÂN VIÊN MỚI
 */
function addNewStaff(staffData) {
  const lock = LockService.getScriptLock();
  try {
    const hasLock = lock.tryLock(30000);
    if (!hasLock) throw new Error("Hệ thống bận.");
    
    const headers = ["EMAIL", "HO_TEN", "ROLE", "CHI_NHANH", "WRITE_ACCESS"];
    appendRowsToSheet("B_NHANVIEN", headers, [staffData]);
    return { success: true };
  } catch(err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}
`;
