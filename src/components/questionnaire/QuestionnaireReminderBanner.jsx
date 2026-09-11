import React from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Rappel in-app : bandeau invitant l'athlète à remplir son/ses questionnaire(s)
 * en attente. Purement présentationnel — n'affiche rien si count vaut 0.
 */
export default function QuestionnaireReminderBanner({ count = 0, onFill }) {
  if (!count) return null;
  const plural = count > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-8"
    >
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Bell className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">
            {plural ? `${count} questionnaires à remplir` : 'Un questionnaire à remplir'}
          </p>
          <p className="text-sm text-amber-700 mt-0.5">
            Pense à {plural ? 'les' : 'le'} compléter pour le suivi de tes séances.
          </p>
        </div>
        <Button
          onClick={onFill}
          className="bg-amber-500 hover:bg-amber-600 text-white gap-2 shrink-0"
        >
          <Bell className="w-4 h-4" />
          Remplir maintenant
        </Button>
      </div>
    </motion.div>
  );
}
