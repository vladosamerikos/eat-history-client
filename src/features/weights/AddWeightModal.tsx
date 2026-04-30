import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bluetooth, Camera, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
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
  const fileRef = useRef<HTMLInputElement | null>(null);
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
          weight.bodyFat ?? weight.muscle ?? weight.water ?? weight.bone ?? weight.visceralFat ?? weight.bmr,
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

  // Desconectamos la báscula cuando el modal se cierra para no mantener BLE activo.
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-background shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-base font-semibold">
            {isEdit ? t('weight.editTitle') : t('weight.addTitle')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label={t('common.close') ?? 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-1 text-xs">
                <span className="text-muted-foreground">{t('weight.date')}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="col-span-1 text-xs">
                <span className="text-muted-foreground">{t('weight.time')}</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <label className="col-span-1 text-xs">
                <span className="text-muted-foreground">{t('weight.kg')}</span>
                <input
                  inputMode="decimal"
                  autoFocus
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  placeholder="70.5"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
            </div>

            {ble.supported && (
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Bluetooth className="h-4 w-4 flex-shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {ble.deviceName ?? t('weight.ble.title')}
                      </p>
                      <p className="text-[11px] leading-tight text-muted-foreground">
                        {ble.status === 'idle' && t('weight.ble.idle')}
                        {ble.status === 'requesting' && t('weight.ble.requesting')}
                        {ble.status === 'connecting' && t('weight.ble.connecting')}
                        {ble.status === 'reading' && (
                          ble.lastMeasurement
                            ? t('weight.ble.reading', { kg: ble.lastMeasurement.kg.toFixed(2) })
                            : t('weight.ble.standOnScale')
                        )}
                        {ble.status === 'stable' && ble.lastMeasurement && (
                          t('weight.ble.stable', { kg: ble.lastMeasurement.kg.toFixed(2) })
                        )}
                        {ble.status === 'connected' && ble.lastMeasurement && (
                          t('weight.ble.stable', { kg: ble.lastMeasurement.kg.toFixed(2) })
                        )}
                        {ble.status === 'error' && (ble.error ?? t('common.errorGeneric'))}
                      </p>
                    </div>
                  </div>
                  {ble.status === 'idle' || ble.status === 'error' || ble.status === 'stable' ? (
                    <button
                      type="button"
                      onClick={() => ble.connect()}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                    >
                      <Bluetooth className="h-3.5 w-3.5" />{' '}
                      {ble.status === 'stable' ? t('weight.ble.remeasure') : t('weight.ble.connect')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => ble.disconnect()}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      {ble.status === 'requesting' || ble.status === 'connecting' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      {t('weight.ble.disconnect')}
                    </button>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
            >
              <span>{t('weight.bodyComp')}</span>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-3 gap-2">
                <NumField label={t('weight.bodyFat')} suffix="%" value={bodyFat} onChange={setBodyFat} />
                <NumField label={t('weight.muscle')} suffix="%" value={muscle} onChange={setMuscle} />
                <NumField label={t('weight.water')} suffix="%" value={water} onChange={setWater} />
                <NumField label={t('weight.bone')} suffix="kg" value={bone} onChange={setBone} />
                <NumField label={t('weight.visceralFat')} value={visceralFat} onChange={setVisceralFat} />
                <NumField label="BMR" suffix="kcal" value={bmr} onChange={setBmr} />
              </div>
            )}

            <label className="text-xs">
              <span className="text-muted-foreground">{t('common.notes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>

            <div>
              <span className="text-xs text-muted-foreground">{t('weight.photo')}</span>
              <div className="mt-1 flex items-center gap-2">
                {pendingPhotoPreview ? (
                  <div className="relative">
                    <img src={pendingPhotoPreview} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPhoto(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                      aria-label={t('common.delete')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : existingPhotoUrl && !photoExplicitlyRemoved ? (
                  <div className="relative">
                    <img src={existingPhotoUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotoExplicitlyRemoved(true)}
                      className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                      aria-label={t('common.delete')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="grid h-20 w-20 place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted"
                  >
                    <Camera className="h-5 w-5" />
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPendingPhoto(f);
                      setPhotoExplicitlyRemoved(false);
                    }
                  }}
                />
                <p className="flex-1 text-xs text-muted-foreground">{t('weight.photoHint')}</p>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface NumFieldProps {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}

function NumField({ label, suffix, value, onChange }: NumFieldProps) {
  return (
    <label className="text-xs">
      <span className="text-muted-foreground">{label}{suffix ? ` (${suffix})` : ''}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
      />
    </label>
  );
}
