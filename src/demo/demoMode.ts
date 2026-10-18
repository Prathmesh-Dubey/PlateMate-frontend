// src/demo/demoMode.ts
// Demo mode lets visitors explore the whole app with made-up data. While it is on, every API call is
// answered by the in-memory mock backend (src/demo/mockBackend.ts) and NOTHING is sent to the real
// server or saved to localStorage. The flag lives only in memory, so reloading the page leaves demo mode
// and discards everything the visitor entered.
let demoActive = false;

export const isDemoMode = (): boolean => demoActive;

export const setDemoMode = (on: boolean): void => {
  demoActive = on;
  if (on) seedMenuMemory();
  else memory.clear();
};

export const DEMO_USER = {
  id: 'demo-user',
  fullName: 'Demo Visitor',
  email: 'demo@platemate.app',
  phoneNumber: '9876543210',
  role: 'ADMIN',
};

// ---- In-memory replacement for localStorage (used by the Menu Planner in demo mode) ----
const memory = new Map<string, string>();

const SAMPLE_MENU: Array<[string, string, string, string]> = [
  ['Poha, Tea', 'Dal Tadka, Jeera Rice, Roti, Salad', 'Samosa, Chai', 'Paneer Butter Masala, Roti, Rice, Kheer'],
  ['Upma, Tea', 'Rajma, Rice, Roti, Papad', 'Biscuits, Tea', 'Aloo Gobi, Dal Fry, Roti, Rice'],
  ['Idli Sambar', 'Chole, Bhatura, Onion Salad', 'Bhajiya, Chai', 'Mix Veg, Dal, Roti, Rice, Gulab Jamun'],
  ['Paratha, Curd', 'Kadhi Pakoda, Rice, Roti', 'Sandwich, Tea', 'Matar Paneer, Roti, Jeera Rice'],
  ['Misal Pav', 'Veg Pulao, Raita, Dal', 'Vada Pav, Chai', 'Palak Dal, Bhindi Fry, Roti, Rice'],
  ['Sabudana Khichdi', 'Dal Khichdi, Papad, Pickle', 'Pakoda, Tea', 'Veg Biryani, Raita, Sweet'],
  ['Puri Bhaji', 'Special Thali', 'Cake, Tea', 'Dal Makhani, Naan, Rice, Ice Cream'],
];

const mondayISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return d.toISOString().split('T')[0];
};

const seedMenuMemory = () => {
  memory.clear();
  const monday = new Date(mondayISO() + 'T00:00:00');
  const cells: Record<string, Record<string, string>> = {};
  SAMPLE_MENU.forEach(([b, l, s, dn], i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    cells[d.toISOString().split('T')[0]] = { BREAKFAST: b, LUNCH: l, SNACKS: s, DINNER: dn };
  });
  memory.set('messMenuCells_v2', JSON.stringify(cells));
};

/** Same surface as the bits of localStorage the Menu Planner uses; in demo mode it never touches real storage. */
export const menuStorage = {
  getItem: (key: string): string | null => (demoActive ? (memory.get(key) ?? null) : localStorage.getItem(key)),
  setItem: (key: string, value: string): void => {
    if (demoActive) memory.set(key, value);
    else localStorage.setItem(key, value);
  },
};
