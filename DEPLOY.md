# Publicar BRUMA 0.7 en Cloudflare Pages

Este repositorio contiene el juego web estático listo para desplegarse sin Higgsfield ni un proceso de compilación.

## Cloudflare Pages

1. En [Cloudflare Dashboard](https://dash.cloudflare.com/) abrí **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Autorizá GitHub y elegí el repositorio `ezeedev/BRUMA` y la rama `main`.
3. Configurá **Framework preset: None**, **Build command: (vacío)** y **Build output directory: .** (la raíz del repositorio).
4. Elegí un nombre disponible para el proyecto y presioná **Save and Deploy**.
5. Cloudflare mostrará la dirección pública `https://<nombre>.pages.dev` al finalizar el despliegue.

El juego utiliza `index.html`, `style.css` y módulos JavaScript nativos de `js/`, sin dependencias de npm.

## Guardado de mundos

Las partidas se almacenan en `localStorage` del navegador. Al cambiar de `higgsfield.app` a `pages.dev`, las partidas existentes **no se transfieren automáticamente** por las restricciones de origen del navegador. No borres el sitio viejo ni su almacenamiento hasta disponer de una herramienta de exportación/importación.

## Desarrollo

Para probar localmente, serví la carpeta con un servidor HTTP, por ejemplo `python -m http.server 8000`, y abrí `http://localhost:8000`. Evitá abrir `index.html` como archivo local porque utiliza módulos JavaScript.
