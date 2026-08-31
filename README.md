# Venta Digital — Frontend

Aplicación Vue 3, TypeScript y Vite.

## Desarrollo

```bash
npm ci
npm run dev
```

## Despliegue en Coolify

1. Crear el recurso desde este repositorio y seleccionar **Dockerfile** como tipo de build.
2. Usar el puerto **80**.
3. Configurar `VITE_API_URL` como variable de build con la URL pública del API, incluyendo `/api` (por ejemplo, `https://api.example.com/api`).
4. Desplegar el recurso.

`VITE_API_URL` se integra en los archivos estáticos durante el build de Vite. Cambiarla requiere volver a construir y desplegar la imagen.

Para construir localmente:

```bash
docker build \
  --build-arg VITE_API_URL=https://api.example.com/api \
  -t venta-digital-front .
docker run --rm -p 8080:80 venta-digital-front
```
