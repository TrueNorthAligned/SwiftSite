import { useSite } from '../store';
import type { Section, SectionType } from '../types';
import { DEFAULT_SECTION_PROPS } from '../types';

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  return (
    <div className="prop-field">
      <label>{label}</label>
      <div className="color-picker-row">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="prop-input prop-input-sm"
        />
      </div>
    </div>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function TextInput({ label, value, onChange }: TextInputProps) {
  return (
    <div className="prop-field">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="prop-input"
      />
    </div>
  );
}

function ServicesItemsEditor({
  items = [],
  onChange,
}: {
  items: Array<{ title: string; description: string }>;
  onChange: (items: Array<{ title: string; description: string }>) => void;
}) {
  const handleChange = (idx: number, field: string, value: string) => {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const addItem = () => {
    onChange([...items, { title: 'New Service', description: 'Description here' }]);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="prop-field">
      <label>Service Items</label>
      {items.map((item, idx) => (
        <div key={idx} className="service-item-editor">
          <input
            type="text"
            value={item.title}
            onChange={(e) => handleChange(idx, 'title', e.target.value)}
            placeholder="Service title"
            className="prop-input prop-input-sm"
          />
          <input
            type="text"
            value={item.description}
            onChange={(e) => handleChange(idx, 'description', e.target.value)}
            placeholder="Description"
            className="prop-input prop-input-sm"
          />
          <button
            className="ss-btn-remove ss-btn-sm"
            onClick={() => removeItem(idx)}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="ss-btn-add" onClick={addItem}>
        + Add Service
      </button>
    </div>
  );
}

function getEditorFields(type: SectionType) {
  const defaults = DEFAULT_SECTION_PROPS[type];
  const fields: Array<{ key: string; label: string; kind: 'text' | 'color' | 'services-editor' }> = [];

  for (const key of Object.keys(defaults)) {
    if (key === 'items') {
      fields.push({ key, label: 'Service Items', kind: 'services-editor' });
    } else if (key.endsWith('Color') || key.endsWith('BgColor')) {
      fields.push({ key: key as string, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), kind: 'color' });
    } else {
      fields.push({ key: key as string, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()), kind: 'text' });
    }
  }
  return fields;
}

export default function PropertyEditor() {
  const { state, dispatch } = useSite();
  const selectedSection = state.sections.find(
    (s) => s.id === state.selectedSectionId
  );

  if (!selectedSection) {
    return (
      <div className="property-editor property-editor-empty">
        <h3>Properties</h3>
        <p className="empty-hint">Select a section on the canvas to edit its properties</p>
      </div>
    );
  }

  const fields = getEditorFields(selectedSection.type);
  const defaults = DEFAULT_SECTION_PROPS[selectedSection.type];

  const updateProp = (key: string, value: any) => {
    dispatch({
      type: 'UPDATE_SECTION_PROPS',
      id: selectedSection.id,
      props: { [key]: value },
    });
  };

  const resetToDefaults = () => {
    dispatch({
      type: 'UPDATE_SECTION_PROPS',
      id: selectedSection.id,
      props: { ...defaults },
    });
  };

  return (
    <div className="property-editor">
      <div className="property-editor-header">
        <h3>Properties</h3>
        <span className="section-type-badge">{selectedSection.type}</span>
      </div>

      {fields.map((field) => {
        if (field.kind === 'color') {
          return (
            <ColorInput
              key={field.key}
              label={field.label}
              value={selectedSection.props[field.key] || ''}
              onChange={(v) => updateProp(field.key, v)}
            />
          );
        }
        if (field.kind === 'services-editor') {
          return (
            <ServicesItemsEditor
              key={field.key}
              items={selectedSection.props[field.key] || []}
              onChange={(v) => updateProp(field.key, v)}
            />
          );
        }
        return (
          <TextInput
            key={field.key}
            label={field.label}
            value={selectedSection.props[field.key] || ''}
            onChange={(v) => updateProp(field.key, v)}
          />
        );
      })}

      <div className="prop-actions">
        <button className="ss-btn-reset" onClick={resetToDefaults}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}