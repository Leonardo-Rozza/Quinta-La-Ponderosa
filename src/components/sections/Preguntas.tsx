import { PRECIOS } from '@/lib/constants';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { SectionIntro } from './shared/SectionIntro';

const PREGUNTAS = [
  {
    pregunta: '¿La quinta se comparte con otros grupos?',
    respuesta: 'No. La reserva corresponde al uso exclusivo del predio durante la jornada elegida.',
  },
  {
    pregunta: '¿Qué horario incluye la jornada?',
    respuesta: `El uso es de ${PRECIOS.horarioInicio} a ${PRECIOS.horarioFin} hs, dentro del mismo día. Si necesitás coordinar un detalle de ingreso, escribinos antes de reservar.`,
  },
  {
    pregunta: '¿Cuántas personas pueden asistir?',
    respuesta: `La capacidad máxima informada es de ${PRECIOS.maximoPersonas} personas, incluyendo adultos y niños.`,
  },
  {
    pregunta: '¿Cómo se confirma la fecha?',
    respuesta: `La fecha queda confirmada cuando Mercado Pago acredita la seña del ${PRECIOS.porcentajeSena * 100}%. El sitio muestra el estado y enviamos la confirmación al email informado.`,
  },
  {
    pregunta: '¿El sitio recibe los datos de mi tarjeta?',
    respuesta: 'No. El pago se completa en el entorno de Mercado Pago; La Ponderosa recibe únicamente el estado necesario para asociarlo con la reserva.',
  },
] as const;

export function Preguntas() {
  return (
    <section className="faq section-shell" aria-labelledby="faq-title">
      <div className="section-container faq__layout">
        <div className="faq__heading">
          <SectionIntro
            align="left"
            eyebrow="Antes de reservar"
            title={<span id="faq-title">Preguntas que conviene resolver.</span>}
            description="La información central, sin hacerte buscarla entre mensajes."
          />
          <p>
            ¿Tu duda no está acá?{' '}
            <Link href="/#contacto">Hablemos antes de que pagues.</Link>
          </p>
        </div>

        <div className="faq__list">
          {PREGUNTAS.map(({ pregunta, respuesta }, index) => (
            <details key={pregunta} open={index === 0}>
              <summary>
                <span>{pregunta}</span>
                <Plus aria-hidden="true" />
              </summary>
              <p>{respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
