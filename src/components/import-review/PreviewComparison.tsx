/**
 * Task 3.5 - Preview Comparison Component
 * Side-by-side read-only preview of source vs normalized content
 * Displays diffs and line mappings
 */

import { useState, useMemo } from 'react';
import { FileCode, ArrowRight, Copy, Check } from 'lucide-react';
import type { PreviewComparison } from '../../types/import';

interface PreviewComparisonProps {
  comparison: PreviewComparison;
  className?: string;
}

export function PreviewComparison({ comparison, className = '' }: PreviewComparisonProps) {
  const [copied, setCopied] = useState<'source' | 'normalized' | null>(null);

  const sourceLines = useMemo(() => 
    comparison.sourceContent.split('\n'), 
    [comparison.sourceContent]
  );

  const normalizedLines = useMemo(() => 
    comparison.normalizedContent.split('\n'), 
    [comparison.normalizedContent]
  );

  const handleCopy = async (content: string, type: 'source' | 'normalized') => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`preview-comparison flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <span className="font-medium text-gray-800 dark:text-gray-200">
            {comparison.sourceFile}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span>{sourceLines.length} lines</span>
          <ArrowRight className="w-4 h-4" />
          <span>{normalizedLines.length} lines</span>
        </div>
      </div>

      {/* Side-by-Side Preview */}
      <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
        {/* Source Panel */}
        <div className="flex flex-col border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Source (Vendor Format)
            </span>
            <button
              onClick={() => handleCopy(comparison.sourceContent, 'source')}
              className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              title="Copy source"
            >
              {copied === 'source' ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
            <pre className="p-4 text-xs font-mono">
              <code className="text-gray-800 dark:text-gray-200">
                {sourceLines.map((line, index) => (
                  <div key={index} className="flex hover:bg-gray-100 dark:hover:bg-gray-800">
                    <span className="inline-block w-12 text-right pr-4 text-gray-500 dark:text-gray-500 select-none">
                      {index + 1}
                    </span>
                    <span className="flex-1">{line || '\n'}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>

        {/* Normalized Panel */}
        <div className="flex flex-col border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Normalized (Canonical Format)
            </span>
            <button
              onClick={() => handleCopy(comparison.normalizedContent, 'normalized')}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 transition-colors"
              title="Copy normalized"
            >
              {copied === 'normalized' ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
            <pre className="p-4 text-xs font-mono">
              <code className="text-gray-800 dark:text-gray-200">
                {normalizedLines.map((line, index) => (
                  <div key={index} className="flex hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    <span className="inline-block w-12 text-right pr-4 text-gray-500 dark:text-gray-500 select-none">
                      {index + 1}
                    </span>
                    <span className="flex-1">{line || '\n'}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>

      {/* Diff Stats (if available) */}
      {comparison.diff && comparison.diff.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-4">
            <span className="font-medium">Changes:</span>
            <span className="text-green-600 dark:text-green-400">
              +{comparison.diff.filter(d => d.type === 'added').length} additions
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{comparison.diff.filter(d => d.type === 'removed').length} deletions
            </span>
            <span className="text-yellow-600 dark:text-yellow-400">
              ~{comparison.diff.filter(d => d.type === 'modified').length} modifications
            </span>
          </div>
        </div>
      )}

      {/* Read-Only Notice */}
      <div className="mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-300">
        <strong>Read-Only:</strong> This is a preview comparison. No configuration changes can be made from this screen.
      </div>
    </div>
  );
}
