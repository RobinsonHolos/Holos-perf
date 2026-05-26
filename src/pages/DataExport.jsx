import React, { useState } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, FileDown, Calendar, User as UserIcon, ArrowLeft } from 'lucide-react';
import { format, parseISO, getWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

export default function DataExport() {
  // ── Utiliser useAuth() au lieu de recharger l'utilisateur ─────────────────
  const { user, isAdmin, isCoach } = useAuth();

  const [selectedAthlete, setSelectedAthlete] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: isCoach && !!user?.email,
  });

  const { data: allLogs = [] } = useQuery({
    queryKey: ['all-logs-export'],
    queryFn: () => base44.entities.TrainingLog.list('-training_date', 5000),
    enabled: !!user
  });

  const { data: allResponses = [] } = useQuery({
    queryKey: ['all-responses-export'],
    queryFn: () => base44.entities.QuestionnaireResponse.list('-submitted_date', 5000),
    enabled: !!user
  });

  const { data: allTemplates = [] } = useQuery({
    queryKey: ['all-templates-export'],
    queryFn: () => base44.entities.QuestionnaireTemplate.list(),
    enabled: !!user
  });

  const userFilteredLogs = (() => {
    if (isAdmin) return allLogs;
    if (isCoach && coachGroup) return allLogs.filter(log => coachGroup.athlete_emails.includes(log.athlete_email));
    return allLogs;
  })();

  const userFilteredResponses = (() => {
    if (isAdmin) return allResponses;
    if (isCoach && coachGroup) return allResponses.filter(resp => coachGroup.athlete_emails.includes(resp.athlete_email));
    return allResponses;
  })();

  const allAthleteEmails = new Set([
    ...userFilteredLogs.map(log => log.athlete_email),
    ...userFilteredResponses.map(resp => resp.athlete_email)
  ]);
  
  const athletes = [...allAthleteEmails].map(email => {
    const log = userFilteredLogs.find(l => l.athlete_email === email);
    const response = userFilteredResponses.find(r => r.athlete_email === email);
    return { email, name: log?.athlete_name || response?.athlete_name || email };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const filterData = () => {
    let filteredLogs = [...userFilteredLogs];
    let filteredResponses = [...userFilteredResponses];

    if (selectedAthlete !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.athlete_email === selectedAthlete);
      filteredResponses = filteredResponses.filter(resp => resp.athlete_email === selectedAthlete);
    }
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => log.training_date >= startDate);
      filteredResponses = filteredResponses.filter(resp => format(new Date(resp.submitted_date), 'yyyy-MM-dd') >= startDate);
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => log.training_date <= endDate);
      filteredResponses = filteredResponses.filter(resp => format(new Date(resp.submitted_date), 'yyyy-MM-dd') <= endDate);
    }

    return {
      logs: filteredLogs.sort((a, b) => new Date(b.training_date) - new Date(a.training_date)),
      responses: filteredResponses.sort((a, b) => new Date(b.submitted_date) - new Date(a.submitted_date))
    };
  };

  const exportToCSV = () => {
    const { logs, responses } = filterData();
    if (logs.length === 0 && responses.length === 0) { alert('Aucune donnée à exporter'); return; }

    const templateIds = new Set(responses.map(resp => resp.template_id).filter(Boolean));
    const allQuestionIds = new Set();
    const questionIdToLabel = {};
    allTemplates.forEach(template => {
      if (templateIds.has(template.id) && Array.isArray(template.questions)) {
        template.questions.forEach(q => {
          if (q.id) { allQuestionIds.add(q.id); questionIdToLabel[q.id] = q.athleteLabel || q.label || q.id; }
        });
      }
    });

    const questionLabels = Array.from(allQuestionIds).map(id => questionIdToLabel[id] || id);
    const baseHeaders = ['Date', 'Athlète', 'Email', 'Année', 'Mois', 'Semaine', 'Jour', 'Source'];
    const trainingLogHeaders = ['Type de séance', 'Durée (min)', 'Fatigue', 'Intensité', 'Sommeil', 'Plaisir', 'Harmonie proches', 'Maîtrise technique', 'Maîtrise tactique', 'Épanouissement', 'Commentaire'];
    const headers = [...baseHeaders, ...(logs.length > 0 ? trainingLogHeaders : []), ...questionLabels];

    const dayLabels = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

    const logRows = logs.map(log => {
      const date = parseISO(log.training_date);
      return [
        format(date, 'dd/MM/yyyy', { locale: fr }), log.athlete_name || '', log.athlete_email || '',
        format(date, 'yyyy'), format(date, 'yyMM'), `${format(date, 'yy')}${getWeek(date, { locale: fr }).toString().padStart(2, '0')}`,
        `${getDay(date) === 0 ? 7 : getDay(date)}${dayLabels[getDay(date)]}`, 'TrainingLog',
        log.session_type || '', log.duration_minutes || '', log.fatigue || '', log.intensite || '',
        log.sommeil || '', log.plaisir || '', log.harmonie_proches || '', log.maitrise_technique || '',
        log.maitrise_tactique || '', log.epanouissement || '', (log.commentaire || '').replace(/"/g, '""'),
        ...Array.from(allQuestionIds).map(() => '')
      ];
    });

    const responseRows = responses.map(resp => {
      const date = new Date(resp.submitted_date);
      return [
        format(date, 'dd/MM/yyyy', { locale: fr }), resp.athlete_name || '', resp.athlete_email || '',
        format(date, 'yyyy'), format(date, 'yyMM'), `${format(date, 'yy')}${getWeek(date, { locale: fr }).toString().padStart(2, '0')}`,
        `${getDay(date) === 0 ? 7 : getDay(date)}${dayLabels[getDay(date)]}`, 'Questionnaire',
        ...(logs.length > 0 ? ['', '', '', '', '', '', '', '', '', '', ''] : []),
        ...Array.from(allQuestionIds).map(questionId => {
          const value = resp.responses?.[questionId];
          return value !== undefined ? String(value).replace(/"/g, '""') : '';
        })
      ];
    });

    const allRows = [...logRows, ...responseRows].sort((a, b) => b[0].split('/').reverse().join('').localeCompare(a[0].split('/').reverse().join('')));
    const csvContent = [headers.join(','), ...allRows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `donnees_${selectedAthlete === 'all' ? 'tous_athletes' : athletes.find(a => a.email === selectedAthlete)?.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const { logs, responses } = filterData();
    if (logs.length === 0 && responses.length === 0) { alert('Aucune donnée à exporter'); return; }
    const blob = new Blob([JSON.stringify({ training_logs: logs, questionnaire_responses: responses }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `donnees_${format(new Date(), 'yyyyMMdd')}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) return null;

  const { logs, responses } = filterData();
  const filteredCount = logs.length + responses.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link to={createPageUrl('AdminHome')}>
              <Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" />Accueil</Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Export des données</h1>
          <p className="text-slate-500">Téléchargez les données d'entraînement et les réponses aux questionnaires</p>
        </div>

        <Card className="shadow-sm border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileDown className="w-5 h-5" />Configuration de l'export</CardTitle>
            <CardDescription>Sélectionnez les données à exporter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><UserIcon className="w-4 h-4" />Athlète</Label>
              <Select value={selectedAthlete} onValueChange={setSelectedAthlete}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un athlète" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les athlètes</SelectItem>
                  {athletes.map(athlete => <SelectItem key={athlete.email} value={athlete.email}>{athlete.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" />Période</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Date de début</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Date de fin</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Format d'export</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800"><span className="font-semibold">{filteredCount}</span> entrée{filteredCount !== 1 ? 's' : ''} à exporter</p>
            </div>
            <Button onClick={exportFormat === 'csv' ? exportToCSV : exportToJSON} className="w-full bg-slate-800 hover:bg-slate-700 gap-2" size="lg" disabled={filteredCount === 0}>
              <Download className="w-5 h-5" />
              Télécharger ({exportFormat.toUpperCase()})
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
