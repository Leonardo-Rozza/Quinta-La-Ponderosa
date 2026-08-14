interface DaylineProps {
  compact?: boolean;
  inverse?: boolean;
}

const MOMENTOS = [
  { hora: '10', etiqueta: 'Llegar' },
  { hora: '15', etiqueta: 'Disfrutar' },
  { hora: '20', etiqueta: 'Cerrar' },
] as const;

export function Dayline({ compact = false, inverse = false }: DaylineProps) {
  return (
    <div
      className={`dayline${compact ? ' dayline--compact' : ''}${inverse ? ' dayline--inverse' : ''}`}
      aria-label="Una jornada en La Ponderosa, de 10 a 20 horas"
    >
      {MOMENTOS.map((momento, index) => (
        <div className="dayline__moment" key={momento.hora}>
          <span className="dayline__dot" aria-hidden="true" />
          <span className="dayline__time">{momento.hora}:00</span>
          {!compact ? <span className="dayline__label">{momento.etiqueta}</span> : null}
          {index < MOMENTOS.length - 1 ? <span className="dayline__track" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}
