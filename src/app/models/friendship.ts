import { Profile } from './profile';

export type FriendshipStatus = 'pending' | 'accepted';

export interface Friendship {
  user_a: string;
  user_b: string;
  status: FriendshipStatus;
  requested_by: string;
  created_at: string;
  updated_at: string;
}

export interface FriendshipView {
  friendship: Friendship;
  other: Profile;
}
