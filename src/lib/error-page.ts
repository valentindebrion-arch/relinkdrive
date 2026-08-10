export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Relink — page indisponible</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex" />
    <meta name="theme-color" content="#00b050" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 1.5rem;
        display: grid;
        place-items: center;
        background: #f6f8f6;
        color: #0f1a12;
        font: 15px/1.6 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .card {
        width: 100%;
        max-width: 26rem;
        text-align: center;
        background: #fff;
        border: 1px solid #e3e9e4;
        border-radius: 1.25rem;
        padding: 2rem 1.5rem;
        box-shadow: 0 12px 32px rgba(0, 176, 80, 0.08);
      }
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: 1rem;
        background: #00b050;
        color: #fff;
        font-weight: 800;
        font-size: 1.35rem;
        margin-bottom: 1rem;
      }
      h1 { font-size: 1.15rem; margin: 0 0 0.5rem; font-weight: 700; }
      p { color: #566159; margin: 0 0 1.5rem; font-size: 0.9rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button {
        padding: 0.65rem 1.1rem;
        border-radius: 0.75rem;
        font: inherit;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
      }
      .primary { background: #00b050; color: #fff; }
      .secondary { background: #fff; color: #0f1a12; border-color: #d8e0d9; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">R</div>
      <h1>Cette page n'a pas pu être chargée</h1>
      <p>Une erreur est survenue de notre côté. Réessayez dans un instant ou revenez à l'accueil.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Retour à l'accueil</a>
      </div>
    </div>
  </body>
</html>`;
}
