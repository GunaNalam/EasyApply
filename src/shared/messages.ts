export const FILL_MESSAGE = 'EASYAPPLY_FILL';

export interface FillResult {
  filled: number;
  kept: number;
  needs: number;
  error?: string;
}
