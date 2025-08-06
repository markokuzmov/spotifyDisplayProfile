import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl(),
    {
      name: 'log-connections',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          console.log(
            `[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} from ${req.socket.remoteAddress.slice(7)}`
          );
          next();
        });
      }
    }
  ],
  server: {
    https: true,
    host: true,  // allow LAN connections
    port: 3000
  }
});