import express from 'express';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createIdentityContext } from './contexts/identity/index.js';
import { createSchedulesContext } from './contexts/schedules/index.js';
import { createHistoryContext } from './contexts/history/index.js';
import { createDepartureContext } from './contexts/departure/index.js';
import { externalAdapters } from './contexts/external-data/index.js';
import { HttpError, now } from './shared.js';

export function createApp({ db, cfg, fetchImpl = fetch }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const identity = createIdentityContext(db, cfg);
  const schedules = createSchedulesContext(db, identity.requireUser);
  const external = externalAdapters(db, cfg, fetchImpl);
  let departure;
  const history = createHistoryContext(db, cfg, identity.requireUser, {
    getForUser: (...args) => departure.getForUser(...args),
    listForUser: (...args) => departure.listForUser(...args)
  });
  departure = createDepartureContext(db, cfg, {
    schedules, history, external, requireUser: identity.requireUser, requirePartner: identity.requirePartner
  });

  const specPath = fileURLToPath(new URL('../openapi.yaml', import.meta.url));
  const spec = YAML.parse(readFileSync(specPath, 'utf8'));
  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', service: 'berangkatpas', time: now() });
  });
  app.get('/api/openapi.yaml', (_req, res) => res.sendFile(specPath));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: false } }));
  app.use('/api/v1/auth', identity.router);
  app.use('/api/v1/places', identity.requireUser, external.placesRouter);
  app.use('/api/v1/schedules', departure.scheduleRouter);
  app.use('/api/v1/schedules', schedules.router);
  app.use('/api/v1/reminders', departure.manifestRouter);
  app.use('/api/v1/recommendations', departure.previewRouter);
  app.use('/api/v1/recommendations', history.feedbackRouter);
  app.use('/api/v1/history', history.historyRouter);

  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    if (error?.code?.startsWith?.('SQLITE_CONSTRAINT')) return res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource conflicts with existing data' } });
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: { code: status === 500 ? 'INTERNAL_ERROR' : error.code, message: status === 500 ? 'Internal server error' : error.message } });
  });
  return app;
}
