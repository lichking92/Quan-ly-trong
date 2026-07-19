/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { monitor } from '../utils/debugMonitor';
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
  FileUp,
  FileDown,
  Info,
  CheckCircle,
  Clock,
  ShoppingBag,
  ListPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SanPham, NhapXuat, NhapXuatCT, LoaiPhieu, User as UserType, ThuongHieu } from '../types';
import { generateSKUString, formatDop, getVietnamDateString, getVietnamDateTimeString, generateSphOptions, formatSKUForDisplay, cleanSKU } from '../data/mockData';

/**
 * FILE: TransactionForm.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Xử lý nghiệp vụ lập phiếu Nhập kho / Xuất kho.
 *        Tự động tính toán SKU, truy vấn tồn hiện tại trong kho theo thời gian thực,
 *        kiểm soát lỗi xuất âm kho cực kỳ nghiêm ngặt (Rule 1), và đồng bộ giỏ hàng chờ xác nhận.
 */

interface TransactionFormProps {
  currentUser: UserType;
  sanPhams: SanPham[];
  chiNhanhs: string[];
  thuongHieus: string[];
  brandList?: ThuongHieu[];
  loaiPhieuMacDinh: 'NHẬP' | 'XUẤT';
  prefilledSku?: string;
  onClearPrefilledSku?: () => void;
  prefilledCartItems?: { sku: string; soLuong: number; }[];
  onClearPrefilledCartItems?: () => void;
  onSaveTransaction: (header: NhapXuat, details: NhapXuatCT[]) => void;
  onNavigateToHistory: () => void;
  onTriggerToast?: (message: string) => void;
  hasPermission?: (permissionCode: string) => boolean;
}

// Kiểu dữ liệu tạm thời cho dòng sản phẩm trong giỏ hàng chờ xác nhận
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
  brandList,
  loaiPhieuMacDinh,
  prefilledSku,
  onClearPrefilledSku,
  prefilledCartItems,
  onClearPrefilledCartItems,
  onSaveTransaction,
  onNavigateToHistory,
  onTriggerToast,
  hasPermission
}: TransactionFormProps) {
  monitor.trackRender('TransactionForm');

  const hasPerm = (p: string) => {
    if (hasPermission) return hasPermission(p);
    return currentUser?.writeAccess !== false;
  };
  
  // --- 1. THÔNG TIN CHỨNG TỪ (BẢNG 1) ---
  const [loaiPhieu, setLoaiPhieu] = useState<LoaiPhieu>(loaiPhieuMacDinh);
  const canWrite = loaiPhieu === 'NHẬP' ? hasPerm('picking_nhap.create') : hasPerm('picking_xuat.create');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [ngayLap, setNgayLap] = useState<string>(getVietnamDateString());
  const [ghiChuPhieu, setGhiChuPhieu] = useState<string>('');

  // Trạng thái đáp ứng Mobile Onboarding Step-by-Step
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [toastPending, setToastPending] = useState<{ message: string } | null>(null);
  const [isAdded, setIsAdded] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Đồng bộ loại phiếu khi props thay đổi
  useEffect(() => {
    setLoaiPhieu(loaiPhieuMacDinh);
  }, [loaiPhieuMacDinh]);

  // --- 2. THÔNG TIN CHỌN SẢN PHẨM (BẢNG 2) ---
  const [selectBrand, setSelectBrand] = useState<string>('Blick');
  const [selectChietXuat, setSelectChietXuat] = useState<string>('1.56');
  const [selectTinhNang, setSelectTinhNang] = useState<string>('ĐM');
  const [selectDoSphType, setSelectDoSphType] = useState<'CẬN' | 'VIỄN'>('CẬN');
  const [selectDoSph, setSelectDoSph] = useState<number>(-2.00);
  const [selectDoCyl, setSelectDoCyl] = useState<number>(0.00);
  const [selectSoLuong, setSelectSoLuong] = useState<number>(1);
  const [selectDvt, setSelectDvt] = useState<string>('miếng');
  const [selectGhiChuDong, setSelectGhiChuDong] = useState<string>('');

  // Tự động điền dữ liệu khi có SKU cần restock nhanh từ Dashboard
  useEffect(() => {
    if (prefilledSku) {
      const found = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(prefilledSku));
      if (found) {
        setErrorMsg('');
        setLoaiPhieu('NHẬP');
        setSelectBrand(found.THUONG_HIEU);
        setSelectChietXuat(found.CHIET_XUAT);
        setSelectTinhNang(found.TINH_NANG);
        setSelectDoSph(found.CAN);
        setSelectDoCyl(found.LOAN);
        setSelectDoSphType(found.CAN <= 0 ? 'CẬN' : 'VIỄN');
        setSelectDvt(found.DVT);
        setIsBarcodeMode(false); // Trả về dạng form thuộc tính chi tiết để xem cho rõ
        setSelectSoLuong(Math.max(1, found.TON_TOI_THIEU - found.TON_CUOI + 2)); // Gợi ý số lượng tối ưu để lấp đầy kho
        
        // Chuyển step thành 2 trên Mobile để vào thẳng màn hình cấu hình sản phẩm
        if (window.innerWidth < 768) {
          setCurrentStep(2);
        }
        
        setSuccessMsg(`Hệ thống đã tự động chọn SKU: ${found.SKU}. Vui lòng nhập số lượng và bấm 'Thêm Vào Phiếu Chờ'.`);
        setTimeout(() => setSuccessMsg(''), 6000);
      }
      
      if (onClearPrefilledSku) {
        onClearPrefilledSku();
      }
    }
  }, [prefilledSku, sanPhams, onClearPrefilledSku]);

  // Tự động điền hàng loạt sản phẩm khi được chuyển từ "Kiểm tra đơn hàng"
  useEffect(() => {
    if (prefilledCartItems && prefilledCartItems.length > 0) {
      const newItems: CartItem[] = [];
      prefilledCartItems.forEach((item, idx) => {
        const found = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
        if (found) {
          newItems.push({
            id: `CART_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
            sku: found.SKU,
            tenSp: found.TEN_SAN_PHAM,
            thuongHieu: found.THUONG_HIEU,
            chietXuat: found.CHIET_XUAT,
            tinhNang: found.TINH_NANG,
            sph: found.CAN,
            cyl: found.LOAN,
            soLuong: item.soLuong,
            dvt: found.DVT,
            ghiChu: 'Phân tích tự động từ tin nhắn'
          });
        }
      });
      if (newItems.length > 0) {
        setCart(newItems);
        setLoaiPhieu('XUẤT'); // Luôn chuyển sang phiếu xuất theo yêu cầu nghiệp vụ
        setErrorMsg('');
        setSuccessMsg(`Đã tự động thêm ${newItems.length} sản phẩm từ đơn hàng tin nhắn vào Phiếu Xuất.`);
        setTimeout(() => setSuccessMsg(''), 6000);
      }
      if (onClearPrefilledCartItems) {
        onClearPrefilledCartItems();
      }
    }
  }, [prefilledCartItems, sanPhams, onClearPrefilledCartItems]);

  // Chế độ tìm kiếm nhanh / Quét barcode giả lập
  const [isBarcodeMode, setIsBarcodeMode] = useState<boolean>(false);
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  
  // Trạng thái báo lỗi và giỏ hàng chờ xác nhận (Bảng 3)
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- 3. QUY TẮC NGHIỆP VỤ - ĐỒNG BỘ CHIẾT XUẤT VÀ TÍNH NĂNG THEO THƯƠNG HIỆU ---
  const availableFeatures = useMemo(() => {
    if (!brandList) return ['ĐM', 'ASX'];
    const featuresSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim() === selectBrand.trim())
      .forEach(b => {
        const valStr = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(f => featuresSet.add(f));
        }
      });
    const result = Array.from(featuresSet);
    return result.length > 0 ? result : ['ĐM', 'ASX'];
  }, [brandList, selectBrand]);

  const availableChietXuats = useMemo(() => {
    if (!brandList) return ['1.56', '1.60', '1.61', '1.67', '1.74'];
    const cxSet = new Set<string>();
    brandList
      .filter(b => b.THUONG_HIEU.trim() === selectBrand.trim())
      .forEach(b => {
        const valStr = b.CHIET_XUAT_MAC_DINH || '';
        if (valStr) {
          valStr.split(',').map(s => s.trim()).filter(Boolean).forEach(cx => cxSet.add(cx));
        }
      });
    const result = Array.from(cxSet);
    return result.length > 0 ? result : ['1.56', '1.60', '1.61', '1.67', '1.74'];
  }, [brandList, selectBrand]);

  useEffect(() => {
    if (availableFeatures.length > 0 && !availableFeatures.includes(selectTinhNang)) {
      setSelectTinhNang(availableFeatures[0]);
    }
  }, [availableFeatures, selectTinhNang]);

  useEffect(() => {
    if (availableChietXuats.length > 0 && !availableChietXuats.includes(selectChietXuat)) {
      setSelectChietXuat(availableChietXuats[0]);
    }
  }, [availableChietXuats, selectChietXuat]);

  const handleBrandChange = (brand: string) => {
    setSelectBrand(brand);
    
    let nextFeature = '';
    let nextChietXuat = '';

    if (brandList) {
      const matchedBrands = brandList.filter(b => b.THUONG_HIEU.trim() === brand.trim());
      
      const featuresSet = new Set<string>();
      const cxSet = new Set<string>();

      matchedBrands.forEach(b => {
        const fStr = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
        if (fStr) {
          fStr.split(',').map(s => s.trim()).filter(Boolean).forEach(f => featuresSet.add(f));
        }
        const cxStr = b.CHIET_XUAT_MAC_DINH || '';
        if (cxStr) {
          cxStr.split(',').map(s => s.trim()).filter(Boolean).forEach(cx => cxSet.add(cx));
        }
      });

      const fList = Array.from(featuresSet);
      const cxList = Array.from(cxSet);

      if (fList.length > 0) {
        nextFeature = fList[0];
      }
      if (cxList.length > 0) {
        nextChietXuat = cxList[0];
      }
    }

    if (nextFeature) {
      setSelectTinhNang(nextFeature);
    } else {
      const isDM = ['Blick', 'Element', 'Nikki'].includes(brand);
      setSelectTinhNang(isDM ? 'ĐM' : 'ASX');
    }

    if (nextChietXuat) {
      setSelectChietXuat(nextChietXuat);
    } else {
      if (['Blick', 'Zeiss Clear', 'Essilor Pre', 'Essilor Rock'].includes(brand)) {
        setSelectChietXuat('1.56');
      } else if (brand === 'Zeiss Blue') {
        setSelectChietXuat('1.60');
      } else {
        setSelectChietXuat('1.61');
      }
    }
  };

  // Độ cầu SPH: Lấy theo cấu hình phạm vi của thương hiệu / chiết suất đang chọn
  const sphOptions = useMemo(() => {
    return generateSphOptions(selectBrand, selectChietXuat, brandList || [], selectDoSphType);
  }, [selectBrand, selectChietXuat, brandList, selectDoSphType]);

  useEffect(() => {
    if (sphOptions.length > 0) {
      if (!sphOptions.includes(selectDoSph)) {
        // Mặc định chọn phần tử có sẵn phù hợp hoặc phần tử đầu tiên
        if (selectDoSphType === 'CẬN' && sphOptions.includes(-2.00)) {
          setSelectDoSph(-2.00);
        } else if (selectDoSphType === 'VIỄN' && sphOptions.includes(1.50)) {
          setSelectDoSph(1.50);
        } else {
          setSelectDoSph(sphOptions[0]);
        }
      }
    }
  }, [sphOptions, selectDoSph, selectDoSphType]);

  // Độ loạn: -0.00 đến -2.00 (bước nhảy 0.25)
  const cylOptions = useMemo(() => {
    const opts: number[] = [];
    for (let i = 0; i >= -2.00; i -= 0.25) {
      opts.push(Number(i.toFixed(2)));
    }
    return opts;
  }, []);

  // --- 4. TÍNH SKU VÀ TRUY VẤN TỒN KHO THỜI GIAN THỰC ---
  const calculatedSKU = useMemo(() => {
    if (isBarcodeMode) {
      // Ở chế độ barcode, chúng ta dùng trực tiếp barcode input làm SKU
      return barcodeInput.trim().toUpperCase();
    }
    return generateSKUString(selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl);
  }, [selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl, isBarcodeMode, barcodeInput]);

  // Tìm sản phẩm tương ứng trong cơ sở dữ liệu
  const matchedProductInDB = useMemo(() => {
    if (!calculatedSKU) return null;
    return sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(calculatedSKU)) || null;
  }, [calculatedSKU, sanPhams]);

  // Tên sản phẩm hiển thị thông tin
  const calculatedProductName = useMemo(() => {
    if (matchedProductInDB) return matchedProductInDB.TEN_SAN_PHAM;
    
    // Nếu chưa tồn tại trong DB, dựng tên tự động
    const labelTinhNang = selectTinhNang === 'ĐM' ? 'Đổi màu' : 'Lọc ánh sáng xanh';
    const labelDo = selectDoSphType === 'CẬN' ? `Cận ${formatDop(selectDoSph)}` : `Viễn ${formatDop(selectDoSph)}`;
    const labelCyl = selectDoCyl !== 0 ? ` Loạn ${formatDop(selectDoCyl)}` : '';
    return `Tròng kính ${labelTinhNang} ${selectBrand} ${selectChietXuat} ${labelDo}${labelCyl}`;
  }, [matchedProductInDB, selectBrand, selectChietXuat, selectTinhNang, selectDoSph, selectDoCyl, selectDoSphType]);

  // --- 5. TÍNH TỔNG SỐ LƯỢNG GIỎ HÀNG (BẢNG 3) ---
  const totalCartQty = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.soLuong, 0);
  }, [cart]);

  // Dự đoán tồn kho sau khi giao dịch thành công để cảnh báo sớm (Tab Xuất)
  const estimatedPostStock = useMemo(() => {
    if (!matchedProductInDB) return 0;
    return matchedProductInDB.TON_CUOI - (loaiPhieu === 'XUẤT' ? selectSoLuong : 0);
  }, [matchedProductInDB, loaiPhieu, selectSoLuong]);

  const isWarningLowStock = useMemo(() => {
    if (!matchedProductInDB || loaiPhieu !== 'XUẤT') return false;
    return estimatedPostStock <= matchedProductInDB.TON_TOI_THIEU;
  }, [matchedProductInDB, loaiPhieu, estimatedPostStock]);

  // --- 6. XỬ LÝ QUÉT MÃ BARCODE GIẢ LẬP NHANH ---
  const handleApplyBarcode = () => {
    if (!barcodeInput.trim()) return;
    const skuToFind = barcodeInput.trim();
    const found = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(skuToFind));
    if (found) {
      setErrorMsg('');
      setSelectBrand(found.THUONG_HIEU);
      setSelectChietXuat(found.CHIET_XUAT);
      setSelectTinhNang(found.TINH_NANG);
      setSelectDoSph(found.CAN);
      setSelectDoCyl(found.LOAN);
      setSelectDoSphType(found.CAN <= 0 ? 'CẬN' : 'VIỄN');
      setSelectDvt(found.DVT);
      setSuccessMsg(`Quét thành công! Tìm thấy sản phẩm: ${found.TEN_SAN_PHAM}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } else {
      setErrorMsg(`Không tìm thấy SKU [${skuToFind}] trong kho sản phẩm. Vui lòng tạo sản phẩm trước.`);
      setSuccessMsg('');
    }
  };

  // --- 7. NGHIỆP VỤ: THÊM SẢN PHẨM VÀO GIỎ CHỜ XÁC NHẬN ---
  const handleAddToBasket = () => {
    setErrorMsg('');

    // Rule 2: SKU phải tồn tại trong kho trước khi làm phiếu nhập/xuất
    if (!matchedProductInDB) {
      setErrorMsg(`Lỗi nghiệp vụ (Rule 2): SKU [${calculatedSKU}] chưa tồn tại trong kho sản phẩm. Vui lòng tạo sản phẩm này trong tab "Sản Phẩm" trước khi thực hiện giao dịch.`);
      return;
    }

    if (selectSoLuong <= 0) {
      setErrorMsg('Lỗi: Số lượng sản phẩm thêm vào phiếu phải lớn hơn 0.');
      return;
    }

    // Tính lượng đã có sẵn trong giỏ của SKU này để kiểm tra tồn dồn tích
    const existingQtyInCart = cart
      .filter(item => cleanSKU(item.sku) === cleanSKU(calculatedSKU))
      .reduce((sum, item) => sum + item.soLuong, 0);

    const totalRequestedQty = existingQtyInCart + selectSoLuong;

    // Rule 1: Không cho xuất âm kho
    if (loaiPhieu === 'XUẤT') {
      const currentStock = matchedProductInDB.TON_CUOI;
      if (totalRequestedQty > currentStock) {
        setErrorMsg(`Lỗi nghiêm trọng (Rule 1 - Xuất âm kho): SKU [${calculatedSKU}] hiện tại chỉ còn tồn ${currentStock} ${matchedProductInDB.DVT}. Bạn yêu cầu xuất tổng cộng ${totalRequestedQty} ${matchedProductInDB.DVT} (bao gồm cả hàng đã có trong giỏ). Hệ thống từ chối giao dịch.`);
        return;
      }
    }

    // Đủ điều kiện => Thêm vào giỏ
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
    
    // Bỏ toast overlay, chuyển sang trạng thái ✓ Đã thêm nhỏ ngay cạnh nút
    setIsAdded(true);
    setTimeout(() => {
      setIsAdded(false);
    }, 1500);
  };

  // Xóa một dòng sản phẩm khỏi giỏ hàng chờ (Bảng 3)
  const handleRemoveCartItem = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Cập nhật số lượng cho dòng sản phẩm trong giỏ hàng chờ trực tiếp
  const handleUpdateCartItemQty = (id: string, newQty: number) => {
    const finalQty = Math.max(1, newQty);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, soLuong: finalQty };
      }
      return item;
    }));
  };

  // Phân tích lỗi vượt tồn kho cho từng dòng sản phẩm
  const cartItemStockErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    cart.forEach(item => {
      if (loaiPhieu === 'XUẤT') {
        const prod = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
        const stock = prod ? prod.TON_CUOI : 0;
        if (item.soLuong > stock) {
          errors[item.id] = `Yêu cầu (${item.soLuong} miếng) vượt quá tồn kho hiện có (${stock} miếng).`;
        }
      }
    });
    return errors;
  }, [cart, sanPhams, loaiPhieu]);

  // --- 8. NGHIỆP VỤ LƯU TOÀN BỘ PHIẾU GIAO DỊCH (HOÀN THÀNH & LƯU) ---
  const handleCompleteTransaction = () => {
    setErrorMsg('');

    if (!selectedBranch) {
      setErrorMsg('Lỗi: Bạn bắt buộc phải tự chọn chi nhánh thực hiện giao dịch trước khi lưu phiếu.');
      // Cuộn lên đầu để xem lỗi hoặc chuyển step 1 nếu đang ở mobile
      if (isMobile) {
        setCurrentStep(1);
      }
      return;
    }

    if (cart.length === 0) {
      setErrorMsg('Lỗi: Bạn chưa chọn bất kỳ sản phẩm nào để tạo phiếu.');
      return;
    }

    // Kiểm tra không cho xuất âm kho dồn dính
    if (loaiPhieu === 'XUẤT') {
      const hasErrors = Object.keys(cartItemStockErrors).length > 0;
      if (hasErrors) {
        setErrorMsg('Lỗi nghiêm trọng (Rule 1): Có sản phẩm trong phiếu xuất vượt quá tồn kho thực tế khả dụng. Vui lòng điều chỉnh lại số lượng trước khi lưu phiếu.');
        return;
      }
    }

    // Giả lập khóa LockService bằng Code xử lý bất đồng bộ
    // LockService tránh tranh chấp ghi đồng thời dữ liệu lên sheet database
    setErrorMsg('Đang kích hoạt LockService ngăn ngừa tranh chấp ghi đè dữ liệu...');

    setTimeout(() => {
      setErrorMsg('');

      // 1. Tạo số phiếu tự tăng (Sẽ được quản lý tự tăng ở State App chính)
      // Mã phiếu định dạng: PN000001, PX000001 dựa vào LoaiPhieu
      const headerPrefix = loaiPhieu === 'NHẬP' ? 'PN' : 'PX';
      
      // 2. Tạo Header phiếu Nhập Xuất (B_NHAPXUAT)
      // HOA_DON sẽ được gán số phiếu cụ thể ở tầng cha App, ở đây ta để tạm hoặc tạo chuỗi ngẫu nhiên độc bản để App thay thế
      const tempHoaDonId = `${headerPrefix}_TEMP_${Date.now()}`;

      const newHeader: NhapXuat = {
        HOA_DON: tempHoaDonId, // Sẽ được App.tsx định dạng lại thành số phiếu tăng dần chính xác
        CHI_NHANH: selectedBranch,
        NGAY: ngayLap,
        LOAI: loaiPhieu,
        TONG_SL: totalCartQty,
        NGUOI_TAO: currentUser.username,
        TEN_NGUOI_TAO: currentUser.fullName,
        TG_TAO: getVietnamDateTimeString(),
        GHI_CHU: ghiChuPhieu || `Lập phiếu ${loaiPhieu.toLowerCase()} kho tại ${selectedBranch}`,
        MA_NV: currentUser.id,
        TEN_DANG_NHAP: currentUser.username
      };

      // 3. Tạo Danh sách Chi tiết dòng (B_NHAPXUATCT)
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

      // Gọi callback truyền ra App.tsx để đồng bộ hóa và lưu trữ thời gian thực
      onSaveTransaction(newHeader, detailRows);

      // Reset giỏ hàng và form
      setCart([]);
      setGhiChuPhieu('');
      
      // Chuyển tab sang Lịch sử để xem lại chứng từ vừa lưu sau khi Toast hiển thị
      setTimeout(() => {
        onNavigateToHistory();
      }, 1500);

    }, 600);
  };

  const renderMobileOnboarding = () => {
    const steps = [
      { id: 1, title: 'Chứng từ', icon: FileText },
      { id: 2, title: 'Sản phẩm', icon: Layers },
      { id: 3, title: 'Phiếu chờ', icon: Clock },
      { id: 4, title: 'Xác nhận', icon: CheckCircle },
    ];

    const handleNextStep = () => {
      setErrorMsg('');
      if (currentStep === 1) {
        if (!selectedBranch) {
          setErrorMsg('Lỗi: Bạn bắt buộc phải tự chọn chi nhánh thực hiện giao dịch trước khi tiếp tục.');
          return;
        }
      }
      if (currentStep < 4) {
        setCurrentStep(prev => prev + 1);
      }
    };

    const handlePrevStep = () => {
      setErrorMsg('');
      if (currentStep > 1) {
        setCurrentStep(prev => prev - 1);
      }
    };

    return (
      <div className="space-y-4 px-1 pb-16">
        {/* THANH TIẾN TRÌNH PROGRESS STEPPER */}
        <div className="bg-[#0f172a]/5 p-3 rounded-2xl border border-slate-100 flex items-center justify-between gap-1 shadow-2xs">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-initial">
                <button
                  type="button"
                  onClick={() => {
                    if (s.id === 1 || selectedBranch) {
                      setCurrentStep(s.id);
                    } else {
                      setErrorMsg('Vui lòng chọn chi nhánh ở Bước 1 trước.');
                    }
                  }}
                  className="flex flex-col items-center gap-1 focus:outline-hidden cursor-pointer flex-1"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-105 shadow-sm' 
                      : isCompleted
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-white text-slate-400 border border-slate-200'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : s.id}
                  </div>
                  <span className={`text-[9px] font-bold ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </button>
                {idx < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1.5 max-w-[24px] transition-all ${currentStep > s.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* THÔNG BÁO LỖI */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500" />
            <span className="font-semibold leading-tight">{errorMsg}</span>
          </div>
        )}

        {/* NỘI DUNG TỪNG BƯỚC */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="bento-card !p-4 space-y-4"
          >
            {/* BƯỚC 1: THÔNG TIN CHỨNG TỪ */}
            {currentStep === 1 && (
              <div className="space-y-3.5">
                <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <FileText className="w-4.5 h-4.5 text-blue-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase">Bước 1: Thông tin chứng từ</span>
                </div>

                {/* Loại phiếu */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Loại phiếu</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setLoaiPhieu('NHẬP'); setCart([]); setErrorMsg(''); }}
                      className={`py-3 px-4 text-xs font-bold rounded-xl transition-all text-center cursor-pointer border ${
                        loaiPhieu === 'NHẬP' 
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Phiếu Nhập Kho
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLoaiPhieu('XUẤT'); setCart([]); setErrorMsg(''); }}
                      className={`py-3 px-4 text-xs font-bold rounded-xl transition-all text-center cursor-pointer border ${
                        loaiPhieu === 'XUẤT' 
                          ? 'bg-rose-500 text-white border-rose-500 shadow-xs' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Phiếu Xuất Kho
                    </button>
                  </div>
                </div>

                {/* Chi nhánh */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> Chi nhánh thực hiện <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      setSelectedBranch(e.target.value);
                      setErrorMsg('');
                    }}
                    className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  >
                    <option value="">-- Chọn chi nhánh --</option>
                    {chiNhanhs.map(branch => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>

                {/* Ngày lập */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Ngày lập phiếu
                  </label>
                  <input
                    type="date"
                    value={ngayLap}
                    onChange={(e) => setNgayLap(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                </div>

                {/* Ghi chú */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Ghi chú chung</label>
                  <textarea
                    rows={2}
                    placeholder="Nhập ghi chú chung của phiếu..."
                    value={ghiChuPhieu}
                    onChange={(e) => setGhiChuPhieu(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* BƯỚC 2: CHỌN CẤU HÌNH SẢN PHẨM */}
            {currentStep === 2 && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-4.5 h-4.5 text-blue-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase">Bước 2: Chọn sản phẩm</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => { setIsBarcodeMode(!isBarcodeMode); setErrorMsg(''); }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer border ${
                      isBarcodeMode ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}
                  >
                    <Barcode className="w-3.5 h-3.5" />
                    {isBarcodeMode ? 'Quét: BẬT' : 'Quét: TẮT'}
                  </button>
                </div>

                {isBarcodeMode ? (
                  <div className="bg-blue-50/20 p-3 rounded-xl border border-blue-100/50 space-y-2">
                    <p className="text-[10px] text-slate-500 font-medium">
                      Nhập mã hoặc quét barcode để tự động tra cứu nhanh sản phẩm.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ví dụ: BLICK 1.56..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleApplyBarcode(); }}
                        className="flex-1 bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold font-mono text-slate-700 uppercase tracking-wider focus:outline-hidden focus:border-blue-400"
                      />
                      <button
                        type="button"
                        onClick={handleApplyBarcode}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl"
                      >
                        Áp Dụng
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Hãng */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Thương hiệu / Hãng</label>
                      <select
                        value={selectBrand}
                        onChange={(e) => handleBrandChange(e.target.value)}
                        className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-hidden"
                      >
                        {thuongHieus.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Chiết suất */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Chiết suất</label>
                        <select
                          value={selectChietXuat}
                          onChange={(e) => setSelectChietXuat(e.target.value)}
                          className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-hidden font-mono"
                        >
                          {availableChietXuats.map(cx => (
                            <option key={cx} value={cx}>{cx}</option>
                          ))}
                        </select>
                      </div>

                      {/* Tính năng */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Tính năng</label>
                        <select
                          value={selectTinhNang}
                          onChange={(e) => setSelectTinhNang(e.target.value)}
                          className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:outline-hidden"
                        >
                          {availableFeatures.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Loại độ</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectDoSphType('CẬN')}
                          className={`py-2 text-xs font-bold rounded-xl text-center border cursor-pointer transition-all ${
                            selectDoSphType === 'CẬN' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-white text-slate-400 border-slate-200'
                          }`}
                        >
                          Cận (-)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectDoSphType('VIỄN')}
                          className={`py-2 text-xs font-bold rounded-xl text-center border cursor-pointer transition-all ${
                            selectDoSphType === 'VIỄN' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-white text-slate-400 border-slate-200'
                          }`}
                        >
                          Viễn (+)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* SPH */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Cầu (SPH)</label>
                        <select
                          value={selectDoSph}
                          onChange={(e) => setSelectDoSph(Number(e.target.value))}
                          className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-mono focus:outline-hidden"
                        >
                          {sphOptions.map(opt => (
                            <option key={opt} value={opt}>{formatDop(opt)}</option>
                          ))}
                        </select>
                      </div>

                      {/* CYL */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Loạn (CYL)</label>
                        <select
                          value={selectDoCyl}
                          onChange={(e) => setSelectDoCyl(Number(e.target.value))}
                          className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-mono focus:outline-hidden"
                        >
                          {cylOptions.map(opt => (
                            <option key={opt} value={opt}>{formatDop(opt)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* SỐ LƯỢNG & GHI CHÚ */}
                <div className="grid grid-cols-3 gap-2 pt-1.5">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Số lượng</label>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectSoLuong(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg font-bold border border-slate-200"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={selectSoLuong}
                        onChange={(e) => setSelectSoLuong(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 text-center text-sm font-extrabold text-slate-700 bg-transparent font-mono focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectSoLuong(prev => prev + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white text-slate-600 rounded-lg font-bold border border-slate-200"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="col-span-1 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">ĐVT</label>
                    <input
                      type="text"
                      value="miếng"
                      disabled
                      className="w-full text-sm font-bold text-slate-400 bg-slate-100 border border-slate-200 p-3 rounded-xl text-center"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú dòng sản phẩm</label>
                  <input
                    type="text"
                    placeholder="Nhập ghi chú dòng nếu cần..."
                    value={selectGhiChuDong}
                    onChange={(e) => setSelectGhiChuDong(e.target.value)}
                    className="w-full text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl"
                  />
                </div>

                {/* THÔNG TIN TỒN KHO THỰC TẾ TRONG HỆ THỐNG */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="font-bold">SKU:</span>
                    <span className="text-slate-800 font-extrabold">{calculatedSKU}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Tồn kho:</span>
                    {matchedProductInDB ? (
                      <div className="text-right">
                        <span className="font-extrabold text-blue-600">{matchedProductInDB.TON_CUOI} miếng</span>
                        {matchedProductInDB.TON_CUOI <= matchedProductInDB.TON_TOI_THIEU && (
                          <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wider animate-pulse mt-0.5">
                            ⚠️ Tồn kho thấp!
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="font-bold text-red-500">⚠️ Chưa khai báo SKU</span>
                    )}
                  </div>
                  {isWarningLowStock && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-250 text-amber-800 rounded-lg text-[10px] font-bold leading-tight">
                      ⚠️ Cảnh báo: Xuất {selectSoLuong} miếng sẽ khiến tồn kho còn lại ({estimatedPostStock} miếng) giảm xuống dưới ngưỡng tối thiểu ({matchedProductInDB?.TON_TOI_THIEU} miếng)!
                    </div>
                  )}
                </div>

                {/* NÚT THÊM VÀO GIỎ */}
                {canWrite && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <AnimatePresence>
                        {isAdded && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="text-emerald-600 text-xs font-bold flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4 text-emerald-500" /> ✓ Đã thêm vào phiếu chờ
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddToBasket();
                      }}
                      disabled={isAdded}
                      className={`w-full flex items-center justify-center gap-1.5 text-white font-bold py-3.5 px-4 rounded-xl cursor-pointer transition-all shadow-xs ${
                        isAdded ? 'bg-emerald-600' : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle className="w-5 h-5" /> Đã Thêm!
                        </>
                      ) : (
                        <>
                          <Plus className="w-5 h-5" /> Thêm Vào Phiếu Chờ
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BƯỚC 3: DANH SÁCH CHỜ (GIỎ HÀNG) */}
            {currentStep === 3 && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4.5 h-4.5 text-blue-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase">Bước 3: Phiếu chờ</span>
                  </div>
                  <span className="text-xs font-bold text-blue-600 font-mono">
                    {cart.length} dòng
                  </span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {cart.length > 0 ? (
                    cart.map((item, idx) => (
                      <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2.5 shadow-3xs">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-[9px] font-mono font-bold text-slate-400">{idx + 1}. {item.sku}</p>
                          <p className="text-xs font-bold text-slate-700 truncate">{item.tenSp}</p>
                          <p className="text-[10px] text-slate-400 italic">Ghi chú: {item.ghiChu}</p>
                          {cartItemStockErrors[item.id] && (
                            <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              {cartItemStockErrors[item.id]}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 scale-90">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateCartItemQty(item.id, item.soLuong - 1);
                              }}
                              className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-500"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.soLuong}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                handleUpdateCartItemQty(item.id, isNaN(val) ? 1 : val);
                              }}
                              className="w-10 text-center text-xs font-bold text-slate-700 bg-transparent font-mono focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateCartItemQty(item.id, item.soLuong + 1);
                              }}
                              className="w-5 h-5 flex items-center justify-center text-xs font-bold text-slate-500"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.id)}
                            className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400 leading-relaxed font-mono">
                      Phiếu chờ rỗng.<br />Vui lòng quay lại Bước 2 để thêm sản phẩm.
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/50 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">Tổng sản lượng:</span>
                    <span className="font-extrabold text-blue-600 text-sm font-mono">{totalCartQty} miếng</span>
                  </div>
                )}
              </div>
            )}

            {/* BƯỚC 4: XÁC NHẬN & HOÀN THÀNH */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
                  <CheckCircle className="w-4.5 h-4.5 text-blue-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase">Bước 4: Xác nhận phiếu</span>
                </div>

                <div className="space-y-3 bg-slate-50/60 p-4 rounded-xl border border-slate-100 text-xs">
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400 font-semibold">Loại phiếu:</span>
                    <span className={`font-bold ${loaiPhieu === 'NHẬP' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      PHIẾU {loaiPhieu} KHO
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400 font-semibold">Chi nhánh:</span>
                    <span className="font-bold text-slate-700">{selectedBranch}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400 font-semibold">Ngày chứng từ:</span>
                    <span className="font-bold text-slate-700 font-mono">{ngayLap}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400 font-semibold">Ghi chú chung:</span>
                    <span className="font-bold text-slate-700 max-w-[160px] truncate">{ghiChuPhieu || 'Không ghi chú'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                    <span className="text-slate-400 font-semibold">Số loại tròng kính:</span>
                    <span className="font-bold text-slate-700">{cart.length} dòng SKU</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-500 font-bold">Tổng sản lượng phiếu:</span>
                    <span className="font-extrabold text-blue-600 text-base font-mono">{totalCartQty} miếng</span>
                  </div>
                </div>

                {canWrite ? (
                  <button
                    type="button"
                    onClick={handleCompleteTransaction}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm py-4 px-4 rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-100"
                  >
                    <Save className="w-5 h-5" /> Hoàn Thành & Lưu Phiếu
                  </button>
                ) : (
                  <div className="p-3 bg-amber-50 text-amber-800 text-center rounded-xl text-[11px] font-semibold">
                    Quyền Chỉ Xem - Không thể lưu phiếu.
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* CÁC NÚT ĐIỀU HƯỚNG BOTTOM (NEXT / BACK) */}
        <div className="flex gap-3 pt-2">
          {currentStep > 1 && (
            <button
              type="button"
              onClick={handlePrevStep}
              className="flex-1 flex items-center justify-center gap-1 bg-white border border-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl transition-all cursor-pointer hover:bg-slate-50"
            >
              <ChevronLeft className="w-4.5 h-4.5" /> Quay lại
            </button>
          )}
          {currentStep < 4 && (
            <button
              type="button"
              onClick={handleNextStep}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-all cursor-pointer hover:bg-blue-700 shadow-sm shadow-blue-100"
            >
              Tiếp tục <ChevronRight className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDesktopLayout = () => {
    return (
      <>
      
      {/* KHU VỰC THÔNG TIN TIÊU ĐỀ PHIẾU */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl ${loaiPhieu === 'NHẬP' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {loaiPhieu === 'NHẬP' ? <FileDown className="w-5.5 h-5.5" /> : <FileUp className="w-5.5 h-5.5" />}
          </div>
          <div>
            <h2 className="font-sans font-bold text-slate-800 text-base">Lập Phiếu {loaiPhieu} Kho Tròng Kính</h2>
            <p className="text-xs text-slate-400 font-mono">Quy trình nhập xuất tuân thủ kiểm soát tồn kho chặt chẽ</p>
          </div>
        </div>

        {/* Nút chuyển đổi loại phiếu nhanh */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {hasPerm('picking_nhap.view') && (
            <button
              onClick={() => { setLoaiPhieu('NHẬP'); setCart([]); setErrorMsg(''); }}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                loaiPhieu === 'NHẬP' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Phiếu Nhập
            </button>
          )}
          {hasPerm('picking_xuat.view') && (
            <button
              onClick={() => { setLoaiPhieu('XUẤT'); setCart([]); setErrorMsg(''); }}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                loaiPhieu === 'XUẤT' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Phiếu Xuất
            </button>
          )}
        </div>
      </div>

      {((loaiPhieu === 'NHẬP' && !hasPerm('picking_nhap.create')) || (loaiPhieu === 'XUẤT' && !hasPerm('picking_xuat.create'))) && (
        <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs flex items-center gap-3 shadow-2xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          <span className="font-semibold">
            Tài khoản của bạn <strong>({currentUser.fullName} - {currentUser.role})</strong> không có quyền lập loại phiếu này. Mọi tác vụ Thêm vào phiếu chờ và Lưu phiếu giao dịch đã bị khóa.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-center gap-3 shadow-xs animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-center gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* HAI PHÂN VÙNG: BẢNG 1 & BẢNG 2 TRÊN GIAO DIỆN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BẢNG 1: THÔNG TIN CHỨNG TỪ (1/3 Cột) */}
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow-lg shadow-slate-150/80 border border-slate-200/80 hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thông Tin Chứng Từ</span>
          </div>

          <div className="space-y-4">
            {/* Nhóm 1: Địa điểm */}
            <div className="space-y-2 p-3 bg-slate-50/50 rounded-xl border border-slate-150/70">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">1. Địa điểm kho</span>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Chi nhánh áp dụng
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                >
                  <option value="">-- Chọn chi nhánh --</option>
                  {chiNhanhs.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nhóm 2: Thời gian & Nhân sự */}
            <div className="space-y-2.5 p-3 bg-slate-50/50 rounded-xl border border-slate-150/70">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">2. Thời gian & Nhân sự</span>
              
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Ngày lập phiếu
                </label>
                <input
                  type="date"
                  value={ngayLap}
                  onChange={(e) => setNgayLap(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Người lập
                </label>
                <div className="text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg p-2 font-mono truncate">
                  {currentUser.fullName}
                </div>
              </div>
            </div>

            {/* Nhóm 3: Ghi chú */}
            <div className="space-y-2 p-3 bg-slate-50/50 rounded-xl border border-slate-150/70">
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">3. Ghi chú chung</span>
              <div className="space-y-1">
                <textarea
                  rows={2}
                  placeholder="Nhập ghi chú chung..."
                  value={ghiChuPhieu}
                  onChange={(e) => setGhiChuPhieu(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-100 focus:outline-hidden resize-none"
                />
              </div>
            </div>
          </div>

          {/* Thống kê giỏ hàng */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Số loại tròng kính:</span>
              <span className="font-bold text-slate-700">{cart.length} dòng SKU</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">Tổng sản lượng phiếu:</span>
              <span className="font-extrabold text-blue-600 text-sm font-mono">{totalCartQty} {selectDvt}</span>
            </div>
          </div>

          {/* Nút lưu nhanh ngay tại Bảng 1 (Tận dụng không gian Desktop, tránh cuộn) */}
          {cart.length > 0 && canWrite && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleCompleteTransaction}
                className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-100"
              >
                <Save className="w-4 h-4" /> Lưu Phiếu Giao Dịch
              </button>
              <button
                type="button"
                onClick={() => { setCart([]); setErrorMsg(''); }}
                className="w-full text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer bg-white border border-slate-200 py-1.5 rounded-lg text-center"
              >
                Xóa giỏ hàng chờ
              </button>
            </div>
          )}
        </div>

        {/* BẢNG 2: CHỌN SẢN PHẨM & QUY TẮC SKU (2/3 Cột) */}
        <div className="bg-white rounded-2xl p-5 space-y-4 lg:col-span-2 shadow-lg shadow-slate-150/80 border border-slate-200/80 hover:shadow-xl transition-shadow duration-300">
          
          <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700 uppercase">Cấu Hình Sản Phẩm Tròng Kính</span>
            </div>
            
            {/* Chuyển đổi quét barcode hoặc chọn thủ công */}
            <button
              type="button"
              onClick={() => { setIsBarcodeMode(!isBarcodeMode); setErrorMsg(''); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                isBarcodeMode ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
              }`}
            >
              <Barcode className="w-3.5 h-3.5" />
              {isBarcodeMode ? 'Chế Độ Quét: BẬT' : 'Chế Độ Quét: TẮT'}
            </button>
          </div>

          {/* CHẾ ĐỘ 1: QUÉT BARCODE HOẶC GÕ SKU NHANH */}
          {isBarcodeMode ? (
            <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100/50 space-y-3">
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Nhập hoặc dán mã SKU tròng kính (Ví dụ: `BLICK 1.56 ĐM -2.00 -0.50`) hoặc kết nối đầu đọc quét mã vạch để chọn nhanh sản phẩm trong tích tắc.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Quét mã vạch hoặc nhập SKU..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleApplyBarcode(); }}
                  className="flex-1 bg-white border border-slate-200 rounded-lg py-2 px-3 text-xs font-bold font-mono text-slate-700 uppercase tracking-wider"
                />
                <button
                  type="button"
                  onClick={handleApplyBarcode}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all"
                >
                  Áp Dụng
                </button>
              </div>
            </div>
          ) : (
            /* CHẾ ĐỘ 2: LỰA CHỌN THUỘC TÍNH SẢN PHẨM (TRẢI NGHIỆM KHÁCH HÀNG THÂN THIỆN) */
            <div className="space-y-2 sm:space-y-4">
              <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                {/* Thương hiệu */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Hãng</label>
                  <div className="col-span-2">
                    <select
                      value={selectBrand}
                      onChange={(e) => handleBrandChange(e.target.value)}
                      className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg focus:outline-hidden"
                    >
                      {thuongHieus.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Chiết suất (Luôn cho phép lựa chọn linh hoạt theo yêu cầu người dùng) */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Chiết suất</label>
                  <div className="col-span-2">
                    <select
                      value={selectChietXuat}
                      onChange={(e) => setSelectChietXuat(e.target.value)}
                      className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg focus:outline-hidden"
                    >
                      <option value="1.56">1.56</option>
                      <option value="1.60">1.60</option>
                      <option value="1.61">1.61</option>
                      <option value="1.67">1.67</option>
                      <option value="1.74">1.74</option>
                    </select>
                  </div>
                </div>

                {/* Tính năng (Chỉ có các lựa chọn theo thương hiệu) */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Tính năng</label>
                  <div className="col-span-2">
                    <select
                      value={selectTinhNang}
                      onChange={(e) => setSelectTinhNang(e.target.value)}
                      className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg focus:outline-hidden"
                    >
                      {availableFeatures.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4 mt-2 sm:mt-4">
                {/* Phân loại độ */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Loại độ</label>
                  <div className="col-span-2 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectDoSphType('CẬN')}
                      className={`py-1 px-1.5 text-xs font-bold rounded-lg cursor-pointer text-center transition-all ${
                        selectDoSphType === 'CẬN' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                      }`}
                    >
                      Cận (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectDoSphType('VIỄN')}
                      className={`py-1 px-1.5 text-xs font-bold rounded-lg cursor-pointer text-center transition-all ${
                        selectDoSphType === 'VIỄN' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                      }`}
                    >
                      Viễn (+)
                    </button>
                  </div>
                </div>

                {/* Độ SPH */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Cầu (SPH)</label>
                  <div className="col-span-2">
                    <select
                      value={selectDoSph}
                      onChange={(e) => setSelectDoSph(Number(e.target.value))}
                      className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg font-mono"
                    >
                      {sphOptions.map(opt => (
                        <option key={opt} value={opt}>{formatDop(opt)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Độ CYL (loạn) */}
                <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
                  <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Loạn (CYL)</label>
                  <div className="col-span-2">
                    <select
                      value={selectDoCyl}
                      onChange={(e) => setSelectDoCyl(Number(e.target.value))}
                      className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg font-mono"
                    >
                      {cylOptions.map(opt => (
                        <option key={opt} value={opt}>{formatDop(opt)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DÒNG SỐ LƯỢNG, ĐVT & GHI CHÚ SẢN PHẨM */}
          <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
            <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
              <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">S.lượng</label>
              <div className="col-span-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectSoLuong(prev => Math.max(1, prev - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 active:bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 font-bold text-sm cursor-pointer shrink-0 transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  value={selectSoLuong}
                  onChange={(e) => setSelectSoLuong(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center text-base md:text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSelectSoLuong(prev => prev + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 active:bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-200 font-bold text-sm cursor-pointer shrink-0 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
              <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">ĐVT</label>
              <div className="col-span-2">
                <input
                  type="text"
                  value="miếng"
                  disabled
                  className="w-full text-base md:text-xs font-bold text-slate-500 bg-slate-100 border border-slate-100 p-1.5 sm:p-2 rounded-lg"
                />
              </div>
            </div>
            <div className="flex flex-col sm:space-y-1 sm:block grid grid-cols-3 items-center gap-2 py-0.5 sm:py-0">
              <label className="col-span-1 text-[10px] font-bold text-slate-400 uppercase">Ghi chú dòng</label>
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Trả hàng, gấp..."
                  value={selectGhiChuDong}
                  onChange={(e) => setSelectGhiChuDong(e.target.value)}
                  className="w-full text-base md:text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-100 p-1.5 sm:p-2 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* TRẠNG THÁI SKU PHÁT HIỆN TỒN KHO THỰC TẾ TRONG HỆ THỐNG */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">SKU xác định:</span>
              <p className="text-xs font-bold font-mono text-slate-800 tracking-tight">{formatSKUForDisplay(calculatedSKU)}</p>
              <p className="text-[11px] text-slate-400 truncate max-w-sm font-medium">{calculatedProductName}</p>
            </div>
            
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400">Trạng thái tồn kho:</span>
              {matchedProductInDB ? (
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-700 flex items-center sm:justify-end gap-1 font-mono">
                    Sẵn có: <span className="text-blue-600 text-sm">{matchedProductInDB.TON_CUOI}</span> {matchedProductInDB.DVT}
                  </p>
                  {matchedProductInDB.TON_CUOI <= matchedProductInDB.TON_TOI_THIEU && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 py-0.5 px-2 rounded-full uppercase tracking-wider animate-pulse">
                      ⚠️ Tồn kho thấp (Tối thiểu: {matchedProductInDB.TON_TOI_THIEU})
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs font-extrabold text-red-600 flex items-center sm:justify-end gap-1">
                  ⚠️ Chưa tồn tại trong kho
                </p>
              )}
            </div>
          </div>

          {isWarningLowStock && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold leading-relaxed shadow-3xs flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 animate-pulse" />
              <span>
                Cảnh báo tồn kho thấp: Xuất <strong>{selectSoLuong} miếng</strong> sẽ đẩy tồn kho còn lại của SKU này ({estimatedPostStock} miếng) xuống dưới ngưỡng tối thiểu ({matchedProductInDB?.TON_TOI_THIEU} miếng)!
              </span>
            </div>
          )}

          {/* NÚT THÊM VÀO GIỎ CHỜ XÁC NHẬN */}
          {canWrite && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <AnimatePresence>
                {isAdded && (
                  <motion.span
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="text-emerald-600 text-xs font-bold flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-500 animate-bounce" /> ✓ Đã thêm vào phiếu chờ
                  </motion.span>
                )}
              </AnimatePresence>
              <button
                type="button"
                onClick={handleAddToBasket}
                disabled={isAdded}
                className={`flex items-center gap-1.5 text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all shadow-xs ${
                  isAdded ? 'bg-emerald-600' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isAdded ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Đã Thêm!
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Thêm Vào Phiếu Chờ
                  </>
                )}
              </button>
            </div>
          )}

        </div>

      </div>

      {/* BẢNG 3: DANH SÁCH CHỜ XÁC NHẬN (DANH SÁCH CHI TIẾT) */}
      <div className="bento-card !p-0 overflow-hidden">
        
        <div className="bg-slate-50/75 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" /> Danh Sách Hàng Chờ Xác Nhận ({cart.length} sản phẩm)
          </span>
          <span className="text-xs font-mono font-bold text-blue-600">
            Tổng sản lượng: {totalCartQty} {selectDvt}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/25 border-b border-slate-100">
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">STT</th>
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mã SKU</th>
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mô Tả Tròng Kính</th>
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Số Lượng</th>
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi Chú Dòng</th>
                <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {cart.length > 0 ? (
                cart.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 py-0.5 px-2 rounded">
                        {formatSKUForDisplay(item.sku)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-800">{item.tenSp}</div>
                        {cartItemStockErrors[item.id] && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {cartItemStockErrors[item.id]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartItemQty(item.id, item.soLuong - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.soLuong}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            handleUpdateCartItemQty(item.id, isNaN(val) ? 1 : val);
                          }}
                          className="w-12 text-center text-xs font-bold text-slate-700 bg-transparent font-mono focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCartItemQty(item.id, item.soLuong + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 font-bold text-xs cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-medium italic">{item.ghiChu}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveCartItem(item.id)}
                        className="text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-400 font-mono leading-relaxed">
                    Phiếu rỗng. Hãy chọn tròng kính mắt và cấu hình thông số ở bảng trên,<br />sau đó nhấn nút "Thêm Vào Phiếu Chờ".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Nút lưu chứng từ giao dịch */}
        {cart.length > 0 && canWrite && (
          <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setCart([]); setErrorMsg(''); }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer bg-white border border-slate-200 rounded-xl"
            >
              Xóa Toàn Bộ
            </button>
            <button
              type="button"
              onClick={handleCompleteTransaction}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-6 rounded-xl cursor-pointer transition-all shadow-xs"
            >
              <Save className="w-4.5 h-4.5" /> Hoàn Thành & Lưu Chứng Từ
            </button>
          </div>
        )}

      </div>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {isMobile ? renderMobileOnboarding() : renderDesktopLayout()}
    </div>
  );
}
