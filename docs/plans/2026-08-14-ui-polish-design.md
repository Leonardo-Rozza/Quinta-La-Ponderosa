# Pulido visual y navegación de la landing

Fecha: 2026-08-14  
Estado: aprobado  
Opción elegida: A — compacta, funcional y fiel al diseño previo

## Objetivo

Corregir seis problemas visibles de la landing sin cambiar el flujo de reservas ni la integración de pagos:

1. Reducir la altura del footer y hacer funcionales todos sus enlaces.
2. Simplificar el visor de galería y permitir cerrarlo al tocar fuera.
3. Eliminar el hueco de la grilla de servicios.
4. Mantener visible la cronología del hero junto a sus datos principales.
5. Alinear correctamente las secciones al navegar mediante enlaces internos.
6. Recuperar el botón circular verde de WhatsApp.

## Decisiones de diseño

### Footer compacto

- Eliminar el bloque promocional grande `footer__lead` porque repite llamadas a la acción ya presentes en hero y reservas.
- Mantener una grilla compacta con marca, redes, navegación y contacto.
- Conservar la franja inferior con copyright y enlaces legales.
- Usar anclas nativas para destinos de la misma página.
- Convertir la dirección en un enlace a Google Maps.
- Mantener objetivos táctiles de al menos 44 px y foco visible.

### Visor de galería

- Quitar el texto “También podés usar las flechas del teclado”.
- Mantener botones Anterior/Siguiente, flechas del teclado, Escape y botón X.
- Cerrar al pulsar realmente el backdrop, no al interactuar con el contenido.
- Exigir que el puntero principal empiece y termine fuera del rectángulo del diálogo para evitar cierres por arrastres accidentales.
- Enrutar todos los cierres por `dialog.close()` y restaurar el foco al thumbnail de origen mediante `onClose`.

### Servicios

- Mantener los dos servicios destacados en una primera fila de dos columnas.
- Mostrar los cuatro servicios regulares en una segunda fila completa de cuatro columnas en escritorio.
- Pasar a dos columnas en tablet y una columna en móvil.
- No agrandar WiFi ni crear una jerarquía visual artificial.

### Hero

- Agrupar los datos principales y `Dayline` dentro de un bloque `hero__meta` en el flujo normal.
- Usar dos columnas en escritorio: datos a la izquierda y cronología a la derecha.
- Apilar ambos bloques en móvil.
- Reducir los pisos rígidos de padding para pantallas panorámicas bajas.
- Mantener el componente compartido `Dayline` sin duplicarlo ni ocultarlo.

### Navegación por secciones

- Evitar la suma actual entre `scroll-padding-top` y `scroll-margin-top`.
- Ubicar cada ID navegable en el inicio visual del contenido, después del padding decorativo de la sección.
- Mantener un único offset global basado en la cabecera fija.
- Aplicar el mismo contrato en escritorio y móvil, incluidos los enlaces del footer.

### WhatsApp

- Recuperar el botón circular verde oficial (`#25d366`) con el glifo de WhatsApp.
- Mantener una aparición suave después del scroll y un pulso sutil.
- No recuperar el tooltip automático para evitar ruido y superposición sobre el footer.
- Conservar `target="_blank"`, `rel="noopener noreferrer"`, foco visible y exclusión del tab order mientras está oculto.
- Normalizar el teléfono a dígitos antes de construir cualquier URL `wa.me`.

## Componentes afectados

- `src/components/sections/Footer.tsx`
- `src/components/sections/Galeria.tsx`
- `src/components/sections/Hero.tsx`
- Componentes de las secciones enlazadas desde navegación y footer
- `src/components/layout/WhatsAppButton.tsx`
- `src/lib/utils.ts`
- `src/app/globals.css`

## Comportamiento responsivo

- Escritorio ancho: footer en tres columnas; hero meta en dos columnas; servicios `2 destacados + 4 regulares`.
- Tablet: footer y servicios en dos columnas donde el espacio lo permita; hero meta apilable antes de superponerse.
- Móvil: footer en una columna, servicios en una columna, cronología debajo de los datos y WhatsApp como círculo de 52–56 px respetando el safe area.
- Pantallas panorámicas bajas: la cronología permanece junto a los datos principales y no al final absoluto del hero.

## Accesibilidad e interacción

- Conservar foco visible, áreas táctiles y orden DOM coherente con el orden visual.
- El visor mantiene foco inicial en Cerrar y lo devuelve al elemento que lo abrió.
- Un click dentro del visor no lo cierra; X, Escape y backdrop sí.
- Los enlaces internos actualizan el hash y muestran el encabezado de la sección sin quedar oculto ni generar un vacío grande.
- `prefers-reduced-motion` desactiva pulso y transiciones prolongadas mediante la regla global existente.

## Validación

- Revisar escritorio en 1440×900 y una vista panorámica baja.
- Revisar tablet en 768×1024.
- Revisar móvil en 390×844 y 360×640.
- Probar todos los enlaces del footer, incluido Maps, teléfono, email, redes y legales.
- Probar visor por X, Escape, backdrop, navegación, flechas y restauración de foco.
- Confirmar ausencia de overflow horizontal y errores de consola.
- Ejecutar ESLint, TypeScript, Vitest, `git diff --check` y build de producción con webpack.

## Fuera de alcance

- No se modifica el formulario de reservas, Supabase ni Mercado Pago.
- No se agregan dependencias de UI.
- No se cambia el contenido fotográfico ni la identidad tipográfica.
