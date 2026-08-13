import React, { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink, Github, Globe, User, Tag, Layers, Download, GitBranch, Calendar, Shield, AlertOctagon, Package, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { YMM4Plugin } from '../types';
import { MarkdownContent } from './MarkdownContent';
import { getSiteNameFromUrl } from '../utils/site';
import { parseGithubRepo, fetchGithubReadme } from '../utils/github';
import { fetchBoothDetails } from '../utils/booth';

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

  const ghInfo = useMemo(() => {
    if (!plugin) return null;
    if (plugin.githubUser && plugin.githubRepo) {
      return { user: plugin.githubUser, repo: plugin.githubRepo };
    }
    if (plugin.url) {
      const parsed = parseGithubRepo(plugin.url);
      if (parsed) return parsed;
    }
    if (Array.isArray(plugin.links)) {
      for (const l of plugin.links) {
        const parsed = parseGithubRepo(l.url);
        if (parsed) return parsed;
      }
    }
    return null;
  }, [plugin]);

  const boothUrl = useMemo(() => {
    if (!plugin) return null;
    if (plugin.url && plugin.url.includes('booth.pm')) return plugin.url;
    if (Array.isArray(plugin.links)) {
      const found = plugin.links.find((l) => l.url.includes('booth.pm'));
      if (found) return found.url;
    }
    return null;
  }, [plugin]);

  const [isReadmeOpen, setIsReadmeOpen] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [isLoadingReadme, setIsLoadingReadme] = useState(false);
  const [readmeError, setReadmeError] = useState<string | null>(null);

  const [isBoothDescOpen, setIsBoothDescOpen] = useState(false);
  const [boothData, setBoothData] = useState<{ author?: string; price?: string; description?: string; images?: string[] } | null>(null);
  const [isLoadingBooth, setIsLoadingBooth] = useState(false);
  const [boothError, setBoothError] = useState<string | null>(null);

  useEffect(() => {
    setIsReadmeOpen(false);
    setReadmeContent(null);
    setIsLoadingReadme(false);
    setReadmeError(null);

    setIsBoothDescOpen(false);
    setBoothData(null);
    setIsLoadingBooth(false);
    setBoothError(null);

    if (boothUrl) {
      setIsLoadingBooth(true);
      fetchBoothDetails(boothUrl).then((details) => {
        if (details) {
          setBoothData(details);
        }
        setIsLoadingBooth(false);
      });
    }
  }, [plugin.id, boothUrl]);

  const handleToggleReadme = async () => {
    const nextOpen = !isReadmeOpen;
    setIsReadmeOpen(nextOpen);

    if (nextOpen && !readmeContent && !isLoadingReadme && ghInfo) {
      setIsLoadingReadme(true);
      setReadmeError(null);
      const text = await fetchGithubReadme(ghInfo.user, ghInfo.repo);
      if (text) {
        setReadmeContent(text);
      } else {
        setReadmeError('README.md の取得に失敗したか、ファイルが存在しません。');
      }
      setIsLoadingReadme(false);
    }
  };

  const handleToggleBoothDesc = async () => {
    const nextOpen = !isBoothDescOpen;
    setIsBoothDescOpen(nextOpen);

    if (nextOpen && !boothData && !isLoadingBooth && boothUrl) {
      setIsLoadingBooth(true);
      setBoothError(null);
      const details = await fetchBoothDetails(boothUrl);
      if (details && (details.description || details.author)) {
        setBoothData(details);
      } else {
        setBoothError('BOOTHからの製品説明の取得に失敗したか、説明文が見つかりませんでした。');
      }
      setIsLoadingBooth(false);
    }
  };

  const displayedAuthor = boothData?.author || plugin.author;

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

              {plugin.isExternalSource && (
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold px-2 py-0.5 border border-zinc-300 dark:border-zinc-700">
                  <Globe className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>外部</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-500" />
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{displayedAuthor}</span>
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

            {/* GitHub README Accordion */}
            {ghInfo && (
              <div className="mt-3 border border-zinc-300 dark:border-zinc-700 rounded-xs overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleReadme}
                  className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-between text-left font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    <span>GitHub README.md ({ghInfo.user}/{ghInfo.repo})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="text-[11px]">
                      {isReadmeOpen ? '折りたたむ' : '表示する'}
                    </span>
                    {isReadmeOpen ? (
                      <ChevronUp className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    )}
                  </div>
                </button>

                {isReadmeOpen && (
                  <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700 max-h-[500px] overflow-y-auto">
                    {isLoadingReadme ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs font-mono text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-700 dark:text-zinc-300" />
                        <span>GitHubから README.md を取得中...</span>
                      </div>
                    ) : readmeError ? (
                      <div className="p-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                        {readmeError}
                      </div>
                    ) : readmeContent ? (
                      <MarkdownContent
                        content={readmeContent}
                        baseUrl={`https://raw.githubusercontent.com/${ghInfo.user}/${ghInfo.repo}/HEAD/`}
                        githubRepoInfo={ghInfo}
                      />
                    ) : (
                      <div className="text-xs text-zinc-500">README が見つかりませんでした。</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BOOTH Description Accordion */}
            {boothUrl && (
              <div className="mt-3 border border-zinc-300 dark:border-zinc-700 rounded-xs overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleBoothDesc}
                  className="w-full p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-between text-left font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    <span>BOOTH 製品説明文 (booth.pm)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <span className="text-[11px]">
                      {isBoothDescOpen ? '折りたたむ' : '表示する (マークダウン)'}
                    </span>
                    {isBoothDescOpen ? (
                      <ChevronUp className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-900 dark:text-zinc-100 shrink-0" />
                    )}
                  </div>
                </button>

                {isBoothDescOpen && (
                  <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700 max-h-[500px] overflow-y-auto space-y-3">
                    {isLoadingBooth ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs font-mono text-zinc-500">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-700 dark:text-zinc-300" />
                        <span>BOOTHから製品説明を取得中...</span>
                      </div>
                    ) : boothError ? (
                      <div className="p-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                        {boothError}
                      </div>
                    ) : boothData ? (
                      <div className="space-y-3">
                        {boothData.price && (
                          <div className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 border border-zinc-300 dark:border-zinc-700 inline-block">
                            価格: {boothData.price}
                          </div>
                        )}
                        {boothData.description ? (
                          <MarkdownContent content={boothData.description} />
                        ) : (
                          <div className="text-xs text-zinc-500">BOOTHの説明文が見つかりませんでした。</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">製品説明が見つかりませんでした。</div>
                    )}
                  </div>
                )}
              </div>
            )}
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
          <div className="space-y-2 border-t border-zinc-200 dark:border-zinc-800 pt-4">
            
            <h3 className="text-xs font-bold uppercase text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>関連リンク</span>
            </h3>

            {(() => {
              const allLinks: { url: string; name?: string }[] = [];
              if (plugin.url) {
                allLinks.push({ url: plugin.url, name: '' });
              }
              if (hasLinks) {
                plugin.links!.forEach((link) => {
                  if (link.url !== plugin.url && !allLinks.some(l => l.url === link.url)) {
                    allLinks.push(link);
                  }
                });
              }

              if (allLinks.length === 0) {
                return <div className="text-xs text-zinc-500">関連リンクはありません</div>;
              }

              return (
                <div className="flex flex-wrap gap-2">
                  {allLinks.map((link, idx) => {
                    const displayIcon = <SiteIcon url={link.url} className="w-4 h-4 shrink-0" />;
                    const displayName = getSiteNameFromUrl(link.url, link.name);

                    return (
                      <a
                        key={idx}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={link.url}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 font-mono text-xs font-bold transition-all group rounded-xs shadow-2xs hover:border-zinc-900 dark:hover:border-zinc-100 cursor-pointer"
                      >
                        {displayIcon}
                        <span className="truncate max-w-[180px] sm:max-w-[240px]">{displayName}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100" />
                      </a>
                    );
                  })}
                </div>
              );
            })()}
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

