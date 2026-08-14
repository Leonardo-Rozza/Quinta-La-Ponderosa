import { LegalLayout } from '@/components/sections/legal/LegalLayout';
import { CONFIG } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacidad | La Ponderosa',
  description: 'Cómo se usan y protegen los datos enviados al reservar Quinta La Ponderosa.',
};

export default function PrivacidadPage() {
  return (
    <LegalLayout
      eyebrow="Privacidad"
      title="Tus datos se usan para organizar tu jornada."
      summary="Explicamos qué pedimos, para qué lo usamos y con quién se comparte durante la reserva."
    >
      <section>
        <h2>1. Datos que recibimos</h2>
        <p>
          Al completar una reserva recibimos nombre y apellido, email, teléfono, cantidad de personas, fecha elegida
          y los comentarios que decidas agregar. También registramos referencias técnicas del pedido y el estado del
          pago para evitar duplicados y asociar la acreditación con la fecha correcta.
        </p>
      </section>

      <section>
        <h2>2. Para qué los usamos</h2>
        <ul>
          <li>Comprobar disponibilidad y gestionar la reserva.</li>
          <li>Enviar confirmaciones y coordinar ingreso, saldo y detalles de la jornada.</li>
          <li>Prevenir abuso, pagos duplicados y conflictos de fechas.</li>
          <li>Responder consultas y cumplir obligaciones contables o legales aplicables.</li>
        </ul>
      </section>

      <section>
        <h2>3. Servicios que intervienen</h2>
        <p>
          Usamos proveedores de alojamiento, base de datos y correo para operar el sitio. Mercado Pago procesa la
          seña bajo sus propias condiciones de privacidad. No vendemos tus datos ni los cedemos para publicidad.
        </p>
        <p>
          La sección de ubicación incorpora un mapa de Google. Ese contenido puede recibir datos técnicos, como la
          dirección IP, al cargarse cerca de tu pantalla. Podés usar el resto del sitio sin interactuar con el mapa.
        </p>
      </section>

      <section>
        <h2>4. Conservación y seguridad</h2>
        <p>
          Conservamos la información durante el tiempo necesario para administrar la reserva, atender reclamos y
          cumplir obligaciones aplicables. Limitamos el acceso operativo y usamos conexiones cifradas en tránsito.
          Ningún sistema es infalible; si detectamos un incidente relevante, actuaremos según corresponda.
        </p>
      </section>

      <section>
        <h2>5. Tus opciones</h2>
        <p>
          Podés pedir acceso, corrección o eliminación de tus datos, sujeto a las obligaciones de conservación que
          correspondan. Escribí desde el email usado en la reserva a{' '}
          <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a> para que podamos verificar el pedido.
        </p>
      </section>
    </LegalLayout>
  );
}
