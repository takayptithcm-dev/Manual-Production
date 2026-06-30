export type Environment = 'indoor' | 'outdoor';

export interface Annotation {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  techPositions?: Record<number, { x: number; y: number }>;
  label: string;
  description: string;
  material: string;
  spec: string;
  note: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
}

export interface ProductionManual {
  annotations: Annotation[];
  technicalSpecifications: string;
  generalNotes: string;
  timeSetting?: 'day' | 'night';
  markupRate?: number;
  vatRate?: number;
}

export type PageType = 'COVER_AND_RENDER' | 'TECH' | 'TECH_SPECS' | 'BOM' | 'NOTES';

export interface PageDef {
  id: string;
  type: PageType;
  title?: string;
  techIndex?: number;
  annotationIds?: string[];
}
