import { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Save, ChevronDown, ChevronUp, User, Calendar, FolderOpen } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import {
  PRIORITY_OPTIONS,
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
  BROWSER_OPTIONS,
  DEVICE_OPTIONS,
  ENVIRONMENT_OPTIONS,
} from '../../utils/constants';
import { cn } from '../../utils/helpers';
import { useProjects, useUsers } from '../../hooks/useProjects';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  summary: z.string().min(1, 'Summary is required').max(500),
  description: z.string().min(1, 'Description is required'),
  priority: z.string().min(1, 'Priority is required'),
  severity: z.string().min(1, 'Severity is required'),
  status: z.string().min(1, 'Status is required'),
  module: z.string().optional(),
  environment: z.string().optional(),
  browser: z.string().optional(),
  device: z.string().optional(),
  projectId: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  expectedResult: z.string().optional(),
  actualResult: z.string().optional(),
  stepsToReproduce: z.array(z.object({ value: z.string() })).optional(),
  acceptanceCriteria: z.array(z.object({ value: z.string() })).optional(),
  testCases: z
    .array(
      z.object({
        title: z.string(),
        steps: z.array(z.object({ value: z.string() })),
        expected: z.string(),
      })
    )
    .optional(),
  labels: z.array(z.string()).optional(),
  timeEstimate: z.object({
    value: z.coerce.number().min(0).optional().nullable(),
    unit: z.enum(['minutes', 'hours', 'days']).optional(),
  }).optional().nullable(),
  completionPercentage: z.coerce.number().min(0).max(100).optional(),
});

function SelectField({ label, name, control, options, required, error }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select
            {...field}
            className={cn(
              'w-full rounded-lg border bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100',
              'px-3 py-2 text-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-400',
              error
                ? 'border-red-400 dark:border-red-600'
                : 'border-gray-300 dark:border-secondary-600'
            )}
          >
            <option value="">Select {label}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function TicketForm({ ticket, onSave, isSaving, members = [] }) {
  const [labelInput, setLabelInput] = useState('');
  const [expandedTestCase, setExpandedTestCase] = useState(null);
  const { data: projects = [] } = useProjects();
  const { data: allUsers = [] } = useUsers();
  const assigneeList = allUsers.length > 0 ? allUsers : members.map((m) => ({ _id: m.userId?._id || m.userId, name: m.userId?.name || 'Unknown' }));

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      summary: '',
      description: '',
      priority: 'Medium',
      severity: 'Major',
      status: 'draft',
      module: '',
      environment: '',
      browser: '',
      device: '',
      projectId: '',
      assignedTo: '',
      dueDate: '',
      expectedResult: '',
      actualResult: '',
      stepsToReproduce: [{ value: '' }],
      acceptanceCriteria: [{ value: '' }],
      testCases: [],
      labels: [],
      timeEstimate: { value: null, unit: 'hours' },
      completionPercentage: 0,
    },
  });

  const { fields: steps, append: appendStep, remove: removeStep } = useFieldArray({ control, name: 'stepsToReproduce' });
  const { fields: criteria, append: appendCriteria, remove: removeCriteria } = useFieldArray({ control, name: 'acceptanceCriteria' });
  const { fields: testCases, append: appendTestCase, remove: removeTestCase } = useFieldArray({ control, name: 'testCases' });
  const labels = watch('labels') || [];

  useEffect(() => {
    if (ticket) {
      reset({
        title: ticket.title || '',
        summary: ticket.summary || '',
        description: ticket.description || '',
        priority: ticket.priority || 'Medium',
        severity: ticket.severity || 'Major',
        status: ticket.status || 'draft',
        module: ticket.module || '',
        environment: ticket.environment || '',
        browser: ticket.browser || '',
        device: ticket.device || '',
        projectId: ticket.projectId?._id || ticket.projectId || '',
        assignedTo: ticket.assignedTo?._id || ticket.assignedTo || '',
        dueDate: ticket.dueDate ? ticket.dueDate.slice(0, 10) : '',
        expectedResult: ticket.expectedResult || '',
        actualResult: ticket.actualResult || '',
        stepsToReproduce: ticket.stepsToReproduce?.length
          ? ticket.stepsToReproduce.map((v) => ({ value: v }))
          : [{ value: '' }],
        acceptanceCriteria: ticket.acceptanceCriteria?.length
          ? ticket.acceptanceCriteria.map((v) => ({ value: v }))
          : [{ value: '' }],
        testCases: ticket.testCases?.map((tc) => ({
          title: tc.title || '',
          steps: tc.steps?.map((s) => ({ value: s })) || [{ value: '' }],
          expected: tc.expected || '',
        })) || [],
        labels: ticket.labels || [],
        timeEstimate: ticket.timeEstimate ?? { value: null, unit: 'hours' },
        completionPercentage: ticket.completionPercentage ?? 0,
      });
    }
  }, [ticket, reset]);

  const handleAddLabel = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && labelInput.trim()) {
      e.preventDefault();
      const newLabel = labelInput.trim().replace(/,$/, '');
      if (newLabel && !labels.includes(newLabel)) {
        setValue('labels', [...labels, newLabel]);
      }
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label) => {
    setValue('labels', labels.filter((l) => l !== label));
  };

  const onSubmit = (data) => {
    const formatted = {
      ...data,
      projectId:  data.projectId  || null,
      assignedTo: data.assignedTo || null,
      dueDate:    data.dueDate    || null,
      stepsToReproduce: data.stepsToReproduce?.map((s) => s.value).filter(Boolean),
      acceptanceCriteria: data.acceptanceCriteria?.map((s) => s.value).filter(Boolean),
      testCases: data.testCases?.map((tc) => ({
        title: tc.title,
        steps: tc.steps?.map((s) => s.value).filter(Boolean),
        expected: tc.expected,
      })),
    };
    onSave?.(formatted);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Basic Info */}
      <div className="space-y-4">
        <Input
          label="Title"
          required
          error={errors.title?.message}
          placeholder="Brief title of the issue"
          {...register('title')}
        />
        <Input
          label="Summary"
          required
          error={errors.summary?.message}
          placeholder="One-line summary"
          {...register('summary')}
        />
        <Input
          label="Description"
          required
          multiline
          rows={4}
          error={errors.description?.message}
          placeholder="Detailed description of the issue"
          {...register('description')}
        />
      </div>

      {/* Priority / Severity / Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectField
          label="Priority"
          name="priority"
          control={control}
          options={PRIORITY_OPTIONS}
          required
          error={errors.priority?.message}
        />
        <SelectField
          label="Severity"
          name="severity"
          control={control}
          options={SEVERITY_OPTIONS}
          required
          error={errors.severity?.message}
        />
        <SelectField
          label="Status"
          name="status"
          control={control}
          options={STATUS_OPTIONS}
          required
          error={errors.status?.message}
        />
      </div>

      {/* Environment details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectField label="Environment" name="environment" control={control} options={ENVIRONMENT_OPTIONS} />
        <SelectField label="Browser" name="browser" control={control} options={BROWSER_OPTIONS} />
        <SelectField label="Device" name="device" control={control} options={DEVICE_OPTIONS} />
      </div>

      {/* Project */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
          <FolderOpen className="w-3.5 h-3.5" /> Project
        </label>
        <Controller
          name="projectId"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-400"
            >
              <option value="">No Project (Personal)</option>
              {projects.map((p) => {
                const pid = p._id || p.id;
                return (
                  <option key={pid} value={pid}>
                    {p.name} · {p.key}
                  </option>
                );
              })}
            </select>
          )}
        />
      </div>

      {/* Assignment + Due Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> Assigned To
          </label>
          <Controller
            name="assignedTo"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-400"
              >
                <option value="">Unassigned</option>
                {assigneeList.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Due Date
          </label>
          <input
            type="date"
            {...register('dueDate')}
            className="w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:border-primary-400"
          />
        </div>
      </div>

      {/* Module */}
      <Input
        label="Module / Component"
        placeholder="e.g. Authentication, Dashboard, API"
        {...register('module')}
      />

      {/* Steps to reproduce */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Steps to Reproduce
        </label>
        <div className="space-y-2">
          {steps.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-start">
              <span className="text-xs text-gray-400 mt-2.5 w-5 shrink-0 text-right">{index + 1}.</span>
              <input
                {...register(`stepsToReproduce.${index}.value`)}
                placeholder={`Step ${index + 1}`}
                className="flex-1 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              />
              <button
                type="button"
                onClick={() => removeStep(index)}
                disabled={steps.length === 1}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => appendStep({ value: '' })}
          className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Step
        </button>
      </div>

      {/* Expected / Actual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Expected Result"
          multiline
          rows={3}
          placeholder="What should happen"
          {...register('expectedResult')}
        />
        <Input
          label="Actual Result"
          multiline
          rows={3}
          placeholder="What actually happens"
          {...register('actualResult')}
        />
      </div>

      {/* Acceptance Criteria */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Acceptance Criteria
        </label>
        <div className="space-y-2">
          {criteria.map((field, index) => (
            <div key={field.id} className="flex gap-2 items-center">
              <span className="text-gray-400 shrink-0">✓</span>
              <input
                {...register(`acceptanceCriteria.${index}.value`)}
                placeholder={`Criteria ${index + 1}`}
                className="flex-1 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              />
              <button
                type="button"
                onClick={() => removeCriteria(index)}
                disabled={criteria.length === 1}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-30 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => appendCriteria({ value: '' })}
          className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Criterion
        </button>
      </div>

      {/* Test Cases */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Test Cases
        </label>
        <div className="space-y-3">
          {testCases.map((tcField, tcIndex) => (
            <div
              key={tcField.id}
              className="border border-gray-200 dark:border-secondary-600 rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-secondary-700 cursor-pointer"
                onClick={() =>
                  setExpandedTestCase(expandedTestCase === tcIndex ? null : tcIndex)
                }
              >
                <input
                  {...register(`testCases.${tcIndex}.title`)}
                  placeholder={`Test Case ${tcIndex + 1} title`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-transparent text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 focus:outline-none placeholder:text-gray-400"
                />
                <div className="flex items-center gap-2 ml-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTestCase(tcIndex); }}
                    className="p-1 rounded text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {expandedTestCase === tcIndex ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
              {expandedTestCase === tcIndex && (
                <div className="p-4 space-y-3">
                  <Input
                    label="Expected Output"
                    placeholder="Expected result for this test case"
                    {...register(`testCases.${tcIndex}.expected`)}
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Steps</p>
                    <TestCaseSteps control={control} register={register} tcIndex={tcIndex} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            appendTestCase({ title: '', steps: [{ value: '' }], expected: '' });
            setExpandedTestCase(testCases.length);
          }}
          className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 flex items-center gap-1 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Test Case
        </button>
      </div>

      {/* Labels */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Labels
        </label>
        <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-secondary-600 rounded-lg bg-white dark:bg-secondary-800 min-h-[42px]">
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-400 text-xs rounded-md font-medium"
            >
              {label}
              <button
                type="button"
                onClick={() => handleRemoveLabel(label)}
                className="hover:text-primary-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={handleAddLabel}
            placeholder={labels.length === 0 ? 'Type and press Enter to add labels' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-900 dark:text-gray-100 focus:outline-none placeholder:text-gray-400"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add a label</p>
      </div>

      {/* Time Estimate */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Time Estimate
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            {...register('timeEstimate.value')}
            placeholder="e.g. 4"
            className="w-28 rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
          />
          <Controller
            name="timeEstimate.unit"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            )}
          />
        </div>
      </div>

      {/* Completion % */}
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Completion — {watch('completionPercentage') ?? 0}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          {...register('completionPercentage')}
          className="w-full accent-primary-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          variant="primary"
          icon={Save}
          loading={isSaving}
          disabled={!isDirty && !!ticket}
        >
          {ticket ? 'Save Changes' : 'Save Ticket'}
        </Button>
      </div>
    </form>
  );
}

function TestCaseSteps({ control, register, tcIndex }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `testCases.${tcIndex}.steps`,
  });

  return (
    <div className="space-y-2">
      {fields.map((field, idx) => (
        <div key={field.id} className="flex gap-2 items-center">
          <span className="text-xs text-gray-400 w-4 text-right shrink-0">{idx + 1}.</span>
          <input
            {...register(`testCases.${tcIndex}.steps.${idx}.value`)}
            placeholder={`Step ${idx + 1}`}
            className="flex-1 rounded border border-gray-200 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            disabled={fields.length === 1}
            className="p-1 rounded text-gray-400 hover:text-red-500 disabled:opacity-30"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ value: '' })}
        className="text-xs text-primary-600 dark:text-primary-400 flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Add step
      </button>
    </div>
  );
}
