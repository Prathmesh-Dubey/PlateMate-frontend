// server.ts - Main Express Server for Mess Management System
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { candidatesRouter } from './server/routes/candidates';
import { attendanceRouter } from './server/routes/attendance';
import { mealsRouter } from './server/routes/meals';
import { expensesRouter } from './server/routes/expenses';
import { stockRouter } from './server/routes/stock';
import { staffRouter } from './server/routes/staff';
import { billingRouter } from './server/routes/billing';
import { partiesRouter } from './server/routes/parties';
import { menusRouter } from './server/routes/menus';
import { reportsRouter } from './server/routes/reports';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser
  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'MessFlow API', timestamp: new Date().toISOString() });
  });

  app.use('/api/candidates', candidatesRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/meals', mealsRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/stock', stockRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/parties', partiesRouter);
  app.use('/api/menus', menusRouter);
  app.use('/api/reports', reportsRouter);

  // Vite middleware for development vs Static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
