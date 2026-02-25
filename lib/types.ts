export type Tab = 'exercises' | 'templates' | 'log' | 'history' | 'settings';

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
}

export interface TemplateExercise {
  exerciseId: string;
  order: number;
}

export interface WorkoutTemplate {
  id?: number;
  name: string;
  exercises: TemplateExercise[];
  createdAt: number;
  updatedAt: number;
}
