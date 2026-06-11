import { Profile } from './profile';

export interface AnimeRecommendation {
  id: string;
  from_user_id: string;
  to_user_id: string;
  anime_id: string;
  message: string | null;
  created_at: string;
  dismissed_at: string | null;
}

export interface IncomingRecommendation extends AnimeRecommendation {
  from_user: Profile | null;
}
