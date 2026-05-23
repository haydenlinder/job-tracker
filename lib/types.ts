export enum CATEGORIES {
  APPLICATION="application",
  INTERVIEW="interview",
  OFFER="offer",
  REJECTION="rejection",
  OPPORTUNITY="opportunity",
  OTHER="other",
}

export interface JobEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labels: string[];
  category: CATEGORIES
}

export type EmailStats = { total: number, byCategory: Record<CATEGORIES, number> }
