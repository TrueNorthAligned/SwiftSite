import { useDrag } from 'react-dnd';
import type { SectionType } from '../types';
import { SECTION_LABELS } from '../types';

interface DraggableSectionProps {
  type: SectionType;
}

function DraggableSection({ type }: DraggableSectionProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'SECTION_TYPE',
    item: { type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const icons: Record<SectionType, string> = {
    hero: '🏠',
    about: 'ℹ️',
    services: '⚙️',
    contact: '📧',
    footer: '📄',
  };

  return (
    <div
      ref={drag}
      className="section-type-item"
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <span className="section-type-icon">{icons[type]}</span>
      <span className="section-type-label">{SECTION_LABELS[type]}</span>
    </div>
  );
}

const SECTION_TYPES: SectionType[] = ['hero', 'about', 'services', 'contact', 'footer'];

export default function SectionPicker() {
  return (
    <div className="section-picker">
      <h3 className="section-picker-title">Add Sections</h3>
      <p className="section-picker-hint">Drag a section onto the canvas</p>
      <div className="section-type-list">
        {SECTION_TYPES.map((type) => (
          <DraggableSection key={type} type={type} />
        ))}
      </div>
    </div>
  );
}