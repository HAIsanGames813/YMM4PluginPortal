import { YMM4Plugin } from '../types';

/**
 * Parses a date string into a timestamp (ms).
 * Returns null if missing or invalid.
 */
export function parseDateToTime(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const t = Date.parse(trimmed);
  return !isNaN(t) && t > 0 ? t : null;
}

/**
 * Returns the effective timestamp for "更新日順" (sortBy === 'updatedAt').
 * 1. GitHub組: DLリンクを取るところ（GitHub Releases / extraGhData）の公開・作成日時（日付＋時間）を優先
 * 2. plugin.updatedAt がある場合はその日時
 * 3. それ以外（BOOTH等で更新日取得が難しい組）は公開日（publishedAt / createdAt）を代替日時として間間に組み込む
 * 4. それでも取得できなかったものは null（日付がある最古のアイテムの末尾に配置）
 */
export function getPluginUpdatedEffectiveTime(plugin: YMM4Plugin): number | null {
  // 1. GitHub組: DLリンク（GitHub Releases / extraGhData）の日付と時間を優先
  if (plugin.extraGhData) {
    const dlDateTime = plugin.extraGhData.published_at || plugin.extraGhData.created_at || plugin.extraGhData.updated_at;
    const dlTime = parseDateToTime(dlDateTime);
    if (dlTime !== null) return dlTime;
  }

  // 2. plugin.updatedAt
  const updatedTime = parseDateToTime(plugin.updatedAt);
  if (updatedTime !== null) return updatedTime;

  // 3. それ以外（BOOTH等の更新日取得が難しい組）は公開日（publishedAt / createdAt）で組み込む
  const pubDate = plugin.publishedAt || plugin.createdAt;
  const publishedTime = parseDateToTime(pubDate);
  if (publishedTime !== null) return publishedTime;

  // 4. それでも取得できなかったやつはnull（一番古いやつのあとに配置）
  return null;
}

/**
 * Returns the effective timestamp for "公開日順" (sortBy === 'publishedAt').
 */
export function getPluginPublishedEffectiveTime(plugin: YMM4Plugin): number | null {
  const pubDate = plugin.publishedAt || plugin.createdAt || (plugin.extraGhData && (plugin.extraGhData.published_at || (plugin.extraGhData as any).created_at));
  return parseDateToTime(pubDate);
}
