import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(currentDir, '..');

dotenv.config({ path: path.join(backendRoot, '.env.local') });
dotenv.config({ path: path.join(backendRoot, '.env') });
