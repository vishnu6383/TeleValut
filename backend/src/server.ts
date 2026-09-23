import { app } from './app';
import { config } from './config';
import { closeDatabase, initializeDatabase } from './config/database';

initializeDatabase().then(() => {
	const server = app.listen(config.port, () => console.log(`TeleVault API listening on http://localhost:${config.port}`));
	const shutdown = async () => { server.close(); await closeDatabase(); process.exit(0); };
	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);
}).catch((error) => { console.error('MongoDB Atlas connection failed:', error instanceof Error ? error.message : 'unknown error'); process.exit(1); });
