import React from 'react';
import {
  X,
  Filter,
  SlidersHorizontal,
  CheckSquare,
  Square,
  RotateCcw,
  Search,
  ArrowUpDown,
  Github,
  Globe,
  Package,
  Layers,
  ListFilter
} from 'lucide-react';
import { FilterState, PageSize } from '../types';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  availableTypes: { name: string; count: number }[];
  matchedCount: number;
  totalCount: number;
  onResetFilters: () => void;
  isAllVisibleSelected: boolean;
  onSelectAllVisible: () => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  filterState,
  onFilterChange,
  availableTypes,
  matchedCount,
  totalCount,
  onResetFilters,
  isAllVisibleSelected,
  onSelectAllVisible
}) => {
  // Local state for search input to prevent IME conversion interrupts
  const [localSearch, setLocalSearch] = React.useState(filterState.searchQuery);

  React.useEffect(() => {
    setLocalSearch(filterState.searchQuery);
  }, [filterState.searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ searchQuery: localSearch, currentPage: 1 });
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    onFilterChange({ searchQuery: '', currentPage: 1 });
  };

  // Handle category checkbox toggle
  const handleToggleCategory = (catName: string) => {
    let current = [...filterState.selectedTypes];
    if (current.includes(catName)) {
      current = current.filter((c) => c !== catName);
    } else {
      current.push(catName);
    }
    onFilterChange({ selectedTypes: current, currentPage: 1 });
  };

  // Select all categories
  const handleSelectAllCategories = () => {
    const allNames = availableTypes.map((t) => t.name);
    onFilterChange({ selectedTypes: allNames, currentPage: 1 });
  };

  // Clear all categories
  const handleClearAllCategories = () => {
    onFilterChange({ selectedTypes: [], currentPage: 1 });
  };

  const isAllCategoriesSelected =
    availableTypes.length > 0 &&
    availableTypes.every((t) => filterState.selectedTypes.includes(t.name));

  // Sidebar Content JSX
  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono">
      {/* Header for Mobile only (hidden on desktop) */}
      <div className="md:hidden p-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-between border-b border-zinc-900 dark:border-zinc-100 shrink-0">
        <div className="flex items-center gap-2 font-bold text-sm">
          <SlidersHorizontal className="w-4 h-4" />
          <span>フィルター & 表示設定</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Banner Notice (Moved from Main App) */}
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border-l-4 border-zinc-900 dark:border-zinc-100 space-y-2">
          <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Package className="w-4 h-4 shrink-0" />
            <span className="leading-tight">YMM4 プラグイン<br/>統合ディレクトリ</span>
          </div>
          <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
            ManjuBox公式データ・GitHub公開プラグインの最新情報を取得しています。
          </p>
        </div>

        {/* Quick Batch Actions */}
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 space-y-2">
          <div className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
            一括選択操作
          </div>
          <button
            onClick={onSelectAllVisible}
            className="w-full py-2 px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            {isAllVisibleSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            <span>{isAllVisibleSelected ? '現在のページの選択解除' : '現在のページを全選択'}</span>
          </button>
        </div>

        {/* Keyword Search */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>キーワード絞り込み</span>
          </label>
          <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="名前・作者・機能..."
                className="w-full pl-3 pr-7 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-900 dark:border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                  title="検索ワードを消去"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-900 dark:border-zinc-100 text-xs font-bold font-mono hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-1 shrink-0"
              title="検索を実行"
            >
              <Search className="w-3.5 h-3.5" />
              <span>検索</span>
            </button>
          </form>
        </div>

        {/* Category Filter (Vertical Checkbox List) */}
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              <span>カテゴリー</span>
            </label>

            {/* Select All / Clear All Categories Buttons */}
            <div className="flex items-center gap-2 text-[10px]">
              <button
                onClick={
                  isAllCategoriesSelected
                    ? handleClearAllCategories
                    : handleSelectAllCategories
                }
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline font-bold cursor-pointer"
              >
                {isAllCategoriesSelected ? '全解除' : '全選択'}
              </button>
            </div>
          </div>

          {/* Vertical Checkboxes */}
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 border border-zinc-300 dark:border-zinc-700 p-2 bg-zinc-50 dark:bg-zinc-800/50">
            {availableTypes.length === 0 ? (
              <div className="text-xs text-zinc-500 py-2">カテゴリーがありません</div>
            ) : (
              availableTypes.map((typeObj) => {
                const isChecked = filterState.selectedTypes.includes(typeObj.name);
                return (
                  <label
                    key={typeObj.name}
                    onClick={() => handleToggleCategory(typeObj.name)}
                    className={`flex items-center justify-between p-1 text-[11px] font-mono cursor-pointer transition-colors border ${
                      isChecked
                        ? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-600 font-bold'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {isChecked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      )}
                      <span className="truncate">{typeObj.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 px-1 py-0.5 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0 ml-1">
                      {typeObj.count}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Distribution Status Filter */}
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
            <ListFilter className="w-3 h-3" />
            <span>配布ステータス</span>
          </label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono">
            <button
              onClick={() => onFilterChange({ statusFilter: 'all', currentPage: 1 })}
              className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                filterState.statusFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => onFilterChange({ statusFilter: 'enabled', currentPage: 1 })}
              className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                filterState.statusFilter === 'enabled'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              配布中
            </button>
            <button
              onClick={() => onFilterChange({ statusFilter: 'disabled', currentPage: 1 })}
              className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                filterState.statusFilter === 'disabled'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              終了
            </button>
          </div>
        </div>

        {/* Host Filter Toggle */}
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
            <Globe className="w-3 h-3" />
            <span>配布ホスト</span>
          </label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono">
            <button
              onClick={() => onFilterChange({ hostFilter: 'all', currentPage: 1 })}
              className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                filterState.hostFilter === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => onFilterChange({ hostFilter: 'github', currentPage: 1 })}
              className={`py-1.5 px-1 flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                filterState.hostFilter === 'github'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Github className="w-2.5 h-2.5" />
              <span>GitHub</span>
            </button>
            <button
              onClick={() => onFilterChange({ hostFilter: 'external', currentPage: 1 })}
              className={`py-1.5 px-1 flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                filterState.hostFilter === 'external'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <Globe className="w-2.5 h-2.5" />
              <span>外部</span>
            </button>
          </div>
        </div>

        {/* Sort Dropdown & Order */}
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
            <ArrowUpDown className="w-3 h-3" />
            <span>並び替え</span>
          </label>
          <div className="grid grid-cols-12 gap-2">
            <select
              value={filterState.sortBy}
              onChange={(e) => onFilterChange({ sortBy: e.target.value as any, currentPage: 1 })}
              className="col-span-8 p-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-900 dark:border-zinc-200 text-xs font-mono cursor-pointer"
            >
              <option value="updatedAt">更新日順</option>
              <option value="publishedAt">公開日順</option>
              <option value="name">プラグイン名順</option>
              <option value="author">作者名順</option>
              <option value="type">カテゴリー順</option>
            </select>
            <button
              onClick={() => onFilterChange({ sortOrder: filterState.sortOrder === 'asc' ? 'desc' : 'asc', currentPage: 1 })}
              className="col-span-4 p-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-900 dark:border-zinc-200 text-[10px] font-bold hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-colors cursor-pointer text-center"
            >
              {filterState.sortOrder === 'asc' ? '昇順' : '降順'}
            </button>
          </div>
        </div>

        {/* Page Size Selection */}
        <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
          <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3" />
            <span>1ページあたりの表示件数</span>
          </label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono">
            {[5, 10, 20, 50, 100, 'all'].map((size) => (
              <button
                key={String(size)}
                onClick={() => onFilterChange({ pageSize: size as PageSize, currentPage: 1 })}
                className={`py-1.5 px-1 text-center transition-colors cursor-pointer ${
                  filterState.pageSize === size
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                    : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {size === 'all' ? '全体' : `${size}件`}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Drawer Footer (Mobile only logic handled here if needed, but always visible for reset) */}
      <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 mb-1">
          <span>該当件数: {matchedCount}件 / 全{totalCount}件</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetFilters}
            className="flex-1 py-2 px-2 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-400 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>リセット</span>
          </button>
          <button
            onClick={onClose}
            className="md:hidden flex-1 py-2 px-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Fixed Sidebar */}
      <aside className="hidden md:block w-64 lg:w-72 shrink-0 h-[calc(100vh-65px)] sticky top-[65px] border-r-2 border-zinc-900 dark:border-zinc-100 overflow-hidden shadow-sm">
        {sidebarContent}
      </aside>

      {/* 2. Mobile Drawer (Overlay) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden font-mono md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          {/* Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-[85vw] max-w-sm flex flex-col border-l-2 border-zinc-900 dark:border-zinc-100 shadow-2xl">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
