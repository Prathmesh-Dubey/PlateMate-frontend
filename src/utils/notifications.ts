// src/utils/notifications.ts
// Phone notifications for stock alerts (Android app only; no-ops on the web).
// These are LOCAL notifications: they fire whenever the app checks stock (on open, on resume and
// every few minutes while it is running). Alerts while the app is fully closed would need a server
// push service (Firebase) on the backend.
import { isNativeApp } from '../config/appDownload';
import { isDemoMode } from '../demo/demoMode';

const CHANNEL_ID = 'stock-alerts';
const SEEN_KEY = 'platemate-stock-notified';

interface StockLike {
  id?: string | number;
  name?: string;
  itemName?: string;
  unit?: string;
  currentStock: number;
  minimumStockLevel: number;
  expiryDate?: string;
}

const todayISO = () => new Date().toISOString().split('T')[0];

const loadSeen = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
};

/** Asks for notification permission and creates the Android channel. Returns true when allowed. */
export const setupNotifications = async (): Promise<boolean> => {
  if (!isNativeApp()) return false;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      perm = await LocalNotifications.requestPermissions();
    }
    if (perm.display !== 'granted') return false;
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Stock alerts',
      description: 'Low stock and expiring item alerts',
      importance: 4,
      visibility: 1,
    });
    return true;
  } catch {
    return false;
  }
};

/** Notifies once per day for each low-stock / expiring item. */
export const notifyStockAlerts = async (items: StockLike[]): Promise<void> => {
  if (!isNativeApp() || isDemoMode() || !Array.isArray(items)) return;
  const day = todayISO();
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const seen = loadSeen();

  const fresh: Array<{ key: string; title: string; body: string }> = [];
  items.forEach((i, idx) => {
    if (!i) return;
    const label = i.name || i.itemName || 'Item';
    const id = String(i.id ?? idx);
    if (i.currentStock <= i.minimumStockLevel && seen[`low-${id}`] !== day) {
      fresh.push({
        key: `low-${id}`,
        title: 'Low stock',
        body: `${label}: ${i.currentStock}${i.unit ? ' ' + i.unit : ''} left (minimum ${i.minimumStockLevel})`,
      });
    }
    if (i.expiryDate && i.expiryDate <= soon && seen[`exp-${id}`] !== day) {
      fresh.push({
        key: `exp-${id}`,
        title: i.expiryDate < day ? 'Item expired' : 'Expiring soon',
        body: `${label} ${i.expiryDate < day ? 'expired on' : 'expires on'} ${i.expiryDate}`,
      });
    }
  });
  if (fresh.length === 0) return;

  const allowed = await setupNotifications();
  if (!allowed) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');

  const list = fresh.slice(0, 20);
  await LocalNotifications.schedule({
    notifications: list.map((n, k) => ({
      id: (Math.floor(Date.now() / 1000) % 1000000) + k,
      title: n.title,
      body: n.body,
      channelId: CHANNEL_ID,
      group: 'stock-alerts',
    })),
  });
  list.forEach((n) => (seen[n.key] = day));
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
};
