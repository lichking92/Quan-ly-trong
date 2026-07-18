/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Boxes, 
  AlertTriangle, 
  Calendar, 
  MapPin, 
  Download, 
  FileSpreadsheet, 
  FileText,
  Filter,
  RefreshCw,
  Clock,
  PieChart as PieIcon,
  Tag,
  ListPlus,
  BarChart2,
  Compass,
  SlidersHorizontal,
  X,
  Activity,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  Database,
  Plus,
  Trash2,
  ShieldCheck,
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  ReferenceArea
} from 'recharts';
import { SanPham, NhapXuat, NhapXuatCT } from '../types';
import { normalizeChietXuat, compareChietXuat } from '../utils/chietXuatHelper';
import TemplateExportManager from './TemplateExportManager';
import { monitor } from '../utils/debugMonitor';
import { 
  calculateResolvedValues, 
  exportReportByTemplate, 
  Template, 
  PlaceholderMapping, 
  DEFAULT_MAPPINGS,
  ColumnMapping,
  exportRawData,
  exportReportWithFilters
} from '../utils/exportEngine';
import { fetchExportTemplates, fetchExportMappings, syncExportTemplate } from '../supabaseSync';

/**
 * FILE: Dashboard.tsx
 * TÁC GIẢ: Lão làng Lập trình Hệ thống (30+ năm kinh nghiệm)
 * MÔ TẢ: Module phân tích dữ liệu kho tròng kính thời gian thực.
 *        Cung cấp các biểu đồ động trực quan hóa hoạt động nhập xuất,
 *        phát hiện hàng tồn kho chạm ngưỡng cảnh báo, bộ lọc đa chiều và chọn nhanh thời gian tiện ích.
 */

interface DashboardProps {
  sanPhams: SanPham[];
  nhapXuats: NhapXuat[];
  nhapXuatCTs: NhapXuatCT[];
  chiNhanhs: string[];
  onQuickRestock?: (sku: string) => void;
  onTriggerToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
  currentUser?: any;
  onDrillDown?: (filters: {
    historyTypeFilter: 'Tất cả' | 'NHẬP' | 'XUẤT' | 'KIỂM KHO' | 'NHẬP_KIEM_KHO' | 'XUAT_KIEM_KHO';
    branchFilter: string;
    fromDate: string;
    toDate: string;
  }) => void;
}

// --- HEATMAP HELPER FUNCTIONS ---
export function getHeatmapLevel(val: number, maxVal: number): number {
  if (val <= 0) return 0;
  if (maxVal <= 0) return 1;
  const level = Math.ceil((val / maxVal) * 7);
  return Math.min(Math.max(level, 1), 7);
}

export function getLevelStyle(level: number, txType: 'XUẤT' | 'NHẬP') {
  const isXuat = txType === 'XUẤT';
  if (isXuat) {
    switch (level) {
      case 1: return { bg: '#fef2f2', text: '#ef4444', border: '#fee2e2', name: 'Rất thấp' };
      case 2: return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5', name: 'Thấp' };
      case 3: return { bg: '#fca5a5', text: '#991b1b', border: '#f87171', name: 'Trung bình thấp' };
      case 4: return { bg: '#f87171', text: '#ffffff', border: '#ef4444', name: 'Trung bình' };
      case 5: return { bg: '#ef4444', text: '#ffffff', border: '#dc2626', name: 'Trung bình cao' };
      case 6: return { bg: '#dc2626', text: '#ffffff', border: '#b91c1c', name: 'Cao' };
      case 7: return { bg: '#991b1b', text: '#ffffff', border: '#7f1d1d', name: 'Rất cao' };
      default: return { bg: '#ffffff', text: '#cbd5e1', border: '#e2e8f0', name: 'N/A' };
    }
  } else {
    // NHẬP: Emerald/Green
    switch (level) {
      case 1: return { bg: '#f0fdf4', text: '#22c55e', border: '#dcfce7', name: 'Rất thấp' };
      case 2: return { bg: '#dcfce7', text: '#16a34a', border: '#86efac', name: 'Thấp' };
      case 3: return { bg: '#86efac', text: '#166534', border: '#4ade80', name: 'Trung bình thấp' };
      case 4: return { bg: '#4ade80', text: '#ffffff', border: '#22c55e', name: 'Trung bình' };
      case 5: return { bg: '#22c55e', text: '#ffffff', border: '#16a34a', name: 'Trung bình cao' };
      case 6: return { bg: '#16a34a', text: '#ffffff', border: '#15803d', name: 'Cao' };
      case 7: return { bg: '#166534', text: '#ffffff', border: '#14532d', name: 'Rất cao' };
      default: return { bg: '#ffffff', text: '#cbd5e1', border: '#e2e8f0', name: 'N/A' };
    }
  }
}

export function getLevelRanges(maxVal: number) {
  if (maxVal <= 0) return [];
  const ranges = [];
  if (maxVal < 7) {
    for (let i = 1; i <= maxVal; i++) {
      ranges.push({
        level: Math.min(7, Math.max(1, Math.ceil((i / maxVal) * 7))),
        lower: i,
        upper: i,
        label: `${i}`
      });
    }
    return ranges;
  }
  for (let i = 1; i <= 7; i++) {
    const lower = Math.floor(((i - 1) * maxVal) / 7) + 1;
    const upper = i === 7 ? maxVal : Math.floor((i * maxVal) / 7);
    if (lower <= upper) {
      ranges.push({
        level: i,
        lower,
        upper,
        label: lower === upper ? `${lower}` : `${lower} - ${upper}`
      });
    }
  }
  return ranges;
}

// --- AN TOÀN CHO BIỂU ĐỒ RECHARTS (TRÁNH WARNING WIDTH/HEIGHT = 0 VÀ RENDER ẨN) ---
interface SafeResponsiveContainerProps {
  children: React.ReactElement;
  height: number | string;
  minHeight?: number;
}

function SafeResponsiveContainer({ children, height, minHeight }: SafeResponsiveContainerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = React.useState<boolean>(false);

  React.useEffect(() => {
    let active = true;
    const checkSize = () => {
      if (!active) return;
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        // Chỉ render khi container thực sự hiển thị và có chiều rộng > 0
        if (clientWidth > 0) {
          setShouldRender(true);
        } else {
          setShouldRender(false);
        }
      }
    };

    // Chạy kiểm tra kích thước lần đầu tiên
    checkSize();

    // Sử dụng ResizeObserver để lắng nghe thay đổi kích thước và ẩn hiện
    let observer: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window && containerRef.current) {
      observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          checkSize();
        });
      });
      observer.observe(containerRef.current);
    }

    return () => {
      active = false;
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full relative" 
      style={{ height: height, minHeight: minHeight }}
    >
      {shouldRender ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full flex items-center justify-center text-xs text-slate-400 font-mono italic bg-slate-50/20 rounded-xl" style={{ minHeight: minHeight }}>
          Đang tải đồ thị...
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ 
  sanPhams, 
  nhapXuats, 
  nhapXuatCTs, 
  chiNhanhs, 
  onQuickRestock,
  onTriggerToast,
  currentUser,
  onDrillDown
}: DashboardProps) {
  monitor.trackRender('Dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<'ANALYTICS' | 'TEMPLATES'>('ANALYTICS');
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  React.useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);
  
  // --- 1. QUẢN LÝ TRẠNG THÁI BỘ LỌC ---
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_BRANCH') || 'Tất cả';
  });
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_BRAND') || 'Tất cả';
  });
  const [selectedFeatureFilter, setSelectedFeatureFilter] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_FEATURE') || 'Tất cả';
  });
  const [selectedChietXuatFilter, setSelectedChietXuatFilter] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_CHIET_XUAT') || 'Tất cả';
  });
  const [chartType, setChartType] = useState<'line' | 'stacked'>('line');
  
  // Dữ liệu mẫu năm 2026, nên mặc định đặt khoảng thời gian từ 2026-07-01 đến 2026-07-31
  const [startDate, setStartDate] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_START_DATE') || '2026-07-01';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_END_DATE') || '2026-07-31';
  });
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>(() => {
    return localStorage.getItem('DASHBOARD_FILTER_QUICK') || '30d';
  });

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_BRANCH', selectedBranch);
  }, [selectedBranch]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_BRAND', selectedBrandFilter);
  }, [selectedBrandFilter]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_FEATURE', selectedFeatureFilter);
  }, [selectedFeatureFilter]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_CHIET_XUAT', selectedChietXuatFilter);
  }, [selectedChietXuatFilter]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_START_DATE', startDate);
  }, [startDate]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_END_DATE', endDate);
  }, [endDate]);

  React.useEffect(() => {
    localStorage.setItem('DASHBOARD_FILTER_QUICK', activeQuickFilter);
  }, [activeQuickFilter]);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  // --- QUẢN LÝ DANH SÁCH MẪU XUẤT CHO DASHBOARD ---
  const [exportTemplates, setExportTemplates] = useState<Template[]>([]);
  const [exportMappings, setExportMappings] = useState<PlaceholderMapping[]>([]);

  // Trạng thái của Modal cấu hình xuất nâng cao
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportModalType, setExportModalType] = useState<'EXCEL' | 'PDF'>('EXCEL');
  const [exportMode, setExportMode] = useState<'RAW' | 'TEMPLATE'>('TEMPLATE');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [exportStartRow, setExportStartRow] = useState<number>(10);
  const [exportGroupByFields, setExportGroupByFields] = useState<string[]>([]);
  const [currentMappings, setCurrentMappings] = useState<ColumnMapping[]>([]);

  // Trạng thái Form thêm cột mới trong Modal nâng cao
  const [showAddColForm, setShowAddColForm] = useState<boolean>(false);
  const [newColLabel, setNewColLabel] = useState<string>('');
  const [newColField, setNewColField] = useState<string>('');
  const [newColExcel, setNewColExcel] = useState<string>('');
  const [newColIsPivot, setNewColIsPivot] = useState<boolean>(false);
  const [newColAgg, setNewColAgg] = useState<'SUM_SO_LUONG' | 'SUM_NHAP' | 'SUM_XUAT' | 'SUM_TON' | 'COUNT_SKU' | 'COUNT_CHUNG_TU' | 'SUM_GIA_TRI_NHAP' | 'SUM_GIA_TRI_XUAT'>('SUM_SO_LUONG');

  const handleMoveColumnUp = (index: number) => {
    if (index === 0) return;
    setCurrentMappings(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveColumnDown = (index: number) => {
    if (index === currentMappings.length - 1) return;
    setCurrentMappings(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleRemoveColumnByIndex = (index: number) => {
    setCurrentMappings(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNewColumnCustom = () => {
    if (!newColLabel.trim()) {
      alert('Vui lòng nhập tên cột hiển thị');
      return;
    }
    const excelCol = newColExcel.trim().toUpperCase() || `COL_${currentMappings.length + 1}`;
    
    const newMapping: ColumnMapping = {
      excelColumn: excelCol,
      dataField: newColField || 'SO_LUONG',
      label: newColLabel.trim(),
      isPivot: newColIsPivot,
      pivotSource: 'PHIEU',
      pivotGroupBy: [],
      pivotAggregation: newColIsPivot ? newColAgg : undefined,
      pivotFilters: []
    };

    setCurrentMappings(prev => [...prev, newMapping]);
    setNewColLabel('');
    setNewColField('');
    setNewColExcel('');
    setNewColIsPivot(false);
    setNewColAgg('SUM_SO_LUONG');
    setShowAddColForm(false);
  };

  const handleAddGroupByField = (fieldKey: string) => {
    if (!fieldKey) return;
    if (!exportGroupByFields.includes(fieldKey)) {
      setExportGroupByFields(prev => [...prev, fieldKey]);
    }
  };

  const handleRemoveGroupByField = (fieldKey: string) => {
    setExportGroupByFields(prev => prev.filter(f => f !== fieldKey));
  };

  const handleMoveGroupByFieldUp = (index: number) => {
    if (index === 0) return;
    setExportGroupByFields(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveGroupByFieldDown = (index: number) => {
    if (index === exportGroupByFields.length - 1) return;
    setExportGroupByFields(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  React.useEffect(() => {
    const loadTemplates = async () => {
      try {
        const dbTemplates = await fetchExportTemplates();
        const dbMappings = await fetchExportMappings();
        if (dbTemplates && dbTemplates.length > 0) {
          const cleaned = dbTemplates.map((t: any) => {
            let fields = t.groupByFields || [];
            if (t.id === 'default-phieu-xuat-excel' && (fields.includes('SKU') || fields.includes('TEN_SP'))) {
              fields = [];
            }
            if (t.id === 'default-dashboard-excel') {
              fields = [];
            }
            return {
              ...t,
              groupByFields: fields
            };
          });
          setExportTemplates(cleaned);
        } else {
          // Khôi phục từ localStorage làm dự phòng
          const savedTemplates = localStorage.getItem('export_templates');
          if (savedTemplates) {
            const parsed = JSON.parse(savedTemplates).map((t: any) => {
              let fields = t.groupByFields || [];
              if (t.id === 'default-phieu-xuat-excel' && (fields.includes('SKU') || fields.includes('TEN_SP'))) {
                fields = [];
              }
              if (t.id === 'default-dashboard-excel') {
                fields = [];
              }
              return {
                ...t,
                groupByFields: fields
              };
            });
            setExportTemplates(parsed);
          }
        }
        if (dbMappings && dbMappings.length > 0) {
          setExportMappings(dbMappings);
        } else {
          const savedMappings = localStorage.getItem('export_mappings');
          if (savedMappings) {
            setExportMappings(JSON.parse(savedMappings));
          } else {
            setExportMappings(DEFAULT_MAPPINGS);
          }
        }
      } catch (err) {
        console.error('Lỗi tải cấu hình mẫu xuất ở Dashboard:', err);
      }
    };
    loadTemplates();
  }, [dashboardSubTab]);

  // --- TRẠNG THÁI CHO BIỂU ĐỒ PHÂN TÍCH ĐỘ & TỔ HỢP ĐỘ ---
  const [diopterTxType, setDiopterTxType] = useState<'XUẤT' | 'NHẬP'>('XUẤT');
  const [diopterMode, setDiopterMode] = useState<'SPH' | 'CYL' | 'ADD' | 'COMBINED'>('COMBINED');
  const [diopterChartStyle, setDiopterChartStyle] = useState<'bar' | 'pie'>('bar');
  const [showRangeEditor, setShowRangeEditor] = useState<boolean>(false);

  // --- TRẠNG THÁI CHO DASHBOARD PHÂN TÍCH ĐỘ KHO TRÒNG CHUYÊN SÂU ---
  const [salesDbTxType, setSalesDbTxType] = useState<'XUẤT' | 'NHẬP'>('XUẤT');
  const [salesDbBarMode, setSalesDbBarMode] = useState<'SPH_TO_CYL' | 'CYL_TO_SPH'>('SPH_TO_CYL');
  const [salesDbSelectedSph, setSalesDbSelectedSph] = useState<number | 'ALL'>('ALL');
  const [salesDbSelectedCyl, setSalesDbSelectedCyl] = useState<number | 'ALL'>('ALL');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ sph: number; cyl: number } | null>(null);
  const [salesDbTopType, setSalesDbTopType] = useState<'XUẤT' | 'NHẬP'>('XUẤT');
  const [salesDbTopLimit, setSalesDbTopLimit] = useState<number>(10);

  // --- TRẠNG THÁI ẨN / HIỆN BIỂU ĐỒ (MEMORIZED) ---
  const [collapsedCharts, setCollapsedCharts] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_collapsed_charts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const toggleChartCollapse = (chartId: string) => {
    setCollapsedCharts(prev => {
      const next = { ...prev, [chartId]: !prev[chartId] };
      localStorage.setItem('dashboard_collapsed_charts', JSON.stringify(next));
      return next;
    });
  };

  // --- TRẠNG THÁI PHÓNG TO TOÀN MÀN HÌNH ---
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  // --- TRẠNG THÁI THU PHÓNG (ZOOM STATES FOR EACH CHART) ---
  // Chart 1: dailyTx
  const [dailyTxZoom, setDailyTxZoom] = useState<{ start: number; end: number } | null>(null);
  const [dailyTxRefArea, setDailyTxRefArea] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });

  // Chart 2: brandStock (Pie: Zoom level maps to scale, limit is sliced segment count)
  const [brandStockZoom, setBrandStockZoom] = useState<number>(1); // Scale multiplier (1 = normal, 1.3 = zoom in, 0.7 = zoom out)
  const [brandStockLimit, setBrandStockLimit] = useState<number>(10); // Number of sliced brands to show

  // Chart 3: topXuat
  const [topXuatZoom, setTopXuatZoom] = useState<{ start: number; end: number } | null>(null);
  const [topXuatRefArea, setTopXuatRefArea] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });

  // Chart 4: branchExport
  const [branchExportZoom, setBranchExportZoom] = useState<{ start: number; end: number } | null>(null);
  const [branchExportRefArea, setBranchExportRefArea] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });

  // Chart 5: diopterBar (salesBarChartData)
  const [salesDbBarZoom, setSalesDbBarZoom] = useState<{ start: number; end: number } | null>(null);
  const [salesDbBarRefArea, setSalesDbBarRefArea] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });

  // Bộ lọc phạm vi độ cho Heatmap SPH x CYL
  const [sphFilterFrom, setSphFilterFrom] = useState<number>(0.00);
  const [sphFilterTo, setSphFilterTo] = useState<number>(-5.00);
  const [cylFilterFrom, setCylFilterFrom] = useState<number>(0.00);
  const [cylFilterTo, setCylFilterTo] = useState<number>(-2.00);

  const [sphRanges, setSphRanges] = useState([
    { id: '1', min: 0.00, max: -1.00, label: '0 đến -1.00' },
    { id: '2', min: -1.25, max: -3.00, label: '-1.25 đến -3.00' },
    { id: '3', min: -3.25, max: -6.00, label: '-3.25 đến -6.00' },
    { id: '4', min: -6.25, max: -20.00, label: 'Dưới -6.00' }
  ]);

  const [cylRanges, setCylRanges] = useState([
    { id: '1', min: 0.00, max: -0.75, label: '0 đến -0.75' },
    { id: '2', min: -1.00, max: -2.00, label: '-1.00 đến -2.00' },
    { id: '3', min: -2.25, max: -10.00, label: 'Trên -2.00' }
  ]);

  // Bảng màu sắc cao cấp, độ tương phản cao, hiện đại cho Biểu đồ Pie/Bar
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];

  // Xác định ngày cuối cùng trong bộ dữ liệu để làm mốc thời gian động (tránh trắng bảng)
  const maxDataDateStr = useMemo(() => {
    if (nhapXuats.length === 0) return '2026-07-12';
    const dates = nhapXuats.map(h => h.NGAY).filter(Boolean);
    if (dates.length === 0) return '2026-07-12';
    dates.sort();
    return dates[dates.length - 1];
  }, [nhapXuats]);

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // --- 2. BỘ LỌC NHANH THỜI GIAN (QUICK FILTERS) ---
  const handleQuickFilter = (type: 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | '7d' | '30d' | '90d' | '6m' | '1y') => {
    setActiveQuickFilter(type);
    const today = new Date();
    
    if (type === 'today') {
      setStartDate(formatDate(today));
      setEndDate(formatDate(today));
    } else if (type === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setStartDate(formatDate(yesterday));
      setEndDate(formatDate(yesterday));
    } else if (type === 'this_week') {
      const currentDay = today.getDay();
      const distance = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distance);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(sunday));
    } else if (type === 'last_week') {
      const currentDay = today.getDay();
      const distance = (currentDay === 0 ? -6 : 1 - currentDay) - 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() + distance);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(sunday));
    } else if (type === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    } else if (type === 'last_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(lastDay));
    } else {
      const refDate = new Date(maxDataDateStr);
      setEndDate(formatDate(refDate));
      const startDateObj = new Date(refDate);
      if (type === '7d') {
        startDateObj.setDate(startDateObj.getDate() - 7);
      } else if (type === '30d') {
        startDateObj.setDate(startDateObj.getDate() - 30);
      } else if (type === '90d') {
        startDateObj.setDate(startDateObj.getDate() - 90);
      } else if (type === '6m') {
        startDateObj.setMonth(startDateObj.getMonth() - 6);
      } else if (type === '1y') {
        startDateObj.setFullYear(startDateObj.getFullYear() - 1);
      }
      setStartDate(formatDate(startDateObj));
    }
  };

  const handleResetFilters = () => {
    setSelectedBranch('Tất cả');
    setSelectedBrandFilter('Tất cả');
    setSelectedFeatureFilter('Tất cả');
    setSelectedChietXuatFilter('Tất cả');
    setStartDate('2026-07-01');
    setEndDate('2026-07-31');
    setActiveQuickFilter('30d');
  };

  // --- 3. LỌC DỮ LIỆU THEO ĐIỀU KIỆN ---
  // Lọc phiếu theo Chi nhánh và Khoảng thời gian
  const filteredHeadersBase = useMemo(() => {
    return nhapXuats.filter(h => {
      if (h.TRANG_THAI === 'Đã hủy') return false;
      const matchBranch = selectedBranch === 'Tất cả' || h.CHI_NHANH === selectedBranch;
      const matchDate = h.NGAY >= startDate && h.NGAY <= endDate;
      return matchBranch && matchDate;
    });
  }, [nhapXuats, selectedBranch, startDate, endDate]);

  // Lọc chi tiết phiếu khớp với Header cơ sở VÀ khớp bộ lọc Brand, Tính năng, Chiết suất
  const filteredDetails = useMemo(() => {
    const headerIds = new Set(filteredHeadersBase.map(h => h.HOA_DON));
    return nhapXuatCTs.filter(d => {
      if (!headerIds.has(d.HOA_DON)) return false;
      
      const matchBrand = selectedBrandFilter === 'Tất cả' || d.THUONG_HIEU === selectedBrandFilter;
      const matchFeature = selectedFeatureFilter === 'Tất cả' || d.TINH_NANG === selectedFeatureFilter;
      const matchChietXuat = selectedChietXuatFilter === 'Tất cả' || compareChietXuat(d.CHIET_XUAT, selectedChietXuatFilter);
      
      return matchBrand && matchFeature && matchChietXuat;
    });
  }, [nhapXuatCTs, filteredHeadersBase, selectedBrandFilter, selectedFeatureFilter, selectedChietXuatFilter]);

  // Lọc lại Headers tương ứng với các dòng chi tiết thực tế
  const filteredHeaders = useMemo(() => {
    const activeHeaderIds = new Set(filteredDetails.map(d => d.HOA_DON));
    return filteredHeadersBase.filter(h => activeHeaderIds.has(h.HOA_DON));
  }, [filteredHeadersBase, filteredDetails]);

  // --- 4. TẤT CẢ DANH SÁCH DROPDOWN CHO BỘ LỌC ĐA CHIỀU ---
  const brandOptions = useMemo(() => {
    const set = new Set(sanPhams.map(p => p.THUONG_HIEU));
    return Array.from(set).sort();
  }, [sanPhams]);

  const chietXuatOptions = useMemo(() => {
    const filtered = sanPhams.filter(p => {
      const matchBrand = selectedBrandFilter === 'Tất cả' || p.THUONG_HIEU === selectedBrandFilter;
      const matchFeature = selectedFeatureFilter === 'Tất cả' || p.TINH_NANG === selectedFeatureFilter;
      return matchBrand && matchFeature;
    });
    const set = new Set(filtered.map(p => p.CHIET_XUAT).filter(Boolean));
    return Array.from(set).sort();
  }, [sanPhams, selectedBrandFilter, selectedFeatureFilter]);

  // --- 4. TÍNH TOÁN CÁC KPI CHỦ CHỐT (TẬP TRUNG HIỆU NĂNG) ---
  const kpis = useMemo(() => {
    const totalProducts = sanPhams.length;

    let numPhieuNhap = 0;
    let numPhieuXuat = 0;
    let numPhieuNhapKK = 0;
    let numPhieuXuatKK = 0;

    filteredHeaders.forEach(h => {
      if (h.LOAI === 'NHẬP') {
        if (h.HOA_DON.startsWith('PNK')) {
          numPhieuNhapKK++;
        } else {
          numPhieuNhap++;
        }
      }
      if (h.LOAI === 'XUẤT') {
        if (h.HOA_DON.startsWith('PXK')) {
          numPhieuXuatKK++;
        } else {
          numPhieuXuat++;
        }
      }
    });

    let totalNhap = 0;
    let totalXuat = 0;

    filteredDetails.forEach(d => {
      if (d.LOAI === 'NHẬP') totalNhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') totalXuat += d.SO_LUONG;
    });

    const lowStockCount = sanPhams.filter(p => p.TON_CUOI <= p.TON_TOI_THIEU).length;

    return {
      totalProducts,
      numPhieuNhap,
      numPhieuXuat,
      numPhieuNhapKK,
      numPhieuXuatKK,
      totalNhap,
      totalXuat,
      lowStockCount
    };
  }, [sanPhams, filteredHeaders, filteredDetails]);

  // --- 5. BIỂU ĐỒ 1: TOP 5 SKU XUẤT NHIỀU NHẤT ---
  const topXuatData = useMemo(() => {
    const mapXuat: Record<string, { sku: string; qty: number; name: string }> = {};

    filteredDetails.forEach(d => {
      if (d.LOAI === 'XUẤT') {
        if (!mapXuat[d.SKU]) {
          mapXuat[d.SKU] = { sku: d.SKU, qty: 0, name: d.TEN_SP };
        }
        mapXuat[d.SKU].qty += d.SO_LUONG;
      }
    });

    return Object.values(mapXuat)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
      .map(item => ({
        name: item.sku.split(' ').slice(0, 3).join(' '), 
        fullSKU: item.sku,
        'Số lượng xuất': item.qty
      }));
  }, [filteredDetails]);

  // --- 6. BIỂU ĐỒ 2: TỶ TRỌNG NHẬP XUẤT (PIE CHART) ---
  const ratioData = useMemo(() => {
    return [
      { name: 'Tổng Nhập', value: kpis.totalNhap },
      { name: 'Tổng Xuất', value: kpis.totalXuat }
    ].filter(item => item.value > 0);
  }, [kpis]);

  // --- 7. BIỂU ĐỒ 3: CHI NHÁNH LẤY HÀNG NHIỀU NHẤT (BAR CHART) ---
  const branchData = useMemo(() => {
    const mapBranch: Record<string, { branch: string; qty: number }> = {};

    filteredHeaders.forEach(h => {
      if (h.LOAI === 'XUẤT') {
        if (!mapBranch[h.CHI_NHANH]) {
          mapBranch[h.CHI_NHANH] = { branch: h.CHI_NHANH, qty: 0 };
        }
        mapBranch[h.CHI_NHANH].qty += h.TONG_SL;
      }
    });

    return Object.values(mapBranch)
      .sort((a, b) => b.qty - a.qty)
      .map(item => ({
        name: item.branch,
        'Số lượng xuất': item.qty
      }));
  }, [filteredHeaders]);

  // --- 8. BIỂU ĐỒ 4: NGÀY GIAO DỊCH NHIỀU NHẤT (LINE CHART) ---
  const transactionByDateData = useMemo(() => {
    const mapDate: Record<string, { date: string; nhap: number; xuất: number }> = {};

    filteredDetails.forEach(d => {
      const dateStr = d.NGAY;
      if (!mapDate[dateStr]) {
        mapDate[dateStr] = { date: dateStr, nhap: 0, xuất: 0 };
      }
      if (d.LOAI === 'NHẬP') mapDate[dateStr].nhap += d.SO_LUONG;
      if (d.LOAI === 'XUẤT') mapDate[dateStr].xuất += d.SO_LUONG;
    });

    return Object.values(mapDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        name: item.date.split('-').slice(1).join('/'),
        'Nhập': item.nhap,
        'Xuất': item.xuất
      }));
  }, [filteredDetails]);

  // --- 9. BIỂU ĐỒ 5: TỶ LỆ HÀNG TỒN THEO THƯƠNG HIỆU (PIE CHART MỚI) ---
  const brandStockData = useMemo(() => {
    const mapBrand: Record<string, number> = {};
    sanPhams.forEach(p => {
      mapBrand[p.THUONG_HIEU] = (mapBrand[p.THUONG_HIEU] || 0) + p.TON_CUOI;
    });
    return Object.entries(mapBrand)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [sanPhams]);

  // --- 9B. BIẾN THEO DÕI THU PHÓNG (ZOOM COMPRESSED DATASETS) ---
  const zoomDailyTxData = useMemo(() => {
    if (!dailyTxZoom) return transactionByDateData;
    return transactionByDateData.slice(dailyTxZoom.start, dailyTxZoom.end + 1);
  }, [transactionByDateData, dailyTxZoom]);

  const zoomBrandStockData = useMemo(() => {
    return brandStockData.slice(0, brandStockLimit);
  }, [brandStockData, brandStockLimit]);

  const zoomTopXuatData = useMemo(() => {
    if (!topXuatZoom) return topXuatData;
    return topXuatData.slice(topXuatZoom.start, topXuatZoom.end + 1);
  }, [topXuatData, topXuatZoom]);

  const zoomBranchData = useMemo(() => {
    if (!branchExportZoom) return branchData;
    return branchData.slice(branchExportZoom.start, branchExportZoom.end + 1);
  }, [branchData, branchExportZoom]);

  // --- 10. DANH SÁCH CẢNH BÁO SẮP HẾT HÀNG ---
  const criticalProducts = useMemo(() => {
    return sanPhams
      .filter(p => p.TON_CUOI <= p.TON_TOI_THIEU)
      .sort((a, b) => (a.TON_CUOI / a.TON_TOI_THIEU) - (b.TON_CUOI / b.TON_TOI_THIEU));
  }, [sanPhams]);

  // --- 11. XỬ LÝ XUẤT FILE BÁO CÁO (EXCEL/PDF) ---
  const handleExportData = (type: 'EXCEL' | 'PDF') => {
    // Cho phép xuất PDF sử dụng cấu hình mẫu Excel (Đồng bộ cấu hình "User cấu hình 1 lần")
    const templatesOfType = type === 'PDF' 
      ? exportTemplates 
      : exportTemplates.filter(t => t.type === 'EXCEL');
    
    if (templatesOfType.length === 0) {
      if (onTriggerToast) {
        onTriggerToast(
          'Chưa cấu hình mẫu xuất Excel/PDF. Vui lòng cấu hình trong mục Hệ Thống Xuất Excel/PDF Theo Mẫu.',
          'warning'
        );
      } else {
        alert('Chưa cấu hình mẫu xuất Excel/PDF. Vui lòng cấu hình trong mục Hệ Thống Xuất Excel/PDF Theo Mẫu.');
      }
      return;
    }

    setExportModalType(type);
    
    // Tìm mẫu mặc định hoặc mẫu đầu tiên
    const matched = templatesOfType.find(t => t.isDefault) || templatesOfType[0];

    setSelectedTemplateId(matched.id);
    setExportStartRow(matched.startRow || 10);
    setExportGroupByFields(matched.groupByFields || []);
    setCurrentMappings(matched.columnMappings || []);
    setExportMode('TEMPLATE');
    setShowExportModal(true);
  };

  const executeExport = async () => {
    setIsExporting(true);
    try {
      // Xuất theo mẫu cấu hình động (Single Source of Truth)
      const matchedTemplate = exportTemplates.find(t => t.id === selectedTemplateId);
      if (!matchedTemplate) {
        if (onTriggerToast) {
          onTriggerToast('Vui lòng chọn mẫu báo cáo hợp lệ', 'warning');
        } else {
          alert('Vui lòng chọn mẫu báo cáo hợp lệ');
        }
        return;
      }

      // Tích hợp cấu hình tùy chỉnh trực tiếp từ Modal
      const customizedTemplate: Template = {
        ...matchedTemplate,
        groupByFields: exportGroupByFields,
        columnMappings: currentMappings
      };

      // Lưu tự động thay đổi vào mẫu báo cáo
      const updatedList = exportTemplates.map(t => t.id === selectedTemplateId ? customizedTemplate : t);
      setExportTemplates(updatedList);
      localStorage.setItem('export_templates', JSON.stringify(updatedList));

      // Đồng bộ ngầm lên Supabase để lưu trữ lâu dài
      syncExportTemplate(customizedTemplate).catch(err => {
        console.warn('Lỗi đồng bộ ngầm mẫu báo cáo:', err);
      });

      await exportReportWithFilters({
        template: customizedTemplate,
        exportFormat: exportModalType,
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
        onTriggerToast,
        onDownload: (blob, fileName) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      });
      setShowExportModal(false);
    } catch (error) {
      console.error('Lỗi xuất báo cáo theo mẫu:', error);
      alert('Đã xảy ra lỗi khi kết xuất báo cáo theo cấu hình. Hệ thống tự động chuyển sang chế độ in truyền thống.');
      if (exportModalType === 'PDF') {
        window.print();
      }
    } finally {
      setIsExporting(false);
    }
  };

  // --- TRÍ TUỆ ĐỊNH GIÁ: TÍNH TOÁN DỮ LIỆU ĐỘ & TỔ HỢP ĐỘ ---
  const formatDopLocal = (val: number): string => {
    if (val === 0 || Math.abs(val) < 0.0001) return '-0.00';
    const fixed = val.toFixed(2);
    if (val > 0) return `+${fixed}`;
    return fixed;
  };

  const getSphCylAdd = (d: NhapXuatCT) => {
    const sph = d.SPH ?? 0;
    const cyl = d.CYL ?? 0;
    let add = 0;
    if (sph > 0) {
      add = sph;
    }
    const skuTokens = (d.SKU || '').trim().split(/\s+/);
    if (skuTokens.length >= 6) {
      const thirdToLast = skuTokens[skuTokens.length - 3];
      const val = parseFloat(thirdToLast);
      if (
        !isNaN(val) && 
        (thirdToLast.includes('.') || /^[+-]?\d+$/.test(thirdToLast)) && 
        !['1.56', '1.60', '1.61', '1.67', '1.74'].includes(thirdToLast)
      ) {
        add = val;
      }
    }
    return { sph, cyl, add };
  };

  const findSphRangeLabel = (sph: number) => {
    for (const r of sphRanges) {
      const rMin = Math.min(r.min, r.max);
      const rMax = Math.max(r.min, r.max);
      if (sph >= rMin && sph <= rMax) {
        return r.label;
      }
    }
    return 'Khác (SPH)';
  };

  const findCylRangeLabel = (cyl: number) => {
    for (const r of cylRanges) {
      const rMin = Math.min(r.min, r.max);
      const rMax = Math.max(r.min, r.max);
      if (cyl >= rMin && cyl <= rMax) {
        return r.label;
      }
    }
    return 'Khác (CYL)';
  };

  const diopterChartData = useMemo(() => {
    const dataMap: Record<string, number> = {};

    filteredDetails.forEach(d => {
      if (d.LOAI !== diopterTxType) return;

      const { sph, cyl, add } = getSphCylAdd(d);

      if (diopterMode === 'SPH') {
        if (sph <= 0) {
          const key = formatDopLocal(sph);
          dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
        }
      } else if (diopterMode === 'CYL') {
        if (cyl < 0) {
          const key = formatDopLocal(cyl);
          dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
        }
      } else if (diopterMode === 'ADD') {
        if (add > 0) {
          const key = `+${add.toFixed(2)}`;
          dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
        }
      } else if (diopterMode === 'COMBINED') {
        const sphLabel = findSphRangeLabel(sph);
        const cylLabel = findCylRangeLabel(cyl);
        let key = `SPH: ${sphLabel} | CYL: ${cylLabel}`;
        if (add > 0) {
          key += ` | ADD: +${add.toFixed(2)}`;
        }
        dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
      }
    });

    const totalQty = Object.values(dataMap).reduce((sum, v) => sum + v, 0);

    const sortedData = Object.entries(dataMap)
      .map(([name, value]) => {
        const percentage = totalQty > 0 ? (value / totalQty) * 100 : 0;
        return {
          name,
          value,
          percentage: Number(percentage.toFixed(1))
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      sortedData,
      totalQty
    };
  }, [filteredDetails, diopterTxType, diopterMode, sphRanges, cylRanges]);

  // ==========================================
  // CÁC PHÂN TÍCH CHUYÊN SÂU CHO KHO TRÒNG (DASHBOARD ĐỘ BÁN CHẠY)
  // ==========================================

  // Định dạng hiển thị độ đẹp mắt (VD: -2.00, +1.50, 0.00)
  const formatDopValue = (val: number): string => {
    if (val === 0 || Math.abs(val) < 0.0001) return '0.00';
    return val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
  };

  // Lấy danh sách SPH và CYL độc nhất từ các dòng giao dịch thực tế hoặc danh mục
  const uniqueSphValues = useMemo(() => {
    const sphSet = new Set<number>();
    filteredDetails.forEach(d => {
      const { sph } = getSphCylAdd(d);
      sphSet.add(sph);
    });
    if (sphSet.size === 0) {
      sanPhams.forEach(p => {
        sphSet.add(p.CAN ?? 0);
      });
    }
    return Array.from(sphSet).sort((a, b) => b - a); // Sắp xếp giảm dần (ví dụ: +2.00, 0.00, -1.00, -2.00...)
  }, [filteredDetails, sanPhams]);

  const uniqueCylValues = useMemo(() => {
    const cylSet = new Set<number>();
    filteredDetails.forEach(d => {
      const { cyl } = getSphCylAdd(d);
      cylSet.add(cyl);
    });
    if (cylSet.size === 0) {
      sanPhams.forEach(p => {
        cylSet.add(p.LOAN ?? 0);
      });
    }
    return Array.from(cylSet).sort((a, b) => b - a); // Loạn giảm dần, ví dụ: 0.00, -0.25, -0.50, -1.00...
  }, [filteredDetails, sanPhams]);

  // Lọc SPH (Cận) và CYL (Loạn) nằm trong phạm vi người dùng lựa chọn cho Heatmap
  const heatmapSphValues = useMemo(() => {
    const minSph = Math.min(sphFilterFrom, sphFilterTo);
    const maxSph = Math.max(sphFilterFrom, sphFilterTo);
    return uniqueSphValues.filter(sph => sph >= minSph && sph <= maxSph);
  }, [uniqueSphValues, sphFilterFrom, sphFilterTo]);

  const heatmapCylValues = useMemo(() => {
    const minCyl = Math.min(cylFilterFrom, cylFilterTo);
    const maxCyl = Math.max(cylFilterFrom, cylFilterTo);
    return uniqueCylValues.filter(cyl => cyl >= minCyl && cyl <= maxCyl);
  }, [uniqueCylValues, cylFilterFrom, cylFilterTo]);

  // Cố định lựa chọn SPH / CYL hợp lệ để vẽ biểu đồ cột
  const activeSelectedSph = useMemo(() => {
    if (salesDbSelectedSph === 'ALL') return 'ALL';
    if (uniqueSphValues.includes(salesDbSelectedSph)) return salesDbSelectedSph;
    return uniqueSphValues[0] ?? 0;
  }, [salesDbSelectedSph, uniqueSphValues]);

  const activeSelectedCyl = useMemo(() => {
    if (salesDbSelectedCyl === 'ALL') return 'ALL';
    if (uniqueCylValues.includes(salesDbSelectedCyl)) return salesDbSelectedCyl;
    return uniqueCylValues[0] ?? 0;
  }, [salesDbSelectedCyl, uniqueCylValues]);

  // 1. Dữ liệu Biểu đồ cột phân tích (luôn sắp xếp theo thứ tự độ thực tế liên tục)
  const salesBarChartData = useMemo(() => {
    const dataMap: Record<string, number> = {};

    filteredDetails.forEach(d => {
      if (d.LOAI !== salesDbTxType) return;
      const { sph, cyl } = getSphCylAdd(d);

      if (salesDbBarMode === 'SPH_TO_CYL') {
        const matchSph = activeSelectedSph === 'ALL' || sph === activeSelectedSph;
        if (matchSph) {
          const key = formatDopValue(cyl);
          dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
        }
      } else {
        const matchCyl = activeSelectedCyl === 'ALL' || cyl === activeSelectedCyl;
        if (matchCyl) {
          const key = formatDopValue(sph);
          dataMap[key] = (dataMap[key] || 0) + d.SO_LUONG;
        }
      }
    });

    const totalQty = Object.values(dataMap).reduce((sum, v) => sum + v, 0);

    const sortedData = Object.entries(dataMap)
      .map(([name, value]) => {
        const percentage = totalQty > 0 ? (value / totalQty) * 100 : 0;
        return {
          name,
          value,
          percentage: Number(percentage.toFixed(1))
        };
      })
      .sort((a, b) => {
        const valA = parseFloat(a.name);
        const valB = parseFloat(b.name);
        // Sắp xếp theo trị tuyệt đối tăng dần để biểu thị độ liên tục (ví dụ: 0.00, -0.25, -0.50... hoặc +0.75, +1.00...)
        const absDiff = Math.abs(valA) - Math.abs(valB);
        if (Math.abs(absDiff) < 0.0001) {
          return valB - valA; // Ưu tiên độ dương đứng trước độ âm nếu trùng trị tuyệt đối
        }
        return absDiff;
      });

    // Tìm phần tử có sản lượng lớn nhất làm Top để tóm tắt thông tin chính xác
    let maxItem = sortedData[0] || null;
    sortedData.forEach(item => {
      if (!maxItem || item.value > maxItem.value) {
        maxItem = item;
      }
    });

    return {
      sortedData,
      totalQty,
      topValue: maxItem ? maxItem.name : 'N/A',
      topQty: maxItem ? maxItem.value : 0,
      topPercentage: maxItem ? maxItem.percentage : 0
    };
  }, [filteredDetails, salesDbTxType, salesDbBarMode, activeSelectedSph, activeSelectedCyl]);

  const zoomSalesDbBarData = useMemo(() => {
    if (!salesDbBarZoom) return salesBarChartData.sortedData;
    return salesBarChartData.sortedData.slice(salesDbBarZoom.start, salesDbBarZoom.end + 1);
  }, [salesBarChartData.sortedData, salesDbBarZoom]);

  // 2. Dữ liệu Heatmap SPH × CYL
  const heatmapData = useMemo(() => {
    const grid: Record<string, { n_qty: number; x_qty: number }> = {};

    filteredDetails.forEach(d => {
      const { sph, cyl } = getSphCylAdd(d);
      const key = `${sph}_${cyl}`;
      if (!grid[key]) {
        grid[key] = { n_qty: 0, x_qty: 0 };
      }
      if (d.LOAI === 'NHẬP') {
        grid[key].n_qty += d.SO_LUONG;
      } else if (d.LOAI === 'XUẤT') {
        grid[key].x_qty += d.SO_LUONG;
      }
    });

    // Tìm max trị số của loại gd hiện tại để tính mật độ màu
    let maxQtyVal = 0;
    Object.values(grid).forEach(cell => {
      const val = salesDbTxType === 'XUẤT' ? cell.x_qty : cell.n_qty;
      if (val > maxQtyVal) {
        maxQtyVal = val;
      }
    });

    return {
      grid,
      maxQtyVal
    };
  }, [filteredDetails, salesDbTxType]);

  const heatmapLevelRanges = useMemo(() => {
    return getLevelRanges(heatmapData.maxQtyVal);
  }, [heatmapData.maxQtyVal]);

  // Chi tiết ô được click trong Heatmap
  const selectedCellDetails = useMemo(() => {
    if (!selectedHeatmapCell) return null;
    const { sph, cyl } = selectedHeatmapCell;

    // Lọc các SKU liên quan từ danh mục sanPhams
    const relatedSkus = sanPhams.filter(p => {
      return (p.CAN ?? 0) === sph && (p.LOAN ?? 0) === cyl;
    });

    const totalStock = relatedSkus.reduce((sum, p) => sum + (p.TON_CUOI ?? 0), 0);

    // Tính tổng nhập, tổng xuất trong kỳ từ filteredDetails
    let totalNhapInPeriod = 0;
    let totalXuatInPeriod = 0;
    filteredDetails.forEach(d => {
      const { sph: s, cyl: c } = getSphCylAdd(d);
      if (s === sph && c === cyl) {
        if (d.LOAI === 'NHẬP') totalNhapInPeriod += d.SO_LUONG;
        if (d.LOAI === 'XUẤT') totalXuatInPeriod += d.SO_LUONG;
      }
    });

    return {
      sph,
      cyl,
      totalNhap: totalNhapInPeriod,
      totalXuat: totalXuatInPeriod,
      currentStock: totalStock,
      skus: relatedSkus.map(p => ({
        sku: p.SKU,
        name: p.TEN_SAN_PHAM,
        brand: p.THUONG_HIEU,
        chietXuat: p.CHIET_XUAT,
        features: p.TINH_NANG,
        stock: p.TON_CUOI,
        minStock: p.TON_TOI_THIEU
      }))
    };
  }, [selectedHeatmapCell, sanPhams, filteredDetails]);

  // 3. Top tổ hợp bán chạy / nhập kho hàng đầu
  const topCombinationsData = useMemo(() => {
    const comboMap: Record<string, { sph: number; cyl: number; qty: number }> = {};

    filteredDetails.forEach(d => {
      if (d.LOAI !== salesDbTopType) return;
      const { sph, cyl } = getSphCylAdd(d);
      const key = `${sph}_${cyl}`;
      if (!comboMap[key]) {
        comboMap[key] = { sph, cyl, qty: 0 };
      }
      comboMap[key].qty += d.SO_LUONG;
    });

    const sortedList = Object.values(comboMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, salesDbTopLimit);

    const maxQty = sortedList[0]?.qty || 1;

    return sortedList.map(item => ({
      ...item,
      percentageOfMax: Number(((item.qty / maxQty) * 100).toFixed(1))
    }));
  }, [filteredDetails, salesDbTopType, salesDbTopLimit]);

  // --- CONTROLLER CHO BIỂU ĐỒ (ZOOM, FULLSCREEN, COLLAPSE) ---
  const handleChartMouseDown = (e: any, setRefArea: (val: any) => void) => {
    if (e && e.activeTooltipIndex !== undefined && e.activeTooltipIndex !== null) {
      setRefArea({ left: e.activeTooltipIndex, right: e.activeTooltipIndex });
    }
  };

  const handleChartMouseMove = (e: any, refArea: any, setRefArea: (val: any) => void) => {
    if (refArea.left !== null && e && e.activeTooltipIndex !== undefined && e.activeTooltipIndex !== null) {
      setRefArea({ ...refArea, right: e.activeTooltipIndex });
    }
  };

  const handleChartMouseUp = (
    refArea: any, 
    setRefArea: (val: any) => void, 
    zoomState: any, 
    setZoom: (val: any) => void, 
    dataLength: number
  ) => {
    if (refArea.left !== null && refArea.right !== null && refArea.left !== refArea.right) {
      const startOffset = zoomState ? zoomState.start : 0;
      const leftIndex = Number(refArea.left);
      const rightIndex = Number(refArea.right);
      const [start, end] = [leftIndex, rightIndex].sort((a, b) => a - b);
      const originalStart = startOffset + start;
      const originalEnd = startOffset + end;
      
      const boundedStart = Math.max(0, originalStart);
      const boundedEnd = Math.min(dataLength - 1, originalEnd);

      if (boundedEnd > boundedStart) {
        setZoom({ start: boundedStart, end: boundedEnd });
      }
    }
    setRefArea({ left: null, right: null });
  };

  const renderChartControls = (
    chartId: string, 
    options?: { 
      isPie?: boolean; 
      dataLength?: number; 
      zoomState?: any;
      setZoomState?: (val: any) => void;
      refAreaState?: any;
    }
  ) => {
    const isCollapsed = collapsedCharts[chartId] || false;
    const isFullscreen = fullscreenChart === chartId;

    const handleZoomIn = () => {
      if (options?.isPie) {
        setBrandStockLimit(prev => Math.max(3, prev - 2));
        setBrandStockZoom(prev => Math.min(1.5, prev + 0.15));
      } else if (options?.setZoomState && options?.dataLength) {
        const currentZoom = options.zoomState;
        const currentStart = currentZoom ? currentZoom.start : 0;
        const currentEnd = currentZoom ? currentZoom.end : options.dataLength - 1;
        const len = currentEnd - currentStart;
        if (len > 2) {
          const delta = Math.max(1, Math.round(len * 0.15));
          options.setZoomState({
            start: Math.min(currentStart + delta, currentEnd - 1),
            end: Math.max(currentEnd - delta, currentStart + 1)
          });
        }
      }
    };

    const handleZoomOut = () => {
      if (options?.isPie) {
        setBrandStockLimit(prev => Math.min(brandStockData.length, prev + 2));
        setBrandStockZoom(prev => Math.max(0.6, prev - 0.15));
      } else if (options?.setZoomState && options?.dataLength) {
        const currentZoom = options.zoomState;
        if (!currentZoom) return;
        const currentStart = currentZoom.start;
        const currentEnd = currentZoom.end;
        const len = currentEnd - currentStart;
        const delta = Math.max(1, Math.round(len * 0.15));
        const newStart = Math.max(0, currentStart - delta);
        const newEnd = Math.min(options.dataLength - 1, currentEnd + delta);
        if (newStart === 0 && newEnd === options.dataLength - 1) {
          options.setZoomState(null);
        } else {
          options.setZoomState({ start: newStart, end: newEnd });
        }
      }
    };

    const handleReset = () => {
      if (options?.isPie) {
        setBrandStockLimit(10);
        setBrandStockZoom(1);
      } else if (options?.setZoomState) {
        options.setZoomState(null);
      }
    };

    return (
      <div className="flex items-center gap-1.5 shrink-0 select-none">
        <button
          type="button"
          onClick={() => toggleChartCollapse(chartId)}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          title={isCollapsed ? "Mở rộng biểu đồ" : "Thu gọn biểu đồ"}
        >
          {isCollapsed ? <ChevronDown className="w-4 h-4 text-emerald-600" /> : <ChevronUp className="w-4 h-4 text-slate-500" />}
        </button>

        {!isCollapsed && (
          <>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Thu nhỏ vùng nhìn (Zoom In)"
            >
              <ZoomIn className="w-4 h-4 text-blue-600" />
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!options?.isPie && !options?.zoomState}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              title="Phóng to vùng nhìn (Zoom Out)"
            >
              <ZoomOut className="w-4 h-4 text-indigo-600" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={!options?.isPie && !options?.zoomState && brandStockLimit === 10 && brandStockZoom === 1}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              title="Khôi phục mặc định"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setFullscreenChart(isFullscreen ? null : chartId)}
          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-red-500" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* CHUYỂN ĐỔI CHẾ ĐỘ XEM TRÊN DASHBOARD */}
      <div className="flex bg-slate-100 p-1 rounded-xl self-start w-fit select-none border border-slate-200">
        <button
          type="button"
          onClick={() => setDashboardSubTab('ANALYTICS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            dashboardSubTab === 'ANALYTICS' 
              ? 'bg-blue-650 text-white shadow-xs' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-250/40'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Phân Tích & Đồ Thị Trực Quan
        </button>
        <button
          type="button"
          onClick={() => setDashboardSubTab('TEMPLATES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            dashboardSubTab === 'TEMPLATES' 
              ? 'bg-blue-650 text-white shadow-xs' 
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-250/40'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Hệ Thống Xuất Excel/PDF Theo Mẫu
        </button>
      </div>

      {dashboardSubTab === 'TEMPLATES' ? (
        <TemplateExportManager
          sanPhams={sanPhams}
          nhapXuats={nhapXuats}
          nhapXuatCTs={nhapXuatCTs}
          chiNhanhs={chiNhanhs}
        />
      ) : (
        <>
          {/* 1. THANH BỘ LỌC ĐA NHIỆM CHUYÊN NGHIỆP */}
      <div id="dashboard-filter-section" className="bento-card !p-5 bg-white border border-slate-100 rounded-2xl shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-sans font-semibold text-slate-800 text-base">Dashboard Phân Tích Kho</h2>
              <p className="text-xs text-slate-400 font-mono">Hệ thống phân tích đa chiều tự động cập nhật mượt mà</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset bộ lọc
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Đồ thị:</span>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setChartType('line')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    chartType === 'line' ? 'bg-blue-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đường xu hướng
                </button>
                <button
                  type="button"
                  onClick={() => setChartType('stacked')}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    chartType === 'stacked' ? 'bg-blue-650 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Cột chồng
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Bộ lọc nhanh thời gian (Date Range presets) */}
          <div className="space-y-1 md:col-span-2">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Lọc nhanh khoảng thời gian
            </label>
            <div className="flex flex-wrap items-center gap-1 bg-slate-100/80 p-1 rounded-lg">
              {([
                { key: 'today', label: 'Hôm nay' },
                { key: 'yesterday', label: 'Hôm qua' },
                { key: 'this_week', label: 'Tuần này' },
                { key: 'last_week', label: 'Tuần trước' },
                { key: 'this_month', label: 'Tháng này' },
                { key: 'last_month', label: 'Tháng trước' }
              ] as const).map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleQuickFilter(f.key)}
                  className={`px-2 py-1 text-[9px] font-extrabold rounded-md transition-all cursor-pointer ${
                    activeQuickFilter === f.key ? 'bg-red-650 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chi nhánh */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Chi nhánh
            </label>
            <select 
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả chi nhánh</option>
              {chiNhanhs.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Thương hiệu */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Thương hiệu
            </label>
            <select 
              value={selectedBrandFilter}
              onChange={(e) => { setSelectedBrandFilter(e.target.value); setSelectedChietXuatFilter('Tất cả'); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả thương hiệu</option>
              {brandOptions.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Tính năng */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Tính năng
            </label>
            <select 
              value={selectedFeatureFilter}
              onChange={(e) => { setSelectedFeatureFilter(e.target.value); setSelectedChietXuatFilter('Tất cả'); }}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả tính năng</option>
              <option value="ĐM">Đổi màu (ĐM)</option>
              <option value="ASX">Chống ánh sáng xanh (ASX)</option>
            </select>
          </div>

          {/* Chiết suất lọc */}
          <div className="space-y-1">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Boxes className="w-3 h-3" /> Chiết suất lọc
            </label>
            <select 
              value={selectedChietXuatFilter}
              onChange={(e) => setSelectedChietXuatFilter(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden"
            >
              <option value="Tất cả">Tất cả chiết suất</option>
              {chietXuatOptions.map(cx => (
                <option key={cx} value={cx}>{cx}</option>
              ))}
            </select>
          </div>

          {/* Ngày bắt đầu */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Ngày bắt đầu
            </label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-bold text-slate-755 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden font-mono"
            />
          </div>

          {/* Ngày kết thúc */}
          <div className="space-y-1 lg:col-span-3">
            <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Ngày kết thúc
            </label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActiveQuickFilter(''); }}
              className="w-full text-xs font-bold text-slate-755 bg-slate-50 border border-slate-150 rounded-lg py-1.5 px-2 focus:outline-hidden font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. CHỈ SỐ KPI CHỦ CHỐT - PHÙ HỢP HOÀN TOÀN VỚI YÊU CẦU NGHIỆP VỤ */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Tổng phiếu nhập */}
        <div 
          onClick={() => onDrillDown && onDrillDown({
            historyTypeFilter: 'NHẬP',
            branchFilter: selectedBranch,
            fromDate: startDate,
            toDate: endDate
          })}
          className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-emerald-300 transition-all duration-150 group"
          title="Bấm để xem danh sách chi tiết các Phiếu Nhập"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 justify-between">
              <span className="truncate">Tổng phiếu nhập</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500 shrink-0" />
            </p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuNhap}</p>
          </div>
        </div>

        {/* Card 2: Tổng phiếu xuất */}
        <div 
          onClick={() => onDrillDown && onDrillDown({
            historyTypeFilter: 'XUẤT',
            branchFilter: selectedBranch,
            fromDate: startDate,
            toDate: endDate
          })}
          className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-rose-300 transition-all duration-150 group"
          title="Bấm để xem danh sách chi tiết các Phiếu Xuất"
        >
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-rose-100 transition-colors">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 justify-between">
              <span className="truncate">Tổng phiếu xuất</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 shrink-0" />
            </p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuXuat}</p>
          </div>
        </div>

        {/* Card 3: Tổng phiếu nhập kiểm kho */}
        <div 
          onClick={() => onDrillDown && onDrillDown({
            historyTypeFilter: 'NHẬP_KIEM_KHO',
            branchFilter: selectedBranch,
            fromDate: startDate,
            toDate: endDate
          })}
          className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-teal-300 transition-all duration-150 group"
          title="Bấm để xem danh sách chi tiết các Phiếu Nhập Kiểm Kho (PNK)"
        >
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl group-hover:bg-teal-100 transition-colors">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 justify-between">
              <span className="truncate">Nhập kiểm kho (PNK)</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-teal-500 shrink-0" />
            </p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuNhapKK}</p>
          </div>
        </div>

        {/* Card 4: Tổng phiếu xuất kiểm kho */}
        <div 
          onClick={() => onDrillDown && onDrillDown({
            historyTypeFilter: 'XUAT_KIEM_KHO',
            branchFilter: selectedBranch,
            fromDate: startDate,
            toDate: endDate
          })}
          className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:border-indigo-300 transition-all duration-150 group"
          title="Bấm để xem danh sách chi tiết các Phiếu Xuất Kiểm Kho (PXK)"
        >
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase flex items-center gap-1 justify-between">
              <span className="truncate">Xuất kiểm kho (PXK)</span>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500 shrink-0" />
            </p>
            <p className="stat-value text-slate-850 font-mono font-bold text-lg">{kpis.numPhieuXuatKK}</p>
          </div>
        </div>

        {/* Card 5: Số lượng đã nhập */}
        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Lượng đã nhập</p>
            <p className="stat-value text-slate-855 font-mono font-bold text-lg">{kpis.totalNhap} <span className="text-[10px] text-slate-400">miếng</span></p>
          </div>
        </div>

        {/* Card 6: Số lượng đã xuất */}
        <div className="bento-card !p-4 flex items-center gap-4 bg-white border border-slate-100 rounded-2xl shadow-xs">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="stat-label !mb-0 text-slate-400 font-bold text-[10px] uppercase">Lượng đã xuất</p>
            <p className="stat-value text-slate-855 font-mono font-bold text-lg">{kpis.totalXuat} <span className="text-[10px] text-slate-400">miếng</span></p>
          </div>
        </div>
      </div>

      {/* 3. ĐỒ THỊ BIỂU DIỄN PHÂN TÍCH CHUYÊN SÂU */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Biểu đồ 1: Biến Động Nhập Xuất Theo Ngày (Line hoặc Stacked Bar) */}
        {(!fullscreenChart || fullscreenChart === 'dailyTx') && (
          <div className={`bento-card !p-5 ${fullscreenChart === 'dailyTx' ? 'fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col justify-between' : ''}`}>
            <h3 className="font-sans font-bold text-slate-850 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>Biến Động Nhập Xuất Theo Ngày</span>
                {dailyTxZoom && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    Đã thu phóng
                  </span>
                )}
              </div>
              {renderChartControls('dailyTx', { 
                dataLength: transactionByDateData.length, 
                zoomState: dailyTxZoom, 
                setZoomState: setDailyTxZoom, 
                refAreaState: dailyTxRefArea 
              })}
            </h3>
            
            {!collapsedCharts['dailyTx'] && (
              <div className={`w-full ${fullscreenChart === 'dailyTx' ? 'flex-1 h-[calc(100%-60px)] min-h-[300px]' : 'h-80 min-h-[300px]'}`}>
                {zoomDailyTxData.length > 0 && isMounted ? (
                  <SafeResponsiveContainer height={fullscreenChart === 'dailyTx' ? 'calc(100% - 20px)' : 300} minHeight={250}>
                    {chartType === 'line' ? (
                      <LineChart 
                        data={zoomDailyTxData} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onMouseDown={(e) => handleChartMouseDown(e, (val) => setDailyTxRefArea(val))}
                        onMouseMove={(e) => handleChartMouseMove(e, dailyTxRefArea, (val) => setDailyTxRefArea(val))}
                        onMouseUp={() => handleChartMouseUp(dailyTxRefArea, (val) => setDailyTxRefArea(val), dailyTxZoom, setDailyTxZoom, transactionByDateData.length)}
                      >
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="Nhập" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="Xuất" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        {dailyTxRefArea.left !== null && dailyTxRefArea.right !== null && (
                          <ReferenceArea 
                            x1={zoomDailyTxData[Number(dailyTxRefArea.left)]?.name} 
                            x2={zoomDailyTxData[Number(dailyTxRefArea.right)]?.name} 
                            {...({ fill: '#3b82f6', fillOpacity: 0.15 } as any)}
                          />
                        )}
                      </LineChart>
                    ) : (
                      <BarChart 
                        data={zoomDailyTxData} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onMouseDown={(e) => handleChartMouseDown(e, (val) => setDailyTxRefArea(val))}
                        onMouseMove={(e) => handleChartMouseMove(e, dailyTxRefArea, (val) => setDailyTxRefArea(val))}
                        onMouseUp={() => handleChartMouseUp(dailyTxRefArea, (val) => setDailyTxRefArea(val), dailyTxZoom, setDailyTxZoom, transactionByDateData.length)}
                      >
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Nhập" stackId="a" fill="#10b981" />
                        <Bar dataKey="Xuất" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        {dailyTxRefArea.left !== null && dailyTxRefArea.right !== null && (
                          <ReferenceArea 
                            x1={zoomDailyTxData[Number(dailyTxRefArea.left)]?.name} 
                            x2={zoomDailyTxData[Number(dailyTxRefArea.right)]?.name} 
                            {...({ fill: '#3b82f6', fillOpacity: 0.15 } as any)}
                          />
                        )}
                      </BarChart>
                    )}
                  </SafeResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    Không có dữ liệu giao dịch trong khoảng thời gian này
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Biểu đồ 5: Tỷ Lệ Hàng Tồn Kho Theo Thương Hiệu (Pie Chart Mới) */}
        {(!fullscreenChart || fullscreenChart === 'brandStock') && (
          <div className={`bento-card !p-5 ${fullscreenChart === 'brandStock' ? 'fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col justify-between' : ''}`}>
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>Tỷ Lệ Hàng Tồn Kho Theo Thương Hiệu</span>
                {brandStockLimit < brandStockData.length && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    Top {brandStockLimit}
                  </span>
                )}
              </div>
              {renderChartControls('brandStock', { isPie: true })}
            </h3>
            
            {!collapsedCharts['brandStock'] && (
              <div className={`flex flex-col sm:flex-row items-center justify-around gap-4 ${fullscreenChart === 'brandStock' ? 'flex-1 h-[calc(100%-60px)] min-h-[300px]' : 'h-80 min-h-[300px]'}`}>
                {zoomBrandStockData.length > 0 && isMounted ? (
                  <>
                    <div className={`${fullscreenChart === 'brandStock' ? 'h-72 w-72 min-h-[288px] min-w-[288px]' : 'h-44 w-44 min-h-[176px] min-w-[176px]'} transition-all duration-300 relative`}>
                      <SafeResponsiveContainer height={fullscreenChart === 'brandStock' ? 288 : 176} minHeight={176}>
                        <PieChart>
                          <Pie
                            data={zoomBrandStockData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55 * brandStockZoom * (fullscreenChart === 'brandStock' ? 1.5 : 1)}
                            outerRadius={75 * brandStockZoom * (fullscreenChart === 'brandStock' ? 1.5 : 1)}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {zoomBrandStockData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} miếng`} />
                        </PieChart>
                      </SafeResponsiveContainer>
                    </div>
                    <div className="space-y-2 overflow-y-auto max-h-48 pr-1 flex-1">
                      {zoomBrandStockData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="text-slate-600 truncate max-w-[120px]">{item.name}</span>
                          </div>
                          <span className="font-mono text-slate-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 font-mono">
                    Không có dữ liệu tồn kho thương hiệu
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Biểu đồ 2: Top 5 SKU Xuất Nhiều Nhất (Bar Chart) */}
        {(!fullscreenChart || fullscreenChart === 'topXuat') && (
          <div className={`bento-card !p-5 ${fullscreenChart === 'topXuat' ? 'fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col justify-between' : ''}`}>
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>Top 5 SKU Xuất Kho Nhiều Nhất</span>
                {topXuatZoom && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    Đã thu phóng
                  </span>
                )}
              </div>
              {renderChartControls('topXuat', { 
                dataLength: topXuatData.length, 
                zoomState: topXuatZoom, 
                setZoomState: setTopXuatZoom, 
                refAreaState: topXuatRefArea 
              })}
            </h3>
            
            {!collapsedCharts['topXuat'] && (
              <div className={`w-full ${fullscreenChart === 'topXuat' ? 'flex-1 h-[calc(100%-60px)] min-h-[300px]' : 'h-80 min-h-[300px]'}`}>
                {zoomTopXuatData.length > 0 && isMounted ? (
                  <SafeResponsiveContainer height={fullscreenChart === 'topXuat' ? 'calc(100% - 20px)' : 300} minHeight={250}>
                    <BarChart 
                      data={zoomTopXuatData} 
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      onMouseDown={(e) => handleChartMouseDown(e, (val) => setTopXuatRefArea(val))}
                      onMouseMove={(e) => handleChartMouseMove(e, topXuatRefArea, (val) => setTopXuatRefArea(val))}
                      onMouseUp={() => handleChartMouseUp(topXuatRefArea, (val) => setTopXuatRefArea(val), topXuatZoom, setTopXuatZoom, topXuatData.length)}
                    >
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                      <Bar dataKey="Số lượng xuất" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {zoomTopXuatData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                      {topXuatRefArea.left !== null && topXuatRefArea.right !== null && (
                        <ReferenceArea 
                          x1={zoomTopXuatData[Number(topXuatRefArea.left)]?.name} 
                          x2={zoomTopXuatData[Number(topXuatRefArea.right)]?.name} 
                          {...({ fill: '#3b82f6', fillOpacity: 0.15 } as any)}
                        />
                      )}
                    </BarChart>
                  </SafeResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    Chưa có dữ liệu xuất kho phát sinh trong kỳ lọc
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Biểu đồ 3: Chi Nhánh Lấy Hàng Nhiều Nhất (Bar Chart) */}
        {(!fullscreenChart || fullscreenChart === 'branch') && (
          <div className={`bento-card !p-5 bg-white border border-slate-100 rounded-2xl shadow-xs ${fullscreenChart === 'branch' ? 'fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col justify-between' : ''}`}>
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>Sản Lượng Xuất Theo Chi Nhánh</span>
                {branchExportZoom && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                    Đã thu phóng
                  </span>
                )}
              </div>
              {renderChartControls('branch', { 
                dataLength: branchData.length, 
                zoomState: branchExportZoom, 
                setZoomState: setBranchExportZoom, 
                refAreaState: branchExportRefArea 
              })}
            </h3>
            
            {!collapsedCharts['branch'] && (
              <div className={`w-full ${fullscreenChart === 'branch' ? 'flex-1 h-[calc(100%-60px)] min-h-[300px]' : 'h-80 min-h-[300px]'}`}>
                {zoomBranchData.length > 0 && isMounted ? (
                  <SafeResponsiveContainer height={fullscreenChart === 'branch' ? 'calc(100% - 20px)' : 300} minHeight={250}>
                    <BarChart 
                      data={zoomBranchData} 
                      layout="vertical" 
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      onMouseDown={(e) => handleChartMouseDown(e, (val) => setBranchExportRefArea(val))}
                      onMouseMove={(e) => handleChartMouseMove(e, branchExportRefArea, (val) => setBranchExportRefArea(val))}
                      onMouseUp={() => handleChartMouseUp(branchExportRefArea, (val) => setBranchExportRefArea(val), branchExportZoom, setBranchExportZoom, branchData.length)}
                    >
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={10} width={100} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }} />
                      <Bar dataKey="Số lượng xuất" fill="#f59e0b" radius={[0, 6, 6, 0]} maxBarSize={25} />
                      {branchExportRefArea.left !== null && branchExportRefArea.right !== null && (
                        <ReferenceArea 
                          y1={zoomBranchData[Number(branchExportRefArea.left)]?.name} 
                          y2={zoomBranchData[Number(branchExportRefArea.right)]?.name} 
                          {...({ fill: '#3b82f6', fillOpacity: 0.15 } as any)}
                        />
                      )}
                    </BarChart>
                  </SafeResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                    Chưa ghi nhận xuất kho tại các chi nhánh ngoại vi
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 3B. DASHBOARD PHÂN TÍCH ĐỘ BÁN CHẠY CHO KHO TRÒNG CHUYÊN SÂU */}
      {/* ========================================================================= */}
      <div className="space-y-6">
        
        {/* PANEL CHÍNH - HEATMAP SPH x CYL (ƯU TIÊN HIỂN THỊ) */}
        <div id="lens-diopter-dashboard" className="bento-card !p-6 bg-white border border-slate-100 rounded-2xl shadow-xs space-y-6">
          
          {/* Header Dashboard & Bộ lọc Loại Giao dịch chính */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Compass className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm uppercase tracking-wide">
                  Phân Tích Mật Độ Bán Chạy & Biểu Đồ Độ Kho Tròng
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Phân tích phân phối tần suất, tổ hợp độ tối ưu và mật độ luân chuyển kho
                </p>
              </div>
            </div>

            {/* Bộ chuyển đổi loại giao dịch phân tích */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Loại giao dịch:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setSalesDbTxType('XUẤT');
                    setSalesDbTopType('XUẤT');
                  }}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    salesDbTxType === 'XUẤT' 
                      ? 'bg-red-500 text-white shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Lượt Xuất (Bán Chạy)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSalesDbTxType('NHẬP');
                    setSalesDbTopType('NHẬP');
                  }}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    salesDbTxType === 'NHẬP' 
                      ? 'bg-emerald-500 text-white shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Lượt Nhập Kho
                </button>
              </div>
            </div>
          </div>

          {/* CHỦ ĐỀ CHÍNH: HEATMAP SPH x CYL MẬT ĐỘ HOẠT ĐỘNG */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                  <span className="w-1.5 h-3 bg-indigo-600 rounded-xs inline-block" />
                  Mật Độ Hoạt Động (Heatmap) Cận × Loạn
                </h4>
                <p className="text-[10px] text-slate-400">
                  Trục đứng: Cận (SPH) | Trục ngang: Loạn (CYL). Màu càng đậm biểu thị lượng giao dịch càng lớn.
                </p>
              </div>

              {/* Chú giải màu sắc */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50/50 rounded-xl border border-slate-150 shadow-3xs max-w-full">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mr-1">Thang 7 Mức Độ:</span>
                {heatmapLevelRanges.length > 0 ? (
                  heatmapLevelRanges.map(range => {
                    const style = getLevelStyle(range.level, salesDbTxType);
                    return (
                      <div key={range.level} className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] text-slate-600 font-mono shadow-3xs" title={`${style.name}: từ ${range.lower} đến ${range.upper} cái`}>
                        <span className="w-2.5 h-2.5 rounded-xs inline-block shadow-3xs" style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }} />
                        <span className="font-bold hidden sm:inline">{style.name}:</span>
                        <span>{range.label}</span>
                      </div>
                    );
                  })
                ) : (
                  <span className="text-[9px] text-slate-400 font-mono">Chưa có dữ liệu</span>
                )}
              </div>
            </div>

            {/* BỘ LỌC PHẠM VI ĐỘ CHO HEATMAP */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Bộ lọc phạm vi độ phân tích</span>
                <div className="flex gap-3 text-[9px] font-extrabold text-indigo-600">
                  <button
                    type="button"
                    onClick={() => {
                      setSphFilterFrom(0.00);
                      setSphFilterTo(-5.00);
                      setCylFilterFrom(0.00);
                      setCylFilterTo(-2.00);
                    }}
                    className="hover:underline cursor-pointer"
                  >
                    Mẫu: Cận 0.00 đến -5.00 | Loạn 0.00 đến -2.00
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSphFilterFrom(0.00);
                      setSphFilterTo(-15.00);
                      setCylFilterFrom(0.00);
                      setCylFilterTo(-6.00);
                    }}
                    className="text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Hiện toàn bộ
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Cận từ (SPH)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={sphFilterFrom}
                    onChange={(e) => setSphFilterFrom(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Cận đến (SPH)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={sphFilterTo}
                    onChange={(e) => setSphFilterTo(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Loạn từ (CYL)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={cylFilterFrom}
                    onChange={(e) => setCylFilterFrom(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Loạn đến (CYL)</label>
                  <input
                    type="number"
                    step="0.25"
                    value={cylFilterTo}
                    onChange={(e) => setCylFilterTo(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-mono font-bold focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Bên trái: Bảng Heatmap Matrix */}
              <div className="xl:col-span-2 space-y-2">
                <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[460px] overflow-y-auto shadow-2xs bg-slate-50/10">
                  <table className="min-w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-20 shadow-3xs">
                      <tr>
                        <th className="p-2.5 font-bold text-slate-500 border border-slate-200 sticky left-0 bg-slate-100 z-30 min-w-[85px] text-center shadow-3xs">
                          Cận \ Loạn
                        </th>
                        {heatmapCylValues.map(cyl => (
                          <th key={cyl} className="p-2.5 font-bold text-slate-500 border border-slate-200 text-center min-w-[65px] font-mono">
                            {formatDopValue(cyl)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapSphValues.length > 0 ? (
                        heatmapSphValues.map(sph => (
                          <tr key={sph} className="hover:bg-slate-50/40">
                            <td className="p-2.5 font-bold text-slate-700 border border-slate-150 sticky left-0 bg-white z-10 text-center shadow-3xs font-mono">
                              {formatDopValue(sph)}
                            </td>
                            {heatmapCylValues.map(cyl => {
                              const key = `${sph}_${cyl}`;
                              const cell = heatmapData.grid[key];
                              const val = cell ? (salesDbTxType === 'XUẤT' ? cell.x_qty : cell.n_qty) : 0;
                              const maxVal = heatmapData.maxQtyVal;
                              
                              const isSelected = selectedHeatmapCell?.sph === sph && selectedHeatmapCell?.cyl === cyl;
                              const isHighest = val > 0 && val === maxVal;
                              const cellLevel = getHeatmapLevel(val, maxVal);
                              const style = getLevelStyle(cellLevel, salesDbTxType);

                              return (
                                <td 
                                  key={cyl} 
                                  onClick={() => setSelectedHeatmapCell({ sph, cyl })}
                                  style={val > 0 ? { backgroundColor: style.bg, color: style.text, borderColor: style.border } : {}}
                                  className={`p-2.5 border border-slate-150 text-center font-bold font-mono cursor-pointer transition-all duration-150 hover:scale-[1.1] hover:shadow-md hover:z-25 group relative ${
                                    val === 0 ? 'text-slate-300 bg-white' : ''
                                  } ${
                                    isSelected ? 'ring-2 ring-indigo-600 ring-offset-1 z-10' : ''
                                  } ${
                                    isHighest ? 'ring-2 ring-amber-500 ring-offset-1 z-10' : ''
                                  }`}
                                  title={`Cận: ${formatDopValue(sph)} | Loạn: ${formatDopValue(cyl)} => ${val} cái`}
                                >
                                  {val > 0 ? (
                                    <>
                                      <span>{val}</span>
                                      {isHighest && <span className="absolute top-0.5 right-0.5 text-[8px]" title="Bán chạy nhất!">👑</span>}
                                      
                                      {/* Custom Tooltip on Hover */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none">
                                        <div className="bg-slate-900/95 text-white text-[10px] px-2.5 py-2 rounded-lg shadow-xl whitespace-nowrap text-left border border-slate-700 font-sans space-y-1">
                                          <div>Cận (SPH): <span className="font-mono font-bold text-sky-300">{formatDopValue(sph)}</span></div>
                                          <div>Loạn (CYL): <span className="font-mono font-bold text-sky-300">{formatDopValue(cyl)}</span></div>
                                          <div>Số lượng: <span className="font-mono font-extrabold text-amber-400">{val}</span> cái</div>
                                          {isHighest && <div className="text-[9px] font-bold text-yellow-400 flex items-center gap-0.5">⭐ Cao nhất hiện tại</div>}
                                        </div>
                                        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 mx-auto" />
                                      </div>
                                    </>
                                  ) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={heatmapCylValues.length + 1} className="p-12 text-center text-slate-400 font-mono italic">
                            Không có tổ hợp độ cận/loạn nào nằm trong phạm vi đã chọn
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>* Mẹo: Cuộn ngang/dọc để xem trọn bảng. Click vào ô bất kỳ để xem phân tích chi tiết.</span>
                  <span>Tổng hiển thị: {heatmapSphValues.length} Cận × {heatmapCylValues.length} Loạn (Ma trận gốc: {uniqueSphValues.length} × {uniqueCylValues.length})</span>
                </div>
              </div>

              {/* Bên phải: Drawer/Panel chi tiết ô được click */}
              <div className="xl:col-span-1 bg-slate-50/70 border border-slate-150 rounded-xl p-4 flex flex-col justify-between space-y-4 shadow-3xs">
                {selectedCellDetails ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Activity className="w-4 h-4 animate-pulse" />
                        </span>
                        <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                          Chi Tiết Tổ Hợp Độ
                        </h5>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setSelectedHeatmapCell(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-all cursor-pointer"
                        title="Đóng chi tiết"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* SPH x CYL Indicator */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-3xs">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Cận (SPH)</p>
                        <p className="text-sm font-black text-slate-800 font-mono">
                          {formatDopValue(selectedCellDetails.sph)}
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-3xs">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Loạn (CYL)</p>
                        <p className="text-sm font-black text-slate-800 font-mono">
                          {formatDopValue(selectedCellDetails.cyl)}
                        </p>
                      </div>
                    </div>

                    {/* Summary statistics inside block */}
                    <div className="bg-white rounded-xl border border-slate-100 p-3 space-y-2 text-xs shadow-3xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tồn kho hiện tại:</span>
                        <span className="font-bold text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded">
                          {selectedCellDetails.currentStock} cái
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tổng xuất trong kỳ:</span>
                        <span className="font-bold text-red-600 font-mono bg-red-50 px-2 py-0.5 rounded">
                          {selectedCellDetails.totalXuat} cái
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Tổng nhập trong kỳ:</span>
                        <span className="font-bold text-emerald-600 font-mono bg-emerald-50 px-2 py-0.5 rounded">
                          {selectedCellDetails.totalNhap} cái
                        </span>
                      </div>
                    </div>

                    {/* Related SKUs List */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">
                        Danh sách SKU liên quan ({selectedCellDetails.skus.length})
                      </p>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedCellDetails.skus.length > 0 ? (
                          selectedCellDetails.skus.map(skuItem => {
                            const isLowStock = skuItem.stock <= skuItem.minStock;
                            return (
                              <div key={skuItem.sku} className="p-2.5 bg-white border border-slate-100 rounded-lg hover:border-slate-300 transition-colors space-y-1.5 shadow-3xs">
                                <div className="flex items-start justify-between gap-1.5">
                                  <p className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]" title={skuItem.sku}>
                                    {skuItem.sku}
                                  </p>
                                  {isLowStock && (
                                    <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                                      Sắp Hết
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                                  <span>Tồn: <strong className={isLowStock ? 'text-red-500 font-bold' : 'text-slate-600 font-bold'}>{skuItem.stock}</strong></span>
                                  <span>T.Hiệu: <strong className="text-slate-600">{skuItem.brand}</strong></span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-6 text-[10px] text-slate-400 italic">
                            Không tìm thấy SKU nào trong kho có độ này
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
                    <div className="p-4 bg-indigo-50/50 text-indigo-500 rounded-full">
                      <Compass className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Chưa Chọn Độ Phân Tích</p>
                      <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mt-1">
                        Vui lòng nhấp chuột vào một ô vuông bất kỳ trên bảng heatmap ở bên trái để xem tồn kho trực tiếp và danh sách chi tiết SKU liên quan.
                      </p>
                    </div>
                  </div>
                )}

                {/* Footer Quick Info */}
                {selectedCellDetails && selectedCellDetails.skus.length > 0 && onQuickRestock && (
                  <button
                    type="button"
                    onClick={() => onQuickRestock(selectedCellDetails.skus[0].sku)}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ListPlus className="w-4 h-4" />
                    Tạo nhanh phiếu nhập tròng này
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>

        {/* PHÂN VÙNG HAI CỘT DƯỚI: BIỂU ĐỒ CỘT PHÂN TÍCH & TOP TỔ HỢP BÁN CHẠY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* 1. BIỂU ĐỒ CỘT PHÂN TÍCH THEO SPH HOẶC CYL */}
          {(!fullscreenChart || fullscreenChart === 'salesBar') && (
            <div className={`bento-card !p-5 bg-white border border-slate-100 rounded-2xl shadow-xs flex flex-col justify-between space-y-5 ${fullscreenChart === 'salesBar' ? 'fixed inset-4 z-50 bg-white/95 backdrop-blur-md shadow-2xl flex flex-col justify-between' : ''}`}>
              
              {/* Header Column 1 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                    <BarChart2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
                        Biểu Đồ Phân Tích Chuyển Đổi Độ
                      </h4>
                      {salesDbBarZoom && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                          Đã thu phóng
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">Xem phân phối lượng giao dịch theo lát cắt cụ thể</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Selector Mode SPH hoặc CYL */}
                  <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
                    <button
                      type="button"
                      onClick={() => setSalesDbBarMode('SPH_TO_CYL')}
                      className={`text-[9px] uppercase font-black px-2 py-1.5 rounded-md transition-all cursor-pointer ${
                        salesDbBarMode === 'SPH_TO_CYL' 
                          ? 'bg-blue-600 text-white shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Cận → Loạn
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesDbBarMode('CYL_TO_SPH')}
                      className={`text-[9px] uppercase font-black px-2 py-1.5 rounded-md transition-all cursor-pointer ${
                        salesDbBarMode === 'CYL_TO_SPH' 
                          ? 'bg-blue-600 text-white shadow-3xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Loạn → Cận
                    </button>
                  </div>

                  {renderChartControls('salesBar', {
                    dataLength: salesBarChartData.sortedData.length,
                    zoomState: salesDbBarZoom,
                    setZoomState: setSalesDbBarZoom,
                    refAreaState: salesDbBarRefArea
                  })}
                </div>
              </div>

              {!collapsedCharts['salesBar'] && (
                <>
                  {/* Điều khiển giá trị cụ thể */}
                  <div className="flex items-center gap-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Giá trị lọc:</span>
                    {salesDbBarMode === 'SPH_TO_CYL' ? (
                      <div className="flex items-center gap-2 w-full">
                        <select
                          value={salesDbSelectedSph}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSalesDbSelectedSph(val === 'ALL' ? 'ALL' : parseFloat(val));
                          }}
                          className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer w-full font-mono shadow-3xs"
                        >
                          <option value="ALL">-- Tất cả độ Cận (SPH) --</option>
                          {uniqueSphValues.map(v => (
                            <option key={v} value={v}>Cận: {formatDopValue(v)}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full">
                        <select
                          value={salesDbSelectedCyl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSalesDbSelectedCyl(val === 'ALL' ? 'ALL' : parseFloat(val));
                          }}
                          className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer w-full font-mono shadow-3xs"
                        >
                          <option value="ALL">-- Tất cả độ Loạn (CYL) --</option>
                          {uniqueCylValues.map(v => (
                            <option key={v} value={v}>Loạn: {formatDopValue(v)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Thống kê Tổng lượng và Top bán chạy */}
                  <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shadow-3xs">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">Tổng Giao Dịch</p>
                      <p className="text-xs font-extrabold text-slate-800 font-mono mt-0.5">{salesBarChartData.totalQty} cái</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shadow-3xs col-span-2">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase">Độ Chiếm Tỉ Trọng Cao Nhất (Top)</p>
                      <p className="text-xs font-extrabold text-indigo-600 font-mono mt-0.5 truncate">
                        {salesBarChartData.topValue !== 'N/A' 
                          ? `${salesBarChartData.topValue} (${salesBarChartData.topQty} cái | ${salesBarChartData.topPercentage}%)`
                          : 'Không có dữ liệu'}
                      </p>
                    </div>
                  </div>

                  {/* Rendering Bar Chart */}
                  <div className={`w-full ${fullscreenChart === 'salesBar' ? 'flex-1 h-[calc(100%-180px)] min-h-[300px]' : 'h-80 min-h-[300px]'}`}>
                    {zoomSalesDbBarData.length > 0 && isMounted ? (
                      <SafeResponsiveContainer height={fullscreenChart === 'salesBar' ? 'calc(100% - 20px)' : 300} minHeight={250}>
                        <BarChart 
                          data={zoomSalesDbBarData} 
                          margin={{ top: 15, right: 10, left: -25, bottom: 10 }}
                          onMouseDown={(e) => handleChartMouseDown(e, (val) => setSalesDbBarRefArea(val))}
                          onMouseMove={(e) => handleChartMouseMove(e, salesDbBarRefArea, (val) => setSalesDbBarRefArea(val))}
                          onMouseUp={() => handleChartMouseUp(salesDbBarRefArea, (val) => setSalesDbBarRefArea(val), salesDbBarZoom, setSalesDbBarZoom, salesBarChartData.sortedData.length)}
                        >
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            fontFamily="JetBrains Mono"
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            fontFamily="JetBrains Mono"
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: 8, border: '1px solid #f1f5f9', fontSize: 11 }}
                            formatter={(value, name, props: any) => [`${value} cái (${props.payload.percentage}%)`, 'Lượng giao dịch']}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={35}>
                            {zoomSalesDbBarData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                          {salesDbBarRefArea.left !== null && salesDbBarRefArea.right !== null && (
                            <ReferenceArea 
                              x1={zoomSalesDbBarData[Number(salesDbBarRefArea.left)]?.name} 
                              x2={zoomSalesDbBarData[Number(salesDbBarRefArea.right)]?.name} 
                              {...({ fill: '#3b82f6', fillOpacity: 0.15 } as any)}
                            />
                          )}
                        </BarChart>
                      </SafeResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono italic bg-slate-50/50 rounded-xl border border-dashed border-slate-150">
                        Không tìm thấy lượng giao dịch tương ứng với điều kiện lọc
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          )}

          {/* 2. TOP TỔ HỢP ĐỘ BÁN CHẠY / NHẬP KHO NHIỀU NHẤT */}
          <div className="bento-card !p-5 bg-white border border-slate-100 rounded-2xl shadow-xs flex flex-col justify-between space-y-4">
            
            {/* Header Column 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Xếp Hạng Tổ Hợp Độ Luân Chuyển
                  </h4>
                  <p className="text-[10px] text-slate-400">Các cụm SPH + CYL ghi nhận sản lượng luân chuyển cao nhất</p>
                </div>
              </div>

              {/* Controls limit: Top 10, 20, 50 */}
              <div className="flex items-center gap-1">
                {([10, 20, 50] as const).map(lim => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => setSalesDbTopLimit(lim)}
                    className={`px-2.5 py-1 text-[9px] font-black rounded-md border transition-all cursor-pointer ${
                      salesDbTopLimit === lim 
                        ? 'bg-slate-800 border-slate-800 text-white shadow-3xs' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Top {lim}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Toggle Xuất/Nhập cho bảng xếp hạng */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-xl text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Dữ liệu xếp hạng:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSalesDbTopType('XUẤT')}
                  className={`text-[9px] font-bold px-2 py-1 rounded cursor-pointer transition-colors ${
                    salesDbTopType === 'XUẤT' ? 'bg-red-50 text-red-600 font-extrabold' : 'text-slate-500'
                  }`}
                >
                  Theo Xuất Kho (Bán chạy)
                </button>
                <span className="text-slate-250">|</span>
                <button
                  type="button"
                  onClick={() => setSalesDbTopType('NHẬP')}
                  className={`text-[9px] font-bold px-2 py-1 rounded cursor-pointer transition-colors ${
                    salesDbTopType === 'NHẬP' ? 'bg-emerald-50 text-emerald-600 font-extrabold' : 'text-slate-500'
                  }`}
                >
                  Theo Nhập Kho
                </button>
              </div>
            </div>

            {/* List ranking render */}
            <div className="space-y-3.5 max-h-[295px] overflow-y-auto pr-1">
              {topCombinationsData.length > 0 ? (
                topCombinationsData.map((item, idx) => {
                  const barColor = salesDbTopType === 'XUẤT' ? 'bg-red-500' : 'bg-emerald-500';
                  return (
                    <div 
                      key={`${item.sph}_${item.cyl}`} 
                      className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50/50 transition-all cursor-pointer"
                      onClick={() => setSelectedHeatmapCell({ sph: item.sph, cyl: item.cyl })}
                      title="Xem chi tiết tổ hợp này trên Heatmap"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Rank badge */}
                          <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black shrink-0 ${
                            idx === 0 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-slate-700 font-mono font-bold truncate">
                            SPH <strong className="text-slate-900">{formatDopValue(item.sph)}</strong> | CYL <strong className="text-slate-900">{formatDopValue(item.cyl)}</strong>
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-slate-800 font-bold">{item.qty} cái</span>
                        </div>
                      </div>
                      
                      {/* Progress bar representing ratio of top max quantity */}
                      <div className="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} 
                          style={{ width: `${item.percentageOfMax}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-slate-400 font-mono italic">
                  Không ghi nhận tổ hợp nào phù hợp với bộ lọc trong kỳ
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* 4. CHIA HAI PHÂN VÙNG: SẮP HẾT HÀNG & CHỨC NĂNG XUẤT BÁO CÁO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DANH SÁCH SẮP HẾT HÀNG (2/3 Cột) */}
        <div className="bento-card !p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 w-full flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                Sản Phẩm Đang Cận Ngưỡng Tối Thiểu ({criticalProducts.length})
              </span>
              <span className="text-[10px] font-mono px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-bold">
                Khẩn cấp
              </span>
            </h3>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 pr-1">
            {criticalProducts.length > 0 ? (
              criticalProducts.map(p => {
                const ratio = p.TON_CUOI / p.TON_TOI_THIEU;
                let barColor = 'bg-red-500';
                if (ratio > 0.5) barColor = 'bg-amber-500';

                return (
                  <div key={p.SKU} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/40 px-2 rounded-xl transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{p.SKU}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${barColor}`} 
                          style={{ width: `${Math.min(ratio * 100, 100)}%` }} 
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-red-600">{p.TON_CUOI} {p.DVT}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Tối thiểu: {p.TON_TOI_THIEU}</p>
                      </div>
                      {onQuickRestock && (
                        <button
                          onClick={() => onQuickRestock(p.SKU)}
                          className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-3xs"
                          title="Lập phiếu nhập nhanh cho sản phẩm này"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Nhập</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-mono">
                Tuyệt vời! Toàn bộ sản phẩm đều ở trạng thái an toàn trên ngưỡng tồn kho tối thiểu.
              </div>
            )}
          </div>
        </div>

        {/* XUẤT BÁO CÁO DOANH THU & KHO (1/3 Cột) */}
        <div className="bento-card !p-5">
          <h3 className="font-sans font-bold text-slate-800 text-xs uppercase border-b border-slate-50 pb-2 mb-4">
            Kết Xuất Dữ Liệu
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Lựa chọn định dạng kết xuất dữ liệu báo cáo xuất nhập tồn tương thích trực tiếp với các phần mềm quản lý hoặc in ấn văn phòng.
          </p>
          
          <div className="space-y-3.5">
            <button
              onClick={() => handleExportData('EXCEL')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4.5 h-4.5" />
              {isExporting ? 'Đang trích xuất...' : 'Xuất Báo Cáo Excel (CSV)'}
            </button>

            <button
              onClick={() => handleExportData('PDF')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-4.5 h-4.5" />
              In Bản Báo Cáo PDF
            </button>
            
            <div className="border-t border-dashed border-slate-100 pt-4 text-center">
              <span className="text-[10px] font-mono text-slate-400 flex items-center justify-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Chu kỳ làm mới: Tức thì (Realtime)
              </span>
            </div>
          </div>
        </div>

      </div>
      </>
      )}

      {/* MODAL CẤU HÌNH XUẤT NÂNG CAO */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${exportModalType === 'EXCEL' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {exportModalType === 'EXCEL' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold uppercase text-slate-850 tracking-wider font-sans">Chi tiết Mẫu Kết Xuất {exportModalType}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Thay thế Placeholder trực quan theo cấu trúc file mẫu của bạn</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-755 text-xs">
              
              {/* PHÂN VÙNG 1: THÔNG TIN MẪU & VỊ TRÍ GHI & GROUP BY (BENTO GRID CỰC GỌN) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Cột trái: Cấu hình File & Dòng ghi */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cấu hình File & Dòng ghi</div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Mẫu báo cáo áp dụng</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => {
                          const tid = e.target.value;
                          setSelectedTemplateId(tid);
                          const matched = exportTemplates.find(t => t.id === tid);
                          if (matched) {
                            setExportStartRow(matched.startRow || 10);
                            setExportGroupByFields(matched.groupByFields || []);
                            setCurrentMappings(matched.columnMappings || []);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
                      >
                        {(exportModalType === 'PDF' ? exportTemplates : exportTemplates.filter(t => t.type === 'EXCEL'))
                          .map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name} {t.isDefault ? '(Mặc định)' : ''} {t.type !== exportModalType ? `(${t.type})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">File mẫu hiện tại</label>
                      <div className="bg-slate-100 border border-slate-200/60 px-2.5 py-1.5 rounded-lg text-slate-700 text-xs font-semibold truncate" title={exportTemplates.find(t => t.id === selectedTemplateId)?.fileName}>
                        {exportTemplates.find(t => t.id === selectedTemplateId)?.fileName || '(Preset hệ thống)'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Dòng bắt đầu ghi dữ liệu</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={exportStartRow}
                        onChange={e => setExportStartRow(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold font-mono text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Dữ liệu chi tiết/bảng sẽ tự động ghi đè hoặc chèn liên tiếp bắt đầu từ dòng này.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cột phải: Các trường gom nhóm */}
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-150 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Các trường gom nhóm (Group By)</span>
                    <select
                      value=""
                      onChange={(e) => {
                        handleAddGroupByField(e.target.value);
                        e.target.value = ''; // Reset select
                      }}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-indigo-700 cursor-pointer focus:outline-none shadow-3xs"
                    >
                      <option value="">+ Thêm trường...</option>
                      {[
                        { key: 'THUONG_HIEU', label: 'Thương hiệu' },
                        { key: 'CHIET_SUAT', label: 'Chiết suất' },
                        { key: 'TINH_NANG', label: 'Tính năng' },
                        { key: 'CHI_NHANH', label: 'Chi nhánh' },
                        { key: 'KHO', label: 'Kho' },
                        { key: 'CAN', label: 'Độ cận' },
                        { key: 'LOAN', label: 'Độ loạn' },
                        { key: 'VIEN', label: 'Độ viễn' },
                        { key: 'SKU', label: 'SKU' },
                        { key: 'TEN_NGUOI_TAO', label: 'Người tạo' },
                        { key: 'LOAI', label: 'Loại chứng từ' }
                      ]
                        .filter(opt => !exportGroupByFields.includes(opt.key))
                        .map(opt => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-white border border-slate-150 rounded-xl flex-1 min-h-[90px]">
                    {exportGroupByFields.length > 0 ? (
                      exportGroupByFields.map((fieldKey, index) => {
                        const optMap: Record<string, string> = {
                          THUONG_HIEU: 'Thương hiệu',
                          CHIET_SUAT: 'Chiết suất',
                          TINH_NANG: 'Tính năng',
                          CHI_NHANH: 'Chi nhánh',
                          KHO: 'Kho',
                          CAN: 'Độ cận',
                          LOAN: 'Độ loạn',
                          VIEN: 'Độ viễn',
                          SKU: 'SKU',
                          TEN_NGUOI_TAO: 'Người tạo',
                          LOAI: 'Loại chứng từ'
                        };
                        const label = optMap[fieldKey] || fieldKey;
                        return (
                          <div key={fieldKey} className="flex items-center justify-between bg-slate-50 px-2.5 py-1 border border-slate-150 rounded-lg text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 flex items-center justify-center bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-bold">
                                {index + 1}
                              </span>
                              <span className="font-bold text-slate-700">{label}</span>
                              <span className="text-[9px] font-mono text-slate-400">({fieldKey})</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveGroupByFieldUp(index)}
                                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer bg-transparent border-0"
                                title="Đẩy lên"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === exportGroupByFields.length - 1}
                                onClick={() => handleMoveGroupByFieldDown(index)}
                                className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer bg-transparent border-0"
                                title="Đẩy xuống"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroupByField(fieldKey)}
                                className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded bg-transparent border-0 cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-[10px] py-4">
                        Không gom nhóm (Báo cáo sẽ kết xuất chi tiết từng dòng)
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* PHÂN VÙNG 2: MAPPING CỘT DỮ LIỆU */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Cấu hình Mapping cột dữ liệu ({currentMappings.length} cột)</label>
                    <p className="text-[10px] text-slate-400">Thiết lập mối quan hệ giữa Placeholder trong file mẫu và các thuộc tính dữ liệu hệ thống</p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowAddColForm(!showAddColForm)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors border-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm cột mới
                  </button>
                </div>

                {/* FORM THÊM CỘT MỚI (COLLAPSIBLE FORM) */}
                {showAddColForm && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-xs animate-in fade-in duration-150">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-indigo-600" /> Thêm cột dữ liệu mới vào bảng báo cáo
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">Tên cột hiển thị</label>
                        <input
                          type="text"
                          value={newColLabel}
                          onChange={e => setNewColLabel(e.target.value)}
                          placeholder="VD: Thương hiệu"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">Mã cột / Placeholder</label>
                        <input
                          type="text"
                          value={newColExcel}
                          onChange={e => setNewColExcel(e.target.value)}
                          placeholder="VD: THUONG_HIEU"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500">Trường dữ liệu / Nguồn</label>
                        <select
                          value={newColField}
                          onChange={e => setNewColField(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer font-semibold text-slate-700"
                        >
                          <option value="">-- Chọn trường nguồn --</option>
                          <option value="THUONG_HIEU">THUONG_HIEU (Thương hiệu)</option>
                          <option value="CHIET_SUAT">CHIET_SUAT (Chiết suất)</option>
                          <option value="TINH_NANG">TINH_NANG (Tính năng)</option>
                          <option value="CHI_NHANH">CHI_NHANH (Chi nhánh)</option>
                          <option value="KHO">KHO (Kho hàng)</option>
                          <option value="CAN">CAN (Độ cận)</option>
                          <option value="LOAN">LOAN (Độ loạn)</option>
                          <option value="VIEN">VIEN (Độ viễn)</option>
                          <option value="SKU">SKU (Mã SKU)</option>
                          <option value="TEN_NGUOI_TAO">TEN_NGUOI_TAO (Người tạo)</option>
                          <option value="LOAI">LOAI (Loại chứng từ)</option>
                          <option value="SO_LUONG">SO_LUONG (Số lượng)</option>
                          <option value="DVT">DVT (Đơn vị tính)</option>
                          <option value="NGAY">NGAY (Ngày giao dịch)</option>
                          <option value="HOA_DON">HOA_DON (Mã phiếu / Số hóa đơn)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddColForm(false)}
                        className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs bg-white hover:bg-slate-50 cursor-pointer font-bold"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleAddNewColumnCustom}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer border-0"
                      >
                        Xác nhận Thêm
                      </button>
                    </div>
                  </div>
                )}

                <div className="border border-slate-150 rounded-2xl overflow-hidden bg-white shadow-3xs">
                  <div className="overflow-x-auto max-h-[250px]">
                    <table className="min-w-full text-xs text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-150">
                        <tr>
                          <th className="p-2 pl-4 w-12 text-center text-slate-500 font-bold">STT</th>
                          <th className="p-2 w-1/3 text-slate-500 font-bold">Tên cột hiển thị</th>
                          <th className="p-2 w-1/3 text-slate-500 font-bold">Mã cột / Placeholder (Copy)</th>
                          <th className="p-2 w-1/3 text-slate-500 font-bold">Trường dữ liệu / Nguồn</th>
                          <th className="p-2 text-center w-28 text-slate-500 font-bold">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentMappings.length > 0 ? (
                          currentMappings.map((m, index) => (
                            <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                              <td className="p-2 text-center font-mono font-bold text-slate-400">
                                {index + 1}
                              </td>
                              
                              {/* Edit Label */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={m.label || ''}
                                  onChange={(e) => {
                                    const next = [...currentMappings];
                                    next[index] = { ...next[index], label: e.target.value };
                                    setCurrentMappings(next);
                                  }}
                                  className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                  placeholder="Tên cột hiển thị"
                                />
                              </td>

                              {/* Pure Text Placeholder (No textbox, easy copy) */}
                              <td className="p-2 select-all cursor-pointer font-mono font-bold text-indigo-700 text-center" title="Bôi đen hoặc click đúp để copy">
                                <span className="inline-block bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100/50 hover:bg-indigo-100 transition-colors">
                                  {`{{${m.excelColumn}}}`}
                                </span>
                              </td>

                              {/* Edit Data Field */}
                              <td className="p-2">
                                <select
                                  value={m.dataField}
                                  onChange={(e) => {
                                    const next = [...currentMappings];
                                    next[index] = { ...next[index], dataField: e.target.value };
                                    setCurrentMappings(next);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                                >
                                  <option value="">-- Không ánh xạ --</option>
                                  <option value="THUONG_HIEU">THUONG_HIEU (Thương hiệu)</option>
                                  <option value="CHIET_SUAT">CHIET_SUAT (Chiết suất)</option>
                                  <option value="TINH_NANG">TINH_NANG (Tính năng)</option>
                                  <option value="CHI_NHANH">CHI_NHANH (Chi nhánh)</option>
                                  <option value="KHO">KHO (Kho hàng)</option>
                                  <option value="CAN">CAN (Độ cận)</option>
                                  <option value="LOAN">LOAN (Độ loạn)</option>
                                  <option value="VIEN">VIEN (Độ viễn)</option>
                                  <option value="SKU">SKU (Mã SKU)</option>
                                  <option value="TEN_NGUOI_TAO">TEN_NGUOI_TAO (Người tạo)</option>
                                  <option value="LOAI">LOAI (Loại chứng từ)</option>
                                  <option value="SO_LUONG">SO_LUONG (Số lượng)</option>
                                  <option value="DVT">DVT (Đơn vị tính)</option>
                                  <option value="NGAY">NGAY (Ngày giao dịch)</option>
                                  <option value="HOA_DON">HOA_DON (Mã phiếu / Số hóa đơn)</option>
                                </select>
                              </td>

                              {/* Action buttons */}
                              <td className="p-2 text-center">
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveColumnUp(index)}
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer bg-transparent border-0"
                                    title="Di chuyển lên"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === currentMappings.length - 1}
                                    onClick={() => handleMoveColumnDown(index)}
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer bg-transparent border-0"
                                    title="Di chuyển xuống"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveColumnByIndex(index)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded bg-transparent border-0 cursor-pointer transition-colors"
                                    title="Xóa cột"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                              Chưa có cấu hình cột nào. Hãy bấm "Thêm cột mới" để tự thiết kế cấu trúc báo cáo của bạn.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Hệ thống tự động đồng bộ và áp dụng cấu hình
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl font-bold transition-all cursor-pointer text-xs bg-transparent"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={executeExport}
                  disabled={isExporting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs text-xs disabled:opacity-50 border-0"
                >
                  <RefreshCw className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                  {isExporting ? 'Đang xuất...' : 'Bắt đầu kết xuất'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
