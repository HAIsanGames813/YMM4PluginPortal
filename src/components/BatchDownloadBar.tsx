import React from 'react';
import { Download, CheckSquare, X, ExternalLink, Github, Globe } from 'lucide-react';
import { YMM4Plugin } from '../types';

interface BatchDownloadBarProps {
  selectedPlugins: YMM4Plugin[];
  onClearSelection: () => void;
  onSelectAllVisible: () => void;
  onExecuteBatch: () => void;
  isAllVisibleSelected: boolean;
}

export const BatchDownloadBar: React.FC<BatchDownloadBarProps> = ({
  selectedPlugins,
  onClearSelection,
  onSelectAllVisible,
  onExecuteBatch,
  isAllVisibleSelected
}) => {
  if (selectedPlugins.length === 0) return null;

  const githubCount = selectedPlugins.filter((p) => p.isGithub).length;
  const externalCount = selectedPlugins.length - githubCount;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-t-2 border-zinc-900 dark:border-zinc-100 p-3 sm:p-4 shadow-2xl font-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Selection Count Info */}
        <div className="flex items-center gap-3">
          <div className="bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 px-2.5 py-1 text-sm font-extrabold border border-white dark:border-zinc-900">
            {selectedPlugins.length} 件選択中
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 bg-zinc-800 dark:bg-zinc-200 px-2 py-0.5 text-zinc-200 dark:text-zinc-800">
              <Github className="w-3 h-3" />
              <span>GitHub: {githubCount}</span>
            </span>

            <span className="flex items-center gap-1 bg-zinc-800 dark:bg-zinc-200 px-2 py-0.5 text-zinc-200 dark:text-zinc-800">
              <Globe className="w-3 h-3" />
              <span>外部: {externalCount}</span>
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          
          <button
            onClick={onSelectAllVisible}
            className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800 hover:bg-zinc-700 dark:hover:bg-zinc-300 font-bold border border-zinc-700 dark:border-zinc-300 transition-colors cursor-pointer"
          >
            {isAllVisibleSelected ? '表示中を解除' : '表示中を全選択'}
          </button>

          <button
            onClick={onClearSelection}
            className="px-2.5 py-1.5 text-xs text-zinc-400 dark:text-zinc-600 hover:text-white dark:hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span className="hidden md:inline">クリア</span>
          </button>

          {/* Primary Batch Download Trigger Button */}
          <button
            onClick={onExecuteBatch}
            className="flex-1 sm:flex-none bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-2 border-2 border-white dark:border-zinc-900 shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>一括ダウンロード実行</span>
          </button>

        </div>

      </div>
    </div>
  );
};
