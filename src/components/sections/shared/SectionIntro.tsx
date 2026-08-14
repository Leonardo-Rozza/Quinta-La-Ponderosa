import { ReactNode } from 'react';

interface SectionIntroProps {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'left' | 'center';
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  align = 'center',
}: SectionIntroProps) {
  return (
    <header className={`section-intro section-intro--${align}`}>
      <p className="section-eyebrow">
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <h2 className="section-title">{title}</h2>
      {description ? <p className="section-description">{description}</p> : null}
    </header>
  );
}
