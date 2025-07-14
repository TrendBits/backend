export interface ApiResponse<T = any> {
  status: 'success' | 'error' | string;
  title: string;
  message: string;
  data?: T;
  meta?: any;
}
