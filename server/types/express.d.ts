import '@clerk/express';
// Minimal AuthObject shape for type augmentation
interface AuthObject { userId?: string }
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthObject & { userId?: string };
  }
}
