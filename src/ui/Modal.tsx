import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icons';

interface ModalProps {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  wide?: boolean;
}

export function Modal({ title, eyebrow, children, onClose, className = '', wide = false }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`forge-modal ${wide ? 'forge-modal--wide' : ''} ${className}`}
      >
        <span className="frame-stud frame-stud--tl" />
        <span className="frame-stud frame-stud--tr" />
        <span className="frame-stud frame-stud--bl" />
        <span className="frame-stud frame-stud--br" />
        <header className="modal-header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          {onClose && (
            <button className="icon-button modal-close" onClick={onClose} aria-label="Close menu">
              <Icon name="close" size={24} />
            </button>
          )}
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
