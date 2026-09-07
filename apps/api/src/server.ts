import 'dotenv/config';
import { appConfig } from '@ciesa/config';

import app from './app.js';

app.listen(appConfig.apiPort, () => {
  console.log(`API listening on http://localhost:${appConfig.apiPort}`);
});