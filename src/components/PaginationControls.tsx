import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showLabels?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showLabels = true
}) => {
  const [inputValue, setInputValue] = useState<string>(String(currentPage));

  useEffect(() => {
    setInputValue(String(currentPage));
  }, [currentPage]);

  const handleJump = () => {
    const pageNum = parseInt(inputValue, 10);
    if (!isNaN(pageNum)) {
      const validPage = Math.max(1, Math.min(totalPages, pageNum));
      onPageChange(validPage);
      setInputValue(String(validPage));
    } else {
      setInputValue(String(currentPage));
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-1.5">
      {/* 最初のページへ */}
      <button
        disabled={currentPage <= 1}
        onClick={() => onPageChange(1)}
        title="最初のページへ"
        className="px-2 py-1 sm:px-2.5 sm:py-1.5 border border-zinc-900 dark:border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold flex items-center gap-1 text-xs"
      >
        <ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {showLabels && <span className="hidden sm:inline">最初</span>}
      </button>

      {/* 前へ */}
      <button
        disabled={currentPage <= 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        title="前のページへ"
        className="px-2 py-1 sm:px-2.5 sm:py-1.5 border border-zinc-900 dark:border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold flex items-center gap-1 text-xs"
      >
        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        {showLabels && <span className="hidden sm:inline">前へ</span>}
      </button>

      {/* ページ番号直接入力 */}
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 sm:px-2 sm:py-1 border border-zinc-900 dark:border-zinc-200 text-xs">
        {showLabels && (
          <span className="text-zinc-500 dark:text-zinc-400 font-bold hidden sm:inline">
            ページ
          </span>
        )}
        <input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJump();
          }}
          onBlur={handleJump}
          className="w-10 sm:w-12 py-0.5 text-center bg-white dark:bg-zinc-900 border border-zinc-400 dark:border-zinc-600 font-bold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
        />
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          / {totalPages}
        </span>
      </div>

      {/* 次へ */}
      <button
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        title="次のページへ"
        className="px-2 py-1 sm:px-2.5 sm:py-1.5 border border-zinc-900 dark:border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold flex items-center gap-1 text-xs"
      >
        {showLabels && <span className="hidden sm:inline">次へ</span>}
        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>

      {/* 最後のページへ */}
      <button
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(totalPages)}
        title="最後のページへ"
        className="px-2 py-1 sm:px-2.5 sm:py-1.5 border border-zinc-900 dark:border-zinc-200 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-bold flex items-center gap-1 text-xs"
      >
        {showLabels && <span className="hidden sm:inline">最後</span>}
        <ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
};
