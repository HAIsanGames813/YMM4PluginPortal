export type ThemeMode = 'light' | 'dark' | 'system';
export type PageSize = 5 | 10 | 20 | 50 | 100 | 'all';
export type BatchDownloadMode = 'zip' | 'individual';

export interface PluginLink {
  name: string;
  url: string;
}

export interface YMM4Plugin {
  id: string;
  name: string;
  author: string;
  type: string;
  description: string;
  url: string;
  links: PluginLink[];
  isGithub: boolean;
  githubUser: string | null;
  githubRepo: string | null;
  version?: string;
  updatedAt?: string;
  publishedAt?: string;
  createdAt?: string;
  isEnabled?: boolean;
  license?: string;
  tags?: string[];
  price?: string;
  isExternalSource?: boolean;
  sourceName?: string;
  extraGhData?: {
    user: string;
    repo: string;
    name?: string;
    tag_name?: string;
    published_at?: string;
    file_name?: string;
    browser_download_url?: string;
  } | null;
}

export interface GithubAsset {
  id: number;
  name: string;
  size: number;
  download_count: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  name: string;
  published_at: string;
  created_at: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  zipball_url: string;
  tarball_url: string;
  assets: GithubAsset[];
}

export interface GithubDetailData {
  user: string;
  repo: string;
  releases: GithubRelease[];
}

export type AutoFetchDisplayMode = 'show' | 'only' | 'hide';

export interface FilterState {
  searchQuery: string;
  selectedTypes: string[]; // multi-select categories
  selectedHosts?: string[]; // multi-select hosts
  hostFilter: 'all' | 'github' | 'external';
  statusFilter: 'all' | 'enabled' | 'disabled';
  sortBy: 'updatedAt' | 'publishedAt' | 'name' | 'author' | 'type';
  sortOrder: 'asc' | 'desc';
  pageSize: PageSize;
  currentPage: number;
  batchDownloadMode: BatchDownloadMode;
  githubExternalMode: AutoFetchDisplayMode;
  boothExternalMode: AutoFetchDisplayMode;
}
