import type { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Serves a minimal widget HTML that loads a light-weight client.
export function registerEmbedWidget(app: Express) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  app.get('/embed/widget', (req, res) => {
    const __public = path.join(__dirname, '..', 'client', 'public', 'embed-widget.html');
    res.sendFile(__public);
  });
}
