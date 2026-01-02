import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { execSync } from 'child_process';
import pkg from './package.json';

// Get git info for versioning
const getGitInfo = () => {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%cd --date=short').toString().trim();
    return { commitHash, commitDate };
  } catch {
    return { commitHash: 'unknown', commitDate: 'unknown' };
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const gitInfo = getGitInfo();

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true,
    },
    plugins: [vue()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      '__APP_VERSION__': JSON.stringify(pkg.version),
      '__GIT_COMMIT__': JSON.stringify(gitInfo.commitHash),
      '__BUILD_DATE__': JSON.stringify(gitInfo.commitDate),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    }
  };
});
