import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import { createDefaultSection } from './types';
import type { SiteState, SiteAction, SectionType } from './types';

const initialState: SiteState = {
  sections: [],
  selectedSectionId: null,
};

function siteReducer(state: SiteState, action: SiteAction): SiteState {
  switch (action.type) {
    case 'ADD_SECTION': {
      const newSection = createDefaultSection(action.sectionType);
      return {
        ...state,
        sections: [...state.sections, newSection],
        selectedSectionId: newSection.id,
      };
    }
    case 'REMOVE_SECTION': {
      const filtered = state.sections.filter((s) => s.id !== action.id);
      return {
        ...state,
        sections: filtered,
        selectedSectionId:
          state.selectedSectionId === action.id ? null : state.selectedSectionId,
      };
    }
    case 'MOVE_SECTION': {
      const sections = [...state.sections];
      const [moved] = sections.splice(action.fromIndex, 1);
      sections.splice(action.toIndex, 0, moved);
      return { ...state, sections };
    }
    case 'SELECT_SECTION': {
      return { ...state, selectedSectionId: action.id };
    }
    case 'UPDATE_SECTION_PROPS': {
      return {
        ...state,
        sections: state.sections.map((s) =>
          s.id === action.id ? { ...s, props: { ...s.props, ...action.props } } : s
        ),
      };
    }
    default:
      return state;
  }
}

interface SiteContextType {
  state: SiteState;
  dispatch: React.Dispatch<SiteAction>;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(siteReducer, initialState);
  return (
    <SiteContext.Provider value={{ state, dispatch }}>
      {children}
    </SiteContext.Provider>
  );
}

export function useSite(): SiteContextType {
  const context = useContext(SiteContext);
  if (!context) throw new Error('useSite must be used within SiteProvider');
  return context;
}