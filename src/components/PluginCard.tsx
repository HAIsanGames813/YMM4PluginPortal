import React from 'react';
import {
  Github,
  Globe,
  User,
  Download,
  Layers,
  ExternalLink,
  Info,
  CheckSquare,
  Square,
  GitBranch,
  Calendar,
  AlertOctagon
} from 'lucide-react';
import { YMM4Plugin } from '../types';
import { getSiteNameFromUrl } from '../utils/site';

const BoothPriceTag: React.FC<{ plugin: YMM4Plugin }> = ({ plugin }) => {
  if (!plugin.price) return null;

  return (
    <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 font-bold ml-auto">
      価格: {plugin.price}
    </span>
  );
};

interface PluginCardProps {
  plugin: YMM4Plugin;
  isSelected: boolean;
  onToggleSelect: (plugin: YMM4Plugin) => void;
  onOpenVersions: (plugin: YMM4Plugin) => void;
  onOpenDetails: (plugin: YMM4Plugin) => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
};

export const PluginCard: React.FC<PluginCardProps> = React.memo(({
  plugin,
  isSelected,
  onToggleSelect,
  onOpenVersions,
  onOpenDetails
}) => {
  const publishedDateFormatted = formatDate(plugin.publishedAt);
  const updatedDateFormatted = formatDate(plugin.updatedAt);

  return (
    <div
      className={`relative bg-white dark:bg-zinc-900 border-2 transition-all flex flex-col justify-between ${
        isSelected
          ? 'border-zinc-900 dark:border-zinc-100 ring-2 ring-zinc-900 dark:ring-zinc-100 bg-zinc-50 dark:bg-zinc-800/80'
          : plugin.isEnabled === false
          ? 'border-zinc-300 dark:border-zinc-800 opacity-90'
          : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100'
      }`}
    >
      {/* Top Header Row with Selection Checkbox & Badges */}
      <div>
        <div className="flex items-start justify-between gap-2 p-3 bg-zinc-100 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
          
          {/* Checkbox for Batch Download */}
          <button
            onClick={() => onToggleSelect(plugin)}
            title={isSelected ? '選択解除' : '一括ダウンロード対象に選択'}
            className="flex items-center gap-1.5 text-xs font-mono font-bold hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer pt-0.5 select-none"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-zinc-400 dark:text-zinc-600 shrink-0" />
            )}
            <span className={isSelected ? 'text-zinc-900 dark:text-zinc-100 font-extrabold' : 'text-zinc-600 dark:text-zinc-400'}>
              選択
            </span>
          </button>

          {/* Badges: Discontinued, External Source, Type & Host */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {/* Discontinued Badge */}
            {plugin.isEnabled === false && (
              <span className="text-[10px] font-mono px-2 py-0.5 bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 font-bold border border-red-300 dark:border-red-800 flex items-center gap-1">
                <AlertOctagon className="w-3 h-3" />
                <span>配布終了</span>
              </span>
            )}

            {/* External Source Badge */}
            {plugin.isExternalSource && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-700 flex items-center gap-1"
                title="manjubox.net API未掲載の外部自動検知プラグインです"
              >
                <Globe className="w-3 h-3 text-zinc-600 dark:text-zinc-400" />
                <span>外部</span>
              </span>
            )}

            {/* Type badges */}
            {(plugin.type || 'その他')
              .split(/[、、,／/\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((cat, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-mono px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold border border-zinc-300 dark:border-zinc-600"
                >
                  {cat}
                </span>
              ))}

            {/* GitHub vs External site badge */}
            {plugin.isGithub ? (
              <span className="text-[11px] font-mono px-2 py-0.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold flex items-center gap-1 border border-zinc-900 dark:border-zinc-100">
                <Github className="w-3 h-3" />
                <span>GitHub</span>
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>{getSiteNameFromUrl(plugin.url || (plugin.links && plugin.links[0]?.url) || '')}</span>
              </span>
            )}
            
            {/* Display BOOTH Price if it's a BOOTH URL */}
            <BoothPriceTag plugin={plugin} />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3">
          {/* Plugin Title */}
          <div className="cursor-pointer group" onClick={() => onOpenDetails(plugin)}>
            <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-100 group-hover:underline line-clamp-2 leading-tight">
              {plugin.name}
            </h2>
          </div>

          {/* Author & Version Info */}
          <div className="flex flex-wrap items-center text-xs font-mono text-zinc-600 dark:text-zinc-400 gap-y-1 gap-x-3">
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{plugin.author}</span>
            </div>

            {plugin.version && (
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-700 text-[10px]">
                <GitBranch className="w-3 h-3" />
                <span>{plugin.version}</span>
              </div>
            )}
          </div>

          {/* Plugin Dates: Published Date & Update Date */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-2 border border-zinc-200 dark:border-zinc-800">
            {publishedDateFormatted && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-400" />
                <span>公開日: <strong className="text-zinc-700 dark:text-zinc-300">{publishedDateFormatted}</strong></span>
              </div>
            )}
            {updatedDateFormatted && (
              <div className="flex items-center gap-1">
                <span>更新日: <strong className="text-zinc-700 dark:text-zinc-300">{updatedDateFormatted}</strong></span>
              </div>
            )}
          </div>

          {/* Plugin Description */}
          <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3 leading-relaxed min-h-[3rem]">
            {plugin.description || '説明なし'}
          </p>

          {/* Tags if available */}
          {plugin.tags && plugin.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {plugin.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-2">
        
        {/* GitHub Version Select vs Direct Site Link */}
        {plugin.isGithub && plugin.githubUser && plugin.githubRepo ? (
          <button
            onClick={() => onOpenVersions(plugin)}
            className="flex-1 min-w-[120px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 px-3 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 border border-zinc-900 dark:border-zinc-100 transition-colors cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>バージョン選択</span>
          </button>
        ) : (
          <a
            href={plugin.url || (plugin.links && plugin.links[0]?.url) || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[120px] bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 px-3 py-1.5 text-xs font-mono font-bold flex items-center justify-center gap-1.5 border border-zinc-900 dark:border-zinc-100 transition-colors cursor-pointer truncate"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {getSiteNameFromUrl(plugin.url || (plugin.links && plugin.links[0]?.url) || '')} を開く
            </span>
          </a>
        )}

        {/* View Detail Modal Button */}
        <button
          onClick={() => onOpenDetails(plugin)}
          title="詳細を表示"
          className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 p-1.5 text-xs font-mono border border-zinc-400 dark:border-zinc-600 cursor-pointer"
        >
          <Info className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
});
