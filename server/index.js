import { createApp } from './app.js';
import { migrate } from './db.js';

const PORT = process.env.PORT || 3000;

await migrate();
createApp().listen(PORT, () => {
  console.log(`Cashalot server listening on port ${PORT}`);
});
