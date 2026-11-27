import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  generateShopInsights,
  interpretVoiceCommand,
  synthesizeShopkeeperSpeech,
  transcribeShopkeeperAudio,
} from './src/server/gemini.ts';
import { shopStore } from './src/server/store.ts';
import type { Language, SyncOperation } from './src/types.ts';

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'DukaanSaathi', timestamp: new Date().toISOString() });
  });

  // Middleware for shop access & data isolation
  function requireShopAccess(req: Request, res: Response, next: NextFunction) {
    const shopId = String(req.params.shopId || req.body?.shopId || 'demo-kirana');
    const record = shopStore.getShopRecord(shopId);
    if (!record) {
      res.status(404).json({ error: 'Shop not found' });
      return;
    }

    if (record.profile.isPublic && !record.profile.hasPin) {
      next();
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token || !shopStore.verifyShopToken(token, shopId)) {
      res.status(401).json({ error: 'PIN verification required for this shop.' });
      return;
    }

    next();
  }

  // Create a new isolated shop (optional PIN)
  app.post('/api/shops/create', async (req, res) => {
    try {
      const { name, ownerName, phone, city, shopType, pin, isPublic } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({ error: 'Please enter a valid shop name.' });
        return;
      }
      if (pin && (typeof pin !== 'string' || pin.trim().length < 4)) {
        res.status(400).json({ error: 'Shop PIN must be at least 4 characters.' });
        return;
      }
      const result = await shopStore.createShop({
        name,
        ownerName: typeof ownerName === 'string' ? ownerName : 'Shopkeeper',
        phone: typeof phone === 'string' ? phone : '',
        city: typeof city === 'string' ? city : 'India',
        shopType: typeof shopType === 'string' ? shopType : 'Kirana & General Store',
        pin: typeof pin === 'string' ? pin : undefined,
        isPublic: Boolean(isPublic),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create shop' });
    }
  });

  // Join existing shop by code (+ PIN if protected)
  app.post('/api/shops/join', (req, res) => {
    const { code, pin } = req.body || {};
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Shop code is required.' });
      return;
    }
    const record = shopStore.findShopByCode(code);
    if (!record) {
      res.status(404).json({ error: 'No shop found with that code.' });
      return;
    }
    if (record.profile.hasPin && record.pinHash) {
      if (!pin || typeof pin !== 'string' || !shopStore.verifyPin(pin.trim(), record.pinHash)) {
        res.status(401).json({ error: 'Invalid shop PIN. Please check and try again.' });
        return;
      }
      const token = shopStore.signShopToken(record.profile.id);
      res.json({ snapshot: shopStore.getSnapshot(record.profile.id), token });
      return;
    }
    res.json({ snapshot: shopStore.getSnapshot(record.profile.id) });
  });

  // Get full shop snapshot
  app.get('/api/shops/:shopId/snapshot', requireShopAccess, (req, res) => {
    const snapshot = shopStore.getSnapshot(String(req.params.shopId));
    if (!snapshot) {
      res.status(404).json({ error: 'Shop not found' });
      return;
    }
    res.json(snapshot);
  });

  // Offline outbox sync endpoint
  app.post('/api/shops/:shopId/sync', requireShopAccess, async (req, res) => {
    try {
      const shopId = String(req.params.shopId);
      const operations = Array.isArray(req.body?.operations)
        ? (req.body.operations as SyncOperation[])
        : [];
      const result = await shopStore.applySyncOperations(shopId, operations);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Sync failed' });
    }
  });

  // Reset Public Demo Shop data
  app.post('/api/shops/demo-kirana/reset-demo', async (_req, res) => {
    try {
      const snapshot = await shopStore.resetDemoShop();
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Reset failed' });
    }
  });

  // Gemini NLU: interpret multilingual voice/text command
  app.post('/api/ai/interpret', requireShopAccess, async (req, res) => {
    try {
      const { shopId, transcript, language, pendingConfirmation } = req.body || {};
      if (!transcript || typeof transcript !== 'string') {
        res.status(400).json({ error: 'Transcript is required.' });
        return;
      }
      const snapshot = shopStore.getSnapshot(String(shopId || 'demo-kirana'));
      if (!snapshot) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }
      const lang: Language = ['en', 'hi', 'te'].includes(language) ? language : 'en';
      const result = await interpretVoiceCommand({
        transcript: transcript.trim().slice(0, 500),
        language: lang,
        pendingConfirmation: Boolean(pendingConfirmation),
        shop: snapshot.shop,
        products: snapshot.products,
        customers: snapshot.customers,
        sales: snapshot.sales,
        expenses: snapshot.expenses,
      });
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  // Gemini Speech-to-Text fallback for recorded audio clips
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType, language } = req.body || {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'Audio data is required.' });
        return;
      }
      const lang: Language = ['en', 'hi', 'te'].includes(language) ? language : 'en';
      const transcript = await transcribeShopkeeperAudio({
        audioBase64,
        mimeType: typeof mimeType === 'string' ? mimeType : 'audio/webm',
        language: lang,
      });
      res.json({ transcript });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Transcription failed' });
    }
  });

  // Gemini Text-to-Speech
  app.post('/api/ai/tts', async (req, res) => {
    try {
      const { text, language } = req.body || {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Text is required.' });
        return;
      }
      const lang: Language = ['en', 'hi', 'te'].includes(language) ? language : 'en';
      const audioBase64 = await synthesizeShopkeeperSpeech({
        text: text.slice(0, 600),
        language: lang,
      });
      res.json({ audioBase64, mimeType: 'audio/wav' });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'TTS failed' });
    }
  });

  // Gemini Business Insights
  app.post('/api/ai/insights', requireShopAccess, async (req, res) => {
    try {
      const { shopId, language } = req.body || {};
      const snapshot = shopStore.getSnapshot(String(shopId || 'demo-kirana'));
      if (!snapshot) {
        res.status(404).json({ error: 'Shop not found' });
        return;
      }
      const lang: Language = ['en', 'hi', 'te'].includes(language) ? language : 'en';
      const insights = await generateShopInsights({
        language: lang,
        shop: snapshot.shop,
        products: snapshot.products,
        customers: snapshot.customers,
        sales: snapshot.sales,
        expenses: snapshot.expenses,
      });
      res.json(insights);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to generate insights' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DukaanSaathi server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
