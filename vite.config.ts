import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sound library root directories (absolute paths)
const SOUND_ROOTS = [
  path.resolve(__dirname, 'sound libraries'),
  path.resolve(__dirname, 'Deterministic Engine Soundbank'),
];

// Middleware to serve audio files from external directories
function soundLibraryMiddleware() {
  return {
    name: 'sound-library-middleware',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // Only handle requests to /sounds/ paths
        if (!req.url?.startsWith('/sounds/')) {
          return next();
        }

        // Decode the URL and extract the relative path
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const relativePath = urlPath.replace(/^\/sounds\//, '');

        // If it's the index.json, serve from public/sounds/
        if (relativePath === 'index.json') {
          return next();
        }

        // Try to find the file in each sound root
        for (const root of SOUND_ROOTS) {
          const rootBasename = path.basename(root);

          // Try 1: join root directly with relativePath
          // (works when relativePath is already relative to root)
          let filePath = path.join(root, relativePath);
          let resolved = path.resolve(filePath);

          // Try 2: if relativePath starts with root's basename, strip it
          // (handles case where relativePath includes the root dir name)
          if (!resolved.startsWith(root) || !(fs.existsSync(filePath) && fs.statSync(filePath).isFile())) {
            const stripped = relativePath.replace(new RegExp(`^${escapeRegex(rootBasename)}/`), '');
            const altPath = path.join(root, stripped);
            const altResolved = path.resolve(altPath);
            if (altResolved.startsWith(root) && fs.existsSync(altPath) && fs.statSync(altPath).isFile()) {
              filePath = altPath;
              resolved = altResolved;
            }
          }

          if (resolved.startsWith(root) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            // Set appropriate content type
            const ext = path.extname(filePath).toLowerCase();
            const contentTypes: Record<string, string> = {
              '.wav': 'audio/wav',
              '.mp3': 'audio/mpeg',
              '.ogg': 'audio/ogg',
              '.flac': 'audio/flac',
              '.aif': 'audio/aiff',
              '.aiff': 'audio/aiff',
            };
            
            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Stream the file
            const stream = fs.createReadStream(filePath);
            stream.pipe(res);
            return;
          }
        }

        // Escape special regex characters in a string
        function escapeRegex(s: string) {
          return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // File not found
        res.statusCode = 404;
        res.end('Sound file not found');
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isDev = mode === 'development';
  const isAIStudio = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss(), soundLibraryMiddleware()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      hmr: !isAIStudio,
    },
    build: {
      sourcemap: isDev,
      minify: !isDev,
      outDir: 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            tone: ['tone'],
          },
        },
      },
    },
    optimizeDeps: {
      include: ['tone', 'react', 'react-dom'],
    },
  };
});