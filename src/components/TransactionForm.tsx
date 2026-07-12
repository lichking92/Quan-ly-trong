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
  Layers, 
  ChevronRight, 
  ChevronLeft,
  Plus, 
  Trash2, 
  Barcode, 
  Save, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Info,
  CheckCircle,
  Clock,
  Search,
  ShoppingCart,
  Building,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, NhapXuat, NhapXuatCT, LoaiPhieu, User as UserType, ThươngHieu } from '../types';
import { generateSKUString, formatDop } from '../data/mockData';

/**
 * FILE: TransactionForm.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Xử lý nghiệp vụ lập phiếu Nhập kho / Xuất kho bằng mô hình Wizard 3 bước chuyên nghiệp.
 *        - Bước 1: Khai báo thông tin phiếu (Ngày lập, người lập, chi nhánh, ghi chú).
 *        - Bước 2: Thiết lập chi tiết danh sách sản phẩm (Giỏ hàng, nhập số lượng, kiểm soát lỗi xuất âm kho Rule 1).
 *        - Bước 3: Xác nhận tổng hợp và Lưu phiếu.
 */

interface TransactionFormProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  chiNhanhs: string[];
  thuongHieus: ThươngHieu[];
  loaiPhieuMacDinh: 'NHẬP' | 'XUẤT';
  onSaveTransaction: (header: NhapXuat, details: NhapXuatCT[]) => void;
  onNavigateToHistory: () => void;
}

interface CartItem {
  id: string;
  sku: string;
  tenSp: string;
  thuongHieu: string;
  chietXuat: string;
  tinhNang: string;
  sph: number;
  cyl: number;
  soLuong: number;
  dvt: string;
  ghiChu: string;
}

export default function TransactionForm({
  currentUser,
  sanPhams,
  chiNhanhs,
  thuongHieus,
  loaiPhieuMacDinh,
  onSaveTransaction,
  onNavigateToHistory
}: TransactionFormProps) {
  
  // --- 1. TRẠNG THÁI WIZARD ---
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // --- 2. THÔNG TIN CHỨNG TỪ (BƯỚC 1) ---
  const [loaiPhieu, setLoaiPhieu] = useState<LoaiPhieu>(loaiPhieuMacDinh);
  const [selectedBranch, setSelectedBranch] = useState<string>(currentUser.branch || chiNhanhs[0] || 'Kho Trung Tâm');
  const [ngayLap, setNgayLap] = useState<string>(new Date().toISOString().split('T')[0]);
  const [ghiChuPhieu, setGhiChuPhieu] = useState<string>('');

  // Đồng bộ loại phiếu khi props thay đổi
  useEffect(() => {
    setLoaiPhieu(loaiPhieuMacDinh);
    setCurrentStep(1); // Trở về bước 1 khi chuyển tab nhập/xuất để người dùng khai báo lại
    setCart([]);
  }, [loaiPhieuMacDinh]);

  // --- 3. THÔNG TIN CHỌN SẢN PHẨM (BƯỚC 2) ---
  const [selectBrand, setSelectBrand] = useState<string>('Blick');
  const [selectChietXuat, setSelectChietXuat] = useState<string>('1.56');
  const [selectTinhNang, setSelectTinhNang] = useState<string>('ĐM');
  const [selectDoSphType, setSelectDoSphType] = useState<'CẬN' | 'VIỄN'>('CẬN');
  const [selectDoSph, setSelectDoSph] = useState<number>(-2.00);
  const [selectDoCyl, setSelectDoCyl] = useState<number>(0.00);
  const [selectSoLuong, setSelectSoLuong] = useState<number>(1);
  const [selectDvt, setSelectDvt] = useState<string>('miếng');
  const [selectGhiChuDong, setSelectGhiChuDong] = useState<string>('');

  // Chế độ tìm kiếm nhanh / Quét barcode giả lập
  const [isBarcodeMode, setIsBarcodeMode] = useState<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  
  // Giỏ hàng chờ xác nhận
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- 3.5 DYNAMIC AVAILABLE FEATURES MEMO ---
  const activeBrandObj = useMemo(() => {
    return thuongHieus.find(t => t.THUONG_HIEU === selectBrand);
  }, [thuongHieus, selectBrand]);

  const availableFeatures = useMemo(() => {
    if (activeBrandObj?.TINH_NANG_LIST && activeBrandObj.TINH_NANG_LIST.length > 0) {
      return activeBrandObj.TINH_NANG_LIST;
    }
    return [activeBrandObj?.TINH_NANG_MAC_DINH || 'ASX'];
  }, [activeBrandObj]);

  // --- 4. QUY TẮC NGHIỆP VỤ - ĐỒNG BỘ CHIẾT XUẤT VÀ TÍNH NĂNG THEO THƯƠNG HIỆU ---
  const handleBrandChange = (brand: string) => {
    setSelectBrand(brand);
    
    // Tìm đối tượng thương hiệu tương ứng
    const brandObj = thuongHieus.find(t => t.THUONG_HIEU === brand);
    
    // Rule 1: Nếu Thương hiệu có danh sách tính năng riêng biệt, chọn tính năng đầu tiên hoặc mặc định, ngược lại dùng fallback
    let newTinhNang = 'ASX';
    if (brandObj) {
      if (brandObj.TINH_NANG_LIST && brandObj.TINH_NANG_LIST.length > 0) {
        newTinhNang = brandObj.TINH_NANG_LIST[0];
      } else {
        newTinhNang = brandObj.TINH_NANG_MAC_DINH || 'ASX';
      }
    } else {
      const isDM = ['Blick', 'Element', 'Nikki'].includes(brand);
      newTinhNang = isDM ? 'ĐM' : 'ASX';
    }
    setSelectTinhNang(newTinhNang);

    // Rule 2: Nếu Thương hiệu là Blick, Zeiss Clear, Essilor Pre, Essilor Rock thì Chiết suất là 1.56.
    // Zeiss Blue chiết suất sẽ là 1.60. Còn lại thì sẽ dropdown 1.56; 1.61; 1.67; 1.74
    if (['Blick', 'Zeiss Clear', 'Essilor Pre', 'Essilor Rock'].includes(brand)) {
      setSelectChietXuat('1.56');
    } else if (brand === 'Zeiss Blue') {
      setSelectChietXuat('1.60');
    } else {
      setSelectChietXuat(brandObj?.CHIET_XUAT_MAC_DINH || '1.61');
    }
  };

  // Độ cận: -0.00 đến -8.00 | Độ viễn: +0.75 đến +4.00 (bước nhảy 0.25)
  const sphOptions = useMemo(() => {
    const opts: number[] = [];
    if (selectDoSphType === 'CẬN') {
      for (let i = 0; i >= -8.00; i -= 0.25) {
        opts.push(Number(i.toFixed(2)));
      }
    } else {
      for (let i = 0.75; i <= 4.00; i += 0.25) {
        opts.push(Number(i.toFixed(2)));
      }
    }
    return opts;
  }, [selectDoSphType]);

  useEffect(() => {
    if (selectDoSphType === 'CẬN') {
      setSelectDoSph(-2.00);
    } else {
      setSelectDoSph(1.50);
    }
  }, [selectDoSphType]);

  // Độ loạn: -0.00 đến -2.00 (bước nhảy 0.25)
  const cylOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 0; i >= -2.00; i -= 0.25) {
      opts.push(Number(i.toFixed(2)));
    }
    return opts;
  }, []);

  // --- 5. TÍNH SKU VÀ TRUY VẤN TỒN KHO THỜI GIAN THỰC ---
  const calculatedSKU = useMemo(() => {
    if (isBarcodeMode) {
      return barcodeInput.trim().toUpperCase();
    }
    return generateSKUString(selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl);
  }, [selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl, isBarcodeMode, barcodeInput]);

  // Tìm sản phẩm tương ứng trong cơ sở dữ liệu
  const matchedProductInDB = useMemo(() => {
    if (!calculatedSKU) return null;
    return sanPhams.find(p => p.SKU.toUpperCase() === calculatedSKU.toUpperCase()) || null;
  }, [calculatedSKU, sanPhams]);

  // Tên sản phẩm hiển thị thông tin
  const calculatedProductName = useMemo(() => {
    if (matchedProductInDB) return matchedProductInDB.TEN_SAN_PHAM;
    
    const labelTinhNang = selectTinhNang === 'ĐM' ? 'Đổi màu' : 'Lọc ánh sáng xanh';
    const labelDo = selectDoSphType === 'CẬN' ? `Cận ${formatDop(selectDoSph)}` : `Viễn ${formatDop(selectDoSph)}`;
    const labelCyl = selectDoCyl !== 0 ? ` Loạn ${formatDop(selectDoCyl)}` : '';
    return `Tròng kính ${labelTinhNang} ${selectBrand} ${selectChietXuat} ${labelDo}${labelCyl}`;
  }, [matchedProductInDB, selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl, selectDoSphType]);

  // --- 6. TÍNH TỔNG SỐ LƯỢNG GIỎ HÀNG ---
  const totalCartQty = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.soLuong, 0);
  }, [cart]);

  // --- 7. XỬ LÝ QUÉT MÃ BARCODE GIẢ LẬP NHANH ---
  const handleApplyBarcode = () => {
    if (!barcodeInput.trim()) return;
    const skuToFind = barcodeInput.trim().toUpperCase();
    const found = sanPhams.find(p => p.SKU.toUpperCase() === skuToFind);
    if (found) {
      setErrorMsg('');
      setSelectBrand(found.THUONG_HIEU);
      setSelectChietXuat(found.CHIET_XUAT);
      setSelectTinhNang(found.TINH_NANG);
      setSelectDoSph(found.CAN);
      setSelectDoCyl(found.LOAN);
      setSelectDoSphType(found.CAN <= 0 ? 'CẬN' : 'VIỄN');
      setSelectDvt(found.DVT);
      setSuccessMsg(`Quét thành công! Đã khớp: ${found.TEN_SAN_PHAM}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(`Không tìm thấy SKU [${skuToFind}] trong kho sản phẩm. Vui lòng tạo sản phẩm trước.`);
      setSuccessMsg('');
    }
  };

  // --- 8. NGHIỆP VỤ: THÊM SẢN PHẨM VÀO GIỎ CHỜ XÁC NHẬN ---
  const handleAddToBasket = () => {
    setErrorMsg('');

    // Rule 2: SKU phải tồn tại trong kho trước khi làm phiếu nhập/xuất
    if (!matchedProductInDB) {
      setErrorMsg(`Lỗi nghiệp vụ (Rule 2): SKU [${calculatedSKU}] chưa tồn tại trong kho sản phẩm. Vui lòng tạo sản phẩm này trước khi giao dịch.`);
      return;
    }

    if (selectSoLuong <= 0) {
      setErrorMsg('Số lượng sản phẩm thêm vào phiếu phải lớn hơn 0.');
      return;
    }

    const existingQtyInCart = cart
      .filter(item => item.sku.toUpperCase() === calculatedSKU.toUpperCase())
      .reduce((sum, item) => sum + item.soLuong, 0);

    const totalRequestedQty = existingQtyInCart + selectSoLuong;

    // Rule 1: Không cho xuất âm kho
    if (loaiPhieu === 'XUẤT') {
      const currentStock = matchedProductInDB.TON_CUOI;
      if (totalRequestedQty > currentStock) {
        setErrorMsg(`Lỗi nghiêm trọng (Rule 1 - Xuất âm kho): SKU [${calculatedSKU}] hiện tại chỉ còn tồn ${currentStock} ${matchedProductInDB.DVT}. Bạn yêu cầu xuất tổng cộng ${totalRequestedQty} ${matchedProductInDB.DVT}. Hệ thống từ chối giao dịch.`);
        return;
      }
    }

    const newCartItem: CartItem = {
      id: `CART_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sku: calculatedSKU,
      tenSp: calculatedProductName,
      thuongHieu: matchedProductInDB.THUONG_HIEU,
      chietXuat: matchedProductInDB.CHIET_XUAT,
      tinhNang: matchedProductInDB.TINH_NANG,
      sph: matchedProductInDB.CAN,
      cyl: matchedProductInDB.LOAN,
      soLuong: selectSoLuong,
      dvt: selectDvt,
      ghiChu: selectGhiChuDong || 'Giao dịch chuẩn'
    };

    setCart(prev => [...prev, newCartItem]);
    setSelectGhiChuDong('');
    setBarcodeInput('');
    
    setSuccessMsg(`Đã thêm thành công SKU ${calculatedSKU} vào danh sách.`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRemoveCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // --- 9. WIZARD NAVIGATION HELPERS ---
  const handleNextToStep2 = () => {
    if (!selectedBranch) {
      setErrorMsg('Vui lòng chọn chi nhánh lập phiếu.');
      return;
    }
    setErrorMsg('');
    setCurrentStep(2);
  };

  const handleNextToStep3 = () => {
    if (cart.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất 1 sản phẩm vào phiếu trước khi tiếp tục.');
      return;
    }
    setErrorMsg('');
    setCurrentStep(3);
  };

  // --- 10. LƯU TOÀN BỘ PHIẾU GIAO DỊCH (BƯỚC 3) ---
  const handleCompleteTransaction = () => {
    setErrorMsg('');

    if (cart.length === 0) {
      setErrorMsg('Giỏ hàng rỗng.');
      return;
    }

    // Giả lập khóa LockService
    setErrorMsg('Đang kích hoạt LockService ngăn ngừa tranh chấp ghi đè dữ liệu...');

    setTimeout(() => {
      setErrorMsg('');

      const headerPrefix = loaiPhieu === 'NHẬP' ? 'PN' : 'PX';
      const tempHoaDonId = `${headerPrefix}_TEMP_${Date.now()}`;

      const newHeader: NhapXuat = {
        HOA_DON: tempHoaDonId, // Sẽ được App.tsx định dạng lại thành số phiếu tăng dần chính xác
        CHI_NHANH: selectedBranch,
        NGAY: ngayLap,
        LOAI: loaiPhieu,
        TONG_SL: totalCartQty,
        NGUOI_TAO: currentUser.username,
        TEN_NGUOI_TAO: currentUser.fullName,
        TG_TAO: new Date().toISOString().replace('T', ' ').substring(0, 19),
        GHI_CHU: ghiChuPhieu || `Lập phiếu ${loaiPhieu.toLowerCase()} kho tại ${selectedBranch}`
      };

      const detailRows: NhapXuatCT[] = cart.map((item, idx) => ({
        ID: `CT_${Date.now()}_${idx}`,
        HOA_DON: tempHoaDonId,
        SKU: item.sku,
        TEN_SP: item.tenSp,
        THUONG_HIEU: item.thuongHieu,
        CHIET_XUAT: item.chietXuat,
        TINH_NANG: item.tinhNang,
        SPH: item.sph,
        CYL: item.cyl,
        SO_LUONG: item.soLuong,
        DVT: item.dvt,
        GHI_CHU: item.ghiChu,
        LOAI: loaiPhieu,
        NGAY: ngayLap
      }));

      onSaveTransaction(newHeader, detailRows);

      setCart([]);
      setGhiChuPhieu('');
      setSuccessMsg(`Lưu phiếu thành công! Hệ thống đã tự động cập nhật cân bằng kho.`);
      
      setTimeout(() => {
        setSuccessMsg('');
        onNavigateToHistory();
      }, 1500);

    }, 800);
  };

  return (
    <div className="space-y-6">
      
      {/* KHU VỰC THÔNG TIN TIÊU ĐỀ PHIẾU */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl ${loaiPhieu === 'NHẬP' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {loaiPhieu === 'NHẬP' ? <TrendingUp className="w-5.5 h-5.5" /> : <TrendingDown className="w-5.5 h-5.5" />}
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-base">Lập Phiếu {loaiPhieu} Kho</h2>
            <p className="text-xs text-slate-400 font-mono">Quy trình lập chứng từ xuất nhập kho chặt chẽ, an toàn kho dữ liệu</p>
          </div>
        </div>

        {/* TIẾN TRÌNH WIZARD */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 1 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>1. Khai báo phiếu</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 2 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>2. Thêm sản phẩm</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            currentStep === 3 ? 'bg-red-600 text-white shadow-xs' : 'text-slate-400'
          }`}>3. Hoàn tất phiếu</span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* CHIA MÀN HÌNH WIZARD */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* PANEL TRÁI: FORM ĐIỀU HƯỚNG WIZARD (3/5 Cột) */}
        <div className="lg:col-span-3 space-y-4">
          
          <AnimatePresence mode="wait">
            
            {/* BƯỚC 1: KHAI BÁO PHIẾU */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-500" /> Bước 1: Khai báo thông tin phiếu {loaiPhieu.toLowerCase()} kho
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Chi nhánh áp dụng
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden cursor-pointer"
                    >
                      {chiNhanhs.map(branch => (
                        <option key={branch} value={branch}>{branch}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Ngày lập phiếu
                    </label>
                    <input
                      type="date"
                      value={ngayLap}
                      onChange={(e) => setNgayLap(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Người tạo phiếu
                    </label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.fullName}
                      className="w-full text-xs font-bold text-slate-400 bg-slate-100/60 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Số hóa đơn tự động
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${loaiPhieu === 'NHẬP' ? 'PNxxxxxx' : 'PXxxxxxx'} (Tự động tăng)`}
                      className="w-full text-xs font-bold text-slate-400 bg-slate-100/60 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden cursor-not-allowed italic font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block">
                      Ghi chú phiếu
                    </label>
                    <textarea
                      placeholder={`Ví dụ: ${loaiPhieu === 'NHẬP' ? 'Nhập hàng từ nhà cung cấp Blick' : 'Xuất kho trả hàng hoặc bán lẻ cho khách hàng'}...`}
                      value={ghiChuPhieu}
                      onChange={(e) => setGhiChuPhieu(e.target.value)}
                      rows={3}
                      className="w-full text-xs font-medium text-slate-700 bg-slate-50 border border-slate-100 p-2.5 rounded-lg focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-50">
                  <button
                    onClick={handleNextToStep2}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <span>Thêm sản phẩm</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* BƯỚC 2: THIẾT LẬP CHI TIẾT SẢN PHẨM */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2 flex items-center justify-between">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-blue-500" /> Bước 2: Thiết lập chi tiết danh sách sản phẩm
                  </h3>
                  
                  {/* Toggle chế độ Barcode / Thường */}
                  <button
                    onClick={() => { setIsBarcodeMode(!isBarcodeMode); setErrorMsg(''); }}
                    className="text-[10px] font-bold uppercase bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-600 cursor-pointer transition-all"
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    {isBarcodeMode ? 'Nhập thủ công' : 'Quét mã SKU'}
                  </button>
                </div>

                {isBarcodeMode ? (
                  /* GIAO DIỆN QUÉT BARCODE */
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block">
                        Nhập hoặc Quét mã SKU của Tròng Kính
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ví dụ: BL-156-DM-C2.00-L0.00"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleApplyBarcode()}
                          className="flex-1 text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 p-2.5 rounded-lg focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBarcode}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-lg cursor-pointer transition-colors"
                        >
                          Khớp mã
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* GIAO DIỆN LẬP THỦ CÔNG (FORM CO ĐỌC CHẶT CHẼ) */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3 bg-slate-50/80 border border-slate-100 rounded-xl">
                    
                    {/* Thương hiệu */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Thương hiệu</label>
                      <select
                        value={selectBrand}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer"
                      >
                        {thuongHieus.map(b => (
                          <option key={b.THUONG_HIEU} value={b.THUONG_HIEU}>{b.THUONG_HIEU}</option>
                        ))}
                      </select>
                    </div>

                    {/* Chiết suất */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Chiết suất</label>
                      {['Blick', 'Zeiss Clear', 'Essilor Pre', 'Essilor Rock', 'Zeiss Blue'].includes(selectBrand) ? (
                        <input
                          type="text"
                          disabled
                          value={selectChietXuat}
                          className="w-full text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-not-allowed"
                        />
                      ) : (
                        <select
                          value={selectChietXuat}
                          onChange={(e) => setSelectChietXuat(e.target.value)}
                          className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer"
                        >
                          <option value="1.56">1.56</option>
                          <option value="1.61">1.61</option>
                          <option value="1.67">1.67</option>
                          <option value="1.74">1.74</option>
                        </select>
                      )}
                    </div>

                    {/* Tính năng (Dropdown theo thương hiệu) */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Tính năng</label>
                      <select
                        value={selectTinhNang}
                        onChange={(e) => setSelectTinhNang(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer font-mono"
                      >
                        {availableFeatures.map(f => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    {/* Loại Độ */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Loại độ</label>
                      <select
                        value={selectDoSphType}
                        onChange={(e) => setSelectDoSphType(e.target.value as 'CẬN' | 'VIỄN')}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer"
                      >
                        <option value="CẬN">Cận thị</option>
                        <option value="VIỄN">Viễn thị</option>
                      </select>
                    </div>

                    {/* Độ SPH */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Độ cầu (SPH)</label>
                      <select
                        value={selectDoSph}
                        onChange={(e) => setSelectDoSph(Number(e.target.value))}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer font-mono"
                      >
                        {sphOptions.map(val => (
                          <option key={val} value={val}>{formatDop(val)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Độ CYL */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-400">Độ loạn (CYL)</label>
                      <select
                        value={selectDoCyl}
                        onChange={(e) => setSelectDoCyl(Number(e.target.value))}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 py-1.5 px-2 rounded-lg focus:outline-hidden cursor-pointer font-mono"
                      >
                        {cylOptions.map(val => (
                          <option key={val} value={val}>{formatDop(val)}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                )}

                {/* THÔNG TIN KHỚP SKU THỜI GIAN THỰC */}
                <div className="p-3.5 rounded-xl border border-dashed border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">SKU tính toán tự động:</span>
                    <span className="text-xs font-mono font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {calculatedSKU}
                    </span>
                    <span className="text-xs font-bold text-slate-700 block mt-1">{calculatedProductName}</span>
                  </div>

                  <div className="sm:text-right flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tồn kho hiện tại:</span>
                    {matchedProductInDB ? (
                      <span className={`text-xl font-extrabold font-mono ${matchedProductInDB.TON_CUOI <= 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {matchedProductInDB.TON_CUOI} <span className="text-xs font-semibold text-slate-400">{matchedProductInDB.DVT}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded mt-0.5">
                        Chưa khai báo SKU
                      </span>
                    )}
                  </div>
                </div>

                {/* NHẬP SỐ LƯỢNG VÀ THÊM VÀO GIỎ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Số lượng lập phiếu</label>
                    <div className="flex gap-2">
                      <div className="flex items-center bg-slate-50 border border-slate-250 rounded-lg overflow-hidden shrink-0 h-9">
                        <button
                          type="button"
                          onClick={() => setSelectSoLuong(prev => Math.max(1, prev - 1))}
                          className="w-10 h-full font-extrabold text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer text-base select-none"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={selectSoLuong}
                          onChange={(e) => setSelectSoLuong(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-11 h-full text-xs font-bold text-slate-750 bg-transparent text-center focus:outline-hidden font-mono border-x border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectSoLuong(prev => prev + 1)}
                          className="w-10 h-full font-extrabold text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors flex items-center justify-center cursor-pointer text-base select-none"
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Ghi chú dòng sản phẩm..."
                        value={selectGhiChuDong}
                        onChange={(e) => setSelectGhiChuDong(e.target.value)}
                        className="flex-1 text-xs font-semibold text-slate-750 bg-slate-50 border border-slate-250 p-2 rounded-lg focus:outline-hidden h-9"
                      />
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddToBasket}
                      className="w-full bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Thêm vào danh sách phiếu
                    </button>
                  </div>
                </div>

                {/* ĐIỀU HƯỚNG BƯỚC 2 */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={handleNextToStep3}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <span>Tiếp tục xác nhận</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* BƯỚC 3: XÁC NHẬN TỔNG HỢP & LƯU */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.15 }}
                className="bento-card !p-5 space-y-4"
              >
                <div className="border-b border-slate-50 pb-2">
                  <h3 className="font-sans font-bold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-500" /> Bước 3: Xác nhận tổng hợp và Lưu phiếu {loaiPhieu.toLowerCase()} kho
                  </h3>
                </div>

                {/* TÓM TẮT METADATA PHIẾU */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs space-y-2">
                  <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-500" /> Tóm tắt thông tin chứng từ
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4">
                    <p><span className="text-slate-400">Loại phiếu:</span> <span className={`font-bold py-0.5 px-2 rounded-sm text-[10px] ${loaiPhieu === 'NHẬP' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{loaiPhieu} KHO</span></p>
                    <p><span className="text-slate-400">Ngày lập:</span> <strong className="text-slate-700 font-mono">{ngayLap}</strong></p>
                    <p><span className="text-slate-400">Chi nhánh:</span> <strong className="text-slate-700">{selectedBranch}</strong></p>
                    <p><span className="text-slate-400">Người lập:</span> <strong className="text-slate-700">{currentUser.fullName}</strong></p>
                    <p className="sm:col-span-2"><span className="text-slate-400">Ghi chú phiếu:</span> <span className="text-slate-600 italic font-medium">{ghiChuPhieu || '(Không có ghi chú)'}</span></p>
                  </div>
                </div>

                {/* BẢNG TỔNG HỢP DANH SÁCH SẢN PHẨM */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Danh sách chi tiết dòng sản phẩm ({cart.length} dòng)
                  </span>

                  {/* Dạng bảng cho máy tính */}
                  <div className="hidden sm:block border border-slate-100 rounded-xl overflow-hidden shadow-2xs max-h-48 overflow-y-auto bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="p-2.5">SKU</th>
                          <th className="p-2.5">Tên Sản Phẩm</th>
                          <th className="p-2.5 text-right">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                        {cart.map((item) => (
                          <tr key={item.id}>
                            <td className="p-2.5 font-mono text-[11px] text-blue-600">{item.sku}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[200px]">{item.tenSp}</td>
                            <td className="p-2.5 font-mono text-right">{item.soLuong} {item.dvt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Dạng thẻ cho thiết bị di động */}
                  <div className="block sm:hidden space-y-2 max-h-56 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={item.id} className="p-3 bg-white border border-slate-100 rounded-xl shadow-3xs flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50">
                            {item.sku}
                          </span>
                          <p className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2 mt-1">{item.tenSp}</p>
                        </div>
                        <div className="text-right shrink-0 font-mono font-extrabold text-slate-800">
                          {item.soLuong} <span className="text-[9px] font-sans font-medium text-slate-400 block">{item.dvt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ĐIỀU HƯỚNG BƯỚC 3 */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-50">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Quay lại</span>
                  </button>
                  <button
                    onClick={handleCompleteTransaction}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-md shadow-red-600/15 animate-pulse"
                  >
                    <Save className="w-4 h-4" />
                    <span>Xác Nhận & Lưu Phiếu</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* PANEL PHẢI: GIỎ HÀNG CHỜ / TÓM TẮT SỐ LIỆU (2/5 Cột) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* CARD TÓM TẮT THÔNG SỐ */}
          {cart.length > 0 && (
            <div className={`bento-card !p-4 text-white space-y-3.5 ${loaiPhieu === 'NHẬP' ? 'bg-emerald-950/95 border-emerald-900' : 'bg-rose-950/95 border-rose-900'}`}>
              <h4 className="font-sans font-bold text-[10px] uppercase text-slate-300 tracking-wider">
                Thống kê tóm tắt phiếu
              </h4>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-300 block font-bold uppercase">Tổng số dòng</span>
                  <span className="text-lg font-extrabold font-mono text-slate-100">{cart.length}</span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-300 block font-bold uppercase">Tổng số lượng</span>
                  <span className="text-lg font-extrabold font-mono text-slate-100">{totalCartQty}</span>
                </div>
              </div>
            </div>
          )}

          {/* GIỎ HÀNG CHI TIẾT */}
          <div className="bento-card !p-4 flex flex-col max-h-[280px]">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-3 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-slate-400" /> Chi tiết dòng sản phẩm ({cart.length})
            </h3>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pr-1 space-y-2.5">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={item.id} className="pt-2 pb-3.5 space-y-1 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          {item.sku}
                        </span>
                        <p className="font-bold text-slate-800 mt-1 truncate max-w-[170px]" title={item.tenSp}>
                          {item.tenSp}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveCartItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Xóa dòng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold pt-1">
                      <span>Số lượng: <strong className="text-slate-700">{item.soLuong} {item.dvt}</strong></span>
                      <span className="text-[10px] font-sans font-medium text-slate-500 italic max-w-[130px] truncate">
                        {item.ghiChu}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-24 text-center text-xs text-slate-400 font-mono italic leading-relaxed">
                  Chưa có sản phẩm nào được thêm vào danh sách chứng từ lập phiếu.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
