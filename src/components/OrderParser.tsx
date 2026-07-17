import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardCheck, 
  Copy, 
  Check, 
  Plus, 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  ChevronRight, 
  MessageSquare, 
  Sparkles,
  ShoppingBag,
  Info,
  Trash2,
  Printer,
  Download,
  Layers,
  Bookmark,
  Building2,
  CheckSquare,
  Square,
  ClipboardList,
  Eye,
  ArrowLeft,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Settings,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { SanPham } from '../types';
import { supabase } from '../supabaseClient';
import { generateSKUString, formatDop, formatSKUForDisplay, cleanSKU, getVietnamDateString, getVietnamDateTimeString } from '../data/mockData';
import { resolveEffectiveUserId } from '../supabaseSync';

const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const isLetterOrDigit = (char: string): boolean => {
  return /[\p{L}\p{N}]/u.test(char);
};

const containsWord = (text: string, word: string): boolean => {
  if (!text || !word) return false;
  const textUpper = text.toUpperCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
  const wordUpper = word.toUpperCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
  
  let index = textUpper.indexOf(wordUpper);
  while (index !== -1) {
    const charBefore = index > 0 ? textUpper[index - 1] : '';
    const charAfter = index + wordUpper.length < textUpper.length ? textUpper[index + wordUpper.length] : '';
    
    const isBeforeValid = !charBefore || !isLetterOrDigit(charBefore);
    const isAfterValid = !charAfter || !isLetterOrDigit(charAfter);
    
    if (isBeforeValid && isAfterValid) {
      return true;
    }
    
    index = textUpper.indexOf(wordUpper, index + 1);
  }
  return false;
};

// Helper to parse a token as a numeric diopter value
// Supports standard decimals, shorthand formats (e.g. -050 -> -0.50, -125 -> -1.25), and PL / PLANO
const parseDiopterValue = (token: string): number => {
  const tu = token.toUpperCase().trim();
  if (tu === 'PL' || tu === 'PLANO') {
    return 0.00;
  }

  const hasPlus = tu.startsWith('+');
  const hasMinus = tu.startsWith('-');
  const cleanNumStr = (hasPlus || hasMinus) ? tu.substring(1) : tu;

  let numericVal = 0;
  // If it is a 3 or 4-digit integer (e.g. 050, 075, 125, 200, 1000)
  if (/^\d{3,4}$/.test(cleanNumStr)) {
    numericVal = parseFloat(cleanNumStr) / 100;
  } else {
    numericVal = parseFloat(cleanNumStr);
  }

  if (isNaN(numericVal)) return 0;

  if (hasPlus) {
    return numericVal;
  } else {
    // defaults to negative if hasMinus or unsigned
    return -numericVal;
  }
};

const getSphCylScore = (val: number): number => {
  if (val === 0) return 0;
  if (val < 0) return Math.abs(val);
  return 1000 + val;
};

const compareFields = (a: any, b: any, fieldKey: string) => {
  switch (fieldKey) {
    case 'brand': {
      const valA = a.brand || '';
      const valB = b.brand || '';
      return valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
    }
    case 'chietXuat': {
      const valA = parseFloat(a.chietXuat) || 0;
      const valB = parseFloat(b.chietXuat) || 0;
      return valA - valB;
    }
    case 'tinhNang': {
      const valA = a.tinhNang || '';
      const valB = b.tinhNang || '';
      return valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
    }
    case 'cyl': {
      const valA = parseFloat(a.cyl) || 0;
      const valB = parseFloat(b.cyl) || 0;
      return getSphCylScore(valA) - getSphCylScore(valB);
    }
    case 'sph': {
      const valA = parseFloat(a.sph) || 0;
      const valB = parseFloat(b.sph) || 0;
      return getSphCylScore(valA) - getSphCylScore(valB);
    }
    case 'add': {
      const valA = parseFloat(a.add || a.ADD) || 0;
      const valB = parseFloat(b.add || b.ADD) || 0;
      return valA - valB;
    }
    case 'sku': {
      const valA = a.sku || '';
      const valB = b.sku || '';
      return valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
    }
    default:
      return 0;
  }
};

interface OrderParserProps {
  sanPhams: SanPham[];
  brandList: any[]; // b_thuonghieu list
  onCreateXuatPhieu: (items: { sku: string; soLuong: number; }[], gomDonId?: string) => void;
  chiNhanhs?: string[];
  onTriggerToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
  currentUser?: any;
  onSaveMultipleTransactions?: (transactions: { header: any; details: any[] }[]) => Promise<string[]>;
  onNavigateToHistory?: () => void;
}

interface ParsedItem {
  id: string;
  rawLine: string;
  brand: string;
  chietXuat: string;
  tinhNang: string;
  sph: number;
  cyl: number;
  quantity: number;
  unit: string;
  sku: string;
  matchedProduct: SanPham | null;
  error?: string;
  selected?: boolean;
  exportQuantity?: number;
}

export default function OrderParser({ 
  sanPhams, 
  brandList, 
  onCreateXuatPhieu,
  chiNhanhs = [],
  onTriggerToast,
  currentUser,
  onSaveMultipleTransactions,
  onNavigateToHistory
}: OrderParserProps) {
  // Sub-tab: ANALYZE (New analysis & temporary order creation) or TEMP_ORDERS (List of temporary cards & batch picking)
  const [parserViewTab, setParserViewTab] = useState<'ANALYZE' | 'TEMP_ORDERS'>('ANALYZE');

  const [message, setMessage] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedDeficient, setCopiedDeficient] = useState<boolean>(false);

  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // NEW STATES FOR BATCH PICKING
  const [selectedOrderBranch, setSelectedOrderBranch] = useState<string>(() => {
    return chiNhanhs && chiNhanhs.length > 0 ? chiNhanhs[0] : 'Chi nhánh chính';
  });

  const [tempOrders, setTempOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('BATCH_PICKING_TEMP_ORDERS');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedTempOrderIds, setSelectedTempOrderIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'single' | 'all' | 'selected';
    id?: string;
    message: string;
  } | null>(null);
  const [isBatchPickingActive, setIsBatchPickingActive] = useState<boolean>(false);
  const [pickedItemsState, setPickedItemsState] = useState<Record<string, boolean>>({});
  
  // States for Step Wizard & Mobile Picking UI
  const [pickingStep, setPickingStep] = useState<number>(1);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [orderExportModes, setOrderExportModes] = useState<Record<string, 'FULL' | 'PARTIAL' | 'CANCEL'>>({});
  
  const [exportError, setExportError] = useState<string[] | null>(null);
  const [isSortingConfigOpen, setIsSortingConfigOpen] = useState<boolean>(false);
  const [sortingPriority, setSortingPriority] = useState<string[]>(() => {
    const userPrefix = currentUser?.username || 'default';
    const saved = localStorage.getItem(`batch_sorting_priority_${userPrefix}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return ['brand', 'chietXuat', 'tinhNang', 'cyl', 'sph', 'add', 'sku'];
  });

  useEffect(() => {
    const userPrefix = currentUser?.username || 'default';
    localStorage.setItem(`batch_sorting_priority_${userPrefix}`, JSON.stringify(sortingPriority));
  }, [sortingPriority, currentUser]);

  const movePriorityField = (index: number, direction: 'UP' | 'DOWN') => {
    const nextList = [...sortingPriority];
    if (direction === 'UP' && index > 0) {
      const temp = nextList[index];
      nextList[index] = nextList[index - 1];
      nextList[index - 1] = temp;
    } else if (direction === 'DOWN' && index < nextList.length - 1) {
      const temp = nextList[index];
      nextList[index] = nextList[index + 1];
      nextList[index + 1] = temp;
    }
    setSortingPriority(nextList);
  };

  // Sync temp orders to localStorage
  useEffect(() => {
    localStorage.setItem('BATCH_PICKING_TEMP_ORDERS', JSON.stringify(tempOrders));
  }, [tempOrders]);

  // Tải đơn hàng tạm từ Supabase khi khởi chạy hoặc chuyển đổi người dùng
  useEffect(() => {
    const fetchTempOrdersFromSupabase = async () => {
      try {
        const userId = await resolveEffectiveUserId();
        
        // Tải b_gomdon
        const { data: headers, error: headerErr } = await supabase
          .from('b_gomdon')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (headerErr) {
          console.warn('Không thể tải b_gomdon từ Supabase:', headerErr);
          return;
        }

        if (!headers || headers.length === 0) {
          return;
        }

        // Tải b_gomdonct
        const { data: details, error: detailErr } = await supabase
          .from('b_gomdonct')
          .select('*')
          .eq('user_id', userId);

        if (detailErr) {
          console.warn('Không thể tải b_gomdonct từ Supabase:', detailErr);
          return;
        }

        // Ánh xạ dữ liệu
        const mappedOrders = headers.map(h => {
          const orderDetails = (details || [])
            .filter(d => d.gom_don_id === h.id)
            .map(d => ({
              id: d.id,
              rawLine: d.raw_line,
              brand: d.brand,
              chietXuat: d.chiet_xuat,
              tinhNang: d.tinh_nang,
              sph: Number(d.sph),
              cyl: Number(d.cyl),
              quantity: Number(d.quantity),
              unit: d.unit,
              sku: d.sku,
              error: d.error || undefined
            }));

          return {
            id: h.id,
            branch: h.branch,
            originalText: h.original_text,
            createdAt: h.created_at ? new Date(h.created_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN'),
            trangThai: h.trang_thai,
            soPhieuXuat: h.so_phieu_xuat,
            items: orderDetails
          };
        });

        setTempOrders(mappedOrders);
        localStorage.setItem('BATCH_PICKING_TEMP_ORDERS', JSON.stringify(mappedOrders));
      } catch (err) {
        console.error('Lỗi khi tải đơn hàng tạm từ Supabase:', err);
      }
    };

    fetchTempOrdersFromSupabase();
  }, [currentUser]);

  // Set default branch when chiNhanhs loaded
  useEffect(() => {
    if (chiNhanhs && chiNhanhs.length > 0 && !selectedOrderBranch) {
      setSelectedOrderBranch(chiNhanhs[0]);
    }
  }, [chiNhanhs]);

  // Pre-build exact Profiles of Brands from brandList and sanPhams for smart lookup and deduction
  const brandProfiles = useMemo(() => {
    const profiles: Record<string, {
      name: string;
      defaultChietXuat: string;
      defaultFeature: string;
      allChietXuats: string[];
      allFeatures: string[];
    }> = {};

    // 1. Gather from brandList
    brandList.forEach(b => {
      const bName = (b.THUONG_HIEU || '').trim();
      if (!bName) return;
      const bUpper = bName.toUpperCase();
      
      if (!profiles[bUpper]) {
        profiles[bUpper] = {
          name: bName,
          defaultChietXuat: '',
          defaultFeature: '',
          allChietXuats: [],
          allFeatures: []
        };
      }

      const profile = profiles[bUpper];

      if (b.CHIET_XUAT_MAC_DINH) {
        const cxs = b.CHIET_XUAT_MAC_DINH.split(',').map((s: string) => s.trim());
        if (cxs.length > 0 && !profile.defaultChietXuat) {
          profile.defaultChietXuat = cxs[0];
        }
        cxs.forEach((cx: string) => {
          if (cx && !profile.allChietXuats.includes(cx)) {
            profile.allChietXuats.push(cx);
          }
        });
      }

      const feat = b.TINH_NANG_MAC_DINH || b.TINH_NANG || '';
      if (feat) {
        const featUpper = feat.toUpperCase();
        let normFeat = feat;
        if (['ĐM', 'ĐỔI MÀU', 'DOI MAU'].includes(featUpper)) {
          normFeat = 'ĐM';
        } else if (['ASX', 'ASG', 'BLUE', 'BLUE CUT'].includes(featUpper)) {
          normFeat = 'ASX';
        }
        
        if (!profile.defaultFeature) {
          profile.defaultFeature = normFeat;
        }
        if (!profile.allFeatures.includes(normFeat)) {
          profile.allFeatures.push(normFeat);
        }
      }
    });

    // 2. Complement/enrich from sanPhams
    sanPhams.forEach(p => {
      const bName = (p.THUONG_HIEU || '').trim();
      if (!bName) return;
      const bUpper = bName.toUpperCase();

      if (!profiles[bUpper]) {
        profiles[bUpper] = {
          name: bName,
          defaultChietXuat: '',
          defaultFeature: '',
          allChietXuats: [],
          allFeatures: []
        };
      }

      const profile = profiles[bUpper];

      const cx = (p.CHIET_XUAT || '').trim();
      if (cx && !profile.allChietXuats.includes(cx)) {
        profile.allChietXuats.push(cx);
      }

      const feat = (p.TINH_NANG || '').trim();
      if (feat) {
        const featUpper = feat.toUpperCase();
        let normFeat = feat;
        if (['ĐM', 'ĐỔI MÀU', 'DOI MAU'].includes(featUpper)) {
          normFeat = 'ĐM';
        } else if (['ASX', 'ASG', 'BLUE', 'BLUE CUT'].includes(featUpper)) {
          normFeat = 'ASX';
        }

        if (!profile.allFeatures.includes(normFeat)) {
          profile.allFeatures.push(normFeat);
        }
      }
    });

    // 3. Auto-determine defaults if only one option exists
    Object.keys(profiles).forEach(key => {
      const p = profiles[key];
      if (p.allChietXuats.length === 1 && !p.defaultChietXuat) {
        p.defaultChietXuat = p.allChietXuats[0];
      }
      if (p.allFeatures.length === 1 && !p.defaultFeature) {
        p.defaultFeature = p.allFeatures[0];
      }
    });

    return profiles;
  }, [brandList, sanPhams]);

  // Helper to normalize chiet xuat shorthand (e.g. 156 -> 1.56)
  const normalizeChietXuat = (val: string): string => {
    const cleaned = val.trim();
    if (cleaned === '156') return '1.56';
    if (cleaned === '160') return '1.60';
    if (cleaned === '161') return '1.61';
    if (cleaned === '167') return '1.67';
    if (cleaned === '174') return '1.74';
    return cleaned;
  };

  // Preprocessor helpers for multi-line blocks with shared diopter lists
  const isDiopterToken = (t: string): boolean => {
    const tu = t.toUpperCase().trim();
    if (tu === 'PL' || tu === 'PLANO') return true;
    if (tu === '0' || tu === '0.00' || tu === '-0.00' || tu === '+0.00') return true;
    if (/^[+-]\d+(\.\d+)?$/.test(tu)) return true;
    if (/^[+-]\d{3,4}$/.test(tu)) return true;
    if (/^\d{3,4}$/.test(tu)) {
      const val = parseInt(tu);
      if ([156, 160, 161, 167, 174].includes(val)) return false;
      return true;
    }
    if (/^\d+\.\d+$/.test(tu)) {
      const val = parseFloat(tu);
      if ([1.56, 1.60, 1.61, 1.67, 1.74].includes(val)) return false;
      return true;
    }
    if (/^\d+$/.test(tu)) {
      const val = parseInt(tu);
      if (val > 0 && val <= 25) {
        return true;
      }
    }
    return false;
  };

  const getLineTokens = (line: string): string[] => {
    const processed = line.toUpperCase()
      .replace(/(\d+),(\d+)/g, '$1.$2')
      .replace(/([+-])\s+(\d+)/g, '$1$2')
      .replace(/[,;]/g, ' ')
      .replace(/(\d+)\s*(M|C|CẶP|CAP|MIẾNG|MIENG|X|V|PCS)(?=\s|$)/gi, '$1$2')
      .replace(/(\d)([-+])(\d)/g, '$1 $2$3');
    return processed.split(/\s+/).filter(Boolean);
  };

  const isQuantitySpecifierLine = (line: string): { quantity: number; unit: string; raw: string } | null => {
    const norm = line.toLowerCase().trim();
    const p1 = /(?:mỗi độ|moi do|mỗi|moi|each)\s+(\d+)\s*(m|c|cặp|cap|miếng|mieng|pcs|c|x|v)?/i;
    const p2 = /(\d+)\s*(m|c|cặp|cap|miếng|mieng|pcs|c|x|v)?\s*(?:mỗi độ|moi do|mỗi|moi|each|\/độ|\/do|\/ độ|\/ do)/i;
    
    let match = norm.match(p1);
    if (!match) {
      match = norm.match(p2);
    }
    
    if (match) {
      const qty = parseInt(match[1], 10);
      const suffix = (match[2] || 'miếng').toUpperCase();
      let finalQty = qty;
      let unit = 'miếng';
      if (suffix === 'C' || suffix === 'CẶP' || suffix === 'CAP') {
        finalQty = qty * 2;
      }
      return { quantity: finalQty, unit, raw: match[0] };
    }
    return null;
  };

  const findWordIndexHelper = (textUpper: string, wordUpper: string): number => {
    let index = textUpper.indexOf(wordUpper);
    while (index !== -1) {
      const charBefore = index > 0 ? textUpper[index - 1] : '';
      const charAfter = index + wordUpper.length < textUpper.length ? textUpper[index + wordUpper.length] : '';
      
      const isBeforeValid = !charBefore || !isLetterOrDigit(charBefore);
      const isAfterValid = !charAfter || !isLetterOrDigit(charAfter);
      
      if (isBeforeValid && isAfterValid) {
        return index;
      }
      index = textUpper.indexOf(wordUpper, index + 1);
    }
    return -1;
  };

  const hasHeaderInfo = (
    line: string,
    uniqueBrands: string[],
    uniqueChietXuats: string[],
    uniqueFeatures: string[]
  ): boolean => {
    const lineUpper = line.toUpperCase();
    
    const foundBrand = uniqueBrands.some(brand => findWordIndexHelper(lineUpper, brand) !== -1);
    if (foundBrand) return true;
    
    const foundChiet = uniqueChietXuats.some(cx => findWordIndexHelper(lineUpper, cx) !== -1) || 
                       ['156', '160', '161', '167', '174'].some(sh => findWordIndexHelper(lineUpper, sh) !== -1);
    if (foundChiet) return true;
    
    const foundFeat = uniqueFeatures.some(f => findWordIndexHelper(lineUpper, f) !== -1);
    if (foundFeat) return true;
    
    return false;
  };

  const preprocessMultiLineBlocks = (
    text: string,
    uniqueBrands: string[],
    uniqueChietXuats: string[],
    uniqueFeatures: string[]
  ): string => {
    const lines = text.split('\n');
    const outputLines: string[] = [];
    
    let i = 0;
    while (i < lines.length) {
      const currentLine = lines[i];
      const currentLineTrimmed = currentLine.trim();
      
      if (!currentLineTrimmed) {
        outputLines.push(currentLine);
        i++;
        continue;
      }
      
      const isHeader = hasHeaderInfo(currentLineTrimmed, uniqueBrands, uniqueChietXuats, uniqueFeatures) &&
                       !getLineTokens(currentLineTrimmed).some(isDiopterToken) &&
                       !isQuantitySpecifierLine(currentLineTrimmed);
                       
      if (isHeader) {
        let j = i + 1;
        const diopterLinesCollected: string[] = [];
        let quantitySpecifier: { quantity: number; unit: string; raw: string } | null = null;
        let foundEnd = false;
        
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextLineTrimmed = nextLine.trim();
          
          if (!nextLineTrimmed) {
            j++;
            continue;
          }
          
          const qSpec = isQuantitySpecifierLine(nextLineTrimmed);
          if (qSpec) {
            quantitySpecifier = qSpec;
            foundEnd = true;
            break;
          }
          
          const isDiopterOnly = getLineTokens(nextLineTrimmed).some(isDiopterToken) &&
                                !hasHeaderInfo(nextLineTrimmed, uniqueBrands, uniqueChietXuats, uniqueFeatures);
                                
          if (isDiopterOnly) {
            diopterLinesCollected.push(nextLineTrimmed);
            j++;
          } else {
            break;
          }
        }
        
        if (foundEnd && quantitySpecifier && diopterLinesCollected.length > 0) {
          console.log(`[OrderParser Preprocessor] Found multi-line block from line ${i + 1} to ${j + 1}`);
          diopterLinesCollected.forEach(d => {
            const expandedLine = `${currentLineTrimmed} ${d} ${quantitySpecifier!.quantity}m`;
            outputLines.push(expandedLine);
          });
          i = j + 1;
          continue;
        }
      }
      
      outputLines.push(currentLine);
      i++;
    }
    
    return outputLines.join('\n');
  };

  // Core parsing algorithm
  const handleAnalyze = (overrideBrand?: string) => {
    if (!message.trim()) {
      setParsedItems([]);
      setHasAnalyzed(true);
      return;
    }

    const activeFallbackBrand = (typeof overrideBrand === 'string') ? overrideBrand : selectedBrand;

    // Current context state
    let currentBrand = typeof activeFallbackBrand === 'string' ? activeFallbackBrand : '';
    let currentChietXuat = '';
    let currentFeature = '';

    // Dynamically retrieve brand list from state, fallback if empty
    const uniqueBrands = Array.from(new Set([
      ...brandList.map(b => (b.THUONG_HIEU || '').toUpperCase().trim()),
      ...sanPhams.map(p => (p.THUONG_HIEU || '').toUpperCase().trim())
    ])).filter(Boolean).sort((a, b) => b.length - a.length); // Sort longest first for accurate greedy matching

    const uniqueChietXuats = Array.from(new Set([
      '1.56', '1.60', '1.61', '1.67', '1.74',
      ...brandList.map(b => (b.CHIET_XUAT_MAC_DINH || '').split(',').map((s: string) => s.trim().toUpperCase())).flat(),
      ...sanPhams.map(p => (p.CHIET_XUAT || '').trim().toUpperCase())
    ])).filter(Boolean).sort((a, b) => b.length - a.length);

    const uniqueFeatures = Array.from(new Set([
      'ASX', 'ĐM', 'ĐỔI MÀU', 'DOI MAU', 'CLEAR', 'BLUE', 'ROCK', 'PRE', 'ASG', 'BLUE CUT', 'CORON',
      ...brandList.map(b => (b.TINH_NANG_MAC_DINH || '').toUpperCase().trim()),
      ...brandList.map(b => (b.TINH_NANG || '').toUpperCase().trim()),
      ...sanPhams.map(p => (p.TINH_NANG || '').toUpperCase().trim())
    ])).filter(Boolean).sort((a, b) => b.length - a.length);

    // Preprocess "Danh sách độ dùng chung"
    const preprocessedMessage = preprocessMultiLineBlocks(message, uniqueBrands, uniqueChietXuats, uniqueFeatures);
    const lines = preprocessedMessage.split('\n');
    const results: ParsedItem[] = [];

    console.log('[OrderParser Debug] Initialized Parser Config:');
    console.log('  - Active Fallback Brand:', activeFallbackBrand);
    console.log('  - Registered Brands:', uniqueBrands);
    console.log('  - Registered Chiết Suấts:', uniqueChietXuats);
    console.log('  - Registered Features:', uniqueFeatures);

    // Sorted keys for our precise brandProfiles lookup
    const sortedBrandKeys = Object.keys(brandProfiles).sort((a, b) => b.length - a.length);

    // Boundary word search helper to verify words/tokens accurately
    const findWordIndex = (textUpper: string, wordUpper: string): number => {
      let index = textUpper.indexOf(wordUpper);
      while (index !== -1) {
        const charBefore = index > 0 ? textUpper[index - 1] : '';
        const charAfter = index + wordUpper.length < textUpper.length ? textUpper[index + wordUpper.length] : '';
        
        const isBeforeValid = !charBefore || !isLetterOrDigit(charBefore);
        const isAfterValid = !charAfter || !isLetterOrDigit(charAfter);
        
        if (isBeforeValid && isAfterValid) {
          return index;
        }
        index = textUpper.indexOf(wordUpper, index + 1);
      }
      return -1;
    };

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      // Skip empty lines, lines consisting of separator symbols (at least 2), or blank lines
      if (!line || /^[-_=+*~#\s]{2,}$/.test(line)) {
        console.log(`[OrderParser Debug] Skipping separator/empty line #${index + 1}: "${line}"`);
        return;
      }

      // Normalize all whitespace to standard spaces and remove duplicate spaces
      const lineUpper = line.toUpperCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();

      // Step 1: Detect and update context (Brand, Chiet Xuat, Feature)
      let foundBrand = '';
      let foundChiet = '';
      let foundFeat = '';

      let remainingLineUpper = lineUpper;

      // 1. Find Brand (longest matching first to avoid greedy collision)
      for (const brandKey of sortedBrandKeys) {
        const brandIdx = findWordIndex(remainingLineUpper, brandKey);
        if (brandIdx !== -1) {
          foundBrand = brandProfiles[brandKey].name;
          // Blank out matched brand characters to prevent any sub-part of the brand name from being matched as a feature
          remainingLineUpper = remainingLineUpper.substring(0, brandIdx) + ' '.repeat(brandKey.length) + remainingLineUpper.substring(brandIdx + brandKey.length);
          break;
        }
      }

      // 2. Find Chiết suất from the remaining part of the line
      for (const cx of uniqueChietXuats) {
        const cxIdx = findWordIndex(remainingLineUpper, cx);
        if (cxIdx !== -1) {
          foundChiet = cx;
          remainingLineUpper = remainingLineUpper.substring(0, cxIdx) + ' '.repeat(cx.length) + remainingLineUpper.substring(cxIdx + cx.length);
          break;
        }
      }

      // Fallback: check for chiết suất shorthand like 156, 160
      if (!foundChiet) {
        for (const sh of ['156', '160', '161', '167', '174']) {
          const shIdx = findWordIndex(remainingLineUpper, sh);
          if (shIdx !== -1) {
            foundChiet = normalizeChietXuat(sh);
            remainingLineUpper = remainingLineUpper.substring(0, shIdx) + ' '.repeat(sh.length) + remainingLineUpper.substring(shIdx + sh.length);
            break;
          }
        }
      }

      // 3. Find Feature from the remaining part of the line
      const sortedFeatures = uniqueFeatures.slice().sort((a, b) => b.length - a.length);
      for (const f of sortedFeatures) {
        const fIdx = findWordIndex(remainingLineUpper, f);
        if (fIdx !== -1) {
          const fUpper = f.toUpperCase();
          if (fUpper === 'ĐM' || fUpper === 'ĐỔI MÀU' || fUpper === 'DOI MAU') {
            foundFeat = 'ĐM';
          } else if (fUpper === 'ASX' || fUpper === 'ASG' || fUpper === 'BLUE' || fUpper === 'BLUE CUT') {
            foundFeat = 'ASX';
          } else {
            foundFeat = f;
          }
          remainingLineUpper = remainingLineUpper.substring(0, fIdx) + ' '.repeat(f.length) + remainingLineUpper.substring(fIdx + f.length);
          break;
        }
      }

      // Context Tracking & Reset/Update logic:
      // Whenever we encounter any title components in a line (brand, chiet, feat), we update the context.
      // If we are starting a group (because of a brand/chiet/feat change or new title-only line), 
      // we resolve missing parts using the brand config defaults or smart auto-deductions.
      if (foundBrand || foundChiet || foundFeat) {
        const resolvedBrand = foundBrand || activeFallbackBrand || currentBrand || '';
        
        let resolvedChiet = foundChiet;
        let resolvedFeat = foundFeat;

        // Try to resolve/deduce missing fields from the Brand Profile
        if (resolvedBrand) {
          const profile = brandProfiles[resolvedBrand.toUpperCase()];
          if (profile) {
            // Auto-deduce chiết suất if the brand has only one unique chiết suất
            if (!resolvedChiet) {
              resolvedChiet = profile.allChietXuats.length === 1 ? profile.allChietXuats[0] : (profile.defaultChietXuat || '');
            }
            // Auto-deduce feature if the brand has only one unique feature
            if (!resolvedFeat) {
              resolvedFeat = profile.allFeatures.length === 1 ? profile.allFeatures[0] : (profile.defaultFeature || '');
            }
          }
        }

        // If still missing, check in sanPhams for any sample product of this brand as a secondary fallback
        if (!resolvedChiet || !resolvedFeat) {
          const matchedProdSample = sanPhams.find(p => 
            (p.THUONG_HIEU || '').toUpperCase().trim() === resolvedBrand.toUpperCase().trim()
          );
          if (matchedProdSample) {
            if (!resolvedChiet) resolvedChiet = matchedProdSample.CHIET_XUAT || '';
            if (!resolvedFeat) resolvedFeat = matchedProdSample.TINH_NANG || '';
          }
        }

        currentBrand = resolvedBrand;
        currentChietXuat = resolvedChiet;
        currentFeature = resolvedFeat;
      }

      // Step 2: Parse Diopters and Quantities
      // Normalizing commas inside numbers (e.g., -2,00 -> -2.00) and spaces after signs (e.g. - 2.00 -> -2.00)
      let processedLine = lineUpper
        .replace(/(\d+),(\d+)/g, '$1.$2') // -2,00 -> -2.00
        .replace(/([+-])\s+(\d+)/g, '$1$2') // - 2.00 -> -2.00
        .replace(/[,;]/g, ' ');

      // Join quantities with their suffixes (e.g., 6 m -> 6m, 1 cặp -> 1cặp)
      processedLine = processedLine.replace(/(\d+)\s*(M|C|CẶP|CAP|MIẾNG|MIENG|X|V|PCS)(?=\s|$)/gi, '$1$2');

      // Separate consecutive SPH and CYL written consecutively (e.g., -2.00-0.50 -> -2.00 -0.50)
      processedLine = processedLine.replace(/(\d)([-+])(\d)/g, '$1 $2$3');

      const rawTokens = processedLine.split(/\s+/).filter(Boolean);

      // Build precise set of context words to filter out from diopter tokens
      const foundWordsToFilter = new Set<string>();
      
      if (foundBrand) {
        foundBrand.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
      }
      if (currentBrand) {
        currentBrand.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
      }
      if (foundChiet) {
        foundChiet.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
        foundWordsToFilter.add(foundChiet.replace('.', ''));
      }
      if (currentChietXuat) {
        currentChietXuat.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
        foundWordsToFilter.add(currentChietXuat.replace('.', ''));
      }
      if (foundFeat) {
        foundFeat.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
        if (foundFeat === 'ĐM') {
          ['ĐM', 'ĐỔI MÀU', 'DOI MAU', 'DOI', 'MAU', 'ĐỔI', 'MÀU'].forEach(w => foundWordsToFilter.add(w));
        } else if (foundFeat === 'ASX') {
          ['ASX', 'ASG', 'BLUE', 'BLUE CUT', 'CUT'].forEach(w => foundWordsToFilter.add(w));
        }
      }
      if (currentFeature) {
        currentFeature.toUpperCase().split(/\s+/).forEach(w => foundWordsToFilter.add(w));
        if (currentFeature === 'ĐM') {
          ['ĐM', 'ĐỔI MÀU', 'DOI MAU', 'DOI', 'MAU', 'ĐỔI', 'MÀU'].forEach(w => foundWordsToFilter.add(w));
        } else if (currentFeature === 'ASX') {
          ['ASX', 'ASG', 'BLUE', 'BLUE CUT', 'CUT'].forEach(w => foundWordsToFilter.add(w));
        }
      }

      // Filter out meta-context tokens to prevent misinterpreting index, brand, or feature as diopter values
      const tokens = rawTokens.filter(t => {
        const tu = t.toUpperCase();
        if (foundWordsToFilter.has(tu)) return false;
        return true;
      });

      // Let's check if there are any diopter tokens in the remaining tokens
      const isDiopterToken = (t: string): boolean => {
        const tu = t.toUpperCase();
        if (tu === 'PL' || tu === 'PLANO') return true;
        if (tu === '0' || tu === '0.00' || tu === '-0.00' || tu === '+0.00') return true;
        if (/^[+-]\d+(\.\d+)?$/.test(tu)) return true;
        
        // Also support shorthand like -050, -125, +125 etc
        if (/^[+-]\d{3,4}$/.test(tu)) return true;
        // Even unsigned shorthands like 050, 075, 125, 200
        if (/^\d{3,4}$/.test(tu)) {
          const val = parseInt(tu);
          if ([156, 160, 161, 167, 174].includes(val)) return false;
          return true;
        }

        // Also support plain unsigned decimals, e.g. 2.25 or 0.50 (but not index like 1.56)
        if (/^\d+\.\d+$/.test(tu)) {
          const val = parseFloat(tu);
          if (currentChietXuat && val === parseFloat(currentChietXuat)) return false;
          if ([1.56, 1.60, 1.61, 1.67, 1.74].includes(val)) return false;
          return true;
        }
        // Match unsigned integers, e.g. 2, 3, 4
        if (/^\d+$/.test(tu)) {
          const val = parseInt(tu);
          if ([156, 160, 161, 167, 174].includes(val)) return false;
          if (val > 0 && val <= 25) {
            return true;
          }
        }
        return false;
      };

      const hasDiopters = tokens.some(isDiopterToken);

      console.log(`[OrderParser Debug] Line #${index + 1}: "${line}"`);
      console.log(`  - Normalized String: "${lineUpper}"`);
      console.log(`  - Context Matched Line: Brand="${foundBrand || 'None'}", Chiết Suất="${foundChiet || 'None'}", Tính Năng="${foundFeat || 'None'}"`);
      console.log(`  - Cumulative Context: Brand="${currentBrand || 'None'}", Chiết Suất="${currentChietXuat || 'None'}", Tính Năng="${currentFeature || 'None'}"`);
      console.log(`  - Raw Tokens:`, rawTokens);
      console.log(`  - Filters Active:`, Array.from(foundWordsToFilter));
      console.log(`  - Diopter/Qty Tokens Remaining:`, tokens);

      if (hasDiopters) {
        const diopterValues: number[] = [];
        let quantity = 1;
        let unit = 'miếng';
        let qtyFound = false;

        // 1. Identify and extract quantity if explicitly specified with suffix
        let activeTokens = [...tokens];
        const suffixIndex = activeTokens.findIndex(token => 
          token.match(/^(\d+)\s*(M|C|CẶP|CAP|MIẾNG|MIENG|X|V)$/i)
        );

        if (suffixIndex !== -1) {
          const token = activeTokens[suffixIndex];
          const qtyMatch = token.match(/^(\d+)\s*(M|C|CẶP|CAP|MIẾNG|MIENG|X|V)$/i);
          if (qtyMatch) {
            const num = parseInt(qtyMatch[1], 10);
            const suffix = qtyMatch[2].toUpperCase();
            if (suffix === 'C' || suffix === 'CẶP' || suffix === 'CAP') {
              quantity = num * 2;
              unit = 'miếng';
            } else {
              quantity = num;
              unit = 'miếng';
            }
            qtyFound = true;
          }
          // Remove from activeTokens
          activeTokens.splice(suffixIndex, 1);
        }

        // 2. Fallback: If no explicit suffix quantity was found, look at the last token of the line
        if (!qtyFound && activeTokens.length > 1) {
          const lastToken = activeTokens[activeTokens.length - 1];
          // If the last token is a pure unsigned integer, and we have other diopters before it, it's a quantity
          if (/^\d+$/.test(lastToken)) {
            const potentialDioptersCount = activeTokens.slice(0, -1).filter(isDiopterToken).length;
            if (potentialDioptersCount > 0) {
              quantity = parseInt(lastToken, 10);
              qtyFound = true;
              unit = 'miếng';
              activeTokens.pop(); // Remove the quantity token
            }
          }
        }

        // 3. Now parse the remaining activeTokens as diopters
        activeTokens.forEach((token) => {
          if (isDiopterToken(token)) {
            const val = parseDiopterValue(token);
            diopterValues.push(val);
          }
        });

        if (diopterValues.length > 0) {
          const sph = diopterValues[0];
          // SPH and CYL rule: missing CYL defaults to -0.00
          const cyl = diopterValues.length > 1 ? diopterValues[1] : 0.00;

          console.log(`  - Parsed Diopters: SPH=${sph}, CYL=${cyl}`);
          console.log(`  - Parsed Quantity: Qty=${quantity} (${unit})`);

          if (!currentBrand || !currentChietXuat || !currentFeature) {
            const missing = [];
            if (!currentBrand) missing.push("Thương hiệu");
            if (!currentChietXuat) missing.push("Chiết xuất");
            if (!currentFeature) missing.push("Tính năng");

            const errStr = `Thiếu: ${missing.join(', ')}. Thêm dòng mô tả thương hiệu bên trên (Ví dụ: "HEN ASX 1.56")`;
            console.log(`  - ERROR: ${errStr}`);

            results.push({
              id: `PARSED_${index}_${Math.random().toString(36).substring(2, 5)}`,
              rawLine,
              brand: currentBrand || 'N/A',
              chietXuat: currentChietXuat || 'N/A',
              tinhNang: currentFeature || 'N/A',
              sph,
              cyl,
              quantity,
              unit,
              sku: '',
              matchedProduct: null,
              error: errStr
            });
          } else {
            // Generate standard database SKU
            const generatedSku = generateSKUString(currentBrand, currentChietXuat, currentFeature, sph, cyl);
            const normGenSku = cleanSKU(generatedSku);
            const matchedProduct = sanPhams.find(p => cleanSKU(p.SKU) === normGenSku) || null;

            console.log(`  - Generated SKU: "${generatedSku}"`);
            if (matchedProduct) {
              console.log(`  - SUCCESS: Matched DB Product: "${matchedProduct.TEN_SAN_PHAM}" (Stock: ${matchedProduct.TON_CUOI})`);
            } else {
              console.log(`  - WARN: No exact SKU match found in catalog for "${generatedSku}"`);
            }

            const stock = matchedProduct?.TON_CUOI ?? 0;
            const isSelectable = !!matchedProduct && stock > 0;
            const defaultExportQty = isSelectable ? Math.min(quantity, stock) : 0;

            results.push({
              id: `PARSED_${index}_${Math.random().toString(36).substring(2, 5)}`,
              rawLine,
              brand: currentBrand,
              chietXuat: currentChietXuat,
              tinhNang: currentFeature,
              sph,
              cyl,
              quantity,
              unit,
              sku: generatedSku,
              matchedProduct,
              selected: isSelectable,
              exportQuantity: defaultExportQty
            });
          }
        }
      } else {
        console.log(`  - Line treated as meta-context only (no diopter values found).`);
      }
    });

    console.log('[OrderParser Debug] Parser finished. Total parsed items:', results.length);
    setParsedItems(results);
    setHasAnalyzed(true);
  };

  // Compute live statistics of the parsed order
  const stats = useMemo(() => {
    let sufficient = 0;
    let deficient = 0;
    let outOfStock = 0;
    let errorsCount = 0;

    parsedItems.forEach(item => {
      if (item.error) {
        errorsCount++;
        return;
      }
      if (!item.matchedProduct) {
        outOfStock++;
        return;
      }
      
      const stock = item.matchedProduct.TON_CUOI;
      if (stock <= 0) {
        outOfStock++;
      } else if (stock < item.quantity) {
        deficient++;
      } else {
        sufficient++;
      }
    });

    const totalSKUs = parsedItems.filter(item => !item.error).length;
    const isAllSufficient = totalSKUs > 0 && deficient === 0 && outOfStock === 0 && errorsCount === 0;

    return {
      totalSKUs,
      sufficient,
      deficient,
      outOfStock,
      errorsCount,
      isAllSufficient
    };
  }, [parsedItems]);

  const isMissingBrand = useMemo(() => {
    return parsedItems.some(item => !item.brand || item.brand === 'N/A' || item.error?.includes('Thương hiệu'));
  }, [parsedItems]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set([
      ...brandList.map(b => b.THUONG_HIEU.toUpperCase().trim()),
      ...sanPhams.map(p => p.THUONG_HIEU.toUpperCase().trim())
    ])).filter(Boolean).sort();
  }, [brandList, sanPhams]);

  // Re-run analysis automatically when selectedBrand fallback is updated
  useEffect(() => {
    if (hasAnalyzed) {
      handleAnalyze();
    }
  }, [selectedBrand]);

  // Copy deficient list only to clipboard
  const handleCopyDeficient = () => {
    const deficientList: string[] = [];
    
    parsedItems.forEach(item => {
      if (item.error) return;

      const cleanLineDesc = `${item.brand} ${item.chietXuat} ${item.tinhNang} ${formatDop(item.sph)} ${formatDop(item.cyl)}`.trim().replace(/\s+/g, ' ');
      
      if (!item.matchedProduct) {
        deficientList.push(`${cleanLineDesc} → HẾT`);
        return;
      }
      
      const stock = item.matchedProduct.TON_CUOI;
      if (stock <= 0) {
        deficientList.push(`${cleanLineDesc} → HẾT`);
      } else if (stock < item.quantity) {
        deficientList.push(`${cleanLineDesc} → Chỉ còn ${stock} miếng`);
      }
    });

    if (deficientList.length === 0) {
      deficientList.push('Không có SKU nào bị thiếu hàng hoặc hết hàng! Đơn hàng đủ 100%.');
    }

    const content = deficientList.join('\n');
    navigator.clipboard.writeText(content).then(() => {
      setCopiedDeficient(true);
      setTimeout(() => setCopiedDeficient(false), 2000);
    });
  };

  // Copy entire analyzed results to clipboard
  const handleCopyAll = () => {
    const linesToCopy: string[] = [];
    
    parsedItems.forEach(item => {
      if (item.error) {
        linesToCopy.push(`⚠️ Dòng sai cú pháp: "${item.rawLine}" (${item.error})`);
        return;
      }

      const cleanLineDesc = `${item.brand} ${item.chietXuat} ${item.tinhNang} ${formatDop(item.sph)} ${formatDop(item.cyl)}`.trim().replace(/\s+/g, ' ');
      
      if (!item.matchedProduct) {
        linesToCopy.push(`❌ ${cleanLineDesc} → HẾT`);
        return;
      }

      const stock = item.matchedProduct.TON_CUOI;
      if (stock <= 0) {
        linesToCopy.push(`❌ ${cleanLineDesc} → HẾT`);
      } else if (stock < item.quantity) {
        linesToCopy.push(`⚠️ ${cleanLineDesc} → Chỉ còn ${stock} miếng`);
      } else {
        linesToCopy.push(`✅ ${cleanLineDesc} → Còn`);
      }
    });

    if (linesToCopy.length === 0) {
      linesToCopy.push('Chưa có dữ liệu phân tích đơn hàng.');
    }

    const content = linesToCopy.join('\n');
    navigator.clipboard.writeText(content).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  // Selection helper variables
  const selectableItems = useMemo(() => {
    return parsedItems.filter(item => !item.error && item.matchedProduct && item.matchedProduct.TON_CUOI > 0);
  }, [parsedItems]);

  const allSelectableChecked = useMemo(() => {
    if (selectableItems.length === 0) return false;
    return selectableItems.every(item => item.selected);
  }, [selectableItems]);

  const someSelectableChecked = useMemo(() => {
    if (selectableItems.length === 0) return false;
    return selectableItems.some(item => item.selected) && !allSelectableChecked;
  }, [selectableItems, allSelectableChecked]);

  const handleToggleSelectAll = () => {
    const targetState = !allSelectableChecked;
    setParsedItems(prev => prev.map(item => {
      const isSelectable = !item.error && item.matchedProduct && item.matchedProduct.TON_CUOI > 0;
      if (isSelectable) {
        return { ...item, selected: targetState };
      }
      return item;
    }));
  };

  const handleToggleSelectItem = (id: string) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id === id) {
        // Can only select if stock > 0 and no error
        const stock = item.matchedProduct?.TON_CUOI ?? 0;
        if (!item.error && stock > 0) {
          return { ...item, selected: !item.selected };
        }
      }
      return item;
    }));
  };

  const handleUpdateExportQty = (id: string, val: number) => {
    setParsedItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const stock = item.matchedProduct?.TON_CUOI ?? 0;
      // Clamp quantity to [1, stock]
      const clamped = Math.max(1, Math.min(val, stock));
      return { ...item, exportQuantity: clamped };
    }));
  };

  // Individual parsed item deletion
  const handleDeleteParsedItem = (id: string) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  // Bulk remove unfulfillable/unavailable items (stock <= 0)
  const handleRemoveUnavailableSKUs = () => {
    setParsedItems(prev => prev.filter(item => {
      if (item.error) return false;
      if (!item.matchedProduct) return false;
      const stock = item.matchedProduct.TON_CUOI;
      return stock > 0;
    }));
  };

  // Auto transition selected items with export quantities to transaction sales form
  const handleCreateXuat = () => {
    const selectedItems = parsedItems
      .filter(item => !item.error && item.selected && item.matchedProduct && (item.exportQuantity ?? 0) > 0)
      .map(item => ({
        sku: item.sku,
        soLuong: item.exportQuantity ?? 0
      }));
    
    if (selectedItems.length > 0) {
      onCreateXuatPhieu(selectedItems);
    }
  };

  // NEW UTILITIES FOR BATCH PICKING AND CARD PERSISTENCE
  const handleSaveTempOrder = async () => {
    if (parsedItems.length === 0) {
      if (onTriggerToast) onTriggerToast('Vui lòng phân tích đơn hàng trước khi lưu!', 'warning');
      return;
    }

    const newTempOrderId = `TEMP_ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userId = await resolveEffectiveUserId();

    const newTempOrder = {
      id: newTempOrderId,
      branch: selectedOrderBranch,
      originalText: message,
      items: parsedItems.map(item => ({
        id: item.id,
        rawLine: item.rawLine,
        brand: item.brand,
        chietXuat: item.chietXuat,
        tinhNang: item.tinhNang,
        sph: item.sph,
        cyl: item.cyl,
        quantity: item.quantity,
        unit: item.unit,
        sku: item.sku,
        error: item.error
      })),
      createdAt: new Date().toLocaleString('vi-VN'),
    };

    setTempOrders(prev => [newTempOrder, ...prev]);
    
    if (onTriggerToast) {
      onTriggerToast(`Đã lưu đơn hàng tạm cục bộ. Đang đồng bộ lên Supabase Cloud...`, 'success');
    }

    // Clear parsing states for next order
    setMessage('');
    setParsedItems([]);
    setHasAnalyzed(false);

    try {
      // 1. Insert header b_gomdon
      const { error: headerErr } = await supabase.from('b_gomdon').insert({
        id: newTempOrderId,
        branch: selectedOrderBranch,
        original_text: message,
        trang_thai: 'Chờ xử lý',
        user_id: userId
      });

      if (headerErr) {
        console.error('Lỗi khi lưu b_gomdon lên Supabase:', headerErr);
        if (onTriggerToast) onTriggerToast('Không thể đồng bộ Gom Đơn lên Supabase Cloud!', 'error');
        return;
      }

      // 2. Insert details b_gomdonct
      const detailsToInsert = newTempOrder.items.map(item => ({
        id: item.id || `DT_${Math.random().toString(36).substring(2, 10)}`,
        gom_don_id: newTempOrderId,
        raw_line: item.rawLine,
        brand: item.brand,
        chiet_xuat: item.chietXuat,
        tinh_nang: item.tinhNang,
        sph: item.sph,
        cyl: item.cyl,
        quantity: item.quantity,
        unit: item.unit,
        sku: item.sku,
        error: item.error || null,
        user_id: userId
      }));

      const { error: detailsErr } = await supabase.from('b_gomdonct').insert(detailsToInsert);
      if (detailsErr) {
        console.error('Lỗi khi lưu b_gomdonct lên Supabase:', detailsErr);
        if (onTriggerToast) onTriggerToast('Lưu chi tiết thất bại lên đám mây!', 'error');
      } else {
        if (onTriggerToast) onTriggerToast(`Đã đồng bộ Gom Đơn chi nhánh "${selectedOrderBranch}" lên Supabase Cloud thành công!`, 'success');
      }
    } catch (err) {
      console.error('Lỗi khi lưu lên Supabase:', err);
    }
  };

  const handleDeleteTempOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      type: 'single',
      id,
      message: 'Xóa đơn hàng tạm này?'
    });
  };

  const handleClearAllTempOrders = () => {
    setDeleteConfirm({
      type: 'all',
      message: 'Xóa toàn bộ đơn hàng tạm?'
    });
  };

  const handleDeleteSelectedTempOrders = () => {
    if (selectedTempOrderIds.length === 0) {
      if (onTriggerToast) onTriggerToast('Vui lòng chọn ít nhất một thẻ gom đơn để xóa!', 'warning');
      return;
    }
    setDeleteConfirm({
      type: 'selected',
      message: `Xóa ${selectedTempOrderIds.length} đơn hàng tạm đã chọn?`
    });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);

    if (type === 'single' && id) {
      // Optimistic UI update immediately
      setTempOrders(prev => prev.filter(o => o.id !== id));
      setSelectedTempOrderIds(prev => prev.filter(orderId => orderId !== id));
      
      if (onTriggerToast) onTriggerToast('Đang xóa đơn hàng tạm...', 'warning');

      try {
        // Delete details first
        const { error: detailErr } = await supabase
          .from('b_gomdonct')
          .delete()
          .eq('gom_don_id', id);

        if (detailErr) {
          console.warn('Cảnh báo khi xóa chi tiết b_gomdonct:', detailErr);
        }

        // Delete header
        const { error: headerErr } = await supabase
          .from('b_gomdon')
          .delete()
          .eq('id', id);

        if (headerErr) {
          console.error('Lỗi khi xóa b_gomdon trên Supabase:', headerErr);
          if (onTriggerToast) onTriggerToast('Lỗi khi xóa đơn hàng tạm trên cơ sở dữ liệu!', 'error');
        } else {
          if (onTriggerToast) onTriggerToast('Đã xóa đơn hàng tạm', 'success');
        }
      } catch (err) {
        console.error('Lỗi khi thực hiện xóa trên Supabase:', err);
        if (onTriggerToast) onTriggerToast('Lỗi kết nối khi xóa đơn hàng tạm!', 'error');
      }
    } else if (type === 'all') {
      const backupTempOrders = [...tempOrders];
      const backupSelectedIds = [...selectedTempOrderIds];
      
      setTempOrders([]);
      setSelectedTempOrderIds([]);
      
      if (onTriggerToast) onTriggerToast('Đang dọn dẹp toàn bộ thẻ gom đơn...', 'warning');

      try {
        const userId = await resolveEffectiveUserId();
        
        // Delete all details
        const { error: detailErr } = await supabase
          .from('b_gomdonct')
          .delete()
          .eq('user_id', userId);

        if (detailErr) console.warn('Lỗi khi xóa chi tiết b_gomdonct:', detailErr);

        // Delete all headers
        const { error: headerErr } = await supabase
          .from('b_gomdon')
          .delete()
          .eq('user_id', userId);

        if (headerErr) {
          console.error('Lỗi khi xóa toàn bộ b_gomdon trên Supabase:', headerErr);
          setTempOrders(backupTempOrders);
          setSelectedTempOrderIds(backupSelectedIds);
          if (onTriggerToast) onTriggerToast('Lỗi khi xóa toàn bộ đơn hàng tạm trên cơ sở dữ liệu!', 'error');
        } else {
          if (onTriggerToast) onTriggerToast('Đã xóa đơn hàng tạm', 'success');
        }
      } catch (err) {
        console.error('Lỗi khi xóa toàn bộ trên Supabase:', err);
        setTempOrders(backupTempOrders);
        setSelectedTempOrderIds(backupSelectedIds);
        if (onTriggerToast) onTriggerToast('Lỗi kết nối khi dọn dẹp đơn hàng tạm!', 'error');
      }
    } else if (type === 'selected') {
      const idsToDelete = [...selectedTempOrderIds];
      const backupTempOrders = [...tempOrders];
      
      setTempOrders(prev => prev.filter(o => !idsToDelete.includes(o.id)));
      setSelectedTempOrderIds([]);
      
      if (onTriggerToast) onTriggerToast('Đang xóa các đơn hàng tạm đã chọn...', 'warning');

      try {
        // Delete child details
        const { error: detailErr } = await supabase
          .from('b_gomdonct')
          .delete()
          .in('gom_don_id', idsToDelete);

        if (detailErr) console.warn('Lỗi khi xóa chi tiết b_gomdonct đã chọn:', detailErr);

        // Delete parent headers
        const { error: headerErr } = await supabase
          .from('b_gomdon')
          .delete()
          .in('id', idsToDelete);

        if (headerErr) {
          console.error('Lỗi khi xóa b_gomdon đã chọn trên Supabase:', headerErr);
          setTempOrders(backupTempOrders);
          setSelectedTempOrderIds(idsToDelete);
          if (onTriggerToast) onTriggerToast('Lỗi khi xóa các đơn hàng tạm đã chọn trên cơ sở dữ liệu!', 'error');
        } else {
          if (onTriggerToast) onTriggerToast('Đã xóa đơn hàng tạm', 'success');
        }
      } catch (err) {
        console.error('Lỗi khi xóa các thẻ gom đơn đã chọn trên Supabase:', err);
        setTempOrders(backupTempOrders);
        setSelectedTempOrderIds(idsToDelete);
        if (onTriggerToast) onTriggerToast('Lỗi kết nối khi xóa các đơn hàng tạm đã chọn!', 'error');
      }
    }
  };

  const handleToggleSelectTempOrder = (id: string) => {
    setSelectedTempOrderIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(orderId => orderId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleToggleSelectAllTempOrders = () => {
    if (selectedTempOrderIds.length === tempOrders.length) {
      setSelectedTempOrderIds([]);
    } else {
      setSelectedTempOrderIds(tempOrders.map(o => o.id));
    }
  };

  const handleCreateXuatFromTempOrder = (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only export valid products
    const validItems = order.items
      .filter((item: any) => !item.error && item.sku)
      .map((item: any) => {
        // Find current live stock limit
        const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
        const liveStock = liveProd?.TON_CUOI ?? 0;
        return {
          sku: item.sku,
          soLuong: Math.min(item.quantity, liveStock > 0 ? liveStock : item.quantity)
        };
      });

    if (validItems.length === 0) {
      if (onTriggerToast) onTriggerToast('Đơn hàng tạm không có sản phẩm hợp lệ nào hoặc không tìm thấy sản phẩm trong danh mục!', 'error');
      return;
    }

    onCreateXuatPhieu(validItems, order.id);
    if (onTriggerToast) onTriggerToast(`Đang chuyển sang tạo phiếu xuất cho chi nhánh "${order.branch}"...`, 'success');
  };

  // Memoized grouped batch picking data
  const batchPickingData = useMemo(() => {
    const selectedOrders = tempOrders.filter(o => selectedTempOrderIds.includes(o.id));
    
    // Map of: cleanSKU -> AggregatedItem
    const skuMap: Record<string, {
      sku: string;
      brand: string;
      chietXuat: string;
      tinhNang: string;
      sph: number;
      cyl: number;
      totalQty: number;
      unit: string;
      origins: { branch: string; qty: number }[];
    }> = {};

    selectedOrders.forEach(order => {
      order.items.forEach((item: any) => {
        if (item.error) return; // skip items with error
        
        const skuKey = cleanSKU(item.sku);
        if (!skuMap[skuKey]) {
          skuMap[skuKey] = {
            sku: item.sku,
            brand: item.brand,
            chietXuat: item.chietXuat,
            tinhNang: item.tinhNang,
            sph: item.sph,
            cyl: item.cyl,
            totalQty: 0,
            unit: item.unit || 'miếng',
            origins: []
          };
        }
        skuMap[skuKey].totalQty += item.quantity;
        skuMap[skuKey].origins.push({
          branch: order.branch,
          qty: item.quantity
        });
      });
    });

    const aggregatedList = Object.values(skuMap);

    // Group by Brand and Chiết suất
    const groupMap: Record<string, {
      brand: string;
      chietXuat: string;
      items: typeof aggregatedList;
    }> = {};

    aggregatedList.forEach(item => {
      const groupKey = `${item.brand.toUpperCase()} - ${item.chietXuat}`;
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          brand: item.brand,
          chietXuat: item.chietXuat,
          items: []
        };
      }
      groupMap[groupKey].items.push(item);
    });

    // Sort items inside each group: based on custom sorting priority list
    Object.values(groupMap).forEach(g => {
      g.items.sort((a, b) => {
        for (const field of sortingPriority) {
          const comp = compareFields(a, b, field);
          if (comp !== 0) return comp;
        }
        return 0;
      });
    });

    // Sort groups: based on whichever of 'brand' or 'chietXuat' comes first in sortingPriority
    const brandIndex = sortingPriority.indexOf('brand');
    const chietXuatIndex = sortingPriority.indexOf('chietXuat');
    const isBrandFirst = brandIndex < chietXuatIndex;

    const sortedGroups = Object.values(groupMap).sort((a, b) => {
      if (isBrandFirst) {
        const brandCompare = a.brand.localeCompare(b.brand, 'vi', { sensitivity: 'base' });
        if (brandCompare !== 0) return brandCompare;
        const cxA = parseFloat(a.chietXuat) || 0;
        const cxB = parseFloat(b.chietXuat) || 0;
        return cxA - cxB;
      } else {
        const cxA = parseFloat(a.chietXuat) || 0;
        const cxB = parseFloat(b.chietXuat) || 0;
        if (cxA !== cxB) return cxA - cxB;
        return a.brand.localeCompare(b.brand, 'vi', { sensitivity: 'base' });
      }
    });

    return sortedGroups;
  }, [tempOrders, selectedTempOrderIds, sortingPriority]);

  // Compute picking stats
  const pickingStats = useMemo(() => {
    let totalUniqueSkus = 0;
    let pickedUniqueSkus = 0;
    let totalUnits = 0;
    let pickedUnits = 0;

    batchPickingData.forEach(group => {
      group.items.forEach(item => {
        totalUniqueSkus++;
        totalUnits += item.totalQty;
        if (pickedItemsState[item.sku]) {
          pickedUniqueSkus++;
          pickedUnits += item.totalQty;
        }
      });
    });

    return {
      totalUniqueSkus,
      pickedUniqueSkus,
      totalUnits,
      pickedUnits,
      percent: totalUniqueSkus > 0 ? Math.round((pickedUniqueSkus / totalUniqueSkus) * 100) : 0
    };
  }, [batchPickingData, pickedItemsState]);

  const handleStartBatchPicking = () => {
    if (selectedTempOrderIds.length === 0) {
      if (onTriggerToast) onTriggerToast('Vui lòng chọn ít nhất một thẻ đơn hàng để gom đơn!', 'warning');
      return;
    }
    // Initialize picking state as false for all included SKUs
    const initialPickedState: Record<string, boolean> = {};
    batchPickingData.forEach(group => {
      group.items.forEach(item => {
        initialPickedState[item.sku] = false;
      });
    });
    setPickedItemsState(initialPickedState);
    setIsBatchPickingActive(true);
    setPickingStep(1); // Set Step 1 by default
    if (onTriggerToast) onTriggerToast(`Đang mở quy trình gom đơn lấy hàng gồm ${selectedTempOrderIds.length} đơn!`, 'success');
  };

  const handleTogglePickedSku = (sku: string) => {
    setPickedItemsState(prev => ({
      ...prev,
      [sku]: !prev[sku]
    }));
  };

  const handleExecuteBatchExport = async () => {
    if (!onSaveMultipleTransactions) {
      if (onTriggerToast) onTriggerToast('Hệ thống chưa hỗ trợ xuất kho tự động từ gom đơn!', 'error');
      return;
    }
    
    // Lọc các đơn hàng được chọn và chưa được xuất
    const ordersToExport = tempOrders.filter(o => selectedTempOrderIds.includes(o.id) && o.trangThai !== 'Đã xuất');
    if (ordersToExport.length === 0) {
      if (onTriggerToast) onTriggerToast('Không có đơn hàng nào hợp lệ hoặc tất cả đơn đã được xuất!', 'warning');
      return;
    }

    // 1. Calculate aggregated requested export quantity per SKU and verify against live stock
    const skuRequiredQty: Record<string, number> = {};
    const skuOriginalNames: Record<string, string> = {};

    for (const order of ordersToExport) {
      const orderItems = order.items.filter((item: any) => !item.error && item.sku);
      const pickedCount = orderItems.filter((item: any) => !!pickedItemsState[item.sku]).length;
      const isFullyPicked = pickedCount === orderItems.length && orderItems.length > 0;
      
      const mode = isFullyPicked ? (orderExportModes[order.id] || 'FULL') : 'PARTIAL';
      if (mode === 'CANCEL') continue;

      for (const item of orderItems) {
        // In PARTIAL mode, only include picked items
        if (mode === 'PARTIAL' && !pickedItemsState[item.sku]) {
          continue;
        }

        const skuKey = cleanSKU(item.sku);
        skuRequiredQty[skuKey] = (skuRequiredQty[skuKey] || 0) + item.quantity;
        skuOriginalNames[skuKey] = `${item.brand} ${item.chietXuat} ${item.tinhNang} (SPH ${formatDop(item.sph)} CYL ${formatDop(item.cyl)})`;
      }
    }

    // Now verify against live stock
    const stockErrors: string[] = [];
    for (const [skuKey, requiredQty] of Object.entries(skuRequiredQty)) {
      const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === skuKey);
      const liveStock = liveProd?.TON_CUOI ?? 0;
      if (requiredQty > liveStock) {
        stockErrors.push(
          `${skuOriginalNames[skuKey]} (SKU: ${skuKey}) - Yêu cầu: ${requiredQty}, Tồn kho: ${liveStock}`
        );
      }
    }

    if (stockErrors.length > 0) {
      setExportError(stockErrors);
      if (onTriggerToast) {
        onTriggerToast('Không thể tạo phiếu xuất! Có sản phẩm vượt quá tồn kho thực tế, sẽ gây âm kho.', 'error');
      }
      return;
    } else {
      setExportError(null);
    }

    // 2. Prepare transactions to submit
    const transactionsToSubmit: { header: any; details: any[]; orderId: string }[] = [];
    const updatedTempOrders = [...tempOrders];

    for (const order of ordersToExport) {
      const orderItems = order.items.filter((item: any) => !item.error && item.sku);
      const pickedCount = orderItems.filter((item: any) => !!pickedItemsState[item.sku]).length;
      const isFullyPicked = pickedCount === orderItems.length && orderItems.length > 0;
      
      const mode = isFullyPicked ? (orderExportModes[order.id] || 'FULL') : 'PARTIAL';
      
      // Nếu người dùng chọn Hủy bỏ đơn hàng này
      if (mode === 'CANCEL') {
        continue;
      }

      if (orderItems.length === 0) continue;

      const detailsList: any[] = [];
      let totalQty = 0;

      for (let i = 0; i < orderItems.length; i++) {
        const item = orderItems[i];

        // In PARTIAL mode, only include picked items
        if (mode === 'PARTIAL' && !pickedItemsState[item.sku]) {
          continue;
        }

        const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
        const exportQty = item.quantity;
        totalQty += exportQty;

        detailsList.push({
          ID: `CT_NEW_${Date.now()}_${order.id.replace('TEMP_ORDER_', '')}_${i}`,
          HOA_DON: '', // Sẽ được sinh tự động tại App.tsx
          SKU: item.sku,
          TEN_SP: liveProd?.TEN_SAN_PHAM || `${item.brand} ${item.chietXuat} ${item.tinhNang}`,
          THUONG_HIEU: item.brand,
          CHIET_XUAT: item.chietXuat,
          TINH_NANG: item.tinhNang,
          SPH: item.sph,
          CYL: item.cyl,
          SO_LUONG: exportQty,
          DVT: item.unit || 'miếng',
          GHI_CHU: `Xuất từ Gom đơn lấy hàng — Chi nhánh ${order.branch}`,
          LOAI: 'XUẤT',
          NGAY: getVietnamDateString()
        });
      }

      if (detailsList.length === 0) {
        continue; // Bỏ qua nếu không xuất SKU nào cho đơn này
      }

      const newHeader = {
        HOA_DON: '', // Sẽ được sinh tự động tại App.tsx
        CHI_NHANH: order.branch,
        NGAY: getVietnamDateString(),
        LOAI: 'XUẤT' as const,
        TONG_SL: totalQty,
        NGUOI_TAO: currentUser?.username || 'admin',
        TEN_NGUOI_TAO: currentUser?.fullName || 'Người dùng hệ thống',
        TG_TAO: getVietnamDateTimeString(),
        GHI_CHU: `Tự động xuất kho từ gom đơn lấy hàng — Chi nhánh ${order.branch}`,
        MA_NV: currentUser?.id || 'admin',
        TEN_DANG_NHAP: currentUser?.username || 'admin'
      };

      transactionsToSubmit.push({
        header: newHeader,
        details: detailsList,
        orderId: order.id
      });
    }

    if (transactionsToSubmit.length === 0) {
      if (onTriggerToast) onTriggerToast('Không có sản phẩm nào được xuất! Tất cả đơn hàng tạm đều trống hoặc bị bỏ qua.', 'warning');
      return;
    }

    try {
      // Thực hiện lưu bulk transactions chuẩn chỉ
      const invoiceIds = await onSaveMultipleTransactions(
        transactionsToSubmit.map(t => ({ header: t.header, details: t.details }))
      );

      // Cập nhật thông tin phiếu xuất và trạng thái vào thẻ đơn tạm
      transactionsToSubmit.forEach((tx, idx) => {
        const matchingIndex = updatedTempOrders.findIndex(o => o.id === tx.orderId);
        if (matchingIndex !== -1) {
          const soPhieuXuatVal = invoiceIds[idx] || `PX_AUTO_${Date.now()}_${idx}`;
          updatedTempOrders[matchingIndex] = {
            ...updatedTempOrders[matchingIndex],
            trangThai: 'Đã xuất',
            soPhieuXuat: soPhieuXuatVal
          };

          // Đồng bộ trạng thái đã xuất lên Supabase
          supabase.from('b_gomdon')
            .update({ trang_thai: 'Đã xuất', so_phieu_xuat: soPhieuXuatVal })
            .eq('id', tx.orderId)
            .then(({ error }) => {
              if (error) console.warn('Lỗi khi cập nhật trạng thái xuất b_gomdon:', error);
            });
        }
      });

      setTempOrders(updatedTempOrders);
      localStorage.setItem('BATCH_PICKING_TEMP_ORDERS', JSON.stringify(updatedTempOrders));

      if (onTriggerToast) {
        onTriggerToast(`Đã tự động tạo thành công ${transactionsToSubmit.length} phiếu xuất kho riêng biệt!`, 'success');
      }

      // Đóng modal và reset step
      setIsBatchPickingActive(false);
      setPickingStep(1);
      setExportError(null);

      // Chuyển sang tab Lịch sử để xem lại các chứng từ vừa lưu tự động
      if (onNavigateToHistory) {
        setTimeout(() => {
          onNavigateToHistory();
        }, 1200);
      }
    } catch (e) {
      console.error('Lỗi tạo phiếu xuất tự động:', e);
      if (onTriggerToast) onTriggerToast('Lỗi nghiêm trọng khi thực hiện tạo phiếu xuất tự động!', 'error');
    }
  };

  const handleExportExcel = () => {
    if (batchPickingData.length === 0) return;

    let csvContent = '\uFEFF'; // UTF-8 BOM
    csvContent += 'BẢNG GOM ĐƠN LẤY HÀNG (BATCH PICKING LIST)\n';
    csvContent += `Ngày tạo: ${new Date().toLocaleString('vi-VN')}\n`;
    csvContent += `Số đơn gom: ${selectedTempOrderIds.length} đơn hàng\n`;
    csvContent += `Tổng số lượng: ${pickingStats.totalUnits} miếng\n\n`;
    
    csvContent += 'STT,Thương hiệu,Chiết suất,Độ cầu (SPH),Độ loạn (CYL),Mã SKU,Tổng số lượng,Đơn vị,Chi tiết theo chi nhánh,Trạng thái lấy hàng\n';
    
    let index = 1;
    batchPickingData.forEach(group => {
      group.items.forEach(item => {
        const sphStr = formatDop(item.sph);
        const cylStr = formatDop(item.cyl);
        const isPicked = pickedItemsState[item.sku] ? 'ĐÃ LẤY' : 'CHƯA LẤY';
        const originsStr = item.origins.map(o => `${o.branch}: ${o.qty} miếng`).join('; ');
        
        csvContent += `${index},"${item.brand}","${item.chietXuat}","${sphStr}","${cylStr}","${item.sku}",${item.totalQty},"${item.unit}","${originsStr}","${isPicked}"\n`;
        index++;
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GOM_DON_LAY_HANG_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onTriggerToast) onTriggerToast('Đã xuất file gom đơn CSV (UTF-8 BOM) hỗ trợ Excel thành công!', 'success');
  };

  const handlePrint = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        let html = `
          <html>
            <head>
              <title>Bảng Gom Đơn Lấy Hàng</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
                .title { font-size: 22px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; text-transform: uppercase; margin-bottom: 5px; }
                .meta { font-size: 11px; color: #64748b; margin-bottom: 25px; font-family: monospace; }
                .group-header { background: #f1f5f9; color: #0f172a; padding: 10px 14px; font-weight: 800; font-size: 13px; margin-top: 25px; border-left: 4px solid #4f46e5; border-radius: 0 6px 6px 0; letter-spacing: 0.05em; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 11px; }
                th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; }
                .qty { text-align: center; font-weight: 800; font-size: 13px; color: #0f172a; }
                .origins { font-size: 10px; color: #64748b; font-style: italic; }
                .check-box { text-align: center; font-size: 16px; font-weight: bold; width: 50px; }
                @media print {
                  body { padding: 10px; }
                  button { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="title">BẢNG GOM ĐƠN LẤY HÀNG (BATCH PICKING)</div>
              <div class="meta">
                Thời gian in: ${new Date().toLocaleString('vi-VN')}<br/>
                Tổng số đơn gom: ${selectedTempOrderIds.length} đơn hàng<br/>
                Tổng cộng tròng kính cần lấy: ${pickingStats.totalUnits} miếng (${pickingStats.totalUniqueSkus} SKU)
              </div>
        `;

        batchPickingData.forEach(group => {
          html += `
            <div class="group-header">${group.brand.toUpperCase()} - ${group.chietXuat}</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 12%; text-align: center;">Độ cầu (SPH)</th>
                  <th style="width: 12%; text-align: center;">Độ loạn (CYL)</th>
                  <th style="width: 38%;">Mã SKU / Thông tin sản phẩm</th>
                  <th style="width: 25%;">Chi tiết phân bổ chi nhánh</th>
                  <th style="width: 13%; text-align: center;">Số lượng</th>
                  <th style="width: 10%; text-align: center;">Đã lấy</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          group.items.forEach(item => {
            const isPickedSymbol = pickedItemsState[item.sku] ? '✓' : '';
            const originsStr = item.origins.map(o => `${o.branch}: ${o.qty}M`).join(', ');
            html += `
              <tr>
                <td style="text-align: center; font-family: monospace; font-weight: 800; font-size: 12px;">${formatDop(item.sph)}</td>
                <td style="text-align: center; font-family: monospace; font-weight: 800; font-size: 12px;">${formatDop(item.cyl)}</td>
                <td>
                  <div style="font-weight: bold; font-size: 11px;">${item.brand} ${item.chietXuat} ${item.tinhNang}</div>
                  <div style="font-size: 9px; color: #64748b; font-family: monospace;">${item.sku}</div>
                </td>
                <td class="origins">${originsStr}</td>
                <td class="qty">${item.totalQty} <span style="font-size: 9px; font-weight: normal; color: #64748b;">M</span></td>
                <td class="check-box">${isPickedSymbol}</td>
              </tr>
            `;
          });

          html += `
              </tbody>
            </table>
          `;
        });

        html += `
              <div style="margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 11px; color: #64748b; display: flex; justify-content: space-between;">
                <span>In từ phần mềm Quản lý Kho Kính Mắt</span>
                <span>Chữ ký nhân viên soạn kho: ............................................</span>
              </div>
              <script>
                window.onload = function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 500);
                };
              </script>
            </body>
          </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6" id="order_parser_container">
      {/* Header section with instructions */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="font-sans font-bold text-slate-800 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Kiểm Tra Đơn Hàng & Gom Đơn Soạn Hàng
          </h2>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex border-b border-slate-200" id="order_parser_subtabs">
        <button
          onClick={() => setParserViewTab('ANALYZE')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            parserViewTab === 'ANALYZE'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <ClipboardList className="w-4.5 h-4.5" />
          Phân Tích Đơn Mới
        </button>
        <button
          onClick={() => setParserViewTab('TEMP_ORDERS')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all cursor-pointer relative ${
            parserViewTab === 'TEMP_ORDERS'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Bookmark className="w-4.5 h-4.5" />
          Đơn Hàng Tạm & Gom Đơn ({tempOrders.length})
          {tempOrders.length > 0 && (
            <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {tempOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT: ANALYZE */}
      {parserViewTab === 'ANALYZE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Left Column: Input Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Chi Nhánh Nhận Đơn
                </label>
                <select
                  value={selectedOrderBranch}
                  onChange={(e) => setSelectedOrderBranch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all cursor-pointer shadow-xs"
                  id="selected_order_branch_dropdown"
                >
                  {chiNhanhs && chiNhanhs.length > 0 ? (
                    chiNhanhs.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))
                  ) : (
                    <option value="Chi nhánh chính">Chi nhánh chính</option>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Nội dung tin nhắn khách gửi</span>
                  <button 
                    onClick={() => setMessage('')} 
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase cursor-pointer"
                  >
                    Xóa Trắng
                  </button>
                </div>
                
                <textarea
                  className="w-full h-80 px-4 py-3 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all leading-relaxed"
                  placeholder="Nhập hoặc dán tin nhắn khách gửi tại đây...&#10;Ví dụ:&#10;HEN ASX 1.56&#10;-050 8M (Tự hiểu -0.50)&#10;-125 9M (Tự hiểu -1.25)&#10;-2,00-0,50 2M (Tự hiểu SPH -2.00, CYL -0.50)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  id="message_input_textarea"
                />
              </div>

              <button
                onClick={() => handleAnalyze()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                id="analyze_message_btn"
              >
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                Phân Tích Đơn Hàng & Đối Chiếu Kho Live
              </button>
            </div>
          </div>

          {/* Right Column: Parsed Results View */}
          <div className="lg:col-span-7 space-y-4">
            {!hasAnalyzed ? (
              <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl h-[450px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="p-4 bg-slate-100 rounded-full text-slate-400">
                  <ClipboardCheck className="w-8 h-8" />
                </div>
                <p className="font-sans font-bold text-slate-700 text-sm">Chưa có dữ liệu phân tích</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Hãy chọn chi nhánh, nhập nội dung tin nhắn của khách hàng ở khung bên trái rồi bấm nút <strong>Phân Tích Đơn Hàng</strong> để hiển thị kết quả đối chiếu tồn kho chi tiết.
                </p>
              </div>
            ) : parsedItems.length === 0 ? (
              <div className="bg-red-50/30 border border-red-100 rounded-2xl h-[450px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="p-4 bg-red-50 rounded-full text-red-500">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <p className="font-sans font-bold text-red-700 text-sm">Không nhận diện được SKU tròng kính nào</p>
                <p className="text-xs text-red-500/80 max-w-sm">
                  Vui lòng kiểm tra lại định dạng tin nhắn. Đảm bảo có dòng thông tin thương hiệu (Ví dụ: "HEN ASX 1.56") và tiếp theo là các dòng chứa thông số độ (Ví dụ: "-2.00 -0.50 1M").
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Fallback Brand Selector for Missing Brands */}
                {isMissingBrand && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fade-in" id="fallback_brand_container">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="font-sans font-bold text-amber-800 text-sm">
                          Chưa nhận diện được Thương hiệu tròng kính
                        </h4>
                        <p className="text-xs text-amber-700/90 leading-relaxed">
                          Hệ thống phát hiện dòng độ nhưng thiếu thông tin Thương hiệu (Ví dụ chỉ ghi <em>"ASX 1.56"</em>). 
                          Vui lòng chọn Thương hiệu dưới đây để áp dụng tự động và đối chiếu tồn kho live:
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5 max-w-sm">
                      <select
                        value={selectedBrand}
                        onChange={(e) => {
                          const newBrand = e.target.value;
                          setSelectedBrand(newBrand);
                          handleAnalyze(newBrand);
                        }}
                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500 transition-all cursor-pointer shadow-xs"
                        id="fallback_brand_dropdown"
                      >
                        <option value="">-- Chọn Thương hiệu --</option>
                        {uniqueBrands.map((brand) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                      
                      {selectedBrand && (
                        <button
                          onClick={() => {
                            setSelectedBrand('');
                            handleAnalyze('');
                          }}
                          className="text-[11px] text-amber-800 hover:text-amber-950 font-bold hover:underline shrink-0 px-2 cursor-pointer"
                          id="clear_fallback_brand_btn"
                        >
                          Xóa áp dụng
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Bento statistics panel */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl text-center space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Đủ Hàng</span>
                    <p className="text-2xl font-sans font-extrabold text-emerald-700">{stats.sufficient}</p>
                    <p className="text-[9px] font-medium text-emerald-500/90 font-mono uppercase">SKU sẵn sàng</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-2xl text-center space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Thiếu Hàng</span>
                    <p className="text-2xl font-sans font-extrabold text-amber-700">{stats.deficient}</p>
                    <p className="text-[9px] font-medium text-amber-500/90 font-mono uppercase">Không đủ số lượng</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-2xl text-center space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Hết Hàng</span>
                    <p className="text-2xl font-sans font-extrabold text-rose-700">{stats.outOfStock}</p>
                    <p className="text-[9px] font-medium text-rose-500/90 font-mono uppercase">Tồn kho bằng 0</p>
                  </div>
                </div>

                {/* Status banner and primary actions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trạng thái tổng quan</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {stats.isAllSufficient ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-100">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            ✅ ĐỦ HÀNG ĐỂ XUẤT KHO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-rose-100">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ⚠️ KHO THIẾU/HẾT MỘT SỐ SKU
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleSaveTempOrder}
                        className="bg-indigo-600 hover:bg-indigo-505 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        id="save_temp_order_btn"
                      >
                        <Plus className="w-4 h-4" />
                        Lưu Soạn Đơn
                      </button>

                      {parsedItems.some(item => !item.error && item.selected && item.matchedProduct && (item.exportQuantity ?? 0) > 0) ? (
                        <button
                          onClick={handleCreateXuat}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          id="generate_invoice_from_parser_btn"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          Tạo Phiếu Xuất ({parsedItems.filter(item => !item.error && item.selected && item.matchedProduct && (item.exportQuantity ?? 0) > 0).length} SKU)
                        </button>
                      ) : (
                        <div className="text-[10px] text-slate-400 max-w-[150px] font-medium leading-tight">
                          * Lưu soạn đơn làm thẻ tạm, hoặc tick chọn sản phẩm có hàng để Tạo Phiếu Xuất ngay.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Copy Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCopyAll}
                      className="flex-1 min-w-[150px] bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-2 px-3 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      id="copy_all_results_btn"
                    >
                      {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedAll ? 'Đã copy toàn bộ!' : 'Copy Toàn Bộ Kết Quả'}
                    </button>

                    <button
                      onClick={handleCopyDeficient}
                      className="flex-1 min-w-[150px] bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold py-2 px-3 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      id="copy_deficient_results_btn"
                    >
                      {copiedDeficient ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedDeficient ? 'Đã copy danh sách thiếu!' : 'Copy Danh Sách Thiếu Hàng'}
                    </button>

                    {!stats.isAllSufficient && parsedItems.some(item => item.error || !item.matchedProduct || item.matchedProduct.TON_CUOI < item.quantity) && (
                      <button
                        onClick={handleRemoveUnavailableSKUs}
                        className="flex-1 min-w-[150px] bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-3 rounded-lg border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        id="remove_unavailable_btn"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        Lọc Bỏ SKU Thiếu/Hết
                      </button>
                    )}
                  </div>

                  {/* Display Deficiencies List */}
                  {!stats.isAllSufficient && parsedItems.some(item => !item.error && (!item.matchedProduct || (item.matchedProduct.TON_CUOI < item.quantity))) && (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
                      <h3 className="font-sans font-bold text-rose-800 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        Danh Sách Thiếu Hàng / Hết Hàng
                      </h3>
                      <ul className="divide-y divide-rose-100/50 text-xs text-rose-700 font-mono">
                        {parsedItems
                          .filter(item => !item.error && (!item.matchedProduct || (item.matchedProduct.TON_CUOI < item.quantity)))
                          .map(item => {
                            const stock = item.matchedProduct?.TON_CUOI ?? 0;
                            const skuDesc = `${item.brand} ${item.chietXuat} ${item.tinhNang} ${formatDop(item.sph)} ${formatDop(item.cyl)}`;
                            return (
                              <li key={item.id} className="py-1.5 flex justify-between items-center">
                                <span>{skuDesc}</span>
                                <span className="font-bold">
                                  {stock <= 0 ? 'HẾT' : `Chỉ còn ${stock} miếng`}
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}

                  {/* Table of Parsed results */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                      <table className="w-full text-left border-collapse font-sans">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-10">
                              <input
                                type="checkbox"
                                checked={allSelectableChecked}
                                ref={el => {
                                  if (el) {
                                    el.indeterminate = someSelectableChecked;
                                  }
                                }}
                                onChange={handleToggleSelectAll}
                                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                title="Chọn tất cả SKU khả dụng"
                              />
                            </th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase">Thông số diopter / SKU</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-16">Yêu cầu</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-16">Kho</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-24">SL Xuất</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-28">Trạng thái</th>
                            <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-12">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {parsedItems.map((item) => {
                            const sphStr = formatDop(item.sph);
                            const cylStr = formatDop(item.cyl);
                            
                            // Handle syntax errors
                            if (item.error) {
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 bg-red-50/10">
                                  <td className="py-2.5 px-3 text-center">
                                    <input type="checkbox" disabled className="w-3.5 h-3.5 rounded-sm border-slate-200" />
                                  </td>
                                  <td colSpan={5} className="py-2.5 px-3">
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Cú pháp dòng lỗi: "{item.rawLine}"
                                      </p>
                                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{item.error}</p>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteParsedItem(item.id)}
                                      className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Xóa dòng lỗi"
                                    >
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            const stock = item.matchedProduct?.TON_CUOI ?? 0;
                            const hasProduct = !!item.matchedProduct;
                            const isSelectable = hasProduct && stock > 0;
                            
                            let statusBadge = null;
                            let textClass = "text-slate-800";
                            let rowClass = "hover:bg-slate-50/40 transition-colors";

                            if (!hasProduct) {
                              statusBadge = (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 bg-rose-50 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-100">
                                  <XCircle className="w-3 h-3" /> HẾT
                                </span>
                              );
                              rowClass = "bg-rose-50/10 hover:bg-rose-50/20";
                              textClass = "text-rose-700 font-bold";
                            } else if (stock <= 0) {
                              statusBadge = (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 bg-rose-50 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-100">
                                  <XCircle className="w-3 h-3" /> HẾT
                                </span>
                              );
                              rowClass = "bg-rose-50/10 hover:bg-rose-50/20";
                              textClass = "text-rose-700 font-bold";
                            } else if (stock < item.quantity) {
                              statusBadge = (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 bg-amber-50 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-100">
                                  <AlertTriangle className="w-3 h-3" /> Thiếu
                                </span>
                              );
                              rowClass = "bg-amber-50/10 hover:bg-amber-50/20";
                              textClass = "text-amber-700 font-bold";
                            } else {
                              statusBadge = (
                                <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                                  <CheckCircle className="w-3 h-3" /> Sẵn sàng
                                </span>
                              );
                            }

                            return (
                              <tr key={item.id} className={`${rowClass} ${item.selected ? 'bg-indigo-50/10' : ''}`}>
                                <td className="py-2.5 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!item.selected}
                                    disabled={!isSelectable}
                                    onChange={() => handleToggleSelectItem(item.id)}
                                    className="w-3.5 h-3.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isSelectable ? "Chọn để xuất" : "Không thể chọn SKU hết hàng"}
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="space-y-0.5">
                                    <p className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                      <span className="text-slate-500 bg-slate-100 px-1 py-0.2 rounded text-[10px]">{item.brand}</span>
                                      <span>SPH {sphStr}</span>
                                      <span>CYL {cylStr}</span>
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-tight">{formatSKUForDisplay(item.sku) || 'N/A'}</p>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                                  {item.quantity} <span className="text-[9px] text-slate-400 font-normal">{item.unit}</span>
                                </td>
                                <td className={`py-2.5 px-3 text-center font-mono font-bold ${textClass}`}>
                                  {hasProduct ? stock : 0}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {isSelectable ? (
                                    <input
                                      type="number"
                                      min={1}
                                      max={stock}
                                      disabled={!item.selected}
                                      value={item.exportQuantity ?? ''}
                                      onChange={(e) => handleUpdateExportQty(item.id, parseInt(e.target.value) || 0)}
                                      className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-md focus:outline-hidden focus:border-indigo-500 text-xs font-bold disabled:bg-slate-50 disabled:text-slate-400"
                                    />
                                  ) : (
                                    <span className="text-slate-400 font-semibold font-mono">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {statusBadge}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteParsedItem(item.id)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    title="Xóa dòng này"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: TEMP_ORDERS (List of temporary cards and Batch Picking Trigger) */}
      {parserViewTab === 'TEMP_ORDERS' && (
        <div className="space-y-4 animate-fade-in">
          {tempOrders.length === 0 ? (
            <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl h-[450px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="p-4 bg-indigo-50 text-indigo-500 rounded-full">
                <Bookmark className="w-8 h-8" />
              </div>
              <p className="font-sans font-bold text-slate-700 text-sm">Chưa Có Thẻ Đơn Hàng Tạm Nào</p>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Để gom đơn, vui lòng chuyển sang tab <strong>Phân Tích Đơn Mới</strong>, chọn chi nhánh và dán tin nhắn khách gửi. Sau khi bấm đối chiếu kho, chọn <strong>Lưu Soạn Đơn</strong> để lưu lại dưới dạng thẻ đơn tạm. Bạn có thể lưu nhiều đơn từ nhiều chi nhánh khác nhau!
              </p>
              <button
                onClick={() => setParserViewTab('ANALYZE')}
                className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" />
                Soạn Đơn Mới Ngay
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Batch Picking Controls Header */}
              <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTempOrderIds.length === tempOrders.length && tempOrders.length > 0}
                    onChange={handleToggleSelectAllTempOrders}
                    className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Chọn tất cả đơn tạm"
                    id="select_all_temp_orders_checkbox"
                  />
                  <div>
                    <h3 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      Chọn Thẻ Đơn Để Gom Soạn Hàng
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Đã chọn <strong>{selectedTempOrderIds.length}</strong> / <strong>{tempOrders.length}</strong> đơn hàng tạm
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleStartBatchPicking}
                    disabled={selectedTempOrderIds.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md active:scale-95 disabled:scale-100 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    id="batch_picking_btn"
                  >
                    <Layers className="w-4.5 h-4.5" />
                    Gom Đơn Lấy Hàng ({selectedTempOrderIds.length} Đơn)
                  </button>

                  <button
                    onClick={handleDeleteSelectedTempOrders}
                    disabled={selectedTempOrderIds.length === 0}
                    className="bg-rose-50 hover:bg-rose-100 disabled:bg-slate-100 disabled:text-slate-400 text-rose-600 text-xs font-bold py-2.5 px-3.5 rounded-xl border border-rose-200/50 transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    id="delete_selected_temp_orders_btn"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa Đã Chọn ({selectedTempOrderIds.length})
                  </button>

                  <button
                    onClick={handleClearAllTempOrders}
                    className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold py-2.5 px-3.5 rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    id="clear_all_temp_orders_btn"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa Tất Cả
                  </button>
                </div>
              </div>

              {/* Grid of Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tempOrders.map((order) => {
                  const isChecked = selectedTempOrderIds.includes(order.id);
                  const validItemsCount = order.items.filter((i: any) => !i.error).length;
                  const totalGlasses = order.items.reduce((sum: number, i: any) => sum + (i.error ? 0 : i.quantity), 0);

                  // Calculate live status of this card against current inventory
                  let okCount = 0;
                  let defCount = 0;
                  let outCount = 0;
                  let totalValid = 0;

                  order.items.forEach((item: any) => {
                    if (item.error) return;
                    totalValid++;
                    const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
                    const liveStock = liveProd?.TON_CUOI ?? 0;

                    if (liveStock <= 0) {
                      outCount++;
                    } else if (liveStock < item.quantity) {
                      defCount++;
                    } else {
                      okCount++;
                    }
                  });

                  let cardStatusBadge = null;
                  if (order.trangThai === 'Đã xuất') {
                    cardStatusBadge = (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" /> Đã xuất ({order.soPhieuXuat})
                      </span>
                    );
                  } else if (outCount > 0) {
                    cardStatusBadge = (
                      <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ⚠️ Hết hàng
                      </span>
                    );
                  } else if (defCount > 0) {
                    cardStatusBadge = (
                      <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ⚠️ Thiếu hàng
                      </span>
                    );
                  } else {
                    cardStatusBadge = (
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                        ✓ Đủ hàng
                      </span>
                    );
                  }

                  return (
                    <div
                      key={order.id}
                      onClick={() => handleToggleSelectTempOrder(order.id)}
                      className={`bg-white rounded-2xl border-2 p-4 flex flex-col justify-between gap-4 transition-all hover:shadow-md cursor-pointer select-none ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/5 ring-1 ring-indigo-600/10 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // toggled by card click
                              className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />
                            <div className="space-y-0.5">
                              <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1">
                                <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                                {order.branch}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-medium font-mono">{order.createdAt}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteTempOrder(order.id, e)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                            title="Xóa đơn hàng tạm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {validItemsCount} SKU
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                            {totalGlasses} miếng
                          </span>
                          {cardStatusBadge}
                        </div>
                      </div>

                      {/* Items Preview List */}
                      <div className="border-t border-b border-slate-100/80 py-3 my-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sản phẩm chi tiết</p>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-50/50 pr-1">
                          {order.items.map((item: any, i: number) => {
                            const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
                            const liveStock = liveProd?.TON_CUOI ?? 0;

                            let stockIndicator = null;
                            if (item.error) {
                              stockIndicator = <span className="text-[9px] font-bold text-rose-500">Lỗi cú pháp</span>;
                            } else if (liveStock <= 0) {
                              stockIndicator = <span className="text-[9px] font-bold text-rose-500 font-mono">Hết (Kho: 0)</span>;
                            } else if (liveStock < item.quantity) {
                              stockIndicator = <span className="text-[9px] font-bold text-amber-500 font-mono">Thiếu (Kho: {liveStock})</span>;
                            } else {
                              stockIndicator = <span className="text-[9px] font-medium text-emerald-600 font-mono">Đủ (Kho: {liveStock})</span>;
                            }

                            return (
                              <div key={item.id || i} className="flex items-start justify-between gap-2 text-xs pt-1.5 first:pt-0">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-700 font-sans leading-tight">
                                    {item.brand} {item.chietXuat} {item.tinhNang}
                                  </p>
                                  <p className="font-mono text-[10px] text-slate-400">
                                    SPH {formatDop(item.sph)} CYL {formatDop(item.cyl)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 space-y-0.5">
                                  <p className="font-bold text-slate-800">{item.quantity}M</p>
                                  {stockIndicator}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        {order.trangThai === 'Đã xuất' ? (
                          <div className="w-full bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold py-2.5 px-3 rounded-xl text-center flex items-center justify-center gap-1.5 cursor-not-allowed">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            Đã Xuất Kho ({order.soPhieuXuat})
                          </div>
                        ) : (
                          <button
                            onClick={(e) => handleCreateXuatFromTempOrder(order, e)}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 hover:shadow-sm text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Tạo Phiếu Xuất Kho
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEW BATCH PICKING FULL-SCREEN OVERLAY MODAL */}
      {isBatchPickingActive && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 overflow-y-auto flex items-start justify-center p-0 md:p-6 animate-fade-in" id="batch_picking_modal_overlay">
          <div className="bg-slate-50 min-h-screen md:min-h-0 md:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl md:my-4 flex flex-col overflow-hidden animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <button
                  onClick={() => setIsBatchPickingActive(false)}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider mb-1"
                >
                  <ArrowLeft className="w-4 h-4" /> Quay Lại
                </button>
                <h2 className="text-base md:text-xl font-sans font-extrabold flex items-center gap-2">
                  <Layers className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                  Quy Trình Gom Đơn & Lấy Hàng
                </h2>
                <p className="text-[11px] md:text-xs text-slate-400 font-sans leading-relaxed">
                  Soạn hàng gộp thông minh cho các đơn hàng tạm, xuất kho trực tiếp tiện lợi trên di động.
                </p>
              </div>

              {/* Action Buttons for PDF/Excel */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handlePrint}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-white text-[11px] md:text-xs font-bold py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                  id="print_picking_list_btn"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In PDF
                </button>

                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 hover:bg-emerald-500 hover:shadow-sm text-white text-[11px] md:text-xs font-bold py-2 px-3 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                  id="export_excel_picking_btn"
                >
                  <Download className="w-3.5 h-3.5" />
                  Excel CSV
                </button>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 md:px-6 shrink-0">
              <div className="max-w-3xl mx-auto">
                {/* Mobile step label */}
                <div className="block md:hidden text-center mb-1.5">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                    Bước {pickingStep} / 4
                  </span>
                  <p className="font-extrabold text-slate-800 text-sm">
                    {pickingStep === 1 && 'Chọn đơn hàng'}
                    {pickingStep === 2 && 'Gom đơn lấy hàng'}
                    {pickingStep === 3 && 'Xác nhận lấy hàng'}
                    {pickingStep === 4 && 'Tạo phiếu xuất'}
                  </p>
                </div>

                {/* Progress track */}
                <div className="relative flex items-center justify-between">
                  {/* Background Track Line */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-100 z-0 rounded-full" />
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 z-0 rounded-full transition-all duration-300" 
                    style={{ width: `${((pickingStep - 1) / 3) * 100}%` }}
                  />

                  {[
                    { num: 1, label: 'Chọn đơn hàng' },
                    { num: 2, label: 'Gom đơn lấy hàng' },
                    { num: 3, label: 'Xác nhận lấy hàng' },
                    { num: 4, label: 'Tạo phiếu xuất' }
                  ].map((st) => {
                    const isActive = pickingStep === st.num;
                    const isCompleted = pickingStep > st.num;
                    return (
                      <div key={st.num} className="relative z-10 flex flex-col items-center">
                        <button
                          onClick={() => {
                            if (st.num < pickingStep || (st.num > pickingStep && selectedTempOrderIds.length > 0)) {
                              setPickingStep(st.num);
                            }
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-bold text-xs transition-all ${
                            isCompleted 
                              ? 'bg-indigo-600 text-white ring-4 ring-indigo-50 shadow-sm' 
                              : isActive 
                                ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 font-extrabold shadow-md'
                                : 'bg-white border-2 border-slate-200 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : st.num}
                        </button>
                        <span className={`hidden md:block text-[10px] font-bold mt-1 text-center tracking-tight transition-colors ${
                          isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-400'
                        }`}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Persistent Picked Progress Bar */}
            <div className="bg-indigo-50/80 border-b border-indigo-100/40 px-4 py-2.5 md:px-6 shrink-0 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">Đã lấy:</span>
                <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200/60 px-2 py-0.5 rounded-lg shadow-2xs font-mono">
                  {pickingStats.pickedUniqueSkus} / {pickingStats.totalUniqueSkus} SKU
                </span>
                <span className="text-xs font-bold text-slate-500 font-mono hidden sm:inline">({pickingStats.pickedUnits} / {pickingStats.totalUnits} miếng)</span>
              </div>
              
              <div className="flex-1 max-w-md mx-2">
                <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden border border-slate-300/20">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${pickingStats.percent}%` }}
                  />
                </div>
              </div>
              
              <div className="shrink-0">
                <span className="text-xs font-black text-indigo-600 bg-white border border-indigo-200/60 px-2 py-0.5 rounded-md font-mono">
                  {pickingStats.percent}%
                </span>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 md:p-6 space-y-6 flex-1 overflow-y-auto max-h-[calc(100vh-220px)] md:max-h-[60vh]">
              
              {/* STEP 1: CHỌN ĐƠN HÀNG */}
              {pickingStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl">
                    <h3 className="font-sans font-bold text-indigo-900 text-sm">Bước 1: Chọn Đơn Hàng Soạn</h3>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Đã chọn <strong>{selectedTempOrderIds.length}</strong> / <strong>{tempOrders.length}</strong> đơn hàng tạm
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTempOrderIds(tempOrders.map(o => o.id))}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                      >
                        Chọn Tất Cả
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        onClick={() => setSelectedTempOrderIds([])}
                        className="text-xs font-bold text-slate-500 hover:text-slate-400 cursor-pointer"
                      >
                        Bỏ Chọn Hết
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {tempOrders.map((order) => {
                      const isChecked = selectedTempOrderIds.includes(order.id);
                      const isExported = order.trangThai === 'Đã xuất';
                      const itemsCount = order.items.filter((i: any) => !i.error).length;
                      const totalQty = order.items.reduce((sum: number, i: any) => sum + (i.error ? 0 : i.quantity), 0);

                      return (
                        <div
                          key={order.id}
                          onClick={() => {
                            if (isExported) return;
                            setSelectedTempOrderIds(prev => 
                              prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
                            );
                          }}
                          className={`bg-white rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                            isExported 
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                              : isChecked
                                ? 'border-indigo-600 bg-indigo-50/5 shadow-xs ring-1 ring-indigo-600/10'
                                : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isExported}
                                onChange={() => {}} // toggled by card click
                                className="w-4.5 h-4.5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <div>
                                <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1 flex-wrap">
                                  <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                                  {order.branch}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono">{order.createdAt}</p>
                              </div>
                            </div>

                            {isExported ? (
                              <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5 whitespace-nowrap">
                                <Check className="w-3 h-3" /> Đã xuất
                              </span>
                            ) : (
                              <span className="bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                                Chờ xuất
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 pt-1 border-t border-slate-100">
                            <span><strong>{itemsCount}</strong> SKU</span>
                            <span>•</span>
                            <span><strong>{totalQty}</strong> miếng</span>
                            {order.soPhieuXuat && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-indigo-600 font-bold">{order.soPhieuXuat}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: GOM ĐƠN LẤY HÀNG (CONSOLIDATED DICTIONARY VIEW) */}
              {pickingStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0 mt-0.5">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-sans font-bold text-emerald-900 text-sm">Bước 2: Gom Đơn Lấy Hàng (Tổng Hợp)</h3>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số lượng cần lấy</span>
                      <p className="text-base font-extrabold text-slate-800">
                        {pickingStats.totalUnits} miếng <span className="text-xs font-normal text-slate-400">({pickingStats.totalUniqueSkus} loại tròng)</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gom từ</span>
                      <p className="text-sm font-bold text-indigo-600">{selectedTempOrderIds.length} đơn hàng tạm</p>
                    </div>
                  </div>

                  {/* Collapsible Sorting Configuration Panel */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setIsSortingConfigOpen(!isSortingConfigOpen)}
                      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 flex items-center justify-between transition-colors cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span className="font-sans font-bold text-slate-700 text-xs uppercase tracking-wider">
                          Cấu Hình Thứ Tự Sắp Xếp Tròng Kính
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-medium font-mono">
                          (Tùy chỉnh độ ưu tiên)
                        </span>
                        {isSortingConfigOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isSortingConfigOpen && (
                      <div className="p-4 bg-white border-t border-slate-100 space-y-3 animate-fade-in">
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Sắp xếp độ ưu tiên từ trên xuống dưới (1 là cao nhất). Nhấp vào nút <strong>Lên</strong> hoặc <strong>Xuống</strong> để thay đổi thứ tự. Cấu hình tự động lưu cho các lần sau.
                        </p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {sortingPriority.map((field, idx) => {
                            const fieldLabels: Record<string, string> = {
                              brand: 'Thương hiệu (Brand)',
                              chietXuat: 'Chiết suất (Index)',
                              tinhNang: 'Tính năng (Feature)',
                              cyl: 'Độ CYL (Cylinder)',
                              sph: 'Độ SPH (Sphere)',
                              add: 'Độ ADD (Addition)',
                              sku: 'Mã SKU'
                            };
                            return (
                              <div 
                                key={field} 
                                className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="flex items-center justify-center w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-[10px] rounded-md font-mono">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-700">
                                    {fieldLabels[field] || field}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => movePriorityField(idx, 'UP')}
                                    className={`p-1.5 rounded-lg border transition-all ${
                                      idx === 0 
                                        ? 'border-slate-100 text-slate-300 cursor-not-allowed' 
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-90 cursor-pointer'
                                    }`}
                                    title="Di chuyển lên trên"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === sortingPriority.length - 1}
                                    onClick={() => movePriorityField(idx, 'DOWN')}
                                    className={`p-1.5 rounded-lg border transition-all ${
                                      idx === sortingPriority.length - 1 
                                        ? 'border-slate-100 text-slate-300 cursor-not-allowed' 
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-100 active:scale-90 cursor-pointer'
                                    }`}
                                    title="Di chuyển xuống dưới"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expand/Collapse All */}
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => {
                        const next: Record<string, boolean> = {};
                        batchPickingData.forEach(g => {
                          next[`${g.brand.toUpperCase()} - ${g.chietXuat}`] = true;
                        });
                        setExpandedGroups(next);
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    >
                      Mở rộng tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => {
                        const next: Record<string, boolean> = {};
                        batchPickingData.forEach(g => {
                          next[`${g.brand.toUpperCase()} - ${g.chietXuat}`] = false;
                        });
                        setExpandedGroups(next);
                      }}
                      className="font-bold text-slate-500 hover:text-slate-400 cursor-pointer"
                    >
                      Thu gọn tất cả
                    </button>
                  </div>

                  {/* Grouped Cards list */}
                  <div className="space-y-4">
                    {batchPickingData.length === 0 ? (
                      <p className="text-center text-slate-400 py-8 italic bg-white border border-slate-100 rounded-2xl">
                        Không có sản phẩm nào để gom. Vui lòng chọn đơn có sản phẩm hợp lệ!
                      </p>
                    ) : (
                      batchPickingData.map((group, groupIndex) => {
                        const groupKey = `${group.brand.toUpperCase()} - ${group.chietXuat}`;
                        const isExpanded = expandedGroups[groupKey] !== false; // defaults to true
                        const totalGroupQty = group.items.reduce((sum, item) => sum + item.totalQty, 0);

                        return (
                          <div key={groupKey} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                            {/* Group Header - Clickable */}
                            <div 
                              onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                              className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 select-none"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                                <span className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                                  {group.brand} — Chiết suất {group.chietXuat}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">
                                  {group.items.length} SKU
                                </span>
                                <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full font-mono">
                                  {totalGroupQty} Miếng
                                </span>
                              </div>
                            </div>

                            {/* Group items - Card format for mobile */}
                            {isExpanded && (
                              <div className="p-3 md:p-4 space-y-3 bg-white divide-y divide-slate-100">
                                {group.items.map((item) => {
                                  const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
                                  const liveStock = liveProd?.TON_CUOI ?? 0;

                                  return (
                                    <div key={item.sku} className="pt-3 first:pt-0 flex flex-col gap-2.5">
                                      {/* Product Detail row */}
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono font-extrabold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                              SPH {formatDop(item.sph)}
                                            </span>
                                            {item.cyl !== 0 && (
                                              <span className="font-mono font-extrabold text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                                CYL {formatDop(item.cyl)}
                                              </span>
                                            )}
                                          </div>
                                          <p className="font-semibold text-slate-800 text-xs leading-snug">
                                            {item.brand} {item.chietXuat} {item.tinhNang}
                                          </p>
                                          <p className="font-mono text-[10px] text-slate-400">SKU: {item.sku}</p>
                                        </div>

                                        {/* Quantity bubble */}
                                        <div className="text-right shrink-0">
                                          <div className="inline-flex flex-col items-center justify-center bg-indigo-600 text-white font-sans font-black text-sm px-4 py-2.5 rounded-xl shadow-xs leading-none">
                                            <span>{item.totalQty}</span>
                                            <span className="text-[8px] font-normal uppercase mt-0.5">Miếng</span>
                                          </div>
                                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Kho: {liveStock}</p>
                                        </div>
                                      </div>

                                      {/* Branch Breakdown */}
                                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex flex-wrap gap-1.5 items-center">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Phân bổ:</span>
                                        {item.origins.map((o, oi) => (
                                          <span key={oi} className="bg-white border border-slate-200 text-slate-700 font-bold font-mono text-[10px] px-2 py-0.5 rounded-md">
                                            {o.branch}: {o.qty}M
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: XÁC NHẬN ĐÃ LẤY HÀNG (INTERACTIVE TICK OFF) */}
              {pickingStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl">
                    <h3 className="font-sans font-bold text-indigo-900 text-sm">Bước 3: Xác Nhận Đã Lấy Hàng</h3>
                  </div>

                  {/* Interactive Progress Tracking */}
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                      <span className="font-sans font-bold text-slate-700 uppercase tracking-wider">Tiến Độ Lấy Hàng Thực Tế</span>
                      <span className="font-mono font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                        Đã lấy {pickingStats.pickedUniqueSkus} / {pickingStats.totalUniqueSkus} loại tròng ({pickingStats.pickedUnits} / {pickingStats.totalUnits} miếng) — {pickingStats.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{ width: `${pickingStats.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick helper */}
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => {
                        const next: Record<string, boolean> = {};
                        batchPickingData.forEach(g => {
                          g.items.forEach(i => {
                            next[i.sku] = true;
                          });
                        });
                        setPickedItemsState(next);
                      }}
                      className="font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                    >
                      Đánh dấu tất cả Đã Lấy
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => {
                        setPickedItemsState({});
                      }}
                      className="font-bold text-slate-500 hover:text-slate-400 cursor-pointer"
                    >
                      Đặt lại (Chưa lấy)
                    </button>
                  </div>

                  {/* Checklist with large checkboxes */}
                  <div className="space-y-4">
                    {batchPickingData.map((group, groupIndex) => {
                      const groupKey = `${group.brand.toUpperCase()} - ${group.chietXuat}`;
                      const isExpanded = expandedGroups[groupKey] !== false;
                      const groupPickedCount = group.items.filter(i => pickedItemsState[i.sku]).length;

                      return (
                        <div key={groupKey} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition-all">
                          {/* Group header */}
                          <div 
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                            className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                              )}
                              <span className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                                {group.brand} — Chiết suất {group.chietXuat}
                              </span>
                            </div>
                            <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                              Đã lấy {groupPickedCount} / {group.items.length}
                            </span>
                          </div>

                          {/* Interactive Card Rows */}
                          {isExpanded && (
                            <div className="p-3 md:p-4 space-y-3 bg-white divide-y divide-slate-100">
                              {group.items.map((item) => {
                                const isPicked = !!pickedItemsState[item.sku];
                                const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
                                const liveStock = liveProd?.TON_CUOI ?? 0;

                                return (
                                  <div 
                                    key={item.sku}
                                    onClick={() => handleTogglePickedSku(item.sku)}
                                    className={`pt-3 first:pt-0 flex items-center gap-4 cursor-pointer select-none group transition-colors p-1 rounded-xl ${
                                      isPicked ? 'opacity-50' : 'hover:bg-slate-50/50'
                                    }`}
                                  >
                                    {/* Large Touch-friendly Checkbox */}
                                    <div className="shrink-0 p-1.5 rounded-xl hover:bg-indigo-50/50 active:scale-90 transition-transform">
                                      {isPicked ? (
                                        <CheckSquare className="w-6 h-6 text-indigo-600" />
                                      ) : (
                                        <Square className="w-6 h-6 text-slate-300 group-hover:text-slate-400" />
                                      )}
                                    </div>

                                    {/* Item detail */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-md ${
                                          isPicked ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-900'
                                        }`}>
                                          SPH {formatDop(item.sph)}
                                        </span>
                                        {item.cyl !== 0 && (
                                          <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-md ${
                                            isPicked ? 'bg-slate-200 text-slate-400' : 'bg-amber-50 border border-amber-100 text-amber-700'
                                          }`}>
                                            CYL {formatDop(item.cyl)}
                                          </span>
                                        )}
                                      </div>
                                      <p className={`font-semibold text-xs leading-snug mt-1 truncate ${
                                        isPicked ? 'text-slate-400 line-through' : 'text-slate-800'
                                      }`}>
                                        {item.brand} {item.chietXuat} {item.tinhNang}
                                      </p>
                                      <p className="font-mono text-[9px] text-slate-400 tracking-tight">SKU: {item.sku}</p>
                                    </div>

                                    {/* Large Bold Quantity Bubble */}
                                    <div className="text-right shrink-0">
                                      <span className={`font-black text-sm block ${isPicked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                        {item.totalQty} Miếng
                                      </span>
                                      <span className="text-[9px] text-slate-400 block font-mono">Kho: {liveStock}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: TẠO PHIẾU XUẤT (VERIFICATION & ACTION SCREEN) */}
              {pickingStep === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-amber-50/50 border border-amber-100/50 p-4 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-sans font-bold text-amber-900 text-sm">Bước 4: Tạo Phiếu Xuất</h3>
                    </div>
                  </div>

                  {exportError && (
                    <div className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-rose-700">
                        <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
                        <h4 className="font-sans font-bold text-sm">Không thể tạo phiếu xuất (Vượt quá tồn kho thực tế)!</h4>
                      </div>
                      <div className="text-xs text-rose-800 space-y-1 pl-7">
                        {exportError.map((err, idx) => (
                          <div key={idx} className="font-semibold">• {err}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pickingStats.pickedUniqueSkus < pickingStats.totalUniqueSkus ? (
                    <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-3.5 rounded-r-xl flex items-center gap-2.5 shadow-2xs animate-fade-in">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs font-black text-amber-950">
                        Còn thiếu {pickingStats.totalUniqueSkus - pickingStats.pickedUniqueSkus} SKU chưa lấy. Đã lấy {pickingStats.pickedUniqueSkus}/{pickingStats.totalUniqueSkus} SKU.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border-l-4 border-emerald-500 text-emerald-950 p-3.5 rounded-r-xl flex items-center gap-2.5 shadow-2xs animate-fade-in">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <p className="text-xs font-black text-emerald-950">
                        Đã gom đầy đủ {pickingStats.totalUniqueSkus}/{pickingStats.totalUniqueSkus} SKU. Sẵn sàng tạo phiếu xuất!
                      </p>
                    </div>
                  )}

                  {/* List of orders with verification results */}
                  <div className="space-y-4">
                    {tempOrders.filter(o => selectedTempOrderIds.includes(o.id)).map((order) => {
                      const isExported = order.trangThai === 'Đã xuất';
                      
                      const orderItems = order.items.filter((item: any) => !item.error && item.sku);
                      const pickedCount = orderItems.filter((item: any) => !!pickedItemsState[item.sku]).length;
                      const isFullyPicked = pickedCount === orderItems.length && orderItems.length > 0;
                      
                      // Auto enforce partial if not fully picked
                      const mode = isFullyPicked ? (orderExportModes[order.id] || 'FULL') : 'PARTIAL';

                      // Compile stock checklist for this specific order
                      const stockIssues: { item: any; inStock: number }[] = [];
                      let isOk = true;

                      orderItems.forEach((item: any) => {
                        const liveProd = sanPhams.find(p => cleanSKU(p.SKU) === cleanSKU(item.sku));
                        const liveStock = liveProd?.TON_CUOI ?? 0;

                        if (liveStock < item.quantity) {
                          isOk = false;
                          stockIssues.push({ item, inStock: liveStock });
                        }
                      });

                      return (
                        <div key={order.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 space-y-4">
                          {/* Header section of the card */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div>
                              <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                {order.branch}
                              </h4>
                              <p className="text-[10px] text-slate-400 font-mono">Đơn tạm: {order.id}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              {isExported ? (
                                <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                  <Check className="w-3.5 h-3.5" /> Đã xuất ({order.soPhieuXuat})
                                </span>
                              ) : isOk ? (
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                  ✓ Sẵn sàng xuất kho
                                </span>
                              ) : (
                                <span className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                                  ⚠️ Thiếu hàng ({stockIssues.length} SKU)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Display Stock issues details if any */}
                          {stockIssues.length > 0 && !isExported && (
                            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 space-y-2">
                              <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Danh sách SKU bị thiếu trong kho:</p>
                              <div className="divide-y divide-rose-100 space-y-1.5">
                                {stockIssues.map(({ item, inStock }, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-xs pt-1.5 first:pt-0 gap-2">
                                    <div>
                                      <p className="font-semibold text-rose-900 leading-tight">
                                        {item.brand} {item.chietXuat} {item.tinhNang}
                                      </p>
                                      <p className="text-[10px] text-rose-600 font-mono mt-0.5">
                                        SPH {formatDop(item.sph)} CYL {formatDop(item.cyl)} — {item.sku}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-extrabold text-rose-900">Yêu cầu: {item.quantity}M</span>
                                      <span className="text-[10px] text-rose-600 block">Trong kho: {inStock}M</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Options/Actions for this specific order if NOT exported yet */}
                          {!isExported && (
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-slate-100 mt-2">
                              <span className="text-[11px] text-slate-400 font-medium italic">
                                * Mỗi thẻ đơn tạo một phiếu xuất riêng biệt.
                              </span>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={!isFullyPicked}
                                  onClick={() => setOrderExportModes(prev => ({ ...prev, [order.id]: 'FULL' }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    !isFullyPicked
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                      : mode === 'FULL' 
                                        ? 'bg-indigo-600 text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title={!isFullyPicked ? "Cần tích đủ 100% SKU ở bước 3 để chọn Xuất Đầy Đủ" : "Xuất đầy đủ số lượng"}
                                >
                                  Xuất Đầy Đủ ({pickedCount}/{orderItems.length} SKU)
                                </button>
                                <button
                                  type="button"
                                  disabled={isFullyPicked}
                                  onClick={() => setOrderExportModes(prev => ({ ...prev, [order.id]: 'PARTIAL' }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    isFullyPicked
                                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                      : mode === 'PARTIAL' 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title={isFullyPicked ? "Đã gom đủ 100% SKU, vui lòng chọn Xuất Đầy Đủ" : "Chỉ xuất các SKU đã được gom ở bước 3"}
                                >
                                  Xuất Một Phần ({pickedCount}/{orderItems.length} SKU)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOrderExportModes(prev => ({ ...prev, [order.id]: 'CANCEL' }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    mode === 'CANCEL' 
                                      ? 'bg-rose-600 text-white shadow-xs' 
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                  title="Hủy không tạo phiếu xuất kho cho đơn hàng tạm này"
                                >
                                  Bỏ Qua (Hủy)
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generous Bottom Spacer to prevent cut-off on mobile viewport/sticky footer */}
              <div className="h-28 shrink-0" />

            </div>

            {/* Sticky Action Footer (Tối ưu thao tác một tay ở cuối màn hình) */}
            <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex items-center justify-between gap-4 sticky bottom-0 z-20 shadow-lg">
              
              {/* Back Button */}
              {pickingStep > 1 ? (
                <button
                  onClick={() => setPickingStep(prev => prev - 1)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold py-3 px-5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Quay Lại
                </button>
              ) : (
                <button
                  onClick={() => setIsBatchPickingActive(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-bold py-3 px-5 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                >
                  Đóng Lại
                </button>
              )}

              {/* Next/Create Invoice Buttons */}
              {pickingStep < 4 ? (
                <button
                  onClick={() => {
                    if (selectedTempOrderIds.length === 0) {
                      if (onTriggerToast) onTriggerToast('Vui lòng chọn ít nhất một thẻ đơn hàng!', 'warning');
                      return;
                    }
                    setPickingStep(prev => prev + 1);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-sans font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Tiếp Tục</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleExecuteBatchExport}
                  className="bg-emerald-600 hover:bg-emerald-500 hover:shadow-sm text-white font-sans font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Tạo Phiếu Xuất
                </button>
              )}

            </div>

          </div>
        </div>
      )}

      {/* Toast Confirmation UI */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999]"
          >
            <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0 border border-rose-500/20">
                  <Trash2 className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-sans font-bold text-sm text-slate-100">
                    {deleteConfirm.message}
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-normal font-sans">
                    Thao tác này chỉ dọn dẹp các đơn tạm và hoàn toàn không ảnh hưởng tới phiếu xuất hay tồn kho.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="py-2 px-3.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={executeDelete}
                  className="py-2 px-4.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-950/20 cursor-pointer active:scale-95"
                >
                  Xóa
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
