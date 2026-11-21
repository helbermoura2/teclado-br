import { createApp } from './app.mjs';
const server = await createApp();
const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`CENA: http://localhost:${port}`);
  console.log(process.env.TMDB_READ_TOKEN ? 'Busca TMDB configurada.' : 'Modo de amostra: 6 títulos. Configure TMDB_READ_TOKEN para busca completa.');
  if (!process.env.PUBLIC_BASE_URL) console.log('Catálogo local. Defina PUBLIC_BASE_URL para acessar a lista de outro aparelho.');
});
