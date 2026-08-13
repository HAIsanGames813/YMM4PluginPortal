export function getDomainFromUrl(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function getSiteNameFromUrl(urlStr: string, rawName?: string): string {
  if (!urlStr) return 'Webサイト';

  const domain = getDomainFromUrl(urlStr).toLowerCase();
  
  let siteName = '';

  if (domain.includes('github.com')) {
    siteName = 'GitHub';
  } else if (domain.includes('booth.pm')) {
    siteName = 'BOOTH';
  } else if (domain.includes('x.com') || domain.includes('twitter.com')) {
    siteName = 'X (Twitter)';
  } else if (domain.includes('commons.nicovideo.jp')) {
    siteName = 'ニコニ・コモンズ';
  } else if (domain.includes('seiga.nicovideo.jp')) {
    siteName = 'ニコニコ静画';
  } else if (domain.includes('3d.nicovideo.jp')) {
    siteName = 'ニコニ立体';
  } else if (domain.includes('nicovideo.jp')) {
    siteName = 'ニコニコ動画';
  } else if (domain.includes('getuploader.com')) {
    siteName = 'GetUploader';
  } else if (domain.includes('note.com')) {
    siteName = 'note';
  } else if (domain.includes('drive.google.com')) {
    siteName = 'Google Drive';
  } else if (domain.includes('docs.google.com')) {
    siteName = 'Google Docs';
  } else if (domain.includes('forms.gle') || domain.includes('forms.google.com')) {
    siteName = 'Google Forms';
  } else if (domain.includes('dropbox.com')) {
    siteName = 'Dropbox';
  } else if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
    siteName = 'YouTube';
  } else if (domain.includes('ymm4-info.net')) {
    siteName = 'YMM4情報サイト';
  } else if (domain.includes('manjubox.net')) {
    siteName = 'まんじゅう屋 (manjubox.net)';
  } else if (domain.includes('qiita.com')) {
    siteName = 'Qiita';
  } else if (domain.includes('zenn.dev')) {
    siteName = 'Zenn';
  } else if (domain.includes('bowlroll.net')) {
    siteName = 'BowlRoll';
  } else if (domain.includes('ci-en')) {
    siteName = 'Ci-en';
  } else if (domain.includes('fanbox.cc')) {
    siteName = 'FANBOX';
  } else if (domain.includes('pixiv.net')) {
    siteName = 'pixiv';
  } else if (domain.includes('discord.')) {
    siteName = 'Discord';
  } else if (domain) {
    siteName = domain;
  } else {
    siteName = 'Webサイト';
  }

  // Check if rawName is a custom specific title (and not generic like 'link', 'links', '配布サイト', etc.)
  if (rawName && typeof rawName === 'string') {
    const normalized = rawName.trim().toLowerCase();
    const isGeneric = [
      'link', 'links', 'url', 'urls', '0', '1', '2', '3', '4', '5',
      '配布サイト', '配布元', 'メインページ', '配布元・メインページ',
      '関連リンク', '配布url', 'サイト', 'ウェブサイト', 'homepage', 'website', 'site'
    ].includes(normalized);

    if (!isGeneric && rawName.trim().length > 0) {
      return `${rawName} (${siteName})`;
    }
  }

  return siteName;
}
