import React, { useEffect, useState } from 'react';
import { X, GitBranch, Download, Calendar, FileText, AlertCircle, RefreshCw, ExternalLink, Tag } from 'lucide-react';
import { YMM4Plugin, GithubDetailData, GithubRelease } from '../types';
import { MarkdownContent } from './MarkdownContent';

interface VersionModalProps {
  plugin: YMM4Plugin | null;
  onClose: () => void;
  onSelectVersionAsset?: (plugin: YMM4Plugin, assetUrl: string, versionTag: string) => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({
  plugin,
  onClose,
  onSelectVersionAsset
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<GithubDetailData | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);

  useEffect(() => {
    if (!plugin || !plugin.isGithub || !plugin.githubUser || !plugin.githubRepo) {
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchDetail = async () => {
      try {
        const user = plugin.githubUser!;
        const repo = plugin.githubRepo!;
        let releasesList: GithubRelease[] = [];
        let fetched = false;

        // 1. Try local Express API route
        try {
          const res = await fetch(`/api/ymm4/github-detail/${encodeURIComponent(user)}/${encodeURIComponent(repo)}`);
          const contentType = res.headers.get('content-type');
          if (res.ok && contentType && contentType.includes('application/json')) {
            const json = await res.json();
            if (json.success && json.data) {
              const raw = json.data;
              if (Array.isArray(raw.releases)) releasesList = raw.releases;
              else if (Array.isArray(raw)) releasesList = raw;
              else if (raw.tag_name) releasesList = [raw];
              fetched = true;
            }
          }
        } catch (e) {
          console.warn('API route not available, trying direct GitHub API');
        }

        // 2. Direct Fallback to GitHub API (for GitHub Pages static hosting)
        if (!fetched) {
          try {
            const ghRes = await fetch(`https://api.github.com/repos/${user}/${repo}/releases`, {
              headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (ghRes.ok) {
              const raw = await ghRes.json();
              if (Array.isArray(raw)) {
                releasesList = raw;
                fetched = true;
              }
            }
          } catch (e) {
            console.error('Direct GitHub API fetch failed:', e);
          }
        }

        if (!isMounted) return;

        if (fetched) {
          setDetailData({
            user,
            repo,
            releases: releasesList
          });

          if (releasesList.length > 0) {
            setSelectedReleaseId(releasesList[0].id);
          }
        } else {
          setError('リリース情報の取得に失敗しました。(GitHub API制限等)');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || '通信エラーが発生しました。');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [plugin]);

  if (!plugin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-b border-zinc-900 dark:border-zinc-100">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            <h2 className="font-mono font-bold text-sm sm:text-base tracking-tight uppercase">
              バージョン・リリース選択 ({plugin.githubUser}/{plugin.githubRepo})
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Sub-Header */}
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{plugin.name}</span>
            <span className="ml-2 text-zinc-600 dark:text-zinc-400">by {plugin.author}</span>
          </div>

          <a
            href={`https://github.com/${plugin.githubUser}/${plugin.githubRepo}/releases`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 hover:underline font-bold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>GitHubで全リリースを見る</span>
          </a>
        </div>

        {/* Modal Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 font-mono">
          
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-600 dark:text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin text-zinc-900 dark:text-zinc-100" />
              <p className="text-xs">GitHubからリリース情報を読み込み中...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border-2 border-zinc-900 dark:border-zinc-100 text-xs text-zinc-900 dark:text-zinc-100 space-y-2">
              <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>エラーが発生しました</span>
              </div>
              <p>{error}</p>
              <a
                href={`https://github.com/${plugin.githubUser}/${plugin.githubRepo}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold underline cursor-pointer"
              >
                GitHubリリースページで直接確認する <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {!loading && !error && detailData && detailData.releases.length === 0 && (
            <div className="py-8 text-center text-xs text-zinc-600 dark:text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 p-4">
              <p>リリース情報が見つかりませんでした。</p>
              <a
                href={`https://github.com/${plugin.githubUser}/${plugin.githubRepo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 font-bold underline"
              >
                GitHubリポジトリトップページを開く <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {!loading && !error && detailData && detailData.releases.length > 0 && (
            <div className="space-y-4">
              
              {/* Release selection tabs */}
              <div className="border border-zinc-900 dark:border-zinc-100 p-2 bg-zinc-50 dark:bg-zinc-800/50 space-y-1">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>バージョン選択:</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {detailData.releases.map((rel) => {
                    const isSelected = selectedReleaseId === rel.id;
                    return (
                      <button
                        key={rel.id}
                        onClick={() => setSelectedReleaseId(rel.id)}
                        className={`px-3 py-1 text-xs border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-bold'
                            : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100'
                        }`}
                      >
                        {rel.tag_name || rel.name || `Release #${rel.id}`}
                        {rel.prerelease && <span className="ml-1 text-[9px] opacity-75">(Pre)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Release Detail Card */}
              {(() => {
                const activeRelease = detailData.releases.find(r => r.id === selectedReleaseId) || detailData.releases[0];
                if (!activeRelease) return null;

                return (
                  <div className="border-2 border-zinc-900 dark:border-zinc-100 p-4 bg-white dark:bg-zinc-900 space-y-4">
                    
                    {/* Tag Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                            {activeRelease.name || activeRelease.tag_name}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-bold">
                            {activeRelease.tag_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {activeRelease.published_at
                              ? new Date(activeRelease.published_at).toLocaleDateString('ja-JP')
                              : '公開日不明'}
                          </span>
                        </div>
                      </div>

                      {/* Download Zipball */}
                      {activeRelease.zipball_url && (
                        <a
                          href={activeRelease.zipball_url}
                          download
                          className="inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-3 py-1.5 text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>ソースZIPをダウンロード</span>
                        </a>
                      )}
                    </div>

                    {/* Release Notes / Body */}
                    {activeRelease.body ? (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>リリースノート (更新内容):</span>
                        </div>
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 max-h-72 overflow-y-auto font-sans leading-relaxed">
                          <MarkdownContent content={activeRelease.body} />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500 italic">リリースノートの記述はありません。</div>
                    )}

                    {/* Download Assets List */}
                    <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                        <Download className="w-3.5 h-3.5" />
                        <span>配布アセット・プラグインファイル ({activeRelease.assets?.length || 0} 件):</span>
                      </div>

                      {activeRelease.assets && activeRelease.assets.length > 0 ? (
                        <div className="space-y-1.5">
                          {activeRelease.assets.map((asset) => (
                            <div
                              key={asset.id}
                              className="flex items-center justify-between p-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100 transition-colors"
                            >
                              <div className="truncate pr-2">
                                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                  {asset.name}
                                </div>
                                <div className="text-[10px] text-zinc-500">
                                  サイズ: {(asset.size / 1024).toFixed(1)} KB
                                </div>
                              </div>

                              <a
                                href={asset.browser_download_url}
                                download
                                onClick={() => {
                                  if (onSelectVersionAsset) {
                                    onSelectVersionAsset(plugin, asset.browser_download_url, activeRelease.tag_name);
                                  }
                                }}
                                className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 px-3 py-1 text-xs font-bold border border-zinc-900 dark:border-zinc-100 flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Download className="w-3 h-3" />
                                <span>ダウンロード</span>
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-800 p-2.5 border border-zinc-200 dark:border-zinc-700">
                          ビルド済みアセットファイル (.ymme / .zip) は添付されていません。上記の「ソースZIP」をご利用ください。
                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
