import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteVersion?: string;
  ymm4Version?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  siteVersion = 'v1.1.4',
  ymm4Version = '取得中...'
}) => {
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      fetch('/README.md')
        .then(res => {
          if (res.ok) return res.text();
          throw new Error('Failed to fetch README');
        })
        .then(text => {
          setReadmeContent(text);
          setLoading(false);
        })
        .catch(() => {
          setReadmeContent(`# YMM4プラグインポータル

ゆっくりMovieMaker4の非公式プラグインポータルサイトです

## 開発
このサイトはGoogle AI Studioを使用して作成しました  

## 使用API
- manjubox.net ymm4plugins.yml
- manjubox.net RSS
- manjubox.net GitHub plugin list
- GitHub REST API Repositories Search
- GitHub REST API Releases
- GitHub REST API Tags for YMM4 and plugins
- BOOTH公開ページ情報パース (サーバーサイドプロキシ)

## 変更履歴
### ーーーー1.0.0ーーーー
・公開
##### ーー1.0.1ーー
・サイト名を変更  
・検索の入力時、入力モードがキャンセル問題の修正及び検索ボタンの追加
##### ーー1.0.2ーー
・リンクを変更(_for_HAIsanを削除)
##### ーー1.0.3ーー
・マークダウン表示に対応  
・リンクをサイト名で表示するように変更
##### ーー1.0.4ーー
・サイトアイコンを追加
##### ーー1.0.5ーー  
・フォントをM PLUS 1Pに変更  
・サイト下部の表示情報を変更
##### ーー1.0.6ーー
・ページ切り替え方法を追加
##### ーー1.0.7ーー
・Githubで公開されているプラグインのreadme表示に対応  
#### ーーー1.1.0ーーー
・Manjubox.netに掲載されていないプラグインの取得に対応  
・サイトバージョン情報及びYMM4の最新バージョン表示に対応  
・配布サイトフィルタに対応  
##### ーー1.1.1ーー
・Boothの表示情報の一部修正
##### ーー1.1.2ーー
・YMM4の最新バージョン表示に関する修正
##### ーー1.1.3ーー
・YMM4の最新バージョンの取得方法を変更
##### ーー1.1.4ーー
・api情報表示の調整`);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-300 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                サイト情報 & バージョン履歴
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                GitHub README情報に基づくシステム詳細
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">サイトバージョン</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{siteVersion}</div>
            </div>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">YMM4 最新バージョン</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{ymm4Version}</div>
            </div>
          </div>

          {/* README Body */}
          <div className="prose dark:prose-invert max-w-none bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-xl border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-zinc-600 dark:text-zinc-400">
                <div className="w-6 h-6 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin mr-2" />
                読み込み中...
              </div>
            ) : (
              <MarkdownContent content={readmeContent} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400">
          <span>YMM4 Plugin Portal System</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl transition-colors shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
