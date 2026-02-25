'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, seedExercises } from '@/lib/db';
import type {
  ActiveWorkout,
  Exercise,
  LoggedExercise,
  Tab,
  WeightUnit,
  WorkoutEntry,
  WorkoutSet,
  WorkoutTemplate
} from '@/lib/types';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const tabs: { key: Tab; label: string }[] = [
  { key: 'exercises', label: 'Exercises' },
  { key: 'templates', label: 'Templates' },
  { key: 'log', label: 'Log' },
  { key: 'history', label: 'History' },
  { key: 'settings', label: 'Settings' }
];

const ACTIVE_WORKOUT_META_KEY = 'active_workout';
const WEIGHT_UNIT_META_KEY = 'weight_unit';
const DARK_MODE_META_KEY = 'dark_mode';

const makeId = () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function createDefaultSet(): WorkoutSet {
  return { id: makeId(), weight: '', reps: '', completed: false };
}

function createWorkoutExercise(exercise: Exercise): LoggedExercise {
  return {
    instanceId: makeId(),
    exerciseId: exercise.id,
    name: exercise.name,
    sets: [createDefaultSet()]
  };
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeNumericInput(value: string, allowDecimal: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const numericPattern = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;
  if (!numericPattern.test(trimmed)) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return trimmed;
}

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('exercises');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<string>('all');
  const [bodyPart, setBodyPart] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutEntry | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const refreshTemplates = async () => {
    setTemplates(await db.templates.orderBy('updatedAt').reverse().toArray());
  };

  const refreshWorkouts = async () => {
    setWorkouts(await db.workouts.orderBy('endedAt').reverse().toArray());
  };

  useEffect(() => {
    const init = async () => {
      await seedExercises();
      const [exerciseRows, templateRows, workoutRows, savedUnit, savedDarkMode, savedActiveWorkout] = await Promise.all([
        db.exercises.toArray(),
        db.templates.orderBy('updatedAt').reverse().toArray(),
        db.workouts.orderBy('endedAt').reverse().toArray(),
        db.meta.get(WEIGHT_UNIT_META_KEY),
        db.meta.get(DARK_MODE_META_KEY),
        db.meta.get(ACTIVE_WORKOUT_META_KEY)
      ]);

      setExercises(exerciseRows);
      setTemplates(templateRows);
      setWorkouts(workoutRows);

      if (savedUnit?.value === 'kg' || savedUnit?.value === 'lb') {
        setWeightUnit(savedUnit.value);
      }

      if (savedDarkMode?.value === 'true' || savedDarkMode?.value === 'false') {
        setDarkMode(savedDarkMode.value === 'true');
      }

      if (savedActiveWorkout?.value) {
        try {
          const parsed = JSON.parse(savedActiveWorkout.value) as ActiveWorkout;
          setActiveWorkout(parsed);
          setTab('log');
        } catch {
          await db.meta.delete(ACTIVE_WORKOUT_META_KEY);
        }
      }
    };

    init();
  }, []);

  useEffect(() => {
    void db.meta.put({ key: DARK_MODE_META_KEY, value: String(darkMode) });
  }, [darkMode]);

  useEffect(() => {
    void db.meta.put({ key: WEIGHT_UNIT_META_KEY, value: weightUnit });
  }, [weightUnit]);

  useEffect(() => {
    if (activeWorkout) {
      void db.meta.put({ key: ACTIVE_WORKOUT_META_KEY, value: JSON.stringify(activeWorkout) });
      return;
    }

    void db.meta.delete(ACTIVE_WORKOUT_META_KEY);
  }, [activeWorkout]);

  const equipmentOptions = useMemo(
    () => ['all', ...new Set(exercises.map((item) => item.equipment))].slice(0, 16),
    [exercises]
  );
  const bodyPartOptions = useMemo(
    () => ['all', ...new Set(exercises.map((item) => item.bodyPart))].slice(0, 16),
    [exercises]
  );

  const filtered = useMemo(
    () =>
      exercises.filter((item) => {
        const matchText = item.name.toLowerCase().includes(query.toLowerCase());
        const matchEq = equipment === 'all' || item.equipment === equipment;
        const matchBody = bodyPart === 'all' || item.bodyPart === bodyPart;
        return matchText && matchEq && matchBody;
      }),
    [exercises, query, equipment, bodyPart]
  );

  const createTemplate = async () => {
    await db.templates.add({
      name: `Template ${templates.length + 1}`,
      exercises: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    await refreshTemplates();
  };

  const startWorkoutFromTemplate = (template: WorkoutTemplate) => {
    const workoutExercises = template.exercises
      .sort((a, b) => a.order - b.order)
      .map((item) => exercises.find((exercise) => exercise.id === item.exerciseId))
      .filter((item): item is Exercise => Boolean(item))
      .map((exercise) => createWorkoutExercise(exercise));

    const nextWorkout: ActiveWorkout = {
      id: makeId(),
      templateId: template.id,
      templateName: template.name,
      startedAt: Date.now(),
      exercises: workoutExercises
    };

    setActiveWorkout(nextWorkout);
    setTab('log');
  };

  const startEmptyWorkout = () => {
    setActiveWorkout({
      id: makeId(),
      templateName: 'Quick workout',
      startedAt: Date.now(),
      exercises: []
    });
    setTab('log');
  };

  const updateActiveWorkout = (updater: (workout: ActiveWorkout) => ActiveWorkout) => {
    setActiveWorkout((current) => (current ? updater(current) : current));
  };

  const finishWorkout = async () => {
    if (!activeWorkout) return;

    const completedWorkout: WorkoutEntry = {
      templateId: activeWorkout.templateId,
      templateName: activeWorkout.templateName,
      startedAt: activeWorkout.startedAt,
      endedAt: Date.now(),
      exercises: activeWorkout.exercises
    };

    await db.workouts.add(completedWorkout);
    setActiveWorkout(null);
    await refreshWorkouts();
    setTab('history');
  };

  const deleteWorkout = async (workout: WorkoutEntry) => {
    if (!workout.id) return;
    if (!window.confirm('Delete this workout from history?')) return;
    await db.workouts.delete(workout.id);
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(null);
    }
    await refreshWorkouts();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-20">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-100/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <h1 className="text-xl font-bold">PulseLog</h1>
        <p className="text-xs text-zinc-500">Workout logging PWA</p>
      </header>

      <section className="flex-1 p-4">
        {tab === 'exercises' && (
          <div className="space-y-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Search exercises"
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Equipment</p>
              <div className="flex flex-wrap gap-2">
                {equipmentOptions.map((opt) => (
                  <button key={opt} onClick={() => setEquipment(opt)} className={`chip ${equipment === opt ? 'border-brand bg-brand/15' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Body part</p>
              <div className="flex flex-wrap gap-2">
                {bodyPartOptions.map((opt) => (
                  <button key={opt} onClick={() => setBodyPart(opt)} className={`chip ${bodyPart === opt ? 'border-brand bg-brand/15' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {filtered.map((exercise) => (
                <button key={exercise.id} onClick={() => setSelectedExercise(exercise)} className="card w-full text-left">
                  <p className="font-semibold">{exercise.name}</p>
                  <p className="text-xs text-zinc-500">{exercise.bodyPart} • {exercise.equipment}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'templates' && (
          <div className="space-y-4">
            <button onClick={createTemplate} className="w-full rounded-xl bg-brand p-3 text-sm font-semibold text-white">
              Create template
            </button>
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                allExercises={exercises}
                refreshTemplates={refreshTemplates}
                sensors={sensors}
                onStart={() => startWorkoutFromTemplate(template)}
              />
            ))}
          </div>
        )}

        {tab === 'log' && (
          <LogScreen
            activeWorkout={activeWorkout}
            templates={templates}
            exercises={exercises}
            sensors={sensors}
            weightUnit={weightUnit}
            onStartTemplate={(templateId) => {
              const template = templates.find((item) => item.id === templateId);
              if (template) {
                startWorkoutFromTemplate(template);
              }
            }}
            onStartQuickWorkout={startEmptyWorkout}
            onUpdateWorkout={updateActiveWorkout}
            onFinishWorkout={finishWorkout}
          />
        )}

        {tab === 'history' && (
          <HistoryScreen workouts={workouts} weightUnit={weightUnit} onOpenWorkout={setSelectedWorkout} onDeleteWorkout={deleteWorkout} />
        )}

        {tab === 'settings' && (
          <div className="card space-y-4">
            <h2 className="font-semibold">Settings</h2>
            <label className="flex items-center justify-between text-sm">
              Dark mode
              <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
            </label>

            <div className="space-y-2 text-sm">
              <p className="font-medium">Weight units</p>
              <div className="flex gap-2">
                {(['kg', 'lb'] as WeightUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setWeightUnit(unit)}
                    className={`rounded-lg border px-3 py-2 text-xs uppercase ${weightUnit === unit ? 'border-brand bg-brand/15 text-brand' : 'border-zinc-300 dark:border-zinc-700'}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 mx-auto grid w-full max-w-md grid-cols-5 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {tabs.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`p-3 text-xs ${tab === item.key ? 'font-semibold text-brand' : 'text-zinc-500'}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {selectedExercise && (
        <div className="fixed inset-0 z-20 bg-black/60 p-4" onClick={() => setSelectedExercise(null)}>
          <div className="card mx-auto mt-12 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{selectedExercise.name}</h3>
            <p className="text-sm text-zinc-500">Target: {selectedExercise.target}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {selectedExercise.instructions.slice(0, 5).map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
            <button className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={() => setSelectedExercise(null)}>Close</button>
          </div>
        </div>
      )}

      {selectedWorkout && (
        <WorkoutDetailsModal workout={selectedWorkout} weightUnit={weightUnit} onClose={() => setSelectedWorkout(null)} />
      )}
    </main>
  );
}

function TemplateCard({
  template,
  allExercises,
  refreshTemplates,
  sensors,
  onStart
}: {
  template: WorkoutTemplate;
  allExercises: Exercise[];
  refreshTemplates: () => Promise<void>;
  sensors: ReturnType<typeof useSensors>;
  onStart: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const templateExercises = template.exercises
    .sort((a, b) => a.order - b.order)
    .map((item) => ({ ...item, exercise: allExercises.find((ex) => ex.id === item.exerciseId) }))
    .filter((item) => item.exercise);

  const available = allExercises.filter((e) => !template.exercises.find((te) => te.exerciseId === e.id)).slice(0, 20);

  const save = async (patch: Partial<WorkoutTemplate>) => {
    await db.templates.update(template.id!, { ...patch, updatedAt: Date.now() });
    await refreshTemplates();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templateExercises.findIndex((item) => item.exerciseId === active.id);
    const newIndex = templateExercises.findIndex((item) => item.exerciseId === over.id);
    const reordered = arrayMove(templateExercises, oldIndex, newIndex).map((item, index) => ({ exerciseId: item.exerciseId, order: index }));
    await save({ exercises: reordered });
  };

  const removeExercise = async (exerciseId: string) => {
    const filtered = templateExercises.filter((item) => item.exerciseId !== exerciseId).map((item, index) => ({ exerciseId: item.exerciseId, order: index }));
    await save({ exercises: filtered });
  };

  const addExercise = async (exerciseId: string) => {
    const next = [...templateExercises.map((item) => ({ exerciseId: item.exerciseId, order: item.order })), { exerciseId, order: templateExercises.length }];
    await save({ exercises: next });
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          className="w-full rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          value={template.name}
          onChange={(e) => save({ name: e.target.value })}
        />
        <button className="rounded-lg border border-brand px-3 py-1 text-xs font-medium text-brand" onClick={onStart}>Start</button>
        <button className="text-xs text-zinc-500" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={templateExercises.map((item) => item.exerciseId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {templateExercises.map((item) => (
              <SortableItem key={item.exerciseId} id={item.exerciseId} name={item.exercise!.name} onRemove={() => removeExercise(item.exerciseId)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editing && (
        <select className="w-full rounded-lg border border-zinc-300 bg-transparent p-2 text-sm dark:border-zinc-700" onChange={(e) => e.target.value && addExercise(e.target.value)} defaultValue="">
          <option value="" disabled>Add exercise…</option>
          {available.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>{exercise.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function LogScreen({
  activeWorkout,
  templates,
  exercises,
  sensors,
  weightUnit,
  onStartTemplate,
  onStartQuickWorkout,
  onUpdateWorkout,
  onFinishWorkout
}: {
  activeWorkout: ActiveWorkout | null;
  templates: WorkoutTemplate[];
  exercises: Exercise[];
  sensors: ReturnType<typeof useSensors>;
  weightUnit: WeightUnit;
  onStartTemplate: (templateId: number) => void;
  onStartQuickWorkout: () => void;
  onUpdateWorkout: (updater: (workout: ActiveWorkout) => ActiveWorkout) => void;
  onFinishWorkout: () => Promise<void>;
}) {
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerEquipment, setPickerEquipment] = useState<string>('all');
  const [pickerBodyPart, setPickerBodyPart] = useState<string>('all');

  if (!activeWorkout) {
    return (
      <div className="space-y-4">
        <div className="card space-y-3">
          <h2 className="font-semibold">Start workout</h2>
          <p className="text-sm text-zinc-500">Pick a template to begin logging or start an empty workout.</p>
          <select className="w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700" defaultValue="" onChange={(e) => onStartTemplate(Number(e.target.value))}>
            <option value="" disabled>Select a template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <button className="w-full rounded-xl border border-zinc-300 p-3 text-sm font-semibold dark:border-zinc-700" onClick={onStartQuickWorkout}>
            Start quick workout
          </button>
        </div>
      </div>
    );
  }

  const onExerciseDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    onUpdateWorkout((workout) => {
      const oldIndex = workout.exercises.findIndex((item) => item.instanceId === active.id);
      const newIndex = workout.exercises.findIndex((item) => item.instanceId === over.id);
      return { ...workout, exercises: arrayMove(workout.exercises, oldIndex, newIndex) };
    });
  };

  const addExercise = (exerciseId: string) => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;

    onUpdateWorkout((workout) => ({ ...workout, exercises: [...workout.exercises, createWorkoutExercise(exercise)] }));
    setShowExercisePicker(false);
    setPickerQuery('');
    setPickerEquipment('all');
    setPickerBodyPart('all');
  };

  const availableExercises = exercises.filter(
    (exercise) => !activeWorkout.exercises.some((item) => item.exerciseId === exercise.id)
  );
  const equipmentOptions = ['all', ...new Set(availableExercises.map((item) => item.equipment))].slice(0, 16);
  const bodyPartOptions = ['all', ...new Set(availableExercises.map((item) => item.bodyPart))].slice(0, 16);
  const filteredExercises = availableExercises.filter((item) => {
    const matchesText = item.name.toLowerCase().includes(pickerQuery.toLowerCase());
    const matchesEquipment = pickerEquipment === 'all' || item.equipment === pickerEquipment;
    const matchesBodyPart = pickerBodyPart === 'all' || item.bodyPart === pickerBodyPart;
    return matchesText && matchesEquipment && matchesBodyPart;
  });

  return (
    <div className="space-y-4">
      <div className="card space-y-2">
        <h2 className="font-semibold">{activeWorkout.templateName}</h2>
        <p className="text-xs text-zinc-500">Started {new Date(activeWorkout.startedAt).toLocaleString()}</p>
        <p className="text-xs text-zinc-500">Weight unit: {weightUnit}</p>
      </div>

      <button
        className="w-full rounded-lg border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
        onClick={() => setShowExercisePicker(true)}
      >
        Add exercise from library…
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onExerciseDragEnd}>
        <SortableContext items={activeWorkout.exercises.map((item) => item.instanceId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {activeWorkout.exercises.map((exercise, index) => (
              <ActiveExerciseCard
                key={exercise.instanceId}
                index={index}
                exercise={exercise}
                weightUnit={weightUnit}
                onChange={(patch) => {
                  onUpdateWorkout((workout) => ({
                    ...workout,
                    exercises: workout.exercises.map((item) =>
                      item.instanceId === exercise.instanceId ? patch(item) : item
                    )
                  }));
                }}
                onRemove={() => {
                  onUpdateWorkout((workout) => ({
                    ...workout,
                    exercises: workout.exercises.filter((item) => item.instanceId !== exercise.instanceId)
                  }));
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button className="w-full rounded-xl bg-brand p-3 text-sm font-semibold text-white" onClick={() => void onFinishWorkout()}>
        Finish workout
      </button>

      {showExercisePicker && (
        <div className="fixed inset-0 z-30 bg-black/60 p-4" onClick={() => setShowExercisePicker(false)}>
          <div className="card mx-auto mt-6 max-h-[85vh] max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold">Add exercise</h3>
              <button className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700" onClick={() => setShowExercisePicker(false)}>
                Close
              </button>
            </div>

            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Search exercises"
            />

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Equipment</p>
              <div className="flex flex-wrap gap-2">
                {equipmentOptions.map((opt) => (
                  <button key={opt} onClick={() => setPickerEquipment(opt)} className={`chip ${pickerEquipment === opt ? 'border-brand bg-brand/15' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Body part</p>
              <div className="flex flex-wrap gap-2">
                {bodyPartOptions.map((opt) => (
                  <button key={opt} onClick={() => setPickerBodyPart(opt)} className={`chip ${pickerBodyPart === opt ? 'border-brand bg-brand/15' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {filteredExercises.length ? (
                filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => addExercise(exercise.id)}
                    className="w-full rounded-lg border border-zinc-200 p-3 text-left text-sm dark:border-zinc-700"
                  >
                    <p className="font-semibold">{exercise.name}</p>
                    <p className="text-xs text-zinc-500">{exercise.bodyPart} • {exercise.equipment}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No exercises match your filters.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveExerciseCard({
  exercise,
  index,
  weightUnit,
  onChange,
  onRemove
}: {
  exercise: LoggedExercise;
  index: number;
  weightUnit: WeightUnit;
  onChange: (patch: (exercise: LoggedExercise) => LoggedExercise) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: exercise.instanceId });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const removeSet = (setId: string) => {
    onChange((currentExercise) => {
      if (currentExercise.sets.length <= 1) return currentExercise;
      return {
        ...currentExercise,
        sets: currentExercise.sets.filter((item) => item.id !== setId)
      };
    });
  };

  return (
    <div ref={setNodeRef} style={style} className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{index + 1}. {exercise.name}</p>
          <p className="text-xs text-zinc-500">Set logging ({weightUnit})</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="cursor-grab rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600" {...attributes} {...listeners}>Drag</button>
          <button className="text-xs text-rose-500" onClick={onRemove}>Remove exercise</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="py-1">Set</th>
              <th className="py-1">Weight ({weightUnit})</th>
              <th className="py-1">Reps</th>
              <th className="py-1">Done</th>
              <th className="py-1 text-right">Remove</th>
            </tr>
          </thead>
          <tbody>
            {exercise.sets.map((set, setIndex) => (
              <tr key={set.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-1">{setIndex + 1}</td>
                <td className="py-1 pr-2">
                  <input
                    className="w-20 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                    inputMode="decimal"
                    value={set.weight}
                    onChange={(e) => {
                      const nextWeight = normalizeNumericInput(e.target.value, true);
                      if (nextWeight === null) return;

                      onChange((currentExercise) => ({
                        ...currentExercise,
                        sets: currentExercise.sets.map((item) => (item.id === set.id ? { ...item, weight: nextWeight } : item))
                      }));
                    }}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
                    inputMode="numeric"
                    value={set.reps}
                    onChange={(e) => {
                      const nextReps = normalizeNumericInput(e.target.value, false);
                      if (nextReps === null) return;

                      onChange((currentExercise) => ({
                        ...currentExercise,
                        sets: currentExercise.sets.map((item) => (item.id === set.id ? { ...item, reps: nextReps } : item))
                      }));
                    }}
                  />
                </td>
                <td className="py-1">
                  <input
                    type="checkbox"
                    checked={set.completed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onChange((currentExercise) => ({
                        ...currentExercise,
                        sets: currentExercise.sets.map((item) => (item.id === set.id ? { ...item, completed: checked } : item))
                      }));
                    }}
                  />
                </td>
                <td className="py-1 text-right">
                  <button
                    className="rounded px-1 text-sm text-rose-500"
                    onClick={() => removeSet(set.id)}
                    aria-label={`Remove set ${setIndex + 1}`}
                    title="Remove set"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          onClick={() => {
            onChange((currentExercise) => ({
              ...currentExercise,
              sets: [...currentExercise.sets, createDefaultSet()]
            }));
          }}
        >
          Add set
        </button>
        <button
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
          onClick={() => {
            onChange((currentExercise) => {
              const last = currentExercise.sets[currentExercise.sets.length - 1];
              if (!last) return currentExercise;

              return {
                ...currentExercise,
                sets: [...currentExercise.sets, { ...last, id: makeId(), completed: false }]
              };
            });
          }}
        >
          Copy last set
        </button>
      </div>
    </div>
  );
}

function HistoryScreen({
  workouts,
  weightUnit,
  onOpenWorkout,
  onDeleteWorkout
}: {
  workouts: WorkoutEntry[];
  weightUnit: WeightUnit;
  onOpenWorkout: (workout: WorkoutEntry) => void;
  onDeleteWorkout: (workout: WorkoutEntry) => void;
}) {
  if (!workouts.length) {
    return (
      <div className="card text-sm">
        <h2 className="mb-2 font-semibold">History</h2>
        <p className="text-zinc-500">No completed workouts yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((workout) => {
        const validSets = workout.exercises.flatMap((exercise) =>
          exercise.sets.filter((set) => {
            const weight = parseNonNegativeNumber(set.weight);
            const reps = parseNonNegativeNumber(set.reps);
            return weight !== null && reps !== null;
          })
        );
        const totalSets = validSets.length;
        const totalVolume = workout.exercises.reduce(
          (sum, exercise) =>
            sum +
            exercise.sets.reduce((setSum, set) => {
              const weight = parseNonNegativeNumber(set.weight);
              const reps = parseNonNegativeNumber(set.reps);
              if (weight === null || reps === null) return setSum;
              return setSum + weight * reps;
            }, 0),
          0
        );

        return (
          <div key={workout.id} className="card space-y-2">
            <button className="w-full text-left" onClick={() => onOpenWorkout(workout)}>
              <p className="font-semibold">{workout.templateName}</p>
              <p className="text-xs text-zinc-500">{new Date(workout.endedAt).toLocaleString()}</p>
              <p className="text-xs text-zinc-500">
                {workout.exercises.length} exercises • {totalSets} sets • {Math.round(totalVolume)} {weightUnit} total volume
              </p>
            </button>
            <button className="text-xs text-rose-500" onClick={() => onDeleteWorkout(workout)}>Delete</button>
          </div>
        );
      })}
    </div>
  );
}

function WorkoutDetailsModal({ workout, weightUnit, onClose }: { workout: WorkoutEntry; weightUnit: WeightUnit; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 bg-black/60 p-4" onClick={onClose}>
      <div className="card mx-auto mt-8 max-h-[85vh] max-w-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">{workout.templateName}</h3>
        <p className="text-xs text-zinc-500">{new Date(workout.startedAt).toLocaleString()} - {new Date(workout.endedAt).toLocaleString()}</p>

        <div className="mt-3 space-y-3">
          {workout.exercises.map((exercise) => (
            <div key={exercise.instanceId} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <p className="mb-2 text-sm font-semibold">{exercise.name}</p>
              <ul className="space-y-1 text-xs">
                {exercise.sets.map((set, idx) => (
                  <li key={set.id}>
                    Set {idx + 1}: {set.weight || '-'} {weightUnit} × {set.reps || '-'} reps {set.completed ? '✓' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function SortableItem({ id, name, onRemove }: { id: string; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-700">
      <div className="flex items-center gap-2">
        <button className="cursor-grab rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600" {...attributes} {...listeners}>
          Drag
        </button>
        <span>{name}</span>
      </div>
      <button className="text-xs text-rose-500" onClick={onRemove}>Remove</button>
    </div>
  );
}
