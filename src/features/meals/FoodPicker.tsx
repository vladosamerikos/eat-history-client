import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { Search, X } from 'lucide-react';
import { listFoods, type Food } from '@/features/foods/foods.api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (food: Food) => void;
}

/**
 * Selector de comidas optimizado para móvil: bottom-sheet con búsqueda
 * fuzzy provista por cmdk. Carga la lista al abrir y filtra en cliente.
 */
export function FoodPicker({ open, onClose, onSelect }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const { data: foods = [], isLoading } = useQuery<Food[]>({
    queryKey: ['foods', 'picker', q],
    queryFn: () => listFoods(q || undefined),
    enabled: open,
  });

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">
                {t('meals.picker.title') ?? 'Elegir comida'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label={t('common.close') ?? 'Cerrar'}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <Command shouldFilter={false} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder={t('meals.picker.search') ?? 'Buscar comida…'}
                  className="h-12 flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
              <Command.List className="flex-1 overflow-y-auto px-1 py-1">
                {isLoading ? (
                  <Command.Loading>
                    <p className="px-3 py-4 text-xs text-muted-foreground">
                      {t('common.loading') ?? 'Cargando…'}
                    </p>
                  </Command.Loading>
                ) : foods.length === 0 ? (
                  <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {t('common.empty') ?? 'Sin resultados'}
                  </Command.Empty>
                ) : (
                  foods.map((f) => (
                    <Command.Item
                      key={f._id}
                      value={`${f.name} ${f._id}`}
                      onSelect={() => {
                        onSelect(f);
                        onClose();
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm aria-selected:bg-muted"
                    >
                      {f.imageUrl ? (
                        <img
                          src={f.imageUrl}
                          alt=""
                          className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-muted text-base">
                          🥗
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {Math.round(f.nutritionPer100.kcal)} kcal/100g · P
                          {Math.round(f.nutritionPer100.protein)} · C
                          {Math.round(f.nutritionPer100.carbs)} · G
                          {Math.round(f.nutritionPer100.fat)}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-[10px] uppercase text-muted-foreground">
                        {f.defaultPortionG ?? 100}g
                      </span>
                    </Command.Item>
                  ))
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
