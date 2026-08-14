import React, { useState, useMemo } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from 'lucide-react';

// Sélecteur d'athlètes avec recherche + sélection en masse par groupe/club.
// - Admin : peut ajouter un groupe entier ou un club entier (parmi tous ceux de l'appli).
// - Coach lié à un club : pas de sélecteur "groupe", juste la liste (déjà limitée aux athlètes du club) + "Tout sélectionner".
// - Coach indépendant : peut ajouter un de ses propres groupes.
export default function AthleteAssignmentPicker({
  athletes = [],
  selected = [],
  onChange,
  isAdmin = false,
  coachClub = null,
  allGroups = [],
  allClubs = [],
  coachOwnGroups = [],
  idPrefix = 'athlete',
  emptyLabel = 'Aucun athlète disponible',
}) {
  const [search, setSearch] = useState('');
  const [groupPick, setGroupPick] = useState('');
  const [clubPick, setClubPick] = useState('');

  const filteredAthletes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter(a =>
      (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
    );
  }, [athletes, search]);

  const allFilteredSelected = filteredAthletes.length > 0 && filteredAthletes.every(a => selected.includes(a.email));

  const toggleAthlete = (email) => {
    onChange(selected.includes(email) ? selected.filter(e => e !== email) : [...selected, email]);
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const filteredEmails = new Set(filteredAthletes.map(a => a.email));
      onChange(selected.filter(e => !filteredEmails.has(e)));
    } else {
      const merged = new Set([...selected, ...filteredAthletes.map(a => a.email)]);
      onChange(Array.from(merged));
    }
  };

  const addEmails = (emails) => {
    const validEmails = (emails || []).filter(e => athletes.some(a => a.email === e));
    if (validEmails.length === 0) return;
    const merged = new Set([...selected, ...validEmails]);
    onChange(Array.from(merged));
  };

  const groupOptions = isAdmin ? allGroups : coachOwnGroups;
  const showGroupSelector = isAdmin ? groupOptions.length > 0 : (!coachClub && groupOptions.length > 0);
  const showClubSelector = isAdmin && allClubs.length > 0;

  return (
    <div>
      <Label className="mb-3 block">Athlètes assignés</Label>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher un athlète..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleSelectAll}
          disabled={filteredAthletes.length === 0}
        >
          {allFilteredSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
        {showGroupSelector && (
          <Select
            value={groupPick}
            onValueChange={(groupId) => {
              const group = groupOptions.find(g => g.id === groupId);
              if (group) addEmails(group.athlete_emails);
              setGroupPick('');
            }}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="+ Groupe entier" /></SelectTrigger>
            <SelectContent>
              {groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {showClubSelector && (
          <Select
            value={clubPick}
            onValueChange={(clubId) => {
              const club = allClubs.find(c => c.id === clubId);
              if (club) addEmails(club.athlete_emails);
              setClubPick('');
            }}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="+ Club entier" /></SelectTrigger>
            <SelectContent>
              {allClubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-2">
        {filteredAthletes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            {athletes.length === 0 ? emptyLabel : 'Aucun athlète ne correspond à la recherche'}
          </p>
        ) : (
          filteredAthletes.map((athlete) => (
            <div key={athlete.email} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded">
              <Checkbox
                id={`${idPrefix}-${athlete.email}`}
                checked={selected.includes(athlete.email)}
                onCheckedChange={() => toggleAthlete(athlete.email)}
              />
              <Label htmlFor={`${idPrefix}-${athlete.email}`} className="flex-1 cursor-pointer">
                {athlete.name}
              </Label>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
