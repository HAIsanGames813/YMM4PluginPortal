import { YMM4Plugin } from '../types';

export function isBoothPlugin(plugin: YMM4Plugin): boolean {
  if (plugin.sourceName === 'BOOTH') return true;
  if (plugin.url && plugin.url.toLowerCase().includes('booth.pm')) return true;
  if (plugin.links && plugin.links.some(l => l.url && l.url.toLowerCase().includes('booth.pm'))) return true;
  return false;
}

export function getPluginDisplayPrice(plugin: YMM4Plugin, boothDataPrice?: string): string {
  const isBooth = isBoothPlugin(plugin);
  if (!isBooth) {
    return '-円';
  }
  const priceToUse = boothDataPrice || plugin.price;
  if (priceToUse && priceToUse.trim() !== '') {
    return priceToUse;
  }
  return '-円';
}

export function getPluginNumericPrice(plugin: YMM4Plugin, boothDataPrice?: string): number {
  const isBooth = isBoothPlugin(plugin);
  if (!isBooth) {
    return -1; // Non-booth items sorted at the end
  }
  const priceToUse = boothDataPrice || plugin.price;
  if (!priceToUse) return 0; // Booth but price unknown -> treat as 0 or free
  const clean = priceToUse.replace(/[^\d]/g, '');
  if (clean === '') {
    if (priceToUse.includes('無料') || priceToUse.includes('Free')) return 0;
    return 0;
  }
  return parseInt(clean, 10);
}
