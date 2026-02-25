'use client';

import { useEffect, useMemo, useState } from 'react';
import { db, seedExercises } from '@/lib/db';
import type { Exercise, Tab, WorkoutTemplate } from '@/lib/types';
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

export default function AppShell() {
  const [tab, setTab] = useState<Tab>('exercises');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState<string>('all');
  const [bodyPart, setBodyPart] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const init = async () => {
      await seedExercises();
      setExercises(await db.exercises.toArray());
      setTemplates(await db.templates.orderBy('updatedAt').reverse().toArray());
    };
    init();
  }, []);

  const refreshTemplates = async () => {
    setTemplates(await db.templates.orderBy('updatedAt').reverse().toArray());
  };

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
              <TemplateCard key={template.id} template={template} allExercises={exercises} refreshTemplates={refreshTemplates} sensors={sensors} />
            ))}
          </div>
        )}

        {tab === 'log' && <Placeholder title="Log" text="Quick logging workflow will land next." />}
        {tab === 'history' && <Placeholder title="History" text="Past sessions and progress charts are planned." />}
        {tab === 'settings' && (
          <div className="card space-y-4">
            <h2 className="font-semibold">Settings</h2>
            <label className="flex items-center justify-between text-sm">
              Dark mode
              <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} />
            </label>
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
    </main>
  );
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="card text-sm">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <p className="text-zinc-500">{text}</p>
    </div>
  );
}

function TemplateCard({
  template,
  allExercises,
  refreshTemplates,
  sensors
}: {
  template: WorkoutTemplate;
  allExercises: Exercise[];
  refreshTemplates: () => Promise<void>;
  sensors: ReturnType<typeof useSensors>;
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
