import { LegalLayout } from '@/components/sections/legal/LegalLayout';
import { CONFIG, PRECIOS } from '@/lib/constants';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de reserva | La Ponderosa',
  description: 'Condiciones del proceso de reserva online de Quinta La Ponderosa.',
};

export default function TerminosPage() {
  return (
    <LegalLayout
      eyebrow="Información de reserva"
      title="Términos claros para una jornada tranquila."
      summary="Estas condiciones regulan la solicitud online, la seña y el uso de la quinta. Leelas antes de pagar."
    >
      <section>
        <h2>1. Qué estás reservando</h2>
        <p>
          La reserva corresponde a una jornada de uso de Quinta La Ponderosa, en {CONFIG.direccionLocalidad},
          de {PRECIOS.horarioInicio} a {PRECIOS.horarioFin} hs y para un máximo de{' '}
          {PRECIOS.maximoPersonas} personas. La fecha y el importe vigentes se muestran en el resumen antes del pago.
        </p>
      </section>

      <section>
        <h2>2. Confirmación y pago</h2>
        <p>
          Para iniciar la reserva se abona una seña del {PRECIOS.porcentajeSena * 100}% mediante Mercado Pago.
          La solicitud se considera confirmada únicamente cuando el pago figura aprobado y el sistema muestra o
          envía la confirmación. Un pago pendiente todavía puede requerir acreditación.
        </p>
        <p>
          El saldo se coordina con La Ponderosa para la jornada. Mercado Pago procesa los datos del medio de pago;
          este sitio no recibe números completos de tarjeta ni credenciales de esa cuenta.
        </p>
      </section>

      <section>
        <h2>3. Disponibilidad</h2>
        <p>
          El calendario consulta fechas ocupadas en tiempo real. Si dos personas intentan reservar el mismo día,
          tiene prioridad la primera operación que el sistema logra registrar y confirmar. Si una fecha cambia
          durante el proceso, se solicitará elegir otra antes de cobrar una nueva seña.
        </p>
      </section>

      <section>
        <h2>4. Cambios, cancelaciones y devoluciones</h2>
        <p>
          Si necesitás cambiar o cancelar, comunicate cuanto antes por los canales publicados. Las reprogramaciones
          dependen de la anticipación, el motivo y la disponibilidad de otra fecha; no son automáticas. Cualquier
          condición particular acordada por escrito para tu reserva complementa estos términos.
        </p>
        <div className="legal-callout">
          Antes de pagar, consultanos si necesitás una condición de cancelación específica. No continúes si esa
          condición es determinante para tu encuentro y todavía no fue aclarada.
        </div>
      </section>

      <section>
        <h2>5. Uso responsable del predio</h2>
        <p>
          La persona que reserva debe respetar la capacidad, el horario y las indicaciones de seguridad del lugar,
          y es responsable del comportamiento de su grupo. Los menores deben permanecer bajo supervisión adulta,
          especialmente en el sector de pileta y cerca del fuego.
        </p>
      </section>

      <section>
        <h2>6. Contacto</h2>
        <p>
          Para corregir datos, consultar un pago o pedir información previa, escribí a{' '}
          <a href={`mailto:${CONFIG.email}`}>{CONFIG.email}</a> o llamá al{' '}
          <a href={`tel:${CONFIG.telefono}`}>{CONFIG.telefonoDisplay}</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
