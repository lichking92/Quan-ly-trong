import React, { useState, useMemo, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { SanPham } from '../types';
import { generateSKUString, formatDop } from '../data/mockData';

// Normalized helper to clean SKU strings for comparison
const cleanSKU = (sku: string | undefined | null): string => {
  if (!sku) return '';
  return sku.trim().replace(/\s+/g, ' ').toUpperCase();
};

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

interface OrderParserProps {
  sanPhams: SanPham[];
  brandList: any[]; // b_thuonghieu list
  onCreateXuatPhieu: (items: { sku: string; soLuong: number; }[]) => void;
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
}

export default function OrderParser({ sanPhams, brandList, onCreateXuatPhieu }: OrderParserProps) {
  const [message, setMessage] = useState<string>('');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedDeficient, setCopiedDeficient] = useState<boolean>(false);

  const [selectedBrand, setSelectedBrand] = useState<string>('');

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

  // Core parsing algorithm
  const handleAnalyze = (overrideBrand?: string) => {
    if (!message.trim()) {
      setParsedItems([]);
      setHasAnalyzed(true);
      return;
    }

    const lines = message.split('\n');
    const results: ParsedItem[] = [];

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

    console.log('[OrderParser Debug] Initialized Parser Config:');
    console.log('  - Active Fallback Brand:', activeFallbackBrand);
    console.log('  - Registered Brands:', uniqueBrands);
    console.log('  - Registered Chiết Suấts:', uniqueChietXuats);
    console.log('  - Registered Features:', uniqueFeatures);

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

      // Find Brand
      for (const b of uniqueBrands) {
        if (containsWord(lineUpper, b)) {
          foundBrand = b;
          break;
        }
      }

      // Find Chiết suất
      for (const cx of uniqueChietXuats) {
        if (containsWord(lineUpper, cx)) {
          foundChiet = cx;
          break;
        }
      }
      if (!foundChiet) {
        for (const sh of ['156', '160', '161', '167', '174']) {
          if (containsWord(lineUpper, sh)) {
            foundChiet = normalizeChietXuat(sh);
            break;
          }
        }
      }

      // Find Feature
      for (const f of uniqueFeatures) {
        if (containsWord(lineUpper, f)) {
          const fUpper = f.toUpperCase();
          if (fUpper === 'ĐM' || fUpper === 'ĐỔI MÀU' || fUpper === 'DOI MAU') {
            foundFeat = 'ĐM';
          } else if (fUpper === 'ASX' || fUpper === 'ASG' || fUpper === 'BLUE' || fUpper === 'BLUE CUT') {
            foundFeat = 'ASX';
          } else {
            foundFeat = f;
          }
          break;
        }
      }

      // Context Tracking & Reset/Update logic:
      // Whenever we encounter any title components in a line (brand, chiet, feat), we update the context.
      // If we are starting a group (because of a brand/chiet/feat change or new title-only line), 
      // we resolve missing parts using the brand config defaults.
      if (foundBrand || foundChiet || foundFeat) {
        const resolvedBrand = foundBrand || activeFallbackBrand || '';
        
        let resolvedChiet = foundChiet;
        let resolvedFeat = foundFeat;

        // Find default config from brandList
        const brandConfig = brandList.find(b => 
          (b.THUONG_HIEU || '').toUpperCase().trim() === resolvedBrand.toUpperCase().trim()
        );
        if (brandConfig) {
          if (!resolvedChiet) resolvedChiet = brandConfig.CHIET_XUAT_MAC_DINH || '';
          if (!resolvedFeat) resolvedFeat = brandConfig.TINH_NANG_MAC_DINH || brandConfig.TINH_NANG || '';
        }

        // If still missing, check in sanPhams for any sample product of this brand
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
              matchedProduct
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

  // Individual parsed item deletion
  const handleDeleteParsedItem = (id: string) => {
    setParsedItems(prev => prev.filter(item => item.id !== id));
  };

  // Bulk remove unfulfillable/unavailable items
  const handleRemoveUnavailableSKUs = () => {
    setParsedItems(prev => prev.filter(item => {
      if (item.error) return false;
      if (!item.matchedProduct) return false;
      const stock = item.matchedProduct.TON_CUOI;
      return stock >= item.quantity;
    }));
  };

  // Auto transition whole order to transaction sales form
  const handleCreateXuat = () => {
    const validItems = parsedItems
      .filter(item => !item.error && item.matchedProduct && item.matchedProduct.TON_CUOI >= item.quantity)
      .map(item => ({
        sku: item.sku,
        soLuong: item.quantity
      }));
    
    if (validItems.length > 0) {
      onCreateXuatPhieu(validItems);
    }
  };

  return (
    <div className="space-y-6" id="order_parser_container">
      {/* Header section with instructions */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-sans font-bold text-slate-800 text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            Kiểm Tra Đơn Hàng Tự Động
          </h2>
          <p className="text-xs text-slate-500">
            Dán trực tiếp tin nhắn đặt hàng của Khách hàng, hệ thống tự động nhận diện SKU tròng kính, bóc tách độ cầu (SPH), độ loạn (CYL) và tra cứu tồn kho live ngay lập tức.
          </p>
        </div>
        <div className="bg-indigo-50/60 border border-indigo-100/50 p-3 rounded-xl max-w-sm">
          <p className="text-[10px] font-mono font-bold text-indigo-700 uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Chuẩn tin nhắn hỗ trợ:
          </p>
          <p className="text-[10px] text-indigo-600/90 leading-relaxed font-sans mt-1">
            Mỗi khối bắt đầu bằng tên dòng <strong>Thương hiệu + Chiết xuất + Tính năng</strong> (VD: <em>HEN ASX 1.56</em>), tiếp theo là danh sách dòng độ cầu + loạn + số lượng (VD: <em>-2,00 -0,50 1M</em>).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Panel */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
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

            <button
              onClick={handleAnalyze}
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
                Hãy nhập nội dung tin nhắn của khách hàng ở khung bên trái rồi bấm nút <strong>Phân Tích Đơn Hàng</strong> để hiển thị kết quả đối chiếu tồn kho chi tiết.
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

              {/* Status banner and primary action */}
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
                          ⚠️ CẦN BỔ SUNG KHO HOẶC THIẾU HÀNG
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {parsedItems.some(item => !item.error && item.matchedProduct && item.matchedProduct.TON_CUOI >= item.quantity) ? (
                      <button
                        onClick={handleCreateXuat}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        id="generate_invoice_from_parser_btn"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Tạo Phiếu Xuất ({parsedItems.filter(item => !item.error && item.matchedProduct && item.matchedProduct.TON_CUOI >= item.quantity).length} SKU)
                      </button>
                    ) : (
                      <div className="text-[11px] text-slate-400 font-medium italic">
                        * Không có SKU nào đủ hàng để tạo phiếu xuất
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
                    className="flex-1 min-w-[150px] bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold py-2 px-3 rounded-lg border border-amber-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    id="copy_deficient_results_btn"
                  >
                    {copiedDeficient ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-amber-600" />}
                    {copiedDeficient ? 'Đã copy danh sách thiếu!' : 'Copy Danh Sách Thiếu Hàng'}
                  </button>

                  {!stats.isAllSufficient && parsedItems.some(item => item.error || !item.matchedProduct || item.matchedProduct.TON_CUOI < item.quantity) && (
                    <button
                      onClick={handleRemoveUnavailableSKUs}
                      className="flex-1 min-w-[150px] bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-2 px-3 rounded-lg border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
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
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left border-collapse font-sans">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase">Thông số diopter / SKU</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-20">Yêu cầu</th>
                          <th className="py-2.5 px-3 text-[10px] font-bold text-slate-400 uppercase text-center w-20">Kho thực tế</th>
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
                                <td colSpan={4} className="py-2.5 px-3">
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
                                <AlertTriangle className="w-3 h-3" /> Chỉ còn {stock} miếng
                              </span>
                            );
                            rowClass = "bg-amber-50/10 hover:bg-amber-50/20";
                            textClass = "text-amber-700 font-bold";
                          } else {
                            statusBadge = (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 bg-emerald-50 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-100">
                                <CheckCircle className="w-3 h-3" /> Còn
                              </span>
                            );
                          }

                          return (
                            <tr key={item.id} className={rowClass}>
                              <td className="py-2.5 px-3">
                                <div className="space-y-0.5">
                                  <p className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-slate-500 bg-slate-100 px-1 py-0.2 rounded text-[10px]">{item.brand}</span>
                                    <span>SPH {sphStr}</span>
                                    <span>CYL {cylStr}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono tracking-tight">{item.sku || 'N/A'}</p>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                                {item.quantity} <span className="text-[9px] text-slate-400 font-normal">{item.unit}</span>
                              </td>
                              <td className={`py-2.5 px-3 text-center font-mono font-bold ${textClass}`}>
                                {hasProduct ? stock : 0}
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
    </div>
  );
}
