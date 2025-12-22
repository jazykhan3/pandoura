/**
 * Task 3.5 - Symbol Summary Component
 * Displays categorized list of all imported symbols
 * Read-only table with filtering and search
 */

import { useState, useMemo } from 'react';
import { Search, Filter, FileCode, Boxes, Tag as TagIcon, Settings } from 'lucide-react';
import type { SymbolInfo } from '../../types/import';

interface SymbolSummaryProps {
  symbols: SymbolInfo[];
  onSymbolSelect?: (symbol: SymbolInfo) => void;
  className?: string;
}

export function SymbolSummary({ symbols, onSymbolSelect, className = '' }: SymbolSummaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter symbols based on search and category
  const filteredSymbols = useMemo(() => {
    return symbols.filter(symbol => {
      const matchesSearch = symbol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           symbol.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || symbol.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [symbols, searchTerm, selectedCategory]);

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts = {
      all: symbols.length,
      POU: 0,
      Type: 0,
      Variable: 0,
      Instruction: 0
    };
    
    symbols.forEach(symbol => {
      counts[symbol.category]++;
    });
    
    return counts;
  }, [symbols]);

  return (
    <div className={`symbol-summary flex flex-col h-full ${className}`}>
      {/* Header Controls */}
      <div className="symbol-summary-controls flex items-center gap-4 mb-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text"
            placeholder="Search symbols..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All ({categoryCounts.all})</option>
            <option value="POU">POUs ({categoryCounts.POU})</option>
            <option value="Type">Types ({categoryCounts.Type})</option>
            <option value="Variable">Variables ({categoryCounts.Variable})</option>
            <option value="Instruction">Instructions ({categoryCounts.Instruction})</option>
          </select>
        </div>
      </div>

      {/* Symbol Count */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Showing {filteredSymbols.length} of {symbols.length} symbols
      </div>

      {/* Symbols Table */}
      <div className="flex-1 overflow-auto border border-gray-300 dark:border-gray-700 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Symbol
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                ID
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredSymbols.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No symbols found
                </td>
              </tr>
            ) : (
              filteredSymbols.map(symbol => (
                <tr 
                  key={symbol.id}
                  onClick={() => onSymbolSelect?.(symbol)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(symbol.category)}
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {symbol.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryBadgeClass(symbol.category)}`}>
                      {symbol.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {symbol.type}
                  </td>
                  <td className="px-4 py-3">
                    {symbol.dataType && (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">
                        {symbol.dataType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {symbol.sourceFile && (
                      <div className="flex flex-col">
                        <span className="truncate max-w-xs">{symbol.sourceFile}</span>
                        {symbol.lineNumber && (
                          <span className="text-xs text-gray-500">Line {symbol.lineNumber}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {symbol.canonicalId && (
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {symbol.canonicalId.slice(0, 12)}...
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getCategoryIcon(category: string) {
  const iconClass = "w-4 h-4";
  
  switch (category) {
    case 'POU':
      return <FileCode className={`${iconClass} text-blue-500`} />;
    case 'Type':
      return <Boxes className={`${iconClass} text-orange-500`} />;
    case 'Variable':
      return <TagIcon className={`${iconClass} text-green-500`} />;
    case 'Instruction':
      return <Settings className={`${iconClass} text-gray-500`} />;
    default:
      return <FileCode className={`${iconClass} text-gray-500`} />;
  }
}

function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case 'POU':
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
    case 'Type':
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
    case 'Variable':
      return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
    case 'Instruction':
      return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}
