/**
 * Lucide icons for scenario keys — chrome only (never emoji in UI chrome).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Utensils,
  Compass,
  ShoppingBag,
  Hotel,
  Users,
  Landmark,
  TrainFront,
  Moon,
  Cross,
  Briefcase,
  GraduationCap,
  ClipboardList,
  Pill,
  Siren,
  KeyRound,
  LandmarkIcon,
  Car,
  Church,
  Soup,
  Heart,
  Pencil,
  MessageSquare,
} from 'lucide-react';

const SCENARIO_ICONS: Record<string, LucideIcon> = {
  restaurant: Utensils,
  directions: Compass,
  market: ShoppingBag,
  hotel: Hotel,
  social: Users,
  government: Landmark,
  transit: TrainFront,
  nightlife: Moon,
  hospital: Cross,
  office: Briefcase,
  school: GraduationCap,
  customs: ClipboardList,
  pharmacy: Pill,
  emergency: Siren,
  landlord: KeyRound,
  bank: LandmarkIcon,
  taxi: Car,
  temple: Church,
  street_food: Soup,
  date: Heart,
  custom: Pencil,
};

export function scenarioIcon(key: string): LucideIcon {
  return SCENARIO_ICONS[key] ?? MessageSquare;
}
