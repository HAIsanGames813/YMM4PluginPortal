import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import yaml from 'yaml';
import { Navbar } from './components/Navbar';
import { SideDrawer } from './components/SideDrawer';
import { PluginCard } from './components/PluginCard';
import { VersionModal } from './components/VersionModal';
import { PluginDetailModal } from './components/PluginDetailModal';
import { BatchDownloadBar } from './components/BatchDownloadBar';
import { BatchDownloadModal } from './components/BatchDownloadModal';
import { PaginationControls } from './components/PaginationControls';
import { YMM4Plugin, ThemeMode, FilterState, PageSize } from './types';
import { getStoredTheme, applyTheme } from './utils/theme';
import { parseGithubRepo } from './utils/github';
import { RefreshCw, AlertCircle, Package, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, SlidersHorizontal } from 'lucide-react';

async function fetchDirectYmm4Plugins(): Promise<YMM4Plugin[]> {
  const fetchWithProxy = async (url: string) => {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch (e) {
      // Direct fetch failed (e.g. CORS)
    }
    try {
      const proxyRes = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
      if (proxyRes.ok) return proxyRes;
    } catch (e) {
      // CORS proxy 1 failed
    }
    try {
      const proxyRes2 = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
      if (proxyRes2.ok) return proxyRes2;
    } catch (e) {
      // CORS proxy 2 failed
    }
    return null;
  };

  const [ymlRes, ghListRes] = await Promise.all([
    fetchWithProxy('https://manjubox.net/ymm4plugins.yml'),
    fetchWithProxy('https://manjubox.net/api/ymm4plugins/github/list')
  ]);

  let yamlRawData: any = null;
  if (ymlRes && ymlRes.ok) {
    const text = await ymlRes.text();
    try {
      yamlRawData = yaml.parse(text);
    } catch (e) {
      console.error('YAML parse error:', e);
    }
  }

  let githubList: any[] = [];
  if (ghListRes && ghListRes.ok) {
    try {
      githubList = await ghListRes.json();
    } catch (e) {
      console.error('GitHub list JSON parse error:', e);
    }
  }

  const ghMap = new Map<string, any>();
  if (Array.isArray(githubList)) {
    for (const item of githubList) {
      if (item.user && item.repo) {
        ghMap.set(`${item.user.toLowerCase()}/${item.repo.toLowerCase()}`, item);
      } else if (item.full_name) {
        ghMap.set(item.full_name.toLowerCase(), item);
      }
    }
  }

  let rawPluginsList: any[] = [];
  if (Array.isArray(yamlRawData)) {
    rawPluginsList = yamlRawData;
  } else if (yamlRawData && typeof yamlRawData === 'object') {
    if (Array.isArray(yamlRawData.plugins)) {
      rawPluginsList = yamlRawData.plugins;
    } else {
      rawPluginsList = Object.values(yamlRawData);
    }
  }

  const normalizedPlugins: YMM4Plugin[] = rawPluginsList.map((item: any, idx: number) => {
    const id = item.id || `plugin-${idx}-${Date.now()}`;
    const name = item.name || item.title || item.plugin_name || '無題プラグイン';
    const author = item.author || item.creator || item.user || '不明';
    const type = item.type || item.category || 'その他';
    const description = item.description || item.desc || item.summary || '';
    const url = item.url || item.website || item.homepage || '';

    let links: any[] = [];
    if (Array.isArray(item.links)) {
      links = item.links;
    } else if (typeof item.links === 'object' && item.links !== null) {
      links = Object.entries(item.links).map(([key, val]) => ({ name: key, url: val }));
    } else if (typeof item.links === 'string') {
      links = [item.links];
    }

    let ghInfo: { user: string; repo: string } | null = parseGithubRepo(url);
    if (!ghInfo) {
      for (const l of links) {
        const linkUrl = typeof l === 'string' ? l : (l.url || l.href || '');
        const parsed = parseGithubRepo(linkUrl);
        if (parsed) {
          ghInfo = parsed;
          break;
        }
      }
    }

    if (!ghInfo && item.github) {
      if (typeof item.github === 'string') {
        ghInfo = parseGithubRepo(item.github);
      } else if (item.github.user && item.github.repo) {
        ghInfo = { user: item.github.user, repo: item.github.repo };
      }
    }

    const isGithub = !!ghInfo;
    const githubUser = ghInfo ? ghInfo.user : null;
    const githubRepo = ghInfo ? ghInfo.repo : null;

    let extraGhData = null;
    if (ghInfo) {
      const key = `${ghInfo.user.toLowerCase()}/${ghInfo.repo.toLowerCase()}`;
      extraGhData = ghMap.get(key) || null;
    }

    const rawIsEnabled = item.isEnabled ?? item.enabled ?? item.is_enabled;
    const isEnabled = rawIsEnabled === false || rawIsEnabled === 'false' ? false : true;

    const publishedAt = item.publishedAt || item.published_at || item.createdAt || item.created_at || item.date || item.releaseDate || item.release_date || (extraGhData ? extraGhData.created_at || extraGhData.published_at : '') || '';

    return {
      id: String(id),
      name: String(name),
      author: String(author),
      type: String(type),
      description: String(description),
      url: url ? String(url) : '',
      links: links.map(l => typeof l === 'string' ? { name: '', url: l } : { name: l.name || '', url: l.url || l.href || '#' }),
      isGithub,
      githubUser,
      githubRepo,
      version: item.version || (extraGhData ? extraGhData.latest_tag || extraGhData.tag_name : '') || '',
      updatedAt: item.updated_at || item.updatedAt || (extraGhData ? extraGhData.updated_at : '') || '',
      publishedAt,
      isEnabled,
      license: item.license || '',
      tags: Array.isArray(item.tags) ? item.tags : (item.tag ? [item.tag] : []),
      extraGhData
    };
  });

  for (const ghItem of githubList) {
    if (!ghItem.user || !ghItem.repo) continue;
    const exists = normalizedPlugins.some(
      p => p.githubUser?.toLowerCase() === ghItem.user.toLowerCase() && p.githubRepo?.toLowerCase() === ghItem.repo.toLowerCase()
    );
    if (!exists) {
      normalizedPlugins.push({
        id: `gh-${ghItem.user}-${ghItem.repo}`,
        name: ghItem.name || ghItem.repo,
        author: ghItem.user || ghItem.owner || 'GitHub User',
        type: ghItem.type || 'GitHubプラグイン',
        description: ghItem.description || '',
        url: `https://github.com/${ghItem.user}/${ghItem.repo}`,
        links: [{ name: 'GitHub Repo', url: `https://github.com/${ghItem.user}/${ghItem.repo}` }],
        isGithub: true,
        githubUser: ghItem.user,
        githubRepo: ghItem.repo,
        version: ghItem.latest_tag || ghItem.tag_name || '',
        updatedAt: ghItem.updated_at || '',
        publishedAt: ghItem.created_at || ghItem.published_at || '',
        isEnabled: true,
        license: ghItem.license || '',
        tags: Array.isArray(ghItem.tags) ? ghItem.tags : ['GitHub'],
        extraGhData: ghItem
      });
    }
  }

  return normalizedPlugins;
}

export default function App() {
  const [plugins, setPlugins] = useState<YMM4Plugin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Theme Mode State (3-way: light, dark, system)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredTheme);

  // Side Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Helper function to split composite category string (e.g. "映像エフェクト、図形" -> ["映像エフェクト", "図形"])
  const getPluginCategories = (typeStr?: string): string[] => {
    if (!typeStr || !typeStr.trim()) return ['その他'];
    const parts = typeStr
      .split(/[、、,／/\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : ['その他'];
  };

  // Filter & Search State
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    selectedTypes: [],
    hostFilter: 'all',
    statusFilter: 'all',
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    pageSize: 20,
    currentPage: 1,
    batchDownloadMode: 'zip'
  });

  // Selected Plugins for Batch Download
  const [selectedPluginIds, setSelectedPluginIds] = useState<Set<string>>(new Set());

  // Modal States
  const [versionModalPlugin, setVersionModalPlugin] = useState<YMM4Plugin | null>(null);
  const [detailModalPlugin, setDetailModalPlugin] = useState<YMM4Plugin | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Apply Theme Mode change
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
  };

  useEffect(() => {
    applyTheme(themeMode);
  }, []);

  // Fetch Plugins Data
  const loadPlugins = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: any = null;

      // 1. Try local Express API route (in development / server container)
      try {
        const res = await fetch('/api/ymm4/plugins');
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          data = await res.json();
        }
      } catch (e) {
        console.warn('Local Express API route unavailable, checking static bundle...');
      }

      if (data && data.success && Array.isArray(data.plugins) && data.plugins.length > 0) {
        setPlugins(data.plugins);
        setLastUpdated(data.timestamp || new Date().toISOString());
        return;
      }

      // 2. Try static generated plugins-data.json (for GitHub Pages / static hosting)
      try {
        const staticRes = await fetch('./plugins-data.json');
        const contentType = staticRes.headers.get('content-type');
        if (staticRes.ok && contentType && contentType.includes('application/json')) {
          const staticData = await staticRes.json();
          if (staticData && Array.isArray(staticData.plugins) && staticData.plugins.length > 0) {
            setPlugins(staticData.plugins);
            setLastUpdated(staticData.timestamp || new Date().toISOString());
            return;
          }
        }
      } catch (e) {
        console.warn('Static plugins-data.json unavailable, trying CORS proxy fallback...');
      }

      // 3. CORS Proxy Fallback if static JSON is missing
      const directPlugins = await fetchDirectYmm4Plugins();
      if (directPlugins && directPlugins.length > 0) {
        setPlugins(directPlugins);
        setLastUpdated(new Date().toISOString());
      } else {
        setError('プラグインデータの取得に失敗しました。');
      }
    } catch (err: any) {
      console.error('Error in loadPlugins:', err);
      setError(err?.message || 'プラグイン情報の取得に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlugins();
  }, []);

  // Compute available plugin types with counts (individual categories)
  const availableTypes = useMemo(() => {
    const typeMap = new Map<string, number>();
    for (const p of plugins) {
      const cats = getPluginCategories(p.type);
      for (const cat of cats) {
        typeMap.set(cat, (typeMap.get(cat) || 0) + 1);
      }
    }
    const list = Array.from(typeMap.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [plugins]);

  // Sync initial selectedTypes with availableTypes once plugins load
  useEffect(() => {
    if (availableTypes.length > 0 && filterState.selectedTypes.length === 0) {
      setFilterState((prev) => ({
        ...prev,
        selectedTypes: availableTypes.map((t) => t.name)
      }));
    }
  }, [availableTypes]);

  const deferredFilterState = useDeferredValue(filterState);

  // Filter and Sort Plugins
  const filteredPlugins = useMemo(() => {
    return plugins
      .filter((p) => {
        // Search query filter
        if (deferredFilterState.searchQuery.trim()) {
          const q = deferredFilterState.searchQuery.toLowerCase().trim();
          const nameMatch = p.name.toLowerCase().includes(q);
          const authorMatch = p.author.toLowerCase().includes(q);
          const typeMatch = p.type.toLowerCase().includes(q);
          const descMatch = p.description.toLowerCase().includes(q);
          const ghMatch = p.githubRepo?.toLowerCase().includes(q);
          const tagMatch = p.tags?.some((t) => t.toLowerCase().includes(q));

          if (!nameMatch && !authorMatch && !typeMatch && !descMatch && !ghMatch && !tagMatch) {
            return false;
          }
        }

        // Multi-select category filter: If at least one category matches selectedTypes
        if (deferredFilterState.selectedTypes.length < availableTypes.length) {
          const cats = getPluginCategories(p.type);
          const hasMatch = cats.some((c) => deferredFilterState.selectedTypes.includes(c));
          if (!hasMatch) return false;
        }

        // Distribution Status Filter (isEnabled: false = 配布終了)
        if (deferredFilterState.statusFilter === 'enabled') {
          if (p.isEnabled === false) return false;
        } else if (deferredFilterState.statusFilter === 'disabled') {
          if (p.isEnabled !== false) return false;
        }

        // Host filter
        if (deferredFilterState.hostFilter === 'github') {
          if (!p.isGithub) return false;
        } else if (deferredFilterState.hostFilter === 'external') {
          if (p.isGithub) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = '';
        let valB = '';

        if (deferredFilterState.sortBy === 'name') {
          valA = a.name;
          valB = b.name;
        } else if (deferredFilterState.sortBy === 'author') {
          valA = a.author;
          valB = b.author;
        } else if (deferredFilterState.sortBy === 'type') {
          valA = a.type || 'その他';
          valB = b.type || 'その他';
        } else if (deferredFilterState.sortBy === 'updatedAt') {
          valA = a.updatedAt || a.version || '';
          valB = b.updatedAt || b.version || '';
        } else if (deferredFilterState.sortBy === 'publishedAt') {
          valA = a.publishedAt || a.createdAt || '';
          valB = b.publishedAt || b.createdAt || '';
        }

        const comp = valA.localeCompare(valB, 'ja', { numeric: true });
        return deferredFilterState.sortOrder === 'asc' ? comp : -comp;
      });
  }, [plugins, deferredFilterState, availableTypes]);

  // Paginated plugins list
  const totalPages =
    filterState.pageSize === 'all'
      ? 1
      : Math.max(1, Math.ceil(filteredPlugins.length / filterState.pageSize));

  const currentPageSafe = Math.min(filterState.currentPage, totalPages);

  const paginatedPlugins = useMemo(() => {
    if (filterState.pageSize === 'all') return filteredPlugins;
    const start = (currentPageSafe - 1) * filterState.pageSize;
    return filteredPlugins.slice(start, start + filterState.pageSize);
  }, [filteredPlugins, filterState.pageSize, currentPageSafe]);

  // Toggle Single Selection
  const handleToggleSelect = React.useCallback((plugin: YMM4Plugin) => {
    setSelectedPluginIds((prev) => {
      const next = new Set(prev);
      if (next.has(plugin.id)) {
        next.delete(plugin.id);
      } else {
        next.add(plugin.id);
      }
      return next;
    });
  }, []);

  // Select all visible (paginated) plugins vs clear visible
  const isAllVisibleSelected =
    paginatedPlugins.length > 0 &&
    paginatedPlugins.every((p) => selectedPluginIds.has(p.id));

  const handleSelectAllVisible = () => {
    setSelectedPluginIds((prev) => {
      const next = new Set(prev);
      if (isAllVisibleSelected) {
        paginatedPlugins.forEach((p) => next.delete(p.id));
      } else {
        paginatedPlugins.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedPluginIds(new Set());
  };

  // Get selected plugin objects
  const selectedPluginsList = useMemo(() => {
    return plugins.filter((p) => selectedPluginIds.has(p.id));
  }, [plugins, selectedPluginIds]);

  // Reset filter handler
  const handleResetFilters = () => {
    setFilterState({
      searchQuery: '',
      selectedTypes: availableTypes.map((t) => t.name),
      hostFilter: 'all',
      statusFilter: 'all',
      sortBy: 'publishedAt',
      sortOrder: 'desc',
      pageSize: 20,
      currentPage: 1,
      batchDownloadMode: 'zip'
    });
  };

  const isFiltered =
    filterState.searchQuery !== '' ||
    filterState.selectedTypes.length < availableTypes.length ||
    filterState.hostFilter !== 'all' ||
    filterState.statusFilter !== 'all';

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-mono pb-24">
      
      {/* Header Navigation with Top-Right Menu Toggle */}
      <Navbar
        themeMode={themeMode}
        onThemeChange={handleThemeChange}
        onRefresh={loadPlugins}
        isRefreshing={isLoading}
        lastUpdated={lastUpdated}
        totalCount={plugins.length}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        isFiltered={isFiltered}
      />

      {/* Main Layout Wrapper */}
      <div className="flex-1 flex w-full mx-auto">
        
        {/* Side Menu Filter & Settings (Desktop Fixed / Mobile Drawer) */}
        <SideDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          filterState={filterState}
          onFilterChange={(newFields) =>
            setFilterState((prev) => ({ ...prev, ...newFields }))
          }
          availableTypes={availableTypes}
          matchedCount={filteredPlugins.length}
          totalCount={plugins.length}
          onResetFilters={handleResetFilters}
          isAllVisibleSelected={isAllVisibleSelected}
          onSelectAllVisible={handleSelectAllVisible}
        />

        {/* Main Content */}
        <main className="flex-1 w-full px-4 py-6 sm:px-6 space-y-6 min-w-0">
          
          {/* Top Pagination & Stats Bar */}
          {!isLoading && !error && filteredPlugins.length > 0 && (
            <div className="p-3 bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-zinc-800 dark:text-zinc-200 font-bold">
                  表示中: { (currentPageSafe - 1) * (filterState.pageSize === 'all' ? filteredPlugins.length : filterState.pageSize as number) + 1 } - { filterState.pageSize === 'all' ? filteredPlugins.length : Math.min(currentPageSafe * (filterState.pageSize as number), filteredPlugins.length) } 件 / 全 {filteredPlugins.length} 件
                </div>

                {/* Page Size Selector */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 border border-zinc-300 dark:border-zinc-700 text-[11px] flex-wrap">
                  <span className="text-zinc-500 dark:text-zinc-400 px-1 font-bold">表示数:</span>
                  {[5, 10, 20, 50, 100, 'all'].map((size) => (
                    <button
                      key={String(size)}
                      onClick={() =>
                        setFilterState((prev) => ({
                          ...prev,
                          pageSize: size as PageSize,
                          currentPage: 1
                        }))
                      }
                      className={`px-2 py-0.5 text-center transition-colors cursor-pointer font-bold ${
                        filterState.pageSize === size
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {size === 'all' ? '全体' : `${size}件`}
                    </button>
                  ))}
                </div>
              </div>

              {filterState.pageSize !== 'all' && totalPages > 1 && (
                <div className="ml-auto">
                  <PaginationControls
                    currentPage={currentPageSafe}
                    totalPages={totalPages}
                    onPageChange={(page) =>
                      setFilterState((prev) => ({ ...prev, currentPage: page }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100">
              <RefreshCw className="w-8 h-8 animate-spin text-zinc-900 dark:text-zinc-100" />
              <p className="text-sm font-bold">Manjubox API からプラグイン情報を取得中...</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="p-6 bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 space-y-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-base">
                <AlertCircle className="w-5 h-5" />
                <span>エラーが発生しました</span>
              </div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300">{error}</p>
              <button
                onClick={loadPlugins}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold border border-zinc-900 dark:border-zinc-100 cursor-pointer"
              >
                再読み込みを試す
              </button>
            </div>
          )}

          {/* No Results Match State */}
          {!isLoading && !error && filteredPlugins.length === 0 && (
            <div className="py-16 text-center bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 p-6 space-y-3">
              <Info className="w-8 h-8 mx-auto text-zinc-400" />
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                該当するプラグインが見つかりませんでした
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                検索キーワードやカテゴリー、配布ステータスフィルターの条件を変更してお試しください。
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold border border-zinc-900 dark:border-zinc-100 cursor-pointer inline-block"
              >
                フィルターを初期化
              </button>
            </div>
          )}

          {/* Plugin Cards Grid */}
          {!isLoading && !error && filteredPlugins.length > 0 && (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {paginatedPlugins.map((plugin) => (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    isSelected={selectedPluginIds.has(plugin.id)}
                    onToggleSelect={handleToggleSelect}
                    onOpenVersions={setVersionModalPlugin}
                    onOpenDetails={setDetailModalPlugin}
                  />
                ))}
              </div>

              {/* Bottom Pagination Bar */}
              {filterState.pageSize !== 'all' && totalPages > 1 && (
                <div className="p-4 bg-white dark:bg-zinc-900 border-2 border-zinc-900 dark:border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-zinc-600 dark:text-zinc-400 font-bold">
                    全 {filteredPlugins.length} 件中 { (currentPageSafe - 1) * (filterState.pageSize as number) + 1 } 〜 { Math.min(currentPageSafe * (filterState.pageSize as number), filteredPlugins.length) } 件目を表示
                  </div>

                  <PaginationControls
                    currentPage={currentPageSafe}
                    totalPages={totalPages}
                    onPageChange={(page) =>
                      setFilterState((prev) => ({ ...prev, currentPage: page }))
                    }
                  />
                </div>
              )}
            </>
          )}

        </main>
      </div>

      {/* Sticky Bottom Bar for Batch Download Selection */}
      <BatchDownloadBar
        selectedPlugins={selectedPluginsList}
        onClearSelection={handleClearSelection}
        onSelectAllVisible={handleSelectAllVisible}
        onExecuteBatch={() => setIsBatchModalOpen(true)}
        isAllVisibleSelected={isAllVisibleSelected}
      />

      {/* Version Selection Modal */}
      {versionModalPlugin && (
        <VersionModal
          plugin={versionModalPlugin}
          onClose={() => setVersionModalPlugin(null)}
        />
      )}

      {/* Plugin Detail Modal */}
      {detailModalPlugin && (
        <PluginDetailModal
          plugin={detailModalPlugin}
          onClose={() => setDetailModalPlugin(null)}
          onOpenVersions={setVersionModalPlugin}
          isSelected={selectedPluginIds.has(detailModalPlugin.id)}
          onToggleSelect={handleToggleSelect}
        />
      )}

      {/* Batch Download Modal */}
      {isBatchModalOpen && (
        <BatchDownloadModal
          selectedPlugins={selectedPluginsList}
          batchDownloadMode={filterState.batchDownloadMode}
          onClose={() => setIsBatchModalOpen(false)}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Footer */}
      <footer className="mt-12 py-6 bg-white dark:bg-zinc-900 border-t-2 border-zinc-900 dark:border-zinc-100 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2">
            <img src="./ymm4pluginportal.png" alt="YMM4プラグインポータルサイト Logo" className="w-5 h-5 object-contain" />
            <span>YMM4プラグインポータルサイト</span>
          </div>
          <div className="text-[10px] text-zinc-400">Data provided by manjubox.net APIs &amp; GitHub Repositories</div>
        </div>
      </footer>

    </div>
  );
}
