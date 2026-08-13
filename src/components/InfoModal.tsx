import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';
import { SITE_VERSION } from '../config/version';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteVersion?: string;
  ymm4Version?: string;
}

const FALLBACK_README = `<img width="3200" height="800" alt="YMM4プラグインポータルサイト" src="https://github.com/user-attachments/assets/b6af9a7f-20e8-48ee-989e-b595df5aedcc" />

# YMM4プラグインポータル

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

### v1.1.8
- 取得方法の追加

### v1.1.7
- readmeが表示されない問題の修正

### v1.1.6
- readme表示の修正

### v1.1.5
- YMM4の最新バージョンの取得方法を変更

### v1.1.4
- api情報表示の調整

### v1.1.3
- YMM4の最新バージョンの取得方法を変更

### v1.1.2
- YMM4の最新バージョン表示に関する修正

### v1.1.1
- Boothの表示情報の一部修正

### v1.1.0
- Manjubox.netに掲載されていないプラグインの取得に対応  
- サイトバージョン情報及びYMM4の最新バージョン表示に対応  
- 配布サイトフィルタに対応  

### v1.0.7
- Githubで公開されているプラグインのreadme表示に対応  

### v1.0.6
- ページ切り替え方法を追加

### v1.0.5
- フォントをM PLUS 1Pに変更  
- サイト下部の表示情報を変更

### v1.0.4
- サイトアイコンを追加

### v1.0.3
- マークダウン表示に対応  
- リンクをサイト名で表示するように変更

### v1.0.2
- リンクを変更(_for_HAIsanを削除)

### v1.0.1
- サイト名を変更  
- 検索の入力時、入力モードがキャンセル問題の修正及び検索ボタンの追加

### v1.0.0
- 公開`;

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  siteVersion = SITE_VERSION,
  ymm4Version = '取得中...'
}) => {
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/readme')
        .then(res => {
          if (res.ok) return res.text();
          throw new Error('Failed to fetch README from server');
        })
        .then(text => {
          setReadmeContent(text);
          setLoading(false);
        })
        .catch(err => {
          console.warn('Failed to fetch README from server, falling back to embedded content:', err);
          setReadmeContent(FALLBACK_README);
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
