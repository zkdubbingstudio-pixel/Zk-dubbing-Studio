import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const targetSupabaseUrl = 
    process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.includes('fmxtiykddxwzewzckihv')
      ? process.env.VITE_SUPABASE_URL
      : 'https://rwioavitlgzyrbgivwzi.supabase.co';

  const targetAnonKey = 
    process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kecwr9BW3V2UnM4TpruFfQ_S6C7Qsys';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(targetSupabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(targetAnonKey),
    },
    esbuild: {
      // Disable debug logs and debugger statements in production build (Requirement 6)
      drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
      pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('@aws-sdk')) return 'vendor-aws';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1200,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api/supabase-proxy': {
          target: targetSupabaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/supabase-proxy/, ''),
          headers: {
            apikey: targetAnonKey,
          },
        },
        '/rest/v1': {
          target: targetSupabaseUrl,
          changeOrigin: true,
          secure: true,
          headers: {
            apikey: targetAnonKey,
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
