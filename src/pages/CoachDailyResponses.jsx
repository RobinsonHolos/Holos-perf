import React, { useMemo } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardList, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const today = format(new Date(), 'yyyy-MM-dd');

function resolveResponseValue(value, question) {
  if (value === undefined || value === null) return '—';
  if (question.type === 'select') {
    const choices = question.selectOptions?.choices || [];
    const arr = Array.isArray(value) ? value : [value];
    const labels = arr.map(v => {
      const i = parseInt(v, 10);
      if (!isNaN(i) && choices[i] !== undefined) return choices[i].label ?? v;
      return v;
    });
    return labels.join(', ');
  }
  if (question.type === 'scale') {
    const min = question.scaleOptions?.min ?? 0;
    const max = question.scaleOptions?.max ?? 100;
    return `${value}`;
  }
  if (question.type === 'textarea' || question.type === 'text') {
    const str = String(value);
    return str.length > 40 ? str.slice(0, 38) + '…' : str;
  }
  return String(value);
}

function ScaleCell({ value, question }) {
  if (value === undefined || value === null) return <span className="text-slate-300">—</span>;
  const min = question.scaleOptions?.min ?? 0;
  const max = question.scaleOptions?.max ?? 100;
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 50;
  const color = question.scaleOptions?.color || '#6366f1';
  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px]">
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ResponseTable({ template, athletes, responses }) {
  const questions = template.questions || [];
  if (questions.length === 0) return null;

  const responseByEmail = {};
  responses.forEach(r => {
    if (r.template_id === template.id) responseByEmail[r.athlete_email] = r;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full min-w-max text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left font-semibold text-slate-700 px-4 py-3 border-b border-slate-200 sticky left-0 bg-slate-50 min-w-[140px] z-10">
              Athlète
            </th>
            {questions.map(q => (
              <th
                key={q.id}
                className="text-center font-medium text-slate-600 px-3 py-3 border-b border-slate-200 whitespace-nowrap max-w-[120px]"
                title={q.label}
              >
                <span className="block truncate max-w-[110px]">
                  {q.athleteLabel || q.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {athletes.map((athlete, i) => {
            const response = responseByEmail[athlete.email];
            return (
              <tr
                key={athlete.email}
                className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
              >
                <td className="px-4 py-3 border-b border-slate-100 sticky left-0 bg-inherit z-10">
                  <span className="font-medium text-slate-800 whitespace-nowrap">
                    {athlete.name}
                  </span>
                  {!response && (
                    <Badge variant="outline" className="ml-2 text-xs text-slate-400 border-slate-200">
                      Pas répondu
                    </Badge>
                  )}
                </td>
                {questions.map(q => (
                  <td key={q.id} className="px-3 py-3 border-b border-slate-100 text-center">
                    {response ? (
                      q.type === 'scale' ? (
                        <ScaleCell value={response.responses?.[q.id]} question={q} />
                      ) : (
                        <span className="text-slate-700">
                          {resolveResponseValue(response.responses?.[q.id], q)}
                        </span>
                      )
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CoachDailyResponses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const { data: clubData, isLoading: loadingClub } = useQuery({
    queryKey: ['coach-club-group-responses', user?.email, isIndividualView],
    queryFn: async () => {
      const [clubs, groups] = await Promise.all([
        base44.entities.Club.list(),
        base44.entities.Group.list()
      ]);
      const club = isIndividualView ? null : clubs.find(c => (c.coach_emails || []).includes(user.email));
      const coachGroups = groups.filter(g => g.coach_email === user.email);
      return { club, coachGroups };
    },
    enabled: !!user
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['club-teams-responses', clubData?.club?.id],
    queryFn: () => base44.entities.Team.filter({ club_id: clubData.club.id }),
    enabled: !!clubData?.club?.id
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-responses'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  const { data: allTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['active-templates-responses'],
    queryFn: async () => {
      const templates = await base44.entities.QuestionnaireTemplate.list();
      return templates.filter(t => t.is_active);
    },
    enabled: !!user
  });

  const { data: todayResponses = [], isLoading: loadingResponses } = useQuery({
    queryKey: ['today-responses-view', today],
    queryFn: async () => {
      const all = await base44.entities.QuestionnaireResponse.list();
      return all.filter(r => r.submitted_date?.startsWith(today));
    },
    enabled: !!user
  });

  // Tous les emails d'athlètes du coach
  const allAthleteEmails = useMemo(() => {
    if (!clubData) return new Set();
    const { club, coachGroups } = clubData;
    const emails = new Set();
    if (club && !isIndividualView) {
      (club.athlete_emails || []).forEach(e => emails.add(e));
    }
    coachGroups.forEach(g => (g.athlete_emails || []).forEach(e => emails.add(e)));
    return emails;
  }, [clubData, isIndividualView]);

  // Regrouper les templates par athlètes du coach
  const templateGroups = useMemo(() => {
    const result = [];
    allTemplates.forEach(template => {
      const assigned = (template.assigned_athletes || []).filter(e => allAthleteEmails.has(e));
      if (assigned.length === 0) return;
      const athletes = assigned.map(email => {
        const u = allUsers.find(u => u.email === email);
        return { email, name: u?.full_name || email };
      }).sort((a, b) => a.name.localeCompare(b.name));
      result.push({ template, athletes });
    });
    return result;
  }, [allTemplates, allAthleteEmails, allUsers]);

  const isLoading = loadingClub || loadingTemplates || loadingResponses;

  if (!user) return null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Réponses du jour</h1>
              <p className="text-slate-500 text-sm capitalize">
                {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <ClipboardList className="w-8 h-8 animate-pulse text-slate-300" />
          </div>
        ) : templateGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Aucun questionnaire assigné à vos athlètes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {templateGroups.map(({ template, athletes }, i) => {
              const respondedCount = athletes.filter(a =>
                todayResponses.some(r => r.athlete_email === a.email && r.template_id === template.id)
              ).length;

              return (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800">{template.name}</h2>
                      {template.description && (
                        <p className="text-sm text-slate-500">{template.description}</p>
                      )}
                    </div>
                    <Badge
                      className={`${
                        respondedCount === athletes.length
                          ? 'bg-green-100 text-green-700'
                          : respondedCount === 0
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-orange-100 text-orange-700'
                      } border-0`}
                    >
                      {respondedCount}/{athletes.length} réponses
                    </Badge>
                  </div>
                  <ResponseTable
                    template={template}
                    athletes={athletes}
                    responses={todayResponses}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
