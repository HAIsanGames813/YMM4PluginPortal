import React, { useState } from 'react';
import { X, ExternalLink, Github, Globe, User, Tag, Layers, Download, GitBranch, Calendar, Shield, AlertOctagon, Package } from 'lucide-react';
import { YMM4Plugin } from '../types';
import { MarkdownContent } from './MarkdownContent';
import { getSiteNameFromUrl } from '../utils/site';

interface PluginDetailModalProps {
  plugin: YMM4Plugin | null;
  onClose: () => void;
  onOpenVersions: (plugin: YMM4Plugin) => void;
  isSelected: boolean;
  onToggleSelect: (plugin: YMM4Plugin) => void;
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

const extractDomain = (urlStr: string) => {
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname;
  } catch {
    return '';
  }
};

const SiteIcon: React.FC<{ url: string; className?: string }> = ({ url, className = "w-4 h-4 shrink-0" }) => {
  const domain = extractDomain(url);
  const [hasError, setHasError] = useState(false);

  if (domain.includes('github.com')) {
    return <Github className={`${className} text-zinc-900 dark:text-zinc-100`} />;
  }
  
  if (domain.includes('x.com') || domain.includes('twitter.com')) {
    return <X className={`${className} text-zinc-900 dark:text-zinc-100`} />;
  }

  if (domain.includes('booth.pm')) {
    return <Package className={`${className} text-zinc-900 dark:text-zinc-100`} />;
  }

  if (!domain || hasError) {
    return <Globe className={`${className} text-zinc-500 dark:text-zinc-400`} />;
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${className} object-contain rounded-xs`}
    />
  );
};

export const PluginDetailModal: React.FC<PluginDetailModalProps> = ({
  plugin,
  onClose,
  onOpenVersions,
  isSelected,
  onToggleSelect
}) => {
  if (!plugin) return null;

  const hasLinks = Array.isArray(plugin.links) && plugin.links.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-b border-zinc-900 dark:border-zinc-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900 font-bold">
              {plugin.type || 'プラグイン'}
            </span>
            <h2 className="font-mono font-bold text-sm sm:text-base tracking-tight truncate">
              プラグイン詳細情報
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 font-mono">
          
          {/* Title & Author Header */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 space-y-2">
            <h1 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 leading-snug">
              {plugin.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              {plugin.isEnabled === false && (
                <div className="flex items-center gap-1 bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 font-bold px-2 py-0.5 border border-red-300 dark:border-red-800">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>配布終了</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{plugin.author}</span>
              </div>

              {plugin.version && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>バージョン: {plugin.version}</span>
                </div>
              )}

              {plugin.publishedAt && (
                <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>公開日: {formatDate(plugin.publishedAt)}</span>
                </div>
              )}

              {plugin.updatedAt && (
                <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-mono">
                  <span>更新日: {formatDate(plugin.updatedAt)}</span>
                </div>
              )}

              {plugin.license && (
                <div className="flex items-center gap-1 text-zinc-500">
                  <Shield className="w-3.5 h-3.5" />
                  <span>ライセンス: {plugin.license}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
              概要 / 機能説明
            </h3>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
              {plugin.description ? (
                <MarkdownContent content={plugin.description} />
              ) : (
                '概要説明が登録されていません。'
              )}
            </div>
          </div>

          {/* Tags */}
          {plugin.tags && plugin.tags.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                <span>タグ</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {plugin.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* External Links & URLs Section */}
          <div className="space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            
            <h3 className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>関連リンク一覧</span>
            </h3>

            <div className="space-y-1.5">
              {(() => {
                const allLinks: { url: string; name?: string }[] = [];
                if (plugin.url) {
                  allLinks.push({ url: plugin.url, name: '' });
                }
                if (hasLinks) {
                  plugin.links!.forEach((link) => {
                    if (link.url !== plugin.url) {
                      allLinks.push(link);
                    }
                  });
                }

                if (allLinks.length === 0) {
                  return <div className="text-xs text-zinc-500">関連リンクはありません</div>;
                }

                return allLinks.map((link, idx) => {
                  const displayIcon = <SiteIcon url={link.url} className="w-4 h-4 mt-0.5 shrink-0" />;
                  const displayName = getSiteNameFromUrl(link.url, link.name);

                  return (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-start justify-between p-3 border transition-colors group ${
                        idx === 0
                          ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {displayIcon}
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:underline text-xs">
                            {displayName}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400 break-all leading-relaxed">
                            {link.url}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 shrink-0 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 ml-2 mt-0.5" />
                    </a>
                  );
                });
              })()}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
          
          <button
            onClick={() => onToggleSelect(plugin)}
            className={`px-3 py-2 text-xs font-mono font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              isSelected
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-400 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-zinc-100'
            }`}
          >
            <span>{isSelected ? '一括選択から解除' : '一括選択に追加'}</span>
          </button>

          <div className="flex items-center gap-2">
            {plugin.isGithub ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenVersions(plugin);
                }}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>バージョン・リリース選択</span>
              </button>
            ) : (
              <a
                href={plugin.url || (plugin.links && plugin.links[0]?.url) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{getSiteNameFromUrl(plugin.url || (plugin.links && plugin.links[0]?.url) || '')} を開く</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono text-xs font-bold border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors cursor-pointer"
            >
              閉じる
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
