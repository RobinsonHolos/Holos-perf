import React, { useState, useEffect } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AthleteDataChart from '../components/dashboard/AthleteDataChart';
import HistogramChart from '../components/dashboard/HistogramChart';
import MetricSelector from '../components/dashboard/MetricSelector';
import StatCard from '../components/dashboard/StatCard';
import { 
  Activity, TrendingUp, Calendar, RefreshCw, ArrowLeft, Zap
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';


const sessionTypeLabels = {
  entrainement: 'Entraînement',
  competition: 'Compétition',
  effort_type: 'Effort type',
  off: 'Off'
};

const sessionTypeColors = {
  entrainement: 'bg-blue-100 text-blue-700',
  competition: 'bg-amber-100 text-amber-700',
  effort_type: 'bg-purple-100 text-purple-700',
  off: 'bg-slate-100 text-slate-600'
};

// Palette de couleurs moderne et contrastée
const defaultColors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
  '#f43f5e', '#a855f7', '#84cc16', '#6366f1',
  '#fb923c', '#34d399', '#60a5fa', '#f87171'
];

const getDefaultDates = () => {
  const today = new Date();
  const dow = today.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - daysFromMon);
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
  const startOfPrevWeek = new Date(startOfThisWeek);
  startOfPrevWeek.setDate(startOfThisWeek.getDate() - 7);
  return {
    start: format(startOfPrevWeek, 'yyyy-MM-dd'),
    end: format(endOfThisWeek, 'yyyy-MM-dd'),
  };
};

export default function PersonalDashboard() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => getDefaultDates().start);
  const [endDate, setEndDate] = useState(() => getDefaultDates().end);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [sessionTypeFilters, setSessionTypeFilters] = useState([]);
  const [metricLabels, setMetricLabels] = useState({});
  const [metricColors, setMetricColors] = useState({});
  const [dynamicSessionTypes, setDynamicSessionTypes] = useState({ labels: {}, colors: {} });

  // Charger les questionnaires assignés à l'utilisateur
  const { data: assignedQuestionnaires = [] } = useQuery({
    queryKey: ['assigned-questionnaires', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allTemplates = await base44.entities.QuestionnaireTemplate.list();
      return allTemplates.filter(t => 
        t.is_active && 
        t.assigned_athletes && 
        t.assigned_athletes.includes(user.email)
      );
    },
    enabled: !!user,
  });

  // Construire dynamiquement les métriques et types de séance à partir du questionnaire assigné
  useEffect(() => {
    if (assignedQuestionnaires.length > 0) {
      const primaryQuestionnaire = assignedQuestionnaires[0];
      const questions = primaryQuestionnaire.questions || [];
      
      // Types de séance dynamiques depuis la première question select
      const firstQuestion = questions[0];
      if (firstQuestion?.type === 'select') {
        const defaultSessionTypeColors = [
          'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700',
          'bg-purple-100 text-purple-700', 'bg-slate-100 text-slate-600',
          'bg-green-100 text-green-700', 'bg-rose-100 text-rose-700',
        ];
        const choices = firstQuestion.selectOptions?.choices || [];
        const labels = {};
        const colors = {};
        choices.forEach((choice, index) => {
          labels[choice.label] = choice.label;
          colors[choice.label] = defaultSessionTypeColors[index % defaultSessionTypeColors.length];
        });
        setDynamicSessionTypes({ labels, colors });
        setSessionTypeFilters(Object.keys(labels));
      }

      // Extraire les questions de type numérique/scale
      const numericQuestions = questions.filter(q => 
        q.type === 'scale' || q.type === 'number'
      );

      const labels = {};
      const colors = {};
      const metricKeys = [];

      numericQuestions.forEach((question, index) => {
        const key = question.id;
        const label = (question.athleteLabel || question.label || '').toLowerCase();
        labels[key] = question.athleteLabel || question.label;
        
        let color = question.scaleOptions?.color;
        if (!color || color === '#ffffff' || color === '#000000') {
          if (label.includes('fatigue')) color = '#ef4444';
          else if (label.includes('intensit')) color = '#f59e0b';
          else if (label.includes('sommeil')) color = '#8b5cf6';
          else if (label.includes('plaisir')) color = '#10b981';
          else if (label.includes('harmonie') || label.includes('proches')) color = '#06b6d4';
          else if (label.includes('technique')) color = '#3b82f6';
          else if (label.includes('tactique')) color = '#6366f1';
          else if (label.includes('épanouissement') || label.includes('epanouissement')) color = '#ec4899';
          else if (label.includes('dynamisme')) color = '#84cc16';
          else if (label.includes('estime')) color = '#a855f7';
          else if (label.includes('cardiovasculaire')) color = '#f43f5e';
          else if (label.includes('musculaire')) color = '#fb923c';
          else color = defaultColors[index % defaultColors.length];
        }
        colors[key] = color;
        metricKeys.push(key);
      });

      setMetricLabels(labels);
      setMetricColors(colors);
      
      if (selectedMetrics.length === 0) {
        setSelectedMetrics(metricKeys.slice(0, Math.min(4, metricKeys.length)));
      }
    }
  }, [assignedQuestionnaires]);

  // Charger les réponses aux questionnaires de l'utilisateur actuel
  const { data: allQuestionnaireResponses = [], isLoading, refetch } = useQuery({
    queryKey: ['my-responses', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const responses = await base44.entities.QuestionnaireResponse.filter({ 
        athlete_email: user.email 
      }, '-submitted_date', 1000);
      
      // Filtrer pour ne garder que les réponses aux questionnaires assignés
      const assignedIds = assignedQuestionnaires.map(q => q.id);
      return responses.filter(r => assignedIds.includes(r.template_id));
    },
    enabled: !!user?.email && assignedQuestionnaires.length > 0,
  });

  const myResponses = allQuestionnaireResponses.map(response => {
    const submittedDate = response.submitted_date ? new Date(response.submitted_date) : new Date();
    
    // Trouver le template pour mapper les réponses
    const responseTemplate = assignedQuestionnaires.find(q => q.id === response.template_id);
    const transformedResponses = {};
    
    if (responseTemplate && response.responses) {
      // Mapper les réponses directement par ID de question
      responseTemplate.questions.forEach(question => {
        const responseValue = response.responses[question.id];
        if (responseValue !== undefined && responseValue !== null) {
          if (question.type === 'scale' || question.type === 'number') {
            transformedResponses[question.id] = Number(responseValue);
          } else if (question.type === 'text' || question.type === 'textarea') {
            transformedResponses[question.id] = String(responseValue);
          }
        }
      });
    }
    
    // session_type = valeur de la première question (type de séance)
    const firstQuestionId = assignedQuestionnaires.find(q => q.id === response.template_id)?.questions?.[0]?.id;
    const sessionType = firstQuestionId ? response.responses?.[firstQuestionId] : null;

    return {
      id: response.id,
      originalResponse: response,
      athlete_email: response.athlete_email,
      athlete_name: response.athlete_name,
      training_date: format(submittedDate, 'yyyy-MM-dd'),
      session_type: sessionType || 'inconnu',
      duration_minutes: null,
      ...transformedResponses
    };
  });



  // Filter logs
  const filteredLogs = myResponses.filter(log => {
    const logDate = parseISO(log.training_date);
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const inDateRange = isAfter(logDate, start) && logDate <= end;
    const matchesSessionType = sessionTypeFilters.length === 0 || sessionTypeFilters.includes(log.session_type);
    return inDateRange && matchesSessionType;
  });

  // Add date labels
  const logsWithLabels = filteredLogs.map(log => ({
    ...log,
    dateLabel: format(parseISO(log.training_date), 'dd/MM', { locale: fr })
  }));



  const groupedChartData = logsWithLabels;

  // Stats dynamiques basées sur les premières métriques disponibles
  const totalSessions = filteredLogs.length;
  const metricKeys = Object.keys(metricLabels);
  const firstMetric = metricKeys[0];
  const secondMetric = metricKeys[1];
  const thirdMetric = metricKeys[2];
  
  const avgFirstMetric = filteredLogs.length > 0 && firstMetric
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[firstMetric] || 0), 0) / filteredLogs.length)
    : '-';
  const avgSecondMetric = filteredLogs.length > 0 && secondMetric
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[secondMetric] || 0), 0) / filteredLogs.length)
    : '-';
  const avgThirdMetric = filteredLogs.length > 0 && thirdMetric
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[thirdMetric] || 0), 0) / filteredLogs.length)
    : '-';

  const toggleSessionTypeFilter = (type) => {
    setSessionTypeFilters(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const getReturnUrl = () => {
    if (!user) return createPageUrl('Home');
    if (user.user_status === 'admin') return createPageUrl('AdminHome');
    if (user.user_status === 'coach' || user.user_status === 'coach_pro') return createPageUrl('CoachHome');
    return createPageUrl('AthleteHome');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              Mon Dashboard Personnel 📊
            </h1>
            <p className="text-slate-500 mt-1">
              Suivi de mes performances et bien-être
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to={getReturnUrl()}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </Button>
            </Link>
            <Link to="/ObjectiveData">
              <Button variant="outline" className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50">
                <Zap className="w-4 h-4" />
                Données Objectives
              </Button>
            </Link>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {myResponses.length === 0 ? (
          <Card className="shadow-sm border-0">
            <CardContent className="p-8 text-center">
              <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                Aucune donnée disponible
              </h3>
              <p className="text-slate-500">
                {assignedQuestionnaires.length > 0 
                  ? 'Remplissez vos questionnaires assignés pour voir vos statistiques apparaître ici.'
                  : 'Aucun questionnaire assigné. Contactez votre coach.'}
              </p>
              {assignedQuestionnaires.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-slate-600 mb-2">Questionnaires assignés :</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {assignedQuestionnaires.map(q => (
                      <Badge key={q.id} variant="secondary">{q.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters Bar */}
            <Card className="shadow-sm border-0 mb-6">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700">Du :</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 w-40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium text-slate-700">Au :</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 w-40"
                    />
                  </div>
                  {Object.keys(dynamicSessionTypes.labels).length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Label className="text-sm text-slate-600">Type :</Label>
                      {Object.entries(dynamicSessionTypes.labels).map(([value, label]) => (
                        <div key={value} className="flex items-center gap-1.5">
                          <Checkbox
                            id={`type-${value}`}
                            checked={sessionTypeFilters.includes(value)}
                            onCheckedChange={() => toggleSessionTypeFilter(value)}
                          />
                          <Label htmlFor={`type-${value}`} className="text-sm cursor-pointer">{label}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>



            {/* Metric Selector */}
            {Object.keys(metricLabels).length > 0 && (
              <Card className="shadow-sm border-0 mb-6">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-800 mb-3">Indicateurs à afficher</h3>
                  <MetricSelector
                    selected={selectedMetrics}
                    onChange={setSelectedMetrics}
                    metrics={Object.keys(metricLabels).map(key => ({
                      key,
                      label: metricLabels[key],
                      color: metricColors[key]
                    }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Line Chart */}
            {groupedChartData.length > 0 && selectedMetrics.length > 0 && (
              <div className="mb-6">
                <AthleteDataChart
                  data={groupedChartData}
                  selectedMetrics={selectedMetrics}
                  metricConfig={Object.keys(metricLabels).reduce((acc, key) => {
                    acc[key] = { name: metricLabels[key], color: metricColors[key] };
                    return acc;
                  }, {})}
                  title="Mon évolution"
                  startDate={startDate}
                  endDate={endDate}
                />
              </div>
            )}

            {/* Histogram Charts Grid */}
            {logsWithLabels.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(metricLabels).map(([key, label]) => (
                  <HistogramChart
                    key={key}
                    data={logsWithLabels}
                    dataKey={key}
                    title={label}
                    color={metricColors[key]}
                    startDate={startDate}
                    endDate={endDate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}