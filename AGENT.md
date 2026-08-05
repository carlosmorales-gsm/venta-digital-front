# AGENT.md — Venta Digital (Frontend)

Reglas obligatorias para cualquier IA o desarrollador que trabaje este repositorio.

## Contexto del producto

- App Vue 3 + Vite + TypeScript + Pinia + Vue Router.
- Backend hermano: `C:\desarrollo\sanmartin\proyectos comercial\venta-digital-backend` (puerto **3022**, prefijo `/api`).
- Marca visual: Grupo San Martín (colores y logos tomados de `gsm-website`).
- Idioma UI y mensajes: español.

## Roles y sesión

| Rol | Login | Token | Pantalla post-login |
|-----|-------|-------|---------------------|
| VENDEDOR | Celular + PIN WhatsApp | Access hasta **fin del día** (sin refresh) | `/vendedor/ventas` |
| MONITOR | Usuario + contraseña | Access + **refresh** | `/monitor` (menú por permisos) + `/monitor/ventas` si tiene `ventas.ver` |
| ADMIN | Usuario + contraseña | Access + refresh | `/monitor` + `/monitor/ventas` + `/admin/usuarios` |

- No inventar flujos de auth distintos a los anteriores.
- Fechas del API llegan en UTC; mostrar siempre con `formatUtcToLocal` / zona del navegador (`shared/utils/datetime.ts`).

## Diseño (identidad propia)

Comparte marca GSM (colores, logos, Roboto/Recline), pero **no copia layouts de NetPay**.

- Tokens propios en `src/styles/main.css` (`--vd-*` + `--gsm-*`)
- Login: composición centrada (hero + panel), orientada a uso en campo/móvil
- App autenticada: header superior + nav horizontal (drawer en móvil), sin sidebar NetPay
- Clases propias: `.panel`, `.page-head`, `.btn-accent`, `.access`
- Responsive obligatorio: móvil, tablet y desktop

## Estructura legible

```
src/
  modules/     # por dominio (auth, sales, monitor, admin)
  shared/      # api, utils, types
  layouts/     # shells reutilizables
  styles/      # tokens, fonts, base
  router/
```

- Código claro y comentado solo donde aporte contexto de negocio.
- Preferir nombres en español para UI; inglés técnico en código (`auth.store`, `http`, etc.) de forma consistente.
- SOLID: un store/servicio con una responsabilidad; vistas delgadas.

## Historial ANA

- Cada día de trabajo se documenta en `historial-ana/YYYY-MM-DD.md`.
- Antes de cambiar algo importante, lee el ANA más reciente.
- Al terminar un bloque de trabajo, actualiza o crea el ANA del día.

## Prácticas

1. No commitear `.env` con secretos.
2. No romper guards de router (`roles` / `permissions`).
3. No agregar UI de ventas reales hasta que el backend lo exponga (hoy el listado es placeholder).
4. Mantener botones y campos táctiles (min ~44px) en móvil.
5. Si tocas auth, verificar los 3 roles.

## Arranque

```bash
npm install
npm run dev
```

API esperada: `VITE_API_URL=http://localhost:3022/api`
