export type ToolCategory =
  | 'json'
  | 'string'
  | 'code'
  | 'api'
  | 'generators';

export interface ToolItem {
  id: string;
  name: string;
  shortName?: string;
  description: string;
  category: ToolCategory;
  categoryLabel: string;
  icon: string;
  route: string;
  keywords: string[];
  isFavorite?: boolean;
  badge?: string;
  shortcut?: string;
}

export interface ToolCategoryGroup {
  id: ToolCategory;
  name: string;
  icon: string;
  description: string;
  tools: ToolItem[];
}

