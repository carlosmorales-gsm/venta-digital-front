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
| ADMIN | Usuario + contraseña | Access + refresh | `/monitor` + `/monitor/ventas` + `/admin/usuarios` + `/admin/bitacora` |

- No inventar flujos de auth distintos a los anteriores.
- Fechas del API llegan en UTC; mostrar con `formatUtcToLocal` (`shared/utils/datetime.ts`).
- **No mostrar** al usuario final nombres de zona horaria, “UTC”, ni textos técnicos de horario; solo fechas/horas legibles.

## Diseño (identidad propia)

Comparte marca GSM (colores, logos, Roboto/Recline), pero **no copia layouts de NetPay**.

- Tokens propios en `src/styles/main.css` (`--vd-*` + `--gsm-*`)
- Login: composición centrada (hero + panel), orientada a uso en campo/móvil
- App autenticada MONITOR/ADMIN: menú lateral (inspirado en NetPay) + topbar, paleta GSM 2025 e iconos propios
- VENDEDOR: solo barra superior (sin menú lateral)
- Clases propias: `.panel`, `.page-head`, `.btn-accent`, `.access`
- Responsive obligatorio: móvil, tablet y desktop

## Estructura legible

```
src/
  modules/     # por dominio (auth, sales, monitor, admin)
  shared/      # api, utils, types, ui global
    ui/dialog/ # alert / confirm globales
    ui/modal/  # VdModal reutilizable (formularios, etc.)
  layouts/     # shells reutilizables
  styles/      # tokens, fonts, base
  router/
```

- Código claro y comentado solo donde aporte contexto de negocio.
- Preferir nombres en español para UI; inglés técnico en código (`auth.store`, `http`, etc.) de forma consistente.
- SOLID: un store/servicio con una responsabilidad; vistas delgadas.

## Diálogos (obligatorio)

**Prohibido** usar `alert()`, `confirm()` o `prompt()` nativos de JavaScript / `window`.

Usar el sistema global:

```ts
import { useDialog } from '../shared/ui/dialog'

const { alert, confirm } = useDialog()

await alert({ title: 'Listo', message: 'Usuario creado', variant: 'success' })

const ok = await confirm({
  title: 'Eliminar',
  message: '¿Seguro que deseas continuar?',
  variant: 'danger',
  confirmText: 'Eliminar',
  cancelText: 'Cancelar',
})
```

- Host montado en `App.vue` (`VdDialogHost`).
- Variantes: `info` | `success` | `warning` | `danger`.

## Historial ANA

- Cada día de trabajo se documenta en `historial-ana/YYYY-MM-DD.md`.
- Antes de cambiar algo importante, lee el ANA más reciente.
- Al terminar un bloque de trabajo, actualiza o crea el ANA del día.

## Prácticas

1. No commitear `.env` con secretos.
2. No romper guards de router (`roles` / `permissions`).
3. Ventas vendedor: wizard por secciones (`/vendedor/ventas/nueva`), borradores (máx. 3, 24 h), reutilizar cotización, vista previa PDF en modal, INE + comprobante al enviar.
4. Mantener botones y campos táctiles (min ~44px) en móvil.
5. Si tocas auth, verificar los 3 roles.
6. Usuarios admin: crear, editar y habilitar/deshabilitar (sin `alert`/`confirm` nativos).
7. Bitácora (`/admin/bitacora`): solo ADMIN; filtros por fechas/palabra/usuario/acción; PDF con `jspdf` en el front.

## Arranque

```bash
npm install
npm run dev
```

API esperada: `VITE_API_URL=http://localhost:3022/api`
