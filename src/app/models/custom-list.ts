export interface CustomList {
  id: string;
  user_id: string;
  name: string;
  is_public: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
}

export interface CustomListItem {
  list_id: string;
  anime_id: string;
  added_at: string;
  position: number;
}

export type ListRole = 'owner' | 'collaborator';

export interface CustomListWithItems extends CustomList {
  anime_ids: string[];
  role: ListRole;
}

export interface ListCollaborator {
  list_id: string;
  user_id: string;
  added_at: string;
}
