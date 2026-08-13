import React, { useState } from 'react';
import { X, Download, ExternalLink, Github, Globe, CheckCircle2, AlertCircle, FileText, Archive } from 'lucide-react';
import JSZip from 'jszip';
import { YMM4Plugin, BatchDownloadMode } from '../types';

interface BatchDownloadModalProps {
  selectedPlugins: YMM4Plugin[];
  batchDownloadMode?: BatchDownloadMode;
  onClose: () => void;
  onClearSelection: () => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  selectedPlugins,
  batchDownloadMode = 'zip',
  onClose,
  onClearSelection
}) => {
  const githubPlugins = selectedPlugins.filter((p) => p.isGithub);
  const externalPlugins = selectedPlugins.filter((p) => !p.isGithub);

  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);

  const addLog = (msg: string) => {
    setDownloadLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`]);
  };

  // Helper to trigger direct browser file download
  const triggerDownload = (url: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helper to fetch file as ArrayBuffer using server-side proxy to bypass CORS and API limits
  const fetchFileBuffer = async (url: string): Promise<ArrayBuffer | null> => {
    try {
      const res = await fetch(`/api/ymm4/proxy-file?url=${encodeURIComponent(url)}`);
      if (res.ok) return await res.arrayBuffer();
    } catch (e) {
      // Server proxy failed
    }
    try {
      const res = await fetch(url);
      if (res.ok) return await res.arrayBuffer();
    } catch (e) {
      // Direct fetch failed
    }
    return null;
  };

  // Execute Batch Action
  const handleStartBatch = async () => {
    setIsProcessing(true);
    setCompleted(false);
    setDownloadLogs([]);

    if (batchDownloadMode === 'zip') {
      // === Mode 1: Bundle all files into a single ZIP archive ===
      addLog(`[ZIP一括処理] アーカイブ作成を開始します (${selectedPlugins.length} 件)...`);
      const zip = new JSZip();

      // Create manifest file inside zip
      const manifestLines = [
        `=== YMM4プラグインポータルサイト - 選択プラグイン一括ダウンロード情報 ===`,
        `作成日時: ${new Date().toLocaleString('ja-JP')}`,
        `対象数: ${selectedPlugins.length} 件`,
        ``,
        ...selectedPlugins.map((p, i) => `[${i + 1}] ${p.name}
  作者: ${p.author}
  カテゴリー: ${p.type}
  配布URL: ${p.url || (p.links && p.links[0]?.url) || 'なし'}
  説明: ${p.description}`)
      ].join('\n');

      zip.file('プラグイン一覧_README.txt', manifestLines);

      // Process GitHub plugins for direct zip bundling
      if (githubPlugins.length > 0) {
        addLog(`--- GitHubプラグイン (${githubPlugins.length} 件) のファイル取得中 ---`);
        for (let i = 0; i < githubPlugins.length; i++) {
          const p = githubPlugins[i];
          let downloadUrl = p.extraGhData?.browser_download_url || p.url;
          if (!downloadUrl && p.githubUser && p.githubRepo) {
            downloadUrl = `https://github.com/${p.githubUser}/${p.githubRepo}/releases/latest`;
          }

          addLog(`取得中 [${i + 1}/${githubPlugins.length}]: ${p.name}`);

          if (downloadUrl) {
            const buffer = await fetchFileBuffer(downloadUrl);
            const sanitizeName = p.name.replace(/[\/\\:\*\?"<>\|]/g, '_');
            
            if (buffer && buffer.byteLength > 0) {
              const ext = p.extraGhData?.file_name ? p.extraGhData.file_name.split('.').pop() : 'ymme';
              zip.file(`${sanitizeName}.${ext}`, buffer);
              addLog(`  └ 完了: ${sanitizeName}.${ext}`);
            } else {
              // Fallback: create .url shortcut file inside zip
              const urlShortcut = `[InternetShortcut]\nURL=${downloadUrl}\n`;
              zip.file(`配布元リンク/${sanitizeName}.url`, urlShortcut);
              addLog(`  └ 直DL不可のためショートカットを保存: 配布元リンク/${sanitizeName}.url`);
            }
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Process External plugins
      if (externalPlugins.length > 0) {
        addLog(`--- 外部サイトプラグイン (${externalPlugins.length} 件) のショートカット追加中 ---`);
        for (let i = 0; i < externalPlugins.length; i++) {
          const p = externalPlugins[i];
          const targetUrl = p.url || (p.links && p.links[0]?.url) || '';
          const sanitizeName = p.name.replace(/[\/\\:\*\?"<>\|]/g, '_');

          if (targetUrl) {
            const urlShortcut = `[InternetShortcut]\nURL=${targetUrl}\n`;
            zip.file(`外部サイトリンク/${sanitizeName}.url`, urlShortcut);
            addLog(`ショートカット追加: 外部サイトリンク/${sanitizeName}.url`);

            // Also open in new browser tab for convenience
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      addLog('ZIP圧縮ファイルを生成しています...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const bundleUrl = URL.createObjectURL(zipBlob);
      const zipFileName = `ymm4_plugins_bundle_${new Date().toISOString().slice(0, 10)}.zip`;
      
      triggerDownload(bundleUrl, zipFileName);
      URL.revokeObjectURL(bundleUrl);
      addLog(`ダウンロード完了: ${zipFileName}`);

    } else {
      // === Mode 2: Individual download ===
      addLog(`[個別処理] 一括処理を開始します (${selectedPlugins.length} 件)...`);

      if (githubPlugins.length > 0) {
        addLog(`--- GitHubプラグイン (${githubPlugins.length} 件) の個別ダウンロードを開始 ---`);
        for (let i = 0; i < githubPlugins.length; i++) {
          const p = githubPlugins[i];
          let downloadUrl = p.extraGhData?.browser_download_url || p.url;
          if (!downloadUrl && p.githubUser && p.githubRepo) {
            downloadUrl = `https://github.com/${p.githubUser}/${p.githubRepo}/releases/latest`;
          }

          addLog(`個別DL [${i + 1}/${githubPlugins.length}]: ${p.name}`);
          if (downloadUrl) {
            triggerDownload(downloadUrl, `${p.name}.ymme`);
          }
          await new Promise((r) => setTimeout(r, 600));
        }
      }

      if (externalPlugins.length > 0) {
        addLog(`--- 外部サイトプラグイン (${externalPlugins.length} 件) の配布ページを開きます ---`);
        for (let i = 0; i < externalPlugins.length; i++) {
          const p = externalPlugins[i];
          const targetUrl = p.url || (p.links && p.links[0]?.url) || '';

          if (targetUrl) {
            addLog(`配布ページオープン [${i + 1}/${externalPlugins.length}]: ${p.name}`);
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
          } else {
            addLog(`警告: ${p.name} の有効なURLが見つかりません。`);
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    addLog('一括処理が完了しました！');
    setIsProcessing(false);
    setCompleted(true);
  };

  // Download Manifest text file
  const handleExportList = () => {
    const lines = [
      `=== YMM4プラグインポータルサイト - 選択プラグインリスト ===`,
      `出力日時: ${new Date().toLocaleString('ja-JP')}`,
      `合計: ${selectedPlugins.length} 件`,
      ``,
      ...selectedPlugins.map((p, i) => {
        return `[${i + 1}] ${p.name}
  作者: ${p.author}
  種別: ${p.type}
  GitHub: ${p.isGithub ? 'はい' : 'いいえ'}
  URL: ${p.url || (p.links && p.links[0]?.url) || 'なし'}
  バージョン: ${p.version || '未指定'}
  説明: ${p.description}
--------------------------------------------------`;
      })
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `ymm4_selected_plugins_${Date.now()}.txt`);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-mono">
      <div className="bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-b border-zinc-900 dark:border-zinc-100">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            <h2 className="font-bold text-sm sm:text-base uppercase tracking-tight">
              一括ダウンロード & 配布サイト処理
            </h2>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Breakdown summary */}
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 space-y-2 text-xs">
            <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
              <span>選択されたプラグイン: 合計 {selectedPlugins.length} 件</span>
              <span className="text-[11px] px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 font-bold border border-zinc-400 dark:border-zinc-600">
                方式: {batchDownloadMode === 'zip' ? '圧縮ZIPまとめてDL' : '個別DL'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700">
              <div className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-1">
                <div className="font-bold flex items-center gap-1 text-zinc-900 dark:text-zinc-100">
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub プラグイン ({githubPlugins.length} 件)</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {batchDownloadMode === 'zip'
                    ? 'ファイルをまとめ、単一のZIP圧縮ファイルでダウンロードします。'
                    : 'アセットファイル (.ymme / .zip) を順次個別にダウンロードします。'}
                </p>
              </div>

              <div className="p-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 space-y-1">
                <div className="font-bold flex items-center gap-1 text-zinc-900 dark:text-zinc-100">
                  <Globe className="w-3.5 h-3.5" />
                  <span>外部サイトプラグイン ({externalPlugins.length} 件)</span>
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {batchDownloadMode === 'zip'
                    ? '配布元URLへのショートカットをZIP内に格納し、Webページも開きます。'
                    : '配布元 (BOOTH, GetUploader 等) のWebサイトを新しいタブで自動表示します。'}
                </p>
              </div>
            </div>
          </div>

          {/* Browser popup notice if external plugins exist */}
          {externalPlugins.length > 0 && (
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
              <div className="text-zinc-700 dark:text-zinc-300">
                <strong className="block font-bold">ポップアップブロックにご注意ください</strong>
                複数の外部サイトを一度に開く際、ブラウザの「ポップアップのブロック」機能が表示される場合があります。ブロックされた場合はアドレスバーの許可設定を有効にしてください。
              </div>
            </div>
          )}

          {/* Execution Logs */}
          {downloadLogs.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">処理ログ:</div>
              <div className="p-3 bg-zinc-900 text-zinc-100 dark:bg-zinc-950 dark:text-zinc-200 border border-zinc-900 text-[11px] max-h-48 overflow-y-auto space-y-1">
                {downloadLogs.map((log, idx) => (
                  <div key={idx} className="leading-snug">{log}</div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
          
          <button
            onClick={handleExportList}
            className="px-3 py-1.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-bold border border-zinc-400 dark:border-zinc-600 hover:border-zinc-900 dark:hover:border-zinc-100 flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>リストをテキスト出力</span>
          </button>

          <div className="flex items-center gap-2">
            {!completed ? (
              <button
                onClick={handleStartBatch}
                disabled={isProcessing}
                className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{isProcessing ? '一括処理中...' : '一括実行する'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onClearSelection();
                  onClose();
                }}
                className="px-5 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold border border-zinc-900 dark:border-zinc-100 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>完了・選択解除して閉じる</span>
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-3 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-300 dark:hover:bg-zinc-600 cursor-pointer disabled:opacity-50"
            >
              閉じる
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
