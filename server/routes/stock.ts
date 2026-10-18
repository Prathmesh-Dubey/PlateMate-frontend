// server/routes/stock.ts
import { Router } from 'express';
import { stockItems, stockTransactions, uid } from '../db';
import type { StockItem, StockTransaction } from '../../src/types';

export const stockRouter = Router();

// Summary
stockRouter.get('/summary', (req, res) => {
  const totalItems = stockItems.length;
  const totalValue = stockItems.reduce((acc, item) => acc + item.currentStock * item.unitPrice, 0);
  const lowStockItems = stockItems.filter(i => i.currentStock <= i.minimumStockLevel).length;
  const categories = Array.from(new Set(stockItems.map(i => i.category)));
  res.json({ totalItems, totalValue, lowStockItems, categories });
});

// Summary by category
stockRouter.get('/summary/category/:category', (req, res) => {
  const cat = decodeURIComponent(req.params.category).toLowerCase();
  const items = stockItems.filter(i => i.category.toLowerCase() === cat);
  const totalItems = items.length;
  const totalValue = items.reduce((acc, item) => acc + item.currentStock * item.unitPrice, 0);
  res.json({ totalItems, totalValue, items });
});

// Total value
stockRouter.get('/total-value', (req, res) => {
  const totalValue = stockItems.reduce((acc, item) => acc + item.currentStock * item.unitPrice, 0);
  res.json({ totalValue });
});

// Check low stock alerts
stockRouter.post('/alerts/check', (req, res) => {
  const alerts = stockItems
    .filter(item => item.currentStock <= item.minimumStockLevel)
    .map(item => ({
      item,
      currentStock: item.currentStock,
      minLevel: item.minimumStockLevel,
    }));
  res.json({ alerts });
});

// Low stock items
stockRouter.get('/items/low-stock', (req, res) => {
  res.json(stockItems.filter(item => item.currentStock <= item.minimumStockLevel));
});

// Over stock items
stockRouter.get('/items/over-stock', (req, res) => {
  res.json(stockItems.filter(item => item.maximumStockLevel && item.currentStock >= item.maximumStockLevel));
});

// Active items
stockRouter.get('/items/active', (req, res) => {
  res.json(stockItems.filter(item => item.status !== 'INACTIVE'));
});

// Category items
stockRouter.get('/items/category/:category', (req, res) => {
  const cat = decodeURIComponent(req.params.category).toLowerCase();
  res.json(stockItems.filter(item => item.category.toLowerCase() === cat));
});

// By item name
stockRouter.get('/items/name/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name).toLowerCase();
  const found = stockItems.find(item => item.itemName.toLowerCase() === name);
  if (!found) return res.status(404).json({ message: 'Stock item not found' });
  res.json(found);
});

// History for item
stockRouter.get('/history/:stockItemId', (req, res) => {
  const { stockItemId } = req.params;
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const txs = stockTransactions.filter(t => {
    if (t.stockItemId !== stockItemId) return false;
    if (startDate && t.transactionDate < startDate) return false;
    if (endDate && t.transactionDate > endDate) return false;
    return true;
  });

  const history = txs.map(t => ({
    date: t.transactionDate,
    stock: t.quantity,
    transaction: t,
  }));
  res.json(history);
});

// Transactions all
stockRouter.get('/transactions', (req, res) => {
  res.json(stockTransactions);
});

// Transactions by type
stockRouter.get('/transactions/type/:type', (req, res) => {
  res.json(stockTransactions.filter(t => t.transactionType === req.params.type));
});

// Transactions by date range
stockRouter.get('/transactions/range', (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  res.json(stockTransactions.filter(t => {
    if (startDate && t.transactionDate < startDate) return false;
    if (endDate && t.transactionDate > endDate) return false;
    return true;
  }));
});

// Transactions by item
stockRouter.get('/transactions/item/:stockItemId', (req, res) => {
  res.json(stockTransactions.filter(t => t.stockItemId === req.params.stockItemId));
});

// Transaction by ID
stockRouter.get('/transactions/:id', (req, res) => {
  const tx = stockTransactions.find(t => t.id === req.params.id);
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });
  res.json(tx);
});

// Create transaction
stockRouter.post('/transactions', (req, res) => {
  const data: StockTransaction = req.body;
  const newTx: StockTransaction = {
    ...data,
    id: data.id || uid('stx'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  stockTransactions.unshift(newTx);

  // Update item currentStock automatically
  const item = stockItems.find(i => i.id === data.stockItemId);
  if (item) {
    if (['PURCHASE', 'RETURN', 'ADJUSTMENT'].includes(data.transactionType)) {
      item.currentStock += Number(data.quantity);
    } else if (['USAGE', 'SALE', 'WASTE'].includes(data.transactionType)) {
      item.currentStock = Math.max(0, item.currentStock - Number(data.quantity));
    }
    item.updatedAt = new Date().toISOString();
  }

  res.status(201).json(newTx);
});

// Get all items
stockRouter.get('/items', (req, res) => {
  res.json(stockItems);
});

// Create item
stockRouter.post('/items', (req, res) => {
  const data: StockItem = req.body;
  const newItem: StockItem = {
    ...data,
    id: data.id || uid('stock'),
    status: data.status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  stockItems.unshift(newItem);
  res.status(201).json(newItem);
});

// Item by ID
stockRouter.get('/items/:id', (req, res) => {
  const item = stockItems.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Stock item not found' });
  res.json(item);
});

// Update item
stockRouter.put('/items/:id', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  stockItems[idx] = {
    ...stockItems[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };
  res.json(stockItems[idx]);
});

// Toggle status
stockRouter.patch('/items/:id/toggle', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  stockItems[idx].status = stockItems[idx].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  stockItems[idx].updatedAt = new Date().toISOString();
  res.json(stockItems[idx]);
});

// Update stock
stockRouter.patch('/items/:id/stock', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  const newStock = Number(req.query.newStock);
  stockItems[idx].currentStock = newStock;
  stockItems[idx].updatedAt = new Date().toISOString();
  res.json(stockItems[idx]);
});

// Add stock
stockRouter.patch('/items/:id/add', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  const quantity = Number(req.query.quantity) || 0;
  const reference = req.query.reference as string;
  const remarks = req.query.remarks as string;

  stockItems[idx].currentStock += quantity;
  stockItems[idx].updatedAt = new Date().toISOString();

  stockTransactions.unshift({
    id: uid('stx'),
    stockItemId: stockItems[idx].id!,
    transactionType: 'PURCHASE',
    quantity,
    unitPrice: stockItems[idx].unitPrice,
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: reference,
    remarks: remarks || 'Stock added',
    enteredByCandidateId: 'cand_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json(stockItems[idx]);
});

// Deduct stock
stockRouter.patch('/items/:id/deduct', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  const quantity = Number(req.query.quantity) || 0;
  const reference = req.query.reference as string;
  const remarks = req.query.remarks as string;

  stockItems[idx].currentStock = Math.max(0, stockItems[idx].currentStock - quantity);
  stockItems[idx].updatedAt = new Date().toISOString();

  stockTransactions.unshift({
    id: uid('stx'),
    stockItemId: stockItems[idx].id!,
    transactionType: 'USAGE',
    quantity,
    unitPrice: stockItems[idx].unitPrice,
    transactionDate: new Date().toISOString().split('T')[0],
    referenceNumber: reference,
    remarks: remarks || 'Stock deducted for kitchen consumption',
    enteredByCandidateId: 'cand_1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json(stockItems[idx]);
});

// Upload images mock
stockRouter.post('/items/:id/images', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  const mockUrl = 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400';
  stockItems[idx].images = stockItems[idx].images || [];
  stockItems[idx].images!.push(mockUrl);
  if (!stockItems[idx].primaryImage) stockItems[idx].primaryImage = mockUrl;
  res.json({ images: stockItems[idx].images });
});

// Set primary image
stockRouter.patch('/items/:id/primary-image', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  stockItems[idx].primaryImage = req.query.imageUrl as string;
  res.json(stockItems[idx]);
});

// Delete item
stockRouter.delete('/items/:id', (req, res) => {
  const idx = stockItems.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Stock item not found' });
  stockItems.splice(idx, 1);
  res.status(204).send();
});
