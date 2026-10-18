// server/routes/menus.ts
import { Router } from 'express';
import { menus, uid } from '../db';
import type { Menu, MenuItem } from '../../src/types';

export const menusRouter = Router();

// Today's menus
menusRouter.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.json(menus.filter(m => m.menuDate === today));
});

// Weekly plan
menusRouter.get('/weekly-plan', (req, res) => {
  const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
  const start = new Date(startDate);
  const plan: Array<{ day: string; meals: Menu[] }> = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMeals = menus.filter(m => m.menuDate === dayStr);
    plan.push({ day: `${dayName} (${dayStr})`, meals: dayMeals });
  }

  res.json(plan);
});

// Weekly
menusRouter.get('/weekly', (req, res) => {
  const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  const endStr = end.toISOString().split('T')[0];

  res.json(menus.filter(m => m.menuDate >= startDate && m.menuDate <= endStr));
});

// Monthly
menusRouter.get('/monthly', (req, res) => {
  const month = Number(req.query.month) || (new Date().getMonth() + 1);
  const year = Number(req.query.year) || new Date().getFullYear();

  res.json(menus.filter(m => {
    const d = new Date(m.menuDate);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }));
});

// Summary
menusRouter.get('/summary', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = menus.filter(m => {
    if (startDate && m.menuDate < startDate) return false;
    if (endDate && m.menuDate > endDate) return false;
    return true;
  });

  const categories: Record<string, number> = {};
  let totalItems = 0;

  filtered.forEach(m => {
    m.items?.forEach(item => {
      totalItems++;
      categories[item.category] = (categories[item.category] || 0) + 1;
    });
  });

  res.json({ totalMenus: filtered.length, totalItems, categories });
});

// Popular items
menusRouter.get('/popular-items', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const filtered = menus.filter(m => {
    if (startDate && m.menuDate < startDate) return false;
    if (endDate && m.menuDate > endDate) return false;
    return true;
  });

  const itemCounts: Record<string, { count: number; category: string }> = {};
  filtered.forEach(m => {
    m.items?.forEach(item => {
      if (!itemCounts[item.itemName]) {
        itemCounts[item.itemName] = { count: 0, category: item.category };
      }
      itemCounts[item.itemName].count++;
    });
  });

  const popular = Object.entries(itemCounts).map(([itemName, data]) => ({
    itemName,
    count: data.count,
    category: data.category,
  })).sort((a, b) => b.count - a.count);

  res.json(popular);
});

// Copy menu to target date
menusRouter.post('/copy', (req, res) => {
  const sourceMenuId = req.query.sourceMenuId as string;
  const targetDate = req.query.targetDate as string;
  const mealType = req.query.mealType as any;

  const source = menus.find(m => m.id === sourceMenuId);
  if (!source) return res.status(404).json({ message: 'Source menu not found' });

  const newMenu: Menu = {
    ...source,
    id: uid('menu'),
    menuDate: targetDate,
    mealType: mealType || source.mealType,
    items: source.items.map(it => ({ ...it, id: uid('item') })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  menus.unshift(newMenu);
  res.json(newMenu);
});

// Copy weekly
menusRouter.post('/copy-weekly', (req, res) => {
  const sourceStart = req.query.sourceWeekStart as string;
  const targetStart = req.query.targetWeekStart as string;

  const sourceDate = new Date(sourceStart);
  const targetDate = new Date(targetStart);
  const dayDiff = Math.round((targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));

  let copied = 0;
  const sourceEnd = new Date(sourceDate);
  sourceEnd.setDate(sourceDate.getDate() + 7);
  const sourceEndStr = sourceEnd.toISOString().split('T')[0];

  const sourceMenus = menus.filter(m => m.menuDate >= sourceStart && m.menuDate < sourceEndStr);

  sourceMenus.forEach(sm => {
    const origD = new Date(sm.menuDate);
    origD.setDate(origD.getDate() + dayDiff);
    const newDateStr = origD.toISOString().split('T')[0];

    menus.unshift({
      ...sm,
      id: uid('menu'),
      menuDate: newDateStr,
      items: sm.items.map(it => ({ ...it, id: uid('item') })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    copied++;
  });

  res.json({ success: true, message: `Copied ${copied} menus to target week`, copied });
});

// By date and meal type
menusRouter.get('/date/:date/meal/:mealType', (req, res) => {
  const { date, mealType } = req.params;
  const m = menus.find(menu => menu.menuDate === date && menu.mealType === mealType);
  if (!m) return res.status(404).json({ message: 'Menu not found for given date and meal type' });
  res.json(m);
});

// By date
menusRouter.get('/date/:date', (req, res) => {
  res.json(menus.filter(m => m.menuDate === req.params.date));
});

// By range
menusRouter.get('/range', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  res.json(menus.filter(m => {
    if (startDate && m.menuDate < startDate) return false;
    if (endDate && m.menuDate > endDate) return false;
    return true;
  }));
});

// ================= Menu Items =================

// Add item to menu
menusRouter.post('/:menuId/items', (req, res) => {
  const menu = menus.find(m => m.id === req.params.menuId);
  if (!menu) return res.status(404).json({ message: 'Menu not found' });
  const data: MenuItem = req.body;
  const newItem: MenuItem = {
    ...data,
    id: data.id || uid('item'),
    isAvailable: data.isAvailable !== false,
  };
  menu.items = menu.items || [];
  menu.items.push(newItem);
  menu.updatedAt = new Date().toISOString();
  res.status(201).json(newItem);
});

// Update item in menu
menusRouter.put('/:menuId/items/:itemId', (req, res) => {
  const menu = menus.find(m => m.id === req.params.menuId);
  if (!menu) return res.status(404).json({ message: 'Menu not found' });
  const idx = menu.items.findIndex(i => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ message: 'Item not found' });

  menu.items[idx] = { ...menu.items[idx], ...req.body };
  menu.updatedAt = new Date().toISOString();
  res.json(menu.items[idx]);
});

// Remove item from menu
menusRouter.delete('/:menuId/items/:itemId', (req, res) => {
  const menu = menus.find(m => m.id === req.params.menuId);
  if (!menu) return res.status(404).json({ message: 'Menu not found' });
  const idx = menu.items.findIndex(i => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ message: 'Item not found' });

  menu.items.splice(idx, 1);
  menu.updatedAt = new Date().toISOString();
  res.status(204).send();
});

// Update availability
menusRouter.patch('/:menuId/items/:itemId/availability', (req, res) => {
  const menu = menus.find(m => m.id === req.params.menuId);
  if (!menu) return res.status(404).json({ message: 'Menu not found' });
  const item = menu.items.find(i => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ message: 'Item not found' });

  item.isAvailable = req.query.available === 'true';
  menu.updatedAt = new Date().toISOString();
  res.json(item);
});

// Toggle status
menusRouter.patch('/:id/toggle', (req, res) => {
  const menu = menus.find(m => m.id === req.params.id);
  if (!menu) return res.status(404).json({ message: 'Menu not found' });
  menu.status = menu.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  menu.updatedAt = new Date().toISOString();
  res.json(menu);
});

// Get all
menusRouter.get('/', (req, res) => {
  res.json(menus);
});

// Create
menusRouter.post('/', (req, res) => {
  const data: Menu = req.body;
  const newMenu: Menu = {
    ...data,
    id: data.id || uid('menu'),
    status: data.status || 'ACTIVE',
    items: data.items?.map(it => ({ ...it, id: it.id || uid('item') })) || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  menus.unshift(newMenu);
  res.status(201).json(newMenu);
});

// Get by ID
menusRouter.get('/:id', (req, res) => {
  const m = menus.find(item => item.id === req.params.id);
  if (!m) return res.status(404).json({ message: 'Menu not found' });
  res.json(m);
});

// Update
menusRouter.put('/:id', (req, res) => {
  const idx = menus.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Menu not found' });
  menus[idx] = { ...menus[idx], ...req.body, updatedAt: new Date().toISOString() };
  res.json(menus[idx]);
});

// Delete
menusRouter.delete('/:id', (req, res) => {
  const idx = menus.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Menu not found' });
  menus.splice(idx, 1);
  res.status(204).send();
});
