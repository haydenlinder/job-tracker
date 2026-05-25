export enum CATEGORIES {
  APPLICATION="application",
  INTERVIEW="interview",
  OFFER="offer",
  REJECTION="rejection",
  OPPORTUNITY="opportunity",
  OTHER="other",
  CONVERSATION="conversation",
}

export interface JobEmail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  labels: string[];
  category: CATEGORIES;
  companyName: string;
}

export interface CompanyGroup {
  companyName: string;
  emails: JobEmail[];
  category: CATEGORIES;
}

export type EmailStats = { total: number, byCategory: Record<CATEGORIES, number> }
