import React from 'react';
import { Sun, Moon, Monitor, RefreshCw, Menu, SlidersHorizontal } from 'lucide-react';
import { ThemeMode } from '../types';

interface NavbarProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: string | null;
  totalCount: number;
  onOpenDrawer: () => void;
  isFiltered?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  themeMode,
  onThemeChange,
  onRefresh,
  isRefreshing,
  lastUpdated,
  totalCount,
  onOpenDrawer,
  isFiltered
}) => {
  return (
    <header className="w-full bg-white dark:bg-zinc-900 border-b-2 border-zinc-900 dark:border-zinc-100 px-4 py-3 sm:px-6 sticky top-0 z-30 shadow-xs">
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        
        {/* Brand / Logo Title */}
        <div className="flex items-center gap-3">
          <img
            src="./ymm4pluginportal.png"
            alt="YMM4 Plugin Portal Logo"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg sm:text-xl tracking-tight uppercase">
                YMM4プラグインポータルサイト
              </h1>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              ゆっくりMovieMaker4のプラグインポータル
            </p>
          </div>
        </div>

        {/* Action Controls & Theme Toggle */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="最新データに更新"
            className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-900 dark:border-zinc-200 px-2.5 py-1.5 text-xs font-mono font-bold transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">更新</span>
          </button>

          {/* Theme Selector (3-way) */}
          <div className="flex border border-zinc-900 dark:border-zinc-200 bg-zinc-100 dark:bg-zinc-800 p-0.5">
            <button
              onClick={() => onThemeChange('light')}
              title="ライトモード"
              className={`px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                themeMode === 'light'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onThemeChange('dark')}
              title="ダークモード"
              className={`px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                themeMode === 'dark'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onThemeChange('system')}
              title="自動"
              className={`px-2 py-1 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                themeMode === 'system'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Top-Right Hamburger / Side Menu Drawer Button (Hidden on Desktop) */}
          <button
            onClick={onOpenDrawer}
            className="flex items-center gap-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 border-2 border-zinc-900 dark:border-zinc-100 px-3 py-1.5 text-xs font-mono font-bold transition-colors cursor-pointer relative md:hidden"
            title="メニュー・フィルター設定を開く"
          >
            <Menu className="w-4 h-4" />
            <span>メニュー</span>
            {isFiltered && (
              <span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500 animate-pulse" />
            )}
          </button>

        </div>
      </div>
    </header>
  );
};
