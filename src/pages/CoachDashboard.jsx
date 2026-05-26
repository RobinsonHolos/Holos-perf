import React, { useState, useEffect, useMemo } from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import AthleteDataChart from '../components/dashboard/AthleteDataChart';
import HistogramChart from '../components/dashboard/HistogramChart';
import MetricSelector from '../components/dashboard/MetricSelector';
import StatCard from '../components/dashboard/StatCard';
import SummaryStatsTable from '../components/dashboard/SummaryStatsTable';
import { 
  Users, Activity, TrendingUp, Calendar, Filter, 
  ChevronDown, ChevronUp, RefreshCw, ArrowLeft, Search, Zap
} from 'lucide-react';
import { format, subDays, isAfter, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const defaultSessionTypeColors = [
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-slate-100 text-slate-600',
  'bg-green-100 text-green-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

// Virtual demo data
const generateDemoData = () => {
  const athletes = [
    { email: 'marie.dupont@email.com', name: 'Marie Dupont' },
    { email: 'lucas.martin@email.com', name: 'Lucas Martin' },
    { email: 'emma.bernard@email.com', name: 'Emma Bernard' },
    { email: 'thomas.petit@email.com', name: 'Thomas Petit' },
    { email: 'lea.moreau@email.com', name: 'Léa Moreau' }
  ];
  
  const sessionTypes = ['entrainement', 'competition', 'effort_type', 'off'];
  const logs = [];
  
  const today = new Date();
  
  athletes.forEach(athlete => {
    const daysCount = 30 + Math.floor(Math.random() * 15);
    
    for (let i = 0; i < daysCount; i++) {
      const date = subDays(today, i);
      if (Math.random() > 0.75) continue;
      
      const sessionType = sessionTypes[Math.floor(Math.random() * sessionTypes.length)];
      const isCompetition = sessionType === 'competition';
      const isOff = sessionType === 'off';
      
      logs.push({
        id: `demo-${athlete.email}-${i}`,
        athlete_email: athlete.email,
        athlete_name: athlete.name,
        training_date: format(date, 'yyyy-MM-dd'),
        session_type: sessionType,
        duration_minutes: isOff ? null : (60 + Math.floor(Math.random() * 90)),
        fatigue: Math.floor(30 + Math.random() * 50),
        intensite: isOff ? Math.floor(10 + Math.random() * 20) : (isCompetition ? Math.floor(70 + Math.random() * 30) : Math.floor(40 + Math.random() * 40)),
        sommeil: Math.floor(40 + Math.random() * 50),
        plaisir: Math.floor(50 + Math.random() * 45),
        harmonie_proches: Math.floor(50 + Math.random() * 40),
        maitrise_technique: Math.floor(45 + Math.random() * 45),
        maitrise_tactique: Math.floor(40 + Math.random() * 50),
        epanouissement: Math.floor(55 + Math.random() * 40),
        commentaire: Math.random() > 0.7 ? ['Bonne séance', 'Fatigue accumulée', 'Sensation de forme', 'Besoin de récupération', 'Excellente session'][Math.floor(Math.random() * 5)] : ''
      });
    }
  });
  
  return logs.sort((a, b) => new Date(b.training_date) - new Date(a.training_date));
};

// Default date range: last 2 complete weeks Mon-Sun
// Week 1 = the week before last, Week 2 = last complete week
// "Complete" means Mon to Sun, regardless of today's day
const getDefaultDates = () => {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun,1=Mon,...,6=Sat
  // Days since last Monday (if today is Monday, daysFromMon=0)
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  // Start of current week (Monday)
  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - daysFromMon);
  // End of current week (Sunday)
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);
  // Start of previous week
  const startOfPrevWeek = new Date(startOfThisWeek);
  startOfPrevWeek.setDate(startOfThisWeek.getDate() - 7);

  return {
    start: format(startOfPrevWeek, 'yyyy-MM-dd'),
    end: format(endOfThisWeek, 'yyyy-MM-dd'),
  };
};

export default function CoachDashboard() {
  const { user } = useAuth();
  const [selectedAthleteEmails, setSelectedAthleteEmails] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectionMode, setSelectionMode] = useState('all');
  const [startDate, setStartDate] = useState(() => getDefaultDates().start);
  const [endDate, setEndDate] = useState(() => getDefaultDates().end);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [groupBy, setGroupBy] = useState('day');
  const [sessionTypeFilters, setSessionTypeFilters] = useState(['entrainement', 'competition', 'effort_type', 'off', 'inconnu']);
  const [sortConfig, setSortConfig] = useState({ key: 'training_date', direction: 'desc' });
  const [demoData] = useState(() => generateDemoData());
  const [athleteMetrics, setAthleteMetrics] = useState({ labels: {}, colors: {}, idToCanonical: {} });
  const [athleteSearchQuery, setAthleteSearchQuery] = useState('');
  const [dynamicSessionTypes, setDynamicSessionTypes] = useState({ labels: {}, colors: {} });
  const [customColors, setCustomColors] = useState({});

  useEffect(() => {
    if (user?.metric_colors) {
      setCustomColors(user.metric_colors);
    }
  }, [user?.email]);

  const handleColorChange = async (metricKey, newColor) => {
    const updated = { ...customColors, [metricKey]: newColor };
    setCustomColors(updated);
    // Sauvegarder dans le profil utilisateur
    await base44.auth.updateMe({ metric_colors: updated });
    // Mettre à jour les couleurs dans athleteMetrics en temps réel
    setAthleteMetrics(prev => ({
      ...prev,
      colors: { ...prev.colors, [metricKey]: newColor }
    }));
  };

  const isAdmin = user?.user_status === 'admin';
  const isCoach = user?.user_status === 'coach' || user?.user_status === 'coach_pro';

  const defaultColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
    '#f43f5e', '#a855f7', '#84cc16', '#6366f1',
    '#fb923c', '#34d399', '#60a5fa', '#f87171'
  ];

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      if (!isCoach) return null;
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: isCoach && !!user?.email,
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club', user?.email],
    queryFn: async () => {
      if (!user?.email || !isCoach) return null;
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const { data: assignedTemplates = [] } = useQuery({
    queryKey: ['coach-templates', user?.email, coachGroup?.id, coachClub?.id],
    queryFn: async () => {
      if (!user?.email || (!isCoach && !isAdmin)) return [];
      if (isAdmin) {
        const templates = await base44.entities.QuestionnaireTemplate.list();
        return templates.filter(t => t.is_active !== false);
      }
      // Pour un coach : tous les templates assignés à ses athlètes (groupe + club)
      const templates = await base44.entities.QuestionnaireTemplate.list();
      const coachAthleteEmails = [
        ...(coachGroup?.athlete_emails || []),
        ...(coachClub?.athlete_emails || []),
      ];
      const uniqueEmails = [...new Set(coachAthleteEmails)];
      return templates.filter(t =>
        t.assigned_coaches?.includes(user.email) ||
        uniqueEmails.some(email => t.assigned_athletes?.includes(email))
      );
    },
    enabled: !!user && (isCoach || isAdmin),
  });

  const { data: realLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['questionnaire-responses-coach', user?.email, coachGroup?.id, coachClub?.id, assignedTemplates.map(t => t.id).join(',')],
    queryFn: async () => {
      let filteredResponses;
      if (isAdmin) {
        const allResponses = await base44.entities.QuestionnaireResponse.list('-submitted_date', 2000);
        const templateIds = assignedTemplates.map(t => t.id);
        filteredResponses = templateIds.length > 0 ? allResponses.filter(r => templateIds.includes(r.template_id)) : allResponses;
      } else if (isCoach) {
        const allResponses = await base44.entities.QuestionnaireResponse.list('-submitted_date', 1000);
        let coachAthleteEmails = [...(coachGroup?.athlete_emails || [])];
        if (!isIndividualView && coachClub) {
          coachAthleteEmails = [...new Set([...coachAthleteEmails, ...(coachClub.athlete_emails || [])])];
        }
        if (coachAthleteEmails.length === 0) return [];
        filteredResponses = allResponses.filter(r => coachAthleteEmails.includes(r.athlete_email));
      } else {
        return [];
      }
      const templateMap = {};
      assignedTemplates.forEach(t => { templateMap[t.id] = t; });
      return filteredResponses.map(response => {
        const submittedDate = response.submitted_date ? new Date(response.submitted_date) : new Date();
        const responseTemplate = templateMap[response.template_id];
        const transformedResponses = {};
        if (responseTemplate && response.responses) {
          responseTemplate.questions.forEach(question => {
            const responseValue = response.responses[question.id];
            if (responseValue !== undefined && responseValue !== null) {
              if (question.type === 'scale' || question.type === 'number') {
                // Store under original question id; canonical mapping applied at render time
                transformedResponses[question.id] = Number(responseValue);
              } else if (question.type === 'text' || question.type === 'textarea') {
                transformedResponses[question.id] = String(responseValue);
              } else {
                transformedResponses[question.id] = responseValue;
              }
            }
          });
        }
        const firstQuestionId = responseTemplate?.questions?.[0]?.id;
        const firstQuestion = responseTemplate?.questions?.[0];
        const hasSelectFirstQuestion = firstQuestion?.type === 'select';
        const sessionType = (hasSelectFirstQuestion && firstQuestionId) ? response.responses?.[firstQuestionId] : null;
        return {
          id: response.id,
          athlete_email: response.athlete_email,
          athlete_name: response.athlete_name,
          training_date: format(submittedDate, 'yyyy-MM-dd'),
          template_id: response.template_id,
          session_type: sessionType || (hasSelectFirstQuestion ? 'inconnu' : 'questionnaire'),
          duration_minutes: null,
          ...transformedResponses
        };
      });
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const hasRealAthletes = isCoach
    ? (coachGroup?.athlete_emails?.length || 0) > 0 || (coachClub?.athlete_emails?.length || 0) > 0
    : true;
  const allLogs = realLogs.length > 0 ? realLogs : (hasRealAthletes ? [] : demoData);
  const isUsingDemoData = realLogs.length === 0 && !hasRealAthletes;



  const { data: allGroups = [] } = useQuery({
    queryKey: ['all-groups', user?.email],
    queryFn: async () => {
      if (isAdmin) return await base44.entities.Group.list();
      if (isCoach) return await base44.entities.Group.filter({ coach_email: user.email });
      return [];
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      return await base44.entities.User.list();
    },
    enabled: !!user && (isAdmin || isCoach),
  });

  const isIndividualView = localStorage.getItem('coachView') === 'individual';

  const selectableAthletes = useMemo(() => {
    if (isAdmin) {
      return allUsers
        .filter(u => u.user_status === 'athlete' || (u.role === 'user' && u.user_status !== 'coach' && u.user_status !== 'coach_pro' && u.user_status !== 'admin'))
        .map(u => ({ email: u.email, name: u.full_name }));
    } else if (isCoach) {
      let athleteEmails = [];
      if (coachClub && !isIndividualView) {
        athleteEmails = coachClub.athlete_emails || [];
      } else {
        athleteEmails = coachGroup?.athlete_emails || [];
      }
      return athleteEmails.map(email => {
        const u = allUsers.find(u => u.email === email);
        return { email, name: u?.full_name || u?.email || email };
      });
    }
    return [];
  }, [isAdmin, isCoach, allUsers, coachClub, isIndividualView, coachGroup]);

  const userFilteredLogs = useMemo(() => {
    let logs = allLogs;

    if (isAdmin) {
      logs = allLogs;
    } else if (isCoach) {
      const coachAthleteEmails = selectableAthletes.map(a => a.email);
      logs = allLogs.filter(log => coachAthleteEmails.includes(log.athlete_email));
    } else {
      logs = allLogs.filter(log => log.athlete_email === user?.email);
    }

    if (isAdmin || isCoach) {
      if (selectionMode === 'athletes' && selectedAthleteEmails.length > 0) {
        logs = logs.filter(log => selectedAthleteEmails.includes(log.athlete_email));
      } else if (selectionMode === 'group' && selectedGroupId) {
        const group = allGroups.find(g => g.id === selectedGroupId);
        if (group) {
          logs = logs.filter(log => group.athlete_emails.includes(log.athlete_email));
        }
      }
    }

    return logs;
  }, [allLogs, isAdmin, isCoach, selectableAthletes, user?.email, selectionMode, selectedAthleteEmails, selectedGroupId, allGroups]);

  const athletesFromLogs = [...new Map(userFilteredLogs.map(log => [log.athlete_email, { 
    email: log.athlete_email, 
    name: log.athlete_name 
  }])).values()];

  const athletes = athletesFromLogs;

  const calculateMedian = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  };

  // Extract dynamic session types from the templates actually used in visible logs
  useEffect(() => {
    // Get unique template IDs present in the currently visible logs
    const templateIdsInLogs = [...new Set(userFilteredLogs.map(log => log.template_id).filter(Boolean))];

    // Find the corresponding templates
    let relevantTemplates = templateIdsInLogs.length > 0
      ? assignedTemplates.filter(t => templateIdsInLogs.includes(t.id))
      : assignedTemplates;

    const labels = {};
    const colors = {};
    let colorIndex = 0;

    relevantTemplates.forEach(template => {
      const firstQuestion = template.questions?.[0];
      if (firstQuestion && firstQuestion.type === 'select') {
        const choices = firstQuestion.selectOptions?.choices || [];
        choices.forEach((choice) => {
          const key = choice.label;
          if (!labels[key]) {
            labels[key] = choice.label;
            colors[key] = defaultSessionTypeColors[colorIndex % defaultSessionTypeColors.length];
            colorIndex++;
          }
        });
      }
    });

    // Toujours inclure 'questionnaire' pour les questionnaires sans QCM en première question
    labels['questionnaire'] = 'Questionnaire';
    colors['questionnaire'] = 'bg-indigo-100 text-indigo-700';
    // Toujours inclure 'inconnu' pour les questionnaires avec QCM sans valeur reconnue
    labels['inconnu'] = 'Autre';
    colors['inconnu'] = 'bg-slate-100 text-slate-600';

    setDynamicSessionTypes({ labels, colors });
    setSessionTypeFilters(Object.keys(labels));
  }, [userFilteredLogs, assignedTemplates]);

  useEffect(() => {
    // Trouver les templates réellement utilisés dans les logs filtrés
    const templateIdsInLogs = [...new Set(userFilteredLogs.map(log => log.template_id).filter(Boolean))];
    const relevantTemplates = templateIdsInLogs.length > 0
      ? assignedTemplates.filter(t => templateIdsInLogs.includes(t.id))
      : assignedTemplates;

    if (relevantTemplates.length === 0) {
      setAthleteMetrics({ labels: {}, colors: {}, idToCanonical: {} });
      setSelectedMetrics([]);
      return;
    }

    const normalizeLabel = (str) => (str || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Regrouper les questions de même label (ex: "estime de soi" de 2 templates → 1 clé canonique)
    const groupedByLabel = new Map();
    relevantTemplates.forEach(template => {
      (template.questions || []).filter(q => q.type === 'scale' || q.type === 'number').forEach(question => {
        const norm = normalizeLabel(question.athleteLabel || question.label);
        if (!groupedByLabel.has(norm)) {
          groupedByLabel.set(norm, { representative: question, ids: [question.id] });
        } else {
          const existing = groupedByLabel.get(norm);
          if (!existing.ids.includes(question.id)) existing.ids.push(question.id);
        }
      });
    });

    if (groupedByLabel.size === 0) {
      setAthleteMetrics({ labels: {}, colors: {}, idToCanonical: {} });
      setSelectedMetrics([]);
      return;
    }

    const labels = {};
    const colors = {};
    const metricKeys = [];
    const idToCanonical = {};
    let colorIdx = 0;

    groupedByLabel.forEach(({ representative: question, ids }) => {
      const canonicalKey = ids[0];
      ids.forEach(id => { idToCanonical[id] = canonicalKey; });

      const label = normalizeLabel(question.athleteLabel || question.label);
      labels[canonicalKey] = question.athleteLabel || question.label;

      let color = question.scaleOptions?.color;
      if (!color || color === '#ffffff' || color === '#000000') {
        if (label.includes('fatigue')) color = '#ef4444';
        else if (label.includes('intensit')) color = '#f59e0b';
        else if (label.includes('sommeil')) color = '#8b5cf6';
        else if (label.includes('plaisir')) color = '#10b981';
        else if (label.includes('harmonie') || label.includes('proches')) color = '#06b6d4';
        else if (label.includes('technique')) color = '#3b82f6';
        else if (label.includes('tactique')) color = '#6366f1';
        else if (label.includes('epanouissement')) color = '#ec4899';
        else if (label.includes('dynamisme')) color = '#84cc16';
        else if (label.includes('estime')) color = '#a855f7';
        else if (label.includes('cardiovasculaire')) color = '#f43f5e';
        else if (label.includes('musculaire')) color = '#fb923c';
        else color = defaultColors[colorIdx % defaultColors.length];
      }
      colors[canonicalKey] = color;
      metricKeys.push(canonicalKey);
      colorIdx++;
    });

    // Appliquer les couleurs personnalisées de l'utilisateur en priorité
    Object.keys(colors).forEach(key => {
      if (customColors[key]) colors[key] = customColors[key];
    });

    setAthleteMetrics({ labels, colors, idToCanonical });
    setSelectedMetrics(metricKeys.slice(0, Math.min(4, metricKeys.length)));
  }, [userFilteredLogs, assignedTemplates, customColors]);

  const dateRange = { start: parseISO(startDate), end: parseISO(endDate) };

  // Filter logs
  const filteredLogs = userFilteredLogs.filter(log => {
    const logDate = parseISO(log.training_date);
    const inDateRange = logDate >= dateRange.start && logDate <= dateRange.end;
    const matchesSessionType = sessionTypeFilters.includes(log.session_type);
    return inDateRange && matchesSessionType;
  });

  // Remap all question ids in a log to their canonical key so grouped questions plot together
  const remapLogMetrics = (log) => {
    const idToCanonical = athleteMetrics.idToCanonical || {};
    if (Object.keys(idToCanonical).length === 0) return log;
    const remapped = { ...log };
    Object.entries(idToCanonical).forEach(([origId, canonicalId]) => {
      if (origId !== canonicalId && remapped[origId] !== undefined && remapped[canonicalId] === undefined) {
        remapped[canonicalId] = remapped[origId];
      }
    });
    return remapped;
  };

  const processedLogs = (() => {
    if (selectionMode === 'all' || (selectionMode === 'athletes' && selectedAthleteEmails.length <= 1)) {
      return filteredLogs.map(log => ({
        ...remapLogMetrics(log),
        dateLabel: format(parseISO(log.training_date), 'dd/MM', { locale: fr })
      }));
    }

    const grouped = {};
    filteredLogs.forEach(rawLog => {
      const log = remapLogMetrics(rawLog);
      const dateKey = log.training_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          training_date: log.training_date,
          session_type: log.session_type,
          dateLabel: format(parseISO(log.training_date), 'dd/MM', { locale: fr }),
          athlete_name: selectionMode === 'group' ? 'Groupe (médiane)' : 'Sélection (médiane)',
          values: {}
        };
      }

      Object.keys(athleteMetrics.labels).forEach(metricKey => {
        if (log[metricKey] != null) {
          if (!grouped[dateKey].values[metricKey]) {
            grouped[dateKey].values[metricKey] = [];
          }
          grouped[dateKey].values[metricKey].push(log[metricKey]);
        }
      });
    });

    return Object.values(grouped).map(day => {
      const medians = {};
      Object.entries(day.values).forEach(([metricKey, values]) => {
        medians[metricKey] = Math.round(calculateMedian(values));
      });
      return {
        id: `median-${day.training_date}`,
        training_date: day.training_date,
        session_type: day.session_type,
        dateLabel: day.dateLabel,
        athlete_name: day.athlete_name,
        athlete_email: 'group',
        duration_minutes: null,
        ...medians
      };
    });
  })();

  const logsWithLabels = processedLogs;

  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    if (sortConfig.key === 'training_date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const groupedChartData = (() => {
    const currentMetricLabels = Object.keys(athleteMetrics.labels);
    if (currentMetricLabels.length === 0) return [];
    if (groupBy === 'day') return logsWithLabels;
    
    const grouped = {};
    filteredLogs.forEach(log => {
      let key;
      const date = parseISO(log.training_date);
      if (groupBy === 'week') {
        key = format(startOfWeek(date, { locale: fr }), 'yyyy-MM-dd');
      } else if (groupBy === 'month') {
        key = format(startOfMonth(date), 'yyyy-MM');
      }
      
      if (!grouped[key]) {
        grouped[key] = { 
          training_date: key, 
          dateLabel: groupBy === 'week' 
            ? `Sem. ${format(parseISO(key), 'dd/MM', { locale: fr })}`
            : format(parseISO(key + '-01'), 'MMM yyyy', { locale: fr }),
          count: 0, 
          ...Object.fromEntries(
            currentMetricLabels.map(m => [m, { sum: 0, count: 0 }])
          )
        };
      }
      grouped[key].count++;
      currentMetricLabels.forEach(m => {
        if (log[m] != null) {
          grouped[key][m].sum += log[m];
          grouped[key][m].count++;
        }
      });
    });

    return Object.values(grouped).map(g => ({
      training_date: g.training_date,
      dateLabel: g.dateLabel,
      ...Object.fromEntries(
        currentMetricLabels.map(m => [m, g[m].count > 0 ? Math.round(g[m].sum / g[m].count) : null])
      )
    })).sort((a, b) => new Date(a.training_date) - new Date(b.training_date));
  })();

  const totalSessions = filteredLogs.length;
  const firstMetricKey = selectedMetrics[0];
  const secondMetricKey = selectedMetrics[1];
  
  const avgFirstMetric = filteredLogs.length > 0 && firstMetricKey
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[firstMetricKey] || 0), 0) / filteredLogs.length)
    : '-';
  const avgSecondMetric = filteredLogs.length > 0 && secondMetricKey
    ? Math.round(filteredLogs.reduce((sum, l) => sum + (l[secondMetricKey] || 0), 0) / filteredLogs.length)
    : '-';

  const toggleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const toggleSessionTypeFilter = (type) => {
    setSessionTypeFilters(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              {isCoach ? 'Dashboard Entraineur 🏆' : isAdmin ? 'Dashboard Admin 🏆' : 'Mes Données 📊'}
            </h1>
            <p className="text-slate-500 mt-1">
              {isCoach ? `Suivi du groupe ${coachGroup?.name || ''}` : isAdmin ? 'Suivi de vos athlètes' : 'Suivi de mes entraînements'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(isAdmin || isCoach) && (
              <Link to={isAdmin ? createPageUrl('AdminHome') : isIndividualView ? createPageUrl('CoachHomeIndividual') : createPageUrl('CoachHome')}>
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Accueil
                </Button>
              </Link>
            )}
            {(!isCoach || user?.can_access_objective_data_page !== false) && (
            <Link to="/ObjectiveData">
              <Button variant="outline" className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50">
                <Zap className="w-4 h-4" />
                Données Objectives
              </Button>
            </Link>
            )}
            {isUsingDemoData && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Données de démonstration
              </Badge>
            )}
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Athlete Selector */}
        {(isAdmin || isCoach) && (
          <Card className="shadow-lg border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-indigo-900">
                🎯 Sélection d'athlète
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <Label className="text-sm font-medium text-slate-700">Mode de sélection :</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectionMode === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setSelectionMode('all'); setSelectedAthleteEmails([]); setSelectedGroupId(null); }}
                      className={selectionMode === 'all' ? 'bg-slate-800' : ''}
                    >
                      Tous
                    </Button>
                    <Button
                      variant={selectionMode === 'athletes' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setSelectionMode('athletes'); setSelectedGroupId(null); }}
                      className={selectionMode === 'athletes' ? 'bg-slate-800' : ''}
                    >
                      Athlètes
                    </Button>
                    {allGroups.length > 0 && (
                      <Button
                        variant={selectionMode === 'group' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setSelectionMode('group'); setSelectedAthleteEmails([]); }}
                        className={selectionMode === 'group' ? 'bg-slate-800' : ''}
                      >
                        Groupe
                      </Button>
                    )}
                  </div>
                </div>

                {selectionMode === 'athletes' && (
                  <div className="flex items-start gap-4">
                    <Label className="text-sm font-medium text-slate-700 whitespace-nowrap mt-3">Athlètes :</Label>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Rechercher un athlète..."
                          value={athleteSearchQuery}
                          onChange={(e) => setAthleteSearchQuery(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="border border-slate-200 rounded-lg p-3 bg-white max-h-48 overflow-y-auto">
                        {selectableAthletes.length > 0 ? (
                          selectableAthletes
                            .filter(a => !athleteSearchQuery || a.name.toLowerCase().includes(athleteSearchQuery.toLowerCase()) || a.email.toLowerCase().includes(athleteSearchQuery.toLowerCase()))
                            .map((athlete) => (
                              <div key={athlete.email} className="flex items-center gap-2 py-1">
                                <Checkbox
                                  id={`athlete-${athlete.email}`}
                                  checked={selectedAthleteEmails.includes(athlete.email)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedAthleteEmails([...selectedAthleteEmails, athlete.email]);
                                    } else {
                                      setSelectedAthleteEmails(selectedAthleteEmails.filter(e => e !== athlete.email));
                                    }
                                  }}
                                />
                                <Label htmlFor={`athlete-${athlete.email}`} className="text-sm cursor-pointer">
                                  {athlete.name}
                                </Label>
                              </div>
                            ))
                        ) : (
                          <div className="text-sm text-amber-700">Aucun athlète disponible</div>
                        )}
                      </div>
                      {selectedAthleteEmails.length > 0 && (
                        <div className="text-sm text-indigo-700 font-medium">
                          ✓ {selectedAthleteEmails.length} athlète(s) sélectionné(s) - Affichage des médianes
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectionMode === 'group' && allGroups.length > 0 && (
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">Groupe :</Label>
                    <div className="flex-1 max-w-md">
                      <Select 
                        value={selectedGroupId || 'none'} 
                        onValueChange={(v) => setSelectedGroupId(v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-11 bg-white border-indigo-300 shadow-sm">
                          <SelectValue placeholder="Sélectionner un groupe..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="font-semibold">Sélectionner un groupe...</span>
                          </SelectItem>
                          {allGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.athlete_emails?.length || 0} athlètes)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedGroupId && (
                        <div className="text-sm text-indigo-700 font-medium mt-2">
                          ✓ Groupe sélectionné - Affichage des médianes par jour
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date & Session Type Filters */}
        <Card className="shadow-sm border-0 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">Du :</Label>
                <Input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">Au :</Label>
                <Input
                  type="date"
                  id="endDate"
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

        {/* Summary Stats Table */}
        <div className="mb-6">
          <SummaryStatsTable 
            data={userFilteredLogs}
            metricLabels={athleteMetrics.labels}
            metricColors={athleteMetrics.colors}
            startDate={startDate}
            endDate={endDate}
            sessionTypeFilters={sessionTypeFilters}
          />
        </div>

        {/* Metric Selector */}
        {Object.keys(athleteMetrics.labels).length > 0 && (
          <Card className="shadow-sm border-0 mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Indicateurs à afficher</h3>
              <MetricSelector
                selected={selectedMetrics}
                onChange={setSelectedMetrics}
                onColorChange={handleColorChange}
                metrics={Object.keys(athleteMetrics.labels).map(key => ({
                  key,
                  label: athleteMetrics.labels[key],
                  color: athleteMetrics.colors[key]
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
              metricConfig={Object.keys(athleteMetrics.labels).reduce((acc, key) => {
                acc[key] = { name: athleteMetrics.labels[key], color: athleteMetrics.colors[key] };
                return acc;
              }, {})}
              title={`Évolution ${isAdmin && athletes.length > 1 ? '(tous les athlètes)' : ''}`}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
        )}

        {/* Histogram Charts Grid */}
        {logsWithLabels.length > 0 && Object.keys(athleteMetrics.labels).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {Object.entries(athleteMetrics.labels).map(([key, label]) => (
              <HistogramChart
                key={key}
                data={logsWithLabels}
                dataKey={key}
                title={label}
                color={athleteMetrics.colors[key]}
                startDate={startDate}
                endDate={endDate}
              />
            ))}
          </div>
        )}

        {/* Data Table */}
        <Card className="shadow-sm border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Détail des séances</CardTitle>
              <Badge variant="secondary">{sortedLogs.length} entrées</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead 
                      className="cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('training_date')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortConfig.key === 'training_date' && (
                          sortConfig.direction === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-slate-100"
                      onClick={() => toggleSort('athlete_name')}
                    >
                      Athlète
                    </TableHead>
                    <TableHead>Type</TableHead>
                    {selectedMetrics.slice(0, 5).map(metricKey => (
                      <TableHead 
                        key={metricKey}
                        className="text-center cursor-pointer hover:bg-slate-100"
                        onClick={() => toggleSort(metricKey)}
                      >
                        {athleteMetrics.labels[metricKey] || metricKey}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs.slice(0, 10).map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">
                        {format(parseISO(log.training_date), 'dd/MM/yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>{log.athlete_name}</TableCell>
                      <TableCell>
                        <Badge className={dynamicSessionTypes.colors[log.session_type] || 'bg-slate-100 text-slate-600'}>
                          {dynamicSessionTypes.labels[log.session_type] || log.session_type}
                        </Badge>
                      </TableCell>
                      {selectedMetrics.slice(0, 5).map(metricKey => (
                        <TableCell key={metricKey} className="text-center">
                          <span className={`font-medium ${log[metricKey] >= 70 ? 'text-amber-600' : ''}`}>
                            {log[metricKey] ?? '-'}
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {sortedLogs.length > 10 && (
              <p className="text-center text-sm text-slate-500 mt-4">
                Affichage des 10 premières entrées sur {sortedLogs.length}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}