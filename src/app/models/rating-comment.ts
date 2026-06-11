import { Profile } from './profile';

export interface RatingComment {
  id: string;
  rating_user_id: string;
  rating_anime_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface RatingCommentWithAuthor extends RatingComment {
  author: Profile | null;
}
