import { YMM4Plugin } from '../types';
import { parseGithubRepo } from './github';

export function mapTopicsToCategory(topics: string[] = []): string {
  if (!topics || topics.length === 0) return 'その他';
  const lower = topics.map((t) => t.toLowerCase().trim());
  const categories: string[] = [];

  for (const topic of lower) {
    if (topic === 'ymm4-audio-effect') categories.push('音声エフェクト');
    else if (topic === 'ymm4-video-effect' || topic === 'ymm4-effect') categories.push('映像エフェクト');
    else if (topic === 'ymm4-transition') categories.push('トランジション');
    else if (topic === 'ymm4-shape') categories.push('図形');
    else if (topic === 'ymm4-tachie') categories.push('立ち絵');
    else if (topic === 'ymm4-video-source') categories.push('動画アイテム');
    else if (topic === 'ymm4-image-source') categories.push('画像アイテム');
    else if (topic === 'ymm4-audio-source' || topic === 'ymm4-voice') categories.push('音声');
    else if (topic === 'ymm4-video-writer' || topic === 'ymm4-video-exporter' || topic === 'ymm4-exporter') categories.push('映像出力');
    else if (topic === 'ymm4-text-completion') categories.push('テキスト');
    else if (topic === 'ymm4-importer') categories.push('インポーター');
  }

  const unique = Array.from(new Set(categories));
  return unique.length > 0 ? unique.join('、') : 'その他';
}

export async function fetchExternalPlugins(existingPlugins: YMM4Plugin[]): Promise<YMM4Plugin[]> {
  // 1. Try server backend API /api/external-plugins
  try {
    const apiRes = await fetch('./api/external-plugins');
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.success && Array.isArray(data.plugins)) {
        return data.plugins;
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Try static plugins-data.json or external-plugins.json
  try {
    const staticRes = await fetch('./plugins-data.json');
    if (staticRes.ok) {
      const data = await staticRes.json();
      if (data && data.success && Array.isArray(data.plugins)) {
        return data.plugins.filter((p: YMM4Plugin) => p.isExternalSource);
      }
    }
  } catch (e) {
    // ignore
  }

  return [];
}

