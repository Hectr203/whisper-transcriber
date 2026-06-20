# Guia Maestra del Sistema de Diseno SMT para Vue

## Objetivo

Este documento adapta la guia visual existente a la arquitectura real de este proyecto:

- Vue 3
- Vite
- Vuetify 4
- Vue Router
- Tailwind CSS

La meta es usar la misma intencion visual del documento original, pero aterrizada a componentes, estilos y decisiones que si existen en `talleres-frontend`.

---

## Estado real del proyecto

Hoy el frontend ya trabaja con esta base:

- Shell principal en `src/App.vue`
- Estilos globales en `src/style.css`
- Tema de Vuetify en `src/plugins/vuetify.js`
- Vistas modulares en `src/views/*.vue`
- Componentes compartidos en `src/components/*.vue`

## Diferencia contra la guia original

La guia original fue escrita para:

- React
- TypeScript
- componentes tipo `tsx`
- Framer Motion
- Headless UI
- Zustand
- Lucide React

Eso no se debe copiar tal cual aqui.

En este proyecto la traduccion correcta es:

- `tsx` -> componentes `.vue`
- estado local y composables -> `ref`, `reactive`, `computed`
- shell visual -> `v-app`, `v-navigation-drawer`, `v-app-bar`, `v-main`
- overlays y dialogs -> componentes de Vuetify
- iconos -> `@mdi/font`
- tablas, chips, botones y formularios -> Vuetify con ajuste visual via clases Tailwind

---

## Direccion visual que si debemos conservar

La intencion visual del sistema original sigue siendo valida:

- interfaz administrativa premium
- fondo claro con profundidad suave
- tarjetas blancas con borde tenue
- radios grandes
- contraste entre neutros oscuros y acento calido
- densidad media
- aspecto actual, limpio y estable

La UI no debe verse:

- rigida
- cuadrada
- recargada
- con controles enormes
- ni como mezcla de estilos sin sistema

---

## Stack visual recomendado para este proyecto

## Base obligatoria

- Vue 3
- Vuetify 4
- Tailwind CSS
- `@mdi/font`

## Opcional si queremos acercarnos mas a la guia original

- `@fontsource/plus-jakarta-sans`

No se requiere instalar librerias de React para aplicar este sistema en Vue.

---

## Fuente del sistema

## Recomendacion

Para replicar la personalidad visual del documento original, la fuente principal deberia migrar a:

- `Plus Jakarta Sans`

## Situacion actual

Hoy el proyecto usa:

- `Manrope` como sans principal
- `Sora` para el titulo de marca

Eso vive en `src/style.css`.

## Decision recomendada

Hay dos caminos validos:

1. Mantener `Manrope + Sora` y solo portar color, radios, sombras y layout.
2. Migrar a `Plus Jakarta Sans` y acercarnos mas al sistema original completo.

## Recomendacion practica

Si vamos a redisenar varias pantallas, conviene migrar desde ahora a `Plus Jakarta Sans` para evitar inconsistencia futura.

---

## Color del sistema para Vue

## Estado actual

El tema de Vuetify hoy usa:

- `primary: #0e7490`
- `secondary: #f97316`
- `background: #f0f9ff`

## Direccion sugerida

Para alinearnos mejor con la guia original, el sistema deberia pivotar a esta base:

- fondo general: `#f8fafc`
- texto principal: `#0f172a`
- acento principal: gradiente naranja entre `#fb923c` y `#ea580c`
- neutro estructural: `slate`

## Regla

Vuetify debe aportar estructura y accesibilidad, pero el look final debe definirse con tokens consistentes, no solo con colores por defecto del framework.

---

## Equivalencias de componentes

## Shell

Mapeo real para este proyecto:

- `AppLayout.tsx` -> `src/App.vue`
- `AppSidebar.tsx` -> bloque `v-navigation-drawer` dentro de `src/App.vue`
- `AppNavbar.tsx` -> bloque `v-app-bar` dentro de `src/App.vue`

## Controles

En vez de componentes React separados, en Vue conviene crear wrappers visuales:

- `BasePrimaryButton.vue`
- `BaseSecondaryButton.vue`
- `BasePageCard.vue`
- `BaseSectionHeader.vue`
- `BaseDataToolbar.vue`

## Formularios

Los inputs deben usar componentes de Vuetify, pero con apariencia estandarizada:

- `v-text-field`
- `v-select`
- `v-textarea`
- `v-autocomplete`
- `v-dialog`
- `v-date-input` o wrappers propios si se busca una replica mas fina

## Tablas y listados

Se debe unificar el look de:

- encabezados
- filtros
- paginacion
- estados vacios
- acciones por fila

Esto aplica directo a vistas como:

- `src/views/PreventiveView.vue`
- `src/views/ServicesView.vue`
- `src/views/UnitsView.vue`
- `src/views/ReportsView.vue`

---

## Reglas visuales para Vue + Vuetify

## Layout

- fondo general suave con profundidad ligera
- tarjetas principales con `border`, `shadow` tenue y radios amplios
- contenedores con `max-width` consistente
- separacion clara entre shell y contenido

## Sidebar

- debe sentirse estructural, no como drawer generico
- estados activos mas notorios
- badges y acciones con mejor jerarquia
- version rail bien cuidada en desktop

## Navbar

- cabecera mas alta y mas refinada que la actual
- titulo de modulo con mejor jerarquia
- CTA global ubicado arriba si el flujo lo necesita
- notificaciones con mejor tratamiento visual

## Tarjetas

- radios grandes
- sombra larga y suave
- acento de color controlado
- densidad media

## Botones

- primario: compacto, claro, con fuerza visual
- secundario: neutro, limpio, sin competir con el CTA
- evitar botones demasiado altos o pesados

## Tipografia

- titulos con mucho peso visual
- labels y metadatos compactos
- uppercase solo donde agrega jerarquia real
- no abusar de tracking amplio

---

## Que requiere este sistema para poder usarse de verdad

## Requerido para una adopcion minima

- definir si mantenemos `Manrope/Sora` o migramos a `Plus Jakarta Sans`
- normalizar tokens visuales en `src/style.css`
- ajustar paleta en `src/plugins/vuetify.js`
- extraer componentes base reutilizables para botones, tarjetas y cabeceras
- aplicar el sistema primero al shell en `src/App.vue`

## Requerido para una adopcion completa

- crear wrappers base de UI en `src/components`
- rehacer patrones repetidos en vistas clave
- homologar espaciados, radios y sombras
- revisar tablas, dialogs, filtros y formularios
- definir estados consistentes para carga, vacio y error

## Requerido si quieres copiar casi exacto el sistema original

- instalar `@fontsource/plus-jakarta-sans`
- reemplazar la mezcla `Manrope/Sora`
- crear una capa de componentes visuales propios sobre Vuetify
- retocar sidebar, navbar, cards y toolbar para que Vuetify no imponga su look por defecto

---

## Archivos que debemos tocar primero

Orden recomendado de trabajo:

1. `src/style.css`
2. `src/plugins/vuetify.js`
3. `src/App.vue`
4. `src/components/ConfirmDialog.vue`
5. `src/components/PaginationControls.vue`
6. `src/components/DataState.vue`
7. vistas prioritarias como `src/views/PreventiveView.vue` y `src/views/DashboardView.vue`

---

## Estrategia recomendada de implementacion

## Fase 1

Crear el sistema base:

- tipografia
- colores
- radios
- sombras
- shell

## Fase 2

Crear componentes base reutilizables:

- botones
- tarjetas
- toolbar de filtros
- encabezados de pagina

## Fase 3

Aplicar el sistema a las vistas con mas impacto:

- dashboard
- preventivo
- servicios
- unidades

## Fase 4

Pulir formularios, dialogs, tablas y estados vacios.

---

## Recomendacion de uso

Usa este documento como guia maestra para el frontend actual.

Usa `docs/diseño.md` solo como referencia visual de origen.

La fuente de verdad para este proyecto Vue debe ser este archivo, porque ya habla el idioma real del stack.
