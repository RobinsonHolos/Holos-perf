import React from 'react';
import { supabase as base44 } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import EventCalendar from '../components/calendar/EventCalendar';
import CoachCalendar from '../components/calendar/CoachCalendar';
import { useAuth } from '@/lib/AuthContext';

export default function CalendarPage() {
  const { user } = useAuth();

  const isAdmin  = user?.user_status === 'admin';
  const isCoach  = user?.user_status === 'coach' || user?.user_status === 'coach_pro';
  
  // Admin et coachs ont accès au CoachCalendar
  const hasCoachAccess = isAdmin || isCoach;

  const { data: coachGroup } = useQuery({
    queryKey: ['coach-group', user?.email],
    queryFn: async () => {
      const groups = await base44.entities.Group.filter({ coach_email: user.email });
      return groups[0] || null;
    },
    enabled: !!user?.email && isCoach,
  });

  const { data: coachClub } = useQuery({
    queryKey: ['coach-club-calendar', user?.email],
    queryFn: async () => {
      const clubs = await base44.entities.Club.list();
      return clubs.find(c => (c.coach_emails || []).includes(user.email)) || null;
    },
    enabled: !!user?.email && isCoach,
  });

  // Charger tous les utilisateurs pour résoudre les noms réels
  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-calendar'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.email && hasCoachAccess,
  });

  const athletes = (() => {
    if (!hasCoachAccess) return [];

    if (isAdmin) {
      return allUsers
        .filter(u => u.user_status === 'athlete')
        .map(u => ({ email: u.email, name: u.full_name || u.email }));
    }

    // Coach : selon la vue sélectionnée
    const coachView = localStorage.getItem('coachView') || 'club';
    let emails = [];
    if (coachView === 'club' && coachClub) {
      emails = coachClub.athlete_emails || [];
    } else {
      emails = coachGroup?.athlete_emails || [];
    }
    return emails.map(email => {
      const u = allUsers.find(u => u.email === email);
      return { email, name: u?.full_name || email };
    });
  })();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">Chargement...</p>
      </div>
    );
  }

  const homeUrl = isAdmin ? 'AdminHome' : isCoach ? 'CoachHome' : 'AthleteHome';

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to={createPageUrl(homeUrl)}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">
            {hasCoachAccess ? 'Calendrier des Séances' : 'Mon Calendrier'}
          </h1>
          <p className="text-slate-500 mt-2">
            {hasCoachAccess ? 'Planifiez et gérez les séances de vos athlètes' : 'Gérez vos événements personnels'}
          </p>
        </div>
        
        {hasCoachAccess ? (
          <CoachCalendar coachEmail={user.email} athletes={athletes} />
        ) : (
          <EventCalendar userEmail={user.email} />
        )}
      </div>
    </div>
  );
}
