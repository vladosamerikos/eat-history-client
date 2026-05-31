import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bluetooth, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { MSIcon } from '@/components/ui/MSIcon';
import { MacroInputRow } from '@/components/ui/MacroInputRow';
import { PhotoCard } from '@/components/ui/PhotoCard';
import { PhotoSourceSheet } from '@/components/ui/PhotoSourceSheet';
import {
  createWeight,
  removeWeightPhoto,
  updateWeight,
  uploadWeightPhoto,
  type Weight,
} from './weights.api';
import { useMiScale } from './useMiScale';

interface AddWeightModalProps {
  open: boolean;
  onClose: () => void;
  weight?: Weight | null;
  defaultDate?: string;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function AddWeightModal({ open, onClose, weight, defaultDate }: AddWeightModalProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isEdit = Boolean(weight);

  const [date, setDate] = useState<string>(defaultDate ?? todayISO());
  const [time, setTime] = useState<string>(nowHHMM());
  const [kg, setKg] = useState<string>('');
  const [bodyFat, setBodyFat] = useState<string>('');
  const [muscle, setMuscle] = useState<string>('');
  const [water, setWater] = useState<string>('');
  const [bone, setBone] = useState<string>('');
  const [visceralFat, setVisceralFat] = useState<string>('');
  const [bmr, setBmr] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoExplicitlyRemoved, setPhotoExplicitlyRemoved] = useState(false);
  const [usedBle, setUsedBle] = useState(false);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const ble = useMiScale({
    onStable: (m) => {
      setKg(m.kg.toFixed(2));
      setUsedBle(true);
      setTime(nowHHMM());
      toast.success(t('weight.ble.captured', { kg: m.kg.toFixed(2) }));
    },
  });

  useEffect(() => {
    if (!open) return;
    if (weight) {
      setDate(weight.date);
      setTime(weight.time ?? '');
      setKg(String(weight.kg));
      setBodyFat(weight.bodyFat != null ? String(weight.bodyFat) : '');
      setMuscle(weight.muscle != null ? String(weight.muscle) : '');
      setWater(weight.water != null ? String(weight.water) : '');
      setBone(weight.bone != null ? String(weight.bone) : '');
      setVisceralFat(weight.visceralFat != null ? String(weight.visceralFat) : '');
      setBmr(weight.bmr != null ? String(weight.bmr) : '');
      setNotes(weight.notes ?? '');
      setExistingPhotoUrl(weight.photoUrl ?? null);
      setShowAdvanced(
        Boolean(
          weight.bodyFat ??
          weight.muscle ??
          weight.water ??
          weight.bone ??
          weight.visceralFat ??
          weight.bmr,
        ),
      );
    } else {
      setDate(defaultDate ?? todayISO());
      setTime(nowHHMM());
      setKg('');
      setBodyFat('');
      setMuscle('');
      setWater('');
      setBone('');
      setVisceralFat('');
      setBmr('');
      setNotes('');
      setExistingPhotoUrl(null);
      setShowAdvanced(false);
    }
    setError(null);
    setPendingPhoto(null);
    setPendingPhotoPreview(null);
    setPhotoExplicitlyRemoved(false);
    setUsedBle(false);
  }, [open, weight, defaultDate]);

  useEffect(() => {
    if (!open) ble.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!pendingPhoto) {
      setPendingPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingPhoto);
    setPendingPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingPhoto]);

  const previewPhoto = pendingPhotoPreview ?? (photoExplicitlyRemoved ? null : existingPhotoUrl);

  const save = useMutation({
    mutationFn: async () => {
      const kgNum = num(kg);
      if (!(kgNum > 0)) throw new Error(t('weight.errors.kgRequired') ?? 'Weight required');
      const body = {
        date,
        time: time || undefined,
        kg: kgNum,
        bodyFat: bodyFat ? num(bodyFat) : undefined,
        muscle: muscle ? num(muscle) : undefined,
        water: water ? num(water) : undefined,
        bone: bone ? num(bone) : undefined,
        visceralFat: visceralFat ? num(visceralFat) : undefined,
        bmr: bmr ? num(bmr) : undefined,
        notes: notes.trim() || undefined,
        source: usedBle
          ? ('ble-mi-scale' as const)
          : pendingPhoto
            ? ('scale-photo' as const)
            : ('manual' as const),
      };
      let saved: Weight;
      if (isEdit && weight) {
        saved = await updateWeight(weight._id, body);
      } else {
        saved = await createWeight(body);
      }
      if (pendingPhoto) {
        saved = await uploadWeightPhoto(saved._id, pendingPhoto);
      } else if (isEdit && photoExplicitlyRemoved && weight?.photoUrl) {
        saved = await removeWeightPhoto(saved._id);
      }
      return saved;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['weights'] });
      qc.invalidateQueries({ queryKey: ['weight-latest'] });
      toast.success(t('common.saved'));
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : t('common.errorGeneric');
      setError(msg);
      toast.error(msg);
    },
  });

  if (!open) return null;

  const bleStatusText = (() => {
    switch (ble.status) {
      case 'idle':
        return t('weight.ble.idle');
      case 'requesting':
        return t('weight.ble.requesting');
      case 'connecting':
        return t('weight.ble.connecting');
      case 'reading':
        return ble.lastMeasurement
          ? t('weight.ble.reading', { kg: ble.lastMeasurement.kg.toFixed(2) })
          : t('weight.ble.standOnScale');
      case 'stable':
      case 'connected':
        return ble.lastMeasurement
          ? t('weight.ble.stable', { kg: ble.lastMeasurement.kg.toFixed(2) })
          : null;
      case 'error':
        return ble.error ?? t('common.errorGeneric');
      default:
        return null;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-surface/95 px-5 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full border border-surface-variant bg-surface-container text-on-surface-variant transition-colors hover:text-primary"
            aria-label={t('common.close') ?? 'Close'}
          >
            <X className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-on-background">
            {isEdit ? t('weight.editTitle') : t('weight.addTitle')}
          </h1>
          <div className="w-10" />
        </header>

        {/* Scrollable body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-32">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Hero kg input */}
          <div className="flex items-center gap-3 rounded-xl border border-surface-variant/30 bg-surface-container-low/50 p-4">
            <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary/10">
              <MSIcon name="scale" size={28} className="text-primary" />
            </span>
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <input
                inputMode="decimal"
                autoFocus
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="0"
                className="no-spin w-full min-w-0 flex-1 bg-transparent text-[34px] font-bold leading-none tabular-nums text-on-background placeholder:text-on-surface-variant/40 focus:outline-none"
              />
              <span className="text-xs font-medium text-on-surface-variant">kg</span>
            </div>
          </div>

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-surface-variant bg-surface-container-low p-4">
            <label className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t('weight.date')}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 rounded-lg border border-surface-variant bg-surface-container px-3 text-sm text-on-background focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {t('weight.time')}
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-10 rounded-lg border border-surface-variant bg-surface-container px-3 text-sm text-on-background focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          {/* BLE scale */}
          {ble.supported && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-variant bg-surface-container-low p-3">
              <div className="flex min-w-0 items-center gap-2">
                <Bluetooth className="h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-on-background">
                    {ble.deviceName ?? t('weight.ble.title')}
                  </p>
                  {bleStatusText && (
                    <p className="text-[11px] leading-tight text-on-surface-variant">
                      {bleStatusText}
                    </p>
                  )}
                </div>
              </div>
              {ble.status === 'idle' || ble.status === 'error' || ble.status === 'stable' ? (
                <button
                  type="button"
                  onClick={() => ble.connect()}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Bluetooth className="h-3.5 w-3.5" />
                  {ble.status === 'stable' ? t('weight.ble.remeasure') : t('weight.ble.connect')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => ble.disconnect()}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-surface-variant bg-surface-container px-3 py-1.5 text-xs"
                >
                  {(ble.status === 'requesting' || ble.status === 'connecting') && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {t('weight.ble.disconnect')}
                </button>
              )}
            </div>
          )}

          {/* Photo */}
          <PhotoCard
            previewUrl={previewPhoto}
            onPick={() => setPhotoSheetOpen(true)}
            onRemove={() => {
              setPendingPhoto(null);
              setPhotoExplicitlyRemoved(true);
            }}
            emptyIcon={<MSIcon name="photo_camera" size={22} className="text-primary" />}
            emptyLabel={t('weight.photo') ?? 'Foto'}
          />

          {/* Body composition (advanced) */}
          <div className="space-y-3 rounded-xl border border-surface-variant bg-surface-container-low p-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
            >
              <span>{t('weight.bodyComp')}</span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-3">
                <MacroInputRow
                  msIcon="percent"
                  iconClass="text-amber-400"
                  label={t('weight.bodyFat')}
                  unit="%"
                  step={0.1}
                  value={bodyFat}
                  onChange={setBodyFat}
                />
                <MacroInputRow
                  msIcon="fitness_center"
                  iconClass="text-primary"
                  label={t('weight.muscle')}
                  unit="%"
                  step={0.1}
                  value={muscle}
                  onChange={setMuscle}
                />
                <MacroInputRow
                  msIcon="water_drop"
                  iconClass="text-sky-400"
                  label={t('weight.water')}
                  unit="%"
                  step={0.1}
                  value={water}
                  onChange={setWater}
                />
                <MacroInputRow
                  msIcon="skeleton"
                  iconClass="text-on-surface-variant"
                  label={t('weight.bone')}
                  unit="kg"
                  step={0.1}
                  value={bone}
                  onChange={setBone}
                />
                <MacroInputRow
                  msIcon="blur_on"
                  iconClass="text-rose-400"
                  label={t('weight.visceralFat')}
                  unit=""
                  step={1}
                  value={visceralFat}
                  onChange={setVisceralFat}
                />
                <MacroInputRow
                  msIcon="local_fire_department"
                  iconClass="text-primary"
                  label="BMR"
                  unit="kcal"
                  step={10}
                  value={bmr}
                  onChange={setBmr}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <label className="flex flex-col gap-2 rounded-xl border border-surface-variant bg-surface-container-low p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {t('common.notes')}
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-surface-variant bg-surface-container px-3 py-2 text-sm text-on-background focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        {/* Sticky footer */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-surface-variant bg-surface/95 px-5 py-4 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-shrink-0 rounded-full px-5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="btn-press h-12 flex-grow rounded-full bg-primary-container text-sm font-bold text-on-primary-container shadow-lg disabled:opacity-50"
          >
            {save.isPending ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </motion.div>

      <PhotoSourceSheet
        open={photoSheetOpen}
        onClose={() => setPhotoSheetOpen(false)}
        onFile={(f) => {
          setPendingPhoto(f);
          setPhotoExplicitlyRemoved(false);
        }}
      />
    </div>
  );
}
