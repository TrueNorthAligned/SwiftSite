import { useDrop } from 'react-dnd';
import { useSite } from '../store';
import type { SectionType } from '../types';
import SectionRenderer from './SectionRenderer';

export default function Canvas() {
  const { state, dispatch } = useSite();

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'SECTION_TYPE',
    drop: (item: { type: SectionType }) => {
      dispatch({ type: 'ADD_SECTION', sectionType: item.type });
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const handleSelect = (id: string) => {
    dispatch({ type: 'SELECT_SECTION', id });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      dispatch({ type: 'MOVE_SECTION', fromIndex, toIndex });
    }
  };

  return (
    <div className="canvas-container">
      <div
        ref={drop}
        className={`canvas-dropzone ${isOver ? 'canvas-over' : ''}`}
      >
        {state.sections.length === 0 ? (
          <div className="canvas-empty">
            <div className="canvas-empty-icon">🎨</div>
            <p>Drag sections from the left sidebar to start building your website</p>
          </div>
        ) : (
          <div className="canvas-sections">
            {state.sections.map((section, index) => (
              <div
                key={section.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                <SectionRenderer
                  section={section}
                  isSelected={state.selectedSectionId === section.id}
                  onClick={() => handleSelect(section.id)}
                />
                <div className="ss-section-actions">
                  <button
                    className="ss-btn-remove"
                    onClick={() =>
                      dispatch({ type: 'REMOVE_SECTION', id: section.id })
                    }
                    title="Remove section"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}